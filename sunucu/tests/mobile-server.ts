// Isolated local integration fixture. Never imported by the production entry point.
if (process.env.KENT_INTEGRATION_TEST !== "1")
  throw new Error("This server is only for automated integration tests.");
const { PGlite } = await import("@electric-sql/pglite");
const { memoryAdapter } = await import("better-auth/adapters/memory");
const { toNodeHandler, fromNodeHeaders } = await import("better-auth/node");
const { readFile } = await import("node:fs/promises");
const { createAuth } = await import("../src/auth.js");
const { createApp } = await import("../src/app.js");
import type { Database, Sql } from "../src/database.js";
const pg = new PGlite();
await pg.exec('CREATE TABLE "user"(id text PRIMARY KEY)');
await pg.exec(
  await readFile(
    new URL("../migrations/001_citizen.sql", import.meta.url),
    "utf8",
  ),
);
await pg.exec(
  await readFile(
    new URL("../migrations/003_community.sql", import.meta.url),
    "utf8",
  ),
);
const sql = (client: Pick<typeof pg, "query">): Sql => ({
  async query(text, params) {
    const result = await client.query<Record<string, unknown>>(text, params);
    return { rows: result.rows, rowCount: result.affectedRows };
  },
});
const db: Database = {
  ...sql(pg),
  transaction: (task) => pg.transaction((tx) => task(sql(tx))),
};
const config = {
  baseUrl: "http://localhost:4311",
  secret: "test-only-mobile-session-secret-not-for-live-usage",
  databaseUrl: "test-only",
  webOrigins: ["http://localhost:4174", "http://localhost:4173"],
};
const auth = createAuth(
  memoryAdapter({
    user: [],
    account: [],
    session: [],
    verification: [],
    rateLimit: [],
  }),
  config,
);
const blobs = new Map<string, Buffer>();
const app = createApp({
  db,
  config,
  authHandler: toNodeHandler(auth),
  async session(req) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (session)
      await db.query(
        'INSERT INTO "user"(id) VALUES($1) ON CONFLICT DO NOTHING',
        [session.user.id],
      );
    return session?.user ?? null;
  },
  photos: {
    async put(path, bytes) {
      blobs.set(path, bytes);
      return path;
    },
    async get(path) {
      return blobs.get(path) ?? null;
    },
    async del(path) {
      blobs.delete(path);
    },
  },
});
const express = (await import("express")).default;
const fixture = express();
fixture.post("/__test/reset-auth-limit", async (_req, res) => {
  const context = await auth.$context;
  await context.adapter.deleteMany({ model: "rateLimit", where: [] });
  res.json({ ok: true });
});
// This test-only transition stands in for a future municipal service. It is not a citizen API route.
fixture.post("/__test/resolve/:id", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) {
    res.sendStatus(401);
    return;
  }
  const row = (
    await db.query(
      "SELECT document FROM citizen_report WHERE id=$1 AND owner_id=$2",
      [req.params.id, session.user.id],
    )
  ).rows[0];
  if (!row) {
    res.sendStatus(404);
    return;
  }
  const document = row.document;
  document.status = "closed";
  document.resolution = {
    body: "İzole test: Yol yüzeyi onarıldı.",
    completedAt: new Date().toISOString(),
    photos: [],
  };
  document.events.push({
    id: "test-resolution",
    status: "closed",
    body: document.resolution.body,
    createdAt: document.resolution.completedAt,
  });
  await db.query("UPDATE citizen_report SET document=$1::jsonb WHERE id=$2", [
    JSON.stringify(document),
    req.params.id,
  ]);
  res.json({ ok: true });
});
fixture.use(app);
fixture.listen(4311, "127.0.0.1", () =>
  console.log("Isolated mobile integration API ready."),
);
