import { HALF, TAU, clamp, hash, hex, inRange, mk, vnoise } from './core.js';
import { nearestIdx, paintTools } from './bau.js';
import { edgeCircles, stampWay } from './kit.js';

// ---------- Regenbogen Rev 2: the finale over the clouds (plaene/REGENBOGEN_REV2.md) ----------
// A lap of honour over five floating coins, each with two landmarks of its cup: Fantasy (start under a gate of clouds, the podium), bronze
// (earth road, a puddle at the edge, two cows, a pier with a shower that only looks the part), the rainbow arch over a cloud gorge (the biggest
// jump of the game over the gap at its top), a fork: the rainbow road round the north or the cloud path (soft, narrow, holes at its edge),
// silver (a red bridge over a cloud pond with koi, the cloud train with a crossing and a ramp on one half of the road), gold (an asphalt S with
// kerbs and gravel, the sphinx gate, at its end a chair lift over the crevasse onto the platinum coin), platinum (a lava tube through a little
// cone, a liana over a crack in the coin against the bow round it, the wormhole), the spiral through the sea of clouds (boost arrows, the
// double rainbow in the last lap) and the rain bay before the finish (the only place that washes).
// Terrain: 41..46 the six colour lanes (red on the left in driving direction, violet on the right; each works differently, see rainbow.js),
// 47 the asphalt of the gold coin, 48 a cloud hole (you fall through, a unicorn brings you back), 130 the cloud path (soft, a little slower),
// 131 the station of the chair lift (the car is hooked on), 0 soft clouds beside the road and the ground of the coins (slow like grass, clean),
// 1 the roads of the bronze, silver, platinum and Fantasy coins, the pier and the bay, 2 storm clouds (like mud, grey; on the bronze coin a brown
// puddle), 5 the cloud pond (deep water), 7 gravel, 15 the lava rill in the tube, 4 boost arrows.

export const LANE = 41, ASPH = 47, HOLE = 48, CLOUD = 130, LIFT = 131;
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
  st0: '#5b6075', st1: '#6d7388', st2: '#82889c', stL: '#a4aabb', stH: '#c6cad8',
  gr0: '#63c24a', gr1: '#55b03e', gr2: '#74d05a', grD: '#3e8e2e', er0: '#c99e69', er1: '#bb905b', er2: '#d5ad79', erE: '#9b7349',
  md0: '#5a3a1f', md1: '#4b301a', md2: '#664327', sg0: '#6fb85a', sg1: '#62a84e', sg2: '#7ec766', pa0: '#c4ad86', pa1: '#b59d76', pa2: '#d0ba94', paE: '#948063',
  wa0: '#7fc4e8', wa1: '#95d2f0', wa2: '#b2e2f8', wa3: '#e8f6ff', waE: '#5a9ac0',
  sa0: '#ecca8a', sa1: '#e2bf7c', sa2: '#f4d69e', as0: '#55565b', as1: '#4d4e53', as2: '#5d5e63', asE: '#ecece6', kR: '#d83a2c', kW: '#f4f4ee',
  gv0: '#b8a888', gv1: '#a89878', gv2: '#c8b898', rk0: '#4a4442', rk1: '#423c3a', rk2: '#544e4a', rkL: '#6a625c', bs0: '#7a7480', bs1: '#706a76', bs2: '#86808c', bsE: '#ff8a3a',
  lv0: '#ff7a1a', lv1: '#ffb02a', lv2: '#ffe04a', lvD: '#c8401a', pe0: '#fdf5ff', pe1: '#f3eaff', pe2: '#fff7ea', peE: '#e6d6f6',
  cp0: '#f1dcff', cp1: '#e6ccfa', cp2: '#dabcf2', cpE: '#f2b630', hz: '#ffd23f', hzD: '#26262c', pl: '#8a92a0', plD: '#4a5060',
  wd0: '#b07a48', wd1: '#9a6a3c', wdD: '#6a4424', bay0: '#cfeefc', bay1: '#b6e2f6', bay2: '#e6f8ff',
}).map(([k, v]) => [k, hex(v)]));

const bez = (P, t) => { const u = 1 - t; return [0, 1].map(k => u * u * u * P[0][k] + 3 * u * u * t * P[1][k] + 3 * u * t * t * P[2][k] + t * t * t * P[3][k]); };

// a way of its own (the cloud path, the liana chord, the rain bay): its points with the index of the centre line they count for
function wayOf(pts, path, N) {
  const i0 = nearestIdx(path, pts[0].x, pts[0].y), i1 = nearestIdx(path, pts[pts.length - 1].x, pts[pts.length - 1].y), span = (i1 - i0 + N) % N;
  return { pts: pts.map((p, k) => ({ x: p.x, y: p.y, i: (i0 + Math.round(span * k / Math.max(1, pts.length - 1))) % N })), i0, i1 };
}

// the box of the path between indices i0 and i1, w px round it
function idxBox(path, N, i0, i1, w, MW, MH) {
  let x0 = MW, y0 = MH, x1 = 0, y1 = 0;
  for (let i = i0; ; i = (i + 1) % N) { const p = path[i]; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); if (i === i1) break; }
  return [Math.max(0, Math.floor(x0 - w)), Math.max(0, Math.floor(y0 - w)), Math.min(MW - 1, Math.ceil(x1 + w)), Math.min(MH - 1, Math.ceil(y1 + w))];
}

// the main classification of every pixel, one band of rows (a plain function: fast after the first calls)
function classifyRows(Z, ya, yb) {
  const { MW, ter, dist, coin, inside, dd, dk, dbl, lane, alt, dblM, gorge, dPix, dLane, off, sd, archX, archY, archR } = Z, DH = 17;
  for (let y = ya; y < yb; y++) for (let x = 0; x < MW; x++) {
    const j = y * MW + x, k = coin[j], road = dist[j] < HALF;
    // the double rainbow: its own lanes across its width (6 px each)
    if (dd[j] < DH && !road && !k) {
      const q = dk[j], a = dbl[Math.max(0, q - 2)], b = dbl[Math.min(dbl.length - 1, q + 2)], tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
      const o = ((x + .5 - dbl[q].x) * -ty + (y + .5 - dbl[q].y) * tx) / l;
      dblM[j] = 1; alt[j] = 1; dPix.push(j); dLane.push(clamp(Math.floor((o + DH) / (2 * DH) * 6), 0, 5));
    }
    if (road) {
      if (ter[j] === 4) continue;
      if (k) { ter[j] = k === 3 ? ASPH : 1; continue; }
      const ln = clamp(Math.floor((off(j) + HALF) / (2 * HALF) * 6), 0, 5);
      ter[j] = LANE + ln; lane[j] = ln + 1;
      continue;
    }
    if (k) { ter[j] = 0; continue; }
    // cloud holes: the gorge inside the loop (behind a bank of clouds along the road), the gorge under the arch, the gorge under the double rainbow
    let hole = false;
    const e = dist[j];
    if (inside[j] && e > HALF + 16) hole = e > HALF + 40 || e > HALF + 16 + 22 * vnoise(x * .028, y * .028, sd + 1);
    if (!hole && Math.abs(x - archX) < archR + 20 && y < archY + 180) {
      const ex = (x + .5 - archX) / (archR + 18 * (vnoise(x * .03, y * .03, sd + 2) - .5)), ey = (y + .5 - archY) / 175; hole = ex * ex + ey * ey < 1;
    }
    if (!hole && dd[j] < 70) { const dq = dk[j] / dbl.length; hole = dq > .06 && dq < .97 && dd[j] < 52 + 18 * vnoise(x * .04, y * .04, sd + 4) && e > HALF + 16; }
    if (hole) { ter[j] = HOLE; gorge[j] = 1; } else ter[j] = 0;
  }
}

