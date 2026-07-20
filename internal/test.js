// test.js — run with `node test.js`
// Smallest checks that fail if the enhance odds, tier data, or stat stacking break.
import assert from "node:assert/strict";
import { enhanceChance, tryEnhance } from "../enhance.js";
import { tierOf, maxPlus, aggregate, getItem, poolFor } from "../items.js";
import { bosses, spawnBossMob } from "../bosses.js";
import { spawnField, gridDist, getZone } from "../zones.js";
import { charBonus, legionBonuses, unlockedSlots, MASTERY_INT, CLASS_BONUSES } from "../legion.js";
import { load, serialize } from "../saveSystem.js";
import { classes, skillDamage, classStatBonuses, radiusOf, buffDuration } from "../classes.js";
import { newCharacter, gainXP, agiSpeedPct } from "../player.js";
import { zones, zoneLocked, intDrip } from "../zones.js";

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

// tier tables: w3t-exact endpoints (Rosetta = the canonical scaling item)
const rosetta = getItem("luke_dmg");
assert.equal(rosetta.name, "Rosetta Stone");
assert.deepEqual(tierOf(rosetta, 0), { atk: 120, int: 40, dmgInc: 80 });
assert.deepEqual(tierOf(rosetta, 20), { atk: 3156, int: 6600, dmgInc: 2000 });
assert.equal(maxPlus(rosetta), 20);
const raf = getItem("rafaros");
assert.equal(tierOf(raf, 0).atk, 1);
assert.equal(tierOf(raf, 20).atk, 500);
const tal = getItem("talisman");
assert.equal(maxPlus(tal), 6);
assert.equal(tierOf(tal, 0).skillLevels, 1);
assert.equal(tierOf(tal, 6).skillLevels, 7);

// aggregation: atk stacks, atkspd takes best only, effects SCALE with plus
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

const low = aggregate([{ itemId: "luke_dmg", plus: 0 }]);
const high = aggregate([{ itemId: "luke_dmg", plus: 20 }]);
assert.equal(low.dmgIncPct, 80);
assert.equal(high.dmgIncPct, 2000); // the user-reported bug: Rosetta now scales

// effect folding across kinds: crit best-only, addDmg best-only, procs stack
const fx = aggregate([
  { itemId: "hellparty_crit", plus: 20 },   // 25% ×37.15
  { itemId: "abysswalker_crit", plus: 20 }, // 45% ×36500 (better -> wins)
  { itemId: "hellparty_proc", plus: 20 },
  { itemId: "luke_proc", plus: 20 },
  { itemId: "anton_add", plus: 20 },        // addDmg 120 / skillDmg 265
  { itemId: "luke_add", plus: 20 },         // addDmg 175 / skillDmg 330
]);
assert.equal(fx.crit.mult, 36500);
assert.equal(fx.intProcs.length, 2);
assert.equal(fx.addDmgPct, 175);            // best only
assert.equal(fx.skillDmgPct, 265 + 330);    // stacks
const intp = aggregate([{ itemId: "taibers_intp", plus: 20 }, { itemId: "luke_dmg", plus: 20 }]);
assert.equal(intp.int, Math.round((tierOf(getItem("taibers_intp"), 20).int + 6600) * 1.5)); // +50% item INT

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

// guards: poor, equipment cap +20, talisman cap +6
assert.equal(tryEnhance({ copper: 0 }, { itemId: "rafaros", plus: 5 }, def).result, "poor");
assert.equal(tryEnhance({ copper: 1e18 }, { itemId: "rafaros", plus: 20 }, def).result, "max");
assert.equal(tryEnhance({ copper: 1e18 }, { itemId: "talisman", plus: 6 }, tal).result, "max");

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

