import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestApi, type TestApi } from "./harness.ts";

let api: TestApi;
before(async () => {
  api = await startTestApi();
});
after(async () => {
  await api.close();
});

test("health answers with version", async () => {
  const r = await request(api.app).get("/api/health").expect(200);
  assert.deepEqual(r.body, { ok: true, version: "2.0.0" });
});

test("roles are resolved from staff records", async () => {
  const center = await api.login("demo-merkez@kentbag.app");
  assert.equal((await request(api.app).get("/api/me").set(center).expect(200)).body.role, "center");

  const crew = await api.login("demo-elk-trafo@kentbag.app");
  const me = (await request(api.app).get("/api/me").set(crew).expect(200)).body;
  assert.equal(me.role, "crew");
  assert.equal(me.teamId, "elk-trafo");
  assert.equal(me.institution, "electricity");

  const inst = await api.login("demo-kurum-water@kentbag.app");
  const instMe = (await request(api.app).get("/api/me").set(inst).expect(200)).body;
  assert.equal(instMe.role, "institution");
  assert.equal(instMe.institution, "water");

  const citizen = await api.signUpCitizen("yeni@example.test");
  assert.equal((await request(api.app).get("/api/me").set(citizen).expect(200)).body.role, "citizen");
});

test("no session → 401 with a Turkish message", async () => {
  const r = await request(api.app).get("/api/me").expect(401);
  assert.equal(typeof r.body.error, "string");
});

test("deactivated staff → 403", async () => {
  const crew = await api.login("demo-elk-ariza@kentbag.app");
  await api.db.query("UPDATE staff SET active=false WHERE user_id=(SELECT id FROM \"user\" WHERE email=$1)", ["demo-elk-ariza@kentbag.app"]);
  await request(api.app).get("/api/me").set(crew).expect(403);
});

test("teams are seeded from the catalog", async () => {
  const { rows } = await api.db.query("SELECT id, institution_id FROM team ORDER BY id");
  assert.equal(rows.length, 11);
  assert.ok(rows.some((r) => r.id === "elk-trafo" && r.institution_id === "electricity"));
});
