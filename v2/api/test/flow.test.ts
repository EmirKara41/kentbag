import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { PNG, startTestApi, TEST_PASSWORD, type Headers, type TestApi } from "./harness.ts";

let api: TestApi;
let off: TestApi;
before(async () => {
  api = await startTestApi({
    demoPassword: TEST_PASSWORD,
    classify: async () => ({ priority: "high", note: "Elektrik kesintisi; kritik hizmet." }),
  });
  off = await startTestApi();
});
after(async () => {
  await api.close();
  await off.close();
});

const demo = async (key: string): Promise<Headers> => {
  const r = await request(api.app).post("/api/demo/login").send({ key }).expect(200);
  return { Origin: "https://localhost", Authorization: `Bearer ${r.body.token}` };
};

test("demo login is off unless configured; when on it only serves demo accounts", async () => {
  await request(off.app).get("/api/demo/accounts").expect(404);
  await request(off.app).post("/api/demo/login").send({ key: "merkez" }).expect(404);
  const list = (await request(api.app).get("/api/demo/accounts").expect(200)).body.accounts;
  assert.ok(list.some((a: any) => a.key === "merkez" && a.app === "web"));
  assert.ok(list.some((a: any) => a.key === "elk-trafo" && a.app === "crew"));
  assert.ok(list.every((a: any) => !("email" in a)));
  await request(api.app).post("/api/demo/login").send({ key: "nope" }).expect(404);
  const center = await demo("merkez");
  assert.equal((await request(api.app).get("/api/me").set(center).expect(200)).body.role, "center");
});

test("presentation flow end to end", async () => {
  const citizen = await demo("vatandas");
  const trafo = await demo("elk-trafo");
  const center = await demo("merkez");
  const electricity = await demo("kurum-electricity");
  await api.db.query("UPDATE team SET on_shift=false WHERE institution_id='electricity' AND id<>'elk-trafo'");
  await api.db.query("UPDATE team SET located_at=now() WHERE id='elk-trafo'");

  // 1–2. Citizen reports; the agent routes and assigns with a reason.
  const created = (
    await request(api.app)
      .post("/api/requests")
      .set(citizen)
      .send({ clientRequestId: crypto.randomUUID(), category: "electricity", description: "Sokağımızda elektrik kesildi, trafo ses çıkarıyor.", address: "Cumhuriyet Mah.", point: { lat: 40.546, lng: 41.994 }, photoIds: [] })
      .expect(201)
  ).body.request;
  assert.equal(created.status, "assigned");
  assert.equal(created.teamName, "Trafo müdahale ekibi");
  const staffView = (await request(api.app).get(`/api/staff/requests/${created.id}`).set(center).expect(200)).body.request;
  assert.match(staffView.agentReason, /Trafo müdahale ekibi seçildi/);
  const view = async () => (await request(api.app).get(`/api/requests/${created.id}`).set(citizen).expect(200)).body.request;

  // 3. Crew departs: citizen sees "Ekip yolda" and an arrival time.
  await request(api.app).post(`/api/crew/jobs/${created.id}/depart`).set(trafo).expect(200);
  let v = await view();
  assert.equal(v.statusLabel, "Ekip yolda");
  assert.ok(v.etaArrival);

  // 4. Arrives with 30 minutes left: "Ekip sahada" and a finish time.
  await request(api.app).post(`/api/crew/jobs/${created.id}/arrive`).set(trafo).send({ remainingMinutes: 30 }).expect(200);
  v = await view();
  assert.equal(v.statusLabel, "Ekip sahada");
  assert.ok(v.etaFinish);

  // 5. Resolves with a photo; the request closes immediately.
  const photo = (await request(api.app).put("/api/photos/done-1").set(trafo).set("Content-Type", "image/png").send(PNG).expect(200)).body.id;
  await request(api.app).post(`/api/crew/jobs/${created.id}/resolve`).set(trafo).send({ note: "Trafo sigortası değiştirildi, elektrik verildi.", photoIds: [photo] }).expect(200);
  v = await view();
  assert.equal(v.status, "resolved");
  assert.equal(v.resolutionPhotos.length, 1);

  // 6a. "Sorun devam ediyor" reopens and the agent assigns again.
  await request(api.app).post(`/api/requests/${created.id}/reopen`).set(citizen).send({ note: "Elektrik yine gitti.", photoIds: [] }).expect(200);
  v = await view();
  assert.equal(v.status, "assigned");

  // 6b. Agent off: center routes and the institution assigns by hand.
  await request(api.app).put("/api/staff/agent").set(center).send({ center: false }).expect(200);
  const manual = (
    await request(api.app)
      .post("/api/requests")
      .set(citizen)
      .send({ clientRequestId: crypto.randomUUID(), category: "electricity", description: "Okul önündeki sokak lambaları yanmıyor.", address: "Karabekir Mah.", point: { lat: 40.544, lng: 41.99 }, photoIds: [] })
      .expect(201)
  ).body.request;
  assert.equal(manual.status, "received");
  await request(api.app).post(`/api/staff/requests/${manual.id}/route`).set(center).send({ institution: "electricity" }).expect(200);
  await request(api.app).post(`/api/staff/requests/${manual.id}/assign`).set(electricity).send({ teamId: "elk-trafo" }).expect(200);
  await request(api.app).post(`/api/crew/jobs/${manual.id}/resolve`).set(trafo).send({ note: "Lamba armatürleri yenilendi.", photoIds: [] }).expect(200);
  assert.equal((await request(api.app).get(`/api/requests/${manual.id}`).set(citizen).expect(200)).body.request.status, "resolved");
  await request(api.app).put("/api/staff/agent").set(center).send({ center: true }).expect(200);
});
