// bestiary.js
// Monster book. Entries come from zones + bosses; kill counts live in
// gameState.kills. Each milestone reached grants a permanent global
// damage bonus — collection is power.
import { zones } from "./zones.js";
import { bosses } from "./bosses.js";

export const MILESTONES = [10, 100, 1000];
export const BONUS_PER_MILESTONE = 0.005; // +0.5% damage each

export function bestiaryEntries(state) {
  return [
    ...zones.map(z => ({ key: z.id, name: z.mobName, kills: state.kills[z.id] || 0, boss: false })),
    ...bosses.map(b => ({ key: b.id, name: b.name, kills: state.kills[b.id] || 0, boss: true })),
  ];
}

export function bestiaryBonus(state) {
  let reached = 0;
  for (const e of bestiaryEntries(state)) {
    for (const m of MILESTONES) if (e.kills >= m) reached++;
  }
  return reached * BONUS_PER_MILESTONE;
}
