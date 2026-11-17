import { getMigrations } from "better-auth/db/migration";
import type { Auth } from "./auth.ts";
import type { Db } from "./db.ts";
import { migrations } from "./schema.ts";

/** Applies KentBağ's own SQL files (idempotent, additive). Safe to run on every cold start. */
export async function migrateApp(db: Db) {
  await db.tx(async (q) => {
    // One instance at a time; concurrent cold starts wait here.
    await q.query("SELECT pg_advisory_xact_lock(734202)");
    for (const m of migrations) await q.query(m.sql);
  });
}

export async function migrate(db: Db, auth: Auth) {
  const authMigration = await getMigrations(auth.options);
  await authMigration.runMigrations();
  await migrateApp(db);
}
