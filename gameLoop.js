// gameLoop.js
// Idle-game loop: logic runs on setInterval with wall-clock deltas (keeps
// firing in background tabs, where the browser clamps but never fully stops
// it), requestAnimationFrame is used for rendering only.
// A throw in render would otherwise kill the rAF chain permanently (frozen
// UI while logic keeps running); a throw in tick aborts that tick's autosave.
// Guard both; log each distinct error once to avoid 4/s console spam.
const seen = new Set();
function guard(fn, label) {
  return () => {
    try { fn(); } catch (e) {
      const key = String(e);
      if (!seen.has(key)) { seen.add(key); console.error(`[${label}]`, e); }
    }
  };
}

export function startGameLoop(tick, render, logicIntervalMs = 250) {
  setInterval(guard(tick, "tick"), logicIntervalMs);

  const safeRender = guard(render, "render");
  (function frame() {
    safeRender();
    requestAnimationFrame(frame);
  })();
}
