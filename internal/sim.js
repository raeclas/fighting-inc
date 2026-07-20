// sim.js — deterministic progression simulator / balance tracker.
//
//   node sim.js            print the milestone timeline, write baseline.json
//   node sim.js --compare  diff current balance against baseline.json,
//                          exit 1 if any milestone drifted more than 25%
//
// Imports the REAL game modules, so any change to zones/items/enhance/bosses
// math shows up here. All randomness is replaced with expected value:
// enhancing to +N costs its expected copper, a boss item takes its expected
// number of kills. The bot plays a Blood Evil (passive procs counted as EV
// damage — the canonical idle farmer on source numbers). Not modeled: macros,
// gathering buffs, active-class casts, potions/elixir IV, first-kill drop/enh
// IV (drop-rate milestones stay solo-rate — deliberately conservative).
import fs from "node:fs";
import { zones, VARIANTS, spawnMob, zoneLocked, intDrip, BAG_CHANCE, FIELD_COLS, FIELD_ROWS, FIELD_BOSS_SPAWN_CHANCE, FIELD_BOSS_INT_MULT } from "../zones.js";
import { getItem, tierOf, aggregate, poolFor, SPECIAL_IDS } from "../items.js";
import { enhanceChance } from "../enhance.js";
import { bosses, getBoss, spawnBossMob } from "../bosses.js";
import { getClass, skillDamage, classStatBonuses } from "../classes.js";
import { bestiaryBonus } from "../bestiary.js";
import { evalFeats, featBonus } from "../feats.js";
import { legionBonuses } from "../legion.js";

const MAX_SIM_S = 365 * 86400;
const CLS = getClass("bloodevil");

