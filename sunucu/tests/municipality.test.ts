import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { startPilot } from "../src/pilot.js";
import { geminiTriage, modelInput, ruleTriage } from "../src/triage.js";

test("triage uses concrete safety, not abuse, and Gemini failure retains rules", async () => {
  const normal = {
    category: "road",
    kind: "issue",
    description: "Sokak yolu bozuk, çok sinirliyim!!!",
  };
  assert.equal(ruleTriage(normal).priority, "normal");
  assert.equal(
    ruleTriage({
      ...normal,
      description: "Tekerlekli sandalye ile kaldırımdan geçemiyorum.",
    }).priority,
    "high",
  );
  const urgent = {
    ...normal,
    description: "Açıkta elektrik kablosu var, kıvılcım çıkıyor.",
  };
  assert.equal(ruleTriage(urgent).priority, "urgent");
  const sanitized = modelInput({
    ...normal,
    ownerId: "private-owner",
    location: { address: "private-address" },
    photos: ["private-photo"],
    description: "test@example.com 0532 123 45 67 12345678901 yol bozuk",
  } as any);
  assert.deepEqual(Object.keys(sanitized).sort(), [
    "category",
    "description",
    "kind",
  ]);
  assert.doesNotMatch(
    JSON.stringify(sanitized),
    /private-|example.com|0532|12345678901/,
  );
  let calls = 0;
  const failed = await geminiTriage(urgent, ruleTriage(urgent), {
    apiKey: "test-only",
    model: "test",
    fetch: async () => {
      calls++;
      return new Response("unavailable", { status: 503 });
    },
  });
  assert.equal(calls, 1);
  assert.equal(failed.source, "rules");
  assert.equal(failed.aiState, "failed");
  assert.equal(failed.priority, "urgent");
  const result = await geminiTriage(urgent, ruleTriage(urgent), {
    apiKey: "test-only",
    model: "test",
    fetch: async () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text: JSON.stringify({
                      priority: "low",
                      reason: "Kozmetik bakım olduğu tahmin ediliyor.",
                    }),
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 20,
            candidatesTokenCount: 10,
            totalTokenCount: 30,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });
  assert.equal(result.source, "gemini");
  assert.equal(result.priority, "urgent");
});

