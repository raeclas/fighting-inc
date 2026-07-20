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
    baseCooldownMs: 500, // w3u attack cooldown
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
    baseCooldownMs: 580, // w3u attack cooldown
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
    // w3u: job unit "Sword" 0.50s (sibling "Hellventor" 0.52 read as Blood Evil;
    // idx13 "Evil spirits and demons" = Rakshasa, deferred)
    baseCooldownMs: 500,
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
    baseCooldownMs: 520, // w3u attack cooldown ("Hellventor")
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
    baseCooldownMs: 550, // w3u attack cooldown
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
    baseCooldownMs: 520, // w3u attack cooldown ("Jin: Vagabond")
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
    baseCooldownMs: 550, // w3u attack cooldown
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
    baseCooldownMs: 580, // w3u attack cooldown
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
    baseCooldownMs: 550, // w3u attack cooldown ("A hundred flowers in a row")
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

  // ---- batch 2 (HEROES.md + w3a extraction; assumptions marked) ----
  {
    id: "crusader",
    baseCooldownMs: 550, // w3u attack cooldown
    name: "Crusader",
    archetype: "passive", // deterministic: skills fire themselves off cooldown
    desc: "Holy clockwork. Every skill casts itself the moment it's ready.",
    skills: [
      { id: "purity",     key: "Q", name: "Blades of Purity",    kind: "cast", autocast: true, base: 120, mult: 120, cooldownMs: 5_000 },
      { id: "deflection", key: "W", name: "Deflection Wall",     kind: "cast", autocast: true, base: 0, mult: 800,    cooldownMs: 15_000, aoe: true, radius: 1.5 },
      { id: "invocation", key: "E", name: "Divine Invocation",   kind: "cast", autocast: true, base: 0, mult: 300,    cooldownMs: 60_000,
        buff: { durationMs: 22_000, autoRider: { base: 0, mult: 300 } } },
      // Penance rider (INT×500) has no stated duration — omitted, damage kept
      { id: "repentance", key: "R", name: "Hammer of Repentance", kind: "cast", autocast: true, base: 0, mult: 2_000, cooldownMs: 30_000, aoe: true, radius: 2.5 },
      // 6 hits/3s folded to one volley (Astral Storm precedent)
      { id: "judgment",   key: "T", name: "Righteous Judgment",  kind: "cast", autocast: true, base: 0, mult: 48_000, cooldownMs: 30_000, aoe: true, radius: 2.5 },
      { id: "apocalypse", key: "F", name: "Apocalypse",          kind: "cast", autocast: true, base: 0, mult: 1_100,  cooldownMs: 60_000,
        buff: { durationMs: 22_000, skillDmgPctPerLevel: 5 } },
      { id: "punishment", key: "D", name: "Punishment",          kind: "cast", autocast: true, base: 0, mult: 19_000, cooldownMs: 60_000 },
    ],
    enhanced: [
      { tier: "abyss",  replaces: "purity", id: "jupiterhammer", key: "Q", name: "Thunder Hammer: Jupiter", kind: "cast", autocast: true, base: 0, mult: 4_000, cooldownMs: 60_000 },
      { tier: "trans",  replaces: "deflection", id: "doomspear", key: "W", name: "Doom Spear", kind: "cast", autocast: true, base: 0, mult: 90_000, cooldownMs: 60_000 },
      { tier: "awaken", id: "finaljudgement", key: "M", name: "Final Judgement", kind: "cast", autocast: true, base: 0, mult: 2_500_000, cooldownMs: 300_000 },
    ],
  },
  {
    id: "majesty",
    baseCooldownMs: 500, // w3u attack cooldown
    name: "Majesty",
    archetype: "active",
    desc: "Single-target god. Casts arm the blade; your autos do the killing.",
    skills: [
      { id: "swordplay",  key: "Q", name: "Swordplay",           kind: "proc", procChance: 0.20, base: 2, mult: 0 },
      // casts arm on-hit riders: charges = how many autos carry the damage
      { id: "elemshift",  key: "W", name: "Elemental Shift",     kind: "cast", base: 0, mult: 0, cooldownMs: 15_000,
        buff: { durationMs: 60_000, charges: 20, autoRider: { base: 0, mult: 150 } } },
      { id: "arcaneblast", key: "E", name: "Arcane Sword Blast", kind: "cast", base: 0, mult: 0, cooldownMs: 10_000,
        buff: { durationMs: 60_000, charges: 1, autoRider: { base: 0, mult: 6_000 } } },
      { id: "swiftslash", key: "R", name: "Swift Demon Slash",   kind: "cast", base: 0, mult: 0, cooldownMs: 15_000,
        buff: { durationMs: 60_000, charges: 1, autoRider: { base: 0, mult: 15_000 } } },
      { id: "imperial",   key: "T", name: "Imperial Swordsmanship", kind: "proc", procChance: 0.10, base: 0, mult: 1_200, stacksTo: 40 },
      { id: "spacetime",  key: "F", name: "Ultimate Slayer: Spacetime Cutter", kind: "cast", base: 0, mult: 0, cooldownMs: 35_000,
        buff: { durationMs: 60_000, charges: 1, autoRider: { base: 0, mult: 60_000 } } },
      { id: "laevateinn", key: "D", name: "Ultimate Sword: Laevateinn", kind: "cast", base: 0, mult: 0, cooldownMs: 45_000,
        buff: { durationMs: 60_000, charges: 1, autoRider: { base: 0, mult: 110_000 } } },
    ],
    enhanced: [
      { tier: "abyss",  replaces: "swordplay", id: "illusionsword", key: "Q", name: "Illusion Sword", kind: "cast", base: 0, mult: 2_000, cooldownMs: 50_000 },
      { tier: "trans",  replaces: "elemshift", id: "eradicator", key: "W", name: "Elemental Eradicator", kind: "cast", base: 0, mult: 600_000, cooldownMs: 60_000 },
      { tier: "awaken", id: "supremelegion", key: "M", name: "Supreme Legion", kind: "cast", base: 0, mult: 11_600_000, cooldownMs: 300_000 },
    ],
  },
  {
    id: "divineress",
    baseCooldownMs: 550, // w3u attack cooldown
    name: "Divineress",
    archetype: "active",
    desc: "Builds Spheres with every swing, spends them on dragon prayers.",
    spheres: { perAttack: 14, max: 50 },
    skills: [
      { id: "thunderamulet", key: "Q", name: "Thunder Amulet", kind: "cast", base: 200, mult: 200, cooldownMs: 10_000 },
      { id: "powerorb",   key: "W", name: "Power Orb",         kind: "cast", base: 600, mult: 600, cooldownMs: 100, sphereCost: 3 },
      { id: "soulmagnet", key: "E", name: "Soul Magnet",       kind: "cast", base: 2_000, mult: 2_000, cooldownMs: 20_000, sphereGain: 2 },
      { id: "dragonfury", key: "R", name: "Dragon Fury",       kind: "cast", base: 2_000, mult: 2_000, cooldownMs: 28_000, sphereGain: 1, sphereGainBossMult: 5 },
      { id: "thunderstorm", key: "T", name: "Oracle: Dragon Thunderstorm", kind: "cast", base: 7_500, mult: 7_500, cooldownMs: 28_000, sphereGain: 1, sphereGainBossMult: 10 },
      // ponytail: HEROES.md calls this a "sphere management hybrid" with no CD — 20s assumed (Khai precedent)
      { id: "beads",      key: "F", name: "One Hundred Eight Beads", kind: "cast", base: 0, mult: 1_500, cooldownMs: 20_000, sphereGain: 2 },
      { id: "incarnation", key: "D", name: "Incarnation: Raging Godly Dragon", kind: "cast", base: 0, mult: 37_500, cooldownMs: 50_000, sphereGain: 1, sphereGainBossMult: 20 },
    ],
    enhanced: [
      // ponytail: CDs unstated for the two evolves — base-slot CDs assumed
      { tier: "abyss",  replaces: "thunderamulet", id: "holycomet", key: "Q", name: "Holy Comet", kind: "cast", base: 0, mult: 13_000, cooldownMs: 10_000, sphereCost: "all", sphereBonusMult: 1_000 },
      { tier: "trans",  replaces: "soulmagnet", id: "rosaryprison", key: "E", name: "Rosary Prison", kind: "cast", base: 0, mult: 120_000, cooldownMs: 20_000 },
      { tier: "awaken", id: "celestialpurge", key: "M", name: "Celestial Purge", kind: "cast", base: 0, mult: 2_000_000, cooldownMs: 300_000, sphereFill: true },
    ],
  },
  {
    id: "geniewiz",
    baseCooldownMs: 580, // w3u attack cooldown
    name: "Geniewiz",
    archetype: "active",
    desc: "Every cast spins the wheel: jackpot, success, failure — or nothing.",
    skills: [
      // outcomes: GS 10% / S 50% / F 30%; the missing 10% is a total miss
      { id: "flyswatter", key: "Q", name: "Devolution Flyswatter", kind: "cast", base: 0, mult: 0, cooldownMs: 8_000,
        outcomes: [{ p: 0.1, tag: "GS", base: 300, mult: 300 }, { p: 0.5, tag: "S", base: 200, mult: 200 }, { p: 0.3, tag: "F", base: 50, mult: 50 }] },
      { id: "acidcloud", key: "W", name: "Acid Cloud", kind: "cast", base: 0, mult: 0, cooldownMs: 15_000,
        outcomes: [{ p: 0.1, tag: "GS", base: 1_500, mult: 1_500 }, { p: 0.5, tag: "S", base: 700, mult: 700 }, { p: 0.3, tag: "F", base: 200, mult: 200 }] },
      { id: "lavapotion", key: "E", name: "Lava Potion No. 9", kind: "cast", base: 0, mult: 0, cooldownMs: 22_000,
        outcomes: [{ p: 0.1, tag: "GS", base: 5_000, mult: 5_000 }, { p: 0.5, tag: "S", base: 2_500, mult: 2_500 }, { p: 0.3, tag: "F", base: 400, mult: 400 }] },
      { id: "collider", key: "R", name: "Florae Collider", kind: "cast", base: 0, mult: 0, cooldownMs: 25_000,
        outcomes: [{ p: 0.1, tag: "GS", base: 12_000, mult: 12_000 }, { p: 0.5, tag: "S", base: 3_500, mult: 3_500 }, { p: 0.3, tag: "F", base: 600, mult: 600 }] },
      { id: "giantswatter", key: "T", name: "Giant Flyswatter", kind: "cast", base: 0, mult: 0, cooldownMs: 32_000,
        outcomes: [{ p: 0.1, tag: "GS", base: 30_000, mult: 30_000 }, { p: 0.5, tag: "S", base: 8_000, mult: 8_000 }, { p: 0.3, tag: "F", base: 1_000, mult: 1_000 }] },
      // GS auto/skill-dmg side-buffs carry no numbers in HEROES.md — damage tiers only
      { id: "fusioncraft", key: "F", name: "Fusion Craft", kind: "cast", base: 0, mult: 0, cooldownMs: 42_000,
        outcomes: [{ p: 0.1, tag: "GS", base: 0, mult: 20_000 }, { p: 0.5, tag: "S", base: 0, mult: 15_000 }, { p: 0.3, tag: "F", base: 0, mult: 2_000 }] },
      { id: "ouroboros", key: "D", name: "Ouroboros", kind: "cast", base: 0, mult: 0, cooldownMs: 50_000,
        outcomes: [{ p: 0.1, tag: "GS", base: 0, mult: 50_000 }, { p: 0.5, tag: "S", base: 0, mult: 30_000 }, { p: 0.3, tag: "F", base: 0, mult: 4_000 }] },
    ],
    enhanced: [
      // evolves are jackpot-or-nothing per HEROES.md
      { tier: "abyss",  replaces: "flyswatter", id: "gravitas", key: "Q", name: "Gravitas", kind: "cast", base: 0, mult: 0, cooldownMs: 60_000,
        outcomes: [{ p: 0.1, tag: "GS", base: 0, mult: 75_000, resetsCooldowns: true }] },
      { tier: "trans",  replaces: "acidcloud", id: "electricrabbit", key: "W", name: "Florae Electric Rabbit", kind: "cast", base: 0, mult: 0, cooldownMs: 100_000,
        outcomes: [{ p: 0.1, tag: "GS", base: 0, mult: 110_000 }] },
      { tier: "awaken", id: "arsmagna", key: "M", name: "Ars Magna", kind: "cast", base: 0, mult: 0, cooldownMs: 300_000,
        outcomes: [{ p: 0.1, tag: "GS", base: 0, mult: 4_000_000 }] },
    ],
  },
  {
    id: "spectre",
    baseCooldownMs: 500, // w3u attack cooldown ("Jin: Blade")
    name: "Spectre",
    archetype: "active",
    desc: "Every skill hastens the trigger finger. Single targets fear her most.",
    skills: [
      { id: "doubleshot", key: "Q", name: "Double Shot",   kind: "proc", every: 9, base: 0, mult: 100 },
      // multi-target damage variants folded to single-target values (residue)
      { id: "blending",  key: "W", name: "Blending Pain",  kind: "cast", base: 0, mult: 900,    cooldownMs: 12_000, buff: { durationMs: 2_000, atkSpdPct: 30 } },
      { id: "shaker",    key: "E", name: "Shaker Blast",   kind: "cast", base: 0, mult: 6_000,  cooldownMs: 13_000, buff: { durationMs: 3_000, atkSpdPct: 30 } },
      { id: "lastorder", key: "R", name: "Last Order",     kind: "cast", base: 0, mult: 12_000, cooldownMs: 20_000, buff: { durationMs: 4_000, atkSpdPct: 30 } },
      { id: "trace",     key: "T", name: "Trace",          kind: "cast", base: 0, mult: 0,      cooldownMs: 60_000,
        buff: { durationMs: 35_000, autoRider: { base: 0, mult: 1_200 } } },
      { id: "showdown",  key: "F", name: "Showdown",       kind: "cast", base: 0, mult: 50_000, cooldownMs: 30_000, buff: { durationMs: 5_000, atkSpdPct: 30 } },
      { id: "daybreak",  key: "D", name: "Daybreak",       kind: "cast", base: 0, mult: 95_000, cooldownMs: 45_000, buff: { durationMs: 4_000, atkSpdPct: 30 } },
    ],
    enhanced: [
      { tier: "abyss",  replaces: "doubleshot", id: "professional", key: "Q", name: "Professional", kind: "proc", every: 60, base: 0, mult: 40_000 },
      { tier: "trans",  replaces: "blending", id: "catharsis", key: "W", name: "Catharsis", kind: "cast", base: 0, mult: 500_000, cooldownMs: 60_000 },
      { tier: "awaken", id: "testament", key: "M", name: "Testament", kind: "cast", base: 0, mult: 3_000_000, cooldownMs: 300_000 },
    ],
  },
  {
    id: "hekate",
    baseCooldownMs: 550, // w3u attack cooldown ("Hecate")
    name: "Hekate",
    archetype: "active",
    desc: "Affection as a weapon system. Solo, every buff is a self-buff.",
    skills: [
      // w3a: buffs run 600s (self-cast unlimited in source; 600s is close enough)
      { id: "curiosity", key: "Q", name: "Evil Curiosity",  kind: "cast", base: 0, mult: 0, cooldownMs: 10_000,
        buff: { durationMs: 600_000, intPctPerLevel: 50 } },
      // w3a: over 15M INT the buff drops to lvl×50% — capped pair
      { id: "favoritism", key: "W", name: "Favoritism",     kind: "cast", base: 0, mult: 0, cooldownMs: 1_000,
        buff: { durationMs: 600_000, intPctPerLevel: 500, intPctPerLevelCapped: 50, capInt: 15_000_000 } },
      { id: "forbiddencurse", key: "E", name: "Forbidden Curse", kind: "cast", base: 0, mult: 0, cooldownMs: 1_000,
        buff: { durationMs: 600_000, procMultPctBase: 8, procMultPctPerLevel: 3 } },
      { id: "hotaffection", key: "R", name: "Hot Affection", kind: "cast", base: 0, mult: 10_000, cooldownMs: 30_000, aoe: true, radius: 2.5 },
      { id: "loveemergency", key: "T", name: "Love Emergency Measures", kind: "cast", base: 0, mult: 0, cooldownMs: 1_000,
        buff: { durationMs: 600_000, intPctBase: 5, intPctPerLevel: 2 } },
      { id: "marionette", key: "F", name: "Marionette",     kind: "cast", base: 0, mult: 30_000, cooldownMs: 40_000, aoe: true, radius: 2.5 },
      { id: "dollforest", key: "D", name: "Forest of Dolls", kind: "cast", base: 0, mult: 50_000, cooldownMs: 60_000, aoe: true, radius: 2.5 },
    ],
    enhanced: [
      { tier: "abyss",  replaces: "curiosity", id: "possession", key: "Q", name: "Eternal Possession", kind: "cast", base: 0, mult: 0, cooldownMs: 1_000,
        buff: { durationMs: 600_000, addDmgPctPerLevel: 50 } },
      // skill-crit component of the source buff is undecoded — atk% part only
      { tier: "trans",  replaces: "favoritism", id: "transfavoritism", key: "W", name: "-Transcendence- Favoritism", kind: "cast", base: 0, mult: 0, cooldownMs: 1_000,
        buff: { durationMs: 600_000, atkPctBase: 4, atkPctPerLevel: 1.5 } },
      { tier: "awaken", id: "finale", key: "M", name: "Finale", kind: "cast", base: 0, mult: 2_000_000, cooldownMs: 300_000, aoe: true, radius: 4 },
    ],
  },
  {
    id: "ashtarte",
    baseCooldownMs: 500, // w3u attack cooldown ("Ashtoreth")
    name: "Ashtarte",
    archetype: "active",
    desc: "Spear tempo: cast rhythm feeds Chaser procs and long war-trances.",
    skills: [
      { id: "wedge",     key: "Q", name: "Wedge",           kind: "cast", base: 140, mult: 140, cooldownMs: 6_000 },
      // AoE finisher component (lvl×(INT×200)+20000) folded out — main hit only
      { id: "brainattack", key: "W", name: "Brain Attack",  kind: "cast", base: 50_000, mult: 900, cooldownMs: 10_000 },
      { id: "chaser",    key: "E", name: "Chaser",          kind: "proc", procChance: 0.12, base: 40_000, mult: 650 },
      { id: "teana",     key: "R", name: "Teana Transformation", kind: "cast", base: 0, mult: 0, cooldownMs: 75_000,
        buff: { durationMs: 41_000, autoRider: { base: 0, mult: 500 } } },
      { id: "martialartist", key: "T", name: "Civilian and Martial Artist", kind: "proc", every: 1, base: 0, mult: 280 },
      { id: "chaserevo", key: "F", name: "Chaser Evolution", kind: "cast", base: 0, mult: 0, cooldownMs: 75_000,
        buff: { durationMs: 41_000, procRider: { target: "chaser", base: 0, mult: 3_000 } } },
      // w3a: +attack speed value is trigger-applied and undecoded — duration only
      { id: "apostolate", key: "D", name: "Apostolate",     kind: "cast", base: 0, mult: 0, cooldownMs: 150_000,
        buff: { durationMs: 48_000, perLevelMs: 3_000 } },
    ],
    enhanced: [
      { tier: "abyss",  replaces: "wedge", id: "apostledance", key: "Q", name: "Dance of the Apostles", kind: "cast", base: 0, mult: 300_000, cooldownMs: 50_000 },
      { tier: "trans",  replaces: "brainattack", id: "wargoddess", key: "W", name: "Goddess of the Battlefield", kind: "cast", base: 0, mult: 0, cooldownMs: 75_000,
        buff: { durationMs: 41_000, autoRider: { base: 0, mult: 4_000 }, procChanceAdd: { target: "chaser", add: 0.40 } } },
      { tier: "awaken", id: "extition", key: "M", name: "Extition", kind: "cast", base: 0, mult: 13_200_000, cooldownMs: 300_000 },
    ],
  },
  {
    id: "necromancer",
    baseCooldownMs: 580, // w3u attack cooldown ("Jin: The Necromancer")
    name: "Necromancer",
    archetype: "active",
    desc: "Raise Vallacre, then the real spellbook opens.",
    skills: [
      { id: "darknail",  key: "Q", name: "Dark Nail",       kind: "proc", procChance: 0.05, base: 100, mult: 100 },
      { id: "soullure",  key: "W", name: "Soul Lure",       kind: "proc", procChance: 0.03, base: 600, mult: 600, aoe: true, radius: 1.5 },
      // ponytail: minion = clone rider; Black Web 1.5%×INT×800 folded to EV mult 12
      { id: "rapport",   key: "E", name: "Nicholas Rapport", kind: "cast", base: 0, mult: 0, cooldownMs: 60_000,
        buff: { durationMs: 60_000, clones: 1, cloneRider: { base: 0, mult: 12 } } },
      { id: "blackwave", key: "R", name: "Black Wave",      kind: "cast", base: 0, mult: 5_000, cooldownMs: 25_000, aoe: true, radius: 2.5 },
      // stance enabler; duration unstated — matches its 40s cooldown (continuous upkeep)
      { id: "vallacre",  key: "T", name: "Vallacre the Slaughterer", kind: "cast", base: 0, mult: 0, cooldownMs: 40_000,
        buff: { durationMs: 40_000, autoRider: { base: 0, mult: 170 } } },
      { id: "phantomstorm", key: "F", name: "Phantom Storm", kind: "cast", base: 0, mult: 7_000, cooldownMs: 19_000, aoe: true, radius: 4, requiresBuff: "vallacre" },
      { id: "vallacreinc", key: "D", name: "Vallacre Incarnation", kind: "cast", base: 0, mult: 38_000, cooldownMs: 39_000, requiresBuff: "vallacre",
        buff: { durationMs: 10_000, atkSpdPct: 20 } },
    ],
    enhanced: [
      { tier: "abyss",  replaces: "darknail", id: "guillotine", key: "Q", name: "Guillotine", kind: "cast", base: 0, mult: 60_000, cooldownMs: 39_000 },
      // ponytail: proc% unstated — inherits the base W slot's 3%
      { tier: "trans",  replaces: "soullure", id: "executioner", key: "W", name: "Executioner Slash", kind: "proc", procChance: 0.03, base: 0, mult: 25_000 },
      { tier: "awaken", id: "moros", key: "M", name: "Primordial Fear: Moros", kind: "cast", base: 0, mult: 3_000_000, cooldownMs: 300_000 },
    ],
  },
  {
    id: "darkknight",
    baseCooldownMs: 580, // w3u attack cooldown
    name: "Dark Knight",
    archetype: "passive",
    desc: "Borrowed steel: each proc casts Blood Evil, Indra, or Omniblade's craft.",
    skills: [
      { id: "combo1", key: "Q", name: "Combo I",   kind: "proc", procChance: 0.05,  base: 100, mult: 100 },
      // ponytail: HEROES.md gives only the 2.7%→0.5% endpoints — linear ramp
      { id: "combo2", key: "W", name: "Combo II",  kind: "proc", procChance: 0.027,  base: 0, mult: 1, borrow: { tier: 1 } },
      { id: "combo3", key: "E", name: "Combo III", kind: "proc", procChance: 0.0226, base: 0, mult: 1, borrow: { tier: 2 } },
      { id: "combo4", key: "R", name: "Combo IV",  kind: "proc", procChance: 0.0182, base: 0, mult: 1, borrow: { tier: 3 } },
      { id: "combo5", key: "T", name: "Combo V",   kind: "proc", procChance: 0.0138, base: 0, mult: 1, borrow: { tier: 4 } },
      { id: "combo6", key: "F", name: "Combo VI",  kind: "proc", procChance: 0.0094, base: 0, mult: 1, borrow: { tier: 5 } },
      { id: "combo7", key: "D", name: "Combo VII", kind: "proc", procChance: 0.005,  base: 0, mult: 1, borrow: { tier: 6 } },
    ],
    enhanced: [
      // ponytail: SQ/SW combo chances unstated — base-slot chances kept
      { tier: "abyss",  replaces: "combo1", id: "sqcombo", key: "Q", name: "SQ Combo", kind: "proc", procChance: 0.05, base: 0, mult: 1, borrow: { enhanced: 0 } },
      { tier: "trans",  replaces: "combo2", id: "swcombo", key: "W", name: "SW Combo", kind: "proc", procChance: 0.027, base: 0, mult: 1, borrow: { enhanced: 1 } },
      // Time Strike (INT×12M) + Time Explosion (INT×2M) folded to one 14M hit
      { tier: "awaken", id: "endoftime", key: "M", name: "The End of Time", kind: "proc", procChance: 0.05, base: 0, mult: 14_000_000, cooldownMs: 300_000, aoe: true, radius: 4 },
    ],
  },
];

export const getClass = id => classes.find(c => c.id === id);

// Does `skill` answer to `id`? Evolved replacements answer to the base id
// they replaced (procBoost/procRider targets keep working post-evolution).
export const matchesSkill = (skill, id) => skill.id === id || skill.replaces === id;

// Geniewiz outcome roll: outcomes = [{p, tag, base, mult, ...}] in order
// (GS/S/F); remaining probability mass = total miss (0 damage). gsMult scales
// the FIRST (jackpot) entry's chance — the Brush class weapon's "success rate".
export function rollOutcome(outcomes, gsMult = 1, rng = Math.random) {
  let r = rng();
  for (let i = 0; i < outcomes.length; i++) {
    const p = outcomes[i].p * (i === 0 ? gsMult : 1);
    if (r < p) return outcomes[i];
    r -= p;
  }
  return null; // major failure
}

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
