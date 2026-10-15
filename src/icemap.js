import { HALF, TAU, clamp, hash, hex, vnoise } from './core.js';
import { nearestIdx, paintTools, startLine } from './bau.js';

// ---------- Eis: the ski jump, the bob run, the frozen lake with the short cut, the hot spring, the village ----------
// Terrain: 1 packed snow, 0 snow beside the road, 2 deep snow (like mud, it makes the car white), 3 the hot spring (washes),
// 5 the glacier stream (deep water, the road crosses it on a wooden bridge), 12 sheet ice (the bob run, the landing slope, the lake).
// The infield north of the lake is one big glacier (solid, a ring of circles along its cliff); its tongue ends in the ice gate where the stream
// starts. Rock ridges close the gap between the two legs on the right and the slope of the avalanche: nobody cuts through the middle.

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
export function* iceTerrain(S) {
  const { MW, MH, def, ter, dist, near, path, N } = S, A = MW * MH, alt = new Uint8Array(A), lakeM = new Uint8Array(A);
  yield;
  // the frozen lake: everything beside the road inside the ellipse is thin ice (a second way, the short cut)
  if (def.lake) {
    const [lx, ly, rx, ry] = def.lake;
    for (let y = Math.max(0, ly - ry - 6); y < Math.min(MH, ly + ry + 6); y++) for (let x = Math.max(0, lx - rx - 6); x < Math.min(MW, lx + rx + 6); x++) {
      const j = y * MW + x, e = ((x + .5 - lx) / rx) ** 2 + ((y + .5 - ly) / ry) ** 2;
      if (e >= .85 + .3 * vnoise(x * .08, y * .08, 71) || ter[j] !== 0) continue;
      ter[j] = 12; lakeM[j] = 1; alt[j] = 1;
    }
  }
  yield;
  // the glacier fills the infield (it is solid, see paintIce); the bay at its foot is the penguin colony. Only where there is room beside the road
  const glac = new Uint8Array(A);
  if (def.glacier) {
    const { rects, bay } = def.glacier;
    for (const [x0, y0, x1, y1, wave] of rects) for (let y = y0; y <= y1 + (wave || 0); y++) for (let x = x0; x <= x1; x++) {
      const j = y * MW + x;
      if (ter[j] !== 0 || dist[j] < HALF + 8) continue;
      if (wave && y > y1 + (vnoise(x * .05, 3, 74) - .5) * wave) continue;
      if (bay && ((x - bay[0]) / bay[2]) ** 2 + ((y - bay[1]) / bay[3]) ** 2 < 1 + .25 * (vnoise(x * .1, y * .1, 75) - .5)) continue;
      glac[j] = 1;
    }
  }
  yield;
  // the bob run and the landing slope of the ski jump: sheet ice on the road
  const seg = ([a, b]) => range(N, nearestIdx(path, a[0], a[1]), nearestIdx(path, b[0], b[1]));
  const bob = def.bob ? seg(def.bob) : new Uint8Array(N), land = def.landing ? seg(def.landing) : new Uint8Array(N);
  for (let j = 0; j < A; j++) if (dist[j] < HALF && (bob[near[j]] || land[near[j]]) && ter[j] === 1) ter[j] = 12;
  // snow drifts on the outside of a bend: deep snow that grows in from the edge of the road, the inner line stays clean
  const driftM = new Uint8Array(A);
  for (const [dx, dy, len, depth, sx, sy] of def.drifts || []) {
    const i0 = nearestIdx(path, dx, dy), q = nearestIdx(path, sx, sy), side = Math.sign((sx - path[q].x) * S.nrm[q].x + (sy - path[q].y) * S.nrm[q].y) || 1;
    for (let y = Math.max(0, dy - 2 * len - HALF - 6); y < Math.min(MH, dy + 2 * len + HALF + 6); y++) for (let x = Math.max(0, dx - 2 * len - HALF - 6); x < Math.min(MW, dx + 2 * len + HALF + 6); x++) {
      const j = y * MW + x; if (ter[j] !== 1) continue;
      const i = near[j], k = ((i - i0 + N + N / 2) % N) - N / 2; if (Math.abs(k) > len) continue;
      const n = S.nrm[i], p = path[i], w = (x + .5 - p.x) * n.x + (y + .5 - p.y) * n.y, u = Math.sin(Math.PI * (k + len) / (2 * len)) ** .7;
      if (w * side > HALF - depth * u * (.75 + .5 * vnoise(x * .12, y * .12, 77))) { ter[j] = 2; driftM[j] = 1; }
    }
  }
  yield;
  // the hot spring: steaming water that reaches onto the road (it washes the snow off and never freezes)
  if (def.spring) {
    const [sx, sy, rx, ry] = def.spring;
    for (let y = sy - ry - 3; y <= sy + ry + 3; y++) for (let x = sx - rx - 3; x <= sx + rx + 3; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      if (((x + .5 - sx) / rx) ** 2 + ((y + .5 - sy) / ry) ** 2 < .85 + .3 * vnoise(x * .2, y * .2, 72)) ter[y * MW + x] = 3;
    }
  }
  yield;
  // the ski jump: one big ramp across the whole road; the slopes push the cars downhill
  const jumps = [];
  if (def.jump) { const [x, y, vz] = def.jump, i = nearestIdx(path, x, y), p = path[i], t = S.tan[i]; jumps.push({ x: p.x, y: p.y, tx: t.x, ty: t.y, lo: -HALF - 4, hi: HALF + 4, vz }); }
  const pushes = (def.slopes || []).map(([x0, y0, x1, y1, f]) => ({ i0: nearestIdx(path, x0, y0), i1: nearestIdx(path, x1, y1), f }));
  yield;
  // the corners that freeze from lap 2: their road pixels, from the edge inwards (with a little noise, so it grows like ice flowers)
  const frost = (def.frost || []).map(([x, y]) => {
    const c = nearestIdx(path, x, y), R = range(N, (c - 44 + N) % N, (c + 44) % N), px = [];
    for (let j = 0; j < A; j++) if (dist[j] < HALF && R[near[j]] && ter[j] === 1) px.push(j);
    const key = j => HALF - dist[j] + vnoise(j % MW * .25, (j / MW | 0) * .25, 73) * 9;
    px.sort((a, b) => key(a) - key(b));
    return { px, x, y };
  });
  return { alt, lakeM, glac, driftM, bob, jumps, pushes, frost };
}

