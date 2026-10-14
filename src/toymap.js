import { HALF, TAU, hash, hex, vnoise } from './core.js';
import { nearestIdx } from './bau.js';
import { stampLine } from './volcanomap.js';

// ---------- Spielzimmer: the play mat with its printed road, the wooden toy train on the parquet, the ramp of books onto the bed, the pillow
// (the jump onto the desk), the desk (crayons, an eraser, the paint box, a ruler as a bridge between the two tables), the marble run down to the
// floor, the building-block quarter, the toy car wash ----------
// Terrain: 0 the pile of the rug beside the road and the folds of the duvet (slow like grass), 1 road (the printed road of the play mat, the
// paper road and the wood of the desk, the books of the ramp, the pillow, the ruler), 2 plasticine (like mud, it colours the car), 30 parquet
// (half as slippery as sheet ice), 31 the soft road over the blanket (a little slower), 32 watercolour from the paint box (it does not brake,
// it colours). Codes 30 and up are this track's own (see physics.js).
// Levels (see toys.js): floor, bed, desk. upM marks the pixels that are up on the bed, the desk, the ramp, the ruler or in the marble run: a car
// up there that leaves them falls to the floor.

const K = Object.fromEntries(Object.entries({
  pq0: '#c8915a', pq1: '#bd8650', pq2: '#d29c64', pqS: '#7e5230', pqG: '#ad7844', tape: '#efe6c8', tapeD: '#cfc29c',
  skirt: '#f2ede2', skirtD: '#b8ae9a',
  rug: '#7cc06a', rug1: '#71b45f', rug2: '#8acb78', rugE: '#4a8440', rugE2: '#5d9a50', fringe: '#efe2c0',
  street: '#a8c4a0', streetL: '#c8dcc2', pond: '#9cc8d8', ptree: '#64a856', phouse: '#d8b090', proof: '#c88878',
  road: '#6e747c', road1: '#666c74', road2: '#787e86', roadE: '#f4f4ee', zebra: '#f0f0ea',
  frame: '#7a4e2c', frameL: '#9a6a3e', frameD: '#4e3018', quilt: '#fbf3e2', quilt1: '#f3e8d2', stitch: '#c8a070', quiltE: '#e2d2b4',
  pil: '#eef3fb', pil1: '#dde6f3', pilS: '#a8b6cc', pilL: '#ffffff', face: '#9cb6d8', faceD: '#6e88ac', hem: '#c4d4ea',
  wood0: '#dcb486', wood1: '#d2a978', wood2: '#e4be92', woodG: '#bf9462', woodE: '#8a6238', woodF: '#a87c4c', woodFD: '#74502e',
  paper: '#f8f6ee', paperL: '#cddff0', paperM: '#f0b4b4', pencil: '#5a5a64', paperE: '#d8d4c6',
  pages: '#f4ecd8', pagesD: '#d8ccb0', ruler: '#f2c94c', rulerL: '#f8dc7a', rulerD: '#b88a20', tick: '#3a2a10',
  rail: '#e8c890', railL: '#f4dcae', railD: '#b8945e', groove: '#8a6a40',
  hull: '#ececf0', hullD: '#9a9aa6', dark: '#2a2a32', blue: '#4a8ae8',
}).map(([k, v]) => [k, hex(v)]));
// plasticine and watercolour: main, dark, light
const COLS = [['#e04848', '#a02a2a', '#ff8a7a'], ['#3c6ee0', '#24449a', '#8ab0ff'], ['#f2cc30', '#b8920e', '#fff08a'], ['#40b850', '#24803a', '#9ae49a']].map(a => a.map(hex));
const PATCH = ['#a8cdf0', '#f6e6c4', '#f5b8c8', '#b8e6c8', '#cdbdf0'].map(hex);
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

// terrain, before the ground is painted. S: { MW, MH, def, ter, dist, near, path, tan, nrm, N }
export function* toyTerrain(S) {
  const { MW, MH, def, ter, dist, near, path, N } = S, A = MW * MH;
  // kind: 1 parquet, 2 rug, 3 bed, 4 desk, 5 the books of the ramp, 6 the ruler, 7 the marble run
  const kind = new Uint8Array(A), upM = new Uint8Array(A), alt = new Uint8Array(A);
  const ix = p => nearestIdx(path, p[0], p[1]);
  const [tx, ty, tr] = def.tower, desk = def.desk, gy0 = desk[0][3], gy1 = desk[1][1], [rx, rh] = def.ruler;
  const rampA = ix(def.ramp[0]), rampB = ix(def.ramp[1]), lipI = ix(def.lip), landI = ix(def.land), t0 = ix([tx + tr + 4, ty]), t1 = ix([tx - tr, ty]), runI = ix(def.runup);
  yield;
  for (let j = 0; j < A; j++) {
    if (j % 40000 === 39999) yield;
    const x = j % MW, y = j / MW | 0, road = dist[j] < HALF, keep = ter[j] === 2, i = near[j];
    if (inR(def.bed, x, y)) { kind[j] = 3; upM[j] = 1; if (!keep) ter[j] = inR(def.pillow, x, y) ? 1 : road ? 31 : 0; continue; }
    if (desk.some(q => inR(q, x, y))) { kind[j] = 4; upM[j] = 1; if (!keep) ter[j] = 1; continue; }
    if ((road && i >= t0 - 10 && i <= t1 + 2) || Math.hypot(x + .5 - tx, y + .5 - ty) < tr) { kind[j] = 7; upM[j] = 1; ter[j] = 1; continue; }
    if (road && i >= rampA - 1 && i <= rampB + 1) { kind[j] = 5; upM[j] = 1; ter[j] = 1; continue; }
    if (y >= gy0 && y < gy1 && x >= desk[0][0] && x < desk[0][2] && Math.abs(x + .5 - rx) < rh) { kind[j] = 6; upM[j] = 1; ter[j] = 1; continue; }
    const rug = inRR(def.rug, x, y, 16);
    kind[j] = rug ? 2 : 1;
    if (!keep) ter[j] = rug ? (road ? 1 : 0) : 30;
  }
  yield;
  // watercolour from the open paint box, only on the desk
  for (const [px, py, pr] of def.paints) for (let y = Math.floor(py - pr - 3); y <= py + pr + 3; y++) for (let x = Math.floor(px - pr - 3); x <= px + pr + 3; x++) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    const j = y * MW + x; if (kind[j] !== 4 || ter[j] === 2) continue;
    if (Math.hypot(x + .5 - px, (y + .5 - py) * 1.3) < pr + (vnoise(x * .25, y * .25, 141) - .5) * 5) ter[j] = 32;
  }
  // the clean way round the paint box (a second way on the desk)
  stampLine(def.fork.pts, def.fork.half, j => { if (kind[j] === 4) alt[j] = 1; }, MW, MH);
  yield;
  // how high the road is along the lap (0 floor, 1 bed, 1.25 desk) and on which level a car there is (2 floor, 1 bed, 3 desk)
  const hgt = new Float32Array(N), lv = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    let h = 0;
    if (i >= rampA && i <= rampB) h = (i - rampA) / Math.max(1, rampB - rampA);
    else if (i > rampB && i <= lipI) h = 1;
    else if (i > lipI && i < landI) h = 1 + .25 * (i - lipI) / Math.max(1, landI - lipI);
    else if (i >= landI && i < t0) h = 1.25;
    else if (i >= t0 && i <= t1) h = 1.25 * (1 - (i - t0) / Math.max(1, t1 - t0));
    hgt[i] = h; lv[i] = h < .5 ? 2 : i <= lipI ? 1 : 3;
  }
  return { kind, upM, alt, hgt, lv, rampA, rampB, lipI, landI, t0, t1, runI };
}

