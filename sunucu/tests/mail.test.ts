import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { startPilot } from "../src/pilot.js";
import { InstitutionMail } from "../src/mail.js";
import { InstitutionService } from "../src/institutions.js";

test(
  "institution email keeps a persistent outbox, retries idempotently and does not claim citizen delivery",
  { timeout: 60000 },
  async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "kent-mail-test-"));
    const previous = process.env.DEMO_MAIL_TO;
    process.env.DEMO_MAIL_TO = "demo@example.test";
    const pilot = await startPilot({
      dataDir,
      host: "127.0.0.1",
      port: 4327,
      pgPort: 5445,
      listenHost: "127.0.0.1",
    });
    try {
      const account = await request(pilot.app)
        .post("/api/auth/sign-up/email")
        .set("Origin", "https://localhost")
        .send({
          name: "Mail test",
          email: "mail-citizen@example.test",
          password: "Test-mail-password123!",
        })
        .expect(200);
      const citizen = {
        Origin: "https://localhost",
        Authorization: `Bearer ${account.headers["set-auth-token"]}`,
      };
      const report = (
        await request(pilot.app)
          .post("/api/reports")
          .set(citizen)
          .send({
            requestId: "mail-test-road",
            kind: "issue",
            category: "road",
            description: "TEST BİLDİRİMİ: okul girişinde yol hasarı var.",
            location: {
              source: "manual",
              address: "TEST ADRESİ, Oltu Cumhuriyet Mahallesi",
            },
            photos: [],
          })
          .expect(200)
      ).body;
      const before = (
        await request(pilot.app).get("/api/workspace").set(citizen).expect(200)
      ).body.inbox.length;
      const institutions = new InstitutionService(pilot.db, pilot.service);
      const input = {
        id: report.id,
        unitId: "public-works",
        instruction: "TEST: yol hasarını inceleyin.",
        channel: "both",
      };
      await institutions.forward(input);
      await institutions.forward(input);
      const failed = new InstitutionMail(pilot.db, async () => {
        throw new Error("provider-secret-diagnostics");
      });
      let result = await failed.dispatch(report.id);
      assert.equal(result.mails.length, 1);
      assert.equal(result.mails[0].state, "failed");
      assert.ok(!result.mails[0].error.includes("provider-secret"));
      const keys: string[] = [];
      const mail = new InstitutionMail(pilot.db, async (payload, key) => {
        assert.equal(payload.to, "demo@example.test");
        assert.ok(payload.text.includes("Yol ve Fen İşleri"));
        assert.ok(payload.text.includes(report.reference));
        assert.ok(payload.text.includes("TEST: yol hasarını inceleyin."));
        keys.push(key);
        return "test-provider-id";
      });
      result = await mail.dispatch(report.id);
      assert.equal(result.mails[0].state, "sent");
      assert.equal(result.mails[0].providerId, "test-provider-id");
      await mail.dispatch(report.id);
      assert.equal(keys.length, 1);
      assert.equal(keys[0], result.mails[0].id);
      const after = (
        await request(pilot.app).get("/api/workspace").set(citizen).expect(200)
      ).body;
      assert.equal(after.inbox.length, before);
      assert.ok(!JSON.stringify(after).includes("demo@example.test"));
    } finally {
      if (previous === undefined) delete process.env.DEMO_MAIL_TO;
      else process.env.DEMO_MAIL_TO = previous;
      await pilot.close();
      await rm(dataDir, { recursive: true, force: true });
    }
  },
);
