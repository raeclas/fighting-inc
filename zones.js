// zones.js
// Hunting grounds. Each zone has one mob type and three difficulty
// variants (1x / 5x / 20x) that scale its stats and rewards.
export const VARIANTS = [1, 5, 20];

// Wiki hunting grounds give per-kill copper only (WC3 mobs are fodder);
// hp/def/regen/xp are our difficulty curve derived from the coin value.
// hpMult tapers DOWN the ladder so copper-per-hp IMPROVES as you climb
// (0.10 → 0.25): every zone unlock is a real income jump per point of DPS.
// Money bags: rare bonus drop worth many kills — values from the wiki.
export const BAG_CHANCE = 0.05;

const mk = (id, mobName, copper, bag, hpMult, overrides = {}) => ({
  id, mobName, copper, bag,
  hp: copper * hpMult,
  defense: Math.round(copper * 0.5),
  regen: copper * hpMult / 100,
  xp: copper * 8,
  ...overrides,
});

// The source game's hunting grounds ("Labour" camps), ascending;
// per-kill copper and bag values straight from the wiki (1 silver = 1e9 copper).
export const zones = [
  mk("temple",        "Fallen Temple Labourer",   2,          30,        10, { defense: 0 }), // starter: must be killable at atk 1
  mk("magtonium",     "Magtonium Miner",          52,         1_200,     9),
  mk("otherverse",    "Otherverse Drone",         1_799,      48_000,    8),
  mk("terranium",     "Terranium Golem",          179_999,    5e6,       7),
  mk("harlemdungeon", "Harlem Delinquent",        1_199_999,  28e6,      6),
  mk("lukelab",       "Luke's Apprentice",        119_999_992, 2e9,      5.5),
  mk("fiendwar",      "Lesser Fiend",             35e9,       300e9,     5),
  mk("stormy",        "Storm Wisp",               1_079e9,    9_000e9,   4.8),
  mk("aiolite",       "Aiolite Sentinel",         16_199e9,   135_000e9, 4.5),
  mk("despairore",    "Despair Ore Sprite",       1_619_999e9, 13.5e15,  4.2),
  mk("goldenberyl",   "Beryl Guardian",           119_999_992e9, 1e18,   4),
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
