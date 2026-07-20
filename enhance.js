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
// buffs: { doubleChance, freeAttempts, okTickets } — crafted enhancement aids.
// okTickets = confirmation ticket: 100% success, ticket consumed, copper still
// paid (map OK-item behavior) — but NOT in the 0.45% band: guaranteed +16→+20
// let a 30-minute gathering session hand out endgame stat tables that were
// balanced around 0.45% rarity (reduction-pass abuse fix; the ticket is left
// unconsumed and the roll proceeds normally). mult = the Luck multiplier.
// Returns { result: "success" | "fail" | "max" | "poor", chance }
export const OK_TICKET_MAX_PLUS = 15; // tickets force +N→+N+1 only for N ≤ this
export function tryEnhance(state, eq, def, rng = Math.random, buffs = null, mult = 1) {
  // per-item cap: equipment +20, talismans/insignia +6 (tier table length)
  const cap = def.tiers ? def.tiers.length - 1 : MAX_PLUS;
  if (eq.plus >= cap) return { result: "max", chance: 0 };

  const free = buffs?.freeAttempts > 0;
  const cost = free ? 0 : def.enhCost;
  if (state.copper < cost) return { result: "poor", chance: 0 };

  if (free) buffs.freeAttempts--;
  state.copper -= cost;

  let chance;
  if (buffs?.okTickets > 0 && eq.plus <= OK_TICKET_MAX_PLUS) {
    buffs.okTickets--;
    chance = 1; // doubleChance untouched — ticket wins outright
  } else {
    chance = enhanceChance(eq.plus);
    if (buffs?.doubleChance > 0) {
      chance = Math.min(1, chance * 2);
      buffs.doubleChance--;
    }
    chance = Math.min(1, chance * mult);
  }

  if (rng() < chance) {
    eq.plus++;
    return { result: "success", chance };
  }
  return { result: "fail", chance };
}

// Avatar reinforcement bands (map eJx/aqx), keyed by level enhanced FROM.
// Softer than weapons: +0→+3 guaranteed, then 24/9/1.2/0.3.
export function avatarChance(plus) {
  if (plus < 4) return 1;
  if (plus < 7) return 0.24;
  if (plus < 11) return 0.09;
  if (plus < 16) return 0.012;
  return 0.003;
}

// One avatar attempt: def.enhCost copper on the softer avatar bands (souls
// were cut in the reduction pass — copper is the only cost). Confirmation
// ticket + Luck mult apply here too (map checks the OK item in this path).
export function tryAvatarEnhance(state, eq, def, rng = Math.random, buffs = null, mult = 1) {
  if (eq.plus >= def.tiers.length - 1) return { result: "max", chance: 0 };
  if (state.copper < def.enhCost) return { result: "poor", chance: 0 };
  state.copper -= def.enhCost;
  let chance;
  if (buffs?.okTickets > 0 && eq.plus <= OK_TICKET_MAX_PLUS) {
    buffs.okTickets--;
    chance = 1;
  } else {
    chance = Math.min(1, avatarChance(eq.plus) * mult);
  }
  if (rng() < chance) {
    eq.plus++;
    return { result: "success", chance };
  }
  return { result: "fail", chance };
}

// Talisman-family upgrade: 2×(+n) → 1×(+n+1). Free, deterministic,
// cap def.tiers.length - 1 (+6). Mutates bag (removes the partner).
export function tryMerge(bag, idx, def) {
  const a = bag[idx];
  if (!a) return "no-pair";
  if (a.plus >= def.tiers.length - 1) return "max";
  const j = bag.findIndex((b, k) => k !== idx && b.itemId === a.itemId && b.plus === a.plus);
  if (j === -1) return "no-pair";
  bag.splice(j, 1);
  a.plus++;
  return "merged";
}
