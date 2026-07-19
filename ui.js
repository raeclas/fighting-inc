// ui.js
// DOM updates, zone list, shop, equipment, and the enhance feed.
import { zones, VARIANTS } from "./zones.js";
import { items, getItem, statValue, aggregate } from "./items.js";
import { enhanceChance, MAX_PLUS } from "./enhance.js";
import { classes, getClass, skillDamage } from "./classes.js";
import { bosses, INTEREST } from "./bosses.js";
import { bestiaryEntries, bestiaryBonus, MILESTONES } from "./bestiary.js";
import { UNLOCK_COST, MAX_SLOTS, MAX_INTERVAL_LEVEL, intervalMs, intervalUpgradeCost, slotCost } from "./macro.js";
import { ACTIVITIES, tickIntervalMs, xpToNext, HAMMER_ORE_COST, OFFERING_FISH_COST } from "./gathering.js";
import { RETIRE_MIN_LEVEL, legionBonus } from "./legion.js";

// 1234567 -> "1.23M"
export function fmt(n) {
  if (n < 1e4) return Math.floor(n).toString();
  const units = ["", "k", "M", "B", "T", "Qa"];
  const tier = Math.min(units.length - 1, Math.floor(Math.log10(n) / 3));
  return (n / 10 ** (tier * 3)).toFixed(2) + units[tier];
}

export function updateUI(state, player) {
  const { atk, spdPct } = aggregate(player.equipment);
  const interval = Math.round(player.attackSpeed / (1 + spdPct / 100));

  document.getElementById("playerHealth").textContent = player.health;
  document.getElementById("playerCopper").textContent = fmt(state.copper);
  document.getElementById("playerDamage").textContent = fmt(player.attack + atk);
  document.getElementById("playerAttackSpeed").textContent = interval;
  document.getElementById("playerLevel").textContent = player.level;
  document.getElementById("playerXP").textContent = `${fmt(player.xp)}/${fmt(player.xpToNext)}`;

  const mob = state.currentMob;
  document.getElementById("mobName").textContent = mob ? mob.name : "No zone selected";
  document.getElementById("mobHealth").textContent = mob ? `${fmt(Math.max(0, mob.hp))}/${fmt(mob.maxHp)}` : "";
  document.getElementById("mobDefense").textContent = mob ? fmt(mob.defense) : "";
  document.getElementById("mobRegen").textContent = mob ? fmt(mob.regen) : "";
  document.getElementById("mobCopper").textContent = mob ? fmt(mob.copper) : "";
  document.getElementById("mobKills").textContent = mob ? (state.kills[mob.isBoss ? mob.bossId : mob.zoneId] || 0) : "";

  const fbBtn = document.getElementById("huntFieldBoss");
  const onFieldBoss = mob && mob.isFieldBoss;
  fbBtn.disabled = !state.currentZoneId || onFieldBoss;
  fbBtn.style.display = state.currentZoneId ? "" : "none";
  const fk = state.currentZoneId ? (state.fieldKills[state.currentZoneId] || 0) : 0;
  document.getElementById("fieldKills").textContent =
    state.currentZoneId ? ` Field bosses felled here: ${fmt(fk)}` : "";
}

export function renderZoneList(state, onSelect) {
  const container = document.querySelector(".zoneList");
  container.innerHTML = "";

  zones.forEach(zone => {
    const div = document.createElement("div");
    div.className = "zoneEntry";

    const label = document.createElement("strong");
    label.textContent = zone.mobName;
    div.appendChild(label);

    VARIANTS.forEach((mult, i) => {
      const btn = document.createElement("button");
      btn.textContent = `${mult}x`;
      btn.onclick = () => onSelect(zone.id, i);
      div.appendChild(btn);
    });

    container.appendChild(div);
  });
}

export function renderShop(onBuy) {
  const container = document.querySelector(".shopList");
  container.innerHTML = "";

  items.filter(d => d.shop).forEach(def => {
    const div = document.createElement("div");
    div.className = "shopEntry";
    const statLabel = def.stat === "atk" ? `ATK +${def.base}` : `ATK SPD +${def.base}%`;
    div.innerHTML = `<strong>${def.name}</strong> — ${fmt(def.cost)}c<br>
      ${statLabel} (at +20: ${def.stat === "atk" ? "ATK +" + def.per20 : "ATK SPD +" + def.per20 + "%"})<br>
      Enhance cost: ${fmt(def.enhCost)}c/try`;
    const btn = document.createElement("button");
    btn.textContent = "Buy";
    btn.onclick = () => onBuy(def.id);
    div.appendChild(btn);
    container.appendChild(div);
  });
}

