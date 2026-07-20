// battle.js
// Canvas battle scene. The sim pushes lightweight events (it may resolve
// many attacks per tick); this layer aggregates them into representative
// animation — hero lunge, mob flash/shake, floating damage numbers, HP bar.
import { getSheet } from "./sprites.js";
import { fmt as fmtNum } from "./format.js";
import { getClass } from "./classes.js";

const W = 560, H = 280;
// bigger tap-targets on touch devices
const HIT_R = matchMedia("(pointer: coarse)").matches ? 34 : 24;
const HERO = { x: 110, y: 215 };
const MOB = { x: 400, y: 215 };
const SPRITE_DRAW = 64;

let canvas = null, ctx = null, tooltip = null;

const events = [];
export function pushBattleEvent(e) { events.push(e); }

const floaters = []; // {x, y, alpha, text, color, sizePx}
let shakeUntil = 0;  // boss-kill screen shake deadline
let attackUntil = 0;
let flashUntil = 0;

// last-rendered mob hit-boxes for hover/tap tooltips: {m, x, y, r}
let hitboxes = [];

// deterministic terrain patches (x, y, rx, ry) — screenshot-style mottled green
const PATCHES = [
  [70, 60, 50, 18], [230, 120, 70, 22], [430, 70, 55, 16], [150, 200, 60, 20],
  [350, 240, 80, 24], [500, 180, 45, 15], [40, 150, 40, 14], [300, 30, 45, 13],
];

function showTooltip(mob, clientX, clientY) {
  const wrap = canvas.parentElement;
  const wrapRect = wrap.getBoundingClientRect();
  tooltip.innerHTML = `<strong>${mob.name}</strong><br>` +
    `HP ${fmtNum(Math.max(0, mob.hp))} / ${fmtNum(mob.maxHp)}<br>DEF ${fmtNum(mob.defense)}`;
  tooltip.style.display = "block";
  tooltip.style.left = `${Math.min(clientX - wrapRect.left + 14, wrapRect.width - 130)}px`;
  tooltip.style.top = `${clientY - wrapRect.top - 10}px`;
}

function hitTest(ev) {
  const rect = canvas.getBoundingClientRect();
  const p = ev.touches?.[0] ?? ev;
  const x = (p.clientX - rect.left) * (W / rect.width);
  const y = (p.clientY - rect.top) * (H / rect.height);
  for (const hb of hitboxes) {
    if (Math.hypot(hb.x - x, hb.y - (y + hb.r / 2)) <= hb.r) return { hb, p };
  }
  return null;
}

// canvas theme colors, read from the stylesheet once at init so the canvas
// follows style.css (fallbacks = the shipped theme)
const C = { hp: "#2fd42f", gold: "#ffd700" };
export function initBattle(el) {
  canvas = el;
  canvas.width = W;
  canvas.height = H;
  ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const css = getComputedStyle(document.documentElement);
  C.hp = css.getPropertyValue("--hp-green").trim() || C.hp;
  C.gold = css.getPropertyValue("--cur-gold").trim() || C.gold;

  tooltip = document.createElement("div");
  tooltip.className = "battleTooltip";
  canvas.parentElement.style.position = "relative";
  canvas.parentElement.appendChild(tooltip);

  const onMove = ev => {
    const hit = hitTest(ev);
    if (hit) showTooltip(hit.hb.m, hit.p.clientX, hit.p.clientY);
    else tooltip.style.display = "none";
  };
  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });
  canvas.addEventListener("touchstart", ev => {
    onMove(ev);
    if (tooltip.style.display === "block") setTimeout(() => { tooltip.style.display = "none"; }, 1800);
  }, { passive: true });
}

function spawnFloater(text, color, sizePx = 16) {
  floaters.push({
    x: MOB.x - 45 + Math.random() * 90,
    y: MOB.y - 60 - Math.random() * 25,
    alpha: 1,
    text, color, sizePx,
  });
}

