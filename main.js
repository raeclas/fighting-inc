// main.js
// Entry point. Loads the save, wires UI, runs the update/render loop.
import { gameState } from "./state.js";
import { save, load, wipe, exportSave, importSave } from "./saveSystem.js";
import { bindFormatSettings } from "./format.js";
import { startGameLoop } from "./gameLoop.js";
import { updateUI, renderZoneList, renderShop, renderEquipment, logLine, fmt } from "./ui.js";
import { getZone, spawnMob, spawnField, spawnFieldBoss, gridDist, zoneLocked, intDrip, FIELD_COLS, FIELD_ROWS, BAG_CHANCE, FIELD_BOSS_SPAWN_CHANCE, FIELD_BOSS_INT_MULT } from "./zones.js";
import { newCharacter, gainXP, resetHealth, agiSpeedPct } from "./player.js";
import { getItem, aggregate, absorbDupes, bagDupeCount, SPECIAL_IDS, MERGE_IDS, AVATAR_IDS, AVATAR_SOULS, CLASS_WEAPON } from "./items.js";
import { tryEnhance, tryMerge, tryAvatarEnhance } from "./enhance.js";
import { JARS, jarFor, ivMult, potionActive, POTION_MS, INT_POTION_MULT } from "./consumables.js";
import { getClass, skillDamage, classStatBonuses, radiusOf, buffDuration, MAX_SKILL_LEVEL, activeSkills, matchesSkill, rollOutcome } from "./classes.js";
import { renderClassSelect, hideClassSelect, renderSkillBar, renderBossList, renderBestiary, renderAchievements, renderStatsPanel, renderCodex, initTabs, initFeedFilter, bustRenderCaches } from "./ui.js";
import { bestiaryBonus } from "./bestiary.js";
import { evalAchievements, achievementBonus, ACHIEVEMENT_BONUS } from "./achievements.js";
import { renderMacro } from "./ui.js";
import { UNLOCK_COST, MAX_SLOTS, intervalMs, intervalUpgradeCost, slotCost } from "./macro.js";
import { renderGathering, renderLegion } from "./ui.js";
import { legionBonuses, unlockedSlots, intTutorMult } from "./legion.js";
import { initBattle, renderBattle, pushBattleEvent } from "./battle.js";
import { ACTIVITIES, tickIntervalMs, xpToNext, HAMMER_ORE_COST, OFFERING_FISH_COST, INT_POTION_FISH_COST, PROB_POTION_ORE_COST, OK_TICKET_COST, ELIXIR_COST } from "./gathering.js";
import { getBoss, spawnBossMob, TICKET_SUCCESS, FIRST_KILL_BONUS, firstKillBonuses } from "./bosses.js";

const FIRST_KILL_MULT = 10; // first-kill trophy bounty multiplier
import { poolFor } from "./items.js";

///// LOAD SAVE /////
bindFormatSettings(() => gameState.settings); // before any render uses fmt
const savedGame = load(gameState);
if (gameState.characters.length === 0) gameState.characters.push(newCharacter());
// The active character. Rebound when the roster switches (Legion step 4);
// same object identity as gameState.characters[gameState.active].
let player = gameState.characters[gameState.active];

// The front (first living) mob — the auto-attack target and the "primary" mob
// for UI/boss logic. A boss is just a field of one.
function frontMob() {
  return gameState.field.find(m => m.hp > 0) || null;
}

function replaceInField(oldMob, newMob) {
  const i = gameState.field.indexOf(oldMob);
  if (i === -1) return;
  newMob.gx = oldMob.gx;
  newMob.gy = oldMob.gy;
  gameState.field[i] = newMob;
}

function selectZone(zoneId, variantIndex) {
  const zone = getZone(zoneId);
  if (!zone) return;
  const locked = zoneLocked(zone, player, variantIndex);
  if (locked) return logLine(`${zone.name}: ${locked}.`, "fail");
  gameState.currentZoneId = zoneId;
  gameState.currentVariant = variantIndex;
  gameState.field = spawnField(zone, variantIndex);
}
// ponytail: a zone you already farm keeps running past its lockout until you
// switch — kick-on-tick if boosting through it ever matters.

// Hunt the field boss for the currently selected zone/variant (solo).
function huntFieldBoss() {
  if (!gameState.currentZoneId) return logLine("Select a hunting ground first.", "fail");
  const zone = getZone(gameState.currentZoneId);
  const fb = spawnFieldBoss(zone, gameState.currentVariant);
  gameState.field = [fb];
  logLine(`A ${fb.name} lumbers into view.`);
}

// resume farming where the save left off
if (gameState.currentZoneId) selectZone(gameState.currentZoneId, gameState.currentVariant);

///// TIME /////
// Wall clock is the source of truth. A 250ms tick and an 8h offline gap run
// through the same code: small deltas simulate attack-by-attack, big deltas
// use closed-form expected value.
const OFFLINE_CAP_MS = 12 * 3600 * 1000;
const BATCH_THRESHOLD_MS = 2000;
let lastLogicTime = savedGame?.lastSeen ?? Date.now();

///// CLASS /////
function pickClass(classId) {
  const cls = getClass(classId);
  player.classId = classId;
  player.skills = { [cls.skills[0].id]: 1 };
  // Free starter staff — something to enhance from turn one (the +0→+3 band is
  // guaranteed, so kill-time drops fast) and teaches the core loop.
  if (player.equipment.every(e => e === null)) {
    player.equipment[0] = { itemId: "rafaros", plus: 0 };
  }
  hideClassSelect();
  logLine(`You are now a ${cls.name}. Here's a Rafaros Staff — enhance it. Good luck.`, "success");
  renderEquipment(player, equipHandlers);
  refreshMacro();
  save(gameState);
}

// a buff is up while its timer runs AND (for on-hit charge buffs) charges remain
const buffActive = id => {
  const b = gameState.buffs[id];
  return !!b && b.until > gameState.total_time && (b.charges === undefined || b.charges > 0);
};

// the 7 slots with learned evolutions swapped in + the M ultimate appended
function skillsOf() {
  return activeSkills(getClass(player.classId), player.skills);
}

// active Doppelganger clone count (0 when the buff is down); `extra` = item
// clones (Abyssal Knuckle) that join while the summon is up
function activeClones(extra = 0) {
  const dop = getClass(player.classId)?.skills.find(s => s.buff?.clones);
  return dop && buffActive(dop.id) ? dop.buff.clones + extra : 0;
}

