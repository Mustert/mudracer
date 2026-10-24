import { HALF, clamp, hash, hex, rng, vnoise } from './core.js';
import { nearestIdx, paintTools, startLine } from './bau.js';
import { stampLine } from './volcanomap.js';

// ---------- Eis Rev 2: the winter-sports mountain (plaene/EIS_REV2.md) ----------
// Terrain: 1 packed snow (the road), 0 snow beside the road, 2 deep snow (like mud, it makes the car white), 12 sheet ice (the bob run, the lake),
// 70 the line of the chair lift (road under the cables; a car that reaches it is hooked on, ice.js), 71 powder snow (the open field in the pine wood, a little slower than the road, it does not make the car white).
// The map is tall (1000 x 1500): the lift on the left edge, the bob run on top, the wood, the serpentines on the right, the lake at the bottom.
// Nothing can be cut off: the fence between lift and wood, solid massifs at the edge, ridges and cliffs between the serpentines (CLAUDE.md, principle 4).

export const LIFT = 70, POWDER = 71, RIM = 28; // (RIM: the strip along the shore of the lake that never breaks)

const K = Object.fromEntries(Object.entries({
  tileA: '#e8f4fb', tileB: '#9fd0e8',
  snow: '#eef4fa', snow1: '#e3ebf4', snow2: '#f9fbfe', snowB: '#cddbea', snowD: '#b7c8da', glit: '#ffffff',
  pow: '#f2f7fc', pow1: '#e6eef7', pow2: '#fbfdff', powT: '#cfdcea',
  road: '#dfe6ef', road1: '#d3dbe6', road2: '#e9eef5', roadE: '#aebdcd', rut: '#c6d0dc',
  ice: '#bfe3f3', ice1: '#a9d6ec', ice2: '#d6eef8', iceL: '#ffffff', iceD: '#8cc3e0', lake: '#9fcfe6', lake1: '#8ac2de', lakeE: '#6fa6c8', thick: '#d4ecf8', thick1: '#c4e3f3', thickE: '#9ec6e0',
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

// the distance of a point from the outline of a polygon
const edgeDist = (P, x, y) => { let m = 1e9; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, ay] = P[j], [bx, by] = P[i], dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1); m = Math.min(m, Math.hypot(x - ax - dx * t, y - ay - dy * t)); } return m; };

const inPoly = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };

