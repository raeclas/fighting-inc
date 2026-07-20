// feats.js
// ONE system for permanent account bonuses. Merged (design-reduction pass,
// 2026-07-20) from three parallel micro-bonus systems: achievements (+0.5%
// dmg each), boss first-kill trophies (dmg/drop/enh IV), and item-mastery
// stars (+0.5% dmg each). A feat is: an entry in FEATS below, a boss killed
// for the first time, or a mastery star (item-absorb milestone).
// featBonus(state) → { dmg, luck }: dmg adds to global damage, luck adds to
// the drop & enhance roll multiplier — surfaced as "Luck" in the UI.
// Earned FEATS entries persist under the legacy save key `state.achievements`;
// first-kill and star feats are derived from kills/mastery (no extra state).
import { bosses } from "./bosses.js";
import { MERGE_IDS, masteryStars } from "./items.js";

export const FEAT_DMG = 0.01;   // +1% global damage per feat
export const FEAT_LUCK = 0.002; // +0.2% Luck per feat (drop & enhance rolls)

const bossIds = new Set(bosses.map(b => b.id));
const chars = s => s.characters ?? [];
const anyChar = (s, f) => chars(s).some(f);
const anyItem = (s, f) =>
  anyChar(s, c => [...(c.equipment ?? []), ...(c.stash ?? [])].some(eq => eq && f(eq)));
const totalKills = s => {
  let n = 0;
  for (const k in s.kills ?? {}) n += s.kills[k];
  for (const k in s.fieldKills ?? {}) n += s.fieldKills[k];
  return n;
};

export const FEATS = [
  { id: "kills1k", name: "Numbers Guy", desc: "Defeat 1,000 enemies", check: s => totalKills(s) >= 1000 },
  { id: "kills100k", name: "Genocide Route", desc: "Defeat 100,000 enemies", check: s => totalKills(s) >= 100_000 },
  { id: "kills10m", name: "The Grind Never Stops", desc: "Defeat 10,000,000 enemies", check: s => totalKills(s) >= 10_000_000 },
  { id: "bossfirst", name: "Raid Boss", desc: "Defeat any boss", check: s => [...bossIds].some(id => (s.kills?.[id] ?? 0) >= 1) },
  { id: "fieldboss", name: "Wanderer Slain", desc: "Defeat a field boss", check: s => Object.values(s.fieldKills ?? {}).some(n => n >= 1) },
  { id: "int100k", name: "Big Brain", desc: "Reach 100,000 INT on one character", check: s => anyChar(s, c => c.int >= 100_000) },
  { id: "int1m", name: "Galaxy Brain", desc: "Reach 1,000,000 INT on one character", check: s => anyChar(s, c => c.int >= 1_000_000) },
  { id: "int100m", name: "Enhancement Slave", desc: "Reach 100,000,000 INT on one character", check: s => anyChar(s, c => c.int >= 100_000_000) },
  { id: "lvl100", name: "Century", desc: "Reach level 100", check: s => anyChar(s, c => c.level >= 100) },
  { id: "lvl1000", name: "Four Digits", desc: "Reach level 1,000", check: s => anyChar(s, c => c.level >= 1000) },
  { id: "plus10", name: "Double Digits", desc: "Enhance an item to +10", check: s => anyItem(s, eq => eq.plus >= 10) },
  { id: "plus15", name: "Against the Odds", desc: "Enhance an item to +15", check: s => anyItem(s, eq => eq.plus >= 15) },
  { id: "plus20", name: "The 0.45% Club", desc: "Enhance an item to +20", check: s => anyItem(s, eq => eq.plus >= 20) },
  { id: "merged", name: "Fusion Dance", desc: "Merge a talisman", check: s => anyChar(s, c => (c.specialBag ?? []).some(eq => MERGE_IDS.has(eq.itemId) && eq.plus > 0)) },
  { id: "gather10", name: "Blue Collar", desc: "Mining and Fishing both Lv10", check: s => (s.gathering?.level?.mining ?? 0) >= 10 && (s.gathering?.level?.fishing ?? 0) >= 10 },
  { id: "roster2", name: "Legion of Two", desc: "Create a second character", check: s => chars(s).length >= 2 },
  { id: "mastery1", name: "Connoisseur", desc: "Absorb a duplicate into item mastery", check: s => anyChar(s, c => Object.values(c.mastery ?? {}).some(n => n >= 1)) },
  { id: "silver", name: "First Silver", desc: "Hold 1 silver (1e9 copper) on one character", check: s => anyChar(s, c => c.copper >= 1e9) },
];

// one feat per boss defeated at least once
export function firstKillFeats(state) {
  let n = 0;
  for (const b of bosses) if ((state.kills?.[b.id] ?? 0) >= 1) n++;
  return n;
}

// mastery stars across the whole roster — each star is a feat
export function starFeats(state) {
  return chars(state).reduce((s, c) => s + masteryStars(c.mastery), 0);
}

export function featCount(state) {
  return Object.keys(state.achievements ?? {}).length
    + firstKillFeats(state) + starFeats(state);
}

export function featBonus(state) {
  const n = featCount(state);
  return { dmg: n * FEAT_DMG, luck: n * FEAT_LUCK };
}

// Run un-earned FEATS checks; mark earned ones; return the newly earned defs.
// (First-kill and star feats are derived — nothing to evaluate.)
export function evalFeats(state) {
  const earned = [];
  for (const a of FEATS) {
    if (state.achievements[a.id]) continue;
    if (a.check(state)) {
      state.achievements[a.id] = true;
      earned.push(a);
    }
  }
  return earned;
}
