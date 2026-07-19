# Hero-skills study (source: Enhancement Slave RPG)

First-pass reference from the wiki (English skill translations); exact damage
uses the map's own formula `damage = INT + weapon` — every skill below scales as
`INT × multiplier`, further multiplied by **skill level** (1→7, +talismans).
Design source for expanding [classes.js](../classes.js) beyond Striker/Overmind.

## The universal template

Every hero (except Rakshasa) has:
- **1 passive** stat skill (attack power / attack speed / armor-reduction).
- **6 skills** on keys Q/W/E/R/T/F/D — for **active** heroes these are cast
  with cooldowns; for **passive** heroes they proc at a small % chance per attack.
- **3 "enhanced" endgame skills** that REPLACE earlier ones, unlocked from the
  100k / 500k INT special bosses (the last, key M, is a 300s-cooldown nuke).
- Two macro modes advertised per hero: **Boss Hunting** vs **AoE Hunting**.

**Archetype split (wiki):**
- **Passive (6):** Neo: Vagabond, Omniblade, Blood Evil, Indra, Dark Knight, Crusader.
- **Active (13):** Nen Empress, Divineress, Overmind, Desperado, Storm Trooper,
  Striker, Hekate, Majesty, Ashtarte, Rakshasa, Geniewiz, Spectre, Necromancer.

**Maps to our model:** passive heroes = our Overmind mechanic (proc-per-attack);
active heroes = our Striker mechanic (cast + cooldown). NOTE the source lists
**Overmind as active** — we adapted it to passive; keep that divergence in mind.
Most skills are **AoE** → reinforces the Phase A mob-pack. Rakshasa needs its own
prompt-timing minigame (deferred).

---

## Overmind — ACTIVE, ranged, flashy AoE caster
- **Lantern Fire (Q)** — Active Single, 2s CD — `80 + INT×80`
- **Arctic Fist (W)** — Active AoE, 14s CD — `30000 + INT×550`
- **Thunder Calling (E)** — Active AoE, 14s, range 800 — `INT×3500`
- **Astral Storm (R)** — Active AoE, 30s, range 1200 — `INT×500 ×13 meteors`
- **Elemental Curtain (T)** — Active AoE, 30s — `INT×10000`
- **The Gate (F)** — Active AoE, 30s — `INT×30000`
- **Sesto Elemental (D)** — Active AoE, 60s — `INT×40000`, **resets all other cooldowns**
- Enhanced: Holloween Buster (Q, 55s, INT×40000); Elemental Quake (W, 60s, INT×65000);
  Cosmic Calamity (M, 300s, INT×2,400,000)

## Striker — ACTIVE, melee, armor-strip + pull
- **Equip Boxing Gloves** (Passive) — +50% attack speed, reduces enemy armor
- **Low Kick (W)** — 6s CD, range 500 — `70000 + INT×700`
- **One Inch Punch (E)** — Active AoE, 15s, activates on attacked enemies — `4000`
- **Rising Knuckle (R)** — Active AoE, 30s, range 1100, **pulls enemies** — `INT×3000`
- **Power Fist (T)** — Active Buff, 60s, 30s duration, buffs basic attacks — `INT×1200`
- **Kihop Low Kick (F)** — Active AoE, 50s, 6s charge, range 400 — `INT×65000`
- **Empress's Climactic Fist (D)** — Active AoE, 55s, range 550 — `INT×100000`
- Enhanced: Limit Break (Passive, bonus dmg every 5 attacks, INT×1000); Tiger Strike
  (W, 30s, INT×160000); Neo: Awakened Sliding Slash (M, 300s, pulls up to 35, INT×1,700,000)

## Rakshasa — ACTIVE (unique), ranged, prompt-timing + Ghost
Basic attacks ranged. Each skill has a small % chance to **prompt on screen**;
timely activation ("Perfect") massively boosts damage AND skips cooldown. **Ghost
system**: some skills summon a 4s shadow granting +40% attack speed. `-autoskill`
command auto-fires prompts but loses ~99% damage (AFK only); spam-misclicking →
"Macro Check". Macros UNAVAILABLE for this hero. → our osu/rhythm minigame archetype.
- **Phantom Slash (Q)** — 20s, 3% trigger, range 600 — `500 + INT×500 (prompt)`, 2× Perfect
- **Ghost: Circle Cut (W)** — 20s, 2%, range 1000 — `800 + INT×800`, summons Ghost (+40% AS)
- **Soul Strike (E)** — 20s, 1.5%, range 1000 — `3000 + INT×3000`, 2× Perfect
- **Dyad: Half Moon Slash (R)** — 20s, 1.5%, range 1200 — `6000 + INT×6000`, 2× Perfect
- **Ghost: Targeted Hit (T)** — 20s, 1.5%, range 1200 — `12000 + INT×12000`, Ghost, 5× Perfect (boss)
- **Phantom Cross (F)** — 20s, 1.1%, range 1500 — `25000 + INT×25000`, 5× Perfect (boss)
- **Phantasmal Slayer (D)** — 20s, 1%, range 1500 — `35000 + INT×35000`, Ghost, 12× Perfect (boss)
- Enhanced: Fiend Dance (Q, 0.8%, INT×100000, 12× Perfect on current target); Abyssal
  Punishment (W, 1%, INT×150000); Spectral Genocide (M, 300s, INT×8,000,000)