// terrain, before the ground is painted. S: { def, ter, dist, near, path, tan, nrm, N }
export function* iceTerrain(S) {
  const { MW, MH, def, ter, dist, near, path, N } = S, A = MW * MH, alt = new Uint8Array(A), lakeM = new Uint8Array(A), fieldM = new Uint8Array(A);
  yield;
  // the frozen lake: an oval with a ragged rim, the road across it is ice too; its north half is wider and flatter and reaches up to the foot of the rock wall
  // (lake[4] = how far it reaches north of its middle, lake[5] = the y it never goes above: the foot of the wall)
  const [lx, ly, rx, ry, rt = ry, ytop = 0] = def.lake;
  for (let y = Math.max(0, ly - rt - 8); y < Math.min(MH, ly + ry + 8); y++) for (let x = Math.max(0, lx - rx - 8); x < Math.min(MW, lx + rx + 8); x++) {
    const j = y * MW + x, dx = Math.abs(x + .5 - lx) / rx, dy = y + .5 - ly, e = dy < 0 ? dx ** 3 + (dy / rt) ** 2 : dx * dx + (dy / ry) ** 2;
    if (e >= .9 + .2 * vnoise(x * .05, y * .05, 71) || y < ytop + 3 * vnoise(x * .1, 7, 72) || (ter[j] !== 0 && ter[j] !== 1)) continue;
    ter[j] = 12; lakeM[j] = 1;
  }
  // how far every lake pixel is from the shore (chamfer 3-4, in pixels, up to 60): the rim of the lake is thick ice that never breaks
  const lakeD = new Uint8Array(A), qx0 = Math.max(0, lx - rx - 10), qy0 = Math.max(0, ly - rt - 10), qw = Math.min(MW, lx + rx + 10) - qx0, qh = Math.min(MH, ly + ry + 10) - qy0, D = new Uint16Array(qw * qh);
  for (let y = 0; y < qh; y++) for (let x = 0; x < qw; x++) D[y * qw + x] = lakeM[(qy0 + y) * MW + qx0 + x] ? 9999 : 0;
  for (let y = 1; y < qh; y++) for (let x = 1; x < qw - 1; x++) { const i = y * qw + x; D[i] = Math.min(D[i], D[i - 1] + 3, D[i - qw] + 3, D[i - qw - 1] + 4, D[i - qw + 1] + 4); }
  for (let y = qh - 2; y >= 0; y--) for (let x = qw - 2; x >= 1; x--) { const i = y * qw + x; D[i] = Math.min(D[i], D[i + 1] + 3, D[i + qw] + 3, D[i + qw + 1] + 4, D[i + qw - 1] + 4); }
  for (let y = 0; y < qh; y++) for (let x = 0; x < qw; x++) lakeD[(qy0 + y) * MW + qx0 + x] = Math.min(60, Math.round(D[y * qw + x] / 3));
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
  // the pines of the wood: spread out with a minimum distance (Poisson discs, 50 px), never on the lane along the centre line (it stays free, 42 px to each side), never at the
  // fence, the walls or the funnel. The trees in the first part of the wood (the landing of the jump) are flown over (ground: the cars in the air ignore them, update.js)
  const R = rng(def.seed * 77 + 3), trees = [], cellN = 50 / Math.SQRT2, gw = Math.ceil((fx1 - fx0) / cellN) + 1, grid = new Int16Array(gw * (Math.ceil((fy1 - fy0) / cellN) + 1)).fill(-1);
  for (let k = 0; k < 9000; k++) {
    const x = fx0 + R() * (fx1 - fx0), y = fy0 + R() * (fy1 - fy0), j = (y | 0) * MW + (x | 0);
    if (!fieldM[j] || dist[j] < 42 || edgeDist(F, x, y) < 26 || (def.skiers || []).some(([sx, sy]) => Math.hypot(sx - x, sy - y) < 24)) continue;
    const gx = ((x - fx0) / cellN) | 0, gy = ((y - fy0) / cellN) | 0; let ok = true;
    for (let qy = Math.max(0, gy - 2); qy <= gy + 2 && ok; qy++) for (let qx = Math.max(0, gx - 2); qx <= gx + 2; qx++) { const q = grid[qy * gw + qx]; if (q >= 0 && Math.hypot(trees[q].x - x, trees[q].y - y) < 50) { ok = false; break; } }
    if (!ok) continue;
    grid[gy * gw + gx] = trees.length; trees.push({ x: Math.round(x), y: Math.round(y), r: 7, ground: y < 800 });
  }
  yield;
  // deep snow: hollows on the line with a clean lane beside them (a shorter line through snow against a longer clean one), and drifts in the lee of some pines
  // (wind from the west: the drift lies to the east and the south-east of the tree)
  const deepM = new Uint8Array(A), blob = (cx, cy, ex, ey, a, k) => {
    const R2 = Math.ceil(Math.max(ex, ey) * 1.3) + 2, ca = Math.cos(a), sa = Math.sin(a);
    for (let y = Math.max(0, Math.floor(cy - R2)); y <= Math.min(MH - 1, cy + R2); y++) for (let x = Math.max(0, Math.floor(cx - R2)); x <= Math.min(MW - 1, cx + R2); x++) {
      const j = y * MW + x; if (ter[j] !== POWDER && ter[j] !== 0) continue;
      const dx = x + .5 - cx, dy = y + .5 - cy, e = ((dx * ca + dy * sa) / ex) ** 2 + ((-dx * sa + dy * ca) / ey) ** 2;
      if (e < .8 + .4 * vnoise(x * .1, y * .1, 80 + k) && !trees.some(t => (t.x - x) ** 2 + (t.y - y) ** 2 < 100)) { ter[j] = 2; deepM[j] = 1; }
    }
  };
  (def.deep || []).forEach(([x, y, ax, ay, a], k) => blob(x, y, ax, ay, a || 0, k));
  trees.filter(t => t.y > 700 && R() < .22).forEach((t, k) => blob(t.x + 26, t.y + 8, 30, 11, .3, 20 + k));
  yield;
  // the lift line: the road under the cables, from just after the line up to the top station
  const [lx0, ly0, ly1] = def.lift, lA = nearestIdx(path, lx0, ly0), lB = nearestIdx(path, lx0, ly1 + 22);
  for (let y = Math.max(0, ly1 - HALF); y <= Math.min(MH - 1, ly0 + HALF); y++) for (let x = Math.max(0, lx0 - HALF - 2); x <= Math.min(MW - 1, lx0 + HALF + 2); x++) {
    const j = y * MW + x; if (ter[j] === 1 && near[j] >= lA && near[j] <= lB) ter[j] = LIFT;
  }
  yield;
  // the foehn: a lane that leaves the road beside the climb and comes back (road, like the car wash lane of the desert; the way back arrow and c.safe know it as alt)
  let bay = null;
  if (def.bay) {
    const lane = new Uint8Array(A), P = stampLine(def.bay.lane, def.bay.half, j => { lane[j] = 1; if (ter[j] === 0 || ter[j] === 1) { ter[j] = 1; alt[j] = 1; } }, MW, MH);
    bay = { P, i0: nearestIdx(path, def.bay.lane[0][0], def.bay.lane[0][1]), lane };
  }
  yield;
  // the bob run: sheet ice on the road
  const seg = ([a, b]) => range(N, nearestIdx(path, a[0], a[1]), nearestIdx(path, b[0], b[1]));
  // (the ice runs on 80 px past the last wall: the run-out where the bob run ends on the snow road)
  const bob = seg(def.bob), ice = range(N, nearestIdx(path, def.bob[0][0], def.bob[0][1]), (nearestIdx(path, def.bob[1][0], def.bob[1][1]) + 40) % N), [bx0, by0, bx1, by1] = boxOf(path, ice, HALF + 10);
  for (let y = Math.max(0, by0); y <= Math.min(MH - 1, by1); y++) for (let x = Math.max(0, bx0); x <= Math.min(MW - 1, bx1); x++) {
    const j = y * MW + x; if (dist[j] < HALF && ice[near[j]] && ter[j] === 1) ter[j] = 12;
  }
  yield;
  // the ski jump: one big ramp across the whole road
  const jumps = [], [jx, jy, vz] = def.jump, ji = nearestIdx(path, jx, jy), jp = path[ji], jt = S.tan[ji];
  jumps.push({ x: jp.x, y: jp.y, tx: jt.x, ty: jt.y, lo: -HALF - 4, hi: HALF + 4, vz });
  const pushes = (def.slopes || []).map(([x0, y0, x1, y1, f]) => ({ i0: nearestIdx(path, x0, y0), i1: nearestIdx(path, x1, y1), f }));
  const serp = [nearestIdx(path, 570, 470), nearestIdx(path, 930, 910)];
  return { alt, lakeM, lakeD, fieldM, deepM, trees, bob, jumps, pushes, bay, serp };
}

