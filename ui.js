// ui.js
// DOM updates, zone list, shop, equipment, and the enhance feed.
import { zones, VARIANTS, zoneLocked } from "./zones.js";
import { items, getItem, tierOf, maxPlus, MERGE_IDS } from "./items.js";
import { enhanceChance } from "./enhance.js";
import { classes, getClass, skillDamage, activeSkills } from "./classes.js";
import { JARS, potionActive } from "./consumables.js";
import { bosses, INTEREST } from "./bosses.js";
import { bestiaryEntries, bestiaryBonus, MILESTONES } from "./bestiary.js";
import { UNLOCK_COST, MAX_SLOTS, MAX_INTERVAL_LEVEL, intervalMs, intervalUpgradeCost, slotCost } from "./macro.js";
import { ACTIVITIES, tickIntervalMs, xpToNext, HAMMER_ORE_COST, OFFERING_FISH_COST, INT_POTION_FISH_COST, PROB_POTION_ORE_COST, OK_TICKET_COST } from "./gathering.js";
import { legionBonuses, charBonus, CLASS_BONUSES, MASTERY_INT, SLOT_MILESTONES, accountInt } from "./legion.js";
import { getSheet, SHEETS } from "./sprites.js";

// formatting lives in format.js (leaf); re-export keeps existing importers working
export { fmt, fmtCountdown } from "./format.js";
import { fmt, fmtCountdown } from "./format.js";

// ---- HUD (portrait / plate / HP / currency / inventory) ----
let hudPortraitKey = "", hudInvKey = "";

// portrait backdrop tint per class
const PORTRAIT_COLORS = {
  striker: "#a8502f", overmind: "#6a3fa0", omniblade: "#8a8f9f",
  bloodevil: "#8f1f1f", indra: "#1f5f8f", vagabond: "#4f6f3f",
  desperado: "#8f6f2f", stormtrooper: "#2f6f6f", nenempress: "#8f2f6f",
};

function updateHud(state, player) {
  const cls = getClass(player.classId);
  document.getElementById("hudPlate").textContent =
    `Lv ${player.level} ${cls ? cls.name : "Enhancement Slave"}`;

  const hpFrac = player.maxHealth ? Math.max(0, player.health / player.maxHealth) : 1;
  document.getElementById("hudHpBar").style.width = `${hpFrac * 100}%`;
  document.getElementById("hudHpText").textContent = `${player.health} / ${player.maxHealth}`;

  // display-only currency tiers (economy stays copper): 1 silver = 1e9 copper
  const c = player.copper;
  document.getElementById("curGold").textContent = fmt(Math.floor(c / 1e18));
  document.getElementById("curSilver").textContent = fmt(Math.floor(c / 1e9) % 1e9);
  document.getElementById("curCopper").textContent = fmt(c % 1e9);

  // avatar souls (special-boss drops) — hidden until the first one drops
  const souls = player.souls || {};
  const anySouls = (souls.old || 0) + (souls.brilliant || 0) > 0;
  document.getElementById("soulsRow").style.display = anySouls ? "" : "none";
  if (anySouls) document.getElementById("soulsVal").textContent = `${fmt(souls.old || 0)} / ${fmt(souls.brilliant || 0)}`;

  // active potion countdowns — hidden when none running
  const now = state.total_time;
  const potParts = [];
  if (potionActive(player, "int", now)) potParts.push(`INT ${fmtCountdown(player.potionUntil.int - now)}`);
  if (potionActive(player, "prob", now)) potParts.push(`IV ${fmtCountdown(player.potionUntil.prob - now)}`);
  document.getElementById("potionRow").style.display = potParts.length ? "" : "none";
  if (potParts.length) document.getElementById("potionVal").textContent = potParts.join(" · ");

  // portrait: sprite frame 0 face-crop on a class-colored backdrop, else emoji
  const sheet = player.classId ? getSheet(player.classId) : null;
  const pKey = `${player.classId}|${!!sheet?.img}`;
  if (pKey !== hudPortraitKey) {
    hudPortraitKey = pKey;
    const box = document.getElementById("hudPortrait");
    if (sheet?.img) {
      box.textContent = "";
      const cv = document.createElement("canvas");
      cv.width = 64;
      cv.height = 64;
      const c = cv.getContext("2d");
      c.imageSmoothingEnabled = false;
      const grad = c.createRadialGradient(32, 24, 6, 32, 32, 44);
      grad.addColorStop(0, PORTRAIT_COLORS[player.classId] ?? "#2b3854");
      grad.addColorStop(1, "#0a0d16");
      c.fillStyle = grad;
      c.fillRect(0, 0, 64, 64);
      // 2× zoom on the top-center quarter of frame 0 — the face
      const s = sheet.meta.size;
      c.drawImage(sheet.img, s / 4, 0, s / 2, s / 2, 0, 0, 64, 64);
      box.appendChild(cv);
    } else {
      box.textContent = sheet?.meta.fallback ?? SHEETS.hero.fallback;
    }
  }

  // 6-slot inventory mini-grid; click jumps to the Gear tab, hover/tap = item card
  const invKey = player.equipment.map(e => e ? `${e.itemId}+${e.plus}` : ".").join("|");
  if (invKey !== hudInvKey) {
    hudInvKey = invKey;
    const inv = document.getElementById("hudInv");
    inv.innerHTML = "";
    for (const eq of player.equipment) {
      const cell = document.createElement("div");
      cell.className = "invCell" + (eq ? " filled" : "");
      if (eq) {
        const def = getItem(eq.itemId);
        cell.textContent = def.name[0];
        const plus = document.createElement("span");
        plus.textContent = `+${eq.plus}`;
        cell.appendChild(plus);
        attachItemTip(cell, eq);
      }
      cell.onclick = () => document.querySelector('.tabBar [data-tab="gear"]')?.click();
      inv.appendChild(cell);
    }
  }
}