## Omniblade — PASSIVE, sword auto-attacker (matches our Overmind mechanic)
- **Lightsword Mastery** (Passive) — +70% attack power ×skill level
- **Ultimate Slay - Iron Strike** — 3% proc, reduce armor 4s — `600 + INT×600`
- **Overdrive** — 2% proc, 4s, basic-attack boost — `260 + INT×260`
- **Draw Sword** — 3% proc — `7000 + INT×6500`
- **Illusion Sword Dance** — 2% proc — `15000 + INT×15000`
- **Omnislay - Mind's Sword** — 2% proc — `INT×25000`
- **Ultimate Slay - Tempest** — 1.2% proc — `INT×50000`
- Enhanced: Omnislay - Shooting Star (0.5%, INT×100000); Ultimate Blade Dance (0.5%,
  INT×300000); Pentastrike (5% proc, 300s CD, INT×12,000,000)

## Blood Evil — PASSIVE, auto-attack + luck, huge AoE zone-clearer
All skills passive procs; all but Q are AoE.
- **Gore Cross** — 5% — `100 + INT×100`
- **Raging Fury** — 3% AoE, range 700 — `300 + INT×300`
- **Blood Sword** — 2.4% AoE, range 700 — `1800 + INT×900`
- **Blood Boom** — 1.8% AoE, range 1000 — `8000 + INT×2000`
- **Outrage Break** — 1% AoE, range 1200 — `10000 + INT×5000`
- **Extreme Overkill** — 0.6% AoE, range 1500 — `14000 + INT×7000`
- **Blood Riven** — 0.5% AoE, range 1500 — `20000 + INT×20000`
- Enhanced: Enrage (0.5%, INT×35000); Blood Snatch (0.5%, INT×65000); Blood Majin
  Strike: Destruction (5%, 300s CD, INT×2,000,000)

## Indra — PASSIVE, RNG-proc
- **Wave Wheel Slasher** — 5% — `100 + INT×100`
- **Wave Radiation** — 3%, range 720 — `600 + INT×600`
- **Heat Wave Sword** — 2%, range 800 — `1200 + INT×1200`
- **Spirit Crescent** — 1.5%, range 860 — `2500 + INT×2500`
- **Agni Pentacle** — 1%, single — `15000 + INT×18000`
- **Wave Eye** — 0.5% buff, 9s, range→1200 — `INT×40000`; +10% basic attacks do `INT×3000`
- **Thunder God** — 0.5%, range 1200 — `12000 + INT×12000`
- Enhanced: Ground Quaker (0.6%, INT×75000); Murderous Wave (0.6%, INT×40000);
  Wave Weaver: Heaven's Thunder (5%, 300s, INT×2,000,000)

## Dark Knight — PASSIVE, "combo" meta-hero
Each proc **randomly picks the tier-equivalent skill of Blood Evil, Indra, or Omniblade**
(the passive version of Geniewiz). Q Combo 5% (100 + INT×100); W→D Combo each roll one of
the three heroes' skills at that tier (2.7% → 0.5% down the keys). Enhanced: SQ/SW Combo
(borrow the enhanced tier); The End of Time (5%, 300s — Time Strike INT×12,000,000 + Time
Explosion INT×2,000,000). Port note: complex — build the 3 base passives first, then DK as
a "roll one of them" wrapper.

