import { HALF, clamp, hash, hex, mk, vnoise } from './core.js';
import { nearestIdx, paintTools, startLine } from './bau.js';
import { edgeCircles, smin, stampWay } from './kit.js';

// ---------- Weltall Rev 2 (plaene/WELTALL_REV2.md): the orbit ----------
// Out of the hangar of a space station (the start straight, gravity), through the glass tube onto the platforms in zero gravity (two forks: a narrow
// grating bridge, short, or a wide platform round a bow), in a wide curve round the ringed planet (its ring is an open field of ice dust: the further
// in, the shorter, the harder the pull and the bigger the swing-by when you leave it), through the asteroid field (an open platform grid with big
// asteroids and moon dust in the hollows beside them) or into the wormhole at its mouth (out again on the moon), over the moon with the long jump over
// the big crater (little gravity; too slow: down into the dust of the crater, or round its rim) and back into the hangar; the decontamination bay
// beside the road in front of the start blows the dust off. The black hole opens in the void in the middle (space.js).
// Terrain: 0 nothing (space: a car that gets there drifts off, see space.js), 1 floor with gravity (station deck, glass tube, the roads over the moon),
// 17 metal platform in zero gravity (little grip), 100 ring dust (the field of the planet's ring), 2 moon dust (like mud, it makes the car silver),
// 13 the ground of the moon (slow like grass, it stays clean), 4 boost pad.
export const RING = 100;
// what a pixel is for the painting (kind)
export const KD = { deck: 1, tube: 2, moon: 3, ring: 4, belt: 5, pad: 6, wide: 7, bay: 8, rock: 9, chunk: 10, detour: 11 };

const K = Object.fromEntries(Object.entries({
  sp0: '#05061a', sp1: '#090a24', sp2: '#100e32', nebB: '#122a5a', nebB2: '#1a3a74', nebP: '#2a1450', nebP2: '#3c1c66',
  pl: '#4a5468', pl1: '#434c5f', pl2: '#535e73', plD: '#1a202c', seam: '#2a3242', rivet: '#8a96ac', glow: '#5fe8ff', glowM: '#2fb4d4', glowD: '#1a5a72',
  gr: '#3a4254', gr1: '#2c3342', grL: '#5a667c',
  hz: '#ffd23f', hzD: '#26262c',
  deck: '#5a6273', deck1: '#525a6a', deck2: '#646d7e', deckS: '#454c5a', lane: '#3e4552', lane1: '#383f4b', mark: '#e8eef4',
  tube: '#56607a', tube1: '#4e5870', tube2: '#606a84', groove: '#3e465a',
  moon: '#72747c', moon1: '#676970', moon2: '#7e8088', moonD: '#4c4e56', moonL: '#9c9ea6', moonE: '#3a3c43',
  road: '#aeb0b6', road1: '#a4a6ac', road2: '#b8bac0', roadE: '#55575f', rut: '#989aa1',
  dust: '#d2d5dc', dust1: '#c4c7cf', dust2: '#e2e4ea', dustE: '#a4a7b0', pdust: '#9599a3', pdust1: '#868a94',
  ring: '#d8e4ec', ring1: '#b8c8d8', ring2: '#eef6fa', ringD: '#7a8aa0', ringF: '#9aa6b8',
  pa: '#c88a4a', pb: '#e0b070', pc: '#a8683a', pd: '#f0d0a0',
  ocean: '#1f5fb8', ocean1: '#2a74d0', land: '#3a9a4a', land1: '#8a7a3a', cloud: '#f2f6fa', atmo: '#7ab8f0',
  rock: '#7a7268', rock1: '#625a52', rock2: '#958c80', rockD: '#3e3832', rockL: '#b0a698',
  ice: '#d8eef8', ice1: '#a8cce4', iceD: '#5a7a98',
  hull: '#c8ced8', hull1: '#a8b0bc', hullD: '#6a7280', win: '#7fd8ff', win1: '#ffe9a8', solar: '#24407a', solar1: '#3a62b0', solarL: '#8ab0ff',
  bay: '#4a6a7a', bay1: '#42606e', bayS: '#2e4652', bayN: '#9ad8ee',
}).map(([k, v]) => [k, hex(v)]));

// the circular range a..b of the centre line (in driving order)
const inRng = (i, a, b) => a <= b ? i >= a && i <= b : i >= a || i <= b;

// the field of the planet's ring: inside the annulus between the planet and the road; at both ends the inner edge is the tangent to the inner ring
// (a straight line), so a car that leaves the ring in a straight line always gets back onto the road (the swing-by)
function ringTest(P, rroad) {
  const t = P.tangent * Math.PI / 180, rc = P.ring[0] + 5;
  return (x, y) => {
    const dx = x + .5 - P.x, dy = y + .5 - P.y, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx) * 180 / Math.PI;
    if (Math.abs(a) > 135 || r > 360) return false;
    if (Math.abs(a) <= P.tangent) { if (r < P.ring[0]) return false; } else { const ph = Math.sign(a) * t; if (dx * Math.cos(ph) + dy * Math.sin(ph) < rc) return false; }
    return r < rroad[Math.round(a) + 135];
  };
}

