// bosses.js
// Summonable bosses. Cost copper to summon, refund with interest on kill,
// drop boss items and skill tickets at low rates (source-game style).
// skillIndex: which class-skill slot this boss's ticket teaches/levels.
export const INTEREST = 1.5;          // kill refund = summonCost * INTEREST
export const TICKET_CHANCE = 0.25;    // ticket drop chance per kill
export const TICKET_SUCCESS = 0.05;   // ticket level-up success (100% if skill unknown)
export const ITEM_DROP_CHANCE = 0.08; // per item per kill

export const bosses = [
  {
    id: "hellparty", name: "Hell Party",
    hp: 50_000, defense: 100, summonCost: 20_000, xp: 5_000,
    skillIndex: 1,
    itemIds: ["rosetta", "partyhat"],
  },
  {
    id: "anton", name: "Anton",
    hp: 500_000, defense: 500, summonCost: 100_000, xp: 30_000,
    skillIndex: 2,
    itemIds: ["kneecap", "refinedlumen"],
  },
  {
    id: "luke", name: "Luke",
    hp: 5_000_000, defense: 2_000, summonCost: 500_000, xp: 150_000,
    skillIndex: 3,
    itemIds: ["rosetta2"],
  },
  {
    id: "harlem", name: "Harlem Hell Party",
    hp: 50_000_000, defense: 8_000, summonCost: 2_000_000, xp: 800_000,
    skillIndex: null, // no ticket; pure loot boss
    itemIds: ["globetrophy"],
  },
  // decompiled roster, ×10 HP ladder continued (source HPs clamp at 1e9;
  // difficulty there is scripted — ours keeps the honest ladder)
  {
    id: "sirocco", name: "Sirocco",
    hp: 500_000_000, defense: 30_000, summonCost: 20_000_000, xp: 6_000_000,
    skillIndex: 4, // T-slot ticket
    itemIds: ["siroccoheart"],
  },
  {
    id: "ozma", name: "Ozma",
    hp: 5_000_000_000, defense: 120_000, summonCost: 200_000_000, xp: 50_000_000,
    skillIndex: 5, // F-slot ticket
    itemIds: ["ozmabrand"],
  },
  {
    id: "tiamat", name: "Tiamat",
    hp: 50_000_000_000, defense: 500_000, summonCost: 2_000_000_000, xp: 400_000_000,
    skillIndex: 6, // D-slot ticket
    itemIds: ["tiamatcurse"],
  },
  {
    id: "astaroth", name: "Astaroth",
    hp: 500_000_000_000, defense: 2_000_000, summonCost: 20_000_000_000, xp: 3_000_000_000,
    skillIndex: 5,
    itemIds: ["astarothgrim", "timewatch"],
  },
  {
    id: "ezra", name: "Prophet Ezra",
    hp: 5_000_000_000_000, defense: 8_000_000, summonCost: 200_000_000_000, xp: 25_000_000_000,
    skillIndex: null, // pure loot boss
    itemIds: ["ezraprophecy"],
  },
  // INT-gated specials (source: Bernardo 100k / Trans. 500k / Seria 1.5M INT,
  // 18–30 min respawns). Free to challenge; pay in patience. `bag` = the
  // guaranteed copper bounty on kill (they cost nothing to summon).
  {
    id: "bernardo", name: "Bernardo",
    hp: 100_000_000, defense: 20_000, summonCost: 0, xp: 10_000_000,
    reqInt: 100_000, respawnMs: 18 * 60_000, bag: 50_000_000,
    skillIndex: null,
    itemIds: ["siroccoheart"],
  },
  {
    id: "bernardo2", name: "Transcendence Bernardo",
    hp: 500_000_000, defense: 100_000, summonCost: 0, xp: 60_000_000,
    reqInt: 500_000, respawnMs: 24 * 60_000, bag: 300_000_000,
    skillIndex: null,
    itemIds: ["ozmabrand"],
  },
  {
    id: "seria", name: "Seria",
    hp: 1_500_000_000, defense: 300_000, summonCost: 0, xp: 200_000_000,
    reqInt: 1_500_000, respawnMs: 30 * 60_000, bag: 1_000_000_000,
    skillIndex: null,
    itemIds: ["tiamatcurse", "timewatch"],
  },
];

export const getBoss = id => bosses.find(b => b.id === id);

export function spawnBossMob(boss) {
  return {
    bossId: boss.id,
    name: `${boss.name} (BOSS)`,
    hp: boss.hp,
    maxHp: boss.hp,
    defense: boss.defense,
    regen: boss.hp / 200, // bosses regen; out-DPS it or go home
    copper: boss.bag ?? Math.round(boss.summonCost * INTEREST),
    xp: boss.xp,
    isBoss: true,
  };
}
