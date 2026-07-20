# Batch-2 gear extractor: the 7 remaining Abyssal Fragment class weapons
# (name-grouped) + the 5 ★Fusion★ Formless-Sirocco drop families (chain-rooted
# via JASS pool vars GR/hR/HR/jR/JR — their display names drift per tier).
# Appends a second generated block to itemdata.js.
import json, re, os, collections

OLD = r"C:\Users\Admin\AppData\Local\Temp\claude\C--Users-Admin-Desktop-My-Stuff-Work-Personal-FightingInc\17173ae5-6721-40ea-b304-07b2c0c9d6f9\scratchpad"
PREV = r"C:\Users\Admin\AppData\Local\Temp\claude\C--Users-Admin-Desktop-My-Stuff-Work-Personal-FightingInc\2312006c-1cf2-4517-83f0-47f65effbfce\scratchpad"
REPO = r"C:\Users\Admin\Desktop\My Stuff\Work\Personal\FightingInc"
j = open(OLD + r"\war3map.j", encoding="utf-8", errors="replace").read()
items = json.load(open(PREV + r"\map-items.json", encoding="utf-8"))
byid = {it["id"]: it for it in items}
def tocc(s): return str((ord(s[0])<<24)|(ord(s[1])<<16)|(ord(s[2])<<8)|ord(s[3]))
def fourcc(n): return bytes([(n>>24)&255,(n>>16)&255,(n>>8)&255,n&255]).decode("latin1")

# tier chains + enhance-cost tables (same technique as gen_specials2.py)
chains = collections.defaultdict(dict)
for var, idx, num in re.findall(r"set (\w+)\[(\d+)\]=\((\d+)\)", j):
    iid = fourcc(int(num))
    if iid in byid:
        chains[var][int(idx)] = iid
finder_var = {}
for m in re.finditer(r"function (\w+) takes nothing returns integer.{0,600}?A3e==(\w+)\[j\]", j, re.S):
    finder_var[m.group(1)] = m.group(2)
finder_cost = {}
for m in re.finditer(r"function \w+ takes nothing returns boolean(.{0,700}?)endfunction", j, re.S):
    body = m.group(1)
    fm = re.search(r"(\w+)\(\)>=0", body)
    cm = re.search(r"Rme\(p,(\d+),(\d+)\)", body)
    if fm and cm and fm.group(1) in finder_var:
        finder_cost[finder_var[fm.group(1)]] = int(cm.group(2)) * (10 ** (9 * int(cm.group(1))))

groups = collections.defaultdict(dict)
for it in items:
    m = re.search(r"\s*\+(\d+)$", it["name"])
    base = re.sub(r"\s*\+\d+$", "", it["name"])
    groups[base][int(m.group(1)) if m else 0] = it

def parse_tip(tip):
    t = tip.replace(",", "")
    out = {}
    def grab(pat, key, cast=float, flags=0):
        m = re.search(pat, t, flags)
        if m: out[key] = cast(m.group(1))
    grab(r"Attack power \+?\s*(\d+)", "atk", int)
    grab(r"Intelligence \+\s*(\d+)", "int", int)
    grab(r"Increase attack power by ([\d.]+)%", "dmgInc")
    grab(r"Additional damage \+?([\d.]+)%", "addDmg")
    grab(r"Skill damage \+?([\d.]+)%", "skillDmg")
    grab(r"Skill cooldown reduced by ([\d.]+)%", "cooldownPct")
    grab(r"intelligence ratio increases by ([\d.]+)%", "intRatioPct")
    grab(r"activation probability increased by ([\d.]+)%", "procRatePct")
    grab(r"success rate of all skills by ([\d.]+)%", "gsRatePct")
    grab(r"buff values[^%\n]*?increase by ([\d.]+)%", "buffValuePct", flags=re.I)
    m = re.search(r"attack speed increases by an additional ([\d.]+)%", t)
    if m: out["skillSpdPct"] = float(m.group(1))
    grab(r"[Ii]ncreases item intelligence by ([\d.]+)%", "intPct")
    m = re.search(r"(\d+)% chance to deal ([\d.]+)x Intelligence damage", t)
    if m: out["procChance"], out["procMult"] = int(m.group(1)), float(m.group(2))
    m = re.search(r"(\d+)% chance of ([\d.]+)x critical hit", t) \
        or re.search(r"(\d+)% chance of critical ([\d.]+)x", t)
    if m: out["critChance"], out["critMult"] = int(m.group(1)), float(m.group(2))
    return out

