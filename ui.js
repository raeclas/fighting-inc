// ui.js
// DOM updates, zone list, shop, equipment, and the enhance feed.
import { zones, VARIANTS, zoneLocked, intDrip, BAG_CHANCE, FIELD_BOSS_SPAWN_CHANCE, FIELD_BOSS_INT_MULT, FIELD_BOSS_BAG_MULT, FIELD_BOSS_HP_MULT } from "./zones.js";
import { items, getItem, tierOf, maxPlus, MERGE_IDS, masteryMult, masteryStars, MASTERY_MILESTONES, MASTERY_BONUS, MASTERY_STAR_BONUS, bagDupeCount, aggregate } from "./items.js";
import { enhanceChance } from "./enhance.js";
import { classes, getClass, skillDamage, activeSkills, classStatBonuses } from "./classes.js";
import { JARS, potionActive, ivMult, PROB_POTION_IV, ELIXIR_IV, INT_POTION_MULT } from "./consumables.js";
import { bosses, INTEREST, TICKET_SUCCESS, firstKillBonuses, FIRST_KILL_BONUS } from "./bosses.js";
import { bestiaryEntries, bestiaryBonus, MILESTONES, BONUS_PER_MILESTONE } from "./bestiary.js";
import { ACHIEVEMENTS, achievementBonus, ACHIEVEMENT_BONUS } from "./achievements.js";
import { UNLOCK_COST, MAX_SLOTS, MAX_INTERVAL_LEVEL, intervalMs, intervalUpgradeCost, slotCost } from "./macro.js";
import { ACTIVITIES, tickIntervalMs, xpToNext, HAMMER_ORE_COST, OFFERING_FISH_COST, INT_POTION_FISH_COST, PROB_POTION_ORE_COST, OK_TICKET_COST, ELIXIR_COST } from "./gathering.js";
import { legionBonuses, charBonus, CLASS_BONUSES, MASTERY_INT, SLOT_MILESTONES, accountInt, intTutorMult, TUTOR_PCT } from "./legion.js";
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
  crusader: "#b09a3f", majesty: "#3f4fa0", divineress: "#2f8f7f",
  geniewiz: "#8f7f1f", spectre: "#4f4f6f", hekate: "#7f2f8f",
  ashtarte: "#a03f5f", necromancer: "#3f5f3f", darkknight: "#26262e",
};

// frame-0 face-crop (top-center 2× zoom) on a tinted radial backdrop.
// Shared by the HUD portrait and boss cards; null when the sheet isn't loaded.
function portraitCanvas(sheetId, px, tint = "#2b3854") {
  const sheet = sheetId ? getSheet(sheetId) : null;
  if (!sheet?.img) return null;
  const cv = document.createElement("canvas");
  cv.width = px;
  cv.height = px;
  const c = cv.getContext("2d");
  c.imageSmoothingEnabled = false;
  const grad = c.createRadialGradient(px / 2, px * 0.375, px / 10, px / 2, px / 2, px * 0.69);
  grad.addColorStop(0, tint ?? "#2b3854");
  grad.addColorStop(1, "#0a0d16");
  c.fillStyle = grad;
  c.fillRect(0, 0, px, px);
  const s = sheet.meta.size;
  c.drawImage(sheet.img, s / 4, 0, s / 2, s / 2, 0, 0, px, px);
  return cv;
}

