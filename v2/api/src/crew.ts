import express, { type Router } from "express";
import { z } from "zod";
import { categories, institutions, teamById, type Action, type Actor } from "@kentbag/shared";
import type { Context } from "./server.ts";
import { handle } from "./server.ts";
import { HttpError } from "./errors.ts";
import { checkResolution } from "./vision.ts";
import { getRequest, photoLinker, rowToRequest, saveTransition } from "./requests.ts";
import type { CurrentUser } from "./access.ts";

const minutes = z.object({ remainingMinutes: z.number().int() });
const resolveBody = z.object({ note: z.string(), photoIds: z.array(z.uuid()).max(3).default([]) });
const reasonBody = z.object({ reason: z.string() });
const NOT_YOURS = "Bu iş artık ekibinizde değil. Liste yenilendi.";

export function crewRoutes(ctx: Context): Router {
  const router = express.Router();
  const link = photoLinker(ctx.config);
  const crewUser = (req: express.Request) => ctx.access.requireRole(req, "crew");
  const actor = (u: CurrentUser): Actor => ({ role: "crew", userId: u.userId, teamId: u.teamId, institution: u.institution });

  router.get(
    "/crew/queue",
    handle(async (req, res) => {
      const user = await crewUser(req);
      const team = (await ctx.db.query("SELECT * FROM team WHERE id=$1", [user.teamId])).rows[0];
      const { rows } = await ctx.db.query(
        `SELECT * FROM request WHERE team_id=$1 AND status IN ('assigned','en_route','on_site') ORDER BY queue_order NULLS LAST, created_at`,
        [user.teamId],
      );
      res.json({
        team: {
          id: team.id,
          name: team.name,
          institution: team.institution_id,
          institutionName: institutions[team.institution_id as keyof typeof institutions].name,
          onShift: team.on_shift,
          active: team.active,
        },
        jobs: rows.map((row) => {
          const r = rowToRequest(row);
          return {
            id: r.id,
            reference: r.reference,
            category: r.category,
            categoryName: categories[r.category].name,
            priority: r.priority,
            status: r.status,
            description: r.description,
            address: r.address,
            point: r.point,
            photos: r.photoIds.map(link),
            queuePosition: r.queueOrder,
            etaArrival: r.etaArrival,
            etaFinish: r.etaFinish,
            remainingMinutes: r.remainingMinutes,
            remainingSetAt: r.remainingSetAt,
            createdAt: r.createdAt,
          };
        }),
      });
    }),
  );

  router.post(
    "/crew/shift",
    handle(async (req, res) => {
      const user = await crewUser(req);
      const { onShift } = z.object({ onShift: z.boolean() }).parse(req.body);
      await ctx.db.query("UPDATE team SET on_shift=$2 WHERE id=$1", [user.teamId, onShift]);
      if (onShift) await ctx.agentService.assignWaiting(user.institution!);
      await ctx.teamChanged(user.teamId!);
      res.json({ onShift });
    }),
  );

  router.post(
    "/crew/location",
    handle(async (req, res) => {
      const user = await crewUser(req);
      const { point } = z.object({ point: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }) }).parse(req.body);
      await ctx.db.query("UPDATE team SET lat=$2, lng=$3, located_at=$4 WHERE id=$1", [user.teamId, point.lat, point.lng, ctx.now()]);
      await ctx.teamChanged(user.teamId!);
      res.status(204).end();
    }),
  );

  router.post(
    "/crew/jobs/:id/:action",
    handle(async (req, res) => {
      const user = await crewUser(req);
      const id = String(req.params.id);
      const current = await getRequest(ctx.db, id);
      if (!current || current.teamId !== user.teamId) throw new HttpError(409, NOT_YOURS);
      let action: Action;
      switch (req.params.action) {
        case "depart":
          action = { type: "depart" };
          break;
        case "arrive":
          action = { type: "arrive", remainingMinutes: minutes.parse(req.body).remainingMinutes };
          break;
        case "remaining":
          action = { type: "update_remaining", remainingMinutes: minutes.parse(req.body).remainingMinutes };
          break;
        case "resolve": {
          const input = resolveBody.parse(req.body);
          if (input.photoIds.length) {
            const { rows } = await ctx.db.query("SELECT owner_id, request_id FROM photo WHERE id = ANY($1::uuid[])", [input.photoIds]);
            if (rows.length !== input.photoIds.length || rows.some((p) => p.owner_id !== user.userId || (p.request_id && p.request_id !== id)))
              throw new HttpError(409, "Fotoğraflardan biri size ait değil.");
          }
          action = { type: "resolve", note: input.note, photoIds: input.photoIds };
          break;
        }
        case "decline":
          action = { type: "decline", reason: reasonBody.parse(req.body).reason };
          break;
        default:
          throw new HttpError(404, "Bilinmeyen işlem.");
      }
      const after = await saveTransition(ctx, id, action, actor(user), {
        inside: async (q) => {
          if (action.type === "resolve" && action.photoIds.length)
            await q.query("UPDATE photo SET request_id=$1 WHERE id = ANY($2::uuid[])", [id, action.photoIds]);
        },
      });
      if (action.type === "resolve" && action.photoIds.length) {
        // Before/after comparison is advisory and slow; it runs after the crew gets the answer.
        const work = checkResolution({ db: ctx.db, photos: ctx.photos, judge: ctx.photoJudge, now: ctx.now }, id).catch((e) =>
          console.error("Resolution check failed", e),
        );
        if (ctx.defer) ctx.defer(work);
        else await work;
      }
      if (action.type === "decline") {
        try {
          await ctx.agent.processRequest(id);
        } catch (error) {
          console.error("Agent failed after decline; sweep will retry", error);
        }
      }
      const team = teamById(user.teamId!);
      res.json({ job: { id: after.id, status: after.status, teamName: team?.name } });
    }),
  );

  return router;
}
