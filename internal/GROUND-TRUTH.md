# GROUND TRUTH — source-fidelity pass (2026-07-20)

Reconciled wiki (enhancement-slave-rpg.fandom.com, per-boss pages) against the
decompiled map (w3t tier chains, w3u, war3mapmisc.txt, JASS `Epx`/`Eux` drop
dispatch). **Map wins on numbers, wiki wins on EN names.** Wiki item stats are
the **+20 tier** (talismans: +6). Extraction scripts: this session's scratchpad
(`dump_map.py`, `gen_itemdata.py`, `gen_itemjs.py` → regenerates
[itemdata.js](../itemdata.js)); raw JSON batches `wiki-batch*.json` there too.

## Hero growth (w3u + misc.txt) — uniform across all heroes
- Base STR/AGI/INT = 1/1/1; per level: **STR +0, AGI +0.1, INT +1**.
- `AgiAttackSpeedBonus=500` → attack speed pegs WC3's +400% cap within ~8 levels.
  Model: `interval = base / min(5, 1 + 0.1×(level-1)×5 + itemSpd%)`, cap ×5.
- `MaxHeroLevel=5000`, XP: `NeedHeroXPFormulaB=150` → xpToNext(n) = 150×n.
- INT-per-level is symbolic (+1); the real INT economy is kills (intPerKill).

## Item model (w3t tier chains)
- Every equipment has 21 tiers (+0..+20); talismans/insignia 7 (+0..+6).
  ALL stats + effect values scale per tier (hand-authored ramps — no formula;
  verbatim tables in itemdata.js).
- Effects seen: `dmgInc` ("Increase attack power by N%", stacks, applies to
  stat-increased damage), `addDmg`+`skillDmg` (one item both; **addDmg
  best-only** — "Only 1 additional damage items are applied"), `procChance/
  procMult` (N% chance INT×mult on attack), `critChance/critMult` (best-only),
  `intPct` (item-INT %), `spdPct` (attack speed, best-only per source),
  `skillLevels` (talismans). Lumen Basilium's DEF aura NOT modeled (flat stick).
- Wiki ATK columns match w3t exactly at +20 (Rosetta 120→3156 atk, 40→6600 INT,
  80%→2000% dmgInc).

## Boss ladder (JASS solo-kill values; party variants ×3 chance — ignored)
ticket = distinct ticket item, 5% upgrade (100% first learn).
`itemChance` %, `bag`, `bounty` in tier units (t0 copper, t1 silver, t2 gold).

| boss | ticket | item% | bag | bounty | rare |
|---|---|---|---|---|---|
| hellparty | Q | 4 | 10,000c | 5,500c | — |
| anton | W | 3 | 250,000c | 150,000c | — |
| luke | E | 2 | 1M c | 250,000c | — |
| harlem | R | 2 | 27M c | 7M c | — |
| taibers | T | 2 | 470M c | 170M c | — |
| fiendwar | F | 2 | 3 s | 1 s | — |
| prey | D | 2 | 80 s | 30 s | — |
| hyunfindwar | D | 2 | 312 s | 72 s | Talisman 0.15% |
| transfrey | D | 2 | 3,900 s | 900 s | Talisman 0.30% |
| baekhwa | — | 2 | 11,700 s | 2,700 s | Myth item 0.50% |
| ezra | — | 2 | 70,200 s | 16,200 s | TransTalisman 0.15% |
| ezraabyss | — | 2 | 117,000 s | 27,000 s | TransTalisman 0.36% |
| sirocco | — | 2 | 351,000 s | 81,000 s | TransTalisman 1.20% |
| astaroth | — | 2 | 5.2M s | 1.2M s | TransTalisman 2.00% |
| astaroth2 | — | 2 | 26M s | 6M s | Insignia 0.05% |
| tiamat | — | 2 | 130M s | 30M s | Insignia 0.10% |
| berias | — | 2 | 600M s | 200M s | Insignia 0.10% |
| ozma | — | 2 | 600M s | 600M s | Insignia 0.10% |
| queendestroyer | — | 2 | 200M s | 200M s | Insignia 0.30% |
| abysswalker | — | 2 | 9 g | 9 g | Insignia 1.00% |
| spirazzi | — | 2 | 36 g | 36 g | BrTalisman 0.10% |
| skasa | — | 2 | 60 g | 60 g | BrTalisman 0.30% |
| hisma | — | 2 | 150 g | 150 g | — |
| luton | — | 2 | 400 g | 400 g | — |

Specials (bernardo/bernardo2/seria/trialgiver/librarykeeper): source drops are
the enhanced-skill ticket system + class weapons/avatars — DEFERRED with
enhanced skills; they keep simplified bag bounties for now.

Note: source "Abyssal Intangible Sirocco" boss is not in our roster (pool tR).

## Class skills (wiki, verified vs HEROES.md)
Damage = **skillLevel × (base + INT × mult)**; details incl. cooldowns/ranges in
scratchpad `wiki-classes1.md`/`wiki-classes2.md` (9 shipped classes + enhanced
skills for later). Notables: Omniblade's Lightsword Mastery = +70%×lvl attack
power passive skill; Storm Trooper mastery = 17% AoE autos; Desperado Revolver
Enhancement = 15% auto / 20% skill proc.

## Zone economy (wiki Hunting Grounds, source values) — gates IMPLEMENTED (zones.js zoneLocked/intDrip)
Fallen Temple 10c/kill (bag 150c) … Harlem 5,999,999c (+1 INT), Harlem-R
599,999,936c (+2 INT), Harlem-D 179s (+3), Stormy 5,399s (+15), Aiolite 80,999s
(+4), Ore of Despair 1.62M s (+20; 20x: 32.4M s, +10), Best 599,999,936s (+10).
Entry gates + "No Entry after INT X" lockouts listed per zone (roadmap item 1).
