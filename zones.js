// zones.js
// Hunting grounds. Each zone has one mob type and three difficulty
// variants (1x / 5x / 20x) that scale its stats and rewards.
export const VARIANTS = [1, 5, 20];

// Wiki hunting grounds give per-kill copper only (WC3 mobs are fodder);
// hp/def/regen/xp are our difficulty curve derived from the coin value.
const mk = (id, mobName, copper) => ({
  id, mobName, copper,
  hp: copper * 10,
  defense: Math.round(copper * 0.5),
  regen: copper / 10,
  xp: copper * 8,
});

// Ascending by copper. Intro zones are ours; the rest are the source game's
// hunting grounds ("Labour" camps) with per-kill copper from the wiki.
export const zones = [
  {
    id: "slime",
    mobName: "Stupid Slime",
    hp: 10, defense: 0, regen: 0,
    copper: 1, xp: 10,
  },
  mk("temple", "Fallen Temple Labourer", 2),
  {
    id: "slime2",
    mobName: "Less Stupid Slime",
    hp: 25, defense: 1, regen: 0.5,
    copper: 3, xp: 25,
  },
  {
    id: "goblin",
    mobName: "Unpaid Goblin Intern",
    hp: 80, defense: 3, regen: 2,
    copper: 10, xp: 80,
  },
  mk("magtonium",     "Magtonium Miner",    52),
  mk("otherverse",    "Otherverse Drone",   1_799),
  mk("terranium",     "Terranium Golem",    179_999),
  mk("harlemdungeon", "Harlem Delinquent",  1_199_999),
  mk("lukelab",       "Luke's Apprentice",  119_999_992),
  mk("fiendwar",      "Lesser Fiend",       35e9),
  mk("stormy",        "Storm Wisp",         1_079e9),
  mk("aiolite",       "Aiolite Sentinel",   16_199e9),
  mk("despairore",    "Despair Ore Sprite", 1_619_999e9),
  mk("goldenberyl",   "Beryl Guardian",     119_999_992e9),
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
    xp: zone.xp * m,
  };
}
