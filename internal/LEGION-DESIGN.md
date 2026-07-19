# Legion rebuild — locked design (roster-based)

Corrects the current Legion, which is wrong: it's MapleStory *prestige* (retire →
wipe a character → account bonus). It should be MapleStory *Legion*: multiple
separate characters, each always contributing an account-wide bonus, none sacrificed.

Decisions locked with the user:
- **INT is per-character** (revisits Phase B, where it was account-shared). Each
  character grinds its own INT/level/gear/copper. The *account* layer is the Legion board.
- **Bonuses are varied per class** — each class gives a distinct account bonus type.
- **Slots unlock via INT milestones (spine) + gold purchase (escalating shortcut).**
  NOT level-5000 (our level curve caps ~45; adopting a 5000 cap is a separate retune).

## Architecture pivot

Today: one global `player` object = the whole character. `gameState` holds run state.
Target: an **account** holding a **roster** of characters + an active pointer.

- **Character** (was `player`): `{ classId, level, xp, xpToNext, attack, attackSpeed,
  int, equipment, stash, skills }` — fully independent per character. Copper is
  per-character too (you farm + enhance on the character you're playing).
- **Account** (`gameState` grows): `{ characters: [], active: 0, slots: 1, gold: 0,
  kills, fieldKills, gathering, macro, ... }`. Bestiary/kills stay account-wide (a
  shared collection). `gathering` account-wide (or per-char — decide during build;
  lean account-wide). Legion bonuses are **derived**, not stored.
- **The active character** is what combat/UI read. Replace every `player.*` combat
  read with `activeChar().*`. `effectiveStats()` reads the active char AND applies
  the summed Legion bonuses from the whole roster.
- **INT** moves off `gameState` onto each character. Undo Phase B's `gameState.int`
  → `char.int`; keep the intPerKill drip (awards the *active* character's int).

## Legion board

- One slot per class (19). A class's slot is "active" when the roster contains a
  character of that class past a **mastery gate** (e.g. all skills learned, or an
  INT threshold on that character).
- Each active class contributes a **distinct** account-wide bonus, **scaled by that
  character's INT** (unbounded → idle-friendly; level caps, INT doesn't):
  | Class (example) | Bonus |
  |---|---|
  | Striker | +% attack speed |
  | Overmind | +% AoE/skill damage |
  | Blood Evil | +% drop rate (bags) |
  | Omniblade | +% enhance success |
  | Storm Trooper | +% gold/copper find |
  | … | assign the rest from HEROES.md flavor |
- **Caution:** INT already boosts damage directly; keep Legion %s modest so INT
  doesn't compound into a runaway (direct INT damage + INT-scaled Legion damage).
- Bonuses apply to the **active** character's combat (and to all, conceptually —
  but only the active one is playing).

## Character slots

- Start with 1 slot. Unlock more via:
  - **INT milestones** — escalating (e.g. 100k, 1M, 10M account or best-char INT). Primary.
  - **Gold** — escalating price (gold = the high-tier currency, 1e9 copper = 1 silver,
    1e9 silver = 1 gold per wiki). A gold sink + impatience valve.
- Unlocking a slot lets you **create** a new character (pick class, fresh level/gear/int).
  This replaces both retire (gone) and job-change (a new character IS the job change).

## Migration

- `saveSystem`: wrap the current single character into `characters[0]`; move `int`
  from account onto it; drop `legion.retired`. Version-bump the save; migrate old saves.
- Remove `retireCharacter` / `RETIRE_MIN_LEVEL`; `legion.js` becomes the board
  (per-class bonus table + `legionBonuses(account)` returning the summed multipliers).
- `main.js`: introduce `activeChar()`; repoint combat/enhance/drops to it. `effectiveStats`
  folds `char.int` + Legion multipliers.
- UI: a **Legion/roster tab** — list characters (class, level, INT, its bonus), a
  "play" button to switch active, a "new character" button (when a slot is free),
  and slot-unlock buttons (INT-gated / gold-priced).

## Build order (own session)

1. Save/state: account + roster + migration (get old saves loading as characters[0]).
2. `activeChar()` indirection; repoint combat/enhance/drops/UI reads. Verify game plays identically with a 1-char roster.
3. Legion board: per-class bonus table, `legionBonuses()`, fold into effectiveStats.
4. Slots + create-character + switch-active UI (roster tab).
5. Slot unlocks (INT milestones + gold), gold currency plumbing.
6. sim.js: model a representative roster's Legion multipliers; re-baseline.
7. Retune Legion %s so INT doesn't runaway (watch the sim).

## Verification

Per step, play in browser: 1-char roster plays identically; create a 2nd character,
switch between them, confirm each keeps its own INT/gear/level; Legion bonuses apply
to the active char and scale with the other's INT; slots unlock at the milestone / on
gold spend; save/reload preserves the whole roster. Sim + tests green.
