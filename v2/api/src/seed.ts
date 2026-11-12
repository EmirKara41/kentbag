import { institutionIds, institutions, oltuCenter, type InstitutionId, type Role } from "@kentbag/shared";
import type { Auth } from "./auth.ts";
import type { Db } from "./db.ts";

export type DemoAccount = {
  key: string;
  email: string;
  name: string;
  label: string;
  role: Role;
  app: "web" | "citizen" | "crew";
  institution?: InstitutionId;
  teamId?: string;
};

export function demoAccounts(): DemoAccount[] {
  const list: DemoAccount[] = [
    { key: "vatandas", email: "demo-vatandas@kentbag.app", name: "Demo Vatandaş", label: "Vatandaş", role: "citizen", app: "citizen" },
    { key: "merkez", email: "demo-merkez@kentbag.app", name: "Demo Belediye Merkezi", label: "Belediye merkezi", role: "center", app: "web" },
  ];
  for (const id of institutionIds) {
    const inst = institutions[id];
    list.push({
      key: `kurum-${id}`,
      email: `demo-kurum-${id}@kentbag.app`,
      name: `Demo ${inst.name}`,
      label: inst.name,
      role: "institution",
      app: "web",
      institution: id,
    });
    for (const team of inst.teams)
      list.push({
        key: team.id,
        email: `demo-${team.id}@kentbag.app`,
        name: `Demo ${team.name}`,
        label: `${team.name} (${inst.name})`,
        role: "crew",
        app: "crew",
        institution: id,
        teamId: team.id,
      });
  }
  return list;
}

export async function seedTeams(db: Db) {
  for (const id of institutionIds)
    for (const team of institutions[id].teams)
      await db.query(
        `INSERT INTO team (id, institution_id, name) VALUES ($1,$2,$3)
         ON CONFLICT (id) DO UPDATE SET institution_id=EXCLUDED.institution_id, name=EXCLUDED.name`,
        [team.id, id, team.name],
      );
}

/** Creates demo accounts (idempotent) and puts demo teams on shift around Oltu. */
export async function seedDemo(db: Db, auth: Auth, password: string, now = new Date()) {
  const accounts = demoAccounts();
  for (const [i, account] of accounts.entries()) {
    let id = (await db.query(`SELECT id FROM "user" WHERE email=$1`, [account.email])).rows[0]?.id as string | undefined;
    if (!id) {
      const result = await auth.api.signUpEmail({ body: { name: account.name, email: account.email, password } });
      id = result.user.id;
    }
    if (account.role !== "citizen")
      await db.query(
        `INSERT INTO staff (user_id, role, institution_id, team_id) VALUES ($1,$2,$3,$4)
         ON CONFLICT (user_id) DO UPDATE SET role=EXCLUDED.role, institution_id=EXCLUDED.institution_id, team_id=EXCLUDED.team_id, active=true`,
        [id, account.role, account.institution ?? null, account.teamId ?? null],
      );
    if (account.teamId) {
      const angle = (i / accounts.length) * 2 * Math.PI;
      await db.query(`UPDATE team SET on_shift=true, active=true, lat=$2, lng=$3, located_at=$4 WHERE id=$1`, [
        account.teamId,
        oltuCenter.lat + 0.01 * Math.sin(angle),
        oltuCenter.lng + 0.012 * Math.cos(angle),
        now,
      ]);
    }
  }
}
