# pixelize.py — turn raw 1024px candidates into true pixel sprites.
# Nearest-neighbor downscale + shared adaptive palette + flat-background
# removal to transparency. Contact sheet for picking.
# Usage:
#   .venv/Scripts/python pixelize.py            # all of out/raw -> out/px + sheet
#   .venv/Scripts/python pixelize.py --size 64  # sprite size (default 64)
import argparse
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
RAW = HERE / "out" / "raw"
PX = HERE / "out" / "px"

def key_bg(img, tol=28):
    # sample the 4 corners; anything close to that color goes transparent
    px = img.convert("RGBA")
    data = px.load()
    w, h = px.size
    corners = [data[0, 0], data[w - 1, 0], data[0, h - 1], data[w - 1, h - 1]]
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    for y in range(h):
        for x in range(w):
            r, g, b, a = data[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) < tol * 3:
                data[x, y] = (0, 0, 0, 0)
    return px

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", type=int, default=64)
    ap.add_argument("--colors", type=int, default=24, help="palette size per sprite")
    ap.add_argument("--keep-bg", action="store_true", help="skip background keying")
    args = ap.parse_args()

    PX.mkdir(parents=True, exist_ok=True)
    files = sorted(RAW.glob("*.png"))
    if not files:
        raise SystemExit("out/raw is empty — run gen.py first")

    for f in files:
        img = Image.open(f).convert("RGB")
        # quantize BEFORE downscale so big flat areas vote on the palette
        img = img.quantize(colors=args.colors, method=Image.MEDIANCUT).convert("RGB")
        img = img.resize((args.size, args.size), Image.NEAREST)
        out = img if args.keep_bg else key_bg(img)
        out.save(PX / f.name)
        print(f"{f.name} -> px/{f.name}", flush=True)

    # contact sheet: rows = assets, cols = candidates, shown 2x for judging
    sheet_files = sorted(PX.glob("*.png"))
    ids = sorted({f.stem.rsplit("_", 1)[0] for f in sheet_files})
    cols = max(int(f.stem.rsplit("_", 1)[1]) for f in sheet_files) + 1
    cell = args.size * 2 + 8
    sheet = Image.new("RGBA", (cols * cell + 120, len(ids) * cell), (24, 26, 20, 255))
    from PIL import ImageDraw
    draw = ImageDraw.Draw(sheet)
    for r, aid in enumerate(ids):
        draw.text((4, r * cell + cell // 2 - 6), aid, fill=(200, 180, 120, 255))
        for c in range(cols):
            p = PX / f"{aid}_{c}.png"
            if not p.exists():
                continue
            im = Image.open(p).resize((args.size * 2, args.size * 2), Image.NEAREST)
            sheet.alpha_composite(im, (120 + c * cell, r * cell + 4))
    sheet_path = HERE / "out" / "contact_sheet.png"
    sheet.save(sheet_path)
    print(f"contact sheet -> {sheet_path}", flush=True)

if __name__ == "__main__":
    main()