// terrain, before the ground is painted. S: { MW, MH, def, ter, dist, near, path, tan, nrm, N }
export function* rainbowTerrain(S) {
  const { MW, MH, def, ter, dist, near, path, tan, nrm, N } = S, A = MW * MH, sd = def.seed * 7;
  const coin = new Uint8Array(A), lane = new Uint8Array(A), alt = new Uint8Array(A), inside = new Uint8Array(A), brown = new Uint8Array(A), bridge = new Uint8Array(A);
  const kerb = new Uint8Array(A), plat = new Uint8Array(A), dblM = new Uint8Array(A), gorge = new Uint8Array(A), wayM = new Uint8Array(A), tubeM = new Uint8Array(A);
  const { off } = paintTools(S);
  const C = COINS.map(k => def.coins[k]);
  const ni = q => nearestIdx(path, q[0], q[1]);
  // the coins
  C.forEach(([cx, cy, r], k) => { for (let y = Math.max(0, cy - r); y <= Math.min(MH - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(MW - 1, cx + r); x++) if (Math.hypot(x + .5 - cx, y + .5 - cy) < r) coin[y * MW + x] = k + 1; });
  yield;
  // inside the loop of the road (even-odd per row): the middle of the map is a deep cloud gorge, nobody cuts across it
  for (let y = 0; y < MH; y++) {
    const yc = y + .5, xs = [];
    for (let i = 0; i < N; i++) { const a = path[i], b = path[(i + 1) % N]; if ((a.y <= yc) !== (b.y <= yc)) xs.push(a.x + (yc - a.y) / (b.y - a.y) * (b.x - a.x)); }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - .5)); x <= Math.min(MW - 1, Math.floor(xs[k + 1] - .5)); x++) inside[y * MW + x] = 1;
    if (y % 200 === 199) yield;
  }
  // the arch: where it starts and ends, its gap at the top
  const [a0, a1, g0, g1] = def.arch.map(ni);
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
  const dPix = [], dLane = [], archX = (def.arch[0][0] + def.arch[1][0]) / 2, archY = def.arch[0][1], archR = (def.arch[1][0] - def.arch[0][0]) / 2 + 4;
  const Z = { MW, ter, dist, coin, inside, dd, dk, dbl, lane, alt, dblM, gorge, dPix, dLane, off, sd, archX, archY, archR };
  for (let y = 0; y < MH; y += 50) { classifyRows(Z, y, Math.min(MH, y + 50)); yield; }
  // the gap at the top of the arch: no road there
  { const [x0, y0, x1, y1] = idxBox(path, N, g0, g1, HALF + 2, MW, MH); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const j = y * MW + x; if (dist[j] < HALF + 1 && inRange(near[j], g0, g1) && !coin[j]) { ter[j] = HOLE; lane[j] = 0; gorge[j] = 1; } } }
  yield;
  // the crevasse between the gold and the platinum coin: from the gorge in the middle out to the edge of the map; the chair lift crosses it
  const [h0, h1] = def.crevasse.map(ni), hc = (h0 + Math.round(((h1 - h0 + N) % N) / 2)) % N, half = ((h1 - h0 + N) % N) + 1, pc = path[hc], tg = tan[hc], nm = nrm[hc];
  // (out = the side of the road that is outside the loop: there it runs to the edge of the map; inside only up to the gorge, 80 px)
  const out = inside[Math.round(pc.y + nm.y * 100) * MW + Math.round(pc.x + nm.x * 100)] ? -1 : 1;
  for (let y = Math.max(0, Math.floor(pc.y - half - 20)); y <= Math.min(MH - 1, pc.y + half + 20); y++) for (let x = 0; x < MW; x++) {
    const j = y * MW + x; if (coin[j]) continue;
    const al = (x + .5 - pc.x) * tg.x + (y + .5 - pc.y) * tg.y, ac = ((x + .5 - pc.x) * nm.x + (y + .5 - pc.y) * nm.y) * out;
    if (Math.abs(al) < half + 6 * (vnoise(ac * .06, 3, sd + 9) - .4) && ac > -HALF - 80) { ter[j] = HOLE; lane[j] = 0; gorge[j] = 1; }
  }
  // the station of the lift: the last stretch of road on the gold coin before the crevasse
  const s0 = (h0 - 16 + N) % N, s1 = (h0 - 2 + N) % N, liftLand = (h1 + 8) % N;
  { const [x0, y0, x1, y1] = idxBox(path, N, s0, s1, HALF + 2, MW, MH); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const j = y * MW + x; if (dist[j] < HALF && inRange(near[j], s0, s1)) { ter[j] = LIFT; lane[j] = 0; } } }
  yield;
  // the cloud path (fork after the arch): narrow, soft, over the gorge; bites of holes eat into its edge here and there
  const CP = def.cloudPath, cpHalf = 17;
  const cpPts = stampWay(CP, cpHalf + 9, (j, e) => {
    if (dist[j] < HALF) return;
    if (e < cpHalf) { ter[j] = CLOUD; alt[j] = 1; wayM[j] = 1; gorge[j] = 0; lane[j] = 0; } else if (ter[j] === HOLE) ter[j] = 0; // (a thin bank of cloud on both sides)
  }, MW, MH);
  const cloudWay = wayOf(cpPts, path, N), bites = [];
  for (let k = 14; k < cpPts.length - 14; k += 23) {
    const p = cpPts[k], q = cpPts[k + 1], tx = q.x - p.x, ty = q.y - p.y, l = Math.hypot(tx, ty) || 1, s = hash(k, 1, sd) < .5 ? 1 : -1, r = 10 + 4 * hash(k, 2, sd);
    const bx = p.x - ty / l * s * (cpHalf + 3), by = p.y + tx / l * s * (cpHalf + 3); bites.push([bx, by, r]);
    for (let y = Math.floor(by - r - 2); y <= by + r + 2; y++) for (let x = Math.floor(bx - r - 2); x <= bx + r + 2; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const j = y * MW + x; if (dist[j] < HALF + 2 || coin[j]) continue;
      if (Math.hypot(x + .5 - bx, y + .5 - by) < r * (.8 + .35 * vnoise(x * .2, y * .2, sd + 31))) { ter[j] = HOLE; gorge[j] = 1; alt[j] = 0; wayM[j] = 0; }
    }
  }
  yield;
  // the rain bay before the finish: a little lagoon of cloud south of the road (washes in its middle, see paintRainbow)
  const bayPts = stampWay(def.bay, 18, (j) => { if (dist[j] < HALF) return; ter[j] = 1; alt[j] = 1; wayM[j] = 2; gorge[j] = 0; lane[j] = 0; }, MW, MH);
  const bayWay = wayOf(bayPts, path, N);
  // the pier of the bronze coin (Strandsteg with a shower, only to look at): planks out from the road
  if (def.jetty) stampWay(def.jetty, 9, j => { if (dist[j] < HALF || coin[j] !== 1) return; ter[j] = 1; alt[j] = 1; wayM[j] = 3; }, MW, MH);
  // the bronze coin: a mud puddle at the edge of the earth road (brown, not grey)
  if (def.puddle) {
    const [px, py, rx, ry] = def.puddle;
    for (let y = py - ry - 4; y <= py + ry + 4; y++) for (let x = px - rx - 4; x <= px + rx + 4; x++) {
      const j = y * MW + x; if (coin[j] !== 1 || wayM[j]) continue;
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
  { const [cx, cy, cr] = C[2]; for (let y = cy - cr; y <= cy + cr; y++) for (let x = cx - cr; x <= cx + cr; x++) {
    const j = y * MW + x; if (coin[j] !== 3 || dist[j] >= HALF || dist[j] < HALF - 6) continue;
    const i = near[j], ta = tan[(i - 8 + N) % N], tb = tan[(i + 8) % N], turn = ta.x * tb.y - ta.y * tb.x;
    if (Math.abs(turn) > .1 && off(j) * turn > 0) kerb[j] = 1;
  } }
  yield;
  // the platinum coin: a crack through the metal (a cloud hole) between the bow of the road and the liana chord
  const L = def.liana, [lax, lay] = L.a, [lbx, lby] = L.b, ll = Math.hypot(lbx - lax, lby - lay), ldx = (lbx - lax) / ll, ldy = (lby - lay) / ll;
  const crack = { x: lax + ldx * ll * .5, y: lay + ldy * ll * .5, len: 48, w: 18, dx: ldx, dy: ldy };
  const lianaPts = stampWay([L.a, L.b], 16, (j) => { if (dist[j] < HALF) return; ter[j] = 1; alt[j] = 1; wayM[j] = 4; }, MW, MH);
  for (let y = Math.floor(crack.y - 60); y <= crack.y + 60; y++) for (let x = Math.floor(crack.x - 60); x <= crack.x + 60; x++) {
    const j = y * MW + x; if (dist[j] < HALF + 3) continue;
    const a = (x + .5 - crack.x) * ldx + (y + .5 - crack.y) * ldy, c = -(x + .5 - crack.x) * ldy + (y + .5 - crack.y) * ldx;
    const w = crack.w * (1 - (c / crack.len) ** 2) + 4 * (vnoise(c * .3, 1, sd + 33) - .5);
    if (Math.abs(c) < crack.len && Math.abs(a) < w) { ter[j] = HOLE; gorge[j] = 1; alt[j] = 0; wayM[j] = 0; }
  }
  const lianaWay = wayOf(lianaPts, path, N);
  // the lava tube: the road runs through a little cone; inside it a rill of lava beside the road, the rest of the cone is rock (solid)
  const [vx, vy, vr] = def.cone;
  for (let y = vy - vr; y <= vy + vr; y++) for (let x = vx - vr; x <= vx + vr; x++) {
    const j = y * MW + x, dc = Math.hypot(x + .5 - vx, y + .5 - vy); if (dc > vr) continue;
    tubeM[j] = 1;
    if (dist[j] < HALF) continue;
    if (dist[j] < HALF + 7 && off(j) > 0) ter[j] = 15; else ter[j] = 0;
  }
  // the little platform of the wormhole on the platinum coin
  const [wx, wy, wr] = def.portals.a;
  for (let y = wy - wr - 1; y <= wy + wr + 1; y++) for (let x = wx - wr - 1; x <= wx + wr + 1; x++) { const j = y * MW + x; if (Math.hypot(x + .5 - wx, y + .5 - wy) < wr && dist[j] >= HALF) { ter[j] = 1; plat[j] = 1; alt[j] = 1; } }
  yield;
  // storm clouds on the rainbow (static ones; the storm brings more, see rainbow.js): they drift onto the road from the bank at one side
  const stampOn = (t, o, rx, ry, fn) => {
    const i = Math.floor(t * N) % N, p = path[i], tg2 = tan[i], nm2 = nrm[i], cx = p.x + nm2.x * o, cy = p.y + nm2.y * o, R = Math.ceil(Math.max(rx, ry) * 1.3);
    for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const dx = x + .5 - cx, dy = y + .5 - cy, a = dx * tg2.x + dy * tg2.y, c = dx * nm2.x + dy * nm2.y;
      if ((a / rx) ** 2 + (c / ry) ** 2 < .75 + .45 * vnoise(x * .16, y * .16, sd + 8 + t * 100)) fn(y * MW + x);
    }
  };
  const stormPix = [];
  for (const [t, o, rx, ry] of def.storm || []) stampOn(t, o, rx, ry, j => { if (lane[j]) { ter[j] = 2; stormPix.push(j); } });
  // the runtime storm spots (event gewitter): which road pixels they will cover
  const stormSpots = (def.stormAt || []).map(([t, o, rx, ry]) => { const px = []; stampOn(t, o, rx, ry, j => { if (lane[j] && ter[j] >= LANE && ter[j] < LANE + 6) px.push(j); }); const p = path[Math.floor(t * N) % N]; return { px, x: p.x, y: p.y }; });
  yield;
  // jumps: the gap of the arch, the ramp at the cloud train (one half of the road), the liana (on only while it swings on this side, rainbow.js)
  const T = i => tan[i], P = i => path[i];
  const landI = (g1 + 14) % N, iA = lianaWay.i0, ri = ni(def.train.ramp), rn = nrm[ri];
  const lip = lianaPts[Math.max(0, Math.round((ll * .5 - crack.w - 14) / 2))];
  const jumps = [
    { x: P(g0).x - T(g0).x * 2, y: P(g0).y - T(g0).y * 2, tx: T(g0).x, ty: T(g0).y, lo: -HALF - 4, hi: HALF + 4, vz: 247, land: landI, sfx: 'bigJump' },
    { x: P(ri).x, y: P(ri).y, tx: T(ri).x, ty: T(ri).y, lo: -HALF - 4, hi: -2, vz: 125, cap: 150 },
    { x: lip.x, y: lip.y, tx: ldx, ty: ldy, lo: -17, hi: 17, vz: 150, land: iA, off: true, soft: true, liana: true, sfx: 'tarzan' },
  ];
  const pushes = [{ i0: a0, i1: (g0 - 1 + N) % N, f: -26 }, { i0: g1, i1: a1, f: 60 }];
  return { coin, lane, alt, inside, brown, bridge, kerb, plat, dblM, gorge, wayM, tubeM, dbl, dPix, dLane, stormPix, stormSpots, jumps, pushes, bites, crack,
    arch: { a0, a1, g0, g1, landI }, lift: { s0, s1, h0, h1, land: liftLand }, ways: { cloud: cloudWay, bay: bayWay, liana: lianaWay }, rampI: ri, rampN: { x: rn.x, y: rn.y } };
}

