// test.js — run with `node test.js`
// Smallest checks that fail if the enhance odds, tier data, or stat stacking break.
import assert from "node:assert/strict";
import { enhanceChance, tryEnhance, tryMerge, avatarChance, tryAvatarEnhance } from "../enhance.js";
import { tierOf, maxPlus, aggregate, getItem, poolFor, CLASS_WEAPON, AVATAR_IDS, AVATAR_SOULS, SPECIAL_IDS, masteryMult, absorbDupes } from "../items.js";
import { activeSkills, matchesSkill, rollOutcome, getClass } from "../classes.js";
import { fmt, bindFormatSettings } from "../format.js";
import { snapshotChar } from "../saveSystem.js";
import { JARS, ZONE_JARS, jarFor, ivMult, potionActive, PROB_POTION_IV } from "../consumables.js";
import { bosses, spawnBossMob, FIRST_KILL_BONUS, firstKillBonuses } from "../bosses.js";
import { spawnField, gridDist, getZone } from "../zones.js";
import { charBonus, legionBonuses, unlockedSlots, MASTERY_INT, CLASS_BONUSES, intTutorMult } from "../legion.js";
import { load, serialize, validSave, importSave } from "../saveSystem.js";
import { classes, skillDamage, classStatBonuses, radiusOf, buffDuration } from "../classes.js";
import { newCharacter, gainXP, agiSpeedPct } from "../player.js";
import { zones, zoneLocked, intDrip } from "../zones.js";
import { ACHIEVEMENTS, ACHIEVEMENT_BONUS, achievementBonus, evalAchievements } from "../achievements.js";

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
    // procs fire by chance OR every-N; payload is dmg (mult/base), a buff, or a borrow
    else if (s.kind === "proc") assert.ok(
      (s.every > 0 || (s.procChance > 0 && s.procChance <= 1))
      && (s.mult > 0 || s.base > 0 || s.buff || s.borrow), s.id);
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
// source: base AGI 1 × AgiAttackSpeedBonus 500 saturates the +400% cap at level 1
assert.equal(agiSpeedPct({ level: 1 }), 400);
assert.equal(agiSpeedPct({ level: 5000 }), 400);
for (const cls of classes) {
  assert.ok(cls.baseCooldownMs >= 500 && cls.baseCooldownMs <= 580, `${cls.id} baseCooldownMs`);
}

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

// per-variant gates (source teleport items): Luke 20x = "100 times" bridge
const spire = zones.find(z => z.id === "spire");
assert.ok(zoneLocked(spire, { level: 5000, int: 300_000 }, 0));           // 1x locked past 250k
assert.equal(zoneLocked(spire, { level: 5000, int: 300_000 }, 2), null);  // 20x open to 510k
assert.ok(zoneLocked(spire, { level: 5000, int: 510_000 }, 2));           // 20x locks at 510k
assert.equal(zoneLocked(spire, { level: 5000, int: 300_000 }), null);     // zone open if any variant is
assert.ok(zoneLocked(warpit, { level: 5000, int: 450_000 }, 2));          // 10x-analog needs 500k
assert.equal(zoneLocked(warpit, { level: 5000, int: 450_000 }, 0), null); // 1x open at 400k
const sorrow = zones.find(z => z.id === "sorrow");
assert.equal(zoneLocked(sorrow, { level: 5000, int: 2.5e6 }, 0), null);   // (Q) opens 2.2M
assert.ok(zoneLocked(sorrow, { level: 5000, int: 2.5e6 }, 1));            // (W 5x) needs 4M
// no INT dead zone anywhere: every INT value has at least one INT-yielding zone
for (let int = 5_000; int <= 20e6; int = Math.round(int * 1.05)) {
  const p = { level: 5000, int };
  const ok = zones.some(z => intDrip(z, p) > 0 &&
    [0, 1, 2].some(v => !zoneLocked(z, p, v)));
  assert.ok(ok, `INT dead zone at ${int}`);
}
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

