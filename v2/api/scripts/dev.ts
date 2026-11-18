// Local development API: in-process Postgres (PGlite), demo accounts, port 3100.
// Not used in production. Data lives in api/.local/dev-db.
import { mkdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { Pool } from "pg";
import { createAuth } from "../src/auth.ts";
import { createPgDb } from "../src/db.ts";
import { migrate } from "../src/migrate.ts";
import { seedDemo, seedTeams } from "../src/seed.ts";
import { createServer } from "../src/server.ts";
import { memoryPhotoStore } from "../src/photos.ts";
import { createGeo } from "../src/geo.ts";
import { geminiJudge } from "../src/vision.ts";

const port = Number(process.env.PORT || 3100);
const password = process.env.DEMO_PASSWORD || "Demo-yerel-sifre-123";
await mkdir(new URL("../.local/", import.meta.url), { recursive: true });
const pg = new PGlite(new URL("../.local/dev-db", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
await pg.waitReady;
const socket = new PGLiteSocketServer({ db: pg, host: "127.0.0.1", port: 5433, maxConnections: 1 });
await socket.start();
const pool = new Pool({ host: "127.0.0.1", port: 5433, database: "postgres", user: "postgres", max: 1, idleTimeoutMillis: 0 });
const config = {
  databaseUrl: "local",
  baseUrl: `http://127.0.0.1:${port}`,
  secret: "local-development-secret-not-for-production",
  webOrigins: ["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:5174", "http://localhost:5174", "http://127.0.0.1:5175", "http://localhost:5175"],
  testing: true,
};
const db = createPgDb(pool);
const auth = createAuth(pool, config);
await migrate(db, auth);
await seedTeams(db);
await seedDemo(db, auth, password);
const geo = createGeo();
const { app } = createServer({ db, auth, config, photos: memoryPhotoStore(), travel: geo.travel, geocode: geo.geocode, locate: geo.locate, demoPassword: password,
  // Optional: with GEMINI_API_KEY in api/.env the photo checks run locally too.
  photoJudge: process.env.GEMINI_API_KEY ? geminiJudge(process.env.GEMINI_API_KEY, process.env.GEMINI_VISION_MODEL ?? "gemini-3.5-flash-lite") : undefined,
});
app.listen(port, "127.0.0.1", () => console.log(`KentBağ v2 dev API on http://127.0.0.1:${port} (demo login on)`));
