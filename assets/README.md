# Art goes here

Drop PNG sprite sheets in this folder. The game picks them up automatically;
anything missing renders an emoji placeholder instead, so add art one file
at a time in any order.

## Format

- One PNG per animation, frames in a **grid**, read left-to-right then
  top-to-bottom (a single row is just a 1-row grid — both work).
- Every frame is a **64×64** square. Columns are derived from image width
  automatically, so 128×192 = a 2×3 grid = up to 6 frames.
- Set `frames` in `sprites.js` to how many cells actually animate.
- Static image is fine: 1 frame, 64×64. Start there, animate later.
- Transparent background. Characters should face **right** (mobs get
  mirrored automatically).

## Filenames (see sprites.js for the manifest)

| File | What |
|---|---|
| `striker.png`, `overmind.png`, `hero.png` | hero idle (hero = no class picked) |
| `striker_attack.png`, `overmind_attack.png` | optional attack anims |
| `kiln.png`, `slag.png`, `rift.png`, `loam.png`, `market.png`, `spire.png`, `warpit.png`, `tempest.png`, `prism.png`, `sorrow.png`, `aurum.png` | zone mobs |
| `hellparty.png`, `anton.png`, `luke.png`, `harlem.png` | bosses |

Different frame count or size? Edit that entry in `sprites.js`
(`frames`, `size`, `fps`).

## Tools

- **Piskel** (piskelapp.com) — free, in-browser, exports sprite-sheet strips. Easiest start.
- **Libresprite** — free desktop Aseprite fork.
- **Aseprite** — paid, the pixel-art standard.

In Piskel: draw frames → Export → PNG → "Spritesheet file export", one row.
