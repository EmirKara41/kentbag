import test from "node:test";
import assert from "node:assert/strict";
import {
  freshDraft,
  draftError,
  validPoint,
  isCompleted,
  isOngoing,
} from "../src/domain";
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
