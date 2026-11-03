import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { configFromEnv } from "./config.js";
import { createAuth } from "./auth.js";
import { createApp } from "./app.js";
import { privateBlob } from "./storage.js";
import type { Database } from "./database.js";
import { MunicipalityService } from "./municipality.js";
import { createStaffAccess } from "./staff.js";
import { waitUntil } from "@vercel/functions";
import express from "express";
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
const session = async (req: import("express").Request) =>
  (await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }))
    ?.user ?? null;
const municipality = new MunicipalityService(db, config, {
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
});
const app = createApp({
  db,
  config,
  photos: privateBlob,
  authHandler: toNodeHandler(auth),
  session,
  staff: createStaffAccess(db, session, (body) =>
    auth.api.signUpEmail({ body }),
  ),
  municipality: {
    service: municipality,
    token: config.secret,
    panelOrigin: process.env.PANEL_ORIGIN || config.baseUrl,
  },
});
// Initialize once per process, keep analysis alive after the receipt is returned on Vercel.
let initialized: Promise<void> | undefined;
const handler = express();
handler.use((req, res) => {
  initialized ??= municipality.initialize().catch((error) => {
    initialized = undefined;
    throw error;
  });
  void initialized
    .then(() => {
      res.once("finish", () => {
        if (
          req.method === "POST" &&
          req.path === "/api/reports" &&
          res.statusCode < 300
        ) {
          const pending = municipality
            .analyzePending()
            .catch(() => console.error("Analysis failed; receipt retained."));
          if (process.env.VERCEL) waitUntil(pending);
        }
      });
      app(req, res);
    })
    .catch(() =>
      res.status(503).json({ error: "Veri servisi şu anda hazır değil." }),
    );
});
export default handler;