function effectiveStats() {
  const g = aggregate(player.equipment, player.specialBag, player.mastery);
  const leg = legionBonuses(gameState);
  const cls = getClass(player.classId);
  const statSk = classStatBonuses(cls, player.skills, g.skillLevelBonus);

  // buff-driven bonuses (Khai haste, Miracle skill dmg, Hekate's self-buff kit)
  // + timed armor debuffs. Enhanced skills carry buffs too — walk activeSkills.
  // The Brush S class weapon scales Hekate-style buff magnitudes.
  const bvMult = 1 + g.buffValuePct / 100;
  let buffSpdPct = 0, buffSkillDmgPct = 0, timedArmor = 0;
  let buffIntPct = 0, buffAtkPct = 0, buffAddDmgPct = 0, buffProcMultPct = 0;
  for (const s of activeSkills(cls, player.skills)) {
    const level = player.skills[s.id];
    if (!level) continue;
    const L = level + g.skillLevelBonus;
    if (s.buff && buffActive(s.id)) {
      buffSpdPct += (s.buff.atkSpdPct ?? 0) + (s.buff.atkSpdPctPerLevel ?? 0) * L;
      buffSkillDmgPct += (s.buff.skillDmgPctPerLevel ?? 0) * L;
      // Favoritism: past the source INT cap the per-level value drops
      const intPerLvl = player.int >= (s.buff.capInt ?? Infinity)
        ? (s.buff.intPctPerLevelCapped ?? 0) : (s.buff.intPctPerLevel ?? 0);
      buffIntPct += ((s.buff.intPctBase ?? 0) + intPerLvl * L) * bvMult;
      buffAtkPct += ((s.buff.atkPctBase ?? 0) + (s.buff.atkPctPerLevel ?? 0) * L) * bvMult;
      buffAddDmgPct += (s.buff.addDmgPctPerLevel ?? 0) * L * bvMult;
      buffProcMultPct += ((s.buff.procMultPctBase ?? 0) + (s.buff.procMultPctPerLevel ?? 0) * L) * bvMult;
    }
    if (s.armorDebuff && buffActive(`${s.id}:armor`)) timedArmor += s.armorDebuff.perLevel * L;
  }
  // dmgInc ("Increase attack power by N%") stacks additively with the other
  // percent bonuses; addDmg ("Additional damage", best item only) multiplies
  // on top — matches the source tooltips' two separate multiplier families.
  const bonus = 1 + bestiaryBonus(gameState) + firstKillBonuses(gameState.kills).dmg
    + achievementBonus(gameState)
    + statSk.atkPct / 100 + leg.dmgPct / 100 + g.dmgIncPct / 100 + buffAtkPct / 100;
  // INT (character + item) is flat 1:1 damage, added before the % multipliers.
  // INT potion multiplies PURE (character) INT only — item INT untouched (map).
  const pureMult = potionActive(player, "int", gameState.total_time) ? INT_POTION_MULT : 1;
  // Hekate's INT buffs (Love Emergency etc.) scale the whole INT term
  const totalInt = Math.round((Math.round(player.int * pureMult) + g.int) * (1 + buffIntPct / 100));
  const atkTotal = Math.round((player.attack + g.atk + totalInt) * bonus * (1 + (g.addDmgPct + buffAddDmgPct) / 100));
  // AGI saturates WC3's +400% cap from level 1 (source). ponytail: letting
  // item/legion/buff speed stack PAST the cap is OUR adaptation — in the map
  // those stats are decorative (cap already full); here they stay meaningful.
  // ponytail: skillSpdPct (Blade weapon "when using a skill") folds in
  // unconditionally — idle combat casts constantly; no per-cast window kept.
  const spdPct = agiSpeedPct(player) + g.spdPct + g.skillSpdPct + leg.atkSpeedPct + statSk.atkSpdPct + buffSpdPct;
  // Forbidden Curse boosts INT-proc item effectiveness
  const intProcs = buffProcMultPct
    ? g.intProcs.map(p => ({ chance: p.chance, mult: p.mult * (1 + buffProcMultPct / 100) }))
    : g.intProcs;
  return {
    atk: atkTotal,
    // source skill formula: level × (base + INT × mult) × this
    skillDmgMult: 1 + (leg.skillDmgPct + g.skillDmgPct + buffSkillDmgPct) / 100,
    interval: (cls?.baseCooldownMs ?? player.attackSpeed) / (1 + spdPct / 100),
    // enemy armor stripped from autos: item auras + Boxing Gloves + timed debuffs
    armorStrip: g.defReduce + statSk.armorReduce + timedArmor,
    totalInt,
    crit: g.crit,             // {chance, mult} | null — auto-attacks only
    intProcs,                 // [{chance, mult}] — mult × INT bonus per auto
    cdMult: 1 - g.cooldownPct / 100,
    skillLevelBonus: g.skillLevelBonus,
    // class-weapon meta-modifiers + avatar magic crit
    intRatioMult: 1 + g.intRatioPct / 100,   // scales the INT×mult term of skills
    procRateMult: 1 + g.procRatePct / 100,   // scales proc-skill activation chance
    gsRateMult: 1 + g.gsRatePct / 100,       // Geniewiz jackpot chance (Brush weapon)
    magicCrit: g.magicCrit,                  // {chance, pct} | null — skills only
    clones: g.clones,                        // extra Doppelganger clones
  };
}

// talisman-adjusted skill level for damage math
function effSkillLevel(level, eff) {
  return level + (eff?.skillLevelBonus ?? 0);
}

// Apply a skill's damage. AoE hits every living mob within its grid-radius of
// the target; single-target hits just the target. Targets are snapshotted so a
// slot that respawns mid-cast isn't hit twice.
function applySkillDamage(skill, dmg, target, radius = skill.radius) {
  const hits = skill.aoe
    ? gameState.field.filter(m => m.hp > 0 && gridDist(m, target) <= radius)
    : [target];
  for (const m of hits) {
    m.hp -= dmg;
    if (m.hp <= 0) resolveKill(m);
  }
}

function resetOtherCooldowns(exceptId) {
  for (const id of Object.keys(gameState.cooldowns)) {
    if (id !== exceptId) gameState.cooldowns[id] = 0;
  }
}

function castSkill(skill) {
  const level = player.skills[skill.id];
  const target = frontMob();
  if (skill.kind !== "cast" || !level || !target) return;
  if ((gameState.cooldowns[skill.id] || 0) > gameState.total_time) return;
  // Necromancer stance: some skills need the enabler buff running
  if (skill.requiresBuff && !buffActive(skill.requiresBuff)) {
    return logLine(`${skill.name} needs its stance active.`, "fail");
  }
  // Divineress spheres: gate the cost before anything is spent
  const sph = getClass(player.classId)?.spheres;
  let spent = 0;
  if (skill.sphereCost) {
    const cost = skill.sphereCost === "all" ? Math.floor(gameState.spheres) : skill.sphereCost;
    if (cost < 1 || gameState.spheres < cost) return logLine(`${skill.name} needs spheres.`, "fail");
    gameState.spheres -= cost;
    spent = cost;
  }

  const eff = effectiveStats();
  gameState.cooldowns[skill.id] = gameState.total_time + Math.round(skill.cooldownMs * eff.cdMult);
  if (skill.resetsCooldowns) resetOtherCooldowns(skill.id); // Sesto Elemental

  const L = effSkillLevel(level, eff);
  // Geniewiz: one weighted outcome roll decides the damage tier (or a miss)
  let dmgSkill = skill;
  let gsHit = !skill.outcomes;
  if (skill.outcomes) {
    const o = rollOutcome(skill.outcomes, eff.gsRateMult);
    if (!o) {
      pushBattleEvent({ type: "skill", dmg: 0 });
      return logLine(`${skill.name}: MAJOR FAILURE. The wheel laughs.`, "fail");
    }
    dmgSkill = { ...skill, base: o.base, mult: o.mult };
    gsHit = o.tag === "GS";
    if (o.tag === "GS") logLine(`${skill.name}: GREAT SUCCESS!`, "success");
    if (o.resetsCooldowns) resetOtherCooldowns(skill.id); // Gravitas jackpot
  }
  // buffs arm normally; outcome skills whose buff is jackpot-gated arm on GS only
  if (skill.buff && (!skill.buffOnGS || gsHit)) {
    gameState.buffs[skill.id] = {
      until: gameState.total_time + buffDuration(skill, L),
      ...(skill.buff.charges ? { charges: skill.buff.charges } : {}),
    };
    logLine(`${skill.name} active.`, "success");
  }
  if (skill.armorDebuff) {
    gameState.buffs[`${skill.id}:armor`] = { until: gameState.total_time + skill.armorDebuff.durationMs };
  }

  let dmg = skillDamage(dmgSkill, L, eff.totalInt, eff.skillDmgMult, eff.intRatioMult);
  // Holy Comet: consumed spheres add INT×mult each; Celestial Purge refills
  if (skill.sphereBonusMult && spent) dmg += Math.round(L * eff.totalInt * skill.sphereBonusMult * spent);
  if (skill.sphereFill && sph) gameState.spheres = sph.max;
  if (skill.sphereGain && sph) {
    const mult = target.isBoss ? (skill.sphereGainBossMult ?? 1) : 1;
    gameState.spheres = Math.min(sph.max, gameState.spheres + skill.sphereGain * mult);
  }
  if (eff.magicCrit && Math.random() < eff.magicCrit.chance) {
    dmg = Math.round(dmg * (1 + eff.magicCrit.pct / 100)); // avatar magic crit
  }
  if (dmg > 0) {
    applySkillDamage(skill, dmg, target, radiusOf(skill, L, buffActive("miracle")));
    pushBattleEvent({ type: "skill", dmg });
  }
}

