# pick.py — promote chosen candidates into the game's assets/.
# Usage: .venv/Scripts/python pick.py kiln=2 slag=0 rift=3 ...
# Copies out/px/<id>_<n>.png -> ../../assets/<id>.png (static, 64x64).
# Remember: sprites.js SHEETS entry for that id must say frames: 1.
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).parent
PX = HERE / "out" / "px"
ASSETS = HERE.parent.parent / "assets"

def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: pick.py id=candidate [id=candidate ...]")
    for arg in sys.argv[1:]:
        aid, _, n = arg.partition("=")
        src = PX / f"{aid}_{n}.png"
        if not src.exists():
            raise SystemExit(f"missing {src}")
        dst = ASSETS / f"{aid}.png"
        shutil.copyfile(src, dst)
        print(f"{src.name} -> {dst}")

if __name__ == "__main__":
    main()
