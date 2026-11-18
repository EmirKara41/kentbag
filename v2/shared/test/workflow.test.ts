import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTransition,
  statusLabel,
  TransitionError,
  type Action,
  type Actor,
  type CitizenRequest,
  type RequestStatus,
} from "../src/index.ts";

const now = new Date("2026-11-12T10:00:00Z");
const base = (over: Partial<CitizenRequest> = {}): CitizenRequest => ({
  id: "r1",
  reference: "KB-ABC123",
  citizenId: "u-citizen",
  kind: "issue",
  category: "electricity",
  priority: "normal",
  description: "Sokakta elektrik yok.",
  address: "Cumhuriyet Mah.",
  point: { lat: 40.545, lng: 41.993 },
  photoIds: [],
  status: "received",
  institution: null,
  teamId: null,
  queueOrder: null,
  remainingMinutes: null,
  remainingSetAt: null,
  etaArrival: null,
  etaFinish: null,
  agentReason: null,
  resolutionNote: null,
  resolutionPhotoIds: [],
  resolvedAt: null,
  mergedInto: null,
  createdAt: now,
  updatedAt: now,
  ...over,
});
const agent: Actor = { role: "agent" };
const center: Actor = { role: "center", userId: "u-center" };
const inst: Actor = { role: "institution", userId: "u-inst", institution: "electricity" };
const otherInst: Actor = { role: "institution", userId: "u-inst2", institution: "water" };
const crew: Actor = { role: "crew", userId: "u-crew", teamId: "elk-trafo", institution: "electricity" };
const otherCrew: Actor = { role: "crew", userId: "u-crew2", teamId: "elk-ariza", institution: "electricity" };
const owner: Actor = { role: "citizen", userId: "u-citizen" };
const stranger: Actor = { role: "citizen", userId: "u-other" };

const routed = (s: RequestStatus = "routed") => base({ status: s, institution: "electricity" });
const onTeam = (s: RequestStatus) =>
  base({ status: s, institution: "electricity", teamId: "elk-trafo", queueOrder: 1 });

function ok(req: CitizenRequest, action: Action, actor: Actor, expected: RequestStatus) {
  const { request, event } = applyTransition(req, action, actor, now);
  assert.equal(request.status, expected);
  assert.equal(event.status, expected);
  assert.equal(event.type, action.type);
  return { request, event };
}
function fails(req: CitizenRequest, action: Action, actor: Actor, code: TransitionError["code"]) {
  assert.throws(() => applyTransition(req, action, actor, now), (e: unknown) => e instanceof TransitionError && e.code === code);
}

const route: Action = { type: "route", institution: "electricity", reason: "Kategori: elektrik" };
const assign: Action = { type: "assign", teamId: "elk-trafo", reason: "En erken varış" };
const resolve: Action = { type: "resolve", note: "Sigorta değiştirildi.", photoIds: [] };

test("route from received, reopened, returned, routed (agent and center)", () => {
  for (const s of ["received", "reopened", "returned", "routed"] as RequestStatus[]) {
    const { request } = ok(base({ status: s, teamId: "x" }), route, agent, "routed");
    assert.equal(request.institution, "electricity");
    assert.equal(request.teamId, null);
  }
  ok(base(), route, center, "routed");
  fails(base(), route, inst, "forbidden");
});

test("assign by agent, center and own institution only", () => {
  for (const s of ["routed", "assigned", "returned", "reopened"] as RequestStatus[]) ok(routed(s), assign, agent, "assigned");
  ok(routed(), assign, center, "assigned");
  const { request } = ok(routed(), assign, inst, "assigned");
  assert.equal(request.teamId, "elk-trafo");
  fails(routed(), assign, otherInst, "forbidden");
  fails(routed(), { type: "assign", teamId: "su-ariza", reason: "x" }, center, "invalid_input");
  fails(base(), assign, center, "invalid_state");
});

test("crew lifecycle depart → arrive → update → resolve", () => {
  ok(onTeam("assigned"), { type: "depart" }, crew, "en_route");
  const arrived = ok(onTeam("en_route"), { type: "arrive", remainingMinutes: 45 }, crew, "on_site").request;
  assert.equal(arrived.remainingMinutes, 45);
  assert.deepEqual(arrived.remainingSetAt, now);
  ok(onTeam("assigned"), { type: "arrive", remainingMinutes: 30 }, crew, "on_site");
  ok(onTeam("on_site"), { type: "update_remaining", remainingMinutes: 10 }, crew, "on_site");
  for (const s of ["assigned", "en_route", "on_site"] as RequestStatus[]) {
    const { request, event } = ok(onTeam(s), resolve, crew, "resolved");
    assert.equal(request.resolutionNote, "Sigorta değiştirildi.");
    assert.deepEqual(request.resolvedAt, now);
    assert.equal(event.public, true);
  }
});

test("another team cannot act; finished request cannot depart", () => {
  fails(onTeam("assigned"), { type: "depart" }, otherCrew, "forbidden");
  fails(onTeam("resolved"), { type: "depart" }, crew, "invalid_state");
});

test("input validation", () => {
  fails(onTeam("on_site"), { type: "resolve", note: "123456789", photoIds: [] }, crew, "invalid_input");
  fails(onTeam("on_site"), { type: "resolve", note: "Tamamlandı işlem", photoIds: ["a", "b", "c", "d"] }, crew, "invalid_input");
  fails(onTeam("en_route"), { type: "arrive", remainingMinutes: 0 }, crew, "invalid_input");
  fails(onTeam("en_route"), { type: "arrive", remainingMinutes: 601 }, crew, "invalid_input");
  fails(onTeam("assigned"), { type: "decline", reason: "kısa" }, crew, "invalid_input");
});

