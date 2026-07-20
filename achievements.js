// achievements.js
// Account achievements — bestiary's sibling: checks read ONLY already-tracked
// state (kills, characters, gathering, mastery), each earned one grants a
// permanent global damage bonus. Collection is power.
import { bosses } from "./bosses.js";
import { MERGE_IDS } from "./items.js";

export const ACHIEVEMENT_BONUS = 0.005; // +0.5% damage each

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

export const ACHIEVEMENTS = [
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

export function achievementBonus(state) {
  return Object.keys(state.achievements ?? {}).length * ACHIEVEMENT_BONUS;
}

// Run un-earned checks; mark earned ones; return the newly earned defs.
export function evalAchievements(state) {
  const earned = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id]) continue;
    if (a.check(state)) {
      state.achievements[a.id] = true;
      earned.push(a);
    }
  }
  return earned;
}