// ---- item tooltip (WC3 hover card, shared singleton) ----
let itemTip = null;
function showItemTip(html, x, y) {
  if (!itemTip) {
    itemTip = document.createElement("div");
    itemTip.className = "battleTooltip itemTip";
    document.body.appendChild(itemTip);
  }
  itemTip.innerHTML = html;
  itemTip.style.display = "block";
  itemTip.style.left = `${Math.min(x + 12, window.innerWidth - 230)}px`;
  itemTip.style.top = `${Math.max(4, y - itemTip.offsetHeight - 10)}px`;
}
function hideItemTip() {
  if (itemTip) itemTip.style.display = "none";
}
function itemTipHtml(eq) {
  const def = getItem(eq.itemId);
  const next = eq.plus >= maxPlus(def)
    ? "MAX enhancement"
    : `next +: ${(enhanceChance(eq.plus) * 100).toFixed(2)}% @ ${fmt(def.enhCost)}c`;
  return `<strong>${def.name} +${eq.plus}</strong><br>` +
    itemLabel(def, eq.plus).split(" · ").join("<br>") + `<br><em>${next}</em>`;
}
function attachItemTip(el, eq) {
  el.addEventListener("mouseenter", ev => showItemTip(itemTipHtml(eq), ev.clientX, ev.clientY));
  el.addEventListener("mouseleave", hideItemTip);
  el.addEventListener("touchstart", ev => {
    const t = ev.touches[0];
    showItemTip(itemTipHtml(eq), t.clientX, t.clientY);
    setTimeout(hideItemTip, 1800);
  }, { passive: true });
}

// ---- top chips: milestones + timers (special-boss countdowns join in later) ----
let lastChipKey = "";
function renderChips(state, player) {
  const chips = [];
  const next = SLOT_MILESTONES[state.slots];
  if (next !== undefined) {
    chips.push({ label: "Next Legion slot", time: `${fmt(accountInt(state))} / ${fmt(next)} INT` });
  }
  if (state.currentZoneId) {
    chips.push({ label: "Field boss roams these grounds", time: "2% / kill" });
  }
  // special-boss respawn timers (only once the INT gate is open)
  for (const b of bosses) {
    if (!b.reqInt || player.int < b.reqInt) continue;
    const cd = Math.max(0, (state.bossCooldowns[b.id] || 0) - state.total_time);
    chips.push({ label: b.name, time: cd > 0 ? fmtCountdown(cd) : "READY" });
  }
  const key = chips.map(c => c.label + c.time).join("|");
  if (key === lastChipKey) return;
  lastChipKey = key;
  document.getElementById("chipBar").innerHTML = chips
    .map(c => `<span class="chip">${c.label} <span class="chipTime">${c.time}</span></span>`)
    .join("");
}

