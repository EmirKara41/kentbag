import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import type { PhotoCheck, PhotoJudge, ResolutionCheck } from "../src/vision.ts";
import { PNG, startTestApi, type Headers, type TestApi } from "./harness.ts";

const clock = new Date("2026-11-18T09:00:00Z");
let nextRelevance: PhotoCheck | "fail" = { verdict: "ok", note: "Fotoğrafta yoldaki çukur görülüyor." };
let nextResolution: ResolutionCheck = { verdict: "confirmed", note: "Aynı yer; çukur kapatılmış görünüyor." };
const seen: { kind: string; photos: number }[] = [];
const judge: PhotoJudge = {
  async relevance(input) {
    seen.push({ kind: "relevance", photos: input.photos.length });
    if (nextRelevance === "fail") throw new Error("model down");
    return nextRelevance;
  },
  async resolution(input) {
    seen.push({ kind: "resolution", photos: input.before.length + input.after.length });
    return nextResolution;
  },
};

let api: TestApi;
let citizen: Headers;
let works: Headers;
before(async () => {
  api = await startTestApi({ now: () => clock, photoJudge: judge });
  citizen = await api.signUpCitizen("foto@example.test");
  works = await api.login("demo-kurum-public-works@kentbag.app");
  await api.db.query("UPDATE team SET located_at=$1", [clock]);
});
after(async () => api.close());

async function photo(who: Headers) {
  return (await request(api.app).put(`/api/photos/${crypto.randomUUID()}`).set(who).set("Content-Type", "image/png").send(PNG).expect(200)).body.id;
}
async function report(withPhoto = true) {
  const photoIds = withPhoto ? [await photo(citizen)] : [];
  return (
    await request(api.app)
      .post("/api/requests")
      .set(citizen)
      .send({ clientRequestId: crypto.randomUUID(), category: "road", description: "Ana caddede derin bir çukur var.", address: "Kale Mah.", point: { lat: 40.544, lng: 41.992 }, photoIds })
      .expect(201)
  ).body.request;
}
const staffView = async (id: string) => (await request(api.app).get(`/api/staff/requests/${id}`).set(works).expect(200)).body.request;

test("a fitting photo is noted and the request is assigned as usual", async () => {
  nextRelevance = { verdict: "ok", note: "Fotoğrafta yoldaki çukur görülüyor." };
  const r = await report();
  assert.equal(r.status, "assigned");
  const s = await staffView(r.id);
  assert.equal(s.photoCheck.verdict, "ok");
});

test("an unrelated photo holds the request for a person; staff can still assign it", async () => {
  nextRelevance = { verdict: "unrelated", note: "Fotoğraf bir deniz manzarası; yol hasarı görünmüyor." };
  const r = await report();
  assert.equal(r.status, "routed", "not auto-assigned");
  let s = await staffView(r.id);
  assert.equal(s.photoCheck.verdict, "unrelated");
  assert.match(s.agentReason, /personel onayı/);
  await api.server.ctx.agentService.sweep();
  assert.equal((await staffView(r.id)).status, "routed", "the sweep does not assign it either");
  await request(api.app).post(`/api/staff/requests/${r.id}/assign`).set(works).send({ teamId: "fen-yol" }).expect(200);
  s = await staffView(r.id);
  assert.equal(s.status, "assigned");
  // The citizen is not shown the AI's judgement.
  const mine = (await request(api.app).get(`/api/requests/${r.id}`).set(citizen).expect(200)).body.request;
  assert.ok(!("photoCheck" in mine));
});

test("no photo, or a failing model, changes nothing", async () => {
  seen.length = 0;
  const plain = await report(false);
  assert.equal(plain.status, "assigned");
  assert.equal(seen.length, 0, "no model call without photos");
  nextRelevance = "fail";
  const r = await report();
  assert.equal(r.status, "assigned");
  assert.equal((await staffView(r.id)).photoCheck, null);
});

test("closing photos are compared with the citizen's and the result is shown to staff", async () => {
  nextRelevance = { verdict: "ok", note: "Çukur görülüyor." };
  const r = await report();
  const team = (await staffView(r.id)).teamId;
  const crew = await api.login(`demo-${team}@kentbag.app`);
  const closing = await photo(crew);
  seen.length = 0;
  await request(api.app).post(`/api/crew/jobs/${r.id}/resolve`).set(crew).send({ note: "Çukur asfaltla dolduruldu.", photoIds: [closing] }).expect(200);
  assert.deepEqual(seen, [{ kind: "resolution", photos: 2 }]);
  const s = await staffView(r.id);
  assert.equal(s.status, "resolved");
  assert.equal(s.resolutionCheck.verdict, "confirmed");
});
