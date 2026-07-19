// battle.js
// Canvas battle scene. The sim pushes lightweight events (it may resolve
// many attacks per tick); this layer aggregates them into representative
// animation — hero lunge, mob flash/shake, floating damage numbers, HP bar.
import { getSheet } from "./sprites.js";

const W = 420, H = 190;
const HERO = { x: 90, y: 130 };
const MOB = { x: 320, y: 130 };
const SPRITE_DRAW = 64;

let canvas = null, ctx = null;

const events = [];
export function pushBattleEvent(e) { events.push(e); }

const floaters = []; // {x, y, alpha, text, color, sizePx}
let attackUntil = 0;
let flashUntil = 0;

export function initBattle(el) {
  canvas = el;
  canvas.width = W;
  canvas.height = H;
  ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
}

function spawnFloater(text, color, sizePx = 16) {
  floaters.push({
    x: MOB.x - 20 + Math.random() * 40,
    y: MOB.y - 70,
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
    const frame = Math.floor((now / 1000) * fps) % frames;
    ctx.drawImage(sheet.img, frame * size, 0, size, size, -draw / 2, -draw, draw, draw);
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

  // consume sim events
  let hits = 0, hitDmg = 0;
  for (const e of events) {
    if (e.type === "hit") { hits++; hitDmg += e.dmg; }
    else if (e.type === "skill") spawnFloater(fmtNum(e.dmg), "#ffb02e", 22);
    else if (e.type === "kill") spawnFloater(`+${fmtNum(e.copper)}c`, "#ffd700", 18);
    else if (e.type === "bag") spawnFloater(`💰 +${fmtNum(e.copper)}c!`, "#ffd700", 26);
  }
  events.length = 0;

  if (hits > 0) {
    attackUntil = now + 250;
    flashUntil = now + 120;
    if (hits <= 3) {
      for (let i = 0; i < hits; i++) spawnFloater(fmtNum(hitDmg / hits), "#ff5050", 16);
    } else {
      spawnFloater(`${fmtNum(hitDmg)} ×${hits}`, "#ff5050", 20);
    }
  }

  // scene
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "rgba(128, 128, 128, 0.12)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(90, 70, 40, 0.35)";
  ctx.fillRect(0, H - 44, W, 44); // ground

  const mob = state.currentMob;

  // hero (lunges toward the mob while attacking)
  let heroX = HERO.x;
  if (now < attackUntil) {
    const t = 1 - (attackUntil - now) / 250;
    heroX += Math.sin(t * Math.PI) * 55;
  }
  drawActor(player.classId ?? "hero", heroX, HERO.y, now);

  // mob (flash + shake when hit)
  if (mob) {
    const flashing = now < flashUntil;
    const shake = flashing ? (Math.random() - 0.5) * 6 : 0;
    const key = mob.isBoss ? mob.bossId : mob.zoneId;
    drawActor(key, MOB.x + shake, MOB.y, now, {
      scale: mob.isBoss ? 1.6 : 1,
      flip: true,
      bright: flashing,
    });

    // HP bar
    const bw = mob.isBoss ? 160 : 110;
    const bx = MOB.x - bw / 2;
    const by = mob.isBoss ? 14 : 34;
    const frac = Math.max(0, mob.hp / mob.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(bx - 1, by - 1, bw + 2, 10);
    ctx.fillStyle = frac > 0.5 ? "#3fbf3f" : frac > 0.2 ? "#e0a020" : "#d03030";
    ctx.fillRect(bx, by, bw * frac, 8);
    ctx.fillStyle = "#fff";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(mob.name, MOB.x, by - 5);
  } else {
    ctx.fillStyle = "rgba(128,128,128,0.8)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pick a hunting ground", MOB.x, MOB.y - 40);
  }

  // floating damage numbers
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.y -= 0.8;
    f.alpha -= 0.018;
    if (f.alpha <= 0) { floaters.splice(i, 1); continue; }
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle = f.color;
    ctx.font = `bold ${f.sizePx}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }
  if (floaters.length > 40) floaters.splice(0, floaters.length - 40);
}

function fmtNum(n) {
  if (n < 1e4) return Math.round(n).toString();
  const units = ["", "k", "M", "B", "T"];
  const tier = Math.min(units.length - 1, Math.floor(Math.log10(n) / 3));
  return (n / 10 ** (tier * 3)).toFixed(1) + units[tier];
}