export function updateUI(state, player, eff) {
  updateHud(state, player);
  renderChips(state, player);
  document.getElementById("playerInt").textContent = fmt(eff.totalInt);
  document.getElementById("playerDamage").textContent = fmt(eff.atk);
  document.getElementById("playerAttackSpeed").textContent = Math.round(eff.interval);
  document.getElementById("playerXP").textContent = `${fmt(player.xp)}/${fmt(player.xpToNext)}`;

  const field = state.field || [];
  const mob = field.find(m => m.hp > 0) || field[0] || null;
  const living = field.filter(m => m.hp > 0).length;
  const solo = field.length <= 1;

  document.getElementById("mobName").textContent =
    mob ? (solo ? mob.name : `${mob.name}  (${living} in the field)`) : "No zone selected";
  document.getElementById("mobHealth").textContent = mob ? `${fmt(Math.max(0, mob.hp))}/${fmt(mob.maxHp)}` : "";
  document.getElementById("mobDefense").textContent = mob ? fmt(mob.defense) : "";
  document.getElementById("mobRegen").textContent = mob ? fmt(mob.regen) : "";
  document.getElementById("mobCopper").textContent = mob ? fmt(mob.copper) : "";
  document.getElementById("mobKills").textContent = mob ? (state.kills[mob.isBoss ? mob.bossId : mob.zoneId] || 0) : "";

  const fbBtn = document.getElementById("huntFieldBoss");
  const soloFieldBoss = solo && mob && mob.isFieldBoss;
  fbBtn.disabled = !state.currentZoneId || soloFieldBoss;
  fbBtn.style.display = state.currentZoneId ? "" : "none";
  const fk = state.currentZoneId ? (state.fieldKills[state.currentZoneId] || 0) : 0;
  document.getElementById("fieldKills").textContent =
    state.currentZoneId ? ` Field bosses felled here: ${fmt(fk)}` : "";
}

// Called every frame; rebuilds only when a gate opens/closes (level/INT bands).
let lastZoneKey = "";
export function renderZoneList(player, onSelect, force = false) {
  const key = zones.map(z => zoneLocked(z, player) ?? "").join("|");
  if (!force && key === lastZoneKey) return;
  lastZoneKey = key;

  const container = document.querySelector(".zoneList");
  container.innerHTML = "";

  zones.forEach(zone => {
    const div = document.createElement("div");
    const locked = zoneLocked(zone, player);
    div.className = "zoneEntry" + (locked ? " locked" : "");

    const label = document.createElement("strong");
    label.textContent = zone.name;
    div.appendChild(label);

    if (locked) {
      const em = document.createElement("em");
      em.textContent = ` — ${locked}`;
      div.appendChild(em);
    } else {
      VARIANTS.forEach((mult, i) => {
        const btn = document.createElement("button");
        btn.textContent = `${mult} laps`;
        btn.onclick = () => onSelect(zone.id, i);
        div.appendChild(btn);
      });
    }

    container.appendChild(div);
  });
}

export function renderShop(onBuy) {
  const container = document.querySelector(".shopList");
  container.innerHTML = "";

  items.filter(d => d.shop).forEach(def => {
    const div = document.createElement("div");
    div.className = "shopEntry";
    div.innerHTML = `<strong>${def.name}</strong> — ${fmt(def.cost)}c<br>
      ${itemLabel(def, 0)} (at +20: ${itemLabel(def, 20)})<br>
      Enhance cost: ${fmt(def.enhCost)}c/try`;
    const btn = document.createElement("button");
    btn.textContent = "Buy";
    btn.onclick = () => onBuy(def.id);
    div.appendChild(btn);
    container.appendChild(div);
  });
}

