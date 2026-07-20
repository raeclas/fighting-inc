// gathering.js
// Non-combat skills. One activity runs at a time, alongside combat.
// Resources craft into enhancement aids — gathering feeds the +20 grind.
export const ACTIVITIES = {
  mining:  { resource: "ore",  verb: "Mine", gerund: "Mining",  noun: "Ore" },
  fishing: { resource: "fish", verb: "Fish", gerund: "Fishing", noun: "Fish" },
};

export const HAMMER_ORE_COST = 5;      // 1 Blessed Hammer: next enhance has 2x chance
export const OFFERING_FISH_COST = 5;   // 1 Greasy Offering: next enhance costs 0c
// ponytail: costs are OURS (map sold potions/tickets via event shop — no
// single-player analog); effect magnitudes stay source. Tune freely.
export const INT_POTION_FISH_COST = 10;   // 1 INT potion: +120% pure INT, 30min
export const PROB_POTION_ORE_COST = 10;   // 1 Probability potion: IV +25%, 30min
export const OK_TICKET_COST = { ore: 25, fish: 25 }; // guaranteed enhance at any band

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
    buffs: { doubleChance: 0, freeAttempts: 0, okTickets: 0 },
  };
}
