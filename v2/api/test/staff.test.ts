import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestApi, type Headers, type TestApi } from "./harness.ts";

let api: TestApi;
let citizen: Headers;
let center: Headers;
let electricity: Headers;
let water: Headers;
let trafo: Headers;
before(async () => {
  api = await startTestApi();
  citizen = await api.signUpCitizen("staff-citizen@example.test");
  center = await api.login("demo-merkez@kentbag.app");
  electricity = await api.login("demo-kurum-electricity@kentbag.app");
  water = await api.login("demo-kurum-water@kentbag.app");
  trafo = await api.login("demo-elk-trafo@kentbag.app");
});
after(async () => api.close());
beforeEach(async () => {
  await request(api.app).put("/api/staff/agent").set(center).send({ center: true, institutions: { electricity: true, water: true } }).expect(200);
});

const create = async (category = "electricity") =>
  (
    await request(api.app)
      .post("/api/requests")
      .set(citizen)
      .send({ clientRequestId: crypto.randomUUID(), category, description: "Bildirim açıklaması yeterince uzun.", address: "Karabekir Mah.", point: { lat: 40.547, lng: 41.992 }, photoIds: [] })
      .expect(201)
  ).body.request;

test("center sees everything including received; manual route and assign reach the crew", async () => {
  await request(api.app).put("/api/staff/agent").set(center).send({ center: false }).expect(200);
  const r = await create();
  const list = (await request(api.app).get("/api/staff/requests").set(center).expect(200)).body.requests;
  const row = list.find((x: any) => x.id === r.id);
  assert.equal(row.status, "received");
  assert.equal(row.statusLabel, "Alındı");

  const suggestion = (await request(api.app).post(`/api/staff/requests/${r.id}/suggest`).set(center).expect(200)).body;
  assert.equal(suggestion.institution, "electricity");

  await request(api.app).post(`/api/staff/requests/${r.id}/route`).set(center).send({ institution: "electricity" }).expect(200);
  await request(api.app).post(`/api/staff/requests/${r.id}/assign`).set(electricity).send({ teamId: "elk-trafo" }).expect(200);
  const queue = (await request(api.app).get("/api/crew/queue").set(trafo).expect(200)).body.jobs;
  assert.ok(queue.some((j: any) => j.id === r.id));
});

test("institutions only see and act on their own requests", async () => {
  const r = await create();
  await request(api.app).get(`/api/staff/requests/${r.id}`).set(water).expect(404);
  await request(api.app).post(`/api/staff/requests/${r.id}/assign`).set(water).send({ teamId: "su-ariza" }).expect(403);
  const mine = (await request(api.app).get("/api/staff/requests").set(water).expect(200)).body.requests;
  assert.ok(mine.every((x: any) => x.institution === "water"));
  await request(api.app).post(`/api/staff/requests/${r.id}/route`).set(electricity).send({ institution: "water" }).expect(403);
});

test("citizen name only for the center", async () => {
  const r = await create();
  const forCenter = (await request(api.app).get(`/api/staff/requests/${r.id}`).set(center).expect(200)).body.request;
  assert.equal(forCenter.citizenName, "Test Vatandaşı");
  assert.ok(forCenter.events.some((e: any) => e.public === false || e.public === true));
  const forInst = (await request(api.app).get(`/api/staff/requests/${r.id}`).set(electricity).expect(200)).body.request;
  assert.equal(forInst.citizenName, undefined);
});

test("agent switches: institution changes its own, never the center's", async () => {
  await request(api.app).put("/api/staff/agent").set(electricity).send({ institutions: { electricity: false } }).expect(200);
  const s = (await request(api.app).get("/api/staff/agent").set(electricity).expect(200)).body;
  assert.equal(s.institutions.electricity, false);
  await request(api.app).put("/api/staff/agent").set(electricity).send({ center: false }).expect(403);
  await request(api.app).put("/api/staff/agent").set(electricity).send({ institutions: { water: false } }).expect(403);
});

test("teams board and deactivation", async () => {
  const teams = (await request(api.app).get("/api/staff/teams").set(electricity).expect(200)).body.teams;
  assert.deepEqual(teams.map((t: any) => t.id).sort(), ["elk-ariza", "elk-bakim", "elk-trafo"]);
  assert.ok(Array.isArray(teams[0].jobs));
  await request(api.app).patch("/api/staff/teams/elk-bakim").set(electricity).send({ active: false }).expect(200);
  await request(api.app).patch("/api/staff/teams/su-ariza").set(electricity).send({ active: false }).expect(403);
  await request(api.app).get("/api/staff/requests").set(citizen).expect(403);
});

test("cancel by institution and sweep endpoint", async () => {
  const r = await create();
  const c = await request(api.app).post(`/api/staff/requests/${r.id}/cancel`).set(electricity).send({ reason: "Mükerrer kayıt, diğer talep işleniyor." }).expect(200);
  assert.equal(c.body.request.status, "cancelled");
  const s = await request(api.app).post("/api/agent/sweep").set(center).expect(200);
  assert.equal(typeof s.body.processed, "number");
});
