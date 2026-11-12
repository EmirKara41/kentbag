import test from "node:test";
import assert from "node:assert/strict";
import { createDraftStore, validateReport, type ReportDraft } from "../src/report.ts";

const valid: ReportDraft = {
  clientRequestId: "c-1",
  category: "electricity",
  description: "Sokakta elektrik yok.",
  address: "",
  point: { lat: 40.5, lng: 41.9 },
  photoIds: [],
};

test("report validation messages", () => {
  assert.equal(validateReport({ ...valid, category: null }), "Sorunun türünü seç.");
  assert.equal(validateReport({ ...valid, description: "123456789" }), "Sorunu en az 10 karakterle anlat.");
  assert.equal(validateReport({ ...valid, point: null, address: "abc" }), "Konum seç veya adres yaz.");
  assert.equal(validateReport({ ...valid, point: null, address: "Cumhuriyet Mah." }), null);
  assert.equal(validateReport(valid), null);
});

test("draft store keeps the same clientRequestId until cleared", () => {
  const mem = new Map<string, string>();
  const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  const store = createDraftStore(storage);
  const first = store.load();
  assert.ok(first.clientRequestId.length >= 8);
  store.save({ ...first, description: "yarım kalan" });
  const again = store.load();
  assert.equal(again.clientRequestId, first.clientRequestId);
  assert.equal(again.description, "yarım kalan");
  store.clear();
  assert.notEqual(store.load().clientRequestId, first.clientRequestId);
});
