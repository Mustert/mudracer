import { HALF, TAU, clamp, hash, hex, mk, vnoise } from './core.js';
import { nearestIdx, paintTools, startLine } from './bau.js';
import { edgeCircles, smin } from './kit.js';
import { polyPts } from './volcanomap.js';

// ---------- Dschungel Rev 2 (plaene/DSCHUNGEL_REV2.md): a river valley ----------
// The river comes as a waterfall off the table mountain at the top, runs through a gorge under the road (liana or log bridge), wide and deep through
// the middle (nobody cuts across) and out at the bottom edge; on its way down the road fords it. Course: the start straight at the bottom left (east),
// the mangrove swamp with its boardwalk, the ford, fork 1 before the canopy (the swamp gully north through the undergrowth, or the dry trail round the
// east), the gorge under the waterfall, the dark temple pyramid (fork 2 in its hall: the ball corridor or the waterfall grotto, the only place that
// washes), down the temple stairs past the camp to the line.
// Terrain: 1 earth road (and trail, grotto, gravel banks, log), 0 jungle floor, 2 swamp (like mud, makes the car green), 10 deep swamp (pulls, swallows),
// 5 deep water (river, basin), 11 the gorge (you fall), 90 undergrowth floor (the open field under the canopy), 91 ford water (current, does not wash),
// 92 boardwalk planks.
export const FIELD = 90, FORD = 91, BOARD = 92;
// what a pixel is for the painting (kind)
const KR = { rock: 1, fig: 2, twall: 3, tfloor: 4, gravel: 5, fall: 6, stairs: 7, rim: 8, pillar: 9, ruin: 10 };

const K = Object.fromEntries(Object.entries({
  fl: '#2f6a2a', fl1: '#286024', fl2: '#367a30', flE: '#22501e', litter: '#5a4a22', litter2: '#7a5a2a',
  und: '#24502a', und1: '#1e4624', und2: '#2c5c2e', undL: '#4a5a24', root: '#5a3e22', rootL: '#7a5634', rootD: '#3a2614',
  road: '#7a5a36', road1: '#6e5030', road2: '#86643e', roadE: '#4e3a22', pud: '#5a4228',
  plank: '#a07644', plank1: '#8a6632', plankD: '#4e3418', log: '#7a5430', logL: '#9a7040', logD: '#3e2a16',
  duck: '#7aa83a', duck2: '#9ac84a', swamp: '#3e4e22', swamp1: '#46582a', deep: '#22301a', deep1: '#2c3c20',
  riv: '#1e4a48', riv1: '#245652', riv2: '#2c625a', rivD: '#163a3a', gorge: '#0e1a18', gorge1: '#16302c', foam: '#d8eef0',
  ford: '#4e6a4a', ford1: '#58764e', ford2: '#64805a', gravel: '#a0947a', gravel1: '#8a7e66', gravel2: '#b4a88c',
  rock: '#6a6458', rock1: '#5a554a', rock2: '#7c7668', rockD: '#3e3a32', rockL: '#9a9282', moss: '#4a7a30', moss1: '#5a8a38',
  leaf: '#1e5a24', leaf1: '#2a7030', leaf2: '#3a8a38', leaf3: '#5aa83e', leafD: '#0e3412', leafL: '#7ac84a',
  st: '#8a8a78', st1: '#7a7a6a', st2: '#9a9a88', stD: '#4a4a40', stL: '#b8b8a4', plate: '#b6ae96', plate1: '#a8a088', plateJ: '#6a6454',
  tw: '#4a4a3e', tw1: '#3e3e34', tw2: '#56564a', twD: '#26261e',
  tent: '#d8a040', tentD: '#a07020', tent2: '#3a8a6a', tent2D: '#24604a', jeep: '#6a7a3a', jeepD: '#3e4a22',
}).map(([k, v]) => [k, hex(v)]));

// the river runs from the top edge to the bottom edge (its chain [x, y, half width] goes down): row by row, its middle and half width from the chain,
// a ragged edge; fn(j) for every pixel of it
function river(C, MW, MH, seed, fn) {
  for (let y = 0; y < MH; y++) {
    let k = 1; while (k < C.length - 1 && C[k][1] < y) k++;
    const a = C[k - 1], b = C[k], f = clamp((y - a[1]) / ((b[1] - a[1]) || 1), 0, 1), cx = a[0] + (b[0] - a[0]) * f, r = a[2] + (b[2] - a[2]) * f;
    for (let x = Math.max(0, Math.floor(cx - r - 4)); x <= Math.min(MW - 1, cx + r + 4); x++) if (Math.abs(x + .5 - cx) < r + (vnoise(x * .1, y * .1, seed) - .5) * 6) fn(y * MW + x);
  }
}

// a narrow way of its own (a polyline with rounded corners, every 2 px): every pixel nearer than half to it, fn(j, distance); returns the points.
// Like stampLine (volcanomap.js), but with a distance buffer over its box instead of a Map (fast)
function stampWay(P, half, fn, MW, MH) {
  const pts = polyPts(P), R = Math.ceil(half + 1);
  let x0 = MW, y0 = MH, x1 = 0, y1 = 0; for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  x0 = Math.max(0, Math.floor(x0 - R)); y0 = Math.max(0, Math.floor(y0 - R)); x1 = Math.min(MW - 1, Math.ceil(x1 + R)); y1 = Math.min(MH - 1, Math.ceil(y1 + R));
  const BW = x1 - x0 + 1, D = new Float32Array(BW * (y1 - y0 + 1)).fill(1e9), h2 = half * half;
  for (const p of pts) for (let y = Math.max(y0, Math.floor(p.y - R)); y <= Math.min(y1, p.y + R); y++) { const dy = y + .5 - p.y, row = (y - y0) * BW; for (let x = Math.max(x0, Math.floor(p.x - R)); x <= Math.min(x1, p.x + R); x++) { const dx = x + .5 - p.x, dd = dx * dx + dy * dy; if (dd < h2 && dd < D[row + x - x0]) D[row + x - x0] = dd; } }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dd = D[(y - y0) * BW + x - x0]; if (dd < h2) fn(y * MW + x, Math.sqrt(dd)); }
  return pts;
}

// the distance of (x, y) from the segment a-b
const segD = (x, y, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1); return Math.hypot(x - ax - dx * t, y - ay - dy * t); };

// the x of the river at height y (its middle), from the chain
export function riverX(C, y) {
  for (let k = 1; k < C.length; k++) { const a = C[k - 1], b = C[k]; if (y >= a[1] && y <= b[1]) return a[0] + (b[0] - a[0]) * (y - a[1]) / ((b[1] - a[1]) || 1); }
  return C[C.length - 1][0];
}

