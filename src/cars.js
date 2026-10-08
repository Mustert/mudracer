import { G } from './g.js';
import { ROTS, SOIL_HI, SOIL_LO, SS, TAU, clamp, hash, hex, mk, outlineImg, rng, toCanvas } from './core.js';

// ---------- cars (44x44 sprites, facing right, centre 22/22) ----------

export const HL = '#fff7c2', TL = '#ff3b3b';


export const CAR_DEFS = [
  { id: 'flitzer', name: 'FLITZER', M: '#f07a1a', D: '#b44d0c', L: '#ffb45e', speed: 1.085, mud: 0.80, acc: 1.2, turn: 1.12, engine: 64, honk: 'meep',
    draw({ R, wheel, glass, cut }, c) {
      wheel(9, 9, 8, 5); wheel(28, 9, 7, 5); wheel(9, 30, 8, 5); wheel(28, 30, 7, 5);
      R(c.M, 5, 12, 34, 20); R(c.L, 7, 13, 30, 1); R(c.D, 7, 30, 30, 1);
      R(c.D, 29, 15, 1, 14);
      R(c.M, 15, 15, 7, 14); R(c.L, 15, 15, 7, 1);
      R('#fff4e0', 5, 19, 34, 2); R('#fff4e0', 5, 23, 34, 2);
      glass(22, 14, 4, 16); glass(12, 16, 3, 12);
      R('#ffffff', 31, 19, 5, 6); R('#262626', 33, 20, 1, 4); R('#262626', 32, 21, 1, 1);
      R(c.D, 2, 12, 4, 20); R('#6e2e07', 2, 11, 4, 2); R('#6e2e07', 2, 31, 4, 2);
      R(TL, 6, 13, 2, 3); R(TL, 6, 28, 2, 3);
      R(HL, 37, 14, 2, 3); R(HL, 37, 27, 2, 3);
      R(c.M, 23, 11, 2, 1); R(c.M, 23, 32, 2, 1);
      cut(5, 12, 34, 20, 4);
    } },
  { id: 'monster', name: 'MONSTER', M: '#8e44ad', D: '#5e2a75', L: '#c79be0', speed: 0.97, mud: 1.40, acc: .9, turn: .95, engine: 40, honk: 'horn',
    draw({ R, wheel, glass, cut }, c) {
      wheel(6, 4, 11, 9); wheel(27, 4, 11, 9); wheel(6, 31, 11, 9); wheel(27, 31, 11, 9);
      R(c.M, 4, 11, 36, 22); R(c.L, 6, 12, 32, 1); R(c.D, 6, 31, 32, 1);
      R(c.D, 5, 14, 11, 16); for (let y = 16; y < 29; y += 3) R(c.M, 6, y, 9, 1);
      R(c.L, 17, 13, 12, 18); R('#e2c6f0', 17, 13, 12, 1);
      for (let y = 15; y < 30; y += 4) R('#ffe14d', 19, y, 2, 2);
      glass(29, 14, 3, 16); glass(16, 16, 1, 12);
      R('#222222', 33, 19, 4, 6); R('#666666', 34, 20, 2, 4);
      R('#ffb31a', 33, 13, 6, 1); R('#ffe14d', 36, 13, 3, 1); R('#ffb31a', 33, 30, 6, 1); R('#ffe14d', 36, 30, 3, 1);
      R(HL, 39, 13, 1, 3); R(HL, 39, 28, 1, 3); R(TL, 4, 13, 1, 3); R(TL, 4, 28, 1, 3);
      cut(4, 11, 36, 22, 3);
    } },
  { id: 'traktor', name: 'TRAKTOR', M: '#3aa845', D: '#23702b', L: '#8be08f', speed: 0.95, mud: 1.60, acc: .8, turn: .9, engine: 30, honk: 'tractor',
    draw({ R, wheel, cut }, c) {
      wheel(5, 3, 13, 9); wheel(5, 32, 13, 9);
      wheel(28, 10, 8, 5); wheel(28, 29, 8, 5);
      R('#555555', 2, 20, 3, 4);
      R(c.M, 18, 15, 21, 14); R(c.L, 19, 16, 19, 1); R(c.D, 19, 27, 19, 1);
      for (let x = 21; x < 36; x += 3) { R(c.D, x, 17, 1, 2); R(c.D, x, 25, 1, 2); }
      R(c.L, 20, 21, 17, 2);
      R('#555555', 38, 16, 1, 12); for (let y = 17; y < 27; y += 2) R('#888888', 38, y, 1, 1);
      R('#333333', 24, 17, 3, 3); R('#888888', 24, 17, 1, 1);
      R(c.M, 5, 12, 14, 20); R(c.D, 5, 12, 13, 1); R(c.D, 5, 31, 13, 1);
      R('#f4d03f', 6, 13, 12, 18); R('#fff0a0', 7, 14, 10, 1); R('#d4ac1f', 7, 29, 10, 1); R('#e5bf2c', 11, 15, 2, 14);
      R(HL, 37, 15, 2, 2); R(HL, 37, 27, 2, 2);
      cut(18, 15, 21, 14, 2); cut(6, 13, 12, 18, 2);
    } },
  { id: 'polizei', name: 'POLIZEI', M: '#eef3f8', D: '#aab8c6', L: '#ffffff', B: '#1f5fd1', speed: 1.04, mud: 0.95, acc: 1.1, turn: 1.05, engine: 58, honk: 'police', siren: true,
    draw({ R, wheel, glass, cut }, c) {
      wheel(9, 9, 7, 5); wheel(28, 9, 7, 5); wheel(9, 30, 7, 5); wheel(28, 30, 7, 5);
      R(c.M, 5, 12, 34, 20); R(c.D, 7, 30, 30, 1);
      R(c.B, 5, 12, 34, 3); R(c.B, 5, 29, 34, 3); R(c.D, 29, 15, 1, 14);
      R(c.B, 37, 15, 2, 14); R(c.B, 5, 15, 2, 14);
      R('#ffffff', 15, 15, 8, 14);
      glass(24, 14, 4, 16); glass(12, 15, 3, 14);
      R('#1d4ed8', 18, 14, 3, 16); R('#60a5fa', 18, 16, 3, 4); R('#60a5fa', 18, 24, 3, 4); R('#dbeafe', 19, 17, 1, 1); R('#dbeafe', 19, 25, 1, 1);
      R(HL, 37, 14, 2, 3); R(HL, 37, 27, 2, 3); R(TL, 5, 14, 1, 3); R(TL, 5, 27, 1, 3);
      R(c.M, 25, 11, 2, 1); R(c.M, 25, 32, 2, 1);
      cut(5, 12, 34, 20, 4);
    } },
  { id: 'feuerwehr', name: 'FEUERWEHR', M: '#e03131', D: '#961c1c', L: '#ff7b7b', speed: 1.005, mud: 1.25, acc: .85, turn: .9, engine: 44, honk: 'fire', siren: true,
    draw({ R, wheel, glass, cut }, c) {
      for (const x of [7, 15, 29]) { wheel(x, 10, 7, 4); wheel(x, 30, 7, 4); }
      R(c.M, 2, 12, 39, 20); R(c.L, 3, 12, 37, 1); R(c.D, 3, 31, 37, 1);
      R('#ffffff', 3, 29, 26, 1); R('#ffffff', 3, 14, 26, 1);
      R(c.D, 29, 12, 1, 20);
      R('#d9d9d9', 4, 16, 24, 2); R('#d9d9d9', 4, 26, 24, 2); for (let x = 5; x < 28; x += 3) R('#a8a8a8', x, 18, 1, 8);
      R('#f1c40f', 22, 19, 4, 6); R('#c79a06', 22, 24, 4, 1);
      R(c.L, 31, 14, 5, 16);
      R('#3d7bff', 31, 13, 4, 2); R('#3d7bff', 31, 29, 4, 2); R('#9cc3ff', 32, 13, 1, 1); R('#9cc3ff', 32, 29, 1, 1);
      glass(36, 14, 3, 16);
      R(HL, 40, 14, 1, 3); R(HL, 40, 27, 1, 3); R(TL, 2, 14, 1, 2); R(TL, 2, 28, 1, 2);
      cut(2, 12, 39, 20, 3);
    } },
  // each of these is a reward: win the cup with that number (first win) to unlock the car
  { id: 'foodtruck', name: 'FOODTRUCK', cup: 1, M: '#2ec4b6', D: '#1a8a80', L: '#8ff0e6', speed: 1.005, mud: 1.20, acc: .95, turn: .95, engine: 46, honk: 'jingle',
    draw({ R, wheel, glass, cut }, c) {
      for (const x of [8, 28]) { wheel(x, 9, 8, 4); wheel(x, 31, 8, 4); }
      R(c.M, 3, 12, 37, 20); R(c.L, 4, 12, 35, 1); R(c.D, 4, 31, 35, 1);
      R('#f4f1e6', 4, 15, 24, 15); R('#dcd6c4', 4, 29, 24, 1);
      for (let x = 4; x < 28; x += 4) { R('#e84a5f', x, 12, 2, 3); R('#ffffff', x + 2, 12, 2, 3); }
      R(c.D, 29, 12, 1, 20); R(c.M, 30, 13, 7, 18); R(c.L, 30, 13, 7, 1); glass(36, 14, 3, 16);
      const disc2 = (cx, cy, rad, col) => { for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (dx * dx + dy * dy <= rad * rad + rad * .6) R(col, cx + dx, cy + dy, 1, 1); };
      disc2(16, 22, 8, '#4f9e3f'); for (let a = 0; a < 12; a++) R('#7bd35f', 16 + Math.round(Math.cos(a / 12 * TAU) * 8), 22 + Math.round(Math.sin(a / 12 * TAU) * 8), 1, 1);
      R('#ffd23f', 9, 15, 3, 3); R('#ffd23f', 21, 15, 3, 3); R('#ffd23f', 9, 26, 3, 3); R('#ffd23f', 21, 26, 3, 3);
      disc2(16, 22, 7, '#6b3a1f'); disc2(16, 22, 6, '#c07a28'); disc2(15, 21, 5, '#e0a040'); disc2(14, 20, 2, '#f2c06a');
      for (const [sx, sy] of [[13, 23], [16, 19], [18, 22], [15, 25], [19, 25], [12, 20]]) R('#fff6e0', sx, sy, 1, 1);
      R(HL, 39, 14, 1, 3); R(HL, 39, 27, 1, 3); R(TL, 3, 14, 1, 2); R(TL, 3, 28, 1, 2);
      cut(3, 12, 37, 20, 3);
    } },
  { id: 'krankenwagen', name: 'KRANKENWAGEN', cup: 2, M: '#f7f7f2', D: '#c8c8c0', L: '#ffffff', speed: 1.03, mud: 1.00, acc: 1.05, turn: 1.03, engine: 56, honk: 'ambulance', siren: true,
    draw({ R, wheel, glass, cut }, c) {
      wheel(9, 9, 8, 5); wheel(28, 9, 7, 5); wheel(9, 30, 8, 5); wheel(28, 30, 7, 5);
      R(c.M, 4, 12, 35, 20); R(c.D, 5, 30, 33, 1);
      R('#e53935', 4, 12, 35, 2); R('#e53935', 4, 30, 35, 2);
      for (let x = 4; x < 38; x += 4) { R('#ffd23f', x, 14, 2, 1); R('#ffd23f', x + 2, 29, 2, 1); }
      R(c.D, 30, 15, 1, 14);
      R('#e53935', 13, 20, 9, 3); R('#e53935', 16, 17, 3, 9);
      R('#1d4ed8', 26, 15, 3, 14); R('#60a5fa', 26, 16, 3, 3); R('#60a5fa', 26, 25, 3, 3);
      glass(32, 14, 4, 16);
      R(HL, 38, 14, 1, 3); R(HL, 38, 27, 1, 3); R(TL, 4, 15, 1, 2); R(TL, 4, 27, 1, 2);
      cut(4, 12, 35, 20, 3);
    } },
  { id: 'quad', name: 'QUAD', cup: 3, M: '#ff7a1a', D: '#b8520a', L: '#ffb066', accent: { s: '#e84a5f', p: '#3d7bff', pl: '#6fa0ff', b: '#ffd93d', bl: '#fff08a' }, speed: 1.015, mud: 1.20, acc: 1.25, turn: 1.15, engine: 72, honk: 'quad',
    draw({ R, wheel }, c) {
      wheel(8, 5, 10, 8); wheel(27, 5, 10, 8); wheel(8, 31, 10, 8); wheel(27, 31, 10, 8);
      R('#3a3a3a', 11, 13, 3, 18); R('#3a3a3a', 30, 13, 3, 18);
      R('#555555', 4, 15, 8, 14); for (let y = 16; y < 29; y += 3) R('#8a8a8a', 5, y, 6, 1);
      R(c.M, 7, 11, 12, 5); R(c.M, 7, 28, 12, 5); R(c.M, 26, 11, 12, 5); R(c.M, 26, 28, 12, 5);
      R(c.L, 8, 11, 10, 1); R(c.L, 27, 11, 10, 1); R(c.D, 8, 32, 10, 1); R(c.D, 27, 32, 10, 1);
      R(c.M, 13, 15, 21, 14); R(c.L, 14, 15, 19, 2); R(c.D, 14, 27, 19, 2);
      R('#222222', 13, 18, 8, 8);
      // the driver: suit (p) and helmet (b) follow the paint
      R(c.accent.p, 16, 16, 6, 12); R(c.accent.p, 22, 16, 6, 2); R(c.accent.p, 22, 26, 6, 2);
      R('#222222', 29, 14, 2, 16); R('#555555', 29, 13, 2, 1); R('#555555', 29, 30, 2, 1);
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (dx * dx + dy * dy <= 18) R(dx + dy < -2 ? c.accent.bl : c.accent.b, 19 + dx, 22 + dy, 1, 1);
      R('#1b120c', 22, 20, 2, 5); R(c.accent.s, 15, 21, 8, 1);
      R(HL, 37, 19, 1, 6);
    } },
  { id: 'rally', name: 'RALLY CAR', cup: 4, M: '#f4f6fa', D: '#b8c0cc', L: '#ffffff', accent: { s: '#e8453c', p: '#2a4fd6', pl: '#4a73ff', b: '#f2e12e', bl: '#fff08a' }, speed: 1.0, mud: 1.0, acc: 1.10, turn: 1.05, engine: 70, honk: 'rally',
    draw({ R, wheel, glass, cut }, c) {
      wheel(8, 9, 8, 5); wheel(28, 9, 8, 5); wheel(8, 30, 8, 5); wheel(28, 30, 8, 5);
      R(c.M, 5, 12, 34, 20); R(c.L, 7, 13, 30, 1); R(c.D, 7, 30, 30, 1);
      // livery: stripes (s), bonnet and roof panels (p, pl), band (b) all follow the paint
      const A = c.accent;
      R(A.s, 8, 12, 22, 2); R(A.s, 8, 30, 22, 2); R(A.p, 8, 14, 22, 1); R(A.p, 8, 29, 22, 1);
      R(A.p, 30, 13, 7, 18); R(A.pl, 30, 13, 7, 1); R('#1a1a1a', 32, 19, 5, 6); R('#555555', 33, 20, 3, 1);
      R(A.b, 36, 13, 3, 18); R('#1a1a1a', 37, 18, 2, 8);
      R(A.p, 14, 15, 13, 14); R(A.pl, 14, 15, 13, 1); R(A.b, 14, 21, 13, 2); R('#1a1a1a', 18, 17, 3, 2);
      glass(27, 14, 3, 16); glass(11, 16, 3, 12);
      R('#222222', 2, 13, 3, 18); R(A.s, 2, 13, 1, 18); R(c.D, 5, 14, 1, 16);
      R(HL, 38, 14, 1, 3); R(HL, 38, 27, 1, 3); R(TL, 5, 14, 1, 3); R(TL, 5, 27, 1, 3);
      cut(5, 12, 34, 20, 4);
    } },
  { id: 'batmobil', name: 'BATMOBIL', cup: 5, M: '#2b2d33', D: '#15161a', L: '#4e525c', speed: 1.1, mud: 1.4, acc: 1.4, turn: 1.2, engine: 85, honk: 'batmobil',
    draw({ R, wheel, glass, cut }, c) {
      wheel(5, 8, 10, 6); wheel(5, 30, 10, 6); wheel(29, 9, 9, 5); wheel(29, 30, 9, 5);
      R(c.D, 2, 11, 11, 3); R(c.M, 3, 11, 9, 2); R(c.L, 4, 11, 7, 1); R(c.D, 2, 30, 11, 3); R(c.M, 3, 31, 9, 2); R(c.L, 4, 32, 7, 1);
      R(c.M, 6, 13, 32, 18); R(c.M, 38, 16, 4, 12); R(c.M, 36, 14, 3, 16);
      R(c.L, 8, 13, 28, 1); R(c.D, 8, 30, 28, 1);
      R(c.D, 16, 15, 11, 14); R('#0e0f12', 17, 16, 9, 12); R('#27415c', 19, 18, 5, 8); R('#5a86b0', 19, 18, 1, 3);
      R(c.L, 28, 21, 13, 2); R(c.D, 29, 17, 6, 1); R(c.D, 29, 26, 6, 1);
      R('#0e0f12', 3, 18, 6, 8); R('#2a2a2a', 4, 19, 4, 6); R('#ff7a1a', 3, 21, 2, 2);
      R('#ffa21a', 38, 14, 1, 2); R('#ffa21a', 38, 28, 1, 2);
      R(HL, 41, 18, 1, 2); R(HL, 41, 24, 1, 2); R(TL, 6, 14, 1, 2); R(TL, 6, 28, 1, 2);
      cut(6, 13, 32, 18, 3);
    } },
];

