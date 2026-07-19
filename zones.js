// zones.js
// Hunting grounds. Each zone has one mob type and three difficulty
// variants (1x / 5x / 20x) that scale its stats and rewards.
export const VARIANTS = [1, 5, 20];

export const zones = [
  {
    id: "slime",
    mobName: "Stupid Slime",
    hp: 10, defense: 0, regen: 0,
    copper: 1, xp: 10,
  },
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