// terrain, before the ground is painted. S: { def, ter, dist, near, path, tan, nrm, N }
export function* jungleTerrain(S) {
  const { MW, MH, def, ter, dist, near, path, N } = S, A = MW * MH;
  const alt = new Uint8Array(A), kind = new Uint8Array(A), plankM = new Uint8Array(A), logM = new Uint8Array(A), riverM = new Uint8Array(A), grottoM = new Uint8Array(A);
  const sd = (def.seed || 11) * 7;
  yield;

  // ----- the river: from the waterfall to the bottom edge. Over the road at the gorge only the log stays; across the road at the ford it is shallow -----
  // how far inside the shallow ford a point is (px; below 0: deep water). Its edge wanders, it is no box (1S11-5)
  const fordE = (x, y) => def.ford.half - Math.abs(y - def.ford.y + (vnoise(x * .035, y * .035, sd + 2) - .5) * 40 + (vnoise(x * .15, y * .15, sd + 12) - .5) * 8);
  const GO = def.gorge, FO = def.ford, cliffY = x => def.cliff + (vnoise(x * .02, 1, sd) - .5) * 40 + (vnoise(x * .08, 2, sd) - .5) * 10;
  river(def.river, MW, MH, sd + 1, j => { riverM[j] = 1; });
  yield;
  for (let j = 0; j < A; j++) {
    if (!riverM[j]) continue;
    const x = j % MW, y = j / MW | 0;
    if (y < cliffY(x) + 6) { ter[j] = 0; kind[j] = KR.fall; continue; } // (the waterfall over the edge of the table mountain)
    if (fordE(x, y) > 0 || (dist[j] < HALF + 6 && Math.abs(y - FO.y) < 70)) { ter[j] = FORD; continue; } // (the road itself always fords it)
    if (y < GO.y + 130) {
      if (dist[j] < HALF && Math.abs(y - GO.log) <= GO.lh) { ter[j] = 1; logM[j] = 1; continue; }
      ter[j] = dist[j] < HALF + 22 ? 11 : 5; continue;
    }
    ter[j] = 5;
  }
  for (const [bx, by, br] of FO.banks) for (let y = by - br - 2; y <= by + br + 2; y++) for (let x = bx - br - 2; x <= bx + br + 2; x++) {
    if (Math.hypot(x + .5 - bx, (y + .5 - by) * 1.5) < br + (vnoise(x * .3, y * .3, sd + 3) - .5) * 3) { const j = y * MW + x; ter[j] = 1; kind[j] = KR.gravel; }
  }
  yield;

  // ----- the table mountain along the top: rock down to cliffY (never over the road, the trail or the temple) -----
  const [tx0, ty0, tx1, ty1] = def.temple.rect, inTR = (x, y) => x >= tx0 && x <= tx1 && y >= ty0 && y <= ty1;
  for (let y = 0; y < 140; y++) for (let x = 0; x < MW; x++) {
    const j = y * MW + x; if (kind[j] || riverM[j] || dist[j] < HALF + 6 || inTR(x, y) || y >= cliffY(x)) continue;
    kind[j] = KR.rock;
  }
  yield;

  // ----- the mangrove swamp: swamp grows in from the edges in hollows, never across the whole road; deep swamp lies well off the line -----
  for (const [x0, y0, rx, ry] of def.swamp) for (let y = Math.floor(y0 - ry * 1.3); y <= y0 + ry * 1.3; y++) for (let x = Math.floor(x0 - rx * 1.3); x <= x0 + rx * 1.3; x++) {
    const j = y * MW + x; if (ter[j] > 1 || kind[j]) continue;
    if (((x + .5 - x0) / rx) ** 2 + ((y + .5 - y0) / ry) ** 2 < .75 + .5 * vnoise(x * .09, y * .09, sd + 4)) ter[j] = 2;
  }
  for (const [qx, qy, qr] of def.quick) for (let y = qy - qr - 2; y <= qy + qr + 2; y++) for (let x = qx - qr - 2; x <= qx + qr + 2; x++)
    if (Math.hypot(x + .5 - qx, y + .5 - qy) < qr + (vnoise(x * .3, y * .3, sd + 5) - .5) * 2) ter[y * MW + x] = 10;
  // the boardwalk: a longer bow to the south over the swamp, narrow, planks (full grip), no rail
  const boards = stampWay(def.boards.pts, def.boards.half, j => { if (ter[j] === 0 || ter[j] === 2) { ter[j] = BOARD; plankM[j] = 1; alt[j] = 1; } }, MW, MH);
  yield;

  // ----- fork 1: the dry trail round the east (a narrow earth road of its own) -----
  const trailM = new Uint8Array(A), trail = stampWay(def.trail.pts, def.trail.half + 10, (j, dd) => { trailM[j] = 1; if (dd >= def.trail.half) return; if (ter[j] === 0 || ter[j] === 2) { ter[j] = 1; alt[j] = 1; } kind[j] = 0; }, MW, MH);
  yield;

  // ----- the undergrowth under the canopy: an open field round the swamp gully, walled in by strangler figs (one shape, smooth), fig blobs inside,
  // the gully itself (the centre line) always free -----
  const F = def.field, iF0 = nearestIdx(path, F.from[0], F.from[1]), iF1 = nearestIdx(path, F.to[0], F.to[1]), R = F.r + 24;
  let bx0 = MW, by0 = MH, bx1 = 0, by1 = 0;
  for (let i = iF0; i !== iF1; i = (i + 1) % N) { const p = path[i]; bx0 = Math.min(bx0, p.x - R); by0 = Math.min(by0, p.y - R); bx1 = Math.max(bx1, p.x + R); by1 = Math.max(by1, p.y + R); }
  bx0 = Math.max(0, Math.floor(bx0)); by0 = Math.max(0, Math.floor(by0)); bx1 = Math.min(MW - 1, Math.ceil(bx1)); by1 = Math.min(MH - 1, Math.ceil(by1));
  const BW = bx1 - bx0 + 1, BH = by1 - by0 + 1, dC = new Float32Array(BW * BH).fill(1e9), nI = new Int32Array(BW * BH).fill(-1);
  for (let i = iF0, n = 0; ((iF1 - i + N) % N) > 2; i = (i + 3) % N, n += 3) {
    const p = path[i];
    for (let y = Math.max(by0, Math.floor(p.y - R)); y <= Math.min(by1, p.y + R); y++) {
      const dy = y + .5 - p.y, row = (y - by0) * BW - bx0;
      for (let x = Math.max(bx0, Math.floor(p.x - R)); x <= Math.min(bx1, p.x + R); x++) { const dx = x + .5 - p.x, dd = dx * dx + dy * dy; if (dd < dC[row + x]) { dC[row + x] = dd; nI[row + x] = n; } }
    }
    if (n % 80 === 78) yield;
  }
  for (let k = 0; k < dC.length; k++) dC[k] = Math.sqrt(dC[k]);
  const nF = (iF1 - iF0 + N) % N, wall0 = (x, y, k) => F.r + (vnoise(x * .025, y * .025, sd + 6) - .5) * 40 + (vnoise(x * .1, y * .1, sd + 7) - .5) * 10 - dC[k];
  // the fig blobs: spread out (a little Poisson), never on the gully, never too near the wall
  const blobs = [], rr = (a, b) => (hash(a, b, sd + 8) * 1e4 | 0) / 1e4;
  for (let t = 0; t < 600 && blobs.length < F.blobs; t++) {
    const x = bx0 + rr(t, 1) * BW | 0, y = by0 + rr(t, 2) * BH | 0, k = (y - by0) * BW + x - bx0, r = 11 + rr(t, 3) * 9;
    if (nI[k] < 6 || nI[k] > nF - 6 || wall0(x, y, k) < r + 22 || dC[k] < HALF + r + 12 || trailM[y * MW + x]) continue;
    if (blobs.some(b => Math.hypot(b.x - x, b.y - y) < 64)) continue;
    blobs.push({ x, y, r });
  }
  const figM = new Uint8Array(A);
  for (let y = by0; y <= by1; y++) {
    if (y % 40 === 39) yield;
    for (let x = bx0; x <= bx1; x++) {
      const k = (y - by0) * BW + x - bx0, j = y * MW + x; if (nI[k] <= 2 || nI[k] >= nF - 2 || trailM[j] || riverM[j]) continue;
      if (dist[j] < HALF || dC[k] > F.r + 56) continue; // (the gully; far outside)
      let f = wall0(x, y, k);
      if (f > 0) { // (the blobs and root walls only matter inside: they can only make it smaller)
        for (const b of blobs) f = smin(f, Math.hypot(x + .5 - b.x, y + .5 - b.y) - b.r - (vnoise(x * .2, y * .2, sd + 9) - .5) * 5, 10);
        for (const [ax, ay, cx2, cy2, w] of F.ridges) f = smin(f, segD(x, y, ax, ay, cx2, cy2) - w - (vnoise(x * .15, y * .15, sd + 10) - .5) * 6, 12);
      }
      if (f > 0) { ter[j] = FIELD; alt[j] = 1; continue; }
      if (f > -18 || dC[k] < F.r + 30) { ter[j] = 0; kind[j] = KR.fig; figM[j] = 1; }
    }
  }
  const figWalls = edgeCircles((x, y) => x < 0 || y < 0 || x >= MW || y >= MH || !figM[y * MW + x], bx0, by0, bx1, by1, 4, 4, 5);
  yield;

  // ----- the temple pyramid: its floor is the road inside (the ball corridor), the grotto lane and the hall; the rest of the footprint is wall -----
  const TD = def.temple, [hx, hy, hr] = TD.hall;
  const grotto = stampWay(TD.grotto.pts, TD.grotto.half, j => { ter[j] = 1; alt[j] = 1; grottoM[j] = 1; }, MW, MH);
  const floor = new Uint8Array(A);
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
    const j = y * MW + x;
    if (dist[j] < HALF || grottoM[j]) { floor[j] = 1; kind[j] = KR.tfloor; continue; }
    if (Math.hypot(x + .5 - hx, y + .5 - hy) < hr && y < TD.pillarY) { floor[j] = 1; kind[j] = KR.tfloor; ter[j] = 1; alt[j] = 1; continue; }
    ter[j] = 0; kind[j] = KR.twall;
  }
  // the row of pillars between the corridor and the grotto (solid like the walls, painted as pillars)
  for (let y = ty0; y <= ty1; y++) for (let x = TD.pillars[0]; x <= TD.pillars[1]; x++) { const j = y * MW + x; if (kind[j] === KR.twall && y > TD.pillarY - 8 && y < TD.pillarY + 26) kind[j] = KR.pillar; }
  const templeWalls = edgeCircles((x, y) => x < tx0 || y < ty0 || x > tx1 || y > ty1 || !!floor[y * MW + x], tx0, ty0, tx1, ty1, 4, 4, 5);
  yield;

  // ----- overgrown ruin walls in the jungle (solid): no shortcut through the inside -----
  const ruinM = new Uint8Array(A), ruinWalls = [];
  for (const [ax, ay, cx2, cy2, w] of def.ruins) {
    const x0 = Math.max(0, Math.min(ax, cx2) - w - 6), y0 = Math.max(0, Math.min(ay, cy2) - w - 6), x1 = Math.min(MW - 1, Math.max(ax, cx2) + w + 6), y1 = Math.min(MH - 1, Math.max(ay, cy2) + w + 6);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const j = y * MW + x; if (dist[j] < HALF + 8) continue;
      if (segD(x, y, ax, ay, cx2, cy2) < w + (vnoise(x * .2, y * .2, sd + 11) - .5) * 5) { ruinM[j] = 1; kind[j] = KR.ruin; ter[j] = 0; }
    }
    ruinWalls.push(...edgeCircles((x, y) => x < 0 || y < 0 || x >= MW || y >= MH || !ruinM[y * MW + x], x0, y0, x1, y1, 4, 3, 5));
  }
  yield;

  // ----- the stairs down out of the pyramid (a push down the slope), the basin at their foot (the stone ball sinks in it) -----
  const [s0, s1, push] = def.stairs, iS0 = nearestIdx(path, s0[0], s0[1]), iS1 = nearestIdx(path, s1[0], s1[1]);
  for (let j = 0; j < A; j++) { if (dist[j] < HALF + 6 && (near[j] - iS0 + N) % N <= (iS1 - iS0 + N) % N && kind[j] !== KR.twall) { const y = j / MW | 0; if (y > ty1 - 60) kind[j] = KR.stairs; } }
  const [qx, qy, qr] = def.basin;
  for (let y = qy - qr - 6; y <= qy + qr + 6; y++) for (let x = qx - qr - 6; x <= qx + qr + 6; x++) {
    const j = y * MW + x, dd = Math.hypot(x + .5 - qx, y + .5 - qy); if (dist[j] < HALF + 2) continue;
    if (dd < qr) ter[j] = 5; else if (dd < qr + 5) { ter[j] = 0; kind[j] = KR.rim; }
  }
  yield;

  // ----- the liana: it throws you over the gorge when it hangs on your side (the east) as you get there; the current in the ford pushes south -----
  const iG = nearestIdx(path, riverX(def.river, GO.y), GO.y);
  let xE = Math.round(riverX(def.river, GO.y)); while (xE < MW - 1 && riverM[GO.y * MW + xE]) xE++;
  let xW = Math.round(riverX(def.river, GO.y)); while (xW > 0 && riverM[GO.y * MW + xW]) xW--;
  const iLip = nearestIdx(path, xE + 4, GO.y), lp = path[iLip], iLand = nearestIdx(path, xW - 26, GO.y);
  const ls = GO.lane.map(y => -(y - lp.y));
  const jumps = [{ x: xE + 4, y: lp.y, tx: -1, ty: 0, lo: Math.min(...ls), hi: Math.max(...ls), vz: 95, push: 128, off: true, liana: true, sfx: 'tarzan', land: iLand }];
  let fx0 = MW, fx1 = 0; for (let x = 0; x < MW; x++) if (riverM[FO.y * MW + x]) { fx0 = Math.min(fx0, x); fx1 = Math.max(fx1, x); }
  const fordR = [fx0 - 4, FO.y - FO.half - 8, fx1 + 4, FO.y + FO.half + 8];
  const pushes = [{ rect: fordR, fx: 0, fy: FO.push }, { i0: iS0, i1: iS1, f: push }];

  const idx = (p) => nearestIdx(path, p[0], p[1]);
  return { alt, kind, plankM, logM, riverM, grottoM, figM, trailM, figWalls, templeWalls, ruinWalls, blobs, boards, trail, grotto, jumps, pushes, fordR,
    iG, iLand, gorgeX: [xW, xE], iF: [iF0, iF1], iS: [iS0, iS1], iFork: idx(def.trail.pts[0]), iBoard: idx(def.boards.pts[0]), iFord: idx([riverX(def.river, FO.y), FO.y]),
    iDoor: idx([tx1, TD.door]), iHall: idx([hx, hy]), iGrotto: idx(TD.grotto.pts[0]), cliffY, fordE };
}

