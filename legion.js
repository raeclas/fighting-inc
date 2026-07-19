// legion.js
// MapleStory-style Legion board: every roster character past the mastery gate
// contributes its class's account-wide bonus, scaled by that character's INT.
// INT is unbounded, so bonuses grow on a log10 curve — modest by design, since
// INT already feeds flat damage directly (tuning pass = rebuild step 7).

export const MASTERY_INT = 1000; // a character counts once its INT reaches this

// Per-class bonus table. `per` = % added per log10 step of (int/MASTERY_INT).
// Only playable classes are wired; add rows (and new stats) as classes land.
export const CLASS_BONUSES = {
  striker:  { stat: "atkSpeedPct", per: 4, label: "attack speed" },
  overmind: { stat: "skillDmgPct", per: 5, label: "skill damage" },
};

// % contributed by one character (0 below the gate / for unwired classes).
export function charBonus(char) {
  const b = CLASS_BONUSES[char.classId];
  if (!b || char.int < MASTERY_INT) return 0;
  return b.per * Math.log10(char.int / MASTERY_INT + 1);
}

// Character slots unlock at account-total INT milestones (×10 each step).
// [0] = the starting slot. No purchase path — INT is the only gate.
export const SLOT_MILESTONES = [0, 100e3, 1e6, 10e6, 100e6, 1e9, 10e9, 100e9, 1e12, 10e12];

export function accountInt(state) {
  return state.characters.reduce((sum, c) => sum + c.int, 0);
}

export function unlockedSlots(state) {
  const total = accountInt(state);
  return SLOT_MILESTONES.filter(m => total >= m).length;
}

// Summed account-wide multipliers from the whole roster (active char included).
export function legionBonuses(state) {
  const out = { atkSpeedPct: 0, skillDmgPct: 0 };
  for (const c of state.characters) {
    const b = CLASS_BONUSES[c.classId];
    if (b) out[b.stat] += charBonus(c);
  }
  return out;
}
