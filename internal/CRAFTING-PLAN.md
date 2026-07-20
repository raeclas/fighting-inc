# Gathering→Crafting Progression ("Workman's Set") — DEFERRED

Status: designed 2026-07-20, deferred until after the design-reduction pass.
Rationale: reduction pass (fidelity → content-library spec, system merges/cuts)
lands first; adding a new system on top of the pre-reduction pile was the wrong
order. The Workman utility identity fits the reduced game better.

Problem: gathering is skippable (infinite copper via boss bounties, one-shot
flat-cost aids, no consumption loop). Guardrail (user-set): crafted gear never
competes with boss gear on raw power — utility identity only; core loop stays
"kill stronger bosses".

User-approved decisions: license-unlock dual gathering; workman-tier cost
scaling ×2^(tier−1); Workman's set / tier ladder / material enhance / catalyst /
mastery milestones.

Post-reduction adjustments to make when reviving:
- mastery-star plug becomes a Feats plug (gathering milestones = feats)
- Angler's ivPct feeds the visible Luck stat
- catalyst unchanged

## P1 — Dual gathering + Foreman's License
`nextTick:{mining,fishing}` replaces `nextTickAt`; `license` flag;
`craftLicense` (250 ore + 250 fish, both Lv10); `advanceGathering(g, now,
onLevelUp)` generalized from main.js gatherTick (catch-up guard 20k).
Migration: default `nextTick` to old `nextTickAt` else `total_time` in
saveSystem `load()` — otherwise catch-up mints ≤20k free resources.

## P2 — Workman's set
20 itemdata entries `wm_{pickaxe|angler|foreman|watch}{1..5}`
`{boss:null, enhCost:0, tiers:[7]}`, utility key only (no atk/int/dmgInc/
addDmg/skillDmg — test-enforced guardrail).

New aggregate lanes: `out.ivPct` (stacks; fold into dropIv/enhIv — post-
reduction: into Luck), `out.spdStackPct` (stacks; avoids the spdPct best-only
trap vs boss items at 50-400).

Stats (+0→+6) per tier:
| Tier | pickaxe defReduce | angler ivPct | foreman intPct | watch spdStack |
|---|---|---|---|---|
| T1 | 1k → 3k | 1 → 2 | 1 → 2 | 2 → 4 |
| T2 | 8k → 24k | 2 → 4 | 2 → 4 | 4 → 8 |
| T3 | 50k → 150k | 4 → 6 | 4 → 7 | 8 → 14 |
| T4 | 400k → 1.2M | 6 → 9 | 6 → 10 | 12 → 20 |
| T5 | 30M → 90M | 8 → 12 | 8 → 15 | 16 → 30 |
(Pickaxe ≈ 15-30% of next era's boss defense — wall-breaker, never damage.)

Ladder `WORKMAN_TIERS` (shared gates; costs pre-weight):
Lv5 / 30 / luke×1 · Lv15 / 150 / harlem×10 · Lv30 / 750 / fiendwar×25 ·
Lv50 / 4k / prey×50 · Lv75 / 20k / skasa×1.
Gate = min(mining, fishing) level AND kills. Family weights [ore,fish]:
pickaxe [1.5,0.5], angler [0.5,1.5], foreman/watch [1,1].
Recraft consumes previous tier, plus carries (nothing becomes trash).
Per-character sets, shared gathering resources (roster amplifies the sink).
Add ids to SPECIAL_IDS; bag UI renders generically.

## P3 — Material enhance
`tryMaterialEnhance(resources, eq, def, cost, rng, buffs, mult)` mirrors
tryAvatarEnhance, pays ore/fish. Reuse `enhanceChance` bands (+6 cap → only
100%/30% bands hit, ~14 expected attempts). Cost/attempt =
ceil(tierCost/10) × weights (T1 3+3 … T5 2k+2k; expected +0→+6 ≈ 1.4× craft
cost). Branch in `enhanceBag` on `WORKMAN_IDS` BEFORE the copper path
(enhCost 0 = free-enhance bug otherwise — test it).

## P4 — Scholar's Catalyst + era costs
`bestIntBounty(kills)` in bosses.js. Catalyst: 150 ore + 150 fish, 1h cooldown
(`g.catalystReadyAt` vs total_time), pays 25% of best defeated special's
intBounty to active char INT; requires Bernardo down; primary tuning knob.
`craftCostMult(bag) = 2^(bestWorkmanTier−1)` (×1..16) on potions/confirmation
ticket/elixir/catalyst; hammer + offering stay flat.

## P5 — Feats, achievements, Codex
Gathering milestones [10,25,50,100] per activity → feats. Achievements:
license "Multitasker", workman1 "Tools of the Trade", workman5 "Master
Craftsman". Codex crafting section rendered from live constants.

## P6 — Sim
Extend the declared blind spot ("gathering / workman set / catalyst not
modeled") — bot never gathers, baseline bit-identical expected. Upgrade path:
deterministic gathering income + greedy craft order if crafted power ever
needs drift tracking.
