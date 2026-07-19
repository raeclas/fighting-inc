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

## Boss difficulty (w3u + war3map.j) — brutality decoded

The "5-minute boss kill" feel decomposes into three verified mechanisms:

1. **WC3 armor math**: damage reduction = 0.06·armor/(1+0.06·armor). Boss def
   750 → 97.8% reduction → **effective HP = raw × 46**; def 1000 → ×61. The
   1e9-clamped bosses are really 46–61B effective HP. (Our port bakes this
   into the `hp` numbers — flat-subtract defense can't express % armor.)
2. **Regen** (w3u `uhpr`, as fraction of max HP/s): Prey, -Hyun- Find War,
   -Transcendence- Frey, Baekhwa Mandarin = **1e9/s = 100%/s, a full heal per
   second** — the literal "can you even damage it" DPS gate. Ezra-raid 45%/s,
   Fiend War 30%/s, Taibers 25%/s, Harlem 8%/s, Siroccos/Astaroth-Terror 7%/s,
   Anton 1%/s, rest 0. Ported as `regenPct` in bosses.js.
3. `SetWidgetLife(boss, life × Nk)` at spawn is a **dev test hook** (`--Che`
   chat command; Nk defaults 1.0) — no hidden HP multiplier. The full `--Command`
   test suite exists in-script (`--G intelligence`, `--Money`, `--Special`, …).

**Drop economy (`Epx(p, loc, bountyTier, bounty, _, _, itemChance%, poolItem,
companionTicket, rareChance%, rareItem)`):** bounties are literal tier currency
(tier 0/1/2 = copper/silver/gold, 1e9 steps): Anton 250k copper, Taibers 470M
copper, Prey 80 SILVER, -Hyun- Find War 312 silver (+0.15% Talisman), Baekhwa
11.7k silver (+1.5% Myth pool), Ezra-abyss 117k silver (+1.08% -Transcendence-
Talisman), **Hisma 150 GOLD**. Item pools per boss (Salvation set, Heaven's
Legacy, Black Heaven, -Hyun-/-Transcendence-, ★Abyss★, Luna/Myth) each roll
one of ~5 set pieces; skill-enhancement tickets ride along as companions.
Boss spawn tags (`creephealon` etc.) are order-string routing, not mechanics.

## Item effects (war3map.w3t) — our boss items are under-ported

3517 item entries / 436 unique bases (rest are +N enhancement tiers). Our port
reduced everything to flat atk / atkspd sticks; the source gives every real
equipment **Attack + INT together** (INT ≈ 10% of the atk value; caster items
higher — Rosetta Stone is 528 atk / 1070 INT) plus one signature effect:

| Effect archetype | Count | Example (real numbers) |
|---|---|---|
| Increase attack power by N% ("applies only to damage increased by stats") | 78 | Rosetta Stone: **+380%**, "processed internally, not shown in status window" |
| Additional damage +N% / Skill damage +N% | 57/40 | Tiamat's Distrust: +303% add, 925% skill |
| N% chance to deal N×Intelligence damage on attack | 35 | Creation's Savior Staff: 20% for 1265×INT |
| Increases item intelligence by N% | 34 | Tiamat's Curse: +120–132% |
| N% chance of N× critical hit | 29 | Tiamat's Wrath: 45% for 853× |
| Attack speed +N% (**"Only 1 attack speed item applies"**) | 3 | Lumen Caligo 36% — our non-stacking rule is decompile-accurate |
| Reduce surrounding defense (aura, special slot) | 3 | Abyss Fragment Necklace: −2.8 → −115 |
| Skill cooldown −N% | 3 | Abyssal Fragment Staff (class-exclusive line) |
| Talisman: +N levels to specific skills (special slot) | 3 | Talisman Q/R/T +3; Transcendence W/F/D +4 |

Also: class-exclusive "Abyssal Fragment" accessories (one per hero, each with a
class-flavored effect — cooldown, proc chance, clone count, buff strength);
INT-gated wear requirements ("intelligence of 500,000 or more"); consumables
(money bundles per zone, INT potions, enhancement-protection tickets, job-change
scrolls, skill-enhancement tickets per class, epic jars = loot boxes).
