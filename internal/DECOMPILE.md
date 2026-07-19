# Decompiled source-map notes

Ground-truth values pulled from the actual WC3 map (`QoLP_Slave_RPG_S2_4.6L`),
which is protected but not un-crackable. Reference only — the map itself is
copyrighted and gitignored. Extraction scripts live in the scratchpad (MPQ
reader + a PKWARE-DCL "explode" port + a w3u object-data parser); ask if you
want them checked in.

## How

1. `.w3x` = a 512-byte `HM3W` header, then an MPQ archive at offset `0x200`.
2. Files inside are **encrypted** (StormLib key = filename hash) and
   **PKWARE-imploded** (compression `0x08`) — mpyq handles neither, so both
   were implemented. Decrypt with the block key, then explode.
3. `war3map.j` (3.7 MB JASS) has the logic; `war3map.w3u` (object data) has
   unit HP/defense; `war3map.wts` resolves names.

## Enhancement (war3map.j ~line 73896) — WIKI IS WRONG

Real bands, keyed by the level you enhance **from**:

| From +N | Success |
|---|---|
| 0–3 | **guaranteed** (no roll) |
| 4–6 | 30% |
| 7–10 | 12% |
| 11–15 | **1.8%** (wiki says 2.1) |
| 16–19 | **0.45%** |

**The kicker (line 73904):** `if GetRandomReal(0,100) <= EHv * IV[player]`.
The chance is *multiplied by a per-player `IV` value* built from lobby size /
elixirs (war3map.j ~43500). "Play with 5+ players" isn't advice, it's a
literal enhancement-rate multiplier. Our game has no equivalent yet — the
gathering buffs are the closest hook.

## Damage / INT (war3map.j line 6181)

```
damage = GetHeroInt(u) + qA[p]*fV[p]*max(1, jK[p])
```

**INT adds 1:1 to damage** — confirmed. It's a flat additive term alongside
the weapon/item product. INT is the endgame scaling stat that hunting grounds
drip per kill (Harlem onward), exactly the post-gear lever our F3 ceiling needs.

## Hunting-ground mob stats (war3map.w3u) — the wiki has NONE of these

Raw HP is truthful up to Terranium, then **clamps at 1,000,000,000** (WC3's
max unit HP); higher zones enforce difficulty in script, not unit stats.

| Zone | 1x HP | 5x HP | 20x HP | def (1x→20x) | field boss = |
|---|---|---|---|---|---|
| Fallen Temple | 200 | 1,000 | 4,000 | 0 | 10× mob (2k/10k/40k) |
| Magtonium | 8,000 | 40,000 | 160,000 | 5 / 10 / 15 | 80k / 400k / 2M |
| Otherverse | 400,000 | 2,000,000 | 8,000,000 | 20 / 30 / 40 | 4M / 20M / 80M |
| Terranium | 40,000,000 | — | — | 50 | 400M |
| Golden Beryl | (clamped 1e9) | | | 800 | — |

Exact relationships (these drive our zone formula now):
- **5x mob = 5× the 1x HP; 20x = 20×** — matches our variant multipliers exactly.
- **Field boss = 10× the corresponding mob HP** — the "stronger version that
  drops bags" you described. Named "N laps Boss" in-map.
- **HP-per-copper rises up the ladder**: 100 (Temple) → 154 (Magtonium) →
  222 (Otherverse) → 222 (Terranium) → ~666 (Harlem). Mobs get *tankier per
  coin* as you climb — the opposite of a kindness curve. Higher zones pay
  more absolute copper but worse per point of damage; INT/gear growth is what
  makes them worth it. This is the real sadism, and it replaces my guessed taper.

Also visible: dozens of summon bosses (Anton 160M/def80, Luke 600M/def120,
Abyss Walker, Sirocco, Ozma, Tiamat, Astaroth, Ezra…) — the full boss roster
for future content, most clamped at 1e9 HP with defense 500–1000.
