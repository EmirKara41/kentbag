import { randomUUID } from "node:crypto";
import express, { type Router } from "express";
import { z } from "zod";
import { institutions, oltuNeighborhoods, type InstitutionId } from "@kentbag/shared";
import { handle, type Context } from "./server.ts";
import { HttpError } from "./errors.ts";
import { getRequest } from "./requests.ts";
import { broadcastToCitizens } from "./push.ts";

const HOUR = 3_600_000;
const body = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(1000),
  neighborhood: z.enum(oltuNeighborhoods as [string, ...string[]]).nullable().default(null),
  hours: z.number().int().min(1).max(24 * 30).default(24),
  requestReference: z.string().trim().max(20).optional(),
});

const from = (institution: string | null) => (institution ? institutions[institution as InstitutionId]?.name ?? institution : "Oltu Belediyesi");

/** Notices from the municipality or an institution (planned outage, maintenance) shown on the citizen home screen. */
export function announcementRoutes(ctx: Context): Router {
  const router = express.Router();
  const staff = (req: express.Request) => ctx.access.requireRole(req, "center", "institution");

  function row(r: Record<string, any>, now: Date) {
    return {
      id: r.id,
      title: r.title,
      body: r.body,
      from: from(r.institution_id),
      institution: r.institution_id,
      neighborhood: r.neighborhood,
      requestId: r.request_id,
      requestReference: r.reference ?? null,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      active: new Date(r.starts_at) <= now && now < new Date(r.ends_at),
      createdAt: r.created_at,
    };
  }

  router.get(
    "/announcements",
    handle(async (req, res) => {
      await ctx.access.requireUser(req);
      const now = ctx.now();
      const { rows } = await ctx.db.query(
        `SELECT a.*, r.reference FROM announcement a LEFT JOIN request r ON r.id=a.request_id
         WHERE a.starts_at <= $1 AND a.ends_at > $1 ORDER BY a.created_at DESC LIMIT 20`,
        [now],
      );
      res.json({ announcements: rows.map((r) => row(r, now)) });
    }),
  );

  router.get(
    "/staff/announcements",
    handle(async (req, res) => {
      const user = await staff(req);
      const now = ctx.now();
      const { rows } = await ctx.db.query(
        `SELECT a.*, r.reference FROM announcement a LEFT JOIN request r ON r.id=a.request_id
         WHERE a.ends_at > $1 ORDER BY a.created_at DESC LIMIT 100`,
        [new Date(now.getTime() - 7 * 24 * HOUR)],
      );
      res.json({
        announcements: rows.map((r) => ({ ...row(r, now), canEnd: user.role === "center" || r.institution_id === user.institution })),
      });
    }),
  );

  router.post(
    "/staff/announcements",
    handle(async (req, res) => {
      const user = await staff(req);
      const input = body.parse(req.body);
      const now = ctx.now();
      let requestId: string | null = null;
      if (input.requestReference) {
        const found = (await ctx.db.query("SELECT id FROM request WHERE upper(reference)=upper($1)", [input.requestReference])).rows[0];
        const linked = found ? await getRequest(ctx.db, found.id) : null;
        if (!linked || (user.role === "institution" && linked.institution !== user.institution))
          throw new HttpError(400, "Bu numarada bir talep bulunamadı.");
        requestId = linked.id;
      }
      const id = randomUUID();
      const institution = user.role === "institution" ? user.institution! : null;
      await ctx.db.query(
        `INSERT INTO announcement (id, institution_id, title, body, neighborhood, request_id, starts_at, ends_at, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$7)`,
        [id, institution, input.title, input.body, input.neighborhood, requestId, now, new Date(now.getTime() + input.hours * HOUR), user.userId],
      );
      if (ctx.pushSend)
        await broadcastToCitizens(ctx.db, ctx.pushSend, {
          title: `${from(institution)}: ${input.title}`,
          body: input.neighborhood ? `${input.neighborhood} Mah. · ${input.body}` : input.body,
        }).catch((e) => console.error("Announcement push failed", e));
      const { rows } = await ctx.db.query(`SELECT a.*, r.reference FROM announcement a LEFT JOIN request r ON r.id=a.request_id WHERE a.id=$1`, [id]);
      res.status(201).json({ announcement: row(rows[0], now) });
    }),
  );

  router.post(
    "/staff/announcements/:id/end",
    handle(async (req, res) => {
      const user = await staff(req);
      const a = (await ctx.db.query("SELECT * FROM announcement WHERE id=$1", [String(req.params.id)])).rows[0];
      if (!a || (user.role === "institution" && a.institution_id !== user.institution)) throw new HttpError(404, "Duyuru bulunamadı.");
      await ctx.db.query("UPDATE announcement SET ends_at=LEAST(ends_at, $2) WHERE id=$1", [a.id, ctx.now()]);
      res.status(204).end();
    }),
  );

  return router;
}
