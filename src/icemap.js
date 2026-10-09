import { HALF, TAU, WH, WW, clamp, hash, hex, vnoise } from './core.js';
import { nearestIdx } from './bau.js';

// ---------- Eis: the ski jump, the bob run, the frozen lake with the short cut, the hot spring, the village ----------
// Terrain: 1 packed snow, 0 snow beside the road, 2 deep snow (like mud, it makes the car white), 3 the hot spring (washes),
// 5 the glacier stream (deep water, the road crosses it on a wooden bridge), 12 sheet ice (the bob run, the landing slope, the lake).

const K = Object.fromEntries(Object.entries({
  snow: '#eef4fa', snow1: '#e3ebf4', snow2: '#f9fbfe', snowB: '#cddbea', snowD: '#b7c8da', glit: '#ffffff',
  road: '#dfe6ef', road1: '#d3dbe6', road2: '#e9eef5', roadE: '#aebdcd', rut: '#c6d0dc',
  ice: '#bfe3f3', ice1: '#a9d6ec', ice2: '#d6eef8', iceL: '#ffffff', iceD: '#8cc3e0', lake: '#9fcfe6', lake1: '#8ac2de', lakeE: '#6fa6c8',
  bobW: '#8fb4d0', bobWL: '#d8ecf8', bobWD: '#5f86a6', blue: '#2f6fd8', red: '#d83a2c',
  wood: '#a8743c', woodD: '#6a4420', woodL: '#c99258', roofS: '#f4f8fc', roofD: '#c2d0de', win: '#ffd56a', winD: '#c8902a',
  rock: '#8a96a4', rockD: '#5e6a78', rockL: '#b4c0cc',
}).map(([k, v]) => [k, hex(v)]));

const range = (N, a, b) => { const r = new Uint8Array(N); for (let i = a; ; i = (i + 1) % N) { r[i] = 1; if (i === b) break; } return r; };

// terrain, before the ground is painted. S: { def, ter, dist, near, path, tan, nrm, N }
export function iceTerrain(S) {
  const { def, ter, dist, near, path, N } = S, A = WW * WH, alt = new Uint8Array(A), lakeM = new Uint8Array(A);
  // the frozen lake: everything beside the road inside the ellipse is thin ice (a second way, the short cut)
  if (def.lake) {
    const [lx, ly, rx, ry] = def.lake;
    for (let y = Math.max(0, ly - ry - 6); y < Math.min(WH, ly + ry + 6); y++) for (let x = Math.max(0, lx - rx - 6); x < Math.min(WW, lx + rx + 6); x++) {
      const j = y * WW + x, e = ((x + .5 - lx) / rx) ** 2 + ((y + .5 - ly) / ry) ** 2;
      if (e >= .85 + .3 * vnoise(x * .08, y * .08, 71) || ter[j] !== 0) continue;
      ter[j] = 12; lakeM[j] = 1; alt[j] = 1;
    }
  }
  // the bob run and the landing slope of the ski jump: sheet ice on the road
  const seg = ([a, b]) => range(N, nearestIdx(path, a[0], a[1]), nearestIdx(path, b[0], b[1]));
  const bob = def.bob ? seg(def.bob) : new Uint8Array(N), land = def.landing ? seg(def.landing) : new Uint8Array(N);
  for (let j = 0; j < A; j++) if (dist[j] < HALF && (bob[near[j]] || land[near[j]]) && ter[j] === 1) ter[j] = 12;
  // the hot spring: steaming water that reaches onto the road (it washes the snow off and never freezes)
  if (def.spring) {
    const [sx, sy, rx, ry] = def.spring;
    for (let y = sy - ry - 3; y <= sy + ry + 3; y++) for (let x = sx - rx - 3; x <= sx + rx + 3; x++) {
      if (x < 0 || y < 0 || x >= WW || y >= WH) continue;
      if (((x + .5 - sx) / rx) ** 2 + ((y + .5 - sy) / ry) ** 2 < .85 + .3 * vnoise(x * .2, y * .2, 72)) ter[y * WW + x] = 3;
    }
  }
  // the ski jump: one big ramp across the whole road; the slopes push the cars downhill
  const jumps = [];
  if (def.jump) { const [x, y, vz] = def.jump, i = nearestIdx(path, x, y), p = path[i], t = S.tan[i]; jumps.push({ x: p.x, y: p.y, tx: t.x, ty: t.y, lo: -HALF - 4, hi: HALF + 4, vz }); }
  const pushes = (def.slopes || []).map(([x0, y0, x1, y1, f]) => ({ i0: nearestIdx(path, x0, y0), i1: nearestIdx(path, x1, y1), f }));
  // the corners that freeze from lap 2: their road pixels, from the edge inwards (with a little noise, so it grows like ice flowers)
  const frost = (def.frost || []).map(([x, y]) => {
    const c = nearestIdx(path, x, y), R = range(N, (c - 44 + N) % N, (c + 44) % N), px = [];
    for (let j = 0; j < A; j++) if (dist[j] < HALF && R[near[j]] && ter[j] === 1) px.push(j);
    const key = j => HALF - dist[j] + vnoise(j % WW * .25, (j / WW | 0) * .25, 73) * 9;
    px.sort((a, b) => key(a) - key(b));
    return { px, x, y };
  });
  return { alt, lakeM, bob, jumps, pushes, frost };
}