// terrain, before the ground is painted. S: { MW, MH, def, ter, dist, near, path, tan, nrm, N }
export function* spaceTerrain(S) {
  const { MW, MH, def, ter, dist, near, path, nrm, N } = S, A = MW * MH, sd = def.seed * 131 + 17;
  const alt = new Uint8Array(A), kind = new Uint8Array(A), narrowM = new Uint8Array(A);
  const off = j => { const i = near[j], p = path[i]; return (j % MW + .5 - p.x) * nrm[i].x + ((j / MW | 0) + .5 - p.y) * nrm[i].y; };
  const [sx0, sy0, sx1, sy1] = def.station, [mx, my, mr] = def.moon;
  const onMoon = (x, y) => { const d2 = (x + .5 - mx) ** 2 + (y + .5 - my) ** 2; if (d2 > (mr + 8) ** 2) return false; if (d2 < (mr - 8) ** 2) return true; return Math.sqrt(d2) < mr + (vnoise(x * .05, y * .05, 121) - .5) * 14; };
  const t0 = nearestIdx(path, def.tube[0][0], def.tube[0][1]), t1 = nearestIdx(path, def.tube[1][0], def.tube[1][1]);
  yield;
  // ----- the station deck, the glass tube, the moon, the platforms -----
  for (let j = 0; j < A; j++) {
    if (j % 60000 === 59999) yield;
    const x = j % MW, y = j / MW | 0, t = ter[j], road = dist[j] < HALF;
    if (x >= sx0 && x <= sx1 && y >= sy0 && y <= sy1) { kind[j] = KD.deck; if (t === 0 || t === 2) ter[j] = 1; continue; }
    if (onMoon(x, y)) { kind[j] = KD.moon; if (t === 0) ter[j] = 13; continue; }
    if (!road) continue;
    if (inRng(near[j], t0, t1)) { kind[j] = KD.tube; if (t === 2) ter[j] = 1; continue; }
    if (t === 1) ter[j] = 17;
  }
  yield;
  // ----- the forks on the platforms: the road is a narrow grating bridge there (the sides are open space); the wide platform round the bow is a way of its own -----
  const forks = [];
  for (const F of def.forks) {
    const a = nearestIdx(path, F.from[0], F.from[1]), b = nearestIdx(path, F.to[0], F.to[1]);
    let x0 = MW, y0 = MH, x1 = 0, y1 = 0;
    for (let i = a; inRng(i, a, b); i = (i + 1) % N) { const p = path[i]; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); if (i === b) break; }
    for (let y = Math.max(0, Math.floor(y0 - HALF - 2)); y <= Math.min(MH - 1, y1 + HALF + 2); y++) for (let x = Math.max(0, Math.floor(x0 - HALF - 2)); x <= Math.min(MW - 1, x1 + HALF + 2); x++) {
      const j = y * MW + x; if (dist[j] >= HALF || ter[j] !== 17 || !inRng(near[j], a, b)) continue;
      if (Math.abs(off(j)) > F.half) ter[j] = 0; else narrowM[j] = 1;
    }
    const pts = stampWay(F.pts, F.wide, j => { if (ter[j] === 0 && !kind[j]) { ter[j] = 17; kind[j] = KD.wide; alt[j] = 1; narrowM[j] = 0; } }, MW, MH);
    forks.push({ a, b, pts, i: nearestIdx(path, F.pts[0][0], F.pts[0][1]) });
  }
  yield;
  // ----- the planet's ring: an open field of ice dust (code 100) between the planet and the road -----
  const P = def.planet, rroad = new Float32Array(271).fill(1e9);
  for (const p of path) {
    const dx = p.x - P.x, dy = p.y - P.y, r = Math.hypot(dx, dy); if (r > 420) continue;
    const b = Math.round(Math.atan2(dy, dx) * 180 / Math.PI) + 135; if (b < 0 || b > 270) continue;
    for (let q = Math.max(0, b - 1); q <= Math.min(270, b + 1); q++) rroad[q] = Math.min(rroad[q], r - HALF + 4);
  }
  const inRing = ringTest(P, rroad), RR = 362;
  for (let y = Math.max(0, P.y - RR); y <= Math.min(MH - 1, P.y + RR); y++) for (let x = Math.max(0, P.x - RR); x <= Math.min(MW - 1, P.x + RR); x++) {
    const j = y * MW + x; if (ter[j] !== 0 || kind[j]) continue;
    if (inRing(x, y)) { ter[j] = RING; kind[j] = KD.ring; alt[j] = 1; }
  }
  // ice chunks in the ring (solid): spread out, never closer than `gap` to each other
  const chunks = [], rnd = (k, q) => hash(k, q, sd + 140);
  for (let k = 0, tries = 0; chunks.length < P.chunks && tries < 400; tries++, k++) {
    const a = (rnd(k, 1) - .5) * 2 * (P.tangent - 6) * Math.PI / 180, r = P.ring[0] + 18 + rnd(k, 2) * (P.ring[1] - P.ring[0] - 30), cr = 6 + rnd(k, 3) * 3;
    const x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r;
    if (chunks.some(c => Math.hypot(c.x - x, c.y - y) < 48)) continue;
    chunks.push({ x, y, r: cr });
    for (let yy = Math.floor(y - cr); yy <= y + cr; yy++) for (let xx = Math.floor(x - cr); xx <= x + cr; xx++) { const j = yy * MW + xx; if (Math.hypot(xx + .5 - x, yy + .5 - y) < cr - .5 && ter[j] === RING) { ter[j] = 0; kind[j] = KD.chunk; } }
  }
  yield;
  // ----- the asteroid field: an open platform grid round the road, wider in the middle, with big asteroids (solid) and moon dust in the hollows -----
  const B = def.belt, b0 = nearestIdx(path, B.from[0], B.from[1]), b1 = nearestIdx(path, B.to[0], B.to[1]), bl = (b1 - b0 + N) % N;
  const bw = new Float32Array(A).fill(1e9);
  for (let k = 0; k <= bl; k += 2) {
    const i = (b0 + k) % N, p = path[i], w = HALF + (B.half - HALF) * clamp(Math.min(k, bl - k) / 32, 0, 1), R = Math.ceil(w + 1);
    for (let y = Math.max(0, Math.floor(p.y - R)); y <= Math.min(MH - 1, p.y + R); y++) for (let x = Math.max(0, Math.floor(p.x - R)); x <= Math.min(MW - 1, p.x + R); x++) {
      const j = y * MW + x, dd = Math.hypot(x + .5 - p.x, y + .5 - p.y) - w;
      if (dd < bw[j]) bw[j] = dd;
    }
  }
  for (let j = 0; j < A; j++) if (bw[j] < 6) bw[j] += (vnoise((j % MW) * .06, (j / MW | 0) * .06, sd + 141) - .5) * 10; // (a ragged edge: the noise only near it)
  for (let j = 0; j < A; j++) if (bw[j] < 0 && ter[j] === 0 && !kind[j]) { ter[j] = 17; kind[j] = KD.belt; alt[j] = 1; } else if (bw[j] < 0 && ter[j] === 17 && !kind[j]) kind[j] = KD.belt;
  yield;
  // the asteroids: two lumps melted into one shape, a ragged outline; solid circles follow the outline
  const rockWalls = [];
  for (const [x, y, r] of B.rocks) {
    const ox = (hash(x, 1, sd) - .5) * r * .9, oy = (hash(y, 2, sd) - .5) * r * .9, R2 = r * .62, X0 = Math.floor(x - r * 1.6), X1 = Math.ceil(x + r * 1.6), Y0 = Math.floor(y - r * 1.6), Y1 = Math.ceil(y + r * 1.6);
    const f = (X, Y) => smin(Math.hypot(X + .5 - x, Y + .5 - y) - r, Math.hypot(X + .5 - x - ox, Y + .5 - y - oy) - R2, 10) + (vnoise(X * .18, Y * .18, sd + 142) - .5) * 5;
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) { if (X < 0 || Y < 0 || X >= MW || Y >= MH) continue; const j = Y * MW + X; if (f(X, Y) < 0 && kind[j] !== KD.deck) { ter[j] = 0; kind[j] = KD.rock; alt[j] = 0; } }
    rockWalls.push(...edgeCircles((X, Y) => X < 0 || Y < 0 || X >= MW || Y >= MH || kind[Y * MW + X] !== KD.rock, X0, Y0, X1, Y1, 4, 4, 5));
  }
  // moon dust in the hollows beside them (on the ideal line: through the dust, or round it)
  for (const [x, y, rx, ry] of B.dust) for (let Y = Math.floor(y - ry * 1.5); Y <= y + ry * 1.5; Y++) for (let X = Math.floor(x - rx * 1.5); X <= x + rx * 1.5; X++) {
    const j = Y * MW + X; if (ter[j] !== 17) continue;
    if (((X + .5 - x) / rx) ** 2 + ((Y + .5 - y) / ry) ** 2 < .8 + .4 * vnoise(X * .14, Y * .14, sd + 143)) ter[j] = 2;
  }
  yield;
  // ----- the wormhole: its mouth on a little round platform at the edge of the field -----
  const [qx, qy, qr] = def.portals.a;
  for (let y = qy - qr - 1; y <= qy + qr + 1; y++) for (let x = qx - qr - 1; x <= qx + qr + 1; x++) { const j = y * MW + x; if (Math.hypot(x + .5 - qx, y + .5 - qy) < qr && ter[j] === 0 && kind[j] !== KD.rock) { ter[j] = 17; kind[j] = KD.pad; alt[j] = 1; } }
  // ----- the moon: the big crater full of dust (the road jumps over it), the way round its rim, small dusty craters -----
  const C = def.crater;
  for (let y = Math.floor(C.y - C.r - 4); y <= C.y + C.r + 4; y++) for (let x = Math.floor(C.x - C.r - 4); x <= C.x + C.r + 4; x++) {
    const j = y * MW + x; if (Math.hypot(x + .5 - C.x, y + .5 - C.y) < C.r + (vnoise(x * .12, y * .12, sd + 144) - .5) * 5) ter[j] = 2;
  }
  const detour = stampWay(C.pts, C.half, j => { if (ter[j] === 13 || ter[j] === 0) { ter[j] = 1; kind[j] = KD.detour; alt[j] = 1; } }, MW, MH);
  for (const [cx, cy, cr, dusty] of def.craters) {
    if (!dusty) continue;
    for (let y = Math.floor(cy - cr); y <= cy + cr; y++) for (let x = Math.floor(cx - cr); x <= cx + cr; x++) {
      const j = y * MW + x; if (x < 0 || y < 0 || x >= MW || y >= MH || ter[j] !== 13) continue;
      if (Math.hypot(x + .5 - cx, y + .5 - cy) < cr * .78 + (vnoise(x * .2, y * .2, 122) - .5) * 4) ter[j] = 2;
    }
  }
  // ----- the decontamination bay beside the road in front of the start (on the deck; it washes, see paintSpace) -----
  const bay = stampWay(def.bay.pts, def.bay.half, j => { if (dist[j] >= HALF - 2) { kind[j] = KD.bay; alt[j] = 1; ter[j] = 1; } }, MW, MH);
  yield;
  return { alt, kind, narrowM, t0, t1, forks, chunks, rockWalls, b0, b1, detour, bay, inRing };
}

