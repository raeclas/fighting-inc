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
- ✅ Talisman merge + special bag: `player.specialBag` (rings/necklaces/
  talismans/insignia/aura, incl. both Ent Spirit pieces — never eat the 6
  slots), talisman family merge-only 2×(+n)→+(n+1) free (`tryMerge`), aura
  DEF-only from bag (atk/INT suppressed), jewelry keeps copper enhance from
  bag, idempotent v3 sweep migration, fresh baseline (~1-2% earlier).
- ✅ Enhanced skills + special bosses: 9 classes × 3 enhanced skills
  (`cls.enhanced`, abyss/trans/awaken + `activeSkills()` swap-in), evolution
  tickets 100% success from bernardo/bernardo2/trialgiver (real dispatch
  rates), M ultimate (300s CD), per-class Abyss Fragment weapons + trans/
  liberation gear + avatars extracted from map (internal/extract/), meta-
  modifiers live: cooldownPct/intRatioPct/procRatePct/clones/magicCrit,
  souls ("100 years old"/"Brilliant Sarah") + avatar soul-enhance bands
  24/9/1.2/0.3. Zero sim drift (specials beyond canonical horizon).
- ✅ Consumables/jars: zone-jar gacha loop (consumables.js — per-zone/variant
  map rates, drop beside the bag roll, offline EV as float counts, Open =
  source ORx roll into specialBag), INT potion (+120% pure INT 30min) +
  Probability potion (source IV +25% on every drop/enhance roll — `ivMult()`
  is the item-2 elixir plug point), enhancement confirmation ticket (3rd
  gathering buff, 100% next enhance, copper still paid, avatar path too).
  Zero sim drift. NOT in map (never invented): Golden Book/Reversal Staff,
  Myth-jar open weights, mixed-jar brtalisman branch, Beryl 20-lap rate,
  protection-rights wiring.

- ✅ Batch-2 heroes + Formless Sirocco (2026-07-20): all 9 remaining classes
  (Crusader autocast, Majesty on-hit charges + 40-stack reset, Divineress
  spheres, Geniewiz GS/S/F outcome rolls, Spectre every-N, Hekate self-buff
  kit from w3a extraction, Ashtarte chaser tempo, Necromancer Vallacre stance,
  Dark Knight borrow-wrapper) + their 7 Abyss Fragment weapons and the
  ★Abyss★ Formless Sirocco boss (free summon, 20% elite twin at 3× drops,
  5-item ★Fusion★ pool — tR decoded; ROADMAP's old "already extracted" claim
  was wrong until now). 18/19 classes shipped. Zero sim drift.

## Next — remaining source gaps, in build order

### 1. Rakshasa (last class) — prompt-timing minigame, needs its own reaction UI.

### SHELVED — Party/lobby multiplier analogue (IV × YJ)
Shelved by user decision (2026-07-20). `ivMult()` in consumables.js already
carries the IV plumbing (probability potion feeds it); elixir sources can plug
in whenever this revives. **Map:** enhance/bag/coin all ×`IV[player]` (elixirs)
×`YJ[party-size]`.

### Mechanical residue (small, opportunistic)
Batch-2 marked adaptations: Apostolate AS% + Hekate SW crit component
undecoded (trigger-applied); Geniewiz GS side-buffs unnumbered (damage tiers
only); DK combo chances interpolated between the 2.7/0.5 endpoints; multi-hit
skills folded to one volley (Judgment, Brain Attack finisher, End of Time);
Spectre single/multi damage split uses single; Necromancer minion = clone
rider with Black Web folded to EV; a few unstated CDs assumed (marked ponytail).
Attack speed = HYBRID adaptation (2026-07-20): source saturates the WC3 +400%
cap at level 1 (base AGI 1 × AgiAttackSpeedBonus 500, per-class baseCooldownMs
from w3u), so all spd% stats are decorative in the map — we let item/legion/
buff speed stack past the cap to keep them meaningful.
Khai buff duration assumed 15s (map silent); One Inch Punch on-attacked /
knuckle pulls / 13 discrete meteors (no substrate); clones are damage riders,
not attackers; buffs absent from offline batch EV; locked-out zone farms
until you switch (no kick-on-tick). Job-change scroll stays superseded by the
Legion roster.

## Guardrails
- The map file stays gitignored; extraction scripts + parsed item dump live in
  [extract/](extract/) (the decompiled war3map.j itself stays out).
- Every mechanic keeps the sim honest: model it in [sim.js](sim.js) if it
  affects the passive curve, or note it as an active-only bonus (like field
  bosses) if it doesn't.
- FULL SOURCE NUMBERS since the fidelity pass (user decision 2026-07-20):
  magnitudes come from the map/wiki (+20-tier convention), not our tuning.
  GROUND-TRUTH.md is the reference; map beats wiki on numbers.
