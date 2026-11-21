import { HALF, TAU, clamp, hash, hex, mk, vnoise } from './core.js';
import { nearestIdx, paintTools, startLine } from './bau.js';
import { stampWay } from './kit.js';
import { polyPts } from './volcanomap.js';

// ---------- Spielzimmer Rev 2 (plaene/SPIELZIMMER_REV2.md): the kids' room as a room. A toy car is a toy car here, the furniture is huge ----------
// Lap (clockwise): the printed road of the play mat (the start, north), the parquet corner, the wooden train on the parquet, then the fork:
// up the ramp of books ONTO the bed (duvet with folds that are little hills, the teddy, the two pillows at the head, the pillow throws you over the
// gap onto the desk) or UNDER the bed (dark, dust, boxes, lost toys, the monster plush; a long staircase of building blocks up onto the desk).
// Both meet on the desk (lined paper on the maple top, crayons, the eraser, the paint box with its clean way round it, the ruler as a bridge to
// the second table), down the marble run to the floor, through the building-block town on a big baseplate (an open field), past the toy car
// wash in its bay and onto the start straight.
// Terrain codes on the floor: 0 the pile of the rug, 1 road (the printed road, the swept floor under the bed, the desk, books, blocks, the ruler,
// the wash bay), 2 plasticine, 30 parquet (half as slippery as sheet ice), 32 watercolour (on the desk, it colours), 120 dust under the bed
// (like mud, grey), 121 the baseplate of the town (bumpy, full grip), 122 the swept floor under the bed (a little slower: low, dark), 123 the
// staircase of blocks (slow: you climb). Up on the bed the car reads the bed top instead (bedT: 0 duvet, 31 the
// soft way over it, 1 the pillows), because the bed lies over the floor under it (see toys.js: levels).
export const DUST = 120, PLATE = 121, FLOORU = 122, STEPS = 123, PARQUET = 30, BLANKET = 31, PAINT = 32;
// what a pixel is (kind): the level a car there can be on follows from it (toys.js)
export const KD = { FLOOR: 1, RUG: 2, BED: 3, DESK: 4, RAMP: 5, RULER: 6, TOWER: 7, STAIRS: 8, CITY: 9 };
// the side ways (wayM): under the bed (and its stairs), the wash bay, the clean way round the paint box
export const WAY = { UNDER: 1, BAY: 2, PAINT: 3 };

// (an object literal: its fields stay fast to read in the loops over every pixel)
const K = {
  pq0: hex('#c99460'), pq1: hex('#bf8a56'), pq2: hex('#d39e6a'), pq3: hex('#b98250'), pqS: hex('#7a4e2c'), pqG: hex('#ad7a48'), tape: hex('#efe6c8'), tapeD: hex('#cfc29c'),
  wall: hex('#e8dcc0'), wallP: hex('#dccfae'), wallD: hex('#c4b48e'), skirt: hex('#f4efe4'), skirtD: hex('#a89e88'),
  rug: hex('#6fb85e'), rug1: hex('#64ac54'), rug2: hex('#7cc46a'), rugE: hex('#3f7a36'), rugE2: hex('#548f48'), fringe: hex('#efe2c0'),
  street: hex('#a5c29c'), streetL: hex('#c8dcc2'), pond: hex('#8fc4dc'), pondD: hex('#6aa6c4'), ptree: hex('#4f9a46'), ptreeL: hex('#6cb85e'), phouse: hex('#e0b890'), proof: hex('#c8705e'),
  road: hex('#686e78'), road1: hex('#61666f'), road2: hex('#727882'), roadE: hex('#f4f4ee'), zebra: hex('#f0f0ea'),
  frame: hex('#8a5a32'), frameL: hex('#b07a48'), frameD: hex('#4e3018'), post: hex('#9a6638'),
  duv: hex('#3f6fc0'), duv1: hex('#3765b2'), duv2: hex('#4a7ccc'), duvL: hex('#6c9ce0'), duvD: hex('#2a4c8e'), duvS: hex('#2f5aa4'), star: hex('#ffe58a'), starD: hex('#e8c45a'), moon: hex('#fff4c8'),
  path: hex('#8fb4ea'), path1: hex('#82a8e2'), pathE: hex('#f2f6ff'), stitch: hex('#ffffff'),
  sheet: hex('#f6f4ee'), sheetD: hex('#dcd8ce'), pil: hex('#fbfbf8'), pil1: hex('#eceae2'), pilS: hex('#c8c4b8'), pilD: hex('#a8a498'), pilL: hex('#ffffff'), pilP: hex('#f3c6cf'),
  face: hex('#2f5aa4'), faceD: hex('#1e3c74'), faceL: hex('#4a7ccc'),
  under: hex('#4a3a2c'), under1: hex('#40322a'), underL: hex('#5a4834'), dust: hex('#9a948c'), dust1: hex('#b8b2a8'), dustD: hex('#7a746c'),
  box: hex('#c8a070'), boxD: hex('#8a6a40'), boxL: hex('#e0bc88'), tapeB: hex('#d8c8a0'),
  wood0: hex('#e2c08e'), wood1: hex('#d8b482'), wood2: hex('#ead09e'), woodG: hex('#c49a64'), woodE: hex('#9a6e3e'), woodF: hex('#a87a48'), woodFD: hex('#6a4628'), leg: hex('#5a3a1e'),
  paper: hex('#fbfaf4'), paperL: hex('#c6dbf0'), paperM: hex('#f0a8a8'), pencil: hex('#55555f'), paperE: hex('#d8d4c6'),
  pages: hex('#f6eedc'), pagesD: hex('#d8ccb0'), ruler: hex('#f4cc4c'), rulerL: hex('#fadc7a'), rulerD: hex('#b88a20'), tick: hex('#3a2a10'),
  rail: hex('#e8c890'), railL: hex('#f4dcae'), railD: hex('#b8945e'), groove: hex('#8a6a40'),
  hull: hex('#ececf0'), hullD: hex('#9a9aa6'), dark: hex('#2a2a32'), ink: hex('#1b120c'),
  plate: hex('#4aa85a'), plateL: hex('#66c474'), plateD: hex('#327c40'), arrow: hex('#f4f4ee'),
  bay: hex('#a8d4f0'), bay1: hex('#b8dcf4'), bayS: hex('#5a9ac8'),
};
// plasticine and watercolour: main, dark, light
const COLS = [['#e04848', '#a02a2a', '#ff8a7a'], ['#3c6ee0', '#24449a', '#8ab0ff'], ['#f2cc30', '#b8920e', '#fff08a'], ['#40b850', '#24803a', '#9ae49a']].map(a => a.map(hex));
const BOOKS = [['#d84a4a', '#a83434'], ['#4a7ad8', '#3458a8'], ['#4ab86a', '#348a4e'], ['#e8b83a', '#b88a20'], ['#9a5ad0', '#6e3aa0']].map(a => a.map(hex));
const BLOCKS = ['#e84a4a', '#3c78e0', '#f2c230', '#40b050', '#f08a2a', '#d8b48a'].map(hex);

const inR = (r, x, y) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3];
// a rectangle with rounded corners
const inRR = (r, x, y, q) => {
  if (!inR(r, x, y)) return false;
  const dx = Math.max(r[0] + q - x, 0, x - (r[2] - q)), dy = Math.max(r[1] + q - y, 0, y - (r[3] - q));
  return dx * dx + dy * dy <= q * q;
};
const shade = (c, k) => [Math.min(255, c[0] * k) | 0, Math.min(255, c[1] * k) | 0, Math.min(255, c[2] * k) | 0];
const mixC = (a, b, f) => [a[0] + (b[0] - a[0]) * f | 0, a[1] + (b[1] - a[1]) * f | 0, a[2] + (b[2] - a[2]) * f | 0];
// the train loop: a point on the ellipse and the length of its tangent (for steps of equal length)
export const loopAt = (L, th) => ({ x: L[0] + Math.cos(th) * L[2], y: L[1] + Math.sin(th) * L[3] });
export const loopSpeed = (L, th) => Math.hypot(L[2] * Math.sin(th), L[3] * Math.cos(th)) || 1;

// a side way: its points (every 2 px), and for each the index of the centre line it counts as (from where it leaves to where it comes back)
function wayOf(P, path, N, id) {
  const pts = polyPts(P), i0 = nearestIdx(path, P[0][0], P[0][1]), i1 = nearestIdx(path, P[P.length - 1][0], P[P.length - 1][1]), span = (i1 - i0 + N) % N;
  return { id, P: pts.map((p, k) => ({ x: p.x, y: p.y, i: (i0 + Math.round(span * k / Math.max(1, pts.length - 1))) % N })), i0, i1 };
}