///// player state /////
const P = {
  t: 0, copper: 0,
  level: 1, xpAcc: 0, xpToNext: 150,
  attack: 5, attackSpeed: 1000,
  int: 0,        // per-character flat damage (kill drip + 1/level)
  equipment: [], // {itemId, plus}
  specialBag: [], // special items: never eat the 6 slots
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

// source hero growth: xpToNext = 150 × level, INT +1/level (see player.js)
function gainXp(xp) {
  P.xpAcc += xp;
  while (P.level < 5000 && P.xpAcc >= P.xpToNext) {
    P.xpAcc -= P.xpToNext;
    P.level++;
    P.xpToNext = 150 * P.level;
    P.int += 1;
  }
}

// feats shim: persistent earned-set, live views over P (same checks the game
// runs; kill counts are EV floats — >= comparisons hold). First-kill feats
// derive from P.kills; mastery stars are 0 (absorbs not modeled).
const achState = { achievements: {}, gathering: { level: { mining: 1, fishing: 1 } } };

function stats() {
  const g = aggregate(P.equipment, P.specialBag);
  // Legion: the bot is a 1-char account, so only its own class bonus applies.
  const leg = legionBonuses({ characters: [{ classId: CLS.id, int: P.int }] });
  const statSk = classStatBonuses(CLS, P.skills, g.skillLevelBonus);
  achState.kills = P.kills;
  achState.fieldKills = {};
  achState.characters = [{ int: P.int, level: P.level, copper: P.copper, equipment: P.equipment, stash: [], specialBag: P.specialBag, mastery: {} }];
  evalFeats(achState);
  const bonus = 1 + bestiaryBonus({ kills: P.kills }) + statSk.atkPct / 100
    + featBonus(achState).dmg
    + leg.dmgPct / 100 + g.dmgIncPct / 100;
  const totalInt = P.int + g.int;
  const A = Math.round((P.attack + g.atk + totalInt) * bonus * (1 + g.addDmgPct / 100));
  const skillDmgMult = 1 + (leg.skillDmgPct + g.skillDmgPct) / 100;
  // AGI from levels caps the attack-speed bonus at +400% (WC3 cap)
  // AGI saturates the WC3 cap from level 1 (source); spd stats stack past it (our adaptation)
  const spdPct = 400 + g.spdPct + leg.atkSpeedPct + statSk.atkSpdPct;
  const interval = (CLS.baseCooldownMs ?? P.attackSpeed) / (1 + spdPct / 100) / 1000; // s per attack
  // crit multiplies autos (EV); item INT procs add flat single-target EV
  const critEV = 1 + (g.crit ? g.crit.chance * (g.crit.mult - 1) : 0);
  let intProcEV = 0;
  for (const p of g.intProcs) intProcEV += p.chance * p.mult * totalInt;
  let procEV = 0; // skill procs ignore defense, same as the game
  for (const s of CLS.skills) {
    const lvl = P.skills[s.id];
    if (lvl && s.kind === "proc") procEV += s.procChance * skillDamage(s, lvl + g.skillLevelBonus, totalInt, skillDmgMult);
  }
  // static armor strip (item auras + Boxing Gloves); timed debuffs/buffs not EV-modeled
  const armorStrip = g.defReduce + statSk.armorReduce;
  return { atk: A, interval, procEV, critEV, intProcEV, totalInt, skillDmgMult, armorStrip, slb: g.skillLevelBonus };
}

function dpsAgainst(mob) {
  const { atk, interval, procEV, critEV, intProcEV, armorStrip } = stats();
  return (Math.max(0, atk - Math.max(0, mob.defense - armorStrip)) * critEV + intProcEV + procEV) / interval - mob.regen;
}

// mobs of the 4×4 field within `radius` of the centre — AoE coverage.
function aoeCoverage(radius) {
  let n = 0;
  for (let gy = 0; gy < FIELD_ROWS; gy++)
    for (let gx = 0; gx < FIELD_COLS; gx++)
      if (Math.hypot(gx - 1.5, gy - 1.5) <= radius) n++;
  return Math.max(1, n);
}

// Kills/sec against a field of these mobs. Auto-attack is single-target (≤1
// kill per hit); each AoE proc kills up to its coverage; each source kills at
// most 1 mob per mob it hits. This is the farm-vs-boss lever in the tracker.
function fieldKillsPerSec(mob) {
  const { atk, interval, critEV, intProcEV, totalInt, skillDmgMult, armorStrip, slb } = stats();
  const hp = mob.maxHp;
  let killsPerAtk = Math.min(1, Math.max(0, atk - Math.max(0, mob.defense - armorStrip)) * critEV / hp); // auto, single-target
  killsPerAtk += Math.min(1, intProcEV / hp); // item INT procs, single-target EV
  for (const s of CLS.skills) {
    const lvl = P.skills[s.id];
    if (!lvl || s.kind !== "proc") continue;
    const dmg = skillDamage(s, lvl + slb, totalInt, skillDmgMult);
    const cover = s.aoe ? aoeCoverage(s.radius) : 1;
    killsPerAtk += s.procChance * cover * Math.min(1, dmg / hp);
  }
  return killsPerAtk / interval;
}

// Time to kill, floored at one attack interval: you can't attack faster than
// your attack speed, so a one-shot still takes a full swing. Without this
// floor a huge-DPS character "one-shots" low-HP mobs in ~0ms and the lowest
// zone looks infinitely efficient — which is not how the discrete game plays.
function timeToKill(mob) {
  const { interval } = stats(); // already seconds
  const dps = dpsAgainst(mob);
  if (dps <= 0) return Infinity;
  return Math.max(interval, mob.maxHp / dps);
}

// best zone×variant by `metric` (copper/s default, INT/s for the INT era);
// returns null if nothing farmable
function bestZoneRate(metric = "copperPerSec") {
  let best = null;
  for (const z of zones) {
    for (let v = 0; v < VARIANTS.length; v++) {
      if (zoneLocked(z, { level: P.level, int: P.int }, v)) continue; // per-variant gates
      const mob = spawnMob(z, v);
      const kps = fieldKillsPerSec(mob);
      if (kps <= 0) continue;
      const r = {
        zone: z, variant: v, name: mob.name,
        copperPerSec: kps * (mob.copper + BAG_CHANCE * mob.bag),
        xpPerSec: kps * mob.xp,
        // drip + field-boss INT-spike EV (spawn chance × 100× drip)
        intPerSec: kps * intDrip(z, { int: P.int }) * (1 + FIELD_BOSS_SPAWN_CHANCE * FIELD_BOSS_INT_MULT),
        killsPerSec: kps,
      };
      if (!best || r[metric] > best[metric]) best = r;
    }
  }
  return best;
}

function bossInfo(bossId) {
  const boss = getBoss(bossId);
  if (boss.reqInt && P.int < boss.reqInt) return null; // summon gate (game checks at summon)
  const mob = spawnBossMob(boss);
  const ttk = timeToKill(mob);
  if (ttk > 3600) return null; // not practically killable
  const d = boss.drops;
  const bounty = d?.bounty ? d.bounty * 1e9 ** (d.bountyTier ?? 0) : 0;
  return { boss, mob, ttk, netPerKill: mob.copper + bounty - boss.summonCost };
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
    P.int += r.intPerSec * dt;
    P.kills[r.zone.id] = (P.kills[r.zone.id] || 0) + r.killsPerSec * dt;
    gainXp(r.xpPerSec * dt);
  }
  return true;
}

