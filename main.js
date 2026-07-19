// main.js
// Entry point. Loads the save, wires UI, runs the update/render loop.
import { gameState } from "./state.js";
import { save, load, wipe } from "./saveSystem.js";
import { startGameLoop } from "./gameLoop.js";
import { updateUI, renderZoneList, renderShop, renderEquipment, logLine, fmt } from "./ui.js";
import { getZone, spawnMob, spawnFieldBoss, BAG_CHANCE, FIELD_BOSS_SPAWN_CHANCE } from "./zones.js";
import { player } from "./player.js";
import { getItem, aggregate } from "./items.js";
import { tryEnhance, MAX_PLUS } from "./enhance.js";
import { getClass, skillDamage, MAX_SKILL_LEVEL } from "./classes.js";
import { renderClassSelect, hideClassSelect, renderSkillBar, renderBossList, renderBestiary } from "./ui.js";
import { bestiaryBonus } from "./bestiary.js";
import { renderMacro } from "./ui.js";
import { UNLOCK_COST, MAX_SLOTS, intervalMs, intervalUpgradeCost, slotCost } from "./macro.js";
import { renderGathering, renderLegion } from "./ui.js";
import { RETIRE_MIN_LEVEL, legionBonus } from "./legion.js";
import { initBattle, renderBattle, pushBattleEvent } from "./battle.js";
import { ACTIVITIES, tickIntervalMs, xpToNext, HAMMER_ORE_COST, OFFERING_FISH_COST } from "./gathering.js";
import { getBoss, spawnBossMob, TICKET_CHANCE, TICKET_SUCCESS, ITEM_DROP_CHANCE } from "./bosses.js";

///// LOAD SAVE /////
const savedGame = load(gameState, player);

function selectZone(zoneId, variantIndex) {
  const zone = getZone(zoneId);
  if (!zone) return;
  gameState.currentZoneId = zoneId;
  gameState.currentVariant = variantIndex;
  gameState.currentMob = spawnMob(zone, variantIndex);
}

// Hunt the field boss for the currently selected zone/variant.
function huntFieldBoss() {
  if (!gameState.currentZoneId) return logLine("Select a hunting ground first.", "fail");
  const zone = getZone(gameState.currentZoneId);
  gameState.currentMob = spawnFieldBoss(zone, gameState.currentVariant);
  logLine(`A ${gameState.currentMob.name} lumbers into view.`);
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
  hideClassSelect();
  logLine(`You are now a ${cls.name}. There is no repick. Good luck.`, "success");
  refreshMacro();
  save(gameState, player);
}

function effectiveStats() {
  const { atk, spdPct } = aggregate(player.equipment);
  const bonus = 1 + bestiaryBonus(gameState) + legionBonus(gameState.legion.retired);
  return {
    atk: Math.round((player.attack + atk) * bonus),
    interval: player.attackSpeed / (1 + spdPct / 100),
  };
}

function castSkill(skill) {
  const level = player.skills[skill.id];
  const mob = gameState.currentMob;
  if (!level || !mob) return;
  if ((gameState.cooldowns[skill.id] || 0) > gameState.total_time) return;

  gameState.cooldowns[skill.id] = gameState.total_time + skill.cooldownMs;
  const dmg = skillDamage(skill, level, effectiveStats().atk);
  mob.hp -= dmg;
  pushBattleEvent({ type: "skill", dmg });
  if (mob.hp <= 0) killMob(mob);
}

window.addEventListener("keydown", e => {
  const cls = getClass(player.classId);
  if (!cls || cls.archetype !== "active" || e.repeat) return;
  const skill = cls.skills.find(s => s.key === e.key.toUpperCase());
  if (skill) castSkill(skill);
});

