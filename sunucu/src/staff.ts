import express from "express";
import { z } from "zod";
import type { Database } from "./database.js";
import type { CitizenUser } from "./citizen.js";
import { HttpError } from "./validation.js";
import { institutionProfiles } from "./institution-domain.js";
import { CrewEnrollment } from './enrollment.js';

export type Staff = {
  userId: string;
  name: string;
  email: string;
  role: "center" | "institution" | "crew";
  unitId: string | null;
  teamId: string | null;
};
export type StaffAccess = {
  enrollment(req: express.Request, input?: unknown): Promise<unknown>;
  reviewEnrollment(input: unknown): Promise<unknown>;
  member(req: express.Request): Promise<Staff | null>;
  create(input: unknown): Promise<{ ok: true }>;
  list(): Promise<unknown>;
  disable(input: unknown, req: express.Request): Promise<{ ok: true }>;
};
export function createStaffAccess(
  db: Database,
  session: (req: express.Request) => Promise<CitizenUser | null>,
  signup: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<{ user: { id: string } }>,
): StaffAccess {
  const member = async (req: express.Request): Promise<Staff | null> => {
    const user = await session(req);
    if (!user) return null;
    const row = (
      await db.query(
        "SELECT * FROM staff_member WHERE user_id=$1 AND active=true",
        [user.id],
      )
    ).rows[0];
    return row
      ? {
          userId: user.id,
          name: user.name,
          email: user.email,
          role: row.role,
          unitId: row.unit_id,
          teamId: row.team_id,
        }
      : null;
  };
  return {
    member,
    async enrollment(req,input) {
      const user=await session(req);
      if(!user) throw new HttpError(401,'Hesabınızla giriş yapın.');
      const service=new CrewEnrollment(db);
      return input===undefined?service.status(user.id):service.submit(user.id,input);
    },
    reviewEnrollment: input=>new CrewEnrollment(db).review(input),
    async list() {
      return {
        applications: await new CrewEnrollment(db).list(),
        members: (
          await db.query(
            'SELECT u.id,u.name,u.email,s.role,s.unit_id AS "unitId",s.team_id AS "teamId",s.active FROM staff_member s JOIN "user" u ON u.id=s.user_id ORDER BY s.created_at DESC',
          )
        ).rows,
      };
    },
    async create(input) {
      const data = z
        .object({
          name: z.string().trim().min(2).max(100),
          email: z
            .email()
            .max(254)
            .transform((v) => v.toLowerCase()),
          password: z.string().min(12).max(128),
          role: z.enum(["center", "institution", "crew"]),
          unitId: z.string().optional(),
          teamId: z.string().optional(),
        })
        .parse(input);
      const profile = institutionProfiles.find((p) => p.id === data.unitId);
      if (data.role !== "center" && !profile)
        throw new HttpError(400, "Geçerli bir kurum seçin.");
      if (
        data.role === "crew" &&
        !profile?.teams.some((t) => t.id === data.teamId)
      )
        throw new HttpError(400, "Kurumun ekiplerinden birini seçin.");
      if (
        (data.role === "center" && (data.unitId || data.teamId)) ||
        (data.role === "institution" && data.teamId)
      )
        throw new HttpError(400, "Rol ve kurum bilgileri uyuşmuyor.");
      // Better Auth owns password hashing and account creation. Never return its new session to the operator.
      let created;
      try {
        created = await signup({
          name: data.name,
          email: data.email,
          password: data.password,
        });
      } catch {
        throw new HttpError(
          409,
          "Hesap oluşturulamadı. E-posta kullanımda olabilir; farklı bir adres deneyin.",
        );
      }
      await db.query(
        "INSERT INTO staff_member(user_id,role,unit_id,team_id) VALUES($1,$2,$3,$4)",
        [
          created.user.id,
          data.role,
          data.role === "center" ? null : data.unitId,
          data.role === "crew" ? data.teamId : null,
        ],
      );
      return { ok: true };
    },
    async disable(input, req) {
      const { id } = z.object({ id: z.string().min(1).max(220) }).parse(input);
      if ((await member(req))?.userId === id)
        throw new HttpError(
          409,
          "Kendi hesabınızı bu ekrandan kapatamazsınız.",
        );
      const result = await db.query(
        "UPDATE staff_member SET active=false WHERE user_id=$1 RETURNING user_id",
        [id],
      );
      if (!result.rows.length)
        throw new HttpError(404, "Personel hesabı bulunamadı.");
      return { ok: true };
    },
  };
}
export function staffRouter(access: StaffAccess) {
  const router = express.Router();
  router.get('/enrollment',async(req,res)=>res.json(await access.enrollment(req)));
  router.post('/enrollment',express.json({limit:'2kb'}),async(req,res)=>res.json(await access.enrollment(req,req.body)));
  router.get("/me", async (req, res) => {
    const member = await access.member(req);
    if (!member)
      throw new HttpError(401, "Yetkili personel hesabınızla giriş yapın.");
    res.json(member);
  });
  return router;
}
