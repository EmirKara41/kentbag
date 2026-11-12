import type { Request } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { InstitutionId, Role } from "@kentbag/shared";
import type { Auth } from "./auth.ts";
import type { Db } from "./db.ts";
import { HttpError } from "./errors.ts";

export type CurrentUser = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  institution?: InstitutionId;
  teamId?: string;
};

export function createAccess(db: Db, auth: Auth) {
  async function requireUser(req: Request): Promise<CurrentUser> {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new HttpError(401, "Oturum açman gerekiyor.");
    const { id, name, email } = session.user;
    const { rows } = await db.query("SELECT role, institution_id, team_id, active FROM staff WHERE user_id=$1", [id]);
    const staff = rows[0];
    if (!staff) return { userId: id, name, email, role: "citizen" };
    if (!staff.active) throw new HttpError(403, "Bu personel hesabının erişimi kapatılmış.");
    return {
      userId: id,
      name,
      email,
      role: staff.role,
      institution: staff.institution_id ?? undefined,
      teamId: staff.team_id ?? undefined,
    };
  }
  async function requireRole(req: Request, ...roles: Role[]) {
    const user = await requireUser(req);
    if (!roles.includes(user.role)) throw new HttpError(403, "Bu bölüm için yetkin yok.");
    return user;
  }
  return { requireUser, requireRole };
}

export type Access = ReturnType<typeof createAccess>;
