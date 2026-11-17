import { randomUUID } from "node:crypto";
import express, { type Router } from "express";
import { z } from "zod";
import { fileTypeFromBuffer } from "file-type";
import { imageSize } from "image-size";
import { categories, isOpen, type CategoryId, type CitizenRequest, type RequestEvent } from "@kentbag/shared";
import type { Context } from "./server.ts";
import { handle } from "./server.ts";
import { HttpError } from "./errors.ts";
import { citizenView, getEvents, getRequest, insertEvent, photoLinker, rowToRequest, saveTransition } from "./requests.ts";
import { verifyPhotoUrl } from "./photos.ts";
import { distanceMeters, NEARBY_METERS } from "./nearby.ts";

const point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const categoryEnum = z.enum(Object.keys(categories) as [CategoryId, ...CategoryId[]]);
const createBody = z.object({
  clientRequestId: z.string().min(8).max(80),
  category: categoryEnum,
  description: z.string().trim().min(10).max(1000),
  address: z.string().trim().max(300).default(""),
  point: point.nullable().optional(),
  photoIds: z.array(z.uuid()).max(3).default([]),
});
const noteBody = z.object({ note: z.string(), photoIds: z.array(z.uuid()).max(3).default([]) });
const reasonBody = z.object({ reason: z.string() });
const nearbyQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  category: categoryEnum,
});

const referenceFor = (id: string) => "KB-" + id.replace(/-/g, "").slice(0, 6).toUpperCase();

