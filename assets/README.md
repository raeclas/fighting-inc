# Art goes here

Drop PNG sprite sheets in this folder. The game picks them up automatically;
anything missing renders an emoji placeholder instead, so add art one file
at a time in any order.

## Format

- One PNG per animation, frames in a **horizontal strip**, left to right.
- Every frame is a **64×64** square → image is `64*frames` wide, 64 tall.
- Static image is fine: 1 frame, 64×64. Start there, animate later.
- Transparent background. Characters should face **right** (mobs get
  mirrored automatically).

## Filenames (see sprites.js for the manifest)

| File | What |
|---|---|
| `striker.png`, `overmind.png`, `hero.png` | hero idle (hero = no class picked) |
| `striker_attack.png`, `overmind_attack.png` | optional attack anims |
| `slime.png`, `slime2.png`, `goblin.png`, `temple.png`, `magtonium.png`, `otherverse.png`, `terranium.png`, `harlemdungeon.png`, `lukelab.png`, `fiendwar.png`, `stormy.png`, `aiolite.png`, `despairore.png`, `goldenberyl.png` | zone mobs |
| `hellparty.png`, `anton.png`, `luke.png`, `harlem.png` | bosses |

Different frame count or size? Edit that entry in `sprites.js`
(`frames`, `size`, `fps`).

## Tools

- **Piskel** (piskelapp.com) — free, in-browser, exports sprite-sheet strips. Easiest start.
- **Libresprite** — free desktop Aseprite fork.
- **Aseprite** — paid, the pixel-art standard.

In Piskel: draw frames → Export → PNG → "Spritesheet file export", one row.
