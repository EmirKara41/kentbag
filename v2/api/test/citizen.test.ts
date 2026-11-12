import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { PNG, startTestApi, type Headers, type TestApi } from "./harness.ts";

let api: TestApi;
let alice: Headers;
let bob: Headers;
before(async () => {
  api = await startTestApi();
  alice = await api.signUpCitizen("alice@example.test");
  bob = await api.signUpCitizen("bob@example.test");
});
after(async () => api.close());

const body = (over: Record<string, unknown> = {}) => ({
  clientRequestId: crypto.randomUUID(),
  category: "electricity",
  description: "Sokağımızda sabahtan beri elektrik yok.",
  address: "Cumhuriyet Mah. Lale Sok. No 4",
  point: { lat: 40.545, lng: 41.993 },
  photoIds: [],
  ...over,
});
const upload = async (who: Headers, clientId: string) =>
  (await request(api.app).put(`/api/photos/${clientId}`).set(who).set("Content-Type", "image/png").send(PNG).expect(200)).body.id as string;

test("create request returns a reference and appears in my list", async () => {
  const r = await request(api.app).post("/api/requests").set(alice).send(body()).expect(201);
  assert.match(r.body.request.reference, /^KB-[A-Z0-9]{6}$/);
  assert.equal(r.body.request.category, "electricity");
  assert.equal(typeof r.body.request.statusLabel, "string");
  const mine = await request(api.app).get("/api/requests/mine").set(alice).expect(200);
  assert.ok(mine.body.requests.some((x: any) => x.id === r.body.request.id));
});

test("same clientRequestId twice creates one request (double tap / retry)", async () => {
  const b = body();
  const first = await request(api.app).post("/api/requests").set(alice).send(b).expect(201);
  const second = await request(api.app).post("/api/requests").set(alice).send(b).expect(200);
  assert.equal(second.body.request.id, first.body.request.id);
  const { rows } = await api.db.query("SELECT count(*)::int AS n FROM request WHERE client_request_id=$1", [b.clientRequestId]);
  assert.equal(rows[0].n, 1);
});

test("only the owner sees the request", async () => {
  const r = await request(api.app).post("/api/requests").set(alice).send(body()).expect(201);
  await request(api.app).get(`/api/requests/${r.body.request.id}`).set(bob).expect(404);
  const own = await request(api.app).get(`/api/requests/${r.body.request.id}`).set(alice).expect(200);
  assert.ok(Array.isArray(own.body.request.events));
  assert.ok(own.body.request.events.every((e: any) => !("actorId" in e)));
});

test("validation", async () => {
  await request(api.app).post("/api/requests").set(alice).send(body({ description: "123456789" })).expect(400);
  await request(api.app).post("/api/requests").set(alice).send(body({ address: "", point: null })).expect(400);
  await request(api.app).post("/api/requests").set(alice).send(body({ category: "unknown" })).expect(400);
  const ids = await Promise.all([1, 2, 3, 4].map((i) => upload(alice, `many-${i}`)));
  await request(api.app).post("/api/requests").set(alice).send(body({ photoIds: ids })).expect(400);
  await request(api.app).post("/api/requests").send(body()).expect(401);
});

test("photos: upload, attach, signed read; foreign photo refused", async () => {
  const mine = await upload(alice, "p1");
  assert.equal(await upload(alice, "p1"), mine); // same client id → same photo
  const r = await request(api.app).post("/api/requests").set(alice).send(body({ photoIds: [mine] })).expect(201);
  const detail = (await request(api.app).get(`/api/requests/${r.body.request.id}`).set(alice).expect(200)).body.request;
  assert.equal(detail.photos.length, 1);
  const url = new URL(detail.photos[0]);
  const got = await request(api.app).get(url.pathname + url.search).expect(200);
  assert.deepEqual(Buffer.from(got.body), PNG);
  await request(api.app).get(`${url.pathname}?expires=9999999999&signature=bad`).expect(403);

  const bobs = await upload(bob, "b1");
  await request(api.app).post("/api/requests").set(alice).send(body({ photoIds: [bobs] })).expect(409);
  await request(api.app).put("/api/photos/x1").set(alice).set("Content-Type", "image/png").send(Buffer.from("not an image")).expect(400);
});

test("reopen only when resolved; cancel by owner", async () => {
  const r = await request(api.app).post("/api/requests").set(alice).send(body()).expect(201);
  const id = r.body.request.id;
  await request(api.app).post(`/api/requests/${id}/reopen`).set(alice).send({ note: "Hâlâ yok", photoIds: [] }).expect(409);
  await request(api.app).post(`/api/requests/${id}/cancel`).set(bob).send({ reason: "Başkasının talebi" }).expect(404);
  const c = await request(api.app).post(`/api/requests/${id}/cancel`).set(alice).send({ reason: "Elektrik geri geldi, gerek kalmadı." }).expect(200);
  assert.equal(c.body.request.status, "cancelled");
});
