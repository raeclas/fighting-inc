# Map extraction tooling

Scripts that pulled item/skill/drop data out of the decompiled source map
(`QoLP_Slave_RPG_S2_4.6L F10.w3x`, gitignored in repo root).

- `dump_map.py` — parses the .w3x archives (w3t/w3u/w3a) into `map-items.json`
  (item names + tooltip strings; checked in here) and friends.
- `gen_itemdata.py` — regular boss pools + tier chains → per-tier stats
  (regenerates the bulk of `itemdata.js`).
- `gen_itemjs.py` — glue for `itemdata.js` output.
- `gen_specials2.py` — special-boss gear (Abyss Fragment weapons/jewelry,
  avatars, -Transcendence-/-Liberation- families) with class tags and enhance
  costs decoded from the JASS drop dispatch + enhance triggers; appends the
  `special-boss gear` block in `itemdata.js`.

The decompiled `war3map.j` (3.8MB, derived from the map) is NOT checked in —
scripts reference it from a local scratchpad path; re-derive with any w3x
decompiler if needed. Paths at the top of each script need updating to
wherever those files live locally.

Decoded facts that live in code, for reference:
- Drop dispatch (war3map.j ~L103890): bernardo 2.25% gear pool (necklace/ring/
  class weapon 1/3 each) + 1.875% Abyss Skill Change Ticket; bernardo2
  0.75% trans gear + 0.75% trans ticket; seria 6× "100 years old" souls +
  0.3% avatar; librarykeeper 6× "Brilliant Sarah" souls + 0.1% splendid
  avatar; trialgiver 0.15% True Awakening ticket + 0.5% liberation gear.
- Enhanced tickets are 100% success, +1 per use, cap 7 (unlike Q..D 5% tickets).
- Avatar enhance: bands 100/24/9/1.2/0.3 (%), costs 2× old souls + 753,300
  silver (Seria) / 3× brilliant souls + 55 gold (Library) per attempt.
- Weapon/jewelry enhance: standard 100/30/12/1.8/0.45 bands, copper costs in
  itemdata (18-24 silver bernardo, 1,970 silver trans, 1 gold liberation).
