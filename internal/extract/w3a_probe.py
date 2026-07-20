# Parse war3map.w3a (extended object format: mods carry level+data ints) and
# dump tooltips for Hekate/Ashtarte ability names.
import os, struct, re, sys, json
sys.stdout.reconfigure(errors="replace")
OLD = r"C:\Users\Admin\AppData\Local\Temp\claude\C--Users-Admin-Desktop-My-Stuff-Work-Personal-FightingInc\17173ae5-6721-40ea-b304-07b2c0c9d6f9\scratchpad"
EX = os.path.join(OLD, "extracted")

def parse_wts(path):
    txt = open(path, "rb").read().decode("utf-8", "replace")
    out, i = {}, 0
    while True:
        k = txt.find("STRING ", i)
        if k == -1: break
        jj = txt.find("{", k); e = txt.find("}", jj)
        try: num = int(txt[k+7:jj].strip())
        except ValueError: i = k + 7; continue
        out[num] = txt[jj+1:e].strip()
        i = e + 1
    return out
wts = parse_wts(os.path.join(EX, "war3map.wts"))
def res(v):
    if isinstance(v, str) and v.startswith("TRIGSTR_"):
        try: return wts.get(int(v[8:]), v)
        except ValueError: return v
    return v

def parse_ext(path):
    data = open(path, "rb").read()
    off = 0
    version, = struct.unpack_from("<I", data, off); off += 4
    entries = []
    for _ in range(2):
        count, = struct.unpack_from("<I", data, off); off += 4
        for _ in range(count):
            origid = data[off:off+4].decode("latin1"); off += 4
            newid = data[off:off+4].decode("latin1"); off += 4
            if version >= 3: off += 4
            nmods, = struct.unpack_from("<I", data, off); off += 4
            mods = []
            for _ in range(nmods):
                modid = data[off:off+4].decode("latin1"); off += 4
                vtype, = struct.unpack_from("<I", data, off); off += 4
                lvl, = struct.unpack_from("<I", data, off); off += 4
                off += 4  # data pointer
                if vtype == 0: val, = struct.unpack_from("<i", data, off); off += 4
                elif vtype in (1, 2): val, = struct.unpack_from("<f", data, off); off += 4
                else:
                    end = data.index(b"\0", off)
                    val = data[off:end].decode("latin1"); off = end + 1
                off += 4
                mods.append((modid, lvl, val))
            entries.append((origid, newid, mods))
    return version, entries

ver, abis = parse_ext(os.path.join(EX, "war3map.w3a"))
print("w3a version", ver, "entries", len(abis))

PATS = ["Hecate", "Hekate", "Ashtarte", "Ashtoreth", "Astarte"]
clean = lambda s: re.sub(r"\|c[0-9A-Fa-f]{8}|\|C[0-9A-Fa-f]{8}|\|r|\|R|\|n", " ", str(s))
out = open("w3a_hekate_ashtarte.txt", "w", encoding="utf-8")
found = 0
for origid, newid, mods in abis:
    name = ""
    tips = {}
    for mid, lvl, val in mods:
        if mid == "anam": name = clean(res(val)).strip()
        if mid == "aub1": tips[lvl] = clean(res(val)).strip()
    if name and any(p.lower() in name.lower() for p in PATS):
        found += 1
        out.write("\n== %r orig %s\n" % (name, origid))
        for lvl in sorted(tips):
            out.write("   L%s: %s\n" % (lvl, tips[lvl][:600]))
out.close()
print("matched", found, "-> w3a_hekate_ashtarte.txt")
