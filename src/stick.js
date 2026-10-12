// ---------- virtual stick (touch, alternative steering) ----------
// Pure math, so it can be tested without a page: the finger is (dx, dy) away from the middle of the stick, r is how far
// the knob may go. Inside the dead zone (a quarter of r) the car rolls out; outside it drives towards the angle.

export const STICK_DEAD = .25;


/** @returns {{ x: number, y: number, on: boolean, ang: number }} x, y from -1 to 1 (knob position), ang in radians */
export function stickRead(dx, dy, r) {
  const d = Math.hypot(dx, dy), k = d > r ? r / d : 1, x = dx * k / r, y = dy * k / r;
  return { x, y, on: d >= r * STICK_DEAD, ang: Math.atan2(dy, dx) };
}
