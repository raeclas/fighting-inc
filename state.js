// state.js
// Game-wide state that is not specific to the player.
import { defaultMacro } from "./macro.js";
import { defaultGathering } from "./gathering.js";

export const gameState = {
  macro: defaultMacro(),
  gathering: defaultGathering(),
  total_time: 0,
  last_save: 0,

  // Legion roster: account holds characters; the active one is what plays.
  // int + copper live on each character, not here.
  characters: [],       // plain char objects (see player.js shape)
  active: 0,
  slots: 1,

  kills: {},            // zoneId/bossId -> lifetime kill count (feeds bestiary)
  fieldKills: {},       // zoneId -> field-boss kill count

  currentZoneId: null,
  currentVariant: 0,
  field: [],            // live combat grid (16 mobs for a zone, 1 for a boss); never saved

  autoResummon: false,  // resummon the boss on kill if copper allows
  bossCooldowns: {},    // special bossId -> total_time when it respawns (saved)

  cooldowns: {},        // skillId -> total_time when ready again (transient)
  procCounts: {},       // skillId -> lifetime proc count this session (transient)
};
