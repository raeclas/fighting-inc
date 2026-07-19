// zones.js
// Hunting grounds. Each zone has one mob type and three difficulty
// variants (1x / 5x / 20x) that scale its stats and rewards.
export const VARIANTS = [1, 5, 20];

// Money bags: the source map drops these at 0.15% on regular kills (×lobby
// multipliers we don't have), and GUARANTEED from field bosses. We lack the
// party multipliers, so 0.5% keeps regular bags a rare tease without them.
// ponytail: 0.5% is a playable stand-in for 0.15%×IV×YJ; retune if IV lands.
export const BAG_CHANCE = 0.005;

// Copper/bag from the wiki; hp1x/def from the DECOMPILED map (see DECOMPILE.md).
// Real 1x HP is exact up to Terranium then WC3 clamps at 1e9, so past that we
// extrapolate the map's own hp-per-copper trend (~666×) instead of the clamp.
// xp is ours (income has no source-game analogue). Variants: 5x mob = 5× hp,
// 20x = 20× hp — matches the map exactly.
// intPerKill: flat +damage the account earns from later zones (0 early). This
// is the post-gear scaling lever — the source drips INT from the mid zones on.
const mk = (id, mobName, copper, bag, hp1x, def, intPerKill = 0) => ({
  id, mobName, copper, bag, intPerKill,
  hp: hp1x,
  defense: def,
  regen: 0,                   // map mobs are one-shot fodder; regen is a future per-zone knob
  xp: Math.max(10, copper),   // level pace tracks income
});

// Original worksite/worker names (source zone names deliberately not copied);
// copper/bag/hp/def are the decompiled ground-truth values.
export const zones = [
  mk("kiln",    "Kiln-Ash Drudge",       2,             30,          200,        0,   0),
  mk("slag",    "Slagworks Grunt",       52,            1_200,       8_000,      5,   0),
  mk("rift",    "Riftseam Picker",       1_799,         48_000,      400_000,    20,  0),
  mk("loam",    "Loamgrave Hauler",      179_999,       5e6,         40_000_000, 50,  1),
  // past here the map clamps hp at 1e9; extrapolate hp ≈ copper × 666, def from map
  mk("market",  "Nightmarket Runner",    1_199_999,     28e6,        8e8,        90,  10),
  mk("spire",   "Spireworks Apprentice", 119_999_992,   2e9,         8e10,       160, 100),
  mk("warpit",  "Warpit Conscript",      35e9,          300e9,       23e12,      600, 1_000),
  mk("tempest", "Tempest Dredger",       1_079e9,       9_000e9,     720e12,     720, 10_000),
  mk("prism",   "Prismvault Sentry",     16_199e9,      135_000e9,   10.8e15,    800, 100_000),
  mk("sorrow",  "Sorrowlode Breaker",    1_619_999e9,   13.5e15,     1.08e18,    800, 1e6),
  mk("aurum",   "Aurum Vault Warden",    119_999_992e9, 1e18,        80e18,      800, 1e7),
];

export function getZone(zoneId) {
  return zones.find(z => z.id === zoneId);
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
    name: m > 1 ? `${zone.mobName} (${m}x)` : zone.mobName,
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
    name: m > 1 ? `${zone.mobName} Foreman (${m}x)` : `${zone.mobName} Foreman`,
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
