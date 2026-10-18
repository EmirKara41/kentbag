import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { configFromEnv } from "./config.js";
import { createAuth } from "./auth.js";
import { createApp } from "./app.js";
import { privateBlob } from "./storage.js";
import type { Database } from "./database.js";
export const config = configFromEnv(process.env);
const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 5,
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 10000,
});
if (process.env.VERCEL) attachDatabasePool(pool);
export const auth = createAuth(pool, config);
const db: Database = {
  query: (text, values) => pool.query(text, values),
  async transaction(task) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await task(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
export default createApp({
  db,
  config,
  photos: privateBlob,
  authHandler: toNodeHandler(auth),
  async session(req) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    return session?.user ?? null;
  },
});