// ======================================================= painting

// shading of the holes: chessboard distance to the edge of the hole, up to 6 (two passes)
function holeDepth(ter, MW, MH) {
  const A = MW * MH, D = new Uint8Array(A);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const j = y * MW + x; if (ter[j] !== HOLE) continue;
    let v = 6; if (x > 0) v = Math.min(v, D[j - 1] + 1); else v = 1; if (y > 0) { v = Math.min(v, D[j - MW] + 1); if (x > 0) v = Math.min(v, D[j - MW - 1] + 1); if (x < MW - 1) v = Math.min(v, D[j - MW + 1] + 1); } else v = 1;
    D[j] = v;
  }
  for (let y = MH - 1; y >= 0; y--) for (let x = MW - 1; x >= 0; x--) {
    const j = y * MW + x; if (ter[j] !== HOLE) continue;
    let v = D[j]; if (x < MW - 1) v = Math.min(v, D[j + 1] + 1); else v = 1; if (y < MH - 1) { v = Math.min(v, D[j + MW] + 1); if (x < MW - 1) v = Math.min(v, D[j + MW + 1] + 1); if (x > 0) v = Math.min(v, D[j + MW - 1] + 1); } else v = 1;
    D[j] = v;
  }
  return D;
}

// the soft sea of clouds: a coarse field (every 4 px) of puffy lumps lit from the top left, read with bilinear filtering
function cloudField(MW, MH, sd) {
  const GW = (MW >> 2) + 2, GH = (MH >> 2) + 2, F = new Float32Array(GW * GH);
  const big = (x, y) => vnoise(x / 30, y / 30, sd + 11) * .6 + vnoise(x / 12, y / 12, sd + 12) * .3 + vnoise(x / 5, y / 5, sd + 13) * .1;
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) { const x = gx * 4, y = gy * 4; F[gy * GW + gx] = big(x, y) + (big(x - 4, y - 4) - big(x + 4, y + 4)) * 1.4; }
  return (x, y) => { const fx = x / 4, fy = y / 4, ix = fx | 0, iy = fy | 0, u = fx - ix, v = fy - iy, q = iy * GW + ix; return (F[q] * (1 - u) + F[q + 1] * u) * (1 - v) + (F[q + GW] * (1 - u) + F[q + GW + 1] * u) * v; };
}

