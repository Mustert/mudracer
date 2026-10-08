import { G } from './g.js';
import { R1 } from './draw.js';

// ---------- Grand Prix trophies: one per cup, car and difficulty, the harder the grander ----------
// LEICHT: a small bronze cup. MITTEL: a silver cup with handles on a two-step foot.
// SCHWER: a big golden cup with curled handles, a ruby, a star on the lid, on a wooden plinth, and it sparkles.

const PAL = [
  { m: '#cd7f32', h: '#f0b070', d: '#8a5a2b' },
  { m: '#c0c8d0', h: '#f2f6fa', d: '#6e7680' },
  { m: '#ffd23f', h: '#fff08a', d: '#c79a06', g: '#e63946', G: '#ff9aa2', p: '#5a3a1f', P: '#8a6440' },
];
const DIM = { m: '#3a2c20', h: '#45362a', d: '#33261b', g: '#3a2c20', G: '#45362a', p: '#33261b', P: '#3a2c20' };

// the shape in units, x around the middle, y upwards from the bottom (negative = above); [x, y, w, h, colour key]
function shape(lv) {
  const R = [], bowl = [[5, 8], [6, 10], [7, 12]][lv], [hw, bh] = bowl;
  const foot = [[[-4, -2, 8, 2, 'd'], [-4, -2, 8, 1, 'm']], [[-5, -2, 10, 2, 'd'], [-4, -4, 8, 2, 'm'], [-4, -4, 8, 1, 'h']],
    [[-8, -4, 16, 4, 'p'], [-8, -4, 16, 1, 'P'], [-5, -6, 10, 2, 'm'], [-5, -6, 10, 1, 'h']]][lv];
  R.push(...foot);
  const fy = foot[foot.length - 1][1], stem = lv ? 3 : 3, top = fy - stem - 1 - bh;
  R.push([-1, fy - stem, 2, stem, 'm'], [-2, fy - stem - 1, 4, 1, 'd']);
  for (let r = 0; r < bh; r++) {
    const w = Math.max(1, Math.round(hw * Math.sqrt(1 - (r / bh) ** 2)));
    R.push([-w, top + r, w * 2, 1, 'm'], [-w + 1, top + r, 1, 1, 'h'], [w - 2, top + r, 1, 1, 'd']);
  }
  R.push([-hw, top, hw * 2, 1, 'h']);
  if (lv >= 1) for (const s of [-1, 1]) {
    // handles: a loop on each side (on SCHWER bigger, with a curl at the bottom)
    const hx = s < 0 ? -hw - 3 : hw, len = lv === 2 ? 7 : 5;
    R.push([hx, top + 1, 3, 1, 'm'], [s < 0 ? hx : hx + 2, top + 1, 1, len, 'm'], [hx, top + len, 3, 1, 'm']);
    if (lv === 2) R.push([s < 0 ? hx - 1 : hx + 3, top + len - 1, 1, 2, 'm']);
  }
  if (lv === 2) {
    R.push([-1, top + 4, 2, 2, 'g'], [-1, top + 4, 1, 1, 'G']);
    // lid with a star on top
    R.push([-4, top - 2, 8, 2, 'm'], [-4, top - 2, 8, 1, 'h'], [-1, top - 5, 2, 3, 'm'], [-2, top - 4, 4, 1, 'm'], [-1, top - 6, 2, 1, 'h']);
  }
  return R;
}
const SHAPES = [0, 1, 2].map(shape);

// cx = middle, by = bottom, k = pixel size of one unit; dim = the empty place on the shelf (not won yet)
export function drawPokal(cx, by, lv, k = 1, dim = false) {
  const R = SHAPES[lv], P = dim ? DIM : PAL[lv], X = x => Math.round(cx + x * k), Y = y => Math.round(by + y * k);
  for (const [x, y, w, h] of R) R1(X(x) - k, Y(y) - k, (w + 2) * k, (h + 2) * k, '#1b120c');
  for (const [x, y, w, h, c] of R) R1(X(x), Y(y), w * k, h * k, P[c]);
  if (!dim && lv === 2 && ((G.time * 3) | 0) % 3 === 0) {
    const top = R[R.length - 1][1];
    R1(X(6), Y(top + 1), k, 5 * k, '#ffffff'); R1(X(4), Y(top + 3), 5 * k, k, '#ffffff');
  }
  if (!dim && lv === 1 && ((G.time * 2 + .5) | 0) % 4 === 0) R1(X(-4), Y(-13), k, 2 * k, '#ffffff');
}

// a tiny one (9x9) for the info boxes of the car selection
const MINI = ['#########', '#.#####.#', '#.#####.#', '.#######.', '..#####..', '...###...', '....#....', '..#####..', '.#######.'];
export function miniPokal(cx, y, lv, dim = false) {
  const c = dim ? '#3f4a3a' : PAL[lv].m, hi = dim ? c : PAL[lv].h;
  MINI.forEach((row, ry) => { for (let rx = 0; rx < 9; rx++) if (row[rx] === '#') R1(cx - 4 + rx, y + ry, 1, 1, ry === 0 || (rx === 2 && ry < 4) ? hi : c); });
  if (!dim && lv === 2) R1(cx, y + 2, 1, 1, PAL[2].g);
}

export const TROPHY_COL = PAL.map(p => p.m);