// merge: 2×(+n) → +(n+1), no pair → no-op, +6 → max
const mbag = [
  { itemId: "talisman", plus: 0 }, { itemId: "talisman", plus: 0 },
  { itemId: "talisman", plus: 1 }, { itemId: "insignia", plus: 6 },
];
assert.equal(tryMerge(mbag, 0, tal), "merged");
assert.equal(mbag.length, 3);
assert.equal(mbag[0].plus, 1);
assert.equal(tryMerge(mbag, 0, tal), "merged");        // the two +1s pair up
assert.deepEqual(mbag.map(e => e.plus), [2, 6]);
assert.equal(tryMerge(mbag, 0, tal), "no-pair");
assert.equal(tryMerge(mbag, 1, getItem("insignia")), "max");
assert.equal(mbag.length, 2);                          // no-op paths mutate nothing

// special bag rules: aura contributes DEF only from the bag; insignia keeps all
const bagged = aggregate([], [{ itemId: "luke_def", plus: 0 }, { itemId: "insignia", plus: 0 }]);
assert.equal(bagged.defReduce, 8);
const ins0 = tierOf(getItem("insignia"), 0);
assert.equal(bagged.atk, ins0.atk);                    // luke_def atk suppressed
assert.equal(bagged.int, ins0.int);
assert.equal(bagged.addDmgPct, ins0.addDmg);

// migration: specials equipped in weapon slots / stash sweep into specialBag
localStorage.setItem("esrpg_save", JSON.stringify({
  v: 3, characters: [{
    classId: "striker", level: 1,
    equipment: [{ itemId: "luke_def", plus: 12 }, { itemId: "rafaros", plus: 3 }, null, null, null, null],
    stash: [{ itemId: "talisman", plus: 4 }, { itemId: "luke_dmg", plus: 2 }],
  }], active: 0, slots: 1,
}));
const st3 = { characters: [], active: 0, slots: 1, kills: {}, fieldKills: {}, macro: {}, gathering: {}, settings: { fullNumbers: false } };
load(st3);
const mc = st3.characters[0];
assert.equal(mc.equipment[0], null);
assert.equal(mc.equipment[1].itemId, "rafaros");
assert.deepEqual(mc.stash.map(e => e.itemId), ["luke_dmg"]);
assert.deepEqual(mc.specialBag.map(e => [e.itemId, e.plus]), [["luke_def", 12], ["talisman", 4]]); // plus preserved
assert.equal(serialize(st3).characters[0].specialBag.length, 2); // persists

// enhanced skills: 3 per class (abyss/trans/awaken), schema + uniqueness
for (const cls of classes) {
  assert.equal(cls.enhanced?.length, 3, `${cls.id} enhanced count`);
  assert.deepEqual(cls.enhanced.map(e => e.tier), ["abyss", "trans", "awaken"], cls.id);
  for (const e of cls.enhanced) {
    assert.ok(!allSkillIds.has(e.id), `duplicate enhanced id ${e.id}`);
    allSkillIds.add(e.id);
    if (e.tier === "awaken") {
      assert.equal(e.key, "M", e.id);
      assert.equal(e.cooldownMs, 300_000, `${e.id} awaken CD`);
      assert.ok(!e.replaces, e.id);
    } else {
      assert.ok(cls.skills.some(s => s.id === e.replaces), `${e.id} replaces unknown ${e.replaces}`);
    }
    assert.ok(e.kind === "cast" || e.kind === "proc", e.id);
    if (e.kind === "proc" && !e.every) assert.ok(e.procChance > 0, e.id);
  }
}

// activeSkills: swaps learned replacements in-slot, appends learned M
const ovm = classes.find(c => c.id === "overmind");
assert.equal(activeSkills(ovm, { lanternfire: 3 })[0].id, "lanternfire");   // base
assert.equal(activeSkills(ovm, { holloween: 1 })[0].id, "holloween");       // evolved (own level)
assert.equal(activeSkills(ovm, { holloween: 1 }).length, 7);
const withM = activeSkills(ovm, { cosmiccalamity: 2 });
assert.equal(withM.length, 8);
assert.equal(withM[7].key, "M");
// nenempress trans replaces E (lionroar), not W
const nen = classes.find(c => c.id === "nenempress");
assert.equal(activeSkills(nen, { grandroar: 1 })[2].id, "grandroar");
assert.equal(activeSkills(nen, { grandroar: 1 })[1].id, "doppel");

// skillDamage: intRatioMult scales only the INT term
assert.equal(skillDamage({ base: 100, mult: 10 }, 2, 1000, 1, 1.5), 2 * (100 + 1000 * 10 * 1.5));