// storm clouds: soft grey puffs, lit from the top left (they look like clouds, not like rocks, 1S15-2)
function stormColAt(x, y, sd) {
  const b = (X, Y) => vnoise(X / 7, Y / 7, sd + 26) * .7 + vnoise(X / 3, Y / 3, sd + 27) * .3, v = b(x, y), l = b(x - 2, y - 2) - b(x + 2, y + 2);
  return l > .1 ? K.stH : l > .03 ? K.stL : v > .55 ? K.st2 : v > .38 ? K.st1 : K.st0;
}

function groundRows(Z, ya, yb) {
  const { MW, MH, ter, dist, near, coin, RT, set, cd, glit, hd, cf, sd, off, C } = Z;
  for (let y = ya; y < yb; y++) for (let x = 0; x < MW; x++) {
    const j = y * MW + x, t = ter[j], k = coin[j], h = hash(x, y, sd + 20), road = dist[j] < HALF, ln = RT.lane[j] - 1;
    if (ln >= 0) { const c = laneCol(near[j], off(j) + HALF, dist[j], ln, h), q = j * 4; cd[q] = c[0]; cd[q + 1] = c[1]; cd[q + 2] = c[2]; cd[q + 3] = 255; }
    let c;
    if (t === 4) { const i = near[j], o = Math.abs(off(j)); c = ((i * 2 - o * .9) % 14 + 14) % 14 < 5 ? [255, 255, 255] : [255, 214, 60]; }
    else if (RT.wayM[j] === 1) { const v = cf(x, y); c = v > .5 ? K.cp0 : v > .4 ? K.cp1 : K.cp2; if (h > .992) c = LNL[(h * 999 | 0) % 6]; }
    else if (RT.wayM[j] === 2) { const v = vnoise(x / 9, y / 5, sd + 41); c = v > .66 ? K.bay2 : v > .4 ? K.bay0 : K.bay1; }
    else if (RT.wayM[j] === 3) { c = (x + (y >> 2)) % 6 === 0 ? K.wdD : (y >> 2) % 2 ? K.wd0 : K.wd1; }
    else if (RT.wayM[j] === 4) { const v = vnoise(x / 8, y / 8, sd + 21) * .6 + h * .4; c = v < .35 ? K.bs1 : v > .68 ? K.bs2 : K.bs0; }
    else if (k) {
      const [cx, cy, cr] = C[k - 1], M = METAL[k - 1], dc = cr - Math.hypot(x + .5 - cx, y + .5 - cy), sh = ((x - cx) + (y - cy)) / cr;
      const v = vnoise(x / 8, y / 8, sd + 21) * .6 + h * .4;
      if (dc < 7 && !(road && dc > 1.5) && t !== HOLE) {
        // the rim of the coin: bevelled metal, little notches (reeding) on the outer edge; the Fantasy coin has a rainbow rim
        if (k === 5) { const a = Math.atan2(y - cy, x - cx), q = ((a / TAU * 12 + 12) | 0) % 6; c = dc < 1.5 ? LND[q] : dc > 5.5 ? M[2] : LN[q]; }
        else c = dc < 1.2 ? M[3] : dc < 2.5 ? (sh < 0 ? M[2] : M[1]) : dc > 5.5 ? (sh < 0 ? M[1] : M[2]) : (Math.round(Math.atan2(y - cy, x - cx) * cr / 3) % 2 ? M[0] : M[2]);
      } else if (t === HOLE) c = holeCol(x, y, hd[j], sd);
      else if (road) {
        const e = dist[j];
        if (t === LIFT) { c = v < .4 ? K.as1 : K.as0; if (((near[j] >> 1) + ((off(j) + 40) >> 3)) % 2 === 0 && e < HALF - 3) c = [236, 200, 60]; if (e > HALF - 2) c = K.asE; }
        else if (k === 1) { c = v < .38 ? K.er1 : v > .66 ? K.er2 : K.er0; if (e > HALF - 3) c = K.erE; if (t === 2) c = v < .4 ? K.md1 : v > .7 ? K.md2 : K.md0; }
        else if (k === 2) { c = v < .38 ? K.pa1 : v > .66 ? K.pa2 : K.pa0; if (e > HALF - 3) c = K.paE; if (RT.bridge[j]) { const i = near[j]; c = i % 3 === 0 ? [96, 52, 34] : (Math.floor(i / 3) & 1) ? [178, 70, 46] : [160, 58, 40]; } }
        else if (k === 3) { c = v < .35 ? K.as1 : v > .68 ? K.as2 : K.as0; if (e > HALF - 2) c = K.asE; if (RT.kerb[j]) c = (Math.floor(near[j] / 4) & 1) ? K.kR : K.kW; }
        else if (k === 4) { c = v < .35 ? K.bs1 : v > .68 ? K.bs2 : K.bs0; if (e > HALF - 2.5) c = K.bsE; else if (h < .02) c = [255, 140, 60]; }
        else { c = v < .4 ? K.pe1 : v > .7 ? K.pe2 : K.pe0; if (e > HALF - 2) c = LN[clamp(Math.floor((off(j) + HALF) / (2 * HALF) * 6), 0, 5)]; else if (e > HALF - 3.5) c = K.peE; }
        if (t === 2 && k !== 1) c = stormColAt(x, y, sd);
      } else if (k === 1) {
        if (t === 2) c = v < .4 ? K.md1 : K.md2; else { c = v < .38 ? K.gr1 : v > .66 ? K.gr2 : K.gr0; if (h < .03) c = K.grD; }
      } else if (k === 2) {
        if (t === 5) { const s2 = vnoise(x / 12, y / 6, sd + 22); c = s2 > .7 ? K.wa3 : s2 > .5 ? K.wa2 : v > .5 ? K.wa1 : K.wa0; let n = 0; for (const q of [1, -1, MW, -MW, 2, -2, 2 * MW, -2 * MW]) if (ter[j + q] !== 5) n++; if (n) c = n > 2 ? [160, 150, 136] : K.waE; }
        else { c = v < .38 ? K.sg1 : v > .66 ? K.sg2 : K.sg0; if (h < .02) c = [255, 194, 214]; }
      } else if (k === 3) {
        if (t === 7) c = h < .3 ? K.gv1 : h > .7 ? K.gv2 : K.gv0; else { c = v < .38 ? K.sa1 : v > .66 ? K.sa2 : K.sa0; if (h < .01) c = [180, 150, 100]; }
      } else if (k === 4) { c = v < .38 ? K.rk1 : v > .66 ? K.rk2 : K.rk0; if (h < .02) c = K.rkL; if (RT.plat[j]) c = K.pl; if (t === 15) c = h < .3 ? K.lv2 : K.lv0; }
      else { c = v < .4 ? K.pe1 : v > .7 ? K.pe2 : K.pe0; if (h < .02) c = LNL[(h * 300 | 0) % 6]; }
      // the gloss of the metal: a soft diagonal streak over every coin (1S15-2)
      if (!road && t !== HOLE && dc >= 7) { const g = (x - cx) - (y - cy) + cr * .35; if (Math.abs(g) < 5 + 3 * Math.sin(y * .05)) c = c.map(u => Math.min(255, u + 26)); }
    } else if (t === HOLE) c = holeCol(x, y, hd[j], sd);
    else if (ln >= 0 && t !== 2) c = laneCol(near[j], off(j) + HALF, dist[j], ln, h);
    else if (t === 2) { c = stormColAt(x, y, sd); let n = 0; for (const q of [1, -1, MW, -MW]) if (ter[j + q] !== 2) n++; if (n) c = K.stL; }
    else {
      const q = cf(x, y) + (h - .5) * .04;
      c = q > .52 ? K.cl0 : q > .42 ? K.cl1 : q > .34 ? K.cl2 : q > .27 ? K.cl3 : K.cl4;
      // the edge of the cloud bank along the road, the cloud path and the bay: a soft shadow
      if (dist[j] < HALF + 2.5) c = K.cl3; else if (dist[j] < HALF + 4) c = K.cl2;
    }
    set(j, c);
    if (ln >= 0 && h > .996) glit.push(j);
  }
  void MH;
}

