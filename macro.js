// macro.js
// The in-game macro workshop. In the source game everyone macroed externally;
// here it IS the progression system for active classes.
export const UNLOCK_COST = 50_000;
export const MAX_SLOTS = 4;
export const MAX_INTERVAL_LEVEL = 10;

export function intervalMs(level) {
  return Math.round(3000 * 0.85 ** level);
}

export function intervalUpgradeCost(level) {
  return 25_000 * 3 ** level;
}

// cost to buy slot number n (slots 1-2 free with unlock)
export function slotCost(n) {
  return 100_000 * (n - 2);
}

export function defaultMacro() {
  return { unlocked: false, enabled: false, intervalLevel: 0, slots: [null, null], nextAt: 0, ptr: 0 };
}
