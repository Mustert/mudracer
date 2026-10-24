import { HALF, hash, hex, vnoise } from './core.js';
import { nearestIdx, paintTools, startLine } from './bau.js';

// ---------- Eis Rev 2: the winter-sports mountain (plaene/EIS_REV2.md) ----------
// Terrain: 1 packed snow (the road), 0 snow beside the road, 2 deep snow (like mud, it makes the car white), 12 sheet ice (the bob run, the lake),
// 71 powder snow (the open field in the pine wood, a little slower than the road, it does not make the car white).
// The map is tall (1000 x 1500): the lift on the left edge, the bob run on top, the wood, the serpentines on the right, the lake at the bottom.
// Nothing can be cut off: the fence between lift and wood, solid massifs at the edge, ridges and cliffs between the serpentines (CLAUDE.md, principle 4).

export const POWDER = 71;

const K = Object.fromEntries(Object.entries({
  snow: '#eef4fa', snow1: '#e3ebf4', snow2: '#f9fbfe', snowB: '#cddbea', snowD: '#b7c8da', glit: '#ffffff',
  pow: '#f2f7fc', pow1: '#e6eef7', pow2: '#fbfdff', powT: '#cfdcea',
  road: '#dfe6ef', road1: '#d3dbe6', road2: '#e9eef5', roadE: '#aebdcd', rut: '#c6d0dc',
  ice: '#bfe3f3', ice1: '#a9d6ec', ice2: '#d6eef8', iceL: '#ffffff', iceD: '#8cc3e0', lake: '#9fcfe6', lake1: '#8ac2de', lakeE: '#6fa6c8',
  bobW: '#8fb4d0', bobWL: '#d8ecf8', bobWD: '#5f86a6', blue: '#2f6fd8', red: '#d83a2c',
  wood: '#a8743c', woodD: '#6a4420', woodL: '#c99258', roofS: '#f4f8fc', roofD: '#c2d0de', win: '#ffd56a', winD: '#c8902a',
  rock: '#8a96a4', rockD: '#5e6a78', rockL: '#b4c0cc', rockDD: '#3e4856',
}).map(([k, v]) => [k, hex(v)]));

const range = (N, a, b) => { const r = new Uint8Array(N); for (let i = a; ; i = (i + 1) % N) { r[i] = 1; if (i === b) break; } return r; };

// the rectangle round a stretch of the centre line (a loop over pixels never runs over the whole map)
function boxOf(path, R, pad) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < path.length; i++) if (R[i]) { const p = path[i]; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return [Math.floor(x0 - pad), Math.floor(y0 - pad), Math.ceil(x1 + pad), Math.ceil(y1 + pad)];
}

const inPoly = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };

// terrain, before the ground is painted. S: { def, ter, dist, near, path, tan, nrm, N }
export function* iceTerrain(S) {
  const { MW, MH, def, ter, dist, near, path, N } = S, A = MW * MH, alt = new Uint8Array(A), lakeM = new Uint8Array(A), fieldM = new Uint8Array(A);
  yield;
  // the frozen lake: an oval with a ragged rim, the road across it is ice too
  const [lx, ly, rx, ry] = def.lake;
  for (let y = Math.max(0, ly - ry - 8); y < Math.min(MH, ly + ry + 8); y++) for (let x = Math.max(0, lx - rx - 8); x < Math.min(MW, lx + rx + 8); x++) {
    const j = y * MW + x, e = ((x + .5 - lx) / rx) ** 2 + ((y + .5 - ly) / ry) ** 2;
    if (e >= .9 + .2 * vnoise(x * .05, y * .05, 71) || (ter[j] !== 0 && ter[j] !== 1)) continue;
    ter[j] = 12; lakeM[j] = 1;
  }
  yield;
  // the wood: an open field of powder snow, the road through it is powder too (like the rally sand of the desert: no way back arrow, c.safe counts)
  const iA = nearestIdx(path, def.jump[0], def.jump[1]), iB = nearestIdx(path, 300, 1000), F = def.field;
  const fx0 = Math.min(...F.map(p => p[0])), fx1 = Math.max(...F.map(p => p[0])), fy0 = Math.min(...F.map(p => p[1])), fy1 = Math.max(...F.map(p => p[1]));
  for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) {
    if (!inPoly(F, x + .5, y + .5)) continue;
    const j = y * MW + x; fieldM[j] = 1; alt[j] = 1;
    if (ter[j] === 0 || (ter[j] === 1 && near[j] > iA && near[j] < iB)) ter[j] = POWDER;
  }
  yield;
  // the bob run: sheet ice on the road
  const seg = ([a, b]) => range(N, nearestIdx(path, a[0], a[1]), nearestIdx(path, b[0], b[1]));
  const bob = seg(def.bob), [bx0, by0, bx1, by1] = boxOf(path, bob, HALF + 10);
  for (let y = Math.max(0, by0); y <= Math.min(MH - 1, by1); y++) for (let x = Math.max(0, bx0); x <= Math.min(MW - 1, bx1); x++) {
    const j = y * MW + x; if (dist[j] < HALF && bob[near[j]] && ter[j] === 1) ter[j] = 12;
  }
  yield;
  // the ski jump: one big ramp across the whole road
  const jumps = [], [jx, jy, vz] = def.jump, ji = nearestIdx(path, jx, jy), jp = path[ji], jt = S.tan[ji];
  jumps.push({ x: jp.x, y: jp.y, tx: jt.x, ty: jt.y, lo: -HALF - 4, hi: HALF + 4, vz });
  const pushes = (def.slopes || []).map(([x0, y0, x1, y1, f]) => ({ i0: nearestIdx(path, x0, y0), i1: nearestIdx(path, x1, y1), f }));
  return { alt, lakeM, fieldM, bob, jumps, pushes };
}

