// bosses.js
// Summonable bosses. Cost copper to summon, refund with interest on kill.
//
// Source-fidelity pass (see internal/GROUND-TRUTH.md):
// - skillIndex = which skill slot this boss's ticket teaches/levels, matching
//   the source ladder: Hell Party=Q(0), Anton=W(1), Luke=E(2), Harlem=R(3),
//   Taibers=T(4), Fiend War=F(5), Prey/-Hyun-/-Transcendence-=D(6).
// - drops: { itemChance, bountyTier, bounty, rare? } — JASS Epx solo values.
//   bounty paid every kill = bounty × 1e9^bountyTier copper. Item pool is
//   poolFor(bossId) from itemdata.js (the real w3t pools). The skill ticket
//   drops ALONGSIDE a successful item roll (source behavior), 5% upgrade.
// regenPct: fraction of max HP healed per second (w3u ground truth). The 1.0
//   bosses are DPS walls: full heal per second — that IS the gate.
export const INTEREST = 1.5;        // kill refund = summonCost * INTEREST
export const TICKET_SUCCESS = 0.05; // ticket level-up success (100% if unknown)

// First kills are FEATS (feats.js): each boss's first kill = +1% dmg +0.2%
// Luck, derived straight from gameState.kills. The 10× bounty burst on kill
// #1 lives in main.js resolveKill.

// Enhanced-skill evolution: a deterministic kill-count ladder (replaced the
// old random ticket drops in the reduction pass — same EV pacing, kills per
// level ≈ 1/source dispatch chance, visible progress instead of a lottery).
// Skill level = min(MAX_SKILL_LEVEL, floor(kills[boss] / kills)).
export const EVOLUTION = {
  abyss:  { boss: "bernardo",   kills: 53 },  // 1/0.01875
  trans:  { boss: "bernardo2",  kills: 133 }, // 1/0.0075
  awaken: { boss: "trialgiver", kills: 667 }, // 1/0.0015
};

const S = 1, GOLD = 2; // bounty tiers (0 = copper)