// class schema: 7 skills per class in slots Q..D, valid kinds, unique ids
const KEYS = ["Q", "W", "E", "R", "T", "F", "D"];
const allSkillIds = new Set();
for (const cls of classes) {
  assert.equal(cls.skills.length, 7, `${cls.id} skill count`);
  assert.ok(CLASS_BONUSES[cls.id], `${cls.id} legion row`);
  cls.skills.forEach((s, i) => {
    assert.ok(!allSkillIds.has(s.id), `duplicate skill id ${s.id}`);
    allSkillIds.add(s.id);
    assert.equal(s.key, KEYS[i], `${s.id} slot key`);
    if (s.kind === "cast") assert.ok(s.cooldownMs > 0 && s.mult >= 0, s.id);
    else if (s.kind === "proc") assert.ok(s.procChance > 0 && s.procChance <= 1 && (s.mult > 0 || s.buff), s.id);
    else if (s.kind === "stat") assert.ok(s.atkSpdPct || s.atkPctPerLevel, s.id);
    else assert.fail(`${s.id} unknown kind ${s.kind}`);
    if (s.aoe) assert.ok(s.radius > 0 || s.rangeBase > 0, s.id);
  });
}

// source skill formula: level × (base + INT × mult) × skillDmgMult
const soaring = classes.find(c => c.id === "vagabond").skills[0];
assert.equal(skillDamage(soaring, 3, 1000, 1), 3 * (200 + 1000 * 200));
assert.equal(skillDamage(soaring, 1, 0, 2), 400); // base only, ×2 skill dmg
// Omniblade's Lightsword Mastery: +70% attack power per level
const omni = classes.find(c => c.id === "omniblade");
assert.equal(classStatBonuses(omni, { lightsword: 2 }).atkPct, 140);
assert.equal(classStatBonuses(omni, { lightsword: 2 }, 1).atkPct, 210); // talisman levels count
// Striker's gloves: flat +50% attack speed
const striker = classes.find(c => c.id === "striker");
assert.equal(classStatBonuses(striker, { gloves: 1 }).atkSpdPct, 50);

// level growth (w3u): INT +1/level, XP next = 150×level, AGI speed cap +400%
const ch = newCharacter();
gainXP(ch, 150);
assert.equal(ch.level, 2);
assert.equal(ch.int, 1);
assert.equal(ch.xpToNext, 300);
assert.equal(agiSpeedPct({ level: 1 }), 0);
assert.equal(agiSpeedPct({ level: 5 }), 200);
assert.equal(agiSpeedPct({ level: 100 }), 400); // capped

// armor auras stack; Lumen Basilium carries defReduce tiers
const lum = aggregate([{ itemId: "luke_def", plus: 20 }, { itemId: "luke_def", plus: 0 }]);
assert.equal(lum.defReduce, 46 + 8);
// Boxing Gloves strip: −(level+1)
const strikerCls = classes.find(c => c.id === "striker");
assert.equal(classStatBonuses(strikerCls, { gloves: 3 }).armorReduce, 4);

// buff plumbing: durations + rider math shapes
const powerfist = strikerCls.skills.find(s => s.id === "powerfist");
assert.equal(buffDuration(powerfist, 2), 30_000);
const deathrev = classes.find(c => c.id === "desperado").skills.find(s => s.id === "deathrev");
assert.equal(buffDuration(deathrev, 5), 28_000 + 5 * 2_000);
// rider damage shape: lvl × (base + INT×mult) — Power Fist at lvl 2, INT 1000
assert.equal(2 * (powerfist.buff.autoRider.base + 1000 * powerfist.buff.autoRider.mult), 2_400_000);
// ST mastery radius grows with level; 800-band under Miracle Vision
const mastery = classes.find(c => c.id === "stormtrooper").skills.find(s => s.id === "heavymastery");
assert.equal(radiusOf(mastery, 1), 1);        // range 400
assert.equal(radiusOf(mastery, 5), 1.5);      // range 600
assert.equal(radiusOf(mastery, 1, true), 1.5); // Miracle: 800
// armor debuffs declared where the source has them
assert.ok(classes.find(c => c.id === "omniblade").skills.find(s => s.id === "ironstrike").armorDebuff.perLevel === 6);