window.addEventListener("keydown", e => {
  const cls = getClass(player.classId);
  if (!cls || cls.archetype !== "active" || e.repeat) return;
  const skill = skillsOf().find(s => s.key === e.key.toUpperCase());
  if (skill) castSkill(skill);
});

///// BOSSES /////
function summonBoss(bossId) {
  const boss = getBoss(bossId);
  if (boss.reqInt) {
    if (player.int < boss.reqInt) return logLine(`${boss.name} ignores you. Requires ${fmt(boss.reqInt)} INT.`, "fail");
    if ((gameState.bossCooldowns[boss.id] || 0) > gameState.total_time)
      return logLine(`${boss.name} has not respawned yet.`, "fail");
  }
  if (player.copper < boss.summonCost) return logLine(`Need ${fmt(boss.summonCost)}c to summon ${boss.name}.`, "fail");
  player.copper -= boss.summonCost;
  gameState.field = [spawnBossMob(boss)];
  logLine(`Summoned ${boss.name}.`);
}

// Give the player an item: special items go to the special bag; the rest into
// a free equipment slot, else the stash (never lost).
function acquireItem(itemId, sourceLabel) {
  const def = getItem(itemId);
  if (SPECIAL_IDS.has(itemId)) {
    // one copy per special: bag items are ALWAYS active, so duplicates would
    // stack stats forever off AFK farming. Dupes feed mastery instead.
    // Talisman family exempt — its dupes are merge fodder.
    if (!MERGE_IDS.has(itemId) && player.specialBag.some(e => e.itemId === itemId)) {
      player.mastery[itemId] = (player.mastery[itemId] || 0) + 1;
      logLine(`${sourceLabel} ${def.name} — absorbed into mastery (${player.mastery[itemId]}).`, "success");
    } else {
      player.specialBag.push({ itemId, plus: 0 });
      logLine(`${sourceLabel} ${def.name}! → special bag.`, "success");
    }
    renderEquipment(player, equipHandlers);
    return;
  }
  const slot = player.equipment.indexOf(null);
  if (slot !== -1) {
    player.equipment[slot] = { itemId, plus: 0 };
    logLine(`${sourceLabel} ${def.name}!`, "success");
  } else if (player.stash.some(e => e.itemId === itemId)) {
    // stash holds at most one spare per item; further dupes feed mastery
    // (otherwise AFK boss farming floods the stash forever)
    player.mastery[itemId] = (player.mastery[itemId] || 0) + 1;
    logLine(`${sourceLabel} ${def.name} — absorbed into mastery (${player.mastery[itemId]}).`, "success");
  } else {
    player.stash.push({ itemId, plus: 0 });
    logLine(`${sourceLabel} ${def.name} — slots full, sent to stash.`, "success");
  }
  renderEquipment(player, equipHandlers);
}

function useTicket(boss) {
  const cls = getClass(player.classId);
  const skill = cls.skills[boss.skillIndex];
  const level = player.skills[skill.id];
  if (!level) {
    player.skills[skill.id] = 1;
    logLine(`Skill ticket: learned ${skill.name}! (100% for new skills)`, "success");
    refreshMacro(); // new skill appears in macro dropdowns
  } else if (level >= MAX_SKILL_LEVEL) {
    logLine(`Skill ticket for ${skill.name} dropped, but it's already Lv${MAX_SKILL_LEVEL}.`);
  } else if (Math.random() < TICKET_SUCCESS) {
    player.skills[skill.id] = level + 1;
    logLine(`Skill ticket: ${skill.name} Lv${level} → Lv${level + 1} SUCCESS (5%)`, "success");
  } else {
    logLine(`Skill ticket for ${skill.name} FAILED (5%). Of course it did.`, "fail");
  }
}

// Special-boss evolution tickets: 100% success, +1 level, cap 7 (map nwx —
// unlike the 5% Q..D ladder). Applies immediately on drop.
function useEvolutionTicket(boss, tier) {
  const cls = getClass(player.classId);
  const skill = cls?.enhanced?.find(e => e.tier === tier);
  if (!skill) return;
  const level = player.skills[skill.id] || 0;
  if (level >= MAX_SKILL_LEVEL) {
    return logLine(`${boss.name} dropped a ${tier} ticket, but ${skill.name} is already Lv${MAX_SKILL_LEVEL}.`);
  }
  player.skills[skill.id] = level + 1;
  logLine(level === 0
    ? `${tier.toUpperCase()} TICKET: ${skill.replaces ? "skill evolved into" : "learned"} ${skill.name}!`
    : `${tier.toUpperCase()} TICKET: ${skill.name} Lv${level} → Lv${level + 1} (100%).`, "success");
  refreshMacro(); // skill bar re-renders on the next tick
}

// IV per roll family: potions/elixir (ivMult) + permanent first-kill trophies
function dropIv() {
  return ivMult(player, gameState.total_time) + firstKillBonuses(gameState.kills).drop;
}
function enhIv() {
  return ivMult(player, gameState.total_time) + firstKillBonuses(gameState.kills).enh;
}

function rollBossDrops(boss, dropMult = 1) {
  const d = boss.drops;
  if (!d) return;
  // bounty: tier-N amount = bounty × 1e9^tier copper (silver/gold tiers)
  if (d.bounty) {
    const paid = earnCopper(d.bounty * 1e9 ** (d.bountyTier ?? 0));
    pushBattleEvent({ type: "bag", copper: paid });
    logLine(`Bounty: +${fmt(paid)}c.`, "success");
  }
  // guaranteed avatar-enhancement souls (Seria / Library Keeper)
  if (d.souls) {
    player.souls[d.souls.kind] = (player.souls[d.souls.kind] || 0) + d.souls.count;
    logLine(`${boss.name} leaves ${d.souls.count} souls behind.`, "success");
  }
  // all boss drop rolls scale with the source IV multiplier (probability
  // potion / elixir / first-kill trophies) and the elite twin's 3× (Formless Sirocco)
  const iv = dropIv() * dropMult;
  // item roll — the skill ticket drops ALONGSIDE a successful roll (source Epx)
  if (Math.random() < Math.min(1, d.itemChance * iv)) {
    // specials carry an explicit pool; "classWeapon" resolves per active class
    const pool = d.pool
      ? d.pool.map(id => id === "classWeapon" ? CLASS_WEAPON[player.classId] : id).filter(Boolean)
      : poolFor(boss.id);
    if (pool.length) acquireItem(pool[Math.floor(Math.random() * pool.length)], `${boss.name} dropped`);
    if (boss.skillIndex !== null) useTicket(boss);
  }
  // evolution ticket — independent roll (source dispatch)
  if (d.ticket && Math.random() < Math.min(1, d.ticket.chance * iv)) useEvolutionTicket(boss, d.ticket.tier);
  // Elixir of Strength — potion count, not an item, so it skips acquireItem
  if (d.elixir && Math.random() < Math.min(1, d.elixir * iv)) {
    player.potions.elixir++;
    logLine(`${boss.name} dropped an Elixir of Strength!`, "success");
  }
  // INT bounty (specials): flat chunk per kill — the INT-era heartbeat
  if (d.intBounty) {
    player.int += d.intBounty;
    logLine(`${boss.name} yields +${fmt(d.intBounty)} INT.`, "success");
  }
  if (d.rare && Math.random() < Math.min(1, d.rare.chance * iv)) {
    const rp = d.rare.pool ? poolFor(d.rare.pool) : [d.rare.itemId];
    acquireItem(rp[Math.floor(Math.random() * rp.length)], `${boss.name} dropped a RARE find:`);
  }
}