// full stat line for an item at a plus level (all values from its tier table)
function itemLabel(def, plus) {
  const t = tierOf(def, plus);
  const parts = [];
  if (t.atk) parts.push(`ATK +${fmt(t.atk)}`);
  if (t.int) parts.push(`INT +${fmt(t.int)}`);
  if (t.dmgInc) parts.push(`+${fmt(t.dmgInc)}% dmg`);
  if (t.addDmg) parts.push(`+${fmt(t.addDmg)}% add dmg (best only)`);
  if (t.skillDmg) parts.push(`+${fmt(t.skillDmg)}% skill dmg`);
  if (t.intPct) parts.push(`+${t.intPct}% item INT`);
  if (t.spdPct) parts.push(`ATK SPD +${t.spdPct}%`);
  if (t.procMult) parts.push(`${t.procChance}% proc ${fmt(t.procMult)}×INT`);
  if (t.critMult) parts.push(`${t.critChance}% crit ×${fmt(t.critMult)}`);
  if (t.skillLevels) parts.push(`+${t.skillLevels} to all skills`);
  if (t.defReduce) parts.push(`nearby enemies DEF −${t.defReduce}`);
  if (t.cooldownPct) parts.push(`skill cooldowns −${t.cooldownPct}%`);
  if (t.intRatioPct) parts.push(`skill INT ratio +${t.intRatioPct}%`);
  if (t.procRatePct) parts.push(`skill activation +${t.procRatePct}%`);
  if (t.clones) parts.push(`+${t.clones} clones`);
  if (t.magicCritPct) parts.push(`${t.magicCritChance}% magic crit +${t.magicCritPct}%`);
  return parts.join(" · ") || "(no stats)";
}

// handlers: { onEnhance(slotIdx, times), onUnequip(slotIdx), onDiscard(slotIdx),
//             onEquipStash(stashIdx), onDiscardStash(stashIdx),
//             onMergeBag(bagIdx), onEnhanceBag(bagIdx, times), onDiscardBag(bagIdx) }
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
    const next = eq.plus >= maxPlus(def)
      ? "MAX"
      : `next: ${(enhanceChance(eq.plus) * 100).toFixed(2)}% @ ${fmt(def.enhCost)}c`;

    const info = document.createElement("div");
    info.innerHTML = `<strong>${def.name} +${eq.plus}</strong><br>${itemLabel(def, eq.plus)} — ${next}`;
    div.appendChild(info);

    [1, 10, 30].forEach(times => {
      const btn = document.createElement("button");
      btn.textContent = `x${times}`;
      btn.onclick = () => handlers.onEnhance(i, times);
      div.appendChild(btn);
    });

    const toStash = document.createElement("button");
    toStash.textContent = "→ Stash";
    toStash.onclick = () => handlers.onUnequip(i);
    div.appendChild(toStash);

    const discard = document.createElement("button");
    discard.textContent = "Discard";
    discard.onclick = () => handlers.onDiscard(i);
    div.appendChild(discard);

    container.appendChild(div);
  });

  // Stash: overflow drops waiting for a free slot.
  const stash = player.stash || [];
  if (stash.length) {
    const header = document.createElement("div");
    header.innerHTML = `<strong>Stash (${stash.length})</strong> — free a slot, then Equip`;
    header.style.marginTop = "8px";
    container.appendChild(header);

    stash.forEach((eq, i) => {
      const def = getItem(eq.itemId);
      const div = document.createElement("div");
      div.className = "equipSlot";
      div.innerHTML = `<span>${def.name} +${eq.plus} — ${itemLabel(def, eq.plus)}</span> `;

      const equip = document.createElement("button");
      equip.textContent = "Equip";
      equip.disabled = !player.equipment.includes(null);
      equip.onclick = () => handlers.onEquipStash(i);
      div.appendChild(equip);

      const discard = document.createElement("button");
      discard.textContent = "Discard";
      discard.onclick = () => handlers.onDiscardStash(i);
      div.appendChild(discard);

      container.appendChild(div);
    });
  }

  // Special bag: rings/necklaces/talismans/insignia/aura — always active,
  // never eat the 6 slots. Talisman family merges (2× same +n → +n+1).
  const bag = player.specialBag || [];
  if (bag.length) {
    const header = document.createElement("div");
    header.innerHTML = `<strong>Special Bag (${bag.length})</strong> — always active`;
    header.style.marginTop = "8px";
    container.appendChild(header);

    bag.forEach((eq, i) => {
      const def = getItem(eq.itemId);
      const t = tierOf(def, eq.plus);
      const div = document.createElement("div");
      div.className = "equipSlot";
      // aura items: only DEF applies from the bag
      const label = t.defReduce ? `nearby enemies DEF −${t.defReduce}` : itemLabel(def, eq.plus);
      div.innerHTML = `<span><strong>${def.name} +${eq.plus}</strong> — ${label}</span> `;

      if (MERGE_IDS.has(eq.itemId)) {
        const merge = document.createElement("button");
        const atMax = eq.plus >= maxPlus(def);
        merge.textContent = atMax ? "MAX" : "Merge";
        merge.disabled = atMax || !bag.some((b, k) => k !== i && b.itemId === eq.itemId && b.plus === eq.plus);
        merge.onclick = () => handlers.onMergeBag(i);
        div.appendChild(merge);
      } else {
        const next = eq.plus >= maxPlus(def)
          ? "MAX"
          : `next: ${(enhanceChance(eq.plus) * 100).toFixed(2)}% @ ${fmt(def.enhCost)}c`;
        div.querySelector("span").innerHTML += ` — ${next}`;
        [1, 10, 30].forEach(times => {
          const btn = document.createElement("button");
          btn.textContent = `x${times}`;
          btn.onclick = () => handlers.onEnhanceBag(i, times);
          div.appendChild(btn);
        });
      }

      const discard = document.createElement("button");
      discard.textContent = "Discard";
      discard.onclick = () => handlers.onDiscardBag(i);
      div.appendChild(discard);

      container.appendChild(div);
    });
  }

  // Consumables: zone jars (gacha opens) + potions. Jar counts are floats
  // (offline EV) — display floors; opening needs ≥1.
  const jars = Object.entries(player.jars || {}).filter(([, n]) => n >= 1);
  const pots = Object.entries(player.potions || {}).filter(([, n]) => n >= 1);
  if (jars.length || pots.length) {
    const header = document.createElement("div");
    header.innerHTML = `<strong>Consumables</strong>`;
    header.style.marginTop = "8px";
    container.appendChild(header);

    for (const [jarId, count] of jars) {
      const jar = JARS[jarId];
      if (!jar) continue;
      const div = document.createElement("div");
      div.className = "equipSlot";
      div.innerHTML = `<span><strong>${jar.name}</strong> ×${Math.floor(count)} — ${(jar.openChance * 100).toFixed(2)}% for ${getItem(jar.yields)?.name ?? jar.yields}</span> `;
      for (const [label, times] of [["Open", 1], ["×10", 10], ["×all", Infinity]]) {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.onclick = () => handlers.onOpenJar(jarId, times);
        div.appendChild(btn);
      }
      container.appendChild(div);
    }

    const POT_LABELS = { int: "Intelligence Potion — pure INT +120%, 30min", prob: "Probability Potion — drops & enhances +25%, 30min" };
    for (const [kind, count] of pots) {
      const div = document.createElement("div");
      div.className = "equipSlot";
      div.innerHTML = `<span><strong>${POT_LABELS[kind]}</strong> ×${Math.floor(count)}</span> `;
      const btn = document.createElement("button");
      btn.textContent = "Use";
      btn.onclick = () => handlers.onUsePotion(kind);
      div.appendChild(btn);
      container.appendChild(div);
    }
  }
}