function drawActor(key, cx, cy, now, { scale = 1, flip = false, bright = false } = {}) {
  const sheet = getSheet(key);
  const draw = SPRITE_DRAW * scale;

  ctx.save();
  ctx.translate(cx, cy);
  if (flip) ctx.scale(-1, 1);
  if (bright) ctx.filter = "brightness(2.5)";

  if (sheet && sheet.img) {
    const { size, frames, fps } = sheet.meta;
    // Grid sheet, read left-to-right then top-to-bottom. cols derived from the
    // image width, so a single-row strip (cols == frames) works too.
    const cols = Math.max(1, Math.floor(sheet.img.width / size));
    const frame = Math.floor((now / 1000) * fps) % frames;
    const sx = (frame % cols) * size;
    const sy = Math.floor(frame / cols) * size;
    ctx.drawImage(sheet.img, sx, sy, size, size, -draw / 2, -draw, draw, draw);
  } else {
    const emoji = sheet?.meta.fallback ?? "❓";
    ctx.font = `${draw}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(emoji, 0, 0);
  }
  ctx.restore();
}

export function renderBattle(state, player) {
  if (!ctx) return;
  const now = performance.now();

  // consume sim events — hits shown individually (source-style dense numbers,
  // colored by type: white hit / orange crit / gold skill), overflow aggregated
  const hits = [];
  for (const e of events) {
    if (e.type === "hit") hits.push(e);
    else if (e.type === "skill") spawnFloater(fmtNum(e.dmg), "#ffb02e", 22);
    else if (e.type === "kill") spawnFloater(`+${fmtNum(e.copper)}c`, C.gold, 18);
    else if (e.type === "bag") spawnFloater(`💰 +${fmtNum(e.copper)}c!`, C.gold, 26);
    else if (e.type === "bosskill") { shakeUntil = now + 350; spawnFloater("BOSS DOWN", C.gold, 30); }
  }
  events.length = 0;

  if (hits.length > 0) {
    attackUntil = now + 250;
    flashUntil = now + 120;
    const shown = hits.slice(0, 8);
    for (const h of shown) {
      spawnFloater(fmtNum(h.dmg), h.crit ? "#ff8c1a" : "#f0f0f0", h.crit ? 21 : 15);
    }
    const rest = hits.slice(8);
    if (rest.length) {
      spawnFloater(`${fmtNum(rest.reduce((a, h) => a + h.dmg, 0))} ×${rest.length}`, "#ff5050", 20);
    }
  }

  // scene: mottled green field (screenshot terrain feel)
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#1e4023";
  ctx.fillRect(0, 0, W, H);
  // boss-kill shake: jitter everything drawn after the background, decaying
  ctx.save();
  if (now < shakeUntil) {
    const m = 5 * ((shakeUntil - now) / 350);
    ctx.translate((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m);
  }
  ctx.fillStyle = "#17351c";
  for (const [px, py, rx, ry] of PATCHES) {
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillRect(0, H - 50, W, 50); // ground shadow band

  hitboxes = [];
  const field = state.field || [];
  const solo = field.length <= 1;
  const primary = field.find(m => m.hp > 0) || field[0] || null;
  const flashing = now < flashUntil;

  // hero (lunges toward the field while attacking)
  let heroX = HERO.x;
  if (now < attackUntil) {
    const t = 1 - (attackUntil - now) / 250;
    heroX += Math.sin(t * Math.PI) * 55;
  }
  drawActor(player.classId ?? "hero", heroX, HERO.y, now, { scale: 2.5 });

  // Summon clones (Doppelganger, Necromancer's minion — any active buff with
  // clones): smaller copies flank the hero while the buff runs
  const cloneSkill = getClass(player.classId)?.skills.find(s => s.buff?.clones);
  const cloneBuff = cloneSkill && state.buffs?.[cloneSkill.id];
  if (cloneBuff && cloneBuff.until > state.total_time) {
    drawActor(player.classId ?? "hero", heroX - 45, HERO.y - 28, now, { scale: 1.6 });
    if ((cloneSkill.buff.clones ?? 1) > 1) {
      drawActor(player.classId ?? "hero", heroX - 62, HERO.y + 14, now, { scale: 1.6 });
    }
  }

  // WC3-style overhead HP bar: black outline, always visible
  function hpBar(x, y, w, frac, color = C.hp) {
    ctx.fillStyle = "#000";
    ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, w * Math.max(0, frac), 4);
  }

  if (!primary) {
    ctx.fillStyle = "rgba(220,210,180,0.85)";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pick a hunting ground", MOB.x, MOB.y - 60);
  } else if (solo) {
    // single big enemy (summon boss or a solo-hunted field boss)
    const mob = primary;
    const shake = flashing ? (Math.random() - 0.5) * 6 : 0;
    drawActor(mob.isBoss ? mob.bossId : mob.zoneId, MOB.x + shake, MOB.y, now,
      { scale: 2.2, flip: true, bright: flashing });
    const frac = mob.hp / mob.maxHp;
    hpBar(MOB.x, MOB.y - SPRITE_DRAW * 2.2 - 12, 170,
      frac, frac > 0.5 ? C.hp : frac > 0.2 ? "#e0a020" : "#d03030");
    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(mob.name, MOB.x, MOB.y - SPRITE_DRAW * 2.2 - 20);
    hitboxes.push({ m: mob, x: MOB.x, y: MOB.y, r: SPRITE_DRAW });
  } else {
    // a field: the 4×4 grid, each mob with its own overhead bar
    const cellW = 44, cellH = 42, cols = 4;
    const ox = MOB.x - (cols * cellW) / 2 + cellW / 2;
    const oy = 78;
    for (const m of field) {
      if (m.hp <= 0) continue;
      const jitter = flashing ? (Math.random() - 0.5) * 4 : 0;
      const x = ox + (m.gx || 0) * cellW + jitter;
      const y = oy + (m.gy || 0) * cellH;
      drawActor(m.zoneId, x, y, now, { scale: m.isFieldBoss ? 1.1 : 0.75, flip: true, bright: flashing });
      hpBar(x, y - (m.isFieldBoss ? 76 : 56), 30, m.hp / m.maxHp,
        m.isFieldBoss ? C.gold : C.hp);
      hitboxes.push({ m, x, y, r: HIT_R });
    }
    ctx.fillStyle = "#fff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${primary.name} ×${field.filter(m => m.hp > 0).length}`, MOB.x, oy - 66);
  }

  // floating damage numbers (fast rise/fade so dense output stays readable)
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.y -= 1.0;
    f.alpha -= 0.024;
    if (f.alpha <= 0) { floaters.splice(i, 1); continue; }
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle = f.color;
    ctx.font = `bold ${f.sizePx}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }
  if (floaters.length > 40) floaters.splice(0, floaters.length - 40);
  ctx.restore(); // shake translate
}
