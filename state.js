// state.js
// Game-wide state that is not specific to the player.
import { defaultMacro } from "./macro.js";
import { defaultGathering } from "./gathering.js";

export const gameState = {
  macro: defaultMacro(),
  gathering: defaultGathering(),
  legion: { retired: [] },  // [{classId, level}]
  total_time: 0,
  last_save: 0,

  copper: 0,
  kills: {},            // zoneId/bossId -> lifetime kill count (feeds bestiary)
  fieldKills: {},       // zoneId -> field-boss kill count

  currentZoneId: null,
  currentVariant: 0,
  currentMob: null,     // live mob instance, never saved

  autoResummon: false,  // resummon the boss on kill if copper allows

  cooldowns: {},        // skillId -> total_time when ready again (transient)
  procCounts: {},       // skillId -> lifetime proc count this session (transient)
};
