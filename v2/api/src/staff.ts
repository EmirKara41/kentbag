import express, { type Router } from "express";
import { z } from "zod";
import {
  categories,
  institutionIds,
  institutions,
  queueEta,
  statusLabel,
  teamById,
  type Actor,
  type CitizenRequest,
  type InstitutionId,
} from "@kentbag/shared";
import type { Context } from "./server.ts";
import { handle } from "./server.ts";
import { HttpError } from "./errors.ts";
import { getEvents, getRequest, photoLinker, placeInQueue, rowToRequest, saveTransition } from "./requests.ts";
import { agentSettings, setAgent } from "./settings.ts";
import { loadTeams } from "./agent.ts";
import type { CurrentUser } from "./access.ts";

const institutionEnum = z.enum(institutionIds as [InstitutionId, ...InstitutionId[]]);

export function staffRoutes(ctx: Context): Router {
  const router = express.Router();
  const link = photoLinker(ctx.config);
  const staff = (req: express.Request) => ctx.access.requireRole(req, "center", "institution");
  const actor = (u: CurrentUser): Actor => ({ role: u.role, userId: u.userId, institution: u.institution });

  function row(r: CitizenRequest) {
    const team = r.teamId ? teamById(r.teamId) : null;
    return {
      id: r.id,
      reference: r.reference,
      kind: r.kind,
      category: r.category,
      categoryName: categories[r.category].name,
      priority: r.priority,
      status: r.status,
      statusLabel: statusLabel(r),
      institution: r.institution,
      institutionName: r.institution ? institutions[r.institution].name : null,
      teamId: r.teamId,
      teamName: team?.name ?? null,
      queuePosition: r.queueOrder,
      address: r.address,
      point: r.point,
      description: r.description,
      etaArrival: r.etaArrival,
      etaFinish: r.etaFinish,
      agentReason: r.agentReason,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async function visible(user: CurrentUser, id: string) {
    const r = await getRequest(ctx.db, id);
    if (!r || (user.role === "institution" && r.institution !== user.institution)) throw new HttpError(404, "Talep bulunamadı.");
    return r;
  }

  router.get(
    "/staff/requests",
    handle(async (req, res) => {
      const user = await staff(req);
      const params: unknown[] = [];
      const where: string[] = [];
      if (user.role === "institution") {
        params.push(user.institution);
        where.push(`institution_id=$${params.length}`);
      } else if (req.query.institution) {
        params.push(String(req.query.institution));
        where.push(`institution_id=$${params.length}`);
      }
      if (req.query.status) {
        params.push(String(req.query.status).split(","));
        where.push(`status = ANY($${params.length})`);
      }
      if (req.query.q) {
        params.push(`%${String(req.query.q)}%`);
        where.push(`(reference ILIKE $${params.length} OR description ILIKE $${params.length} OR address ILIKE $${params.length})`);
      }
      const { rows } = await ctx.db.query(
        `SELECT * FROM request ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT 300`,
        params,
      );
      res.json({ requests: rows.map((x) => row(rowToRequest(x))) });
    }),
  );

  router.get(
    "/staff/requests/:id",
    handle(async (req, res) => {
      const user = await staff(req);
      const r = await visible(user, String(req.params.id));
      const events = await getEvents(ctx.db, r.id, false);
      let citizenName: string | undefined;
      if (user.role === "center")
        citizenName = (await ctx.db.query(`SELECT name FROM "user" WHERE id=$1`, [r.citizenId])).rows[0]?.name;
      res.json({
        request: {
          ...row(r),
          citizenName,
          photos: r.photoIds.map(link),
          resolutionNote: r.resolutionNote,
          resolutionPhotos: r.resolutionPhotoIds.map(link),
          events: events.map((e) => ({ id: e.id, status: e.status, type: e.type, body: e.body, public: e.public, actorRole: e.actorRole, at: e.at })),
        },
      });
    }),
  );

  router.post(
    "/staff/requests/:id/route",
    handle(async (req, res) => {
      const user = await ctx.access.requireRole(req, "center");
      const { institution } = z.object({ institution: institutionEnum }).parse(req.body);
      const r = await visible(user, String(req.params.id));
      await saveTransition(ctx, r.id, { type: "route", institution, reason: "Merkez tarafından elle yönlendirildi." }, actor(user));
      try {
        await ctx.agent.processRequest(r.id);
      } catch (error) {
        console.error("Agent failed after manual route", error);
      }
      res.json({ request: row((await getRequest(ctx.db, r.id))!) });
    }),
  );

  router.post(
    "/staff/requests/:id/assign",
    handle(async (req, res) => {
      const user = await staff(req);
      const { teamId } = z.object({ teamId: z.string() }).parse(req.body);
      const r = await getRequest(ctx.db, String(req.params.id));
      if (!r) throw new HttpError(404, "Talep bulunamadı.");
      const team = teamById(teamId);
      if (user.role === "institution" && (r.institution !== user.institution || team?.institution !== user.institution))
        throw new HttpError(403, "Bu talep veya ekip kurumunuza ait değil.");
      const label = user.role === "center" ? "Merkez" : "Kurum";
      const after = await saveTransition(ctx, r.id, { type: "assign", teamId, reason: `${label} tarafından elle atandı.` }, actor(user), {
        inside: (q) => placeInQueue(q, r.id, teamId, 10_000),
      });
      res.json({ request: row(after) });
    }),
  );

  router.post(
    "/staff/requests/:id/cancel",
    handle(async (req, res) => {
      const user = await staff(req);
      const { reason } = z.object({ reason: z.string() }).parse(req.body);
      const r = await visible(user, String(req.params.id));
      const after = await saveTransition(ctx, r.id, { type: "cancel", reason }, actor(user));
      res.json({ request: row(after) });
    }),
  );

  router.post(
    "/staff/requests/:id/suggest",
    handle(async (req, res) => {
      const user = await staff(req);
      const r = await visible(user, String(req.params.id));
      res.json(await ctx.agentService.suggest(r.id));
    }),
  );

  router.get(
    "/staff/teams",
    handle(async (req, res) => {
      const user = await staff(req);
      const ids = user.role === "institution" ? [user.institution!] : req.query.institution ? [String(req.query.institution) as InstitutionId] : institutionIds;
      const now = ctx.now();
      const out = [];
      for (const id of ids) {
        for (const team of await loadTeams(ctx.db, id)) {
          const eta = queueEta({ now, teamPoint: team.point, teamPointAt: team.pointAt, jobs: team.jobs, travel: () => 0 });
          const jobs = [];
          for (const [i, job] of team.jobs.entries()) {
            const r = (await getRequest(ctx.db, job.requestId))!;
            jobs.push({ ...row(r), etaArrival: r.etaArrival ?? eta[i].arrival, etaFinish: r.etaFinish ?? eta[i].finish });
          }
          out.push({
            id: team.id,
            name: team.name,
            institution: id,
            institutionName: institutions[id].name,
            onShift: team.onShift,
            active: team.active,
            locatedAt: team.pointAt,
            jobs,
          });
        }
      }
      res.json({ teams: out });
    }),
  );

  router.patch(
    "/staff/teams/:id",
    handle(async (req, res) => {
      const user = await staff(req);
      const team = teamById(String(req.params.id));
      if (!team) throw new HttpError(404, "Ekip bulunamadı.");
      if (user.role === "institution" && team.institution !== user.institution) throw new HttpError(403, "Bu ekip kurumunuza ait değil.");
      const { active } = z.object({ active: z.boolean() }).parse(req.body);
      await ctx.db.query("UPDATE team SET active=$2 WHERE id=$1", [team.id, active]);
      if (active) await ctx.agentService.assignWaiting(team.institution);
      res.json({ id: team.id, active });
    }),
  );

  router.get(
    "/staff/agent",
    handle(async (req, res) => {
      await staff(req);
      res.json(await agentSettings(ctx.db));
    }),
  );

  router.put(
    "/staff/agent",
    handle(async (req, res) => {
      const user = await staff(req);
      const input = z
        .object({ center: z.boolean().optional(), institutions: z.partialRecord(institutionEnum, z.boolean()).optional() })
        .parse(req.body);
      const changes = Object.entries(input.institutions ?? {}) as [InstitutionId, boolean][];
      if (user.role === "institution" && (input.center !== undefined || changes.some(([id]) => id !== user.institution)))
        throw new HttpError(403, "Yalnız kendi kurumunuzun ajan ayarını değiştirebilirsiniz.");
      if (input.center !== undefined) await setAgent(ctx.db, "center", input.center);
      for (const [id, on] of changes) await setAgent(ctx.db, id, on);
      res.json(await agentSettings(ctx.db));
    }),
  );

  router.post(
    "/agent/sweep",
    handle(async (req, res) => {
      await staff(req);
      res.json(await ctx.agentService.sweep());
    }),
  );

  return router;
}