// class-weapon meta-modifiers fold through aggregate (bagged)
const gWeap = aggregate([], [{ itemId: "bernardo_staff", plus: 20 }, { itemId: "bernardo_ring", plus: 20 }]);
assert.equal(gWeap.cooldownPct, 22);
assert.equal(gWeap.procRatePct, 30);
assert.equal(aggregate([], [{ itemId: "bernardo_gswords", plus: 20 }]).intRatioPct, 38);
assert.equal(aggregate([], [{ itemId: "bernardo_knuckle", plus: 20 }]).clones, 3);
const gAv = aggregate([], [{ itemId: "seria_cloneav", plus: 20 }, { itemId: "lib_cloneav", plus: 0 }]);
assert.equal(gAv.magicCrit.pct, 450); // best-only: 10%×450 beats 10%×30
// defReduce NECKLACE in the bag keeps its atk/int (aura rule is luke_def-only)
const gNeck = aggregate([], [{ itemId: "bernardo_neck", plus: 20 }]);
assert.equal(gNeck.defReduce, 65);
assert.equal(gNeck.atk, 655000);
// every class has a weapon and all pool ids resolve
for (const cls of classes) assert.ok(getItem(CLASS_WEAPON[cls.id]), `${cls.id} class weapon`);
for (const bid of ["bernardo", "bernardo2", "seria", "librarykeeper", "trialgiver"]) {
  const b = bosses.find(x => x.id === bid);
  for (const pid of b.drops.pool) {
    if (pid !== "classWeapon") assert.ok(getItem(pid), `${bid} pool ${pid}`);
    assert.ok(pid === "classWeapon" || SPECIAL_IDS.has(pid), `${bid} ${pid} routes to bag`);
  }
  if (b.drops.ticket) assert.ok(["abyss", "trans", "awaken"].includes(b.drops.ticket.tier));
  if (b.drops.souls) assert.ok(["old", "brilliant"].includes(b.drops.souls.kind));
}

// avatar enhance: bands + soul/copper costs
assert.equal(avatarChance(0), 1);
assert.equal(avatarChance(4), 0.24);
assert.equal(avatarChance(7), 0.09);
assert.equal(avatarChance(11), 0.012);
assert.equal(avatarChance(16), 0.003);
const avDef = getItem("seria_weaponav");
let avState = { copper: avDef.enhCost * 2, souls: { old: 4, brilliant: 0 } };
let avEq = { itemId: "seria_weaponav", plus: 0 };
assert.equal(tryAvatarEnhance(avState, avEq, avDef, "old", 2, () => 0).result, "success");
assert.equal(avEq.plus, 1);
assert.equal(avState.souls.old, 2);
assert.equal(avState.copper, avDef.enhCost);
assert.equal(tryAvatarEnhance({ copper: 1e30, souls: { old: 1 } }, avEq, avDef, "old", 2).result, "nosouls");
assert.equal(tryAvatarEnhance({ copper: 0, souls: { old: 9 } }, avEq, avDef, "old", 2).result, "poor");

// save round-trip: souls persist, enhanced skill levels survive normalizeChar
localStorage.setItem("esrpg_save", JSON.stringify({
  v: 3, characters: [{
    classId: "overmind", level: 1, skills: { lanternfire: 3, holloween: 2, cosmiccalamity: 1 },
    souls: { old: 5, brilliant: 1 },
    specialBag: [{ itemId: "bernardo_staff", plus: 4 }],
  }], active: 0, slots: 1,
}));
const st4 = { characters: [], active: 0, slots: 1, kills: {}, fieldKills: {}, macro: {}, gathering: {}, settings: { fullNumbers: false } };
load(st4);
assert.deepEqual(st4.characters[0].souls, { old: 5, brilliant: 1 });
assert.equal(st4.characters[0].skills.holloween, 2);
assert.equal(st4.characters[0].specialBag[0].itemId, "bernardo_staff");
assert.deepEqual(serialize(st4).characters[0].souls, { old: 5, brilliant: 1 });

