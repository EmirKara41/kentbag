import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { startPilot } from "../src/pilot.js";

test(
  "result photos are optional only for outages; a crew can hand a job back to its institution",
  { timeout: 90000 },
  async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "kent-field-decline-"));
    const options = {
      dataDir,
      host: "127.0.0.1",
      port: 4331,
      pgPort: 5449,
      listenHost: "127.0.0.1",
    };
    let pilot = await startPilot(options);
    const origin = "https://localhost";
    const panel = "http://localhost:4280";
    try {
      const owner = await request(pilot.app)
        .post("/api/auth/sign-up/email")
        .set("Origin", origin)
        .send({
          name: "Test Vatandaşı",
          email: "owner-decline@example.test",
          password: "Test-field-password123!",
        })
        .expect(200);
      const citizen = {
        Origin: origin,
        Authorization: `Bearer ${owner.headers["set-auth-token"]}`,
      };
      const adminLogin = await request(pilot.app)
        .post("/api/municipality/local-session")
        .set("Origin", panel)
        .send({})
        .expect(200);
      const admin = {
        Origin: panel,
        Authorization: `Bearer ${adminLogin.body.token}`,
      };
      const crew = async (email: string, unitId: string, teamId: string) => {
        await request(pilot.app)
          .post("/api/municipality/staff")
          .set(admin)
          .send({
            name: "Test saha personeli",
            email,
            password: "Test-field-password123!",
            role: "crew",
            unitId,
            teamId,
          })
          .expect(200);
        const r = await request(pilot.app)
          .post("/api/auth/sign-in/email")
          .set("Origin", origin)
          .send({ email, password: "Test-field-password123!" })
          .expect(200);
        return {
          Origin: origin,
          Authorization: `Bearer ${r.headers["set-auth-token"]}`,
        };
      };
      const institution = async (unitId: string) => {
        const r = await request(pilot.app)
          .post(`/api/institutions/${unitId}/local-session`)
          .set("Origin", panel)
          .send({})
          .expect(200);
        return { Origin: panel, Authorization: `Bearer ${r.body.token}` };
      };
      // Citizen report → center forward → institution accept + order.
      const prepare = async (
        requestId: string,
        category: string,
        unitId: string,
        teamId: string,
      ) => {
        const report = (
          await request(pilot.app)
            .post("/api/reports")
            .set(citizen)
            .send({
              requestId,
              kind: "issue",
              category,
              description: "Test kaydı: saha sonucu kuralı denenecek.",
              location: { source: "manual", address: "Oltu test adresi" },
              photos: [],
            })
            .expect(200)
        ).body;
        await request(pilot.app)
          .post("/api/municipality/institutions/forward")
          .set(admin)
          .send({
            id: report.id,
            unitId,
            instruction: "Test görevini inceleyin.",
          })
          .expect(200);
        const inst = await institution(unitId);
        const instAct = (body: object) =>
          request(pilot.app)
            .post(`/api/institutions/${unitId}/actions`)
            .set(inst)
            .send({ id: report.id, ...body });
        await instAct({ type: "accept" }).expect(200);
        await instAct({
          type: "order",
          teamId,
          instruction: "Test görevini yerinde yapın.",
          priority: "normal",
        }).expect(200);
        return { report, instAct };
      };
      const fieldJobs = async (who: Record<string, string>) =>
        (
          await request(pilot.app)
            .get("/api/field/workspace")
            .set(who)
            .expect(200)
        ).body.jobs;
      const act = (who: Record<string, string>, body: object) =>
        request(pilot.app).post("/api/field/actions").set(who).send(body);

      // Road work needs at least one result photo.
      const road = await crew("road-crew@example.test", "public-works", "fen-yol");
      await prepare("decline-road", "road", "public-works", "fen-yol");
      const [roadJob] = await fieldJobs(road);
      assert.equal(roadJob.photoOptional, false);
      await act(road, { orderId: roadJob.id, type: "accept" }).expect(200);
      const noPhoto = await act(road, {
        orderId: roadJob.id,
        type: "submit-result",
        body: "Çukur dolduruldu, yüzey düzeltildi.",
        photos: [],
      }).expect(409);
      assert.match(noPhoto.body.error, /en az bir sonuç fotoğrafı/);

      // A water outage can be closed with a written result only.
      const water = await crew("water-crew@example.test", "water", "su-ariza");
      await prepare("decline-water", "water", "water", "su-ariza");
      const [waterJob] = await fieldJobs(water);
      assert.equal(waterJob.photoOptional, true);
      await act(water, { orderId: waterJob.id, type: "accept" }).expect(200);
      await act(water, {
        orderId: waterJob.id,
        type: "submit-result",
        body: "Vana değiştirildi, su verildi ve basınç kontrol edildi.",
        photos: [],
      }).expect(200);
      assert.equal(
        (await fieldJobs(water))[0].crewState,
        "institution_review",
      );

      // The road crew hands its job back with a reason.
      await act(road, {
        orderId: roadJob.id,
        type: "decline",
        body: "kısa",
      }).expect(400);
      const reason = "Adreste böyle bir hasar bulunamadı; konum teyidi gerekiyor.";
      await act(road, { orderId: roadJob.id, type: "decline", body: reason }).expect(200);
      await act(road, { orderId: roadJob.id, type: "decline", body: reason }).expect(200);
      const declined = (await fieldJobs(road))[0];
      assert.equal(declined.crewState, "declined");
      assert.equal(declined.declineReason, reason);
      assert.equal(declined.events.filter((e: any) => e.stage === "declined").length, 1);
      await act(road, {
        orderId: roadJob.id,
        type: "submit-result",
        body: "İade sonrası sonuç gönderilmemeli.",
        photos: [],
      }).expect(409);
      await act(road, { orderId: roadJob.id, type: "start" }).expect(409);

      // The center sees the decline on the field order; nothing reaches the citizen.
      const center = (
        await request(pilot.app)
          .get("/api/municipality/workspace")
          .set(admin)
          .expect(200)
      ).body.data;
      const centerReport = center.reports.find((r: any) =>
        r.fieldOrders?.some((o: any) => o.id === roadJob.id),
      );
      assert.equal(centerReport.fieldOrders[0].crewState, "declined");
      assert.equal(centerReport.fieldOrders[0].declineReason, reason);
      const mine = (
        await request(pilot.app).get("/api/workspace").set(citizen).expect(200)
      ).body;
      assert.doesNotMatch(JSON.stringify(mine), /konum teyidi gerekiyor/);

      // The institution cancels the declined order and prepares a new one.
      const inst = await institution("public-works");
      const roadReportId = centerReport.id;
      await request(pilot.app)
        .post("/api/institutions/public-works/actions")
        .set(inst)
        .send({
          id: roadReportId,
          type: "cancel-order",
          orderId: roadJob.id,
          body: "Ekip iade etti; konum teyidiyle yeniden hazırlanacak.",
        })
        .expect(200);
      await request(pilot.app)
        .post("/api/institutions/public-works/actions")
        .set(inst)
        .send({
          id: roadReportId,
          type: "order",
          teamId: "fen-kis",
          instruction: "Vatandaşla görüşülerek konum teyit edildi; tekrar bakın.",
          priority: "normal",
        })
        .expect(200);
      const winter = await crew("winter-crew@example.test", "public-works", "fen-kis");
      const reassigned = await fieldJobs(winter);
      assert.equal(reassigned.length, 1);
      assert.equal(reassigned[0].crewState, "assigned");

      // State survives a restart.
      await pilot.close();
      pilot = await startPilot(options);
      const restored = await fieldJobs(road);
      assert.equal(restored[0].crewState, "declined");
      assert.equal(restored[0].declineReason, reason);
    } finally {
      await pilot.close();
      await rm(dataDir, { recursive: true, force: true });
    }
  },
);
