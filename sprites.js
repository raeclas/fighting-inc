// sprites.js
// Sprite-sheet manifest + lazy loader.
//
// ART CONTRACT — drop your PNGs into assets/ with these filenames:
// - One PNG per animation. Frames in a HORIZONTAL STRIP, left to right.
// - Every frame in a sheet is square: `size` × `size` pixels.
//   (image width = size * frames, image height = size)
// - `frames: 1` = a plain static image. Start there; animate later.
// - Any file that's missing just renders the emoji fallback instead,
//   so you can add art one monster at a time.
// - "<id>_attack" sheets are optional; without one the idle sheet lunges.
export const SHEETS = {
  // heroes (keyed by class id)
  striker:         { src: "assets/striker.png",         size: 64, frames: 4, fps: 6,  fallback: "🥋" },
  striker_attack:  { src: "assets/striker_attack.png",  size: 64, frames: 4, fps: 12, fallback: null },
  overmind:        { src: "assets/overmind.png",        size: 64, frames: 4, fps: 6,  fallback: "🧠" },
  overmind_attack: { src: "assets/overmind_attack.png", size: 64, frames: 4, fps: 12, fallback: null },
  hero:            { src: "assets/hero.png",            size: 64, frames: 4, fps: 6,  fallback: "🧑" }, // no class yet

  // zone mobs (keyed by zone id)
  temple:        { src: "assets/temple.png",        size: 64, frames: 4, fps: 4, fallback: "😩" },
  magtonium:     { src: "assets/magtonium.png",     size: 64, frames: 4, fps: 4, fallback: "🌋" },
  otherverse:    { src: "assets/otherverse.png",    size: 64, frames: 4, fps: 4, fallback: "👾" },
  terranium:     { src: "assets/terranium.png",     size: 64, frames: 4, fps: 4, fallback: "🗿" },
  harlemdungeon: { src: "assets/harlemdungeon.png", size: 64, frames: 4, fps: 4, fallback: "🧟" },
  lukelab:       { src: "assets/lukelab.png",       size: 64, frames: 4, fps: 4, fallback: "🛸" },
  fiendwar:      { src: "assets/fiendwar.png",      size: 64, frames: 4, fps: 4, fallback: "😈" },
  stormy:        { src: "assets/stormy.png",        size: 64, frames: 4, fps: 4, fallback: "🌩️" },
  aiolite:       { src: "assets/aiolite.png",       size: 64, frames: 4, fps: 4, fallback: "💎" },
  despairore:    { src: "assets/despairore.png",    size: 64, frames: 4, fps: 4, fallback: "🖤" },
  goldenberyl:   { src: "assets/goldenberyl.png",   size: 64, frames: 4, fps: 4, fallback: "💛" },

  // bosses (keyed by boss id)
  hellparty: { src: "assets/hellparty.png", size: 64, frames: 4, fps: 4, fallback: "🎉" },
  anton:     { src: "assets/anton.png",     size: 64, frames: 4, fps: 4, fallback: "👹" },
  luke:      { src: "assets/luke.png",      size: 64, frames: 4, fps: 4, fallback: "🤖" },
  harlem:    { src: "assets/harlem.png",    size: 64, frames: 4, fps: 4, fallback: "💀" },
};

const cache = {}; // key -> { img: Image|null, ready: bool, failed: bool }

// Returns { meta, img } where img is null until loaded (or on 404 → fallback).
export function getSheet(key) {
  const meta = SHEETS[key];
  if (!meta) return null;
  if (!cache[key]) {
    const entry = { img: null, ready: false, failed: false };
    cache[key] = entry;
    const img = new Image();
    img.onload = () => { entry.img = img; entry.ready = true; };
    img.onerror = () => { entry.failed = true; };
    img.src = meta.src;
  }
  return { meta, img: cache[key].ready ? cache[key].img : null };
}