// jars: yields are bag-routed items, zone table sane
for (const [id, jar] of Object.entries(JARS)) {
  assert.ok(SPECIAL_IDS.has(jar.yields), `${id} yields routes to bag`);
  assert.ok(jar.openChance > 0 && jar.openChance < 1, id);
}
for (const [zid, variants] of Object.entries(ZONE_JARS)) {
  assert.ok(zones.find(z => z.id === zid), `unknown zone ${zid}`);
  for (const v of variants) if (v) assert.ok(JARS[v[0]] && v[1] > 0 && v[1] < 1, `${zid} ${v}`);
}
assert.equal(jarFor("prism", 2)[1], 0.0544);
assert.equal(jarFor("aurum", 2), null);     // no source rate — no jar
assert.equal(jarFor("kiln", 0), null);

// potions: expiry + IV multiplier
assert.equal(potionActive({ potionUntil: { prob: 100 } }, "prob", 99), true);
assert.equal(potionActive({ potionUntil: { prob: 100 } }, "prob", 100), false);
assert.equal(ivMult({ potionUntil: { prob: 100 } }, 50), 1 + PROB_POTION_IV);
assert.equal(ivMult({ potionUntil: { prob: 0 } }, 50), 1);

// confirmation ticket: forces success, consumes only itself, copper still paid;
// IV mult scales bands and caps at 1
const tDef = getItem("rafaros");
let tState = { copper: 1e9 };
let tEq = { itemId: "rafaros", plus: 16 }; // 0.45% band
let tBuffs = { doubleChance: 1, freeAttempts: 0, okTickets: 1 };
let r = tryEnhance(tState, tEq, tDef, () => 0.999, tBuffs);
assert.equal(r.result, "success");
assert.equal(r.chance, 1);
assert.equal(tEq.plus, 17);
assert.equal(tBuffs.okTickets, 0);
assert.equal(tBuffs.doubleChance, 1);           // untouched — ticket wins
assert.equal(tState.copper, 1e9 - tDef.enhCost); // copper still paid
assert.equal(tryEnhance({ copper: 0 }, { itemId: "rafaros", plus: 5 }, tDef, Math.random, { okTickets: 1 }).result, "poor");
assert.equal(tryEnhance({ copper: 0 }, { itemId: "rafaros", plus: 5 }, tDef, Math.random, { okTickets: 1 }).result, "poor"); // guard didn't consume
r = tryEnhance({ copper: 1e9 }, { itemId: "rafaros", plus: 11 }, tDef, () => 0.9, null, 1.25);
assert.equal(r.chance, 0.018 * 1.25);            // IV scales the band
r = tryEnhance({ copper: 1e9 }, { itemId: "rafaros", plus: 0 }, tDef, () => 0.9, null, 1.25);
assert.equal(r.chance, 1);                        // guaranteed band caps at 1
// avatar path honors ticket + mult too
const avDef2 = getItem("seria_weaponav");
let avB = { okTickets: 1 };
r = tryAvatarEnhance({ copper: 1e30, souls: { old: 9 } }, { itemId: "seria_weaponav", plus: 16 }, avDef2, "old", 2, () => 0.999, avB);
assert.equal(r.result, "success");
assert.equal(avB.okTickets, 0);
r = tryAvatarEnhance({ copper: 1e30, souls: { old: 9 } }, { itemId: "seria_weaponav", plus: 4 }, avDef2, "old", 2, () => 0.9, null, 1.25);
assert.equal(r.chance, 0.24 * 1.25);

// save round-trip: float jars, potions, potionUntil; old gathering buffs get okTickets
localStorage.setItem("esrpg_save", JSON.stringify({
  v: 3, characters: [{
    classId: "striker", level: 1,
    jars: { sirocco: 2.75 }, potions: { int: 1 }, potionUntil: { prob: 12345 },
  }], active: 0, slots: 1,
  gathering: { buffs: { doubleChance: 3, freeAttempts: 1 } },
}));
const st5 = { characters: [], active: 0, slots: 1, kills: {}, fieldKills: {}, macro: {}, gathering: { buffs: { doubleChance: 0, freeAttempts: 0, okTickets: 0 } }, settings: { fullNumbers: false } };
load(st5);
assert.equal(st5.characters[0].jars.sirocco, 2.75);
assert.deepEqual(st5.characters[0].potions, { int: 1, prob: 0, elixir: 0 });
assert.deepEqual(st5.characters[0].potionUntil, { int: 0, prob: 12345, elixir: 0 });
assert.deepEqual(st5.gathering.buffs, { doubleChance: 3, freeAttempts: 1, okTickets: 0 });
assert.equal(serialize(st5).characters[0].jars.sirocco, 2.75);

