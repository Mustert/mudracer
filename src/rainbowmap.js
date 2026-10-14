import { HALF, TAU, clamp, hash, hex, mk, vnoise } from './core.js';
import { nearestIdx } from './bau.js';

// ---------- Regenbogen: the rainbow road over a sea of clouds between the floating coins of the four cups (the finale) ----------
// Terrain: 31..36 the six colour lanes of the rainbow road (red always on the left in driving direction, violet on the right; each has its own
// effect, see rainbow.js), 37 the asphalt of the gold coin, 38 a cloud hole (you fall through, a unicorn brings you back), 0 soft clouds beside
// the road and the ground of the coins (slow like grass, it stays clean), 1 the roads of the bronze, silver, platinum and Fantasy coins,
// 2 storm clouds (like mud, they make the car grey; on the bronze coin a brown mud puddle), 5 the cloud pond of the garden (deep water),
// 7 gravel (gold), 12 the ice ramp (gold), 4 boost arrows.

export const LANE = 31, ASPH = 37, HOLE = 38;
// the coins: their order in def.coins and the colours of their metal (main, dark, light, deep)
export const COINS = ['bronze', 'silver', 'gold', 'platinum', 'fantasy'];
const METAL = [['#c88a4a', '#a8683a', '#e8b878', '#6a3e1a'], ['#c8ced8', '#9aa2b0', '#f2f5fa', '#5a6270'], ['#f2c230', '#c8961a', '#fff0a0', '#7a5a0a'],
  ['#d4dae6', '#a6aec0', '#ffffff', '#646c80'], ['#f6e8ff', '#d2b8ec', '#ffffff', '#8a6aaa']].map(m => m.map(hex));
// the six lanes: main colour, light, dark
export const RB = ['#ff4d6d', '#ff9f43', '#ffd93d', '#6bcb77', '#4d96ff', '#9b5de5'];
const LN = RB.map(hex), LNL = ['#ff8aa0', '#ffc285', '#ffeb85', '#9fe2a6', '#8dbcff', '#c29cf0'].map(hex), LND = ['#d6334f', '#de7a1e', '#e0b414', '#46a856', '#2f74e0', '#7638c2'].map(hex);

const K = Object.fromEntries(Object.entries({
  cl0: '#ffffff', cl1: '#f2f3fc', cl2: '#e3e6f7', cl3: '#cfd4ef', cl4: '#b8bfe4', clE: '#a4acd8',
  h0: '#9aa4d6', h1: '#6f7cc0', h2: '#4a58a6', h3: '#33418c', h4: '#283678', hc: '#8494d4', hcL: '#b2bff0',
  st0: '#5d6270', st1: '#6c7280', st2: '#7e8492', stD: '#454a56', stL: '#a2a8b6',
  gr0: '#63c24a', gr1: '#55b03e', gr2: '#74d05a', grD: '#3e8e2e', er0: '#c99e69', er1: '#bb905b', er2: '#d5ad79', erE: '#9b7349',
  md0: '#5a3a1f', md1: '#4b301a', md2: '#664327', mdE: '#3b2512', mdH: '#8a6440',
  sg0: '#6fb85a', sg1: '#62a84e', sg2: '#7ec766', pa0: '#c4ad86', pa1: '#b59d76', pa2: '#d0ba94', paE: '#948063',
  wa0: '#7fc4e8', wa1: '#95d2f0', wa2: '#b2e2f8', wa3: '#e8f6ff', waE: '#5a9ac0',
  sa0: '#ecca8a', sa1: '#e2bf7c', sa2: '#f4d69e', as0: '#55565b', as1: '#4d4e53', as2: '#5d5e63', asE: '#ecece6', kR: '#d83a2c', kW: '#f4f4ee',
  gv0: '#b8a888', gv1: '#a89878', gv2: '#c8b898', ic0: '#bfe3f3', ic1: '#a9d6ec', ic2: '#d6eef8', icL: '#ffffff',
  rk0: '#4a4442', rk1: '#423c3a', rk2: '#544e4a', rkL: '#6a625c', bs0: '#7a7480', bs1: '#706a76', bs2: '#86808c', bsE: '#ff8a3a',
  lv0: '#ff7a1a', lv1: '#ffb02a', lv2: '#ffe04a', lvD: '#c8401a',
  pe0: '#fdf5ff', pe1: '#f3eaff', pe2: '#fff7ea', peE: '#e6d6f6',
  hz: '#ffd23f', hzD: '#26262c', pl: '#8a92a0', plD: '#4a5060',
}).map(([k, v]) => [k, hex(v)]));

const inRange = (i, a, b) => a <= b ? i >= a && i <= b : i >= a || i <= b;
const bez = (P, t) => { const u = 1 - t; return [0, 1].map(k => u * u * u * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t * t * t * P[3][k]); };