// handlers: { onSummon(bossId), onToggleAuto() }

// called every frame; rebuilds only when a gate/cooldown/checkbox state changes
let lastBossKey = "";
export function renderBossList(state, player, handlers) {
  const key = bosses.map(b => {
    if (!b.reqInt) return "s";
    const cd = Math.max(0, (state.bossCooldowns[b.id] || 0) - state.total_time);
    return `${player.int >= b.reqInt}|${Math.ceil(cd / 1000)}`;
  }).join(",") + `|${state.autoResummon}`;
  if (key === lastBossKey) return;
  lastBossKey = key;

  const container = document.querySelector(".bossList");
  container.innerHTML = "";

  bosses.forEach(boss => {
    const div = document.createElement("div");
    div.className = "bossEntry";
    const bounty = boss.drops?.bounty ? boss.drops.bounty * 1e9 ** (boss.drops.bountyTier ?? 0) : 0;
    const cost = boss.reqInt
      ? `Free challenge · Bounty ${fmt(bounty)}c · Respawn ${Math.round(boss.respawnMs / 60000)}m`
      : `Summon ${fmt(boss.summonCost)}c (refund ${fmt(Math.round(boss.summonCost * INTEREST))}c + bounty ${fmt(bounty)}c)`;
    div.innerHTML = `<strong>${boss.name}</strong>${boss.reqInt ? ` <em>· requires ${fmt(boss.reqInt)} INT</em>` : ""}<br>
      HP ${fmt(boss.hp)} · DEF ${fmt(boss.defense)} · ${cost}`;
    const btn = document.createElement("button");
    if (!boss.reqInt) {
      btn.textContent = "Summon";
    } else if (player.int < boss.reqInt) {
      btn.textContent = `Locked (${fmt(boss.reqInt)} INT)`;
      btn.disabled = true;
    } else {
      const cd = Math.max(0, (state.bossCooldowns[boss.id] || 0) - state.total_time);
      btn.textContent = cd > 0 ? `Respawns in ${fmtCountdown(cd)}` : "Challenge";
      btn.disabled = cd > 0;
    }
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
// eff: effectiveStats() bundle (totalInt/skillDmgMult/skillLevelBonus).
// onCast(skill): tap-to-cast for cast skills (touch, no keyboard needed).
export function renderSkillBar(state, player, eff, onCast) {
  const slb = eff.skillLevelBonus ?? 0;
  const container = document.querySelector(".skillBar");
  const cls = getClass(player.classId);
  if (!cls) { container.textContent = ""; return; }

  container.innerHTML = "";
  activeSkills(cls, player.skills).forEach(skill => {
    const level = player.skills[skill.id];

    if (!level) {
      const div = document.createElement("div");
      div.className = "skillEntry locked";
      div.textContent = `[${skill.key}] ${skill.name} — locked (boss ticket)`;
      container.appendChild(div);
      return;
    }

    // evolved/awakened skills carry a tier marker (abyss/trans/awaken tickets)
    const star = skill.tier ? "★ " : "";
    const lvLabel = (slb > 0 ? `Lv${level}+${slb}` : `Lv${level}`) + (skill.tier ? ` [${skill.tier}]` : "");
    if (skill.kind === "stat") {
      const div = document.createElement("div");
      div.className = "skillEntry";
      div.innerHTML = `<strong>[${skill.key}] ${skill.name}</strong> ${lvLabel} (passive) — ${skill.desc}`;
      container.appendChild(div);
      return;
    }

    const dmg = fmt(skillDamage(skill, level + slb, eff.totalInt, eff.skillDmgMult, eff.intRatioMult ?? 1));
    if (skill.kind === "cast") {
      const readyAt = state.cooldowns[skill.id] || 0;
      const remaining = Math.max(0, readyAt - state.total_time);
      const ready = remaining <= 0;
      const buffLeft = Math.max(0, (state.buffs[skill.id]?.until ?? 0) - state.total_time);
      const status = buffLeft > 0 ? `ACTIVE ${(buffLeft / 1000).toFixed(1)}s`
        : ready ? "READY" : `${(remaining / 1000).toFixed(1)}s`;
      const btn = document.createElement("button");
      btn.className = "skillEntry skillCast" + (ready ? "" : " onCooldown");
      btn.innerHTML = `<strong>${star}[${skill.key}] ${skill.name}</strong> ${lvLabel}` +
        (skill.buff && !skill.mult ? "" : ` — ${dmg} dmg`) + ` — ${status}`;
      btn.disabled = !ready;
      if (onCast) btn.onclick = () => onCast(skill);
      container.appendChild(btn);
    } else { // proc
      const div = document.createElement("div");
      div.className = "skillEntry";
      const procs = state.procCounts[skill.id] || 0;
      div.innerHTML = `<strong>${star}[${skill.key}] ${skill.name}</strong> ${lvLabel} — ${(skill.procChance * 100).toFixed(1)}% per attack — ${dmg} dmg — procs: ${fmt(procs)}`;
      container.appendChild(div);
    }
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
    activeSkills(cls, player.skills).filter(s => s.kind === "cast" && player.skills[s.id]).forEach(s => {
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
export function renderGathering(state, player, handlers) {
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

  const intPot = document.createElement("button");
  intPot.textContent = `Intelligence Potion (${INT_POTION_FISH_COST} fish): pure INT +120%, 30min`;
  intPot.onclick = handlers.onCraftIntPotion;
  crafts.appendChild(intPot);

  const probPot = document.createElement("button");
  probPot.textContent = `Probability Potion (${PROB_POTION_ORE_COST} ore): drops & enhances +25%, 30min`;
  probPot.onclick = handlers.onCraftProbPotion;
  crafts.appendChild(probPot);

  const ticket = document.createElement("button");
  ticket.textContent = `Confirmation Ticket (${OK_TICKET_COST.ore} ore + ${OK_TICKET_COST.fish} fish): next enhance 100%`;
  ticket.onclick = handlers.onCraftTicket;
  crafts.appendChild(ticket);

  const buffs = document.createElement("div");
  buffs.textContent = `Prepared: ${g.buffs.doubleChance} boosted, ${g.buffs.freeAttempts} free attempts, `
    + `${g.buffs.okTickets ?? 0} guaranteed · Potions held: ${player.potions?.int ?? 0} INT, ${player.potions?.prob ?? 0} probability (use from Gear tab)`;
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
export function renderLegion(state, handlers) {
  // called every frame; only rebuild when roster numbers change
  const key = state.characters.map(c => `${c.classId}|${c.level}|${Math.floor(c.int)}`).join(",")
    + `|${state.active}|${state.slots}`;
  if (key === lastLegionKey) return;
  lastLegionKey = key;

  const leg = legionBonuses(state);
  const LEGION_LABELS = { atkSpeedPct: "attack speed", skillDmgPct: "skill damage", dmgPct: "damage", copperPct: "copper find" };
  const totals = Object.entries(leg)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `<strong>+${v.toFixed(1)}% ${LEGION_LABELS[k]}</strong>`)
    .join(", ") || "<strong>none yet</strong>";
  let html = `<div>Legion board — every character boosts the whole account, scaled by its INT.</div>`;
  html += `<div>Total: ${totals}</div>`;

  state.characters.forEach((c, i) => {
    const cls = getClass(c.classId);
    const b = CLASS_BONUSES[c.classId];
    const status = !b ? "no bonus"
      : c.int < MASTERY_INT ? `inactive — needs ${fmt(MASTERY_INT)} INT (has ${fmt(c.int)})`
      : `+${charBonus(c).toFixed(1)}% ${b.label}`;
    const active = i === state.active;
    html += `<div class="rosterRow">· ${cls ? cls.name : "No class"} Lv${c.level} — INT ${fmt(c.int)} — ${status} `
      + (active ? `<strong>[ACTIVE]</strong>` : `<button data-play="${i}">Play</button>`)
      + `</div>`;
  });

  if (state.characters.length < state.slots) {
    html += `<div><button data-newchar>New character (${state.characters.length}/${state.slots} slots used)</button></div>`;
  } else {
    html += `<div>All ${state.slots} character slot${state.slots > 1 ? "s" : ""} in use.</div>`;
  }
  const next = SLOT_MILESTONES[state.slots];
  if (next !== undefined) {
    html += `<div>Next slot at ${fmt(next)} account INT (have ${fmt(accountInt(state))}).</div>`;
  }

  const container = document.querySelector(".legionPanel");
  container.innerHTML = html;
  container.querySelectorAll("[data-play]").forEach(btn =>
    btn.onclick = () => handlers.onPlay(Number(btn.dataset.play)));
  const nb = container.querySelector("[data-newchar]");
  if (nb) nb.onclick = handlers.onNew;
}

// One panel visible at a time; tab bar toggles the .active class.
export function initTabs() {
  const bar = document.querySelector(".tabBar");
  bar.addEventListener("click", e => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    const tab = btn.dataset.tab;
    bar.querySelectorAll("button").forEach(b => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".tabPanel").forEach(p =>
      p.classList.toggle("active", p.dataset.panel === tab));
  });
}

// Force cached renderers (chips/bosses/legion) to rebuild — e.g. after the
// number-format toggle changes how every number prints.
export function bustRenderCaches() {
  lastChipKey = lastBossKey = lastLegionKey = "";
}

// Feed filter chips: the buttons just swap a class on #feed; CSS hides the rest.
export function initFeedFilter() {
  const bar = document.querySelector(".feedFilter");
  const feed = document.getElementById("feed");
  bar.addEventListener("click", e => {
    const btn = e.target.closest("button[data-ff]");
    if (!btn) return;
    feed.className = btn.dataset.ff;
    bar.querySelectorAll("button").forEach(b => b.classList.toggle("active", b === btn));
  });
}

export function logLine(text, cls = "") {
  const feed = document.getElementById("feed");
  const line = document.createElement("div");
  line.textContent = text;
  if (cls) line.className = cls;
  feed.prepend(line);
  while (feed.children.length > 100) feed.lastChild.remove();
}