// decoupling round: buff targets declared on data, no dead keys, generic matcher
const drev = classes.find(c => c.id === "desperado").skills.find(s => s.id === "deathrev");
assert.deepEqual(drev.buff.procBoost, { target: "revolver", mult: 3 });
const mir = classes.find(c => c.id === "stormtrooper").skills.find(s => s.id === "miracle");
assert.deepEqual(mir.buff.procRider, { target: "heavymastery", base: 0, mult: 550 });
for (const cls of classes) for (const s of [...cls.skills, ...cls.enhanced]) {
  assert.ok(!s.buff?.revolverMult && !s.buff?.masteryRider, `${s.id} dead buff key`);
}
assert.ok(matchesSkill({ id: "revolver" }, "revolver"));
assert.ok(matchesSkill({ id: "heavymasteryx", replaces: "heavymastery" }, "heavymastery"));
assert.ok(!matchesSkill({ id: "lowkick" }, "revolver"));
// procRider is skillDamage-shaped: lvl × (base + INT×mult)
assert.equal(skillDamage(mir.buff.procRider, 2, 1000, 1), 2 * 1000 * 550);

// snapshotChar: strips ONLY the transient; every factory field persists
const snapC = snapshotChar({ ...newCharacter(), lastAttack: 123 });
assert.ok(!("lastAttack" in snapC));
for (const k of Object.keys(newCharacter())) {
  if (k !== "lastAttack") assert.ok(k in snapC, `snapshot lost ${k}`);
}

// normalizeChar: a minimal char round-trips with full factory defaults
localStorage.setItem("esrpg_save", JSON.stringify({
  v: 3, characters: [{ classId: "indra", level: 9, souls: { old: 5 } }], active: 0, slots: 1,
}));
const st6 = { characters: [], active: 0, slots: 1, kills: {}, fieldKills: {}, macro: {}, gathering: { buffs: {} }, settings: { fullNumbers: false } };
load(st6);
const minC = st6.characters[0];
assert.equal(minC.level, 9);
assert.deepEqual(minC.equipment, [null, null, null, null, null, null]);
assert.deepEqual(minC.souls, { old: 5, brilliant: 0 }); // partial nested keeps new sub-fields
assert.deepEqual(minC.potions, { int: 0, prob: 0, elixir: 0 });
assert.equal(minC.xpToNext, 150);

// avatar soul map covers every avatar id
for (const id of AVATAR_IDS) assert.ok(AVATAR_SOULS[id], `no soul cost for ${id}`);

// fmt respects the injected settings getter
const fakeSettings = { fullNumbers: false };
bindFormatSettings(() => fakeSettings);
assert.equal(fmt(1_234_567), "1.23M");
fakeSettings.fullNumbers = true;
assert.equal(fmt(1_234_567), "1,234,567");
fakeSettings.fullNumbers = false;