function updateHud(state, player) {
  const cls = getClass(player.classId);
  document.getElementById("hudPlate").textContent =
    `Lv ${player.level} ${cls ? cls.name : "Enhancement Slave"}`;

  // WC3 purple XP strip — HP is vestigial in the source (no hero-damage system)
  document.getElementById("hudHpBar").style.width = `${Math.min(100, (player.xp / player.xpToNext) * 100)}%`;
  document.getElementById("hudHpText").textContent = `${fmt(player.xp)} / ${fmt(player.xpToNext)} XP`;

  // gold portrait flash on level-up (throttled — early levels come fast)
  if (updateHud.lastLevel && player.level > updateHud.lastLevel
      && state.total_time - (updateHud.lastFlashAt || 0) > 900) {
    updateHud.lastFlashAt = state.total_time;
    const box = document.getElementById("hudPortrait");
    box.classList.remove("levelFlash");
    void box.offsetWidth; // restart the animation
    box.classList.add("levelFlash");
  }
  updateHud.lastLevel = player.level;

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
  if (potionActive(player, "elixir", now)) potParts.push(`ELIXIR ${fmtCountdown(player.potionUntil.elixir - now)}`);
  document.getElementById("potionRow").style.display = potParts.length ? "" : "none";
  if (potParts.length) document.getElementById("potionVal").textContent = potParts.join(" · ");

  // Divineress spheres — shown only for classes that use them
  const sph = cls?.spheres;
  document.getElementById("sphereRow").style.display = sph ? "" : "none";
  if (sph) document.getElementById("sphereVal").textContent = `${Math.floor(state.spheres)} / ${sph.max}`;

  // portrait: sprite frame 0 face-crop on a class-colored backdrop, else emoji
  const sheet = player.classId ? getSheet(player.classId) : null;
  const pKey = `${player.classId}|${!!sheet?.img}`;
  if (pKey !== hudPortraitKey) {
    hudPortraitKey = pKey;
    const box = document.getElementById("hudPortrait");
    const cv = portraitCanvas(player.classId, 64, PORTRAIT_COLORS[player.classId]);
    if (cv) {
      box.textContent = "";
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

// Called every frame; rebuilds when a gate opens/closes or an INT drip caps out.
let lastZoneKey = "";
export function renderZoneList(player, onSelect, force = false) {
  const key = zones.map(z =>
    `${VARIANTS.map((_, i) => zoneLocked(z, player, i) ?? "").join(",")}:${intDrip(z, player)}`).join("|");
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
        // per-variant gates (source: each lap count is its own teleport item)
        const vLocked = zoneLocked(zone, player, i);
        btn.disabled = !!vLocked;
        btn.onclick = () => onSelect(zone.id, i);
        attachTip(btn, `<strong>${mult} laps of ${zone.name}</strong><br>`
          + (vLocked ? `<em>${vLocked}</em><br>` : "")
          + `${fmt(zone.copper * mult)}c/kill · bag ${fmt(zone.bag * mult)}c<br>`
          + `mob HP ${fmt(zone.hp * mult)} · DEF ${fmt(zone.defense * mult)}`
          + (zone.intPerKill ? `<br>+${fmt(zone.intPerKill * mult)} INT/kill` : ""));
        div.appendChild(btn);
      });
      // base 1× economics at a glance; lap buttons carry the scaled numbers
      const drip = intDrip(zone, player);
      const econ = document.createElement("div");
      econ.className = "econ";
      econ.textContent = `≈ ${fmt(zone.copper)}c/kill · bag ${fmt(zone.bag)}c`
        + (zone.intPerKill ? (drip > 0 ? ` · +${fmt(zone.intPerKill)} INT/kill` : " · INT capped") : "");
      div.appendChild(econ);
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
let selectedGearSlot = 0;
export function renderEquipment(player, handlers) {
  const container = document.querySelector(".equipmentList");
  container.innerHTML = "";

  // WC3 inventory: 6 square slots; click selects, detail + actions below
  const grid = document.createElement("div");
  grid.className = "gearGrid";
  player.equipment.forEach((eq, i) => {
    const cell = document.createElement("div");
    cell.className = "invCell gearCell" + (eq ? " filled" : "") + (i === selectedGearSlot ? " selected" : "");
    if (eq) {
      const def = getItem(eq.itemId);
      cell.textContent = def.name[0];
      const plus = document.createElement("span");
      plus.textContent = `+${eq.plus}`;
      cell.appendChild(plus);
      attachItemTip(cell, eq);
    }
    cell.onclick = () => { selectedGearSlot = i; renderEquipment(player, handlers); };
    grid.appendChild(cell);
  });
  container.appendChild(grid);

  {
    const i = selectedGearSlot;
    const eq = player.equipment[i];
    const div = document.createElement("div");
    div.className = "equipSlot gearDetail";
    if (!eq) {
      div.textContent = `Slot ${i + 1}: (empty)`;
    } else {
      const def = getItem(eq.itemId);
      const next = eq.plus >= maxPlus(def)
        ? "MAX"
        : `next: ${(enhanceChance(eq.plus) * 100).toFixed(2)}% @ ${fmt(def.enhCost)}c`;
      const mCount = player.mastery?.[eq.itemId] || 0;
      const mStars = mCount ? ` <span title="Mastery ${mCount}: +${Math.round((masteryMult(mCount) - 1) * 100)}% atk & INT">${"★".repeat(MASTERY_MILESTONES.filter(m => mCount >= m).length)}</span>` : "";
      const info = document.createElement("div");
      info.innerHTML = `<strong>${def.name} +${eq.plus}</strong>${mStars}<br>${itemLabel(def, eq.plus)} — ${next}`;
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
    }
    container.appendChild(div);
  }

  // Stash: overflow drops waiting for a free slot.
  const stash = player.stash || [];
  if (stash.length) {
    const header = document.createElement("div");
    header.innerHTML = `<strong>Stash (${stash.length})</strong> — free a slot, then Equip `;
    header.style.marginTop = "8px";
    // pre-mastery saves arrive with flooded stashes — one-click cleanup
    const dupes = stash.length - new Set(stash.map(e => e.itemId)).size;
    if (dupes) {
      const btn = document.createElement("button");
      btn.textContent = `Dupes → Mastery (${dupes})`;
      btn.title = "Keeps the best copy of each item; the rest go to Item Mastery (1 + plus each)";
      btn.onclick = () => handlers.onAbsorbDupes();
      header.appendChild(btn);
    }
    if (stash.length > 1) {
      const all = document.createElement("button");
      all.textContent = `Absorb ALL (${stash.length})`;
      all.title = "Dump the whole stash into Item Mastery, non-duplicates included";
      all.onclick = () => handlers.onAbsorbAll();
      header.appendChild(all);
    }
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

      const absorb = document.createElement("button");
      absorb.textContent = `→ Mastery (+${1 + eq.plus})`;
      absorb.title = "Move into Item Mastery — milestone stars pay a global damage bonus (see Mastery tab)";
      absorb.onclick = () => handlers.onAbsorbStash(i);
      div.appendChild(absorb);

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
    header.innerHTML = `<strong>Special Bag (${bag.length})</strong> — always active `;
    header.style.marginTop = "8px";
    // pre-dedup saves can hold stat-stacking duplicates — one-click cleanup
    const bagDupes = bagDupeCount(bag);
    if (bagDupes) {
      const btn = document.createElement("button");
      btn.textContent = `Dupes → Mastery (${bagDupes})`;
      btn.title = "Keeps the best copy of each special; the rest go to Item Mastery below (1 + plus each). Talismans never touched.";
      btn.onclick = () => handlers.onAbsorbBagDupes();
      header.appendChild(btn);
    }
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

    const POT_LABELS = { int: "Intelligence Potion — pure INT +120%, 30min", prob: "Probability Potion — drops & enhances +25%, 30min", elixir: "Elixir of Strength — drops & enhances +60%, 30min, no restack" };
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

// hover/tap tooltip carrying static html (list rows; command card builds live)
function attachTip(el, html) {
  el.addEventListener("mouseenter", ev => showItemTip(html, ev.clientX, ev.clientY));
  el.addEventListener("mouseleave", hideItemTip);
  el.addEventListener("touchstart", ev => {
    const t = ev.touches[0];
    showItemTip(html, t.clientX, t.clientY);
    setTimeout(hideItemTip, 1800);
  }, { passive: true });
}

// called every frame; rebuilds when a gate/cooldown/checkbox flips, a sprite
// sheet loads, or damage crosses a triage bucket
let lastBossKey = "";
export function renderBossList(state, player, eff, handlers) {
  const atk = eff?.atk ?? 0;
  const intervalS = (eff?.interval ?? 1000) / 1000;
  const key = bosses.map(b => {
    if (!b.reqInt) return "s";
    const cd = Math.max(0, (state.bossCooldowns[b.id] || 0) - state.total_time);
    return `${player.int >= b.reqInt}|${Math.ceil(cd / 1000)}`;
  }).join(",") + `|${state.autoResummon}|${Math.round(Math.log10(atk + 1) * 4)}`
    + `|${bosses.filter(b => getSheet(b.id)?.img).length}`;
  if (key === lastBossKey) return;
  lastBossKey = key;

  const container = document.querySelector(".bossList");
  container.innerHTML = "";

  bosses.forEach(boss => {
    // auto-attack-only kill estimate (procs/skills excluded — hence the ~);
    // regen default mirrors spawnBossMob's 0.5%/s
    const dps = Math.max(0, atk - boss.defense) / intervalS;
    const regenPerS = boss.hp * (boss.regenPct ?? 0.005);
    const wall = dps > 0 && dps <= regenPerS;
    const ttkS = dps <= 0 || wall ? Infinity : boss.hp / (dps - regenPerS);
    const dim = dps <= 0 || wall || ttkS > 600;

    const div = document.createElement("div");
    div.className = "bossEntry bossCard" + (dim ? " dim" : "");

    const cell = document.createElement("div");
    cell.className = "invCell bossPortrait";
    const cv = portraitCanvas(boss.id, 40);
    if (cv) cell.appendChild(cv);
    else cell.textContent = boss.name[0];
    div.appendChild(cell);

    const bounty = boss.drops?.bounty ? boss.drops.bounty * 1e9 ** (boss.drops.bountyTier ?? 0) : 0;
    const info = document.createElement("div");
    info.className = "bossInfo";
    info.innerHTML = `<strong>${boss.name}</strong><br><span class="econ">Bounty ${fmt(bounty)}c`
      + (boss.drops?.intBounty ? ` · +${fmt(boss.drops.intBounty)} INT` : "")
      + (boss.reqInt ? ` · Respawn ${Math.round(boss.respawnMs / 60000)}m` : "") + `</span>`;
    div.appendChild(info);

    const ttk = document.createElement("span");
    ttk.className = "ttk" + (dps <= 0 || wall ? " wall" : "");
    ttk.textContent = dps <= 0 ? "—" : wall ? "regen wall"
      : ttkS < 60 ? `~${ttkS < 10 ? ttkS.toFixed(1) : Math.ceil(ttkS)}s` : `~${fmtCountdown(ttkS * 1000)}`;
    div.appendChild(ttk);

    // full stat block lives in the hover/tap tooltip
    const cost = boss.reqInt
      ? `Free challenge · Respawn ${Math.round(boss.respawnMs / 60000)}m<br>requires ${fmt(boss.reqInt)} INT`
      : `Summon ${fmt(boss.summonCost)}c<br>refund ${fmt(Math.round(boss.summonCost * INTEREST))}c + bounty ${fmt(bounty)}c`;
    attachTip(div, `<strong>${boss.name}</strong><br>HP ${fmt(boss.hp)} · DEF ${fmt(boss.defense)}`
      + (boss.regenPct ? `<br>regen ${(boss.regenPct * 100).toFixed(1)}%/s` : "")
      + `<br>${cost}<br><em>~kill time: auto-attacks only</em>`);

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

// WC3 command card: square skill buttons in a grid — hotkey badge top-left,
// level badge bottom-right, ★ on evolved, radial darkening sweep + seconds
// while on cooldown, gold pulse while the skill's buff runs. Numbers live in
// the hover/tap tooltip (built live from the ref each show). DOM rebuilds only
// on structural change; per-frame work is sweep/countdown updates on refs.
let skillBarKey = "";
let skillBarRefs = [];
export function renderSkillBar(state, player, eff, onCast) {
  const slb = eff.skillLevelBonus ?? 0;
  const container = document.querySelector(".skillBar");
  const cls = getClass(player.classId);
  if (!cls) { container.textContent = ""; skillBarKey = ""; return; }

  const skills = activeSkills(cls, player.skills);
  const key = `${player.classId}|${slb}|` + skills.map(s => `${s.id}:${player.skills[s.id] || 0}`).join(",");
  if (key !== skillBarKey) {
    skillBarKey = key;
    skillBarRefs = [];
    container.innerHTML = "";
    for (const skill of skills) {
      const level = player.skills[skill.id];
      const r = { skill, level, tip: "" };
      const el = document.createElement(level && skill.kind === "cast" ? "button" : "div");
      el.className = "skillCell" + (level ? "" : " locked");
      el.innerHTML = `<span class="key">${skill.key}</span>`
        + (skill.tier ? `<span class="star">★</span>` : "")
        + `<span class="glyph">${skill.name[0]}</span>`
        + (level ? `<span class="lv">${level}${slb ? `+${slb}` : ""}</span>` : "")
        + `<span class="cd"></span><span class="sweep"></span>`;
      r.el = el;
      r.sweep = el.querySelector(".sweep");
      r.cd = el.querySelector(".cd");
      if (level && skill.kind === "cast" && onCast) el.onclick = () => onCast(skill);
      // live tooltip: content built at show-time from the ref
      el.addEventListener("mouseenter", ev => showItemTip(r.tip, ev.clientX, ev.clientY));
      el.addEventListener("mouseleave", hideItemTip);
      el.addEventListener("touchstart", ev => {
        const t = ev.touches[0];
        showItemTip(r.tip, t.clientX, t.clientY);
        setTimeout(hideItemTip, 1800);
      }, { passive: true });
      container.appendChild(el);
      skillBarRefs.push(r);
    }
  }

  // per-frame: cooldown sweep + seconds, buff pulse, tooltip content
  for (const r of skillBarRefs) {
    const { skill, level } = r;
    const name = `<strong>${skill.tier ? "★ " : ""}[${skill.key}] ${skill.name}</strong>`;
    if (!level) {
      r.tip = `${name}<br><em>locked (boss ticket)</em>`;
      continue;
    }
    const lv = `Lv${level}${slb ? `+${slb}` : ""}${skill.tier ? ` [${skill.tier}]` : ""}`;
    if (skill.kind === "stat") {
      r.tip = `${name}<br>${lv} (passive)<br>${skill.desc}`;
      continue;
    }
    const dmg = fmt(skillDamage(skill, level + slb, eff.totalInt, eff.skillDmgMult, eff.intRatioMult ?? 1));
    if (skill.kind === "cast") {
      const total = Math.max(1, Math.round(skill.cooldownMs * (eff.cdMult ?? 1)));
      const remaining = Math.max(0, (state.cooldowns[skill.id] || 0) - state.total_time);
      const ready = remaining <= 0;
      // charge-based buffs (Majesty riders) end when charges run out, not on the timer
      const bEntry = state.buffs[skill.id];
      const buffLeft = bEntry && (bEntry.charges === undefined || bEntry.charges > 0)
        ? Math.max(0, bEntry.until - state.total_time) : 0;
      const frac = ready ? 0 : Math.min(1, remaining / total);
      r.sweep.style.background = frac
        ? `conic-gradient(rgba(0,0,0,0.72) ${frac * 360}deg, transparent 0)` : "none";
      // stance-gated skills (Necromancer) lock while the enabler buff is down
      const gated = r.skill.requiresBuff && (state.buffs[r.skill.requiresBuff]?.until ?? 0) <= state.total_time;
      r.cd.textContent = gated ? "🔒" : ready ? "" : `${Math.ceil(remaining / 1000)}`;
      r.el.disabled = !ready || gated;
      r.el.classList.toggle("buffed", buffLeft > 0);
      const status = buffLeft > 0 ? `ACTIVE ${(buffLeft / 1000).toFixed(1)}s`
        : ready ? "READY" : `${(remaining / 1000).toFixed(1)}s`;
      r.tip = `${name}<br>${lv}` + (skill.buff && !skill.mult ? "" : `<br>${dmg} dmg`)
        + `<br>cooldown ${(total / 1000).toFixed(0)}s — <em>${status}</em>`;
    } else {
      const rate = skill.every ? `every ${skill.every} attacks` : `${(skill.procChance * 100).toFixed(1)}% per attack`;
      r.el.classList.toggle("buffed", !!skill.buff && (state.buffs[skill.id]?.until ?? 0) > state.total_time);
      r.tip = `${name}<br>${lv} (proc)<br>${rate}<br>${dmg} dmg — procs: ${fmt(state.procCounts[skill.id] || 0)}`;
    }
  }
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

  const elixir = document.createElement("button");
  elixir.textContent = `Elixir of Strength (${ELIXIR_COST.ore} ore + ${ELIXIR_COST.fish} fish): drops & enhances +60%, 30min`;
  elixir.onclick = handlers.onCraftElixir;
  crafts.appendChild(elixir);

  const buffs = document.createElement("div");
  buffs.textContent = `Prepared: ${g.buffs.doubleChance} boosted, ${g.buffs.freeAttempts} free attempts, `
    + `${g.buffs.okTickets ?? 0} guaranteed · Potions held: ${player.potions?.int ?? 0} INT, ${player.potions?.prob ?? 0} probability, ${player.potions?.elixir ?? 0} elixir (use from Gear tab)`;
  crafts.appendChild(buffs);

  container.appendChild(crafts);
}

let lastBestiaryKey = "";
export function renderBestiary(state) {
  // called every frame; rebuild only when kill counts actually change
  const key = Object.values(state.kills).join(",") + "|" + Object.values(state.fieldKills).join(",");
  if (key === lastBestiaryKey) return;
  lastBestiaryKey = key;
  const bonus = bestiaryBonus(state);
  const entry = e => {
    const known = e.kills > 0;
    const stars = MILESTONES.map(m => (e.kills >= m ? "★" : "☆")).join("");
    return `<div class="bestiaryEntry${known ? "" : " locked"}">
      ${stars} ${known ? e.name : "???"} — ${fmt(e.kills)} kills
    </div>`;
  };
  const all = bestiaryEntries(state);
  const head = `<div>Collection bonus: <strong>+${(bonus * 100).toFixed(1)}% damage</strong> — ${MILESTONES.join("/")} kills per entry = +${BONUS_PER_MILESTONE * 100}% each</div>`;
  document.querySelector(".bossMasteryList").innerHTML = head + all.filter(e => e.boss).map(entry).join("");
  document.querySelector(".mobMasteryList").innerHTML = all.filter(e => !e.boss).map(entry).join("");
}

// Item Mastery collection (Mastery tab): the ACTIVE character's absorbed
// items. Stars pay a global damage bonus (account-wide, all characters).
let lastMasteryKey = "";
export function renderMasteryItems(state, player) {
  const totalStars = state.characters.reduce((s, c) => s + masteryStars(c.mastery), 0);
  const mastered = Object.entries(player.mastery || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const key = `${totalStars}|${mastered.map(([id, n]) => `${id}:${n}`).join(",")}`;
  if (key === lastMasteryKey) return;
  lastMasteryKey = key;

  let html = `<div>Account stars: <strong>★${totalStars} = +${(totalStars * MASTERY_STAR_BONUS * 100).toFixed(1)}% damage</strong>`
    + ` — every milestone (${MASTERY_MILESTONES.join("/")}) on any item earns a star</div>`
    + `<div class="econ">Absorb items from the Gear tab (stash & special bag). Each also gives this item +${MASTERY_BONUS * 100}% atk & INT per star while worn.</div>`;
  if (!mastered.length) html += `<div class="bestiaryEntry locked">Nothing absorbed yet.</div>`;
  for (const [itemId, count] of mastered) {
    const def = getItem(itemId);
    if (!def) continue;
    const stars = MASTERY_MILESTONES.map(m => (count >= m ? "★" : "☆")).join("");
    const nextM = MASTERY_MILESTONES.find(m => count < m);
    html += `<div class="bestiaryEntry">${stars} ${def.name} — ${fmt(count)} absorbed${nextM ? ` · next ★ at ${fmt(nextM)}` : " · MAX"}</div>`;
  }
  document.querySelector(".masteryList").innerHTML = html;
}

let lastAchKey = "";
export function renderAchievements(state) {
  // called every frame; rebuild only when the earned count changes
  const key = Object.keys(state.achievements ?? {}).length;
  if (key === lastAchKey) return;
  lastAchKey = key;
  const container = document.querySelector(".achievementList");
  const bonus = achievementBonus(state);
  let html = `<div>Earned: <strong>${key}/${ACHIEVEMENTS.length}</strong> — <strong>+${(bonus * 100).toFixed(1)}% damage</strong></div>`;
  for (const a of ACHIEVEMENTS) {
    const earned = !!state.achievements?.[a.id];
    html += `<div class="bestiaryEntry${earned ? "" : " locked"}">
      ${earned ? "★" : "☆"} ${earned ? a.name : "???"} — ${a.desc}
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
  const tutor = intTutorMult(state);
  if (tutor > 1) html += `<div>Tutoring: benched characters speed the active one's INT drip <strong>×${tutor.toFixed(1)}</strong>.</div>`;

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
// ---- Codex tab: live stat breakdown + mechanics reference ----
// Stats panel rebuilds only while the Codex tab is open, and only when the
// composed text actually changes.
let lastStatsHtml = "";
export function renderStatsPanel(state, player, eff) {
  if (!document.querySelector('.tabPanel[data-panel="codex"]')?.classList.contains("active")) return;
  const pc = n => `${(n * 100).toFixed(1)}%`;
  const cls = getClass(player.classId);
  const g = aggregate(player.equipment, player.specialBag, player.mastery);
  const leg = legionBonuses(state);
  const statSk = classStatBonuses(cls, player.skills, g.skillLevelBonus);
  const fk = firstKillBonuses(state.kills);
  const now = state.total_time;
  const iv = ivMult(player, now);
  const tutor = intTutorMult(state);
  const zone = state.currentZoneId ? zones.find(z => z.id === state.currentZoneId) : null;
  const drip = zone ? intDrip(zone, player) : 0;
  const buffs = state.gathering?.buffs ?? {};
  const bounties = bosses.filter(b => b.drops?.intBounty && player.int >= (b.reqInt ?? 0));

  const row = (label, val, note = "") =>
    `<div class="equipSlot"><span><strong>${label}</strong> ${val}${note ? ` <em>— ${note}</em>` : ""}</span></div>`;
  const h = t => `<div style="margin-top:8px"><strong>${t}</strong></div>`;

  let html = "";
  html += h("Damage");
  html += row("Attack per swing:", fmt(eff.atk), "(base 5 + item ATK + total INT) × damage bonus × additional damage");
  html += row("Total INT:", fmt(eff.totalInt),
    `pure ${fmt(Math.round(player.int))}${potionActive(player, "int", now) ? ` ×${INT_POTION_MULT} (potion)` : ""} + items ${fmt(g.int)}${g.itemIntPct ? ` (incl +${g.itemIntPct}% item INT)` : ""}`);
  const stars = state.characters.reduce((s, c) => s + masteryStars(c.mastery), 0);
  html += row("Damage bonus:",
    `bestiary +${pc(bestiaryBonus(state))} · achievements +${pc(achievementBonus(state))} · trophies +${pc(fk.dmg)}`
    + ` · mastery ★${stars} +${pc(stars * MASTERY_STAR_BONUS)}`
    + ` · class passive +${statSk.atkPct.toFixed(1)}% · legion +${leg.dmgPct.toFixed(1)}% · items +${g.dmgIncPct}%`,
    "temporary buffs fold into the totals above");
  if (g.addDmgPct) html += row("Additional damage:", `+${g.addDmgPct}%`, "best single item only");

  html += h("Speed");
  html += row("Attack interval:", `${Math.round(eff.interval)}ms`,
    `base ${cls?.baseCooldownMs ?? player.attackSpeed}ms · AGI +400% (capped from Lv1) · items +${g.spdPct + g.skillSpdPct}% · legion +${leg.atkSpeedPct.toFixed(1)}% · passive +${statSk.atkSpdPct.toFixed(1)}%`);

  html += h("Skills");
  html += row("Skill damage:", `×${eff.skillDmgMult.toFixed(2)}`,
    `legion +${leg.skillDmgPct.toFixed(1)}% · items +${g.skillDmgPct}%`);
  if (eff.skillLevelBonus) html += row("Skill levels:", `+${eff.skillLevelBonus}`, "talismans/insignia");
  if (eff.cdMult !== 1) html += row("Cooldowns:", `×${eff.cdMult.toFixed(2)}`);
  if (eff.procRateMult !== 1) html += row("Proc rate:", `×${eff.procRateMult.toFixed(2)}`);
  if (eff.intRatioMult !== 1) html += row("Skill INT ratio:", `×${eff.intRatioMult.toFixed(2)}`);
  if (eff.crit) html += row("Crit (autos):", `${(eff.crit.chance * 100).toFixed(0)}% for ×${eff.crit.mult}`, "best single item");
  if (eff.magicCrit) html += row("Magic crit (skills):", `${(eff.magicCrit.chance * 100).toFixed(0)}% for +${eff.magicCrit.pct}%`);
  if (eff.intProcs.length) html += row("INT procs:", eff.intProcs.map(p => `${(p.chance * 100).toFixed(0)}%×${fmt(p.mult)}·INT`).join(", "), "all apply");
  if (eff.armorStrip) html += row("Armor strip:", `−${fmt(eff.armorStrip)} enemy DEF`);

  html += h("Luck (IV)");
  html += row("Drop rolls:", `×${(iv + fk.drop).toFixed(2)}`,
    `base 1 ${potionActive(player, "prob", now) ? `+ ${PROB_POTION_IV} potion ` : ""}${potionActive(player, "elixir", now) ? `+ ${ELIXIR_IV} elixir ` : ""}+ ${fk.drop.toFixed(2)} trophies`);
  html += row("Enhance rolls:", `×${(iv + fk.enh).toFixed(2)}`, `trophies +${fk.enh.toFixed(2)}`);
  if (buffs.doubleChance || buffs.freeAttempts || buffs.okTickets)
    html += row("Enhance aids ready:", `${buffs.doubleChance ?? 0} boosted · ${buffs.freeAttempts ?? 0} free · ${buffs.okTickets ?? 0} guaranteed`);

  html += h("INT income");
  if (zone) html += row("Current ground:", drip ? `+${(drip * tutor).toFixed(1)}/kill` : "INT capped here", zone.name);
  html += row("Legion tutoring:", `×${tutor.toFixed(1)}`, `+${TUTOR_PCT}% per benched character past ${fmt(MASTERY_INT)} INT`);
  html += row("Field bosses:", `${FIELD_BOSS_INT_MULT}× the zone drip`, `${(FIELD_BOSS_SPAWN_CHANCE * 100).toFixed(0)}% wander-in chance per kill`);
  if (bounties.length) html += row("Boss INT bounties open:", bounties.map(b => `${b.name} +${fmt(b.drops.intBounty)}`).join(" · "));

  html += h("Economy");
  html += row("Copper find:", `+${leg.copperPct.toFixed(1)}%`, "legion — applies to ALL copper income");

  if (html !== lastStatsHtml) {
    lastStatsHtml = html;
    document.querySelector(".statsPanel").innerHTML = html;
  }
}

// Static mechanics reference, generated from the live constants/tables so the
// text can't drift from the code. Rendered once at boot.
export function renderCodex() {
  const sec = (title, body) => `<div style="margin-top:10px"><strong>${title}</strong><div class="econ">${body}</div></div>`;
  const li = lines => lines.map(l => `· ${l}`).join("<br>");

  const gateStr = z => {
    const bits = [];
    if (z.reqLevel) bits.push(`Lv ${fmt(z.reqLevel)}+`);
    if (z.reqInt) bits.push(`INT ${fmt(z.reqInt)}+`);
    if (z.lockAfterLevel) bits.push(`locks after Lv ${fmt(z.lockAfterLevel)}`);
    if (z.lockAfterInt) bits.push(`locks after INT ${fmt(z.lockAfterInt)}`);
    if (z.intCapAt) bits.push(`INT stops at ${fmt(z.intCapAt)}`);
    return bits.join(", ") || "open";
  };
  const zoneRows = zones.map(z => {
    let s = `<strong>${z.name}</strong>: ${fmt(z.copper)}c/kill${z.intPerKill ? `, +${z.intPerKill} INT/kill` : ""} — ${gateStr(z)}`;
    if (z.variantGates) s += `<br>&nbsp;&nbsp;per-lap gates: ${z.variantGates.map((v, i) =>
      `${VARIANTS[i]}× ${v.reqInt ? `INT ${fmt(v.reqInt)}+` : "open"}${v.lockAfterInt ? ` to ${fmt(v.lockAfterInt)}` : ""}`).join(" · ")}`;
    return s;
  }).join("<br>");

  const fkCounts = { dmg: 0, drop: 0, enh: 0 };
  for (const id in FIRST_KILL_BONUS) fkCounts[FIRST_KILL_BONUS[id][0]]++;
  const bountyList = bosses.filter(b => b.drops?.intBounty)
    .map(b => `${b.name} +${fmt(b.drops.intBounty)} INT (needs ${fmt(b.reqInt)} INT, ${Math.round(b.respawnMs / 60000)}m respawn)`);

  const html =
    sec("Enhancement", li([
      `Success bands: +0→+3 guaranteed, +4→+6 ${enhanceChance(4) * 100}%, +7→+10 ${enhanceChance(7) * 100}%, +11→+15 ${enhanceChance(11) * 100}%, +16→+20 ${enhanceChance(16) * 100}% (source-exact)`,
      `Cost per attempt is per-item (shown on the item); failures keep the level`,
      `Gathering aids: Blessed Hammer = next enhance 2× odds, Greasy Offering = next enhance free, Confirmation Ticket = next enhance guaranteed`,
      `All odds scale with your IV multiplier (see Luck)`,
    ]))
    + sec("Luck (the IV multiplier)", li([
      `Every drop AND enhance roll is multiplied by IV`,
      `Probability Potion +${PROB_POTION_IV * 100}% and Elixir of Strength +${ELIXIR_IV * 100}% (30min each, elixir can't restack; they add together)`,
      `First-kill trophies add permanently: +1% drop rolls per ladder boss (${fkCounts.drop} bosses), +2% enhance rolls per special (${fkCounts.enh} bosses)`,
      `Money bags: ${BAG_CHANCE * 100}% per kill × IV · zone jars drop and open at map rates × IV`,
      `★Abyss★ elite twin: 20% of summons, 3× drop rolls`,
    ]))
    + sec("Items, Stash & Mastery", li([
      `6 equipment slots; overflow goes to the Stash (one spare per item — further copies become Mastery)`,
      `Item Mastery: absorbed copies are worth 1 + plus each; milestones ${MASTERY_MILESTONES.join("/")} earn STARS — each star anywhere is +${MASTERY_STAR_BONUS * 100}% global damage (all characters count), plus +${MASTERY_BONUS * 100}% atk & INT on that item while worn`,
      `Special Bag items are always active and never eat the 6 slots; one copy per special — duplicates become Mastery`,
      `Best-only stats: Additional Damage, crit, and attack speed count only the best item; Increased Damage and Skill Damage stack`,
      `Auras (Lumen) give only their DEF strip from the bag`,
      `Talisman family: no copper enhance — merge 2× same +n into one +n+1 (max +6); talisman dupes are never auto-absorbed`,
    ]))
    + sec("Bosses", li([
      `Summons cost copper, refund ×${INTEREST} on kill + bounty`,
      `The skill ticket drops alongside a successful item roll; a ticket upgrade is ${TICKET_SUCCESS * 100}% (new skills always learn)`,
      `Regen walls: some bosses heal a % of max HP per second — out-DPS it or gear up`,
      `INT-gated specials are free challenges on respawn timers and pay INT bounties (see below)`,
      `First kill of EVERY boss: 10× bounty + a permanent trophy (+0.5% damage, +1% drop rolls, or +2% enhance rolls by boss family)`,
    ]))
    + sec("INT economy", li([
      `INT is flat 1:1 damage and the endgame gate; sources: zone drip per kill, +1 per level, boss bounties, field-boss spikes`,
      `Field bosses: ${FIELD_BOSS_SPAWN_CHANCE * 100}% wander-in per kill (or Hunt button) — ${FIELD_BOSS_HP_MULT}× HP, guaranteed ${FIELD_BOSS_BAG_MULT}× bag, ${FIELD_BOSS_INT_MULT}× the zone's INT drip`,
      `Legion tutoring: each benched character past ${fmt(MASTERY_INT)} INT adds +${TUTOR_PCT}% INT drip`,
      `Boss bounties: ${bountyList.join(" · ")}`,
    ]))
    + sec("Hunting grounds", zoneRows)
    + sec("Progression", li([
      `XP to next level = 150 × level, max level 5000, +1 INT per level`,
      `Attack speed: AGI saturates the +400% cap from level 1 (source behavior); item/legion/passive speed stacks past it (our adaptation)`,
      `Character slots unlock at account-total INT: ${SLOT_MILESTONES.slice(1).map(fmt).join(", ")}`,
      `Legion board: every roster character past ${fmt(MASTERY_INT)} INT adds its class bonus, growing on a log10 curve`,
    ]))
    + sec("Collection is power", li([
      `Bestiary: ${MILESTONES.join("/")} kills per entry = +${BONUS_PER_MILESTONE * 100}% damage each`,
      `Achievements: ${ACHIEVEMENTS.length} to earn, +${ACHIEVEMENT_BONUS * 100}% damage each`,
    ]))
    + sec("Offline", li([
      `Progress is simulated while away (12h cap) using expected value: kills, copper, XP, INT drip (with tutoring), jar EV`,
      `Not modeled offline: potions/elixir luck, timed buffs, field-boss spikes — log in to use them`,
      `Your save also keeps a last-known-good backup; Export/Import lives in the danger zone`,
    ]));

  document.querySelector(".codexPanel").innerHTML = html;
}

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
  lastChipKey = lastBossKey = lastLegionKey = lastBestiaryKey = lastMasteryKey = skillBarKey = "";
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
  // repeats near the top collapse into one ×N line (window of 3 catches
  // alternating pairs like boss-felled / field-boss-joins)
  for (let i = 0; i < 3 && feed.children[i]; i++) {
    const top = feed.children[i];
    if (top.dataset.text === text && (top.className || "") === cls) {
      const n = (Number(top.dataset.n) || 1) + 1;
      top.dataset.n = n;
      top.textContent = `${text} ×${n}`;
      feed.prepend(top);
      return;
    }
  }
  const line = document.createElement("div");
  line.textContent = text;
  line.dataset.text = text;
  if (cls) line.className = cls;
  feed.prepend(line);
  while (feed.children.length > 100) feed.lastChild.remove();
}
