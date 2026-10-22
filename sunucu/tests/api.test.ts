import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import request from "supertest";
import { PGlite } from "@electric-sql/pglite";
import { memoryAdapter } from "better-auth/adapters/memory";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { createAuth } from "../src/auth.js";
import { createApp } from "../src/app.js";
import { photoUrl, verifyPhotoSignature } from "../src/storage.js";
import type { Database, Sql } from "../src/database.js";

test("citizen API authentication, ownership, photos and atomic report lifecycle", async (t) => {
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
  const adapt = (client: Pick<PGlite, "query">): Sql => ({
    async query(sql, params) {
      const r = await client.query<Record<string, any>>(sql, params);
      return { rows: r.rows, rowCount: r.affectedRows };
    },
  });
  const db: Database = {
    ...adapt(pg),
    transaction: (task) => pg.transaction((tx) => task(adapt(tx))),
  };
  const config = {
    baseUrl: "http://localhost:3000",
    secret: "test-only-long-random-secret-never-for-production-12345",
    databaseUrl: "test-only",
    webOrigins: ["http://localhost:4173"],
  };
  // The actual auth library issues and revokes cookies. Only its database adapter is in-memory.
  const auth = createAuth(
    memoryAdapter({
      user: [],
      session: [],
      account: [],
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
      return (
        (await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }))
          ?.user ?? null
      );
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
  async function register(email: string) {
    const result = await request(app)
      .post("/api/auth/sign-up/email")
      .set("Origin", config.baseUrl)
      .send({
        name: "Deniz Kaya",
        email,
        password: "test-strong-password-1234",
      });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    await db.query('INSERT INTO "user"(id) VALUES($1)', [result.body.user.id]);
    const cookies = result.headers["set-cookie"];
    assert.ok(cookies?.length);
    return {
      cookie: (Array.isArray(cookies) ? cookies : [cookies])
        .map((cookie: string) => cookie.split(";")[0])
        .join("; "),
      id: result.body.user.id,
      token: result.headers["set-auth-token"] as string,
    };
  }
  const alice = await register("alice@example.test");
  const bob = await register("bob@example.test");
  await t.test(
    "Android signed bearer session works without cookies and rejects modified tokens",
    async () => {
      assert.ok(bob.token);
      const response = await request(app)
        .get("/api/workspace")
        .set("Origin", "https://localhost")
        .set("Authorization", `Bearer ${bob.token}`);
      assert.equal(response.status, 200);
      assert.equal(response.body.sessionId, bob.id);
      assert.equal(
        response.headers["access-control-allow-origin"],
        "https://localhost",
      );
      assert.match(
        response.headers["access-control-expose-headers"],
        /set-auth-token/,
      );
      const invalid = await request(app)
        .get("/api/workspace")
        .set("Authorization", `Bearer ${bob.token}modified`);
      assert.equal(invalid.status, 401);
    },
  );
  const draft = {
    requestId: "retry-identity-1",
    category: "road",
    description: "Sokağın girişinde büyük bir çukur var.",
    location: {
      latitude: 41.02,
      longitude: 29.01,
      address: "Deneme Sokak",
      source: "map",
    },
    photos: [] as string[],
  };
  let saved: any;
  let photoId: string;
  await t.test(
    "unauthenticated, wrong-password and foreign-origin requests are rejected",
    async () => {
      assert.equal((await request(app).get("/api/workspace")).status, 401);
      assert.equal(
        (
          await request(app)
            .post("/api/reports")
            .set("Cookie", alice.cookie)
            .set("X-Citizen-Id", bob.id)
            .send(draft)
        ).status,
        409,
      );
      assert.equal(
        (
          await request(app)
            .post("/api/auth/sign-in/email")
            .set("Origin", config.baseUrl)
            .send({ email: "alice@example.test", password: "wrong-password" })
        ).status,
        401,
      );
      assert.equal(
        (
          await request(app)
            .post("/api/reports")
            .set("Cookie", alice.cookie)
            .set("Origin", "https://evil.example")
            .send(draft)
        ).status,
        403,
      );
    },
  );
  await t.test(
    "profile changes and valid uploads persist; invalid image bytes are rejected",
    async () => {
      assert.equal(
        (
          await request(app)
            .patch("/api/profile")
            .set("Cookie", alice.cookie)
            .send({ name: "Deniz Kaya", neighborhood: "Cumhuriyet" })
        ).status,
        200,
      );
      assert.equal(
        (
          await request(app)
            .put("/api/photos/fake")
            .set("Cookie", alice.cookie)
            .set("Content-Type", "image/jpeg")
            .send(Buffer.from("not-a-real-image-file"))
        ).status,
        400,
      );
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=",
        "base64",
      );
      const uploaded = await request(app)
        .put("/api/photos/upload-1")
        .set("Cookie", alice.cookie)
        .set("Content-Type", "image/png")
        .send(png);
      assert.equal(uploaded.status, 200, JSON.stringify(uploaded.body));
      photoId = uploaded.body.id;
      const retry = await request(app)
        .put("/api/photos/upload-1")
        .set("Cookie", alice.cookie)
        .set("Content-Type", "image/png")
        .send(png);
      assert.equal(retry.body.id, photoId);
      assert.equal(blobs.size, 1);
    },
  );
  await t.test(
    "foreign photo attachment rolls the entire submission back",
    async () => {
      const response = await request(app)
        .post("/api/reports")
        .set("Cookie", bob.cookie)
        .send({ ...draft, photos: [photoId] });
      assert.equal(response.status, 400);
      assert.equal(
        (
          await db.query("SELECT * FROM citizen_report WHERE owner_id=$1", [
            bob.id,
          ])
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query("SELECT * FROM citizen_inbox WHERE owner_id=$1", [
            bob.id,
          ])
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "submission is idempotent and client-forged states are ignored",
    async () => {
      draft.photos = [photoId];
      const response = await request(app)
        .post("/api/reports")
        .set("Cookie", alice.cookie)
        .send({ ...draft, status: "resolved", ownerId: bob.id });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      saved = response.body;
      assert.equal(saved.ownerId, alice.id);
      assert.equal(saved.status, "submitted");
      assert.match(saved.events[0].body, /henüz açık değil/);
      const retry = await request(app)
        .post("/api/reports")
        .set("Cookie", alice.cookie)
        .send(draft);
      assert.equal(retry.body.id, saved.id);
      assert.equal(
        (await db.query("SELECT * FROM citizen_inbox")).rows.length,
        1,
      );
      assert.equal(
        (
          await request(app)
            .post("/api/reports")
            .set("Cookie", alice.cookie)
            .send({
              ...draft,
              description: "Farklı bir bildirim açıklaması yazılıyor.",
            })
        ).status,
        409,
      );
    },
  );
  await t.test(
    "private photo requires an unexpired, unmodified signed link",
    async () => {
      const url = new URL(saved.photos[0].uri);
      const response = await request(app).get(url.pathname + url.search);
      assert.equal(response.status, 200);
      assert.equal(response.headers["content-type"], "image/png");
      assert.equal((await request(app).get(url.pathname)).status, 403);
      assert.equal(
        (
          await request(app).get(
            url.pathname + url.search.replace("signature=", "signature=a"),
          )
        ).status,
        403,
      );
      const expired = new URL(
        photoUrl(config.baseUrl, config.secret, photoId, Date.now() - 3600000),
      );
      assert.equal(
        (await request(app).get(expired.pathname + expired.search)).status,
        403,
      );
    },
  );
  await t.test(
    "notes, withdrawal and inbox changes require report ownership",
    async () => {
      assert.equal(
        (
          await request(app)
            .post(`/api/reports/${saved.id}/notes`)
            .set("Cookie", bob.cookie)
            .send({ text: "Bu benim talebim değil." })
        ).status,
        404,
      );
      assert.equal(
        (
          await request(app)
            .post(`/api/reports/${saved.id}/withdraw`)
            .set("Cookie", bob.cookie)
            .send({})
        ).status,
        404,
      );
      assert.equal(
        (
          await request(app)
            .post(`/api/reports/${saved.id}/notes`)
            .set("Cookie", alice.cookie)
            .send({ text: "Çukur bugün daha da büyüdü." })
        ).status,
        200,
      );
      assert.equal(
        (
          await request(app)
            .post("/api/inbox/read")
            .set("Cookie", bob.cookie)
            .send({})
        ).status,
        200,
      );
      let workspace = (
        await request(app).get("/api/workspace").set("Cookie", alice.cookie)
      ).body;
      assert.equal(workspace.inbox[0].read, false);
      assert.equal(workspace.reports[0].notes.length, 1);
      assert.equal(workspace.profiles[0].neighborhood, "Cumhuriyet");
      assert.equal(
        (
          await request(app)
            .post("/api/inbox/read")
            .set("Cookie", alice.cookie)
            .send({})
        ).status,
        200,
      );
      assert.equal(
        (
          await request(app)
            .post(`/api/reports/${saved.id}/withdraw`)
            .set("Cookie", alice.cookie)
            .send({})
        ).status,
        200,
      );
      workspace = (
        await request(app).get("/api/workspace").set("Cookie", alice.cookie)
      ).body;
      assert.equal(workspace.inbox[0].read, true);
      assert.equal(workspace.reports[0].status, "withdrawn");
      assert.equal(
        (await request(app).get("/api/workspace").set("Cookie", bob.cookie))
          .body.reports.length,
        0,
      );
    },
  );
  await t.test(
    "improvement types persist and resolution feedback is owner-scoped without forging municipal status",
    async () => {
      const input = {
        ...draft,
        requestId: "improvement-access-1",
        kind: "improvement",
        category: "accessibility",
        impacts: ["Erişilebilirlik"],
        photos: [],
      };
      assert.equal(
        (
          await request(app)
            .post("/api/reports")
            .set("Cookie", alice.cookie)
            .send({ ...input, kind: "issue" })
        ).status,
        400,
      );
      const response = await request(app)
        .post("/api/reports")
        .set("Cookie", alice.cookie)
        .send(input);
      assert.equal(response.status, 200);
      const id = response.body.id;
      assert.equal(response.body.kind, "improvement");
      assert.deepEqual(response.body.impacts, ["Erişilebilirlik"]);
      assert.equal(
        (
          await request(app)
            .post(`/api/reports/${id}/feedback`)
            .set("Cookie", alice.cookie)
            .send({ outcome: "solved" })
        ).status,
        409,
      );
      assert.equal(
        (
          await request(app)
            .post(`/api/reports/${id}/feedback`)
            .set("Cookie", bob.cookie)
            .send({ outcome: "solved" })
        ).status,
        404,
      );
      await db.query(
        "UPDATE citizen_report SET document=jsonb_set(document,'{status}','\"closed\"'::jsonb) WHERE id=$1",
        [id],
      );
      assert.equal(
        (
          await request(app)
            .post(`/api/reports/${id}/feedback`)
            .set("Cookie", alice.cookie)
            .send({
              outcome: "persists",
              text: "Geçiş hâlâ kapalı.",
              status: "assigned",
            })
        ).status,
        200,
      );
      let workspace = (
        await request(app).get("/api/workspace").set("Cookie", alice.cookie)
      ).body;
      let report = workspace.reports.find((item: any) => item.id === id);
      assert.equal(report.status, "closed");
      assert.equal(report.feedback.outcome, "persists");
      assert.equal(report.feedback.text, "Geçiş hâlâ kapalı.");
      assert.equal(
        (
          await request(app)
            .post(`/api/reports/${id}/feedback`)
            .set("Cookie", alice.cookie)
            .send({ outcome: "solved" })
        ).status,
        200,
      );
      workspace = (
        await request(app).get("/api/workspace").set("Cookie", alice.cookie)
      ).body;
      report = workspace.reports.find((item: any) => item.id === id);
      assert.equal(report.feedback.outcome, "solved");
      assert.equal(report.feedbackHistory.length, 2);
      assert.equal(report.feedbackHistory[0].outcome, "persists");
    },
  );
  await t.test(
    "typed address persists without fabricated coordinates and rejects malformed manual locations",
    async () => {
      const input = {
        ...draft,
        requestId: "typed-address-1",
        photos: [],
        location: {
          source: "manual",
          address: "İstanbul, Kadıköy, Moda Caddesi No: 15 önü",
        },
      };
      const result = await request(app)
        .post("/api/reports")
        .set("Cookie", alice.cookie)
        .send(input);
      assert.equal(result.status, 200);
      assert.deepEqual(result.body.location, input.location);
      for (const location of [
        { source: "manual", address: "Kısa" },
        { ...input.location, latitude: 0, longitude: 0 },
        { source: "map", address: input.location.address },
      ]) {
        assert.equal(
          (
            await request(app)
              .post("/api/reports")
              .set("Cookie", alice.cookie)
              .send({ ...input, requestId: "invalid-location", location })
          ).status,
          400,
        );
      }
    },
  );
  await t.test("sign out invalidates the server session", async () => {
    assert.equal(
      (
        await request(app)
          .post("/api/auth/sign-out")
          .set("Origin", config.baseUrl)
          .set("Cookie", alice.cookie)
          .send({})
      ).status,
      200,
    );
    assert.equal(
      (await request(app).get("/api/workspace").set("Cookie", alice.cookie))
        .status,
      401,
    );
  });
  await pg.close();
});
test("signed photo link cannot be reused for another image", () => {
  const url = new URL(photoUrl("https://example.test", "secret", "one"));
  assert.equal(
    verifyPhotoSignature(
      "secret",
      "two",
      url.searchParams.get("expires"),
      url.searchParams.get("signature"),
    ),
    false,
  );
});
