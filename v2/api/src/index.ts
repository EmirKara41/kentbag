// Production entry (Vercel). Wires real Postgres, auth and private Blob storage.
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { configFromEnv } from "./config.ts";
import { createAuth } from "./auth.ts";
import { createPgDb } from "./db.ts";
import { migrateApp } from "./migrate.ts";
import { blobPhotoStore } from "./photos.ts";
import { createServer } from "./server.ts";
import { createGeo } from "./geo.ts";
import { geminiClassify } from "./agent.ts";
import { firebaseSend } from "./push.ts";
import { resendMailer } from "./mail.ts";

const config = configFromEnv(process.env);
const pool = new Pool({ connectionString: config.databaseUrl, max: 5, idleTimeoutMillis: 5000, connectionTimeoutMillis: 10000 });
if (process.env.VERCEL) attachDatabasePool(pool);
const db = createPgDb(pool);
await migrateApp(db);
const mailer = process.env.RESEND_API_KEY
  ? resendMailer(process.env.RESEND_API_KEY, process.env.RESEND_FROM || process.env.MAIL_FROM || "KentBağ <bildirim@lollore.com>")
  : undefined;
const auth = createAuth(pool, config, mailer);
const geo = createGeo();
const classify = process.env.GEMINI_API_KEY
  ? geminiClassify(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL || "gemini-3.5-flash-lite")
  : undefined;
const { app } = createServer({
  db,
  auth,
  config,
  photos: await blobPhotoStore(),
  travel: geo.travel,
  geocode: geo.geocode,
  classify,
  pushSend: await firebaseSend(process.env.FIREBASE_SERVICE_ACCOUNT),
  demoPassword: process.env.DEMO_LOGIN === "on" ? process.env.DEMO_PASSWORD : undefined,
});

export default app;