// INT/s from killing every reachable respawn-timer special on cooldown while
// farming (the boss INT bounties — the INT-era heartbeat). EV kills recorded
// so trophies/achievements accrue.
function specialBossIntRate() {
  const out = [];
  for (const b of bosses) {
    if (!b.respawnMs || !b.drops?.intBounty) continue;
    const info = bossInfo(b.id); // handles reqInt + killability
    if (!info) continue;
    const cycle = Math.max(info.ttk, b.respawnMs / 1000);
    out.push({ id: b.id, intPerSec: b.drops.intBounty / cycle, killsPerSec: 1 / cycle, netPerKill: info.netPerKill });
  }
  return out;
}

// farm the best INT/s zone until P.int >= target — the INT-era dead-zone
// detector: a STUCK mark here means there is no INT income at this point.
function farmIntUntil(targetInt, label) {
  let guard = 0;
  while (P.int < targetInt && guard++ < 200_000) {
    const r = bestZoneRate("intPerSec");
    const specials = specialBossIntRate();
    const bossInt = specials.reduce((s, x) => s + x.intPerSec, 0);
    const totalIntPerSec = (r?.intPerSec ?? 0) + bossInt;
    if (totalIntPerSec <= 0) { mark(`STUCK: no INT income at ${fmtC(P.int)} INT`); return false; }
    if (r && r.name !== currentFarmName) {
      currentFarmName = r.name;
      mark(`INT farm spot: ${r.name} (${r.intPerSec.toFixed(2)} INT/s zone + ${bossInt.toFixed(2)} boss)`);
    }
    const dt = Math.min(Math.max((targetInt - P.int) / totalIntPerSec, 1), 3600);
    P.t += dt;
    if (P.t > MAX_SIM_S) { mark(`STUCK: exceeded 1 simulated year at ${fmtC(P.int)} INT`); return false; }
    P.int += totalIntPerSec * dt;
    if (r) {
      P.copper += r.copperPerSec * dt;
      P.kills[r.zone.id] = (P.kills[r.zone.id] || 0) + r.killsPerSec * dt;
      gainXp(r.xpPerSec * dt);
    }
    for (const s of specials) {
      P.kills[s.id] = (P.kills[s.id] || 0) + s.killsPerSec * dt;
      P.copper += s.netPerKill * s.killsPerSec * dt;
    }
  }
  mark(label);
  return true;
}