// painting, after the ground. S: { MW, MH, def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, sd, r, starPix, RT }
export function* paintSpace(S) {
  const { MW, MH, def, set, setT, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, sd, starPix, RT } = S, A = MW * MH, kind = RT.kind;
  const { px, dk, solid, off } = paintTools(S);
  // how far (1..3) a pixel is from the void, 4 = further
  // (a distance field, two passes: first along the rows, then down the columns)
  const hd = new Uint8Array(A), vd = new Uint8Array(A);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    let m = 4; for (let dx = -3; dx <= 3; dx++) { const X = x + dx; if (X < 0 || X >= MW) continue; const q = y * MW + X; if (ter[q] === 0 && !kind[q]) { const a = dx < 0 ? -dx : dx; if (a < m) m = a; } }
    hd[y * MW + x] = m;
  }
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    let m = 4; for (let dy = -3; dy <= 3; dy++) { const Y = y + dy; if (Y < 0 || Y >= MH) continue; const a = Math.max(dy < 0 ? -dy : dy, hd[Y * MW + x]); if (a < m) m = a; }
    vd[y * MW + x] = m;
  }
  const toVoid = (x, y) => vd[y * MW + x] || 4;
  const P = def.planet, [ex, ey, er] = def.earth, [mx, my, mr] = def.moon, [sx0, sy0, sx1, sy1] = def.station;
  starPix.length = 0;
  const glowPix = [], edgePix = [], ringPix = [];
  // the nebula: a coarse grid (8 px) of values, looked up per pixel (no noise per pixel over the empty space)
  const NG = 8, GW = Math.ceil(MW / NG) + 1, GH = Math.ceil(MH / NG) + 1, neb = new Float32Array(GW * GH), hue = new Float32Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) { const x = gx * NG, y = gy * NG; neb[gy * GW + gx] = vnoise(x / 90, y / 90, sd + 64) * .65 + vnoise(x / 28, y / 28, sd + 65) * .35; hue[gy * GW + gx] = vnoise(x / 70 + 40, y / 70, sd + 66); }

  yield;
  // ----- the ground -----
  for (let j = 0; j < A; j++) {
    if (j % 50000 === 49999) yield;
    const x = j % MW, y = j / MW | 0, t = ter[j], kd = kind[j], h = hash(x, y, sd + 60);
    if (t === 4 || kd === KD.rock || kd === KD.chunk) continue; // (the boost pads are painted already; asteroids and ice chunks below)
    let c;
    if (t === 0 && !kd) {
      const dpx = x + .5 - P.x, dpy = y + .5 - P.y, dp2 = dpx * dpx + dpy * dpy, ex2 = (x + .5 - ex) ** 2 + (y + .5 - ey) ** 2, dp = dp2 < 230 * 230 ? Math.sqrt(dp2) : 999, de = ex2 < (er + 6) ** 2 ? Math.sqrt(ex2) : 9999;
      if (dp < P.r) {
        // the ringed planet: warm bands, lit from the top left; its atmosphere glows at the rim
        const band = Math.floor((y - P.y + (vnoise(x / 26, y / 7, sd + 61) - .5) * 9 + 200) / 9) % 4, sh = (dpx + dpy) / P.r;
        c = [K.pa, K.pb, K.pc, K.pd][band].map(v => Math.min(255, v * (1.12 - .45 * Math.max(0, sh + .2))) | 0);
        if (dp > P.r - 2) c = [255, 190, 120];
      } else if (de < er) {
        // the Earth at the corner of the map: oceans, land, clouds, the night side darker
        const v = vnoise(x / 22, y / 22, sd + 62), cl = vnoise(x / 14 + 9, y / 9, sd + 63), sh = ((x - ex) + (y - ey)) / er;
        c = cl > .64 ? K.cloud : v > .58 ? (v > .7 ? K.land1 : K.land) : v > .5 ? K.ocean1 : K.ocean;
        c = c.map(q => Math.min(255, q * (1.1 - .5 * Math.max(0, sh + .3))) | 0);
      } else if (de < er + 4) c = K.atmo.map(q => q * (1 - (de - er) / 5) | 0);
      else {
        // deep space: dark blue, clouds of a nebula in blue and purple, stars
        const gx = x / NG, gy = y / NG, ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy, g = iy * GW + ix,
        w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        const v = neb[g] * w00 + neb[g + 1] * w10 + neb[g + GW] * w01 + neb[g + GW + 1] * w11 + (h - .5) * .04, p = hue[g] * w00 + hue[g + 1] * w10 + hue[g + GW] * w01 + hue[g + GW + 1] * w11;
        c = v > .7 ? (p > .5 ? K.nebP2 : K.nebB2) : v > .6 ? (p > .5 ? K.nebP : K.nebB) : v > .48 ? K.sp2 : v > .36 ? K.sp1 : K.sp0;
        if (h < .0016) { c = [255, 255, 255]; starPix.push(j); } else if (h < .0036) c = [255, 233, 168]; else if (h < .0056) c = [159, 214, 255]; else if (h < .009) c = [70, 74, 110];
        // the rest of the planet's ring beyond the field: thin, pale bands you cannot drive on
        if (dp > P.ring[0] && dp < P.ring[1] + 6) { const b = Math.floor(dp / 4) % 3; if (b !== 1) c = c.map((q, k) => (q * .7 + K.ringF[k] * .3) | 0); }
      }
    } else if (kd === KD.deck || kd === KD.bay) {
      // the station deck: tiles, hazard stripes at the edge; the road over it is a dark lane with a dashed line; the bay: blue-grey with nozzles
      const e = Math.min(x - sx0, sx1 - x, y - sy0, sy1 - y);
      if (dist[j] < HALF) {
        c = (x + y) % 3 ? K.lane : K.lane1;
        if (dist[j] > HALF - 2) c = K.mark; else if (Math.abs(off(j)) < 1 && near[j] % 10 < 5) c = K.hz;
      } else if (kd === KD.bay) {
        washMask[j] = 1;
        c = (x % 10 === 0 || y % 10 === 0) ? K.bayS : h < .5 ? K.bay : K.bay1;
        if (x % 10 === 5 && y % 10 === 5) c = K.bayN;
      } else if (e < 4) c = ((x + y) >> 2) & 1 ? K.hz : K.hzD;
      else { c = (x % 12 === 0 || y % 12 === 0) ? K.deckS : vnoise(x / 9, y / 9, sd + 67) > .55 ? K.deck2 : h < .5 ? K.deck : K.deck1; if (x % 12 === 2 && y % 12 === 2) c = K.rivet; }
    } else if (kd === KD.moon || kd === KD.detour) {
      // the moon: grey dust and stone; the roads over it are pressed flat and lighter, dust lies in the craters
      const v = vnoise(x / 7, y / 7, sd + 68) * .6 + h * .4, dm = Math.hypot(x + .5 - mx, y + .5 - my);
      if (t === 2) { c = v < .4 ? K.dust1 : v > .7 ? K.dust2 : K.dust; if (ter[j - 1] !== 2 || ter[j + 1] !== 2 || ter[j - MW] !== 2 || ter[j + MW] !== 2) c = K.dustE; }
      else if (t === 1) {
        c = v < .35 ? K.road1 : v > .7 ? K.road2 : K.road;
        const ed = kd === KD.detour ? ter[j - 2] !== 1 || ter[j + 2] !== 1 || ter[j - 2 * MW] !== 1 || ter[j + 2 * MW] !== 1 : dist[j] > HALF - 2.5;
        if (ed) c = K.roadE; else if (kd !== KD.detour && Math.abs(Math.abs(off(j)) - 11) < 1.6 && h < .75) c = K.rut; else if (h < .01) c = K.moonD;
      }
      else { c = v < .35 ? K.moon1 : v > .7 ? K.moon2 : K.moon; if (h < .012) c = K.moonD; else if (h > .992) c = K.moonL; if (dm > mr - 4) c = K.moonE; }
    } else if (kd === KD.ring) {
      // the ring field: icy dust in thin bands, it glitters; its edge to the void glows
      const dp = Math.hypot(x + .5 - P.x, y + .5 - P.y), b = Math.floor((dp + (vnoise(x / 30, y / 30, sd + 73) - .5) * 6) / 3) % 3, e = toVoid(x, y);
      c = [K.ring, K.ring1, K.ring2][b]; if (h < .03) c = [255, 255, 255];
      if (h < .015) ringPix.push(j);
      if (e === 1) c = K.plD; else if (e === 2) c = K.glow; else if (e === 3) c = K.glowM;
    } else if (t === 2) {
      // moon dust in a hollow of the asteroid field: grey, grainy, its edge frays into the grid
      const v = vnoise(x / 4, y / 4, sd + 69) * .5 + h * .5, edge = ter[j - 1] !== 2 || ter[j + 1] !== 2 || ter[j - MW] !== 2 || ter[j + MW] !== 2;
      c = edge ? (h < .5 ? K.gr : K.pdust1) : v < .45 ? K.pdust1 : v > .75 ? K.dust1 : K.pdust;
    } else if (kd === KD.tube) {
      // the floor of the glass tube: grooves along the way
      const o = Math.abs(off(j)); c = Math.round(o) % 6 === 0 ? K.groove : vnoise(x / 8, y / 8, sd + 70) > .6 ? K.tube2 : h < .5 ? K.tube : K.tube1;
      if (dist[j] > HALF - 2) c = K.hullD;
    } else if (t === 17) {
      // metal plates with seams and rivets; the asteroid field and the narrow bridges are a grating; a glowing strip along every edge to space
      const i = near[j], o = off(j), e = toVoid(x, y), onRoad = dist[j] < HALF;
      c = vnoise(x / 10, y / 10, sd + 71) > .62 ? K.pl2 : h < .5 ? K.pl : K.pl1;
      if (RT.narrowM[j]) c = ((x + y) % 4 === 0 || (x - y + 1000) % 4 === 0) ? K.seam : K.grL;
      else if (kd === KD.belt && !onRoad) c = (x % 8 === 0 || y % 8 === 0) ? K.gr1 : h < .5 ? K.gr : K.pl1;
      else if (kd === KD.wide || kd === KD.pad) { if ((x + y) % 9 === 0) c = K.seam; }
      else if (i % 14 === 0 || Math.abs(Math.abs(o) - 12) < .6) c = K.seam; else if ((i % 14 === 4 || i % 14 === 10) && Math.abs(Math.abs(o) - 7) < .8) c = K.rivet;
      // the edges: yellow and black at the narrow bridges, on the wide way and round the wormhole (a choice, take care); cyan elsewhere
      const warn = RT.narrowM[j] || kd === KD.wide || kd === KD.pad;
      if (e === 1) c = K.plD; else if (warn && e <= 3) c = ((x + y) >> 2) & 1 ? K.hz : K.hzD; else if (e === 2) { c = K.glow; if (hash(i, 1, sd) < .5) glowPix.push(j); } else if (e === 3) c = K.glowM;
      if (e <= 3 && hash(x >> 2, y >> 2, sd + 72) < .08) edgePix.push(j);
    } else continue;
    set(j, c);
  }

  yield;
  // small craters on the moon (only a picture): a rim lit from the top left, a darker bowl; the big crater with its ramp
  for (const [cx, cy, cr, dusty] of def.craters) for (let y = Math.floor(cy - cr - 3); y <= cy + cr + 3; y++) for (let x = Math.floor(cx - cr - 3); x <= cx + cr + 3; x++) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    const j = y * MW + x; if (kind[j] !== KD.moon || dist[j] < HALF) continue;
    const dd = Math.hypot(x + .5 - cx, y + .5 - cy) / cr, sh = ((x - cx) + (y - cy)) / cr;
    if (dd > 1.12) continue;
    if (dd > .86) set(j, sh < 0 ? K.moonL : K.moonD);
    else if (!dusty || ter[j] !== 2) set(j, sh < 0 ? K.moonD : K.moon1);
    else if (sh < -.5) set(j, K.dust1);
  }
  const C = def.crater;
  for (let y = Math.floor(C.y - C.r - 8); y <= C.y + C.r + 8; y++) for (let x = Math.floor(C.x - C.r - 8); x <= C.x + C.r + 8; x++) {
    const j = y * MW + x, dd = Math.hypot(x + .5 - C.x, y + .5 - C.y) / C.r, sh = ((x - C.x) + (y - C.y)) / C.r;
    if (dd < 1) { if (sh > .2 && dd > .55) dk(x, y, .78); else if (sh < -.6 && dd > .7) dk(x, y, 1.08); }
    else if (dd < 1.1 && kind[j] !== KD.detour) set(j, sh < 0 ? K.moonL : K.moonD);
  }
  // the ramp at the east rim of the crater: a steel lip with hazard stripes (the cars fly off it to the west)
  for (let y = C.y - HALF + 2; y <= C.y + HALF - 2; y++) for (let x = C.lip; x <= C.lip + 24; x++) {
    const k = x - C.lip; set(y * MW + x, k < 3 ? K.plD : k < 7 ? (((y >> 2) & 1) ? K.hz : K.hzD) : (y + k) % 5 === 0 ? K.hullD : k > 18 ? K.road1 : K.hull1);
  }
  for (const s of [-1, 1]) for (let x = C.lip; x <= C.lip + 24; x++) setT(x, C.y + s * HALF, K.hullD);
  for (let k = 0, tries = 0; k < 50 && tries < 900; tries++) {
    const x = S.r() * MW | 0, y = S.r() * MH | 0, j = y * MW + x, cr = 2 + (S.r() * 4 | 0);
    if (ter[j] !== 13 || dist[j] < HALF + cr + 3 || kind[j] !== KD.moon) continue;
    for (let dy = -cr - 1; dy <= cr + 1; dy++) for (let dx = -cr - 1; dx <= cr + 1; dx++) { const dd = Math.hypot(dx, dy); if (dd > cr + 1) continue; const q = (y + dy) * MW + x + dx; if (ter[q] !== 13) continue; set(q, dd > cr - .5 ? (dx + dy < 0 ? K.moonD : K.moonL) : K.moon1); }
    k++;
  }
  // the start line (chequered)
  startLine(S);

  yield;
  // ----- the asteroids of the field (solid): shaded from the top left, craters, a dark rim, a shadow on the grid; small rocks drift in space -----
  for (const [x, y, r] of def.belt.rocks) {
    const R = Math.ceil(r * 1.7), cr = [[hash(x, 3, sd) * r - r / 2, hash(x, 4, sd) * r - r / 2, r * .28], [hash(y, 5, sd) * r - r / 2, hash(y, 6, sd) * r - r / 2, r * .2], [hash(x, 7, sd) * r - r / 2, hash(y, 8, sd) * r - r / 2, r * .14]];
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const X = x + dx, Y = y + dy; if (X < 1 || Y < 1 || X >= MW - 1 || Y >= MH - 1) continue;
      const j = Y * MW + X;
      if (kind[j] !== KD.rock) { if (kind[j - 6 * MW - 5] === KD.rock && ter[j] !== 0) dk(X, Y, .62); continue; }
      const sh = (dx + dy) / r; let c = sh < -.5 ? K.rock2 : sh > .45 ? K.rock1 : K.rock;
      if (hash(X, Y, sd + 74) < .06) c = sh < 0 ? K.rockL : K.rockD;
      for (const q of cr) { const qd = Math.hypot(dx - q[0], dy - q[1]); if (qd < q[2]) c = (dx - q[0]) + (dy - q[1]) < 0 ? K.rockD : K.rock1; else if (qd < q[2] + 1.2 && (dx - q[0]) + (dy - q[1]) > 0) c = K.rockL; }
      if (kind[j - 1] !== KD.rock || kind[j + 1] !== KD.rock || kind[j - MW] !== KD.rock || kind[j + MW] !== KD.rock) c = K.rockD;
      set(j, c);
    }
  }
  // the hollows of moon dust: their upper left wall lies in shadow, the lower right one catches the light (a hollow, not a stain)
  for (const [x, y, rx, ry] of def.belt.dust) for (let Y = Math.floor(y - ry * 1.5); Y <= y + ry * 1.5; Y++) for (let X = Math.floor(x - rx * 1.5); X <= x + rx * 1.5; X++) {
    if (ter[Y * MW + X] !== 2) continue;
    const u = (X + .5 - x) / rx, v = (Y + .5 - y) / ry, e = u * u + v * v, sh = (u + v) * .7;
    if (e > .45 && sh < -.25) dk(X, Y, .78); else if (e > .45 && sh > .3) dk(X, Y, 1.1); else if (e < .3) dk(X, Y, .93);
  }
  walls.push(...RT.rockWalls);
  for (const w of RT.rockWalls) solid(w.x, w.y, 3);
  // the ice chunks of the ring: bluish white, a dark rim, a shadow on the dust
  for (const ch of RT.chunks) {
    const R = Math.ceil(ch.r + 4);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const X = Math.round(ch.x + dx), Y = Math.round(ch.y + dy), j = Y * MW + X;
      if (kind[j] === KD.chunk) { const sh = (dx + dy) / ch.r; set(j, Math.hypot(dx, dy) > ch.r - 1.8 ? K.iceD : sh < -.3 ? K.ice : K.ice1); }
      else if (ter[j] === RING && kind[j - 4 * MW - 3] === KD.chunk) dk(X, Y, .7);
    }
    walls.push({ x: ch.x, y: ch.y, r: ch.r });
  }
  // little rocks drifting in the empty space (only a picture)
  const lump = (X, Y, rr, sd2) => {
    for (let dy = -rr - 1; dy <= rr + 1; dy++) for (let dx = -rr - 1; dx <= rr + 1; dx++) {
      const dd = Math.hypot(dx, dy) + (vnoise((X + dx) * 3 / rr, (Y + dy) * 3 / rr, sd2) - .5) * Math.min(rr * .5, 3); if (dd > rr) continue;
      const sh = (dx + dy) / rr; px(X + dx, Y + dy, dd > rr - 1 ? K.rockD : sh < -.45 ? K.rock2 : sh > .4 ? K.rock1 : K.rock);
    }
  };
  for (let k = 0, tries = 0; k < 40 && tries < 3000; tries++) {
    const x = 8 + (S.r() * (MW - 16) | 0), y = 8 + (S.r() * (MH - 16) | 0), j = y * MW + x, rr = 2 + (S.r() * 4 | 0);
    if (ter[j] !== 0 || kind[j] || dist[j] < HALF + 14 + rr || Math.hypot(x - P.x, y - P.y) < P.ring[1] + 14 || Math.hypot(x - ex, y - ey) < er + 10) continue;
    let ok = true; for (let q = -8; q <= 8 && ok; q += 4) for (let s = -8; s <= 8 && ok; s += 4) { const X = x + q, Y = y + s; if (X >= 0 && Y >= 0 && X < MW && Y < MH && (ter[Y * MW + X] !== 0 || kind[Y * MW + X])) ok = false; }
    if (!ok) continue;
    lump(x, y, rr, sd + 75 + k); k++;
  }

  yield;
  // ----- the station: modules on the deck (solid), a railing round the deck, the control tower, the hangar with a robot arm and a docked shuttle -----
  const box = (x, y, w, h, roof, roof2) => {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const e = Math.min(xx, yy, w - 1 - xx, h - 1 - yy);
      setT(x + xx, y + yy, e === 0 ? K.hullD : e === 1 ? (xx < w / 2 && yy < h / 2 ? K.hull : K.hull1) : (Math.floor(yy / 4) % 2 ? roof : roof2));
    }
    for (let q = 3; q < w - 3; q += 5) setT(x + q, y + 2, K.win);
    for (let yy = 0; yy <= h; yy += 6) for (const xx of [0, w]) walls.push({ x: x + xx, y: y + yy, r: 4 });
    for (let xx = 0; xx <= w; xx += 6) for (const yy of [0, h]) walls.push({ x: x + xx, y: y + yy, r: 4 });
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) { const X = x + dx + 3, Y = y + dy + 4; if (X < MW && Y < MH) dk(X, Y, .78); }
    solid(x + w / 2, y + h / 2, Math.max(w, h) / 2 + 4);
  };
  for (const [x, y, w, h] of def.modules) box(x, y, w, h, K.hull1, K.hull);
  const ctl = def.tower; box(ctl[0], ctl[1], ctl[2], ctl[3], K.hullD, K.hull1);
  for (let yy = 4; yy < 14; yy++) for (let xx = 4; xx < ctl[2] - 4; xx++) setT(ctl[0] + xx, ctl[1] + yy, yy < 6 ? K.win1 : K.win);
  // the robot arm over the west modules (it holds a container), the docked shuttle on the east side (only pictures)
  for (let k = 0; k < 30; k++) { setT(70 + k * .9, 200 - k * .5, K.hz); setT(71 + k * .9, 200 - k * .5, K.hzD); }
  for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 12; xx++) setT(92 + xx, 180 + yy, yy === 0 || xx === 0 || yy === 7 || xx === 11 ? K.hullD : xx % 3 ? [200, 90, 60] : [160, 70, 46]);
  const sh = def.shuttle;
  for (let yy = -7; yy <= 7; yy++) for (let xx = -16; xx <= 16; xx++) {
    const e = (xx / 16) ** 2 + (yy / (7 - Math.max(0, xx) * .25)) ** 2; if (e > 1) continue;
    setT(sh[0] + xx, sh[1] + yy, e > .8 ? K.hullD : xx > 10 && Math.abs(yy) < 2 ? K.win : yy < 0 ? K.hull : K.hull1);
  }
  for (const s of [-1, 1]) for (let k = 0; k < 8; k++) setT(sh[0] - 8 - k, sh[1] + s * (7 + k * .5), K.hullD);
  walls.push({ x: sh[0], y: sh[1], r: 9 }, { x: sh[0] - 10, y: sh[1], r: 8 });
  // the railing round the deck: solid wherever no road goes through
  for (let x = sx0; x <= sx1; x += 5) for (const y of [sy0, sy1]) if (dist[y * MW + x] > HALF + 3 && kind[y * MW + x] !== KD.bay) { walls.push({ x, y, r: 3 }); setT(x, y, K.hz); setT(x + 1, y, K.hzD); }
  for (let y = sy0; y <= sy1; y += 5) for (const x of [sx0, sx1]) if (dist[y * MW + x] > HALF + 3) { walls.push({ x, y, r: 3 }); setT(x, y, K.hz); setT(x, y + 1, K.hzD); }
  // the pylons of the hangar beside the start line (lamps; nothing spans the road, the line stays visible)
  for (const s of [-1, 1]) { const x = Math.round(path[0].x + nrm[0].x * s * (HALF + 7)), y = Math.round(path[0].y + nrm[0].y * s * (HALF + 7)); for (let dy = -4; dy <= 4; dy++) for (let dx = -3; dx <= 3; dx++) setT(x + dx, y + dy, Math.abs(dx) === 3 || Math.abs(dy) === 4 ? K.hullD : K.hull1); walls.push({ x, y, r: 4 }); }
  // the decontamination bay: nozzles along its middle, a sign at its mouth (a nozzle over a drop)
  const nozzles = [];
  for (let k = 6; k < RT.bay.length - 6; k += 7) { const p = RT.bay[k]; if (dist[(p.y | 0) * MW + (p.x | 0)] > HALF + 4) nozzles.push({ x: p.x, y: p.y }); }
  const [gx, gy] = def.bay.sign;
  for (let yy = 0; yy < 14; yy++) for (let xx = 0; xx < 14; xx++) setT(gx + xx, gy + yy, xx === 0 || yy === 0 || xx === 13 || yy === 13 ? K.hullD : [40, 110, 200]);
  for (let xx = 3; xx < 11; xx++) setT(gx + xx, gy + 3, K.hull); for (let yy = 4; yy < 6; yy++) setT(gx + 6, gy + yy, K.hull);
  for (const [dx, dy] of [[6, 7], [5, 8], [7, 8], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [5, 10], [6, 10], [7, 10]]) setT(gx + dx, gy + dy, [190, 235, 255]);
  // a gangway from the deck to the turning ring of the station (the ring itself turns while you race)
  const [wx, wy, wr] = def.wheel;
  for (let x = sx1 + 1; x < wx - wr + 2; x++) for (let dy = -3; dy <= 3; dy++) px(x, wy + dy, Math.abs(dy) === 3 ? K.hullD : dy < 0 ? K.hull : K.hull1);

  yield;
  // ----- the glass tube: glass walls along both sides (solid); its roof is a picture drawn over the cars (see-through) -----
  const inTube = i => inRng(i, RT.t0, RT.t1);
  let tube;
  {
    for (let i = RT.t0; inTube(i); i = (i + 3) % N) for (const s of [-1, 1]) walls.push({ x: path[i].x + nrm[i].x * s * (HALF + 3), y: path[i].y + nrm[i].y * s * (HALF + 3), r: 3 });
    let x0 = MW, y0 = MH, x1 = 0, y1 = 0;
    for (let j = 0; j < A; j++) if (dist[j] < HALF + 4 && inTube(near[j])) { const x = j % MW, y = j / MW | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const W = x1 - x0 + 1, H = y1 - y0 + 1, cv = mk(W, H), g = cv.getContext('2d'), img = g.createImageData(W, H), q = img.data;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const j = y * MW + x; if (!(dist[j] < HALF + 4 && inTube(near[j]))) continue;
      const i = near[j], o = off(j), ao = Math.abs(o);
      let c, a;
      if (ao > HALF + 1) { c = K.hullD; a = 255; } else if (ao > HALF - 1) { c = K.hull; a = 255; }
      else if (i % 8 === 0) { c = K.hull1; a = 210; } else if (Math.abs(o + 12) < 2.5) { c = [230, 248, 255]; a = 120; } else { c = [150, 215, 255]; a = 46; }
      const k = ((y - y0) * W + x - x0) * 4; q[k] = c[0]; q[k + 1] = c[1]; q[k + 2] = c[2]; q[k + 3] = a;
      if (ao > HALF - 1) wallMask[j] = 1;
    }
    g.putImageData(img, 0, 0);
    tube = { c: cv, x: x0, y: y0, W, H };
  }

  yield;
  // ----- force fields on the outside of the sharp bends: a glowing barrier between little posts; it bounces the cars back softly -----
  const fieldPix = [];
  for (const [fx, fy, L] of def.fields) {
    const i0 = nearestIdx(path, fx, fy), ta = tan[(i0 - 8 + N) % N], tb = tan[(i0 + 8) % N];
    const s = Math.sign((ta.x - tb.x) * nrm[i0].x + (ta.y - tb.y) * nrm[i0].y) || 1;
    for (let k = -L; k <= L; k++) {
      const q = (i0 + k + N) % N, p = path[q], n = nrm[q];
      const X = Math.round(p.x + n.x * s * (HALF + 3)), Y = Math.round(p.y + n.y * s * (HALF + 3));
      if (X < 0 || Y < 0 || X >= MW || Y >= MH || ter[Y * MW + X] !== 0 || kind[Y * MW + X]) continue;
      for (let o = HALF + 2; o <= HALF + 4; o += .5) { const x = Math.round(p.x + n.x * s * o), y = Math.round(p.y + n.y * s * o); if (x < 0 || y < 0 || x >= MW || y >= MH || ter[y * MW + x] !== 0) continue; px(x, y, o === HALF + 3 ? [190, 250, 255] : [70, 170, 220]); fieldPix.push(y * MW + x); }
      if (k % 3 === 0) walls.push({ x: p.x + n.x * s * (HALF + 4), y: p.y + n.y * s * (HALF + 4), r: 3, bob: true });
      if (k % 9 === 0) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setT(X + dx, Y + dy, Math.abs(dx) === 2 || Math.abs(dy) === 2 ? K.hullD : dx === 0 && dy === 0 ? K.glow : K.hull1);
    }
  }

  yield;
  // ----- the satellite in the hairpin loop of the platforms: a body, solar wings, a dish (only a picture: it floats in space) -----
  const [stx, sty] = def.sat;
  for (let yy = -9; yy <= 9; yy++) for (let xx = -14; xx <= 14; xx++) setT(stx + xx, sty + yy, Math.abs(yy) === 9 || Math.abs(xx) === 14 ? K.hullD : (yy < -5 ? K.hull : K.hull1));
  for (const s of [-1, 1]) {
    for (let xx = 15; xx < 22; xx++) setT(stx + s * xx, sty, K.hullD);
    for (let yy = -10; yy <= 10; yy++) for (let xx = 22; xx <= 60; xx++) setT(stx + s * xx, sty + yy, Math.abs(yy) === 10 || xx === 22 || xx === 60 ? K.hullD : (xx % 12 === 0 || yy === 0) ? K.solarL : (xx + yy) % 7 === 0 ? K.solar1 : K.solar);
  }
  for (let yy = 10; yy < 24; yy++) for (let xx = -6; xx <= 6; xx++) { const e = (xx / 6) ** 2 + ((yy - 17) / 7) ** 2; if (e <= 1) setT(stx + xx, sty + yy, e > .7 ? K.hullD : K.hull); }

  yield;
  // ----- on the moon: the racing flag, a landing craft and a moon buggy (solid), little lamps along the road -----
  const disc = (cx, cy, rr, c) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) if (dx * dx + dy * dy <= rr * rr) setT(cx + dx, cy + dy, c); };
  const [fx0, fy0] = def.flag;
  for (let k = 0; k < 16; k++) setT(fx0, fy0 - k, K.hull1);
  for (let yy = 0; yy < 8; yy++) for (let xx = 1; xx < 13; xx++) setT(fx0 + xx, fy0 - 15 + yy, ((xx >> 1) + (yy >> 1)) & 1 ? [245, 245, 240] : [34, 30, 28]);
  walls.push({ x: fx0, y: fy0, r: 2 });
  const [lx, ly] = def.lander;
  for (const [dx, dy] of [[-12, 10], [12, 10], [-12, -6], [12, -6]]) { for (let k = 0; k < 8; k++) setT(lx + dx * k / 8, ly + dy * k / 8 + 4, K.hullD); disc(lx + dx, ly + dy + 4, 2, K.hull1); }
  for (let yy = -8; yy <= 8; yy++) for (let xx = -9; xx <= 9; xx++) { const e = (xx / 9) ** 2 + (yy / 8) ** 2; if (e <= 1) setT(lx + xx, ly + yy, e > .75 ? K.hullD : xx + yy < -3 ? [230, 200, 90] : [200, 168, 60]); }
  walls.push({ x: lx, y: ly, r: 12 }); solid(lx, ly, 14);
  const [bx, by] = def.buggy;
  for (let yy = -5; yy <= 5; yy++) for (let xx = -9; xx <= 9; xx++) setT(bx + xx, by + yy, Math.abs(yy) === 5 || Math.abs(xx) === 9 ? K.hullD : yy < -1 ? [210, 210, 214] : [170, 172, 180]);
  for (const [dx, dy] of [[-7, -6], [7, -6], [-7, 6], [7, 6]]) disc(bx + dx, by + dy, 2, [40, 40, 46]);
  setT(bx + 3, by - 9, K.hullD); setT(bx + 3, by - 8, K.hullD); setT(bx + 3, by - 10, [255, 80, 60]);
  walls.push({ x: bx, y: by, r: 10 });
  // the tracks of the buggy in the moon ground
  for (let k = 0; k < 120; k++) for (const s of [-6, 6]) { const x = Math.round(bx - 12 - k), y = Math.round(by + s + Math.sin(k / 18) * 6); const j = y * MW + x; if (x > 0 && ter[j] === 13 && dist[j] > HALF + 2) dk(x, y, .88); }
  const lamps = [];
  for (let i = 0; i < N; i += 18) for (const s of [-1, 1]) {
    const x = Math.round(path[i].x + nrm[i].x * s * (HALF + 3)), y = Math.round(path[i].y + nrm[i].y * s * (HALF + 3)); if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    const j = y * MW + x;
    if (kind[j] === KD.moon && ter[j] === 13) { px(x, y, K.hullD); px(x, y - 1, K.hull1); lamps.push({ x, y: y - 1, k: i / 18 | 0 }); }
  }

  yield;
  // ----- the buoys along the edge of the asteroid field (red on one side, green on the other: the lanes), the platforms near the black hole -----
  const buoys = [];
  for (let k = 0, bl = (RT.b1 - RT.b0 + N) % N; k <= bl; k += 18) {
    const i = (RT.b0 + k) % N, p = path[i], n = nrm[i];
    for (const s of [-1, 1]) for (let o = 96; o > HALF; o -= 2) {
      const x = Math.round(p.x + n.x * s * o), y = Math.round(p.y + n.y * s * o); if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const j = y * MW + x; if (kind[j] !== KD.belt || ter[j] !== 17) continue;
      if (toVoid(x, y) > 3) { buoys.push({ x, y, s, k: k / 18 | 0 }); break; }
    }
  }
  const [hx, hy] = def.hole, redPix = edgePix.filter(j => Math.hypot(j % MW - hx, (j / MW | 0) - hy) < def.holeR[1] + 20);
  const W = def.portals, ia = nearestIdx(path, W.a[0], W.a[1]), ib = nearestIdx(path, W.b[0], W.b[1]);
  // the ways of the computer cars: where each leaves the road (index) and its points
  const lip = nearestIdx(path, C.lip, C.y), land = nearestIdx(path, C.x - C.r - 30, C.y);
  const jumps = [{ x: C.lip, y: C.y, tx: -1, ty: 0, lo: -HALF + 2, hi: HALF - 2, vz: C.vz, g: C.g, soft: true, sfx: 'moonJump' }];
  return { jumps, pushes: [], alt: RT.alt, kind, narrowM: RT.narrowM, tube, t0: RT.t0, t1: RT.t1,
    glowPix, ringPix, redPix, fieldPix, lamps, nozzles, buoys, chunks: RT.chunks, b0: RT.b0, b1: RT.b1,
    forks: RT.forks, detour: RT.detour, iDetour: nearestIdx(path, C.pts[0][0], C.pts[0][1]), bayPts: RT.bay, iBay: nearestIdx(path, def.bay.pts[0][0], def.bay.pts[0][1]),
    lip, land, crater: C, rocks: def.belt.rocks,
    iRing: nearestIdx(path, P.x + Math.cos(-97 * Math.PI / 180) * 246, P.y + Math.sin(-97 * Math.PI / 180) * 246), padOff: (W.a[0] - path[ia].x) * nrm[ia].x + (W.a[1] - path[ia].y) * nrm[ia].y,
    portals: { ia, ib, a: { x: W.a[0], y: W.a[1] }, b: { x: path[ib].x, y: path[ib].y } },
    planet: P, inRing: RT.inRing, hole: def.hole, holeR: def.holeR, wheel: def.wheel, sat: def.sat, earth: def.earth, shuttle: def.shuttle };
}
