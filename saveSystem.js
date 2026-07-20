// saveSystem.js
// One localStorage key, one serialize/deserialize pair for the whole game.
// v2: account + character roster. Live characters are plain data objects in
// state.characters; snapshotChar strips transients (lastAttack).
const KEY = "esrpg_save";
import { getItem, SPECIAL_IDS } from "./items.js";

// The persisted fields of one character.
export function snapshotChar(c) {
  return {
    health: c.health,
    maxHealth: c.maxHealth,
    attack: c.attack,
    attackSpeed: c.attackSpeed,
    level: c.level,
    xp: c.xp,
    xpToNext: c.xpToNext,
    int: c.int,
    copper: c.copper,
    equipment: c.equipment,
    stash: c.stash,
    specialBag: c.specialBag,
    souls: c.souls,
    jars: c.jars,
    potions: c.potions,
    potionUntil: c.potionUntil,
    classId: c.classId,
    skills: c.skills,
  };
}

export function serialize(state) {
  return {
    v: 3,
    lastSeen: Date.now(),   // offline-progress hook (Phase 6)
    total_time: state.total_time,
    kills: state.kills,
    fieldKills: state.fieldKills,
    currentZoneId: state.currentZoneId,
    currentVariant: state.currentVariant,
    autoResummon: state.autoResummon,
    bossCooldowns: state.bossCooldowns,
    macro: state.macro,
    gathering: state.gathering,
    settings: state.settings,
    characters: state.characters.map(snapshotChar),
    active: state.active,
    slots: state.slots,
  };
}

export function save(state) {
  localStorage.setItem(KEY, JSON.stringify(serialize(state)));
}

function normalizeChar(c) {
  if (!Array.isArray(c.equipment)) c.equipment = [null, null, null, null, null, null];
  if (!Array.isArray(c.stash)) c.stash = [];
  // quarantine item ids this build doesn't know (save from a newer/older
  // version) — an unknown id in aggregate() would throw every tick and
  // silently freeze the game
  c.equipment = c.equipment.map(eq => (eq && getItem(eq.itemId)) ? eq : null);
  c.stash = c.stash.filter(eq => eq && getItem(eq.itemId));
  if (!Array.isArray(c.specialBag)) c.specialBag = [];
  c.specialBag = c.specialBag.filter(eq => eq && getItem(eq.itemId));
  // migrate: earlier v3 saves have special items in weapon slots / stash
  c.equipment = c.equipment.map(eq => {
    if (eq && SPECIAL_IDS.has(eq.itemId)) { c.specialBag.push(eq); return null; }
    return eq;
  });
  c.stash = c.stash.filter(eq => {
    if (SPECIAL_IDS.has(eq.itemId)) { c.specialBag.push(eq); return false; }
    return true;
  });
  c.int = c.int ?? 0;
  c.copper = c.copper ?? 0;
  c.souls = { old: 0, brilliant: 0, ...(c.souls || {}) };
  c.jars = c.jars || {};
  c.potions = { int: 0, prob: 0, ...(c.potions || {}) };
  c.potionUntil = { int: 0, prob: 0, ...(c.potionUntil || {}) };
  c.lastAttack = 0;
  return c;
}

// Applies a saved game onto live state.
// Returns the raw save object (for lastSeen etc.) or null if no save.
// v<3 saves are DISCARDED: the source-fidelity pass rebased the whole economy
// (items, skills, level growth) — old progress is incoherent on the new curve.
export function load(state) {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  let s;
  try { s = JSON.parse(raw); } catch { return null; }
  if ((s.v ?? 1) < 3) return null;

  state.total_time = s.total_time ?? 0;
  state.kills = s.kills ?? {};
  state.fieldKills = s.fieldKills ?? {};
  state.currentZoneId = s.currentZoneId ?? null;
  state.currentVariant = s.currentVariant ?? 0;
  state.autoResummon = s.autoResummon ?? false;
  state.bossCooldowns = s.bossCooldowns ?? {};
  if (s.macro) state.macro = { ...state.macro, ...s.macro };
  if (s.gathering) state.gathering = { ...state.gathering, ...s.gathering };
  // old saves' buffs object lacks newer fields — re-default additively
  state.gathering.buffs = { doubleChance: 0, freeAttempts: 0, okTickets: 0, ...(state.gathering.buffs || {}) };
  if (s.settings) state.settings = { ...state.settings, ...s.settings };

  state.characters = (s.characters ?? []).map(normalizeChar);
  state.slots = Math.max(s.slots ?? 1, state.characters.length, 1);
  state.active = Math.min(s.active ?? 0, Math.max(state.characters.length - 1, 0));
  return s;
}

export function wipe() {
  localStorage.removeItem(KEY);
}
