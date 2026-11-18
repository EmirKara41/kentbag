import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestApi, type Headers, type TestApi } from "./harness.ts";

const clock = new Date("2026-11-18T09:00:00Z");
// Fake district lookup: south of 40.40 is Narman, an unknown spot at 0,0, everything else Oltu.
const locate = async (p: { lat: number; lng: number }) =>
  p.lat === 0 ? null : p.lat < 40.4 ? { district: "Narman", province: "Erzurum" } : { district: "Oltu", province: "Erzurum" };

let api: TestApi;
let citizen: Headers;
let center: Headers;
before(async () => {
  api = await startTestApi({ now: () => clock, locate });
  citizen = await api.signUpCitizen("sinir@example.test");
  center = await api.login("demo-merkez@kentbag.app");
  await api.db.query("UPDATE team SET located_at=$1", [clock]);
});
after(async () => api.close());

const report = (point: { lat: number; lng: number }, category = "road") =>
  request(api.app)
    .post("/api/requests")
    .set(citizen)
    .send({ clientRequestId: crypto.randomUUID(), category, description: "Köy yolunda büyük bir çökme var.", address: "Köy yolu", point, photoIds: [] })
    .expect(201)
    .then((r) => r.body.request);

test("a request outside Oltu is referred with the right numbers, never sent to a crew", async () => {
  const r = await report({ lat: 40.27, lng: 41.98 });
  assert.equal(r.status, "referred");
  assert.equal(r.teamName, null);
  assert.equal(r.statusLabel, "Yetki alanı dışında");
  assert.ok(r.events.some((e: { body: string }) => /Narman, Erzurum.*yetki alanı dışında/.test(e.body)));
  assert.deepEqual(r.referral.contacts.map((c: { phone: string }) => c.phone), ["159", "153"]);
  assert.equal(r.referral.contacts[1].name, "Narman Belediyesi");
  assert.equal(r.canCancel, false);
});

test("inside Oltu, or an unknown place, works as before", async () => {
  assert.equal((await report({ lat: 40.545, lng: 41.993 })).status, "assigned");
  assert.equal((await report({ lat: 0, lng: 0 })).status, "assigned");
});

test("the app can warn before sending", async () => {
  const out = (await request(api.app).get("/api/area").query({ lat: 40.27, lng: 41.98, category: "water" }).set(citizen).expect(200)).body;
  assert.equal(out.outside, true);
  assert.deepEqual(out.contacts.map((c: { phone: string }) => c.phone), ["185", "153"]);
  const inside = (await request(api.app).get("/api/area").query({ lat: 40.545, lng: 41.993, category: "water" }).set(citizen).expect(200)).body;
  assert.equal(inside.outside, false);
});

test("center can refer by hand, or take a referred request back into work", async () => {
  const r = await report({ lat: 40.27, lng: 41.98 });
  await request(api.app).post(`/api/staff/requests/${r.id}/route`).set(center).send({ institution: "public-works" }).expect(200);
  assert.equal((await request(api.app).get(`/api/requests/${r.id}`).set(citizen).expect(200)).body.request.status, "assigned");

  const inside = await report({ lat: 40.545, lng: 41.993 });
  await request(api.app).post(`/api/staff/requests/${inside.id}/refer`).set(center).send({}).expect(409);
  const electricity = await api.login("demo-kurum-electricity@kentbag.app");
  await request(api.app).post(`/api/staff/requests/${inside.id}/refer`).set(electricity).send({ district: "Şenkaya" }).expect(403);
  // e.g. the road is actually in Şenkaya although the pin fell inside Oltu
  await request(api.app).post(`/api/staff/requests/${inside.id}/refer`).set(center).send({ district: "Şenkaya" }).expect(200);
  const v = (await request(api.app).get(`/api/requests/${inside.id}`).set(citizen).expect(200)).body.request;
  assert.equal(v.status, "referred");
  assert.equal(v.referral.district, "Şenkaya");
});
