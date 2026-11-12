import { randomUUID } from "node:crypto";
import express, { type Router } from "express";
import { z } from "zod";
import { fileTypeFromBuffer } from "file-type";
import { imageSize } from "image-size";
import { categories, type CategoryId } from "@kentbag/shared";
import type { Context } from "./server.ts";
import { handle } from "./server.ts";
import { HttpError } from "./errors.ts";
import { citizenView, getEvents, getRequest, insertEvent, photoLinker, rowToRequest, saveTransition } from "./requests.ts";
import { verifyPhotoUrl } from "./photos.ts";

const point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const createBody = z.object({
  clientRequestId: z.string().min(8).max(80),
  category: z.enum(Object.keys(categories) as [CategoryId, ...CategoryId[]]),
  description: z.string().trim().min(10).max(1000),
  address: z.string().trim().max(300).default(""),
  point: point.nullable().optional(),
  photoIds: z.array(z.uuid()).max(3).default([]),
});
const noteBody = z.object({ note: z.string(), photoIds: z.array(z.uuid()).max(3).default([]) });
const reasonBody = z.object({ reason: z.string() });

const referenceFor = (id: string) => "KB-" + id.replace(/-/g, "").slice(0, 6).toUpperCase();

export function citizenRoutes(ctx: Context): Router {
  const router = express.Router();
  const link = photoLinker(ctx.config);

  async function ownPhotos(userId: string, ids: string[], requestId: string | null) {
    if (!ids.length) return;
    const { rows } = await ctx.db.query(`SELECT id, owner_id, request_id FROM photo WHERE id = ANY($1::uuid[])`, [ids]);
    if (
      rows.length !== ids.length ||
      rows.some((p) => p.owner_id !== userId || (p.request_id && p.request_id !== requestId))
    )
      throw new HttpError(409, "Fotoğraflardan biri sana ait değil veya başka bir talepte kullanılmış.");
  }

  async function ownRequest(userId: string, id: string) {
    const r = await getRequest(ctx.db, id);
    if (!r || r.citizenId !== userId) throw new HttpError(404, "Talep bulunamadı.");
    return r;
  }

  async function view(id: string) {
    const r = (await getRequest(ctx.db, id))!;
    return citizenView(r, await getEvents(ctx.db, id, true), link);
  }

  router.put(
    "/photos/:clientId",
    express.raw({ type: ["image/jpeg", "image/png"], limit: "3mb" }),
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      const clientId = String(req.params.clientId);
      if (!/^[\w-]{1,80}$/.test(clientId)) throw new HttpError(400, "Geçersiz fotoğraf kimliği.");
      const existing = await ctx.db.query(`SELECT id FROM photo WHERE owner_id=$1 AND client_id=$2`, [user.userId, clientId]);
      if (existing.rows[0]) return void res.json({ id: existing.rows[0].id });
      const bytes = req.body as Buffer;
      if (!Buffer.isBuffer(bytes) || !bytes.length) throw new HttpError(400, "Fotoğraf okunamadı.");
      const type = await fileTypeFromBuffer(bytes);
      if (!type || !["image/jpeg", "image/png"].includes(type.mime)) throw new HttpError(400, "Yalnızca JPEG veya PNG fotoğraf yüklenebilir.");
      const size = imageSize(bytes);
      if (!size.width || !size.height || size.width > 8000 || size.height > 8000) throw new HttpError(400, "Fotoğraf boyutu uygun değil.");
      const id = randomUUID();
      const path = await ctx.photos.put(`${user.userId}/${id}.${type.ext}`, bytes, type.mime);
      await ctx.db.query(`INSERT INTO photo (id, owner_id, client_id, path, content_type) VALUES ($1,$2,$3,$4,$5)`, [
        id, user.userId, clientId, path, type.mime,
      ]);
      res.json({ id });
    }),
  );

  router.get(
    "/photos/:id",
    handle(async (req, res) => {
      const id = String(req.params.id);
      if (!verifyPhotoUrl(ctx.config.secret, id, String(req.query.expires ?? ""), String(req.query.signature ?? "")))
        throw new HttpError(403, "Fotoğraf bağlantısının süresi dolmuş.");
      const { rows } = await ctx.db.query(`SELECT path, content_type FROM photo WHERE id=$1`, [id]);
      const bytes = rows[0] ? await ctx.photos.get(rows[0].path) : null;
      if (!bytes) throw new HttpError(404, "Fotoğraf bulunamadı.");
      res.setHeader("Cache-Control", "private, max-age=600");
      res.type(rows[0].content_type).send(bytes);
    }),
  );

  router.post(
    "/requests",
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      const input = createBody.parse(req.body);
      if (!input.point && input.address.length < 5) throw new HttpError(400, "Konum seç veya adres yaz.");
      const existing = await ctx.db.query(`SELECT * FROM request WHERE citizen_id=$1 AND client_request_id=$2`, [
        user.userId, input.clientRequestId,
      ]);
      if (existing.rows[0]) return void res.status(200).json({ request: await view(existing.rows[0].id) });
      await ownPhotos(user.userId, input.photoIds, null);
      const id = randomUUID();
      const now = ctx.now();
      const point = input.point ?? (input.address ? await ctx.geocode(input.address) : null);
      const created = await ctx.db.tx(async (q) => {
        const { rows } = await q.query(
          `INSERT INTO request (id, reference, citizen_id, client_request_id, kind, category, description, address, lat, lng, photo_ids, status, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'received',$12,$12)
           ON CONFLICT (citizen_id, client_request_id) DO NOTHING RETURNING *`,
          [id, referenceFor(id), user.userId, input.clientRequestId, categories[input.category].kind, input.category,
            input.description, input.address, point?.lat ?? null, point?.lng ?? null, input.photoIds, now],
        );
        if (!rows[0]) return null;
        if (input.photoIds.length) await q.query(`UPDATE photo SET request_id=$1 WHERE id = ANY($2::uuid[])`, [id, input.photoIds]);
        await insertEvent(q, { requestId: id, status: "received", type: "created", body: "Talebin alındı.", public: true, actorRole: "citizen", actorId: user.userId, at: now });
        return rowToRequest(rows[0]);
      });
      if (!created) {
        const again = await ctx.db.query(`SELECT id FROM request WHERE citizen_id=$1 AND client_request_id=$2`, [user.userId, input.clientRequestId]);
        return void res.status(200).json({ request: await view(again.rows[0].id) });
      }
      try {
        await ctx.agent.processRequest(created.id);
      } catch (error) {
        console.error("Agent failed; sweep will retry", error);
      }
      res.status(201).json({ request: await view(created.id) });
    }),
  );

  router.get(
    "/requests/mine",
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      // Retry the agent for this citizen's stuck requests, so nothing waits for a staff panel to be open.
      const stuck = await ctx.db.query(
        `SELECT id FROM request WHERE citizen_id=$1 AND status IN ('received','routed','returned','reopened') AND updated_at <= $2`,
        [user.userId, new Date(ctx.now().getTime() - 60_000)],
      );
      for (const row of stuck.rows) await ctx.agent.processRequest(row.id).catch((e) => console.error("Agent retry failed", e));
      const { rows } = await ctx.db.query(`SELECT id FROM request WHERE citizen_id=$1 ORDER BY created_at DESC LIMIT 100`, [user.userId]);
      res.json({ requests: await Promise.all(rows.map((r) => view(r.id))) });
    }),
  );

  router.get(
    "/requests/:id",
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      const r = await ownRequest(user.userId, String(req.params.id));
      res.json({ request: await view(r.id) });
    }),
  );

  router.post(
    "/requests/:id/reopen",
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      const r = await ownRequest(user.userId, String(req.params.id));
      const input = noteBody.parse(req.body);
      await ownPhotos(user.userId, input.photoIds, r.id);
      await saveTransition(ctx, r.id, { type: "reopen", note: input.note, photoIds: input.photoIds }, { role: "citizen", userId: user.userId });
      if (input.photoIds.length) await ctx.db.query(`UPDATE photo SET request_id=$1 WHERE id = ANY($2::uuid[])`, [r.id, input.photoIds]);
      try {
        await ctx.agent.processRequest(r.id);
      } catch (error) {
        console.error("Agent failed; sweep will retry", error);
      }
      res.json({ request: await view(r.id) });
    }),
  );

  router.post(
    "/requests/:id/cancel",
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      const r = await ownRequest(user.userId, String(req.params.id));
      const input = reasonBody.parse(req.body);
      await saveTransition(ctx, r.id, { type: "cancel", reason: input.reason }, { role: "citizen", userId: user.userId });
      res.json({ request: await view(r.id) });
    }),
  );

  return router;
}
