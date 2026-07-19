// gameLoop.js
// Implements the main animation and update loop for the game.
// It keeps a fixed-timestep update cycle, preventing logic from
// depending on render frame rate while still using requestAnimationFrame.
export function startGameLoop(update, render, panic, update_rate = 2) {
  let last_time = null;
  let accumulated_lag = 0;

  const update_time_in_ms = 1000;
  const frequency = update_time_in_ms / update_rate;

  function loop(current_time) {
    if (last_time === null) last_time = current_time;

    const real_delta = current_time - last_time;  // Real elapsed time
    last_time = current_time;

    accumulated_lag += real_delta;

    let first_update = true;
    let updates_this_frame = 0;
    while (accumulated_lag >= frequency) {
      accumulated_lag -= frequency;
      // Pass both fixed timestep and real time
      update(frequency, first_update ? real_delta : 0);
      first_update = false;

      // Spiral of death guard: too far behind in a single frame,
      // drop the remaining lag instead of trying to catch up.
      if (++updates_this_frame >= 300) {
        accumulated_lag = 0;
        panic();
        break;
      }
    }

    render();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}
