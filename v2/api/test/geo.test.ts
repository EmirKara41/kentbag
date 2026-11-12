import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { fallbackTravelMinutes } from "@kentbag/shared";
import { createGeo } from "../src/geo.ts";
import { startTestApi, type Headers, type TestApi } from "./harness.ts";

const A = { lat: 40.54, lng: 41.99 };
const B = { lat: 40.56, lng: 42.01 };
const json = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });

test("OSRM duration in seconds becomes minutes", async () => {
  const geo = createGeo({ fetch: json({ code: "Ok", routes: [{ duration: 1200 }] }) as typeof fetch });
  assert.equal(await geo.travel(A, B), 20);
});

test("OSRM failure falls back to the straight-line estimate", async () => {
  const geo = createGeo({ fetch: (async () => { throw new Error("offline"); }) as typeof fetch });
  assert.equal(await geo.travel(A, B), fallbackTravelMinutes(A, B));
  const bad = createGeo({ fetch: json({ code: "NoRoute" }) as typeof fetch });
  assert.equal(await bad.travel(A, B), fallbackTravelMinutes(A, B));
});

test("geocode returns a point or null", async () => {
  const found = createGeo({ fetch: json([{ lat: "40.5451", lon: "41.9912" }]) as typeof fetch });
  assert.deepEqual(await found.geocode("Cumhuriyet Mah."), { lat: 40.5451, lng: 41.9912 });
  const none = createGeo({ fetch: json([]) as typeof fetch });
  assert.equal(await none.geocode("bilinmeyen yer"), null);
});

let api: TestApi;
let citizen: Headers;
let trafo: Headers;
before(async () => {
  api = await startTestApi({ travel: async () => 20, geocode: async () => null });
  citizen = await api.signUpCitizen("geo@example.test");
  trafo = await api.login("demo-elk-trafo@kentbag.app");
  await api.db.query("UPDATE team SET on_shift=false WHERE institution_id='electricity' AND id<>'elk-trafo'");
  await api.db.query("UPDATE team SET located_at=now() WHERE id='elk-trafo'");
});
after(async () => api.close());

const create = (over: Record<string, unknown> = {}) =>
  request(api.app)
    .post("/api/requests")
    .set(citizen)
    .send({ clientRequestId: crypto.randomUUID(), category: "electricity", description: "Sokakta elektrik yok, karanlık.", address: "Halitpaşa Mah.", point: { lat: 40.55, lng: 42.0 }, photoIds: [], ...over })
    .expect(201);

test("address that cannot be located: assigned with no ETA", async () => {
  const r = (await create({ point: null, address: "Bulunamayan sokak 99" })).body.request;
  const row = (await api.db.query("SELECT status, eta_arrival FROM request WHERE id=$1", [r.id])).rows[0];
  assert.equal(row.status, "assigned");
  assert.equal(row.eta_arrival, null);
  await request(api.app).post(`/api/crew/jobs/${r.id}/resolve`).set(trafo).send({ note: "Kontrol edildi, sorun yok.", photoIds: [] }).expect(200);
});

test("ETA of the next job follows the job in hand", async () => {
  const first = (await create()).body.request;
  const second = (await create({ point: { lat: 40.552, lng: 42.003 } })).body.request;
  const before = (await api.db.query("SELECT eta_arrival FROM request WHERE id=$1", [first.id])).rows[0];
  assert.ok(before.eta_arrival, "first job has an arrival estimate");
  await request(api.app).post(`/api/crew/jobs/${first.id}/arrive`).set(trafo).send({ remainingMinutes: 60 }).expect(200);
  const next = (await api.db.query("SELECT eta_arrival FROM request WHERE id=$1", [second.id])).rows[0];
  const minutes = (new Date(next.eta_arrival).getTime() - Date.now()) / 60000;
  // 60 remaining + 20 travel + 5 buffer
  assert.ok(minutes > 83 && minutes < 86, String(minutes));
  const view = (await request(api.app).get(`/api/requests/${second.id}`).set(citizen).expect(200)).body.request;
  assert.ok(view.etaArrival);
});