test(
  "persistent LAN flow: real auth → report/photo → routing → operator → citizen, with role isolation and restart",
  { timeout: 60000 },
  async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "kent-oltu-test-"));
    const options = {
      dataDir,
      host: "127.0.0.1",
      port: 4322,
      pgPort: 5440,
      listenHost: "127.0.0.1",
    };
    let pilot = await startPilot(options);
    try {
      const signup = await request(pilot.app)
        .post("/api/auth/sign-up/email")
        .set("Origin", "https://localhost")
        .send({
          name: "Test Vatandaşı",
          email: "pilot@example.test",
          password: "Test-only-password123!",
        })
        .expect(200);
      const token = signup.headers["set-auth-token"];
      assert.ok(token);
      const citizen = {
        Authorization: `Bearer ${token}`,
        Origin: "https://localhost",
      };
      await request(pilot.app)
        .get("/api/municipality/workspace")
        .set(citizen)
        .expect(401);
      await request(pilot.app)
        .post("/api/municipality/local-session")
        .set("Origin", "https://localhost")
        .send({})
        .expect(403);
      const session = await request(pilot.app)
        .post("/api/municipality/local-session")
        .set("Origin", "http://localhost:4280")
        .send({})
        .expect(200);
      const admin = {
        Authorization: `Bearer ${session.body.token}`,
        Origin: "http://localhost:4280",
      };
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=",
        "base64",
      );
      const upload = await request(pilot.app)
        .put("/api/photos/pilot-photo")
        .set(citizen)
        .set("Content-Type", "image/png")
        .send(png)
        .expect(200);
      const payload = {
        requestId: "persistent-pilot-report",
        kind: "issue",
        category: "road",
        description: "Oltu okul girişinde yol çöktü, yaralanma riski var.",
        location: {
          source: "manual",
          address: "Cumhuriyet Mahallesi, Oltu, okul girişi",
        },
        photos: [upload.body.id],
      };
      const receipt = await request(pilot.app)
        .post("/api/reports")
        .set(citizen)
        .send(payload)
        .expect(200);
      const reportId = receipt.body.id;
      await request(pilot.app)
        .post("/api/reports")
        .set(citizen)
        .send(payload)
        .expect(200);
      let state = (
        await request(pilot.app)
          .get("/api/municipality/workspace")
          .set(admin)
          .expect(200)
      ).body.data;
      assert.equal(state.reports.length, 1);
      assert.equal(state.reports[0].unitId, "public-works");
      assert.equal(state.reports[0].priority, "urgent");
      assert.equal(state.reports[0].triage.source, "rules");
      const act = (body: object) =>
        request(pilot.app)
          .post("/api/municipality/actions")
          .set(admin)
          .send(body);
      await act({ type: "assign", id: reportId, unitId: "cleaning" }).expect(
        409,
      );
      await act({
        type: "assign",
        id: reportId,
        unitId: "public-works",
        teamId: "oltu-fen",
      }).expect(200);
      await act({
        type: "note",
        id: reportId,
        body: "Kurum içi gizli değerlendirme",
        audience: "internal",
      }).expect(200);
      await act({
        type: "note",
        id: reportId,
        body: "Onarım için güvenlik şeridi hazırlanıyor.",
        audience: "citizen",
      }).expect(200);
      await act({ type: "priority", id: reportId, priority: "high" }).expect(
        200,
      );
      await act({ type: "progress", id: reportId }).expect(200);
      await act({
        type: "resolve",
        id: reportId,
        body: "Hasarlı yol onarıldı ve güvenli geçiş sağlandı.",
      }).expect(200);
      const ws = (
        await request(pilot.app).get("/api/workspace").set(citizen).expect(200)
      ).body;
      assert.equal(ws.reports[0].status, "resolved");
      assert.equal(
        ws.reports[0].resolution.body,
        "Hasarlı yol onarıldı ve güvenli geçiş sağlandı.",
      );
      assert.doesNotMatch(JSON.stringify(ws), /gizli değerlendirme/);
      assert.equal(ws.reports[0].municipality, undefined);
      assert.ok(ws.inbox.some((n: any) => n.body.includes("güvenlik şeridi")));
      const photoPath = new URL(ws.reports[0].photos[0].uri);
      await request(pilot.app)
        .get(photoPath.pathname + photoPath.search)
        .expect(200);
      await request(pilot.app)
        .post(`/api/reports/${reportId}/feedback`)
        .set(citizen)
        .send({ outcome: "persists", text: "Bir noktada hasar devam ediyor." })
        .expect(200);
      const water = await request(pilot.app)
        .post("/api/reports")
        .set(citizen)
        .send({
          ...payload,
          requestId: "water-second",
          category: "water",
          photos: [],
        })
        .expect(200);
      state = (
        await request(pilot.app).get("/api/municipality/workspace").set(admin)
      ).body.data;
      assert.match(
        state.reports.find((r: any) => r.id === water.body.id).externalRouting,
        /teslim teyidi yok/,
      );
      await pilot.close();
      pilot = await startPilot(options);
      const restored = await request(pilot.app)
        .get("/api/workspace")
        .set(citizen)
        .expect(200);
      assert.equal(restored.body.reports.length, 2);
      assert.ok(
        restored.body.reports.find((r: any) => r.id === reportId).feedback
          .outcome === "persists",
      );
      state = (
        await request(pilot.app)
          .get("/api/municipality/workspace")
          .set(admin)
          .expect(200)
      ).body.data;
      const restoredReport = state.reports.find((r: any) => r.id === reportId);
      assert.equal(restoredReport.priority, "high");
      assert.equal(restoredReport.prioritySource, "authority");
      assert.equal(restoredReport.triage.priority, "urgent");
      assert.ok(
        restoredReport.events.some((e: any) =>
          e.body.includes("gizli değerlendirme"),
        ),
      );
      await request(pilot.app)
        .get(photoPath.pathname + photoPath.search)
        .expect(200);
      // Closing without field work is recorded as such, visibly to the citizen.
      await act({
        type: "reopen",
        id: reportId,
        body: "Vatandaş geri dönüşü üzerine yeniden bakılıyor.",
      }).expect(200);
      await act({
        type: "resolve",
        id: reportId,
        mode: "field_photo",
        body: "Geçersiz mod ile sonuçlandırma denemesi.",
      }).expect(400);
      await act({
        type: "resolve",
        id: reportId,
        mode: "no_field",
        body: "Yerinde kontrol edildi; ek saha işi gerekmedi.",
      }).expect(200);
      const closed = (
        await request(pilot.app).get("/api/workspace").set(citizen).expect(200)
      ).body.reports.find((r: any) => r.id === reportId);
      assert.equal(closed.status, "resolved");
      assert.ok(
        JSON.stringify(closed).includes("Saha işi gerekmeden sonuçlandırıldı"),
      );
    } finally {
      await pilot.close();
      await rm(dataDir, { recursive: true, force: true });
    }
  },
);
