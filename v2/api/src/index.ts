// Production entry (Vercel). Wires real Postgres, auth and private Blob storage.
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { configFromEnv } from "./config.ts";
import { createAuth } from "./auth.ts";
import { createPgDb } from "./db.ts";
import { blobPhotoStore } from "./photos.ts";
import { createServer } from "./server.ts";

const config = configFromEnv(process.env);
const pool = new Pool({ connectionString: config.databaseUrl, max: 5, idleTimeoutMillis: 5000, connectionTimeoutMillis: 10000 });
if (process.env.VERCEL) attachDatabasePool(pool);
const db = createPgDb(pool);
const auth = createAuth(pool, config);
const { app } = createServer({ db, auth, config, photos: await blobPhotoStore() });

export default app;
