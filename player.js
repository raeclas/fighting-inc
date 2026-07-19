// player.js
// Contains the player object, combat stats, leveling state,
// and player-centric methods like experience gain and leveling.
export const player = {
  health: 100,
  maxHealth: 100,

  // combat stats
  attack: 5,          // meaningful base so the first mob (200 hp) isn't a 200s slog
  attackSpeed: 1000,  // ms between attacks
  lastAttack: 0,

  // leveling
  level: 1,
  xp: 0,
  xpToNext: 100,

  // per-character resources (Legion rebuild): each roster character farms
  // and spends its own copper and grinds its own INT.
  int: 0,     // flat 1:1 damage (decompiled formula)
  copper: 0,

  // 6 item slots, each null or {itemId, plus}
  equipment: [null, null, null, null, null, null],

  // overflow storage for drops when all 6 slots are full (no ground chests here)
  stash: [],

  // class + known skills (skillId -> level 1..7)
  classId: null,
  skills: {},

  // methods
  takeDamage: function(amount) {
    this.health = Math.max(0, this.health - amount);
  },

  heal: function(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  },

  gainXP: function(amount) {
    this.xp += amount;
    this.checkLevelUp();
  },

  checkLevelUp: function() {
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.levelUp();
    }
  },

  levelUp: function() {
    this.level++;
    this.xpToNext = Math.floor(this.xpToNext * 1.5);
    this.attack += 1;
    // Haste front-loaded: big early gains de-torture the start (our idle
    // analogue of the map's AGI-from-leveling), tapering to a sane floor.
    const step = this.level <= 12 ? 35 : 10;
    this.attackSpeed = Math.max(100, this.attackSpeed - step);
  },

  reset: function() {
    this.health = this.maxHealth;
  }
};