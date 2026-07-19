// sim.js — deterministic progression simulator / balance tracker.
//
//   node sim.js            print the milestone timeline, write baseline.json
//   node sim.js --compare  diff current balance against baseline.json,
//                          exit 1 if any milestone drifted more than 25%
//
// Imports the REAL game modules, so any change to zones/items/enhance/bosses
// math shows up here. All randomness is replaced with expected value:
// enhancing to +N costs its expected copper, a boss item takes its expected
// number of kills. The bot plays the wiki-guide build as an Overmind
// (passive procs counted as EV damage). Not modeled: macros, gathering
// buffs, Legion retirement, active-class play.
import fs from "node:fs";
import { zones, VARIANTS, spawnMob, getZone } from "./zones.js";
import { getItem, statValue, aggregate } from "./items.js";
import { enhanceChance } from "./enhance.js";
import { bosses, getBoss, spawnBossMob, TICKET_CHANCE, ITEM_DROP_CHANCE } from "./bosses.js";
import { getClass, skillDamage } from "./classes.js";
import { bestiaryBonus } from "./bestiary.js";

const MAX_SIM_S = 365 * 86400;
const CLS = getClass("overmind");

///// player state /////
const P = {
  t: 0, copper: 0,
  level: 1, xpAcc: 0, xpToNext: 100,
  attack: 1, attackSpeed: 1000,
  equipment: [], // {itemId, plus}
  skills: { [CLS.skills[0].id]: 1 },
  kills: {},
};

const milestones = [];
function mark(desc) { milestones.push({ t: Math.round(P.t), desc }); }

///// math /////
function expectedEnhanceCost(def, from, to) {
  let c = 0;
  for (let k = from; k < to; k++) c += def.enhCost / enhanceChance(k);
  return c;
}

function gainXp(xp) {
  P.xpAcc += xp;
  while (P.xpAcc >= P.xpToNext) {
    P.xpAcc -= P.xpToNext;
    P.level++;
    P.xpToNext = Math.floor(P.xpToNext * 1.5);
    P.attack += 1;
    P.attackSpeed = Math.max(10, P.attackSpeed - 10);
  }
}

function stats() {
  const { atk, spdPct } = aggregate(P.equipment);
  const bonus = 1 + bestiaryBonus({ kills: P.kills });
  const A = Math.round((P.attack + atk) * bonus);
  const interval = P.attackSpeed / (1 + spdPct / 100) / 1000; // s per attack
  let procEV = 0; // skill procs ignore defense, same as the game
  for (const s of CLS.skills) {
    const lvl = P.skills[s.id];
    if (lvl) procEV += s.procChance * skillDamage(s, lvl, A);
  }
  return { atk: A, interval, procEV };
}

function dpsAgainst(mob) {
  const { atk, interval, procEV } = stats();
  return (Math.max(0, atk - mob.defense) + procEV) / interval - mob.regen;
}

// best zone×variant by copper/s; returns null if nothing farmable
function bestZoneRate() {
  let best = null;
  for (const z of zones) {
    for (let v = 0; v < VARIANTS.length; v++) {
      const mob = spawnMob(z, v);
      const dps = dpsAgainst(mob);
      if (dps <= 0) continue;
      const ttk = mob.maxHp / dps;
      const r = {
        zone: z, variant: v, name: mob.name,
        copperPerSec: mob.copper / ttk,
        xpPerSec: mob.xp / ttk,
        killsPerSec: 1 / ttk,
      };
      if (!best || r.copperPerSec > best.copperPerSec) best = r;
    }
  }
  return best;
}

function bossInfo(bossId) {
  const boss = getBoss(bossId);
  const mob = spawnBossMob(boss);
  const dps = dpsAgainst(mob);
  if (dps <= 0) return null;
  const ttk = mob.maxHp / dps;
  if (ttk > 3600) return null; // not practically killable
  return { boss, mob, ttk, netPerKill: mob.copper - boss.summonCost };
}