// batch-2 mechanics
// outcome roll: GS < 0.1, S < 0.6, F < 0.9, miss above; gsMult widens jackpot
const gwQ = getClass("geniewiz").skills[0];
assert.equal(rollOutcome(gwQ.outcomes, 1, () => 0.05).tag, "GS");
assert.equal(rollOutcome(gwQ.outcomes, 1, () => 0.3).tag, "S");
assert.equal(rollOutcome(gwQ.outcomes, 1, () => 0.7).tag, "F");
assert.equal(rollOutcome(gwQ.outcomes, 1, () => 0.95), null);
assert.equal(rollOutcome(gwQ.outcomes, 2, () => 0.15).tag, "GS"); // Brush weapon doubles GS
// Dark Knight borrow tiers resolve into all three source classes
for (const s of getClass("darkknight").skills) {
  if (!s.borrow) continue;
  for (const src of ["bloodevil", "indra", "omniblade"]) {
    assert.ok(getClass(src).skills[s.borrow.tier], `${s.id} tier ${s.borrow.tier} in ${src}`);
  }
}
for (const e of getClass("darkknight").enhanced) {
  if (e.borrow) for (const src of ["bloodevil", "indra", "omniblade"]) {
    assert.ok(getClass(src).enhanced[e.borrow.enhanced], `${e.id} enhanced ${e.borrow.enhanced} in ${src}`);
  }
}
// spheres/stance/charges/stacks data shapes
const dv = getClass("divineress");
assert.deepEqual(dv.spheres, { perAttack: 14, max: 50 });
assert.equal(dv.skills.find(s => s.id === "powerorb").sphereCost, 3);
assert.equal(dv.enhanced.find(e => e.id === "holycomet").sphereCost, "all");
const nec = getClass("necromancer");
assert.equal(nec.skills.find(s => s.id === "phantomstorm").requiresBuff, "vallacre");
assert.ok(nec.skills.some(s => s.id === "vallacre" && s.buff));
assert.equal(getClass("majesty").skills.find(s => s.id === "elemshift").buff.charges, 20);
assert.equal(getClass("majesty").skills.find(s => s.id === "imperial").stacksTo, 40);
assert.ok(getClass("crusader").skills.every(s => s.autocast));
// new gear folds through aggregate
assert.equal(aggregate([], [{ itemId: "bernardo_brush", plus: 20 }]).gsRatePct, 22);
assert.equal(aggregate([], [{ itemId: "bernardo_brushs", plus: 20 }]).buffValuePct, 32);
assert.equal(aggregate([], [{ itemId: "bernardo_blade", plus: 20 }]).skillSpdPct, 33);
assert.equal(aggregate([{ itemId: "fusion_garb", plus: 20 }]).dmgIncPct, 13000);
// Formless Sirocco: pool resolves, elite fields sane
const fs = bosses.find(b => b.id === "abyssirocco");
assert.ok(fs && fs.eliteChance === 0.2 && fs.eliteDropMult === 3);
assert.equal(poolFor("abyssirocco").length, 5);

// item mastery: milestone mult + aggregate wiring (default arg = zero drift)
{
  assert.equal(masteryMult(0), 1);
  assert.equal(masteryMult(1), 1.02);
  assert.equal(masteryMult(10), 1.04);
  assert.equal(masteryMult(999), 1.06);
  assert.equal(masteryMult(1000), 1.08);
  const eqp = [{ itemId: "luke_dmg", plus: 20 }];
  const plain = aggregate(eqp);
  const mastered = aggregate(eqp, [], { luke_dmg: 10 });
  assert.equal(mastered.atk, Math.round(plain.atk * 1.04));
  assert.equal(mastered.int, Math.round(tierOf(getItem("luke_dmg"), 20).int * 1.04));
  assert.deepEqual(aggregate(eqp, [], {}), plain); // no mastery = identical
}

// Elixir of Strength: +60% IV, additive with prob potion, backfilled on load
{
  const c = { potionUntil: { elixir: 1000 } };
  assert.equal(ivMult(c, 500), 1.6);
  assert.equal(ivMult(c, 1500), 1);
  const both = { potionUntil: { prob: 1000, elixir: 1000 } };
  assert.equal(Math.round(ivMult(both, 500) * 100), 185);
  // special bosses carry the elixir drop field
  for (const id of ["bernardo", "bernardo2", "seria", "librarykeeper", "trialgiver"])
    assert.equal(bosses.find(b => b.id === id).drops.elixir, 0.02);
}

// first-kill trophies: every table id is a real boss, every boss has a trophy
{
  const ids = new Set(bosses.map(b => b.id));
  for (const id in FIRST_KILL_BONUS) assert.ok(ids.has(id), `unknown boss ${id}`);
  for (const b of bosses) assert.ok(FIRST_KILL_BONUS[b.id], `no trophy for ${b.id}`);
  assert.deepEqual(firstKillBonuses({}), { dmg: 0, enh: 0, drop: 0 });
  const some = firstKillBonuses({ hellparty: 5, anton: 1, bernardo: 1, kiln: 99 });
  assert.equal(some.dmg, 0.005);
  assert.equal(some.drop, 0.01);
  assert.equal(some.enh, 0.02);
}