///// MACRO WORKSHOP /////
const macroHandlers = {
  onUnlock() {
    if (player.copper < UNLOCK_COST) return logLine("Can't afford the macro workshop yet.", "fail");
    player.copper -= UNLOCK_COST;
    gameState.macro.unlocked = true;
    logLine("Macro Workshop unlocked. Definitely not bannable.", "success");
    refreshMacro();
  },
  onToggle() { gameState.macro.enabled = !gameState.macro.enabled; refreshMacro(); },
  onUpgradeInterval() {
    const cost = intervalUpgradeCost(gameState.macro.intervalLevel);
    if (player.copper < cost) return logLine("Fingers not affordable.", "fail");
    player.copper -= cost;
    gameState.macro.intervalLevel++;
    refreshMacro();
  },
  onBuySlot() {
    const cost = slotCost(gameState.macro.slots.length + 1);
    if (player.copper < cost) return logLine("Can't afford another macro step.", "fail");
    player.copper -= cost;
    gameState.macro.slots.push(null);
    refreshMacro();
  },
  onSetSlot(i, skillId) { gameState.macro.slots[i] = skillId; },
};

function refreshMacro() {
  renderMacro(gameState, player, macroHandlers);
}

function runMacro() {
  const m = gameState.macro;
  const cls = getClass(player.classId);
  if (!m.unlocked || !m.enabled || !cls || cls.archetype !== "active") return;
  if (gameState.total_time < (m.nextAt || 0)) return;
  m.nextAt = gameState.total_time + intervalMs(m.intervalLevel);

  // cast the first ready skill in the sequence, starting after the last cast
  const avail = skillsOf();
  for (let i = 0; i < m.slots.length; i++) {
    const idx = ((m.ptr || 0) + i) % m.slots.length;
    const skill = avail.find(s => s.id === m.slots[idx]);
    if (!skill || skill.kind !== "cast" || !player.skills[skill.id]) continue;
    if ((gameState.cooldowns[skill.id] || 0) > gameState.total_time) continue;
    castSkill(skill);
    m.ptr = (idx + 1) % m.slots.length;
    break;
  }
}

///// ROSTER /////
// Switch which character is played. Transient combat state resets; the zone
// clears too (the incoming character may not survive the outgoing one's farm).
function switchCharacter(i) {
  if (i === gameState.active || !gameState.characters[i]) return;
  gameState.active = i;
  player = gameState.characters[i];
  player.lastAttack = 0;
  gameState.cooldowns = {};
  gameState.buffs = {};
  gameState.procCounts = {};
  gameState.spheres = 0;
  gameState.field = [];
  gameState.currentZoneId = null;
  gameState.macro.enabled = false;
  renderEquipment(player, equipHandlers);
  refreshMacro();
  renderZoneList(player, selectZone, true);
  if (player.classId) {
    logLine(`Now playing ${getClass(player.classId).name} Lv${player.level}. Pick a hunting ground.`, "success");
  } else {
    renderClassSelect(pickClass);
  }
  save(gameState);
}

function createCharacter() {
  if (gameState.characters.length >= gameState.slots) return;
  gameState.characters.push(newCharacter());
  logLine("A new slave reports for enhancement duty.", "success");
  switchCharacter(gameState.characters.length - 1);
}

const rosterHandlers = { onPlay: switchCharacter, onNew: createCharacter };

///// GATHERING /////
const gatheringHandlers = {
  onSetActivity(name) {
    const g = gameState.gathering;
    g.activity = name;
    if (name) g.nextTickAt = gameState.total_time + tickIntervalMs(g.level[name]);
    refreshGathering();
  },
  onCraftHammer() {
    const g = gameState.gathering;
    if (g.resources.ore < HAMMER_ORE_COST) return logLine("Not enough ore.", "fail");
    g.resources.ore -= HAMMER_ORE_COST;
    g.buffs.doubleChance++;
    refreshGathering();
  },
  onCraftOffering() {
    const g = gameState.gathering;
    if (g.resources.fish < OFFERING_FISH_COST) return logLine("Not enough fish.", "fail");
    g.resources.fish -= OFFERING_FISH_COST;
    g.buffs.freeAttempts++;
    refreshGathering();
  },
  onCraftIntPotion() {
    const g = gameState.gathering;
    if (g.resources.fish < INT_POTION_FISH_COST) return logLine("Not enough fish.", "fail");
    g.resources.fish -= INT_POTION_FISH_COST;
    player.potions.int++;
    refreshGathering();
  },
  onCraftProbPotion() {
    const g = gameState.gathering;
    if (g.resources.ore < PROB_POTION_ORE_COST) return logLine("Not enough ore.", "fail");
    g.resources.ore -= PROB_POTION_ORE_COST;
    player.potions.prob++;
    refreshGathering();
  },
  onCraftTicket() {
    const g = gameState.gathering;
    if (g.resources.ore < OK_TICKET_COST.ore || g.resources.fish < OK_TICKET_COST.fish)
      return logLine("Confirmation ticket needs 25 ore + 25 fish.", "fail");
    g.resources.ore -= OK_TICKET_COST.ore;
    g.resources.fish -= OK_TICKET_COST.fish;
    g.buffs.okTickets++;
    refreshGathering();
  },
  onCraftElixir() {
    const g = gameState.gathering;
    if (g.resources.ore < ELIXIR_COST.ore || g.resources.fish < ELIXIR_COST.fish)
      return logLine("Elixir of Strength needs 50 ore + 50 fish.", "fail");
    g.resources.ore -= ELIXIR_COST.ore;
    g.resources.fish -= ELIXIR_COST.fish;
    player.potions.elixir++;
    refreshGathering();
  },
};

function refreshGathering() {
  renderGathering(gameState, player, gatheringHandlers);
}

function gatherTick() {
  const g = gameState.gathering;
  if (!g.activity || gameState.total_time < g.nextTickAt) return;
  const act = ACTIVITIES[g.activity];

  // catch-up loop: digests offline gaps tick by tick (bounded by 12h cap)
  let guard = 0;
  while (gameState.total_time >= g.nextTickAt && guard++ < 20_000) {
    g.resources[act.resource]++;
    g.xp[g.activity] += 10;
    while (g.xp[g.activity] >= xpToNext(g.level[g.activity])) {
      g.xp[g.activity] -= xpToNext(g.level[g.activity]);
      g.level[g.activity]++;
      logLine(`${act.noun} skill is now Lv${g.level[g.activity]}.`, "success");
    }
    g.nextTickAt += tickIntervalMs(g.level[g.activity]);
  }
  if (g.nextTickAt < gameState.total_time) g.nextTickAt = gameState.total_time;
  refreshGathering();
}

///// SHOP / EQUIPMENT ACTIONS /////
const equipHandlers = { onEnhance: enhance, onUnequip: unequipToStash, onDiscard: discard, onEquipStash: equipStash, onDiscardStash: discardStash, onAbsorbStash: absorbStash, onAbsorbDupes: absorbStashDupes, onAbsorbBagDupes: absorbBagDupes, onMergeBag: mergeBag, onEnhanceBag: enhanceBag, onDiscardBag: discardBag, onOpenJar: openJar, onUsePotion: usePotion };

// Open jars: each is a gacha roll (map ORx) — openChance × IV, consumed either way.
function openJar(jarId, times) {
  const jar = JARS[jarId];
  if (!jar) return;
  let opened = 0, hits = 0;
  const iv = dropIv();
  while (opened < times && (player.jars[jarId] || 0) >= 1) {
    player.jars[jarId]--;
    opened++;
    if (Math.random() < Math.min(1, jar.openChance * iv)) {
      hits++;
      acquireItem(jar.yields, `${jar.name} yields`);
    }
  }
  if (!opened) return;
  if (!hits) logLine(`Opened ${opened}× ${jar.name} — nothing but dust (${(jar.openChance * iv * 100).toFixed(2)}% each).`, "fail");
  renderEquipment(player, equipHandlers);
}