// painting, after the ground. S: { def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, shore, bridgeMask, sd, r, RT }
// a snowy gable roof seen from above (ridge along the middle, beams at the eaves) on the top layer; solid below it when the walls are asked for
function roof(S, x0, y0, w, h) {
  const { MW, setT, wallMask } = S;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const dy = y - y0, dx = x - x0, ridge = Math.abs(dy - h / 2);
    setT(x, y, dx === 0 || dx === w - 1 || dy === 0 || dy === h - 1 ? K.woodD : ridge < 1 ? K.roofD : dy < h / 2 ? K.roofS : (dx % 6 === 0 ? K.roofD : [228, 236, 244]));
    wallMask[y * MW + x] = 1;
  }
}

// the chair lift: lift = [x, y of the valley station, y of the top station]; chess = [x, y] of the stump with the board
function paintLift(S, lift, chess) {
  const { MW, setT, walls, wallMask } = S, { px, dk } = paintTools(S), [lx, ly0, ly1] = lift;
  // masts beside the line every 150 px, a dark cross arm over the road with two wheels for the cables (the cables themselves are drawn while racing)
  for (let y = ly0 - 120; y > ly1 + 60; y -= 150) {
    for (const s of [-1, 1]) { walls.push({ x: lx + s * (HALF + 5), y, r: 3 }); for (let dy = 3; dy < 8; dy++) for (let dx = 2; dx < 9; dx++) dk(lx + s * (HALF + 5) + dx, y + dy, .8); }
    for (let x = lx - HALF - 7; x <= lx + HALF + 7; x++) for (let k = 0; k < 3; k++) setT(x, y - 1 + k, k === 0 ? K.rockL : k === 1 ? K.rockD : K.rockDD);
    for (const cx of [lx - 18, lx + 18]) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 9) setT(cx + dx, y - 2 + dy, dx * dx + dy * dy < 3 ? K.rockL : K.rockDD);
  }
  // the two stations: a roof the cars drive under (they are on the cables there); the valley station just behind the start line, the top station at the end
  for (const y of [ly0 - 21, ly1 + 4]) {
    for (let yy = y + 3; yy < y + 31; yy++) for (let xx = lx - 36 + 5; xx < lx + 36 + 5; xx++) dk(xx, yy, .8);
    roof(S, lx - 36, y, 72, 24);
    for (const s of [-1, 1]) for (const dy of [2, 22]) walls.push({ x: lx + s * (HALF + 5), y: y + dy, r: 4 });
    for (let k = 0; k < 6; k++) setT(lx - 30 + k * 12, y + 24, k % 2 ? K.win : K.winD);
  }
  // chess under the lift: a tree stump with a board, Santa Claus and the Grinch sit at it (they are drawn while racing), a reindeer looks on
  if (chess) {
    const [cx, cy] = chess;
    walls.push({ x: cx, y: cy, r: 11 });
    for (let dy = -14; dy <= 14; dy++) for (let dx = -14; dx <= 14; dx++) {
      const d = Math.hypot(dx, dy); if (d > 14) continue;
      if (d > 9 && dx + dy > 0) dk(cx + dx + 3, cy + dy + 4, .8);
      if (d <= 12) px(cx + dx, cy + dy, d > 11 ? K.woodD : Math.round(d) % 3 === 0 ? K.woodL : K.wood);
    }
    for (let sy = 0; sy < 8; sy++) for (let sx = 0; sx < 8; sx++) for (let q = 0; q < 2; q++) for (let r = 0; r < 2; r++) px(cx - 8 + sx * 2 + q, cy - 8 + sy * 2 + r, (sx + sy) & 1 ? [58, 40, 28] : [244, 232, 205]);
    for (let a = -9; a <= 9; a++) { px(cx + a, cy - 9, K.woodD); px(cx + a, cy + 8, K.woodD); px(cx - 9, cy + a, K.woodD); px(cx + 8, cy + a, K.woodD); }
    // the reindeer: brown body, head with antlers, red nose
    const rx = cx + 12, ry = cy + 34;
    walls.push({ x: rx, y: ry, r: 6 });
    for (let dy = -5; dy <= 5; dy++) for (let dx = -8; dx <= 8; dx++) if ((dx / 8) ** 2 + (dy / 5) ** 2 <= 1) px(rx + dx, ry + dy, dy < -2 ? [140, 98, 62] : dy > 2 ? [92, 62, 38] : [118, 80, 50]);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 9) px(rx - 11 + dx, ry + dy, [118, 80, 50]);
    px(rx - 14, ry, K.red); px(rx - 13, ry, K.red);
    for (const [dx, dy] of [[-12, -4], [-11, -5], [-10, -6], [-12, 4], [-11, 5], [-10, 6], [-13, -5], [-13, 5]]) px(rx + dx, ry + dy, [200, 170, 120]);
    for (let k = 0; k < 4; k++) { px(rx - 5 + k * 3, ry + 5, [60, 40, 26]); px(rx - 5 + k * 3, ry + 6, [60, 40, 26]); }
    wallMask[cy * MW + cx] = 1;
  }
}