///// time advance: farm best zone until copper >= target /////
let currentFarmName = "";
function farmUntil(targetCopper) {
  let guard = 0;
  while (P.copper < targetCopper && guard++ < 200_000) {
    const r = bestZoneRate();
    if (!r) { mark("STUCK: no farmable zone"); return false; }
    if (r.name !== currentFarmName) {
      currentFarmName = r.name;
      mark(`farm spot: ${r.name} (${r.copperPerSec.toFixed(2)} c/s)`);
    }
    // chunk: until target or 1h, whichever first (stats drift with levels)
    const dt = Math.min(Math.max((targetCopper - P.copper) / r.copperPerSec, 1), 3600);
    P.t += dt;
    if (P.t > MAX_SIM_S) { mark("STUCK: exceeded 1 simulated year"); return false; }
    P.copper += r.copperPerSec * dt;
    P.kills[r.zone.id] = (P.kills[r.zone.id] || 0) + r.killsPerSec * dt;
    gainXp(r.xpPerSec * dt);
  }
  return true;
}

///// equipment ops /////
function equip(itemId) {
  const def = getItem(itemId);
  if (P.equipment.length >= 6) {
    // replace the weakest item of the same stat family
    const family = P.equipment
      .map((eq, i) => ({ eq, i, v: statValue(getItem(eq.itemId), eq.plus) }))
      .filter(x => getItem(x.eq.itemId).stat === def.stat)
      .sort((a, b) => a.v - b.v);
    if (family.length) P.equipment.splice(family[0].i, 1);
    else P.equipment.pop();
  }
  P.equipment.push({ itemId, plus: 0 });
}

///// plan steps /////
function buyShop(itemId) {
  const def = getItem(itemId);
  if (!farmUntil(def.cost)) return false;
  P.copper -= def.cost;
  equip(itemId);
  mark(`bought ${def.name}`);
  return true;
}

function enhance(itemId, target) {
  const def = getItem(itemId);
  const eq = P.equipment
    .filter(e => e.itemId === itemId && e.plus < target)
    .sort((a, b) => b.plus - a.plus)[0];
  if (!eq) return true;
  const cost = expectedEnhanceCost(def, eq.plus, target);
  if (!farmUntil(cost)) return false;
  P.copper -= cost;
  eq.plus = target;
  mark(`${def.name} +${target} (E[cost] ${fmtC(cost)})`);
  return true;
}

function bossItem(bossId, itemId) {
  const def = getItem(itemId);
  // wait until the boss is killable: farm in 1h blocks until dps suffices
  let info = bossInfo(bossId);
  let waited = false;
  while (!info) {
    if (!farmUntil(P.copper + bestZoneRate()?.copperPerSec * 3600 || 1)) return false;
    waited = true;
    info = bossInfo(bossId);
    if (P.t > MAX_SIM_S) { mark(`STUCK waiting for ${bossId}`); return false; }
  }
  if (waited) mark(`${info.boss.name} first killable (ttk ${info.ttk.toFixed(0)}s)`);
  if (!farmUntil(info.boss.summonCost)) return false; // summon capital

  const killsNeeded = 1 / ITEM_DROP_CHANCE; // expected kills per item
  P.t += killsNeeded * info.ttk;
  P.copper += killsNeeded * info.netPerKill;
  P.kills[bossId] = (P.kills[bossId] || 0) + killsNeeded;
  gainXp(killsNeeded * info.mob.xp);

  // side effect: enough kills to have seen a skill ticket (E = 1/0.25 = 4)
  if (info.boss.skillIndex !== null) {
    const skill = CLS.skills[info.boss.skillIndex];
    if (!P.skills[skill.id] && killsNeeded >= 1 / TICKET_CHANCE) {
      P.skills[skill.id] = 1;
      mark(`learned ${skill.name} (ticket EV)`);
    }
  }
  equip(itemId);
  mark(`got ${def.name} from ${info.boss.name} (E[${killsNeeded.toFixed(0)}] kills)`);
  return true;
}

