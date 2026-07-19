// saveSystem.js
// One localStorage key, one serialize/deserialize pair for the whole game.
// v2: account + character roster. The live `player` object is the active
// character; serialize snapshots it back into characters[active].
const KEY = "esrpg_save";

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
    classId: c.classId,
    skills: c.skills,
  };
}

export function serialize(state, player) {
  const characters = state.characters.map(snapshotChar);
  characters[state.active] = snapshotChar(player);
  return {
    v: 2,
    lastSeen: Date.now(),   // offline-progress hook (Phase 6)
    total_time: state.total_time,
    kills: state.kills,
    fieldKills: state.fieldKills,
    currentZoneId: state.currentZoneId,
    currentVariant: state.currentVariant,
    autoResummon: state.autoResummon,
    macro: state.macro,
    gathering: state.gathering,
    characters,
    active: state.active,
    slots: state.slots,
  };
}

export function save(state, player) {
  localStorage.setItem(KEY, JSON.stringify(serialize(state, player)));
}

// Old zone ids -> new original names, so existing saves keep their spot and
// bestiary kills after the 2026-07 zone rename. Drop once no old saves remain.
const ZONE_RENAMES = {
  temple: "kiln", magtonium: "slag", otherverse: "rift", terranium: "loam",
  harlemdungeon: "market", lukelab: "spire", fiendwar: "warpit",
  stormy: "tempest", aiolite: "prism", despairore: "sorrow", goldenberyl: "aurum",
};

function normalizeChar(c) {
  if (!Array.isArray(c.equipment)) c.equipment = [null, null, null, null, null, null];
  if (!Array.isArray(c.stash)) c.stash = [];
  c.int = c.int ?? 0;
  c.copper = c.copper ?? 0;
  return c;
}

// v1 -> v2: wrap the single character, move account int/copper onto it.
// legion.retired is dropped (prestige replaced by the Legion board).
function migrateV1(s) {
  s.characters = [{ ...(s.player ?? {}), int: s.int ?? 0, copper: s.copper ?? 0 }];
  s.active = 0;
  s.slots = 1;
  return s;
}

// Applies a saved game onto live state/player.
// Returns the raw save object (for lastSeen etc.) or null if no save.
export function load(state, player) {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  let s;
  try { s = JSON.parse(raw); } catch { return null; }
  if (s.player) migrateV1(s);

  state.total_time = s.total_time ?? 0;
  state.kills = {};
  for (const [id, n] of Object.entries(s.kills ?? {})) {
    state.kills[ZONE_RENAMES[id] ?? id] = n;
  }
  state.fieldKills = {};
  for (const [id, n] of Object.entries(s.fieldKills ?? {})) {
    state.fieldKills[ZONE_RENAMES[id] ?? id] = n;
  }
  state.currentZoneId = ZONE_RENAMES[s.currentZoneId] ?? s.currentZoneId ?? null;
  state.currentVariant = s.currentVariant ?? 0;
  state.autoResummon = s.autoResummon ?? false;
  if (s.macro) state.macro = { ...state.macro, ...s.macro };
  if (s.gathering) state.gathering = { ...state.gathering, ...s.gathering };

  state.characters = (s.characters ?? []).map(normalizeChar);
  state.slots = Math.max(s.slots ?? 1, state.characters.length, 1);
  state.active = Math.min(s.active ?? 0, Math.max(state.characters.length - 1, 0));
  Object.assign(player, state.characters[state.active] ?? {});
  normalizeChar(player);
  player.lastAttack = 0;
  return s;
}

export function wipe() {
  localStorage.removeItem(KEY);
}
