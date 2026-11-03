import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { startPilot } from "../src/pilot.js";

test(
  "staff logins preserve role scope, persist and revoke without granting citizen privileges",
  { timeout: 90000 },
  async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "kent-staff-test-"));
    const options = {
      dataDir,
      host: "127.0.0.1",
      port: 4326,
      pgPort: 5444,
      listenHost: "127.0.0.1",
    };
    let pilot = await startPilot(options);
    const origin = "http://localhost:4280";
    try {
      const session = await request(pilot.app)
        .post("/api/municipality/local-session")
        .set("Origin", origin)
        .send({})
        .expect(200);
      const admin = {
        Origin: origin,
        Authorization: `Bearer ${session.body.token}`,
      };
      await request(pilot.app)
        .post("/api/municipality/staff")
        .set(admin)
        .send({
          name: "Su sorumlusu",
          email: "water-staff@example.test",
          password: "Test-staff-password123!",
          role: "institution",
          unitId: "water",
        })
        .expect(200);
      const login = await request(pilot.app)
        .post("/api/auth/sign-in/email")
        .set("Origin", origin)
        .send({
          email: "water-staff@example.test",
          password: "Test-staff-password123!",
        })
        .expect(200);
      const staff = {
        Origin: origin,
        Authorization: `Bearer ${login.headers["set-auth-token"]}`,
      };
      const me = await request(pilot.app)
        .get("/api/staff/me")
        .set(staff)
        .expect(200);
      assert.equal(me.body.unitId, "water");
      assert.equal(me.body.role, "institution");
      await request(pilot.app)
        .get("/api/institutions/water/workspace")
        .set(staff)
        .expect(200);
      await request(pilot.app)
        .get("/api/institutions/public-works/workspace")
        .set(staff)
        .expect(403);
      await request(pilot.app)
        .get("/api/municipality/staff")
        .set(staff)
        .expect(401);
      await request(pilot.app)
        .post("/api/municipality/staff")
        .set(admin)
        .send({
          name: "Hatalı ekip",
          email: "invalid-team@example.test",
          password: "Test-staff-password123!",
          role: "crew",
          unitId: "water",
          teamId: "fen-yol",
        })
        .expect(400);
      const citizen = await request(pilot.app)
        .post("/api/auth/sign-up/email")
        .set("Origin", "https://localhost")
        .send({
          name: "Vatandaş",
          email: "no-staff@example.test",
          password: "Test-citizen-password123!",
        })
        .expect(200);
      const c = {
        Origin: "https://localhost",
        Authorization: `Bearer ${citizen.headers["set-auth-token"]}`,
      };
      await request(pilot.app).get("/api/staff/me").set(c).expect(401);
      await request(pilot.app)
        .get("/api/institutions/water/workspace")
        .set(c)
        .expect(401);
      await request(pilot.app)
        .post("/api/municipality/staff")
        .set(c)
        .send({})
        .expect(401);
      await pilot.close();
      pilot = await startPilot(options);
      await request(pilot.app)
        .get("/api/institutions/water/workspace")
        .set(staff)
        .expect(200);
      const list = await request(pilot.app)
        .get("/api/municipality/staff")
        .set(admin)
        .expect(200);
      assert.equal(list.body.members[0].email, "water-staff@example.test");
      assert.ok(!JSON.stringify(list.body).includes("Test-staff-password123!"));
      await request(pilot.app)
        .post("/api/municipality/staff/disable")
        .set(admin)
        .send({ id: me.body.userId })
        .expect(200);
      await request(pilot.app)
        .get("/api/institutions/water/workspace")
        .set(staff)
        .expect(401);
      await request(pilot.app).get("/api/staff/me").set(staff).expect(401);
    } finally {
      await pilot.close();
      await rm(dataDir, { recursive: true, force: true });
    }
  },
);
