// ---------- fixed time step ----------
// The game moves in steps of exactly STEP seconds, whatever the frame rate: a lap takes the same time at 30, 60 or 144 frames
// per second, so time trial records do not depend on the screen. STEP is 1/60 s, the step most records were driven with before.
// A slow frame runs several steps (at most MAX_STEPS, below that the game slows down instead of piling up work); a fast
// screen draws between two steps (see main.js, the cars and the camera are drawn in between).

export const STEP = 1 / 60, MAX_STEPS = 8;

export function makeClock(step = STEP, max = MAX_STEPS) {
  let acc = 0;
  return {
    // frame: seconds since the last frame, tick(step) moves the game one step. Returns how far it is to the next step (0..1).
    advance(frame, tick) {
      acc += Math.min(Math.max(frame, 0), step * max);
      let n = 0;
      while (acc >= step && n < max) { tick(step); acc -= step; n++; }
      if (acc >= step) acc = 0;
      return acc / step;
    },
  };
}
