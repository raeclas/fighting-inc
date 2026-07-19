# Economy study & scaling tracker

## The tracker

`sim.js` is a deterministic progression simulator that imports the **live
game modules** (zones, items, enhance, bosses, classes, bestiary). It plays
the canonical wiki-guide build as an Overmind using expected values instead
of RNG (enhance to +N costs its expected copper; a boss item takes its
expected 1/8% = ~13 kills), and logs a milestone timeline.

```
node sim.js            # print timeline, regenerate baseline.json
node sim.js --compare  # diff current balance vs baseline.json; exit 1 on >25% drift
```

**Feature-creep protocol:** after ANY feature or balance change, run
`node sim.js --compare`.
- No drift → the feature didn't touch the power curve, ship it.
- Drift you intended (a rebalance) → run `node sim.js` to accept the new
  baseline and commit `baseline.json` alongside the change.
- Drift you didn't intend → that's the creep, fix before shipping.

Not modeled (acceptable blind spots, revisit if they become primary income):
macros, gathering buffs, Legion retirement loops, active-class play.

## Baseline timeline (2026-07-19)

| t | milestone |
|---|---|
| 7s | Rafaros Staff bought |
| 48m | Rafaros +10 (the slime crawl, 0.15 c/s) |
| 51m | first Liberation Staff |
| 2.4h | first Liberation +20 (E 625k copper) |
| 3.2h | 5× Liberation +20 + Lumen +15, Hell Party farmable |
| 4.3h | Hell Party items +20, Anton farmable |
| 6.0h | Anton/Luke items done |
| 10.3h | Globetrophy +20 — **all current content cleared, level 45** |

## Findings

**F1 — Early game is a desert.** 48 minutes of watching slimes at 0.15 c/s
before the first satisfying milestone. Fix: money bags — rare drop
(~1/20 kills) worth 15–30 kills, straight from the source game. Adds
variance dopamine and roughly doubles early income without touching the
curve elsewhere.

**F2 — All 11 wiki zones are strictly dominated. The bot never leaves
Unpaid Goblin Intern.** Copper-per-hp: goblin 0.125 vs 0.10 flat for every
wiki zone (hp = copper×10), and wiki zones add defense on top. Higher zone =
same income at best, usually worse. Fix: taper the hp multiplier so
copper/hp *improves* up the ladder (≈0.10 intro → ≈0.25 endgame); each zone
unlock then IS an income jump, which is the entire point of unlocking zones.

**F3 — Full clear in 10.3 optimal hours.** Fine for a demo; too short for
release. The gear ladder (not the zone ladder) is the ceiling — see the
gear-cliff note in the fun review. New item tiers stretch this linearly.

**F4 — Legion is unreachable.** Full clear ends at level 45; retirement
needs 50. The xp requirement grows ×1.5/level against roughly linear xp
income. Fix: retire at ~35, or slow xpToNext growth to ×1.35, or add xp
multipliers to later zones.

**F5 — Enhancement is ~80% of all spending, and it's one number.** Spend
per +20 runs 625k (Liberation) → 13.9M (Rosetta) → 69.5M (Kneecap) → 347M
(Rosettier) → 1.39B (Globetrophy): ×2200 across seven hours, financed by
income from the same items. Tight loop is on-theme, but it's a single
lever — gathering buffs, bags, and future sinks (talismans) are what keep
it from feeling like one long toll booth.

**F6 — Bosses are trivial once reachable.** Kill times drop to seconds
immediately (50k hp vs ~15k+ dps at first check). No tension, no wall.
Boss regen scales at hp/200/s — irrelevant. Fix later: scale boss hp to
expected gear at unlock, or add enrage timers.

## Recommended order

1. F2 zone ratio taper — makes the existing 11 zones matter (pure numbers change).
2. F1 money bags — early-game feel + variance.
3. F4 Legion threshold — one constant.
4. F3/F5/F6 — need new content (item tiers, talismans), schedule after art/feel work.
