import { HALF, TAU, WH, WW, clamp, hash, hex, mk, vnoise } from './core.js';
import { nearestIdx } from './bau.js';

// ---------- Vulkan: the serpentine, the crater with its lava lake, the crust over the lava stream and the long way round it, the steam geyser
// with the lava ditch, the lava tube, the lava ford with two stone bridges, the waterfall, the research station ----------
// Terrain: 1 cooled lava (the road), 0 scree beside it, 2 ash (like mud, it makes the car sooty), 3 the waterfall's pool (washes, cools),
// 15 lava (you burn: gone for a moment), 16 the crust over the lava stream (road, but from time to time the stream breaks through).

const K = Object.fromEntries(Object.entries({
  rock: '#4a4442', rock1: '#423c3a', rock2: '#544e4a', rockE: '#36302e', scree: '#5e5652', scree2: '#6a625c',
  road: '#3c3a3a', road1: '#363434', road2: '#444242', roadE: '#262424', crack: '#1c1a1a', glow: '#a8381c', glowL: '#e0662a',
  lava: '#ff7a1a', lava1: '#ffa21f', lava2: '#ffd04a', lavaD: '#c8401a', crust: '#2a1e1a', crustL: '#4a2a1e',
  crust0: '#2e2826', crust1: '#3a302c', crustC: '#8a2a14',
  stone: '#7a746c', stoneL: '#9a948a', stoneD: '#4e4842', slab: '#8a847a',
  bas: '#3a3a40', basL: '#5a5a62', basD: '#24242a', wet: '#2a3a44',
  cont: '#d8d4cc', contD: '#8a867e', contO: '#e8742a', ant: '#9aa0a8',
}).map(([k, v]) => [k, hex(v)]));

// a polyline with rounded corners ([x, y, r]) sampled every 2px
function polyPts(P) {
  const pts = [], seg = (a, b) => { const m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)); for (let s = 0; s < m; s++) pts.push({ x: a[0] + (b[0] - a[0]) * s / m, y: a[1] + (b[1] - a[1]) * s / m }); };
  let cur = [P[0][0], P[0][1]];
  for (let k = 1; k < P.length; k++) {
    const [x, y, r] = P[k];
    if (k === P.length - 1 || !r) { seg(cur, [x, y]); cur = [x, y]; continue; }
    const [qx, qy] = P[k - 1], [nx, ny] = P[k + 1], dp = Math.hypot(qx - x, qy - y), dn = Math.hypot(nx - x, ny - y), rp = Math.min(r, dp / 2), rn = Math.min(r, dn / 2);
    const A0 = [x + (qx - x) / dp * rp, y + (qy - y) / dp * rp], B0 = [x + (nx - x) / dn * rn, y + (ny - y) / dn * rn];
    seg(cur, A0);
    const m = Math.max(8, Math.ceil((rp + rn) * .6));
    for (let q = 0; q < m; q++) { const t = q / m, u = 1 - t; pts.push({ x: u * u * A0[0] + 2 * u * t * x + t * t * B0[0], y: u * u * A0[1] + 2 * u * t * y + t * t * B0[1] }); }
    cur = B0;
  }
  pts.push({ x: cur[0], y: cur[1] });
  return pts;
}

// a narrow road of its own (the long way round the crust, the short cut over the geyser): every pixel within `half` of the line
export function stampLine(P, half, fn) {
  const pts = polyPts(P), R = Math.ceil(half + 1), D = new Map();
  for (const p of pts) for (let y = Math.max(0, Math.floor(p.y - R)); y <= Math.min(WH - 1, p.y + R); y++) for (let x = Math.max(0, Math.floor(p.x - R)); x <= Math.min(WW - 1, p.x + R); x++) {
    const dd = Math.hypot(x + .5 - p.x, y + .5 - p.y); if (dd >= half) continue;
    const j = y * WW + x, o = D.get(j); if (o === undefined || dd < o) D.set(j, dd);
  }
  for (const [j, dd] of D) fn(j, dd);
  return pts;
}

const streamX = (S, y) => S[0] + Math.sin(y / 17) * 4;
const fordX = (F, y) => F.x + Math.sin(y / 21) * 5 - (y - 330) * .05;

