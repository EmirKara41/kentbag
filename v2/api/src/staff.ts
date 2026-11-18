import express, { type Router } from "express";
import { z } from "zod";
import {
  categories,
  outsideServiceArea,
  referralContacts,
  referralMessage,
  serviceArea,
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
import type { Row } from "./db.ts";
import { distanceMeters, NEARBY_METERS } from "./nearby.ts";

/** Supporter and merged-request counts, joined onto request rows for staff lists. */
const WITH_COUNTS = `SELECT r.*,
  (SELECT count(*) FROM request_supporter s WHERE s.request_id = r.id) AS support_count,
  (SELECT count(*) FROM request m WHERE m.merged_into = r.id) AS merged_count
  FROM request r`;

const institutionEnum = z.enum(institutionIds as [InstitutionId, ...InstitutionId[]]);

export function staffRoutes(ctx: Context): Router {
  const router = express.Router();
  const link = photoLinker(ctx.config);
  const staff = (req: express.Request) => ctx.access.requireRole(req, "center", "institution");
  const actor = (u: CurrentUser): Actor => ({ role: u.role, userId: u.userId, institution: u.institution });

  function row(r: CitizenRequest, counts?: Row) {
    const team = r.teamId ? teamById(r.teamId) : null;
    return {
      mergedInto: r.mergedInto,
      supportCount: Number(counts?.support_count ?? 0),
      mergedCount: Number(counts?.merged_count ?? 0),
      referral: (counts?.referral ?? null) as { district: string; province: string | null; contacts: { name: string; phone: string; why: string }[] } | null,
      photoCheck: (counts?.photo_check ?? null) as { verdict: string; note: string } | null,
      resolutionCheck: (counts?.resolution_check ?? null) as { verdict: string; note: string } | null,
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
      if (req.query.kind === "issue" || req.query.kind === "improvement") {
        params.push(req.query.kind);
        where.push(`kind=$${params.length}`);
      }
      const { rows } = await ctx.db.query(
        `${WITH_COUNTS} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT 300`,
        params,
      );
      res.json({ requests: rows.map((x) => row(rowToRequest(x), x)) });
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
      const counts = (await ctx.db.query(`${WITH_COUNTS} WHERE r.id=$1`, [r.id])).rows[0];
      const merged = (await ctx.db.query(`SELECT id, reference FROM request WHERE merged_into=$1 ORDER BY created_at`, [r.id])).rows;
      const mergedIntoReference = r.mergedInto
        ? ((await ctx.db.query(`SELECT reference FROM request WHERE id=$1`, [r.mergedInto])).rows[0]?.reference ?? null)
        : null;
      res.json({
        request: {
          ...row(r, counts),
          merged: merged.map((m) => ({ id: m.id, reference: m.reference })),
          mergedIntoReference,
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

  // Improvement requests: the institution decides; no crew is involved.
  const decisions = {
    plan: z.object({ note: z.string() }),
    reject: z.object({ reason: z.string() }),
    complete: z.object({ note: z.string() }),
  };
  for (const type of ["plan", "reject", "complete"] as const)
    router.post(
      `/staff/requests/:id/${type}`,
      handle(async (req, res) => {
        const user = await staff(req);
        const r = await visible(user, String(req.params.id));
        const input = decisions[type].parse(req.body) as { note?: string; reason?: string };
        const action =
          type === "reject" ? { type, reason: input.reason ?? "" } : { type, note: input.note ?? "" };
        const after = await saveTransition(ctx, r.id, action, actor(user));
        res.json({ request: row(after) });
      }),
    );

  /** Center marks a request as outside Oltu; the citizen gets the numbers to call. */
  router.post(
    "/staff/requests/:id/refer",
    handle(async (req, res) => {
      const user = await ctx.access.requireRole(req, "center");
      const { district } = z.object({ district: z.string().trim().min(2).max(60).optional() }).parse(req.body ?? {});
      const r = await visible(user, String(req.params.id));
      const found = r.point ? await ctx.locate(r.point).catch(() => null) : null;
      const place = district ? { district, province: found?.province ?? serviceArea.province } : found;
      if (!place?.district) throw new HttpError(400, "İlçe bulunamadı; ilçeyi yazın.");
      if (!outsideServiceArea(place)) throw new HttpError(409, `Bu konum ${serviceArea.district} içinde görünüyor.`);
      const referral = { ...place, contacts: referralContacts(r.category, place, r.priority) };
      const after = await saveTransition(ctx, r.id, { type: "refer", message: referralMessage(place) }, actor(user), {
        inside: (q) => q.query("UPDATE request SET referral=$2 WHERE id=$1", [r.id, JSON.stringify(referral)]).then(() => undefined),
      });
      res.json({ request: row(after) });
    }),
  );

  /** Open requests of the same category within 1.5 km, candidates for merging. */
  router.get(
    "/staff/requests/:id/similar",
    handle(async (req, res) => {
      const user = await staff(req);
      const r = await visible(user, String(req.params.id));
      if (!r.point) return void res.json({ requests: [] });
      const params: unknown[] = [r.category, r.id];
      let scope = "";
      if (user.role === "institution") {
        params.push(user.institution);
        scope = `AND r.institution_id=$${params.length}`;
      }
      const { rows } = await ctx.db.query(
        `${WITH_COUNTS} WHERE r.category=$1 AND r.id<>$2 AND r.lat IS NOT NULL
           AND r.status NOT IN ('resolved','cancelled','rejected','merged') ${scope}
         ORDER BY r.created_at LIMIT 200`,
        params,
      );
      const similar = rows
        .map((x) => ({ x, distance: distanceMeters(r.point!, { lat: Number(x.lat), lng: Number(x.lng) }) }))
        .filter((s) => s.distance <= NEARBY_METERS)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10)
        .map(({ x, distance }) => ({ ...row(rowToRequest(x), x), distanceMeters: Math.round(distance) }));
      res.json({ requests: similar });
    }),
  );

  /** Joins this request into another one about the same problem. */
  router.post(
    "/staff/requests/:id/merge",
    handle(async (req, res) => {
      const user = await staff(req);
      const { into } = z.object({ into: z.uuid() }).parse(req.body);
      const r = await visible(user, String(req.params.id));
      let target = await visible(user, into);
      if (target.status === "merged" && target.mergedInto) target = await visible(user, target.mergedInto);
      if (target.id === r.id) throw new HttpError(409, "Talep kendisiyle birleştirilemez.");
      if (target.category !== r.category) throw new HttpError(409, "Yalnız aynı kategorideki talepler birleştirilebilir.");
      if (["resolved", "cancelled", "rejected", "merged"].includes(target.status))
        throw new HttpError(409, "Birleştirilecek talep açık olmalı.");
      const after = await saveTransition(ctx, r.id, { type: "merge", into: target.id, reference: target.reference }, actor(user), {
        inside: async (q) => {
          // Anything that followed or was merged into this request now follows the target.
          await q.query(`UPDATE request SET merged_into=$2 WHERE merged_into=$1`, [r.id, target.id]);
          await q.query(
            `INSERT INTO request_supporter (request_id, user_id, created_at)
             SELECT $2, user_id, created_at FROM request_supporter WHERE request_id=$1 AND user_id <> $3
             ON CONFLICT DO NOTHING`,
            [r.id, target.id, target.citizenId],
          );
          await q.query(`DELETE FROM request_supporter WHERE request_id=$1`, [r.id]);
        },
      });
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
