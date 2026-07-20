// main.js
// Entry point. Loads the save, wires UI, runs the update/render loop.
import { gameState } from "./state.js";
import { save, load, wipe } from "./saveSystem.js";
import { bindFormatSettings } from "./format.js";
import { startGameLoop } from "./gameLoop.js";
import { updateUI, renderZoneList, renderShop, renderEquipment, logLine, fmt } from "./ui.js";
import { getZone, spawnMob, spawnField, spawnFieldBoss, gridDist, zoneLocked, intDrip, FIELD_COLS, FIELD_ROWS, BAG_CHANCE, FIELD_BOSS_SPAWN_CHANCE } from "./zones.js";
import { newCharacter, gainXP, resetHealth, agiSpeedPct } from "./player.js";
import { getItem, aggregate, SPECIAL_IDS, MERGE_IDS, AVATAR_IDS, AVATAR_SOULS, CLASS_WEAPON } from "./items.js";
import { tryEnhance, tryMerge, tryAvatarEnhance } from "./enhance.js";
import { JARS, jarFor, ivMult, potionActive, POTION_MS, INT_POTION_MULT } from "./consumables.js";
import { getClass, skillDamage, classStatBonuses, radiusOf, buffDuration, MAX_SKILL_LEVEL, activeSkills, matchesSkill } from "./classes.js";
import { renderClassSelect, hideClassSelect, renderSkillBar, renderBossList, renderBestiary, initTabs, initFeedFilter, bustRenderCaches } from "./ui.js";
import { bestiaryBonus } from "./bestiary.js";
import { renderMacro } from "./ui.js";
import { UNLOCK_COST, MAX_SLOTS, intervalMs, intervalUpgradeCost, slotCost } from "./macro.js";
import { renderGathering, renderLegion } from "./ui.js";
import { legionBonuses, unlockedSlots } from "./legion.js";
import { initBattle, renderBattle, pushBattleEvent } from "./battle.js";
import { ACTIVITIES, tickIntervalMs, xpToNext, HAMMER_ORE_COST, OFFERING_FISH_COST, INT_POTION_FISH_COST, PROB_POTION_ORE_COST, OK_TICKET_COST } from "./gathering.js";
import { getBoss, spawnBossMob, TICKET_SUCCESS } from "./bosses.js";
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
  const locked = zoneLocked(zone, player);
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

