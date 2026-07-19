// legion.js
// MapleStory-Legion-inspired prestige: retire a leveled character into the
// Legion; every retiree grants a permanent account-wide damage bonus.
// Copper, bestiary, gathering, and macro survive retirement — the character
// (class, level, skills, equipment) does not.
export const RETIRE_MIN_LEVEL = 35; // a full gear clear ends ~45; retiring must fit inside that
export const BONUS_PER_LEVEL = 0.002; // +0.2% damage per retired level

export function legionBonus(retired) {
  return retired.reduce((sum, r) => sum + r.level * BONUS_PER_LEVEL, 0);
}
