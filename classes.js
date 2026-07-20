// classes.js
// Class definitions — source numbers (wiki class pages, verified vs HEROES.md;
// see internal/GROUND-TRUTH.md). Each class has 7 skills in slots Q..D; boss
// tickets teach/level them by slot (Hell Party=Q … Prey=D). A skill is one of:
//   kind "cast": manual/macro cast with cooldownMs (active classes)
//   kind "proc": rolls procChance on every auto-attack (any class)
//   kind "stat": always-on stat bonus, folded into effectiveStats
//     (atkSpdPct flat; atkPctPerLevel scales with skill level — Omniblade)
// Damage = skillLevel × (base + INT × mult), then × (1 + skill-damage %).
//
// aoe + radius: hits every mob within `radius` GRID units on the 4×4 field.
// Source ranges map: <500 → r1 (5 mobs), 500–899 → r1.5 (9), 900–1300 → r2.5
// (15), >1300 → r4 (16). Skills whose range grows (ST mastery) carry
// rangeBase/rangePerLevel and resolve through radiusOf().
//
// buff: real timed buffs (source-exact; registry lives in gameState.buffs):
//   durationMs (+ perLevelMs), autoRider {base,mult} = lvl×(base+INT×mult)
//   added to every auto while active, riderChance = rider rolls per auto,
//   perAttacker = rider also swings for each active clone, clones+cloneRider =
//   Doppelganger, atkSpdPctPerLevel = Khai, skillDmgPctPerLevel = Miracle.
//   procBoost {target, mult} = while active, the target proc's damage ×mult
//   (Death by Revolver). procRider {target, base, mult} = while active, the
//   target proc gains a rider hit lvl×(base+INT×mult) (Miracle Vision).
//   Targets match by skill id OR by `replaces` (evolved skills inherit).
// armorDebuff { perLevel, durationMs }: timed enemy armor strip (autos only).
// Non-exact leftovers (engine has no substrate): One Inch Punch's
// "on attacked enemies" (mobs don't attack), Rising Knuckle's pull (no
// positions), Astral Storm's 13 meteors folded to one INT×6500 volley.
export const classes = [
  {
    id: "striker",
    name: "Striker",
    archetype: "active",
    desc: "Melee armor-cracker. No Q nuke — her Q IS the boxing gloves. Wrists optional.",
    skills: [
      { id: "gloves",   key: "Q", name: "Equip Boxing Gloves", kind: "stat", atkSpdPct: 50, armorStripBase: 1, armorStripPerLevel: 1, desc: "+50% attack speed, enemy armor −(level+1)" },
      { id: "lowkick",  key: "W", name: "Low Kick",            kind: "cast", base: 70_000, mult: 700,     cooldownMs: 6_000 },
      { id: "oneinch",  key: "E", name: "One Inch Punch",      kind: "cast", base: 4_000,  mult: 0,       cooldownMs: 15_000, aoe: true, radius: 1.5 },
      { id: "risingknuckle", key: "R", name: "Rising Knuckle", kind: "cast", base: 0,      mult: 3_000,   cooldownMs: 30_000, aoe: true, radius: 2.5 },
      { id: "powerfist", key: "T", name: "Power Fist",         kind: "cast", base: 0,      mult: 0,       cooldownMs: 60_000,
        buff: { durationMs: 30_000, autoRider: { base: 0, mult: 1_200 } } },
      { id: "kihop",    key: "F", name: "Kihop Low Kick",      kind: "cast", base: 0,      mult: 65_000,  cooldownMs: 50_000, aoe: true, radius: 1 }, // range 400
      { id: "climax",   key: "D", name: "Empress's Climactic Fist", kind: "cast", base: 0, mult: 100_000, cooldownMs: 55_000, aoe: true, radius: 1.5 },
    ],
    enhanced: [
      // Limit Break: bonus damage every 5th auto (deterministic, procCounts)
      { tier: "abyss",  replaces: "gloves",  id: "limitbreak", key: "Q", name: "Limit Break", kind: "proc", every: 5, base: 0, mult: 1_000 },
      { tier: "trans",  replaces: "lowkick", id: "tigerstrike", key: "W", name: "Tiger Strike", kind: "cast", base: 0, mult: 160_000, cooldownMs: 30_000 },
      { tier: "awaken", id: "slidingslash", key: "M", name: "Neo: Awakened Sliding Slash", kind: "cast", base: 0, mult: 1_700_000, cooldownMs: 300_000, aoe: true, radius: 4 }, // pull 35 — no positions
    ],
  },
  {
    id: "overmind",
    name: "Overmind",
    archetype: "active",
    desc: "Ranged caster, large flashy AoE. Sesto resets every other cooldown.",
    skills: [
      { id: "lanternfire", key: "Q", name: "Lantern Fire",      kind: "cast", base: 80,     mult: 80,     cooldownMs: 2_000 },
      { id: "arcticfist",  key: "W", name: "Arctic Fist",       kind: "cast", base: 30_000, mult: 550,    cooldownMs: 14_000, aoe: true, radius: 1.5 },
      { id: "thundercall", key: "E", name: "Thunder Calling",   kind: "cast", base: 0,      mult: 3_500,  cooldownMs: 14_000, aoe: true, radius: 1.5 },
      { id: "astralstorm", key: "R", name: "Astral Storm",      kind: "cast", base: 0,      mult: 6_500,  cooldownMs: 30_000, aoe: true, radius: 2.5 }, // INT×500 ×13 meteors
      { id: "curtain",     key: "T", name: "Elemental Curtain", kind: "cast", base: 0,      mult: 10_000, cooldownMs: 30_000, aoe: true, radius: 2.5 },
      { id: "gate",        key: "F", name: "The Gate",          kind: "cast", base: 0,      mult: 30_000, cooldownMs: 30_000, aoe: true, radius: 2.5 },
      { id: "sesto",       key: "D", name: "Sesto Elemental",   kind: "cast", base: 0,      mult: 40_000, cooldownMs: 60_000, aoe: true, radius: 2.5, resetsCooldowns: true },
    ],
    enhanced: [
      { tier: "abyss",  replaces: "lanternfire", id: "holloween", key: "Q", name: "Holloween Buster", kind: "cast", base: 0, mult: 40_000, cooldownMs: 55_000 },
      { tier: "trans",  replaces: "arcticfist",  id: "elemquake", key: "W", name: "Elemental Quake", kind: "cast", base: 0, mult: 65_000, cooldownMs: 60_000, aoe: true, radius: 4 },
      { tier: "awaken", id: "cosmiccalamity", key: "M", name: "Cosmic Calamity", kind: "cast", base: 0, mult: 2_400_000, cooldownMs: 300_000, aoe: true, radius: 4 },
    ],
  },
  {
    id: "omniblade",
    name: "Omniblade",
    archetype: "passive",
    desc: "Sword procs, all single-target, all huge. The boss executioner — fields bore it.",
    skills: [
      { id: "lightsword",  key: "Q", name: "Lightsword Mastery", kind: "stat", atkPctPerLevel: 70, desc: "+70% attack power per level" },
      { id: "ironstrike",  key: "W", name: "Ultimate Slay: Iron Strike", kind: "proc", procChance: 0.03,  base: 600,    mult: 600,
        armorDebuff: { perLevel: 6, durationMs: 4_000 } },
      { id: "overdrive",   key: "E", name: "Overdrive",          kind: "proc", procChance: 0.02,  base: 0, mult: 0,
        buff: { durationMs: 4_000, autoRider: { base: 260, mult: 260 } } },
      { id: "drawsword",   key: "R", name: "Draw Sword",         kind: "proc", procChance: 0.03,  base: 7_000,  mult: 6_500 },
      { id: "sworddance",  key: "T", name: "Illusion Sword Dance", kind: "proc", procChance: 0.02, base: 15_000, mult: 15_000 },
      { id: "mindsword",   key: "F", name: "Omnislay: Mind's Sword", kind: "proc", procChance: 0.02, base: 0,    mult: 25_000 },
      { id: "tempestslay", key: "D", name: "Ultimate Slay: Tempest", kind: "proc", procChance: 0.012, base: 0,   mult: 50_000 },
    ],
    enhanced: [
      { tier: "abyss",  replaces: "lightsword", id: "shootingstar", key: "Q", name: "Shooting Star", kind: "proc", procChance: 0.005, base: 0, mult: 100_000 },
      { tier: "trans",  replaces: "ironstrike", id: "etherealslash", key: "W", name: "Ethereal Slash", kind: "proc", procChance: 0.005, base: 0, mult: 300_000 },
      { tier: "awaken", id: "pentastrike", key: "M", name: "Pentastrike", kind: "proc", procChance: 0.05, base: 0, mult: 12_000_000, cooldownMs: 300_000 },
    ],
  },
  {
    id: "bloodevil",
    name: "Blood Evil",
    archetype: "passive",
    desc: "Everything explodes around you. The widest field-clearer in the game — bosses shrug.",
    skills: [
      { id: "gorecross",  key: "Q", name: "Gore Cross",       kind: "proc", procChance: 0.05,  base: 100,    mult: 100 },
      { id: "ragingfury", key: "W", name: "Raging Fury",      kind: "proc", procChance: 0.03,  base: 300,    mult: 300,    aoe: true, radius: 1.5 },
      { id: "bloodsword", key: "E", name: "Blood Sword",      kind: "proc", procChance: 0.024, base: 1_800,  mult: 900,    aoe: true, radius: 1.5 },
      { id: "bloodboom",  key: "R", name: "Blood Boom",       kind: "proc", procChance: 0.018, base: 8_000,  mult: 2_000,  aoe: true, radius: 2.5 },
      { id: "outrage",    key: "T", name: "Outrage Break",    kind: "proc", procChance: 0.01,  base: 10_000, mult: 5_000,  aoe: true, radius: 2.5 },
      { id: "overkill",   key: "F", name: "Extreme Overkill", kind: "proc", procChance: 0.006, base: 14_000, mult: 7_000,  aoe: true, radius: 4 },
      { id: "bloodriven", key: "D", name: "Blood Riven",      kind: "proc", procChance: 0.005, base: 20_000, mult: 20_000, aoe: true, radius: 4 },
    ],
    enhanced: [
      { tier: "abyss",  replaces: "gorecross",  id: "enrage", key: "Q", name: "Enrage", kind: "proc", procChance: 0.005, base: 0, mult: 35_000, aoe: true, radius: 4 },
      { tier: "trans",  replaces: "ragingfury", id: "bloodsnatch", key: "W", name: "Blood Snatch", kind: "proc", procChance: 0.005, base: 0, mult: 65_000, aoe: true, radius: 4 },
      { tier: "awaken", id: "bloodmajin", key: "M", name: "Blood Majin Strike", kind: "proc", procChance: 0.05, base: 0, mult: 2_000_000, cooldownMs: 300_000, aoe: true, radius: 4 },
    ],
  },
  {
    id: "indra",
    name: "Indra",
    archetype: "passive",
    desc: "Waves on waves — steady mid-size AoE procs. The comfortable middle path.",
    skills: [
      { id: "wavewheel",  key: "Q", name: "Wave Wheel Slasher", kind: "proc", procChance: 0.05,  base: 100,    mult: 100 },
      { id: "waverad",    key: "W", name: "Wave Radiation",     kind: "proc", procChance: 0.03,  base: 600,    mult: 600,    aoe: true, radius: 1.5 },
      { id: "heatwave",   key: "E", name: "Heat Wave Sword",    kind: "proc", procChance: 0.02,  base: 1_200,  mult: 1_200,  aoe: true, radius: 1.5 },
      { id: "crescent",   key: "R", name: "Spirit Crescent",    kind: "proc", procChance: 0.015, base: 2_500,  mult: 2_500,  aoe: true, radius: 1.5 },
      { id: "agni",       key: "T", name: "Agni Pentacle",      kind: "proc", procChance: 0.01,  base: 15_000, mult: 18_000 },
      { id: "waveeye",    key: "F", name: "Wave Eye",           kind: "proc", procChance: 0.005, base: 0,      mult: 40_000, aoe: true, radius: 2.5,
        buff: { durationMs: 9_000, autoRider: { base: 0, mult: 3_000 }, riderChance: 0.10 } },
      { id: "thundergod", key: "D", name: "Thunder God",        kind: "proc", procChance: 0.005, base: 12_000, mult: 12_000, aoe: true, radius: 2.5 },
    ],
    enhanced: [
      { tier: "abyss",  replaces: "wavewheel", id: "groundquaker", key: "Q", name: "Ground Quaker", kind: "proc", procChance: 0.006, base: 0, mult: 75_000 },
      { tier: "trans",  replaces: "waverad",   id: "murderouswave", key: "W", name: "Murderous Wave", kind: "proc", procChance: 0.006, base: 0, mult: 40_000, aoe: true, radius: 2.5 }, // 5s lingering field — no substrate
      { tier: "awaken", id: "heaventhunder", key: "M", name: "Heaven's Thunder", kind: "proc", procChance: 0.05, base: 0, mult: 2_000_000, cooldownMs: 300_000, aoe: true, radius: 4 },
    ],
  },
  {
    id: "vagabond",
    name: "Neo: Vagabond",
    archetype: "passive",
    desc: "A duelist's blade with the occasional explosion. Single-target lean, wide finishers.",
    skills: [
      { id: "soaring",    key: "Q", name: "Soaring",             kind: "proc", procChance: 0.025, base: 200,    mult: 200 },
      { id: "oppress",    key: "W", name: "Oppressive Pressure", kind: "proc", procChance: 0.02,  base: 400,    mult: 400,    aoe: true, radius: 1.5 },
      { id: "explsword",  key: "E", name: "Explosive Sword",     kind: "proc", procChance: 0.02,  base: 3_000,  mult: 3_000 },
      { id: "crosssword", key: "R", name: "Cross Sword",         kind: "proc", procChance: 0.015, base: 12_000, mult: 12_000 },
      { id: "blastpalm",  key: "T", name: "Blasting Palm",       kind: "proc", procChance: 0.01,  base: 5_000,  mult: 5_000,  aoe: true, radius: 2.5 },
      { id: "verdant",    key: "F", name: "Verdant Blast",       kind: "proc", procChance: 0.01,  base: 0,      mult: 30_000 },
      { id: "moondance",  key: "D", name: "Moonlight Dance",     kind: "proc", procChance: 0.005, base: 0,      mult: 45_000 },
    ],
    enhanced: [
      { tier: "abyss",  replaces: "soaring", id: "lotusdance", key: "Q", name: "Lotus Dance", kind: "proc", procChance: 0.005, base: 0, mult: 25_000, aoe: true, radius: 2.5 },
      { tier: "trans",  replaces: "oppress", id: "lotusflash", key: "W", name: "Lotus Flash", kind: "proc", procChance: 0.005, base: 0, mult: 180_000 },
      { tier: "awaken", id: "moondancex", key: "M", name: "Moonlight Dance -Awakened-", kind: "proc", procChance: 0.05, base: 0, mult: 12_000_000, cooldownMs: 300_000 },
    ],
  },
  {
    id: "desperado",
    name: "Desperado",
    archetype: "active",
    desc: "Ranged revolver executions. The revolver itself procs while you cast.",
    skills: [
      { id: "windmill",  key: "Q", name: "Windmill",             kind: "cast", base: 140,     mult: 140,    cooldownMs: 6_000,  aoe: true, radius: 1.5 },
      { id: "headshot",  key: "W", name: "Headshot",             kind: "cast", base: 0,       mult: 650,    cooldownMs: 5_000,  aoe: true, radius: 1.5 },
      { id: "revolver",  key: "E", name: "Revolver Enhancement", kind: "proc", procChance: 0.15, base: 50_000, mult: 1_750 },
      { id: "wildshot",  key: "R", name: "Wild Shot",            kind: "cast", base: 0,       mult: 4_000,  cooldownMs: 36_000, aoe: true, radius: 2.5 },
      { id: "deathrev",  key: "T", name: "Death by Revolver",    kind: "cast", base: 0, mult: 0, cooldownMs: 75_000,
        buff: { durationMs: 28_000, perLevelMs: 2_000, procBoost: { target: "revolver", mult: 3 } } },
      { id: "scud",      key: "F", name: "Scud Genoside",        kind: "cast", base: 0,       mult: 15_000, cooldownMs: 50_000, aoe: true, radius: 2.5 },
      { id: "seventh",   key: "D", name: "Seventh Flow",         kind: "cast", base: 0,       mult: 40_000, cooldownMs: 50_000, aoe: true, radius: 2.5,
        armorDebuff: { perLevel: 8, durationMs: 10_000 } },
    ],
    enhanced: [
      { tier: "abyss",  replaces: "windmill", id: "suppressive", key: "Q", name: "Suppressive Barrage", kind: "cast", base: 0, mult: 25_000, cooldownMs: 30_000 },
      { tier: "trans",  replaces: "headshot", id: "wipeout", key: "W", name: "Wipeout", kind: "cast", base: 0, mult: 55_000, cooldownMs: 30_000, aoe: true, radius: 2.5 },
      { tier: "awaken", id: "deathcrisis", key: "M", name: "Death Crisis", kind: "cast", base: 0, mult: 4_000_000, cooldownMs: 300_000, aoe: true, radius: 2.5 },
    ],
  },
  {
    id: "stormtrooper",
    name: "Storm Trooper",
    archetype: "active",
    desc: "Flamethrowers, lasers, quantum bombs. Her autos ARE artillery (17% AoE).",
    skills: [
      { id: "heavymastery", key: "Q", name: "Heavy Weapons Mastery", kind: "proc", procChance: 0.17, base: 40, mult: 40, aoe: true,
        rangeBase: 350, rangePerLevel: 50 }, // radius grows with level; 800 under Miracle Vision
      { id: "flamethrow", key: "W", name: "Flame Thrower",   kind: "cast", base: 60_000, mult: 600,    cooldownMs: 12_000, aoe: true, radius: 1.5 },
      { id: "laser",      key: "E", name: "Laser Rifle",     kind: "cast", base: 0,      mult: 2_500,  cooldownMs: 20_000, aoe: true, radius: 2.5 },
      { id: "quantum",    key: "R", name: "Quantum Bomb",    kind: "cast", base: 0,      mult: 5_000,  cooldownMs: 28_000, aoe: true, radius: 4 },
      { id: "miracle",    key: "T", name: "Miracle Vision",  kind: "cast", base: 0,      mult: 0,      cooldownMs: 70_000,
        buff: { durationMs: 30_000, procRider: { target: "heavymastery", base: 0, mult: 550 }, skillDmgPctPerLevel: 7 } },
      { id: "agenttrig",  key: "F", name: "Agent Trigger",   kind: "cast", base: 0,      mult: 10_000, cooldownMs: 30_000, aoe: true, radius: 4 },
      { id: "opraids",    key: "D", name: "Operation Raids", kind: "cast", base: 0,      mult: 32_000, cooldownMs: 65_000, aoe: true, radius: 4 },
    ],
    enhanced: [
      // fixed r750 (no level growth); Miracle Vision rider still applies via id match in main.js
      { tier: "abyss",  replaces: "heavymastery", id: "heavymasteryx", key: "Q", name: "Heavy Weapon Mastery -Enhanced-", kind: "proc", procChance: 0.17, base: 0, mult: 250, aoe: true, radius: 1.5 },
      { tier: "trans",  replaces: "flamethrow", id: "pt15", key: "W", name: "PT-15 Prototype", kind: "cast", base: 0, mult: 110_000, cooldownMs: 70_000, aoe: true, radius: 4 },
      { tier: "awaken", id: "decisive", key: "M", name: "Decisive Battle", kind: "cast", base: 0, mult: 2_000_000, cooldownMs: 300_000 },
    ],
  },
  {
    id: "nenempress",
    name: "Nen Empress",
    archetype: "active",
    desc: "Nen blasts and phantom clones (they're in your heart). Balanced caster.",
    skills: [
      { id: "khai",         key: "Q", name: "Khai",           kind: "cast", base: 0, mult: 6,      cooldownMs: 40_000, aoe: true, radius: 1.5,
        // ponytail: source lists no buff duration and w3a doesn't resolve it — 15s assumed
        buff: { durationMs: 15_000, atkSpdPctPerLevel: 50 } },
      { id: "doppel",       key: "W", name: "Doppelganger",   kind: "cast", base: 0, mult: 0,      cooldownMs: 60_000,
        // 2 clones swing with each auto at lvl×INT×720 — real summons when the engine grows attackers
        buff: { durationMs: 35_000, clones: 2, cloneRider: { base: 0, mult: 720 } } },
      { id: "lionroar",     key: "E", name: "Lion's Roar",    kind: "cast", base: 0, mult: 3_000,  cooldownMs: 20_000, aoe: true, radius: 1.5 },
      { id: "energyshield", key: "R", name: "Energy Shield",  kind: "cast", base: 0, mult: 10_000, cooldownMs: 25_000, aoe: true, radius: 2.5 },
      { id: "tigerflash",   key: "T", name: "Tiger Flash",    kind: "cast", base: 0, mult: 0,      cooldownMs: 60_000,
        buff: { durationMs: 30_000, autoRider: { base: 0, mult: 1_200 }, perAttacker: true } }, // clones swing it too
      { id: "nenflower",    key: "F", name: "Nen Flower",     kind: "cast", base: 0, mult: 27_000, cooldownMs: 40_000, aoe: true, radius: 4 },
      { id: "brilliant",    key: "D", name: "Brilliant Nen",  kind: "cast", base: 0, mult: 65_000, cooldownMs: 60_000, aoe: true, radius: 4 },
    ],
    enhanced: [
      { tier: "abyss",  replaces: "khai",     id: "nenshot", key: "Q", name: "Nen Shot", kind: "cast", base: 0, mult: 22_000, cooldownMs: 8_000 },
      // source: trans ticket changes E for Nen Empress, not W
      { tier: "trans",  replaces: "lionroar", id: "grandroar", key: "E", name: "Lion's Grand Roar", kind: "cast", base: 0, mult: 40_000, cooldownMs: 20_000, aoe: true, radius: 4 },
      { tier: "awaken", id: "nendragons", key: "M", name: "Nen Dragons", kind: "cast", base: 0, mult: 3_000_000, cooldownMs: 300_000 },
    ],
  },
];