///// the canonical build (wiki-guide path) /////
const plan = [
  () => buyShop("rafaros"),    () => enhance("rafaros", 10),
  () => buyShop("darkness"),   () => enhance("darkness", 10),
  () => buyShop("liberation"), () => enhance("liberation", 20),
  () => buyShop("liberation"), () => enhance("liberation", 20),
  () => buyShop("liberation"), () => enhance("liberation", 20),
  () => buyShop("lumen"),      () => enhance("lumen", 15),
  () => buyShop("liberation"), () => enhance("liberation", 20), // replaces rafaros
  () => buyShop("liberation"), () => enhance("liberation", 20), // replaces darkness
  () => bossItem("hellparty", "rosetta"),   () => enhance("rosetta", 20),
  () => bossItem("hellparty", "partyhat"),  () => enhance("partyhat", 20),
  () => bossItem("anton", "kneecap"),       () => enhance("kneecap", 20),
  () => bossItem("anton", "refinedlumen"),  () => enhance("refinedlumen", 15),
  () => bossItem("luke", "rosetta2"),       () => enhance("rosetta2", 20),
  () => bossItem("harlem", "globetrophy"),  () => enhance("globetrophy", 20),
];

///// run /////
for (const step of plan) if (!step()) break;
mark(`END: level ${P.level}, ${fmtC(P.copper)} copper banked`);

///// report /////
function fmtT(s) {
  if (s < 60) return `${s.toFixed(0)}s`;
  if (s < 3600) return `${(s / 60).toFixed(1)}m`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}
function fmtC(n) {
  const units = ["", "k", "M", "B", "T", "Qa"];
  if (n < 1e4) return Math.round(n).toString();
  const tier = Math.min(units.length - 1, Math.floor(Math.log10(n) / 3));
  return (n / 10 ** (tier * 3)).toFixed(2) + units[tier];
}

const compare = process.argv.includes("--compare");
if (!compare) {
  for (const m of milestones) console.log(`${fmtT(m.t).padStart(8)}  ${m.desc}`);
  fs.writeFileSync(new URL("./baseline.json", import.meta.url),
    JSON.stringify(milestones, null, 2));
  console.log("\nbaseline.json written");
} else {
  const base = JSON.parse(fs.readFileSync(new URL("./baseline.json", import.meta.url)));
  // repeated descriptions (e.g. 5x "bought Liberation Staff") are keyed by occurrence
  const keyed = list => {
    const seen = {}, out = new Map();
    for (const m of list) {
      const n = seen[m.desc] = (seen[m.desc] || 0) + 1;
      out.set(`${m.desc}#${n}`, m.t);
    }
    return out;
  };
  const baseMap = keyed(base);
  const nowMap = keyed(milestones);
  let drifted = 0;
  for (const [key, t] of nowMap) {
    const old = baseMap.get(key);
    if (old === undefined) { console.log(`     NEW  ${key} @ ${fmtT(t)}`); continue; }
    const pct = old === 0 ? 0 : ((t - old) / old) * 100;
    const flag = Math.abs(pct) > 25 ? " <<< DRIFT" : "";
    if (Math.abs(pct) > 1 || flag) {
      console.log(`${fmtT(t).padStart(8)}  ${key}  (${pct > 0 ? "+" : ""}${pct.toFixed(0)}% vs baseline)${flag}`);
      if (flag) drifted++;
    }
  }
  for (const key of baseMap.keys()) {
    if (!nowMap.has(key)) { console.log(` MISSING  ${key}`); drifted++; }
  }
  console.log(drifted ? `\n${drifted} milestone(s) drifted >25%` : "\nno significant drift");
  process.exit(drifted ? 1 : 0);
}