// painting, after the ground. S: { MW, MH, def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, sd, RT }
export function* paintToys(S) {
  const { MW, MH, def, d, set, setT, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, sd, RT } = S, A = MW * MH, kind = RT.kind;
  const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < MW && y < MH) set(y * MW + x, c); };
  const dk = (x, y, k) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= MW || y >= MH) return; const i = (y * MW + x) * 4; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; };
  const block = (x, y, rr) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X >= 0 && Y >= 0 && X < MW && Y < MH) wallMask[Y * MW + X] = 1; } };
  const off = j => { const i = near[j], p = path[i]; return (j % MW + .5 - p.x) * nrm[i].x + ((j / MW | 0) + .5 - p.y) * nrm[i].y; };
  const edgeOf = (j, t) => ter[j - 1] !== t || ter[j + 1] !== t || ter[j - MW] !== t || ter[j + MW] !== t;
  // a box on the ground with a shadow to the bottom right (solid things cast one, flat decoration does not)
  const shadowRect = (x0, y0, w, h, ox, oy, k = .72) => { for (let y = y0 + oy; y < y0 + h + oy; y++) for (let x = x0 + ox; x < x0 + w + ox; x++) if (!(x >= x0 && x < x0 + w && y >= y0 && y < y0 + h)) dk(x, y, k); };
  const shadowDisc = (cx, cy, rr, ox, oy, k = .72) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) if (dx * dx + dy * dy <= rr * rr && (dx - ox) ** 2 + (dy - oy) ** 2 > rr * rr) dk(cx + dx, cy + dy, k); };
  const wallsRect = (x0, y0, w, h, r, o = {}) => { for (let y = y0 + r; y <= y0 + h - r + .1; y += r * 1.4) for (let x = x0 + r; x <= x0 + w - r + .1; x += r * 1.4) walls.push({ x, y, r, ...o }); block(x0 + w / 2, y0 + h / 2, Math.max(w, h) / 2 + 4); };
  const nearest = (L, x, y) => { let b = 0, bd = 1e12; L.forEach((m, k) => { const dd = (m[0] - x) ** 2 + (m[1] - y) ** 2; if (dd < bd) { bd = dd; b = k; } }); return b; };
  const [bx0, by0, bx1, by1] = def.bed, desk = def.desk, [ux0, uy0, ux1, uy1] = def.rug, [rx, rh] = def.ruler, gy0 = desk[0][3], gy1 = desk[1][1];
  const DX0 = desk[0][0], DX1 = desk[0][2], FACE = 14, BFACE = 16, zi = nearestIdx(path, def.zebra[0], def.zebra[1]);

  yield;
  // ----- the ground -----
  for (let j = 0; j < A; j++) {
    if (j % 30000 === 29999) yield;
    const x = j % MW, y = j / MW | 0, t = ter[j], kd = kind[j], h = hash(x, y, sd + 40), road = dist[j] < HALF, i = near[j];
    let c;
    if (t === 2) {
      // plasticine: squashed flat, the colour of the tub next to it, fingerprints shine
      const P = COLS[def.knete[nearest(def.mudAt, x, y)]], v = vnoise(x / 3, y / 3, sd + 46);
      c = edgeOf(j, 2) ? P[1] : v > .72 ? P[2] : h < .04 ? P[2] : v < .25 ? shade(P[0], .9) : P[0];
    } else if (t === 32) {
      // watercolour: a thin wet puddle, darker at the rim, a bright streak
      const P = COLS[def.paints[nearest(def.paints, x, y)][3]];
      c = edgeOf(j, 32) ? P[1] : vnoise(x / 4, y / 2, sd + 47) > .7 ? P[2] : mixC(P[0], [255, 255, 255], .15);
    } else if (kd === 3) {
      const e = Math.min(x - bx0, bx1 - 1 - x, y - by0, by1 - 1 - y);
      if (inR(def.pillow, x, y)) {
        // the big pillow: puffy, a seam round it, a little dent where the cars run over it
        const [p0, q0, p1, q1] = def.pillow, pe = Math.min(x - p0, p1 - 1 - x, y - q0, q1 - 1 - y), u = (x - p0) / (p1 - p0) - .4, w = (y - q0) / (q1 - q0) - .4;
        c = pe < 2 ? K.pilS : pe < 4 ? K.pil1 : u * u + w * w < .08 ? K.pilL : (u + w) > .45 ? K.pil1 : K.pil;
        if (pe >= 4 && road && dist[j] < HALF - 6 && h < .25) c = K.pil1;
      } else if (e < 5 && !road) c = e < 1 ? K.frameD : e < 3 ? K.frame : K.frameL; // the wooden frame of the bed
      else {
        // the duvet: patchwork squares with stitched seams, soft folds over it
        const fold = vnoise(x / 26 + y / 70, y / 16, sd + 41), cell = ((x - bx0) / 34 | 0) * 13 + ((y - by0) / 34 | 0);
        const P = PATCH[(hash(cell, 3, sd) * PATCH.length) | 0], seam = ((x - bx0) % 34 === 0 || (y - by0) % 34 === 0) && (x + y) % 4 < 2;
        c = shade(seam ? shade(P, .8) : P, .84 + .24 * fold);
        if (Math.abs(fold - .62) < .025) c = shade(P, 1.12);
        if (road) {
          // the soft way over the blanket: a light flannel band with stitched edges
          c = shade(dist[j] > HALF - 1.5 ? K.quiltE : h < .5 ? K.quilt : K.quilt1, .9 + .14 * fold);
          if (Math.abs(dist[j] - (HALF - 4)) < .8 && i % 4 < 2) c = K.stitch;
        }
      }
    } else if (kd === 4) {
      // the desk: maple boards, the road a long strip of lined paper with pencil edges
      const r0 = desk.find(q => inR(q, x, y)), e = Math.min(x - r0[0], r0[2] - 1 - x, y - r0[1], r0[3] - 1 - y), bd = (x - DX0) / 22 | 0;
      c = [K.wood0, K.wood1, K.wood2][(hash(bd, 5, sd) * 3) | 0];
      if ((x - DX0) % 22 === 0) c = K.woodG; else if (vnoise(x / 2.5, y / 36 + bd * 7, sd + 42) > .74) c = shade(c, .9);
      if (e < 2) c = K.woodE;
      const altJ = RT.alt[j];
      if ((road || altJ) && e >= 2) {
        c = y % 7 === 0 ? K.paperL : (x - DX0) % 160 === 12 ? K.paperM : K.paper;
        if (road && !altJ && dist[j] > HALF - 2.5) c = dist[j] > HALF - 1 ? K.paperE : K.pencil;
        if (altJ && !road) { let rim = false; for (const q of [-2, 2, -2 * MW, 2 * MW]) if (!RT.alt[j + q] && !(dist[j + q] < HALF)) rim = true; if (rim) c = K.pencil; }
      }
    } else if (kd === 5) {
      // the ramp: books lying on top of each other, each one a step higher; the pages show at the front of every book
      const a = (i - RT.rampA) * 2, bk = Math.max(0, a / 22 | 0), fr = a - bk * 22, B = BOOKS[(bk + 1) % BOOKS.length], o = Math.abs(off(j));
      c = o > HALF - 2.5 ? B[1] : fr < 3 ? K.pagesD : fr < 6 ? (y % 2 ? K.pages : K.pagesD) : B[0];
      if (fr >= 6 && Math.abs(o - 12) < 1) c = shade(B[0], 1.15);
    } else if (kd === 6) {
      // the ruler: yellow wood with centimetre marks
      const q = x + .5 - (rx - rh);
      c = q < 1.2 || q > rh * 2 - 1.2 ? K.rulerD : q < 4 && y % 4 === 0 ? K.tick : q < 7 && y % 20 === 0 ? K.tick : vnoise(x / 2, y / 30, sd + 48) > .7 ? K.rulerL : K.ruler;
    } else {
      const rug = kd === 2;
      if (rug) {
        // the play mat: green felt with a printed town (pale side streets, houses, trees, a pond) and the printed road of the race
        const v = vnoise(x / 6, y / 6, sd + 43) * .5 + h * .5, e = Math.min(x - ux0, ux1 - 1 - x, y - uy0, uy1 - 1 - y);
        c = v < .3 ? K.rug1 : v > .75 ? K.rug2 : K.rug;
        for (const [sx0, sy0, sx1, sy1] of def.streets) if (x >= sx0 && x <= sx1 && y >= sy0 && y <= sy1) c = (sx1 - sx0 > sy1 - sy0 ? Math.abs(y - (sy0 + sy1) / 2) < 1 && x % 12 < 6 : Math.abs(x - (sx0 + sx1) / 2) < 1 && y % 12 < 6) ? K.streetL : K.street;
        for (const [qx, qy, w, hh] of def.houses) if (x >= qx && x < qx + w && y >= qy && y < qy + hh) c = y < qy + hh * .55 ? K.proof : K.phouse;
        for (const [qx, qy, qr] of def.ptrees) if (Math.hypot(x - qx, y - qy) < qr) c = shade(K.ptree, Math.hypot(x - qx + 2, y - qy + 2) < qr * .6 ? 1.12 : 1);
        { const [qx, qy, qa, qb] = def.ppond; if (((x - qx) / qa) ** 2 + ((y - qy) / qb) ** 2 < 1) c = K.pond; }
        if (e < 5) c = e < 2 ? K.rugE : K.rugE2;
        if (road && ter[j] === 1) {
          c = v < .3 ? K.road1 : v > .78 ? K.road2 : K.road;
          if (dist[j] > HALF - 3 && dist[j] < HALF - 1) c = K.roadE; else if (dist[j] >= HALF - 1) c = K.rugE;
          else if (Math.abs(off(j)) < 1.3 && i % 14 < 7) c = K.roadE;
          const z = (i - zi + N) % N; if (z < 12 && dist[j] < HALF - 4 && Math.floor(off(j) + 40) % 8 < 4) c = K.zebra;
        }
      } else {
        // parquet: oak planks, staggered, with grain; on the road two strips of masking tape and dashes in the middle
        const row = y / 11 | 0, sh = (row * 37) % 84, pl = hash((x + sh) / 84 | 0, row, sd + 44);
        c = pl < .33 ? K.pq0 : pl < .66 ? K.pq1 : K.pq2;
        if (vnoise(x / 18, y / 1.6, sd + 45 + row) > .68) c = K.pqG;
        if (y % 11 === 0 || (x + sh) % 84 === 0) c = K.pqS;
        if (road) {
          if (dist[j] > HALF - 4 && dist[j] < HALF - 1) c = (x + y) % 5 ? K.tape : K.tapeD;
          else if (Math.abs(off(j)) < 1.4 && i % 18 < 9) c = K.tape;
        }
        // the fringe at both short ends of the rug
        if (y > uy0 + 4 && y < uy1 - 4 && ((x >= ux0 - 7 && x < ux0) || (x >= ux1 && x < ux1 + 7)) && y % 3 === 0) c = K.fringe;
      }
      // the books of the ramp are a little wider than the road
      if (!road && dist[j] < HALF + 4 && i >= RT.rampA && i <= RT.rampB) c = BOOKS[(Math.max(0, ((i - RT.rampA) * 2) / 22 | 0) + 1) % BOOKS.length][1];
      // the front of the bed (its blanket hangs down), the fronts of the two tables
      if (x >= bx0 && x < bx1 && y >= by1 && y < by1 + BFACE) c = (y - by1) > BFACE - 3 ? K.faceD : Math.sin((x + (y - by1) * .3) / 6) > .6 ? K.hem : K.face;
      for (const q of desk) if (x >= q[0] && x < q[2] && y >= q[3] && y < q[3] + FACE) c = y - q[3] > FACE - 3 ? K.woodFD : (x - DX0) % 22 === 0 ? K.woodFD : K.woodF;
    }
    if (x < 6 || y < 6 || x >= MW - 6 || y >= MH - 6) c = Math.min(x, y, MW - 1 - x, MH - 1 - y) === 5 ? K.skirtD : K.skirt; // the skirting board round the room
    set(j, c);
  }
  yield;
  // shadows of the furniture on the floor (the light comes from the window at the top left)
  for (let y = by1 + BFACE; y < by1 + BFACE + 14; y++) for (let x = bx0 + 6; x < bx1 + 30; x++) if (kind[y * MW + x] <= 2) dk(x, y, .7);
  for (let y = by0 + 8; y < by1 + BFACE; y++) for (let x = bx1; x < bx1 + 30; x++) dk(x, y, .72);
  for (const q of desk) for (let y = q[3] + FACE; y < q[3] + FACE + 12 && y < MH; y++) for (let x = q[0] + 6; x < q[2]; x++) if (kind[y * MW + x] <= 2) dk(x, y, .66);
  for (let y = gy0 + FACE; y < gy1; y++) for (let x = DX0; x < DX1; x++) { const j = y * MW + x; if (kind[j] !== 6) dk(x, y, .62); else if (y < gy0 + FACE + 6) dk(x, y, .9); }
  for (let y = desk[0][1] + 8; y < desk[1][3] + FACE; y++) for (let x = DX1; x < DX1 + 16 && x < MW - 6; x++) dk(x, y, .72);
  // the start line (chequered)
  S.band(0, 6, (x, y, a, c) => { if (Math.abs(c) < HALF) set(y * MW + x, ((Math.floor(a + 6) >> 2) + (Math.floor(c + 100) >> 2)) & 1 ? [245, 245, 240] : [34, 30, 28]); });

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
  { const [sx, sy] = def.station; for (let y = sy - 9; y <= sy + 9; y++) for (let x = sx - 20; x <= sx + 20; x++) { const e = Math.min(x - sx + 20, sx + 20 - x, y - sy + 9, sy + 9 - y); setT(x, y, e < 1 ? K.woodFD : y < sy - 2 ? (((x + 40) >> 2) & 1 ? COLS[0][0] : COLS[0][2]) : e < 3 ? K.woodF : K.wood2); }
    shadowRect(sx - 20, sy - 9, 41, 19, 3, 4); wallsRect(sx - 20, sy - 9, 41, 19, 5); }

  yield;
  // ----- the bed: headboard, the small pillow, the teddy (solid for the cars up on the bed) -----
  for (let y = by0 - 8; y < by1 + BFACE; y++) for (let x = bx1; x < bx1 + 22; x++) {
    const e = Math.min(x - bx1, bx1 + 21 - x, y - by0 + 8, by1 + BFACE - 1 - y);
    setT(x, y, e < 1 ? K.frameD : e < 3 ? K.frame : (y - by0) % 46 < 3 ? K.frame : K.frameL);
  }
  for (let y = by0; y < by1; y += 8) walls.push({ x: bx1 + 8, y, r: 8 });
  { const [qx, qy, qw, qh] = def.pillow2; for (let y = qy; y < qy + qh; y++) for (let x = qx; x < qx + qw; x++) { const e = Math.min(x - qx, qx + qw - 1 - x, y - qy, qy + qh - 1 - y); px(x, y, e < 1 ? K.pilS : e < 3 ? K.pil1 : (x - qx) + (y - qy) < 18 ? K.pilL : K.pil); } }
  const [tdx, tdy] = def.teddy, TB = hex('#a8743c'), TBL = hex('#c8945a'), TBD = hex('#7a4e22'), TBM = hex('#e8c89a');
  shadowDisc(tdx, tdy + 8, 26, 7, 8, .7);
  const blob = (cx, cy, rr, c0, c1, c2) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const dd = Math.hypot(dx, dy); if (dd > rr) continue; setT(cx + dx, cy + dy, dd > rr - 1.3 ? c2 : dx + dy < -rr * .4 ? c1 : c0); } };
  blob(tdx - 15, tdy + 18, 7, TB, TBL, TBD); blob(tdx + 15, tdy + 18, 7, TB, TBL, TBD); // feet
  blob(tdx, tdy + 10, 17, TB, TBL, TBD); blob(tdx, tdy + 12, 9, TBM, TBM, TB);           // body, belly
  blob(tdx - 19, tdy + 4, 6, TB, TBL, TBD); blob(tdx + 19, tdy + 4, 6, TB, TBL, TBD);    // arms
  blob(tdx - 11, tdy - 19, 6, TB, TBL, TBD); blob(tdx + 11, tdy - 19, 6, TB, TBL, TBD);  // ears
  blob(tdx, tdy - 9, 13, TB, TBL, TBD); blob(tdx, tdy - 5, 5, TBM, TBM, TB);              // head, snout
  for (const s of [-1, 1]) { setT(tdx + s * 5, tdy - 12, [26, 18, 12]); setT(tdx + s * 5, tdy - 13, [26, 18, 12]); setT(tdx + s * 5 - 1, tdy - 13, [255, 255, 255]); }
  setT(tdx, tdy - 7, [40, 26, 16]); setT(tdx + 1, tdy - 7, [40, 26, 16]); setT(tdx - 11, tdy - 19, TBM); setT(tdx + 11, tdy - 19, TBM);
  for (let k = -3; k <= 3; k++) setT(tdx + k, tdy + 1, k % 2 ? COLS[0][0] : COLS[0][2]); // a red bow tie
  walls.push({ x: tdx, y: tdy - 8, r: 14 }, { x: tdx, y: tdy + 11, r: 17 }, { x: tdx - 18, y: tdy + 4, r: 6 }, { x: tdx + 18, y: tdy + 4, r: 6 });

  yield;
  // ----- the desk: crayons along the road, an eraser on it, the open paint box, the pencil cup, the desk lamp, exercise books, notes -----
  for (const [x0, y0, len, ci] of def.crayons) {
    const P = COLS[ci % 4];
    shadowRect(x0, y0 - 3, len, 7, 2, 3, .78);
    for (let x = x0; x < x0 + len; x++) for (let dy = -3; dy <= 3; dy++) {
      const q = x - x0, tip = len - q, ad = Math.abs(dy);
      if (tip < 8 && ad > tip * .45) continue;
      px(x, y0 + dy, tip < 3 ? P[1] : tip < 8 ? K.wood2 : q < 4 || (q > 8 && q < len - 14) ? (ad === 3 ? P[1] : dy < 0 ? P[2] : P[0]) : (ad === 3 ? K.dark : K.hull));
    }
    for (let x = x0 + 4; x < x0 + len - 2; x += 7) walls.push({ x, y: y0, r: 4 });
  }
  { const [ex, ey, ew, eh] = def.eraser; shadowRect(ex, ey, ew, eh, 3, 4);
    for (let y = ey; y < ey + eh; y++) for (let x = ex; x < ex + ew; x++) { const e = Math.min(x - ex, ex + ew - 1 - x, y - ey, ey + eh - 1 - y); px(x, y, e < 1 ? hex('#7a3a4a') : x - ex < ew * .45 ? (e < 2 ? hex('#ff9ab0') : hex('#f47a96')) : (e < 2 ? hex('#7ab0ff') : hex('#4a86e8'))); }
    for (let x = ex + 5; x < ex + ew - 2; x += 7) walls.push({ x, y: ey + eh / 2, r: 6 }); }
  { const [bx, by, bw, bh] = def.paintbox; shadowRect(bx, by, bw, bh, 3, 3);
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
      const e = Math.min(x - bx, bx + bw - 1 - x, y - by, by + bh - 1 - y), q = (x - bx - 3) / ((bw - 6) / 6) | 0, inPan = e >= 3 && (x - bx - 3) % ((bw - 6) / 6) > 1.5;
      px(x, y, e < 1 ? K.dark : e < 3 ? hex('#3a5aa8') : inPan ? [COLS[0][0], COLS[3][0], COLS[1][0], COLS[2][0], hex('#8a4ad0'), hex('#f08a2a')][q % 6] : hex('#e8e8ee'));
    }
    for (let x = bx + 5; x < bx + bw - 2; x += 7) walls.push({ x, y: by + bh / 2, r: 6 });
    // a brush lying across the box, dipped in blue
    for (let k = 0; k < 30; k++) { px(bx + 6 + k, by - 3 + k * .1, k < 6 ? COLS[1][0] : k < 9 ? K.hullD : hex('#c84a2a')); } }
  for (const [nx, ny, nw, nh, ci] of def.hefte) {
    const P = COLS[ci % 4];
    for (let y = ny; y < ny + nh; y++) for (let x = nx; x < nx + nw; x++) { const e = Math.min(x - nx, nx + nw - 1 - x, y - ny, ny + nh - 1 - y); px(x, y, e < 1 ? P[1] : x - nx < 3 ? shade(P[0], .8) : Math.abs(y - ny - nh * .3) < 4 && x - nx > nw * .25 && x - nx < nw * .75 ? K.paper : P[0]); }
    shadowRect(nx, ny, nw, nh, 2, 2, .85);
  }
  for (const [nx, ny, ci] of def.notes) for (let y = ny; y < ny + 14; y++) for (let x = nx; x < nx + 14; x++) px(x, y, y - ny < 3 ? shade(COLS[ci][2], .92) : (y - ny) % 4 === 0 && x - nx > 2 && x - nx < 11 ? shade(COLS[ci][2], .8) : COLS[ci][2]);
  { const [cx, cy] = def.cup; shadowDisc(cx, cy, 11, 4, 5);
    for (let dy = -11; dy <= 11; dy++) for (let dx = -11; dx <= 11; dx++) { const dd = Math.hypot(dx, dy); if (dd <= 11) setT(cx + dx, cy + dy, dd > 9.8 ? K.dark : dd > 8 ? hex('#e84a8a') : hex('#3a2430')); }
    for (const [ax, ay, ci] of [[-4, -3, 0], [3, -5, 1], [5, 3, 2], [-3, 5, 3], [0, 0, 1]]) for (let k = 0; k < 4; k++) setT(cx + ax + k * .5, cy + ay - k, k < 2 ? COLS[ci][0] : K.wood2);
    walls.push({ x: cx, y: cy, r: 11 }); block(cx, cy, 14); }
  { const [lpx, lpy] = def.lamp; shadowDisc(lpx, lpy, 13, 4, 5);
    for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) { const dd = Math.hypot(dx, dy); if (dd <= 13) setT(lpx + dx, lpy + dy, dd > 11.8 ? K.dark : dx + dy < -6 ? hex('#5a9ae8') : hex('#3a72c8')); }
    for (let k = 0; k < 26; k++) { setT(lpx - k * .7, lpy - k * .55, K.dark); setT(lpx - k * .7 + 1, lpy - k * .55, hex('#9aa0aa')); }
    const hx = lpx - 20, hy = lpy - 16;
    for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) { const dd = Math.hypot(dx, dy * 1.3); if (dd <= 9) setT(hx + dx, hy + dy, dd > 8 ? K.dark : dd < 4 ? hex('#fff6c8') : hex('#3a72c8')); }
    walls.push({ x: lpx, y: lpy, r: 13 }); block(lpx, lpy, 16); }

  yield;
  // ----- the marble run: a round wooden tower with a colourful spiral track, the funnel at the desk, the way out at the bottom, the outlet
  // for the marbles (all above the cars: the cars inside are drawn over it, see toys.js) -----
  const [tx, ty, tr] = def.tower, RC = [COLS[0], COLS[2], COLS[1], COLS[3]];
  shadowDisc(tx, ty, tr + 2, 8, 10, .62);
  for (let dy = -tr - 2; dy <= tr + 2; dy++) for (let dx = -tr - 2; dx <= tr + 2; dx++) {
    const dd = Math.hypot(dx, dy); if (dd > tr + 1) continue;
    const a = (Math.atan2(dy, dx) + TAU) % TAU, pitch = (tr - 12) / 2.4, u = (tr - 4 - dd) / pitch + a / TAU, k = u - Math.floor(u), ring = Math.floor(u) & 3;
    let c = dd > tr - .5 ? K.woodFD : dd > tr - 4 ? K.woodF : dd < 8 ? (dd < 6 ? K.wood2 : K.woodFD) : K.wood1;
    if (dd >= 8 && dd <= tr - 4) c = k < .5 ? (k < .08 || k > .42 ? RC[ring][1] : RC[ring][0]) : k < .56 ? K.woodFD : K.wood1;
    setT(tx + dx, ty + dy, c);
  }
  // the funnel on the desk side and the way out on the floor side (the road under it is the tube, see toys.js)
  for (let y = ty - HALF - 4; y <= ty + HALF + 4; y++) for (let x = tx + tr - 6; x < DX0 + 4; x++) { const ao = Math.abs(y - ty); setT(x, y, ao > HALF + 2 ? K.dark : ao > HALF - 1 ? COLS[0][1] : ((x + y) >> 2) & 1 ? COLS[0][0] : COLS[0][2]); }
  for (let y = ty - 12; y <= ty + 12; y++) for (let x = tx - tr - 2; x < tx - tr + 6; x++) setT(x, y, Math.abs(y - ty) > 10 ? K.dark : hex('#2a1a10'));
  const [mox, moy] = def.marble.out;
  for (let k = 0; k < 14; k++) for (let o = -4; o <= 4; o++) setT(mox + 8 - k + o * .3, moy - 10 + k * .7 + o, Math.abs(o) === 4 ? K.woodFD : COLS[1][0]);
  for (let a = 0; a < TAU; a += .2) walls.push({ x: tx + Math.cos(a) * (tr + 3), y: ty + Math.sin(a) * (tr + 3), r: 5, down: true });

  yield;
  // ----- the floor: the wall of building blocks across the room (nobody cuts through the middle), the castle in the building-block quarter,
  // the doll's house, the toy box, the bookshelf, the window, the night stand with the star projector, the dock of the robot vacuum -----
  const brick = (x0, y0, w, h, c, studs, top) => {
    const put = top ? setT : px;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const ex = x - x0, ey = y - y0, e = Math.min(ex, w - 1 - ex, ey, h - 1 - ey); put(x, y, e < 1 ? shade(c, .45) : ex < 2 || ey < 2 ? shade(c, 1.22) : ex > w - 3 || ey > h - 3 ? shade(c, .78) : c); }
    if (studs) for (let sy = y0 + 4; sy < y0 + h - 2; sy += 8) for (let sx = x0 + 4; sx < x0 + w - 2; sx += 8) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) put(sx + dx, sy + dy, dx + dy < -1 ? shade(c, 1.3) : dx + dy > 1 ? shade(c, .75) : c);
  };
  { const [wx0, wx1, wy] = def.blockWall;
    for (let x = wx0, k = 0; x < wx1; x += 16, k++) {
      const c = BLOCKS[(hash(k, 7, sd) * BLOCKS.length) | 0], studs = hash(k, 8, sd) < .45, w = Math.min(16, wx1 - x);
      shadowRect(x, wy - 8, w, 16, 4, 5, .7); brick(x, wy - 8, w, 16, c, studs, false);
      if (hash(k, 9, sd) < .3) { const c2 = BLOCKS[(hash(k, 10, sd) * BLOCKS.length) | 0]; brick(x + 1, wy - 18, Math.min(14, w - 1), 14, c2, !studs, true); }
      for (let q = 0; q < w; q += 8) walls.push({ x: x + q + 4, y: wy, r: 9 });
    }
  }
  { const [cx0, cy0, cx1, cy1] = def.castle;
    shadowRect(cx0, cy0, cx1 - cx0, cy1 - cy0, 5, 6, .66);
    for (let x = cx0; x < cx1; x += 12) for (const y of [cy0, cy1 - 12]) brick(x, y, Math.min(12, cx1 - x), 12, BLOCKS[((x / 12 | 0) + (y > cy0 ? 2 : 0)) % 5], true, false);
    for (let y = cy0 + 12; y < cy1 - 12; y += 12) for (const x of [cx0, cx1 - 12]) brick(x, y, 12, 12, BLOCKS[((y / 12 | 0) + 1) % 5], false, false);
    for (let y = cy0 + 12; y < cy1 - 12; y++) for (let x = cx0 + 12; x < cx1 - 12; x++) px(x, y, hash(x, y, sd + 50) < .5 ? K.pq1 : K.pq2);
    for (const [qx, qy] of [[cx0 - 4, cy0 - 4], [cx1 - 16, cy0 - 4], [cx0 - 4, cy1 - 16], [cx1 - 16, cy1 - 16]]) { brick(qx, qy - 8, 20, 20, BLOCKS[0], true, true); for (let k = 0; k < 20; k += 6) brick(qx + k, qy - 14, 4, 6, BLOCKS[3], false, true); }
    for (let y = cy0; y <= cy1; y += 8) for (let x = cx0; x <= cx1; x += 8) walls.push({ x, y, r: 7 });
    block((cx0 + cx1) / 2, (cy0 + cy1) / 2, (cx1 - cx0) / 2 + 6); }
  { const [hx, hy, hw, hh] = def.dollhouse;
    shadowRect(hx, hy, hw, hh, 6, 8, .66);
    for (let y = hy; y < hy + hh; y++) for (let x = hx; x < hx + hw; x++) {
      const ey = y - hy, ex = x - hx, top = ey < hh / 2, ridge = Math.abs(ey - hh / 2) < 1.5, e = Math.min(ex, hw - 1 - ex, ey, hh - 1 - ey);
      setT(x, y, e < 1 ? hex('#5a2418') : ridge ? hex('#7a3020') : (ey % 6 === 0 || (ex + (Math.floor(ey / 6) % 2) * 5) % 10 === 0) ? hex('#a8443a') : top ? hex('#e8705a') : hex('#c85a4a'));
    }
    for (let y = hy + 6; y < hy + 18; y++) for (let x = hx + hw - 22; x < hx + hw - 12; x++) setT(x, y, y < hy + 8 ? hex('#3a2a2a') : hex('#d8c8b0')); // the chimney
    wallsRect(hx, hy, hw, hh, 9); }
  { const [bx, by, bw, bh] = def.toybox; shadowRect(bx, by, bw, bh, 5, 6, .68);
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) { const e = Math.min(x - bx, bx + bw - 1 - x, y - by, by + bh - 1 - y); px(x, y, e < 1 ? K.woodFD : e < 4 ? K.woodF : (x - bx) % 12 === 0 ? K.woodG : K.wood1); }
    for (const [qx, qy, qr, ci] of [[bx + 14, by + 14, 8, 0], [bx + 32, by + 22, 6, 2], [bx + 46, by + 12, 7, 1]]) for (let dy = -qr; dy <= qr; dy++) for (let dx = -qr; dx <= qr; dx++) if (dx * dx + dy * dy <= qr * qr) setT(qx + dx, qy + dy, dx * dx + dy * dy > (qr - 1.2) ** 2 ? COLS[ci][1] : dx + dy < -2 ? COLS[ci][2] : COLS[ci][0]);
    wallsRect(bx, by, bw, bh, 8); }
  { const [sx0, sx1] = def.shelf;
    for (let x = sx0; x < sx1; x++) for (let y = 6; y < 30; y++) px(x, y, y > 26 ? K.woodFD : K.woodF);
    for (let x = sx0 + 3, k = 0; x < sx1 - 6; k++) { const w = 5 + (hash(k, 11, sd) * 5 | 0), hh = 14 + (hash(k, 12, sd) * 8 | 0), B = BOOKS[k % BOOKS.length]; for (let y = 26 - hh; y < 26; y++) for (let q = 0; q < w; q++) px(x + q, y, q === 0 || y === 26 - hh ? B[1] : Math.abs(y - 26 + hh * .6) < 1 ? K.pages : B[0]); x += w + 1; }
    shadowRect(sx0, 6, sx1 - sx0, 24, 3, 6, .8);
    for (let x = sx0 + 6; x < sx1; x += 10) walls.push({ x, y: 18, r: 10 }); }
  { const [wx0, wx1] = def.window;
    for (let x = wx0; x < wx1; x++) for (let y = 0; y < 12; y++) px(x, y, y < 2 || y > 9 || (x - wx0) % 60 < 3 ? hex('#f4f4f4') : y < 5 ? hex('#cfe8ff') : hex('#9ccaf0'));
    for (const cx0 of [wx0 - 22, wx1 - 4]) for (let x = cx0; x < cx0 + 26; x++) for (let y = 4; y < 34; y++) { const f = Math.sin((x - cx0) / 2.2); setT(x, y, y > 31 ? hex('#a83a5a') : f > .5 ? hex('#f48aa8') : f < -.5 ? hex('#c85a7a') : hex('#e87094')); } }
  { const [nx, ny, nw, nh] = def.stand; shadowRect(nx, ny, nw, nh, 4, 6, .7);
    for (let y = ny; y < ny + nh; y++) for (let x = nx; x < nx + nw; x++) { const e = Math.min(x - nx, nx + nw - 1 - x, y - ny, ny + nh - 1 - y); px(x, y, e < 1 ? K.woodFD : e < 3 ? K.woodF : K.wood0); }
    const [qx, qy] = def.projector;
    for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) { const dd = Math.hypot(dx, dy); if (dd <= 12) setT(qx + dx, qy + dy, dd > 11 ? K.dark : hash(dx + 20, dy + 20, 51) < .1 ? hex('#ffe9a0') : dx + dy < -8 ? hex('#3a4aa0') : hex('#24306e')); }
    wallsRect(nx, ny, nw, nh, 8); }
  { const [qx, qy] = def.robot.dock;
    for (let y = qy - 22; y <= qy + 22; y++) for (let x = qx - 10; x <= qx + 10; x++) { const e = Math.min(x - qx + 10, qx + 10 - x, y - qy + 22, qy + 22 - y); px(x, y, e < 1 ? K.dark : e < 3 ? K.hullD : x > qx + 6 && Math.abs(y - qy) < 6 ? hex('#c8a83a') : K.hull); }
    shadowRect(qx - 10, qy - 22, 21, 45, 3, 4, .78); }
  { const [nlx, nly] = def.nightlight; for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const dd = Math.hypot(dx, dy); if (dd <= 6 && Math.hypot(dx - 3, dy - 2) > 4.5) px(nlx + dx, nly + dy, dd > 5 ? hex('#b89a40') : hex('#ffe9a0')); } }

  yield;
  // ----- little things on the floor: the tubs of plasticine (solid), a ball, the rubber duck, socks, puzzle pieces, a drawing -----
  for (const [qx, qy, ci] of def.tubs) {
    const P = COLS[ci]; shadowDisc(qx, qy, 8, 3, 4);
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) { const dd = Math.hypot(dx, dy); if (dd <= 8) px(qx + dx, qy + dy, dd > 7 ? K.dark : dd > 5.5 ? K.hull : vnoise(dx / 2 + qx, dy / 2, 52) > .6 ? P[2] : P[0]); }
    walls.push({ x: qx, y: qy, r: 8 });
  }
  { const [qx, qy, qr] = def.ball; shadowDisc(qx, qy, qr, 5, 6, .66);
    for (let dy = -qr; dy <= qr; dy++) for (let dx = -qr; dx <= qr; dx++) { const dd = Math.hypot(dx, dy); if (dd > qr) continue; const a = Math.atan2(dy, dx); setT(qx + dx, qy + dy, dd > qr - 1.2 ? K.dark : dd < qr * .3 && dx + dy < 0 ? [255, 255, 255] : COLS[(((a + Math.PI) / (Math.PI / 2)) | 0) % 4][dx + dy < 0 ? 0 : 1]); }
    walls.push({ x: qx, y: qy, r: qr - 1 }); }
  { const [qx, qy] = def.duck, Y = COLS[2];
    for (let dy = -6; dy <= 6; dy++) for (let dx = -8; dx <= 8; dx++) if ((dx / 8) ** 2 + (dy / 6) ** 2 <= 1) setT(qx + dx, qy + dy, (dx / 8) ** 2 + (dy / 6) ** 2 > .8 ? Y[1] : Y[0]);
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (dx * dx + dy * dy <= 16) setT(qx + 6 + dx, qy - 6 + dy, dx * dx + dy * dy > 11 ? Y[1] : Y[2]);
    setT(qx + 11, qy - 6, hex('#f08a2a')); setT(qx + 12, qy - 6, hex('#f08a2a')); setT(qx + 7, qy - 7, K.dark); }
  for (const [qx, qy, ci] of def.socks) for (let k = 0; k < 18; k++) for (let o = -3; o <= 3; o++) px(qx + k + (k > 12 ? (k - 12) * .5 : 0), qy + o + (k > 12 ? (k - 12) * .9 : 0), Math.abs(o) === 3 ? shade(COLS[ci][0], .7) : k % 6 < 3 ? COLS[ci][0] : K.hull);
  for (const [qx, qy, ci] of def.puzzle) for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
    const inBox = Math.abs(dx) <= 5 && Math.abs(dy) <= 5, knob = Math.hypot(dx - 6, dy) <= 2.5 || Math.hypot(dx, dy + 6) <= 2.5; if (!inBox && !knob) continue;
    px(qx + dx, qy + dy, Math.abs(dx) === 5 || Math.abs(dy) === 5 ? COLS[ci][1] : COLS[ci][0]);
  }
  { const [qx, qy] = def.sheet;
    for (let y = qy; y < qy + 34; y++) for (let x = qx; x < qx + 46; x++) px(x, y, x === qx || y === qy + 33 ? K.paperE : K.paper);
    for (let a = 0; a < TAU; a += .3) px(qx + 10 + Math.cos(a) * 5, qy + 9 + Math.sin(a) * 5, COLS[2][0]); // a sun
    for (let k = 0; k < 14; k++) { px(qx + 22 + k, qy + 26, COLS[0][0]); px(qx + 22, qy + 26 - k * .7, COLS[0][0]); px(qx + 36, qy + 26 - k * .7, COLS[0][0]); px(qx + 22 + k * .5, qy + 16 - k * .4, COLS[0][1]); px(qx + 36 - k * .5, qy + 16 - k * .4, COLS[0][1]); }
    for (let x = qx + 2; x < qx + 44; x++) px(x, qy + 30 + Math.sin(x / 3) * 1.2, COLS[3][0]); }

  yield;
  // ----- the toy car wash: a plastic floor with slits, two yellow posts and a red beam over the road; the brushes turn (see toys.js) -----
  const wi = nearestIdx(path, def.washAt[0], def.washAt[1]), wp = path[wi], wtg = tan[wi], wnm = nrm[wi];
  S.band(wi, 16, (x, y, a, c) => {
    const j = y * MW + x, ac = Math.abs(c), aa = Math.abs(a);
    if (ac < HALF && aa < 14) { washMask[j] = 1; set(j, ((Math.floor(a + 20) % 4 === 0 && ac < HALF - 4) ? hex('#5a9ac8') : (x + y) % 2 ? hex('#a8d4f0') : hex('#b8dcf4'))); }
    if (aa < 3 && ac <= HALF + 10) setT(x, y, aa > 2 ? hex('#a82a2a') : ((Math.floor(c + 100) >> 2) & 1) ? hex('#ffffff') : hex('#e84a4a'));
    if (ac > HALF + 3 && ac <= HALF + 10 && aa < 6) setT(x, y, ac > HALF + 8 || aa > 4.5 ? hex('#b8920e') : hex('#f2cc30'));
  });
  for (const s of [-1, 1]) for (let q = -4; q <= 4; q += 4) walls.push({ x: wp.x + wnm.x * s * (HALF + 7) + wtg.x * q, y: wp.y + wnm.y * s * (HALF + 7) + wtg.y * q, r: 4 });

  yield;
  // ----- the furniture is solid for the cars on the floor (down: only them), the cars up there fall over the edge instead -----
  const ramp = (x, y) => { const q = nearestIdx(path, x, y); return Math.hypot(path[q].x - x, path[q].y - y) < HALF + 10 && q >= RT.rampA - 6 && q <= RT.rampB + 6; };
  const fur = (x, y) => { if (!ramp(x, y)) walls.push({ x, y, r: 6, down: true }); };
  for (let x = bx0; x <= bx1; x += 8) { fur(x, by0 - 2); fur(x, by1 + BFACE - 4); }
  for (let y = by0; y <= by1 + BFACE; y += 8) fur(bx0 - 4, y);
  const DY0 = desk[0][1], DY1 = desk[1][3] + FACE;
  for (let x = DX0; x <= DX1; x += 8) { fur(x, DY0 - 3); fur(x, DY1 - 4); }
  for (let y = DY0; y <= DY1; y += 8) { if (Math.abs(y - ty) > HALF + 8) fur(DX0 - 4, y); fur(DX1 + 4, y); }

  // the pillow throws the cars over the gap onto the desk (a jump like the dunes; too slow and you land on the floor)
  const [jx, jy] = def.lip, ltg = tan[RT.lipI];
  const jumps = [{ x: jx, y: jy, tx: ltg.x, ty: ltg.y, lo: -HALF - 6, hi: HALF + 6, vz: 170 }];
  const ix = p => nearestIdx(path, p[0], p[1]);
  return { jumps, pushes: [], alt: RT.alt, kind, upM: RT.upM, hgt: RT.hgt, lv: RT.lv, rampA: RT.rampA, rampB: RT.rampB, lipI: RT.lipI, landI: RT.landI, t0: RT.t0, t1: RT.t1, runI: RT.runI,
    cross, train: def.train, station: def.station, tower: def.tower, robot: def.robot, domino: def.domino, marble: def.marble, wind: def.wind, projector: def.projector, nightlight: def.nightlight, window: def.window,
    wash: { i: wi, x: wp.x, y: wp.y, tg: wtg, nm: wnm },
    rulerI: [ix([rx, gy0 - 10]), ix([rx, gy1 + 10])], eraserI: ix([def.eraser[0] + def.eraser[2] / 2, def.eraser[1]]), forkI: [ix(def.fork.pts[0]), ix(def.fork.pts[def.fork.pts.length - 1])] };
}
