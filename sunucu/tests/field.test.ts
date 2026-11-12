import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { startPilot } from "../src/pilot.js";
test(
  "field result requires crew → institution → center and stays private until final publication",
  { timeout: 90000 },
  async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "kent-field-test-"));
    const options = {
      dataDir,
      host: "127.0.0.1",
      port: 4328,
      pgPort: 5446,
      listenHost: "127.0.0.1",
    };
    let pilot = await startPilot(options);
    const origin = "https://localhost";
    const sign = async (email: string) => {
      const r = await request(pilot.app)
        .post("/api/auth/sign-up/email")
        .set("Origin", origin)
        .send({
          name: email.startsWith("owner") ? "Özel Vatandaş Kimliği" : "Takipçi",
          email,
          password: "Test-field-password123!",
        })
        .expect(200);
      return {
        Origin: origin,
        Authorization: `Bearer ${r.headers["set-auth-token"]}`,
      };
    };
    try {
      const owner = await sign("owner-field@example.test"),
        participant = await sign("joined-field@example.test");
      const adminLogin = await request(pilot.app)
        .post("/api/municipality/local-session")
        .set("Origin", "http://localhost:4280")
        .send({})
        .expect(200);
      const admin = {
        Origin: "http://localhost:4280",
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
      const field = await crew(
          "field-trafo@example.test",
          "electricity-external",
          "elektrik-trafo",
        ),
        other = await crew(
          "field-other@example.test",
          "electricity-external",
          "elektrik-ariza",
        ),
        water = await crew("field-water@example.test", "water", "su-ariza");
      const role = await request(pilot.app)
        .post("/api/institutions/electricity-external/local-session")
        .set("Origin", "http://localhost:4280")
        .send({})
        .expect(200);
      const institution = {
        Origin: "http://localhost:4280",
        Authorization: `Bearer ${role.body.token}`,
      };
      const report = (
        await request(pilot.app)
          .post("/api/reports")
          .set(owner)
          .send({
            requestId: "field-result-flow",
            kind: "issue",
            category: "electricity",
            description: "Özel açıklama: elektrik arızası testi yapılacak.",
            location: {
              source: "manual",
              address: "Özel adres: Oltu test binası",
            },
            photos: [],
            sharePublicly: true,
            publicArea: "Oltu",
          })
          .expect(200)
      ).body;
      const issue = (await request(pilot.app).get("/api/community").expect(200))
        .body.items[0];
      await request(pilot.app)
        .put(`/api/community/${issue.id}/subscription`)
        .set(participant)
        .send({ subscribed: true })
        .expect(200);
      await request(pilot.app)
        .post("/api/municipality/actions")
        .set(admin)
        .send({
          type: "note",
          id: report.id,
          audience: "internal",
          body: "Merkezin gizli operasyon notu",
        })
        .expect(200);
      await request(pilot.app)
        .post("/api/municipality/institutions/forward")
        .set(admin)
        .send({
          id: report.id,
          unitId: "electricity-external",
          instruction: "Demo elektrik görevini inceleyin.",
        })
        .expect(200);
      const instAct = (body: object) =>
        request(pilot.app)
          .post("/api/institutions/electricity-external/actions")
          .set(institution)
          .send({ id: report.id, ...body });
      await instAct({ type: "accept" }).expect(200);
      await instAct({
        type: "order",
        teamId: "elektrik-trafo",
        instruction: "Demo trafo incelemesi yapın ve sonucunu bildirin.",
        priority: "high",
      }).expect(200);
      await request(pilot.app)
        .get("/api/field/workspace")
        .set(owner)
        .expect(401);
      await request(pilot.app)
        .get("/api/field/workspace")
        .set(institution)
        .expect(401);
      const jobs = (
        await request(pilot.app)
          .get("/api/field/workspace")
          .set(field)
          .expect(200)
      ).body;
      assert.equal(jobs.jobs.length, 1);
      assert.doesNotMatch(
        JSON.stringify(jobs),
        /Özel Vatandaş Kimliği|owner-field|gizli operasyon|ownerId/,
      );
      assert.equal(
        (
          await request(pilot.app)
            .get("/api/field/workspace")
            .set(other)
            .expect(200)
        ).body.jobs.length,
        0,
      );
      assert.equal(
        (
          await request(pilot.app)
            .get("/api/field/workspace")
            .set(water)
            .expect(200)
        ).body.jobs.length,
        0,
      );
      const orderId = jobs.jobs[0].id;
      const action = (body: object, who = field) =>
        request(pilot.app)
          .post("/api/field/actions")
          .set(who)
          .send({ orderId, ...body });
      await action({ type: "accept" }, other).expect(404);
      await action({ type: "accept" }, water).expect(404);
      const beforeOwner = (
        await request(pilot.app).get("/api/workspace").set(owner)
      ).body.inbox.length;
      const beforeParticipant = (
        await request(pilot.app).get("/api/workspace").set(participant)
      ).body.inbox.length;
      await action({ type: "start" }).expect(409);
      await action({ type: "accept" }).expect(200);
      await action({ type: "accept" }).expect(200);
      await action({ type: "start" }).expect(200);
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=",
        "base64",
      );
      const upload = async (who: Record<string, string>, name: string) =>
        (
          await request(pilot.app)
            .put(`/api/photos/${name}`)
            .set(who)
            .set("Content-Type", "image/png")
            .send(png)
            .expect(200)
        ).body.id;
      const photoId = await upload(field, "field-result-photo"),
        foreign = await upload(owner, "citizen-private-photo");
      await action({
        type: "submit-result",
        body: "Gizli saha sonucu inceleme bekliyor.",
        photos: [foreign],
      }).expect(409);
      await action({
        type: "submit-result",
        body: "Gizli saha sonucu inceleme bekliyor.",
        photos: [photoId, photoId],
      }).expect(400);
      const submit = {
        type: "submit-result",
        body: "Gizli saha sonucu inceleme bekliyor.",
        photos: [photoId],
      };
      await action(submit).expect(200);
      await action(submit).expect(200);
      const centerPending = (await request(pilot.app).get('/api/municipality/workspace').set(admin)).body.data;
      assert.equal(centerPending.reports.find((r: any) => r.id === report.id).fieldOrders[0].result, undefined);
      await request(pilot.app).post('/api/municipality/actions').set(admin)
        .send({ type: 'resolve', id: report.id, body: 'Kontrol edilmeden kapatılmamalı.' }).expect(409);
      const review = (decision: string, body: string) =>
        instAct({ type: "review-result", orderId, decision, body });
      const center = (decision: string, body: string) =>
        request(pilot.app)
          .post("/api/municipality/field-review")
          .set(admin)
          .send({ orderId, decision, body });
      await center("publish", "Erken yayın denemesi kabul edilmemeli.").expect(
        409,
      );
      let citizen = (await request(pilot.app).get("/api/workspace").set(owner))
        .body;
      assert.equal(citizen.inbox.length, beforeOwner);
      assert.equal(citizen.reports[0].resolution, undefined);
      assert.doesNotMatch(
        JSON.stringify(citizen),
        /Gizli saha sonucu|field-result-photo/,
      );
      assert.equal(
        (await request(pilot.app).get("/api/workspace").set(participant)).body
          .inbox.length,
        beforeParticipant,
      );
      const institutional = (
        await request(pilot.app)
          .get("/api/institutions/electricity-external/workspace")
          .set(institution)
      ).body;
      assert.equal(institutional.cases[0].orders[0].result.photos.length, 1);
      await review(
        "return",
        "Fotoğrafı ve açıklamayı kontrol ederek tekrar gönderin.",
      ).expect(200);
      assert.equal(
        (await request(pilot.app).get("/api/field/workspace").set(field)).body
          .jobs[0].crewState,
        "in_progress",
      );
      await action(submit).expect(200);
      await review(
        "forward",
        "Kurum kontrolünden geçti; belediye merkezi değerlendirsin.",
      ).expect(200);
      await center(
        "return",
        "Kurum son açıklamayı yeniden kontrol etmelidir.",
      ).expect(200);
      await review(
        "forward",
        "Kurum tekrar kontrol etti; merkezin onayına sunuldu.",
      ).expect(200);
      const pending = (
        await request(pilot.app)
          .get(`/api/community/${issue.id}`)
          .set(participant)
      ).body;
      assert.equal(pending.resolution, undefined);
      assert.doesNotMatch(
        JSON.stringify(pending),
        /Gizli saha sonucu|Fotoğrafı ve açıklamayı/,
      );
      const message =
        "Merkez onayı: Ekip tarafından yapılan işlem kontrol edildi ve sorun giderildi.";
      await center("publish", message).expect(200);
      await center("publish", message).expect(200);
      citizen = (await request(pilot.app).get("/api/workspace").set(owner))
        .body;
      assert.equal(citizen.reports[0].status, "resolved");
      assert.equal(citizen.reports[0].resolution.body, message);
      assert.equal(citizen.reports[0].resolution.photos.length, 1);
      assert.equal(citizen.inbox.length, beforeOwner + 1);
      const followed = (
        await request(pilot.app)
          .get(`/api/community/${issue.id}`)
          .set(participant)
      ).body;
      assert.equal(followed.resolution.body, message);
      assert.equal(followed.resolution.photos.length, 1);
      assert.equal(followed.resolution.orderId, undefined);
      assert.equal(followed.resolution.sharedByCenter, undefined);
      assert.equal(
        (await request(pilot.app).get("/api/workspace").set(participant)).body
          .inbox.length,
        beforeParticipant + 1,
      );
      assert.equal(
        (await request(pilot.app).get(`/api/community/${issue.id}`)).body
          .resolution,
        undefined,
      );
      const url = new URL(followed.resolution.photos[0].uri);
      assert.deepEqual(
        (
          await request(pilot.app)
            .get(url.pathname + url.search)
            .expect(200)
        ).body,
        png,
      );
      await action({ type: "start" }).expect(409);
      await pilot.close();
      pilot = await startPilot(options);
      const restored = (
        await request(pilot.app)
          .get("/api/field/workspace")
          .set(field)
          .expect(200)
      ).body;
      assert.equal(restored.jobs[0].crewState, "published");
      assert.equal(restored.jobs[0].state, "completed");
    } finally {
      await pilot.close();
      await rm(dataDir, { recursive: true, force: true });
    }
  },
);
