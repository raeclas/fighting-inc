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

    // leveling
    level: 1,
    xp: 0,
    xpToNext: 100,

    // per-character resources: each roster character farms and spends its
    // own copper and grinds its own INT.
    int: 0,     // flat 1:1 damage (decompiled formula)
    copper: 0,

    // 6 item slots, each null or {itemId, plus}
    equipment: [null, null, null, null, null, null],

    // overflow storage for drops when all 6 slots are full (no ground chests here)
    stash: [],

    // class + known skills (skillId -> level 1..7)
    classId: null,
    skills: {},
  };
}

export function gainXP(char, amount) {
  char.xp += amount;
  while (char.xp >= char.xpToNext) {
    char.xp -= char.xpToNext;
    levelUp(char);
  }
}

function levelUp(char) {
  char.level++;
  char.xpToNext = Math.floor(char.xpToNext * 1.5);
  char.attack += 1;
  // Haste front-loaded: big early gains de-torture the start (our idle
  // analogue of the map's AGI-from-leveling), tapering to a sane floor.
  const step = char.level <= 12 ? 35 : 10;
  char.attackSpeed = Math.max(100, char.attackSpeed - step);
}

export function resetHealth(char) {
  char.health = char.maxHealth;
}
