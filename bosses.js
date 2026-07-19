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
    copper: Math.round(boss.summonCost * INTEREST),
    xp: boss.xp,
    isBoss: true,
  };
}
