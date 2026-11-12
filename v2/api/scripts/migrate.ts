import { Pool } from "pg";
import { configFromEnv } from "../src/config.ts";
import { createAuth } from "../src/auth.ts";
import { createPgDb } from "../src/db.ts";
import { migrate } from "../src/migrate.ts";

const config = configFromEnv(process.env);
const pool = new Pool({ connectionString: config.databaseUrl, max: 1 });
try {
  await migrate(createPgDb(pool), createAuth(pool, config));
  console.log("KentBağ v2 database schema is ready.");
} finally {
  await pool.end();
}