export const getClass = id => classes.find(c => c.id === id);

// Does `skill` answer to `id`? Evolved replacements answer to the base id
// they replaced (procBoost/procRider targets keep working post-evolution).
export const matchesSkill = (skill, id) => skill.id === id || skill.replaces === id;

export const MAX_SKILL_LEVEL = 7;

// The 7 slots with learned enhanced replacements swapped in (abyss/trans
// tickets REPLACE the base skill — source behavior), plus the M ultimate
// appended once learned. `skills` is the per-char skillId→level map; an
// enhanced skill is active iff its own id has a level there.
export function activeSkills(cls, skills) {
  if (!cls) return [];
  const out = cls.skills.map(s => {
    const rep = cls.enhanced?.find(e => e.replaces === s.id);
    return rep && skills[rep.id] ? rep : s;
  });
  const awaken = cls.enhanced?.find(e => e.tier === "awaken");
  if (awaken && skills[awaken.id]) out.push(awaken);
  return out;
}

// Source formula: damage = skillLevel × (base + INT × mult).
// skillDmgMult (1 + skill-damage %s) folds in here; intRatioMult scales only
// the INT term (class weapons: "skill's intelligence ratio increases by N%").
export function skillDamage(skill, level, totalInt, skillDmgMult = 1, intRatioMult = 1) {
  return Math.round(level * ((skill.base ?? 0) + totalInt * skill.mult * intRatioMult) * skillDmgMult);
}