// handlers: { onEnhance(slotIdx, times), onDiscard(slotIdx) }
export function renderEquipment(player, handlers) {
  const container = document.querySelector(".equipmentList");
  container.innerHTML = "";

  player.equipment.forEach((eq, i) => {
    const div = document.createElement("div");
    div.className = "equipSlot";

    if (!eq) {
      div.textContent = `Slot ${i + 1}: (empty)`;
      container.appendChild(div);
      return;
    }

    const def = getItem(eq.itemId);
    const v = statValue(def, eq.plus);
    const statLabel = def.stat === "atk" ? `ATK +${fmt(v)}` : `ATK SPD +${v}%`;
    const next = eq.plus >= MAX_PLUS
      ? "MAX"
      : `next: ${(enhanceChance(eq.plus) * 100).toFixed(2)}% @ ${fmt(def.enhCost)}c`;

    const info = document.createElement("div");
    info.innerHTML = `<strong>${def.name} +${eq.plus}</strong><br>${statLabel} — ${next}`;
    div.appendChild(info);

    [1, 10, 30].forEach(times => {
      const btn = document.createElement("button");
      btn.textContent = `x${times}`;
      btn.onclick = () => handlers.onEnhance(i, times);
      div.appendChild(btn);
    });

    const discard = document.createElement("button");
    discard.textContent = "Discard";
    discard.onclick = () => handlers.onDiscard(i);
    div.appendChild(discard);

    container.appendChild(div);
  });
}

// handlers: { onSummon(bossId), onToggleAuto() }
export function renderBossList(state, handlers) {
  const container = document.querySelector(".bossList");
  container.innerHTML = "";

  bosses.forEach(boss => {
    const div = document.createElement("div");
    div.className = "bossEntry";
    div.innerHTML = `<strong>${boss.name}</strong><br>
      HP ${fmt(boss.hp)} · DEF ${fmt(boss.defense)} · Summon ${fmt(boss.summonCost)}c
      (refund ${fmt(Math.round(boss.summonCost * INTEREST))}c on kill)`;
    const btn = document.createElement("button");
    btn.textContent = "Summon";
    btn.onclick = () => handlers.onSummon(boss.id);
    div.appendChild(btn);
    container.appendChild(div);
  });

  const autoLabel = document.createElement("label");
  const auto = document.createElement("input");
  auto.type = "checkbox";
  auto.checked = state.autoResummon;
  auto.onchange = handlers.onToggleAuto;
  autoLabel.appendChild(auto);
  autoLabel.append(" Auto-resummon on kill (the penguin button)");
  container.appendChild(autoLabel);
}

export function renderClassSelect(onPick) {
  const overlay = document.getElementById("classSelect");
  const list = overlay.querySelector(".classList");
  list.innerHTML = "";

  classes.forEach(cls => {
    const div = document.createElement("div");
    div.className = "classEntry";
    div.innerHTML = `<strong>${cls.name}</strong> (${cls.archetype})<br>${cls.desc}`;
    const btn = document.createElement("button");
    btn.textContent = `Play ${cls.name}`;
    btn.onclick = () => onPick(cls.id);
    div.appendChild(btn);
    list.appendChild(div);
  });

  overlay.style.display = "flex";
}

export function hideClassSelect() {
  document.getElementById("classSelect").style.display = "none";
}

// Called every frame: cooldowns tick down visibly.
export function renderSkillBar(state, player, atk) {
  const container = document.querySelector(".skillBar");
  const cls = getClass(player.classId);
  if (!cls) { container.textContent = ""; return; }

  container.innerHTML = "";
  cls.skills.forEach(skill => {
    const level = player.skills[skill.id];
    const div = document.createElement("div");
    div.className = "skillEntry";

    if (!level) {
      div.textContent = `${skill.key ? `[${skill.key}] ` : ""}${skill.name} — locked (boss ticket)`;
      div.classList.add("locked");
      container.appendChild(div);
      return;
    }

    const dmg = fmt(skillDamage(skill, level, atk));
    if (cls.archetype === "active") {
      const readyAt = state.cooldowns[skill.id] || 0;
      const remaining = Math.max(0, readyAt - state.total_time);
      const status = remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : "READY";
      div.innerHTML = `<strong>[${skill.key}] ${skill.name}</strong> Lv${level} — ${dmg} dmg — ${status}`;
      if (remaining > 0) div.classList.add("onCooldown");
    } else {
      const procs = state.procCounts[skill.id] || 0;
      div.innerHTML = `<strong>${skill.name}</strong> Lv${level} — ${(skill.procChance * 100).toFixed(1)}% per attack — ${dmg} dmg — procs: ${fmt(procs)}`;
    }
    container.appendChild(div);
  });
}