// plain little cars that fill the Grand Prix field up to eight

export const GENERICS = [['GRAU', '#9aa3ad', '#6b737c', '#c9d0d6'], ['BEIGE', '#d8c8a0', '#a8986e', '#f0e4c4'], ['OLIV', '#6b8a4a', '#4a6333', '#9ab878'], ['WEINROT', '#8a2b3a', '#5e1d27', '#b85566'],
  ['TUERKIS', '#3aa0b8', '#277080', '#7fd0e0'], ['LILA', '#6a5a9a', '#473b70', '#9a8ac8'], ['GOLD', '#c7a02e', '#8e7020', '#e8cb68']].map(([name, M, D, L], i) => ({
  id: 'gen' + i, name, M, D, L, speed: 1.03, mud: 1.0, acc: 1, turn: 1, engine: 50 + i * 3, honk: 'meep', generic: true,
  draw({ R, wheel, glass, cut }, c) {
    wheel(9, 10, 7, 4); wheel(28, 10, 7, 4); wheel(9, 30, 7, 4); wheel(28, 30, 7, 4);
    R(c.M, 5, 13, 34, 18); R(c.L, 7, 13, 30, 1); R(c.D, 7, 30, 30, 1);
    R(c.M, 14, 16, 11, 12); R(c.L, 14, 16, 11, 1); glass(25, 15, 4, 14); glass(11, 16, 3, 12);
    R(HL, 37, 14, 2, 3); R(HL, 37, 27, 2, 3); R(TL, 5, 14, 1, 3); R(TL, 5, 27, 1, 3);
    cut(5, 13, 34, 18, 4);
  } }));