## Crusader — PASSIVE (unique), auto-casts off cooldown (NO RNG)
Deterministic passive — skills fire on cooldown, not on chance. Damage + self-buff mix.
- **Blades of Purity (Q)** — 5s CD — `120 + INT×120`
- **Deflection Wall (W)** — 15s, range 800 — `INT×800`
- **Divine Invocation (E)** — 60s, 22s buff to basic attack — `INT×300`
- **Hammer of Repentance (R)** — 30s, range 1000 — `INT×2000` + Penance debuff (basic-atk buff, INT×500)
- **Righteous Judgment (T)** — 30s, range 1200, 6 hits/3s — `INT×8000`
- **Apocalypse (F)** — 60s, 22s — `INT×1100`, buffs ALL skill damage `+5%×level`
- **Punishment (D)** — 60s (active) — `INT×19000`
- Enhanced: Thunder Hammer: Jupiter (Q, 60s, INT×4000); Doom Spear (W, 60s, INT×90000);
  Final Judgement (M, 300s, INT×2,500,000)

## Nen Empress — ACTIVE, melee, summons clones
- **Khai (Q)** — 40s — `INT×6` + ally +50%×lvl attack speed (1000 range)
- **Doppelganger (W)** — 60s, 35s — creates 2 clones dealing `INT×720`
- **Lion's Roar (E)** — 20s, range 800 — `INT×3000`
- **Energy Shield (R)** — 25s, range 1000 — `INT×10000`
- **Tiger Flash (T)** — 60s, 30s, also buffs clones — `INT×1200`
- **Nen Flower (F)** — 40s, range 1500 — `INT×27000`
- **Brilliant Nen (D)** — 60s, range 1500 — `INT×65000`
- Enhanced: Nen Shot (Q, 8s, INT×22000); Lion's Grand Roar (E, 20s, INT×40000);
  Astral Penetration - Nen Dragons (M, 300s, INT×3,000,000)

## Divineress — ACTIVE, Sphere resource (build/spend)
Basic attacks accrue Spheres (14/attack, max 50); skills consume them. Resource management.
- **Thunder Amulet (Q)** — 10s — `200 + INT×200`
- **Power Orb (W)** — 0.1s CD, consumes 3 Spheres — `600 + INT×600`
- **Soul Magnet (E)** — 20s, +2 Spheres — `2000 + INT×2000`
- **Dragon Fury (R)** — 28s, +Spheres (boss ×5) — `2000 + INT×2000`
- **Oracle: Dragon Thunderstorm (T)** — 28s, +Spheres (boss ×10) — `7500 + INT×7500`
- **One Hundred Eight Beads (F)** — passive/active hybrid, Sphere management — `INT×1500`
- **Incarnation: Raging Godly Dragon (D)** — 50s, +Spheres (boss ×20) — `INT×37500`
- Enhanced: Holy Comet (Q, consumes all Spheres, INT×13000 + INT×1000×Spheres);
  Rosary Prison (E, INT×120000); Celestial Purge (M, 300s, sets Spheres to max, INT×2,000,000)

## Desperado — ACTIVE, ranged revolver, cast + passive proc-buff
- **Windmill (Q)** — 6s — `140 + INT×140`
- **Headshot (W)** — 5s — `INT×650`
- **Revolver Enhancement** (Passive) — 15% auto / 20% skill chance to enhance — `50000 + INT×1750`
- **Wild Shot (R)** — 36s, range 1000 — `INT×4000`
- **Death by Revolver (T)** — 75s buff, 28s — ×3 damage while Revolver Enhancement active
- **Scud Genocide (F)** — 50s, range 1200 — `INT×15000`
- **Seventh Flow (D)** — 50s, range 1200 — `INT×40000` + armor reduce
- Enhanced: Suppressive Barrage (Q, 30s, INT×25000); Wipeout (W, 30s, INT×55000);
  Death Crisis (M, 300s, INT×4,000,000)

## Storm Trooper — ACTIVE, AoE trash-clearer (gun + nuke)
- **Heavy Weapons Mastery** (Passive) — 17% basic attacks AoE, range 350 — `INT×40 + level×40`
- **Flame Thrower (W)** — 12s, range 800 — `60000 + INT×600`
- **Laser Rifle (E)** — 20s, range 1000 — `INT×2500`
- **Quantum Bomb (R)** — 28s, range 1500 — `INT×5000`
- **Miracle Vision (T)** — 70s buff, 30s — `INT×550`, +7%×lvl all skill damage
- **Agent Trigger (F)** — 30s, range 1500 — `INT×10000`
- **Operation Raids (D)** — 65s, range 1500 — `INT×32000`
- Enhanced: Heavy Weapon Mastery (17% AoE, INT×250); PT-15 Prototype (W, 70s, INT×110000);
  Decisive Battle (M, 300s, INT×2,000,000)

<!-- REMAINING: Neo: Vagabond (passive); Hekate, Majesty, Ashtarte, Geniewiz, Spectre,
     Necromancer (active). -->