// the foehn: a washing floor of pale tiles under a hut with a big hot-air blower (the roof is on the top layer: you drive under it), low stone walls between the road
// and the lane, a signpost. The glow of the coils, the rotating blades and the shimmer are drawn while racing (ice.js)
function paintFoen(S, B) {
  const { MW, set, setT, walls, wallMask, washMask, ter } = S, { px, dk } = paintTools(S), [wx0, wy0, wx1, wy1] = B.wash;
  for (let y = wy0; y < wy1; y++) for (let x = wx0; x < wx1; x++) { const j = y * MW + x; if (ter[j] === 1) { washMask[j] = 1; set(j, ((x >> 2) + (y >> 2)) & 1 ? K.tileA : K.tileB); } }
  const low = (bx, by0, by1) => { // a low wall of grey stone blocks capped with snow
    for (let y = by0; y <= by1; y++) {
      for (let x = bx - 6; x <= bx + 5; x++) if (x === bx - 6 || x === bx + 5 || y === by0 || y === by1) dk(x + 3, y + 4, .8);
      for (let x = bx - 5; x <= bx + 4; x++) { const edge = x === bx - 5 || x === bx + 4 || y === by0 || y === by1; px(x, y, edge ? K.rockDD : (y % 9 === 0 || x === bx) ? K.rockD : x < bx - 1 ? K.rockL : K.rock); wallMask[y * MW + x] = 1; }
      if ((y - by0) % 6 === 0) walls.push({ x: bx, y, r: 5 });
    }
  };
  low(...B.wall); low(...B.wall2);
  // the hut: two pillars at the edges of the lane (solid), the snowy roof across (top layer) with the round vent of the blower, glowing coils at its front edge
  const wa0 = wx0 - 8, wa1 = wx1 + 8, ay0 = wy0 + 4, ay1 = ay0 + 15;
  for (const pxl of [wa0 + 3, wa1 - 3]) walls.push({ x: pxl, y: (ay0 + ay1) / 2, r: 5 });
  for (let y = ay1 + 1; y <= ay1 + 7; y++) for (let x = wa0 + 6; x <= wa1 - 6; x++) dk(x, y, .74); // (its shadow on the floor)
  roof(S, wa0, ay0, wa1 - wa0, ay1 - ay0);
  const cx = (wa0 + wa1) / 2, cy = (ay0 + ay1) / 2;
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const d = Math.hypot(dx, dy); if (d <= 6) setT(cx + dx, cy + dy, d > 5 ? K.rockDD : d > 4 ? K.rockL : d > 1.5 ? K.rockD : K.rockDD); }
  for (let x = wa0 + 6; x <= wa1 - 6; x++) { setT(x, ay1, K.red); setT(x, ay1 + 1, (x & 3) < 2 ? [255, 150, 60] : K.red); }
  // the signpost before the way in: a board with a flame
  const [sx, sy] = B.sign;
  walls.push({ x: sx, y: sy, r: 2 });
  for (let k = 0; k < 14; k++) setT(sx, sy - k, K.woodD);
  for (let yy = 0; yy < 9; yy++) for (let xx = -7; xx <= 7; xx++) setT(sx + xx, sy - 22 + yy, yy === 0 || yy === 8 || Math.abs(xx) === 7 ? K.woodD : [250, 240, 220]);
  for (const [dx, dy, c] of /** @type {Array<[number, number, number[]]>} */ ([[0, 0, [240, 90, 40]], [-1, 1, [240, 90, 40]], [1, 1, [240, 90, 40]], [0, 1, [255, 190, 60]], [0, 2, [255, 190, 60]], [-1, 3, [240, 90, 40]], [0, 3, [240, 90, 40]], [1, 3, [240, 90, 40]]])) setT(sx + dx, sy - 20 + dy, c);
}