// handlers: { onUnlock, onToggle, onUpgradeInterval, onBuySlot, onSetSlot(i, skillId) }
export function renderMacro(state, player, handlers) {
  const container = document.querySelector(".macroPanel");
  container.innerHTML = "";
  const cls = getClass(player.classId);

  if (!cls) return;
  if (cls.archetype !== "active") {
    container.textContent = "Your skills already cast themselves. The macro workshop is jealous.";
    return;
  }

  const m = state.macro;
  if (!m.unlocked) {
    const btn = document.createElement("button");
    btn.textContent = `Unlock Macro Workshop — ${fmt(UNLOCK_COST)}c`;
    btn.onclick = handlers.onUnlock;
    container.appendChild(btn);
    return;
  }

  const top = document.createElement("div");
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = m.enabled;
  toggle.onchange = handlers.onToggle;
  const label = document.createElement("label");
  label.appendChild(toggle);
  label.append(` Macro running (every ${(intervalMs(m.intervalLevel) / 1000).toFixed(2)}s)`);
  top.appendChild(label);
  container.appendChild(top);

  if (m.intervalLevel < MAX_INTERVAL_LEVEL) {
    const upgrade = document.createElement("button");
    upgrade.textContent = `Faster fingers — ${fmt(intervalUpgradeCost(m.intervalLevel))}c`;
    upgrade.onclick = handlers.onUpgradeInterval;
    container.appendChild(upgrade);
  }

  m.slots.forEach((skillId, i) => {
    const row = document.createElement("div");
    row.append(`Step ${i + 1}: `);
    const select = document.createElement("select");
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "—";
    select.appendChild(none);
    cls.skills.filter(s => player.skills[s.id]).forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `[${s.key}] ${s.name}`;
      if (s.id === skillId) opt.selected = true;
      select.appendChild(opt);
    });
    select.onchange = () => handlers.onSetSlot(i, select.value || null);
    row.appendChild(select);
    container.appendChild(row);
  });

  if (m.slots.length < MAX_SLOTS) {
    const buySlot = document.createElement("button");
    buySlot.textContent = `Add step ${m.slots.length + 1} — ${fmt(slotCost(m.slots.length + 1))}c`;
    buySlot.onclick = handlers.onBuySlot;
    container.appendChild(buySlot);
  }
}

// handlers: { onSetActivity(name|null), onCraftHammer, onCraftOffering }
export function renderGathering(state, handlers) {
  const container = document.querySelector(".gatheringPanel");
  const g = state.gathering;
  container.innerHTML = "";

  for (const [name, act] of Object.entries(ACTIVITIES)) {
    const row = document.createElement("div");
    const active = g.activity === name;
    const btn = document.createElement("button");
    btn.textContent = active ? `Stop ${act.gerund}` : act.verb;
    btn.onclick = () => handlers.onSetActivity(active ? null : name);
    row.appendChild(btn);
    row.append(` Lv${g.level[name]} (${g.xp[name]}/${xpToNext(g.level[name])} xp, ` +
      `${(tickIntervalMs(g.level[name]) / 1000).toFixed(1)}s/tick) — ${act.noun}: ${fmt(g.resources[act.resource])}`);
    container.appendChild(row);
  }

  const crafts = document.createElement("div");
  crafts.className = "craftRow";

  const hammer = document.createElement("button");
  hammer.textContent = `Blessed Hammer (${HAMMER_ORE_COST} ore): 2x chance on next enhance`;
  hammer.onclick = handlers.onCraftHammer;
  crafts.appendChild(hammer);

  const offering = document.createElement("button");
  offering.textContent = `Greasy Offering (${OFFERING_FISH_COST} fish): next enhance is free`;
  offering.onclick = handlers.onCraftOffering;
  crafts.appendChild(offering);

  const buffs = document.createElement("div");
  buffs.textContent = `Prepared: ${g.buffs.doubleChance} boosted, ${g.buffs.freeAttempts} free attempts`;
  crafts.appendChild(buffs);

  container.appendChild(crafts);
}

export function renderBestiary(state) {
  const container = document.querySelector(".bestiaryList");
  const bonus = bestiaryBonus(state);
  let html = `<div>Collection bonus: <strong>+${(bonus * 100).toFixed(1)}% damage</strong></div>`;

  for (const e of bestiaryEntries(state)) {
    const known = e.kills > 0;
    const stars = MILESTONES.map(m => (e.kills >= m ? "★" : "☆")).join("");
    html += `<div class="bestiaryEntry${known ? "" : " locked"}">
      ${stars} ${known ? e.name : "???"}${e.boss ? " [BOSS]" : ""} — ${fmt(e.kills)} kills
    </div>`;
  }
  container.innerHTML = html;
}

let lastLegionKey = "";
export function renderLegion(state, player, onRetire) {
  // called every frame; only rebuild (and its button) when something changed
  const key = `${player.level}|${state.legion.retired.length}`;
  if (key === lastLegionKey) return;
  lastLegionKey = key;

  const container = document.querySelector(".legionPanel");
  const bonus = legionBonus(state.legion.retired);
  let html = `<div>Legion bonus: <strong>+${(bonus * 100).toFixed(1)}% damage</strong></div>`;

  for (const r of state.legion.retired) {
    const cls = getClass(r.classId);
    html += `<div>· ${cls ? cls.name : r.classId} — retired at Lv${r.level}</div>`;
  }
  container.innerHTML = html;

  const btn = document.createElement("button");
  const ready = player.level >= RETIRE_MIN_LEVEL;
  btn.textContent = ready
    ? `Retire this character (Lv${player.level})`
    : `Retire at Lv${RETIRE_MIN_LEVEL} (now Lv${player.level})`;
  btn.disabled = !ready;
  btn.onclick = onRetire;
  container.appendChild(btn);
}

export function logLine(text, cls = "") {
  const feed = document.getElementById("feed");
  const line = document.createElement("div");
  line.textContent = text;
  if (cls) line.className = cls;
  feed.prepend(line);
  while (feed.children.length > 100) feed.lastChild.remove();
}
