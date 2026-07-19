// classes.js
// Class definitions. Active classes cast skills manually (Q/W/E/R, cooldowns).
// Passive classes roll each skill's proc chance on every auto-attack.
// You start knowing only the first skill; the rest come from boss tickets.
//
// aoe + radius: an AoE skill hits every mob within `radius` GRID units of its
// target on the 4×4 field (radius 1 ≈ 5 mobs, 1.5 ≈ 9, 2.5 ≈ 13, 4 ≈ all 16).
// Non-AoE skills hit the front mob only. This is the farm-vs-boss lever: wide
// skills clear fields fast; on a boss (a field of 1) that width is wasted.
// passive: the class's always-on stat skill (source: every hero has one).
// atkPct multiplies damage; atkSpdPct speeds attacks — folded into effectiveStats.
export const classes = [
  {
    id: "striker",
    name: "Striker",
    archetype: "active",
    desc: "Cast skills yourself with Q/W/E/R/T/F/D. Big damage, big cooldowns. Wrists optional.",
    passive: { name: "Equip Boxing Gloves", desc: "+20% attack speed", atkSpdPct: 20 },
    skills: [
      { id: "jab",      key: "Q", name: "Lightning Jab",             mult: 5,    cooldownMs: 2000 },
      { id: "kick",     key: "W", name: "Cyclone Kick",              mult: 15,   cooldownMs: 6000,   aoe: true, radius: 1.5 },
      { id: "barrage",  key: "E", name: "Fist Barrage",              mult: 40,   cooldownMs: 15000,  aoe: true, radius: 2.2 },
      { id: "nuke",     key: "R", name: "One Inch Apocalypse",       mult: 150,  cooldownMs: 60000,  aoe: true, radius: 4 },
      { id: "powfist",  key: "T", name: "Power Fist",                mult: 450,  cooldownMs: 120000 },
      { id: "kihop",    key: "F", name: "Kihop Low Kick",            mult: 1300, cooldownMs: 180000, aoe: true, radius: 2.2 },
      { id: "climax",   key: "D", name: "Empress's Climactic Fist",  mult: 4000, cooldownMs: 300000, aoe: true, radius: 2.5 },
    ],
  },
  {
    id: "overmind",
    name: "Overmind",
    archetype: "passive",
    desc: "Skills fire themselves on a tiny chance per attack. Flashy AoE — a field-clearing farmer.",
    passive: { name: "Psychic Focus", desc: "+20% attack power", atkPct: 20 },
    skills: [
      { id: "spark",    name: "Psychic Spark",     procChance: 0.10,   mult: 5 },
      { id: "surge",    name: "Mind Surge",        procChance: 0.04,   mult: 15,   aoe: true, radius: 1.5 },
      { id: "storm",    name: "Synapse Storm",     procChance: 0.015,  mult: 40,   aoe: true, radius: 2.5 },
      { id: "collapse", name: "Ego Collapse",      procChance: 0.004,  mult: 150,  aoe: true, radius: 4 },
      { id: "curtain",  name: "Elemental Curtain", procChance: 0.0015, mult: 450,  aoe: true, radius: 2.5 },
      { id: "gate",     name: "The Gate",          procChance: 0.0006, mult: 1300, aoe: true, radius: 4 },
      { id: "sesto",    name: "Sesto Elemental",   procChance: 0.0003, mult: 4000, aoe: true, radius: 4 },
    ],
  },
  // ponytail: the four proc-passives share Overmind's proc ladder; flavor =
  // AoE width vs single-target multiplier trade (wide pays a mult tax).
  {
    id: "omniblade",
    name: "Omniblade",
    archetype: "passive",
    desc: "Sword procs, all single-target, all huge. The boss executioner — fields bore it.",
    passive: { name: "Lightsword Mastery", desc: "+25% attack power", atkPct: 25 },
    skills: [
      { id: "ironstrike", name: "Ultimate Slay: Iron Strike", procChance: 0.10,   mult: 8 },
      { id: "overdrive",  name: "Overdrive",                  procChance: 0.04,   mult: 24 },
      { id: "drawsword",  name: "Draw Sword",                 procChance: 0.015,  mult: 64 },
      { id: "sworddance", name: "Illusion Sword Dance",       procChance: 0.004,  mult: 240 },
      { id: "mindsword",  name: "Omnislay: Mind's Sword",     procChance: 0.0015, mult: 720 },
      { id: "tempestslay", name: "Ultimate Slay: Tempest",    procChance: 0.0006, mult: 2080 },
      { id: "pentastrike", name: "Pentastrike",               procChance: 0.0003, mult: 6400 },
    ],
  },
  {
    id: "bloodevil",
    name: "Blood Evil",
    archetype: "passive",
    desc: "Everything explodes around you. The widest field-clearer in the game — bosses shrug.",
    passive: { name: "Bloodlust", desc: "+15% attack speed", atkSpdPct: 15 },
    skills: [
      { id: "gorecross",  name: "Gore Cross",       procChance: 0.10,   mult: 5 },
      { id: "ragingfury", name: "Raging Fury",      procChance: 0.04,   mult: 15,   aoe: true, radius: 2.5 },
      { id: "bloodsword", name: "Blood Sword",      procChance: 0.015,  mult: 40,   aoe: true, radius: 2.5 },
      { id: "bloodboom",  name: "Blood Boom",       procChance: 0.004,  mult: 150,  aoe: true, radius: 4 },
      { id: "outrage",    name: "Outrage Break",    procChance: 0.0015, mult: 450,  aoe: true, radius: 4 },
      { id: "overkill",   name: "Extreme Overkill", procChance: 0.0006, mult: 1300, aoe: true, radius: 4 },
      { id: "bloodriven", name: "Blood Riven",      procChance: 0.0003, mult: 4000, aoe: true, radius: 4 },
    ],
  },
  {
    id: "indra",
    name: "Indra",
    archetype: "passive",
    desc: "Waves on waves — steady mid-size AoE procs. The comfortable middle path.",
    passive: { name: "Wave Attunement", desc: "+15% attack power", atkPct: 15 },
    skills: [
      { id: "wavewheel",  name: "Wave Wheel Slasher", procChance: 0.10,   mult: 6 },
      { id: "waverad",    name: "Wave Radiation",     procChance: 0.04,   mult: 17,   aoe: true, radius: 1.5 },
      { id: "heatwave",   name: "Heat Wave Sword",    procChance: 0.015,  mult: 44,   aoe: true, radius: 1.5 },
      { id: "crescent",   name: "Spirit Crescent",    procChance: 0.004,  mult: 165,  aoe: true, radius: 1.5 },
      { id: "agni",       name: "Agni Pentacle",      procChance: 0.0015, mult: 495 },
      { id: "waveeye",    name: "Wave Eye",           procChance: 0.0006, mult: 1430, aoe: true, radius: 2.5 },
      { id: "thundergod", name: "Thunder God",        procChance: 0.0003, mult: 4400, aoe: true, radius: 2.5 },
    ],
  },
  {
    id: "vagabond",
    name: "Neo: Vagabond",
    archetype: "passive",
    desc: "A duelist's blade with the occasional explosion. Single-target lean, two wide finishers.",
    passive: { name: "Wanderer's Edge", desc: "+15% attack speed", atkSpdPct: 15 },
    skills: [
      { id: "soaring",    name: "Soaring",              procChance: 0.10,   mult: 7 },
      { id: "oppress",    name: "Oppressive Pressure",  procChance: 0.04,   mult: 20 },
      { id: "explsword",  name: "Explosive Sword",      procChance: 0.015,  mult: 52 },
      { id: "crosssword", name: "Cross Sword",          procChance: 0.004,  mult: 195 },
      { id: "blastpalm",  name: "Blasting Palm",        procChance: 0.0015, mult: 585,  aoe: true, radius: 1.5 },
      { id: "verdant",    name: "Verdant Blast",        procChance: 0.0006, mult: 1690 },
      { id: "moondance",  name: "Moonlight Dance",      procChance: 0.0003, mult: 5200, aoe: true, radius: 2.5 },
    ],
  },
  // ponytail: source buff/clone mechanics (Revolver Enhancement procs, Heavy
  // Weapons AoE autos, Doppelganger clones) modeled as stat passives / plain
  // casts — upgrade when buff timers land with the unique-mechanic batch.
  {
    id: "desperado",
    name: "Desperado",
    archetype: "active",
    desc: "Ranged revolver executions. Single targets die politely; crowds require reloading.",
    passive: { name: "Revolver Enhancement", desc: "+20% attack power", atkPct: 20 },
    skills: [
      { id: "windmill",  key: "Q", name: "Windmill",            mult: 6,    cooldownMs: 2000 },
      { id: "headshot",  key: "W", name: "Headshot",            mult: 19,   cooldownMs: 6000 },
      { id: "suppress",  key: "E", name: "Suppressive Barrage", mult: 50,   cooldownMs: 15000 },
      { id: "wildshot",  key: "R", name: "Wild Shot",           mult: 188,  cooldownMs: 60000,  aoe: true, radius: 1.5 },
      { id: "deathrev",  key: "T", name: "Death by Revolver",   mult: 563,  cooldownMs: 120000 },
      { id: "scud",      key: "F", name: "Scud Genocide",       mult: 1625, cooldownMs: 180000, aoe: true, radius: 1.5 },
      { id: "seventh",   key: "D", name: "Seventh Flow",        mult: 5000, cooldownMs: 300000 },
    ],
  },
  {
    id: "stormtrooper",
    name: "Storm Trooper",
    archetype: "active",
    desc: "Flamethrowers, lasers, quantum bombs. Trash mobs are a rounding error.",
    passive: { name: "Heavy Weapons Mastery", desc: "+15% attack speed", atkSpdPct: 15 },
    skills: [
      { id: "sidearm",   key: "Q", name: "Sidearm Snap",     mult: 4,    cooldownMs: 2000 },
      { id: "flamethrow", key: "W", name: "Flame Thrower",   mult: 12,   cooldownMs: 6000,   aoe: true, radius: 1.5 },
      { id: "laser",     key: "E", name: "Laser Rifle",      mult: 32,   cooldownMs: 15000,  aoe: true, radius: 1.5 },
      { id: "quantum",   key: "R", name: "Quantum Bomb",     mult: 120,  cooldownMs: 60000,  aoe: true, radius: 2.5 },
      { id: "miracle",   key: "T", name: "Miracle Vision",   mult: 360,  cooldownMs: 120000, aoe: true, radius: 2.5 },
      { id: "agenttrig", key: "F", name: "Agent Trigger",    mult: 1300, cooldownMs: 180000, aoe: true, radius: 4 },
      { id: "opraids",   key: "D", name: "Operation Raids",  mult: 4000, cooldownMs: 300000, aoe: true, radius: 4 },
    ],
  },
  {
    id: "nenempress",
    name: "Nen Empress",
    archetype: "active",
    desc: "Nen blasts and phantom clones (they're in your heart). Balanced caster.",
    passive: { name: "Khai", desc: "+15% attack speed", atkSpdPct: 15 },
    skills: [
      { id: "nenshot",   key: "Q", name: "Nen Shot",        mult: 5,    cooldownMs: 2000 },
      { id: "doppel",    key: "W", name: "Doppelganger",    mult: 15,   cooldownMs: 6000 },
      { id: "lionroar",  key: "E", name: "Lion's Roar",     mult: 40,   cooldownMs: 15000,  aoe: true, radius: 1.5 },
      { id: "energyshield", key: "R", name: "Energy Shield", mult: 150, cooldownMs: 60000,  aoe: true, radius: 2.5 },
      { id: "tigerflash", key: "T", name: "Tiger Flash",    mult: 450,  cooldownMs: 120000 },
      { id: "nenflower", key: "F", name: "Nen Flower",      mult: 1300, cooldownMs: 180000, aoe: true, radius: 2.5 },
      { id: "brilliant", key: "D", name: "Brilliant Nen",   mult: 4000, cooldownMs: 300000, aoe: true, radius: 4 },
    ],
  },
];

export const getClass = id => classes.find(c => c.id === id);

export const MAX_SKILL_LEVEL = 7;

// Skill damage scales off the player's current effective attack.
export function skillDamage(skill, level, atk) {
  return Math.round(skill.mult * atk * (1 + 0.5 * (level - 1)));
}