test("citizen reopen only own resolved request", () => {
  const resolved = onTeam("resolved");
  const { request } = ok(resolved, { type: "reopen", note: "Hâlâ elektrik yok", photoIds: [] }, owner, "reopened");
  assert.equal(request.teamId, null);
  fails(resolved, { type: "reopen", note: "Hâlâ elektrik yok", photoIds: [] }, stranger, "forbidden");
  fails(onTeam("on_site"), { type: "reopen", note: "Hâlâ elektrik yok", photoIds: [] }, owner, "invalid_state");
  fails(resolved, { type: "reopen", note: "yok", photoIds: [] }, owner, "invalid_input");
});

test("cancel by owner, center, institution; decline returns to queue", () => {
  const cancel: Action = { type: "cancel", reason: "Sorun kendiliğinden düzeldi." };
  for (const s of ["received", "routed", "assigned", "en_route", "on_site", "reopened", "returned"] as RequestStatus[]) {
    const { event } = ok(onTeam(s), cancel, owner, "cancelled");
    assert.equal(event.public, false);
  }
  ok(onTeam("assigned"), cancel, center, "cancelled");
  ok(onTeam("assigned"), cancel, inst, "cancelled");
  fails(onTeam("assigned"), cancel, stranger, "forbidden");
  fails(onTeam("resolved"), cancel, owner, "invalid_state");
  const { request, event } = ok(onTeam("en_route"), { type: "decline", reason: "Adreste arıza bulunamadı." }, crew, "returned");
  assert.equal(request.teamId, null);
  assert.equal(request.etaArrival, null);
  assert.equal(event.public, false);
});

test("status labels", () => {
  assert.equal(statusLabel(base()), "Alındı");
  assert.equal(statusLabel(routed(), "Elektrik Dağıtımı"), "Elektrik Dağıtımı'na iletildi");
  assert.equal(statusLabel(onTeam("assigned"), "Elektrik Dağıtımı", "Trafo müdahale ekibi"), "Trafo müdahale ekibine atandı");
  assert.equal(statusLabel(onTeam("en_route")), "Ekip yolda");
  assert.equal(statusLabel(onTeam("on_site")), "Ekip sahada");
  assert.equal(statusLabel(onTeam("resolved")), "Çözüldü");
  assert.equal(statusLabel(base({ status: "reopened" })), "Sorun devam ediyor");
  assert.equal(statusLabel(base({ status: "cancelled" })), "İptal edildi");
  assert.equal(statusLabel(base({ status: "returned" })), "Yeniden atanıyor");
});

const idea = (s: RequestStatus = "routed") => base({ kind: "improvement", category: "lighting", status: s, institution: "electricity" });

test("improvements are planned, rejected or completed by their institution, never assigned", () => {
  ok(idea(), { type: "plan", note: "Gelecek ay yapılacak." }, inst, "planned");
  ok(idea("planned"), { type: "complete", note: "Sokak lambaları takıldı." }, center, "resolved");
  const { event } = ok(idea(), { type: "reject", reason: "Bölgede yeterli aydınlatma var." }, inst, "rejected");
  assert.equal(event.public, true);
  assert.throws(() => applyTransition(idea(), { type: "assign", teamId: "elk-trafo", reason: "x" }, agent, now), TransitionError);
  assert.throws(() => applyTransition(idea(), { type: "plan", note: "Plan var." }, otherInst, now), TransitionError);
  assert.throws(() => applyTransition(idea(), { type: "plan", note: "Plan var." }, owner, now), TransitionError);
  assert.throws(() => applyTransition(routed(), { type: "plan", note: "Plan var." }, inst, now), TransitionError);
  assert.throws(() => applyTransition(idea("resolved"), { type: "reopen", note: "Yine yok.", photoIds: [] }, owner, now), TransitionError);
  assert.equal(statusLabel(idea("planned")), "Planlandı");
});

test("merge clears the queue spot and reopen splits a merged request again", () => {
  const { request } = ok(onTeam("assigned"), { type: "merge", into: "r2", reference: "KB-XYZ999" }, inst, "merged");
  assert.equal(request.teamId, null);
  assert.equal(request.mergedInto, "r2");
  assert.throws(() => applyTransition(routed(), { type: "merge", into: "r1", reference: "KB-ABC123" }, center, now), TransitionError);
  assert.throws(() => applyTransition(routed(), { type: "merge", into: "r2", reference: "KB" }, otherInst, now), TransitionError);
  const back = ok(request, { type: "reopen", note: "Bende hâlâ yok.", photoIds: [] }, owner, "reopened");
  assert.equal(back.request.mergedInto, null);
});

test("outside the area: only center or agent refers; center can take it back", async () => {
  const { outsideServiceArea, referralContacts } = await import("../src/index.ts");
  assert.equal(outsideServiceArea({ district: "Oltu", province: "Erzurum" }), false);
  assert.equal(outsideServiceArea({ district: "Narman", province: "Erzurum" }), true);
  assert.equal(outsideServiceArea(null), false);
  assert.deepEqual(referralContacts("road", { district: "Narman", province: "Erzurum" }).map((c) => c.phone), ["159", "153"]);
  assert.deepEqual(referralContacts("electricity", { district: "Yakutiye", province: "Erzurum" }, "urgent").map((c) => c.phone), ["112", "186", "153"]);
  const { request } = ok(base(), { type: "refer", message: "Yetki dışı." }, agent, "referred");
  assert.throws(() => applyTransition(base(), { type: "refer", message: "x" }, inst, now), TransitionError);
  ok(request, { type: "route", institution: "public-works", reason: "Merkez işleme aldı." }, center, "routed");
  assert.equal(statusLabel(request), "Yetki alanı dışında");
});
