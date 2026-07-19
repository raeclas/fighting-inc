# Roadmap — porting the source mechanics

Tracks decompiled mechanics (see [DECOMPILE.md](DECOMPILE.md)) into our game.
Order is by dependency and payoff, not source-game order. Each item lists what
the map does, our adaptation (single-player, no spatial map, idle), and the
files it touches. Run `node sim.js --compare` after each — intended balance
shifts get a fresh `baseline.json` in the same commit.

## Done
- ✅ Enhancement odds (guaranteed ≤+3, 30/12/1.8/0.45), real HP/def per zone,
  INT confirmed as 1:1 damage, money bags, field bosses, bag-rate retune.

## Next — the load-bearing gap

### 1. INT system  ← the keystone, do first
**Map:** `damage = HeroInt + weapon terms`; INT is a flat additive stat that
higher zones drip per kill (Harlem onward). It's the endgame scaling lever.
**Us:** add `player.int`, fold it into `effectiveStats().atk` as a flat `+int`.
Zones past a threshold award `intPerKill` on kill (0 for early zones). INT
persists across Legion retirement (it's the account-power fantasy).
**Touches:** [player.js](../player.js), [main.js](../main.js) effectiveStats + killMob,
[zones.js](../zones.js) add `intPerKill`, save, [ui.js](../ui.js) show INT.
**Why first:** every zone gate and the whole post-gear curve keys off INT.

### 2. Zone gates + "No Entry after X"
**Map:** zones require level/INT to enter (Otherverse lv70 … Harlem lv2750),
and *lock out* once you outgrow them ("No Entry after INT X") — anti-boosting.
**Us:** per-zone `reqLevel` / `reqInt`, and optional `lockAfterInt`. Zone list
shows locked zones greyed with the requirement; the lockout is the honest
anti-Temple-forever fix the sim flagged (F2/F3). Gate values scaled to OUR
curve, not the map's (our levels top ~45, not 2750).
**Touches:** [zones.js](../zones.js), [ui.js](../ui.js) renderZoneList, [main.js](../main.js) selectZone guard.
**Depends on:** INT (1).

### 3. Party/lobby multiplier analogue (IV × YJ)
**Map:** enhancement chance, bag chance, coin double-drop all ×`IV[player]`
(elixirs) ×`YJ[party-size]`. "Play with 5+ players" is literally this.
**Us:** single-player, so no party. Fold into the existing gathering buffs +
a new consumable/elixir: a global `dropBonus` multiplier the player builds up
(brewed from non-combat resources, or timed elixirs). Reuses the buff plumbing
in [gathering.js](../gathering.js)/[enhance.js](../enhance.js).
**Touches:** enhance.js (already takes buffs), zones.js bag/coin rolls, a buff source.

## Later — content breadth (needs the systems above)

### 4. Talismans (endgame skill boosters)
**Map:** drop at +0 from high zones/bosses; merge 2×(+n)→+(n+1) up to +6
(64× +0 for a +6); boost specific skills past level 7.
**Us:** extend the skill system past `MAX_SKILL_LEVEL`; a merge UI. Pure
endgame sink — schedule after INT/gates make endgame reachable.

### 5. Special bosses (INT-gated summons)
**Map:** Bernardo (100k INT), Trans. Bernardo (500k), Seria (1.5M) — rare
class-weapon and Avatar drops, respawn timers 18–30 min.
**Us:** extend [bosses.js](../bosses.js) with `reqInt` and cooldown timers. The
full roster (Anton, Luke, Sirocco, Ozma, Tiamat, Astaroth, Ezra…) with real
def values is already decompiled and waiting.
**Depends on:** INT (1).

### 6. Job-change scroll (0.1%)
**Map:** ultra-rare drop that lets you re-pick class, keeping INT/items/skills.
**Us:** a 0.1% drop that reopens class select without wiping progress. Small,
fun, satirical — the "escape your build" lottery. Do anytime.

## Guardrails
- The map file stays gitignored; extraction scripts in scratchpad (offer to
  check in if useful).
- Every mechanic keeps the sim honest: model it in [sim.js](sim.js) if it
  affects the passive curve, or note it as an active-only bonus (like field
  bosses) if it doesn't.
- Numbers scaled to OUR curve (levels ~45, not 2750; INT in thousands, not
  millions). The *structure* is faithful; the *magnitudes* are ours to tune.
