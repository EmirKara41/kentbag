import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { startPilot } from "../src/pilot.js";

test(
  "shared issues preserve privacy, unique joins, shared updates and persistent subscriptions",
  { timeout: 60000 },
  async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "kent-community-test-"));
    const options = {
      dataDir,
      host: "127.0.0.1",
      port: 4324,
      pgPort: 5442,
      listenHost: "127.0.0.1",
    };
    let pilot = await startPilot(options);
    try {
      async function register(email: string) {
        const r = await request(pilot.app)
          .post("/api/auth/sign-up/email")
          .set("Origin", "https://localhost")
          .send({
            name: "Özel Test Kimliği",
            email,
            password: "Test-only-password123!",
          })
          .expect(200);
        return {
          Authorization: `Bearer ${r.headers["set-auth-token"]}`,
          Origin: "https://localhost",
        };
      }
      const owner = await register("owner@community.test"),
        participant = await register("participant@community.test");
      const session = await request(pilot.app)
        .post("/api/municipality/local-session")
        .set("Origin", "http://localhost:4280")
        .send({})
        .expect(200);
      const admin = {
        Authorization: `Bearer ${session.body.token}`,
        Origin: "http://localhost:4280",
      };
      const input = {
        requestId: "shared-test",
        kind: "issue",
        category: "road",
        description: "Özel açıklama sadece kuruma gitsin, yol hasarlı.",
        location: {
          source: "map",
          latitude: 40.545678,
          longitude: 41.994567,
          address: "Özel adres ve kapı numarası 123",
        },
        photos: [],
      };
      const report = (
        await request(pilot.app)
          .post("/api/reports")
          .set(owner)
          .send(input)
          .expect(200)
      ).body;
      assert.deepEqual(
        (await request(pilot.app).get("/api/community").expect(200)).body.items,
        [],
      );
      await request(pilot.app)
        .post(`/api/reports/${report.id}/sharing`)
        .set(participant)
        .send({ enabled: true, area: "Oltu" })
        .expect(404);
      await request(pilot.app)
        .post(`/api/reports/${report.id}/sharing`)
        .set(owner)
        .send({ enabled: true, area: "Cumhuriyet" })
        .expect(200);
      let items = (
        await request(pilot.app)
          .get("/api/community?latitude=40.545&longitude=41.994")
          .expect(200)
      ).body.items;
      assert.equal(items.length, 1);
      const issueId = items[0].id;
      assert.deepEqual(items[0].point, { latitude: 40.546, longitude: 41.995 });
      assert.equal(items[0].verification, "unverified");
      assert.doesNotMatch(
        JSON.stringify(items),
        /Özel|123|owner@|description|photos|ownerId|reportId/,
      );
      assert.equal(
        (
          await request(pilot.app).get(
            "/api/community?latitude=41&longitude=29",
          )
        ).body.items.length,
        0,
      );
      assert.equal(
        (await request(pilot.app).get("/api/community?area=Halitpaşa")).body
          .items.length,
        0,
      );
      await request(pilot.app).get("/api/community?latitude=40").expect(400);
      const subscription = () =>
        request(pilot.app).put(`/api/community/${issueId}/subscription`);
      await subscription().send({ subscribed: true }).expect(401);
      await subscription().set(owner).send({ subscribed: true }).expect(409);
      await subscription()
        .set(participant)
        .send({ subscribed: true })
        .expect(200);
      await subscription()
        .set(participant)
        .send({ subscribed: true })
        .expect(200);
      let detail = (
        await request(pilot.app)
          .get(`/api/community/${issueId}`)
          .set(participant)
          .expect(200)
      ).body;
      assert.equal(detail.participantCount, 2);
      assert.equal(detail.joined, true);
      let ws = (
        await request(pilot.app)
          .get("/api/workspace")
          .set(participant)
          .expect(200)
      ).body;
      assert.equal(ws.reports.length, 0);
      assert.equal(ws.subscriptions.length, 1);
      const act = (body: object) =>
        request(pilot.app)
          .post("/api/municipality/actions")
          .set(admin)
          .send({ id: report.id, ...body });
      await act({
        type: "note",
        audience: "citizen",
        body: "Sadece talep sahibine özel yanıt.",
      }).expect(200);
      await act({
        type: "note",
        audience: "internal",
        body: "Kurum içi özel not.",
      }).expect(200);
      ws = (await request(pilot.app).get("/api/workspace").set(participant))
        .body;
      assert.equal(ws.inbox.length, 0);
      await act({
        type: "note",
        audience: "participants",
        body: "Ekip bölgeye yönlendirildi; ortak güncelleme.",
      }).expect(200);
      ws = (await request(pilot.app).get("/api/workspace").set(participant))
        .body;
      assert.equal(ws.inbox.length, 1);
      assert.equal(ws.inbox[0].issueId, issueId);
      assert.equal(ws.inbox[0].reportId, undefined);
      const ownerWorkspace = (
        await request(pilot.app).get("/api/workspace").set(owner).expect(200)
      ).body;
      assert.equal(
        ownerWorkspace.inbox.filter(
          (i: any) =>
            i.body === "Ekip bölgeye yönlendirildi; ortak güncelleme.",
        ).length,
        1,
      );
      assert.equal(
        ownerWorkspace.reports
          .find((r: any) => r.id === report.id)
          .events.filter(
            (e: any) =>
              e.body === "Ekip bölgeye yönlendirildi; ortak güncelleme.",
          ).length,
        1,
      );
      detail = (await request(pilot.app).get(`/api/community/${issueId}`)).body;
      assert.equal(detail.events.length, 1);
      assert.doesNotMatch(
        JSON.stringify(detail),
        /özel yanıt|özel not|Özel açıklama|Özel adres/,
      );
      await act({
        type: "assign",
        unitId: "public-works",
        teamId: "oltu-fen",
      }).expect(200);
      await act({ type: "progress" }).expect(200);
      ws = (await request(pilot.app).get("/api/workspace").set(participant))
        .body;
      assert.ok(
        ws.inbox.some((i: any) =>
          i.body.startsWith("Kurum kaydındaki son durum:"),
        ),
      );
      const sharedStatuses = ws.inbox.filter((i: any) =>
        i.body.startsWith("Kurum kaydındaki son durum:"),
      );
      const ownerAfterStatus = (
        await request(pilot.app).get("/api/workspace").set(owner)
      ).body;
      for (const status of sharedStatuses) {
        assert.equal(
          ownerAfterStatus.inbox.filter(
            (i: any) =>
              i.communityEventId === status.communityEventId &&
              i.body === status.body,
          ).length,
          1,
        );
        assert.ok(
          ownerAfterStatus.reports
            .find((r: any) => r.id === report.id)
            .events.some((e: any) => e.body === status.body),
        );
      }
      // Simulate the old omission; repair must restore only the owner, once.
      const lostStatus = sharedStatuses[0];
      await pilot.db.query(
        "DELETE FROM citizen_inbox WHERE owner_id=$1 AND document->>'communityEventId'=$2",
        [ownerAfterStatus.sessionId, lostStatus.communityEventId],
      );
      await pilot.db.query(
        "UPDATE citizen_report SET document=jsonb_set(document,'{events}',$1::jsonb) WHERE id=$2",
        [
          JSON.stringify(
            ownerAfterStatus.reports
              .find((r: any) => r.id === report.id)
              .events.filter((e: any) => e.id !== lostStatus.communityEventId),
          ),
          report.id,
        ],
      );
      const repair = await readFile(
        new URL("../migrations/004_owner_shared_updates.sql", import.meta.url),
        "utf8",
      );
      await pilot.db.query(repair);
      await pilot.db.query(repair);
      const repairedOwner = (
        await request(pilot.app).get("/api/workspace").set(owner)
      ).body;
      assert.equal(
        repairedOwner.inbox.filter(
          (i: any) => i.communityEventId === lostStatus.communityEventId,
        ).length,
        1,
      );
      assert.equal(
        repairedOwner.reports
          .find((r: any) => r.id === report.id)
          .events.filter((e: any) => e.id === lostStatus.communityEventId)
          .length,
        1,
      );
      await pilot.close();
      pilot = await startPilot(options);
      ws = (
        await request(pilot.app)
          .get("/api/workspace")
          .set(participant)
          .expect(200)
      ).body;
      assert.equal(ws.subscriptions.length, 1);
      assert.equal(ws.subscriptions[0].joined, true);
      const restoredOwner = (
        await request(pilot.app).get("/api/workspace").set(owner).expect(200)
      ).body;
      assert.equal(
        restoredOwner.inbox.filter(
          (i: any) => i.communityEventId === lostStatus.communityEventId,
        ).length,
        1,
      );
      assert.ok(
        restoredOwner.reports
          .find((r: any) => r.id === report.id)
          .events.some((e: any) => e.id === lostStatus.communityEventId),
      );
      await request(pilot.app)
        .post(`/api/reports/${report.id}/sharing`)
        .set(owner)
        .send({ enabled: false, area: "Cumhuriyet" })
        .expect(200);
      await request(pilot.app).get(`/api/community/${issueId}`).expect(404);
      assert.equal(
        (await request(pilot.app).get("/api/community")).body.items.length,
        0,
      );
      ws = (await request(pilot.app).get("/api/workspace").set(participant))
        .body;
      assert.equal(ws.subscriptions[0].available, false);
      assert.equal(ws.subscriptions[0].point, undefined);
      await subscription()
        .set(participant)
        .send({ subscribed: false })
        .expect(200);
      assert.equal(
        (await request(pilot.app).get("/api/workspace").set(participant)).body
          .subscriptions.length,
        0,
      );
      const fresh = (
        await request(pilot.app)
          .post("/api/reports")
          .set(owner)
          .send({
            ...input,
            requestId: "opt-in-new",
            sharePublicly: true,
            publicArea: "Aslanpaşa",
            location: {
              source: "manual",
              address: "Aslanpaşa Mahallesi, Oltu, okul girişi",
            },
          })
          .expect(200)
      ).body;
      items = (await request(pilot.app).get("/api/community?area=Aslanpaşa"))
        .body.items;
      assert.equal(items.length, 1);
      assert.equal(items[0].point, undefined);
      assert.equal(
        (
          await request(pilot.app).get(
            "/api/community?latitude=40.545&longitude=41.994",
          )
        ).body.items.length,
        0,
      );
      assert.equal(fresh.sharePublicly, true);
    } finally {
      await pilot.close();
      await rm(dataDir, { recursive: true, force: true });
    }
  },
);
