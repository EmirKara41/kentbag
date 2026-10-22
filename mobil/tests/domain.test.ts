import test from "node:test";
import assert from "node:assert/strict";
import {
  freshDraft,
  draftError,
  validPoint,
  isCompleted,
  isOngoing,
  groupReportEvents,
  type ReportEvent,
} from "../src/domain";
test("history groups only adjacent automatic duplicates and preserves every authored message", () => {
  const event: ReportEvent = {
    id: "1",
    status: "in_review",
    body: "Yönlendirme kaydı oluşturuldu.",
    createdAt: "2026-10-22T11:18:00Z",
  };
  const message: ReportEvent = {
    ...event,
    id: "3",
    body: "Ekip bölgeye gidiyor.",
    kind: "message",
  };
  const events = [
    event,
    { ...event, id: "2" },
    message,
    { ...message, id: "4" },
    { ...event, id: "5" },
  ];
  const grouped = groupReportEvents(events);
  assert.equal(grouped.length, 4);
  assert.equal(grouped[0].repeats.length, 1);
  assert.deepEqual(
    grouped.flatMap((g) => [g.event, ...g.repeats]),
    events,
  );
  assert.equal(events.length, 5);
});
test("reports require a valid category, description, point and no more than three photos", () => {
  const draft = freshDraft("road");
  draft.description = "Yolun girişinde büyük bir çukur oluşmuş.";
  assert.ok(draftError(draft));
  draft.location = { latitude: 41, longitude: 29, address: "", source: "map" };
  assert.equal(draftError(draft), null);
  draft.location.latitude = 200;
  assert.ok(draftError(draft));
  assert.equal(
    validPoint({
      latitude: Number.NaN,
      longitude: 10,
      source: "map",
      address: "",
    }),
    false,
  );
});
test("completed archive excludes withdrawals and unresolved citizen feedback", () => {
  assert.equal(isCompleted({ status: "withdrawn" }), false);
  assert.equal(isOngoing({ status: "withdrawn" }), false);
  assert.equal(isCompleted({ status: "resolved" }), true);
  const report = {
    status: "closed" as const,
    feedback: { outcome: "persists" as const, text: "", createdAt: "" },
  };
  assert.equal(isCompleted(report), false);
  assert.equal(isOngoing(report), true);
});
test("request kind and category must match before submitting", () => {
  const draft = freshDraft("accessibility", "improvement");
  draft.description = "Sağlık merkezine erişilebilir bir geçiş gerekiyor.";
  draft.location = { latitude: 41, longitude: 29, address: "", source: "map" };
  assert.equal(draftError(draft), null);
  draft.kind = "issue";
  assert.ok(draftError(draft));
});
test("each new report has a stable unique retry identity", () => {
  const first = freshDraft(),
    second = freshDraft();
  assert.notEqual(first.requestId, second.requestId);
  assert.equal(JSON.parse(JSON.stringify(first)).requestId, first.requestId);
});
test("a typed address is a valid location without coordinates, but a short address is not", () => {
  const draft = freshDraft("road");
  draft.description = "Sokağın girişindeki yol yüzeyi bozulmuş.";
  draft.location = { source: "manual", address: "Kısa" };
  assert.ok(draftError(draft));
  draft.location.address = "İstanbul, Kadıköy, Moda Caddesi No: 15 önü";
  assert.equal(draftError(draft), null);
  assert.equal(validPoint(draft.location), false);
});