CAR_DEFS.forEach((d, i) => { d.k = i; });

// What the player sees is a five-star view; the fine values behind it (speed, mud, acc, turn) do the real work.
// soil = share of top speed lost when fully muddy: cars that cope badly with mud pay for it until they wash.

const stars = (v, lo, hi) => clamp(1 + Math.round((v - lo) / (hi - lo) * 4), 1, 5);


[...CAR_DEFS, ...GENERICS].forEach(d => {
  d.tempo = stars(d.speed + .1 * (d.acc - 1), .94, 1.09); d.matsch = stars(d.mud, .8, 1.6);
  d.soil = SOIL_LO + (SOIL_HI - SOIL_LO) * (1 - clamp((d.mud - .8) / .8, 0, 1));
});


GENERICS.forEach((d, i) => { d.k = 20 + i; });


// cups won so far: a car with 'cup: n' is locked until cup n has been won. Saves from before the cups only know
// 'mudracer-unlock' (0 to 3 Grand Prix wins): that count becomes cups 1..n, so cars unlocked back then stay unlocked.
G.cupsWon = [];
try {
  const saved = JSON.parse(localStorage.getItem('mudracer-cups') || 'null');
  if (Array.isArray(saved)) G.cupsWon = saved.filter(n => Number.isInteger(n));
  else G.cupsWon = Array.from({ length: clamp(parseInt(localStorage.getItem('mudracer-unlock') || '0', 10) || 0, 0, 3) }, (_, i) => i + 1);
} catch (e) {}