function usePotion(kind) {
  if ((player.potions[kind] || 0) < 1) return;
  // source tip: "Duplicate use is not possible." — elixir only; int/prob stack-extend
  if (kind === "elixir" && potionActive(player, "elixir", gameState.total_time))
    return logLine("Elixir of Strength: duplicate use is not possible.", "fail");
  player.potions[kind]--;
  // stacking uses extend the timer (map: fixed 30min per potion)
  player.potionUntil[kind] = Math.max(gameState.total_time, player.potionUntil[kind] || 0) + POTION_MS;
  logLine({
    int: "Intelligence Potion: pure INT +120% for 30 minutes.",
    prob: "Probability Potion: all drop & enhance rates +25% for 30 minutes.",
    elixir: "Elixir of Strength: all drop & enhance rates +60% for 30 minutes.",
  }[kind], "success");
  renderEquipment(player, equipHandlers);
}

function mergeBag(bagIdx) {
  const eq = player.specialBag[bagIdx];
  if (!eq) return;
  const def = getItem(eq.itemId);
  const result = tryMerge(player.specialBag, bagIdx, def);
  if (result === "merged") logLine(`Merged two ${def.name} +${eq.plus - 1} → +${eq.plus}!`, "success");
  else if (result === "max") logLine(`${def.name} is already at max merge (+${def.tiers.length - 1}).`);
  else logLine(`Need another ${def.name} +${eq.plus} to merge.`, "fail");
  renderEquipment(player, equipHandlers);
}

function enhanceBag(bagIdx, times) {
  const eq = player.specialBag[bagIdx];
  if (!eq || MERGE_IDS.has(eq.itemId)) return; // talisman family is merge-only
  const def = getItem(eq.itemId);
  // avatars: souls + copper per try on their own (softer) odds bands
  const avatar = AVATAR_IDS.has(eq.itemId);
  const [soulKind, soulCost] = AVATAR_SOULS[eq.itemId] ?? ["old", 2];
  for (let i = 0; i < times; i++) {
    const iv = enhIv();
    const { result, chance } = avatar
      ? tryAvatarEnhance(player, eq, def, soulKind, soulCost, Math.random, gameState.gathering.buffs, iv)
      : tryEnhance(player, eq, def, Math.random, gameState.gathering.buffs, iv);
    if (result === "max") { logLine(`${def.name} is already at max enhancement.`); break; }
    if (result === "poor") { logLine("Out of copper.", "fail"); break; }
    if (result === "nosouls") { logLine(`Need ${soulCost} ${soulKind === "old" ? '"100 years old"' : '"Brilliant Sarah"'} souls per try.`, "fail"); break; }
    const pct = (chance * 100).toFixed(2);
    if (result === "success") {
      logLine(`${def.name} +${eq.plus - 1} → +${eq.plus} SUCCESS (${pct}%)`, "success");
    } else {
      logLine(`${def.name} +${eq.plus} enhancement FAILED (${pct}%)`, "fail");
    }
  }
  renderEquipment(player, equipHandlers);
}

function discardBag(bagIdx) {
  const eq = player.specialBag[bagIdx];
  if (!eq) return;
  const def = getItem(eq.itemId);
  if (!confirm(`Discard ${def.name} +${eq.plus} from the special bag? No refund.`)) return;
  player.specialBag.splice(bagIdx, 1);
  logLine(`Discarded ${def.name} +${eq.plus} from the special bag.`);
  renderEquipment(player, equipHandlers);
}

// Swap = unequip to stash, then Equip from stash. No modal needed.
function unequipToStash(slotIdx) {
  const eq = player.equipment[slotIdx];
  if (!eq) return;
  player.equipment[slotIdx] = null;
  player.stash.push(eq);
  logLine(`Sent ${getItem(eq.itemId).name} +${eq.plus} to the stash.`);
  renderEquipment(player, equipHandlers);
}

function equipStash(stashIdx) {
  const slot = player.equipment.indexOf(null);
  if (slot === -1) return logLine("No free slot — discard something first.", "fail");
  const eq = player.stash.splice(stashIdx, 1)[0];
  if (!eq) return;
  player.equipment[slot] = eq;
  logLine(`Equipped ${getItem(eq.itemId).name} +${eq.plus} from stash.`);
  renderEquipment(player, equipHandlers);
}

function discardStash(stashIdx) {
  const eq = player.stash[stashIdx];
  if (!eq) return;
  const def = getItem(eq.itemId);
  if (!confirm(`Discard ${def.name} +${eq.plus} from stash? No refund.`)) return;
  player.stash.splice(stashIdx, 1);
  logLine(`Discarded ${def.name} +${eq.plus} from stash.`);
  renderEquipment(player, equipHandlers);
}

// Batch-absorb every duplicate in the stash (pre-mastery saves arrive with
// flooded stashes); keeps the best copy of each item.
function absorbStashDupes() {
  const n = new Set(player.stash.map(e => e.itemId)).size;
  const dupes = player.stash.length - n;
  if (!dupes) return;
  if (!confirm(`Absorb ${dupes} duplicate item${dupes > 1 ? "s" : ""} into mastery? The best copy of each item stays.`)) return;
  absorbDupes(player.stash, player.mastery);
  logLine(`Absorbed ${dupes} stash duplicate${dupes > 1 ? "s" : ""} into mastery.`, "success");
  renderEquipment(player, equipHandlers);
}

// Same cleanup for the special bag (pre-dedup saves stacked duplicate ring/
// necklace stats); talisman family untouched — its dupes merge.
function absorbBagDupes() {
  const dupes = bagDupeCount(player.specialBag);
  if (!dupes) return;
  if (!confirm(`Absorb ${dupes} duplicate special item${dupes > 1 ? "s" : ""} into mastery? The best copy of each stays; talismans are never touched.`)) return;
  absorbDupes(player.specialBag, player.mastery, MERGE_IDS);
  logLine(`Absorbed ${dupes} special-bag duplicate${dupes > 1 ? "s" : ""} into mastery.`, "success");
  renderEquipment(player, equipHandlers);
}

// Absorb a stash item into mastery: worth 1 + its plus level (a +20 = 21).
function absorbStash(stashIdx) {
  const eq = player.stash[stashIdx];
  if (!eq) return;
  const def = getItem(eq.itemId);
  const worth = 1 + eq.plus;
  if (!confirm(`Absorb ${def.name} +${eq.plus} into mastery (+${worth})? The item is consumed.`)) return;
  player.stash.splice(stashIdx, 1);
  player.mastery[eq.itemId] = (player.mastery[eq.itemId] || 0) + worth;
  logLine(`Absorbed ${def.name} +${eq.plus} — ${def.name} mastery ${player.mastery[eq.itemId]}.`, "success");
  renderEquipment(player, equipHandlers);
}

function buy(itemId) {
  const def = getItem(itemId);
  const slot = player.equipment.indexOf(null);
  if (slot === -1) return logLine("No free item slots.", "fail");
  if (player.copper < def.cost) return logLine(`Not enough copper for ${def.name}.`, "fail");
  player.copper -= def.cost;
  player.equipment[slot] = { itemId, plus: 0 };
  logLine(`Bought ${def.name} for ${fmt(def.cost)}c.`, "success");
  renderEquipment(player, equipHandlers);
}

