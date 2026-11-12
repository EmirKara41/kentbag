import test from "node:test";
import assert from "node:assert/strict";
import { nextAction, remainingChoices } from "../src/crew.ts";

test("one big button per stage", () => {
  assert.deepEqual(nextAction("assigned"), { label: "Yola çıktım", action: "depart" });
  assert.deepEqual(nextAction("en_route"), { label: "Vardım", action: "arrive" });
  assert.deepEqual(nextAction("on_site"), { label: "Bitti", action: "resolve" });
  assert.equal(nextAction("resolved"), null);
});

test("remaining-time choices", () => {
  assert.deepEqual(remainingChoices, [15, 30, 45, 60, 90, 120]);
});