export function citizenRoutes(ctx: Context): Router {
  const router = express.Router();
  const link = photoLinker(ctx.config);
  const lastRetry = new Map<string, number>();
  const locationCalls = new Map<string, number[]>();

  /** Shared budget for location-based lookups (nearby list and following), so the map cannot be scanned. */
  function throttleLocation(userId: string) {
    const nowMs = ctx.now().getTime();
    const recent = (locationCalls.get(userId) ?? []).filter((t) => nowMs - t < 60_000);
    if (recent.length >= 20) throw new HttpError(429, "Çok sık denendi. Biraz sonra tekrar dene.");
    locationCalls.set(userId, [...recent, nowMs]);
  }

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

  const isSupporter = async (userId: string, id: string) =>
    (await ctx.db.query("SELECT 1 FROM request_supporter WHERE request_id=$1 AND user_id=$2", [id, userId])).rows.length > 0;

  /** Whether anyone besides the owner reported or follows this problem. */
  async function othersAffected(id: string) {
    const { rows } = await ctx.db.query(
      `SELECT (SELECT count(*) FROM request_supporter WHERE request_id=$1) + (SELECT count(*) FROM request WHERE merged_into=$1) AS n`,
      [id],
    );
    return Number(rows[0].n) > 0;
  }

  /**
   * What a citizen sees. A merged request shows the progress of the request it joined;
   * a followed request (someone else's) hides that person's text and photos.
   */
  async function view(id: string, viewerId: string) {
    const r = (await getRequest(ctx.db, id))!;
    const own = r.citizenId === viewerId;
    let shown: CitizenRequest = r;
    let events: RequestEvent[] = await getEvents(ctx.db, id, true);
    let mergedWith: string | null = null;
    if (r.status === "merged" && r.mergedInto) {
      const primary = await getRequest(ctx.db, r.mergedInto);
      if (primary) {
        mergedWith = primary.reference;
        const mergedAt = [...events].reverse().find((e) => e.type === "merge")?.at ?? r.updatedAt;
        shown = {
          ...primary,
          id: r.id,
          reference: r.reference,
          citizenId: r.citizenId,
          kind: r.kind,
          category: r.category,
          description: r.description,
          address: r.address || primary.address,
          point: r.point ?? primary.point,
          photoIds: r.photoIds,
          createdAt: r.createdAt,
          mergedInto: primary.id,
        };
        const later = (await getEvents(ctx.db, primary.id, true)).filter((e) => e.at > mergedAt && e.actorRole !== "citizen");
        events = [...events, ...later].sort((a, b) => a.at.getTime() - b.at.getTime());
      }
    }
    if (!own) {
      // A follower sees the shared problem's progress, not the reporter's words, photos or exact spot.
      shown = { ...shown, description: "", photoIds: [], point: null };
      events = events.filter((e) => e.actorRole !== "citizen");
    }
    const primaryDone = r.status === "merged" && !isOpen(shown.status);
    return {
      ...citizenView(shown, events, link),
      relation: own ? ("own" as const) : ("following" as const),
      mergedWith,
      othersAffected: await othersAffected(shown.mergedInto ?? r.id),
      canReopen: own && shown.kind === "issue" && (r.status === "resolved" || primaryDone),
      canCancel: own && (isOpen(r.status) || (r.status === "merged" && !primaryDone)),
    };
  }

  async function visibleTo(userId: string, id: string) {
    const r = await getRequest(ctx.db, id);
    if (!r || (r.citizenId !== userId && !(await isSupporter(userId, id)))) throw new HttpError(404, "Talep bulunamadı.");
    return r;
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
      if (existing.rows[0]) return void res.status(200).json({ request: await view(existing.rows[0].id, user.userId) });
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
        return void res.status(200).json({ request: await view(again.rows[0].id, user.userId) });
      }
      try {
        await ctx.agent.processRequest(created.id);
      } catch (error) {
        console.error("Agent failed; sweep will retry", error);
      }
      res.status(201).json({ request: await view(created.id, user.userId) });
    }),
  );

  router.get(
    "/requests/mine",
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      // Retry the agent for this citizen's stuck requests, so nothing waits for a staff panel to be open.
      // At most once a minute per citizen and 3 requests per retry, so polling cannot multiply the work.
      const nowMs = ctx.now().getTime();
      if (nowMs - (lastRetry.get(user.userId) ?? 0) >= 60_000) {
        lastRetry.set(user.userId, nowMs);
        const stuck = await ctx.db.query(
          `SELECT id FROM request WHERE citizen_id=$1 AND status IN ('received','routed','returned','reopened') AND updated_at <= $2
             AND (kind='issue' OR status='received')
           ORDER BY created_at LIMIT 3`,
          [user.userId, new Date(nowMs - 60_000)],
        );
        for (const row of stuck.rows) await ctx.agent.processRequest(row.id).catch((e) => console.error("Agent retry failed", e));
      }
      // Own requests and the ones this citizen follows ("Ben de etkileniyorum").
      const { rows } = await ctx.db.query(
        `SELECT id, created_at FROM request WHERE citizen_id=$1
         UNION SELECT r.id, r.created_at FROM request_supporter s JOIN request r ON r.id=s.request_id WHERE s.user_id=$1
         ORDER BY created_at DESC LIMIT 100`,
        [user.userId],
      );
      res.json({ requests: await Promise.all(rows.map((r) => view(r.id, user.userId))) });
    }),
  );

  router.get(
    "/requests/nearby",
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      if (user.role !== "citizen") throw new HttpError(403, "Bu işlem vatandaşlar içindir.");
      throttleLocation(user.userId);
      const { lat, lng, category } = nearbyQuery.parse(req.query);
      const dLat = NEARBY_METERS / 111_000;
      const dLng = dLat / Math.cos((lat * Math.PI) / 180);
      const { rows } = await ctx.db.query(
        `SELECT r.*, EXISTS (SELECT 1 FROM request_supporter s WHERE s.request_id=r.id AND s.user_id=$2) AS supporting
         FROM request r WHERE r.category=$1 AND r.citizen_id<>$2
           AND r.status NOT IN ('resolved','cancelled','rejected','merged')
           AND r.lat BETWEEN $3 AND $4 AND r.lng BETWEEN $5 AND $6
         ORDER BY r.created_at DESC LIMIT 50`,
        [category, user.userId, lat - dLat, lat + dLat, lng - dLng, lng + dLng],
      );
      const here = { lat, lng };
      const nearby = rows
        .map((row) => {
          const r = rowToRequest(row);
          return { r, supporting: row.supporting as boolean, distance: distanceMeters(here, r.point!) };
        })
        .filter((x) => x.distance <= NEARBY_METERS)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5);
      res.json({
        requests: nearby.map(({ r, supporting, distance }) => {
          const v = citizenView({ ...r, description: "", photoIds: [] }, [], link);
          return {
            id: v.id,
            reference: v.reference,
            kind: v.kind,
            categoryName: v.categoryName,
            status: v.status,
            statusLabel: v.statusLabel,
            etaArrival: v.etaArrival,
            etaFinish: v.etaFinish,
            createdAt: v.createdAt,
            // Rounded, and no address: enough to recognise the problem, not to locate a person.
            distanceMeters: Math.max(100, Math.round(distance / 100) * 100),
            supporting,
          };
        }),
      });
    }),
  );

  router.get(
    "/requests/:id",
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      const r = await visibleTo(user.userId, String(req.params.id));
      res.json({ request: await view(r.id, user.userId) });
    }),
  );

  router.post(
    "/requests/:id/support",
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      if (user.role !== "citizen") throw new HttpError(403, "Bu işlem vatandaşlar içindir.");
      throttleLocation(user.userId);
      const where = point.parse(req.body?.point);
      let r = await getRequest(ctx.db, String(req.params.id));
      if (r?.status === "merged" && r.mergedInto) r = await getRequest(ctx.db, r.mergedInto);
      if (!r || !isOpen(r.status)) throw new HttpError(404, "Bu sorun artık açık değil.");
      // Only people near the problem can join it, so request ids cannot be used to follow strangers.
      if (!r.point || distanceMeters(where, r.point) > NEARBY_METERS) throw new HttpError(404, "Yakınında böyle bir sorun bulunamadı.");
      if (r.citizenId === user.userId) throw new HttpError(409, "Bu talebi zaten sen bildirdin.");
      await ctx.db.query("INSERT INTO request_supporter (request_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [r.id, user.userId]);
      res.json({ request: await view(r.id, user.userId) });
    }),
  );

  router.delete(
    "/requests/:id/support",
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      await ctx.db.query("DELETE FROM request_supporter WHERE request_id=$1 AND user_id=$2", [String(req.params.id), user.userId]);
      res.status(204).end();
    }),
  );

  router.post(
    "/requests/:id/reopen",
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      const r = await ownRequest(user.userId, String(req.params.id));
      const input = noteBody.parse(req.body);
      if (r.status === "merged" && r.mergedInto) {
        const primary = await getRequest(ctx.db, r.mergedInto);
        if (primary && isOpen(primary.status))
          throw new HttpError(409, "Birleştirildiğin talep hâlâ sürüyor; iş bitince sorun devam ederse yeniden açabilirsin.");
      }
      await ownPhotos(user.userId, input.photoIds, r.id);
      await saveTransition(ctx, r.id, { type: "reopen", note: input.note, photoIds: input.photoIds }, { role: "citizen", userId: user.userId });
      if (input.photoIds.length) await ctx.db.query(`UPDATE photo SET request_id=$1 WHERE id = ANY($2::uuid[])`, [r.id, input.photoIds]);
      try {
        await ctx.agent.processRequest(r.id);
      } catch (error) {
        console.error("Agent failed; sweep will retry", error);
      }
      res.json({ request: await view(r.id, user.userId) });
    }),
  );

  router.post(
    "/requests/:id/cancel",
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      const r = await ownRequest(user.userId, String(req.params.id));
      const input = reasonBody.parse(req.body);
      await saveTransition(ctx, r.id, { type: "cancel", reason: input.reason }, { role: "citizen", userId: user.userId });
      res.json({ request: await view(r.id, user.userId) });
    }),
  );

  return router;
}
