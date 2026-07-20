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
  // heroes (keyed by class id) — static art-pipeline sprites; the idle-sheet
  // lunge animates attacks, "<id>_attack" strips can return later
  striker:         { src: "assets/striker.png",         size: 64, frames: 1, fps: 6,  fallback: "🥋" },
  overmind:        { src: "assets/overmind.png",        size: 64, frames: 1, fps: 6,  fallback: "🧠" },
  hero:            { src: "assets/hero.png",            size: 64, frames: 1, fps: 6,  fallback: "🧑" }, // no class yet
  omniblade:       { src: "assets/omniblade.png",       size: 64, frames: 1, fps: 6,  fallback: "⚔️" },
  bloodevil:       { src: "assets/bloodevil.png",       size: 64, frames: 1, fps: 6,  fallback: "🩸" },
  indra:           { src: "assets/indra.png",           size: 64, frames: 1, fps: 6,  fallback: "🌊" },
  vagabond:        { src: "assets/vagabond.png",        size: 64, frames: 1, fps: 6,  fallback: "🗡️" },
  desperado:       { src: "assets/desperado.png",       size: 64, frames: 1, fps: 6,  fallback: "🤠" },
  stormtrooper:    { src: "assets/stormtrooper.png",    size: 64, frames: 1, fps: 6,  fallback: "🔫" },
  nenempress:      { src: "assets/nenempress.png",      size: 64, frames: 1, fps: 6,  fallback: "👑" },
  crusader:        { src: "assets/crusader.png",        size: 64, frames: 1, fps: 6,  fallback: "✝️" },
  majesty:         { src: "assets/majesty.png",         size: 64, frames: 1, fps: 6,  fallback: "🗡" },
  divineress:      { src: "assets/divineress.png",      size: 64, frames: 1, fps: 6,  fallback: "🔮" },
  geniewiz:        { src: "assets/geniewiz.png",        size: 64, frames: 1, fps: 6,  fallback: "🎰" },
  spectre:         { src: "assets/spectre.png",         size: 64, frames: 1, fps: 6,  fallback: "👻" },
  hekate:          { src: "assets/hekate.png",          size: 64, frames: 1, fps: 6,  fallback: "💜" },
  ashtarte:        { src: "assets/ashtarte.png",        size: 64, frames: 1, fps: 6,  fallback: "🔱" },
  necromancer:     { src: "assets/necromancer.png",     size: 64, frames: 1, fps: 6,  fallback: "💀" },
  darkknight:      { src: "assets/darkknight.png",      size: 64, frames: 1, fps: 6,  fallback: "🌑" },

  // zone mobs (keyed by zone id) — static AI-generated pixel sprites
  // (internal/art pipeline); frames: 1 per the art contract, animate later
  kiln:    { src: "assets/kiln.png",    size: 64, frames: 1, fps: 4, fallback: "😩" },
  slag:    { src: "assets/slag.png",    size: 64, frames: 1, fps: 4, fallback: "🌋" },
  rift:    { src: "assets/rift.png",    size: 64, frames: 1, fps: 4, fallback: "👾" },
  loam:    { src: "assets/loam.png",    size: 64, frames: 1, fps: 4, fallback: "🗿" },
  market:  { src: "assets/market.png",  size: 64, frames: 1, fps: 4, fallback: "🧟" },
  spire:   { src: "assets/spire.png",   size: 64, frames: 1, fps: 4, fallback: "🛸" },
  warpit:  { src: "assets/warpit.png",  size: 64, frames: 1, fps: 4, fallback: "😈" },
  tempest: { src: "assets/tempest.png", size: 64, frames: 1, fps: 4, fallback: "🌩️" },
  prism:   { src: "assets/prism.png",   size: 64, frames: 1, fps: 4, fallback: "💎" },
  sorrow:  { src: "assets/sorrow.png",  size: 64, frames: 1, fps: 4, fallback: "🖤" },
  aurum:   { src: "assets/aurum.png",   size: 64, frames: 1, fps: 4, fallback: "💛" },

  // bosses (keyed by boss id)
  hellparty: { src: "assets/hellparty.png", size: 64, frames: 1, fps: 4, fallback: "🎉" },
  anton:     { src: "assets/anton.png",     size: 64, frames: 1, fps: 4, fallback: "👹" },
  luke:      { src: "assets/luke.png",      size: 64, frames: 1, fps: 4, fallback: "🤖" },
  harlem:    { src: "assets/harlem.png",    size: 64, frames: 1, fps: 4, fallback: "💀" },
  sirocco:   { src: "assets/sirocco.png",   size: 64, frames: 1, fps: 4, fallback: "🌪️" },
  ozma:      { src: "assets/ozma.png",      size: 64, frames: 1, fps: 4, fallback: "🐐" },
  tiamat:    { src: "assets/tiamat.png",    size: 64, frames: 1, fps: 4, fallback: "🐉" },
  astaroth:  { src: "assets/astaroth.png",  size: 64, frames: 1, fps: 4, fallback: "📕" },
  ezra:      { src: "assets/ezra.png",      size: 64, frames: 1, fps: 4, fallback: "🔮" },
  bernardo:  { src: "assets/bernardo.png",  size: 64, frames: 1, fps: 4, fallback: "🛡️" },
  bernardo2: { src: "assets/bernardo2.png", size: 64, frames: 1, fps: 4, fallback: "⚜️" },
  seria:     { src: "assets/seria.png",     size: 64, frames: 1, fps: 4, fallback: "🌸" },
  abysswalker:    { src: "assets/abysswalker.png",    size: 64, frames: 1, fps: 4, fallback: "🕳️" },
  taibers:        { src: "assets/taibers.png",        size: 64, frames: 1, fps: 4, fallback: "🦂" },
  fiendwar:       { src: "assets/fiendwar.png",       size: 64, frames: 1, fps: 4, fallback: "⚔️" },
  berias:         { src: "assets/berias.png",         size: 64, frames: 1, fps: 4, fallback: "🌑" },
  prey:           { src: "assets/prey.png",           size: 64, frames: 1, fps: 4, fallback: "🦌" },
  hyunfindwar:    { src: "assets/hyunfindwar.png",    size: 64, frames: 1, fps: 4, fallback: "🔥" },
  queendestroyer: { src: "assets/queendestroyer.png", size: 64, frames: 1, fps: 4, fallback: "👸" },
  astaroth2:      { src: "assets/astaroth2.png",      size: 64, frames: 1, fps: 4, fallback: "📖" },
  spirazzi:       { src: "assets/spirazzi.png",       size: 64, frames: 1, fps: 4, fallback: "🐍" },
  luton:          { src: "assets/luton.png",          size: 64, frames: 1, fps: 4, fallback: "🐘" },
  transfrey:      { src: "assets/transfrey.png",      size: 64, frames: 1, fps: 4, fallback: "🌠" },
  baekhwa:        { src: "assets/baekhwa.png",        size: 64, frames: 1, fps: 4, fallback: "🍊" },
  ezraabyss:      { src: "assets/ezraabyss.png",      size: 64, frames: 1, fps: 4, fallback: "🌀" },
  hisma:          { src: "assets/hisma.png",          size: 64, frames: 1, fps: 4, fallback: "🐲" },
  skasa:          { src: "assets/skasa.png",          size: 64, frames: 1, fps: 4, fallback: "❄️" },
  librarykeeper:  { src: "assets/librarykeeper.png",  size: 64, frames: 1, fps: 4, fallback: "📚" },
  trialgiver:     { src: "assets/trialgiver.png",     size: 64, frames: 1, fps: 4, fallback: "⚖️" },
  abyssirocco:    { src: "assets/abyssirocco.png",    size: 64, frames: 1, fps: 4, fallback: "🌀" },
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
