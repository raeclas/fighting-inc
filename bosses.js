// bosses.js
// Summonable bosses. Cost copper to summon, refund with interest on kill.
// skillIndex: which class-skill slot this boss's ticket teaches/levels.
//
// drops: { bountyTier, bounty, itemChance, pool: [itemIds], rare?: {chance, itemId} }
//   — decoded from the map's Epx() drop calls. Bounty tiers are literal
//   currency tiers: paid amount = bounty × 1e9^tier copper (tier 1 = silver,
//   tier 2 = gold — the display currency split makes this visible).
// regenPct: fraction of max HP healed per second (decompiled w3u ground
//   truth). The 1.0 bosses are DPS walls: full heal per second — you cannot
//   hurt them until your DPS exceeds their regen. That IS the gate.
export const INTEREST = 1.5;          // kill refund = summonCost * INTEREST
export const TICKET_CHANCE = 0.25;    // ticket drop chance per kill
export const TICKET_SUCCESS = 0.05;   // ticket level-up success (100% if skill unknown)

export const bosses = [
  {
    id: "hellparty", name: "Hell Party",
    hp: 50_000, defense: 100, summonCost: 20_000, xp: 5_000,
    skillIndex: 1, regenPct: 0.005,
    drops: { bountyTier: 0, bounty: 5_000, itemChance: 0.15, pool: ["rosetta", "partyhat"] },
  },
  {
    id: "anton", name: "Anton",
    hp: 500_000, defense: 500, summonCost: 100_000, xp: 30_000,
    skillIndex: 2, regenPct: 0.01,
    drops: { bountyTier: 0, bounty: 250_000, itemChance: 0.15, pool: ["kneecap", "refinedlumen"] },
  },
  {
    id: "luke", name: "Luke",
    hp: 5_000_000, defense: 2_000, summonCost: 500_000, xp: 150_000,
    skillIndex: 3, regenPct: 0.005,
    drops: { bountyTier: 0, bounty: 2_000_000, itemChance: 0.08, pool: ["rosetta2"] },
  },
  {
    id: "harlem", name: "Harlem Hell Party",
    hp: 50_000_000, defense: 8_000, summonCost: 2_000_000, xp: 800_000,
    skillIndex: null, regenPct: 0.08,
    drops: { bountyTier: 0, bounty: 20_000_000, itemChance: 0.08, pool: ["globetrophy"] },
  },

  // ---- decompiled roster ladder (regenPct = source regen/HP ratio) ----
  {
    id: "abysswalker", name: "The Abyss Walker",
    hp: 150_000_000, defense: 15_000, summonCost: 8_000_000, xp: 2_500_000,
    skillIndex: 4, regenPct: 0,
    drops: { bountyTier: 0, bounty: 60_000_000, itemChance: 0.09, pool: ["globetrophy", "siroccoheart"] },
  },
  {
    id: "sirocco", name: "Sirocco",
    hp: 500_000_000, defense: 30_000, summonCost: 20_000_000, xp: 6_000_000,
    skillIndex: 4, regenPct: 0.07,
    drops: { bountyTier: 0, bounty: 150_000_000, itemChance: 0.08, pool: ["siroccoheart"] },
  },
  {
    id: "taibers", name: "Taibers",
    hp: 1_500_000_000, defense: 60_000, summonCost: 60_000_000, xp: 15_000_000,
    skillIndex: 5, regenPct: 0.25,
    drops: { bountyTier: 0, bounty: 470_000_000, itemChance: 0.06, pool: ["heavenstaff", "heavenspear", "samsara"] },
  },
  {
    id: "fiendwar", name: "Fiend War",
    hp: 3_000_000_000, defense: 90_000, summonCost: 120_000_000, xp: 30_000_000,
    skillIndex: 6, regenPct: 0.30,
    drops: { bountyTier: 0, bounty: 1_000_000_000, itemChance: 0.06, pool: ["heavenstaff", "heavenspear", "samsara"] },
  },
  {
    id: "ozma", name: "Ozma",
    hp: 5_000_000_000, defense: 120_000, summonCost: 200_000_000, xp: 50_000_000,
    skillIndex: 5, regenPct: 0,
    drops: { bountyTier: 0, bounty: 2_000_000_000, itemChance: 0.08, pool: ["ozmabrand"] },
  },
  {
    id: "berias", name: "Berias of Destruction",
    hp: 15_000_000_000, defense: 250_000, summonCost: 600_000_000, xp: 120_000_000,
    skillIndex: 4, regenPct: 0,
    drops: { bountyTier: 0, bounty: 6_000_000_000, itemChance: 0.06, pool: ["ozmabrand", "blackstaff"] },
  },
  {
    id: "prey", name: "Prey",
    hp: 30_000_000_000, defense: 350_000, summonCost: 1_200_000_000, xp: 250_000_000,
    skillIndex: 6, regenPct: 1.0, // the first full-heal wall
    drops: { bountyTier: 1, bounty: 80, itemChance: 0.02, pool: ["blackstaff", "blackswan", "blackflame"] },
  },
  {
    id: "tiamat", name: "Tiamat",
    hp: 50_000_000_000, defense: 500_000, summonCost: 2_000_000_000, xp: 400_000_000,
    skillIndex: 6, regenPct: 0,
    drops: { bountyTier: 1, bounty: 30, itemChance: 0.08, pool: ["tiamatcurse"] },
  },
  {
    id: "hyunfindwar", name: "-Hyun- Find War",
    hp: 150_000_000_000, defense: 900_000, summonCost: 6_000_000_000, xp: 1_000_000_000,
    skillIndex: 5, regenPct: 1.0,
    drops: { bountyTier: 1, bounty: 312, itemChance: 0.02, pool: ["hyunclouds", "transwisdom", "transjustice"],
             rare: { chance: 0.0015, itemId: "talisman" } },
  },
  {
    id: "queendestroyer", name: "Queen Destroyer",
    hp: 300_000_000_000, defense: 1_500_000, summonCost: 12_000_000_000, xp: 2_000_000_000,
    skillIndex: 4, regenPct: 0,
    drops: { bountyTier: 1, bounty: 700, itemChance: 0.06, pool: ["hyunclouds", "transwisdom", "transjustice"] },
  },
  {
    id: "astaroth", name: "Astaroth",
    hp: 500_000_000_000, defense: 2_000_000, summonCost: 20_000_000_000, xp: 3_000_000_000,
    skillIndex: 5, regenPct: 0,
    drops: { bountyTier: 1, bounty: 1_200, itemChance: 0.08, pool: ["astarothgrim", "timewatch"] },
  },
  {
    id: "astaroth2", name: "Astaroth the Terror",
    hp: 1_500_000_000_000, defense: 4_000_000, summonCost: 60_000_000_000, xp: 8_000_000_000,
    skillIndex: 6, regenPct: 0.07,
    drops: { bountyTier: 1, bounty: 4_000, itemChance: 0.06, pool: ["astarothgrim", "timewatch", "lunabene"] },
  },
  {
    id: "spirazzi", name: "Spirazzi the Serpent",
    hp: 3_000_000_000_000, defense: 6_000_000, summonCost: 120_000_000_000, xp: 15_000_000_000,
    skillIndex: 4, regenPct: 0,
    drops: { bountyTier: 1, bounty: 8_000, itemChance: 0.06, pool: ["lunabene", "youngchang"] },
  },
  {
    id: "ezra", name: "Prophet Ezra",
    hp: 5_000_000_000_000, defense: 8_000_000, summonCost: 200_000_000_000, xp: 25_000_000_000,
    skillIndex: null, regenPct: 0.45, // raid-variant regen from the map
    drops: { bountyTier: 1, bounty: 15_000, itemChance: 0.08, pool: ["ezraprophecy"] },
  },
  {
    id: "luton", name: "Big Adult Luton",
    hp: 15_000_000_000_000, defense: 15_000_000, summonCost: 500_000_000_000, xp: 60_000_000_000,
    skillIndex: 5, regenPct: 0,
    drops: { bountyTier: 1, bounty: 40_000, itemChance: 0.06, pool: ["youngchang", "abyssroots"] },
  },
  {
    id: "transfrey", name: "-Transcendence- Frey",
    hp: 30_000_000_000_000, defense: 25_000_000, summonCost: 1_000_000_000_000, xp: 120_000_000_000,
    skillIndex: 6, regenPct: 1.0,
    drops: { bountyTier: 1, bounty: 100_000, itemChance: 0.02, pool: ["abyssroots", "abyssend", "abyssmadness"],
             rare: { chance: 0.003, itemId: "talisman" } },
  },
  {
    id: "baekhwa", name: "Baekhwa Mandarin",
    hp: 100_000_000_000_000, defense: 60_000_000, summonCost: 3_000_000_000_000, xp: 300_000_000_000,
    skillIndex: null, regenPct: 1.0,
    drops: { bountyTier: 1, bounty: 400_000, itemChance: 0.06, pool: ["lunabene", "youngchang", "mythroar"],
             rare: { chance: 0.015, itemId: "mythroar" } },
  },
  {
    id: "ezraabyss", name: "Ezra, Engulfed in the Abyss",
    hp: 300_000_000_000_000, defense: 120_000_000, summonCost: 8_000_000_000_000, xp: 800_000_000_000,
    skillIndex: null, regenPct: 0.07,
    drops: { bountyTier: 1, bounty: 1_500_000, itemChance: 0.06, pool: ["abyssroots", "abyssend", "abyssmadness"],
             rare: { chance: 0.0108, itemId: "transtalisman" } },
  },
  {
    id: "hisma", name: "Hisma the Light Dragon",
    hp: 1_000_000_000_000_000, defense: 300_000_000, summonCost: 20_000_000_000_000, xp: 2_000_000_000_000,
    skillIndex: null, regenPct: 0,
    drops: { bountyTier: 2, bounty: 15, itemChance: 0.02, pool: ["lightscale"] },
  },
  {
    id: "skasa", name: "Cold Dragon Skasa",
    hp: 3_000_000_000_000_000, defense: 600_000_000, summonCost: 50_000_000_000_000, xp: 5_000_000_000_000,
    skillIndex: null, regenPct: 0,
    drops: { bountyTier: 2, bounty: 40, itemChance: 0.02, pool: ["frostfang"] },
  },

  // ---- INT-gated specials (free challenge, respawn timers) ----
  {
    id: "bernardo", name: "Bernardo",
    hp: 100_000_000, defense: 20_000, summonCost: 0, xp: 10_000_000,
    reqInt: 100_000, respawnMs: 18 * 60_000, regenPct: 0,
    skillIndex: null,
    drops: { bountyTier: 0, bounty: 50_000_000, itemChance: 0.08, pool: ["siroccoheart"] },
  },
  {
    id: "bernardo2", name: "Transcendence Bernardo",
    hp: 500_000_000, defense: 100_000, summonCost: 0, xp: 60_000_000,
    reqInt: 500_000, respawnMs: 24 * 60_000, regenPct: 0,
    skillIndex: null,
    drops: { bountyTier: 0, bounty: 300_000_000, itemChance: 0.08, pool: ["ozmabrand"] },
  },
  {
    id: "seria", name: "Seria",
    hp: 1_500_000_000, defense: 300_000, summonCost: 0, xp: 200_000_000,
    reqInt: 1_500_000, respawnMs: 30 * 60_000, regenPct: 0,
    skillIndex: null,
    drops: { bountyTier: 0, bounty: 1_000_000_000, itemChance: 0.08, pool: ["tiamatcurse", "timewatch"] },
  },
  {
    id: "librarykeeper", name: "The Library Keeper of Memory",
    hp: 50_000_000_000_000, defense: 40_000_000, summonCost: 0, xp: 200_000_000_000,
    reqInt: 5_000_000, respawnMs: 25 * 60_000, regenPct: 0,
    skillIndex: null,
    drops: { bountyTier: 1, bounty: 250_000, itemChance: 0.06, pool: ["abyssend", "abyssmadness"],
             rare: { chance: 0.01, itemId: "talisman" } },
  },
  {
    id: "trialgiver", name: "The One Who Gives Trials",
    hp: 500_000_000_000_000, defense: 200_000_000, summonCost: 0, xp: 1_000_000_000_000,
    reqInt: 15_000_000, respawnMs: 30 * 60_000, regenPct: 0,
    skillIndex: null,
    drops: { bountyTier: 2, bounty: 5, itemChance: 0.04, pool: ["lightscale", "frostfang"],
             rare: { chance: 0.01, itemId: "transtalisman" } },
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
    // regen as a fraction of max HP per second; the 1.0 walls full-heal —
    // out-DPS it or the bar doesn't move (decompile-faithful gate)
    regen: boss.hp * (boss.regenPct ?? 0.005),
    copper: Math.round(boss.summonCost * INTEREST),
    xp: boss.xp,
    isBoss: true,
  };
}