// terrain, before the ground is painted. S: { MW, MH, def, ter, dist, near, path, tan, nrm, N }
export function* toyTerrain(S) {
  const { MW, MH, def, ter, dist, near, path, N } = S, A = MW * MH;
  const kind = new Uint8Array(A), upM = new Uint8Array(A), alt = new Uint8Array(A), wayM = new Uint8Array(A), hM = new Uint8Array(A), wayD = new Uint8Array(A);
  const ix = p => nearestIdx(path, p[0], p[1]);
  const bed = def.bed, [TA, TB] = def.desk, [tx, ty, tr] = def.tower, [rx, rh] = def.ruler, U = def.under, city = def.city.box;
  const rampA = ix(def.ramp[0]), rampB = ix(def.ramp[1]), lipI = ix(def.lip), t0 = ix([tx + tr, ty]), t1 = ix([tx - tr, ty]);
  const [sx, sy0, sy1] = U.stairs;
  yield;
  const kindRows = (ya, yb) => { for (let y = ya; y < yb; y++) for (let x = 0; x < MW; x++) {
    const j = y * MW + x, road = dist[j] < HALF, i = near[j];
    let k = KD.FLOOR, t = PARQUET;
    if (inRR(def.rug, x, y, 18)) { k = KD.RUG; t = road ? 1 : 0; }
    if (inR(city, x, y)) { k = KD.CITY; t = PLATE; alt[j] = 1; }
    if (inR(bed, x, y)) { k = KD.BED; t = DUST; upM[j] = 1; }
    else if (inR(TA, x, y) || inR(TB, x, y)) { k = KD.DESK; t = 1; upM[j] = 1; }
    else if (y >= TA[3] && y < TB[1] && Math.abs(x + .5 - rx) < rh) { k = KD.RULER; t = 1; upM[j] = 1; }
    else if ((road && i >= t0 - 10 && i <= t1 + 2) || Math.hypot(x + .5 - tx, y + .5 - ty) < tr) { k = KD.TOWER; t = 1; upM[j] = 1; }
    else if (dist[j] < HALF + 3 && i >= rampA - 1 && i <= rampB + 1) { k = KD.RAMP; t = 1; upM[j] = 1; hM[j] = clamp(Math.round(100 * (i - rampA) / Math.max(1, rampB - rampA)), 0, 100); }
    // the floor under and between the desk tables: nobody gets there (a car that falls off the desk is set back on it), no way for anybody
    if (k === KD.FLOOR && x >= TA[0] - 12 && y >= TA[3] && y < TB[3] + 24) t = 11;
    kind[j] = k; ter[j] = t;
  } };
  for (let y = 0; y < MH; y += 40) { kindRows(y, Math.min(MH, y + 40)); yield; }
  yield;
  // plasticine: blobs that grow in from the edge of the way (the town's alleys), never across the whole of it
  for (const [px, py, pr] of def.knete) for (let y = Math.floor(py - pr * 1.4); y <= py + pr * 1.4; y++) for (let x = Math.floor(px - pr * 1.4); x <= px + pr * 1.4; x++) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    const j = y * MW + x; if (kind[j] !== KD.CITY && kind[j] !== KD.RUG && kind[j] !== KD.FLOOR) continue;
    if (Math.hypot(x + .5 - px, (y + .5 - py) * 1.15) < pr * (.8 + .45 * vnoise(x * .18, y * .18, 161))) ter[j] = 2;
  }
  // under the bed: dust everywhere, a swept way through it (the side way), dust lying in the inside of its bends; the staircase of blocks
  const under = wayOf(U.pts, path, N, WAY.UNDER);
  stampWay(U.pts, U.half, (j, d) => {
    const x = j % MW, y = j / MW | 0; wayD[j] = Math.round(U.half - d);
    if (kind[j] === KD.DESK || kind[j] === KD.TOWER) { wayM[j] = WAY.UNDER; alt[j] = 1; return; }
    wayM[j] = WAY.UNDER; alt[j] = 1;
    if (y >= sy0 && y < sy1 && Math.abs(x + .5 - sx) < U.half) { kind[j] = KD.STAIRS; ter[j] = STEPS; upM[j] = 1; hM[j] = clamp(Math.round(125 * (y - sy0) / (sy1 - sy0)), 0, 125); return; }
    if (kind[j] === KD.BED) { ter[j] = d > U.half - 4 && hash(x, y, 162) < .5 ? DUST : FLOORU; return; }
    if (ter[j] !== 2) ter[j] = kind[j] === KD.RUG ? 1 : PARQUET;
  }, MW, MH);
  for (const [px, py, pr] of U.dust) for (let y = Math.floor(py - pr - 4); y <= py + pr + 4; y++) for (let x = Math.floor(px - pr - 4); x <= px + pr + 4; x++) {
    const j = y * MW + x; if (wayM[j] !== WAY.UNDER || kind[j] !== KD.BED) continue;
    if (Math.hypot(x + .5 - px, y + .5 - py) < pr * (.75 + .5 * vnoise(x * .2, y * .2, 163))) ter[j] = DUST;
  }
  yield;
  // the wash bay beside the last bend, the clean way round the paint box on the desk (both side ways), the watercolour on the desk
  const bay = wayOf(def.bay.pts, path, N, WAY.BAY), paintW = wayOf(def.paintFork.pts, path, N, WAY.PAINT);
  stampWay(def.bay.pts, def.bay.half, (j, d) => { wayD[j] = Math.round(def.bay.half - d); wayM[j] = WAY.BAY; alt[j] = 1; ter[j] = 1; }, MW, MH);
  stampWay(def.paintFork.pts, def.paintFork.half, j => { if (kind[j] === KD.DESK && dist[j] >= HALF) { wayM[j] = WAY.PAINT; alt[j] = 1; } }, MW, MH);
  for (const [px, py, pr] of def.paints) for (let y = Math.floor(py - pr - 3); y <= py + pr + 3; y++) for (let x = Math.floor(px - pr - 3); x <= px + pr + 3; x++) {
    const j = y * MW + x; if (kind[j] !== KD.DESK || wayM[j]) continue;
    if (Math.hypot(x + .5 - px, (y + .5 - py) * 1.3) < pr + (vnoise(x * .25, y * .25, 141) - .5) * 5) ter[j] = PAINT;
  }
  // the top of the bed (what a car up there drives on): the pillows, the soft way over the duvet, the duvet
  const BW = bed[2] - bed[0], BH = bed[3] - bed[1], bedT = new Uint8Array(BW * BH);
  for (let y = bed[1]; y < bed[3]; y++) for (let x = bed[0]; x < bed[2]; x++) {
    const j = y * MW + x, q = (y - bed[1]) * BW + x - bed[0];
    bedT[q] = def.pillows.some(p => inR(p, x, y)) || x >= def.sheet ? 1 : dist[j] < HALF ? BLANKET : 0;
  }
  return { kind, upM, alt, wayM, wayD, hM, bedT, ways: [under, bay, paintW], rampA, rampB, lipI, t0, t1 };
}

