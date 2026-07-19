// test.js — run with `node test.js`
// Smallest checks that fail if the enhance odds or stat stacking break.
import assert from "node:assert/strict";
import { enhanceChance, tryEnhance, MAX_PLUS } from "./enhance.js";
import { statValue, aggregate, getItem } from "./items.js";

// odds table (decompiled map values, see DECOMPILE.md)
assert.equal(enhanceChance(0), 1);
assert.equal(enhanceChance(3), 1);
assert.equal(enhanceChance(4), 0.3);
assert.equal(enhanceChance(6), 0.3);
assert.equal(enhanceChance(7), 0.12);
assert.equal(enhanceChance(10), 0.12);
assert.equal(enhanceChance(11), 0.018);
assert.equal(enhanceChance(15), 0.018);
assert.equal(enhanceChance(16), 0.0045);
assert.equal(enhanceChance(19), 0.0045);

// stat scaling endpoints
const raf = getItem("rafaros");
assert.equal(statValue(raf, 0), raf.base);
assert.equal(statValue(raf, 20), raf.per20);

// aggregation: atk stacks, atkspd takes best only
const agg = aggregate([
  { itemId: "rafaros", plus: 0 },     // ATK 1
  { itemId: "liberation", plus: 20 }, // ATK 1600
  { itemId: "lumen", plus: 0 },       // SPD 30
  { itemId: "lumen", plus: 20 },      // SPD 205 (only this counts)
  null,
  null,
]);
assert.equal(agg.atk, 1601);
assert.equal(agg.spdPct, 205);

// tryEnhance: success increments, fail doesn't, both charge copper
const def = getItem("rafaros");
let state = { copper: 100 };
let eq = { itemId: "rafaros", plus: 5 };
assert.deepEqual(tryEnhance(state, eq, def, () => 0), { result: "success", chance: 0.3 });
assert.equal(eq.plus, 6);
assert.equal(state.copper, 100 - def.enhCost);
assert.deepEqual(tryEnhance(state, eq, def, () => 0.999), { result: "fail", chance: 0.3 });
assert.equal(eq.plus, 6);
assert.equal(state.copper, 100 - 2 * def.enhCost);

// guards
assert.equal(tryEnhance({ copper: 0 }, { itemId: "rafaros", plus: 5 }, def).result, "poor");
assert.equal(tryEnhance({ copper: 1e9 }, { itemId: "rafaros", plus: MAX_PLUS }, def).result, "max");

console.log("all checks passed");