export const bosses = [
  {
    id: "hellparty", name: "Hell Party",
    hp: 50_000, defense: 100, summonCost: 20_000, xp: 5_000,
    skillIndex: 0, regenPct: 0.005,
    drops: { itemChance: 0.04, bountyTier: 0, bounty: 5_500 },
  },
  {
    id: "anton", name: "Anton",
    hp: 500_000, defense: 500, summonCost: 100_000, xp: 30_000,
    skillIndex: 1, regenPct: 0.01,
    drops: { itemChance: 0.03, bountyTier: 0, bounty: 150_000 },
  },
  {
    id: "luke", name: "Luke",
    hp: 5_000_000, defense: 2_000, summonCost: 500_000, xp: 150_000,
    skillIndex: 2, regenPct: 0.005,
    drops: { itemChance: 0.02, bountyTier: 0, bounty: 250_000 },
  },
  {
    id: "harlem", name: "Harlem Hell Party",
    hp: 50_000_000, defense: 8_000, summonCost: 2_000_000, xp: 800_000,
    skillIndex: 3, regenPct: 0.08,
    drops: { itemChance: 0.02, bountyTier: 0, bounty: 7_000_000 },
  },

  // ---- decompiled roster ladder (regenPct = source regen/HP ratio) ----
  {
    id: "abysswalker", name: "The Abyss Walker",
    hp: 150_000_000, defense: 15_000, summonCost: 8_000_000, xp: 2_500_000,
    skillIndex: null, regenPct: 0,
    drops: { itemChance: 0.02, bountyTier: GOLD, bounty: 9, rare: { chance: 0.01, itemId: "insignia" } },
  },
  {
    id: "sirocco", name: "Sirocco",
    hp: 500_000_000, defense: 30_000, summonCost: 20_000_000, xp: 6_000_000,
    skillIndex: null, regenPct: 0.07,
    drops: { itemChance: 0.02, bountyTier: S, bounty: 81_000, rare: { chance: 0.012, itemId: "transtalisman" } },
  },
  {
    id: "taibers", name: "Taibers",
    hp: 1_500_000_000, defense: 60_000, summonCost: 60_000_000, xp: 15_000_000,
    skillIndex: 4, regenPct: 0.25,
    drops: { itemChance: 0.02, bountyTier: 0, bounty: 170_000_000 },
  },
  {
    id: "fiendwar", name: "Fiend War",
    hp: 3_000_000_000, defense: 90_000, summonCost: 120_000_000, xp: 30_000_000,
    skillIndex: 5, regenPct: 0.30,
    drops: { itemChance: 0.02, bountyTier: S, bounty: 1 },
  },
  {
    id: "ozma", name: "Ozma",
    hp: 5_000_000_000, defense: 120_000, summonCost: 200_000_000, xp: 50_000_000,
    skillIndex: null, regenPct: 0,
    drops: { itemChance: 0.02, bountyTier: S, bounty: 600_000_000, rare: { chance: 0.001, itemId: "insignia" } },
  },
  {
    id: "berias", name: "Berias of Destruction",
    hp: 15_000_000_000, defense: 250_000, summonCost: 600_000_000, xp: 120_000_000,
    skillIndex: null, regenPct: 0,
    drops: { itemChance: 0.02, bountyTier: S, bounty: 200_000_000, rare: { chance: 0.001, itemId: "insignia" } },
  },
  {
    id: "prey", name: "Prey",
    hp: 30_000_000_000, defense: 350_000, summonCost: 1_200_000_000, xp: 250_000_000,
    skillIndex: 6, regenPct: 1.0, // the first full-heal wall
    drops: { itemChance: 0.02, bountyTier: S, bounty: 30 },
  },
  {
    id: "tiamat", name: "Tiamat",
    hp: 50_000_000_000, defense: 500_000, summonCost: 2_000_000_000, xp: 400_000_000,
    skillIndex: null, regenPct: 0,
    drops: { itemChance: 0.02, bountyTier: S, bounty: 30_000_000, rare: { chance: 0.001, itemId: "insignia" } },
  },
  {
    id: "hyunfindwar", name: "-Hyun- Find War",
    hp: 150_000_000_000, defense: 900_000, summonCost: 6_000_000_000, xp: 1_000_000_000,
    skillIndex: 6, regenPct: 1.0,
    drops: { itemChance: 0.02, bountyTier: S, bounty: 72, rare: { chance: 0.0015, itemId: "talisman" } },
  },
  {
    id: "queendestroyer", name: "Queen Destroyer",
    hp: 300_000_000_000, defense: 1_500_000, summonCost: 12_000_000_000, xp: 2_000_000_000,
    skillIndex: null, regenPct: 0,
    drops: { itemChance: 0.02, bountyTier: S, bounty: 200_000_000, rare: { chance: 0.003, itemId: "insignia" } },
  },
  {
    id: "astaroth", name: "Astaroth",
    hp: 500_000_000_000, defense: 2_000_000, summonCost: 20_000_000_000, xp: 3_000_000_000,
    skillIndex: null, regenPct: 0,
    drops: { itemChance: 0.02, bountyTier: S, bounty: 1_200_000, rare: { chance: 0.02, itemId: "transtalisman" } },
  },
  {
    id: "astaroth2", name: "Astaroth the Terror",
    hp: 1_500_000_000_000, defense: 4_000_000, summonCost: 60_000_000_000, xp: 8_000_000_000,
    skillIndex: null, regenPct: 0.07,
    drops: { itemChance: 0.02, bountyTier: S, bounty: 6_000_000, rare: { chance: 0.0005, itemId: "insignia" } },
  },
  {
    id: "spirazzi", name: "Spirazzi the Serpent",
    hp: 3_000_000_000_000, defense: 6_000_000, summonCost: 120_000_000_000, xp: 15_000_000_000,
    skillIndex: null, regenPct: 0,
    drops: { itemChance: 0.02, bountyTier: GOLD, bounty: 36, rare: { chance: 0.001, itemId: "brtalisman" } },
  },
  {
    id: "ezra", name: "Prophet Ezra",
    hp: 5_000_000_000_000, defense: 8_000_000, summonCost: 200_000_000_000, xp: 25_000_000_000,
    skillIndex: null, regenPct: 0.45, // raid-variant regen from the map
    drops: { itemChance: 0.02, bountyTier: S, bounty: 16_200, rare: { chance: 0.0015, itemId: "transtalisman" } },
  },
  {
    id: "luton", name: "Big Adult Luton",
    hp: 15_000_000_000_000, defense: 15_000_000, summonCost: 500_000_000_000, xp: 60_000_000_000,
    skillIndex: null, regenPct: 0,
    drops: { itemChance: 0.02, bountyTier: GOLD, bounty: 400 },
  },
  {
    id: "transfrey", name: "-Transcendence- Frey",
    hp: 30_000_000_000_000, defense: 25_000_000, summonCost: 1_000_000_000_000, xp: 120_000_000_000,
    skillIndex: 6, regenPct: 1.0,
    drops: { itemChance: 0.02, bountyTier: S, bounty: 900, rare: { chance: 0.003, itemId: "talisman" } },
  },
  {
    id: "baekhwa", name: "Baekhwa Mandarin",
    hp: 100_000_000_000_000, defense: 60_000_000, summonCost: 3_000_000_000_000, xp: 300_000_000_000,
    skillIndex: null, regenPct: 1.0,
    drops: { itemChance: 0.02, bountyTier: S, bounty: 2_700, rare: { chance: 0.005, pool: "baekhwamyth" } },
  },
  {
    id: "ezraabyss", name: "Ezra, Engulfed in the Abyss",
    hp: 300_000_000_000_000, defense: 120_000_000, summonCost: 8_000_000_000_000, xp: 800_000_000_000,
    skillIndex: null, regenPct: 0.07,
    drops: { itemChance: 0.02, bountyTier: S, bounty: 27_000, rare: { chance: 0.0036, itemId: "transtalisman" } },
  },
  {
    id: "hisma", name: "Hisma the Light Dragon",
    hp: 1_000_000_000_000_000, defense: 300_000_000, summonCost: 20_000_000_000_000, xp: 2_000_000_000_000,
    skillIndex: null, regenPct: 0,
    drops: { itemChance: 0.02, bountyTier: GOLD, bounty: 150 },
  },
  {
    id: "skasa", name: "Cold Dragon Skasa",
    hp: 3_000_000_000_000_000, defense: 600_000_000, summonCost: 50_000_000_000_000, xp: 5_000_000_000_000,
    skillIndex: null, regenPct: 0,
    drops: { itemChance: 0.02, bountyTier: GOLD, bounty: 60, rare: { chance: 0.003, itemId: "brtalisman" } },
  },

  // ★Abyss★ Formless Sirocco (map w3u nske variants): free summon, 20% of
  // summons spawn the elite twin whose drop rolls run at 3× (2%→6% pool).
  {
    id: "abyssirocco", name: "★Abyss★ Formless Sirocco",
    hp: 1_000_000_000, defense: 750, summonCost: 0, xp: 100_000_000,
    skillIndex: null, regenPct: 0.07,
    eliteChance: 0.20, eliteDropMult: 3,
    drops: { itemChance: 0.02, bountyTier: S, bounty: 243_000, rare: { chance: 0.02, itemId: "transtalisman" } },
  },

  // ---- INT-gated specials (free challenge, respawn timers) ----
  // Real source drops (war3map.j dispatch ~L103890, see internal/extract/):
  // gear pools via itemChance; evolutions moved to the EVOLUTION kill ladder.
  // "classWeapon" in a pool resolves to the active class's Abyss weapon.
  {
    id: "bernardo", name: "Bernardo",
    hp: 100_000_000, defense: 20_000, summonCost: 0, xp: 10_000_000,
    reqInt: 100_000, respawnMs: 18 * 60_000, regenPct: 0,
    skillIndex: null,
    drops: { itemChance: 0.0225, pool: ["bernardo_neck", "bernardo_ring", "classWeapon"],
             elixir: 0.02,
             intBounty: 1_500, // ~1.5% of reqInt per kill — INT-era heartbeat (OUR design)
             bountyTier: 0, bounty: 50_000_000 },
  },
  {
    id: "bernardo2", name: "Transcendence Bernardo",
    hp: 500_000_000, defense: 100_000, summonCost: 0, xp: 60_000_000,
    reqInt: 500_000, respawnMs: 24 * 60_000, regenPct: 0,
    skillIndex: null,
    drops: { itemChance: 0.0075, pool: ["bernardo2_staff", "bernardo2_ring", "bernardo2_neck"],
             elixir: 0.02,
             intBounty: 7_500,
             bountyTier: 0, bounty: 300_000_000 },
  },
  {
    id: "seria", name: "Seria",
    hp: 1_500_000_000, defense: 300_000, summonCost: 0, xp: 200_000_000,
    reqInt: 1_500_000, respawnMs: 30 * 60_000, regenPct: 0,
    skillIndex: null,
    drops: { itemChance: 0.003, pool: ["seria_weaponav", "seria_auraav", "seria_cloneav"],
             elixir: 0.02,
             intBounty: 20_000,
             bountyTier: 0, bounty: 1_000_000_000 },
  },
  {
    id: "librarykeeper", name: "The Library Keeper of Memory",
    hp: 50_000_000_000_000, defense: 40_000_000, summonCost: 0, xp: 200_000_000_000,
    reqInt: 5_000_000, respawnMs: 25 * 60_000, regenPct: 0,
    skillIndex: null,
    drops: { itemChance: 0.001, pool: ["lib_weaponav", "lib_cloneav", "lib_auraav"],
             elixir: 0.02,
             intBounty: 75_000,
             bountyTier: S, bounty: 250_000 },
  },
  {
    id: "trialgiver", name: "The One Who Gives Trials",
    hp: 500_000_000_000_000, defense: 200_000_000, summonCost: 0, xp: 1_000_000_000_000,
    reqInt: 15_000_000, respawnMs: 30 * 60_000, regenPct: 0,
    skillIndex: null,
    drops: { itemChance: 0.005, pool: ["trial_staff", "trial_ring", "trial_neck"],
             elixir: 0.02,
             intBounty: 200_000,
             bountyTier: GOLD, bounty: 5 },
  },
];

export const getBoss = id => bosses.find(b => b.id === id);

export function spawnBossMob(boss) {
  // Formless Sirocco: a fifth of summons are the elite twin (same stats, 3× drops)
  const elite = boss.eliteChance && Math.random() < boss.eliteChance;
  return {
    bossId: boss.id,
    elite,
    name: `${boss.name}${elite ? " ELITE" : ""} (BOSS)`,
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