// painting, after the ground. S: { MW, MH, def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, sd, RT }
export function* paintToys(S) {
  const { MW, MH, def, set, setT, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, sd, RT } = S, kind = RT.kind;
  const { px, dk, off } = paintTools(S);
  const block = (x, y, rr) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X >= 0 && Y >= 0 && X < MW && Y < MH) wallMask[Y * MW + X] = 1; } };
  const edgeOf = (j, t) => ter[j - 1] !== t || ter[j + 1] !== t || ter[j - MW] !== t || ter[j + MW] !== t;
  // a box on the ground with a shadow to the bottom right (solid things cast one, flat decoration does not); the light comes from the window (top left)
  const shadowRect = (x0, y0, w, h, ox, oy, k = .66) => { for (let y = y0 + oy; y < y0 + h + oy; y++) for (let x = x0 + ox; x < x0 + w + ox; x++) if (!(x >= x0 && x < x0 + w && y >= y0 && y < y0 + h)) dk(x, y, k); };
  const shadowDisc = (cx, cy, rr, ox, oy, k = .66) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) if (dx * dx + dy * dy <= rr * rr && (dx - ox) ** 2 + (dy - oy) ** 2 > rr * rr) dk(cx + dx, cy + dy, k); };
  const wallsRect = (x0, y0, w, h, r, o = {}) => { for (let y = y0 + r; y <= y0 + h - r + .1; y += r * 1.4) for (let x = x0 + r; x <= x0 + w - r + .1; x += r * 1.4) walls.push({ x, y, r, ...o }); block(x0 + w / 2, y0 + h / 2, Math.max(w, h) / 2 + 4); };
  const disc = (cx, cy, rr, f, put = px) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const dd = Math.hypot(dx, dy); if (dd <= rr) { const c = f(dd, dx, dy); if (c) put(cx + dx, cy + dy, c); } } };
  const bed = def.bed, [bx0, by0, bx1, by1] = bed, [TA, TB] = def.desk, [rx, rh] = def.ruler, U = def.under, [sx, sy0, sy1] = U.stairs, city = def.city.box;
  const FACE = 14, BFACE = 18, zi = nearestIdx(path, def.zebra[0], def.zebra[1]);
  const plateAt = (x, y) => { const u = (x - city[0]) % 10, v = (y - city[1]) % 10, du = u - 4.5, dv = v - 4.5, dd = du * du + dv * dv; return x - city[0] < 3 || city[2] - 1 - x < 3 || y - city[1] < 3 || city[3] - 1 - y < 3 ? K.plateD : dd < 6 ? (du + dv < -1 ? K.plateL : du + dv > 1.5 ? K.plateD : K.plate) : dd < 9 && du + dv > 0 ? K.plateD : K.plate; };
  // a smooth wobble for the grain of the wood, made once (a noise call per pixel would be slow)
  const GT = new Float32Array(4096); for (let k = 0; k < 4096; k++) GT[k] = vnoise(k / 9, 3.3, sd + 45);
  const kneteUnder = new Map(), PQ = [K.pq0, K.pq1, K.pq2, K.pq3], WD = [K.wood0, K.wood1, K.wood2]; // (what lies under the plasticine: the robot sucks it up, toys.js)
  const plank = (x, y) => { const row = (y - 24) / 40 | 0, sh = (row * 131) % 300, u = (x + sh) % 300, id = hash((x + sh) / 300 | 0, row, sd + 44); return { row, u, v: (y - 24) % 40, id }; };

  yield;
  // ----- the ground: parquet (wide oak planks), the play mat with its printed town and road, the floor under the bed, the desk, the ramp of
  // books, the ruler, the stairs of blocks, the baseplate of the town, the walls of the room -----
  const groundRows = (ya, yb) => { for (let y = ya; y < yb; y++) for (let x = 0; x < MW; x++) {
    const j = y * MW + x, t = ter[j], kd = kind[j], road = dist[j] < HALF, i = near[j];
    let c;
    if (t === 2) {
      // plasticine: squashed flat, a darker rim, fingerprints shine
      const P = COLS[def.knete[nearestKnete(def.knete, x, y)][3]], h = hash(x, y, sd + 46);
      c = edgeOf(j, 2) ? P[1] : h < .06 ? P[2] : ((x >> 2) + (y >> 2)) % 5 === 0 ? shade(P[0], .92) : P[0];
      if (kd === KD.CITY) kneteUnder.set(j, plateAt(x, y));
    } else if (kd === KD.BED) {
      // under the bed: the floor in the shade, grey dust in fluffy lumps, the swept way a little lighter (the bed itself is a picture of its own, toys.js)
      const p = plank(x, y), h = hash(x, y, sd + 48);
      c = p.v === 0 || p.u === 0 ? K.pqS : PQ[(p.id * 4) | 0];
      if (t === DUST) {
        // grey fluff in lumps (dust bunnies), a soft light rim on them
        const lump = vnoise(x / 11, y / 11, sd + 53), v = (lump * 7 + h) % 1;
        c = lump > .58 ? (v > .5 ? K.dust1 : K.dust) : v > .62 ? K.dust : v < .3 ? K.dustD : mixC(c, K.dust, .6);
        if (h < .05) c = K.dust1;
      }
      c = shade(c, t === DUST ? .78 : RT.wayM[j] === WAY.UNDER ? .85 : .5);
      if (t !== DUST && RT.wayM[j] === WAY.UNDER && RT.wayD[j] >= 1 && RT.wayD[j] <= 3) c = shade(K.tape, .7);
    } else if (kd === KD.DESK) {
      // the desk: maple boards; the road a long strip of lined paper with pencil edges
      const r0 = inR(TA, x, y) ? TA : TB, e = Math.min(x - r0[0], r0[2] - 1 - x, y - r0[1], r0[3] - 1 - y), bd = (y - r0[1]) / 46 | 0;
      c = WD[(hash(bd, 5, sd) * 3) | 0];
      if ((y - r0[1]) % 46 === 0) c = K.woodG; else if ((y - r0[1] + GT[((x >> 3) + bd * 300) & 4095] * 12) % 7 < .8) c = shade(c, .92);
      if (e < 3) c = e < 1 ? K.woodE : K.wood2; // a light bevel along the edge of the top
      const way = RT.wayM[j];
      if ((road || way) && e >= 3 && t !== PAINT) {
        c = (y + 2) % 6 === 0 ? K.paperL : K.paper;
        if (Math.abs(x - 1210) < 1 && road) c = K.paperM;
        if (road && !way && dist[j] > HALF - 2.5) c = dist[j] > HALF - 1 ? K.paperE : K.pencil;
        if (way === WAY.PAINT && !road) { let rim = false; for (const q of [-2, 2, -2 * MW, 2 * MW]) if (RT.wayM[j + q] !== WAY.PAINT && !(dist[j + q] < HALF)) rim = true; if (rim) c = K.pencil; }
      } else if (t === PAINT) {
        const P = COLS[def.paints[nearestKnete(def.paints, x, y)][3]];
        c = edgeOf(j, PAINT) ? P[1] : vnoise(x / 4, y / 2, sd + 47) > .7 ? P[2] : mixC(P[0], [255, 255, 255], .15);
      }
    } else if (kd === KD.RAMP) {
      // the ramp: books lying on top of each other, each one a step higher; the pages show at the front of every book, the top one lightest
      const a = (i - RT.rampA) * 2, bk = Math.max(0, a / 34 | 0), fr = a - bk * 34, B = BOOKS[bk % BOOKS.length], o = Math.abs(off(j)), lit = .86 + RT.hM[j] / 100 * .22;
      c = o > HALF ? B[1] : fr < 4 ? K.pagesD : fr < 8 ? ((y % 2) ? K.pages : K.pagesD) : B[0];
      if (fr >= 8 && (Math.abs(o - 14) < 1 || Math.abs(o - 22) < .7)) c = shade(B[0], 1.18);
      c = shade(c, lit);
    } else if (kd === KD.RULER) {
      // the ruler: yellow, a tick every millimetre-ish, longer ones every 5 and 10
      const q = x + .5 - (rx - rh), yy = y - TA[3];
      c = q < 1.2 || q > rh * 2 - 1.2 ? K.rulerD : (q < 4 && yy % 3 === 0) || (q < 7 && yy % 15 === 0) || (q < 10 && yy % 30 === 0) ? K.tick : vnoise(x / 2, y / 30, sd + 48) > .7 ? K.rulerL : K.ruler;
    } else if (kd === KD.STAIRS) {
      // the staircase: big wooden blocks, a step every 17 px, each a little lighter (higher); the edge of every step catches the light
      const st = (y - sy0) / 17 | 0, sv = (y - sy0) % 17, B = BLOCKS[(st + 2) % BLOCKS.length], ox = Math.abs(x + .5 - sx);
      c = ox > U.half - 2 ? shade(B, .5) : sv < 2 ? shade(B, 1.3) : sv > 14 ? shade(B, .72) : (x - sx + 40) % 20 === 0 ? shade(B, .8) : B;
      c = shade(c, .8 + .3 * st / 5);
    } else if (kd === KD.TOWER) {
      c = K.woodF;
    } else if (kd === KD.CITY && RT.wayM[j] !== WAY.BAY) {
      // the baseplate: green with studs in a grid, painted white arrows along the way (see below)
      c = plateAt(x, y);
    } else if (RT.wayM[j] === WAY.BAY) {
      c = (x + y) % 2 ? K.bay : K.bay1;
      if (dist[j] >= HALF && (x - 4) % 12 === 0) c = K.bayS;
    } else if (kd === KD.RUG) {
      // the play mat: green felt with a printed town (pale side streets, houses, trees, a pond) and the printed road of the race
      const [ux0, uy0, ux1, uy1] = def.rug, h = hash(x, y, sd + 43), e = Math.min(x - ux0, ux1 - 1 - x, y - uy0, uy1 - 1 - y);
      c = h < .3 ? K.rug1 : h > .82 ? K.rug2 : K.rug;
      for (const [sx0, sy0_, sx1, sy1_] of def.streets) if (x >= sx0 && x <= sx1 && y >= sy0_ && y <= sy1_) c = (sx1 - sx0 > sy1_ - sy0_ ? Math.abs(y - (sy0_ + sy1_) / 2) < 1 && x % 14 < 7 : Math.abs(x - (sx0 + sx1) / 2) < 1 && y % 14 < 7) ? K.streetL : K.street;
      for (const [qx, qy, w, hh] of def.prints) if (x >= qx && x < qx + w && y >= qy && y < qy + hh) c = y < qy + hh * .55 ? K.proof : (x - qx) % 8 < 3 && (y - qy) % 8 < 3 ? K.pond : K.phouse;
      for (const [qx, qy, qr] of def.ptrees) { if (Math.abs(x - qx) >= qr || Math.abs(y - qy) >= qr) continue; const dd = Math.hypot(x - qx, y - qy); if (dd < qr) c = dd < qr * .55 && x + y < qx + qy ? K.ptreeL : K.ptree; }
      { const [qx, qy, qa, qb] = def.ppond; if (Math.abs(x - qx) < qa && Math.abs(y - qy) < qb) { const e2 = ((x - qx) / qa) ** 2 + ((y - qy) / qb) ** 2; if (e2 < 1) c = e2 > .75 ? K.pondD : K.pond; } }
      if (e < 6) c = e < 2 ? K.rugE : K.rugE2;
      if (road && t === 1 && RT.wayM[j] !== WAY.UNDER) {
        const v = hash(x >> 1, y >> 1, sd + 45);
        c = v < .3 ? K.road1 : v > .8 ? K.road2 : K.road;
        if (dist[j] > HALF - 3.5 && dist[j] < HALF - 1.5) c = K.roadE; else if (dist[j] >= HALF - 1.5) c = K.rugE;
        else if (Math.abs(off(j)) < 1.3 && i % 14 < 7) c = K.roadE;
        const z = (i - zi + N) % N; if (z < 12 && dist[j] < HALF - 4 && Math.floor(off(j) + 40) % 8 < 4) c = K.zebra;
      }
    } else {
      // parquet: wide oak planks, staggered, with grain; on the road two strips of masking tape and dashes in the middle
      const p = plank(x, y);
      c = PQ[(p.id * 4) | 0];
      if ((p.v + GT[((p.u >> 2) + (p.id * 1000 | 0)) & 4095] * 14) % 8 < .7) c = K.pqG;
      if (p.v === 0 || p.u === 0) c = K.pqS;
      if (road || RT.wayM[j] === WAY.UNDER) {
        const dd = road ? dist[j] : 99, wd = RT.wayD[j];
        if ((dd > HALF - 5 && dd < HALF - 1) || (!road && wd >= 1 && wd <= 4)) c = (x + y) % 5 ? K.tape : K.tapeD;
        else if (road && Math.abs(off(j)) < 1.4 && i % 18 < 9) c = K.tape;
      }
      // the fringe at both short ends of the rug
      const [ux0, uy0, ux1, uy1] = def.rug;
      if (y > uy0 + 4 && y < uy1 - 4 && ((x >= ux0 - 7 && x < ux0) || (x >= ux1 && x < ux1 + 7)) && y % 3 === 0) c = K.fringe;
    }
    // the walls of the room: wallpaper along the top (we look at it a little from the front), a skirting board all round
    const e = Math.min(x, y, MW - 1 - x, MH - 1 - y);
    if (y < 18) c = y > 14 ? K.wallD : ((x >> 3) + (y >> 2)) % 7 === 0 ? K.wallP : (x % 24 < 2 ? K.wallP : K.wall);
    else if (e < 24) c = e > 21 ? K.skirtD : e < 2 ? K.skirtD : K.skirt;
    set(j, c);
  } };
  for (let y = 0; y < MH; y += 24) { groundRows(y, Math.min(MH, y + 24)); yield; }
  yield;
  // the baseplate: white arrows painted along the way through the town (which way the lap goes)
  for (let i = 0; i < N; i += 2) {
    const p = path[i]; if (!inR(city, p.x, p.y) || (i / 2) % 45 !== 0) continue;
    const tg = tan[i], nm = nrm[i];
    for (let a = -10; a <= 10; a += .5) for (let b = -9; b <= 9; b += .5) {
      const head = a > 2 && Math.abs(b) < (10 - a) * 1.1, shaft = a <= 2 && a >= -10 && Math.abs(b) < 2.5;
      if ((head || shaft) && ter[Math.round(p.y + tg.y * a + nm.y * b) * MW + Math.round(p.x + tg.x * a + nm.x * b)] !== 2) px(p.x + tg.x * a + nm.x * b, p.y + tg.y * a + nm.y * b, K.arrow);
    }
  }
  // the start line (chequered)
  startLine(S);

  yield;
  // ----- the bed casts its shadow on the floor (south and east of it: the light comes from the window), the desk its own; the faces of the
  // desk tables with their legs -----
  for (let y = by1 + BFACE; y < by1 + BFACE + 18; y++) for (let x = bx0 + 8; x < bx1 + 4; x++) if (kind[y * MW + x] !== KD.DESK && kind[y * MW + x] !== KD.STAIRS) dk(x, y, .6 + .3 * (y - by1 - BFACE) / 18);
  for (const q of [TA, TB]) {
    for (let y = q[3]; y < q[3] + FACE && y < MH; y++) for (let x = q[0]; x < q[2]; x++) {
      const k = kind[y * MW + x]; if (k === KD.RULER || k === KD.TOWER) continue;
      px(x, y, y - q[3] > FACE - 3 ? K.woodFD : (x - q[0]) % 46 === 0 ? K.woodFD : y - q[3] < 2 ? K.woodE : K.woodF);
    }
    // legs at the front corners and in the middle, the shadow behind the face
    for (const lx of [q[0] + 4, q[2] - 16, (q[0] + q[2]) / 2 | 0]) for (let y = q[3] + FACE; y < q[3] + FACE + 10; y++) for (let x = lx; x < lx + 12; x++) { const k = kind[y * MW + x]; if (k === KD.FLOOR || k === KD.RUG || k === KD.CITY) px(x, y, x - lx < 3 ? K.woodF : K.leg); }
    for (let y = q[3] + FACE; y < q[3] + FACE + 14 && y < MH; y++) for (let x = q[0] + 6; x < q[2] + 12; x++) { const k = kind[y * MW + x]; if (k === KD.FLOOR || k === KD.RUG || k === KD.CITY) dk(x, y, .62 + .25 * (y - q[3] - FACE) / 14); }
  }
  // the floor between the bed and the desk lies deep in their shade; the floor right behind a table top and beside it is darker (the top is high)
  for (let y = by1 + BFACE; y < TA[1]; y++) for (let x = bx0; x < TA[2]; x++) if (kind[y * MW + x] === KD.FLOOR) dk(x, y, .7);
  for (const q of [TA, TB]) {
    for (let x = q[0]; x < q[2]; x++) for (let y = q[1] - 4; y < q[1]; y++) { const k = kind[y * MW + x]; if (k === KD.FLOOR || k === KD.RUG || k === KD.CITY) dk(x, y, .5 + .1 * (q[1] - y)); }
    for (let y = q[1]; y < q[3] + FACE; y++) for (let x = q[0] - 4; x < q[0]; x++) { const k = kind[y * MW + x]; if (k === KD.FLOOR || k === KD.RUG || k === KD.CITY) dk(x, y, .5 + .1 * (q[0] - x)); }
  }
  // the ramp of books seen from its side (south): the books lie on top of each other, the stack grows towards the bed, its shadow lies beside it
  for (let i = RT.rampA; i <= RT.rampB; i++) {
    const p = path[i], n = nrm[i], f = (i - RT.rampA) / Math.max(1, RT.rampB - RT.rampA), H = Math.round(4 + 16 * f), bk = Math.max(0, (i - RT.rampA) * 2 / 34 | 0);
    for (let k = 0; k < H + 10; k++) {
      const x = Math.round(p.x + n.x * (HALF + 1 + k)), y = Math.round(p.y + n.y * (HALF + 1 + k)), kk = kind[y * MW + x]; if (kk !== KD.FLOOR && kk !== KD.RUG) continue;
      if (k >= H) { dk(x, y, .62 + .03 * (k - H)); continue; }
      const layer = (H - 1 - k) / 4 | 0, B = BOOKS[(Math.min(layer, bk) + 1) % BOOKS.length];
      px(x, y, (H - 1 - k) % 4 === 0 ? K.pagesD : layer > bk ? shade(B[1], .7) : (H - 1 - k) % 4 === 3 ? shade(B[0], .8) : B[1]);
    }
  }

  yield;
  // ----- the wooden train: a loop of beech track with two grooves, joints every 40 px, a little station at the top -----
  const L = def.train, cross = [];
  for (let th = 0, s = 0; th < TAU; th += .6 / loopSpeed(L, th), s += .6) {
    const p = loopAt(L, th), nx = Math.cos(th) / L[2], ny = Math.sin(th) / L[3], nl = Math.hypot(nx, ny), joint = s % 40 < 1.2;
    for (let o = -6.5; o <= 6.5; o += .5) {
      const ao = Math.abs(o);
      px(p.x + nx / nl * o, p.y + ny / nl * o, joint && ao < 5.5 ? K.railD : ao > 5.6 ? K.railD : Math.abs(ao - 3) < .7 ? K.groove : ao < 1 ? K.railL : K.rail);
    }
    const j = Math.round(p.y) * MW + Math.round(p.x);
    if (dist[j] < 3 && !cross.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 40)) cross.push({ th, x: p.x, y: p.y, i: near[j] });
  }
  for (let th = 0; th < TAU; th += .02) { const p = loopAt(L, th); dk(p.x + 4, p.y + 5, .9); }
  { const [qx, qy] = def.station; shadowRect(qx - 22, qy - 10, 45, 21, 3, 4);
    for (let y = qy - 10; y <= qy + 10; y++) for (let x = qx - 22; x <= qx + 22; x++) { const e = Math.min(x - qx + 22, qx + 22 - x, y - qy + 10, qy + 10 - y); setT(x, y, e < 1 ? K.woodFD : y < qy - 2 ? (((x + 40) >> 2) & 1 ? COLS[0][0] : COLS[0][2]) : e < 3 ? K.woodF : K.wood2); }
    wallsRect(qx - 22, qy - 10, 45, 21, 5); }

  yield;
  // ----- under the bed (the floor painted above is in the shade): cardboard boxes along the swept way, lost toys, a sock, the monster plush -----
  for (const [qx, qy, w, h] of U.boxes) {
    for (let y = qy; y < qy + h; y++) for (let x = qx; x < qx + w; x++) {
      const e = Math.min(x - qx, qx + w - 1 - x, y - qy, qy + h - 1 - y);
      px(x, y, shade(e < 1 ? K.boxD : Math.abs(x - qx - w / 2) < 4 ? K.tapeB : e < 3 ? K.boxL : K.box, .8));
    }
    for (let x = qx; x < qx + w; x += 6) walls.push({ x: x + 3, y: qy + 3, r: 5, down: true }, { x: x + 3, y: qy + h - 3, r: 5, down: true });
    for (let y = qy; y < qy + h; y += 6) walls.push({ x: qx + 3, y: y + 3, r: 5, down: true }, { x: qx + w - 3, y: y + 3, r: 5, down: true });
  }
  for (const [qx, qy, what, ci] of U.toys) {
    const P = COLS[ci % 4];
    if (what === 'marble') disc(qx, qy, 6, dd => dd > 5 ? K.ink : dd < 2 ? K.hull : shade(P[0], .7));
    else if (what === 'die') { for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) px(qx + x, qy + y, Math.max(Math.abs(x), Math.abs(y)) > 5 ? K.ink : (x * x + y * y < 3 || ((Math.abs(x) - 3) ** 2 + (Math.abs(y) - 3) ** 2 < 2)) ? K.ink : shade(K.hull, .62)); }
    else if (what === 'stub') { for (let k = 0; k < 16; k++) for (let o = -2; o <= 2; o++) px(qx + k, qy + o + k * .2, k > 12 ? shade(K.wood2, .6) : shade(Math.abs(o) === 2 ? P[1] : P[0], .62)); }
    else if (what === 'sock') { for (let k = 0; k < 22; k++) for (let o = -4; o <= 4; o++) px(qx + k + (k > 15 ? (k - 15) * .5 : 0), qy + o + (k > 15 ? (k - 15) * .9 : 0), shade(Math.abs(o) === 4 ? P[1] : k % 6 < 3 ? P[0] : K.hull, .58)); continue; }
    walls.push({ x: qx + (what === 'stub' ? 8 : 0), y: qy, r: what === 'stub' ? 4 : 6, down: true });
  }
  { const [mx, my] = U.monster; // a fuzzy dark-purple plush monster with horns, it lies there and stares
    disc(mx, my, 22, (dd, dx, dy) => dd > 21 ? K.ink : hash(mx + dx, my + dy, 164) < .25 ? hex('#3a2448') : dx + dy < -10 ? hex('#5a3a70') : hex('#4a2e5e'));
    for (const s of [-1, 1]) { for (let k = 0; k < 8; k++) for (let o = -2; o <= 2; o++) px(mx + s * (10 + k * .6) + o * .3, my - 18 - k, o === 0 ? hex('#e8e0c8') : hex('#b8b098')); }
    disc(mx, my + 8, 6, dd => dd > 5 ? K.ink : hex('#2a1830'));
    walls.push({ x: mx, y: my, r: 21, down: true }); }

  yield;
  // ----- the bed is a picture of its own (toys.js draws it over the cars under it, or see-through when you are under it): the wooden frame
  // with four posts, the headboard at the wall, the blue duvet with stars and quilting and its folds, the soft way over it, the white sheet and
  // the two pillows at the head, the teddy; its side hangs down to the floor in front -----
  const BX = bx0 - 6, BY = by0, BW2 = bx1 + 30 - BX, BH2 = by1 + BFACE + 2 - BY, bimg = new ImageData(BW2, BH2), bd = bimg.data;
  const bset = (x, y, c) => { x = Math.round(x) - BX; y = Math.round(y) - BY; if (x < 0 || y < 0 || x >= BW2 || y >= BH2) return; const q = (y * BW2 + x) * 4; bd[q] = c[0]; bd[q + 1] = c[1]; bd[q + 2] = c[2]; bd[q + 3] = 255; };
  const bdk = (x, y, k) => { x = Math.round(x) - BX; y = Math.round(y) - BY; if (x < 0 || y < 0 || x >= BW2 || y >= BH2) return; const q = (y * BW2 + x) * 4; if (!bd[q + 3]) return; bd[q] *= k; bd[q + 1] *= k; bd[q + 2] *= k; };
  const folds = def.folds, sheetX = def.sheet;
  // (a plain function per band of rows: it gets fast after the first calls, a loop inside the generator would stay slow on the first build)
  const bedRows = (ya, yb) => { for (let y = ya; y < yb; y++) for (let x = bx0; x < bx1; x++) {
    const j = y * MW + x, e = Math.min(x - bx0, bx1 - 1 - x, y - by0, by1 - 1 - y), road = dist[j] < HALF;
    let c;
    if (e < 7) c = e < 1 ? K.frameD : e < 3 ? K.frameL : e < 6 ? K.frame : K.frameD; // the wooden frame round the mattress
    else if (x >= sheetX) {
      // the white sheet at the head
      c = vnoise(x / 9, y / 5, sd + 51) > .66 ? K.sheetD : K.sheet;
    } else {
      // the duvet: deep blue, quilted in diamonds, little yellow stars and moons; soft folds run across it; it is folded back at the head
      const u = (x - bx0 + y - by0) % 64, v = (x - bx0 - y + by0 + 6400) % 64, quilt = u === 0 || v === 0, fold = Math.sin((x - bx0) / 23 + Math.sin(y / 61) * 1.6) * .5 + .5;
      c = quilt ? K.duvS : fold > .82 ? K.duv2 : fold < .2 ? K.duv1 : K.duv;
      const cu = Math.floor((x - bx0 + y - by0) / 64), cv = Math.floor((x - bx0 - y + by0 + 6400) / 64), mcx = (cu * 64 + 32 + (cv * 64 + 32) - 6400) / 2 + bx0, mcy = (cu * 64 + 32 - (cv * 64 + 32) + 6400) / 2 + by0;
      const sdx = x - mcx, sdy = y - mcy, sr = Math.abs(sdx) + Math.abs(sdy) * 1.0;
      if (hash(cu, cv, sd + 52) < .5) { if (sr < 5 || (Math.abs(sdx) < 1 && Math.abs(sdy) < 8) || (Math.abs(sdy) < 1 && Math.abs(sdx) < 8)) c = sr < 3 ? K.star : K.starD; }
      else if (Math.hypot(sdx, sdy) < 6 && Math.hypot(sdx - 3, sdy - 2) > 4.5) c = K.moon;
      if (sheetX - x < 18) c = sheetX - x < 4 ? K.duvD : (sheetX - x) % 6 < 1 ? K.duvS : K.duvL; // the folded-back top of the duvet
      if (e < 15) c = shade(c, .78 + .22 * (e - 7) / 8); // the duvet rolls over the edge of the mattress
      if (road) {
        // the soft way over the duvet: lighter, stitched along both edges
        c = mixC(c, K.path, .62);
        if (dist[j] > HALF - 2) c = K.duvD; else if (Math.abs(dist[j] - (HALF - 5)) < .7 && (near[j] >> 1) % 3 < 2) c = K.stitch;
      }
    }
    // the pillows: big, white, puffy (a seam round them, a dent in the middle, a pink border)
    for (const p of def.pillows) if (inR(p, x, y)) {
      const pe = Math.min(x - p[0], p[2] - 1 - x, y - p[1], p[3] - 1 - y), uu = (x - p[0]) / (p[2] - p[0]) - .5, vv = (y - p[1]) / (p[3] - p[1]) - .5, puff = uu * uu + vv * vv;
      // puffy: bright in the middle, rounder and darker towards its seams, a light top left, a dent where the cars run
      const pk = .8 + .2 * Math.min(1, (pe - 5) / 24);
      c = pe < 1 ? K.pilD : pe < 3 ? K.pilS : pe < 6 ? K.pilP : uu + vv < -.66 && pe > 9 ? K.pilL : shade(puff < .015 ? K.pil1 : K.pil, pk);
      if (road && pe >= 7 && dist[j] < HALF && Math.abs(dist[j] - (HALF - 5)) < .7 && (near[j] >> 1) % 3 < 2) c = K.pilS;
    }
    bset(x, y, c);
  } };
  for (let y = by0; y < by1; y += 40) { bedRows(y, Math.min(by1, y + 40)); yield; }
  // the folds on the way are little hills: a bright crest and a shadow behind it
  for (const fx of folds) for (let y = by0 + 7; y < by1 - 7; y++) for (let dx = -7; dx <= 7; dx++) {
    const x = fx + dx + Math.round(Math.sin(y / 30) * 5), dd = dist[y * MW + x]; if (dd > HALF + 16 || x >= sheetX - 18) continue;
    const fade = clamp((HALF + 16 - dd) / 16, 0, 1);
    bdk(x, y, 1 + (dx < -3 ? .1 : dx < 0 ? .22 : dx < 3 ? -.24 : -.1) * fade);
  }
  // the side of the bed hangs down to the floor in front (the duvet over it, in folds), the shadow of the pillows and the teddy
  for (let y = by1; y < by1 + BFACE; y++) for (let x = bx0; x < bx1; x++) bset(x, y, y - by1 > BFACE - 3 ? K.faceD : x >= sheetX ? (y - by1 < 3 ? K.frameD : K.frame) : Math.sin((x + (y - by1) * .4) / 7) > .55 ? K.faceL : y - by1 < 2 ? K.duvD : K.face);
  for (const p of def.pillows) for (let y = p[1] + 3; y < p[3] + 5; y++) for (let x = p[0] + 4; x < p[2] + 5; x++) if (!inR(p, x, y)) bdk(x, y, .78);
  // the headboard at the wall: a tall wooden board with round posts at its ends; posts at the foot too
  for (let y = by0 - 2; y < by1 + BFACE; y++) for (let x = bx1; x < bx1 + 26; x++) {
    const e = Math.min(x - bx1, bx1 + 25 - x, y - by0 + 2, by1 + BFACE - 1 - y);
    bset(x, y, e < 1 ? K.frameD : e < 3 ? K.frameL : (y - by0) % 52 < 4 ? K.frame : (x - bx1) % 8 < 2 ? K.frame : K.post);
  }
  const knob = (cx, cy, rr) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const dd = Math.hypot(dx, dy); if (dd <= rr) bset(cx + dx, cy + dy, dd > rr - 1.2 ? K.frameD : dx + dy < -rr * .5 ? K.frameL : K.post); } };
  for (const [kx, ky, kr] of [[bx1 + 13, by0 + 10, 12], [bx1 + 13, by1 + 2, 12], [bx0 + 4, by0 + 6, 8], [bx0 + 4, by1 + 2, 8]]) knob(kx, ky, kr);
  // the teddy (solid for the cars up on the bed)
  const [tdx, tdy] = def.teddy, TB_ = hex('#a8743c'), TBL = hex('#c8945a'), TBD = hex('#7a4e22'), TBM = hex('#e8c89a');
  for (let dy = -26; dy <= 34; dy++) for (let dx = -30; dx <= 34; dx++) if (Math.hypot(dx - 8, (dy - 10) * 1.2) < 28) bdk(tdx + dx, tdy + dy, .8);
  const blob = (cx, cy, rr, c0, c1, c2) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const dd = Math.hypot(dx, dy); if (dd > rr) continue; bset(cx + dx, cy + dy, dd > rr - 1.3 ? c2 : dx + dy < -rr * .4 ? c1 : c0); } };
  blob(tdx - 17, tdy + 22, 8, TB_, TBL, TBD); blob(tdx + 17, tdy + 22, 8, TB_, TBL, TBD);
  blob(tdx, tdy + 12, 19, TB_, TBL, TBD); blob(tdx, tdy + 14, 10, TBM, TBM, TB_);
  blob(tdx - 21, tdy + 5, 7, TB_, TBL, TBD); blob(tdx + 21, tdy + 5, 7, TB_, TBL, TBD);
  blob(tdx - 12, tdy - 21, 7, TB_, TBL, TBD); blob(tdx + 12, tdy - 21, 7, TB_, TBL, TBD);
  blob(tdx, tdy - 10, 15, TB_, TBL, TBD); blob(tdx, tdy - 6, 6, TBM, TBM, TB_);
  for (const s of [-1, 1]) { bset(tdx + s * 6, tdy - 13, [26, 18, 12]); bset(tdx + s * 6, tdy - 14, [26, 18, 12]); bset(tdx + s * 6 - 1, tdy - 14, [255, 255, 255]); }
  bset(tdx, tdy - 8, [40, 26, 16]); bset(tdx + 1, tdy - 8, [40, 26, 16]); bset(tdx - 12, tdy - 21, TBM); bset(tdx + 12, tdy - 21, TBM);
  for (let k = -4; k <= 4; k++) { bset(tdx + k, tdy + 1, k % 2 ? COLS[0][0] : COLS[0][2]); bset(tdx + k, tdy + 2, COLS[0][1]); }
  walls.push({ x: tdx, y: tdy - 9, r: 15, up: true }, { x: tdx, y: tdy + 12, r: 19, up: true }, { x: tdx - 20, y: tdy + 5, r: 7, up: true }, { x: tdx + 20, y: tdy + 5, r: 7, up: true });
  const bedImg = mk(BW2, BH2); bedImg.getContext('2d').putImageData(bimg, 0, 0);

  yield;
  // ----- the desk: crayons along the road, the eraser on it, the open paint box, the pencil cup, exercise books, notes, the desk lamp (its light
  // falls on the table), a mug, the star projector; on the second table a pencil case and crayons between the two lanes -----
  for (const [x0, y0, len, ci] of def.crayons) {
    const P = COLS[ci % 4];
    shadowRect(x0, y0 - 4, len, 9, 2, 3, .78);
    for (let x = x0; x < x0 + len; x++) for (let dy = -4; dy <= 4; dy++) {
      const q = x - x0, tip = len - q, ad = Math.abs(dy);
      if (tip < 10 && ad > tip * .45) continue;
      px(x, y0 + dy, tip < 3 ? P[1] : tip < 10 ? K.wood2 : q < 5 || (q > 10 && q < len - 16) ? (ad === 4 ? P[1] : dy < 0 ? P[2] : P[0]) : (ad === 4 ? K.dark : K.hull));
    }
    for (let x = x0 + 4; x < x0 + len - 2; x += 7) walls.push({ x, y: y0, r: 5 });
  }
  { const [ex, ey, ew, eh] = def.eraser; shadowRect(ex, ey, ew, eh, 3, 4);
    for (let y = ey; y < ey + eh; y++) for (let x = ex; x < ex + ew; x++) { const e = Math.min(x - ex, ex + ew - 1 - x, y - ey, ey + eh - 1 - y); px(x, y, e < 1 ? hex('#7a3a4a') : x - ex < ew * .45 ? (e < 2 ? hex('#ff9ab0') : hex('#f47a96')) : (e < 2 ? hex('#7ab0ff') : hex('#4a86e8'))); }
    for (let x = ex + 5; x < ex + ew - 2; x += 7) walls.push({ x, y: ey + eh / 2, r: 6 }); }
  { const [qx, qy, bw, bh] = def.paintbox; shadowRect(qx, qy, bw, bh, 3, 3);
    for (let y = qy; y < qy + bh; y++) for (let x = qx; x < qx + bw; x++) {
      const e = Math.min(x - qx, qx + bw - 1 - x, y - qy, qy + bh - 1 - y), cell = (bw - 6) / 6, q = (x - qx - 3) / cell | 0, inPan = e >= 3 && (x - qx - 3) % cell > 1.5;
      px(x, y, e < 1 ? K.dark : e < 3 ? hex('#3a5aa8') : inPan ? [COLS[0][0], COLS[3][0], COLS[1][0], COLS[2][0], hex('#8a4ad0'), hex('#f08a2a')][q % 6] : hex('#e8e8ee'));
    }
    for (let x = qx + 5; x < qx + bw - 2; x += 7) walls.push({ x, y: qy + bh / 2, r: 6 });
    for (let k = 0; k < 34; k++) px(qx + 8 + k, qy - 4 + k * .08, k < 6 ? COLS[1][0] : k < 9 ? K.hullD : hex('#c84a2a')); } // a brush across it, dipped in blue
  for (const [nx, ny, nw, nh, ci] of def.hefte) {
    const P = COLS[ci % 4];
    shadowRect(nx, ny, nw, nh, 2, 3, .82);
    for (let y = ny; y < ny + nh; y++) for (let x = nx; x < nx + nw; x++) { const e = Math.min(x - nx, nx + nw - 1 - x, y - ny, ny + nh - 1 - y); px(x, y, e < 1 ? P[1] : x - nx < 4 ? shade(P[0], .8) : Math.abs(y - ny - nh * .3) < 5 && x - nx > nw * .25 && x - nx < nw * .75 ? K.paper : P[0]); }
  }
  { const [nx, ny, nw, nh] = def.openBook; shadowRect(nx, ny, nw, nh, 2, 3, .82); // an open exercise book with a drawing of a car
    for (let y = ny; y < ny + nh; y++) for (let x = nx; x < nx + nw; x++) px(x, y, Math.abs(x - nx - nw / 2) < 1 ? K.paperE : x === nx || x === nx + nw - 1 || y === ny + nh - 1 ? K.paperE : (y - ny) % 6 === 0 ? K.paperL : K.paper);
    for (let k = 0; k < 24; k++) { px(nx + nw / 2 + 8 + k, ny + 26, COLS[0][0]); if (k < 14) px(nx + nw / 2 + 13 + k, ny + 19, COLS[0][0]); }
    disc(nx + nw / 2 + 13, ny + 29, 3, dd => dd > 2 ? K.ink : null); disc(nx + nw / 2 + 27, ny + 29, 3, dd => dd > 2 ? K.ink : null); }
  for (const [nx, ny, ci] of def.notes) for (let y = ny; y < ny + 16; y++) for (let x = nx; x < nx + 16; x++) px(x, y, y - ny < 3 ? shade(COLS[ci][2], .92) : (y - ny) % 4 === 0 && x - nx > 2 && x - nx < 13 ? shade(COLS[ci][2], .8) : COLS[ci][2]);
  { const [cx, cy] = def.cup; shadowDisc(cx, cy, 12, 4, 5);
    disc(cx, cy, 12, dd => dd > 10.8 ? K.dark : dd > 9 ? hex('#e84a8a') : hex('#3a2430'), setT);
    for (const [ax, ay, ci] of [[-4, -3, 0], [3, -5, 1], [5, 3, 2], [-3, 5, 3], [0, 0, 1]]) for (let k = 0; k < 5; k++) setT(cx + ax + k * .5, cy + ay - k, k < 3 ? COLS[ci][0] : K.wood2);
    walls.push({ x: cx, y: cy, r: 12 }); block(cx, cy, 15); }
  { const [cx, cy] = def.mug; shadowDisc(cx, cy, 11, 4, 5);
    disc(cx, cy, 11, dd => dd > 10 ? K.dark : dd > 8 ? hex('#f4f4f0') : hex('#6a3a1e'), setT);
    for (let k = -4; k <= 4; k++) { setT(cx + 12 + Math.abs(k) * -.3 + 2, cy + k, K.dark); setT(cx + 13, cy + k, hex('#f4f4f0')); }
    walls.push({ x: cx, y: cy, r: 11 }); }
  { const [qx, qy] = def.projector; shadowDisc(qx, qy, 13, 4, 5);
    disc(qx, qy, 13, (dd, dx, dy) => dd > 12 ? K.dark : hash(dx + 20, dy + 20, 51) < .1 ? hex('#ffe9a0') : dx + dy < -8 ? hex('#3a4aa0') : hex('#24306e'), setT);
    walls.push({ x: qx, y: qy, r: 13 }); }
  { const [lx, ly] = def.lamp, [hx, hy] = def.lampHead; // the desk lamp: its foot, the arm, the shade, a pool of warm light on the table
    for (let dy = -60; dy <= 60; dy++) for (let dx = -80; dx <= 80; dx++) { const e = (dx / 80) ** 2 + (dy / 50) ** 2; if (e < 1 && kind[(hy + 30 + dy) * MW + hx + dx] === KD.DESK) { const q = ((hy + 30 + dy) * MW + hx + dx) * 4, k = .22 * (1 - e); S.d[q] = Math.min(255, S.d[q] + 60 * k); S.d[q + 1] = Math.min(255, S.d[q + 1] + 50 * k); S.d[q + 2] = Math.min(255, S.d[q + 2] + 20 * k); } }
    shadowDisc(lx, ly, 14, 4, 5);
    disc(lx, ly, 14, (dd, dx, dy) => dd > 13 ? K.dark : dx + dy < -6 ? hex('#5a9ae8') : hex('#3a72c8'), setT);
    const steps = Math.hypot(hx - lx, hy - ly); for (let k = 0; k < steps; k++) { const f = k / steps, x = lx + (hx - lx) * f, y = ly + (hy - ly) * f - Math.sin(f * Math.PI) * 18; setT(x, y, K.dark); setT(x + 1, y, hex('#9aa0aa')); setT(x, y + 1, K.dark); }
    for (let dy = -11; dy <= 11; dy++) for (let dx = -12; dx <= 12; dx++) { const dd = Math.hypot(dx, dy * 1.2); if (dd <= 12) setT(hx + dx, hy + dy, dd > 11 ? K.dark : dd < 5 ? hex('#fff6c8') : hex('#3a72c8')); }
    walls.push({ x: lx, y: ly, r: 14 }); block(lx, ly, 17); }
  { const [pcx, pcy, pw, ph] = def.divider; shadowRect(pcx, pcy, pw, ph, 3, 4); // a pencil case with a zip between the two lanes of the second table (the crayons go on from it)
    for (let y = pcy; y < pcy + ph; y++) for (let x = pcx; x < pcx + pw; x++) { const e = Math.min(x - pcx, pcx + pw - 1 - x, y - pcy, pcy + ph - 1 - y); setT(x, y, e < 1 ? K.dark : Math.abs(y - pcy - ph / 2) < 1 ? (x % 3 ? hex('#c8c8d0') : K.dark) : e < 3 ? hex('#f08a2a') : hex('#e86a1a')); }
    wallsRect(pcx, pcy, pw, ph, 7); }
  { const [cx0, cy0, cx1, cy1] = def.chair; // the desk chair in front of the tables: a red cushion on a wooden seat, the backrest on the far side
    shadowRect(cx0, cy0, cx1 - cx0, cy1 - cy0 + 8, 7, 9, .6);
    for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) {
      const e = Math.min(x - cx0, cx1 - 1 - x, y - cy0, cy1 - 1 - y), back = x - cx0 < 14, cu = x - cx0 > 18 && e > 5;
      setT(x, y, e < 1 ? K.woodFD : back ? ((y - cy0) % 16 < 3 ? K.woodFD : x - cx0 < 3 ? K.woodF : K.wood2) : cu ? ((x + y) % 11 === 0 ? hex('#b83a3a') : (x - cx0 - 18) + (y - cy0) < 22 ? hex('#e86a6a') : hex('#d84a4a')) : K.woodF);
    }
    for (let y = cy1; y < cy1 + 8; y++) for (let x = cx0; x < cx1; x++) setT(x, y, y - cy1 > 6 ? K.woodFD : (x - cx0) % 70 < 10 ? K.leg : K.woodF);
    wallsRect(cx0, cy0, cx1 - cx0, cy1 - cy0 + 6, 8); }
  // the edges of the desk tables are solid for the cars on the floor (they cannot drive under the desk), not at the stairs and the marble run
  const fur = (x, y, skip) => { if (!skip(x, y)) walls.push({ x, y, r: 6, down: true }); };
  const atStairs = (x, y) => Math.abs(x - sx) < U.half + 4 && Math.abs(y - sy1) < 12;
  const atTower = (x, y) => Math.hypot(x - def.tower[0], y - def.tower[1]) < def.tower[2] + 10;
  for (const q of [TA, TB]) {
    for (let x = q[0]; x <= q[2]; x += 8) { fur(x, q[1] - 3, atStairs); fur(x, q[3] + FACE - 4, atTower); }
    for (let y = q[1]; y <= q[3] + FACE; y += 8) { fur(q[0] - 4, y, atTower); fur(q[2] + 4, y, () => false); }
  }
  // the sides of the ramp of books and of the staircase (the cars on the floor drive round them, not under them)
  for (let i = (RT.rampA + RT.rampB) >> 1; i <= RT.rampB; i += 3) for (const sg of [-1, 1]) walls.push({ x: path[i].x + nrm[i].x * sg * (HALF + 4), y: path[i].y + nrm[i].y * sg * (HALF + 4), r: 5, down: true });
  for (let y = sy0; y <= sy1; y += 6) for (const s of [-1, 1]) walls.push({ x: sx + s * (U.half + 5), y, r: 5, down: true });

  yield;
  // ----- the marble run: a round wooden tower with a colourful spiral track, the funnel at the desk, the way out at the bottom (all above the
  // cars: the cars inside are drawn over it, see toys.js) -----
  const [tx, ty, tr] = def.tower, RC = [COLS[0], COLS[2], COLS[1], COLS[3]];
  shadowDisc(tx, ty, tr + 2, 9, 11, .58);
  for (let dy = -tr - 2; dy <= tr + 2; dy++) for (let dx = -tr - 2; dx <= tr + 2; dx++) {
    const dd = Math.hypot(dx, dy); if (dd > tr + 1) continue;
    const a = (Math.atan2(dy, dx) + TAU) % TAU, pitch = (tr - 12) / 2.4, u = (tr - 4 - dd) / pitch + a / TAU, k = u - Math.floor(u), ring = Math.floor(u) & 3;
    let c = dd > tr - .5 ? K.woodFD : dd > tr - 4 ? K.woodF : dd < 8 ? (dd < 6 ? K.wood2 : K.woodFD) : K.wood1;
    if (dd >= 8 && dd <= tr - 4) c = k < .5 ? (k < .08 || k > .42 ? RC[ring][1] : RC[ring][0]) : k < .56 ? K.woodFD : K.wood1;
    setT(tx + dx, ty + dy, c);
  }
  for (let y = ty - HALF - 4; y <= ty + HALF + 4; y++) for (let x = tx + tr - 6; x < TB[0] + 4; x++) { const ao = Math.abs(y - ty); setT(x, y, ao > HALF + 2 ? K.dark : ao > HALF - 1 ? COLS[0][1] : ((x + y) >> 2) & 1 ? COLS[0][0] : COLS[0][2]); }
  for (let y = ty - 14; y <= ty + 14; y++) for (let x = tx - tr - 2; x < tx - tr + 6; x++) setT(x, y, Math.abs(y - ty) > 12 ? K.dark : hex('#2a1a10'));
  for (let a = 0; a < TAU; a += .2) walls.push({ x: tx + Math.cos(a) * (tr + 3), y: ty + Math.sin(a) * (tr + 3), r: 5, down: true });

  yield;
  // ----- the floor: the wall of building blocks across the room (nobody cuts through the middle), the town of blocks on its baseplate (houses,
  // towers, the castle), the doll's house and the toy box on the rug, the bookshelf, the window, the door, the drawings, the night light, the
  // dock of the robot vacuum, the sign at the fork -----
  const brick = (x0, y0, w, h, c, studs, top) => {
    const put = top ? setT : px;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const ex = x - x0, ey = y - y0, e = Math.min(ex, w - 1 - ex, ey, h - 1 - ey); put(x, y, e < 1 ? shade(c, .45) : ex < 2 || ey < 2 ? shade(c, 1.22) : ex > w - 3 || ey > h - 3 ? shade(c, .78) : c); }
    if (studs) for (let qy = y0 + 5; qy < y0 + h - 3; qy += 10) for (let qx = x0 + 5; qx < x0 + w - 3; qx += 10) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 8) put(qx + dx, qy + dy, dx + dy < -1 ? shade(c, 1.3) : dx + dy > 1 ? shade(c, .72) : c);
  };
  { const [wx0, wx1, wy] = def.blockWall;
    for (let x = wx0, k = 0; x < wx1; x += 20, k++) {
      const c = BLOCKS[(hash(k, 7, sd) * BLOCKS.length) | 0], studs = hash(k, 8, sd) < .5, w = Math.min(20, wx1 - x);
      shadowRect(x, wy - 9, w, 18, 4, 6, .66); brick(x, wy - 9, w, 18, c, studs, false);
      if (hash(k, 9, sd) < .35) { const c2 = BLOCKS[(hash(k, 10, sd) * BLOCKS.length) | 0]; brick(x + 1, wy - 21, Math.min(18, w - 1), 16, c2, !studs, true); }
      for (let q = 0; q < w; q += 8) walls.push({ x: x + q + 4, y: wy, r: 10 });
    }
  }
  // the houses of the town: walls of bricks with studs on top, windows on the front (south) face, a flat roof of plates; each one solid
  for (const [qx, qy, w, h, ci] of def.city.houses) {
    const col = BLOCKS[ci % BLOCKS.length];
    shadowRect(qx, qy, w, h + 10, 6, 8, .62);
    brick(qx, qy, w, h, col, true, true);
    for (let y = qy + h; y < qy + h + 10; y++) for (let x = qx; x < qx + w; x++) { const fy = y - qy - h; setT(x, y, fy > 8 ? shade(col, .4) : (x - qx) % 14 > 4 && (x - qx) % 14 < 10 && fy > 2 && fy < 7 ? hex('#bfe8ff') : shade(col, .7)); }
    for (let y = qy + 6; y < qy + h + 6; y += 9) for (let x = qx + 6; x < qx + w - 5; x += 9) walls.push({ x, y, r: 7 });
    block(qx + w / 2, qy + h / 2, Math.max(w, h) / 2 + 6);
  }
  { const [cx0, cy0, cx1, cy1] = def.city.castle;
    shadowRect(cx0, cy0, cx1 - cx0, cy1 - cy0, 6, 8, .62);
    for (let x = cx0; x < cx1; x += 14) for (const y of [cy0, cy1 - 14]) brick(x, y, Math.min(14, cx1 - x), 14, BLOCKS[((x / 14 | 0) + (y > cy0 ? 2 : 0)) % 5], true, true);
    for (let y = cy0 + 14; y < cy1 - 14; y += 14) for (const x of [cx0, cx1 - 14]) brick(x, y, 14, 14, BLOCKS[((y / 14 | 0) + 1) % 5], false, true);
    for (let y = cy0 + 14; y < cy1 - 14; y++) for (let x = cx0 + 14; x < cx1 - 14; x++) setT(x, y, hash(x, y, sd + 50) < .5 ? K.pq1 : K.pq2);
    for (const [qx, qy] of [[cx0 - 5, cy0 - 5], [cx1 - 19, cy0 - 5], [cx0 - 5, cy1 - 19], [cx1 - 19, cy1 - 19]]) { brick(qx, qy - 8, 24, 24, BLOCKS[0], true, true); for (let k = 0; k < 24; k += 7) brick(qx + k, qy - 15, 5, 7, BLOCKS[3], false, true); }
    for (let y = cy0; y <= cy1; y += 8) for (let x = cx0; x <= cx1; x += 8) walls.push({ x, y, r: 7 });
    block((cx0 + cx1) / 2, (cy0 + cy1) / 2, (cx1 - cx0) / 2 + 8); }
  { const [hx, hy, hw, hh] = def.dollhouse;
    shadowRect(hx, hy, hw, hh + 12, 7, 9, .62);
    for (let y = hy; y < hy + hh; y++) for (let x = hx; x < hx + hw; x++) {
      const ey = y - hy, ex = x - hx, top = ey < hh / 2, ridge = Math.abs(ey - hh / 2) < 1.5, e = Math.min(ex, hw - 1 - ex, ey, hh - 1 - ey);
      setT(x, y, e < 1 ? hex('#5a2418') : ridge ? hex('#7a3020') : (ey % 7 === 0 || (ex + (Math.floor(ey / 7) % 2) * 6) % 12 === 0) ? hex('#a8443a') : top ? hex('#e8705a') : hex('#c85a4a'));
    }
    for (let y = hy + hh; y < hy + hh + 12; y++) for (let x = hx; x < hx + hw; x++) { const fy = y - hy - hh; setT(x, y, fy > 10 ? hex('#8a6a50') : (x - hx) % 22 > 6 && (x - hx) % 22 < 15 && fy > 2 && fy < 9 ? hex('#bfe8ff') : hex('#f4e4c8')); }
    for (let y = hy + 6; y < hy + 20; y++) for (let x = hx + hw - 24; x < hx + hw - 12; x++) setT(x, y, y < hy + 9 ? hex('#3a2a2a') : hex('#d8c8b0'));
    wallsRect(hx, hy, hw, hh + 10, 9); }
  { const [qx, qy, bw, bh] = def.toybox; shadowRect(qx, qy, bw, bh + 10, 6, 8, .64);
    for (let y = qy; y < qy + bh; y++) for (let x = qx; x < qx + bw; x++) { const e = Math.min(x - qx, qx + bw - 1 - x, y - qy, qy + bh - 1 - y); setT(x, y, e < 1 ? K.woodFD : e < 5 ? K.woodF : (x - qx) % 14 === 0 ? K.woodG : K.wood1); }
    for (let y = qy + bh; y < qy + bh + 10; y++) for (let x = qx; x < qx + bw; x++) setT(x, y, y - qy - bh > 8 ? K.woodFD : K.woodF);
    for (const [ax, ay, ar, ci] of [[qx + 16, qy + 16, 9, 0], [qx + 38, qy + 26, 7, 2], [qx + 56, qy + 14, 8, 1]]) disc(ax, ay, ar, (dd, dx, dy) => dd > ar - 1.2 ? COLS[ci][1] : dx + dy < -2 ? COLS[ci][2] : COLS[ci][0], setT);
    wallsRect(qx, qy, bw, bh + 8, 8); }
  { const [s0, s1] = def.shelf; // the bookshelf against the wall: books standing in a row, the board in front
    shadowRect(s0, 18, s1 - s0, 40, 4, 8, .7);
    for (let x = s0; x < s1; x++) for (let y = 18; y < 58; y++) setT(x, y, y > 54 ? K.woodFD : y > 50 ? K.woodF : K.woodFD);
    for (let x = s0 + 3, k = 0; x < s1 - 8; k++) { const w = 6 + (hash(k, 11, sd) * 6 | 0), hh = 18 + (hash(k, 12, sd) * 12 | 0), B = BOOKS[k % BOOKS.length]; for (let y = 50 - hh; y < 50; y++) for (let q = 0; q < w; q++) setT(x + q, y, q === 0 || y === 50 - hh ? B[1] : Math.abs(y - 50 + hh * .6) < 1 ? K.pages : B[0]); x += w + 1; }
    for (let x = s0 + 6; x < s1; x += 10) walls.push({ x, y: 38, r: 12 }); }
  { const [w0, w1] = def.window; // the window in the wall: the sky, the cross bars, curtains at both sides (they sway, see toys.js)
    for (let x = w0; x < w1; x++) for (let y = 0; y < 15; y++) px(x, y, y < 2 || y > 12 || (x - w0) % 60 < 3 || x > w1 - 3 ? hex('#f4f4f4') : y < 7 ? hex('#cfe8ff') : hex('#9ccaf0')); }
  { const [d0, d1] = def.door; // the door in the bottom wall: a white door, a gap of light under it (in the dark, see toys.js)
    for (let x = d0; x < d1; x++) for (let y = MH - 24; y < MH; y++) px(x, y, y < MH - 20 ? hex('#8a7a60') : x - d0 < 3 || d1 - x < 4 ? hex('#c8c0b0') : (x - d0) % 40 < 2 ? hex('#d8d0c0') : hex('#f4f0e8'));
    disc(d1 - 16, MH - 10, 3, dd => dd > 2 ? hex('#8a6a20') : hex('#f0c040')); }
  for (const [dx0, w, h, ci] of def.drawings) { // the kids' drawings on the wall (a house, a car, a sun)
    for (let y = 1; y < 1 + h; y++) for (let x = dx0; x < dx0 + w; x++) px(x, y, x === dx0 || x === dx0 + w - 1 || y === h ? K.paperE : K.paper);
    disc(dx0 + 6, 5, 2, () => COLS[2][0]); for (let k = 0; k < w - 10; k++) px(dx0 + 5 + k, h - 3 + Math.sin(k / 2) * .8, COLS[(ci + 3) % 4][0]);
    for (let k = 0; k < 8; k++) { px(dx0 + w / 2 - 4 + k, h - 6, COLS[ci][0]); px(dx0 + w / 2 - 3 + k * .7, h - 9 + Math.abs(k - 4) * .5, COLS[ci][1]); }
    px(dx0 + w / 2, 1, hex('#e84a4a')); }
  { const [nlx, nly] = def.nightlight; disc(nlx, nly, 7, (dd, dx, dy) => dd > 6 ? hex('#b89a40') : Math.hypot(dx - 3, dy - 2) > 4.5 ? hex('#ffe9a0') : null); }
  { const [qx, qy] = def.robot.dock; // the dock of the robot vacuum at the wall
    for (let y = qy - 24; y <= qy + 24; y++) for (let x = qx - 12; x <= qx + 12; x++) { const e = Math.min(x - qx + 12, qx + 12 - x, y - qy + 24, qy + 24 - y); px(x, y, e < 1 ? K.dark : e < 3 ? K.hullD : x > qx + 7 && Math.abs(y - qy) < 7 ? hex('#c8a83a') : K.hull); }
    shadowRect(qx - 12, qy - 24, 25, 49, 3, 4, .76);
    walls.push({ x: qx - 4, y: qy - 14, r: 9 }, { x: qx - 4, y: qy, r: 9 }, { x: qx - 4, y: qy + 14, r: 9 }); }
  { const [qx, qy] = def.sign; // the sign at the fork: a post, a board with a pillow and an arrow straight on, a board with a moon and an arrow down
    shadowRect(qx - 2, qy, 5, 26, 3, 3, .7);
    for (let y = qy - 24; y < qy + 26; y++) { setT(qx, y, K.woodFD); setT(qx + 1, y, K.woodF); }
    const board = (y0, col, icon, dir) => {
      for (let y = y0; y < y0 + 18; y++) for (let x = qx - 22; x < qx + 24; x++) { const e = Math.min(x - qx + 22, qx + 23 - x, y - y0, y0 + 17 - y); setT(x, y, e < 1 ? K.ink : e < 2 ? shade(col, 1.25) : col); }
      icon(qx - 14, y0 + 9);
      for (let k = 0; k < 14; k++) for (let o = -1; o <= 1; o++) setT(qx + 2 + (dir ? k * .7 : k) , y0 + 9 + o + (dir ? k * .7 : 0), K.pilL);
      for (let k = 0; k < 6; k++) for (let o = -k; o <= k; o++) setT(dir ? qx + 16 - k + o * .5 : qx + 22 - k, (dir ? y0 + 18 - k - o * .5 : y0 + 9 + o), K.pilL);
    };
    board(qy - 24, hex('#3a78c8'), (cx, cy) => { for (let y = -4; y <= 4; y++) for (let x = -7; x <= 7; x++) setT(cx + x, cy + y, Math.abs(y) === 4 || Math.abs(x) === 7 ? K.pilS : K.pilL); }, 0);
    board(qy - 2, hex('#3a2a5a'), (cx, cy) => { for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (x * x + y * y <= 36 && (x - 3) ** 2 + (y - 2) ** 2 > 20) setT(cx + x, cy + y, hex('#ffe58a')); }, 1);
    walls.push({ x: qx, y: qy + 20, r: 4 }); }

  yield;
  // ----- little things on the floor: the tubs of plasticine at their patches (solid), a ball, the rubber duck, socks, puzzle pieces -----
  for (const [qx, qy, , ci] of def.knete) {
    const a = Math.atan2(qy - path[nearestIdx(path, qx, qy)].y, qx - path[nearestIdx(path, qx, qy)].x), ox = qx + Math.cos(a) * 26, oy = qy + Math.sin(a) * 26, P = COLS[ci];
    if (kind[Math.round(oy) * MW + Math.round(ox)] !== KD.CITY && kind[Math.round(oy) * MW + Math.round(ox)] !== KD.RUG) continue;
    shadowDisc(ox, oy, 9, 3, 4);
    disc(ox, oy, 9, (dd, dx, dy) => dd > 8 ? K.dark : dd > 6.5 ? K.hull : vnoise(dx / 2 + ox, dy / 2, 52) > .6 ? P[2] : P[0]);
    walls.push({ x: ox, y: oy, r: 9 });
  }
  { const [qx, qy, qr] = def.ball; shadowDisc(qx, qy, qr, 5, 6);
    disc(qx, qy, qr, (dd, dx, dy) => { const a = Math.atan2(dy, dx); return dd > qr - 1.2 ? K.dark : dd < qr * .3 && dx + dy < 0 ? [255, 255, 255] : COLS[(((a + Math.PI) / (Math.PI / 2)) | 0) % 4][dx + dy < 0 ? 0 : 1]; }, setT);
    walls.push({ x: qx, y: qy, r: qr - 1 }); }
  { const [qx, qy] = def.duck, Y = COLS[2];
    for (let dy = -7; dy <= 7; dy++) for (let dx = -9; dx <= 9; dx++) if ((dx / 9) ** 2 + (dy / 7) ** 2 <= 1) setT(qx + dx, qy + dy, (dx / 9) ** 2 + (dy / 7) ** 2 > .8 ? Y[1] : Y[0]);
    disc(qx + 7, qy - 7, 5, dd => dd > 4 ? Y[1] : Y[2], setT);
    setT(qx + 12, qy - 7, hex('#f08a2a')); setT(qx + 13, qy - 7, hex('#f08a2a')); setT(qx + 8, qy - 8, K.dark);
    walls.push({ x: qx, y: qy, r: 8 }); }
  for (const [qx, qy, ci] of def.socks) for (let k = 0; k < 22; k++) for (let o = -4; o <= 4; o++) px(qx + k + (k > 15 ? (k - 15) * .5 : 0), qy + o + (k > 15 ? (k - 15) * .9 : 0), Math.abs(o) === 4 ? shade(COLS[ci][0], .7) : k % 6 < 3 ? COLS[ci][0] : K.hull);
  for (const [qx, qy, ci] of def.puzzle) for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
    const inBox = Math.abs(dx) <= 6 && Math.abs(dy) <= 6, knb = Math.hypot(dx - 7, dy) <= 3 || Math.hypot(dx, dy + 7) <= 3; if (!inBox && !knb) continue;
    px(qx + dx, qy + dy, mixC(Math.abs(dx) === 6 || Math.abs(dy) === 6 ? COLS[ci][1] : COLS[ci][0], [200, 160, 110], .35)); // (flat and pale: you drive over them)
  }

  yield;
  // ----- the toy car wash in its bay: a plastic floor with slits, yellow posts and a red beam over it; the brushes turn (see toys.js) -----
  const W = def.bay, wpts = RT.ways[1].P, wm = wpts[wpts.length >> 1], wq = wpts[Math.min(wpts.length - 1, (wpts.length >> 1) + 2)], wtg = { x: wq.x - wm.x, y: wq.y - wm.y }, wl = Math.hypot(wtg.x, wtg.y) || 1;
  wtg.x /= wl; wtg.y /= wl; const wnm = { x: -wtg.y, y: wtg.x };
  for (let y = Math.floor(wm.y - 40); y <= wm.y + 40; y++) for (let x = Math.floor(wm.x - 40); x <= wm.x + 40; x++) {
    const a = (x + .5 - wm.x) * wtg.x + (y + .5 - wm.y) * wtg.y, c = (x + .5 - wm.x) * wnm.x + (y + .5 - wm.y) * wnm.y, j = y * MW + x;
    if (RT.wayM[j] === WAY.BAY && Math.abs(a) < 16) { washMask[j] = 1; set(j, Math.floor(a + 20) % 4 === 0 ? K.bayS : (x + y) % 2 ? hex('#c8e4f8') : hex('#d8ecfa')); }
    if (Math.abs(a) < 3 && Math.abs(c) <= W.half + 9) setT(x, y, Math.abs(a) > 2 ? hex('#a82a2a') : ((Math.floor(c + 100) >> 2) & 1) ? hex('#ffffff') : hex('#e84a4a'));
    if (Math.abs(c) > W.half + 2 && Math.abs(c) <= W.half + 9 && Math.abs(a) < 6) setT(x, y, Math.abs(c) > W.half + 7 || Math.abs(a) > 4.5 ? hex('#b8920e') : hex('#f2cc30'));
  }
  for (const s of [-1, 1]) for (let q = -4; q <= 4; q += 4) walls.push({ x: wm.x + wnm.x * s * (W.half + 6) + wtg.x * q, y: wm.y + wnm.y * s * (W.half + 6) + wtg.y * q, r: 4 });

  yield;
  // ----- the bed: its frame is solid for the cars on the floor (they cannot drive under it), except where the way goes under it; the walls
  // of the room are solid for everybody -----
  const ramp = (x, y) => { const q = near[Math.round(y) * MW + Math.round(x)]; return dist[Math.round(y) * MW + Math.round(x)] < HALF + 10 && q >= RT.rampA - 6 && q <= RT.rampB + 6; };
  const way = (x, y) => RT.wayM[clamp(Math.round(y), 0, MH - 1) * MW + clamp(Math.round(x), 0, MW - 1)] === WAY.UNDER;
  const bfur = (x, y) => { if (!ramp(x, y) && !way(x, y)) walls.push({ x, y, r: 6, down: true }); };
  for (let x = bx0; x <= bx1; x += 8) bfur(x, by1 + BFACE - 6);
  for (let y = by0 + 30; y <= by1 + BFACE; y += 8) bfur(bx0 - 3, y);
  for (let x = 24; x <= MW - 24; x += 8) walls.push({ x, y: 14, r: 6 }, { x, y: MH - 14, r: 6 });
  for (let y = 24; y <= MH - 24; y += 8) walls.push({ x: 14, y, r: 6 }, { x: MW - 14, y, r: 6 });
  walls.push(...[by0 + 10, by0 + 40, by0 + 80, by1 - 80, by1 - 40, by1 - 10].map(y => ({ x: bx1 + 6, y, r: 6, up: true }))); // the headboard

  // the jumps: the folds of the duvet are little hills (only up on the bed), the pillow throws the cars over the gap onto the desk
  const ix = p => nearestIdx(path, p[0], p[1]);
  const jumps = folds.map(fx => { const i = ix([fx, by0 + 104]); return { x: path[i].x, y: path[i].y, tx: tan[i].x, ty: tan[i].y, lo: -HALF - 4, hi: HALF + 4, vz: 52, soft: true, lvl: 1, fold: true }; });
  const [jx, jy] = def.lip, ltg = tan[RT.lipI];
  jumps.push({ x: jx, y: jy, tx: ltg.x, ty: ltg.y, lo: -HALF - 6, hi: HALF + 6, vz: 205, lvl: 1, pillow: true });
  // the stairs push back a little (you climb)
  const pushes = [{ rect: [sx - U.half, sy0, sx + U.half, sy1], fx: 0, fy: -70 }];
  return { jumps, pushes, alt: RT.alt, kind, upM: RT.upM, hM: RT.hM, wayM: RT.wayM, wayD: RT.wayD, bedT: RT.bedT, ways: RT.ways, rampA: RT.rampA, rampB: RT.rampB, lipI: RT.lipI, t0: RT.t0, t1: RT.t1,
    bed: def.bed, bedImg, bedAt: [BX, BY], desk: def.desk, stairs: U.stairs, underLights: U.lights, monster: U.monster, slats: U.slats,
    cross, train: def.train, station: def.station, tower: def.tower, robot: def.robot, domino: def.domino, marble: def.marble, wind: def.wind,
    projector: def.projector, nightlight: def.nightlight, window: def.window, door: def.door, lampHead: def.lampHead, knete: def.knete, kneteUnder,
    wash: { x: wm.x, y: wm.y, tg: wtg, nm: wnm }, eraserI: ix([def.eraser[0] + def.eraser[2] / 2, def.eraser[1]]), rulerI: [ix([rx, TA[3] - 10]), ix([rx, TB[1] + 10])] };
}

// which of the patches (plasticine, watercolour: [x, y, ...]) is nearest
function nearestKnete(L, x, y) { let b = 0, bd = 1e12; for (let k = 0; k < L.length; k++) { const dd = (L[k][0] - x) ** 2 + (L[k][1] - y) ** 2; if (dd < bd) { bd = dd; b = k; } } return b; }