// the clean colour of a lane pixel (i index on the centre line, o offset from the left edge, e distance to the centre line)
function laneCol(i, o, e, ln, h) {
  const u = o - ln * 10;
  if (e > HALF - 1.4) return [255, 255, 255];
  if (e > HALF - 2.6) return [236, 228, 250];
  let c = u < 1 ? LND[ln] : u > 3 && u < 5.5 ? LNL[ln] : LN[ln];
  if (((i * 2 + Math.round(o)) % 46) < 3) c = LNL[ln]; // glossy streaks across
  if (h > .994) c = [255, 255, 255];
  return c;
}

// a hole in the clouds: the cloud wall falls away into the deep blue sky, little clouds far below
function holeCol(x, y, e, sd) {
  let c = e <= 1 ? K.clE : e <= 2 ? K.h0 : e <= 3 ? K.h1 : e <= 4 ? K.h2 : vnoise(x / 40, y / 40, sd + 24) > .55 ? K.h3 : K.h4;
  if (e >= 5) { const fc = vnoise(x / 16, y / 7, sd + 25); if (fc > .74) c = fc > .8 ? K.hcL : K.hc; }
  return c;
}

// pictures that are only needed where the rainbow road is (1P-3: tiles of 128 px instead of whole maps): the clean lanes and the same in grey
const TILE = 128;
function laneTiles(cd, MW, MH, fn) {
  const TX = Math.ceil(MW / TILE), TY = Math.ceil(MH / TILE), tiles = new Map();
  for (let ty = 0; ty < TY; ty++) for (let tx = 0; tx < TX; tx++) {
    const x0 = tx * TILE, y0 = ty * TILE, w = Math.min(TILE, MW - x0), h = Math.min(TILE, MH - y0);
    let any = false; for (let y = y0; y < y0 + h && !any; y += 2) for (let x = x0; x < x0 + w; x += 2) if (cd[(y * MW + x) * 4 + 3]) { any = true; break; }
    if (!any) continue;
    const c = mk(w, h), g = c.getContext('2d'), img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = ((y0 + y) * MW + x0 + x) * 4, p = (y * w + x) * 4; if (!cd[q + 3]) continue; fn(img.data, p, q); }
    g.putImageData(img, 0, 0); tiles.set(ty * TX + tx, { c, x: x0, y: y0 });
  }
  return { tiles, TX };
}
// draw the tiles over the rectangle x, y, w, h into g (the screen or the ground picture)
export function drawTiles(g, TS, x, y, w, h) {
  const tx0 = Math.max(0, Math.floor(x / TILE)), ty0 = Math.max(0, Math.floor(y / TILE)), tx1 = Math.floor((x + w - 1) / TILE), ty1 = Math.floor((y + h - 1) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1 && tx < TS.TX; tx++) {
    const t = TS.tiles.get(ty * TS.TX + tx); if (!t) continue;
    const sx = Math.max(x, t.x), sy = Math.max(y, t.y), ex = Math.min(x + w, t.x + t.c.width), ey = Math.min(y + h, t.y + t.c.height);
    if (ex > sx && ey > sy) g.drawImage(t.c, sx - t.x, sy - t.y, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);
  }
}

