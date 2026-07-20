// zones.js
// Hunting grounds. Each zone has one mob type and three difficulty
// variants (1x / 5x / 20x) that scale its stats and rewards.
export const VARIANTS = [1, 5, 20];

// Money bags: source base rate 0.15% on regular kills (×IV/YJ lobby
// multipliers — those arrive with the party-mult/elixir roadmap item),
// GUARANTEED from field bosses.
export const BAG_CHANCE = 0.0015;

// Copper/bag from the wiki; hp1x/def from the DECOMPILED map (see DECOMPILE.md).
// Real 1x HP is exact up to Terranium then WC3 clamps at 1e9, so past that we
// extrapolate the map's own hp-per-copper trend (~666×) instead of the clamp.
// xp is ours (income has no source-game analogue). Variants: 5x mob = 5× hp,
// 20x = 20× hp — matches the map exactly.
// intPerKill: the source's per-kill INT drip (wiki Hunting Grounds — advanced
// zones give +1..+20 INT per kill; small numbers, that's the point: INT gates
// in the millions are earned one kill at a time).
// gates (wiki Hunting Grounds, see GROUND-TRUTH.md): reqLevel/reqInt to enter,
// lockAfterLevel/lockAfterInt = source "No Entry after X" anti-boosting
// lockouts, intCapAt = "No INT after X" (the drip stops, entry stays).
const mk = (id, name, copper, bag, hp1x, def, intPerKill = 0, gates = {}) => ({
  id, name, mobName: name, copper, bag, intPerKill,
  hp: hp1x,
  defense: def,
  regen: 0,                   // map mobs are one-shot fodder; regen is a future per-zone knob
  xp: Math.max(10, copper),   // level pace tracks income
  ...gates,
});

// Source zone names; copper/bag/hp/def are the decompiled ground-truth values.
export const zones = [
  mk("kiln",    "Fallen Temple",  2,             30,          200,        0,   0,  { lockAfterLevel: 100 }),
  mk("slag",    "Magtonium",      52,            1_200,       8_000,      5,   0,  { lockAfterInt: 1_000 }),
  mk("rift",    "Otherverse",     1_799,         48_000,      400_000,    20,  0,  { reqLevel: 70, lockAfterInt: 5_000 }),
  mk("loam",    "Terranium",      179_999,       5e6,         40_000_000, 50,  0),
  // past here the map clamps hp at 1e9; extrapolate hp ≈ copper × 666, def from map
  mk("market",  "Harlem Dungeon", 1_199_999,     28e6,        8e8,        90,  1,  { reqLevel: 2_750, lockAfterInt: 200_000 }),
  mk("spire",   "Luke Raid",      119_999_992,   2e9,         8e10,       160, 2,  { reqInt: 75_000, lockAfterInt: 250_000 }),
  mk("warpit",  "Fiend War",      35e9,          300e9,       23e12,      600, 3,  { reqInt: 400_000, intCapAt: 2e6 }),
  mk("tempest", "Stormy Route",   1_079e9,       9_000e9,     720e12,     720, 15, { reqInt: 700_000, intCapAt: 2e6 }),
  mk("prism",   "Aiolite",        16_199e9,      135_000e9,   10.8e15,    800, 4,  { reqInt: 1.6e6, intCapAt: 15e6 }),
  mk("sorrow",  "Ore of Despair", 1_619_999e9,   13.5e15,     1.08e18,    800, 20, { reqInt: 4e6, intCapAt: 15e6 }),
  mk("aurum",   "Golden Beryl",   119_999_992e9, 1e18,        80e18,      800, 10, { reqInt: 15.5e6, intCapAt: 75e6 }),
];

export function getZone(zoneId) {
  return zones.find(z => z.id === zoneId);
}

// One gate check shared by UI, selectZone, and the sim.
// Returns a reason string when locked, else null.
export function zoneLocked(zone, player) {
  if (zone.reqLevel && player.level < zone.reqLevel) return `requires level ${zone.reqLevel}`;
  if (zone.reqInt && player.int < zone.reqInt) return `requires ${zone.reqInt.toLocaleString("en-US")} INT`;
  if (zone.lockAfterLevel && player.level > zone.lockAfterLevel) return `No Entry after level ${zone.lockAfterLevel}`;
  if (zone.lockAfterInt && player.int >= zone.lockAfterInt) return `No Entry after ${zone.lockAfterInt.toLocaleString("en-US")} INT`;
  return null;
}

// "No INT after X": the drip stops once the character outgrows the ground.
export function intDrip(zone, player) {
  if (zone.intCapAt && player.int >= zone.intCapAt) return 0;
  return zone.intPerKill;
}

// A hunting ground is a fixed grid of individual mobs. Single-target attacks
// hit one; AoE skills hit everything within their grid-radius of the target.
// This is what makes radius (and AoE heroes) matter without an RTS engine —
// it's a circle-vs-grid distance test, no movement/AI.
export const FIELD_COLS = 4;
export const FIELD_ROWS = 4;

export function spawnField(zone, variantIndex) {
  const field = [];
  for (let gy = 0; gy < FIELD_ROWS; gy++) {
    for (let gx = 0; gx < FIELD_COLS; gx++) {
      const m = spawnMob(zone, variantIndex);
      m.gx = gx;
      m.gy = gy;
      field.push(m);
    }
  }
  return field;
}

export function gridDist(a, b) {
  return Math.hypot((a.gx ?? 0) - (b.gx ?? 0), (a.gy ?? 0) - (b.gy ?? 0));
}

export function spawnMob(zone, variantIndex) {
  const m = VARIANTS[variantIndex];
  return {
    zoneId: zone.id,
    variant: variantIndex,
    name: `${m} laps of ${zone.name}`, // source mob naming ("1 laps", sic)
    hp: zone.hp * m,
    maxHp: zone.hp * m,
    defense: zone.defense * m,
    regen: zone.regen * m,
    copper: zone.copper * m,
    bag: zone.bag * m,
    xp: zone.xp * m,
    intPerKill: zone.intPerKill * m,
  };
}

// Field boss: the decompiled "N laps Boss" — a pre-placed elite standing in
// each zone. 10× mob HP, 20× XP, and a GUARANTEED fat bag (20× the mob bag);
// gives no per-kill coin, matching the map.
export const FIELD_BOSS_HP_MULT = 10;
export const FIELD_BOSS_XP_MULT = 20;
export const FIELD_BOSS_BAG_MULT = 20;
export const FIELD_BOSS_SPAWN_CHANCE = 0.02; // per regular kill, a field boss wanders in

export function spawnFieldBoss(zone, variantIndex) {
  const m = VARIANTS[variantIndex];
  return {
    zoneId: zone.id,
    variant: variantIndex,
    name: `${zone.name} ${m} Laps Boss`, // source field-boss naming
    hp: zone.hp * m * FIELD_BOSS_HP_MULT,
    maxHp: zone.hp * m * FIELD_BOSS_HP_MULT,
    defense: zone.defense * m,
    regen: 0,
    copper: 0,
    bag: zone.bag * m * FIELD_BOSS_BAG_MULT,
    xp: zone.xp * m * FIELD_BOSS_XP_MULT,
    isFieldBoss: true,
  };
}