// achievements: none on empty state, fire on synthetic, bonus math, no re-earn
{
  const empty = { achievements: {}, kills: {}, fieldKills: {}, characters: [], gathering: { level: { mining: 1, fishing: 1 } } };
  assert.equal(evalAchievements(empty).length, 0);
  assert.equal(achievementBonus(empty), 0);
  const rich = {
    achievements: {}, kills: { kiln: 600, hellparty: 1 }, fieldKills: { kiln: 400 },
    characters: [
      { int: 1_000_000, level: 100, copper: 1e9, equipment: [{ itemId: "rafaros", plus: 20 }], stash: [], specialBag: [{ itemId: "talisman", plus: 1 }], mastery: { rafaros: 3 } },
      { int: 0, level: 1, copper: 0, equipment: [], stash: [], specialBag: [], mastery: {} },
    ],
    gathering: { level: { mining: 10, fishing: 10 } },
  };
  const earned = evalAchievements(rich);
  const ids = earned.map(a => a.id).sort();
  assert.deepEqual(ids, ["bossfirst", "fieldboss", "gather10", "int100k", "int1m", "kills1k", "lvl100", "mastery1", "merged", "plus10", "plus15", "plus20", "roster2", "silver"]);
  assert.equal(achievementBonus(rich), ids.length * ACHIEVEMENT_BONUS);
  assert.equal(evalAchievements(rich).length, 0); // already earned — no repeats
}

// absorbDupes: best copy per item survives, rest become mastery at 1+plus
{
  const stash = [
    { itemId: "luke_dmg", plus: 3 }, { itemId: "luke_dmg", plus: 20 }, { itemId: "luke_dmg", plus: 0 },
    { itemId: "rafaros", plus: 5 },
  ];
  const mastery = { luke_dmg: 2 };
  assert.equal(absorbDupes(stash, mastery), 2);
  assert.deepEqual(stash.map(e => `${e.itemId}+${e.plus}`).sort(), ["luke_dmg+20", "rafaros+5"]);
  assert.equal(mastery.luke_dmg, 2 + (1 + 3) + (1 + 0)); // existing + two absorbed
  assert.equal(absorbDupes(stash, mastery), 0); // idempotent
}

// INT-era speedups: boss INT bounties on the 5 specials, legion tutoring
{
  const expected = { bernardo: 1500, bernardo2: 7500, seria: 20000, librarykeeper: 75000, trialgiver: 200000 };
  for (const [id, amt] of Object.entries(expected))
    assert.equal(bosses.find(b => b.id === id).drops.intBounty, amt);
  assert.equal(intTutorMult({ active: 0, characters: [{ int: 5e5 }] }), 1);            // solo
  assert.equal(intTutorMult({ active: 0, characters: [{ int: 5e5 }, { int: 2000 }] }), 1.1);  // 1 benched past gate
  assert.equal(intTutorMult({ active: 0, characters: [{ int: 5e5 }, { int: 500 }] }), 1);     // benched below gate
  assert.equal(intTutorMult({ active: 1, characters: [{ int: 5e5 }, { int: 2000 }] }), 1.1);  // active char never counts itself
}

// save durability: validSave gate, corrupt primary preserved + backup restored
{
  assert.equal(validSave(null), false);
  assert.equal(validSave("nope"), false);
  assert.equal(validSave({ v: 2 }), false);
  assert.equal(validSave({ v: 3 }), true);
  const good = JSON.stringify({ v: 3, characters: [{ classId: "indra", level: 4 }], active: 0, slots: 1 });
  localStorage.setItem("esrpg_save", good);
  const stA = { characters: [], active: 0, slots: 1, kills: {}, fieldKills: {}, macro: {}, gathering: { buffs: {} }, settings: { fullNumbers: false } };
  assert.ok(load(stA));
  assert.equal(localStorage.getItem("esrpg_save_bak"), good); // last-known-good written
  localStorage.setItem("esrpg_save", "{corrupt garbage");
  const stB = { characters: [], active: 0, slots: 1, kills: {}, fieldKills: {}, macro: {}, gathering: { buffs: {} }, settings: { fullNumbers: false } };
  assert.ok(load(stB)); // falls back to _bak
  assert.equal(stB.characters[0].level, 4);
  assert.equal(localStorage.getItem("esrpg_save_corrupt"), "{corrupt garbage"); // rescue copy kept
  assert.equal(importSave("{also garbage"), false);
  assert.equal(importSave(good), true);
}

console.log("all checks passed");
