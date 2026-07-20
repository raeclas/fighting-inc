// titles.js — identity layer (MapleStory medal import, reduction-era rules:
// derived from already-tracked state, no new counters, no obligation).
// Earned titles unlock forever; the chosen one is worn on the HUD plate and
// the Lobby board. player.title stores the chosen id (per character).
import { bosses } from "./bosses.js";

const chars = s => s.characters ?? [];
const anyChar = (s, f) => chars(s).some(f);
const bestPlus = s => {
  let p = 0;
  for (const c of chars(s))
    for (const eq of [...(c.equipment ?? []), ...(c.specialBag ?? [])])
      if (eq) p = Math.max(p, eq.plus);
  return p;
};
const firstKills = s => bosses.filter(b => (s.kills?.[b.id] ?? 0) >= 1).length;
const fieldKills = s => Object.values(s.fieldKills ?? {}).reduce((a, n) => a + n, 0);

export const TITLES = [
  { id: "slave",     name: "Enhancement Slave",  check: () => true }, // everyone's starter truth
  { id: "plus10",    name: "Double Digits",      check: s => bestPlus(s) >= 10 },
  { id: "plus15",    name: "Against the Odds",   check: s => bestPlus(s) >= 15 },
  { id: "plus20",    name: "The 0.45% Club",     check: s => bestPlus(s) >= 20 },
  { id: "slayer",    name: "Boss Slayer",        check: s => firstKills(s) >= 1 },
  { id: "regicide",  name: "Regicide",           check: s => firstKills(s) >= 10 },
  { id: "pantheon",  name: "Pantheon Cleared",   check: s => firstKills(s) >= 25 },
  { id: "bigbrain",  name: "Big Brain",          check: s => anyChar(s, c => c.int >= 100_000) },
  { id: "galaxy",    name: "Galaxy Brain",       check: s => anyChar(s, c => c.int >= 1_000_000) },
  { id: "transcend", name: "Transcendent",       check: s => anyChar(s, c => c.int >= 15_000_000) },
  { id: "bluecollar", name: "Blue Collar",       check: s => (s.gathering?.level?.mining ?? 0) >= 10 && (s.gathering?.level?.fishing ?? 0) >= 10 },
  { id: "foreman",   name: "Foreman",            check: s => (s.gathering?.level?.mining ?? 0) >= 30 && (s.gathering?.level?.fishing ?? 0) >= 30 },
  { id: "commander", name: "Legion Commander",   check: s => chars(s).length >= 4 },
  { id: "wandererbane", name: "Wanderer's Bane", check: s => fieldKills(s) >= 100 },
];

export const earnedTitles = s => TITLES.filter(t => t.check(s));

export function titleName(s, char) {
  const t = TITLES.find(t => t.id === char?.title);
  return t && t.check(s) ? t.name : null;
}
