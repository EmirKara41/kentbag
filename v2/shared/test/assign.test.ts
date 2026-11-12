import test from "node:test";
import assert from "node:assert/strict";
import { chooseTeam, type CandidateTeam, type Point } from "../src/index.ts";

const now = new Date("2026-11-12T10:00:00Z");
const min = (m: number) => new Date(now.getTime() + m * 60000);
const target: Point = { lat: 40.55, lng: 42.0 };
const far: Point = { lat: 40.6, lng: 42.1 };
const near: Point = { lat: 40.551, lng: 42.001 };
// Travel table keyed by origin latitude to keep the test explicit.
const travel = (a: Point) => (a.lat === far.lat ? 30 : 5);
const request = { id: "new", point: target, category: "electricity" as const, priority: "normal" as const };

const idleFar: CandidateTeam = { id: "elk-ariza", name: "Elektrik arıza ekibi", onShift: true, active: true, point: far, pointAt: min(-2), jobs: [] };
const busyNear: CandidateTeam = {
  id: "elk-trafo",
  name: "Trafo müdahale ekibi",
  onShift: true,
  active: true,
  point: near,
  pointAt: min(-2),
  jobs: [{ requestId: "cur", status: "on_site", point: near, category: "electricity", remainingMinutes: 10, remainingSetAt: now, etaArrival: null }],
};

test("picks the team that arrives first, even if busy", () => {
  // idleFar: 30+6 = 36 min; busyNear: 10 + (5+5) = 20 min
  const r = chooseTeam({ now, request, teams: [idleFar, busyNear], travel });
  assert.equal(r?.teamId, "elk-trafo");
  assert.equal(r?.position, 2);
  assert.deepEqual(r?.arrival, min(20));
  assert.match(r!.reason, /Trafo müdahale ekibi/);
});

test("off-shift or inactive teams are never chosen", () => {
  const r = chooseTeam({ now, request, teams: [{ ...busyNear, onShift: false }, { ...idleFar, active: false }], travel });
  assert.equal(r, null);
  const only = chooseTeam({ now, request, teams: [{ ...busyNear, onShift: false }, idleFar], travel });
  assert.equal(only?.teamId, "elk-ariza");
});

test("urgent request goes right after the current job", () => {
  const twoJobs: CandidateTeam = {
    ...busyNear,
    jobs: [
      ...busyNear.jobs,
      { requestId: "later", status: "assigned", point: far, category: "road", remainingMinutes: null, remainingSetAt: null, etaArrival: null },
    ],
  };
  const r = chooseTeam({ now, request: { ...request, priority: "urgent" }, teams: [twoJobs], travel });
  assert.equal(r?.position, 2);
  const normal = chooseTeam({ now, request, teams: [twoJobs], travel });
  assert.equal(normal?.position, 3);
});

test("when no arrival can be computed, the shortest queue wins with an explanation", () => {
  const r = chooseTeam({
    now,
    request: { ...request, point: null },
    teams: [busyNear, { ...idleFar, id: "elk-bakim", name: "Şebeke bakım ekibi" }],
    travel,
  });
  assert.equal(r?.teamId, "elk-bakim");
  assert.equal(r?.arrival, null);
  assert.match(r!.reason, /hesaplanamadı/);
});
