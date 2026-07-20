// items.js
// Item definitions + aggregation, on the decompiled per-tier data.
//
// Every item carries `tiers[plus]` — the VERBATIM source ramp (+0..+20 for
// equipment, +0..+6 for talismans/insignia) from war3map.w3t. A tier holds:
//   atk, int              flat stats
//   dmgInc                +% "Increase attack power by N%" — stacks
//   addDmg, skillDmg      "Additional/Skill damage" — addDmg is BEST-ONLY
//                         (source: "Only 1 additional damage items are applied")
//   procChance, procMult  N% chance per auto to deal mult×INT bonus damage
//   critChance, critMult  crit on autos — best item only
//   intPct                +% to total item-granted INT
//   spdPct                attack speed % — best only (source non-stacking)
//   skillLevels           talismans: +N effective skill levels
import { ITEM_DATA } from "./itemdata.js";

const S = 1e9, G = 1e18; // silver / gold in copper

// per-boss enhance cost (wiki "Enhance x1", copper)
const ENH_COST = {
  hellparty: 18_000, anton: 90_000, luke: 300_000, harlem: 9e6, taibers: 150e6,
  fiendwar: 1 * S, prey: 12 * S, hyunfindwar: 108 * S, transfrey: 720 * S,
  baekhwa: 2_700 * S, ezra: 15_300 * S, ezraabyss: 47_700 * S,
  sirocco: 135_000 * S, astaroth: 1.98e6 * S, astaroth2: 7.65e6 * S,
  tiamat: 36e6 * S, berias: 171e6 * S, ozma: 684e6 * S,
  queendestroyer: 2 * G, abysswalker: 10 * G, spirazzi: 40 * G,
  skasa: 160 * G, hisma: 640 * G,
  luton: 320 * G, // ponytail: not on wiki — interpolated skasa..hisma
};

// shop metadata (source shop staples; ramps are w3t-exact)
const SHOP = {
  rafaros:    { cost: 1,      enhCost: 21 },
  darkness:   { cost: 500,    enhCost: 66 },
  liberation: { cost: 5_000,  enhCost: 450 },
  lumen:      { cost: 10_000, enhCost: 3_900 },
};

// merge-only 7-tier family: no copper enhance, 2×(+n) → +(n+1)
export const MERGE_IDS = new Set(["talisman", "transtalisman", "brtalisman", "insignia"]);
// true auras: from the bag only their aura effect applies (atk/int suppressed)
export const AURA_IDS = new Set(["luke_def"]);
// avatars enhance with souls + copper on their own odds bands (enhance.js);
// [soulKind, soulCost] per attempt (map egx: 2× "100 years old" / aMx: 3× "Brilliant Sarah")
export const AVATAR_SOULS = {
  seria_weaponav: ["old", 2], seria_auraav: ["old", 2], seria_cloneav: ["old", 2],
  lib_weaponav: ["brilliant", 3], lib_cloneav: ["brilliant", 3], lib_auraav: ["brilliant", 3],
};
export const AVATAR_IDS = new Set(Object.keys(AVATAR_SOULS));
// special-boss gear (map: "Can be used in special part item slots")
export const SPECIAL_GEAR_IDS = new Set([
  "bernardo_neck", "bernardo_ring", "bernardo_staff", "bernardo_gsword", "bernardo_gswords",
  "bernardo_handcannon", "bernardo_revolver", "bernardo_knuckle",
  "bernardo_spear", "bernardo_brushs", "bernardo_brush", "bernardo_rosary",
  "bernardo_blade", "bernardo_wand", "bernardo_cross",
  "bernardo2_staff", "bernardo2_ring", "bernardo2_neck",
  "trial_staff", "trial_ring", "trial_neck", ...AVATAR_IDS,
]);
// everything living in the special bag (merge family + aura + jewelry + boss gear) —
// source: these don't eat the 6 weapon slots
export const SPECIAL_IDS = new Set([...MERGE_IDS, "luke_def",
  "hellparty_dmg", "harlem_dmg", "fiendwar_add", "abysswalker_intp", "luton_add",
  ...SPECIAL_GEAR_IDS]);
