// gathering.js
// Non-combat skills. One activity runs at a time, alongside combat.
// Resources craft into enhancement aids — gathering feeds the +20 grind.
export const ACTIVITIES = {
  mining:  { resource: "ore",  verb: "Mine", gerund: "Mining",  noun: "Ore" },
  fishing: { resource: "fish", verb: "Fish", gerund: "Fishing", noun: "Fish" },
};

export const HAMMER_ORE_COST = 5;      // 1 Blessed Hammer: next enhance has 2x chance
export const OFFERING_FISH_COST = 5;   // 1 Greasy Offering: next enhance costs 0c

export function tickIntervalMs(level) {
  return Math.round(5000 * 0.97 ** (level - 1));
}

export function xpToNext(level) {
  return level * 50;
}

export function defaultGathering() {
  return {
    activity: null,
    xp: { mining: 0, fishing: 0 },
    level: { mining: 1, fishing: 1 },
    resources: { ore: 0, fish: 0 },
    nextTickAt: 0,
    buffs: { doubleChance: 0, freeAttempts: 0 },
  };
}