// the kids mode opens every car
export const isLocked = def => !G.kids && !!def.cup && !G.cupsWon.includes(def.cup);


const DIRT = ['#6b4a2b', '#58391f', '#7d5a36'].map(hex);


const CEM = ['#8c9097', '#a4a9af', '#6f747a'].map(hex);
const GOO = ['#c04dd8', '#a33bbf', '#e38cf5'].map(hex);


export const OUT = [27, 18, 12];


function rotateImg(src, a) {
  const out = new ImageData(SS, SS), s = src.data, o = out.data, c = Math.cos(a), n = Math.sin(a), h = SS / 2;
  for (let y = 0; y < SS; y++) for (let x = 0; x < SS; x++) {
    const dx = x + .5 - h, dy = y + .5 - h;
    const sx = Math.floor(c * dx + n * dy + h), sy = Math.floor(-n * dx + c * dy + h);
    if (sx < 0 || sy < 0 || sx >= SS || sy >= SS) continue;
    const si = (sy * SS + sx) * 4, oi = (y * SS + x) * 4;
    o[oi] = s[si]; o[oi + 1] = s[si + 1]; o[oi + 2] = s[si + 2]; o[oi + 3] = s[si + 3];
  }
  return out;
}


function buildCar(def, k, pal) {
  const base = mk(SS, SS), g = base.getContext('2d');
  const R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const wheel = (x, y, w, h) => { R('#1e1e1e', x, y, w, h); for (let i = x + 1; i < x + w; i += 2) R('#3a3a3a', i, y, 1, h); R('#505050', x, y, w, 1); };
  const glass = (x, y, w, h) => { R('#8fd3f4', x, y, w, h); R('#3b7ea8', x, y + h - 2, w, 2); R('#e6f8ff', x, y + 1, 1, Math.max(1, h >> 2)); };
  const cut = (x, y, w, h, r) => {
    for (let j = 0; j < r; j++) for (let i = 0; i < r; i++) if ((r - i - .5) ** 2 + (r - j - .5) ** 2 > r * r) {
      g.clearRect(x + i, y + j, 1, 1); g.clearRect(x + w - 1 - i, y + j, 1, 1);
      g.clearRect(x + i, y + h - 1 - j, 1, 1); g.clearRect(x + w - 1 - i, y + h - 1 - j, 1, 1);
    }
  };
  def.draw({ R, wheel, glass, cut }, def);
  const src = g.getImageData(0, 0, SS, SS);
  const r = rng(k * 977 + 13), blobs = [];
  for (let i = 0; i < 14; i++) blobs.push([5 + r() * 34, 10 + r() * 24, 2.5 + r() * 4]);
  const frames = [], shadow = [];
  for (let lv = 0; lv < 6; lv++) {
    const img = new ImageData(new Uint8ClampedArray(src.data), SS, SS), d = img.data, amt = lv / 5 * 1.15;
    if (lv) for (let y = 0; y < SS; y++) for (let x = 0; x < SS; x++) {
      const i = (y * SS + x) * 4; if (!d[i + 3]) continue;
      let m = 9; for (const b of blobs) m = Math.min(m, Math.hypot(x - b[0], y - b[1]) / b[2]);
      if (Math.min(m, 2) * .42 + hash(x, y, k) * .35 < amt) { const dc = pal[(hash(x, y, k + 9) * 3) | 0]; d[i] = dc[0]; d[i + 1] = dc[1]; d[i + 2] = dc[2]; }
    }
    const row = []; for (let ri = 0; ri < ROTS; ri++) row.push(toCanvas(outlineImg(rotateImg(img, ri / ROTS * TAU), SS, SS, OUT)));
    frames.push(row);
  }
  for (let ri = 0; ri < ROTS; ri++) {
    const im = outlineImg(rotateImg(src, ri / ROTS * TAU), SS, SS, OUT), d = im.data;
    for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 0;
    shadow.push(toCanvas(im));
  }
  return { frames, shadow };
}