///// BOSSES /////
function summonBoss(bossId) {
  const boss = getBoss(bossId);
  if (gameState.copper < boss.summonCost) return logLine(`Need ${fmt(boss.summonCost)}c to summon ${boss.name}.`, "fail");
  gameState.copper -= boss.summonCost;
  gameState.currentMob = spawnBossMob(boss);
  logLine(`Summoned ${boss.name}.`);
}

function rollBossDrops(boss) {
  // items
  for (const itemId of boss.itemIds) {
    if (Math.random() >= ITEM_DROP_CHANCE) continue;
    const def = getItem(itemId);
    const slot = player.equipment.indexOf(null);
    if (slot === -1) {
      logLine(`${def.name} dropped, but your bags are full. It disintegrates.`, "fail");
    } else {
      player.equipment[slot] = { itemId, plus: 0 };
      logLine(`${boss.name} dropped ${def.name}!`, "success");
      renderEquipment(player, equipHandlers);
    }
  }

  // skill ticket
  if (boss.skillIndex === null || Math.random() >= TICKET_CHANCE) return;
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

///// MACRO WORKSHOP /////
const macroHandlers = {
  onUnlock() {
    if (gameState.copper < UNLOCK_COST) return logLine("Can't afford the macro workshop yet.", "fail");
    gameState.copper -= UNLOCK_COST;
    gameState.macro.unlocked = true;
    logLine("Macro Workshop unlocked. Definitely not bannable.", "success");
    refreshMacro();
  },
  onToggle() { gameState.macro.enabled = !gameState.macro.enabled; refreshMacro(); },
  onUpgradeInterval() {
    const cost = intervalUpgradeCost(gameState.macro.intervalLevel);
    if (gameState.copper < cost) return logLine("Fingers not affordable.", "fail");
    gameState.copper -= cost;
    gameState.macro.intervalLevel++;
    refreshMacro();
  },
  onBuySlot() {
    const cost = slotCost(gameState.macro.slots.length + 1);
    if (gameState.copper < cost) return logLine("Can't afford another macro step.", "fail");
    gameState.copper -= cost;
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
  for (let i = 0; i < m.slots.length; i++) {
    const idx = ((m.ptr || 0) + i) % m.slots.length;
    const skill = cls.skills.find(s => s.id === m.slots[idx]);
    if (!skill || !player.skills[skill.id]) continue;
    if ((gameState.cooldowns[skill.id] || 0) > gameState.total_time) continue;
    castSkill(skill);
    m.ptr = (idx + 1) % m.slots.length;
    break;
  }
}

///// LEGION /////
function retireCharacter() {
  if (player.level < RETIRE_MIN_LEVEL) return;
  const cls = getClass(player.classId);
  if (!confirm(`Retire your Lv${player.level} ${cls.name} into the Legion? ` +
    `Class, level, skills and equipment are gone forever. ` +
    `Copper, bestiary, gathering and macros stay.`)) return;

  gameState.legion.retired.push({ classId: player.classId, level: player.level });
  logLine(`${cls.name} retired at Lv${player.level}. The Legion grows.`, "success");

  // fresh character; account-wide systems untouched
  Object.assign(player, {
    health: 100, maxHealth: 100,
    attack: 1, attackSpeed: 1000, lastAttack: 0,
    level: 1, xp: 0, xpToNext: 100,
    equipment: [null, null, null, null, null, null],
    classId: null, skills: {},
  });
  gameState.cooldowns = {};
  gameState.procCounts = {};
  gameState.currentMob = null;
  gameState.currentZoneId = null;
  gameState.macro.enabled = false;

  renderEquipment(player, equipHandlers);
  refreshMacro();
  renderClassSelect(pickClass);
  save(gameState, player);
}

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
};

function refreshGathering() {
  renderGathering(gameState, gatheringHandlers);
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
const equipHandlers = { onEnhance: enhance, onDiscard: discard };

function buy(itemId) {
  const def = getItem(itemId);
  const slot = player.equipment.indexOf(null);
  if (slot === -1) return logLine("No free item slots.", "fail");
  if (gameState.copper < def.cost) return logLine(`Not enough copper for ${def.name}.`, "fail");
  gameState.copper -= def.cost;
  player.equipment[slot] = { itemId, plus: 0 };
  logLine(`Bought ${def.name} for ${fmt(def.cost)}c.`, "success");
  renderEquipment(player, equipHandlers);
}

function enhance(slotIdx, times) {
  const eq = player.equipment[slotIdx];
  if (!eq) return;
  const def = getItem(eq.itemId);

  for (let i = 0; i < times; i++) {
    const { result, chance } = tryEnhance(gameState, eq, def, Math.random, gameState.gathering.buffs);
    if (result === "max") { logLine(`${def.name} is already +${MAX_PLUS}.`); break; }
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
function tick() {
  const now = Date.now();
  const dt = Math.max(0, Math.min(now - lastLogicTime, OFFLINE_CAP_MS));
  lastLogicTime = now;
  if (dt === 0) return;

  gameState.total_time += dt;

  if (dt > BATCH_THRESHOLD_MS) simulateBatch(dt);
  else simulateLive(dt);

  gatherTick(); // while-loop inside digests any gap, live or offline

  if (gameState.total_time - gameState.last_save >= 5000) {
    save(gameState, player);
    gameState.last_save = gameState.total_time;
  }
}

// Mob died: rewards, drops, respawn. Shared by live and (indirectly) batch.
function killMob(mob) {
  if (mob.copper > 0) {
    pushBattleEvent({ type: "kill", copper: mob.copper });
    gameState.copper += mob.copper;
  }
  player.gainXP(mob.xp);

  if (mob.isBoss) {
    gameState.kills[mob.bossId] = (gameState.kills[mob.bossId] || 0) + 1;
    const boss = getBoss(mob.bossId);
    logLine(`${boss.name} defeated! Refund ${fmt(mob.copper)}c.`, "success");
    rollBossDrops(boss);
    if (gameState.autoResummon && gameState.copper >= boss.summonCost) {
      gameState.copper -= boss.summonCost;
      gameState.currentMob = spawnBossMob(boss);
    } else if (gameState.currentZoneId) {
      selectZone(gameState.currentZoneId, gameState.currentVariant);
    } else {
      gameState.currentMob = null;
    }
    return;
  }

  if (mob.isFieldBoss) {
    // guaranteed bag (map: 100% drop), separate kill counter, back to farming
    gameState.copper += mob.bag;
    pushBattleEvent({ type: "bag", copper: mob.bag });
    gameState.fieldKills[mob.zoneId] = (gameState.fieldKills[mob.zoneId] || 0) + 1;
    logLine(`${mob.name} felled! Bag: +${fmt(mob.bag)}c.`, "success");
    selectZone(mob.zoneId, mob.variant); // return to the regular mob
    return;
  }

  // regular mob: rare bag roll, then respawn — or a field boss wanders in
  gameState.kills[mob.zoneId] = (gameState.kills[mob.zoneId] || 0) + 1;
  if (Math.random() < BAG_CHANCE) {
    gameState.copper += mob.bag;
    pushBattleEvent({ type: "bag", copper: mob.bag });
  }
  const zone = getZone(mob.zoneId);
  if (Math.random() < FIELD_BOSS_SPAWN_CHANCE) {
    gameState.currentMob = spawnFieldBoss(zone, mob.variant);
    logLine(`A ${gameState.currentMob.name} wanders in!`);
  } else {
    gameState.currentMob = spawnMob(zone, mob.variant);
  }
}

// Small dt: attack-by-attack with real RNG procs, macro, cooldowns.
function simulateLive(dt) {
  if (!gameState.currentMob) return;

  runMacro();

  const { atk, interval } = effectiveStats();
  const cls = getClass(player.classId);

  // don't let a stale lastAttack (old save) turn into an attack storm
  if (gameState.total_time - player.lastAttack > BATCH_THRESHOLD_MS + interval) {
    player.lastAttack = gameState.total_time - interval;
  }

  // catch-up: cadence-preserving, supports intervals faster than the tick rate
  let guard = 0;
  while (gameState.total_time - player.lastAttack >= interval && guard++ < 1000) {
    player.lastAttack += interval;
    const mob = gameState.currentMob;
    if (!mob) break;

    const dealt = Math.max(0, atk - mob.defense);
    mob.hp -= dealt;
    pushBattleEvent({ type: "hit", dmg: dealt });

    // passive class: each known skill rolls its proc chance per attack
    if (cls && cls.archetype === "passive") {
      for (const skill of cls.skills) {
        const level = player.skills[skill.id];
        if (level && Math.random() < skill.procChance) {
          const procDmg = skillDamage(skill, level, atk);
          mob.hp -= procDmg;
          pushBattleEvent({ type: "skill", dmg: procDmg });
          gameState.procCounts[skill.id] = (gameState.procCounts[skill.id] || 0) + 1;
        }
      }
    }

    if (mob.hp <= 0) killMob(mob);
  }

  const mob = gameState.currentMob;
  if (mob) mob.hp = Math.min(mob.maxHp, mob.hp + (mob.regen / 1000) * dt);

  if (player.health <= 0) {
    player.reset();
    gameState.currentMob = null;
  }
}

// Big dt (offline, throttled background tab): closed-form expected value.
// ponytail: auto-attack + passive-proc EV only — no macro skills, no boss
// farming offline (an active boss reverts to the selected zone first).
function simulateBatch(dt) {
  if (gameState.currentMob?.isBoss) {
    if (gameState.currentZoneId) selectZone(gameState.currentZoneId, gameState.currentVariant);
    else gameState.currentMob = null;
  }
  const mob = gameState.currentMob;
  player.lastAttack = gameState.total_time;
  if (!mob) return;

  const { atk, interval } = effectiveStats();
  const cls = getClass(player.classId);

  let perAttack = Math.max(0, atk - mob.defense);
  if (cls && cls.archetype === "passive") {
    for (const skill of cls.skills) {
      const level = player.skills[skill.id];
      if (level) perAttack += skill.procChance * skillDamage(skill, level, atk);
    }
  }

  const netDps = perAttack / (interval / 1000) - mob.regen;
  if (netDps <= 0) return;

  const kills = Math.floor(dt / (mob.maxHp / netDps * 1000));
  if (kills <= 0) return;

  const copper = Math.round(kills * (mob.copper + BAG_CHANCE * mob.bag));
  gameState.copper += copper;
  gameState.kills[mob.zoneId] = (gameState.kills[mob.zoneId] || 0) + kills;
  player.gainXP(kills * mob.xp);

  if (dt >= 60_000) {
    const hours = (dt / 3600000).toFixed(1);
    logLine(`Welcome back! While you were gone (${hours}h): ${fmt(kills)} × ${mob.name} slain, +${fmt(copper)}c.`, "success");
  }
}

///// RENDER /////
function render() {
  updateUI(gameState, player);
  renderBattle(gameState, player);
  renderSkillBar(gameState, player, effectiveStats().atk);
  renderBestiary(gameState);
  renderLegion(gameState, player, retireCharacter);
}

///// SAVE ON EXIT /////
let resetting = false;
window.addEventListener("beforeunload", () => {
  if (!resetting) save(gameState, player);
});

document.getElementById("huntFieldBoss").onclick = huntFieldBoss;

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
renderZoneList(gameState, selectZone);
renderBossList(gameState, {
  onSummon: summonBoss,
  onToggleAuto: () => { gameState.autoResummon = !gameState.autoResummon; },
});
renderShop(buy);
renderEquipment(player, equipHandlers);
refreshMacro();
refreshGathering();
updateUI(gameState, player);
startGameLoop(tick, render);
