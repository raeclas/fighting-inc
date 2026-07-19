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

## Baseline timeline (2026-07-19, after bags + zone taper)

| t | milestone |
|---|---|
| 5s | Rafaros Staff bought |
| 30m | Rafaros +10, switch to Magtonium |
| 1.4h | first Liberation +20 (E 625k copper) |
| 1.8h | 5× Liberation +20 + Lumen +15, Hell Party farmable |
| 2.4h | Hell Party items +20, Anton farmable |
| 3.1h | Anton/Luke items done |
| 5.2h | Globetrophy +20 — **all current content cleared, level 43** |

Money bags (5% drop, wiki values) roughly doubled income economy-wide and
halved the clear time; F3 (more content) is what stretches it back out.

## Ground truth (decompiled 2026-07-19)

Zone HP/defense and enhancement odds now come from the actual map, not
guesses — see [DECOMPILE.md](DECOMPILE.md). This lengthened a full clear from
~5h (fake values) to **~3.4 days** (real HP), which is the authentic Korean
idle-grinder pace. The sim caught two of my own modeling bugs while landing
this: a regen floor that deadlocked the level-1 starter, and a seconds/ms
units error in the time-to-kill floor that made the lowest zone look
infinitely efficient. Both are exactly what the tracker exists to catch.

Still open, now with real numbers: the game has **no reason to leave a zone
for income alone** past the one-shot point — higher zones win only because
they pay more per one-shot. The source game forces the climb with INT drops
(Harlem+) and hard level/INT lockouts ("No Entry after X"), neither of which
we've built yet. That's the real F3, and it's the next structural piece.

## Findings

**F1 — RESOLVED. Early game was a desert.** 48 minutes of 0.15 c/s before
the first milestone. Fix applied: money bags at `BAG_CHANCE = 5%` with
per-zone values from the wiki (Temple 30c … Golden Beryl 1e18c). First
milestone now ~30m; big gold 💰 floater on drop for the variance dopamine.

**F2 — RESOLVED. All wiki zones were strictly dominated by the placeholder
goblin.** The three placeholder intro mobs (slime/slime2/goblin) had better
copper-per-hp than every wiki zone, so the bot never left the goblin.
Fix applied: placeholders removed (they were always temporary) and the hp
multiplier now tapers down the ladder (×10 → ×4), so copper/hp improves
from 0.10 to 0.25 as you climb — each unlock is a real income jump. The
sim now switches Temple → Magtonium → Otherverse on schedule; Terranium+
still waits on future gear tiers (see F3).

**F3 — Full clear in 10.3 optimal hours.** Fine for a demo; too short for
release. The gear ladder (not the zone ladder) is the ceiling — see the
gear-cliff note in the fun review. New item tiers stretch this linearly.

**F4 — RESOLVED. Legion was unreachable.** Full clear ends level ~43;
retirement needed 50 (xpToNext grows ×1.5/level against roughly linear xp
income). Fix applied: `RETIRE_MIN_LEVEL = 35`, comfortably inside a clear.
Revisit if xp curve or content length changes.

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
