import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import type { PushMessage } from "../src/push.ts";
import { startTestApi, type Headers, type TestApi } from "./harness.ts";

const clock = new Date("2026-11-18T09:00:00Z");
const sent: { tokens: string[]; msg: PushMessage }[] = [];
let api: TestApi;
let ali: Headers;
let ayse: Headers;
let electricity: Headers;
let water: Headers;
let center: Headers;

before(async () => {
  api = await startTestApi({
    now: () => clock,
    pushSend: async (tokens, msg) => {
      sent.push({ tokens, msg });
      return { invalidTokens: [] };
    },
  });
  ali = await api.signUpCitizen("ali@example.test");
  ayse = await api.signUpCitizen("ayse@example.test");
  electricity = await api.login("demo-kurum-electricity@kentbag.app");
  water = await api.login("demo-kurum-water@kentbag.app");
  center = await api.login("demo-merkez@kentbag.app");
  await api.db.query("UPDATE team SET located_at=$1", [clock]);
  await request(api.app).post("/api/push/token").set(ayse).send({ token: "ayse-token-123", enabled: true }).expect(204);
});
after(async () => api.close());

const report = (who: Headers, body: Record<string, unknown>) =>
  request(api.app)
    .post("/api/requests")
    .set(who)
    .send({ clientRequestId: crypto.randomUUID(), address: "Cumhuriyet Mah.", photoIds: [], ...body })
    .expect(201)
    .then((r) => r.body.request);

test("an improvement goes to the institution, never to a crew, and the institution decides", async () => {
  const idea = await report(ali, { category: "lighting", description: "Parkın yanındaki sokak çok karanlık.", point: { lat: 40.546, lng: 41.994 } });
  assert.equal(idea.status, "routed");
  assert.equal(idea.teamName, null);
  // Water cannot decide on an electricity improvement; a crew assignment is refused.
  await request(api.app).post(`/api/staff/requests/${idea.id}/plan`).set(water).send({ note: "Plan var." }).expect(404);
  await request(api.app).post(`/api/staff/requests/${idea.id}/assign`).set(electricity).send({ teamId: "elk-ariza" }).expect(400);
  await request(api.app).post(`/api/staff/requests/${idea.id}/plan`).set(electricity).send({ note: "Aralık ayında iki direk eklenecek." }).expect(200);
  let v = (await request(api.app).get(`/api/requests/${idea.id}`).set(ali).expect(200)).body.request;
  assert.equal(v.status, "planned");
  assert.equal(v.statusLabel, "Planlandı");
  await request(api.app).post(`/api/staff/requests/${idea.id}/complete`).set(electricity).send({ note: "İki aydınlatma direği takıldı." }).expect(200);
  v = (await request(api.app).get(`/api/requests/${idea.id}`).set(ali).expect(200)).body.request;
  assert.equal(v.status, "resolved");
  assert.equal(v.canReopen, false);

  const other = await report(ali, { category: "park", description: "Parka bank konulmasını öneriyorum.", point: { lat: 40.547, lng: 41.99 } });
  await request(api.app).post(`/api/staff/requests/${other.id}/reject`).set(center).send({ reason: "Bu yıl bütçede park donatısı yok." }).expect(200);
  v = (await request(api.app).get(`/api/requests/${other.id}`).set(ali).expect(200)).body.request;
  assert.equal(v.status, "rejected");
  assert.ok(v.events.some((e: { body: string }) => /bütçede/.test(e.body)));
});

