// player.js
// Contains the player object, combat stats, leveling state,
// and player-centric methods like experience gain and leveling.
export const player = {
  health: 100,
  maxHealth: 100,

  // combat stats
  attack: 1,
  attackSpeed: 1000, // ms - 1 attack per second
  lastAttack: 0,

  // leveling
  level: 1,
  xp: 0,
  xpToNext: 100,

  // 6 item slots, each null or {itemId, plus}
  equipment: [null, null, null, null, null, null],

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
    // level up bonuses
    this.attack += 1;
    this.attackSpeed = Math.max(10, this.attackSpeed - 10); // faster, min 10ms
  },

  reset: function() {
    this.health = this.maxHealth;
  }
};