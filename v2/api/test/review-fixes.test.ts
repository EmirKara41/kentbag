import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { TransitionError } from "@kentbag/shared";
import { createPgDb } from "../src/db.ts";
import { saveTransition } from "../src/requests.ts";
import { setAgent } from "../src/settings.ts";
import { startTestApi, type Headers, type TestApi } from "./harness.ts";

let clock = new Date("2026-11-12T10:00:00Z");
let api: TestApi;
let citizen: Headers;
let center: Headers;
let electricity: Headers;
before(async () => {
  api = await startTestApi({ now: () => clock });
  citizen = await api.signUpCitizen("fixes@example.test");
  center = await api.login("demo-merkez@kentbag.app");
  electricity = await api.login("demo-kurum-electricity@kentbag.app");
  await api.db.query("UPDATE team SET located_at=$1", [clock]);
});
after(async () => api.close());

const create = async () =>
  (
    await request(api.app)
      .post("/api/requests")
      .set(citizen)
      .send({ clientRequestId: crypto.randomUUID(), category: "electricity", description: "Sokakta elektrik kesintisi var.", address: "Cumhuriyet Mah.", point: { lat: 40.546, lng: 41.994 }, photoIds: [] })
      .expect(201)
  ).body.request;

test("an expected-status guard is checked under the lock (no double or overriding assignment)", async () => {
  const r = await create();
  assert.equal(r.status, "assigned");
  await assert.rejects(
    () =>
      saveTransition(api.server.ctx, r.id, { type: "assign", teamId: "elk-ariza", reason: "ikinci ajan" }, { role: "agent" }, {
        expectStatus: ["routed", "returned", "reopened"],
      }),
    (e: unknown) => e instanceof TransitionError && e.code === "invalid_state",
  );
  const assigns = (await api.db.query("SELECT count(*)::int AS n FROM request_event WHERE request_id=$1 AND type='assign'", [r.id])).rows[0].n;
  assert.equal(assigns, 1);
});

test("the agent does not overwrite a manual assignment made meanwhile", async () => {
  await setAgent(api.db, "electricity", false);
  const r = await create();
  await request(api.app).post(`/api/staff/requests/${r.id}/assign`).set(electricity).send({ teamId: "elk-bakim" }).expect(200);
  await setAgent(api.db, "electricity", true);
  await api.server.ctx.agentService.processRequest(r.id);
  assert.equal((await api.db.query("SELECT team_id FROM request WHERE id=$1", [r.id])).rows[0].team_id, "elk-bakim");
});

test("db.tx retries a deadlock once and succeeds", async () => {
  let attempts = 0;
  const fakeClient = {
    query: async (sql: string) => {
      if (sql === "SELECT work") {
        attempts++;
        if (attempts === 1) throw Object.assign(new Error("deadlock detected"), { code: "40P01" });
      }
      return { rows: [] };
    },
    release: () => {},
  };
  const db = createPgDb({ connect: async () => fakeClient, query: async () => ({ rows: [] }) } as never);
  await db.tx((q) => q.query("SELECT work"));
  assert.equal(attempts, 2);
});

test("a stuck request is retried when the citizen opens the app, without any panel", async () => {
  await setAgent(api.db, "center", false);
  const r = await create();
  await setAgent(api.db, "center", true);
  clock = new Date(clock.getTime() + 61_000);
  await api.db.query("UPDATE team SET located_at=$1", [clock]);
  const mine = (await request(api.app).get("/api/requests/mine").set(citizen).expect(200)).body.requests;
  assert.equal(mine.find((x: any) => x.id === r.id).status, "assigned");
});

test("staff cancellation is visible to the citizen with its reason", async () => {
  const r = await create();
  await request(api.app).post(`/api/staff/requests/${r.id}/cancel`).set(center).send({ reason: "Mükerrer kayıt, diğer talep işleniyor." }).expect(200);
  const view = (await request(api.app).get(`/api/requests/${r.id}`).set(citizen).expect(200)).body.request;
  assert.ok(view.events.some((e: any) => /Mükerrer kayıt/.test(e.body)));
});