// terrain, before the ground is painted. S: { def, ter, dist, near, path, tan, nrm, N, stampAt }
export function volcanoTerrain(S) {
  const { def, ter, dist, near, path, nrm, N } = S, A = WW * WH, alt = new Uint8Array(A), stoneM = new Uint8Array(A);
  const off = j => { const i = near[j], p = path[i]; return (j % WW + .5 - p.x) * nrm[i].x + ((j / WW | 0) + .5 - p.y) * nrm[i].y; };
  // the crater: a lake of lava in the middle of the map
  const [cx, cy, crx, cry] = def.crater;
  for (let y = cy - cry - 6; y <= cy + cry + 6; y++) for (let x = cx - crx - 6; x <= cx + crx + 6; x++) {
    const j = y * WW + x; if (ter[j] !== 0) continue;
    if (((x + .5 - cx) / crx) ** 2 + ((y + .5 - cy) / cry) ** 2 < .9 + .2 * vnoise(x * .06, y * .06, 91)) ter[j] = 15;
  }
  // the long way round the crust and the short cut over the geyser: narrow roads of their own
  const bypass = stampLine(def.bypass.pts, def.bypass.half, j => { if (ter[j] === 0) { ter[j] = 1; alt[j] = 1; } });
  const sc = stampLine(def.shortcut.pts, def.shortcut.half, j => { if (ter[j] === 0) { ter[j] = 1; alt[j] = 1; } });
  // the lava stream from the crater to the top edge: under the rim road it is covered by a crust, the long way crosses it on a stone bridge
  const crust = [];
  const [sx0, shw] = def.stream;
  for (let y = 0; y < cy - cry + 10; y++) for (let x = Math.floor(streamX(def.stream, y) - shw - 2); x <= streamX(def.stream, y) + shw + 2; x++) {
    const j = y * WW + x, dd = Math.abs(x + .5 - streamX(def.stream, y)); if (dd >= shw + (vnoise(x * .2, y * .2, 92) - .5) * 3) continue;
    if (alt[j]) { stoneM[j] = 1; continue; }
    if (dist[j] < HALF) { ter[j] = 16; crust.push(j); continue; }
    ter[j] = 15;
  }
  // the lava ditch behind the geyser
  const [dx0, dy0, dx1, dy1] = def.ditch;
  for (let y = dy0; y <= dy1; y++) for (let x = dx0; x <= dx1; x++) {
    const j = y * WW + x; if (dist[j] < HALF) continue;
    const e = Math.min(y - dy0, dy1 - y, x - dx0); if (e < (vnoise(x * .2, y * .2, 93) - .3) * 4) continue;
    ter[j] = 15;
  }
  // the lava ford: a river from the crater to the bottom edge; the road crosses it on two stone bridges (lanes), one is always flooded
  const F = def.ford, lanes = F.lanes.map(o => ({ off: o, pix: [] }));
  for (let y = cy + cry - 12; y < WH; y++) for (let x = Math.floor(fordX(F, y) - F.hw - 2); x <= fordX(F, y) + F.hw + 2; x++) {
    const j = y * WW + x; if (Math.abs(x + .5 - fordX(F, y)) >= F.hw + (vnoise(x * .2, y * .2, 94) - .5) * 3) continue;
    if (dist[j] < HALF + 2) {
      const o = off(j), L = lanes.find(L => Math.abs(o - L.off) <= F.half);
      if (L) { ter[j] = 1; stoneM[j] = 1; L.pix.push(j); continue; }
    }
    if (ter[j] !== 3) ter[j] = 15;
  }
  // ash fields on the road, the waterfall's pool
  (def.ash || []).forEach(m => S.stampAt(m, 2));
  if (def.fall) {
    const [fx, fy] = def.fall;
    for (let y = fy - 14; y <= fy + 14; y++) for (let x = fx - 26; x <= fx + 26; x++) if (((x + .5 - fx) / 24) ** 2 + ((y + .5 - fy) / 12) ** 2 < .9 + .2 * vnoise(x * .2, y * .2, 95)) ter[y * WW + x] = 3;
  }
  // heat: a coarse grid (4px cells) of everything that is close to lava (up to about 36px)
  const GW = WW >> 2, GH = Math.ceil(WH / 4), hot = new Uint8Array(GW * GH), heat = new Uint8Array(GW * GH);
  for (let j = 0; j < A; j++) if (ter[j] === 15 || ter[j] === 16) hot[((j / WW | 0) >> 2) * GW + ((j % WW) >> 2)] = 1;
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    if (!hot[gy * GW + gx]) continue;
    for (let q = -9; q <= 9; q++) for (let p = -9; p <= 9; p++) { const X = gx + p, Y = gy + q; if (X >= 0 && Y >= 0 && X < GW && Y < GH && p * p + q * q <= 81) heat[Y * GW + X] = 1; }
  }
  // jumps: the geyser only throws you when it blows (see volcano.js); pushes: the serpentine goes uphill
  const [gx, gy] = def.geyser, jumps = [{ x: gx, y: gy + 14, tx: 0, ty: 1, lo: -def.shortcut.half - 2, hi: def.shortcut.half + 2, vz: 150, push: 118, off: true, geyser: true }];
  const pushes = [{ i0: nearestIdx(path, 60, 300), i1: nearestIdx(path, 120, 95), f: -36 }];
  const tubeI = def.tube.map(([x, y]) => nearestIdx(path, x, y));
  return { alt, stoneM, crust, lanes, bypass, sc, heat, GW, jumps, pushes, tubeI, crustI: nearestIdx(path, sx0, 95), fordI: nearestIdx(path, F.x, 410), bypassI: nearestIdx(path, def.bypass.pts[0][0], def.bypass.pts[0][1]) };
}

