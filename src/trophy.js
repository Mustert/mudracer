import { G } from './g.js';
import { R1, text } from './draw.js';

// ---------- Grand Prix trophies: one per cup, car and difficulty. The shape shows the difficulty, the metal the best place ----------
// LEICHT: a small cup. MITTEL: a cup with handles on a two-step foot. SCHWER: a big cup with curled handles, a ruby, a star on the lid, on a wooden plinth.
// Place 1 gold (it sparkles), 2 silver, 3 bronze; from place 4 on a ribbon (rosette) with the number; 0 = not raced yet (dark shape).

const EXTRA = { g: '#e63946', G: '#ff9aa2', p: '#5a3a1f', P: '#8a6440' };
const PAL = [
  { m: '#ffd23f', h: '#fff08a', d: '#c79a06', ...EXTRA },
  { m: '#c0c8d0', h: '#f2f6fa', d: '#6e7680', ...EXTRA },
  { m: '#cd7f32', h: '#f0b070', d: '#8a5a2b', ...EXTRA },
];
const DIM = { m: '#3a2c20', h: '#45362a', d: '#33261b', g: '#3a2c20', G: '#45362a', p: '#33261b', P: '#3a2c20' };
const RIB = ['#2f6fd8', '#5a9ad8', '#1b4796'];

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

// cx = middle, by = bottom, k = pixel size of one unit; place: 1-3 a cup in gold, silver, bronze, 4 and more a ribbon, 0 the empty place on the shelf
export function drawPokal(cx, by, lv, k = 1, place = 1) {
  if (place > 3) { drawRibbon(cx, by, place, k); return; }
  const R = SHAPES[lv], dim = !place, P = dim ? DIM : PAL[place - 1], X = x => Math.round(cx + x * k), Y = y => Math.round(by + y * k);
  for (const [x, y, w, h] of R) R1(X(x) - k, Y(y) - k, (w + 2) * k, (h + 2) * k, '#1b120c');
  for (const [x, y, w, h, c] of R) R1(X(x), Y(y), w * k, h * k, P[c]);
  if (place === 1 && ((G.time * 3) | 0) % 3 === 0) {
    const top = R[R.length - 1][1];
    R1(X(6), Y(top + 1), k, 5 * k, '#ffffff'); R1(X(4), Y(top + 3), 5 * k, k, '#ffffff');
  }
  if (place === 2 && ((G.time * 2 + .5) | 0) % 4 === 0) R1(X(-4), Y(-13), k, 2 * k, '#ffffff');
}

// a ribbon for place 4 and lower: a blue rosette with pleats, the number in the middle, two tails hanging down
export function drawRibbon(cx, by, place, k = 1) {
  const cy = Math.round(by - 11 * k), r = 6 * k;
  for (const s of [-1, 1]) {
    // the tails, cut in a V at the bottom
    for (let y = 0; y < 10 * k; y++) { const w = 3 * k, x = Math.round(cx + s * (k + y * .25)) - (s < 0 ? w : 0), cut = y > 8 * k ? Math.round((y - 8 * k) * 1.2) : 0; R1(x - 1, cy + y, w + 2, 1, '#1b120c'); R1(x + (s < 0 ? cut : 0), cy + y, Math.max(0, w - cut), 1, y % (2 * k) < k ? RIB[0] : RIB[2]); }
  }
  for (let dy = -r - 1; dy <= r + 1; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
    const dd = Math.hypot(dx, dy), a = Math.atan2(dy, dx), edge = r + Math.sin(a * 10) * k * .6;
    if (dd > edge + 1) continue;
    R1(cx + dx, cy + dy, 1, 1, dd > edge ? '#1b120c' : dd > r * .62 ? (Math.floor((a + Math.PI) / (Math.PI / 10)) & 1 ? RIB[0] : RIB[1]) : dd > r * .5 ? '#1b120c' : '#fff3dc');
  }
  if (k >= 2) text(String(place), cx + 1, cy - 3, 8, '#1b120c', 'center', null);
  else R1(cx - 1, cy - 1, 2, 2, '#1b120c');
}

// tiny digits (3x5) for the mini ribbons
const DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001010010', '111101111101111', '111101111001111'];

// a tiny one (9x9) for the info boxes of the car selection; place as above
const MINI = ['#########', '#.#####.#', '#.#####.#', '.#######.', '..#####..', '...###...', '....#....', '..#####..', '.#######.'];
export function miniPokal(cx, y, lv, place = 1) {
  if (place > 3) {
    // a mini rosette with the number
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const dd = Math.hypot(dx, dy); if (dd <= 4.4) R1(cx + dx, y + 4 + dy, 1, 1, dd > 3.6 ? RIB[2] : RIB[0]); }
    const g = DIG[place % 10]; for (let q = 0; q < 15; q++) if (g[q] === '1') R1(cx - 1 + q % 3, y + 2 + (q / 3 | 0), 1, 1, '#ffffff');
    return;
  }
  const dim = !place, c = dim ? '#3f4a3a' : PAL[place - 1].m, hi = dim ? c : PAL[place - 1].h;
  MINI.forEach((row, ry) => { for (let rx = 0; rx < 9; rx++) if (row[rx] === '#') R1(cx - 4 + rx, y + ry, 1, 1, ry === 0 || (rx === 2 && ry < 4) ? hi : c); });
  if (!dim && lv === 2) R1(cx, y + 2, 1, 1, PAL[0].g);
}

export const TROPHY_COL = PAL.map(p => p.m);
