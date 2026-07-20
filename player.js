// player.js
// Character factory + leveling functions. Characters are plain data objects
// living in gameState.characters; main.js binds `player` to the active one.
export function newCharacter() {
  return {
    health: 100,
    maxHealth: 100,

    // combat stats
    attack: 5,          // meaningful base so the first mob (200 hp) isn't a 200s slog
    attackSpeed: 1000,  // ms between attacks
    lastAttack: 0,      // transient, not saved

    // leveling (source XP curve: NeedHeroXPFormulaB=150 → next = 150 × level)
    level: 1,
    xp: 0,
    xpToNext: 150,

    // per-character resources: each roster character farms and spends its
    // own copper and grinds its own INT.
    int: 0,     // flat 1:1 damage (decompiled formula)
    copper: 0,

    // 6 item slots, each null or {itemId, plus}
    equipment: [null, null, null, null, null, null],

    // overflow storage for drops when all 6 slots are full (no ground chests here)
    stash: [],

    // special items (rings/necklaces/talismans/insignia/aura): bag, not the 6 slots
    specialBag: [],

    // avatar-enhancement souls: "100 years old" (Seria) / "Brilliant Sarah" (Library)
    souls: { old: 0, brilliant: 0 },

    // zone-jar inventory (FLOAT counts: live kills +1, offline EV +kills×chance;
    // UI floors, opening needs ≥1) + potion counts and active-buff expiries
    jars: {},
    potions: { int: 0, prob: 0 },
    potionUntil: { int: 0, prob: 0 }, // absolute total_time — survives reload

    // class + known skills (skillId -> level 1..7)
    classId: null,
    skills: {},
  };
}

// Source hero growth (w3u, uniform): per level STR +0, AGI +0.1, INT +1.
// AGI feeds attack speed in effectiveStats (AgiAttackSpeedBonus, +400% cap);
// it is derived from level, not stored.
export const MAX_LEVEL = 5000; // misc.txt MaxHeroLevel

export function gainXP(char, amount) {
  char.xp += amount;
  while (char.level < MAX_LEVEL && char.xp >= char.xpToNext) {
    char.xp -= char.xpToNext;
    levelUp(char);
  }
}

function levelUp(char) {
  char.level++;
  char.xpToNext = 150 * char.level;
  char.int += 1; // uinp — symbolic next to kill-INT, but it's the source's
}

// Source (war3mapmisc.txt): AgiAttackSpeedBonus=500 PER AGI POINT with base
// AGI 1 — the WC3 +400% cap is saturated from level 1. AGI growth (0.1/level,
// 500 at cap) is cosmetic in the map; every hero swings at baseCooldown÷5.
export function agiSpeedPct(char) {
  return 400;
}

export function resetHealth(char) {
  char.health = char.maxHealth;
}
