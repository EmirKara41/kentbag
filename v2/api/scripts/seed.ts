import { Pool } from "pg";
import { configFromEnv } from "../src/config.ts";
import { createAuth } from "../src/auth.ts";
import { createPgDb } from "../src/db.ts";
import { seedDemo, seedTeams } from "../src/seed.ts";

const config = configFromEnv(process.env);
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12) throw new Error("DEMO_PASSWORD (12+ characters) is required.");
const pool = new Pool({ connectionString: config.databaseUrl, max: 1 });
try {
  const db = createPgDb(pool);
  await seedTeams(db);
  await seedDemo(db, createAuth(pool, config), password);
  console.log("Teams and demo accounts are ready.");
} finally {
  await pool.end();
}
