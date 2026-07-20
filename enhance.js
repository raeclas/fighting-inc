// enhance.js
// The heart of the game: pay copper, roll, probably fail.
// Failure keeps the current plus (source-game behavior) but the copper is gone.
export const MAX_PLUS = 20;

// Bands decompiled from the source map (war3map.j ~73896), keyed by the level
// you enhance FROM. Wiki was wrong on the +10–15 band (said 2.1%, map is 1.8%).
export function enhanceChance(plus) {
  if (plus < 4) return 1;      // +0→+3 guaranteed
  if (plus < 7) return 0.3;    // +4→+6
  if (plus < 11) return 0.12;  // +7→+10
  if (plus < 16) return 0.018; // +11→+15
  return 0.0045;               // +16→+19
}

// One attempt. Mutates state.copper, eq.plus, and (if provided) buffs.
// buffs: { doubleChance: n, freeAttempts: n } — crafted enhancement aids.
// Returns { result: "success" | "fail" | "max" | "poor", chance }
export function tryEnhance(state, eq, def, rng = Math.random, buffs = null) {
  // per-item cap: equipment +20, talismans/insignia +6 (tier table length)
  const cap = def.tiers ? def.tiers.length - 1 : MAX_PLUS;
  if (eq.plus >= cap) return { result: "max", chance: 0 };

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
