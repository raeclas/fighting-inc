# Emits itemdata.js (ES module) from map-itemdata.json, with wiki EN names
# matched by effect kind per boss. Run after gen_itemdata.py.
import json, re

d = json.load(open("map-itemdata.json", encoding="utf-8"))

# wiki EN names per boss, keyed by effect kind
def kind_of(t):  # t = a tier dict (use max tier; some kinds absent at t0)
    if t is None: return "flat"
    if "procMult" in t: return "proc"
    if "critMult" in t: return "crit"
    if "dmgInc" in t: return "dmg"
    if "addDmg" in t or "skillDmg" in t: return "add"
    if "intPct" in t: return "intp"
    if "spdPct" in t: return "spd"
    if "defReduce" in t: return "def"
    if "skillLevels" in t: return "tal"
    return "flat"

WIKI = {  # boss -> kind -> EN name (from wiki-batch*.json)
 "hellparty": {"proc": "Shepherd's Rod", "add": "Shining Intelligence", "dmg": "Superstar Ring", "spd": "Time Traveler's Silver Watch", "crit": "Staff of Wizard"},
 "anton": {"proc": "Savior's Glory - Pole", "add": "Savior's Glory - Staff", "dmg": "Shape of Avarice", "flat": "Source of Avarice", "crit": "Savior's Glory - Spear"},
 "luke": {"proc": "Savior's Glory - Staff", "add": "Pars' Golden Goblet", "dmg": "Rosetta Stone", "def": "Lumen Basilium", "crit": "Savior's Glory - Spear"},
 "harlem": {"proc": "Lotus of Cerulean Magic Flame", "add": "Spacium of Distortion", "dmg": "Jealous Obsession Ring", "crit": "Mercedes"},
 "taibers": {"proc": "Sky's Legacy Staff", "add": "Vessel of Heavens", "dmg": "Samsara: Time of Rebirth", "intp": "Serenity of Life: Harmonic", "crit": "Sky's Legacy Spear"},
 "fiendwar": {"proc": "Cirrostratus: Sky Screen", "add": "Oppressing Ruler Necklace", "dmg": "Wisdom of Futuresight", "intp": "Execution of Justice: Equality", "crit": "Nuri-Endless Life"},
 "prey": {"proc": "Black Sky's Master Staff", "add": "Black Fire: Encroached Sky", "dmg": "Black Bird: Cracking Sky", "crit": "Black Sky's Master Spear"},
 "hyunfindwar": {"crit": "Beauty of Eternal Seasonality Set"},
 "transfrey": {},
 "baekhwa": {"proc": "Luna Benedicto", "add": "Dominating Loop of Darkness", "dmg": "WarGod's Blessed Gemstone", "intp": "All Elemental Crystal", "crit": "Ethereal Spear: Immortal Spirit"},
 "ezra": {"proc": "World Tree Root", "add": "Sea of Feeling Hearts", "dmg": "Fate Rampager", "intp": "Time of Destruction", "crit": "Annihilator"},
 "ezraabyss": {"proc": "★Abyss★ World Tree Root", "add": "★Abyss★ Sea of Feeling Hearts", "dmg": "★Abyss★ Fate Rampager", "intp": "★Abyss★ Time of Destruction", "crit": "★Abyss★ Annihilator"},
 "sirocco": {"proc": "Immaterial Primal Dream: Staff", "add": "Subconscious: Nex's Dreamy Darkness", "dmg": "Immateriality: Nex's Encroached Clothes", "intp": "Phantasm: Nex's Dark Energy", "crit": "Immaterial Primal Dream: Spear"},
 "abysswalker": {"proc": "Staff of Culmination", "add": "Ent Spirit Holy Grail", "dmg": "Ent Spirit Heart", "intp": "Ent Spirit Ring", "crit": "Spear of Culmination"},
 "astaroth": {"proc": "★Immaterial★ Luna Benedicto", "add": "★Immaterial★ Dominating Loop of Darkness", "dmg": "★Immaterial★ WarGod's Blessed Gemstone", "intp": "★Immaterial★ All Elemental Crystal", "crit": "★Immaterial★ Ethereal Spear: Immortal Spirit"},
 "astaroth2": {"proc": "★True Immaterial★ Luna Benedicto", "add": "★True Immaterial★ Dominating Loop of Darkness", "dmg": "★True Immaterial★ WarGod's Blessed Gemstone", "intp": "★True Immaterial★ All Elemental Crystal", "crit": "★True Immaterial★ Ethereal Spear: Immortal Spirit"},
 "tiamat": {"proc": "Despair: Tiamat's Grudge", "add": "Despair: Tiamat's Distrust", "dmg": "Despair: Tiamat's Reproach", "intp": "Despair: Tiamat's Curse", "crit": "Despair: Tiamat's Wrath"},
 "berias": {"proc": "Ruin: Berias' Resentment", "add": "Ruin: Berias' Distrust", "dmg": "Ruin: Berias' Reproach", "intp": "Ruin: Berias' Curse", "crit": "Ruin: Berias' Wrath"},
 "ozma": {"proc": "Vengeance: Ozma's Resentment", "add": "Vengeance: Ozma's Distrust", "dmg": "Vengeance: Ozma's Reproach", "intp": "Vengeance: Ozma's Curse", "crit": "Vengeance: Ozma's Wrath"},
 "queendestroyer": {"proc": "Aspect Devoured Staff", "add": "All or One Magic Box", "dmg": "Lie After Lie", "intp": "Temporal Point of View", "crit": "Aspect Devoured Spear"},
 "spirazzi": {"proc": "Staff of Dying Faith", "add": "Predator: Faded Heartbeat", "dmg": "Predator: Open Wounds", "intp": "Predator: Hunter's Instinct", "crit": "Spear of Dying Faith"},
 "skasa": {"proc": "Frozen Resistance Staff", "add": "Icebloom: Open Petals", "dmg": "Icebloom: Vicious Cold", "intp": "Icebloom: Vast Permafrost", "crit": "Frozen Resistance Spear"},
 "hisma": {"proc": "Berserk Tenacity Staff", "add": "Wrath: Indiscriminate Destruction", "dmg": "Wrath: Frustrated World Domination", "intp": "Wrath: Final Breath", "crit": "Berserk Tenacity Spear"},
 "luton": {},
 "baekhwamyth": {"proc": "Myth Sonorous Battle Roar", "crit": "Myth Excruciating Tragedy"},
 "hundredflower_alias": {},
}
SINGLES = {"talisman": "Talisman", "transtalisman": "-Transcendence- Talisman", "brillianttalisman": None,
           "shininginsignia": "Shining Insignia", "splendidtalisman": "Brilliant Talisman",
           "shop_rafaros": "Rafaros Staff", "shop_darkness": "Defined Darkness",
           "shop_liberation": "Liberation Staff", "shop_lumen": "Lumen Caligo"}

