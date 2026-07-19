// items.js
// Shop item definitions, per-plus stat scaling, and equipment stat aggregation.
// stat "atk" = flat attack, stacks. stat "atkspd" = % attack speed, does NOT stack (best one counts).
export const items = [
  // shop
  { id: "rafaros",    name: "Rafaros Staff",    shop: true, cost: 1,     enhCost: 21,   stat: "atk",    base: 1,  per20: 500 },
  { id: "darkness",   name: "Defined Darkness", shop: true, cost: 500,   enhCost: 66,   stat: "atk",    base: 30, per20: 950 },
  { id: "liberation", name: "Liberation Staff", shop: true, cost: 5000,  enhCost: 450,  stat: "atk",    base: 80, per20: 1600 },
  { id: "lumen",      name: "Lumen Caligo",     shop: true, cost: 10000, enhCost: 3900, stat: "atkspd", base: 30, per20: 205 },

  // boss drops
  { id: "rosetta",      name: "Rosetta Stone",              enhCost: 10_000,    stat: "atk",    base: 300,    per20: 4_000 },
  { id: "partyhat",     name: "Party Hat of Despair",       enhCost: 10_000,    stat: "atk",    base: 200,    per20: 3_000 },
  { id: "kneecap",      name: "Anton's Left Kneecap",       enhCost: 50_000,    stat: "atk",    base: 800,    per20: 12_000 },
  { id: "refinedlumen", name: "Refined Lumen Caligo",       enhCost: 50_000,    stat: "atkspd", base: 60,     per20: 300 },
  { id: "rosetta2",     name: "Rosetta Stone 2: Rosettier", enhCost: 250_000,   stat: "atk",    base: 3_000,  per20: 50_000 },
  { id: "globetrophy",  name: "Harlem Globetrophy",         enhCost: 1_000_000, stat: "atk",    base: 12_000, per20: 200_000 },
];

export const getItem = id => items.find(i => i.id === id);

// Quadratic ramp: +20 is a drastic spike, early plusses feel small.
export function statValue(def, plus) {
  return Math.round(def.base + (def.per20 - def.base) * (plus / 20) ** 2);
}

// equipment: array of ({itemId, plus} | null)
export function aggregate(equipment) {
  let atk = 0, spdPct = 0;
  for (const eq of equipment) {
    if (!eq) continue;
    const def = getItem(eq.itemId);
    const v = statValue(def, eq.plus);
    if (def.stat === "atk") atk += v;
    else if (def.stat === "atkspd") spdPct = Math.max(spdPct, v);
  }
  return { atk, spdPct };
}