// painting, after the ground. S: { def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, shore, bridgeMask, sd, r, RT }
export function* paintIce(S) {
  const { MW, MH, def, set, setT, path, nrm, N, ter, dist, near, walls, wallMask, shore, bridgeMask, sd, RT } = S, A = MW * MH;
  const { px, dk, solid } = paintTools(S);
  const iceCol = (x, y, h, lake) => {
    // glossy streaks running diagonally, a few cracks and air bubbles
    const st = Math.sin((x - y) * .09 + vnoise(x / 30, y / 30, sd + 50) * 4), v = vnoise(x / 9, y / 9, sd + 51);
    if (lake) return st > .93 ? K.ice2 : h < .012 ? K.iceL : v < .3 ? K.lake1 : K.lake;
    return st > .9 ? K.iceL : st > .6 ? K.ice2 : v < .3 ? K.ice1 : h < .01 ? K.iceD : K.ice;
  };

  yield;
  // ----- the ground -----
  for (let j = 0; j < A; j++) {
    if (j % 40000 === 39999) yield;
    const t = ter[j]; if (bridgeMask[j] || shore[j]) continue;
    const x = j % MW, y = j / MW | 0, h = hash(x, y, sd + 40), v = vnoise(x / 8, y / 8, sd + 41) * .55 + h * .45;
    let c;
    if (t === 0) {
      if (dist[j] < HALF + 3) c = dist[j] < HALF + 1.5 ? K.snowB : K.snow1; // a flat, pale snow bank along the road (you drive over it; solid things are dark and cast a shadow)
      else { const dr = vnoise(x / 40, y / 30, sd + 42); c = dr < .3 ? K.snow1 : dr > .7 ? K.snow2 : K.snow; if (v < .2) c = K.snow1; if (h < .006) c = K.glit; }
    } else if (t === POWDER) {
      // powder snow: soft and bright, the old ski tracks as faint curves
      const trk = Math.abs(Math.sin(x * .045 + Math.sin(y * .02) * 3)) > .995;
      c = trk ? K.powT : v < .25 ? K.pow1 : v > .72 ? K.pow2 : K.pow; if (h < .005) c = K.glit;
    } else if (t === 1) {
      c = v < .33 ? K.road1 : v > .7 ? K.road2 : K.road;
      if (dist[j] > HALF - 3) c = K.roadE; else if (Math.abs(dist[j] - 13) < 1.5 && h > .3) c = K.rut;
    } else if (t === 12) {
      if (RT.lakeM[j]) { let e = false; for (const q of [j - 1, j + 1, j - MW, j + MW]) if (q >= 0 && q < A && ter[q] !== 12) e = true; c = e ? K.lakeE : iceCol(x, y, h, true); }
      else c = dist[j] > HALF - 2 ? K.iceD : iceCol(x, y, h, false);
    } else continue;
    set(j, c);
  }
  yield;
  startLine(S);

  yield;
  // ----- the ski jump: blue lines along the run-up, the take-off table with flags -----
  for (const J of RT.jumps) {
    const i0 = nearestIdx(path, J.x, J.y);
    for (let k = -70; k <= 0; k++) { const i = (i0 + k + N) % N, p = path[i]; for (const s of [-1, 1]) for (const w of [HALF - 6, HALF - 7]) px(p.x + nrm[i].x * s * w, p.y + nrm[i].y * s * w, K.blue); }
    for (let k = -8; k <= 0; k++) { const i = (i0 + k + N) % N, p = path[i]; for (let w = -HALF + 2; w <= HALF - 2; w++) px(p.x + nrm[i].x * w, p.y + nrm[i].y * w, k === 0 ? K.woodD : (k & 1) ? K.woodL : K.wood); }
    for (const s of [-1, 1]) {
      const p = path[i0], fx = Math.round(p.x + nrm[i0].x * s * (HALF + 6)), fy = Math.round(p.y + nrm[i0].y * s * (HALF + 6));
      walls.push({ x: fx, y: fy, r: 2 });
      for (let k = 0; k < 10; k++) setT(fx, fy - k, [70, 70, 76]);
      for (let yy = 0; yy < 5; yy++) for (let xx = 1; xx < 8; xx++) setT(fx + xx, fy - 9 + yy, (xx + yy) & 1 ? (s < 0 ? K.red : K.blue) : [255, 255, 255]);
    }
  }

  yield;
  // ----- the bob run: high walls of blue ice on both sides; they are springy (see update.js) -----
  for (let i = 0; i < N; i += 2) {
    if (!RT.bob[i]) continue;
    for (const s of [-1, 1]) walls.push({ x: path[i].x + nrm[i].x * s * (HALF + 3), y: path[i].y + nrm[i].y * s * (HALF + 3), r: 3, bob: 1 });
  }
  const [bx0, by0, bx1, by1] = boxOf(path, RT.bob, HALF + 12);
  for (let y = Math.max(0, by0); y <= Math.min(MH - 1, by1); y++) for (let x = Math.max(0, bx0); x <= Math.min(MW - 1, bx1); x++) {
    const j = y * MW + x; if (!RT.bob[near[j]] || dist[j] < HALF - .5 || dist[j] > HALF + 7) continue;
    const dd = dist[j] - HALF;
    set(j, dd < 1 ? K.bobWL : dd < 4.5 ? ((x + y) % 9 === 0 ? K.bobWL : K.bobW) : dd < 6 ? K.bobWD : K.snowD);
    if (dd >= 6) wallMask[j] = 1;
  }

  yield;
  // ----- solid massifs: snow-covered rock, a dark cliff face all round, a ring of solid circles along the cliff (5 px apart, r 5) -----
  for (const [x0, y0, x1, y1] of def.blocks) {
    for (let y = Math.max(0, y0); y < Math.min(MH, y1); y++) for (let x = Math.max(0, x0); x < Math.min(MW, x1); x++) {
      const j = y * MW + x; wallMask[j] = 1;
      const e = Math.min(x - x0 + (x0 <= 0 ? 99 : 0), x1 - 1 - x + (x1 >= MW ? 99 : 0), y - y0 + (y0 <= 0 ? 99 : 0), y1 - 1 - y + (y1 >= MH ? 99 : 0)), h = hash(x, y, sd + 60), v = vnoise(x / 13, y / 13, sd + 61), sn = vnoise(x / 7, y / 7, sd + 62);
      let c;
      if (e < 4) c = e < 1 ? K.rockDD : e < 2 ? K.rockD : (x + y) & 1 ? K.rockD : K.rock;
      else c = v > .62 ? (sn > .55 ? K.rockL : K.rock) : v < .3 ? K.snow2 : sn > .6 ? K.snow : K.snow1;
      if (h < .01) c = K.iceL;
      set(j, c);
    }
    // a shadow on the snow south and east of the massif
    for (let y = y1; y < Math.min(MH, y1 + 8); y++) for (let x = Math.max(0, x0); x < Math.min(MW, x1 + 8); x++) if (!wallMask[y * MW + x]) dk(x, y, 1 - .22 * (1 - (y - y1) / 8));
    const ring = (ax, ay, bx, by) => { const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 5); for (let k = 0; k <= n; k++) walls.push({ x: ax + (bx - ax) * k / n, y: ay + (by - ay) * k / n, r: 5 }); };
    if (y0 > 0) ring(x0 + 3, y0 + 3, x1 - 3, y0 + 3); if (y1 < MH) ring(x0 + 3, y1 - 3, x1 - 3, y1 - 3);
    if (x0 > 0) ring(x0 + 3, y0 + 3, x0 + 3, y1 - 3); if (x1 < MW) ring(x1 - 3, y0 + 3, x1 - 3, y1 - 3);
  }

  yield;
  // ----- ridges and cliffs: solid grey rock capped with snow, a shadow on the south side, a row of solid circles (the circles are as big as the rock) -----
  const rockLine = (x0, y0, x1, y1, w, cliff) => {
    const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len, n = Math.ceil(len / Math.max(5.5, w * .8));
    for (let k = 0; k <= n; k++) walls.push({ x: x0 + (x1 - x0) * k / n, y: y0 + (y1 - y0) * k / n, r: w });
    for (let a = -w; a <= len + w; a++) {
      const wob = (vnoise(a * .09, 5, sd + 64) - .5) * 3;
      for (let b = -w - 6; b <= w + 6; b++) {
        const X = x0 + ux * a - uy * (b + wob), Y = y0 + uy * a + ux * (b + wob), t = Math.abs(b), end = a < 0 ? -a : a > len ? a - len : 0;
        if (Math.hypot(t, end) > w + 5) continue;
        if (Math.hypot(t, end) <= w) {
          solid(X, Y, 1);
          px(X, Y, t > w - 1.5 ? K.rockDD : hash(a, b, sd + 65) < .35 ? K.rockL : b < -1 ? K.snow2 : b > w * (cliff ? .1 : .4) ? K.rockD : K.rock);
        } else if (b > 0) dk(X, Y, .84 - .02 * (Math.hypot(t, end) - w)); // shadow to one side
      }
    }
    for (let a = 4; a < len - 3; a += 9) { const b = (hash(a, 7, sd + 66) - .5) * 3, X = x0 + ux * a - uy * b, Y = y0 + uy * a + ux * b; px(X, Y, K.snow2); px(X + 1, Y, K.snow2); }
  };
  for (const [x0, y0, x1, y1, w] of def.ridges) rockLine(x0, y0, x1, y1, w, false);
  yield;
  // the cliffs between the serpentine legs: high rock with a hard shadow edge to the south
  for (const [x0, y0, x1, y1] of def.klippen) rockLine(x0, y0, x1, y1, 20, true);

  yield;
  // ----- the fence between the lift and the wood: solid (circles every 5 px), dark rails and posts with a shadow -----
  { const [fx, fy0, fy1] = def.fence;
    for (let y = fy0; y <= fy1; y += 5) walls.push({ x: fx, y, r: 3 });
    for (let y = fy0; y <= fy1; y++) {
      for (let dx = 2; dx <= 6; dx++) dk(fx + dx, y, .84 - .02 * dx);
      for (let dx = -2; dx <= 2; dx++) px(fx + dx, y, dx === 0 ? K.woodL : dx < 0 ? K.wood : K.woodD);
      if (y % 14 < 3) for (let dx = -3; dx <= 3; dx++) px(fx + dx, y, Math.abs(dx) === 3 ? K.woodD : K.woodL);
    }
    for (let y = fy0; y <= fy1; y++) solid(fx, y, 3); }

  yield;
  // ----- the village at the start: a ski hut with warm windows (roof on the top layer), snowmen -----
  const snowman = (x, y) => {
    walls.push({ x, y, r: 5 }); solid(x, y, 7);
    for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 8; dx++) dk(x + 2 + dx, y + 3 + dy, .85);
    for (const [cx, cy, rr] of [[x, y + 2, 5], [x, y - 4, 3.6]]) for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const dd = Math.hypot(dx, dy); if (dd <= rr) setT(cx + dx, cy + dy, dd > rr - 1 ? K.snowD : dx + dy < -1 ? [255, 255, 255] : K.snow); }
    setT(x - 1, y - 5, [30, 30, 30]); setT(x + 1, y - 5, [30, 30, 30]); setT(x + 2, y - 4, [240, 120, 30]); setT(x + 3, y - 4, [240, 120, 30]);
    for (let k = -3; k <= 3; k++) setT(x + k, y - 1, K.red);
    setT(x, y + 1, [30, 30, 30]); setT(x, y + 3, [30, 30, 30]);
  };
  if (def.village) {
    const [hx, hy] = def.village, w = 38, h = 30, x0 = hx - w / 2, y0 = hy - h / 2;
    for (let y = y0 + 4; y < y0 + h + 6; y++) for (let x = x0 + 6; x < x0 + w + 6; x++) dk(x, y, .78);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const dy = y - y0, dx = x - x0, ridge = Math.abs(dy - h / 2);
      // a snowy gable roof seen from above, the ridge along the middle, beams at the eaves
      setT(x, y, dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1 ? K.woodD : ridge < 1 ? K.roofD : dy < h / 2 ? K.roofS : (dx % 6 === 0 ? K.roofD : [228, 236, 244]));
      wallMask[y * MW + x] = 1;
    }
    for (let x = x0 + 4; x < x0 + w - 4; x += 8) for (let k = 0; k < 3; k++) setT(x + k, y0 + h, K.win), setT(x + k, y0 + h + 1, K.winD);
    for (let yy = -4; yy <= 0; yy++) for (let xx = 0; xx < 5; xx++) setT(x0 + w - 10 + xx, y0 + 6 + yy, xx === 0 || xx === 4 ? [90, 60, 40] : [140, 90, 60]); // chimney
    for (let k = -w / 2 + 4; k <= w / 2 - 4; k += 8) for (const s of [-1, 1]) walls.push({ x: hx + k, y: hy + s * (h / 2 - 4), r: 6 });
    snowman(hx + 32, hy - 24); snowman(hx + 38, hy + 44);
  }
  yield;
  // more snowmen out in the snow
  const okOff = (x, y, m) => { for (let dy = -m; dy <= m; dy += 2) for (let dx = -m; dx <= m; dx += 2) { const X = x + dx, Y = y + dy; if (X < 2 || Y < 2 || X >= MW - 2 || Y >= MH - 2) return false; const j = Y * MW + X; if (ter[j] !== 0 || dist[j] < HALF + 10 || wallMask[j] || shore[j]) return false; } return true; };
  for (let k = 0, tries = 0; k < 6 && tries < 800; tries++) { const x = 8 + (S.r() * (MW - 16) | 0), y = 8 + (S.r() * (MH - 16) | 0); if (okOff(x, y, 9)) { snowman(x, y); k++; } }

  return { jumps: RT.jumps, pushes: RT.pushes, alt: RT.alt, lakeM: RT.lakeM, fieldM: RT.fieldM, lake: def.lake, lift: def.lift };
}