// The mountains: every massif (def.blocks [x0, y0, x1, y1, round]), ridge (def.ridges [x0, y0, x1, y1, half width, cliff]) and cliff (def.klippen, half width 20)
// is a shape with a signed distance; they are melted into one rock (a smooth minimum: where two meet the rock grows a soft fillet instead of two walls
// overlapping), the outline is made ragged by noise (less on thin ridges, so they never get thin enough to drive through), and never reaches the road.
// The rock is shaded from its slope (light from the north-west: lit faces, faces in shade, layers), snow lies on the top and on the north faces, and it casts
// a bluish shadow to the south-east (long for cliffs). The solid circles follow the drawn outline (4 px inside it), so what you see is what stops you.
function* paintMountains(S) {
  const { MW, MH, def, d, set, walls, wallMask, ter, dist, sd } = S, A = MW * MH;
  const shapes = [
    ...def.blocks.map(([x0, y0, x1, y1, r = 10]) => {
      // (a massif at the edge of the map runs on beyond it, so its edge there does not show)
      const X0 = x0 <= 0 ? -40 : x0, Y0 = y0 <= 0 ? -40 : y0, X1 = x1 >= MW ? MW + 40 : x1, Y1 = y1 >= MH ? MH + 40 : y1, cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2, hx = (X1 - X0) / 2, hy = (Y1 - Y0) / 2;
      return { box: [X0, Y0, X1, Y1], w: 99, shade: 10, sd: (x, y) => { const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; } };
    }),
    ...[...def.ridges, ...def.klippen.map(k => [...k, 20, 1])].map(([x0, y0, x1, y1, w, cliff]) => {
      const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
      return { box: [Math.min(x0, x1) - w, Math.min(y0, y1) - w, Math.max(x0, x1) + w, Math.max(y0, y1) + w], w, shade: cliff ? 13 : 7,
        sd: (x, y) => { const t = clamp(((x - x0) * dx + (y - y0) * dy) / L2, 0, 1); return Math.hypot(x - x0 - dx * t, y - y0 - dy * t) - w; } };
    }),
  ];
  // the field: D = the smooth minimum of all shapes, dom = the shape that rules the pixel (its width and its shadow)
  const K2 = 12, PAD = 16, D = new Float32Array(A).fill(99), dom = new Uint8Array(A).fill(255);
  shapes.forEach((sh, k) => {
    const [x0, y0, x1, y1] = sh.box;
    for (let y = Math.max(0, Math.floor(y0 - PAD)); y <= Math.min(MH - 1, y1 + PAD); y++) for (let x = Math.max(0, Math.floor(x0 - PAD)); x <= Math.min(MW - 1, x1 + PAD); x++) {
      const j = y * MW + x, a = D[j], b = sh.sd(x + .5, y + .5), h = Math.max(K2 - Math.abs(a - b), 0) / K2;
      if (b < a) dom[j] = k;
      D[j] = Math.min(a, b) - h * h * K2 / 4;
    }
  });
  yield;
  // the ragged outline: big bulges and small notches (on a thin ridge at most 40 % of its half width), never on the road or its snow bank
  const R = new Uint8Array(A);
  for (let j = 0; j < A; j++) {
    if (D[j] > 9) continue;
    const x = j % MW, y = j / MW | 0, sh = shapes[dom[j]] || shapes[0], amp = clamp(sh.w * .4, 2, 7);
    D[j] += ((vnoise(x / 17, y / 17, sd + 60) - .5) * 2 * amp + (vnoise(x / 5, y / 5, sd + 61) - .5) * Math.min(3, amp));
    if (D[j] < 0 && dist[j] >= (S.RT.bob[S.near[j]] ? HALF + 8 : HALF + 2) && (ter[j] === 0 || ter[j] === POWDER || ter[j] === 2)) R[j] = 1; // (not over the ice walls of the bob run)
  }
  yield;
  // the rock: lit faces to the north-west, shade to the south-east, layers along the outline, a dark rim; snow on top where the rock is wide enough,
  // with a few dark outcrops, and on steep north faces
  const at = (x, y) => D[clamp(y, 0, MH - 1) * MW + clamp(x, 0, MW - 1)];
  for (let j = 0; j < A; j++) {
    if (j % 60000 === 59999) yield;
    if (!R[j]) continue;
    const x = j % MW, y = j / MW | 0, sh = shapes[dom[j]] || shapes[0], dep = -D[j], h = hash(x, y, sd + 63);
    let gx = at(x + 2, y) - at(x - 2, y), gy = at(x, y + 2) - at(x, y - 2); const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
    // (thin ridges are bare rock with snow only on the crest; wide rock has a band of cliff round it and snow fields above, lit or in shade by their slope,
    // with bare outcrops on the lower slopes)
    // (seen a little from the south: the faces to the south are high walls of rock, to the north the snow reaches almost to the edge)
    const lit = -.6 * gx - .8 * gy, cap = ((sh.w <= 8 ? sh.w * .8 : Math.min(8, sh.w * .5)) + (vnoise(x / 6, y / 6, sd + 62) - .5) * 3) * (gy > 0 ? 1 + gy * (sh.w > 8 ? 1.4 : .3) : 1 + gy * .45);
    let c;
    if (dep < 1.2) c = K.rockDD;
    else if (dep > cap) {
      const out = vnoise(x / 16, y / 16, sd + 64) * .75 + vnoise(x / 6, y / 6, sd + 65) * .25, contour = dep > 14 && (dep + vnoise(x / 20, y / 20, sd + 67) * 6) % 10 < .9 && h < .7;
      if (out > .66 && dep < 34) c = out < .68 ? K.rockDD : lit > .2 ? K.rockL : lit > -.3 ? K.rock : K.rockD;
      else c = dep < cap + 1.5 ? K.snowD : contour ? K.snowB : lit > .35 ? K.snow2 : lit > -.3 ? K.snow : K.snowB;
      if (h < .006) c = K.glit;
    } else {
      const layer = Math.floor((dep + vnoise(x / 9, y / 9, sd + 66) * 3) / 2.2) & 1;
      c = lit > .35 ? (layer ? K.rockL : K.rock) : lit > -.25 ? (layer ? K.rock : K.rockD) : (layer ? K.rockD : K.rockDD);
      if (gy < -.5 && dep > 2 && h < .12) c = K.snow2; // (snow sticks to the north faces)
      else if (h < .04) c = K.rockL;
    }
    set(j, c); wallMask[j] = 1;
  }
  yield;
  // the shadow on the snow: a bluish one to the south-east, as long as the rock is high (cliffs: long)
  for (let j = 0; j < A; j++) {
    if (j % 80000 === 79999) yield;
    if (R[j] || D[j] > 17) continue;
    const x = j % MW, y = j / MW | 0;
    for (let a = 1; a <= 13; a++) {
      const X = x - Math.round(a * .6), Y = y - a; if (X < 0 || Y < 0) break;
      const q = Y * MW + X; if (!R[q]) continue;
      if (a > (shapes[dom[q]] || shapes[0]).shade) break;
      const i = j * 4, k = a > 10 ? .1 : .2; d[i] *= 1 - k * 1.2; d[i + 1] *= 1 - k; d[i + 2] *= 1 - k * .5; break;
    }
  }
  yield;
  // the solid circles: on the pixels 2 to 5 px inside the outline that face open ground, at least 4.5 px apart (the edge of the map is no open ground)
  const free = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && !R[y * MW + x], G = new Map(), cell = 5;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (x === 0 && y % 300 === 299) yield;
    const j = y * MW + x; if (!R[j] || D[j] > -2) continue;
    if (!(free(x + 5, y) || free(x - 5, y) || free(x, y + 5) || free(x, y - 5) || free(x + 4, y + 4) || free(x - 4, y - 4) || free(x + 4, y - 4) || free(x - 4, y + 4))) continue;
    const cx = x / cell | 0, cy = y / cell | 0; let ok = true;
    for (let qy = cy - 1; qy <= cy + 1 && ok; qy++) for (let qx = cx - 1; qx <= cx + 1; qx++) { const L = G.get(qy * 1000 + qx); if (L && L.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < 20)) { ok = false; break; } }
    if (!ok) continue;
    const p = { x: x + .5, y: y + .5, r: 4 }; walls.push(p);
    const key = cy * 1000 + cx; (G.get(key) || G.set(key, []).get(key)).push(p);
  }
  return R;
}

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
    } else if (t === 2 && RT.deepM[j]) {
      // wind-blown deep snow: ripples across it, a soft pale edge to the powder
      let e = false; for (const q of [j - 2, j + 2, j - 2 * MW, j + 2 * MW]) if (q >= 0 && q < A && ter[q] !== 2) e = true;
      c = e ? K.snowB : Math.sin((x * .8 + y * .5) + vnoise(x / 10, y / 10, sd + 43) * 6) > .55 ? K.snow2 : v < .3 ? K.snow1 : K.snow;
    } else if (t === 1 || t === LIFT) {
      c = v < .33 ? K.road1 : v > .7 ? K.road2 : K.road;
      const inLane = RT.bay && RT.bay.lane[j], laneE = inLane && [-3, 3, -3 * MW, 3 * MW].some(o => ter[j + o] !== 1);
      if ((dist[j] > HALF - 3 && !inLane) || laneE) c = K.roadE; else if (Math.abs(dist[j] - 13) < 1.5 && h > .3) c = K.rut;
    } else if (t === 12) {
      if (RT.lakeM[j]) {
        // the rim (RIM px from the shore): thick, whitish ice with a snow edge, that never breaks; a darker line marks where it ends
        const rd = RT.lakeD[j]; let e = false; for (const q of [j - 1, j + 1, j - MW, j + MW]) if (q >= 0 && q < A && ter[q] !== 12) e = true;
        if (e) c = K.thickE; else if (rd <= 4) c = h < .5 ? K.snow2 : K.snow; else if (rd <= RIM) c = rd === RIM ? K.thickE : v < .35 ? K.thick1 : K.thick; else c = iceCol(x, y, h, true);
      }
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
  // ----- the mountains: the massifs, ridges and cliffs are one rock (plaene/EIS_REV2.md, meldungen 2026-10-24) -----
  yield* paintMountains(S);
  // the cornice along the foot of the face where the snowballs come loose: a ragged hanging edge of snow over the whole stretch
  { const { y0, x0: cx0, x1: cx1 } = def.balls;
    for (let x = cx0 - 20; x <= cx1 + 20; x++) { const h0 = 3 + 3 * vnoise(x * .08, 3, sd + 67) + (x < cx0 || x > cx1 ? -Math.abs(x < cx0 ? cx0 - x : x - cx1) * .2 : 0); for (let dy = -4; dy <= h0; dy++) px(x, y0 - 6 + dy, dy > h0 - 1 ? K.snowB : dy < 0 ? K.snow2 : K.snow); } }

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
  // ----- the chair lift: masts with a cross arm over the line (top layer), the two stations, the chess players under the line -----
  paintLift(S, def.lift, def.chess);
  yield;
  // ----- the climb: the slope is lighter at the top and falls into shade down the valley (the road climbs north along it) -----
  // (soft at all four edges, so that no rectangle shows)
  for (let y = 470; y < 1080; y++) for (let x = 470; x < 600; x++) { const j = y * MW + x; if (!wallMask[j]) dk(x, y, 1 - .13 * (y - 470) / 610 * Math.min(1, (x - 470) / 30, (600 - x) / 30, (y - 470) / 50, (1080 - y) / 50)); }
  paintFoen(S, def.bay);
  yield;
  // ----- the pines: a shadow on the snow, the crown on the top layer, the trunk is a solid circle (the cars in the air fly over the ones where the jump lands) -----
  const C = S.th.treeCol.map(hex);
  const pine = t => {
    walls.push(t); solid(t.x, t.y, 7);
    for (let dy = -11; dy <= 11; dy++) for (let dx = -11; dx <= 11; dx++) if (dx * dx + dy * dy <= 110) dk(t.x + dx + 5, t.y + dy + 7, .76);
    const rot = hash(t.x, t.y, sd + 90) * 6.28;
    for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
      const dd = Math.hypot(dx, dy), an = Math.atan2(dy, dx), rad = 9 + 3 * Math.abs(Math.cos(an * 4 + rot)), inner = 5 + 2 * Math.abs(Math.cos(an * 4 + rot + Math.PI / 4));
      if (dd > rad) continue;
      setT(t.x + dx, t.y + dy, dd < 2 ? C[2] : dd < inner ? ((dx + dy) < 0 ? C[2] : C[1]) : ((dx + dy) < -2 ? C[1] : C[0]));
    }
  };
  { for (const t of RT.trees) pine(t);
    // single pines out in the snow beside the mountains (only where they stand clear of the road and the rock)
    for (const [x, y] of def.pines || []) { const j = y * MW + x; if (ter[j] === 0 && dist[j] > HALF + 14 && !wallMask[j]) pine({ x, y, r: 7 }); }
    // a little joke: the "8" of the mock-up, two rings of snow logs on the ground between the trees (flat, you drive over it)
    if (def.eight) { const [ex, ey] = def.eight; for (const [cy, rr] of [[ey - 11, 10], [ey + 10, 12]]) for (let a = 0; a < 6.28; a += .06) { px(ex + Math.cos(a) * rr, cy + Math.sin(a) * rr, K.woodD); px(ex + Math.cos(a) * (rr - 1), cy + Math.sin(a) * (rr - 1), K.wood); px(ex + Math.cos(a) * (rr - 2), cy + Math.sin(a) * (rr - 2), K.woodL); } }
  }
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
  // the mountain hut at the top of the ski jump, decked out for Christmas: a log hut with a snowy roof (top layer), a wreath on the gable, a lit-up fir
  // beside it (the string lights on the eaves and the fir twinkle while racing, ice.js), a pair of skis leaning on the wall
  if (def.hut) {
    const [hx, hy] = def.hut, w = 44, h = 32, x0 = hx - w / 2, y0 = hy - h / 2;
    for (let y = y0 + 4; y < y0 + h + 7; y++) for (let x = x0 + 6; x < x0 + w + 7; x++) dk(x, y, .78);
    for (let y = y0 + h - 4; y < y0 + h + 4; y++) for (let x = x0 + 2; x < x0 + w - 2; x++) setT(x, y, y >= y0 + h + 2 ? K.woodD : (y + (x >> 3)) % 3 === 0 ? K.woodD : K.wood); // (the log wall under the eaves)
    roof(S, x0, y0, w, h - 3);
    for (let k = 0; k < 2; k++) for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 5; xx++) setT(x0 + 8 + k * 22 + xx, y0 + h + yy - 3, yy === 0 || xx === 0 || xx === 4 ? K.woodD : K.win);
    for (let a = 0; a < 6.28; a += .25) setT(hx + Math.cos(a) * 4, y0 + h + Math.sin(a) * 2 - 1, a % 1.5 < .3 ? K.red : [40, 120, 60]); // (the wreath)
    for (let yy = -4; yy <= 0; yy++) for (let xx = 0; xx < 5; xx++) setT(x0 + w - 11 + xx, y0 + 5 + yy, xx === 0 || xx === 4 ? [90, 60, 40] : [140, 90, 60]); // chimney
    for (let k = 0; k < 9; k++) { setT(x0 - 3, y0 + h - 12 + k, K.red); setT(x0 - 1, y0 + h - 12 + k, K.blue); } // (skis against the wall)
    for (let k = -w / 2 + 6; k <= w / 2 - 6; k += 8) for (const s of [-1, 1]) walls.push({ x: hx + k, y: hy + s * (h / 2 - 5), r: 7 });
    solid(hx, hy, w / 2 + 2);
    const [fx, fy] = def.hut.slice(2);
    pine({ x: fx, y: fy, r: 7 });
  }
  // the summit of the round mountain in the middle of the bob run: a wooden cross with a little shadow (top layer)
  if (def.summit) {
    const [cx, cy] = def.summit;
    for (let k = 0; k < 16; k++) dk(cx + 2 + k * .5, cy + 3 + k * .3, .7);
    for (let k = -12; k <= 4; k++) { setT(cx, cy + k, K.woodD); setT(cx + 1, cy + k, K.wood); }
    for (let k = -5; k <= 6; k++) { setT(cx + k, cy - 8, K.woodD); setT(cx + k, cy - 7, K.wood); }
    setT(cx - 1, cy + 5, K.rockDD); setT(cx + 2, cy + 5, K.rockDD);
  }
  // the snowball fight: two snowmen facing each other (the balls fly while racing, ice.js)
  for (const [x, y] of (def.snowfight || [])) snowman(x, y);
  if (def.snowfight) { const [[ax, ay], [bx, by]] = def.snowfight; for (let t = 0; t <= 1; t += .1) solid(ax + (bx - ax) * t, ay + (by - ay) * t, 14); } // (no other snowman in the line of fire)
  if (def.yeti) solid(def.yeti[0] - 8, def.yeti[1], 14); // (the place where the yeti peeks out stays free of other snowmen)
  yield;
  // more snowmen out in the snow
  const okOff = (x, y, m) => { for (let dy = -m; dy <= m; dy += 2) for (let dx = -m; dx <= m; dx += 2) { const X = x + dx, Y = y + dy; if (X < 2 || Y < 2 || X >= MW - 2 || Y >= MH - 2) return false; const j = Y * MW + X; if (ter[j] !== 0 || dist[j] < HALF + 10 || wallMask[j] || shore[j]) return false; } return true; };
  for (let k = 0, tries = 0; k < 6 && tries < 800; tries++) { const x = 8 + (S.r() * (MW - 16) | 0), y = 8 + (S.r() * (MH - 16) | 0); if (okOff(x, y, 9)) { snowman(x, y); k++; } }

  // the skiers waiting beside the in-run of the jump (drawn while racing; solid like the snowmen)
  for (const [x, y] of def.skiers || []) { walls.push({ x, y, r: 4 }); solid(x, y, 8); }
  return { jumps: RT.jumps, pushes: RT.pushes, alt: RT.alt, trees: RT.trees, lakeM: RT.lakeM, fieldM: RT.fieldM, lake: def.lake, lakeD: RT.lakeD, lift: def.lift, chess: def.chess, bay: RT.bay, foen: def.bay, serp: RT.serp, balls: def.balls, animals: def.animals,
    hut: def.hut, skiers: def.skiers, yeti: def.yeti, snowfight: def.snowfight };
}