// the rainbow track paints cars with purple glitter goo instead of mud; built the first time it is needed
// sprites (48 turns x 6 dirt levels) are built the first time a car is shown

// cem: the grey set for cars that drove through cement; goo 'oil': the black set of the race circuit
const OIL = ['#17171b', '#26262c', '#0c0c0e'].map(hex);
export function carSet(def, goo, cem) {
  const kind = cem ? 'cem' : goo === 'oil' ? 'oil' : goo ? 'goo' : 'mud', key = '_' + kind;
  return def[key] || (def[key] = buildCar(def, def.k, { cem: CEM, oil: OIL, goo: GOO, mud: DIRT }[kind]));
}


// ---------- paint (Werkstatt): every car can get another colour; 0 is the car's own. Main, dark and light shade ----------
// accent: the matching accents for cars with a livery or a driver (rally: stripes s, panels p/pl, band b/bl; quad: suit p, helmet b/bl)

export const PAINTS = [
  { name: 'ORIGINAL' },
  { name: 'ROT', M: '#e03131', D: '#961c1c', L: '#ff7b7b', accent: { s: '#ffffff', p: '#1b1b22', pl: '#3a3a48', b: '#ffd23f', bl: '#fff08a' } },
  { name: 'ORANGE', M: '#f07a1a', D: '#b44d0c', L: '#ffb45e', accent: { s: '#1f5fd1', p: '#2b2d33', pl: '#4e525c', b: '#ffffff', bl: '#ffffff' } },
  { name: 'GELB', M: '#ffd23f', D: '#c79a06', L: '#fff08a', accent: { s: '#e03131', p: '#1b1b22', pl: '#3a3a48', b: '#3aa845', bl: '#8be08f' } },
  { name: 'GRUEN', M: '#3aa845', D: '#23702b', L: '#8be08f', accent: { s: '#ffd23f', p: '#1b4796', pl: '#2f6fd8', b: '#ffffff', bl: '#ffffff' } },
  { name: 'TUERKIS', M: '#2ec4b6', D: '#1a8a80', L: '#8ff0e6', accent: { s: '#ff5fa2', p: '#1a5a80', pl: '#2f8ab8', b: '#ffd23f', bl: '#fff08a' } },
  { name: 'BLAU', M: '#2f6fd8', D: '#1b4796', L: '#7fb0ff', accent: { s: '#ffd23f', p: '#e03131', pl: '#ff7b7b', b: '#ffffff', bl: '#ffffff' } },
  { name: 'LILA', M: '#8e44ad', D: '#5e2a75', L: '#c79be0', accent: { s: '#3aa845', p: '#ffd23f', pl: '#fff08a', b: '#2ec4b6', bl: '#8ff0e6' } },
  { name: 'PINK', M: '#ff5fa2', D: '#c2306f', L: '#ffa6cc', accent: { s: '#ffffff', p: '#8e44ad', pl: '#c79be0', b: '#2ec4b6', bl: '#8ff0e6' } },
  { name: 'WEISS', M: '#eef3f8', D: '#aab8c6', L: '#ffffff', accent: { s: '#3aa845', p: '#e03131', pl: '#ff7b7b', b: '#2f6fd8', bl: '#7fb0ff' } },
  { name: 'SCHWARZ', M: '#2b2d33', D: '#15161a', L: '#4e525c', accent: { s: '#ff7a1a', p: '#e03131', pl: '#ff7b7b', b: '#ffd23f', bl: '#fff08a' } },
];

const paintKey = def => 'mudracer-paint-' + def.id;

export function setPaint(def, i) {
  if (!def.own) def.own = { M: def.M, D: def.D, L: def.L, accent: def.accent }; // (not 'acc': that is the acceleration)
  const p = i > 0 && PAINTS[i] ? PAINTS[i] : def.own;
  def.M = p.M; def.D = p.D; def.L = p.L; def.accent = p.accent || def.own.accent; def.paint = PAINTS[i] && i > 0 ? i : 0;
  delete def._mud; delete def._goo; delete def._cem; delete def._oil; // the sprites are built again with the new colour
}

export function savePaint(def, i) { setPaint(def, i); try { localStorage.setItem(paintKey(def), String(def.paint)); } catch (e) {} }

CAR_DEFS.forEach(def => { let i = 0; try { i = parseInt(localStorage.getItem(paintKey(def)) || '0', 10) || 0; } catch (e) {} setPaint(def, i); });
