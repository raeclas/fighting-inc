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

// talismans/insignia enhance costs (merge system is the real source sink — later)
const SPECIAL_ENH = { talisman: 1 * S, transtalisman: 100 * S, brtalisman: 5000 * S, insignia: 1000 * S };

export const items = Object.entries(ITEM_DATA).map(([id, d]) => ({
  id,
  name: d.name,
  boss: d.boss,                        // null for shop/talismans
  shop: id in SHOP,
  cost: SHOP[id]?.cost ?? 0,
  enhCost: SHOP[id]?.enhCost ?? ENH_COST[d.boss] ?? SPECIAL_ENH[id] ?? 1 * S,
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

// equipment: array of ({itemId, plus} | null) -> folded stat bundle.
export function aggregate(equipment) {
  const out = {
    atk: 0, int: 0,
    spdPct: 0,          // best only
    dmgIncPct: 0,       // stacks
    addDmgPct: 0,       // best only
    skillDmgPct: 0,     // stacks
    itemIntPct: 0,      // stacks
    skillLevelBonus: 0, // talismans stack
    defReduce: 0,       // armor auras (Lumen Basilium) — stacks
    cooldownPct: 0,     // no source item grants this yet (class weapons later)
    crit: null,         // best single crit item
    intProcs: [],       // all apply
  };
  for (const eq of equipment) {
    if (!eq) continue;
    const def = byId.get(eq.itemId);
    if (!def) continue;
    const t = tierOf(def, eq.plus);
    out.atk += t.atk ?? 0;
    out.int += t.int ?? 0;
    if (t.spdPct) out.spdPct = Math.max(out.spdPct, t.spdPct);
    if (t.dmgInc) out.dmgIncPct += t.dmgInc;
    if (t.addDmg) out.addDmgPct = Math.max(out.addDmgPct, t.addDmg);
    if (t.skillDmg) out.skillDmgPct += t.skillDmg;
    if (t.intPct) out.itemIntPct += t.intPct;
    if (t.skillLevels) out.skillLevelBonus += t.skillLevels;
    if (t.defReduce) out.defReduce += t.defReduce;
    if (t.procMult) out.intProcs.push({ chance: t.procChance / 100, mult: t.procMult });
    if (t.critMult) {
      const ev = (t.critChance / 100) * (t.critMult - 1);
      if (!out.crit || ev > out.crit.chance * (out.crit.mult - 1)) {
        out.crit = { chance: t.critChance / 100, mult: t.critMult };
      }
    }
  }
  out.int = Math.round(out.int * (1 + out.itemIntPct / 100));
  return out;
}
