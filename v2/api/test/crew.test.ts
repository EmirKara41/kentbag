import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { PNG, startTestApi, type Headers, type TestApi } from "./harness.ts";

let api: TestApi;
let citizen: Headers;
let trafo: Headers;
let ariza: Headers;
let bakim: Headers;
before(async () => {
  api = await startTestApi();
  citizen = await api.signUpCitizen("crew-citizen@example.test");
  trafo = await api.login("demo-elk-trafo@kentbag.app");
  ariza = await api.login("demo-elk-ariza@kentbag.app");
  bakim = await api.login("demo-elk-bakim@kentbag.app");
  await api.db.query("UPDATE team SET on_shift=false WHERE institution_id='electricity' AND id<>'elk-trafo'");
});
after(async () => api.close());

const create = async () =>
  (
    await request(api.app)
      .post("/api/requests")
      .set(citizen)
      .send({
        clientRequestId: crypto.randomUUID(),
        category: "electricity",
        description: "Trafo önünde kıvılcım var, elektrik kesik.",
        address: "Ayyıldız Mah.",
        point: { lat: 40.548, lng: 41.995 },
        photoIds: [],
      })
      .expect(201)
  ).body.request;
const status = async (id: string) => (await request(api.app).get(`/api/requests/${id}`).set(citizen).expect(200)).body.request;
const act = (who: Headers, id: string, action: string, body: object = {}) =>
  request(api.app).post(`/api/crew/jobs/${id}/${action}`).set(who).send(body);

test("assigned job appears in the team queue and moves through the lifecycle", async () => {
  const r = await create();
  const q = (await request(api.app).get("/api/crew/queue").set(trafo).expect(200)).body;
  assert.equal(q.team.id, "elk-trafo");
  assert.equal(q.team.onShift, true);
  assert.equal(q.team.institutionName, "Elektrik Dağıtımı");
  const job = q.jobs.find((j: any) => j.id === r.id);
  assert.ok(job);
  assert.equal(job.status, "assigned");
  assert.equal(job.categoryName, "Elektrik kesintisi");

  await act(trafo, r.id, "depart").expect(200);
  assert.equal((await status(r.id)).statusLabel, "Ekip yolda");
  await act(trafo, r.id, "arrive", { remainingMinutes: 45 }).expect(200);
  assert.equal((await status(r.id)).statusLabel, "Ekip sahada");
  await act(trafo, r.id, "remaining", { remainingMinutes: 20 }).expect(200);

  const photo = (await request(api.app).put("/api/photos/fix-1").set(trafo).set("Content-Type", "image/png").send(PNG).expect(200)).body.id;
  await act(trafo, r.id, "resolve", { note: "Sigorta değiştirildi, elektrik verildi.", photoIds: [photo] }).expect(200);
  const done = await status(r.id);
  assert.equal(done.status, "resolved");
  assert.equal(done.resolutionNote, "Sigorta değiştirildi, elektrik verildi.");
  assert.equal(done.resolutionPhotos.length, 1);
});

test("another team acting on the job gets a clear 409", async () => {
  const r = await create();
  const res = await act(ariza, r.id, "depart").expect(409);
  assert.match(res.body.error, /artık ekibinizde değil/);
});

test("decline returns the job and the agent hands it to another team on shift", async () => {
  await request(api.app).post("/api/crew/shift").set(bakim).send({ onShift: true }).expect(200);
  const r = await create();
  const owner = (await api.db.query("SELECT team_id FROM request WHERE id=$1", [r.id])).rows[0].team_id;
  const who = owner === "elk-trafo" ? trafo : bakim;
  await act(who, r.id, "decline", { reason: "Adreste trafo bulunamadı, konum yanlış." }).expect(200);
  const after = (await api.db.query("SELECT status, team_id FROM request WHERE id=$1", [r.id])).rows[0];
  assert.equal(after.status, "assigned");
  assert.notEqual(after.team_id, owner);
});

test("off-shift team gets nothing; going on shift picks up waiting jobs", async () => {
  await api.db.query("UPDATE team SET on_shift=false WHERE institution_id='electricity'");
  const r = await create();
  assert.equal((await api.db.query("SELECT status FROM request WHERE id=$1", [r.id])).rows[0].status, "routed");
  await request(api.app).post("/api/crew/shift").set(ariza).send({ onShift: true }).expect(200);
  const row = (await api.db.query("SELECT status, team_id FROM request WHERE id=$1", [r.id])).rows[0];
  assert.equal(row.status, "assigned");
  assert.equal(row.team_id, "elk-ariza");
});

test("location update and role guard", async () => {
  await request(api.app).post("/api/crew/location").set(trafo).send({ point: { lat: 40.55, lng: 42.0 } }).expect(204);
  const t = (await api.db.query("SELECT lat, located_at FROM team WHERE id='elk-trafo'")).rows[0];
  assert.equal(Number(t.lat), 40.55);
  assert.ok(t.located_at);
  await request(api.app).get("/api/crew/queue").set(citizen).expect(403);
});
