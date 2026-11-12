import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestApi, type Headers, type TestApi } from "./harness.ts";
import type { Classify } from "../src/agent.ts";
import { setAgent } from "../src/settings.ts";

let classifyImpl: Classify | undefined;
let clock = new Date("2026-11-12T10:00:00Z");
let api: TestApi;
let citizen: Headers;

before(async () => {
  api = await startTestApi({
    classify: (input) => (classifyImpl ? classifyImpl(input) : Promise.reject(new Error("no model"))),
    now: () => clock,
    classifyTimeoutMs: 200,
  });
  citizen = await api.signUpCitizen("agent-citizen@example.test");
  // Seeded team locations are "now" at seed time; align them with the test clock.
  await api.db.query("UPDATE team SET located_at=$1", [clock]);
});
after(async () => api.close());
beforeEach(async () => {
  classifyImpl = async () => ({ priority: "high", note: "Elektrik kesintisi, kritik hizmet." });
  await setAgent(api.db, "center", true);
  for (const id of ["electricity", "water"] as const) await setAgent(api.db, id, true);
  await api.db.query("UPDATE team SET on_shift=true, active=true");
});

const create = async (category = "electricity") =>
  (
    await request(api.app)
      .post("/api/requests")
      .set(citizen)
      .send({
        clientRequestId: crypto.randomUUID(),
        category,
        description: "Mahallede uzun süredir kesinti var.",
        address: "Cumhuriyet Mah.",
        point: { lat: 40.546, lng: 41.994 },
        photoIds: [],
      })
      .expect(201)
  ).body.request;
const row = async (id: string) => (await api.db.query("SELECT * FROM request WHERE id=$1", [id])).rows[0];

test("agent routes and assigns with a reason", async () => {
  const r = await create();
  const db = await row(r.id);
  assert.equal(db.status, "assigned");
  assert.equal(db.institution_id, "electricity");
  assert.ok(["elk-ariza", "elk-bakim", "elk-trafo"].includes(db.team_id));
  assert.equal(db.priority, "high");
  assert.match(db.agent_reason, /ekibi seçildi/);
  assert.equal(db.queue_order, 1);
  assert.equal(r.status, "assigned");
});

test("model error → routed by category, still assigned", async () => {
  classifyImpl = async () => {
    throw new Error("Gemini down");
  };
  const db = await row((await create()).id);
  assert.equal(db.status, "assigned");
  assert.equal(db.priority, "normal");
  assert.match(db.agent_reason, /Yapay zekâ yanıt vermedi/);
});

test("model timeout behaves like an error", async () => {
  classifyImpl = () => new Promise((resolve) => setTimeout(() => resolve({ priority: "urgent", note: "geç" }), 1000));
  const db = await row((await create()).id);
  assert.equal(db.status, "assigned");
  assert.equal(db.priority, "normal");
});

test("no team on shift → routed; a team going on shift gets it", async () => {
  await api.db.query("UPDATE team SET on_shift=false WHERE institution_id='water'");
  const r = await create("water");
  assert.equal((await row(r.id)).status, "routed");
  await api.db.query("UPDATE team SET on_shift=true WHERE id='su-ariza'");
  const n = await api.server.ctx.agentService.assignWaiting("water");
  assert.ok(n >= 1);
  const db = await row(r.id);
  assert.equal(db.status, "assigned");
  assert.equal(db.team_id, "su-ariza");
});

test("center agent off → request stays received", async () => {
  await setAgent(api.db, "center", false);
  const r = await create();
  assert.equal((await row(r.id)).status, "received");
});

test("institution agent off → routed but no team", async () => {
  await setAgent(api.db, "electricity", false);
  const r = await create();
  const db = await row(r.id);
  assert.equal(db.status, "routed");
  assert.equal(db.team_id, null);
});

test("sweep processes requests left in received for over 60 seconds", async () => {
  await setAgent(api.db, "center", false);
  const r = await create();
  await setAgent(api.db, "center", true);
  clock = new Date(clock.getTime() + 61_000);
  await api.db.query("UPDATE team SET located_at=$1", [clock]);
  const out = await api.server.ctx.agentService.sweep();
  assert.ok(out.processed >= 1);
  assert.equal((await row(r.id)).status, "assigned");
});

test("suggest explains without changing anything", async () => {
  await setAgent(api.db, "center", false);
  const r = await create();
  const s = await api.server.ctx.agentService.suggest(r.id);
  assert.equal(s!.institution, "electricity");
  assert.ok(s!.teamId);
  assert.equal((await row(r.id)).status, "received");
});
