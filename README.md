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
- `npm test` — enhancement-odds and stat-stacking checks
- `npm run sim` — deterministic progression simulator + balance tracker
  (`node internal/sim.js --compare` flags drift against the baseline)
- Serve locally over http (ES modules need it): `npx serve` then open the URL

Design docs, the balance study, and the roadmap live in `internal/`
(not published to the live site).

## Credits
Original game by me. Built with AI assistance for the code; design, balance,
and art are mine. Inspired by *Enhancement Slave RPG* (by SCV) — no assets or
files from that map are used or redistributed.