out = {}
for boss, arr in d.items():
    if boss in SINGLES:
        nm = SINGLES[boss]
        if nm is None: continue
        it = arr[0]
        key = boss.replace("shop_", "") if boss.startswith("shop_") else ("insignia" if boss == "shininginsignia" else ("brtalisman" if boss == "splendidtalisman" else boss))
        out[key] = {"name": nm, "boss": None, "tiers": it["tiers"]}
        continue
    seen = {}
    for it in arr:
        k = kind_of(it["tiers"][-1])
        n = seen.get(k, 0); seen[k] = n + 1
        kk = k if n == 0 else f"{k}{n+1}"
        en = WIKI.get(boss, {}).get(k)
        name = en or re.sub(r"\s+", " ", it["name"]).strip()
        out[f"{boss}_{kk}"] = {"name": name, "boss": boss, "tiers": it["tiers"]}

lines = ["// itemdata.js — GENERATED from the decompiled map (war3map.w3t tier chains,",
         "// pools from the JASS Epx dispatch). Names: wiki EN where known, else map MT.",
         "// Regenerate with scratchpad gen_itemdata.py + gen_itemjs.py. Do not hand-edit.",
         "export const ITEM_DATA = {"]
for k, v in out.items():
    tiers = json.dumps(v["tiers"], separators=(",", ":"), ensure_ascii=False)
    lines.append(f"  {k}: {{ name: {json.dumps(v['name'], ensure_ascii=False)}, boss: {json.dumps(v['boss'])}, tiers: {tiers} }},")
lines.append("};\n")
open(r"C:\Users\Admin\Desktop\My Stuff\Work\Personal\FightingInc\itemdata.js", "w", encoding="utf-8").write("\n".join(lines))
print("wrote itemdata.js:", len(out), "items")
kinds = {}
for k in out: kinds.setdefault(k.split("_")[-1] if "_" in k else "single", 0)
print(sorted(out)[:10])