// painting, after the ground. S: { def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, shore, sd, th, r, critters, darken, RT }
export function* paintJungle(S) {
  const { MW, MH, def, set, setT, path, nrm, tan, N, ter, dist, near, walls, wallMask, washMask, sd, RT } = S, A = MW * MH;
  const { px, dk, solid } = paintTools(S), KD = RT.kind;
  const swampPix = [], fordPix = [];
  const GO = def.gorge;

  yield;
  // ----- the ground -----
  for (let j = 0; j < A; j++) {
    if (j % 40000 === 39999) yield;
    const t = ter[j], kd = KD[j]; if (t === 0 && !kd) continue; // (the jungle floor: the core paints it in the colours of the theme)
    const x = j % MW, y = j / MW | 0, h = hash(x, y, sd + 40), v = vnoise(x / 6, y / 6, sd + 41) * .55 + h * .45;
    let c;
    if (kd === KR.rock) {
      const e = RT.cliffY(x) - y, sh = vnoise(x / 18, y / 9, sd + 60);
      c = e < 4 ? K.rockD : sh > .62 ? K.rockL : sh > .45 ? K.rock2 : sh < .3 ? K.rock1 : K.rock;
      if (vnoise(x / 7, y / 7, sd + 61) > .68 && e > 8) c = h < .5 ? K.moss : K.moss1;
      if ((y + (x >> 4)) % 13 === 0 && e > 6) c = K.rockD; // (layers of the table mountain)
      wallMask[j] = 1;
    } else if (kd === KR.fall) {
      c = ((x * 3 + Math.floor(y / 3)) % 5 === 0) ? K.foam : (x + y) % 3 ? [196, 228, 236] : [140, 196, 210]; wallMask[j] = 1;
    } else if (kd === KR.fig) {
      const s = vnoise(x / 5, y / 14, sd + 62), s2 = vnoise(x / 14, y / 5, sd + 63);
      c = Math.abs(s - .5) < .06 || Math.abs(s2 - .5) < .05 ? K.rootL : s > .55 ? K.root : s < .38 ? K.rootD : K.und1;
      if (vnoise(x / 8, y / 8, sd + 64) > .7) c = K.leaf;
      wallMask[j] = 1;
    } else if (kd === KR.twall || kd === KR.pillar) {
      const bx = Math.floor((x + ((y >> 3) & 1) * 7) / 14), by = y >> 3, joint = (x + ((y >> 3) & 1) * 7) % 14 === 0 || y % 8 === 0;
      c = joint ? K.twD : [K.tw, K.tw1, K.tw2][(hash(bx, by, sd + 44) * 3) | 0];
      if (kd === KR.pillar) { const px2 = (x - def.temple.pillars[0]) % 22; c = px2 < 12 ? (px2 < 2 ? K.stD : px2 < 5 ? K.stL : K.st) : K.twD; }
      wallMask[j] = 1;
    } else if (kd === KR.tfloor || kd === KR.stairs) {
      // light stone plates with dark joints, readable in the dark (contrast)
      const sx = (x + ((y >> 4) & 1) * 8) % 16, joint = sx === 0 || y % 16 === 0;
      c = joint ? K.plateJ : hash(Math.floor((x + ((y >> 4) & 1) * 8) / 16), y >> 4, sd + 45) < .5 ? K.plate : K.plate1;
      if (kd === KR.stairs) c = y % 7 === 0 ? K.stD : y % 7 === 1 ? K.stL : (y % 7 < 4 ? K.st2 : K.st);
      if (vnoise(x / 9, y / 9, sd + 46) > .74 && kd === KR.stairs) c = K.moss;
      if (dist[j] > HALF - 2 && !RT.grottoM[j] && kd === KR.tfloor && dist[j] < HALF) c = K.plateJ;
    } else if (kd === KR.ruin) {
      const bx = Math.floor((x + ((y >> 3) & 1) * 6) / 12), joint = (x + ((y >> 3) & 1) * 6) % 12 === 0 || y % 8 === 0;
      c = joint ? K.stD : [K.st, K.st1, K.st2][(hash(bx, y >> 3, sd + 84) * 3) | 0];
      if (vnoise(x / 6, y / 6, sd + 85) > .58) c = h < .5 ? K.moss : K.moss1;
      wallMask[j] = 1;
    } else if (kd === KR.rim) { c = (x + y) % 4 ? K.st : K.stD; wallMask[j] = 1; }
    else if (kd === KR.gravel) c = h < .3 ? K.gravel1 : h > .75 ? K.gravel2 : K.gravel;
    else if (t === FORD) { const e = Math.max(RT.fordE(x, y), dist[j] < HALF + 6 ? 20 : -99); c = e < 10 && h * 10 > e ? K.riv1 : e < 18 && h * 18 > e ? K.ford : v < .35 ? K.ford : v > .7 ? K.ford2 : K.ford1; fordPix.push(j); } // (it gets deeper towards its edge)
    else if (t === 5 || t === 11) {
      const u = vnoise(x / 10, y / 22, sd + 47);
      if (t === 11) c = u > .6 ? K.gorge1 : K.gorge; else c = u < .3 ? K.rivD : u > .68 ? K.riv2 : K.riv1;
      if (t === 5 && hash(x, y >> 2, sd + 48) < .02) c = K.riv;
    } else if (t === BOARD) {
      // planks across the boardwalk (the boards point along the way)
      const p = RT.boards, k = nearestOf(p, x, y), q = p[k], nx = p[Math.min(p.length - 1, k + 1)], tx = nx.x - q.x, ty = nx.y - q.y, l = Math.hypot(tx, ty) || 1;
      const a = ((x - q.x) * tx + (y - q.y) * ty) / l + k * 2;
      c = Math.floor(a) % 5 === 0 ? K.plankD : (Math.floor(a / 5) & 1) ? K.plank : K.plank1;
    } else if (RT.logM[j]) { const dy = Math.abs(y - GO.log); c = dy >= GO.lh - 1 ? K.logD : dy < 2 ? K.logL : (x % 9 === 0 ? K.logD : K.log); }
    else if (t === FIELD) {
      c = v < .3 ? K.und1 : v > .72 ? K.und2 : K.und;
      if (h < .025) c = h < .012 ? K.litter : K.undL;
      if (Math.abs(vnoise(x / 16, y / 16, sd + 49) - .5) < .015) c = K.root;
    } else if (t === 1 || t === 4) {
      if (t === 4) continue;
      c = v < .33 ? K.road1 : v > .7 ? K.road2 : K.road;
      if (vnoise(x / 9, y / 9, sd + 42) > .74) c = K.pud;
      if (dist[j] > HALF - 2.5 && !RT.alt[j] && dist[j] < HALF) c = K.roadE;
    } else if (t === 2) { c = v < .4 ? K.swamp : K.swamp1; if (h < .14) c = h < .06 ? K.duck2 : K.duck; swampPix.push(j); }
    else if (t === 10) c = v < .45 ? K.deep : K.deep1;
    else continue;
    set(j, c);
  }
  for (const w of RT.figWalls.concat(RT.templeWalls, RT.ruinWalls)) walls.push(w);
  // the ruin walls are solid: a dark rim and a long shadow to the south-east (Grundsatz 10)
  for (const [ax, ay, bx2, by2, w] of def.ruins) for (let y = Math.min(ay, by2) - w - 6; y <= Math.max(ay, by2) + w + 12; y++) for (let x = Math.min(ax, bx2) - w - 6; x <= Math.max(ax, bx2) + w + 12; x++) {
    if (x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1) continue;
    const j = y * MW + x;
    if (KD[j] === KR.ruin) { if (KD[j - MW] !== KR.ruin || KD[j + MW] !== KR.ruin) set(j, K.stD); continue; }
    for (let q = 1; q <= 6; q++) if (KD[j - q * MW - (q >> 1)] === KR.ruin) { dk(x, y, .5 + q * .06); break; }
  }
  // wet rock along the banks of the river and leaf litter on the jungle floor (only near the river: row by row round its middle)
  for (let y = 0; y < MH; y++) {
    const cx = riverX(def.river, y) | 0;
    for (let x = Math.max(1, cx - 110); x <= Math.min(MW - 2, cx + 110); x++) { const j = y * MW + x; if (ter[j] === 0 && !KD[j] && !RT.riverM[j] && nearRiver(RT.riverM, x, y, MW, MH)) set(j, (x + y) % 3 ? K.rockD : K.rock1); }
  }
  yield;
  startLine(S);

  // ----- the gorge: rocky banks on both sides of the river where it runs under the road -----
  for (let y = 60; y < 320; y++) for (let x = RT.gorgeX[0] - 30; x <= RT.gorgeX[1] + 30; x++) {
    const j = y * MW + x; if (RT.riverM[j] || dist[j] < HALF || KD[j]) continue;
    let e = 99; for (let q = 1; q <= 9 && e === 99; q++) if (RT.riverM[j - q] || RT.riverM[j + q]) e = q;
    if (e === 99) continue;
    set(j, e < 3 ? K.rockD : vnoise(x / 4, y / 4, sd + 65) > .6 ? K.rockL : K.rock);
  }
  // the edge of the log bridge (it is the only way where the liana does not hang)
  yield;

  // ----- the ford: stones and driftwood (solid) -----
  for (const [sx, sy, sr] of def.ford.stones) {
    walls.push({ x: sx, y: sy, r: sr });
    for (let dy = -sr; dy <= sr; dy++) for (let dx = -sr; dx <= sr; dx++) { const dd = Math.hypot(dx, dy); if (dd <= sr) px(sx + dx, sy + dy, dd > sr - 1 ? K.rockD : (dx + dy) < -1 ? K.rockL : K.rock); }
  }
  yield;

  // ----- mangroves: arched roots in the swamp beside the road (solid), never on the boardwalk -----
  const mangroves = [];
  for (let t = 0, n = 0; t < 900 && n < 26; t++) {
    const x = 470 + (hash(t, 1, sd + 70) * 300 | 0), y = 740 + (hash(t, 2, sd + 70) * 250 | 0), j = y * MW + x;
    if (ter[j] !== 2 && ter[j] !== 0 || dist[j] < HALF + 10 || wallMask[j] || nearCode(ter, x, y, MW, MH, BOARD, 12) || mangroves.some(m => Math.hypot(m.x - x, m.y - y) < 26)) continue;
    if (RT.riverM[j]) continue;
    mangroves.push({ x, y }); walls.push({ x, y, r: 5 }); solid(x, y, 6); n++;
    for (let a = 0; a < TAU; a += TAU / 6) for (let s = 2; s <= 9; s++) px(x + Math.cos(a) * s, y + Math.sin(a) * s * .7 + (s > 6 ? (s - 6) * .6 : 0), s < 4 ? K.logD : K.root);
    for (let dy = -9; dy <= 6; dy++) for (let dx = -9; dx <= 9; dx++) { const e = (dx / 9) ** 2 + ((dy + 4) / 7) ** 2; if (e < 1) setT(x + dx, y + dy - 6, e > .7 ? K.leafD : (dx + dy) < 0 ? K.leaf2 : K.leaf1); }
  }
  yield;

  // ----- the temple pyramid: seen from outside a step pyramid of big blocks (moss, roots, a shrine on top), doors where the road goes in and out -----
  const TD = def.temple, [tx0, ty0, tx1, ty1] = TD.rect, TW = tx1 - tx0 + 1, TH = ty1 - ty0 + 1, roof = mk(TW, TH), rg = roof.getContext('2d'), rimg = rg.createImageData(TW, TH), rq = rimg.data;
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
    const j = y * MW + x, e = Math.min(x - tx0, tx1 - x, y - ty0, ty1 - y), lvl = Math.floor(e / 16), face = e === x - tx0 ? 'w' : e === tx1 - x ? 'e' : e === y - ty0 ? 'n' : 's';
    const inStep = e % 16, h = hash(x, y, sd + 80);
    const lit = face === 'n' || face === 'w' ? 1.1 : face === 'e' ? .82 : .92, top = lvl >= 4;
    let c = top ? K.st2 : (inStep < 2 ? K.stD : inStep < 4 ? K.stL : [K.st, K.st1, K.st2][(hash(Math.floor(x / 12), Math.floor(y / 7), sd + 81) * 3) | 0]);
    if (!top && ((face === 'n' || face === 's') ? x % 12 === 0 : y % 7 === 0) && inStep >= 4) c = K.stD;
    if (vnoise(x / 11, y / 11, sd + 82) > .66 && !top) c = h < .5 ? K.moss : K.moss1;
    if (Math.abs(vnoise(x / 20, y / 20, sd + 83) - .5) < .012) c = K.root;
    const k = ((y - ty0) * TW + x - tx0) * 4;
    let f = top ? 1 : lit;
    // the doors: dark where the road comes in (east) and the stairs go out (south)
    if (RT.kind[j] === KR.tfloor && e < 12) { c = [20, 16, 12]; f = 1; }
    rq[k] = clamp(c[0] * f, 0, 255); rq[k + 1] = clamp(c[1] * f, 0, 255); rq[k + 2] = clamp(c[2] * f, 0, 255); rq[k + 3] = 255;
  }
  rg.putImageData(rimg, 0, 0);
  // the shrine on top and the big stairs on the south face
  const mx = (tx0 + tx1) / 2 - tx0;
  rg.fillStyle = '#4a4a40'; rg.fillRect(mx - 34, TH / 2 - 26, 68, 46); rg.fillStyle = '#9a9a88'; rg.fillRect(mx - 32, TH / 2 - 24, 64, 40);
  rg.fillStyle = '#1a140e'; rg.fillRect(mx - 9, TH / 2 - 6, 18, 22); rg.fillStyle = '#7a7a6a'; for (let q = -28; q <= 28; q += 8) rg.fillRect(mx + q - 1, TH / 2 - 30, 3, 6);
  const sxS = path[RT.iS[0]].x - tx0;
  for (let y = TH - 64; y < TH; y += 4) { rg.fillStyle = y % 8 ? '#b8b8a4' : '#6a6a5c'; rg.fillRect(sxS - 30, y, 60, 3); }
  // inside: torches along the walls (every 110 px along the floor edge), the waterfall in the grotto
  const torches = [];
  for (const w of RT.templeWalls) { if (torches.some(t => Math.hypot(t.x - w.x, t.y - w.y) < 110) || w.x < tx0 + 6 || w.x > tx1 - 6 || w.y < ty0 + 6 || w.y > ty1 - 6) continue; torches.push({ x: w.x, y: w.y, k: torches.length }); }
  const [fx, fy] = TD.fall;
  for (let y = fy - 24; y <= fy + 24; y++) for (let x = fx - 30; x <= fx + 30; x++) {
    const j = y * MW + x; if (!RT.grottoM[j] || Math.hypot((x - fx) * .8, y - fy) > 24) continue;
    washMask[j] = 1; set(j, (x + y) % 5 ? [96, 150, 160] : [160, 210, 220]);
  }
  // the treasure chest in the hall
  const [hx, hy] = TD.hall, chx = hx - 6, chy = hy - 44;
  for (let y = 0; y < 9; y++) for (let x = 0; x < 13; x++) px(chx + x, chy + y, y === 0 || x === 0 || x === 12 || y === 8 ? [27, 18, 12] : y === 3 ? [255, 210, 63] : [168, 116, 60]);
  const temple = { c: roof, x: tx0, y: ty0, W: TW, H: TH, torches, fall: { x: fx, y: fy }, chest: [chx + 6, chy + 4] };
  yield;

  // ----- the stairs: they come out of the south face (the steps are painted in the ground pass); statues on both sides at the door -----
  for (const s of [-1, 1]) {
    const i = (RT.iS[0] + 30) % N, x = Math.round(path[i].x + nrm[i].x * s * (HALF + 16)), y = Math.round(path[i].y + nrm[i].y * s * (HALF + 16));
    if (KD[y * MW + x]) continue;
    walls.push({ x, y, r: 6 }); solid(x, y, 8);
    for (let dy = -7; dy <= 7; dy++) for (let dx = -6; dx <= 6; dx++) { const e = (dx / 6) ** 2 + (dy / 7) ** 2; if (e <= 1) setT(x + dx, y + dy, e > .75 ? K.stD : dy < -2 ? K.st2 : K.st); }
    setT(x - 2, y - 3, [20, 20, 20]); setT(x + 2, y - 3, [20, 20, 20]); for (let k = -2; k <= 2; k++) setT(x + k, y + 2, K.stD);
  }
  // the basin: its rim is solid
  const [qx, qy, qr] = def.basin;
  for (let a = 0; a < TAU; a += .22) walls.push({ x: qx + Math.cos(a) * (qr + 3), y: qy + Math.sin(a) * (qr + 3), r: 3 });
  yield;

  // ----- the canopy over the undergrowth: a picture of leaves the size of the canopy (see-through only round your own car) -----
  const [cx0, ccy0, cx1, ccy1] = def.canopy, CW = cx1 - cx0, CH = ccy1 - ccy0, cc = mk(CW, CH), cg = cc.getContext('2d'), cimg = cg.createImageData(CW, CH), cq = cimg.data;
  for (let y = 0; y < CH; y++) {
    if (y % 60 === 59) yield;
    for (let x = 0; x < CW; x++) {
      const X = cx0 + x, Y = ccy0 + y, edge = Math.min(x, CW - 1 - x, y, CH - 1 - y) + (vnoise(X * .05, Y * .05, sd + 47) - .5) * 40;
      if (edge < 6) continue;
      if (RT.trailM[Y * MW + X]) continue; // (the trail stays in the open)
      const big = vnoise(X / 16, Y / 16, sd + 48), sm = vnoise(X / 5, Y / 5, sd + 49), hh = hash(X, Y, sd + 50);
      let c = big > .62 ? (sm > .55 ? K.leaf3 : K.leaf2) : big > .4 ? (sm > .6 ? K.leaf2 : K.leaf1) : sm > .62 ? K.leaf1 : K.leaf;
      if (big < .3 && sm < .35) c = K.leafD; if (hh < .01) c = K.leafL; if (hh > .997) c = [230, 80, 120];
      const k = (y * CW + x) * 4; cq[k] = c[0]; cq[k + 1] = c[1]; cq[k + 2] = c[2]; cq[k + 3] = edge < 14 ? 170 : 255;
    }
  }
  cg.putImageData(cimg, 0, 0);
  yield;

  // ----- the signposts at fork 1 (big, readable: up = the swamp gully with a skull, right = the trail with a tent) -----
  const [gx, gy] = def.signs;
  const sign = (x, y, dir, icon) => {
    walls.push({ x: x + 10, y: y + 26, r: 3 }); solid(x + 10, y + 26, 3);
    for (let yy = 0; yy < 18; yy++) for (let xx = 0; xx < 20; xx++) setT(x + xx, y + yy, yy === 0 || xx === 0 || yy === 17 || xx === 19 ? K.logD : K.plank);
    for (let yy = 18; yy < 28; yy++) { setT(x + 9, y + yy, K.logD); setT(x + 10, y + yy, K.log); }
    const ink = [30, 20, 10];
    if (dir === 'up') { for (let q = 0; q < 6; q++) for (let w = -q; w <= q; w++) setT(x + 5 + w, y + 3 + q, ink); for (let q = 9; q < 15; q++) { setT(x + 4, y + q, ink); setT(x + 5, y + q, ink); } }
    else { for (let q = 0; q < 6; q++) for (let w = -q; w <= q; w++) setT(x + 9 + q, y + 6 + w, ink); for (let q = 2; q < 9; q++) { setT(x + q, y + 5, ink); setT(x + q, y + 6, ink); } }
    if (icon === 'skull') { for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 6; xx++) setT(x + 11 + xx, y + 3 + yy, [240, 236, 220]); setT(x + 12, y + 5, ink); setT(x + 15, y + 5, ink); for (let xx = 0; xx < 4; xx++) setT(x + 12 + xx, y + 9, [240, 236, 220]); }
    else for (let q = 0; q < 6; q++) for (let w = -q; w <= q; w++) setT(x + 4 + w, y + 10 + q, q === 5 || Math.abs(w) === q ? K.tentD : K.tent);
  };
  sign(gx, gy, 'up', 'skull'); sign(gx + 26, gy, 'right', 'tent');
  yield;

  // ----- the camp: tents, the jeep, crates, the radio mast, a hammock, the camp fire (flames are drawn while racing) -----
  const [sx, sy] = def.camp;
  const tent = (x, y, A0, A1) => { for (let dy = -9; dy <= 9; dy++) for (let dx = -12; dx <= 12; dx++) { if (Math.abs(dx) > 12 - Math.abs(dy) * .2) continue; setT(x + dx, y + dy, Math.abs(dy) < 1 ? A1 : dy < 0 ? A0 : A1.map(v => v * .85 | 0)); } for (let k = 0; k < 6; k++) dk(x + 13 + k, y + 4, .7); walls.push({ x, y, r: 9 }); solid(x, y, 11); };
  tent(sx - 30, sy - 40, K.tent, K.tentD); tent(sx + 6, sy - 46, K.tent2, K.tent2D); tent(sx - 26, sy + 40, K.tent, K.tentD);
  const Rr = (x, y, w, h, c) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) setT(sx + x + xx, sy + y + yy, c); };
  Rr(14, 2, 26, 13, [20, 20, 16]); Rr(15, 3, 24, 11, K.jeep); Rr(16, 4, 7, 9, K.jeepD); Rr(27, 4, 4, 9, [140, 200, 230]); walls.push({ x: sx + 27, y: sy + 8, r: 9 }); solid(sx + 27, sy + 8, 12);
  for (const [x, y] of [[-34, 4], [-26, 6], [-30, -2], [30, 30]]) { Rr(x, y, 7, 6, K.plankD); Rr(x + 1, y + 1, 5, 4, K.plank); }
  for (let q = 0; q < 26; q++) setT(sx - 50, sy - 10 - q, q % 6 === 0 ? [200, 60, 50] : [140, 140, 140]); setT(sx - 51, sy - 36, [255, 80, 60]);
  for (let q = 0; q < 18; q++) setT(sx + 20 + q, sy - 18 + Math.round(Math.sin(q / 17 * Math.PI) * 3), [200, 150, 90]);
  const camp = { fire: { x: sx - 6, y: sy + 16 }, man: { x: sx + 4, y: sy + 26 } };
  for (let a = 0; a < TAU; a += .6) px(sx - 6 + Math.cos(a) * 4, sy + 16 + Math.sin(a) * 3, K.st);
  yield;

  // ----- stone heads of the ruin at the edges of the map -----
  for (const [x, y] of def.heads) {
    walls.push({ x, y, r: 10 }); solid(x, y, 13);
    for (let dy = -12; dy <= 12; dy++) for (let dx = -10; dx <= 10; dx++) { const e = (dx / 10) ** 2 + (dy / 12) ** 2; if (e > 1) continue; setT(x + dx, y + dy, e > .8 ? K.stD : vnoise((x + dx) / 4, (y + dy) / 4, 113) > .65 ? K.moss : dx < -2 ? K.st2 : K.st); }
    for (const [dx, dy, w, h] of [[-6, -4, 4, 2], [2, -4, 4, 2], [-1, -1, 2, 5], [-5, 6, 10, 2]]) for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) setT(x + dx + xx, y + dy + yy, K.stD);
  }
  yield;

  // ----- ferns (flat and pale: you can drive over them) and big blossoms; on the undergrowth floor too -----
  const okOff = (x, y, m) => { for (let dy = -m; dy <= m; dy += 2) for (let dx = -m; dx <= m; dx += 2) { const X = x + dx, Y = y + dy; if (X < 2 || Y < 2 || X >= MW - 2 || Y >= MH - 2) return false; const j = Y * MW + X; if ((ter[j] !== 0 && ter[j] !== FIELD) || dist[j] < HALF + 5 || wallMask[j] || KD[j]) return false; } return true; };
  for (let k = 0, tries = 0; k < 140 && tries < 5000; tries++) {
    const x = 4 + (S.r() * (MW - 8) | 0), y = 4 + (S.r() * (MH - 8) | 0); if (!okOff(x, y, 6)) continue;
    const off0 = S.r() * TAU, pale = ter[y * MW + x] === FIELD;
    for (let q = 0; q < 6; q++) { const a = off0 + q * TAU / 6; for (let s = 1; s <= 7; s++) { if (pale) { dk(x + Math.cos(a) * s, y + Math.sin(a) * s, 1.12); continue; } px(x + Math.cos(a) * s, y + Math.sin(a) * s, s < 3 ? K.leaf : K.leaf2); if (s > 2 && s < 7) px(x + Math.cos(a) * s - Math.sin(a), y + Math.sin(a) * s + Math.cos(a), K.leaf3); } }
    k++;
  }
  for (let k = 0, tries = 0; k < 80 && tries < 2400; tries++) {
    const x = 4 + (S.r() * (MW - 8) | 0), y = 4 + (S.r() * (MH - 8) | 0); if (!okOff(x, y, 2) || ter[y * MW + x] !== 0) continue;
    const c = [[240, 60, 90], [255, 170, 40], [200, 80, 230], [255, 240, 90]][(S.r() * 4) | 0];
    px(x - 1, y, c); px(x + 1, y, c); px(x, y - 1, c); px(x, y + 1, c); px(x, y, [255, 230, 120]); k++;
  }
  // the fig blobs inside the undergrowth: crowns over them (top layer)
  for (const b of RT.blobs) for (let dy = -b.r - 6; dy <= b.r + 6; dy++) for (let dx = -b.r - 6; dx <= b.r + 6; dx++) {
    const e = Math.hypot(dx, dy) / (b.r + 6) + (vnoise((b.x + dx) * .3, (b.y + dy) * .3, 114) - .5) * .2; if (e > 1) continue;
    setT(b.x + dx, b.y + dy, e > .85 ? K.leafD : (dx + dy) < -3 ? K.leaf3 : e < .4 ? K.leaf2 : K.leaf1);
  }
  yield;

  // ----- the rotten trees of the event: where they stand beside the road or the trail and where they fall (across it) -----
  const trees = def.trees.map(([x, y, side, lane], k) => {
    let p, n, tg, half;
    if (lane === 'p') { const P = RT.trail, q = nearestOf(P, x, y), a = P[Math.max(0, q - 2)], b = P[Math.min(P.length - 1, q + 2)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1; p = P[q]; tg = { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; n = { x: -tg.y, y: tg.x }; half = def.trail.half; }
    else { const i = nearestIdx(path, x, y); p = path[i]; n = nrm[i]; tg = tan[i]; half = HALF; }
    const bx = p.x + n.x * side * (half + 12), by = p.y + n.y * side * (half + 12);
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (dx * dx + dy * dy <= 22) px(bx + dx, by + dy, dx * dx + dy * dy > 14 ? K.logD : K.log);
    walls.push({ x: bx, y: by, r: 4 });
    return { k, bx, by, nx: -n.x * side, ny: -n.y * side, tx: tg.x, ty: tg.y, half, lane };
  });

  // the roots across the swamp gully: little bumps (the core of them is in jungle.js)
  const roots = [];
  for (let i = RT.iF[0] + 40; ((RT.iF[1] - i + N) % N) > 30; i = (i + 37) % N) {
    roots.push({ x: path[i].x, y: path[i].y, tx: tan[i].x, ty: tan[i].y, nx: nrm[i].x, ny: nrm[i].y });
    for (let s = -HALF + 6; s < HALF - 6; s++) { const X = path[i].x + nrm[i].x * s, Y = path[i].y + nrm[i].y * s; px(X, Y, K.rootD); px(X + tan[i].x, Y + tan[i].y, K.rootL); }
  }
  // mud in the gully: a wet strip in its deepest part, on and off (beside it the undergrowth floor is dry: a choice)
  for (let j = 0; j < A; j++) {
    if (dist[j] >= 15 || ter[j] !== 1) continue;
    const i = near[j]; if (!((i - RT.iF[0] + N) % N < (RT.iF[1] - RT.iF[0] + N) % N)) continue;
    if (vnoise(i * .05, 0, sd + 90) > .42 && dist[j] < 9 + vnoise(j % MW * .2, (j / MW | 0) * .2, sd + 91) * 8) { ter[j] = 2; const h = hash(j, 0, 3); set(j, h < .1 ? K.duck : h < .5 ? K.swamp : K.swamp1); swampPix.push(j); }
  }

  return { jumps: RT.jumps, baseJumps: RT.jumps.length, pushes: RT.pushes, alt: RT.alt, quick: def.quick, boards: RT.boards, trail: RT.trail, grotto: RT.grotto,
    iG: RT.iG, iLand: RT.iLand, iF: RT.iF, iS: RT.iS, iFork: RT.iFork, iBoard: RT.iBoard, iFord: RT.iFord, iDoor: RT.iDoor, iHall: RT.iHall, iGrotto: RT.iGrotto,
    gorge: def.gorge, gorgeX: RT.gorgeX, liana: def.liana, fordR: RT.fordR, ford: def.ford, river: def.river, falls: def.falls, cliffY: RT.cliffY,
    temple, canopy: { c: cc, x: cx0, y: ccy0, W: CW, H: CH }, camp, trees, roots, mangroves, blobs: RT.blobs, swampPix, fordPix, basin: def.basin,
    crocs: def.crocs, monkeys: def.monkeys, signs: def.signs, figM: RT.figM, kindM: KD };
}

// the nearest point of a list of points to (x, y)
function nearestOf(P, x, y) { let b = 0, bd = 1e12; for (let k = 0; k < P.length; k++) { const d = (P[k].x - x) ** 2 + (P[k].y - y) ** 2; if (d < bd) { bd = d; b = k; } } return b; }
function nearRiver(M, x, y, MW, MH) { for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < MW && Y < MH && M[Y * MW + X]) return true; } return false; }
function nearCode(ter, x, y, MW, MH, code, r) { for (let dy = -r; dy <= r; dy += 3) for (let dx = -r; dx <= r; dx += 3) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < MW && Y < MH && ter[Y * MW + X] === code) return true; } return false; }

