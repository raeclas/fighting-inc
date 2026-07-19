// enhance.js
// The heart of the game: pay copper, roll, probably fail.
// Failure keeps the current plus (source-game behavior) but the copper is gone.
export const MAX_PLUS = 20;

export function enhanceChance(plus) {
  if (plus < 3) return 1;
  if (plus < 7) return 0.3;
  if (plus < 10) return 0.12;
  if (plus < 15) return 0.021;
  return 0.0045;
}

// One attempt. Mutates state.copper, eq.plus, and (if provided) buffs.
// buffs: { doubleChance: n, freeAttempts: n } — crafted enhancement aids.
// Returns { result: "success" | "fail" | "max" | "poor", chance }
export function tryEnhance(state, eq, def, rng = Math.random, buffs = null) {
  if (eq.plus >= MAX_PLUS) return { result: "max", chance: 0 };

  const free = buffs?.freeAttempts > 0;
  const cost = free ? 0 : def.enhCost;
  if (state.copper < cost) return { result: "poor", chance: 0 };

  if (free) buffs.freeAttempts--;
  state.copper -= cost;

  let chance = enhanceChance(eq.plus);
  if (buffs?.doubleChance > 0) {
    chance = Math.min(1, chance * 2);
    buffs.doubleChance--;
  }

  if (rng() < chance) {
    eq.plus++;
    return { result: "success", chance };
  }
  return { result: "fail", chance };
}