// painting, after the ground. S: { MW, MH, def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, sd, r, critters, mudPix, RT }
export function* paintRainbow(S) {
  const { MW, MH, def, set, setT, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, sd, critters, mudPix, RT } = S, A = MW * MH, coin = RT.coin;
  const { px, dk, solid, off } = paintTools(S);
  const C = COINS.map(k => def.coins[k]);
  const clean = new Uint8ClampedArray(A * 4), glit = [];
  const hd = holeDepth(ter, MW, MH);
  yield;
  const cf = cloudField(MW, MH, sd);
  yield;
  // ----- the ground -----
  const Z = { MW, MH, ter, dist, near, coin, RT, set, cd: clean, glit, hd, cf, sd, off, C };
  for (let y = 0; y < MH; y += 40) { groundRows(Z, y, Math.min(MH, y + 40)); yield; }
  const holes = []; for (let j = 0; j < A; j += 3) if (hd[j] >= 5) holes.push(j);

  yield;
  // ----- the coins: their thickness under the rim and their shadow on the clouds -----
  for (const [k, [cx, cy, cr]] of C.entries()) {
    const M = METAL[k];
    for (let y = cy - cr; y <= cy + cr + 22; y++) for (let x = cx - cr - 4; x <= cx + cr + 12; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const j = y * MW + x; if (coin[j] || dist[j] < HALF || RT.wayM[j]) continue;
      let th = 0; for (let q = 1; q <= 8; q++) if (y - q >= 0 && coin[(y - q) * MW + x] === k + 1) { th = q; break; }
      if (th) { set(j, th > 7 ? M[3] : (x % 3 === 0 ? M[3] : k === 4 ? LND[((x / 6) | 0) % 6] : M[1])); continue; }
      if (Math.hypot(x - 7 - cx, y - 12 - cy) < cr) dk(x, y, ter[j] === HOLE ? .7 : .86);
    }
  }
  // the raised rim of every coin is solid (only the road and the ways cross it): nobody drives off a coin into the clouds
  for (const [cx, cy, cr] of C) for (let a = 0; a < TAU; a += 5 / cr) {
    const x = cx + Math.cos(a) * (cr - 3), y = cy + Math.sin(a) * (cr - 3), j = Math.round(y) * MW + Math.round(x);
    if (x < 0 || y < 0 || x >= MW || y >= MH || dist[j] < HALF + 4) continue;
    let way = false; for (let dy = -6; dy <= 6 && !way; dy += 3) for (let dx = -6; dx <= 6; dx += 3) { const q = j + dy * MW + dx; if (q >= 0 && q < A && RT.wayM[q]) { way = true; break; } }
    if (way || ter[j] === HOLE) continue;
    walls.push({ x, y, r: 3 });
  }
  // the arch casts a long shadow into its gorge
  const { a0, a1, g0, g1 } = RT.arch, span = (a1 - a0 + N) % N, shadowM = new Uint8Array(A);
  for (let i = a0; inRange(i, a0, a1); i = (i + 1) % N) {
    if (!inRange(i, g0, g1)) {
      const f = ((i - a0 + N) % N) / span, hh = Math.sin(Math.PI * f);
      for (let o = -HALF + 1; o < HALF; o++) {
        const X0 = Math.round(path[i].x + nrm[i].x * o + 10 + hh * 26), Y0 = Math.round(path[i].y + nrm[i].y * o + 14 + hh * 38);
        for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) {
          const X = X0 + dx, Y = Y0 + dy; if (X >= MW || Y >= MH || X < 0 || Y < 0) continue;
          const q = Y * MW + X; if (shadowM[q] || dist[q] < HALF + 1 || coin[q]) continue;
          shadowM[q] = 1; dk(X, Y, ter[q] === HOLE ? .72 : .84);
        }
      }
    }
    if (i === a1) break;
  }
  // the edge of the gap: glowing lips of the rainbow
  for (const gi of [g0, g1]) for (let o = -HALF + 1; o < HALF; o++) for (const s of [0, 1]) {
    const p = path[gi], t2 = tan[gi], n = nrm[gi], a = gi === g0 ? -s : s;
    px(p.x + n.x * o + t2.x * a, p.y + n.y * o + t2.y * a, s ? [255, 255, 255] : LNL[clamp(Math.floor((o + HALF) / 10), 0, 5)]);
  }

  yield;
  // ----- the rails of the arch: a row of little cloud puffs on glowing posts (soft walls, like the bob run) -----
  for (let i = a0; inRange(i, a0, a1); i = (i + 1) % N) {
    if (!inRange(i, (g0 - 2 + N) % N, (g1 + 2) % N)) for (const s of [-1, 1]) {
      const x = path[i].x + nrm[i].x * s * (HALF + 3), y = path[i].y + nrm[i].y * s * (HALF + 3);
      if (i % 3 === 0) walls.push({ x, y, r: 3, bob: true });
      px(x, y, [255, 255, 255]); px(x + nrm[i].x * s, y + nrm[i].y * s, [200, 206, 240]);
      if (i % 9 === 0) for (let q = 0; q < 9; q++) { const a = q / 9 * TAU; setT(x + Math.cos(a) * 2.5, y + Math.sin(a) * 2.5 - 2, q < 4 ? [255, 255, 255] : [226, 230, 248]); }
    }
    if (i === a1) break;
  }
  // the cloud path: a golden edge with a lilac shadow outside (Grundsatz 10: you see where it goes on the white clouds), little puffs outside
  for (const [k, p] of RT.ways.cloud.pts.entries()) {
    const q = RT.ways.cloud.pts[Math.min(RT.ways.cloud.pts.length - 1, k + 1)], tx = q.x - p.x, ty = q.y - p.y, l = Math.hypot(tx, ty) || 1;
    for (const s of [-1, 1]) {
      const x = p.x - ty / l * s * 17, y = p.y + tx / l * s * 17, j = Math.round(y) * MW + Math.round(x);
      if (j < 0 || j >= A || ter[j] === HOLE || dist[j] < HALF + 2) continue;
      px(x, y, K.cpE); px(x - ty / l * s, y + tx / l * s, k % 3 ? [200, 170, 226] : [255, 236, 150]);
      if (k % 7 === 0) for (let a = 0; a < 7; a++) { const an = a / 7 * TAU; px(x - ty / l * s * 3 + Math.cos(an) * 2, y + tx / l * s * 3 + Math.sin(an) * 2, a < 3 ? [255, 255, 255] : [222, 226, 246]); }
    }
  }

  yield;
  // ----- the bronze coin (Cup 1): a meadow with a pale picket fence, pines, the pier with its shower, flowers; two cows graze on the road -----
  const [bx, by, br] = C[0];
  for (let i = 0; i < N; i++) for (const s of [-1, 1]) {
    const x = Math.round(path[i].x + nrm[i].x * s * (HALF + 6)), y = Math.round(path[i].y + nrm[i].y * s * (HALF + 6)), j = y * MW + x;
    if (x < 0 || y < 0 || x >= MW || y >= MH || coin[j] !== 1 || RT.wayM[j] || Math.hypot(x - bx, y - by) > br - 9) continue;
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
  // the shower at the end of the pier (Strand): a pole with a shower head, drops (it does not wash: rainbow.js draws a few drops)
  if (def.jetty) {
    const [x, y] = def.jetty[def.jetty.length - 1]; walls.push({ x: x + 10, y, r: 3 }); solid(x + 10, y, 3);
    for (let k = 0; k < 16; k++) setT(x + 10, y - k, [200, 200, 210]); for (let k = 0; k < 6; k++) setT(x + 10 - k, y - 16, [200, 200, 210]); for (let k = -2; k <= 2; k++) setT(x + 5 + k, y - 15, [150, 160, 176]);
    dk(x + 13, y + 2, .7); dk(x + 14, y + 3, .7);
  }
  for (let q = 0; q < 70; q++) {
    const a = hash(q, 1, sd) * TAU, rr = Math.sqrt(hash(q, 2, sd)) * (br - 12), x = Math.round(bx + Math.cos(a) * rr), y = Math.round(by + Math.sin(a) * rr), j = y * MW + x;
    if (ter[j] !== 0 || dist[j] < HALF + 4 || wallMask[j] || RT.wayM[j]) continue;
    const pc = [[255, 90, 122], [255, 225, 77], [255, 255, 255]][q % 3]; px(x - 1, y, pc); px(x + 1, y, pc); px(x, y - 1, pc); px(x, y + 1, pc); px(x, y, [255, 225, 77]);
  }

  yield;
  // ----- the silver coin (Cup 2): a Japanese garden; red railings on the bridge (solid), cherry trees, a lantern, koi; the cloud train -----
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
  if (def.pond) { const [kx, ky, rx, ry] = def.pond; for (let q = 0; q < 4; q++) critters.push({ type: 'koi', x: kx + (q < 2 ? -rx * .62 : rx * .62), y: ky, rx: rx * .22, ry: ry * .45, ph: q * 1.7, col: q % 3 }); }
  // the rails of the cloud train: two shining rails on sleepers, from the cloud bank on the coin (where the train comes out) to the edge of the map
  const TR = def.train, [rx0, ry0] = TR.from, [rx1] = TR.to;
  for (let x = rx0; x <= rx1; x++) {
    for (const o of [-4, 4]) { px(x, ry0 + o, [236, 238, 250]); px(x, ry0 + o + 1, [150, 156, 190]); }
    if (x % 6 === 0) for (let o = -6; o <= 6; o++) { const j = (ry0 + o) * MW + x; if (j >= 0 && j < A && dist[j] >= HALF - 1) px(x, ry0 + o, [196, 176, 232]); }
  }
  // the cloud bank the train comes out of (solid), the warning light with the St. Andrew's cross beside the road
  for (let q = 0; q < 7; q++) { const cx = rx0 - 6 + (q % 3) * 7, cy = ry0 - 10 + Math.floor(q / 3) * 9, r = 8; solid(cx, cy, 5); walls.push({ x: cx, y: cy, r: 6 }); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (dx * dx + dy * dy > r * r) continue; setT(cx + dx, cy + dy, (dx + dy) < -3 ? [255, 255, 255] : (dx + dy) > 4 ? [206, 212, 238] : [240, 242, 252]); } }
  // the ramp on one half of the road before the rails (jumps[1]): planks of cloud-white and gold, a dark lip, its shadow behind it
  { const J = RT.jumps[1], R = HALF + 22;
    for (let Y = Math.floor(J.y - R); Y <= J.y + R; Y++) for (let X = Math.floor(J.x - R); X <= J.x + R; X++) {
      const dx = X + .5 - J.x, dy = Y + .5 - J.y, a = dx * J.tx + dy * J.ty, l = -dx * J.ty + dy * J.tx;
      if (l < J.lo + 5 || l > J.hi) continue;
      if (a > -18 && a <= 1) px(X, Y, a > -1 ? [90, 70, 40] : (Math.floor((a + 18) / 3) & 1) ? [255, 222, 120] : [250, 246, 236]);
      else if (a > 1 && a < 4) dk(X, Y, .72);
    }
  }
  { const [lx, ly] = TR.light; walls.push({ x: lx, y: ly, r: 3 }); solid(lx, ly, 3); for (let k = 0; k < 18; k++) setT(lx, ly - k, [60, 60, 66]); for (let k = -5; k <= 5; k++) { setT(lx + k, ly - 18 + k, [236, 236, 236]); setT(lx + k, ly - 18 - k, [216, 40, 40]); } dk(lx + 2, ly + 2, .7); }

  yield;
  // ----- the gold coin (Cup 3): the sphinx gate over the asphalt (two sphinxes on stone plinths, solid; the lintel on the top layer), the lift -----
  { const [sx, sy] = def.sphinx, si = nearestIdx(path, sx, sy), p = path[si], n = nrm[si], t2 = tan[si];
    // every pixel of the box round (cx, cy) in the frame of the road (a along it, w across it): closed shapes without gaps
    const rot = (cx, cy, R, fn, put = setT) => { for (let Y = Math.floor(cy - R); Y <= cy + R; Y++) for (let X = Math.floor(cx - R); X <= cx + R; X++) { const dx = X + .5 - cx, dy = Y + .5 - cy, c = fn(dx * t2.x + dy * t2.y, dx * n.x + dy * n.y); if (c) put(X, Y, c); } };
    for (const s of [-1, 1]) {
      const x = p.x + n.x * s * (HALF + 24), y = p.y + n.y * s * (HALF + 24);
      walls.push({ x, y, r: 11 }); walls.push({ x: x - t2.x * 9, y: y - t2.y * 9, r: 8 }); walls.push({ x: x + t2.x * 9, y: y + t2.y * 9, r: 8 }); solid(x, y, 14);
      // the plinth: grey-blue stone with a dark rim and its shadow (clearly not sand, Grundsatz 10)
      rot(x + 5, y + 7, 24, (a, w) => Math.abs(a) <= 19 && Math.abs(w) <= 10 ? 1 : null, (X, Y) => dk(X, Y, .7));
      rot(x, y, 24, (a, w) => Math.abs(a) > 18 || Math.abs(w) > 9 ? null : Math.abs(a) > 16.5 || Math.abs(w) > 7.5 ? [70, 72, 92] : (a + w) < -10 ? [176, 180, 200] : [140, 144, 166]);
      // the sphinx lying along the road: the body behind, the head in front, the paws stretched out before it (dark outline, lit from the top left)
      rot(x, y, 22, (a, w) => {
        const b = ((a - 4) / 11) ** 2 + (w / 6.5) ** 2, h = ((a + 9) / 5.5) ** 2 + (w / 6) ** 2, pw = a < -13 && a > -18 && Math.abs(Math.abs(w) - 3) < 1.6;
        if (h <= 1) return h > .7 ? [40, 34, 60] : Math.abs(w) > 2.5 ? ((Math.round(a) & 1) ? [40, 80, 180] : [240, 200, 60]) : [236, 202, 136];
        if (pw) return Math.abs(Math.abs(w) - 3) > .8 ? [96, 64, 26] : [232, 198, 128];
        if (b <= 1) return b > .72 ? [96, 64, 26] : (a + w) < -4 ? [252, 228, 168] : (a + w) > 8 ? [190, 150, 88] : [232, 198, 128];
        return null;
      });
    }
    // the lintel: a stone beam across the road with a golden sun disc (on the top layer: the cars drive under it)
    for (const s of [-1, 1]) { const qx = p.x + n.x * s * (HALF + 6), qy = p.y + n.y * s * (HALF + 6); walls.push({ x: qx, y: qy, r: 4 }); solid(qx, qy, 4); rot(qx + 3, qy + 4, 8, (a, w) => Math.abs(a) < 6 && Math.abs(w) < 5 ? 1 : null, (X, Y) => dk(X, Y, .72)); }
    rot(p.x, p.y, HALF + 24, (a, w) => Math.abs(w) > HALF + 2 && Math.abs(w) < HALF + 10 && Math.abs(a) < 6 ? (Math.abs(w) > HALF + 8.5 || Math.abs(a) > 4.5 ? [90, 70, 40] : [200, 170, 110]) : Math.abs(a) > 4.5 || Math.abs(w) > HALF + 10 ? null : a < -3.5 ? [250, 232, 180] : a > 3.5 ? [110, 84, 44] : Math.round(Math.abs(w)) % 12 === 0 ? [176, 144, 90] : [214, 182, 120]);
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (dx * dx + dy * dy <= 25) setT(p.x + dx, p.y + dy, dx * dx + dy * dy > 18 ? [120, 80, 20] : dx + dy < 0 ? [255, 236, 120] : [230, 180, 40]);
  }
  // the lift: two masts at the stations (on the gold and on the platinum coin), the cable is drawn while racing (rainbow.js)
  const LF = RT.lift, mastA = path[(LF.s0 + 4) % N], mastB = path[LF.land], liftPts = [];
  for (const [p, i] of [[mastA, LF.s0], [mastB, LF.land]]) {
    const n = nrm[i], x = p.x + n.x * (HALF + 8), y = p.y + n.y * (HALF + 8); liftPts.push({ x, y });
    walls.push({ x, y, r: 4 }); solid(x, y, 4);
    for (let k = 0; k < 22; k++) { setT(x, y - k, [90, 96, 110]); setT(x + 1, y - k, [60, 64, 76]); }
    for (let k = -6; k <= 6; k++) setT(x + k, y - 22, [60, 64, 76]);
    dk(x + 3, y + 2, .7); dk(x + 4, y + 3, .7);
  }

  yield;
  // ----- the platinum coin (Cup 4): the lava tube (a cone over the road; its roof is a picture of its own, drawn when you are outside), the
  // liana tree at the crack, the rim of the wormhole platform -----
  const [vx, vy, vr] = def.cone, tubeFree = (x, y) => { const j = y * MW + x; return x >= 0 && y >= 0 && x < MW && y < MH && (!RT.tubeM[j] || dist[j] < HALF + 8); };
  for (const w of edgeCircles(tubeFree, vx - vr - 2, vy - vr - 2, vx + vr + 2, vy + vr + 2, 4, 3, 6)) walls.push(w);
  const roof = mk(vr * 2 + 16, vr * 2 + 16), rg = roof.getContext('2d'), rimg = rg.createImageData(roof.width, roof.height);
  for (let y = 0; y < roof.height; y++) for (let x = 0; x < roof.width; x++) {
    const dx = x - vr - 8, dy = y - vr - 8, dd2 = Math.hypot(dx, dy) + (vnoise((vx + dx) * .3, (vy + dy) * .3, sd + 30) - .5) * 3; if (dd2 > vr + 4) continue;
    const sh = (dx + dy) / vr, h = hash(x, y, sd + 34), q = (y * roof.width + x) * 4;
    let c = dd2 < vr * .26 ? (dd2 < vr * .16 ? K.lv2 : K.lv1) : dd2 < vr * .34 ? K.lvD : sh < -.3 ? [116, 104, 98] : sh > .3 ? [52, 46, 44] : [82, 74, 70];
    if (dd2 >= vr * .34 && Math.abs(Math.atan2(dy, dx) - 2.35) < .14 + .1 * (dd2 / vr)) c = h < .3 ? K.lv1 : K.lv0; // lava runs out of the crater
    if (dd2 > vr + 1) c = [40, 34, 32];
    rimg.data[q] = c[0]; rimg.data[q + 1] = c[1]; rimg.data[q + 2] = c[2]; rimg.data[q + 3] = 255;
  }
  rg.putImageData(rimg, 0, 0);
  // the floor of the tube: dark basalt, the lava rill glows
  for (let y = vy - vr; y <= vy + vr; y++) for (let x = vx - vr; x <= vx + vr; x++) { const j = y * MW + x; if (!RT.tubeM[j]) continue; if (ter[j] === 15) set(j, hash(x, y, 35) < .3 ? K.lv2 : K.lv0); else if (dist[j] >= HALF) set(j, [44, 38, 36]); }
  // the liana chord: glowing edges like the road (Grundsatz 10), not over the crack
  for (const [k, p] of RT.ways.liana.pts.entries()) {
    const q = RT.ways.liana.pts[Math.min(RT.ways.liana.pts.length - 1, k + 1)], tx = q.x - p.x, ty = q.y - p.y, l = Math.hypot(tx, ty) || 1;
    for (const s of [-1, 1]) for (const e of [14, 15]) {
      const x = p.x - ty / l * s * e, y = p.y + tx / l * s * e, j = Math.round(y) * MW + Math.round(x);
      if (j >= 0 && j < A && ter[j] !== HOLE && dist[j] >= HALF && RT.wayM[j] === 4) px(x, y, e === 14 ? K.bsE : [120, 50, 20]);
    }
  }
  // the liana tree: a jungle giant at the end of the crack, its crown on the top layer
  { const cr = RT.crack, tx = Math.round(cr.x - cr.dy * (cr.len + 12)), ty = Math.round(cr.y + cr.dx * (cr.len + 12));
    walls.push({ x: tx, y: ty, r: 6 }); solid(tx, ty, 7);
    for (let dy = -16; dy <= 16; dy++) for (let dx = -16; dx <= 16; dx++) { const dd2 = Math.hypot(dx, dy) + (vnoise((tx + dx) * .3, (ty + dy) * .3, 36) - .5) * 4; if (dd2 > 15) continue; setT(tx + dx, ty + dy, (dx + dy) < -8 ? [104, 180, 72] : (dx + dy) > 8 ? [30, 92, 44] : [58, 140, 60]); }
    for (let dy = -18; dy <= 18; dy++) for (let dx = -18; dx <= 18; dx++) if (dx * dx + dy * dy <= 300) dk(tx + dx + 7, ty + dy + 9, .8);
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
    // the gate stands a little behind the line, so the banner never covers it (Grundsatz 14)
    const p = path[6], n = nrm[6], t2 = tan[6];
    for (const s of [-1, 1]) {
      const x = p.x + n.x * s * (HALF + 9), y = p.y + n.y * s * (HALF + 9);
      walls.push({ x, y, r: 6 }); solid(x, y, 8);
      for (let q = 0; q < 26; q++) { const a = q / 26 * TAU; for (let rr = 0; rr < 7; rr++) setT(x + Math.cos(a) * rr, y + Math.sin(a) * rr, rr > 5 ? [200, 206, 236] : (Math.cos(a) + Math.sin(a) < 0 ? [255, 255, 255] : [236, 238, 250])); }
    }
    for (let o = -HALF - 9; o <= HALF + 9; o++) for (let w = -3; w <= 2; w++) setT(p.x + n.x * o + t2.x * w, p.y + n.y * o + t2.y * w, LN[clamp(Math.floor((w + 3)), 0, 5)]);
    for (let o = -HALF + 3; o <= HALF - 3; o += 7) for (let q = 0; q < 4; q++) for (let w = -(3 - q >> 1); w <= (3 - q >> 1); w++) setT(p.x + n.x * (o + w) + t2.x * (3 + q), p.y + n.y * (o + w) + t2.y * (3 + q), LN[((o + 40) / 7 | 0) % 6]);
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
    const plate = (X, Y) => { const j = Y * MW + X; return j >= 0 && j < A && !wallMask[j] && ter[j] === 0 && coin[j] === k + 1 && !RT.wayM[j]; };
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
  // ----- the rain bay: its middle washes (a little rain cloud with the sun over it, a rainbow in the spray, see rainbow.js) -----
  const BW = RT.ways.bay, bmid = BW.pts[BW.pts.length >> 1];
  for (const p of BW.pts.slice(BW.pts.length * .3 | 0, BW.pts.length * .7 | 0)) for (let dy = -14; dy <= 14; dy++) for (let dx = -3; dx <= 3; dx++) { const j = Math.round(p.y + dy) * MW + Math.round(p.x + dx); if (j >= 0 && j < A && RT.wayM[j] === 2) washMask[j] = 1; }
  for (let j = 0; j < A; j++) if (washMask[j] && hash(j % MW, j / MW | 0, sd + 40) < .05) set(j, [255, 255, 255]);

  yield;
  // the overlays of the race (rainbow.js): the clean lanes (to clear the storm clouds again, the glow of the sun) and the same in grey (the storm)
  const cleanT = laneTiles(clean, MW, MH, (o, p, q) => { o[p] = clean[q]; o[p + 1] = clean[q + 1]; o[p + 2] = clean[q + 2]; o[p + 3] = 255; });
  yield;
  const greyT = laneTiles(clean, MW, MH, (o, p, q) => {
    if (ter[q >> 2] === 2) return; // (the storm clouds on the road stay as they are)
    const ln = RT.lane[q >> 2] - 1, l = (clean[q] * .3 + clean[q + 1] * .55 + clean[q + 2] * .15) * .8 + 30, keep = ln === 0 || ln === 4 ? .35 : 0;
    o[p] = l + (clean[q] - l) * keep; o[p + 1] = l + (clean[q + 1] - l) * keep; o[p + 2] = l + 8 + (clean[q + 2] - l) * keep; o[p + 3] = 255;
  });
  yield;
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
      const x = j % MW, y = j / MW | 0, k = ((y - v0) * w + x - u0) * 4; let col = stormColAt(x, y, sd);
      for (const o of [1, -1, MW, -MW]) if (!on.has(j + o)) col = K.stL;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return { px: sp.px, x: sp.x, y: sp.y, pic: { c, x: u0, y: v0 }, box: [u0, v0, w, h] };
  });
  const P = def.portals, ia = nearestIdx(path, P.a[0], P.a[1]), ib = nearestIdx(path, P.b[0], P.b[1]);
  const di0 = nearestIdx(path, def.double[0][0], def.double[0][1]), di1 = nearestIdx(path, def.double[3][0], def.double[3][1]);
  const isleOf = j => coin[j] ? coin[j] - 1 : -1;
  return { jumps: RT.jumps, pushes: RT.pushes, alt: RT.alt, coin, lane: RT.lane, brown: RT.brown, kerb: RT.kerb, gorge: RT.gorge, wayM: RT.wayM, tubeM: RT.tubeM,
    arch: RT.arch, lift: { ...RT.lift, masts: liftPts }, ways: RT.ways, crack: RT.crack, isleOf,
    clean: cleanT, grey: greyT, glit, holes, stormPix: RT.stormPix, stormSpots: spots,
    dbl: { pts: RT.dbl, pix: RT.dPix, lanes: RT.dLane, pic: { c: dC, x: x0, y: y0 }, i0: di0, i1: di1 },
    portals: { ia, ib, a: { x: P.a[0], y: P.a[1], r: P.a[2] }, b: { x: path[ib].x, y: path[ib].y } },
    bay: { x: bmid.x, y: bmid.y }, pier: def.jetty ? { x: def.jetty[def.jetty.length - 1][0] + 10, y: def.jetty[def.jetty.length - 1][1] } : null,
    cone: { x: vx, y: vy, r: vr, roof, box: { x: vx - vr - 8, y: vy - vr - 8, W: vr * 2 + 16, H: vr * 2 + 16 } },
    train: { y: def.train.from[1], x0: def.train.from[0], x1: def.train.to[0], cross: path[RT.rampI].x, rampI: RT.rampI, light: def.train.light },
    liana: { pivot: { x: RT.crack.x - RT.crack.dy * 4, y: RT.crack.y + RT.crack.dx * 4 }, dx: RT.crack.dx, dy: RT.crack.dy }, mudPix };
}
