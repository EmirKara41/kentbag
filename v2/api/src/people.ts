import { randomUUID } from "node:crypto";
import express, { type Router } from "express";
import { z } from "zod";
import { institutionIds, institutions, teamById, type InstitutionId } from "@kentbag/shared";
import { handle, type Context } from "./server.ts";
import { HttpError } from "./errors.ts";
import type { CurrentUser } from "./access.ts";
import type { Db } from "./db.ts";

const institutionEnum = z.enum(institutionIds as [InstitutionId, ...InstitutionId[]]);
const roleLabel = { center: "Belediye merkezi", institution: "Kurum", crew: "Saha ekibi" } as const;

const newAccount = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().transform((e) => e.trim().toLowerCase()),
  password: z.string().min(8).max(128).optional(),
  role: z.enum(["center", "institution", "crew"]),
  institution: institutionEnum.optional(),
  teamId: z.string().optional(),
});

/** Ends every session and push registration of a user (on deactivation or role change). */
async function signOutEverywhere(db: Db, userId: string) {
  await db.query(`DELETE FROM session WHERE "userId"=$1`, [userId]);
  await db.query(`DELETE FROM push_token WHERE user_id=$1`, [userId]);
}

/** Staff accounts, crew applications and the "forgot password" entry point. */
export function peopleRoutes(ctx: Context): Router {
  const router = express.Router();
  const staff = (req: express.Request) => ctx.access.requireRole(req, "center", "institution");

  /** Institutions manage only their own crews; the center manages everyone. */
  function canManage(user: CurrentUser, target: { role: string; institution?: string | null }) {
    if (user.role === "center") return true;
    return target.role === "crew" && target.institution === user.institution;
  }

  function accountRow(r: Record<string, any>) {
    const team = r.team_id ? teamById(r.team_id) : null;
    return {
      userId: r.user_id,
      name: r.name,
      email: r.email,
      role: r.role,
      roleLabel: roleLabel[r.role as keyof typeof roleLabel],
      institution: r.institution_id,
      institutionName: r.institution_id ? institutions[r.institution_id as InstitutionId]?.name : null,
      teamId: r.team_id,
      teamName: team?.name ?? null,
      active: r.active,
      createdAt: r.created_at,
    };
  }

  router.get(
    "/staff/accounts",
    handle(async (req, res) => {
      const user = await staff(req);
      const scoped = user.role === "institution";
      const { rows } = await ctx.db.query(
        `SELECT s.*, u.name, u.email FROM staff s JOIN "user" u ON u.id = s.user_id
         ${scoped ? "WHERE s.institution_id=$1 AND s.role='crew'" : ""}
         ORDER BY s.role, s.institution_id NULLS FIRST, s.team_id NULLS FIRST, u.name`,
        scoped ? [user.institution] : [],
      );
      res.json({ accounts: rows.map(accountRow) });
    }),
  );

  router.post(
    "/staff/accounts",
    handle(async (req, res) => {
      const user = await staff(req);
      const input = newAccount.parse(req.body);
      const team = input.teamId ? teamById(input.teamId) : null;
      const institution = input.role === "crew" ? team?.institution : input.role === "institution" ? input.institution : undefined;
      if (input.role === "crew" && !team) throw new HttpError(400, "Ekip seç.");
      if (input.role === "institution" && !institution) throw new HttpError(400, "Kurum seç.");
      if (!canManage(user, { role: input.role, institution })) throw new HttpError(403, "Bu hesabı açma yetkin yok.");
      let userId = (await ctx.db.query(`SELECT id FROM "user" WHERE lower(email)=$1`, [input.email])).rows[0]?.id as string | undefined;
      if (userId) {
        if ((await ctx.db.query("SELECT 1 FROM staff WHERE user_id=$1", [userId])).rows.length)
          throw new HttpError(409, "Bu e-posta zaten bir personel hesabına ait.");
      } else {
        if (!input.password) throw new HttpError(400, "Yeni hesap için en az 8 karakterlik bir ilk şifre yaz.");
        const created = await ctx.auth.api.signUpEmail({ body: { name: input.name, email: input.email, password: input.password } });
        userId = created.user.id;
      }
      await ctx.db.query(`INSERT INTO staff (user_id, role, institution_id, team_id) VALUES ($1,$2,$3,$4)`, [
        userId, input.role, institution ?? null, input.role === "crew" ? team!.id : null,
      ]);
      // An existing citizen account changes role: its app sessions end so the right app is used.
      await signOutEverywhere(ctx.db, userId);
      const { rows } = await ctx.db.query(`SELECT s.*, u.name, u.email FROM staff s JOIN "user" u ON u.id=s.user_id WHERE s.user_id=$1`, [userId]);
      res.status(201).json({ account: accountRow(rows[0]) });
    }),
  );

  router.patch(
    "/staff/accounts/:userId",
    handle(async (req, res) => {
      const user = await staff(req);
      const { active } = z.object({ active: z.boolean() }).parse(req.body);
      const target = (await ctx.db.query("SELECT * FROM staff WHERE user_id=$1", [String(req.params.userId)])).rows[0];
      if (!target || !canManage(user, { role: target.role, institution: target.institution_id })) throw new HttpError(404, "Hesap bulunamadı.");
      if (target.user_id === user.userId) throw new HttpError(409, "Kendi hesabını kapatamazsın.");
      await ctx.db.query("UPDATE staff SET active=$2 WHERE user_id=$1", [target.user_id, active]);
      if (!active) await signOutEverywhere(ctx.db, target.user_id);
      const { rows } = await ctx.db.query(`SELECT s.*, u.name, u.email FROM staff s JOIN "user" u ON u.id=s.user_id WHERE s.user_id=$1`, [target.user_id]);
      res.json({ account: accountRow(rows[0]) });
    }),
  );

  // --- Crew applications from the citizen app ---------------------------------------------

  function applicationRow(r: Record<string, any>) {
    const team = teamById(r.team_id);
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      note: r.note,
      institution: r.institution_id,
      institutionName: institutions[r.institution_id as InstitutionId]?.name ?? r.institution_id,
      teamId: r.team_id,
      teamName: team?.name ?? r.team_id,
      status: r.status as "pending" | "approved" | "rejected",
      decisionNote: r.decision_note,
      decidedAt: r.decided_at,
      createdAt: r.created_at,
    };
  }

  router.post(
    "/applications",
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      if (user.role !== "citizen") throw new HttpError(409, "Bu hesap zaten personel hesabı.");
      const input = z
        .object({ teamId: z.string(), phone: z.string().trim().min(10).max(20), note: z.string().trim().max(500).default("") })
        .parse(req.body);
      const team = teamById(input.teamId);
      if (!team) throw new HttpError(400, "Ekip seç.");
      const pending = await ctx.db.query("SELECT 1 FROM crew_application WHERE user_id=$1 AND status='pending'", [user.userId]);
      if (pending.rows.length) throw new HttpError(409, "Bekleyen bir başvurun var; sonucu çıkınca yenisini yapabilirsin.");
      const id = randomUUID();
      await ctx.db.query(
        `INSERT INTO crew_application (id, user_id, institution_id, team_id, phone, note, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, user.userId, team.institution, team.id, input.phone, input.note, ctx.now()],
      );
      const { rows } = await ctx.db.query(
        `SELECT a.*, u.name, u.email FROM crew_application a JOIN "user" u ON u.id=a.user_id WHERE a.id=$1`,
        [id],
      );
      res.status(201).json({ application: applicationRow(rows[0]) });
    }),
  );

  router.get(
    "/applications/mine",
    handle(async (req, res) => {
      const user = await ctx.access.requireUser(req);
      const { rows } = await ctx.db.query(
        `SELECT a.*, u.name, u.email FROM crew_application a JOIN "user" u ON u.id=a.user_id
         WHERE a.user_id=$1 ORDER BY a.created_at DESC LIMIT 1`,
        [user.userId],
      );
      res.json({ application: rows[0] ? applicationRow(rows[0]) : null });
    }),
  );

  router.get(
    "/staff/applications",
    handle(async (req, res) => {
      const user = await staff(req);
      const scoped = user.role === "institution";
      const { rows } = await ctx.db.query(
        `SELECT a.*, u.name, u.email FROM crew_application a JOIN "user" u ON u.id=a.user_id
         ${scoped ? "WHERE a.institution_id=$1" : ""}
         ORDER BY (a.status='pending') DESC, a.created_at DESC LIMIT 200`,
        scoped ? [user.institution] : [],
      );
      res.json({ applications: rows.map(applicationRow) });
    }),
  );

  for (const decision of ["approve", "reject"] as const)
    router.post(
      `/staff/applications/:id/${decision}`,
      handle(async (req, res) => {
        const user = await staff(req);
        const { note } = z.object({ note: z.string().trim().max(500).default("") }).parse(req.body ?? {});
        if (decision === "reject" && note.length < 5) throw new HttpError(400, "Ret gerekçesi yaz (en az 5 karakter).");
        const id = String(req.params.id);
        await ctx.db.tx(async (q) => {
          const app = (await q.query("SELECT * FROM crew_application WHERE id=$1 FOR UPDATE", [id])).rows[0];
          if (!app || (user.role === "institution" && app.institution_id !== user.institution)) throw new HttpError(404, "Başvuru bulunamadı.");
          if (app.status !== "pending") throw new HttpError(409, "Bu başvuru zaten sonuçlandı.");
          if (decision === "approve") {
            if ((await q.query("SELECT 1 FROM staff WHERE user_id=$1", [app.user_id])).rows.length)
              throw new HttpError(409, "Bu kişi zaten personel.");
            await q.query(`INSERT INTO staff (user_id, role, institution_id, team_id) VALUES ($1,'crew',$2,$3)`, [
              app.user_id, app.institution_id, app.team_id,
            ]);
          }
          await q.query(
            `UPDATE crew_application SET status=$2, decision_note=$3, decided_by=$4, decided_at=$5 WHERE id=$1`,
            [id, decision === "approve" ? "approved" : "rejected", note || null, user.userId, ctx.now()],
          );
          if (decision === "approve") await signOutEverywhere(q, app.user_id);
        });
        const { rows } = await ctx.db.query(
          `SELECT a.*, u.name, u.email FROM crew_application a JOIN "user" u ON u.id=a.user_id WHERE a.id=$1`,
          [id],
        );
        res.json({ application: applicationRow(rows[0]) });
      }),
    );

  // --- Forgot password: the apps do not know the web address, so the server picks the page ---

  router.post(
    "/password/forgot",
    handle(async (req, res) => {
      const { email } = z.object({ email: z.email() }).parse(req.body);
      const page = ctx.config.resetPage ?? `${ctx.config.webOrigins[0] ?? ctx.config.baseUrl}/sifre`;
      const response = await ctx.auth.handler(
        new Request(`${ctx.config.baseUrl}/api/auth/request-password-reset`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: ctx.config.baseUrl,
            "x-vercel-forwarded-for": req.ip ?? "unknown",
          },
          body: JSON.stringify({ email: email.trim().toLowerCase(), redirectTo: page }),
        }),
      );
      if (response.status === 429) throw new HttpError(429, "Çok fazla deneme yapıldı. Bir dakika sonra tekrar dene.");
      // Same answer whether or not the address exists.
      res.json({ ok: true });
    }),
  );

  return router;
}
