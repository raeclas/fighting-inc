// classes.js
// Class definitions. Active classes cast skills manually (Q/W/E/R, cooldowns).
// Passive classes roll each skill's proc chance on every auto-attack.
// You start knowing only the first skill; the rest come from boss tickets.
export const classes = [
  {
    id: "striker",
    name: "Striker",
    archetype: "active",
    desc: "Cast skills yourself with Q/W/E/R. Big damage, big cooldowns. Wrists optional.",
    skills: [
      { id: "jab",     key: "Q", name: "Lightning Jab",       mult: 5,   cooldownMs: 2000 },
      { id: "kick",    key: "W", name: "Cyclone Kick",        mult: 15,  cooldownMs: 6000 },
      { id: "barrage", key: "E", name: "Fist Barrage",        mult: 40,  cooldownMs: 15000 },
      { id: "nuke",    key: "R", name: "One Inch Apocalypse", mult: 150, cooldownMs: 60000 },
    ],
  },
  {
    id: "overmind",
    name: "Overmind",
    archetype: "passive",
    desc: "Skills fire themselves on a tiny chance per attack. Hands never touch the keyboard.",
    skills: [
      { id: "spark",    name: "Psychic Spark", procChance: 0.10,  mult: 5 },
      { id: "surge",    name: "Mind Surge",    procChance: 0.04,  mult: 15 },
      { id: "storm",    name: "Synapse Storm", procChance: 0.015, mult: 40 },
      { id: "collapse", name: "Ego Collapse",  procChance: 0.004, mult: 150 },
    ],
  },
];

export const getClass = id => classes.find(c => c.id === id);

export const MAX_SKILL_LEVEL = 7;

// Skill damage scales off the player's current effective attack.
export function skillDamage(skill, level, atk) {
  return Math.round(skill.mult * atk * (1 + 0.5 * (level - 1)));
}