function enhance(slotIdx, times) {
  const eq = player.equipment[slotIdx];
  if (!eq) return;
  const def = getItem(eq.itemId);

  for (let i = 0; i < times; i++) {
    const { result, chance } = tryEnhance(player, eq, def, Math.random, gameState.gathering.buffs, enhIv());
    if (result === "max") { logLine(`${def.name} is already at max enhancement.`); break; }
    if (result === "poor") { logLine("Out of copper.", "fail"); break; }
    const pct = (chance * 100).toFixed(2);
    if (result === "success") {
      logLine(`${def.name} +${eq.plus - 1} → +${eq.plus} SUCCESS (${pct}%)`, "success");
    } else {
      logLine(`${def.name} +${eq.plus} enhancement FAILED (${pct}%)`, "fail");
    }
  }
  renderEquipment(player, equipHandlers);
}

function discard(slotIdx) {
  const eq = player.equipment[slotIdx];
  if (!eq) return;
  const def = getItem(eq.itemId);
  if (!confirm(`Discard ${def.name} +${eq.plus}? No refund.`)) return;
  player.equipment[slotIdx] = null;
  logLine(`Discarded ${def.name} +${eq.plus}.`);
  renderEquipment(player, equipHandlers);
}

///// TICK /////
const OFFLINE_MODAL_MIN_MS = 5 * 60 * 1000;

function killSum() {
  return Object.values(gameState.kills).reduce((a, b) => a + b, 0);
}

function showOfflineModal(dt, before) {
  const kills = killSum() - before.kills;
  const copper = player.copper - before.copper;
  if (kills <= 0 && copper <= 0) return; // nothing hunted — skip the fanfare
  const h = Math.floor(dt / 3600000), m = Math.floor(dt / 60000) % 60;
  document.getElementById("offlineBody").innerHTML =
    `Away ${h ? `${h}h ` : ""}${m}m — the grind never stopped:<br>` +
    `<strong>${fmt(kills)}</strong> kills · <strong>+${fmt(copper)}</strong> copper` +
    (player.level > before.level ? ` · Lv ${before.level} → <strong>${player.level}</strong>` : "");
  document.getElementById("offlineModal").style.display = "flex";
}

function tick() {
  const now = Date.now();
  const dt = Math.max(0, Math.min(now - lastLogicTime, OFFLINE_CAP_MS));
  lastLogicTime = now;
  if (dt === 0) return;

  gameState.total_time += dt;

  // INT milestones open character slots; never close them (saves may exceed)
  gameState.slots = Math.max(gameState.slots, unlockedSlots(gameState));

  const before = dt >= OFFLINE_MODAL_MIN_MS
    ? { copper: player.copper, level: player.level, kills: killSum() }
    : null;

  // Isolate sim errors so the autosave below keeps running (a persistent
  // throw here would otherwise silently stop all saving).
  try {
    if (dt > BATCH_THRESHOLD_MS) simulateBatch(dt);
    else simulateLive(dt);

    gatherTick(); // while-loop inside digests any gap, live or offline

    if (before) showOfflineModal(dt, before);
  } catch (e) {
    console.error("[tick sim]", e);
  }

  if (gameState.total_time - gameState.last_save >= 5000) {
    // achievements ride the 5s cadence — ~18 cheap boolean checks
    for (const a of evalAchievements(gameState)) {
      logLine(`Achievement unlocked: ${a.name} — ${a.desc}! (+${ACHIEVEMENT_BONUS * 100}% damage)`, "success");
    }
    save(gameState);
    gameState.last_save = gameState.total_time;
  }
}

// A single mob died: rewards, drops, and refill its slot (or transition the
// whole field for a boss). Regular field mobs respawn in place so the grid
// stays full to farm.
// All copper income routes through here so the Legion copper-find % applies.
function earnCopper(n) {
  const boosted = Math.round(n * (1 + legionBonuses(gameState).copperPct / 100));
  player.copper += boosted;
  return boosted;
}

function resolveKill(mob) {
  if (mob.copper > 0) {
    pushBattleEvent({ type: "kill", copper: earnCopper(mob.copper) });
  }
  gainXP(player, mob.xp);

  if (mob.isBoss) {
    gameState.kills[mob.bossId] = (gameState.kills[mob.bossId] || 0) + 1;
    const boss = getBoss(mob.bossId);
    logLine(`${boss.name} defeated! ${boss.respawnMs ? "Bounty" : "Refund"} ${fmt(mob.copper)}c.`, "success");
    // first-kill trophy: 10× bounty burst + permanent account bonus
    if (gameState.kills[mob.bossId] === 1) {
      const d = boss.drops;
      const base = d?.bounty ? d.bounty * 1e9 ** (d.bountyTier ?? 0) : mob.copper;
      const paid = earnCopper(base * FIRST_KILL_MULT);
      pushBattleEvent({ type: "bag", copper: paid });
      const fb = FIRST_KILL_BONUS[mob.bossId];
      const fbLabel = fb
        ? { dmg: `+${fb[1] * 100}% damage`, drop: `+${fb[1] * 100}% drop rates`, enh: `+${fb[1] * 100}% enhance rates` }[fb[0]]
        : null;
      logLine(`FIRST KILL: ${boss.name}! Trophy bounty +${fmt(paid)}c${fbLabel ? ` and ${fbLabel} forever` : ""}.`, "success");
    }
    rollBossDrops(boss, mob.elite ? (boss.eliteDropMult ?? 1) : 1);
    if (boss.respawnMs) gameState.bossCooldowns[boss.id] = gameState.total_time + boss.respawnMs;
    if (gameState.autoResummon && !boss.respawnMs && player.copper >= boss.summonCost) {
      player.copper -= boss.summonCost;
      gameState.field = [spawnBossMob(boss)];
    } else if (gameState.currentZoneId) {
      selectZone(gameState.currentZoneId, gameState.currentVariant);
    } else {
      gameState.field = [];
    }
    return;
  }

  if (mob.isFieldBoss) {
    const bag = earnCopper(mob.bag); // guaranteed bag (map: 100% drop)
    pushBattleEvent({ type: "bag", copper: bag });
    gameState.fieldKills[mob.zoneId] = (gameState.fieldKills[mob.zoneId] || 0) + 1;
    // INT spike: 100× the zone drip (tutored) — variance on the INT-era grind
    const fbInt = Math.round(intDrip(getZone(mob.zoneId), player) * FIELD_BOSS_INT_MULT * intTutorMult(gameState));
    if (fbInt) player.int += fbInt;
    logLine(`${mob.name} felled! Bag: +${fmt(bag)}c${fbInt ? ` · +${fmt(fbInt)} INT` : ""}.`, "success");
    if (gameState.field.length === 1) selectZone(mob.zoneId, mob.variant); // solo hunt → back to field
    else replaceInField(mob, spawnMob(getZone(mob.zoneId), mob.variant));   // elite in the ranks → regular
    return;
  }

  // regular field mob: INT, rare bag roll, refill the slot — or a field boss joins the ranks
  if (mob.intPerKill) player.int += intDrip(getZone(mob.zoneId), player) * intTutorMult(gameState); // capped drip × legion tutoring
  gameState.kills[mob.zoneId] = (gameState.kills[mob.zoneId] || 0) + 1;
  const iv = dropIv();
  if (Math.random() < BAG_CHANCE * iv) {
    pushBattleEvent({ type: "bag", copper: earnCopper(mob.bag) });
  }
  // zone jar roll (map rates × IV) — field bosses keep their guaranteed-bag identity
  const jarRoll = jarFor(mob.zoneId, mob.variant);
  if (jarRoll && Math.random() < Math.min(1, jarRoll[1] * iv)) {
    player.jars[jarRoll[0]] = (player.jars[jarRoll[0]] || 0) + 1;
    logLine(`A ${JARS[jarRoll[0]].name} drops!`, "success");
  }
  const zone = getZone(mob.zoneId);
  if (Math.random() < FIELD_BOSS_SPAWN_CHANCE) {
    replaceInField(mob, spawnFieldBoss(zone, mob.variant));
    logLine(`A field boss wanders into the ranks!`);
  } else {
    replaceInField(mob, spawnMob(zone, mob.variant));
  }
}

