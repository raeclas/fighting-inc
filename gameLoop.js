// gameLoop.js
// Idle-game loop: logic runs on setInterval with wall-clock deltas (keeps
// firing in background tabs, where the browser clamps but never fully stops
// it), requestAnimationFrame is used for rendering only.
export function startGameLoop(tick, render, logicIntervalMs = 250) {
  setInterval(tick, logicIntervalMs);

  (function frame() {
    render();
    requestAnimationFrame(frame);
  })();
}