// active class -> its Abyss Fragment weapon (bernardo "classWeapon" pool slot)
export const CLASS_WEAPON = {
  overmind: "bernardo_staff", stormtrooper: "bernardo_handcannon", desperado: "bernardo_revolver",
  striker: "bernardo_gswords", nenempress: "bernardo_knuckle",
  omniblade: "bernardo_gsword", bloodevil: "bernardo_gsword", indra: "bernardo_gsword", vagabond: "bernardo_gsword",
  // batch 2 (map oE pool ↔ "@For X only" tips)
  ashtarte: "bernardo_spear", hekate: "bernardo_brushs", geniewiz: "bernardo_brush",
  divineress: "bernardo_rosary", spectre: "bernardo_blade", necromancer: "bernardo_wand",
  crusader: "bernardo_cross", majesty: "bernardo_gswords", darkknight: "bernardo_gsword",
};

export const items = Object.entries(ITEM_DATA).map(([id, d]) => ({
  id,
  name: d.name,
  boss: d.boss,                        // null for shop/talismans
  shop: id in SHOP,
  cost: SHOP[id]?.cost ?? 0,
  enhCost: d.enhCost ?? SHOP[id]?.enhCost ?? ENH_COST[d.boss] ?? 1 * S,
  classOnly: d.classOnly ?? null,      // special-boss class weapons
  tiers: d.tiers,
}));

const byId = new Map(items.map(i => [i.id, i]));
export const getItem = id => byId.get(id);

// a boss's drop pool = its items in the generated data
export const poolFor = bossId => items.filter(i => i.boss === bossId).map(i => i.id);

export const maxPlus = def => def.tiers.length - 1;

export function tierOf(def, plus) {
  return def.tiers[Math.max(0, Math.min(plus, def.tiers.length - 1))] ?? {};
}

// compat helpers (UI labels)
export const statValue = (def, plus) => tierOf(def, plus).atk ?? 0;
export const intValue = (def, plus) => tierOf(def, plus).int ?? 0;

// item mastery: absorbed-duplicate milestones -> flat atk/int bonus on that
// item. Percent stats untouched (best-only/stacking rules stay intact).
export const MASTERY_MILESTONES = [1, 10, 100, 1000];
export const MASTERY_BONUS = 0.02; // +2% atk & int per milestone, max +8%
export function masteryMult(count) {
  let n = 0;
  for (const m of MASTERY_MILESTONES) if (count >= m) n++;
  return 1 + n * MASTERY_BONUS;
}

// Special-bag duplicates beyond the first copy per item (talisman family
// never counts — its dupes are merge fodder). Shared by UI badge + handler.
export function bagDupeCount(bag) {
  const seen = new Set();
  let n = 0;
  for (const eq of bag) {
    if (MERGE_IDS.has(eq.itemId)) continue;
    if (seen.has(eq.itemId)) n++;
    else seen.add(eq.itemId);
  }
  return n;
}

// Batch-absorb duplicates into mastery: keeps the highest-plus copy of
// each item, absorbs the rest at (1 + plus) each — what a player would do by
// hand. Ids in `skip` are never touched (talisman family: dupes are merge
// fodder). Mutates both args; returns how many items were absorbed.
export function absorbDupes(stash, mastery, skip = null) {
  stash.sort((a, b) => b.plus - a.plus); // best copy first, so it survives
  const seen = new Set();
  let absorbed = 0;
  for (let i = 0; i < stash.length; ) {
    const eq = stash[i];
    if (seen.has(eq.itemId) && !skip?.has(eq.itemId)) {
      mastery[eq.itemId] = (mastery[eq.itemId] || 0) + 1 + eq.plus;
      stash.splice(i, 1);
      absorbed++;
    } else {
      seen.add(eq.itemId);
      i++;
    }
  }
  return absorbed;
}