// Always-on stat-skill bonuses for a character (kind "stat" skills, by level).
export function classStatBonuses(cls, skills, skillLevelBonus = 0) {
  const out = { atkPct: 0, atkSpdPct: 0, armorReduce: 0 };
  for (const s of cls?.skills ?? []) {
    const level = skills[s.id];
    if (!level || s.kind !== "stat") continue;
    const L = level + skillLevelBonus;
    out.atkPct += (s.atkPctPerLevel ?? 0) * L;
    out.atkSpdPct += s.atkSpdPct ?? 0;
    if (s.armorStripPerLevel) out.armorReduce += (s.armorStripBase ?? 0) + s.armorStripPerLevel * L;
  }
  return out;
}

// AoE radius, honoring level-grown ranges (ST mastery) and Miracle Vision.
// Source range → grid radius: <500 → 1, <900 → 1.5, ≤1300 → 2.5, else 4.
export function radiusOf(skill, level, miracleActive = false) {
  if (!skill.rangeBase) return skill.radius;
  const range = miracleActive ? 800 : skill.rangeBase + (skill.rangePerLevel ?? 0) * level;
  return range < 500 ? 1 : range < 900 ? 1.5 : range <= 1300 ? 2.5 : 4;
}

// Buff duration for a cast/proc at a skill level.
export function buffDuration(skill, level) {
  return skill.buff.durationMs + (skill.buff.perLevelMs ?? 0) * level;
}
