# Generates per-tier item data (atk/int/effect arrays, +0..+20) for every boss pool,
# from war3map.w3t tooltips. Pool membership from JASS Epx dispatch (map-pools.json
# + indirect second-level arrays). Output: map-itemdata.json
import json, re, collections

OLD = r"C:\Users\Admin\AppData\Local\Temp\claude\C--Users-Admin-Desktop-My-Stuff-Work-Personal-FightingInc\17173ae5-6721-40ea-b304-07b2c0c9d6f9\scratchpad"
j = open(OLD + r"\war3map.j", encoding="utf-8", errors="replace").read()
items = json.load(open("map-items.json", encoding="utf-8"))
byid = {it["id"]: it for it in items}
def fourcc(n): return bytes([(n>>24)&255,(n>>16)&255,(n>>8)&255,n&255]).decode("latin1")

# JASS tier chains: every enhanceable item has a var with set VAR[i]=(itemid),
# i = plus level. Build var -> {idx: itemid}; chains keyed by tier-0 id.
chains = collections.defaultdict(dict)
for var, idx, num in re.findall(r"set (\w+)\[(\d+)\]=\((\d+)\)", j):
    iid = fourcc(int(num))
    if iid in byid:
        chains[var][int(idx)] = iid
chain_by_zero = {}
for var, tiers in chains.items():
    if 0 in tiers and len(tiers) > 5:
        chain_by_zero[tiers[0]] = tiers

# direct pools: re-decode as IDs (map-pools.json stored names)
pools = {}
for v in set(re.findall(r"Epx\(p,MJe,[^,]+,[^,]+,[^,]+,[^,]+,\d+,(\w+)\[", j)):
    pools[v] = [fourcc(int(n)) for _, n in re.findall(r"set %s\[(\d+)\]=\((\d+)\)" % re.escape(v), j) if fourcc(int(n)) in byid]
# vO (Mandarin Myth rares) sits in the rare-arg slot, not the pool slot
pools["vO"] = [fourcc(int(n)) for _, n in re.findall(r"set vO\[(\d+)\]=\((\d+)\)", j) if fourcc(int(n)) in byid]
# indirect pools: set POOL[i]=xx[0] -> tier-0 id of chain xx
for v in ["RI","cI","PI","zI","XA","CA","GA","PA","UA","wA","oI","tR"]:
    refs = re.findall(r"set %s\[\d+\]=(\w+)\[0\]" % v, j)
    pools[v] = [chains[r][0] for r in refs if 0 in chains.get(r, {})]

BOSS_POOL = {  # our bossId -> JASS pool var
  "hellparty": "pa", "anton": "qa", "luke": "ya", "harlem": "iV",
  "taibers": "cV", "fiendwar": "hV", "prey": "gE", "hyunfindwar": "vX",
  "transfrey": "CX", "baekhwa": "yX", "ezra": "CO", "ezraabyss": "mO",
  "sirocco": "UO", "abysswalker": "CA", "astaroth": "oI", "astaroth2": "RI",
  "tiamat": "cI", "berias": "PI", "ozma": "zI", "queendestroyer": "XA",
  "spirazzi": "GA", "baekhwamyth": "vO", "skasa": "PA", "hisma": "UA", "luton": "wA",
}

def parse_tip(tip):
    t = tip.replace(",", "")
    out = {}
    m = re.search(r"Attack power \+?\s*(\d+)", t)
    if m: out["atk"] = int(m.group(1))
    m = re.search(r"Intelligence \+\s*(\d+)", t)
    if m: out["int"] = int(m.group(1))
    m = re.search(r"Increase attack power by ([\d.]+)%", t)
    if m: out["dmgInc"] = float(m.group(1))
    m = re.search(r"Additional damage \+?([\d.]+)%", t)
    if m: out["addDmg"] = float(m.group(1))
    m = re.search(r"Skill damage \+?([\d.]+)%", t)
    if m: out["skillDmg"] = float(m.group(1))
    m = re.search(r"(\d+)% chance to deal ([\d.]+)x Intelligence damage", t) \
        or re.search(r"(\d+)% chance to deal \(intelligence x ([\d.]+)\)", t, re.I)
    if m: out["procChance"], out["procMult"] = int(m.group(1)), float(m.group(2))
    m = re.search(r"(\d+)%[^\n]*?critical[^\n]*?([\d.]+)\s*x", t, re.I) \
        or re.search(r"(\d+)%[^\n]*?([\d.]+)\s*x[^\n]*?critical", t, re.I)
    if m: out["critChance"], out["critMult"] = int(m.group(1)), float(m.group(2))
    m = re.search(r"[Ii]ntelligence[^\n]*?increase[sd]? by ([\d.]+)%|[Ii]ncreases? item intelligence by ([\d.]+)%", t)
    if m: out["intPct"] = float(m.group(1) or m.group(2))
    m = re.search(r"[Aa]ttack speed[^\n]*?([\d.]+)%", t)
    if m: out["spdPct"] = float(m.group(1))
    m = re.search(r"reduces the defense of surrounding enemies by (\d+)", t, re.I)
    if m: out["defReduce"] = int(m.group(1))
    m = re.search(r"[Ss]kill level[s]?[^\n]*?\+?(\d+)|increases? the level of[^\n]*?by (\d+)", t)
    if m and "icket" not in t: out["skillLevels"] = int(m.group(1) or m.group(2) or 0)
    return out

out = {}
for boss, var in BOSS_POOL.items():
    out[boss] = []
    for iid in pools.get(var, []):
        tiers = chain_by_zero.get(iid)
        base = re.sub(r"\s*\+\d+$", "", byid[iid]["name"])
        if not tiers:
            out[boss].append({"name": base, "error": "no chain"})
            continue
        arr = []
        for plus in range(0, max(tiers) + 1):
            tid = tiers.get(plus)
            arr.append(parse_tip(byid[tid]["tip"]) if tid and tid in byid else None)
        out[boss].append({"name": base, "tiers": arr})

# talismans + insignia: group by exact base name (names ARE consistent here)
groups = collections.defaultdict(dict)
for it in items:
    m = re.search(r"\s*\+(\d+)$", it["name"])
    base = re.sub(r"\s*\+\d+$", "", it["name"])
    groups[base][int(m.group(1)) if m else 0] = it
for nm, key in [("Talisman", "talisman"), ("-Transcendence- Talisman", "transtalisman"), ("Brilliant Talisman", "brillianttalisman"), ("Shining Badge", "shininginsignia"), ("Splendid Talisman", "splendidtalisman"),
                ("Riparos Staff", "shop_rafaros"), ("Define Darkness", "shop_darkness"), ("Liberation Staff", "shop_liberation"), ("Lumen Caligo", "shop_lumen")]:
    tiers = groups.get(nm)
    if tiers:
        out[key] = [{"name": nm, "tiers": [parse_tip(tiers[p]["tip"]) if p in tiers else None for p in range(0, max(tiers)+1)]}]

json.dump(out, open("map-itemdata.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)
for boss, arr in out.items():
    if isinstance(arr, list):
        print(boss, [(a["name"][:30], len(a.get("tiers", []))) for a in arr])
