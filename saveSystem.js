// saveSystem.js
// One localStorage key, one serialize/deserialize pair for the whole game.
const KEY = "esrpg_save";

export function serialize(state, player) {
  return {
    v: 1,
    lastSeen: Date.now(),   // offline-progress hook (Phase 6)
    total_time: state.total_time,
    copper: state.copper,
    kills: state.kills,
    currentZoneId: state.currentZoneId,
    currentVariant: state.currentVariant,
    autoResummon: state.autoResummon,
    macro: state.macro,
    gathering: state.gathering,
    legion: state.legion,
    player: {
      health: player.health,
      maxHealth: player.maxHealth,
      attack: player.attack,
      attackSpeed: player.attackSpeed,
      level: player.level,
      xp: player.xp,
      xpToNext: player.xpToNext,
      equipment: player.equipment,
      classId: player.classId,
      skills: player.skills,
    },
  };
}

export function save(state, player) {
  localStorage.setItem(KEY, JSON.stringify(serialize(state, player)));
}

// Applies a saved game onto live state/player.
// Returns the raw save object (for lastSeen etc.) or null if no save.
export function load(state, player) {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  let s;
  try { s = JSON.parse(raw); } catch { return null; }

  state.total_time = s.total_time ?? 0;
  state.copper = s.copper ?? 0;
  state.kills = s.kills ?? {};
  state.currentZoneId = s.currentZoneId ?? null;
  state.currentVariant = s.currentVariant ?? 0;
  state.autoResummon = s.autoResummon ?? false;
  if (s.macro) state.macro = { ...state.macro, ...s.macro };
  if (s.gathering) state.gathering = { ...state.gathering, ...s.gathering };
  if (s.legion) state.legion = s.legion;
  Object.assign(player, s.player ?? {});
  if (!Array.isArray(player.equipment)) player.equipment = [null, null, null, null, null, null];
  player.lastAttack = 0;
  return s;
}

export function wipe() {
  localStorage.removeItem(KEY);
}