// equipment: array of ({itemId, plus} | null) -> folded stat bundle.
// specialBag: rings/necklaces/talismans/insignia/auras — folded the same,
// except aura items (defReduce) contribute DEF only (source special-slot rule).
export function aggregate(equipment, specialBag = [], mastery = {}) {
  const out = {
    atk: 0, int: 0,
    spdPct: 0,          // best only
    dmgIncPct: 0,       // stacks
    addDmgPct: 0,       // best only
    skillDmgPct: 0,     // stacks
    itemIntPct: 0,      // stacks
    skillLevelBonus: 0, // talismans stack
    defReduce: 0,       // armor auras (Lumen Basilium) — stacks
    cooldownPct: 0,     // class weapons (Abyss Fragment Staff/Hand Cannon)
    intRatioPct: 0,     // "skill's intelligence ratio increases" — class weapons
    procRatePct: 0,     // "skill activation probability increased" — class weapons/rings
    gsRatePct: 0,       // Geniewiz Brush: jackpot ("great success") chance
    buffValuePct: 0,    // Hekate Brush S: scales her buff magnitudes
    skillSpdPct: 0,     // Spectre Blade: attack speed when using skills
    clones: 0,          // Abyssal Knuckle: extra Doppelganger clones
    magicCrit: null,    // best single {chance, pct} — Clone Rare avatars, skill crits
    crit: null,         // best single crit item
    intProcs: [],       // all apply
  };
  const fold = (eq, bagged) => {
    if (!eq) return;
    const def = byId.get(eq.itemId);
    if (!def) return;
    const t = tierOf(def, eq.plus);
    // Lumen-style aura: DEF only from the bag, atk/int suppressed. Applies to
    // true auras only — defReduce NECKLACES/avatars keep their stats (source).
    if (bagged && AURA_IDS.has(eq.itemId)) { out.defReduce += t.defReduce ?? 0; return; }
    const mm = masteryMult(mastery[eq.itemId] || 0);
    out.atk += (t.atk ?? 0) * mm;
    out.int += (t.int ?? 0) * mm;
    if (t.spdPct) out.spdPct = Math.max(out.spdPct, t.spdPct);
    if (t.dmgInc) out.dmgIncPct += t.dmgInc;
    if (t.addDmg) out.addDmgPct = Math.max(out.addDmgPct, t.addDmg);
    if (t.skillDmg) out.skillDmgPct += t.skillDmg;
    if (t.intPct) out.itemIntPct += t.intPct;
    if (t.skillLevels) out.skillLevelBonus += t.skillLevels;
    if (t.defReduce) out.defReduce += t.defReduce;
    if (t.cooldownPct) out.cooldownPct += t.cooldownPct;
    if (t.intRatioPct) out.intRatioPct += t.intRatioPct;
    if (t.procRatePct) out.procRatePct += t.procRatePct;
    if (t.gsRatePct) out.gsRatePct += t.gsRatePct;
    if (t.buffValuePct) out.buffValuePct += t.buffValuePct;
    if (t.skillSpdPct) out.skillSpdPct += t.skillSpdPct;
    if (t.clones) out.clones += t.clones;
    if (t.magicCritPct && (!out.magicCrit || t.magicCritChance * t.magicCritPct >
        out.magicCrit.chance * 100 * out.magicCrit.pct)) {
      out.magicCrit = { chance: t.magicCritChance / 100, pct: t.magicCritPct };
    }
    if (t.procMult) out.intProcs.push({ chance: t.procChance / 100, mult: t.procMult });
    if (t.critMult) {
      const ev = (t.critChance / 100) * (t.critMult - 1);
      if (!out.crit || ev > out.crit.chance * (out.crit.mult - 1)) {
        out.crit = { chance: t.critChance / 100, mult: t.critMult };
      }
    }
  };
  for (const eq of equipment) fold(eq, false);
  for (const eq of specialBag) fold(eq, true);
  out.atk = Math.round(out.atk); // mastery mult can leave fractions
  out.int = Math.round(out.int * (1 + out.itemIntPct / 100));
  return out;
}
