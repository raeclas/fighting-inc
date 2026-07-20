// rivals.js — the fake lobby. Enhancement Slave RPG's satire needs witnesses:
// other slaves grinding beside you, failing in public, occasionally hitting
// the miracle roll. These are simulated NPCs (never presented as real
// players): each has a fixed "talent" multiplier against your account's best,
// so the board stays aspirational at the top and comfortable at the bottom.
// Announcements are flavor only — rivals never touch drops, damage, or the
// economy, so the sim never sees them.

// name, classId, talent (× your best INT), plusOff (vs your best plus)
export const RIVAL_ROSTER = [
  { name: "GodOfEnhance",   classId: "desperado",    talent: 1.35, plusOff: +2 },
  { name: "Slave_Kim",      classId: "striker",      talent: 1.10, plusOff: +1 },
  { name: "PlusTwentyDream", classId: "overmind",    talent: 0.85, plusOff: 0 },
  { name: "HammerTime",     classId: "bloodevil",    talent: 0.70, plusOff: 0 },
  { name: "Baeksu9000",     classId: "nenempress",   talent: 0.55, plusOff: -1 },
  { name: "IntGoblin",      classId: "geniewiz",     talent: 0.40, plusOff: -2 },
  { name: "RerollAndy",     classId: "vagabond",     talent: 0.25, plusOff: -3 },
  { name: "CopperlessKim",  classId: "necromancer",  talent: 0.12, plusOff: -4 },
];

export const ANNOUNCE_MIN_MS = 60_000;
export const ANNOUNCE_MAX_MS = 150_000;

export function defaultRivalState() {
  return { nextAnnounceAt: 0 };
}

// account benchmarks the lobby scales against
export function accountBest(state) {
  let int = 0, plus = 0;
  for (const c of state.characters ?? []) {
    int = Math.max(int, c.int || 0);
    for (const eq of [...(c.equipment ?? []), ...(c.specialBag ?? [])]) {
      if (eq) plus = Math.max(plus, eq.plus);
    }
  }
  return { int, plus };
}

// live board rows (derived every call — nothing to persist or drift)
export function rivalRows(state) {
  const best = accountBest(state);
  return RIVAL_ROSTER.map(r => ({
    name: r.name,
    classId: r.classId,
    int: Math.max(10, Math.round(best.int * r.talent)),
    topPlus: Math.max(0, Math.min(20, best.plus + r.plusOff)),
  }));
}

// One lobby announcement. rng injectable for tests.
// Returns { text, kind } — kind is "plain" | "fanfare".
export function rollAnnouncement(state, rng = Math.random) {
  const rows = rivalRows(state);
  const r = rows[Math.floor(rng() * rows.length)];
  const attempt = Math.min(20, r.topPlus + 1);
  const roll = rng();
  if (roll < 0.55) {
    const flavor = ["Of course it failed.", "The lobby laughs.", "Copper well spent.", "Again."];
    return { kind: "plain", text: `[Lobby] ${r.name}'s +${attempt} enhancement FAILED. ${flavor[Math.floor(rng() * flavor.length)]}` };
  }
  if (roll < 0.80) {
    return { kind: "plain", text: `[Lobby] ${r.name} enhanced to +${attempt}.` };
  }
  if (roll < 0.92) {
    return { kind: "plain", text: `[Lobby] ${r.name} is farming laps. The grind never stops.` };
  }
  const big = Math.max(17, attempt);
  return { kind: "fanfare", text: `[Lobby] ★ ${r.name} hit +${big}!! The whole lobby saw it. ★` };
}

export function scheduleNext(now, rng = Math.random) {
  return now + ANNOUNCE_MIN_MS + rng() * (ANNOUNCE_MAX_MS - ANNOUNCE_MIN_MS);
}

// Rivals react to YOUR moments — the identity payoff of having witnesses.
// kind: "plus" (detail = the plus reached) | "firstkill" (detail = boss name)
export function rollReaction(kind, detail, rng = Math.random) {
  const r = RIVAL_ROSTER[Math.floor(rng() * RIVAL_ROSTER.length)];
  const lines = kind === "plus" ? [
    `[Lobby] ${r.name}: "+${detail}?? That was luck and everyone knows it."`,
    `[Lobby] ${r.name} inspects your +${detail} in bitter silence.`,
    `[Lobby] ${r.name}: "sell me that +${detail}. name a price."`,
    `[Lobby] ${r.name} screenshots your +${detail} for "research".`,
  ] : [
    `[Lobby] ${r.name}: "you killed ${detail} before me? unsubscribe."`,
    `[Lobby] ${r.name} pretends not to be impressed by the ${detail} kill.`,
    `[Lobby] ${r.name}: "${detail}? cleared it ages ago." (they did not)`,
  ];
  return lines[Math.floor(rng() * lines.length)];
}
