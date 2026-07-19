// items.js
// Item definitions, per-plus stat scaling, and equipment aggregation.
//
// Primary stat: "atk" = flat attack, stacks. "atkspd" = % attack speed,
// does NOT stack (best one counts) — decompile-accurate.
// `int`: flat INT at +0 (boss items only, ≈10% of atk per the w3t data);
// scales with plus on the same quadratic ramp as the primary stat.
// `effect`: ONE signature mechanic per item (w3t taxonomy), constant per item:
//   atkPct        +% total damage ("processed internally", Rosetta line)
//   intProc       {chance, mult} — chance per auto to deal mult×INT bonus damage
//   crit          {chance, mult} — chance per auto of a mult× critical (best item only)
//   skillDmgPct   +% skill damage
//   itemIntPct    +% to total item-granted INT
//   cooldownPct   −% skill cooldowns
//   skillLevelBonus  talisman: +N effective levels to known skills
export const items = [
  // shop
  { id: "rafaros",    name: "Rafaros Staff",    shop: true, cost: 1,     enhCost: 21,   stat: "atk",    base: 1,  per20: 500 },
  { id: "darkness",   name: "Defined Darkness", shop: true, cost: 500,   enhCost: 66,   stat: "atk",    base: 30, per20: 950 },
  { id: "liberation", name: "Liberation Staff", shop: true, cost: 5000,  enhCost: 450,  stat: "atk",    base: 80, per20: 1600 },
  { id: "lumen",      name: "Lumen Caligo",     shop: true, cost: 10000, enhCost: 3900, stat: "atkspd", base: 30, per20: 205 },

  // boss drops (int ≈ atk/10; one signature effect each)
  { id: "rosetta",      name: "Rosetta Stone",              enhCost: 10_000,    stat: "atk",    base: 300,    per20: 4_000,   int: 30,    effect: { atkPct: 10 } },
  { id: "partyhat",     name: "Party Hat of Despair",       enhCost: 10_000,    stat: "atk",    base: 200,    per20: 3_000,   int: 20,    effect: { intProc: { chance: 0.10, mult: 2 } } },
  { id: "kneecap",      name: "Anton's Left Kneecap",       enhCost: 50_000,    stat: "atk",    base: 800,    per20: 12_000,  int: 80,    effect: { crit: { chance: 0.15, mult: 2 } } },
  { id: "refinedlumen", name: "Refined Lumen Caligo",       enhCost: 50_000,    stat: "atkspd", base: 60,     per20: 300,     int: 6 },
  { id: "rosetta2",     name: "Rosetta Stone 2: Rosettier", enhCost: 250_000,   stat: "atk",    base: 3_000,  per20: 50_000,  int: 300,   effect: { atkPct: 20 } },
  { id: "globetrophy",  name: "Harlem Globetrophy",         enhCost: 1_000_000, stat: "atk",    base: 12_000, per20: 200_000, int: 1_200, effect: { skillDmgPct: 15 } },

  // decompiled-roster boss drops
  { id: "siroccoheart", name: "Sirocco's Stormheart",         enhCost: 5_000_000,     stat: "atk",    base: 48_000,     per20: 800_000,     int: 4_800,     effect: { intProc: { chance: 0.10, mult: 4 } } },
  { id: "ozmabrand",    name: "Revenge: Ozma's Brand",        enhCost: 25_000_000,    stat: "atk",    base: 190_000,    per20: 3_200_000,   int: 19_000,    effect: { skillDmgPct: 25 } },
  { id: "tiamatcurse",  name: "Despair: Tiamat's Curse",      enhCost: 125_000_000,   stat: "atk",    base: 760_000,    per20: 12_800_000,  int: 76_000,    effect: { itemIntPct: 30 } },
  { id: "astarothgrim", name: "Astaroth's Grimoire",          enhCost: 600_000_000,   stat: "atk",    base: 3_000_000,  per20: 51_000_000,  int: 300_000,   effect: { cooldownPct: 15 } },
  { id: "timewatch",    name: "Time Traveler's Silver Watch", enhCost: 500_000_000,   stat: "atkspd", base: 90,         per20: 420,         int: 9 },
  { id: "ezraprophecy", name: "Ezra's Prophecy",              enhCost: 3_000_000_000, stat: "atk",    base: 12_000_000, per20: 205_000_000, int: 1_200_000, effect: { crit: { chance: 0.20, mult: 3 } } },

  // drop-pool epics (source-set names; one effect each, int ≈ atk/10)
  // Heaven's Legacy pool — Taibers
  { id: "heavenstaff",  name: "Heaven's Legacy: Staff",       enhCost: 12_000_000,     stat: "atk",    base: 90_000,      per20: 1_500_000,    int: 9_000,      effect: { atkPct: 25 } },
  { id: "heavenspear",  name: "Heaven's Legacy: Spear",       enhCost: 12_000_000,     stat: "atk",    base: 90_000,      per20: 1_500_000,    int: 9_000,      effect: { crit: { chance: 0.20, mult: 2 } } },
  { id: "samsara",      name: "Samsara: The Cycle of Time",   enhCost: 12_000_000,     stat: "atkspd", base: 75,          per20: 350,          int: 7 },
  // Black Heaven pool — Prey
  { id: "blackstaff",   name: "Master of Black Heaven: Staff", enhCost: 60_000_000,    stat: "atk",    base: 380_000,     per20: 6_400_000,    int: 38_000,     effect: { skillDmgPct: 30 } },
  { id: "blackswan",    name: "Black Swan: Splitting Sky",     enhCost: 60_000_000,    stat: "atk",    base: 380_000,     per20: 6_400_000,    int: 38_000,     effect: { intProc: { chance: 0.15, mult: 5 } } },
  { id: "blackflame",   name: "Black Flame: Encroaching Sky",  enhCost: 60_000_000,    stat: "atk",    base: 380_000,     per20: 6_400_000,    int: 38_000,     effect: { atkPct: 35 } },
  // -Hyun-/-Transcendence- pool — -Hyun- Find War
  { id: "hyunclouds",   name: "-Hyun- Clouds That Fill the Sky", enhCost: 1_200_000_000, stat: "atk",  base: 6_000_000,   per20: 100_000_000,  int: 600_000,    effect: { intProc: { chance: 0.20, mult: 8 } } },
  { id: "transwisdom",  name: "-Transcendence- Wisdom to See the Future", enhCost: 1_200_000_000, stat: "atk", base: 6_000_000, per20: 100_000_000, int: 600_000, effect: { cooldownPct: 25 } },
  { id: "transjustice", name: "-Transcendence- Justice: Equality", enhCost: 1_200_000_000, stat: "atk", base: 6_000_000,   per20: 100_000_000,  int: 600_000,    effect: { itemIntPct: 60 } },
  // Luna/Myth pool — Baekhwa Mandarin
  { id: "lunabene",     name: "Luna Benedicto",                enhCost: 8_000_000_000,  stat: "atk",    base: 25_000_000,  per20: 420_000_000,  int: 2_500_000,  effect: { skillDmgPct: 50 } },
  { id: "youngchang",   name: "Youngchang: Immortal Soul",     enhCost: 8_000_000_000,  stat: "atk",    base: 25_000_000,  per20: 420_000_000,  int: 2_500_000,  effect: { crit: { chance: 0.30, mult: 4 } } },
  { id: "mythroar",     name: "[Myth] Roar That Echoes Heaven and Earth", enhCost: 20_000_000_000, stat: "atk", base: 60_000_000, per20: 1_000_000_000, int: 6_000_000, effect: { atkPct: 80 } },
  // ★Abyss★ pool — Ezra, Engulfed in the Abyss
  { id: "abyssroots",   name: "★Abyss★ Roots of the World Tree", enhCost: 40_000_000_000, stat: "atk",  base: 130_000_000, per20: 2_200_000_000, int: 13_000_000, effect: { itemIntPct: 100 } },
  { id: "abyssend",     name: "★Abyss★ The End of Time",        enhCost: 40_000_000_000, stat: "atk",   base: 130_000_000, per20: 2_200_000_000, int: 13_000_000, effect: { intProc: { chance: 0.25, mult: 15 } } },
  { id: "abyssmadness", name: "★Abyss★ The One Who Holds Madness", enhCost: 40_000_000_000, stat: "atk", base: 130_000_000, per20: 2_200_000_000, int: 13_000_000, effect: { skillDmgPct: 80 } },
  // dragon pool — Hisma / Skasa
  { id: "lightscale",   name: "Hisma's Radiant Scale",         enhCost: 150_000_000_000, stat: "atk",   base: 500_000_000, per20: 8_500_000_000, int: 50_000_000, effect: { atkPct: 120 } },
  { id: "frostfang",    name: "Skasa's Frozen Fang",           enhCost: 150_000_000_000, stat: "atk",   base: 500_000_000, per20: 8_500_000_000, int: 50_000_000, effect: { crit: { chance: 0.35, mult: 6 } } },

  // talismans (special: no attack, pure skill levels; from rare boss rolls)
  { id: "talisman",      name: "Talisman",                  enhCost: 1_000_000_000,   stat: "atk", base: 0, per20: 0, effect: { skillLevelBonus: 1 } },
  { id: "transtalisman", name: "-Transcendence- Talisman",  enhCost: 100_000_000_000, stat: "atk", base: 0, per20: 0, effect: { skillLevelBonus: 2 } },
];

