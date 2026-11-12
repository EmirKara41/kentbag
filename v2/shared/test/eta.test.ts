import test from "node:test";
import assert from "node:assert/strict";
import { fallbackTravelMinutes, queueEta, withBuffer, type QueueJob, type Point } from "../src/index.ts";

const now = new Date("2026-11-12T10:00:00Z");
const min = (m: number) => new Date(now.getTime() + m * 60000);
const A: Point = { lat: 40.54, lng: 41.99 };
const B: Point = { lat: 40.55, lng: 42.0 };
const C: Point = { lat: 40.56, lng: 42.01 };
const travel20 = () => 20;
const job = (over: Partial<QueueJob>): QueueJob => ({
  requestId: "j",
  status: "assigned",
  point: B,
  category: "electricity",
  remainingMinutes: null,
  remainingSetAt: null,
  etaArrival: null,
  ...over,
});

test("buffer is 20% with a 5 minute floor", () => {
  assert.equal(withBuffer(50), 60);
  assert.equal(withBuffer(10), 15);
  assert.equal(withBuffer(0), 5);
});

test("fallback travel uses road factor 1.4 at 30 km/h", () => {
  const m = fallbackTravelMinutes(A, B);
  // ~1.39 km straight → 1.95 km road → 3.9 min → 4
  assert.ok(m >= 3 && m <= 5, String(m));
  assert.equal(fallbackTravelMinutes(A, A), 0);
});

test("idle team with fresh location: arrival = now + travel + buffer", () => {
  const [r] = queueEta({ now, teamPoint: A, teamPointAt: min(-10), jobs: [job({ requestId: "x" })], travel: travel20 });
  assert.deepEqual(r.arrival, min(25));
  assert.deepEqual(r.finish, min(85)); // electricity default 60
});

test("on-site job remaining 60 entered 10 min ago, next job 20 min away", () => {
  const out = queueEta({
    now,
    teamPoint: A,
    teamPointAt: min(-1),
    jobs: [
      job({ requestId: "cur", status: "on_site", point: A, remainingMinutes: 60, remainingSetAt: min(-10) }),
      job({ requestId: "next", point: B }),
    ],
    travel: travel20,
  });
  assert.equal(out[0].arrival, null);
  assert.deepEqual(out[0].finish, min(50));
  assert.deepEqual(out[1].arrival, min(50 + 25));
});

test("stale team location and no previous job → null", () => {
  const [r] = queueEta({ now, teamPoint: A, teamPointAt: min(-31), jobs: [job({})], travel: travel20 });
  assert.equal(r.arrival, null);
  assert.equal(r.finish, null);
});

test("a job without a point breaks the chain for itself and later jobs", () => {
  const out = queueEta({
    now,
    teamPoint: A,
    teamPointAt: min(-1),
    jobs: [job({ requestId: "1", point: null }), job({ requestId: "2", point: C })],
    travel: travel20,
  });
  assert.equal(out[0].arrival, null);
  assert.equal(out[1].arrival, null);
});

test("en-route job keeps its own arrival", () => {
  const [r] = queueEta({
    now,
    teamPoint: null,
    teamPointAt: null,
    jobs: [job({ status: "en_route", etaArrival: min(12) })],
    travel: travel20,
  });
  assert.deepEqual(r.arrival, min(12));
  assert.deepEqual(r.finish, min(72));
});
