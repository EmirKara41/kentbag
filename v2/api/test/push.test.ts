import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import type { PushMessage } from "../src/push.ts";
import { startTestApi, type Headers, type TestApi } from "./harness.ts";

const sent: { tokens: string[]; msg: PushMessage }[] = [];
let failSend = false;
let api: TestApi;
let citizen: Headers;
let trafo: Headers;
before(async () => {
  api = await startTestApi({
    pushSend: async (tokens, msg) => {
      if (failSend) throw new Error("FCM down");
      sent.push({ tokens, msg });
      return { invalidTokens: tokens.filter((t) => t.startsWith("dead")) };
    },
  });
  citizen = await api.signUpCitizen("push@example.test");
  trafo = await api.login("demo-elk-trafo@kentbag.app");
  await api.db.query("UPDATE team SET on_shift=false WHERE institution_id='electricity' AND id<>'elk-trafo'");
  await request(api.app).post("/api/push/token").set(citizen).send({ token: "citizen-token", enabled: true }).expect(204);
  await request(api.app).post("/api/push/token").set(trafo).send({ token: "trafo-token", enabled: true }).expect(204);
});
beforeEach(() => {
  sent.length = 0;
  failSend = false;
});
after(async () => api.close());

const create = async () =>
  (
    await request(api.app)
      .post("/api/requests")
      .set(citizen)
      .send({ clientRequestId: crypto.randomUUID(), category: "electricity", description: "Direkteki lamba patladı, elektrik yok.", address: "Aslanpaşa Mah.", point: { lat: 40.549, lng: 41.996 }, photoIds: [] })
      .expect(201)
  ).body.request;

test("assignment notifies the crew and the citizen", async () => {
  const r = await create();
  const crew = sent.filter((s) => s.tokens.includes("trafo-token"));
  assert.equal(crew.length, 1);
  assert.match(crew[0].msg.title, /Yeni iş/);
  assert.equal(crew[0].msg.data.requestId, r.id);
  assert.ok(sent.some((s) => s.tokens.includes("citizen-token") && /atandı/.test(s.msg.body)));
});

test("resolve sends 'Sorununuz çözüldü' to the citizen once", async () => {
  const r = await create();
  sent.length = 0;
  await request(api.app).post(`/api/crew/jobs/${r.id}/resolve`).set(trafo).send({ note: "Lamba ve sigorta değiştirildi.", photoIds: [] }).expect(200);
  const toCitizen = sent.filter((s) => s.tokens.includes("citizen-token"));
  assert.equal(toCitizen.length, 1);
  assert.equal(toCitizen[0].msg.title, "Sorununuz çözüldü");
});

test("disabled tokens get nothing; dead tokens are removed", async () => {
  await request(api.app).post("/api/push/token").set(citizen).send({ token: "citizen-token", enabled: false }).expect(204);
  await request(api.app).post("/api/push/token").set(citizen).send({ token: "dead-token", enabled: true }).expect(204);
  await create();
  assert.ok(!sent.some((s) => s.tokens.includes("citizen-token")));
  const dead = await api.db.query("SELECT 1 FROM push_token WHERE token='dead-token'");
  assert.equal(dead.rows.length, 0);
  await request(api.app).post("/api/push/token").set(citizen).send({ token: "citizen-token", enabled: true }).expect(204);
});

test("a failing push service never breaks the action", async () => {
  const r = await create();
  failSend = true;
  await request(api.app).post(`/api/crew/jobs/${r.id}/resolve`).set(trafo).send({ note: "Arıza giderildi, kontrol tamam.", photoIds: [] }).expect(200);
});
