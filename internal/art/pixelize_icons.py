# pixelize_icons.py — icons_raw/*.png -> ../../assets/skills/<id>.png
# 32px, 16-color quantize, background KEPT (buttons want the dark square).
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
RAW = HERE / "out" / "icons_raw"
DST = HERE.parent.parent / "assets" / "skills"

DST.mkdir(parents=True, exist_ok=True)
for f in sorted(RAW.glob("*.png")):
    img = Image.open(f).convert("RGB")
    img = img.quantize(colors=16, method=Image.MEDIANCUT).convert("RGB")
    img = img.resize((32, 32), Image.NEAREST)
    img.save(DST / f.name)
    print(f.name, flush=True)
print(f"-> {DST}", flush=True)