export const getItem = id => items.find(i => i.id === id);

// Quadratic ramp: +20 is a drastic spike, early plusses feel small.
export function statValue(def, plus) {
  return Math.round(def.base + (def.per20 - def.base) * (plus / 20) ** 2);
}

// Item INT rides the same ramp, proportional to the primary stat.
export function intValue(def, plus) {
  if (!def.int || !def.base) return def.int ?? 0;
  return Math.round(def.int * (statValue(def, plus) / def.base));
}

// equipment: array of ({itemId, plus} | null) -> folded stat bundle.
export function aggregate(equipment) {
  const out = {
    atk: 0, spdPct: 0, int: 0,
    atkPct: 0, skillDmgPct: 0, itemIntPct: 0, cooldownPct: 0, skillLevelBonus: 0,
    crit: null,       // best single crit item (like atkspd, only one applies)
    intProcs: [],     // all apply
  };
  for (const eq of equipment) {
    if (!eq) continue;
    const def = getItem(eq.itemId);
    const v = statValue(def, eq.plus);
    if (def.stat === "atk") out.atk += v;
    else if (def.stat === "atkspd") out.spdPct = Math.max(out.spdPct, v);
    out.int += intValue(def, eq.plus);

    const e = def.effect;
    if (!e) continue;
    if (e.atkPct) out.atkPct += e.atkPct;
    if (e.skillDmgPct) out.skillDmgPct += e.skillDmgPct;
    if (e.itemIntPct) out.itemIntPct += e.itemIntPct;
    if (e.cooldownPct) out.cooldownPct += e.cooldownPct;
    if (e.skillLevelBonus) out.skillLevelBonus += e.skillLevelBonus;
    if (e.intProc) out.intProcs.push(e.intProc);
    if (e.crit && (!out.crit || e.crit.chance * (e.crit.mult - 1) > out.crit.chance * (out.crit.mult - 1))) {
      out.crit = e.crit;
    }
  }
  out.int = Math.round(out.int * (1 + out.itemIntPct / 100));
  out.cooldownPct = Math.min(out.cooldownPct, 60); // ponytail: hard cap, raise if a build earns it
  return out;
}