// painting, after the ground. S: { def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, shore, bridgeMask, isBridge, sd, th, r, critters, darken, RT }
export function* paintIce(S) {
  const { MW, MH, def, set, setT, path, tan, nrm, N, ter, dist, near, walls, wallMask, shore, bridgeMask, isBridge, sd, RT } = S, A = MW * MH;
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
    const x = j % MW, y = j / MW | 0, t = ter[j], h = hash(x, y, sd + 40), v = vnoise(x / 8, y / 8, sd + 41) * .55 + h * .45;
    if (bridgeMask[j] || shore[j]) continue;
    let c;
    if (t === 0) {
      if (dist[j] < HALF + 3) c = dist[j] < HALF + 1.5 ? K.snowB : K.snow1; // a flat, pale snow bank along the road (you drive over it; solid things are dark and cast a shadow)
      else { const dr = vnoise(x / 40, y / 30, sd + 42); c = dr < .3 ? K.snow1 : dr > .7 ? K.snow2 : K.snow; if (v < .2) c = K.snow1; if (h < .006) c = K.glit; }
    } else if (t === 1 || t === 4) {
      if (t === 4) continue;
      c = v < .33 ? K.road1 : v > .7 ? K.road2 : K.road;
      if (dist[j] > HALF - 3) c = K.roadE; else if (Math.abs(dist[j] - 13) < 1.5 && h > .3) c = K.rut;
    } else if (t === 2 && RT.driftM[j]) {
      // a wind-blown drift: ripples across it, a soft edge towards the clean road
      let e = false; for (const q of [j - 2, j + 2, j - 2 * MW, j + 2 * MW]) if (q >= 0 && q < A && ter[q] === 1) e = true;
      c = e ? K.snowB : Math.sin((x * .8 + y * .5) + vnoise(x / 10, y / 10, sd + 43) * 6) > .55 ? K.snow2 : v < .3 ? K.snow1 : K.snow;
    } else if (t === 12) {
      const lake = RT.lakeM[j];
      if (lake) { let e = false; for (const q of [j - 1, j + 1, j - MW, j + MW]) if (q >= 0 && q < A && ter[q] !== 12) e = true; c = e ? K.lakeE : iceCol(x, y, h, true); }
      else c = dist[j] > HALF - 2 ? K.iceD : iceCol(x, y, h, false);
    } else continue;
    set(j, c);
  }
  yield;
  // start line (chequered)
  startLine(S);

  yield;
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

  yield;
  // ----- the bob run: high walls of blue ice on both sides; they are springy (see update.js) -----
  for (let i = 0; i < N; i += 2) {
    if (!RT.bob[i]) continue;
    for (const s of [-1, 1]) walls.push({ x: path[i].x + nrm[i].x * s * (HALF + 3), y: path[i].y + nrm[i].y * s * (HALF + 3), r: 3, bob: 1 });
  }
  for (let j = 0; j < A; j++) {
    if (j % 40000 === 39999) yield;
    if (!RT.bob[near[j]] || dist[j] < HALF - .5 || dist[j] > HALF + 7) continue;
    const dd = dist[j] - HALF, x = j % MW, y = j / MW | 0;
    set(j, dd < 1 ? K.bobWL : dd < 4.5 ? ((x + y) % 9 === 0 ? K.bobWL : K.bobW) : dd < 6 ? K.bobWD : K.snowD);
    if (dd >= 6) wallMask[j] = 1;
  }

  yield;
  // ----- the wooden bridge over the glacier stream: solid rails with icicles -----
  for (let i = 0; i < N; i += 3) if (isBridge[i]) for (const s of [-1, 1]) walls.push({ x: path[i].x + nrm[i].x * s * HALF, y: path[i].y + nrm[i].y * s * HALF, r: 3 });
  for (let j = 0; j < A; j++) {
    if (j % 40000 === 39999) yield;
    if (!isBridge[near[j]] || dist[j] < HALF - 2.5 || dist[j] > HALF + 4) continue;
    const dd = dist[j] - HALF, i = near[j];
    if (dd > 1.5) { if (ter[j] === 5 && (i % 4 < 2) && dd < 4) set(j, [230, 246, 255]); continue; } // icicles hanging over the water
    set(j, i % 8 < 2 ? K.woodD : dd < -1 ? K.woodL : K.wood);
  }

  yield;
  // ----- the hot spring: grey stones round it -----
  if (def.spring) {
    const [sx, sy, rx, ry] = def.spring;
    for (let k = 0; k < 22; k++) {
      const a = k / 22 * TAU, x = Math.round(sx + Math.cos(a) * (rx + 3)), y = Math.round(sy + Math.sin(a) * (ry + 3)), j = clamp(y, 0, MH - 1) * MW + clamp(x, 0, MW - 1);
      if (dist[j] < HALF + 2 || ter[j] === 3) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx / 9 + dy * dy / 4 <= 1) px(x + dx, y + dy, dy < 0 ? K.rockL : dy > 0 ? K.rockD : K.rock);
    }
  }

  yield;
  // ----- the glacier: blue-white ice with crevasses, a dark cliff face all round it, a ring of solid circles along the cliff -----
  const GL = RT.glac, isG = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && GL[y * MW + x] === 1;
  for (let j = 0; j < A; j++) {
    if (j % 40000 === 39999) yield;
    if (!GL[j]) continue;
    const x = j % MW, y = j / MW | 0, h = hash(x, y, sd + 60), v = vnoise(x / 7, y / 7, sd + 61);
    wallMask[j] = 1;
    // how far from the edge (1..4 px): the cliff face
    let e = 9; for (let q = 1; q <= 4 && e > q; q++) if (!isG(x - q, y) || !isG(x + q, y) || !isG(x, y - q) || !isG(x, y + q)) e = q;
    let c;
    if (e <= 4) c = e === 1 ? K.rockD : e === 2 ? K.bobWD : (x + y) & 1 ? K.bobW : K.bobWD; // the cliff, darker at the foot
    else {
      const cre = Math.abs(vnoise(x / 17, y / 11, sd + 62) - .5), st = Math.sin((x * .6 - y * .9) * .22 + vnoise(x / 25, y / 25, sd + 63) * 5);
      c = cre < .014 ? K.bobWD : cre < .03 ? K.ice1 : st > .94 ? K.ice2 : v < .3 ? K.ice1 : v > .72 ? K.ice2 : K.ice; // crevasses, lighter ridges, snow dust on the ice
      if (h < .01) c = K.iceL;
    }
    set(j, c);
    // a shadow on the snow south and east of the cliff
  }
  for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
    if (GL[y * MW + x] || ter[y * MW + x] !== 0 || dist[y * MW + x] < HALF + 3) continue;
    let sh = 0; for (let q = 1; q <= 4; q++) if (isG(x - q, y - q)) { sh = 1 - q / 5; break; }
    if (sh) dk(x, y, 1 - .28 * sh);
  }
  yield;
  // the ring of circles along the cliff (a block of 3 px holds at most one circle, so the circles are 5.5 px apart)
  const placed = new Map(), spaced = (x, y) => { for (let by = (y / 3 | 0) - 2; by <= (y / 3 | 0) + 2; by++) for (let bx = (x / 3 | 0) - 2; bx <= (x / 3 | 0) + 2; bx++) { const o = placed.get(by * 1000 + bx); if (o && (o[0] - x) ** 2 + (o[1] - y) ** 2 < 30) return false; } return true; };
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (!GL[y * MW + x]) continue;
    if (isG(x - 1, y) && isG(x + 1, y) && isG(x, y - 1) && isG(x, y + 1)) continue;
    if (!spaced(x, y)) continue;
    placed.set((y / 3 | 0) * 1000 + (x / 3 | 0), [x, y]); walls.push({ x: x + .5, y: y + .5, r: 5 });
  }
  yield;
  // the ice gate where the glacier stream starts: a dark arch in the cliff above the first bit of water
  if (def.gate) {
    const [gx, gy] = def.gate;
    for (let dy = -9; dy <= 6; dy++) for (let dx = -12; dx <= 12; dx++) {
      const d2 = (dx / 12) ** 2 + (dy / 10) ** 2; if (d2 > 1) continue;
      const j = (gy + dy) * MW + gx + dx; if (!GL[j] && ter[j] !== 5) continue;
      set(j, dy > 1 ? K.lakeE : d2 > .62 ? K.iceL : d2 > .38 ? K.bobWD : [24, 52, 84]);
    }
    for (let k = -3; k <= 3; k++) { px(gx + k * 3, gy - 9 + Math.abs(k) * 1.3, K.iceL); px(gx + k * 3, gy - 8 + Math.abs(k) * 1.3, K.ice2); } // icicles on the arch
  }
  yield;
  // ----- rock ridges: solid grey rock capped with snow (shadow on the south side), with a row of solid circles -----
  for (const [x0, y0, x1, y1, w] of def.ridges || []) {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(len / 5.5);
    for (let k = 0; k <= n; k++) walls.push({ x: x0 + (x1 - x0) * k / n, y: y0 + (y1 - y0) * k / n, r: w });
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
    for (let a = -3; a <= len + 3; a++) {
      const wob = (vnoise(a * .09, 5, sd + 64) - .5) * 3;
      for (let b = -w - 6; b <= w + 6; b++) {
        const X = x0 + ux * a - uy * (b + wob), Y = y0 + uy * a + ux * (b + wob), t = Math.abs(b);
        if (t > w + 5) continue;
        if (t <= w) solid(X, Y, 1);
        if (t <= w) px(X, Y, t > w - 1.5 ? K.rockD : hash(a, b, sd + 65) < .35 ? K.rockL : b < -1 ? K.snow2 : b > w * .4 ? K.rockD : K.rock);
        else if (b > 0) dk(X, Y, .84 - .02 * (t - w)); // shadow to one side
      }
    }
    for (let a = 4; a < len - 3; a += 9) { const b = (hash(a, 7, sd + 66) - .5) * 3, X = x0 + ux * a - uy * b, Y = y0 + uy * a + ux * b; px(X, Y, K.snow2); px(X + 1, Y, K.snow2); }
  }
  yield;
  // ----- the slope of the avalanche: the steep face south of the ridge on the right, shaded, with contour lines and rock outcrops -----
  if (def.slope) {
    const [sx0, sy0, sx1, sy1] = def.slope;
    for (let y = sy0; y < sy1; y++) for (let x = sx0; x < sx1; x++) {
      const j = y * MW + x; if (x < 0 || y < 0 || x >= MW || y >= MH || ter[j] !== 0 || dist[j] < HALF + 6 || wallMask[j]) continue;
      const f = 1 - (y - sy0) / (sy1 - sy0), cont = Math.sin((y + vnoise(x / 30, y / 14, sd + 67) * 9) * .55) > .93;
      dk(x, y, 1 - .22 * f); if (cont) dk(x, y, .93);
    }
    for (const [ox, oy] of def.outcrops || []) walls.push({ x: ox, y: oy, r: 6 });
    for (const [ox, oy] of def.outcrops || []) for (let dy = -5; dy <= 5; dy++) for (let dx = -8; dx <= 8; dx++) {
      if ((dx / 8) ** 2 + (dy / 5) ** 2 > 1 + .3 * (vnoise(ox + dx, oy + dy, sd + 68) - .5)) continue;
      px(ox + dx, oy + dy, dy < -2 ? K.rockL : dy > 1 ? K.rockD : K.rock); wallMask[(oy + dy) * MW + ox + dx] = 1;
    }
  }
  yield;
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
      wallMask[y * MW + x] = 1;
    }
    for (let x = x0 + 4; x < x0 + w - 4; x += 8) for (let k = 0; k < 3; k++) setT(x + k, y0 + h, K.win), setT(x + k, y0 + h + 1, K.winD);
    for (let yy = -4; yy <= 0; yy++) for (let xx = 0; xx < 5; xx++) setT(x0 + w - 10 + xx, y0 + 6 + yy, xx === 0 || xx === 4 ? [90, 60, 40] : [140, 90, 60]); // chimney
    for (let k = -w / 2 + 4; k <= w / 2 - 4; k += 8) for (const s of [-1, 1]) walls.push({ x: hx + k, y: hy + s * (h / 2 - 4), r: 6 });
    snowman(hx + 32, hy - 24); snowman(hx + 38, hy + 44);
    // the sledge at a fence
    for (let k = 0; k < 30; k++) { px(hx - 20 + k, hy + 26, K.woodD); if (k % 6 === 0) for (let q = -2; q <= 1; q++) px(hx - 20 + k, hy + 26 + q, K.wood); }
    for (let k = 0; k < 12; k++) { px(hx - 14 + k, hy + 29, K.red); px(hx - 14 + k, hy + 32, K.red); if (k % 4 === 0) for (let q = 29; q <= 32; q++) px(hx - 14 + k, hy + q, K.woodL); }
  }
  yield;
  // more snowmen out in the snow
  const okOff = (x, y, m) => { for (let dy = -m; dy <= m; dy += 2) for (let dx = -m; dx <= m; dx += 2) { const X = x + dx, Y = y + dy; if (X < 2 || Y < 2 || X >= MW - 2 || Y >= MH - 2) return false; const j = Y * MW + X; if (ter[j] !== 0 || dist[j] < HALF + 10 || wallMask[j] || shore[j]) return false; } return true; };
  for (let k = 0, tries = 0; k < 4 && tries < 500; tries++) { const x = 8 + (S.r() * (MW - 16) | 0), y = 8 + (S.r() * (MH - 16) | 0); if (okOff(x, y, 9)) { snowman(x, y); k++; } }

  yield;
  // ----- the penguin colony: an ice floe with rocks in the bay at the foot of the glacier (the penguins are drawn while racing) -----
  let colony = null;
  if (def.colony) {
    const [cx, cy] = def.colony;
    for (let y = cy - 24; y <= cy + 24; y++) for (let x = cx - 40; x <= cx + 40; x++) {
      const j = y * MW + x; if (x < 0 || y < 0 || x >= MW || y >= MH || ter[j] !== 0 || dist[j] < HALF + 6 || GL[j]) continue;
      const e = ((x - cx) / 38) ** 2 + ((y - cy) / 17) ** 2; if (e > .9 + .2 * vnoise(x * .2, y * .2, 74)) continue;
      set(j, e > .8 ? K.iceD : iceCol(x, y, hash(x, y, 75), false)); wallMask[j] = 1;
    }
    for (const [dx, dy] of [[-26, -8], [22, 4], [30, -10]]) for (let yy = -4; yy <= 4; yy++) for (let xx = -5; xx <= 5; xx++) if (xx * xx / 25 + yy * yy / 16 <= 1) px(cx + dx + xx, cy + dy + yy, yy < -1 ? K.rockL : yy > 1 ? K.rockD : K.rock);
    colony = { x: cx, y: cy };
  }
  yield;
  // the ski lift along the left edge of the map: masts (the cable and the gondolas move while racing)
  const lift = { x: 18, y0: 14, y1: 436 };
  for (let y = lift.y0; y <= lift.y1; y += 70) { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) px(lift.x + dx, y + dy, Math.abs(dx) === 2 || Math.abs(dy) === 2 ? K.rockD : [150, 156, 166]); walls.push({ x: lift.x, y, r: 3 }); for (let dx = 1; dx <= 6; dx++) dk(lift.x + 2 + dx, y + 3, .8); }

  const lakeCells = new Map();
  return { jumps: RT.jumps, pushes: RT.pushes, alt: RT.alt, lakeM: RT.lakeM, frost: RT.frost, colony, lift, lakeCells,
    spring: def.spring, lake: def.lake, avalanche: def.avalanche,
    short: def.lake ? { a: nearestIdx(path, 560, 395), x0: 560, x1: 262, y: 395 } : null };
}
