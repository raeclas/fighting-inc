// test.js — run with `node test.js`
// Smallest checks that fail if the enhance odds or stat stacking break.
import assert from "node:assert/strict";
import { enhanceChance, tryEnhance, MAX_PLUS } from "../enhance.js";
import { statValue, intValue, aggregate, getItem } from "../items.js";
import { bosses, spawnBossMob } from "../bosses.js";
import { spawnField, gridDist, getZone } from "../zones.js";
import { charBonus, legionBonuses, unlockedSlots, MASTERY_INT, CLASS_BONUSES } from "../legion.js";
import { load, serialize } from "../saveSystem.js";
import { classes } from "../classes.js";

// field: 16 mobs on a 4×4 grid, AoE radius → coverage
const field = spawnField(getZone("kiln"), 0);
assert.equal(field.length, 16);
const centre = field.find(m => m.gx === 1 && m.gy === 1);
const cover = r => field.filter(m => gridDist(m, centre) <= r).length;
assert.equal(cover(0), 1);      // single-target hits one
assert.equal(cover(1.5), 9);    // 3×3-ish
assert.equal(cover(4), 16);     // whole field
assert.ok(cover(2.5) > cover(1.5)); // bigger radius → more mobs

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

// Legion board: mastery gate, log10 scaling, per-class stat routing, slots
assert.equal(charBonus({ classId: "striker", int: MASTERY_INT - 1 }), 0);       // below gate
assert.equal(charBonus({ classId: null, int: 1e9 }), 0);                        // no class
assert.equal(charBonus({ classId: "striker", int: 999 * MASTERY_INT }), 4 * 3); // log10(1000)=3
const leg = legionBonuses({ characters: [
  { classId: "striker", int: 999 * MASTERY_INT },
  { classId: "overmind", int: 999 * MASTERY_INT },
  { classId: "overmind", int: 0 },                 // gated, contributes nothing
] });
assert.equal(leg.atkSpeedPct, 12);
assert.equal(leg.skillDmgPct, 15);
assert.equal(unlockedSlots({ characters: [{ int: 0 }] }), 1);
assert.equal(unlockedSlots({ characters: [{ int: 100e3 }] }), 2);
assert.equal(unlockedSlots({ characters: [{ int: 60e3 }, { int: 40e3 }] }), 2); // account total
assert.equal(unlockedSlots({ characters: [{ int: 1e6 }] }), 3);

// class schema: 7 skills + a stat passive each, globally unique ids,
// sane numbers, and a Legion bonus row per class
const allSkillIds = new Set();
for (const cls of classes) {
  assert.equal(cls.skills.length, 7, `${cls.id} skill count`);
  assert.ok(cls.passive?.name, `${cls.id} passive`);
  assert.ok(CLASS_BONUSES[cls.id], `${cls.id} legion row`);
  for (const s of cls.skills) {
    assert.ok(!allSkillIds.has(s.id), `duplicate skill id ${s.id}`);
    allSkillIds.add(s.id);
    assert.ok(s.mult > 0, s.id);
    if (cls.archetype === "active") assert.ok(s.key && s.cooldownMs > 0, s.id);
    else assert.ok(s.procChance > 0 && s.procChance <= 1, s.id);
    if (s.aoe) assert.ok(s.radius > 0, s.id);
  }
}

// boss schema: sane numbers, resolvable drop pools, unique ids, regen math
const bossIds = new Set();
for (const b of bosses) {
  assert.ok(!bossIds.has(b.id), `dup boss id ${b.id}`);
  bossIds.add(b.id);
  assert.ok(b.hp > 0 && b.defense >= 0, b.id);
  const r = b.regenPct ?? 0.005;
  assert.ok(r >= 0 && r <= 1, `${b.id} regenPct`);
  assert.ok(b.drops && b.drops.bounty > 0 && b.drops.itemChance > 0, `${b.id} drops`);
  for (const id of b.drops.pool) assert.ok(getItem(id), `${b.id} pool item ${id}`);
  if (b.drops.rare) assert.ok(getItem(b.drops.rare.itemId), `${b.id} rare item`);
}
const wall = spawnBossMob(bosses.find(b => b.id === "prey"));
assert.equal(wall.regen, wall.maxHp); // 100%/s wall: full heal per second

// item effect folding
const fx = aggregate([
  { itemId: "rosetta", plus: 0 },       // atkPct 10, int 30
  { itemId: "kneecap", plus: 0 },       // crit 15% x2
  { itemId: "ezraprophecy", plus: 0 },  // crit 20% x3 (better -> wins)
  { itemId: "partyhat", plus: 0 },      // intProc 10% x2
  { itemId: "tiamatcurse", plus: 0 },   // itemIntPct 30
  { itemId: "talisman", plus: 0 },      // +1 all skills
]);
assert.equal(fx.atkPct, 10);
assert.equal(fx.crit.mult, 3);              // best crit item only
assert.equal(fx.intProcs.length, 1);
assert.equal(fx.skillLevelBonus, 1);
const rawInt = 30 + 80 + 1_200_000 + 20 + 76_000; // int sum at +0
assert.equal(fx.int, Math.round(rawInt * 1.3));   // itemIntPct applies to total
// int scales with plus on the primary-stat ramp
assert.equal(intValue(getItem("rosetta"), 20), Math.round(30 * (4000 / 300)));

// save migration: v1 single-player save -> v2 roster
globalThis.localStorage = {
  store: {},
  getItem(k) { return this.store[k] ?? null; },
  setItem(k, v) { this.store[k] = v; },
  removeItem(k) { delete this.store[k]; },
};
localStorage.setItem("esrpg_save", JSON.stringify({
  v: 1, copper: 5555, int: 777,
  kills: { temple: 8 }, currentZoneId: "temple",
  legion: { retired: [{ classId: "striker", level: 40 }] },
  player: { level: 12, classId: "striker", attack: 25, skills: { jab: 1 } },
}));
const st = { characters: [], active: 0, slots: 1, kills: {}, fieldKills: {}, macro: {}, gathering: {} };
load(st);
assert.equal(st.characters.length, 1);
assert.equal(st.characters[0].int, 777);      // account int moved onto the char
assert.equal(st.characters[0].copper, 5555);  // account copper too
assert.equal(st.characters[0].level, 12);
assert.equal(st.kills.kiln, 8);               // zone rename still applies
assert.equal(st.currentZoneId, "kiln");
assert.equal(st.active, 0);
assert.equal(st.slots, 1);
// round-trip: serialize is v2 and drops legion
const out = serialize(st);
assert.equal(out.v, 2);
assert.equal("legion" in out, false);
assert.equal(out.characters[0].copper, 5555);

console.log("all checks passed");
