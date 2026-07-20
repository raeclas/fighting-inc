# Final extractor: special-boss gear families -> JS entries appended to
# itemdata.js, + enhance-cost report. Name-grouped tiers (immune to chain
# collisions), extended tip parser (cooldown/intRatio/procRate/clones/magicCrit).
import json, re, os, collections

OLD = r"C:\Users\Admin\AppData\Local\Temp\claude\C--Users-Admin-Desktop-My-Stuff-Work-Personal-FightingInc\17173ae5-6721-40ea-b304-07b2c0c9d6f9\scratchpad"
PREV = r"C:\Users\Admin\AppData\Local\Temp\claude\C--Users-Admin-Desktop-My-Stuff-Work-Personal-FightingInc\2312006c-1cf2-4517-83f0-47f65effbfce\scratchpad"
REPO = r"C:\Users\Admin\Desktop\My Stuff\Work\Personal\FightingInc"
j = open(OLD + r"\war3map.j", encoding="utf-8", errors="replace").read()
items = json.load(open(PREV + r"\map-items.json", encoding="utf-8"))
def tocc(s): return str((ord(s[0])<<24)|(ord(s[1])<<16)|(ord(s[2])<<8)|ord(s[3]))

# name -> {plus: item}
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
    grab(r"Skill damage \+?([\d.]+)%", "skillDmg")
    grab(r"Skill cooldown reduced by ([\d.]+)%", "cooldownPct")
    grab(r"intelligence ratio increases by ([\d.]+)%", "intRatioPct")
    grab(r"activation probability increased by ([\d.]+)%", "procRatePct")
    grab(r"Increases clones by (\d+)", "clones", int)
    m = re.search(r"Reduce surrounding defense by ([\d.]+)", t) \
        or re.search(r"([\d.]+) reduction in surrounding enemy defense", t)
    if m: out["defReduce"] = float(m.group(1))
    m = re.search(r"([\d.]+)% chance ([\d.]+)% additional magic critical", t)
    if m: out["magicCritChance"], out["magicCritPct"] = float(m.group(1)), float(m.group(2))
    m = re.search(r"([\d.]+)% chance that intelligence damage increases by an additional ([\d.]+)%", t)
    if m: out["procChance"], out["procMult"] = float(m.group(1)), round(float(m.group(2)) / 100, 4)
    return out

# family enhance cost: chain var for tier-0 id -> finder fn -> condition Rme(p,tier,amt)
def family(base_name):
    # map spells tier-0 pool items "Abyss Fragment X" but tier chains "Abyssal Fragment X"
    g = dict(groups.get(base_name, {}))
    for alt in (base_name.replace("Abyss Fragment", "Abyssal Fragment"),
                base_name.replace("Abyssal Fragment", "Abyss Fragment")):
        if alt != base_name:
            for p, it in groups.get(alt, {}).items():
                g.setdefault(p, it)
    return g

# precompute: finder fn -> chain var it searches; condition fn -> (finder, Rme cost)
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

def enh_cost(g):
    for t0 in (g.get(0), g.get(1)):
        if not t0:
            continue
        cc = tocc(t0["id"])
        for var in re.findall(r"set (\w+)\[\d+\]=\(%s\)" % cc, j):
            if var in finder_cost:
                return finder_cost[var]
    return None

FAMILIES = [
    # (ourId, map name, boss, classOnly)
    ("bernardo_neck",       "Abyss Fragment Necklace",                 "bernardo", None),
    ("bernardo_ring",       "Abyss Fragment Ring",                     "bernardo", None),
    ("bernardo_staff",      "Abyssal Fragment - Staff",                "bernardo", ["overmind"]),
    ("bernardo_gsword",     "Abyssal Fragment - Great Sword",          "bernardo", ["omniblade", "bloodevil", "indra", "vagabond"]),
    ("bernardo_gswords",    "Abyssal Fragment - Great Sword S",        "bernardo", ["striker"]),
    ("bernardo_handcannon", "Abyssal Fragment - Hand Cannon",          "bernardo", ["stormtrooper"]),
    ("bernardo_revolver",   "Abyssal Fragment - Revolver",             "bernardo", ["desperado"]),
    ("bernardo_knuckle",    "Abyssal Fragment - Knuckle",              "bernardo", ["nenempress"]),
    ("bernardo2_staff",     "-Transcendence- Abyss Fragment - Staff",  "bernardo2", None),
    ("bernardo2_ring",      "-Transcendence- Abyss Fragment Ring",     "bernardo2", None),
    ("bernardo2_neck",      "-Transcendence- Abyss Fragment Necklace", "bernardo2", None),
    ("seria_weaponav",      "Weapon Avatar",                           "seria", None),
    ("seria_auraav",        "Aura Avatar",                             "seria", None),
    ("seria_cloneav",       "Clone Rare Avatar Set",                   "seria", None),
    ("lib_weaponav",        "Splendid Weapon Avatar",                  "librarykeeper", None),
    ("lib_cloneav",         "Splendid Clone Rare Avatar Set",          "librarykeeper", None),
    ("lib_auraav",          "Splendid Aura Avatar",                    "librarykeeper", None),
    ("trial_staff",         "-Liberation- Abyss Fragment - Staff",     "trialgiver", None),
    ("trial_ring",          "-Liberation- Abyss Fragment Ring",        "trialgiver", None),
    ("trial_neck",          "-Liberation- Abyss Fragment Necklace",    "trialgiver", None),
]

def js(v):
    return json.dumps(v, separators=(",", ":"))

entries, costs = [], {}
for oid, nm, boss, classOnly in FAMILIES:
    g = family(nm)
    if not g:
        print("MISSING family:", nm); continue
    tiers = [parse_tip(g[p]["tip"]) if p in g else None for p in range(0, max(g) + 1)]
    assert all(t is not None for t in tiers), f"{nm} gap in tiers"
    cost = enh_cost(g)
    costs[oid] = cost
    extra = f', classOnly: {js(classOnly)}' if classOnly else ""
    if cost:
        extra += f", enhCost: {cost}"
    entries.append(f'  {oid}: {{ name: {js(nm)}, boss: {js(boss)}{extra}, tiers: [{",".join(js(t) for t in tiers)}] }},')
    eff = {k for t in tiers for k in t if k not in ("atk", "int")}
    print(f"{oid}: {len(tiers)} tiers, cost={cost}, effects={sorted(eff)}, +max={tiers[-1]}")

block = "\n".join(entries)
path = os.path.join(REPO, "itemdata.js")
src = open(path, encoding="utf-8").read()
MARK = "  // --- special-boss gear (gen_specials2.py) ---\n"
if MARK in src:
    src = re.sub(re.escape(MARK) + r".*?(?=};)", MARK + block + "\n", src, flags=re.S)
else:
    src = src.replace("\n};", "\n" + MARK + block + "\n};")
open(path, "w", encoding="utf-8").write(src)
print("\nitemdata.js updated with", len(entries), "entries")