test("a neighbour sees the nearby problem, joins it and follows its progress", async () => {
  const outage = await report(ali, { category: "water", description: "Sokağımızda sabahtan beri su yok.", point: { lat: 40.546, lng: 41.994 } });
  const nearby = (
    await request(api.app).get("/api/requests/nearby").query({ lat: 40.5465, lng: 41.9945, category: "water" }).set(ayse).expect(200)
  ).body.requests;
  const found = nearby.find((n: { id: string }) => n.id === outage.id);
  assert.ok(found, "nearby problem is listed");
  assert.equal(found.supporting, false);
  assert.ok(!("description" in found));
  // Far away or other category: not listed.
  const far = (await request(api.app).get("/api/requests/nearby").query({ lat: 40.6, lng: 41.994, category: "water" }).set(ayse).expect(200)).body.requests;
  assert.ok(!far.some((n: { id: string }) => n.id === outage.id));

  const near = { point: { lat: 40.5465, lng: 41.9945 } };
  // Following needs the follower to be near the problem.
  await request(api.app).post(`/api/requests/${outage.id}/support`).set(ayse).send({ point: { lat: 40.7, lng: 41.9945 } }).expect(404);
  const followed = (await request(api.app).post(`/api/requests/${outage.id}/support`).set(ayse).send(near).expect(200)).body.request;
  assert.equal(followed.relation, "following");
  assert.equal(followed.description, "");
  assert.equal(followed.point, null);
  assert.ok(!("address" in found));
  await request(api.app).post(`/api/requests/${outage.id}/support`).set(ali).send(near).expect(409);
  const mine = (await request(api.app).get("/api/requests/mine").set(ayse).expect(200)).body.requests;
  assert.ok(mine.some((m: { id: string; relation: string }) => m.id === outage.id && m.relation === "following"));
  const owner = (await request(api.app).get(`/api/requests/${outage.id}`).set(ali).expect(200)).body.request;
  assert.equal(owner.othersAffected, true);

  sent.length = 0;
  const team = (await api.db.query("SELECT team_id FROM request WHERE id=$1", [outage.id])).rows[0].team_id;
  const crew = await api.login(`demo-${team}@kentbag.app`);
  await request(api.app).post(`/api/crew/jobs/${outage.id}/resolve`).set(crew).send({ note: "Ana boru tamir edildi, su verildi.", photoIds: [] }).expect(200);
  assert.ok(sent.some((s) => s.tokens.includes("ayse-token-123") && /Takip ettiğin sorun/.test(s.msg.title)), "follower is notified");

  await request(api.app).delete(`/api/requests/${outage.id}/support`).set(ayse).expect(204);
  await request(api.app).get(`/api/requests/${outage.id}`).set(ayse).expect(404);
});

test("staff merge duplicates; the merged request mirrors the main one and can be split again", async () => {
  const first = await report(ali, { category: "electricity", description: "Mahallede elektrik kesildi, trafo ses çıkarıyor.", point: { lat: 40.55, lng: 41.99 } });
  const dup = await report(ayse, { category: "electricity", description: "Bizim sokakta da elektrik yok.", point: { lat: 40.551, lng: 41.991 } });
  const similar = (await request(api.app).get(`/api/staff/requests/${dup.id}/similar`).set(electricity).expect(200)).body.requests;
  assert.ok(similar.some((s: { id: string }) => s.id === first.id));
  await request(api.app).post(`/api/staff/requests/${dup.id}/merge`).set(water).send({ into: first.id }).expect(404);
  await request(api.app).post(`/api/staff/requests/${dup.id}/merge`).set(electricity).send({ into: dup.id }).expect(409);
  await request(api.app).post(`/api/staff/requests/${dup.id}/merge`).set(electricity).send({ into: first.id }).expect(200);

  const raw = (await api.db.query("SELECT status, team_id, merged_into FROM request WHERE id=$1", [dup.id])).rows[0];
  assert.equal(raw.status, "merged");
  assert.equal(raw.team_id, null);
  const main = (await request(api.app).get(`/api/staff/requests/${first.id}`).set(electricity).expect(200)).body.request;
  assert.equal(main.mergedCount, 1);
  assert.equal(main.merged[0].reference, dup.reference);

  let mirrored = (await request(api.app).get(`/api/requests/${dup.id}`).set(ayse).expect(200)).body.request;
  assert.equal(mirrored.mergedWith, first.reference);
  assert.equal(mirrored.status, main.status);
  assert.equal(mirrored.description, "Bizim sokakta da elektrik yok.");
  await request(api.app).post(`/api/requests/${dup.id}/reopen`).set(ayse).send({ note: "Hâlâ yok.", photoIds: [] }).expect(409);

  const crew = await api.login(`demo-${main.teamId}@kentbag.app`);
  await request(api.app).post(`/api/crew/jobs/${first.id}/resolve`).set(crew).send({ note: "Trafo sigortası değiştirildi.", photoIds: [] }).expect(200);
  mirrored = (await request(api.app).get(`/api/requests/${dup.id}`).set(ayse).expect(200)).body.request;
  assert.equal(mirrored.status, "resolved");
  assert.equal(mirrored.resolutionNote, "Trafo sigortası değiştirildi.");
  assert.equal(mirrored.canReopen, true);

  // Still broken at Ayşe's: her request splits off and goes back to work.
  const back = (await request(api.app).post(`/api/requests/${dup.id}/reopen`).set(ayse).send({ note: "Bizim sokakta hâlâ yok.", photoIds: [] }).expect(200)).body.request;
  assert.equal(back.mergedWith, null);
  assert.equal(back.status, "assigned");
});
