import test from "node:test";
import assert from "node:assert/strict";
import { routeIndex, routeStops, isLive } from "../src/index.ts";

test("every status maps to a route stop", () => {
  assert.equal(routeStops.length, 6);
  assert.equal(routeIndex("received"), 0);
  assert.equal(routeIndex("reopened"), 1);
  assert.equal(routeIndex("assigned"), 2);
  assert.equal(routeIndex("en_route"), 3);
  assert.equal(routeIndex("on_site"), 4);
  assert.equal(routeIndex("resolved"), 5);
  assert.equal(routeIndex("cancelled"), -1);
  assert.ok(isLive("en_route") && !isLive("resolved"));
});
