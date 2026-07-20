// saveSystem.js
// One localStorage key, one serialize/deserialize pair for the whole game.
// v2: account + character roster. Live characters are plain data objects in
// state.characters; snapshotChar strips transients (lastAttack).
const KEY = "esrpg_save";
import { getItem, SPECIAL_IDS } from "./items.js";
import { newCharacter } from "./player.js";
import { defaultGathering } from "./gathering.js";

// The persisted character = everything except transients. New fields persist
// automatically — no allowlist to forget.
export function snapshotChar(c) {
  const { lastAttack, ...rest } = c;
  return rest;
}

export function serialize(state) {
  return {
    v: 3,
    lastSeen: Date.now(),   // offline-progress hook (Phase 6)
    total_time: state.total_time,
    kills: state.kills,
    fieldKills: state.fieldKills,
    achievements: state.achievements,
    tabsSeen: state.tabsSeen,
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
  try {
    localStorage.setItem(KEY, JSON.stringify(serialize(state)));
  } catch (e) {
    console.error("[save]", e); // quota / private mode — keep the game running
  }
}

// Pure shape check shared by load() and importSave(). v<3 saves are invalid:
// the source-fidelity pass rebased the whole economy.
export function validSave(s) {
  return !!s && typeof s === "object" && (s.v ?? 1) >= 3;
}

function parseSave(raw) {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    return validSave(s) ? s : null;
  } catch {
    return null;
  }
}

export function exportSave(state) {
  save(state); // export what's live, not a stale blob
  return localStorage.getItem(KEY);
}

export function importSave(text) {
  if (!parseSave(text)) return false;
  localStorage.setItem(KEY, text);
  return true;
}

function normalizeChar(c) {
  // factory defaults fill any missing top-level field (one source of truth)
  c = { ...newCharacter(), ...c };
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
  // nested objects: the shallow spread can't backfill sub-fields of partials
  c.potions = { int: 0, prob: 0, elixir: 0, ...(c.potions || {}) };
  c.potionUntil = { int: 0, prob: 0, elixir: 0, ...(c.potionUntil || {}) };
  c.lastAttack = 0;
  return c;
}

// Applies a saved game onto live state.
// Returns the raw save object (for lastSeen etc.) or null if no save.
// v<3 saves are DISCARDED: the source-fidelity pass rebased the whole economy
// (items, skills, level growth) — old progress is incoherent on the new curve.
export function load(state) {
  let raw = localStorage.getItem(KEY);
  let s = parseSave(raw);
  if (raw && !s) {
    // corrupt/unusable primary: preserve it for manual rescue (previously the
    // next autosave silently destroyed it), then fall back to last-known-good
    try { localStorage.setItem(KEY + "_corrupt", raw); } catch {}
    raw = localStorage.getItem(KEY + "_bak");
    s = parseSave(raw);
  }
  if (!s) return null;
  // last-known-good backup: one write at startup, so the 5s autosave can
  // never clobber it with a bad state mid-session
  try { localStorage.setItem(KEY + "_bak", raw); } catch {}

  state.total_time = s.total_time ?? 0;
  state.kills = s.kills ?? {};
  state.fieldKills = s.fieldKills ?? {};
  state.achievements = s.achievements ?? {};
  state.tabsSeen = s.tabsSeen ?? {};
  state.currentZoneId = s.currentZoneId ?? null;
  state.currentVariant = s.currentVariant ?? 0;
  state.autoResummon = s.autoResummon ?? false;
  state.bossCooldowns = s.bossCooldowns ?? {};
  if (s.macro) state.macro = { ...state.macro, ...s.macro };
  if (s.gathering) state.gathering = { ...state.gathering, ...s.gathering };
  // old saves' buffs object lacks newer fields — re-default from the factory
  state.gathering.buffs = { ...defaultGathering().buffs, ...(state.gathering.buffs || {}) };
  if (s.settings) state.settings = { ...state.settings, ...s.settings };

  state.characters = (s.characters ?? []).map(normalizeChar);
  state.slots = Math.max(s.slots ?? 1, state.characters.length, 1);
  state.active = Math.min(s.active ?? 0, Math.max(state.characters.length - 1, 0));
  return s;
}

export function wipe() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(KEY + "_bak");     // reset must not resurrect
  localStorage.removeItem(KEY + "_corrupt");
}