def js(v): return json.dumps(v, separators=(",", ":"))

entries = []
def emit(oid, name, boss, tiers, classOnly, cost):
    extra = f", classOnly: {js(classOnly)}" if classOnly else ""
    if cost: extra += f", enhCost: {cost}"
    entries.append(f'  {oid}: {{ name: {js(name)}, boss: {js(boss)}{extra}, tiers: [{",".join(js(t) for t in tiers)}] }},')
    eff = sorted({k for t in tiers for k in t if k not in ("atk", "int")})
    print(f"{oid}: {len(tiers)} tiers cost={cost} effects={eff} max={tiers[-1]}")

# --- 7 class weapons (name-grouped; Abyss/Abyssal spelling merge) ---
WEAPONS = [
    ("bernardo_spear",  "Abyssal Fragment - Spear",   ["ashtarte"]),
    ("bernardo_brushs", "Abyssal Fragment - Brush S", ["hekate"]),
    ("bernardo_brush",  "Abyssal Fragment - Brush",   ["geniewiz"]),
    ("bernardo_rosary", "Abyssal Fragment - Rosary",  ["divineress"]),
    ("bernardo_blade",  "Abyssal Fragment - Blade",   ["spectre"]),
    ("bernardo_wand",   "Abyssal Fragment - Wand",    ["necromancer"]),
    ("bernardo_cross",  "Abyssal Fragment - Cross",   ["crusader"]),
]
def family(nm):
    g = dict(groups.get(nm, {}))
    for alt in (nm.replace("Abyssal", "Abyss"), nm.replace("Abyss ", "Abyssal ")):
        for p, it in groups.get(alt, {}).items():
            g.setdefault(p, it)
    return g
def cost_of(g):
    for t0 in (g.get(0), g.get(1)):
        if not t0: continue
        cc = tocc(t0["id"])
        for var in re.findall(r"set (\w+)\[\d+\]=\(%s\)" % cc, j):
            if var in finder_cost: return finder_cost[var]
    return None
for oid, nm, classOnly in WEAPONS:
    g = family(nm)
    if not g:
        print("MISSING weapon family:", nm); continue
    tiers = [parse_tip(g[p]["tip"]) if p in g else None for p in range(0, max(g) + 1)]
    assert all(tiers), f"{nm} tier gap"
    emit(oid, nm, "bernardo", tiers, classOnly, cost_of(g))

# --- 5 Fusion families (chain-rooted from tR member vars) ---
FUSION = [
    ("fusion_chang", "GR", "★Fusion★ Intangible Dream: Chang"),
    ("fusion_staff", "hR", "★Fusion★ Intangible Dream: Staff"),
    ("fusion_aura",  "HR", "★Fusion★ Nex's Black Aura"),
    ("fusion_garb",  "jR", "★Fusion★ Nex's Encroached Clothing"),
    ("fusion_dark",  "JR", "★Fusion★ Nex's Dreamy Darkness"),
]
for oid, var, name in FUSION:
    ch = chains.get(var, {})
    if 0 not in ch:
        print("MISSING fusion chain:", var); continue
    tiers = [parse_tip(byid[ch[p]]["tip"]) if p in ch and ch[p] in byid else None for p in range(0, max(ch) + 1)]
    assert all(tiers), f"{var} tier gap"
    cost = None
    for v2 in re.findall(r"set (\w+)\[\d+\]=\(%s\)" % tocc(ch[0]), j):
        if v2 in finder_cost: cost = finder_cost[v2]; break
    emit(oid, name, "abyssirocco", tiers, None, cost)

block = "\n".join(entries)
path = os.path.join(REPO, "itemdata.js")
src = open(path, encoding="utf-8").read()
MARK = "  // --- batch-2 gear (gen_batch2.py) ---\n"
if MARK in src:
    src = re.sub(re.escape(MARK) + r".*?(?=};)", MARK + block + "\n", src, flags=re.S)
else:
    src = src.replace("\n};", "\n" + MARK + block + "\n};")
open(path, "w", encoding="utf-8").write(src)
print("\nitemdata.js updated with", len(entries), "entries")