const buffActive = id => (gameState.buffs[id]?.until ?? 0) > gameState.total_time;

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
  const g = aggregate(player.equipment, player.specialBag);
  const leg = legionBonuses(gameState);
  const cls = getClass(player.classId);
  const statSk = classStatBonuses(cls, player.skills, g.skillLevelBonus);

  // buff-driven bonuses (Khai haste, Miracle skill dmg) + timed armor debuffs
  let buffSpdPct = 0, buffSkillDmgPct = 0, timedArmor = 0;
  for (const s of cls?.skills ?? []) {
    const level = player.skills[s.id];
    if (!level) continue;
    const L = level + g.skillLevelBonus;
    if (s.buff && buffActive(s.id)) {
      buffSpdPct += (s.buff.atkSpdPctPerLevel ?? 0) * L;
      buffSkillDmgPct += (s.buff.skillDmgPctPerLevel ?? 0) * L;
    }
    if (s.armorDebuff && buffActive(`${s.id}:armor`)) timedArmor += s.armorDebuff.perLevel * L;
  }
  // dmgInc ("Increase attack power by N%") stacks additively with the other
  // percent bonuses; addDmg ("Additional damage", best item only) multiplies
  // on top — matches the source tooltips' two separate multiplier families.
  const bonus = 1 + bestiaryBonus(gameState) + statSk.atkPct / 100
    + leg.dmgPct / 100 + g.dmgIncPct / 100;
  // INT (character + item) is flat 1:1 damage, added before the % multipliers.
  // INT potion multiplies PURE (character) INT only — item INT untouched (map).
  const pureMult = potionActive(player, "int", gameState.total_time) ? INT_POTION_MULT : 1;
  const totalInt = Math.round(player.int * pureMult) + g.int;
  const atkTotal = Math.round((player.attack + g.atk + totalInt) * bonus * (1 + g.addDmgPct / 100));
  // WC3 caps the total attack-speed bonus at +400% (AGI alone gets there by lv9)
  const spdPct = Math.min(400, agiSpeedPct(player) + g.spdPct + leg.atkSpeedPct + statSk.atkSpdPct + buffSpdPct);
  return {
    atk: atkTotal,
    // source skill formula: level × (base + INT × mult) × this
    skillDmgMult: 1 + (leg.skillDmgPct + g.skillDmgPct + buffSkillDmgPct) / 100,
    interval: player.attackSpeed / (1 + spdPct / 100),
    // enemy armor stripped from autos: item auras + Boxing Gloves + timed debuffs
    armorStrip: g.defReduce + statSk.armorReduce + timedArmor,
    totalInt,
    crit: g.crit,             // {chance, mult} | null — auto-attacks only
    intProcs: g.intProcs,     // [{chance, mult}] — mult × INT bonus per auto
    cdMult: 1 - g.cooldownPct / 100,
    skillLevelBonus: g.skillLevelBonus,
    // class-weapon meta-modifiers + avatar magic crit
    intRatioMult: 1 + g.intRatioPct / 100,   // scales the INT×mult term of skills
    procRateMult: 1 + g.procRatePct / 100,   // scales proc-skill activation chance
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

function castSkill(skill) {
  const level = player.skills[skill.id];
  const target = frontMob();
  if (skill.kind !== "cast" || !level || !target) return;
  if ((gameState.cooldowns[skill.id] || 0) > gameState.total_time) return;

  const eff = effectiveStats();
  gameState.cooldowns[skill.id] = gameState.total_time + Math.round(skill.cooldownMs * eff.cdMult);
  if (skill.resetsCooldowns) { // Sesto Elemental: every other cooldown clears
    for (const id of Object.keys(gameState.cooldowns)) {
      if (id !== skill.id) gameState.cooldowns[id] = 0;
    }
  }
  const L = effSkillLevel(level, eff);
  if (skill.buff) {
    gameState.buffs[skill.id] = { until: gameState.total_time + buffDuration(skill, L) };
    logLine(`${skill.name} active.`, "success");
  }
  if (skill.armorDebuff) {
    gameState.buffs[`${skill.id}:armor`] = { until: gameState.total_time + skill.armorDebuff.durationMs };
  }
  let dmg = skillDamage(skill, L, eff.totalInt, eff.skillDmgMult, eff.intRatioMult);
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
    player.specialBag.push({ itemId, plus: 0 });
    logLine(`${sourceLabel} ${def.name}! → special bag.`, "success");
    renderEquipment(player, equipHandlers);
    return;
  }
  const slot = player.equipment.indexOf(null);
  if (slot !== -1) {
    player.equipment[slot] = { itemId, plus: 0 };
    logLine(`${sourceLabel} ${def.name}!`, "success");
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

function rollBossDrops(boss) {
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
  // all boss drop rolls scale with the source IV multiplier (probability potion)
  const iv = ivMult(player, gameState.total_time);
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
const equipHandlers = { onEnhance: enhance, onUnequip: unequipToStash, onDiscard: discard, onEquipStash: equipStash, onDiscardStash: discardStash, onMergeBag: mergeBag, onEnhanceBag: enhanceBag, onDiscardBag: discardBag, onOpenJar: openJar, onUsePotion: usePotion };

// Open jars: each is a gacha roll (map ORx) — openChance × IV, consumed either way.
function openJar(jarId, times) {
  const jar = JARS[jarId];
  if (!jar) return;
  let opened = 0, hits = 0;
  const iv = ivMult(player, gameState.total_time);
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
  player.potions[kind]--;
  // stacking uses extend the timer (map: fixed 30min per potion)
  player.potionUntil[kind] = Math.max(gameState.total_time, player.potionUntil[kind] || 0) + POTION_MS;
  logLine(kind === "int"
    ? "Intelligence Potion: pure INT +120% for 30 minutes."
    : "Probability Potion: all drop & enhance rates +25% for 30 minutes.", "success");
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
    const iv = ivMult(player, gameState.total_time);
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
    const { result, chance } = tryEnhance(player, eq, def, Math.random, gameState.gathering.buffs, ivMult(player, gameState.total_time));
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

  if (dt > BATCH_THRESHOLD_MS) simulateBatch(dt);
  else simulateLive(dt);

  gatherTick(); // while-loop inside digests any gap, live or offline

  if (before) showOfflineModal(dt, before);

  if (gameState.total_time - gameState.last_save >= 5000) {
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
    rollBossDrops(boss);
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
    logLine(`${mob.name} felled! Bag: +${fmt(bag)}c.`, "success");
    if (gameState.field.length === 1) selectZone(mob.zoneId, mob.variant); // solo hunt → back to field
    else replaceInField(mob, spawnMob(getZone(mob.zoneId), mob.variant));   // elite in the ranks → regular
    return;
  }

  // regular field mob: INT, rare bag roll, refill the slot — or a field boss joins the ranks
  if (mob.intPerKill) player.int += intDrip(getZone(mob.zoneId), player); // "No INT after X" cap
  gameState.kills[mob.zoneId] = (gameState.kills[mob.zoneId] || 0) + 1;
  const iv = ivMult(player, gameState.total_time);
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
    }
    if (b.cloneRider && clones) d += clones * L * (b.cloneRider.base + eff.totalInt * b.cloneRider.mult);
  }
  return Math.round(d);
}

// Small dt: attack-by-attack with real RNG procs, macro, cooldowns.
function simulateLive(dt) {
  if (!frontMob()) return;

  runMacro();

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
        // Limit Break fires every Nth auto (deterministic); others roll chance
        // × class-weapon activation bonus. Awakened procs carry a real cooldown.
        let fired;
        if (skill.every) {
          const n = (gameState.procCounts[`${skill.id}:n`] = (gameState.procCounts[`${skill.id}:n`] || 0) + 1);
          fired = n % skill.every === 0;
        } else {
          fired = Math.random() < Math.min(1, skill.procChance * eff.procRateMult);
        }
        if (fired && skill.cooldownMs) {
          if ((gameState.cooldowns[skill.id] || 0) > gameState.total_time) fired = false;
          else gameState.cooldowns[skill.id] = gameState.total_time + Math.round(skill.cooldownMs * eff.cdMult);
        }
        if (fired) {
          const L = effSkillLevel(level, eff);
          if (skill.buff) { // Overdrive / Wave Eye: proc (re)starts the buff
            gameState.buffs[skill.id] = { until: gameState.total_time + buffDuration(skill, L) };
          }
          if (skill.armorDebuff) { // Iron Strike armor window
            gameState.buffs[`${skill.id}:armor`] = { until: gameState.total_time + skill.armorDebuff.durationMs };
          }
          let procDmg = skillDamage(skill, L, totalInt, eff.skillDmgMult, eff.intRatioMult);
          // active buffs that target this proc (Death by Revolver ×3,
          // Miracle Vision's mastery rider) — declared on the buff data
          for (const b of cls.skills) {
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
            applySkillDamage(skill, procDmg, center, radiusOf(skill, L, buffActive("miracle")));
            pushBattleEvent({ type: "skill", dmg: procDmg });
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

  const fieldDmgPerSec = fieldDmgPerAttack / (interval / 1000);
  const kills = Math.floor((dt / 1000) * fieldDmgPerSec / mob.maxHp);
  if (kills <= 0) return;

  const copper = earnCopper(Math.round(kills * (mob.copper + BAG_CHANCE * mob.bag)));
  // int drip respects the zone's cap; coarse (whole batch at pre-batch int)
  player.int += kills * intDrip(getZone(mob.zoneId), player);
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
  renderLegion(gameState, rosterHandlers);
  renderBossList(gameState, player, bossHandlers);
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
  if (confirm("Are you sure you want to reset the game? This cannot be undone.")) {
    resetting = true;
    wipe();
    location.reload();
  }
};

///// START /////
initBattle(document.getElementById("battleCanvas"));
if (!player.classId) renderClassSelect(pickClass);
initTabs();
initFeedFilter();
renderZoneList(player, selectZone, true);
renderShop(buy);
renderEquipment(player, equipHandlers);
refreshMacro();
refreshGathering();
updateUI(gameState, player, effectiveStats());
startGameLoop(tick, render);
