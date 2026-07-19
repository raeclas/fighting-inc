# Enhancement Slave Idle

A browser idle/incremental game: pick a class, farm hunting grounds for copper,
summon bosses for gear, and enhance your items from +0 to +20 against
deliberately brutal odds. A satirical take on Korean grind-RPGs, inspired by
the Warcraft 3 custom map *Enhancement Slave RPG*, rebuilt from scratch as an
original web game with its own features (bestiary, non-combat skills, offline
progress, an in-game macro workshop, and a MapleStory-Legion-style prestige).

**Play:** open `index.html` — no build step, no dependencies. Saves to your
browser's localStorage. Works on desktop and mobile.

## Features
- 11 hunting grounds (1×/5×/20× difficulty) with wandering field bosses
- +0→+20 enhancement with escalating cost and shrinking odds
- Active and passive classes (skills you cast vs skills that proc)
- Summon bosses with skill-ticket and gear drops
- Bestiary, mining/fishing, offline catch-up, macro automation, Legion prestige

## Develop
- `node test.js` — enhancement-odds and stat-stacking checks
- `node sim.js` — deterministic progression simulator + balance tracker
  (`--compare` flags drift against `baseline.json`)
- Serve locally over http (ES modules need it): `npx serve` then open the URL

Design notes and balance study live in `ECONOMY.md`.

## Credits
Original game by me. Built with AI assistance for the code; design, balance,
and art are mine. Inspired by *Enhancement Slave RPG* (by SCV) — no assets or
files from that map are used or redistributed.