// painting, after the ground. S: { def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, shore, bridgeMask, isBridge, sd, th, r, critters, darken, RT }
export function paintIce(S) {
  const { def, d, set, setT, path, tan, nrm, N, ter, dist, near, walls, wallMask, shore, bridgeMask, isBridge, sd, RT } = S, A = WW * WH;
  const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < WW && y < WH) set(y * WW + x, c); };
  const dk = (x, y, k) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= WW || y >= WH) return; const i = (y * WW + x) * 4; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; };
  const solid = (x, y, rr) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X >= 0 && Y >= 0 && X < WW && Y < WH) wallMask[Y * WW + X] = 1; } };
  const iceCol = (x, y, h, lake) => {
    // glossy streaks running diagonally, a few cracks and air bubbles
    const st = Math.sin((x - y) * .09 + vnoise(x / 30, y / 30, sd + 50) * 4), v = vnoise(x / 9, y / 9, sd + 51);
    if (lake) return st > .93 ? K.ice2 : h < .012 ? K.iceL : v < .3 ? K.lake1 : K.lake;
    return st > .9 ? K.iceL : st > .6 ? K.ice2 : v < .3 ? K.ice1 : h < .01 ? K.iceD : K.ice;
  };

  // ----- the ground -----
  for (let j = 0; j < A; j++) {
    const x = j % WW, y = j / WW | 0, t = ter[j], h = hash(x, y, sd + 40), v = vnoise(x / 8, y / 8, sd + 41) * .55 + h * .45;
    if (bridgeMask[j] || shore[j]) continue;
    let c;
    if (t === 0) {
      if (dist[j] < HALF + 3) c = dist[j] < HALF + 1.5 ? K.snowD : K.snowB; // a snow bank along the road
      else { const dr = vnoise(x / 40, y / 30, sd + 42); c = dr < .3 ? K.snow1 : dr > .7 ? K.snow2 : K.snow; if (v < .2) c = K.snow1; if (h < .006) c = K.glit; }
    } else if (t === 1 || t === 4) {
      if (t === 4) continue;
      c = v < .33 ? K.road1 : v > .7 ? K.road2 : K.road;
      if (dist[j] > HALF - 3) c = K.roadE; else if (Math.abs(dist[j] - 13) < 1.5 && h > .3) c = K.rut;
    } else if (t === 12) {
      const lake = RT.lakeM[j];
      if (lake) { let e = false; for (const q of [j - 1, j + 1, j - WW, j + WW]) if (q >= 0 && q < A && ter[q] !== 12) e = true; c = e ? K.lakeE : iceCol(x, y, h, true); }
      else c = dist[j] > HALF - 2 ? K.iceD : iceCol(x, y, h, false);
    } else continue;
    set(j, c);
  }
  // start line (chequered)
  S.band(0, 6, (x, y, a, c) => { if (Math.abs(c) < HALF) set(y * WW + x, ((Math.floor(a + 6) >> 2) + (Math.floor(c + 100) >> 2)) & 1 ? [245, 245, 240] : [34, 30, 28]); });

  // ----- the ski jump: blue lines along the run-up, the take-off table with flags, a red line where the good jumps land -----
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
    const kI = (i0 + 85) % N, kp = path[kI];
    for (let w = -HALF + 1; w <= HALF - 1; w++) { px(kp.x + nrm[kI].x * w, kp.y + nrm[kI].y * w, K.red); px(kp.x + nrm[kI].x * w + tan[kI].x, kp.y + nrm[kI].y * w + tan[kI].y, K.red); }
  }

  // ----- the bob run: high walls of blue ice on both sides; they are springy (see update.js) -----
  for (let i = 0; i < N; i += 2) {
    if (!RT.bob[i]) continue;
    for (const s of [-1, 1]) walls.push({ x: path[i].x + nrm[i].x * s * (HALF + 3), y: path[i].y + nrm[i].y * s * (HALF + 3), r: 3, bob: 1 });
  }
  for (let j = 0; j < A; j++) {
    if (!RT.bob[near[j]] || dist[j] < HALF - .5 || dist[j] > HALF + 7) continue;
    const dd = dist[j] - HALF, x = j % WW, y = j / WW | 0;
    set(j, dd < 1 ? K.bobWL : dd < 4.5 ? ((x + y) % 9 === 0 ? K.bobWL : K.bobW) : dd < 6 ? K.bobWD : K.snowD);
    if (dd >= 6) wallMask[j] = 1;
  }

  // ----- the wooden bridge over the glacier stream: solid rails with icicles -----
  for (let i = 0; i < N; i += 3) if (isBridge[i]) for (const s of [-1, 1]) walls.push({ x: path[i].x + nrm[i].x * s * HALF, y: path[i].y + nrm[i].y * s * HALF, r: 3 });
  for (let j = 0; j < A; j++) {
    if (!isBridge[near[j]] || dist[j] < HALF - 2.5 || dist[j] > HALF + 4) continue;
    const dd = dist[j] - HALF, i = near[j];
    if (dd > 1.5) { if (ter[j] === 5 && (i % 4 < 2) && dd < 4) set(j, [230, 246, 255]); continue; } // icicles hanging over the water
    set(j, i % 8 < 2 ? K.woodD : dd < -1 ? K.woodL : K.wood);
  }

  // ----- the hot spring: grey stones round it -----
  if (def.spring) {
    const [sx, sy, rx, ry] = def.spring;
    for (let k = 0; k < 22; k++) {
      const a = k / 22 * TAU, x = Math.round(sx + Math.cos(a) * (rx + 3)), y = Math.round(sy + Math.sin(a) * (ry + 3)), j = clamp(y, 0, WH - 1) * WW + clamp(x, 0, WW - 1);
      if (dist[j] < HALF + 2 || ter[j] === 3) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx / 9 + dy * dy / 4 <= 1) px(x + dx, y + dy, dy < 0 ? K.rockL : dy > 0 ? K.rockD : K.rock);
    }
  }

  // ----- the village at the start: a ski hut with warm windows (roof on the top layer), a snowman, a sledge at the fence -----
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
      wallMask[y * WW + x] = 1;
    }
    for (let x = x0 + 4; x < x0 + w - 4; x += 8) for (let k = 0; k < 3; k++) setT(x + k, y0 + h, K.win), setT(x + k, y0 + h + 1, K.winD);
    for (let yy = -4; yy <= 0; yy++) for (let xx = 0; xx < 5; xx++) setT(x0 + w - 10 + xx, y0 + 6 + yy, xx === 0 || xx === 4 ? [90, 60, 40] : [140, 90, 60]); // chimney
    for (let k = -w / 2 + 4; k <= w / 2 - 4; k += 8) for (const s of [-1, 1]) walls.push({ x: hx + k, y: hy + s * (h / 2 - 4), r: 6 });
    snowman(hx + 32, hy - 24); snowman(hx - 30, hy - 70);
    // the sledge at a fence
    for (let k = 0; k < 30; k++) { px(hx - 20 + k, hy + 26, K.woodD); if (k % 6 === 0) for (let q = -2; q <= 1; q++) px(hx - 20 + k, hy + 26 + q, K.wood); }
    for (let k = 0; k < 12; k++) { px(hx - 14 + k, hy + 29, K.red); px(hx - 14 + k, hy + 32, K.red); if (k % 4 === 0) for (let q = 29; q <= 32; q++) px(hx - 14 + k, hy + q, K.woodL); }
  }
  // more snowmen out in the snow
  const okOff = (x, y, m) => { for (let dy = -m; dy <= m; dy += 2) for (let dx = -m; dx <= m; dx += 2) { const X = x + dx, Y = y + dy; if (X < 2 || Y < 2 || X >= WW - 2 || Y >= WH - 2) return false; const j = Y * WW + X; if (ter[j] !== 0 || dist[j] < HALF + 10 || wallMask[j] || shore[j]) return false; } return true; };
  for (let k = 0, tries = 0; k < 4 && tries < 500; tries++) { const x = 8 + (S.r() * (WW - 16) | 0), y = 8 + (S.r() * (WH - 16) | 0); if (okOff(x, y, 9)) { snowman(x, y); k++; } }

  // ----- the penguin colony: an ice floe with rocks (the penguins are drawn while racing) -----
  let colony = null;
  if (def.colony) {
    const [cx, cy] = def.colony;
    for (let y = cy - 22; y <= cy + 22; y++) for (let x = cx - 34; x <= cx + 34; x++) {
      const j = y * WW + x; if (x < 0 || y < 0 || x >= WW || y >= WH || ter[j] !== 0 || dist[j] < HALF + 6) continue;
      const e = ((x - cx) / 34) ** 2 + ((y - cy) / 22) ** 2; if (e > .9 + .2 * vnoise(x * .2, y * .2, 74)) continue;
      set(j, e > .8 ? K.iceD : iceCol(x, y, hash(x, y, 75), false)); wallMask[j] = 1;
    }
    for (const [dx, dy] of [[-22, -10], [18, 8], [26, -12]]) for (let yy = -4; yy <= 4; yy++) for (let xx = -5; xx <= 5; xx++) if (xx * xx / 25 + yy * yy / 16 <= 1) px(cx + dx + xx, cy + dy + yy, yy < -1 ? K.rockL : yy > 1 ? K.rockD : K.rock);
    colony = { x: cx, y: cy };
  }
  // the ski lift along the left edge of the map: masts (the cable and the gondolas move while racing)
  const lift = { x: 18, y0: 14, y1: 436 };
  for (let y = lift.y0; y <= lift.y1; y += 70) { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) px(lift.x + dx, y + dy, Math.abs(dx) === 2 || Math.abs(dy) === 2 ? K.rockD : [150, 156, 166]); walls.push({ x: lift.x, y, r: 3 }); for (let dx = 1; dx <= 6; dx++) dk(lift.x + 2 + dx, y + 3, .8); }

  const lakeCells = new Map();
  return { jumps: RT.jumps, pushes: RT.pushes, alt: RT.alt, lakeM: RT.lakeM, frost: RT.frost, colony, lift, lakeCells,
    spring: def.spring, lake: def.lake, avalanche: def.avalanche,
    short: def.lake ? { a: nearestIdx(path, 560, 395), x0: 560, x1: 262, y: 395 } : null };
}
