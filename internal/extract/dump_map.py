"""Dump w3t items (per-tier), w3u hero growth, misc constants, JASS drops.
Reuses parse functions from the old session's parse_w3u.py (same formats)."""
import os, sys, struct, json, re

OLD = r"C:\Users\Admin\AppData\Local\Temp\claude\C--Users-Admin-Desktop-My-Stuff-Work-Personal-FightingInc\17173ae5-6721-40ea-b304-07b2c0c9d6f9\scratchpad"
EX = os.path.join(OLD, "extracted")
HERE = os.path.dirname(os.path.abspath(__file__))

def rid(b): return b.decode("latin1")

def parse_wts(path):
    txt = open(path, "rb").read().decode("utf-8", "replace")
    out, i = {}, 0
    while True:
        k = txt.find("STRING ", i)
        if k == -1: break
        j = txt.find("{", k); e = txt.find("}", j)
        try: num = int(txt[k+7:j].strip())
        except ValueError: i = k + 7; continue
        out[num] = txt[j+1:e].strip()
        i = e + 1
    return out

def resolve(val, wts):
    if isinstance(val, str) and val.startswith("TRIGSTR_"):
        try: return wts.get(int(val[8:]), val)
        except ValueError: return val
    return val

def parse_obj(path):
    data = open(path, "rb").read()
    off = 0
    version, = struct.unpack_from("<I", data, off); off += 4
    entries = []
    for _ in range(2):
        count, = struct.unpack_from("<I", data, off); off += 4
        for _ in range(count):
            origid = rid(data[off:off+4]); off += 4
            newid = rid(data[off:off+4]); off += 4
            if version >= 3: off += 4
            nmods, = struct.unpack_from("<I", data, off); off += 4
            mods = {}
            for _ in range(nmods):
                modid = rid(data[off:off+4]); off += 4
                vtype, = struct.unpack_from("<I", data, off); off += 4
                if vtype == 0: val, = struct.unpack_from("<i", data, off); off += 4
                elif vtype in (1, 2): val, = struct.unpack_from("<f", data, off); off += 4
                else:
                    end = data.index(b"\0", off)
                    val = data[off:end].decode("latin1"); off = end + 1
                off += 4
                mods[modid] = val
            entries.append((origid, newid, mods))
    return version, entries

wts = parse_wts(os.path.join(EX, "war3map.wts"))

if sys.argv[1] == "sample":
    _, items = parse_obj(os.path.join(EX, "war3map.w3t"))
    print(len(items), "item entries")
    for origid, newid, m in items[:3] + items[1000:1002]:
        print("==", origid, newid)
        for k, v in m.items():
            rv = resolve(v, wts)
            print("  ", k, repr(rv)[:150])

elif sys.argv[1] == "heroes":
    _, units = parse_obj(os.path.join(EX, "war3map.w3u"))
    out = []
    for origid, newid, m in units:
        if not any(k in m for k in ("ustp", "uagp", "uinp", "ustr", "uagi", "uini")):
            continue
        out.append({
            "origid": origid, "newid": newid,
            "name": re.sub(r"\|C[0-9A-Fa-f]{8}|\|r", "", str(resolve(m.get("unam", ""), wts))).strip(),
            "pri": m.get("upra"), "str": m.get("ustr"), "agi": m.get("uagi"), "int": m.get("uini"),
            "strPlus": m.get("ustp"), "agiPlus": m.get("uagp"), "intPlus": m.get("uinp"),
            "hp": m.get("uhpm"), "dmgBase": m.get("ua1b"), "dmgDice": m.get("ua1d"), "dmgSides": m.get("ua1s"),
            "cooldown": m.get("ua1c"), "level": m.get("ulev"),
        })
    json.dump(out, open(os.path.join(HERE, "map-heroes.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("wrote", len(out), "hero-like units")

elif sys.argv[1] == "items":
    _, items = parse_obj(os.path.join(EX, "war3map.w3t"))
    out = []
    for origid, newid, m in items:
        name = resolve(m.get("unam", ""), wts)
        tip = resolve(m.get("utub", ""), wts)
        if not name: continue
        clean = re.sub(r"\|c[0-9A-Fa-f]{8}|\|C[0-9A-Fa-f]{8}|\|r|\|R", "", str(name)).strip()
        tipc = re.sub(r"\|c[0-9A-Fa-f]{8}|\|C[0-9A-Fa-f]{8}|\|r|\|R", "", str(tip)).replace("|n", "\n").strip()
        out.append({"id": newid or origid, "orig": origid, "name": clean, "tip": tipc,
                    "lvl": m.get("ilev"), "gold": m.get("igol"), "abil": m.get("iabi")})
    json.dump(out, open(os.path.join(HERE, "map-items.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("wrote", len(out), "items")