///// equipment ops /////
function equip(itemId) {
  if (SPECIAL_IDS.has(itemId)) { P.specialBag.push({ itemId, plus: 0 }); return; }
  if (P.equipment.length >= 6) {
    // replace the weakest slot by tier ATK
    const weakest = P.equipment
      .map((eq, i) => ({ i, v: tierOf(getItem(eq.itemId), eq.plus).atk ?? 0 }))
      .sort((a, b) => a.v - b.v)[0];
    P.equipment.splice(weakest.i, 1);
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
  const eq = [...P.equipment, ...P.specialBag]
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

  // expected kills for a SPECIFIC pool item: pool_size / roll_chance.
  // Explicit drop pools (specials) beat poolFor — bernardo's generated pool
  // holds all 15 class weapons but the boss only rolls its 3-entry list.
  const d = info.boss.drops;
  const poolSize = (d?.pool?.length ?? poolFor(bossId).length) || 1;
  const killsNeeded = poolSize / (d?.itemChance ?? 0.02);
  // respawn-timer bosses (specials) are kill-rate-bound by the timer; the bot
  // farms the best zone during the wait. ponytail: farm spot held static
  // across the whole wait — fine for a tracker.
  const wait = Math.max(info.ttk, (info.boss.respawnMs ?? 0) / 1000);
  P.t += killsNeeded * wait;
  P.copper += killsNeeded * info.netPerKill;
  P.kills[bossId] = (P.kills[bossId] || 0) + killsNeeded;
  gainXp(killsNeeded * info.mob.xp);
  const idle = killsNeeded * Math.max(0, wait - info.ttk);
  if (idle > 0) {
    const r = bestZoneRate();
    if (r) {
      P.copper += r.copperPerSec * idle;
      P.int += r.intPerSec * idle;
      P.kills[r.zone.id] = (P.kills[r.zone.id] || 0) + r.killsPerSec * idle;
      gainXp(r.xpPerSec * idle);
    }
  }

  // ticket rides the item roll (source): EV ≥ 1 ticket seen over those kills
  if (info.boss.skillIndex !== null) {
    const skill = CLS.skills[info.boss.skillIndex];
    if (!P.skills[skill.id] && killsNeeded * (d?.itemChance ?? 0) >= 1) {
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
  // boss ladder — dmgInc piece then proc piece per boss, wiki-guide style
  () => bossItem("hellparty", "hellparty_dmg"),  () => enhance("hellparty_dmg", 20),
  () => bossItem("hellparty", "hellparty_proc"), () => enhance("hellparty_proc", 20),
  () => bossItem("anton", "anton_dmg"),          () => enhance("anton_dmg", 20),
  () => bossItem("anton", "anton_crit"),         () => enhance("anton_crit", 20),
  () => bossItem("luke", "luke_dmg"),            () => enhance("luke_dmg", 20),   // Rosetta Stone
  () => bossItem("harlem", "harlem_dmg"),        () => enhance("harlem_dmg", 20),
  // ---- INT era (5k → 15.5M): the previously-unsimulated stretch ----
  () => bossItem("taibers", "taibers_intp"),     () => enhance("taibers_intp", 20),
  () => farmIntUntil(100e3,  "INT 100k — Bernardo + slot 2 unlock"),
  () => bossItem("bernardo", "bernardo_gsword"), () => enhance("bernardo_gsword", 20),
  () => farmIntUntil(400e3,  "INT 400k — Fiend War opens"),
  () => bossItem("fiendwar", "fiendwar_dmg"),    () => enhance("fiendwar_dmg", 20),
  () => farmIntUntil(700e3,  "INT 700k — Stormy Route opens"),
  () => farmIntUntil(1e6,    "INT 1M — slot 3"),
  () => farmIntUntil(1.6e6,  "INT 1.6M — Aiolite opens"),
  () => farmIntUntil(4e6,    "INT 4M — Ore of Despair opens"),
  () => farmIntUntil(15.5e6, "INT 15.5M — Golden Beryl opens"),
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
  const units = ["", "k", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
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
