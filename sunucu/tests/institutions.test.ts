import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { startPilot } from "../src/pilot.js";

test(
  "institution delivery is scoped, acknowledged, persistent and prepares orders without pretending crew delivery",
  { timeout: 60000 },
  async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "kent-institutions-test-"));
    const options = {
      dataDir,
      host: "127.0.0.1",
      port: 4325,
      pgPort: 5443,
      listenHost: "127.0.0.1",
    };
    let pilot = await startPilot(options);
    try {
      const signup = await request(pilot.app)
        .post("/api/auth/sign-up/email")
        .set("Origin", "https://localhost")
        .send({
          name: "Özel Kimlik",
          email: "institution-owner@example.test",
          password: "Test-only-password123!",
        })
        .expect(200);
      const citizen = {
        Authorization: `Bearer ${signup.headers["set-auth-token"]}`,
        Origin: "https://localhost",
      };
      const participantAccount = await request(pilot.app)
        .post("/api/auth/sign-up/email")
        .set("Origin", "https://localhost")
        .send({
          name: "Katılan vatandaş",
          email: "institution-participant@example.test",
          password: "Test-only-password123!",
        })
        .expect(200);
      const participant = {
        Origin: "https://localhost",
        Authorization: `Bearer ${participantAccount.headers["set-auth-token"]}`,
      };
      const adminSession = await request(pilot.app)
        .post("/api/municipality/local-session")
        .set("Origin", "http://localhost:4280")
        .send({})
        .expect(200);
      const admin = {
        Authorization: `Bearer ${adminSession.body.token}`,
        Origin: "http://localhost:4280",
      };
      const unitSession = async (unit: string) => {
        const r = await request(pilot.app)
          .post(`/api/institutions/${unit}/local-session`)
          .set("Origin", "http://localhost:4280")
          .send({})
          .expect(200);
        return {
          Authorization: `Bearer ${r.body.token}`,
          Origin: "http://localhost:4280",
        };
      };
      const roadRole = await unitSession("public-works"),
        electricRole = await unitSession("electricity-external"),
        waterRole = await unitSession("water");
      await request(pilot.app)
        .post("/api/institutions/water/local-session")
        .set("Origin", "https://localhost")
        .send({})
        .expect(403);
      await request(pilot.app)
        .post("/api/institutions/unknown/local-session")
        .set("Origin", "http://localhost:4280")
        .send({})
        .expect(404);
      await request(pilot.app)
        .get("/api/institutions/public-works/workspace")
        .expect(401);
      await request(pilot.app)
        .get("/api/institutions/public-works/workspace")
        .set(citizen)
        .expect(401);
      await request(pilot.app)
        .get("/api/institutions/water/workspace")
        .set(roadRole)
        .expect(403);
      await request(pilot.app)
        .get("/api/municipality/workspace")
        .set(roadRole)
        .expect(401);
      const payload = {
        requestId: "institution-road",
        category: "road",
        kind: "issue",
        description: "Okul girişindeki yol hasarı kontrol edilmeli.",
        location: {
          source: "manual",
          address: "Cumhuriyet Mahallesi Oltu, okul girişi",
        },
        photos: [],
        sharePublicly: true,
        publicArea: "Oltu",
      };
      const road = (
        await request(pilot.app)
          .post("/api/reports")
          .set(citizen)
          .send(payload)
          .expect(200)
      ).body;
      const electric = (
        await request(pilot.app)
          .post("/api/reports")
          .set(citizen)
          .send({
            ...payload,
            requestId: "institution-electric",
            category: "electricity",
            description: "Sokakta elektrik kesintisi yaşanıyor.",
          })
          .expect(200)
      ).body;
      await request(pilot.app)
        .post("/api/municipality/actions")
        .set(admin)
        .send({
          type: "note",
          id: road.id,
          audience: "internal",
          body: "Merkezin gizli değerlendirmesi",
        })
        .expect(200);
      const before = (
        await request(pilot.app).get("/api/workspace").set(citizen)
      ).body;
      const issueId = (
        await request(pilot.app).get("/api/community?category=road").expect(200)
      ).body.items[0].id;
      await request(pilot.app)
        .put(`/api/community/${issueId}/subscription`)
        .set(participant)
        .send({ subscribed: true })
        .expect(200);
      const forward = (id: string, unitId: string) =>
        request(pilot.app)
          .post("/api/municipality/institutions/forward")
          .set(admin)
          .send({
            id,
            unitId,
            instruction: "Talebi inceleyip uygun bir saha görevi hazırlayın.",
          });
      await forward(road.id, "water").expect(409);
      await request(pilot.app)
        .post("/api/municipality/institutions/forward")
        .set(roadRole)
        .send({
          id: road.id,
          unitId: "public-works",
          instruction: "Geçersiz yetki denemesi",
        })
        .expect(401);
      await forward(road.id, "public-works").expect(200);
      await forward(road.id, "public-works").expect(200);
      await forward(electric.id, "electricity-external").expect(200);
      const joinedAfterForward = (
        await request(pilot.app)
          .get("/api/workspace")
          .set(participant)
          .expect(200)
      ).body;
      assert.equal(joinedAfterForward.inbox.length, 1);
      assert.equal(joinedAfterForward.inbox[0].issueId, issueId);
      assert.match(
        joinedAfterForward.inbox[0].body,
        /Yol ve Fen İşleri kurumuna iletildi/,
      );
      assert.doesNotMatch(
        JSON.stringify(joinedAfterForward),
        /Talebi inceleyip uygun bir saha görevi|gizli değerlendirmesi/,
      );
      const workspace = async (unit: string, role: Record<string, string>) =>
        (
          await request(pilot.app)
            .get(`/api/institutions/${unit}/workspace`)
            .set(role)
            .expect(200)
        ).body;
      let roadWs = await workspace("public-works", roadRole);
      assert.equal(roadWs.cases.length, 1);
      assert.equal(roadWs.cases[0].id, road.id);
      assert.equal(roadWs.cases[0].events.length, 1);
      assert.equal(roadWs.cases[0].delivery.state, "queued");
      assert.equal(roadWs.crewConnected, false);
      assert.equal(
        (await workspace("electricity-external", electricRole)).cases[0].id,
        electric.id,
      );
      assert.equal((await workspace("water", waterRole)).cases.length, 0);
      assert.doesNotMatch(
        JSON.stringify(roadWs),
        /Özel Kimlik|institution-owner|gizli değerlendirmesi|ownerId|municipality/,
      );
      const act = (role: Record<string, string>, unit: string, body: object) =>
        request(pilot.app)
          .post(`/api/institutions/${unit}/actions`)
          .set(role)
          .send({ id: road.id, ...body });
      const order = {
        type: "order",
        teamId: "fen-yol",
        instruction: "Okul girişindeki hasarı yerinde kontrol edin.",
        priority: "high",
      };
      await act(roadRole, "public-works", order).expect(409);
      await act(electricRole, "electricity-external", {
        type: "accept",
      }).expect(404);
      await act(roadRole, "public-works", { type: "accept" }).expect(200);
      await act(roadRole, "public-works", { type: "accept" }).expect(200);
      await act(roadRole, "public-works", {
        ...order,
        teamId: "elektrik-ariza",
      }).expect(409);
      await Promise.all([
        act(roadRole, "public-works", order).expect(200),
        act(roadRole, "public-works", order).expect(200),
      ]);
      await act(roadRole, "public-works", {
        ...order,
        instruction: "Değiştirilmiş ikinci görev denemesi",
      }).expect(409);
      roadWs = await workspace("public-works", roadRole);
      assert.equal(roadWs.cases[0].orders.length, 1);
      assert.equal(roadWs.cases[0].orders[0].state, "prepared");
      assert.equal(roadWs.cases[0].delivery.preparedCount, 1);
      const after = (
        await request(pilot.app).get("/api/workspace").set(citizen)
      ).body;
      assert.equal(after.inbox.length, before.inbox.length + 3);
      assert.equal(
        after.inbox.filter((i: any) =>
          i.body.includes("Yol ve Fen İşleri kurumuna iletildi"),
        ).length,
        1,
      );
      assert.equal(
        after.inbox.filter(
          (i: any) =>
            i.body === "Yol ve Fen İşleri bildiriminizi incelemeye aldı.",
        ).length,
        1,
      );
      assert.equal(
        after.reports.find((r: any) => r.id === road.id).status,
        "in_review",
      );
      assert.doesNotMatch(JSON.stringify(after), /saha görevi hazırlayın/);
      const joinedAfterAccept = (
        await request(pilot.app)
          .get("/api/workspace")
          .set(participant)
          .expect(200)
      ).body;
      assert.equal(joinedAfterAccept.inbox.length, 2);
      assert.equal(
        joinedAfterAccept.inbox.filter(
          (i: any) =>
            i.body === "Yol ve Fen İşleri bildiriminizi incelemeye aldı.",
        ).length,
        1,
      );
      await act(roadRole, "public-works", {
        type: "note",
        body: "Kurumun özel saha hazırlık notu.",
      }).expect(200);
      const afterInternal = (
        await request(pilot.app).get("/api/workspace").set(citizen)
      ).body;
      assert.doesNotMatch(JSON.stringify(afterInternal), /özel saha hazırlık/);
      await act(roadRole, "public-works", {
        type: "message",
        audience: "participants",
        body: "Kurumumuz yerinde inceleme planlıyor.",
      }).expect(200);
      const owner = (
        await request(pilot.app).get("/api/workspace").set(citizen)
      ).body;
      assert.ok(
        owner.inbox.some(
          (i: any) => i.body === "Kurumumuz yerinde inceleme planlıyor.",
        ),
      );
      assert.ok(
        (await workspace("public-works", roadRole)).cases[0].events.some(
          (e: any) => e.body === "Kurumumuz yerinde inceleme planlıyor.",
        ),
      );
      await act(roadRole, "public-works", {
        type: "resolve",
        body: "Yetki dışı çözüm denemesi",
      }).expect(400);
      const orderId = roadWs.cases[0].orders[0].id;
      await pilot.close();
      pilot = await startPilot(options);
      roadWs = await workspace("public-works", roadRole);
      assert.equal(roadWs.cases[0].orders[0].id, orderId);
      assert.equal(roadWs.cases[0].delivery.state, "accepted");
      const center = (
        await request(pilot.app)
          .get("/api/municipality/workspace")
          .set(admin)
          .expect(200)
      ).body;
      assert.equal(
        center.data.reports.find((r: any) => r.id === road.id)
          .institutionDelivery.preparedCount,
        1,
      );
      assert.ok(
        center.data.reports
          .find((r: any) => r.id === road.id)
          .institutionDelivery.events.some(
            (e: any) => e.body === "Kurumun özel saha hazırlık notu.",
          ),
      );
      assert.ok(
        center.data.audit.some((a: any) =>
          a.body.includes("Görev emri hazırlandı"),
        ),
      );
      await act(roadRole, "public-works", {
        type: "return",
        body: "Konum için merkezden ek bilgi gerekiyor.",
      }).expect(200);
      roadWs = await workspace("public-works", roadRole);
      assert.equal(roadWs.cases[0].orders[0].state, "cancelled");
      assert.equal(roadWs.cases[0].delivery.state, "returned");
      await act(roadRole, "public-works", order).expect(409);
      await act(roadRole, "public-works", {
        type: "message",
        audience: "citizen",
        body: "İade sonrası yetkisiz mesaj",
      }).expect(409);
      await forward(road.id, "public-works").expect(200);
      roadWs = await workspace("public-works", roadRole);
      assert.equal(roadWs.cases[0].delivery.state, "queued");
      assert.equal(roadWs.cases[0].orders.length, 0);
      await request(pilot.app)
        .post("/api/institutions/electricity-external/actions")
        .set(electricRole)
        .send({ type: "accept", id: electric.id })
        .expect(200);
      await request(pilot.app)
        .post("/api/institutions/electricity-external/actions")
        .set(electricRole)
        .send({
          type: "order",
          id: electric.id,
          teamId: "elektrik-trafo",
          instruction: "Şebekeyi kontrol edip arıza kaynağını raporlayın.",
          priority: "high",
        })
        .expect(200);
      assert.equal(
        (await workspace("electricity-external", electricRole)).cases[0]
          .orders[0].teamId,
        "elektrik-trafo",
      );
      await request(pilot.app)
        .post(`/api/reports/${electric.id}/withdraw`)
        .set(citizen)
        .send({})
        .expect(409);
      assert.equal(
        (await workspace("electricity-external", electricRole)).cases[0]
          .orders[0].state,
        "prepared",
      );
      await request(pilot.app)
        .post("/api/municipality/actions")
        .set(admin)
        .send({
          type: "resolve",
          id: electric.id,
          body: "Test kapsamında inceleme sonucu merkez tarafından kaydedildi.",
        })
        .expect(200);
      const withdrawn = await workspace("electricity-external", electricRole);
      assert.equal(withdrawn.cases[0].orders[0].state, "cancelled");
      assert.equal(withdrawn.cases[0].actionable, false);
      await request(pilot.app)
        .post("/api/institutions/electricity-external/actions")
        .set(electricRole)
        .send({
          type: "note",
          id: electric.id,
          body: "Geri çekilmiş talebe yeni işlem.",
        })
        .expect(409);
    } finally {
      await pilot.close();
      await rm(dataDir, { recursive: true, force: true });
    }
  },
);
