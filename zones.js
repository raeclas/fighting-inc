// zones.js
// Hunting grounds. Each zone has one mob type and three difficulty
// variants (1x / 5x / 20x) that scale its stats and rewards.
export const VARIANTS = [1, 5, 20];

// Money bags: rare bonus drop worth many kills — values from the wiki.
export const BAG_CHANCE = 0.05;

// Copper/bag from the wiki; hp1x/def from the DECOMPILED map (see DECOMPILE.md).
// Real 1x HP is exact up to Terranium then WC3 clamps at 1e9, so past that we
// extrapolate the map's own hp-per-copper trend (~666×) instead of the clamp.
// xp is ours (income has no source-game analogue). Variants: 5x mob = 5× hp,
// 20x = 20× hp — matches the map exactly.
const mk = (id, mobName, copper, bag, hp1x, def) => ({
  id, mobName, copper, bag,
  hp: hp1x,
  defense: def,
  regen: 0,                   // map mobs are one-shot fodder; regen is a future per-zone knob
  xp: Math.max(10, copper),   // level pace tracks income
});

export const zones = [
  mk("temple",        "Fallen Temple Labourer", 2,             30,          200,        0),
  mk("magtonium",     "Magtonium Miner",        52,            1_200,       8_000,      5),
  mk("otherverse",    "Otherverse Drone",       1_799,         48_000,      400_000,    20),
  mk("terranium",     "Terranium Golem",        179_999,       5e6,         40_000_000, 50),
  // past here the map clamps hp at 1e9; extrapolate hp ≈ copper × 666, def from map
  mk("harlemdungeon", "Harlem Delinquent",      1_199_999,     28e6,        8e8,        90),
  mk("lukelab",       "Luke's Apprentice",      119_999_992,   2e9,         8e10,       160),
  mk("fiendwar",      "Lesser Fiend",           35e9,          300e9,       23e12,      600),
  mk("stormy",        "Storm Wisp",             1_079e9,       9_000e9,     720e12,     720),
  mk("aiolite",       "Aiolite Sentinel",       16_199e9,      135_000e9,   10.8e15,    800),
  mk("despairore",    "Despair Ore Sprite",     1_619_999e9,   13.5e15,     1.08e18,    800),
  mk("goldenberyl",   "Beryl Guardian",         119_999_992e9, 1e18,        80e18,      800),
];

export function getZone(zoneId) {
  return zones.find(z => z.id === zoneId);
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
  };
}
