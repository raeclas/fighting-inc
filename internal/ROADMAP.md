# Roadmap — porting the source mechanics

Tracks decompiled mechanics (see [DECOMPILE.md](DECOMPILE.md)) into our game.
Order is by dependency and payoff, not source-game order. Each item lists what
the map does, our adaptation (single-player, no spatial map, idle), and the
files it touches. Run `node sim.js --compare` after each — intended balance
shifts get a fresh `baseline.json` in the same commit.

## Done
- ✅ Enhancement odds (guaranteed ≤+3, 30/12/1.8/0.45), real HP/def per zone,
  INT confirmed as 1:1 damage, money bags, field bosses, bag-rate retune.
- ✅ INT system (per-character since the Legion rebuild; zones drip `intPerKill`).
- ✅ Legion roster rebuild: account + characters[], per-class INT-scaled board
  bonuses, slot unlocks at account-INT milestones (see LEGION-DESIGN.md).
- ✅ Full decompiled boss roster (29 incl. Hisma/Skasa dragons + 5 specials),
  real regen walls (`regenPct`, 100%/s DPS gates), Epx drop tables with
  tier-currency bounties + rare talismans.
- ✅ Boss item effects: INT on items + signature mechanics (atk%, INT-procs,
  crit, skill%, item-INT%, cooldown%, talisman skill levels).

## Next — the load-bearing gap

### 1. Zone gates + "No Entry after X"
**Map:** zones require level/INT to enter (Otherverse lv70 … Harlem lv2750),
and *lock out* once you outgrow them ("No Entry after INT X") — anti-boosting.
**Us:** per-zone `reqLevel` / `reqInt`, and optional `lockAfterInt`. Zone list
shows locked zones greyed with the requirement; the lockout is the honest
anti-Temple-forever fix the sim flagged (F2/F3). Gate values scaled to OUR
curve, not the map's (our levels top ~45, not 2750).
**Touches:** [zones.js](../zones.js), [ui.js](../ui.js) renderZoneList, [main.js](../main.js) selectZone guard.

### 2. Party/lobby multiplier analogue (IV × YJ)
**Map:** enhancement chance, bag chance, coin double-drop all ×`IV[player]`
(elixirs) ×`YJ[party-size]`. "Play with 5+ players" is literally this.
**Us:** single-player, so no party. Fold into the existing gathering buffs +
a new consumable/elixir: a global `dropBonus` multiplier the player builds up
(brewed from non-combat resources, or timed elixirs). Reuses the buff plumbing
in [gathering.js](../gathering.js)/[enhance.js](../enhance.js).
**Touches:** enhance.js (already takes buffs), zones.js bag/coin rolls, a buff source.

## Later — content breadth (needs the systems above)

### 3. Talisman merging (endgame skill boosters)
**Map:** talismans drop at +0; merge 2×(+n)→+(n+1) up to +6 (64× +0 for a +6);
boost specific skills past level 7.
**Us:** basic talismans (flat `skillLevelBonus` items from rare boss rolls)
shipped with the drop tables — the MERGE system (+0…+6 ladder, merge UI,
per-key targeting) is what remains. Pure endgame sink.

### 4. Job-change scroll (0.1%)
**Superseded by the Legion roster:** a new character IS the job change (per
LEGION-DESIGN.md). Revisit only if a "re-class in place, keep INT" item still
feels needed once multi-char play settles.

## Guardrails
- The map file stays gitignored; extraction scripts in scratchpad (offer to
  check in if useful).
- Every mechanic keeps the sim honest: model it in [sim.js](sim.js) if it
  affects the passive curve, or note it as an active-only bonus (like field
  bosses) if it doesn't.
- Numbers scaled to OUR curve (levels ~45, not 2750; INT in thousands, not
  millions). The *structure* is faithful; the *magnitudes* are ours to tune.
