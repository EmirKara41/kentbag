import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { getMigrations } from "better-auth/db/migration";
import { configFromEnv } from "../src/config.js";
import { createAuth } from "../src/auth.js";
const pool = new Pool({
  connectionString: configFromEnv(process.env).databaseUrl,
  max: 1,
});
try {
  const auth = createAuth(pool, configFromEnv(process.env));
  const migration = await getMigrations(auth.options);
  await migration.runMigrations();
  await pool.query(
    await readFile(
      new URL("../migrations/001_citizen.sql", import.meta.url),
      "utf8",
    ),
  );
  await pool.query(
    await readFile(
      new URL("../migrations/003_community.sql", import.meta.url),
      "utf8",
    ),
  );
  await pool.query(
    await readFile(
      new URL("../migrations/004_owner_shared_updates.sql", import.meta.url),
      "utf8",
    ),
  );
  await pool.query(
    await readFile(
      new URL("../migrations/005_label_center_messages.sql", import.meta.url),
      "utf8",
    ),
  );
  await pool.query(
    await readFile(
      new URL("../migrations/006_institutions.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log("Authentication and citizen database schema is ready.");
} finally {
  await pool.end();
}