// Bonus damage riding on each auto-attack from active buffs: Power Fist /
// Tiger Flash / Overdrive riders, Wave Eye's 10% roll, Doppelganger clone
// swings. Riders ignore defense (like procs).
function autoRiderDamage(cls, eff) {
  let d = 0;
  const clones = activeClones(eff.clones); // item clones (Abyssal Knuckle) join
  for (const s of skillsOf()) {
    const b = s.buff;
    if (!b || !buffActive(s.id)) continue;
    const L = effSkillLevel(player.skills[s.id], eff);
    if (b.autoRider && (!b.riderChance || Math.random() < b.riderChance)) {
      let r = L * (b.autoRider.base + eff.totalInt * b.autoRider.mult);
      if (b.perAttacker) r *= 1 + clones; // Tiger Flash: clones swing it too
      d += r;
      // Majesty on-hit charges: the rider spends one per auto, buff ends at 0
      const entry = gameState.buffs[s.id];
      if (entry && entry.charges !== undefined) entry.charges--;
    }
    if (b.cloneRider && clones) d += clones * L * (b.cloneRider.base + eff.totalInt * b.cloneRider.mult);
  }
  return Math.round(d);
}

// Small dt: attack-by-attack with real RNG procs, macro, cooldowns.
function simulateLive(dt) {
  if (!frontMob()) return;

  runMacro();
  // Crusader: deterministic passive — skills fire themselves off cooldown
  for (const skill of skillsOf()) {
    if (skill.autocast && player.skills[skill.id]
        && (gameState.cooldowns[skill.id] || 0) <= gameState.total_time) {
      castSkill(skill);
    }
  }

  const eff = effectiveStats();
  const { atk, interval, crit, intProcs, totalInt } = eff;
  const cls = getClass(player.classId);

  // don't let a stale lastAttack (old save) turn into an attack storm
  if (gameState.total_time - player.lastAttack > BATCH_THRESHOLD_MS + interval) {
    player.lastAttack = gameState.total_time - interval;
  }

  // catch-up: cadence-preserving, supports intervals faster than the tick rate
  let guard = 0;
  while (gameState.total_time - player.lastAttack >= interval && guard++ < 1000) {
    player.lastAttack += interval;
    const target = frontMob();
    if (!target) break;

    // Divineress: basic attacks accrue Spheres
    if (cls?.spheres) gameState.spheres = Math.min(cls.spheres.max, gameState.spheres + cls.spheres.perAttack);

    // auto-attack: single target (the front mob); armor strip lowers its
    // defense; item crit multiplies it; buff riders add on top (ignore def)
    let dealt = Math.max(0, atk - Math.max(0, target.defense - eff.armorStrip));
    const isCrit = crit && Math.random() < crit.chance;
    if (isCrit) dealt = Math.round(dealt * crit.mult);
    dealt += autoRiderDamage(cls, eff);
    target.hp -= dealt;
    pushBattleEvent({ type: "hit", dmg: dealt, crit: isCrit });
    if (target.hp <= 0) resolveKill(target);

    // item INT procs: mult × INT bonus hits (ignore defense, like skills)
    for (const p of intProcs) {
      if (Math.random() < p.chance) {
        const t2 = frontMob();
        if (!t2) break;
        const bonus = Math.round(p.mult * totalInt);
        t2.hp -= bonus;
        pushBattleEvent({ type: "skill", dmg: bonus });
        if (t2.hp <= 0) resolveKill(t2);
      }
    }

    // proc skills roll per attack — passive classes AND active-class riders
    // (Desperado's revolver, Storm Trooper's mastery). AoE procs sweep the
    // field around the front mob (the farm-vs-boss lever).
    if (cls) {
      const center = frontMob() || target;
      for (const skill of skillsOf()) {
        if (skill.kind !== "proc") continue;
        const level = player.skills[skill.id];
        if (!level) continue;
        if (skill.requiresBuff && !buffActive(skill.requiresBuff)) continue; // stance-gated
        // Limit Break fires every Nth auto (deterministic); others roll chance
        // × class-weapon activation bonus. Awakened procs carry a real cooldown.
        let fired;
        if (skill.every) {
          const n = (gameState.procCounts[`${skill.id}:n`] = (gameState.procCounts[`${skill.id}:n`] || 0) + 1);
          fired = n % skill.every === 0;
        } else {
          // active buffs can raise a proc's activation chance (War Goddess → Chaser)
          let chance = skill.procChance * eff.procRateMult;
          for (const b of skillsOf()) {
            if (b.buff?.procChanceAdd && buffActive(b.id) && matchesSkill(skill, b.buff.procChanceAdd.target)) {
              chance += b.buff.procChanceAdd.add;
            }
          }
          fired = Math.random() < Math.min(1, chance);
        }
        if (fired && skill.cooldownMs) {
          if ((gameState.cooldowns[skill.id] || 0) > gameState.total_time) fired = false;
          else gameState.cooldowns[skill.id] = gameState.total_time + Math.round(skill.cooldownMs * eff.cdMult);
        }
        if (fired) {
          const L = effSkillLevel(level, eff);
          // Majesty's Imperial stacks: every proc builds one; full = all cooldowns reset
          if (skill.stacksTo) {
            const k = `${skill.id}:stk`;
            gameState.procCounts[k] = (gameState.procCounts[k] || 0) + 1;
            if (gameState.procCounts[k] >= skill.stacksTo) {
              gameState.procCounts[k] = 0;
              resetOtherCooldowns(null);
              logLine(`${skill.name}: ${skill.stacksTo} stacks — cooldowns reset!`, "success");
            }
          }
          // Dark Knight combo: this proc borrows a sibling passive's skill at the
          // same tier (Blood Evil / Indra / Omniblade), damage + shape included
          let dmgSrc = skill;
          if (skill.borrow) {
            const srcCls = getClass(["bloodevil", "indra", "omniblade"][Math.floor(Math.random() * 3)]);
            dmgSrc = skill.borrow.enhanced != null
              ? srcCls.enhanced[skill.borrow.enhanced]
              : srcCls.skills[skill.borrow.tier];
          }
          if (skill.buff) { // Overdrive / Wave Eye: proc (re)starts the buff
            gameState.buffs[skill.id] = { until: gameState.total_time + buffDuration(skill, L) };
          }
          if (skill.armorDebuff) { // Iron Strike armor window
            gameState.buffs[`${skill.id}:armor`] = { until: gameState.total_time + skill.armorDebuff.durationMs };
          }
          let procDmg = skillDamage(dmgSrc, L, totalInt, eff.skillDmgMult, eff.intRatioMult);
          // active buffs that target this proc (Death by Revolver ×3,
          // Miracle Vision's mastery rider, Chaser Evolution) — buff data,
          // enhanced skills included
          for (const b of skillsOf()) {
            if (!b.buff || !buffActive(b.id)) continue;
            const bL = effSkillLevel(player.skills[b.id], eff);
            if (b.buff.procBoost && matchesSkill(skill, b.buff.procBoost.target)) procDmg *= b.buff.procBoost.mult;
            if (b.buff.procRider && matchesSkill(skill, b.buff.procRider.target))
              procDmg += skillDamage(b.buff.procRider, bL, totalInt, eff.skillDmgMult, eff.intRatioMult);
          }
          if (procDmg > 0 && eff.magicCrit && Math.random() < eff.magicCrit.chance) {
            procDmg = Math.round(procDmg * (1 + eff.magicCrit.pct / 100));
          }
          if (procDmg > 0) {
            applySkillDamage(dmgSrc, procDmg, center, radiusOf(dmgSrc, L, buffActive("miracle")));
            pushBattleEvent({ type: "skill", dmg: procDmg });
            if (skill.borrow) logLine(`${skill.name} → ${dmgSrc.name}!`);
          }
          gameState.procCounts[skill.id] = (gameState.procCounts[skill.id] || 0) + 1;
        }
      }
    }
  }

  // mob regen (rare; zones are 0)
  for (const m of gameState.field) {
    if (m.hp > 0 && m.regen) m.hp = Math.min(m.maxHp, m.hp + (m.regen / 1000) * dt);
  }

  if (player.health <= 0) resetHealth(player);
}

