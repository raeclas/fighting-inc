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

## Done (source-fidelity rounds, 2026-07-20)
- ✅ Full source numbers: per-tier item data (itemdata.js), per-boss drop
  pools + Q..D ticket ladder, real class skill tables, per-level AGI/INT
  growth, save v3 wipe. See GROUND-TRUTH.md.
- ✅ Zone gates + "No Entry after X" lockouts + "No INT after X" drip caps
  (zones.js `zoneLocked`/`intDrip`), source zone names ("N laps of X").
- ✅ Combat foundations: armor/DEF debuffs (Lumen aura, Boxing Gloves, Iron
  Strike/Seventh Flow windows), timed buff registry (Power Fist, Death by
  Revolver ×3, Miracle Vision, Khai, Tiger Flash, Overdrive, Wave Eye),
  Doppelganger clones (rider model + battlefield sprites).

## Next — remaining source gaps, in build order

### 1. Talisman merge + special bags (next session's round)
**Map:** talismans drop +0, merge 2×(+n)→+(n+1) to +6 (64× +0 for a +6).
Rings/necklaces/talismans/insignia/avatars live in a SPECIAL EQUIPMENT BAG /
Avatar Warehouse — they don't eat the 6 weapon slots. Lumen-style auras only
work from the special slot (and their atk/INT then don't apply — we're
currently generous, applying both from a normal slot).
**Us:** `player.specialBag` slots + merge UI (2 same-tier → +1); move
talisman/insignia acquisition there. Tier data already in itemdata.js.
**Touches:** player.js (bag), items.js aggregate (special-slot rules),
main.js acquireItem routing, ui.js gear tab, saveSystem (v4 or additive).

### 2. Enhanced skills + special bosses (biggest payoff)
**Map:** Bernardo (100k) Abyssal ticket EVOLVES Q; Trans-Bernardo (500k) W/E;
Giver of Trials (5M) True Awakening M ultimate (300s CD, INT×1.7M–12M).
Class weapons carry meta-modifiers (activation rate +40–60%, skill INT-ratio
+38–60%, cooldown −22–35%, buff value +32–45%, Geniewiz great-success);
Seria/Library Keeper drop avatars (incl. MAGIC CRIT) upgraded with Seria
Coins. All enhanced-skill tables transcribed (scratchpad wiki-classes*.md +
HEROES.md); item data extractable same as round 1.
**Us:** skill evolution state per character, M slot, meta-modifier fields in
effectiveStats, special-boss drop tables, coin currency.

### 3. Consumables/jars
Zone-dropped Talisman/Myth/Insignia jars, Ezra/Sirocco pots, Golden Book
(Reversal Staff amp), INT potions, enhancement-protection tickets. Add after
merge exists so jars have somewhere to pour. Per-zone jar list in
GROUND-TRUTH.md zone table.

### 4. Party/lobby multiplier analogue (IV × YJ)
**Map:** enhance/bag/coin all ×`IV[player]` (elixirs) ×`YJ[party-size]`.
**Us:** single-player → brewed elixirs granting a global `dropBonus`; reuses
gathering buff plumbing. Touches enhance.js, zones.js rolls, a buff source.

### 5. Batch-2 heroes + missing boss
Crusader (auto-cast), Majesty (on-hit riders), Divineress (spheres), Geniewiz
(GS/S/F rolls), Spectre (speed stacks), Hekate/Ashtarte (buffers),
Necromancer (stance), Dark Knight (borrows skills) — port notes in HEROES.md.
Abyssal Intangible Sirocco boss (★Fusion★ pool `tR`, already extracted).
Rakshasa last (prompt-timing minigame).

### Mechanical residue (small, opportunistic)
Khai buff duration assumed 15s (map silent); One Inch Punch on-attacked /
knuckle pulls / 13 discrete meteors (no substrate); clones are damage riders,
not attackers; buffs absent from offline batch EV; locked-out zone farms
until you switch (no kick-on-tick). Job-change scroll stays superseded by the
Legion roster.

## Guardrails
- The map file stays gitignored; extraction scripts in scratchpad (offer to
  check in if useful).
- Every mechanic keeps the sim honest: model it in [sim.js](sim.js) if it
  affects the passive curve, or note it as an active-only bonus (like field
  bosses) if it doesn't.
- FULL SOURCE NUMBERS since the fidelity pass (user decision 2026-07-20):
  magnitudes come from the map/wiki (+20-tier convention), not our tuning.
  GROUND-TRUTH.md is the reference; map beats wiki on numbers.
