import { readFile } from "node:fs/promises";
import { getMigrations } from "better-auth/db/migration";
import type { Auth } from "./auth.ts";
import type { Db } from "./db.ts";

const files = ["001_init.sql"];

export async function migrate(db: Db, auth: Auth) {
  const authMigration = await getMigrations(auth.options);
  await authMigration.runMigrations();
  for (const file of files)
    await db.query(await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"));
}