// How many of the 4×4 field a radius covers (from the field centre) — used to
// value AoE throughput offline.
function aoeCoverage(radius) {
  let n = 0;
  for (let gy = 0; gy < FIELD_ROWS; gy++) {
    for (let gx = 0; gx < FIELD_COLS; gx++) {
      if (Math.hypot(gx - 1.5, gy - 1.5) <= radius) n++;
    }
  }
  return Math.max(1, n);
}

// Big dt (offline, throttled background tab): closed-form expected value over
// the whole field, so AoE farmers earn their field-clear advantage offline too.
// ponytail: auto-attack + passive-proc EV only — no macro skills, no boss farming
// offline (an active boss reverts to the selected zone field first).
function simulateBatch(dt) {
  if (frontMob()?.isBoss) {
    if (gameState.currentZoneId) selectZone(gameState.currentZoneId, gameState.currentVariant);
    else gameState.field = [];
  }
  const mob = frontMob();
  player.lastAttack = gameState.total_time;
  if (!mob || mob.isBoss || mob.isFieldBoss) return; // only estimate regular zone farming

  const eff = effectiveStats();
  const { atk, interval, crit, intProcs, totalInt } = eff;
  const cls = getClass(player.classId);

  // total damage the field soaks per attack: auto hits 1 (crit EV), item INT
  // procs hit 1, each AoE proc hits its coverage. Buffs are not modeled
  // offline (like macros); armorStrip here is only its static parts — timed
  // debuffs have expired across a big dt.
  let fieldDmgPerAttack = Math.max(0, atk - Math.max(0, mob.defense - eff.armorStrip))
    * (1 + (crit ? crit.chance * (crit.mult - 1) : 0));
  for (const p of intProcs) fieldDmgPerAttack += p.chance * p.mult * totalInt;
  if (cls) {
    for (const skill of skillsOf()) {
      if (skill.kind !== "proc" || skill.cooldownMs) continue; // awakened-proc CDs not modeled offline (like buffs)
      const level = player.skills[skill.id];
      if (!level) continue;
      const chance = skill.every ? 1 / skill.every : Math.min(1, skill.procChance * eff.procRateMult);
      const per = chance * skillDamage(skill, effSkillLevel(level, eff), totalInt, eff.skillDmgMult, eff.intRatioMult)
        * (1 + (eff.magicCrit ? eff.magicCrit.chance * eff.magicCrit.pct / 100 : 0));
      fieldDmgPerAttack += per * (skill.aoe ? aoeCoverage(radiusOf(skill, effSkillLevel(level, eff))) : 1);
    }
  }

  // Crusader autocasts contribute offline: each fires every cooldown
  let autocastDps = 0;
  for (const skill of skillsOf()) {
    if (!skill.autocast) continue;
    const level = player.skills[skill.id];
    if (!level) continue;
    const L = effSkillLevel(level, eff);
    autocastDps += skillDamage(skill, L, totalInt, eff.skillDmgMult, eff.intRatioMult)
      * (skill.aoe ? aoeCoverage(radiusOf(skill, L)) : 1) / (skill.cooldownMs / 1000);
  }
  const fieldDmgPerSec = fieldDmgPerAttack / (interval / 1000) + autocastDps;
  const kills = Math.floor((dt / 1000) * fieldDmgPerSec / mob.maxHp);
  if (kills <= 0) return;

  const copper = earnCopper(Math.round(kills * (mob.copper + BAG_CHANCE * mob.bag)));
  // int drip respects the zone's cap; coarse (whole batch at pre-batch int).
  // Tutoring applies; field-boss spikes don't (not modeled in batch).
  player.int += kills * intDrip(getZone(mob.zoneId), player) * intTutorMult(gameState);
  // jar EV (float counts; no IV offline — buffs aren't modeled in batch)
  const jarEV = jarFor(mob.zoneId, mob.variant);
  if (jarEV) player.jars[jarEV[0]] = (player.jars[jarEV[0]] || 0) + kills * jarEV[1];
  gameState.kills[mob.zoneId] = (gameState.kills[mob.zoneId] || 0) + kills;
  gainXP(player, kills * mob.xp);

  if (dt >= 60_000) {
    const hours = (dt / 3600000).toFixed(1);
    logLine(`Welcome back! While you were gone (${hours}h): ${fmt(kills)} × ${mob.name} slain, +${fmt(copper)}c.`, "success");
  }
}

///// RENDER /////
const bossHandlers = {
  onSummon: summonBoss,
  onToggleAuto: () => { gameState.autoResummon = !gameState.autoResummon; },
};

function render() {
  const eff = effectiveStats();
  updateUI(gameState, player, eff);
  renderBattle(gameState, player);
  renderSkillBar(gameState, player, eff, castSkill);
  renderZoneList(player, selectZone); // key-cached; re-renders when a gate flips
  renderBestiary(gameState);
  renderAchievements(gameState);
  renderLegion(gameState, rosterHandlers);
  renderBossList(gameState, player, eff, bossHandlers);
  renderStatsPanel(gameState, player, eff);
}

///// SAVE ON EXIT /////
let resetting = false;
window.addEventListener("beforeunload", () => {
  if (!resetting) save(gameState);
});

document.getElementById("huntFieldBoss").onclick = huntFieldBoss;

document.getElementById("offlineDismiss").onclick = () => {
  document.getElementById("offlineModal").style.display = "none";
};

// number-format toggle: label shows the CURRENT mode
const fmtToggle = document.getElementById("fmtToggle");
function refreshFmtToggle() {
  fmtToggle.textContent = gameState.settings.fullNumbers ? "1,234,567" : "1.2M";
}
fmtToggle.onclick = () => {
  gameState.settings.fullNumbers = !gameState.settings.fullNumbers;
  refreshFmtToggle();
  renderShop(buy); // static lists re-render; per-frame UI picks it up next tick
  renderEquipment(player, equipHandlers);
  bustRenderCaches();
  save(gameState);
};
refreshFmtToggle();

document.getElementById("resetGame").onclick = () => {
  if (!confirm("Are you sure you want to reset the game? This cannot be undone.")) return;
  if (prompt('Last chance: type "RESET" to wipe your save.') !== "RESET") {
    return logLine("Reset cancelled.");
  }
  resetting = true;
  wipe();
  location.reload();
};

document.getElementById("exportSave").onclick = () => {
  const blob = new Blob([exportSave(gameState)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "esrpg_save.json";
  a.click();
  URL.revokeObjectURL(a.href);
  logLine("Save exported.");
};

const importFile = document.getElementById("importFile");
document.getElementById("importSave").onclick = () => importFile.click();
importFile.onchange = () => {
  const f = importFile.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (importSave(reader.result)) {
      resetting = true; // beforeunload must not overwrite the imported save
      location.reload();
    } else {
      logLine("Invalid save file.", "fail");
      importFile.value = "";
    }
  };
  reader.readAsText(f);
};

///// START /////
initBattle(document.getElementById("battleCanvas"));
if (!player.classId) renderClassSelect(pickClass);
initTabs();
initFeedFilter();
renderCodex(); // static mechanics reference — built once from live constants
renderZoneList(player, selectZone, true);
renderShop(buy);
renderEquipment(player, equipHandlers);
refreshMacro();
refreshGathering();
updateUI(gameState, player, effectiveStats());
startGameLoop(tick, render);