// painting, after the ground. S: { def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, shore, sd, th, r, critters, darken, RT }
export function paintVolcano(S) {
  const { def, d, set, setT, path, nrm, N, ter, dist, near, walls, wallMask, shore, sd, RT } = S, A = WW * WH;
  const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < WW && y < WH) set(y * WW + x, c); };
  const dk = (x, y, k) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= WW || y >= WH) return; const i = (y * WW + x) * 4; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; };
  const solid = (x, y, rr) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X >= 0 && Y >= 0 && X < WW && Y < WH) wallMask[Y * WW + X] = 1; } };
  const lavaCol = (x, y, h) => {
    // glowing lava with dark plates of crust drifting on it
    const v = vnoise(x / 7, y / 7, sd + 60), pl = vnoise(x / 13 + 3, y / 13, sd + 61);
    return pl > .68 ? (pl > .74 ? K.crust : K.crustL) : v > .7 ? K.lava2 : v > .45 ? K.lava1 : h < .05 ? K.lavaD : K.lava;
  };
  const lavaPix = [], glowPix = [];

  // ----- the ground -----
  for (let j = 0; j < A; j++) {
    const x = j % WW, y = j / WW | 0, t = ter[j], h = hash(x, y, sd + 40), v = vnoise(x / 6, y / 6, sd + 41) * .55 + h * .45;
    if (shore[j]) continue;
    let c;
    if (t === 0) {
      c = dist[j] < HALF + 2.5 && !RT.alt[j] ? K.rockE : v < .3 ? K.rock1 : v > .72 ? K.rock2 : K.rock;
      if (h < .02) c = K.scree2; else if (h > .985) c = K.scree;
    } else if (t === 1 || t === 4) {
      if (RT.stoneM[j]) { c = ((x >> 2) + (y >> 2)) % 3 === 0 ? K.stoneD : h < .1 ? K.stoneL : K.slab; set(j, c); continue; }
      // cooled lava: dark rock with fine cracks, some of them still glowing faintly
      const cr = Math.abs(vnoise(x / 11, y / 11, sd + 42) - .5) < .025 || Math.abs(vnoise(x / 17 + 5, y / 17, sd + 43) - .5) < .018;
      c = v < .33 ? K.road1 : v > .7 ? K.road2 : K.road;
      if (cr) { c = K.crack; if (hash(x >> 3, y >> 3, sd + 44) < .18) { c = K.glow; glowPix.push(j); } }
      if (dist[j] > HALF - 2.5 && !RT.alt[j]) c = K.roadE;
    } else if (t === 15) { c = lavaCol(x, y, h); if (h < .03) lavaPix.push(j); }
    else if (t === 16) { const cr = Math.abs(vnoise(x / 5, y / 5, sd + 45) - .5) < .06; c = cr ? K.crustC : v < .5 ? K.crust0 : K.crust1; }
    else continue;
    set(j, c);
  }
  // a glowing rim along every edge of the lava
  for (let j = WW; j < A - WW; j++) {
    if (ter[j] === 15) continue;
    if (ter[j - 1] === 15 || ter[j + 1] === 15 || ter[j - WW] === 15 || ter[j + WW] === 15) { if (!RT.stoneM[j] && ter[j] !== 16) set(j, hash(j, 1, sd) < .5 ? K.glow : K.lavaD); }
  }
  // start line (chequered)
  S.band(0, 6, (x, y, a, c) => { if (Math.abs(c) < HALF) set(y * WW + x, ((Math.floor(a + 6) >> 2) + (Math.floor(c + 100) >> 2)) & 1 ? [245, 245, 240] : [34, 30, 28]); });

  // ----- rock walls between the bends of the serpentine and beside the geyser: basalt boulders, solid -----
  const boulder = (x, y, rr) => {
    for (let dy = -rr - 2; dy <= rr + 3; dy++) for (let dx = -rr - 2; dx <= rr + 4; dx++) if (dx > 0 && dy > 0 && Math.hypot(dx - 2, dy - 2) < rr) dk(x + dx, y + dy, .7);
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      const dd = Math.hypot(dx, dy) + (vnoise((x + dx) * .4, (y + dy) * .4, sd + 46) - .5) * 2.5; if (dd > rr) continue;
      const sh = (dx + dy) / rr; setT(x + dx, y + dy, dd > rr - 1 ? K.basD : sh < -.35 ? K.basL : sh > .4 ? K.basD : K.bas);
    }
  };
  for (const [x1, y1, x2, y2] of def.walls || []) {
    const L = Math.hypot(x2 - x1, y2 - y1);
    for (let t = 0; t <= L; t += 7) {
      const x = Math.round(x1 + (x2 - x1) * t / L), y = Math.round(y1 + (y2 - y1) * t / L), j = y * WW + x;
      if (dist[j] < HALF + 1 || RT.alt[j]) continue;
      walls.push({ x, y, r: 5 }); boulder(x, y, 5 + (hash(x, y, 47) * 2 | 0)); solid(x, y, 8);
    }
  }
  // the rocky edge in front of the ditch on the short cut: it stops the cars that come without the geyser (not the flying ones)
  const [dx0, dy0, dx1] = def.ditch;
  for (let x = dx0 + 10; x <= dx1 - 30; x += 5) { walls.push({ x, y: dy0 - 3, r: 3, ground: 1 }); for (let k = -2; k <= 1; k++) px(x + k, dy0 - 3, K.stoneD); px(x, dy0 - 4, K.stoneL); }
  // the geyser: a crusty hole in the short cut
  const [gx, gy] = def.geyser;
  for (let dy = -8; dy <= 8; dy++) for (let dx = -10; dx <= 10; dx++) { const e = (dx / 10) ** 2 + (dy / 8) ** 2; if (e > 1) continue; px(gx + dx, gy + dy, e > .7 ? [214, 196, 140] : e > .4 ? [180, 160, 110] : [40, 30, 26]); }

  // ----- the lava tube: a roof of black rock over the road (a picture of its own, see-through from inside), walls along it -----
  const [ti0, ti1] = RT.tubeI, inTube = i => ti0 <= ti1 ? i >= ti0 && i <= ti1 : i >= ti0 || i <= ti1;
  let tube = null;
  {
    let x0 = WW, y0 = WH, x1 = 0, y1 = 0;
    for (let j = 0; j < A; j++) if (dist[j] < HALF + 9 && inTube(near[j])) { const x = j % WW, y = j / WW | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const W = x1 - x0 + 1, H = y1 - y0 + 1, cv = mk(W, H), g = cv.getContext('2d'), img = g.createImageData(W, H), q = img.data, cracks = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const j = y * WW + x; if (!(dist[j] < HALF + 9 && inTube(near[j]))) continue;
      const dd = dist[j], h = hash(x, y, sd + 48), v = vnoise(x / 6, y / 6, sd + 49);
      let c = dd > HALF + 6 ? K.basD : v < .35 ? K.basD : v > .7 ? K.basL : K.bas;
      const cr = Math.abs(vnoise(x / 9, y / 9, sd + 50) - .5) < .03; if (cr) { c = h < .5 ? K.glowL : K.glow; if (h < .1) cracks.push({ x, y }); }
      const k = ((y - y0) * W + x - x0) * 4; q[k] = c[0]; q[k + 1] = c[1]; q[k + 2] = c[2]; q[k + 3] = 255;
      wallMask[j] = 1;
    }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < N; i += 3) if (inTube(i)) for (const s of [-1, 1]) walls.push({ x: path[i].x + nrm[i].x * s * (HALF + 4), y: path[i].y + nrm[i].y * s * (HALF + 4), r: 4 });
    tube = { c: cv, x: x0, y: y0, W, H, i0: ti0, i1: ti1, cracks };
  }

  // ----- the waterfall: a cliff with water coming down into the pool (drawn while racing), wet rocks round the pool -----
  if (def.fall) {
    const [fx, fy] = def.fall;
    for (let y = fy - 44; y <= fy - 12; y++) for (let x = fx - 22; x <= fx + 22; x++) {
      const j = y * WW + x; if (ter[j] !== 0) continue;
      const e = Math.abs(x - fx) / 22 + (fy - 12 - y) / 40; if (e > 1.1) continue;
      px(x, y, hash(x, y, 51) < .3 ? K.basL : (x + y) % 7 === 0 ? K.basD : K.bas); wallMask[j] = 1;
    }
    for (let k = -18; k <= 18; k += 9) walls.push({ x: fx + k, y: fy - 22, r: 6 });
  }

  // ----- the research station: containers with antennas, a seismograph, a researcher in a helmet -----
  let station = null;
  if (def.station) {
    const [sx, sy] = def.station, R = (x, y, w, h, c) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) setT(sx + x + xx, sy + y + yy, c); };
    for (let y = 0; y < 26; y++) for (let x = 0; x < 64; x++) dk(sx - 28 + x, sy - 8 + y, .72);
    for (const [x, col] of [[-32, K.cont], [2, K.contO]]) {
      R(x, -12, 30, 18, [30, 26, 24]); R(x + 1, -11, 28, 16, col); for (let k = 3; k < 28; k += 4) R(x + 1 + k, -11, 1, 16, col === K.cont ? K.contD : [180, 90, 30]);
      for (let yy = -12; yy < 6; yy++) for (let xx = x; xx < x + 30; xx++) wallMask[(sy + yy) * WW + sx + xx] = 1;
      walls.push({ x: sx + x + 8, y: sy - 3, r: 8 }); walls.push({ x: sx + x + 22, y: sy - 3, r: 8 });
    }
    R(-24, -22, 1, 10, K.ant); R(-27, -24, 7, 1, K.ant); R(-24, -25, 1, 1, [255, 60, 60]); // antenna with a red lamp
    R(10, -26, 1, 14, K.ant); for (let k = 0; k < 5; k++) R(6 + k, -26 + k, 9 - 2 * k, 1, K.ant); // a dish
    station = { x: sx, y: sy, seis: { x: sx + 12, y: sy - 8 }, man: { x: sx - 40, y: sy - 2 } };
  }

  // ----- scenery: basalt columns along the edges, charred stumps, steam vents -----
  const okOff = (x, y, m) => { for (let dy = -m; dy <= m; dy += 2) for (let dx = -m; dx <= m; dx += 2) { const X = x + dx, Y = y + dy; if (X < 2 || Y < 2 || X >= WW - 2 || Y >= WH - 2) return false; const j = Y * WW + X; if (ter[j] !== 0 || dist[j] < HALF + 8 || wallMask[j] || RT.alt[j]) return false; } return true; };
  const column = (x, y) => { // a basalt column seen from above: a hexagon
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) { const ax = Math.abs(dx), ay = Math.abs(dy); if (ax * .5 + ay * .87 > 4.4 || ax > 4.6) continue; setT(x + dx, y + dy, ax * .5 + ay * .87 > 3.6 || ax > 3.8 ? K.basD : dy < -1 ? K.basL : K.bas); }
  };
  for (let k = 0, tries = 0; k < 70 && tries < 3000; tries++) {
    const x = 4 + (S.r() * (WW - 8) | 0), y = 4 + (S.r() * (WH - 8) | 0);
    const edge = x < 30 || y < 20 || x > WW - 40 || y > WH - 14; if (!edge || !okOff(x, y, 5)) continue;
    column(x, y); walls.push({ x, y, r: 4 }); solid(x, y, 5); k++;
  }
  for (let k = 0, tries = 0; k < 10 && tries < 600; tries++) {
    const x = 6 + (S.r() * (WW - 12) | 0), y = 6 + (S.r() * (WH - 12) | 0); if (!okOff(x, y, 6)) continue;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 10) px(x + dx, y + dy, dx * dx + dy * dy > 6 ? [20, 16, 14] : (Math.round(Math.hypot(dx, dy)) % 2 ? [60, 40, 30] : [34, 26, 22]));
    walls.push({ x, y, r: 3 }); k++;
  }
  const vents = [];
  for (let k = 0, tries = 0; k < 7 && tries < 600; tries++) {
    const x = 6 + (S.r() * (WW - 12) | 0), y = 6 + (S.r() * (WH - 12) | 0); if (!okOff(x, y, 4)) continue;
    for (let q = -4; q <= 4; q++) px(x + q, y + Math.round(Math.sin(q) * 1.2), [24, 20, 18]); vents.push({ x, y, k }); k++;
  }

  // ----- the crust when the stream breaks through, and the flooded stone bridge of the ford: pictures of lava to lay over the ground -----
  const lavaPic = pix => {
    if (!pix.length) return null;
    let x0 = WW, y0 = WH, x1 = 0, y1 = 0; for (const j of pix) { const x = j % WW, y = j / WW | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const W = x1 - x0 + 1, H = y1 - y0 + 1, cv = mk(W, H), g = cv.getContext('2d'), img = g.createImageData(W, H), q = img.data;
    for (const j of pix) { const x = j % WW, y = j / WW | 0, c = lavaCol(x, y, hash(x, y, 52)), k = ((y - y0) * W + x - x0) * 4; q[k] = c[0]; q[k + 1] = c[1]; q[k + 2] = c[2]; q[k + 3] = 255; }
    g.putImageData(img, 0, 0);
    return { c: cv, x: x0, y: y0, W, H };
  };
  const crust = { pix: RT.crust, pic: lavaPic(RT.crust) };
  const lanes = RT.lanes.map(L => ({ off: L.off, pix: L.pix, pic: lavaPic(L.pix) }));
  // the signal stone at the ford: it shows which bridge opens next (drawn while racing)
  const F = def.ford, signal = { x: Math.round(F.x + F.hw + 22), y: 362 };
  // between the two bridges of the ford a solid stone pier (so nobody drives into the gap), sharp at both ends
  {
    const i = RT.fordI, p = path[i], tg = S.tan[i];
    for (let a = -F.hw - 12; a <= F.hw + 12; a += 4) {
      const x = p.x + tg.x * a, y = p.y + tg.y * a; walls.push({ x, y, r: Math.abs(a) > F.hw + 4 ? 2 : 3 });
      for (let q = -2; q <= 2; q++) px(x + nrm[i].x * q, y + nrm[i].y * q, Math.abs(q) === 2 ? K.stoneD : K.stoneL);
    }
  }
  // railings along the stone bridge of the long way round the crust
  for (const p of RT.bypass) {
    if (Math.abs(p.x - def.stream[0]) > def.stream[1] + 6 || p.y > 60) continue;
    for (const s of [-1, 1]) { const y = p.y + s * (def.bypass.half + 1); walls.push({ x: p.x, y, r: 2 }); px(p.x, y, K.stoneL); px(p.x, y + s, K.stoneD); }
  }
  walls.push({ x: signal.x, y: signal.y, r: 5 });

  return { jumps: RT.jumps, pushes: RT.pushes, alt: RT.alt, heat: RT.heat, GW: RT.GW, crust, lanes, tube, station, vents, signal, lavaPix, glowPix,
    crater: def.crater, fall: def.fall, geyser: def.geyser, bypass: RT.bypass, sc: RT.sc, crustI: RT.crustI, fordI: RT.fordI, bypassI: RT.bypassI };
}