// terrain, before the ground is painted. S: { MW, MH, def, ter, dist, near, path, tan, nrm, N }
export function* rainbowTerrain(S) {
  const { MW, MH, def, ter, dist, near, path, tan, nrm, N } = S, A = MW * MH, sd = def.seed * 7;
  const coin = new Uint8Array(A), lane = new Uint8Array(A), alt = new Uint8Array(A), inside = new Uint8Array(A), brown = new Uint8Array(A), bridge = new Uint8Array(A);
  const kerb = new Uint8Array(A), plat = new Uint8Array(A), dblM = new Uint8Array(A), gorge = new Uint8Array(A);
  const off = j => { const i = near[j], p = path[i]; return (j % MW + .5 - p.x) * nrm[i].x + ((j / MW | 0) + .5 - p.y) * nrm[i].y; };
  const C = COINS.map(k => def.coins[k]);
  // the coins
  C.forEach(([cx, cy, r], k) => { for (let y = Math.max(0, cy - r); y <= Math.min(MH - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(MW - 1, cx + r); x++) if (Math.hypot(x + .5 - cx, y + .5 - cy) < r) coin[y * MW + x] = k + 1; });
  yield;
  // inside the loop of the road (even-odd per row): the middle of the map is a deep cloud gorge, nobody cuts across it
  for (let y = 0; y < MH; y++) {
    const yc = y + .5, xs = [];
    for (let i = 0; i < N; i++) { const a = path[i], b = path[(i + 1) % N]; if ((a.y <= yc) !== (b.y <= yc)) xs.push(a.x + (yc - a.y) / (b.y - a.y) * (b.x - a.x)); }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - .5)); x <= Math.min(MW - 1, Math.floor(xs[k + 1] - .5)); x++) inside[y * MW + x] = 1;
    if (y % 90 === 89) yield;
  }
  // the arch: where it starts and ends, its gap at the top; the ice ramp of the gold coin with its little gap
  const ni = q => nearestIdx(path, q[0], q[1]);
  const [a0, a1, g0, g1] = def.arch.map(ni), [r0, rl, rg] = def.ramp.map(ni);
  // the double rainbow (last lap): a narrow second road over its own cloud gorge
  const dbl = []; { let L = 0, prev = bez(def.double, 0); dbl.push({ x: prev[0], y: prev[1] }); for (let t = .001; t <= 1; t += .001) { const q = bez(def.double, t); L += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; if (L >= 2) { dbl.push({ x: q[0], y: q[1] }); L = 0; } } }
  const dd = new Float32Array(A).fill(1e4), dk = new Int32Array(A);
  dbl.forEach((p, k) => {
    const R = 70;
    for (let y = Math.max(0, Math.floor(p.y - R)); y <= Math.min(MH - 1, p.y + R); y++) for (let x = Math.max(0, Math.floor(p.x - R)); x <= Math.min(MW - 1, p.x + R); x++) {
      const j = y * MW + x, q = Math.hypot(x + .5 - p.x, y + .5 - p.y); if (q < dd[j]) { dd[j] = q; dk[j] = k; }
    }
  });
  yield;
  const DH = 17, dPix = [], dLane = [], archX = (def.arch[0][0] + def.arch[1][0]) / 2, archY = def.arch[0][1], archR = (def.arch[1][0] - def.arch[0][0]) / 2 + 4;
  for (let j = 0; j < A; j++) {
    if (j % 60000 === 59999) yield;
    const x = j % MW, y = j / MW | 0, t = ter[j], k = coin[j], road = dist[j] < HALF;
    const bank = 16 + 22 * vnoise(x * .028, y * .028, sd + 1);
    // the double rainbow: its own lanes across its width (6 px each)
    if (dd[j] < DH) {
      const q = dk[j], a = dbl[Math.max(0, q - 2)], b = dbl[Math.min(dbl.length - 1, q + 2)], tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1, o = ((x + .5 - dbl[q].x) * -ty + (y + .5 - dbl[q].y) * tx) / l;
      if (!road && !k) { dblM[j] = 1; alt[j] = 1; dPix.push(j); dLane.push(clamp(Math.floor((o + DH) / (2 * DH) * 6), 0, 5)); }
    }
    if (road) {
      if (t === 4) continue;
      if (k) { ter[j] = k === 3 ? ASPH : 1; continue; }
      const ln = clamp(Math.floor((off(j) + HALF) / (2 * HALF) * 6), 0, 5);
      ter[j] = LANE + ln; lane[j] = ln + 1;
      continue;
    }
    if (k) { ter[j] = 0; continue; }
    // cloud holes: the gorge in the middle (inside the loop, behind a bank of clouds along the road), the gorge under the arch, the gorge under the
    // double rainbow (outside, it starts a little away from where it leaves the road)
    // (the gorge under the arch: an oval with ragged edges round the middle of the arch, from the top edge of the map down into the middle)
    const ex = (x + .5 - archX) / (archR + 18 * (vnoise(x * .03, y * .03, sd + 2) - .5)), ey = (y + .5 - archY) / 175, underArch = ex * ex + ey * ey < 1;
    const dq = dd[j] < 1e3 ? dk[j] / dbl.length : -1;
    if (underArch || (inside[j] && dist[j] > HALF + bank) || (dq > .06 && dq < .97 && dd[j] < 52 + 18 * vnoise(x * .04, y * .04, sd + 4) && dist[j] > HALF + bank * .6)) { ter[j] = HOLE; gorge[j] = 1; }
    else ter[j] = 0;
  }
  yield;
  // the gap at the top of the arch and the little crevasse after the ice ramp: no road there
  const band = (i0, i1, w, fn) => { for (let j = 0; j < A; j++) if (dist[j] < w && inRange(near[j], i0, i1) && !coin[j]) fn(j); };
  band(g0, g1, HALF + 1, j => { ter[j] = HOLE; lane[j] = 0; });
  // the crevasse after the ramp: from the gorge in the middle out to the edge of the map, with ragged edges
  {
    const gc = (rl + 2 + Math.round(((rg - rl - 2 + N) % N) / 2)) % N, pc = path[gc], tg = tan[gc], nm = nrm[gc], half = ((rg - rl - 2 + N) % N) + 2;
    for (let j = 0; j < A; j++) {
      if (coin[j]) continue;
      const x = j % MW + .5, y = (j / MW | 0) + .5, al = (x - pc.x) * tg.x + (y - pc.y) * tg.y, ac = (x - pc.x) * nm.x + (y - pc.y) * nm.y;
      if (Math.abs(al) < half + 7 * (vnoise(ac * .06, 3, sd + 9) - .3) && ac < HALF + 60 && ac > -MW) { ter[j] = HOLE; lane[j] = 0; gorge[j] = 1; }
    }
  }
  for (let j = 0; j < A; j++) if (dist[j] < HALF && inRange(near[j], r0, rl) && ter[j] !== 4) { ter[j] = 12; lane[j] = 0; }
  yield;
  // the bronze coin: a mud puddle in a dip of the earth road (brown, not grey)
  if (def.puddle) {
    const [px, py, rx, ry] = def.puddle;
    for (let y = py - ry - 4; y <= py + ry + 4; y++) for (let x = px - rx - 4; x <= px + rx + 4; x++) {
      const j = y * MW + x; if (coin[j] !== 1) continue;
      if (((x + .5 - px) / rx) ** 2 + ((y + .5 - py) / ry) ** 2 < .8 + .4 * vnoise(x * .15, y * .15, sd + 5)) { ter[j] = 2; brown[j] = 1; }
    }
  }
  // the silver coin: a cloud pond, the road crosses it on a red bridge
  if (def.pond) {
    const [px, py, rx, ry] = def.pond;
    for (let y = py - ry - 4; y <= py + ry + 4; y++) for (let x = px - rx - 6; x <= px + rx + 6; x++) {
      const j = y * MW + x; if (coin[j] !== 2) continue;
      if (((x + .5 - px) / rx) ** 2 + ((y + .5 - py) / ry) ** 2 >= .85 + .3 * vnoise(x * .1, y * .1, sd + 6)) continue;
      if (dist[j] < HALF) bridge[j] = 1; else ter[j] = 5;
    }
  }
  // the gold coin: gravel outside the bends; kerbs on the inside of them
  for (const [gx, gy, gr] of def.gravel || []) for (let y = gy - gr; y <= gy + gr; y++) for (let x = gx - gr; x <= gx + gr; x++) {
    const j = y * MW + x; if (coin[j] !== 3 || dist[j] < HALF + 2) continue;
    if (Math.hypot(x + .5 - gx, y + .5 - gy) < gr * (.8 + .35 * vnoise(x * .12, y * .12, sd + 7))) ter[j] = 7;
  }
  for (let j = 0; j < A; j++) {
    if (coin[j] !== 3 || dist[j] >= HALF || dist[j] < HALF - 6) continue;
    const i = near[j], ta = tan[(i - 8 + N) % N], tb = tan[(i + 8) % N], turn = ta.x * tb.y - ta.y * tb.x;
    if (Math.abs(turn) > .1 && off(j) * turn > 0) kerb[j] = 1;
  }
  yield;
  // storm clouds on the rainbow (static ones; the storm brings more, see rainbow.js): they drift onto the road from the bank at one side
  const stampOn = (t, o, rx, ry, fn) => {
    const i = Math.floor(t * N) % N, p = path[i], tg = tan[i], nm = nrm[i], cx = p.x + nm.x * o, cy = p.y + nm.y * o, R = Math.ceil(Math.max(rx, ry) * 1.3);
    for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const dx = x + .5 - cx, dy = y + .5 - cy, a = dx * tg.x + dy * tg.y, c = dx * nm.x + dy * nm.y;
      if ((a / rx) ** 2 + (c / ry) ** 2 < .75 + .45 * vnoise(x * .16, y * .16, sd + 8 + t * 100)) fn(y * MW + x);
    }
  };
  const stormPix = [];
  for (const [t, o, rx, ry] of def.storm || []) stampOn(t, o, rx, ry, j => { if (lane[j]) { ter[j] = 2; stormPix.push(j); } });
  // the runtime storm spots (event gewitter): which road pixels they will cover
  const stormSpots = (def.stormAt || []).map(([t, o, rx, ry]) => { const px = []; stampOn(t, o, rx, ry, j => { if (lane[j] && ter[j] >= LANE && ter[j] < LANE + 6) px.push(j); }); const p = path[Math.floor(t * N) % N]; return { px, x: p.x, y: p.y }; });
  // the little platform of the wormhole on the platinum coin
  const [wx, wy, wr] = def.portals.a;
  for (let y = wy - wr - 1; y <= wy + wr + 1; y++) for (let x = wx - wr - 1; x <= wx + wr + 1; x++) { const j = y * MW + x; if (Math.hypot(x + .5 - wx, y + .5 - wy) < wr && dist[j] >= HALF) { ter[j] = 1; plat[j] = 1; alt[j] = 1; } }
  yield;
  // the arch: uphill it slows a little, downhill it pushes; the jump over the gap; the ice ramp of the gold coin
  const T = i => tan[i], P = i => path[i];
  const landI = (g1 + 14) % N, rampLand = (rg + 10) % N;
  const jumps = [
    { x: P(g0).x - T(g0).x * 2, y: P(g0).y - T(g0).y * 2, tx: T(g0).x, ty: T(g0).y, lo: -HALF - 4, hi: HALF + 4, vz: 247, land: landI, sfx: 'bigJump' },
    { x: P(rl).x, y: P(rl).y, tx: T(rl).x, ty: T(rl).y, lo: -HALF - 4, hi: HALF + 4, vz: 150, land: rampLand },
  ];
  const pushes = [{ i0: a0, i1: (g0 - 1 + N) % N, f: -26 }, { i0: g1, i1: a1, f: 60 }];
  return { coin, lane, alt, inside, brown, bridge, kerb, plat, dblM, gorge, dbl, dPix, dLane, stormPix, stormSpots, jumps, pushes,
    arch: { a0, a1, g0, g1, landI }, ramp: { r0, rl, rg, land: rampLand } };
}

