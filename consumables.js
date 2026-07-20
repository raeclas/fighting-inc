// consumables.js — zone-special drop rates ("jars"), potions, and the source
// IV drop/enhance multiplier ("Luck"). Drop + open rates are map-extracted
// (war3map.j zone dispatch + ORx use handlers, see internal/extract/); never
// invented. The jar INVENTORY was cut in the reduction pass — kills roll
// drop×open in one chain and the item lands directly (same EV, no clicking).
// Potion acquisition is adapted (gathering crafts) — magnitudes stay source.

export const JARS = {
  hyun:     { name: "-Hyun- Find War Talisman Jar",      openChance: 0.0020, yields: "talisman" },
  frey:     { name: "-Transcendence- Frey Talisman Jar", openChance: 0.0020, yields: "talisman" },
  ezra:     { name: "Ezra's Jar",                        openChance: 0.0024, yields: "transtalisman" },
  sirocco:  { name: "Sirocco Talisman Jar",              openChance: 0.0040, yields: "transtalisman" },
  splendid: { name: "Splendid Talisman Jar",             openChance: 0.0010, yields: "brtalisman" },
  insignia: { name: "Shining Insignia Jar",              openChance: 0.0010, yields: "insignia" },
  // source also promises a Brilliant Talisman branch — undecodable, insignia only
  mixed:    { name: "A Jar of Mixed Colors",             openChance: 0.0420, yields: "insignia" },
};

// zoneId -> per-variant (1/5/20 laps) [jarId, dropChance] | null — map rates.
// Baekhwa Myth Jar (tempest 1/5-lap) deferred: open weights undecoded.
export const ZONE_JARS = {
  prism:   [["sirocco", 0.00246], ["sirocco", 0.0126], ["sirocco", 0.0544]],
  warpit:  [["hyun", 0.0020], ["hyun", 0.0066], ["frey", 0.00339]], // map 10-lap → our 20-lap
  aurum:   [["splendid", 0.003], ["splendid", 0.012], null],        // no 20-lap source rate exists
  tempest: [null, null, ["ezra", 0.0024]],  // "The Abyss's Storm Route" analog = 20-lap
  sorrow:  [["insignia", 0.0028], ["insignia", 0.014], ["mixed", 0.001]],
};
export const jarFor = (zoneId, variant) => ZONE_JARS[zoneId]?.[variant] ?? null;

// All potions run 30 real-time minutes (map tips).
export const POTION_MS = 30 * 60 * 1000;
export const INT_POTION_MULT = 2.2;   // "intelligence increases by 1.2x your pure intelligence"
export const PROB_POTION_IV = 0.25;   // "all reinforcement probabilities and drop rates +25%"
export const ELIXIR_IV = 0.60;        // "Elixir of Strength": all probabilities +60%, no duplicate use

export const potionActive = (char, kind, now) => (char.potionUntil?.[kind] ?? 0) > now;

// The source's IV multiplier on every drop/enhance roll. Probability potion
// and elixir stack additively — both ran simultaneously in the map.
export const ivMult = (char, now) =>
  1 + (potionActive(char, "prob", now) ? PROB_POTION_IV : 0)
    + (potionActive(char, "elixir", now) ? ELIXIR_IV : 0);