// zone gates: entry reqs, lockouts, INT drip caps — one shared gate function
const kiln = zones.find(z => z.id === "kiln");
assert.equal(zoneLocked(kiln, { level: 50, int: 0 }), null);
assert.ok(zoneLocked(kiln, { level: 101, int: 0 }));            // No Entry after level 100
assert.ok(zoneLocked(zones.find(z => z.id === "slag"), { level: 1, int: 1_000 }));  // INT lockout
assert.ok(zoneLocked(zones.find(z => z.id === "rift"), { level: 69, int: 0 }));     // level req
assert.equal(zoneLocked(zones.find(z => z.id === "rift"), { level: 70, int: 0 }), null);
assert.ok(zoneLocked(zones.find(z => z.id === "aurum"), { level: 5000, int: 1e6 })); // INT req
const warpit = zones.find(z => z.id === "warpit");
assert.equal(intDrip(warpit, { int: 1e6 }), warpit.intPerKill);
assert.equal(intDrip(warpit, { int: 2e6 }), 0);                 // No INT after 2M
assert.equal(kiln.name, "Fallen Temple");                       // source names

// boss schema: sane numbers, resolvable pools/rares, regen math, ticket ladder
const bossIds = new Set();
for (const b of bosses) {
  assert.ok(!bossIds.has(b.id), `dup boss id ${b.id}`);
  bossIds.add(b.id);
  assert.ok(b.hp > 0 && b.defense >= 0, b.id);
  const r = b.regenPct ?? 0.005;
  assert.ok(r >= 0 && r <= 1, `${b.id} regenPct`);
  assert.ok(b.drops && b.drops.bounty > 0, `${b.id} drops`);
  if (b.drops.itemChance > 0) assert.ok(poolFor(b.id).length > 0, `${b.id} empty pool`);
  if (b.drops.rare) {
    const pool = b.drops.rare.pool ? poolFor(b.drops.rare.pool) : [b.drops.rare.itemId];
    assert.ok(pool.length && pool.every(id => getItem(id)), `${b.id} rare`);
  }
}
// source ticket ladder: Q W E R T F D
const ticketOf = id => bosses.find(b => b.id === id).skillIndex;
assert.deepEqual(
  ["hellparty", "anton", "luke", "harlem", "taibers", "fiendwar", "prey"].map(ticketOf),
  [0, 1, 2, 3, 4, 5, 6]);
const wall = spawnBossMob(bosses.find(b => b.id === "prey"));
assert.equal(wall.regen, wall.maxHp); // 100%/s wall: full heal per second

// save gate: v<3 discarded (source-fidelity wipe), v3 round-trips
globalThis.localStorage = {
  store: {},
  getItem(k) { return this.store[k] ?? null; },
  setItem(k, v) { this.store[k] = v; },
  removeItem(k) { delete this.store[k]; },
};
localStorage.setItem("esrpg_save", JSON.stringify({
  v: 2, characters: [{ classId: "striker", level: 12 }], active: 0, slots: 1,
}));
const st = { characters: [], active: 0, slots: 1, kills: {}, fieldKills: {}, macro: {}, gathering: {}, settings: { fullNumbers: false } };
assert.equal(load(st), null);          // old save rejected
assert.equal(st.characters.length, 0); // state untouched → fresh start

// v3: loads, quarantines unknown item ids, round-trips
localStorage.setItem("esrpg_save", JSON.stringify({
  v: 3, characters: [{
    classId: "striker", level: 7, int: 42, copper: 5555,
    equipment: [{ itemId: "rafaros", plus: 3 }, { itemId: "from_the_future", plus: 9 }, null, null, null, null],
    stash: [{ itemId: "also_unknown", plus: 0 }, { itemId: "luke_dmg", plus: 2 }],
  }], active: 0, slots: 1,
}));
const st2 = { characters: [], active: 0, slots: 1, kills: {}, fieldKills: {}, macro: {}, gathering: {}, settings: { fullNumbers: false } };
load(st2);
assert.equal(st2.characters[0].equipment[0].itemId, "rafaros"); // known survives
assert.equal(st2.characters[0].equipment[1], null);             // unknown -> empty slot
assert.deepEqual(st2.characters[0].stash.map(e => e.itemId), ["luke_dmg"]);
assert.doesNotThrow(() => aggregate(st2.characters[0].equipment));
const out = serialize(st2);
assert.equal(out.v, 3);
assert.equal(out.characters[0].copper, 5555);

console.log("all checks passed");