// painting, after the ground. S: { MW, MH, def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, sd, r, critters, mudPix, RT }
export function* paintRainbow(S) {
  const { MW, MH, def, d, set, setT, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, sd, critters, mudPix, RT } = S, A = MW * MH, coin = RT.coin;
  const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < MW && y < MH) set(y * MW + x, c); };
  const dk = (x, y, k) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= MW || y >= MH) return; const i = (y * MW + x) * 4; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; };
  const solid = (x, y, rr) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X >= 0 && Y >= 0 && X < MW && Y < MH) wallMask[Y * MW + X] = 1; } };
  const off = j => { const i = near[j], p = path[i]; return (j % MW + .5 - p.x) * nrm[i].x + ((j / MW | 0) + .5 - p.y) * nrm[i].y; };
  const C = COINS.map(k => def.coins[k]);
  const fn = (x, y, s) => vnoise(x / 14, y / 14, s) * .6 + vnoise(x / 5, y / 5, s + 1) * .4;
  const big = (x, y) => vnoise(x / 30, y / 30, sd + 11) * .6 + vnoise(x / 12, y / 12, sd + 12) * .3 + vnoise(x / 5, y / 5, sd + 13) * .1;
  // a soft cloud: puffy lumps lit from the top left
  const cloud = (x, y, h) => {
    // big round lumps: their top left side is lit, the bottom right in a soft lilac shadow
    const v = big(x, y), l = (big(x - 4, y - 4) - big(x + 4, y + 4)) * 4;
    const q = v + l * .35;
    let c = q > .52 ? K.cl0 : q > .42 ? K.cl1 : q > .34 ? K.cl2 : q > .27 ? K.cl3 : K.cl4;
    if (h < .003) c = K.cl2;
    return c;
  };
  // storm clouds: dark grey puffs
  const stormCol = (x, y) => {
    const v = fn(x * 1.6, y * 1.6, sd + 26), l = fn(x * 1.6 - 2, y * 1.6 - 2, sd + 26) - fn(x * 1.6 + 2, y * 1.6 + 2, sd + 26);
    return v < .3 ? K.stD : l > .08 ? K.stL : l > 0 ? K.st2 : l > -.08 ? K.st1 : K.st0;
  };
  // the clean colour of a lane pixel (also kept for the overlays: grey in the storm, glowing in the last lap)
  const laneCol = (j, ln, h) => {
    const i = near[j], o = off(j) + HALF, u = o - ln * 10, e = dist[j];
    if (e > HALF - 1.4) return [255, 255, 255];
    if (e > HALF - 2.6) return [236, 228, 250];
    let c = u < 1 ? LND[ln] : u > 3 && u < 5.5 ? LNL[ln] : LN[ln];
    if (((i * 2 + Math.round(o)) % 46) < 3) c = LNL[ln]; // glossy streaks across
    if (h > .994) c = [255, 255, 255];
    return c;
  };
  const clean = new ImageData(MW, MH), cd = clean.data, glit = [], holes = [];
  // the order of the shading of a hole: how far into it (1..5)
  const intoHole = (x, y) => {
    for (let q = 1; q <= 5; q++) for (let dy = -q; dy <= q; dy++) for (let dx = -q; dx <= q; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== q) continue;
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= MW || Y >= MH) continue;
      if (ter[Y * MW + X] !== HOLE) return q;
    }
    return 6;
  };

  yield;
  // ----- the ground -----
  for (let j = 0; j < A; j++) {
    if (j % 30000 === 29999) yield;
    const x = j % MW, y = j / MW | 0, t = ter[j], k = coin[j], h = hash(x, y, sd + 20), road = dist[j] < HALF, ln = RT.lane[j] - 1;
    if (ln >= 0) { const c = laneCol(j, ln, h), q = j * 4; cd[q] = c[0]; cd[q + 1] = c[1]; cd[q + 2] = c[2]; cd[q + 3] = 255; }
    if (t === 4) continue; // the boost arrows are painted already
    let c;
    if (k) {
      const [cx, cy, cr] = C[k - 1], M = METAL[k - 1], dc = cr - Math.hypot(x + .5 - cx, y + .5 - cy), sh = ((x - cx) + (y - cy)) / cr;
      const v = vnoise(x / 8, y / 8, sd + 21) * .6 + h * .4;
      if (dc < 7 && !(road && dc > 1.5)) {
        // the rim of the coin: bevelled metal, little notches (reeding) on the outer edge; the Fantasy coin has a rainbow rim
        if (k === 5) { const a = Math.atan2(y - cy, x - cx), b = LN[((a / TAU * 12 + 12) | 0) % 6]; c = dc < 1.5 ? LND[((a / TAU * 12 + 12) | 0) % 6] : dc > 5.5 ? M[2] : b; }
        else c = dc < 1.2 ? M[3] : dc < 2.5 ? (sh < 0 ? M[2] : M[1]) : dc > 5.5 ? (sh < 0 ? M[1] : M[2]) : (Math.round(Math.atan2(y - cy, x - cx) * cr / 3) % 2 ? M[0] : M[2]);
      } else if (road) {
        const e = dist[j];
        if (k === 1) { c = v < .38 ? K.er1 : v > .66 ? K.er2 : K.er0; if (e > HALF - 3) c = K.erE; if (t === 2) c = v < .4 ? K.md1 : v > .7 ? K.md2 : K.md0; }
        else if (k === 2) { c = v < .38 ? K.pa1 : v > .66 ? K.pa2 : K.pa0; if (e > HALF - 3) c = K.paE; if (RT.bridge[j]) { const i = near[j]; c = i % 3 === 0 ? [96, 52, 34] : (Math.floor(i / 3) & 1) ? [178, 70, 46] : [160, 58, 40]; } }
        else if (k === 3) {
          if (t === 12) c = Math.sin((x - y) * .12) > .85 ? K.icL : v < .35 ? K.ic1 : K.ic0;
          else { c = v < .35 ? K.as1 : v > .68 ? K.as2 : K.as0; if (e > HALF - 2) c = K.asE; if (RT.kerb[j]) c = (Math.floor(near[j] / 4) & 1) ? K.kR : K.kW; }
        } else if (k === 4) { c = v < .35 ? K.bs1 : v > .68 ? K.bs2 : K.bs0; if (e > HALF - 2.5) c = K.bsE; else if (h < .02) c = [255, 140, 60]; }
        else { c = v < .4 ? K.pe1 : v > .7 ? K.pe2 : K.pe0; if (e > HALF - 2) c = LN[clamp(Math.floor((off(j) + HALF) / (2 * HALF) * 6), 0, 5)]; else if (e > HALF - 3.5) c = K.peE; }
        if (t === 2 && k !== 1) c = K.st1;
      } else if (k === 1) {
        if (t === 2) c = v < .4 ? K.md1 : K.md2; else { c = v < .38 ? K.gr1 : v > .66 ? K.gr2 : K.gr0; if (h < .03) c = K.grD; }
      } else if (k === 2) {
        if (t === 5) { const sh2 = vnoise(x / 12, y / 6, sd + 22); c = sh2 > .7 ? K.wa3 : sh2 > .5 ? K.wa2 : v > .5 ? K.wa1 : K.wa0; let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) if (ter[j + dx + dy * MW] !== 5) n++; if (n) c = n > 2 ? [160, 150, 136] : K.waE; }
        else { c = v < .38 ? K.sg1 : v > .66 ? K.sg2 : K.sg0; if (h < .02) c = [255, 194, 214]; }
      } else if (k === 3) {
        if (t === 7) c = h < .3 ? K.gv1 : h > .7 ? K.gv2 : K.gv0; else { c = v < .38 ? K.sa1 : v > .66 ? K.sa2 : K.sa0; if (h < .01) c = [180, 150, 100]; }
      } else if (k === 4) { c = v < .38 ? K.rk1 : v > .66 ? K.rk2 : K.rk0; if (h < .02) c = K.rkL; if (RT.plat[j]) c = K.pl; }
      else { c = v < .4 ? K.pe1 : v > .7 ? K.pe2 : K.pe0; if (h < .02) c = LNL[(h * 300 | 0) % 6]; }
    } else if (t === HOLE) {
      // a hole in the clouds: the cloud wall falls away into the deep blue sky, little clouds far below
      const e = intoHole(x, y), lit = (vnoise(x / 6, y / 6, sd + 23) - .5) * 1.2;
      c = e <= 1 ? K.clE : e <= 2 ? K.h0 : e <= 3 ? K.h1 : e <= 4 ? K.h2 : vnoise(x / 40, y / 40, sd + 24) + lit * .1 > .55 ? K.h3 : K.h4;
      if (e >= 5) { const fc = vnoise(x / 16, y / 7, sd + 25) * .7 + vnoise(x / 4, y / 3, sd + 27) * .3; if (fc > .77) c = fc > .82 ? K.hcL : K.hc; holes.push(j); }
    } else if (ln >= 0 && t !== 2) c = laneCol(j, ln, h);
    else if (t === 2) {
      // storm clouds: dark grey puffs, frayed at the edge
      c = stormCol(x, y);
      let n = 0; for (const q of [1, -1, MW, -MW]) if (ter[j + q] !== 2) n++; if (n) c = K.st2;
    } else if (t === 12) c = Math.sin((x - y) * .12) > .85 ? K.icL : K.ic0;
    else {
      c = cloud(x, y, h);
      // the edge of the cloud bank along the road: a soft shadow
      if (dist[j] < HALF + 2.5) c = K.cl3; else if (dist[j] < HALF + 4) c = K.cl2;
    }
    set(j, c);
    if (ln >= 0 && h > .996) glit.push(j);
  }

  yield;
  // ----- the coins: their thickness under the rim and their shadow on the clouds; the arch casts a long shadow into its gorge -----
  for (const [k, [cx, cy, cr]] of C.entries()) {
    const M = METAL[k];
    for (let y = cy - cr; y <= cy + cr + 22; y++) for (let x = cx - cr - 4; x <= cx + cr + 12; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const j = y * MW + x; if (coin[j] || dist[j] < HALF) continue;
      let th = 0; for (let q = 1; q <= 8; q++) if (y - q >= 0 && coin[(y - q) * MW + x] === k + 1) { th = q; break; }
      if (th) { set(j, th > 7 ? M[3] : (x % 3 === 0 ? M[3] : k === 4 ? LND[((x / 6) | 0) % 6] : M[1])); continue; }
      if (Math.hypot(x - 7 - cx, y - 12 - cy) < cr) dk(x, y, ter[j] === HOLE ? .7 : .86);
    }
  }
  // the raised rim of every coin is solid (only the road crosses it): nobody drives off a coin into the clouds
  for (const [cx, cy, cr] of C) for (let a = 0; a < TAU; a += 5 / cr) {
    const x = cx + Math.cos(a) * (cr - 3), y = cy + Math.sin(a) * (cr - 3), j = Math.round(y) * MW + Math.round(x);
    if (x < 0 || y < 0 || x >= MW || y >= MH || dist[j] < HALF + 4) continue;
    walls.push({ x, y, r: 3 });
  }
  const { a0, a1, g0, g1 } = RT.arch, span = (a1 - a0 + N) % N;
  const shadowM = new Uint8Array(A);
  for (let j = 0; j < A; j++) {
    if (dist[j] >= HALF || !inRange(near[j], a0, a1) || inRange(near[j], g0, g1) || coin[j]) continue;
    const f = ((near[j] - a0 + N) % N) / span, hh = Math.sin(Math.PI * f), X0 = j % MW + Math.round(10 + hh * 26), Y0 = (j / MW | 0) + Math.round(14 + hh * 38);
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) {
      const X = X0 + dx, Y = Y0 + dy; if (X >= MW || Y >= MH) continue;
      const q = Y * MW + X; if (shadowM[q] || dist[q] < HALF + 1 || coin[q]) continue;
      shadowM[q] = 1; dk(X, Y, ter[q] === HOLE ? .72 : .84);
    }
  }
  // the edge of the gap: glowing lips of the rainbow
  for (const gi of [g0, g1]) for (let o = -HALF + 1; o < HALF; o++) for (const s of [0, 1]) {
    const p = path[gi], t2 = tan[gi], n = nrm[gi], a = gi === g0 ? -s : s;
    px(p.x + n.x * o + t2.x * a, p.y + n.y * o + t2.y * a, s ? [255, 255, 255] : LNL[clamp(Math.floor((o + HALF) / 10), 0, 5)]);
  }

  yield;
  // ----- the rails of the arch: a row of little cloud puffs on glowing posts (soft walls, like the bob run) -----
  for (let i = a0; inRange(i, a0, a1); i = (i + 1) % N) {
    if (inRange(i, (g0 - 2 + N) % N, (g1 + 2) % N)) continue;
    for (const s of [-1, 1]) {
      const x = path[i].x + nrm[i].x * s * (HALF + 3), y = path[i].y + nrm[i].y * s * (HALF + 3);
      if (i % 3 === 0) walls.push({ x, y, r: 3, bob: true });
      px(x, y, [255, 255, 255]); px(x + nrm[i].x * s, y + nrm[i].y * s, [200, 206, 240]);
      if (i % 9 === 0) for (let q = 0; q < 9; q++) { const a = q / 9 * TAU; setT(x + Math.cos(a) * 2.5, y + Math.sin(a) * 2.5 - 2, q < 4 ? [255, 255, 255] : [226, 230, 248]); }
    }
    if (i === a1) break;
  }

  yield;
  // ----- the bronze coin (Cup 1): a meadow with a pale picket fence, pines, a beach chair, flowers; two cows graze on the road (see rainbow.js) -----
  const [bx, by, br] = C[0];
  for (let i = 0; i < N; i++) for (const s of [-1, 1]) {
    const x = Math.round(path[i].x + nrm[i].x * s * (HALF + 6)), y = Math.round(path[i].y + nrm[i].y * s * (HALF + 6)), j = y * MW + x;
    if (x < 0 || y < 0 || x >= MW || y >= MH || coin[j] !== 1 || Math.hypot(x - bx, y - by) > br - 9) continue;
    if (i % 6 === 0) { px(x, y, [250, 248, 240]); px(x + 1, y + 1, [190, 184, 168]); } else px(x, y, [236, 230, 214]);
  }
  const pine = (x, y) => {
    walls.push({ x, y, r: 6 }); solid(x, y, 9);
    for (let dy = -11; dy <= 11; dy++) for (let dx = -11; dx <= 11; dx++) if (dx * dx + dy * dy <= 100) dk(x + dx + 5, y + dy + 7, .75);
    const rot = hash(x, y, 3) * TAU;
    for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) {
      const dd2 = Math.hypot(dx, dy), an = Math.atan2(dy, dx), rad = 8 + 3 * Math.abs(Math.cos(an * 4 + rot)); if (dd2 > rad) continue;
      setT(x + dx, y + dy, dd2 < 2 ? [61, 145, 96] : dd2 < 5 ? ((dx + dy) < 0 ? [61, 145, 96] : [39, 112, 72]) : ((dx + dy) < -2 ? [39, 112, 72] : [27, 87, 58]));
    }
  };
  for (const [x, y] of def.pines || []) pine(x, y);
  // the beach chair (Strandkorb): a wicker basket with a striped hood, solid
  if (def.chair) {
    const [x, y] = def.chair; walls.push({ x, y, r: 7 }); solid(x, y, 9);
    for (let dy = -7; dy <= 7; dy++) for (let dx = -8; dx <= 8; dx++) dk(x + dx + 4, y + dy + 5, .8);
    for (let dy = -6; dy <= 6; dy++) for (let dx = -7; dx <= 7; dx++) setT(x + dx, y + dy, Math.abs(dx) === 7 || Math.abs(dy) === 6 ? [110, 80, 40] : dy < -1 ? (((dx + 20) >> 1) % 2 ? [40, 110, 200] : [250, 250, 250]) : ((dx + dy) % 2 ? [210, 172, 110] : [190, 150, 90]));
  }
  for (let q = 0; q < 70; q++) {
    const a = hash(q, 1, sd) * TAU, rr = Math.sqrt(hash(q, 2, sd)) * (br - 12), x = Math.round(bx + Math.cos(a) * rr), y = Math.round(by + Math.sin(a) * rr), j = y * MW + x;
    if (ter[j] !== 0 || dist[j] < HALF + 4 || wallMask[j]) continue;
    const pc = [[255, 90, 122], [255, 225, 77], [255, 255, 255]][q % 3]; px(x - 1, y, pc); px(x + 1, y, pc); px(x, y - 1, pc); px(x, y + 1, pc); px(x, y, [255, 225, 77]);
  }

  yield;
  // ----- the silver coin (Cup 2): a Japanese garden; red railings on the bridge (solid), cherry trees, a stone lantern, koi in the pond -----
  for (let i = 0; i < N; i += 1) {
    let on = false; for (let o = -HALF + 2; o < HALF; o += 4) { const x = Math.round(path[i].x + nrm[i].x * o), y = Math.round(path[i].y + nrm[i].y * o); if (RT.bridge[y * MW + x]) on = true; }
    if (!on) continue;
    for (const s of [-1, 1]) {
      const x = path[i].x + nrm[i].x * s * (HALF - 1), y = path[i].y + nrm[i].y * s * (HALF - 1);
      if (i % 3 === 0) walls.push({ x, y, r: 3 });
      const post = i % 9 < 2;
      for (let w = 0; w < 3; w++) setT(x + nrm[i].x * s * w, y + nrm[i].y * s * w, post ? (w === 1 && i % 9 === 0 ? [232, 193, 74] : [58, 26, 16]) : w === 0 ? [255, 138, 106] : w === 1 ? [224, 84, 58] : [120, 30, 20]);
      for (let w = 3; w < 6; w++) dk(x + nrm[i].x * s * w + 2, y + nrm[i].y * s * w + 3, .7);
    }
  }
  const cherry = (x, y) => {
    walls.push({ x, y, r: 6 }); solid(x, y, 9);
    for (let dy = -11; dy <= 11; dy++) for (let dx = -11; dx <= 11; dx++) if (dx * dx + dy * dy <= 110) dk(x + dx + 5, y + dy + 7, .72);
    for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
      const X = x + dx, Y = y + dy, dd2 = Math.hypot(dx, dy) + (vnoise(X * .45, Y * .45, 5) - .5) * 3.5; if (dd2 > 11) continue;
      const s2 = (dx + dy) / 11 + (vnoise(X * .5, Y * .5, 6) - .5) * .9;
      setT(X, Y, hash(X, Y, 7) < .02 ? [255, 246, 250] : s2 < -.55 ? [249, 207, 223] : s2 > .45 ? [196, 84, 127] : [233, 140, 176]);
    }
  };
  for (const [x, y] of def.cherries || []) cherry(x, y);
  if (def.lantern) {
    const [x, y] = def.lantern, L0 = [185, 183, 172], L1 = [143, 141, 130], L2 = [109, 107, 98];
    walls.push({ x, y, r: 4 }); solid(x, y, 6); for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) dk(x + dx + 2, y + dy + 3, .78);
    const rc = (x0, y0, w, h, c) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) setT(x0 + xx, y0 + yy, c); };
    rc(x - 4, y, 9, 2, L1); rc(x - 1, y - 6, 3, 6, L0); rc(x - 4, y - 11, 9, 5, L1); rc(x - 3, y - 10, 7, 3, L0); rc(x - 1, y - 10, 3, 3, [255, 211, 106]); rc(x - 5, y - 13, 11, 2, L2); rc(x - 3, y - 15, 7, 2, L1);
  }
  if (def.pond) { const [kx, ky, rx, ry] = def.pond; for (let q = 0; q < 4; q++) critters.push({ type: 'koi', x: kx, y: ky + (q < 2 ? -ry * .55 : ry * .55), rx: rx * .5, ry: ry * .25, ph: q * 1.7, col: q % 3 }); }

  yield;
  // ----- the gold coin (Cup 3): cacti at the rim (solid), the flags of the ice ramp, a blue line where good jumps land -----
  const cactus = (x, y) => {
    walls.push({ x, y, r: 4 }); solid(x, y, 6);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) dk(x + dx + 3, y + dy + 4, .8);
    const G0 = [58, 140, 70], G1 = [40, 104, 52], G2 = [96, 180, 96];
    for (let k = 0; k < 13; k++) for (let w = -2; w <= 2; w++) setT(x + w, y - k, w === -2 ? G2 : w === 2 ? G1 : G0);
    for (const s of [-1, 1]) { for (let k = 0; k < 4; k++) setT(x + s * (3 + k), y - 5, G0); for (let k = 0; k < 5; k++) setT(x + s * 6, y - 5 - k, s < 0 ? G2 : G1); }
    setT(x, y - 13, [255, 120, 160]);
  };
  for (const [x, y] of def.cacti || []) cactus(x, y);
  { const { rl } = RT.ramp, p = path[rl], n = nrm[rl]; for (const s of [-1, 1]) { const x = p.x + n.x * s * (HALF + 3), y = p.y + n.y * s * (HALF + 3); for (let k = 0; k < 12; k++) setT(x, y - k, [90, 90, 96]); for (let q = 0; q < 5; q++) for (let w = 0; w < 6; w++) setT(x + w * s, y - 11 + q, q < 2 ? [216, 58, 44] : [255, 255, 255]); walls.push({ x, y, r: 2 }); } }

  yield;
  // ----- the platinum coin (Cup 4): a little volcano (solid) with a lava rill running down beside the road (only to look at: a rock rim keeps
  // the cars out), the rim of the wormhole platform -----
  if (def.cone) {
    const [vx, vy, vr] = def.cone;
    walls.push({ x: vx, y: vy, r: vr - 4 }); solid(vx, vy, vr + 2);
    for (let dy = -vr - 6; dy <= vr + 6; dy++) for (let dx = -vr - 6; dx <= vr + 6; dx++) if (dx * dx + dy * dy <= (vr + 4) ** 2) dk(vx + dx + 6, vy + dy + 8, .7);
    for (let dy = -vr; dy <= vr; dy++) for (let dx = -vr; dx <= vr; dx++) {
      const dd2 = Math.hypot(dx, dy) + (vnoise((vx + dx) * .3, (vy + dy) * .3, sd + 30) - .5) * 3; if (dd2 > vr) continue;
      const sh = (dx + dy) / vr, X = vx + dx, Y = vy + dy;
      let c = dd2 < vr * .32 ? (dd2 < vr * .22 ? K.lv1 : K.lvD) : sh < -.3 ? [110, 100, 96] : sh > .3 ? [52, 46, 44] : [80, 72, 68];
      if (dd2 < vr * .14) c = K.lv2;
      if (dd2 >= vr * .32 && Math.abs(Math.atan2(dy, dx) - 2.35) < .16) c = K.lv0; // the lava runs out of the crater
      setT(X, Y, c);
    }
    const rill = def.rill || [];
    for (let q = 1; q < rill.length; q++) {
      const [x0, y0] = rill[q - 1], [x1, y1] = rill[q], L = Math.hypot(x1 - x0, y1 - y0);
      for (let s = 0; s <= L; s += 1) {
        const x = x0 + (x1 - x0) * s / L, y = y0 + (y1 - y0) * s / L;
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const r2 = Math.hypot(dx, dy); if (r2 > 4) continue; px(x + dx, y + dy, r2 > 3 ? [42, 36, 34] : r2 > 2 ? K.lvD : hash(Math.round(x + dx), Math.round(y + dy), 31) < .3 ? K.lv2 : K.lv0); }
        if (s % 6 < 1) walls.push({ x, y, r: 4 });
      }
    }
  }
  const [wx, wy, wr] = def.portals.a;
  for (let a = 0; a < TAU; a += .02) for (let q = 0; q < 3; q++) { const x = Math.round(wx + Math.cos(a) * (wr - q)), y = Math.round(wy + Math.sin(a) * (wr - q)); px(x, y, q === 0 ? K.plD : ((Math.floor(a * 6)) & 1 ? K.hz : K.hzD)); }

  yield;
  // ----- the Fantasy coin: the start under a gate of clouds with pennants in all colours, a winners' podium beside the road -----
  for (let a = -6; a <= 6; a++) for (let o = -HALF + 1; o < HALF; o++) {
    const p = path[0], x = Math.round(p.x + tan[0].x * a + nrm[0].x * o), y = Math.round(p.y + tan[0].y * a + nrm[0].y * o);
    px(x, y, ((Math.floor(a + 6) >> 2) + (Math.floor(o + 100) >> 2)) & 1 ? [245, 245, 240] : [34, 30, 28]);
  }
  {
    const p = path[2], n = nrm[2], t2 = tan[2];
    for (const s of [-1, 1]) {
      const x = p.x + n.x * s * (HALF + 9), y = p.y + n.y * s * (HALF + 9);
      walls.push({ x, y, r: 6 }); solid(x, y, 8);
      for (let q = 0; q < 26; q++) { const a = q / 26 * TAU; for (let rr = 0; rr < 7; rr++) setT(x + Math.cos(a) * rr, y + Math.sin(a) * rr, rr > 5 ? [200, 206, 236] : (Math.cos(a) + Math.sin(a) < 0 ? [255, 255, 255] : [236, 238, 250])); }
    }
    // the banner over the road: a band of the six colours with pennants hanging from it
    for (let o = -HALF - 9; o <= HALF + 9; o++) for (let w = -3; w <= 2; w++) {
      const x = p.x + n.x * o + t2.x * w, y = p.y + n.y * o + t2.y * w;
      setT(x, y, LN[clamp(Math.floor((w + 3)), 0, 5)]);
    }
    for (let o = -HALF + 3; o <= HALF - 3; o += 7) for (let q = 0; q < 5; q++) for (let w = -(4 - q >> 1); w <= (4 - q >> 1); w++) setT(p.x + n.x * (o + w) - t2.x * (4 + q), p.y + n.y * (o + w) - t2.y * (4 + q), LN[((o + 40) / 7 | 0) % 6]);
  }
  if (def.podium) {
    const [x, y] = def.podium;
    for (const [dx, h, col, n] of /** @type {Array<[number, number, number[], number]>} */ ([[-12, 10, [200, 200, 210], 2], [0, 15, [255, 210, 60], 1], [12, 6, [205, 127, 50], 3]])) {
      walls.push({ x: x + dx, y, r: 6 });
      for (let yy = -h; yy <= 6; yy++) for (let xx = -6; xx <= 6; xx++) setT(x + dx + xx, y + yy, Math.abs(xx) === 6 || yy === -h ? [60, 50, 70] : yy < -h + 3 ? col : [240, 236, 248]);
      for (let k = 0; k < n; k++) setT(x + dx - 1 + k * 2, y - h + 6, [60, 50, 70]);
      for (let yy = 0; yy < 10; yy++) for (let xx = -7; xx <= 7; xx++) dk(x + dx + xx + 4, y + yy + 4, .85);
    }
    solid(x, y, 18);
  }

  yield;
  // ----- the cup symbols, large on every coin (an inlay in the metal of the coin): road, bonsai, star, bolt, unicorn -----
  for (const [k, name] of COINS.entries()) {
    const E = (def.emblems || {})[name]; if (!E) continue;
    const [ex, ey, sz] = E, M = METAL[k];
    const plate = (X, Y) => { const j = Y * MW + X; return j >= 0 && j < A && !wallMask[j] && ter[j] === 0 && coin[j] === k + 1; };
    const ink = (X, Y, c) => { if (plate(X, Y)) set(Y * MW + X, c); };
    for (let y = -sz - 3; y <= sz + 3; y++) for (let x = -sz - 3; x <= sz + 3; x++) {
      const r2 = Math.hypot(x, y); if (r2 > sz + 3) continue;
      ink(ex + x, ey + y, r2 > sz + 1.5 ? M[3] : r2 > sz ? M[2] : M[(x + y) < 0 ? 0 : 1]);
    }
    const s = sz / 10, P = (x, y, c) => { for (let q = 0; q < Math.max(1, s); q++) for (let w = 0; w < Math.max(1, s); w++) ink(Math.round(ex + x * s + q), Math.round(ey + y * s + w), c); };
    const D = M[3], L = M[2];
    if (k === 0) { for (let y = -8; y <= 8; y++) { const hw = 2 + (y + 8) * .25; for (let x = -hw; x <= hw; x++) P(x, y, Math.abs(Math.abs(x) - hw) < 1 ? L : D); if (y % 4 < 2) P(0, y, L); } }
    else if (k === 1) { for (let y = 4; y <= 8; y++) for (let x = -5; x <= 5; x++) P(x, y, D); for (let y = -2; y < 4; y++) P(Math.round(Math.sin(y * .6)), y, D); for (const [qx, qy, qr] of [[-4, -4, 3], [3, -6, 3], [0, -8, 2.5]]) for (let y = -qr; y <= qr; y++) for (let x = -qr; x <= qr; x++) if (x * x + y * y <= qr * qr) P(qx + x, qy + y, (x + y) < 0 ? L : D); }
    else if (k === 2) { for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) { const a = Math.atan2(y, x) + Math.PI / 2, rr = Math.hypot(x, y), lim = 3.6 + 5.4 * Math.max(0, Math.cos(2.5 * (((a % (TAU / 5)) + TAU / 5) % (TAU / 5) - TAU / 10) * 2)); if (rr <= Math.max(3.8, lim)) P(x, y, (x + y) < 0 ? L : D); } }
    else if (k === 3) { const B = [[2, -9], [-4, 1], [0, 1], [-3, 9], [5, -2], [1, -2], [4, -9]]; for (let y = -9; y <= 9; y++) for (let x = -6; x <= 6; x++) { let ins = false; for (let a = 0, b = B.length - 1; a < B.length; b = a++) if ((B[a][1] > y) !== (B[b][1] > y) && x < (B[b][0] - B[a][0]) * (y - B[a][1]) / (B[b][1] - B[a][1]) + B[a][0]) ins = !ins; if (ins) P(x, y, x < 0 ? L : D); } }
    else { for (const [qx, qy, qr] of [[0, 2, 6], [-4, -2, 4]]) for (let y = -qr; y <= qr; y++) for (let x = -qr; x <= qr; x++) if (x * x + y * y <= qr * qr) P(qx + x, qy + y, [255, 255, 255]); for (let q = 0; q < 8; q++) P(-5 - q * .3, -6 - q, LN[q % 6]); P(-6, -3, [60, 40, 90]); for (let y = -4; y <= 6; y++) P(4, y, LN[(y + 6) % 6]); }
  }

  yield;
  // ----- the rain shower before the finish: a wet, glossy stretch that washes (a little cloud rains on it, see rainbow.js) -----
  const si = nearestIdx(path, def.shower[0], def.shower[1]);
  for (let j = 0; j < A; j++) {
    if (dist[j] >= HALF || !inRange(near[j], (si - 9 + N) % N, (si + 9) % N) || ter[j] === 2) continue;
    washMask[j] = 1;
    const i = (j * 4); d[i] = Math.min(255, d[i] * .85 + 40); d[i + 1] = Math.min(255, d[i + 1] * .85 + 46); d[i + 2] = Math.min(255, d[i + 2] * .85 + 60);
    if (hash(j % MW, j / MW | 0, sd + 40) < .04) set(j, [255, 255, 255]);
  }

  yield;
  // the overlays of the race (rainbow.js): the clean lanes (to clear the storm clouds again), the same in grey (the storm), the double rainbow
  const grey = new ImageData(MW, MH), gd = grey.data;
  for (let j = 0; j < A; j++) {
    const q = j * 4; if (!cd[q + 3] || ter[j] === 2) continue; // (the storm clouds on the road stay as they are)
    const ln = RT.lane[j] - 1, l = (cd[q] * .3 + cd[q + 1] * .55 + cd[q + 2] * .15) * .8 + 30, keep = ln === 0 || ln === 4 ? .35 : 0;
    gd[q] = l + (cd[q] - l) * keep; gd[q + 1] = l + (cd[q + 1] - l) * keep; gd[q + 2] = l + 8 + (cd[q + 2] - l) * keep; gd[q + 3] = 255;
  }
  const toC = img => { const c = mk(MW, MH); c.getContext('2d').putImageData(img, 0, 0); return c; };
  // the double rainbow: its pixels in their colours, in a small picture of its own
  let x0 = MW, y0 = MH, x1 = 0, y1 = 0;
  for (const j of RT.dPix) { const x = j % MW, y = j / MW | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const dW = Math.max(1, x1 - x0 + 1), dH = Math.max(1, y1 - y0 + 1), dImg = new ImageData(dW, dH);
  RT.dPix.forEach((j, q) => {
    const x = j % MW, y = j / MW | 0, ln = RT.dLane[q], h = hash(x, y, sd + 41), k = ((y - y0) * dW + x - x0) * 4;
    let c = h > .99 ? [255, 255, 255] : (x + y) % 13 === 0 ? LNL[ln] : LN[ln];
    let edge = false; for (const o of [1, -1, MW, -MW]) if (!RT.dblM[j + o]) edge = true;
    if (edge) c = [255, 255, 255];
    dImg.data[k] = c[0]; dImg.data[k + 1] = c[1]; dImg.data[k + 2] = c[2]; dImg.data[k + 3] = 255;
  });
  const dC = mk(dW, dH); dC.getContext('2d').putImageData(dImg, 0, 0);

  // the storm clouds that the storm brings (event gewitter): a small picture each, drawn over the road while they are there
  const spots = RT.stormSpots.map(sp => {
    let u0 = MW, v0 = MH, u1 = 0, v1 = 0; const on = new Set(sp.px);
    for (const j of sp.px) { const x = j % MW, y = j / MW | 0; if (x < u0) u0 = x; if (x > u1) u1 = x; if (y < v0) v0 = y; if (y > v1) v1 = y; }
    const w = Math.max(1, u1 - u0 + 1), h = Math.max(1, v1 - v0 + 1), c = mk(w, h), g = c.getContext('2d'), img = g.createImageData(w, h);
    for (const j of sp.px) {
      const x = j % MW, y = j / MW | 0, k = ((y - v0) * w + x - u0) * 4; let col = stormCol(x, y);
      for (const o of [1, -1, MW, -MW]) if (!on.has(j + o)) col = K.st2;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return { px: sp.px, x: sp.x, y: sp.y, pic: { c, x: u0, y: v0 }, box: [u0, v0, w, h] };
  });
  const P = def.portals, ia = nearestIdx(path, P.a[0], P.a[1]), ib = nearestIdx(path, P.b[0], P.b[1]);
  const di0 = nearestIdx(path, def.double[0][0], def.double[0][1]), di1 = nearestIdx(path, def.double[3][0], def.double[3][1]);
  return { jumps: RT.jumps, pushes: RT.pushes, alt: RT.alt, coin, lane: RT.lane, brown: RT.brown, kerb: RT.kerb, gorge: RT.gorge, arch: RT.arch, ramp: RT.ramp,
    clean: toC(clean), grey: toC(grey), glit, holes, stormPix: RT.stormPix, stormSpots: spots,
    dbl: { pts: RT.dbl, pix: RT.dPix, lanes: RT.dLane, pic: { c: dC, x: x0, y: y0 }, i0: di0, i1: di1 },
    portals: { ia, ib, a: { x: P.a[0], y: P.a[1], r: P.a[2] }, b: { x: path[ib].x, y: path[ib].y } },
    showerI: si, shower: { x: path[si].x, y: path[si].y }, cone: def.cone, mudPix };
}
