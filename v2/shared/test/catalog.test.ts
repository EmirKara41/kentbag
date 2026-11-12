import test from "node:test";
import assert from "node:assert/strict";
import { categories, institutions, institutionFor, oltuNeighborhoods, type CategoryId } from "../src/index.ts";

test("every category maps to an institution that has teams", () => {
  for (const id of Object.keys(categories) as CategoryId[]) {
    const inst = institutionFor(id);
    assert.ok(institutions[inst].teams.length > 0, id);
  }
  assert.equal(institutionFor("lighting"), "electricity");
  assert.equal(institutionFor("ice"), "public-works");
  assert.deepEqual(institutions.electricity.teams.map((t) => t.id), ["elk-ariza", "elk-bakim", "elk-trafo"]);
  assert.equal(categories.water.defaultMinutes, 90);
  assert.ok(oltuNeighborhoods.length >= 10);
});
