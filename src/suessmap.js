import { HALF, TAU, clamp, hash, hex, mk, smooth, vnoise } from './core.js';
import { nearestIdx, paintTools, startLine } from './bau.js';
import { edgeCircles, smin, stampWay } from './kit.js';

// ---------- Süßigkeitenland Rev 2 (plaene/SUESS_REV2.md): the land round the chocolate mountain ----------
// The chocolate comes out of the fountain on the summit, falls in cascades down the mountain, runs under the marshmallows and the waffle bridge
// into the lake in the middle (nobody cuts across) and out at the bottom edge under the brittle bridge. Course: the start straight on the left
// (north) past the gingerbread village, the lollipop forest (an open field of icing; three caramel brooks run from caramel springs at its hedge
// into ponds, gummy-bear trampolines throw you over them), the caramel moor (the cookie road through it, the brittle lane round it), the
// candyfloss pass up the west flank of the mountain, the dip with the waffle bridge (or straight on over the marshmallows: they bounce), the
// descent into the sweet factory (conveyor belts and the press on the fast way, the maintenance walk beside it), the brittle bridge, the fizz
// field and the lemonade bay to the line.
// Contrast (the user's note on the prototype): what is clean to drive is dark (liquorice, the cookie road, the brittle lane) or very light (the
// icing of the forest, the tiles of the factory); everything sticky is a middle amber (caramel) or loud pink (bubblegum) with a dark rim and
// glossy streaks; flat chocolate is milk brown with a cream rim. Nothing golden lies on golden brown.
// Terrain: 1 liquorice road (also the lanes and the bay), 0 sugar ground (slow like grass), 2 flat chocolate (event schoko), 3 –, 4 fizz pad,
// 5 deep chocolate (river, lake: you sink, you come out brown), 110 icing (the open field of the forest), 111 caramel (sticks for a moment after
// you leave it), 112 bubblegum (holds you), 113 conveyor belt (the push comes from `pushes`), 114 marshmallow (springy stones).
export const ICING = 110, CARA = 111, GUM = 112, BELT = 113, MARSH = 114;
// what a pixel is for the painting (kind)
export const KR = { mtn: 1, slope: 2, hedge: 3, fwall: 4, floor: 5, grate: 6, cookie: 7, island: 8, spur: 9, path: 10, bay: 11, cascade: 12, rill: 13, spring: 14 };

const K = Object.fromEntries(Object.entries({
  lic: '#2a2028', lic1: '#241b22', lic2: '#30262e', licE: '#0e080c', licH: '#5e4e5c', licH2: '#7a6a78', dash: '#fff4fa',
  fi: '#fde0ec', fi1: '#fad2e2', fi2: '#fff0f6', fiD: '#f0bcd2',
  ca: '#d88a1c', ca1: '#c47812', ca2: '#e69a2a', caH: '#ffdc8a', caE: '#4a2604', caE2: '#7a4410',
  ck: '#3e2a22', ck1: '#35221a', ck2: '#4a3428', ckE: '#1a0e08', ckDot: '#f4e6d0',
  br: '#4a3220', br1: '#3e2a1a', brN: '#e8c890', brN2: '#c8a060', brE: '#1e120a',
  isl: '#f0d8a0', isl1: '#e2c488', islS: '#b88a48', islE: '#5a3a18',
  dp: '#40200f', dp1: '#4a2615', dp2: '#56301c', dpS: '#70422a', dpH: '#a07050', dpE: '#2a120a',
  m0: '#6a3e24', m1: '#5a3420', m2: '#7a4a2c', mE: '#2a140a', cap: '#fff6ee', cap1: '#f2e4d8',
  gum: '#ff5aa8', gumH: '#ffb3d6', gumD: '#b0286a',
  wa: '#e8b464', waR: '#f6d08a', waP: '#c88a40', waE: '#7a4a1c',
  ms: '#fffafc', ms1: '#fff0f6', msS: '#f0cfe0', msE: '#b07898', msP: '#ffc8e0',
  le: '#fff27a', le1: '#ffe85a', le2: '#fff8b8', leE: '#e0b020',
  belt: '#8a9098', belt1: '#7a8088', beltL: '#c8ccd2', beltD: '#3a3e44',
  tile: '#f6eef2', tile1: '#e8dae2', tileJ: '#c8b4c0', gr: '#6a7078', grD: '#3a3e44', grL: '#9aa0a8',
  cane: '#e8344a', caneW: '#fff8fa', caneE: '#5a0e1a',
  gb: '#b8743a', gb1: '#a8662e', gbD: '#7a4620', gbL: '#d08848', icg: '#ffffff',
  dough: '#e0a060', doughD: '#b07438', pink: '#ff9ac8', pinkL: '#ffc4e0',
}).map(([k, v]) => [k, hex(v)]));

const SPR = ['#ff4d6d', '#ffd93d', '#6bcb77', '#4d96ff', '#9b5de5', '#ffffff', '#ff9f43'].map(hex);
const LOLLI = [['#ff4d6d', '#ffffff'], ['#ffd93d', '#ff9f43'], ['#6bcb77', '#ffffff'], ['#4d96ff', '#bfe0ff'], ['#9b5de5', '#ffc4e0'], ['#ff7ab8', '#fff27a']].map(p => p.map(hex));
// glass walls of the factory: stripes of boiled sweets
const GLASS = [['#ff9ccb', '#ffd0e6'], ['#9ce6d8', '#d4f6ee']].map(p => p.map(hex));
// the gummy bears (trampolines and decoration)
export const BEARS = ['#ff4d4d', '#ffb02e', '#ffe14d', '#5ad15a', '#ffffff', '#ff7ab8'];

// the sprinkles of the icing: one tile of 64 x 64 (colour number + 1, 0 = none), made once, looked up per pixel (fast)
let TILE = null;
function sprinkleTile() {
  if (TILE) return TILE;
  TILE = new Uint8Array(64 * 64);
  for (let k = 0; k < 46; k++) {
    const x = (hash(k, 1, 301) * 64) | 0, y = (hash(k, 2, 301) * 64) | 0, v = hash(k, 3, 301) < .5, c = 1 + ((hash(k, 4, 301) * SPR.length) | 0);
    for (let q = 0; q < 3; q++) TILE[((y + (v ? q : 0)) & 63) * 64 + ((x + (v ? 0 : q)) & 63)] = c;
  }
  return TILE;
}

const segD = (x, y, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1); return Math.hypot(x - ax - dx * t, y - ay - dy * t); };
const inBox = (x, y, MW, MH) => x >= 0 && y >= 0 && x < MW && y < MH;

// terrain, before the ground is painted. S: { MW, MH, def, ter, dist, near, path, tan, nrm, N, deep }
export function* suessTerrain(S) {
  const { MW, MH, def, ter, dist, path, tan, nrm, N, deep } = S, A = MW * MH, sd = 91;
  const alt = new Uint8Array(A), kind = new Uint8Array(A), brookM = new Uint8Array(A);
  const { off } = paintTools(S), idx = p => nearestIdx(path, p[0], p[1]);
  yield;

  // ----- the chocolate mountain: a cone round the fountain; solid inside (but never near the road), its foot is a slope of cocoa-dusted sugar;
  // the river falls down it in cascades -----
  // its outline: the radius by the angle round the summit (a table: cheap to ask for every pixel)
  const [mx, my, mr] = def.mountain, RA = new Float32Array(721);
  for (let k = 0; k <= 720; k++) { const a = k / 720 * TAU, u = Math.cos(a) * 3 + 9, v = Math.sin(a) * 3 + 9; RA[k] = mr + (vnoise(u, v, sd + 1) - .5) * 22 + (vnoise(u * 4, v * 4, sd + 2) - .5) * 6; }
  const Rm = (x, y) => RA[Math.round((Math.atan2(y + .5 - my, x + .5 - mx) / TAU + 1) % 1 * 720)];
  const mb = [Math.max(0, mx - mr - 50), Math.max(0, my - mr - 50), Math.min(MW - 1, mx + mr + 50), Math.min(MH - 1, my + mr + 50)];
  for (let y = mb[1]; y <= mb[3]; y++) for (let x = mb[0]; x <= mb[2]; x++) {
    const j = y * MW + x, d = Math.hypot(x + .5 - mx, y + .5 - my), R = Rm(x, y);
    if (d < R) { if (deep[j]) kind[j] = KR.cascade; else if (ter[j] === 0) kind[j] = dist[j] > HALF + 18 ? KR.mtn : KR.slope; }
    else if (d < R + 28 && ter[j] === 0) kind[j] = KR.slope;
  }
  const mtnWalls = edgeCircles((x, y) => inBox(x, y, MW, MH) && kind[y * MW + x] !== KR.mtn && kind[y * MW + x] !== KR.cascade, mb[0], mb[1], mb[2], mb[3], 4, 4, 5);
  // the rills the chocolate streams of the event run down (dry grooves you can see before they fill)
  for (const [pts] of def.streams) stampWay(pts.map(p => [p[0], p[1], 20]), 3, j => { if (kind[j] === KR.mtn || kind[j] === KR.slope || (ter[j] === 0 && !kind[j])) kind[j] = KR.rill; }, MW, MH);
  yield;

  // ----- the marshmallows (stepping stones, road already: tracks.js) and the liquorice path over them -----
  for (const [sx, sy, sr, st = 1] of def.stones) for (let y = Math.floor(sy - sr * st - 3); y <= sy + sr * st + 3; y++) for (let x = Math.floor(sx - sr * st - 3); x <= sx + sr * st + 3; x++) {
    const j = y * MW + x; if (inBox(x, y, MW, MH) && deep[j] && ter[j] === 1 && dist[j] >= HALF) { ter[j] = MARSH; alt[j] = 1; }
  }
  const stonePts = stampWay(def.stonePath.pts, def.stonePath.half, j => { if (ter[j] === 0) { ter[j] = 1; kind[j] = KR.path; alt[j] = 1; } else if (ter[j] === MARSH) alt[j] = 1; }, MW, MH);
  // a hop on every marshmallow (soft: no spin when you land), the way you cross them (east)
  const hops = def.stones.map(([sx, sy]) => ({ x: sx, y: sy, tx: 1, ty: 0, lo: -11, hi: 11, vz: 52, soft: true, marsh: true }));
  yield;

  // the brittle lane round the moor (stamped first: the hedge of the forest keeps away from it)
  const spurNear = new Uint8Array(A);
  const spurPts = stampWay(def.spur.pts, def.spur.half + 9, (j, dd) => { spurNear[j] = 1; if (dd < def.spur.half && dist[j] >= HALF && ter[j] !== 5) { ter[j] = 1; kind[j] = KR.spur; alt[j] = 1; } }, MW, MH);

  // ----- the lollipop forest: an open field of icing round the road, walled in by a hedge of candy canes (one shape, smooth), the road itself
  // is icing too (the liquorice dashes show the way) -----
  const F = def.forest, iF0 = idx(F.from), iF1 = idx(F.to), nF = (iF1 - iF0 + N) % N, R = F.r + 30;
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
    if (n % 90 === 87) yield;
  }
  for (let k = 0; k < dC.length; k++) dC[k] = Math.sqrt(dC[k]);
  const wall0 = (x, y, k) => {
    let f = F.r + (vnoise(x * .025, y * .025, sd + 6) - .5) * 30 + (vnoise(x * .1, y * .1, sd + 7) - .5) * 8 - dC[k];
    if (f > -20) for (const [ax, ay, cx2, cy2, w] of F.ridges) f = smin(f, segD(x, y, ax, ay, cx2, cy2) - w - (vnoise(x * .15, y * .15, sd + 14) - .5) * 5, 12);
    return f;
  };
  const fieldM = new Uint8Array(A);
  for (let y = by0; y <= by1; y++) {
    if (y % 50 === 49) yield;
    for (let x = bx0; x <= bx1; x++) {
      const k = (y - by0) * BW + x - bx0, j = y * MW + x; if (nI[k] <= 3 || nI[k] >= nF - 3 || deep[j]) continue;
      if (dC[k] > F.r + 50) continue;
      const f = wall0(x, y, k);
      if (kind[j] === KR.spur || spurNear[j]) continue;
      if (f > 0) { ter[j] = ICING; alt[j] = 1; fieldM[j] = 1; continue; }
      if (dist[j] < HALF) continue;
      if (f > -16 && ter[j] === 0) kind[j] = KR.hedge;
    }
  }
  const hedgeWalls = edgeCircles((x, y) => !inBox(x, y, MW, MH) || kind[y * MW + x] !== KR.hedge, bx0, by0, bx1, by1, 4, 4, 5);
  yield;

  // ----- three caramel brooks across the field: from a caramel spring at the hedge over the line into a pond just past it; on the far side of the
  // pond the icing stays clean (the longer line); a gummy-bear trampoline on the line and one further up the brook throw you over -----
  const jumps = [], brooks = [];
  def.brooks.forEach((t, b) => {
    const i = (iF0 + Math.round(t * nF)) % N, p = path[i], tg = tan[i], nm = nrm[i];
    const at = (o, a) => [p.x + nm.x * o + tg.x * a, p.y + nm.y * o + tg.y * a];
    // how far the open field reaches to each side here: the brook comes from the narrower side, the clean way runs on the wider one
    const ext = s => { let o = 0; for (; o < 160; o += 2) { const [x, y] = at(s * o, 0), j = Math.round(y) * MW + Math.round(x); if (!inBox(Math.round(x), Math.round(y), MW, MH) || !fieldM[j]) break; } return o; };
    const side = ext(1) < ext(-1) ? 1 : -1, eS = ext(side), eO = ext(-side), wo = side * (eS + 10);
    const pts = []; for (let q = 0; q <= 6; q++) { const o = wo + (-side * 8 - wo) * q / 6, a = Math.sin(q * 1.3 + b * 2.1) * 7 * Math.min(1, Math.abs(o) / 50); pts.push([...at(o, a), 12]); }
    const pond = at(-side * 22, 0);
    stampWay(pts, 9, j => { if (ter[j] === ICING) { ter[j] = CARA; brookM[j] = 1; } else if (kind[j] === KR.hedge) kind[j] = KR.spring; }, MW, MH);
    for (let y = Math.floor(pond[1] - 26); y <= pond[1] + 26; y++) for (let x = Math.floor(pond[0] - 26); x <= pond[0] + 26; x++) {
      if (!inBox(x, y, MW, MH)) continue;
      const j = y * MW + x, dx = x + .5 - pond[0], dy = y + .5 - pond[1], a = dx * tg.x + dy * tg.y, c = dx * nm.x + dy * nm.y;
      if ((a / 18) ** 2 + (c / 18) ** 2 < .82 + .36 * vnoise(x * .12, y * .12, sd + 8 + b) && ter[j] === ICING) { ter[j] = CARA; brookM[j] = 1; }
    }
    // the trampolines: in front of the brook where it crosses the line, and further up if there is room (the height does not depend on the speed)
    const tramp = (o, k) => {
      let a0 = 0, bd = 1e9; for (const q of pts) { const c = (q[0] - p.x) * nm.x + (q[1] - p.y) * nm.y; if (Math.abs(c - o) < bd) { bd = Math.abs(c - o); a0 = (q[0] - p.x) * tg.x + (q[1] - p.y) * tg.y; } }
      const [x, y] = at(o, a0 - 22);
      jumps.push({ x, y, tx: tg.x, ty: tg.y, lo: -18, hi: 18, vz: 118, bear: BEARS[(b * 2 + k) % BEARS.length], sq: 0, o, brook: b });
      return o;
    };
    const tr = [tramp(0, 0)]; if (eS > 64) tr.push(tramp(side * Math.min(52, eS - 26), 1));
    brooks.push({ i, side, tramps: tr, clean: -side * clamp((44 + eO) / 2, 46, eO - 16), spring: at(side * (eS + 4), 0), pond });
  });
  yield;

  // ----- lollipops in the field (solid sticks, the sweet on top): spread out, never on the line, a brook or a pond -----
  const lollis = [];
  for (let t = 0; t < 900 && lollis.length < 16; t++) {
    const x = bx0 + (hash(t, 1, sd + 9) * BW | 0), y = by0 + (hash(t, 2, sd + 9) * BH | 0), k = (y - by0) * BW + x - bx0, j = y * MW + x, rr = 8 + (hash(t, 3, sd + 9) * 3 | 0);
    if (!fieldM[j] || nI[k] < 10 || nI[k] > nF - 10 || dC[k] < HALF + rr + 8 || wall0(x, y, k) < rr + 10) continue;
    let bad = false; for (let dy = -rr - 8; dy <= rr + 8 && !bad; dy += 4) for (let dx = -rr - 8; dx <= rr + 8; dx += 4) { const q = (y + dy) * MW + x + dx; if (!inBox(x + dx, y + dy, MW, MH) || brookM[q]) { bad = true; break; } }
    if (bad || lollis.some(l => Math.hypot(l.x - x, l.y - y) < 50) || jumps.some(J => Math.hypot(J.x - x, J.y - y) < 40)) continue;
    lollis.push({ x, y, r: rr, k: lollis.length });
  }
  yield;

  // ----- the caramel moor: the cookie road through it (caramel runs over its edges in places, a winding lane stays clean), round it to the south
  // the brittle lane (longer, clean); islands of brittle in the caramel (solid) -----
  const [ox, oy, orx, ory] = def.moor;
  const inMoor = (x, y) => ((x + .5 - ox) / orx) ** 2 + ((y + .5 - oy) / ory) ** 2 < .78 + .4 * vnoise(x * .02, y * .02, sd + 10);
  for (let y = Math.max(0, oy - ory - 20); y <= Math.min(MH - 1, oy + ory + 20); y++) for (let x = Math.max(0, ox - orx - 30); x <= Math.min(MW - 1, ox + orx + 30); x++) {
    const j = y * MW + x; if (!inMoor(x, y) || kind[j] === KR.spur || fieldM[j] || kind[j]) continue;
    if (dist[j] < HALF) {
      if (ter[j] !== 1) continue;
      kind[j] = KR.cookie;
      const i = S.near[j], lane = Math.sin(i / 23) * 10;
      if (Math.abs(off(j) - lane) > 14 && vnoise(x * .06, y * .06, sd + 11) > .6) ter[j] = CARA;
    } else if (ter[j] === 0) {
      if (vnoise(x * .045, y * .045, sd + 12) > .64 && dist[j] > HALF + 12 && !spurNear[j]) kind[j] = KR.island;
      else ter[j] = CARA;
    }
  }
  const islandWalls = edgeCircles((x, y) => !inBox(x, y, MW, MH) || kind[y * MW + x] !== KR.island, ox - orx - 30, Math.max(0, oy - ory - 20), ox + orx + 30, oy + ory + 20, 4, 4, 5);
  yield;

  // ----- the sweet factory: its floor is the road (the fast way over the belts) and the maintenance walk (grating); the rest of the footprint is
  // the glass wall. Belts are terrain 113 (the push: pushes) -----
  const FA = def.factory, [fx0, fy0, fx1, fy1] = FA.rect;
  const wayPts = stampWay(FA.way.pts, FA.way.half, j => { if (dist[j] >= HALF) { ter[j] = 1; kind[j] = KR.grate; alt[j] = 1; } }, MW, MH);
  for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) {
    const j = y * MW + x;
    if (dist[j] < HALF) { kind[j] = KR.floor; continue; }
    if (kind[j] === KR.grate) continue;
    ter[j] = 0; kind[j] = KR.fwall; alt[j] = 0;
  }
  for (const [x0, y0, x1, y1] of FA.belts) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const j = y * MW + x; if (ter[j] === 1) ter[j] = BELT; }
  const factoryWalls = edgeCircles((x, y) => x < fx0 || y < fy0 || x > fx1 || y > fy1 || kind[y * MW + x] !== KR.fwall, fx0, fy0, fx1, fy1, 4, 4, 5);
  yield;

  // ----- the lemonade bay beside the bottom straight (it washes, see paint) -----
  const bayPts = stampWay(def.bay.pts, def.bay.half, j => { if (dist[j] >= HALF && ter[j] === 0) { ter[j] = 1; kind[j] = KR.bay; alt[j] = 1; } }, MW, MH);

  // ----- the fizz field: fizz pads on one half of the road, bubblegum in front of each (pads behind gum, Grundsatz 12); more gum spots -----
  const gum = [], pads = [];
  const spot = (cx, cy, r) => { for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) { const j = y * MW + x; if (inBox(x, y, MW, MH) && ter[j] === 1 && Math.hypot(x + .5 - cx, y + .5 - cy) < r + (vnoise(x * .3, y * .3, sd + 13) - .5) * 3) ter[j] = GUM; } gum.push([cx, cy]); };
  for (const [x, y, side] of def.fizz) {
    const i = idx([x, y]), p = path[i], tg = tan[i], nm = nrm[i];
    for (let a = -14; a <= 14; a += .5) for (let c = -11; c <= 11; c += .5) { const X = Math.round(p.x + tg.x * a + nm.x * (side * 14 + c)), Y = Math.round(p.y + tg.y * a + nm.y * (side * 14 + c)), j = Y * MW + X; if (ter[j] === 1) ter[j] = 4; }
    pads.push({ x: p.x + nm.x * side * 14, y: p.y + nm.y * side * 14, tx: tg.x, ty: tg.y, nx: nm.x, ny: nm.y });
    spot(p.x - tg.x * 44 + nm.x * side * 14, p.y - tg.y * 44 + nm.y * side * 14, 9);
  }
  for (const [x, y] of def.gum) spot(x, y, 8);
  yield;

  // ----- slopes: up the pass, down to the factory; the belts push along their direction -----
  const [p0, p1, pf] = def.pass, [d0, d1, df] = def.descent;
  const iP0 = idx(p0), iP1 = idx(p1), iD0 = idx(d0), iD1 = idx(d1);
  const pushes = [{ i0: iP0, i1: iP1, f: pf }, { i0: iD0, i1: iD1, f: df }, ...FA.belts.map(([x0, y0, x1, y1, fx, fy]) => ({ rect: [x0, y0, x1, y1], fx, fy }))];

  return { alt, kind, brookM, fieldM, pushes, mtnWalls, hedgeWalls, islandWalls, factoryWalls, jumps: jumps.concat(hops), nTramp: jumps.length, brooks, lollis,
    iF: [iF0, iF1], iP: [iP0, iP1], iD: [iD0, iD1], spurPts, stonePts, wayPts, bayPts, gum, pads,
    boxes: [mb, [bx0, by0, bx1, by1], [ox - orx - 30, Math.max(0, oy - ory - 20), ox + orx + 30, oy + ory + 20]], iSpur: idx(def.spur.pts[0]), iStones: idx(def.stonePath.pts[0]), iWay: idx(FA.way.pts[0]), iPress: idx(FA.press), iBay: idx(def.bay.pts[0]), Rm };
}

// painting, after the ground. S: { MW, MH, def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, shore, deep,
// bridgeMask, isBridge, stoneMask, sd, r, mudPix, watPix, darken, RT }
export function* paintSuess(S) {
  const { MW, MH, def, set, setT, path, nrm, N, ter, dist, near, walls, wallMask, washMask, shore, bridgeMask, isBridge, stoneMask, sd, mudPix, watPix, darken, RT } = S, A = MW * MH;
  const KD = RT.kind, { px, dk, solid, off } = paintTools(S), TL = sprinkleTile();
  const [mx, my] = def.mountain;
  const caraPix = [], chocPix = [], lemPix = [];
  mudPix.length = 0; watPix.length = 0;
  const nb = (j, test) => { const x = j % MW; return (x > 0 && !test(j - 1)) || (x < MW - 1 && !test(j + 1)) || (j >= MW && !test(j - MW)) || (j < A - MW && !test(j + MW)); };
  const nb2 = (j, test) => { const x = j % MW; return (x > 1 && !test(j - 2)) || (x < MW - 2 && !test(j + 2)) || (j >= 2 * MW && !test(j - 2 * MW)) || (j < A - 2 * MW && !test(j + 2 * MW)); };
  const isCara = k => ter[k] === CARA, isGum = k => ter[k] === GUM;
  const [fbx, fby] = def.bay.fount;

  yield;
  // ----- the ground -----
  for (let j = 0; j < A; j++) {
    if (j % 40000 === 39999) yield;
    const t = ter[j], kd = KD[j];
    if (t === 0 && !kd) continue; // (the sugar ground: the core paints it in the colours of the theme)
    const x = j % MW, y = j / MW | 0, h = hash(x, y, sd + 140), NV = () => vnoise(x / 8, y / 8, sd + 141), dd = dist[j];
    let c;
    if (kd === KR.mtn || kd === KR.slope || kd === KR.rill || kd === KR.cascade) {
      // the chocolate mountain: a cone lit from the top left, terraces like a layered cake, an icing cap that drips down from the summit; its foot fades
      // into cocoa-dusted sugar; the rills are dark grooves; the river falls down it in glossy cascades
      const dx = x + .5 - mx, dy = y + .5 - my, d = Math.hypot(dx, dy) || 1, Rr = RT.Rm(x, y), hgt = 1 - d / Rr, lit = -(dx + dy) / (d * 1.414);
      if (kd === KR.cascade) c = (y + (x >> 1)) % 9 < 1 ? K.dpH : (y + (x >> 1)) % 9 < 3 ? K.dpS : K.dp2;
      else if (kd === KR.rill) c = hgt > 0 ? (lit > .3 ? K.m1 : K.mE) : h < .45 ? [190, 130, 120] : K.fi1;
      else if (hgt <= 0) { const f = clamp(-hgt * Rr / 28, 0, 1); c = h < .75 - f * .7 ? [150, 96, 84].map((v, q) => v + (K.fi1[q] - v) * f | 0) : K.fi1; }
      else {
        // ridges run down from the summit (noise over the angle), lit from the top left; the icing cap drips down the ridges
        const an = Math.atan2(dy, dx), rid = vnoise(an * 7 + 20, d / 50, sd + 151), li = .76 + .42 * lit + (rid - .5) * .55 + (h - .5) * .06;
        c = (hgt < .1 ? K.m1 : K.m0).map(v => clamp(v * li, 0, 255) | 0);
        const dl = Math.max(0, vnoise(an * 16 + 3, 1, sd + 152) - .6) * .7;
        if (hgt > .8 - dl + (vnoise(x / 9, y / 9, sd + 153) - .5) * .06) c = (lit > -.2 ? K.cap : K.cap1).map(v => clamp(v * (.9 + .15 * lit + (rid - .5) * .2), 0, 255) | 0); // the icing cap
      }
      if (kd === KR.mtn && hgt > 0 && hgt < .1 && nb(j, k => KD[k] === KR.mtn || KD[k] === KR.cascade || KD[k] === KR.rill)) c = K.mE;
      if (kd === KR.mtn) wallMask[j] = 1;
    } else if (kd === KR.hedge || kd === KR.spring) {
      // the hedge of candy canes round the forest: red and white stripes, a dark rim where it meets the open ground (solid, Grundsatz 10)
      c = ((x + y) >> 2) & 1 ? K.cane : K.caneW;
      if (nb(j, k => KD[k] === KR.hedge || KD[k] === KR.spring)) c = K.caneE;
      if (kd === KR.spring) c = K.ca;
      wallMask[j] = 1;
    } else if (kd === KR.fwall) {
      // the glass walls of the factory: stripes of boiled sweets in frames
      const bx = Math.floor((x - 2) / 40), by = Math.floor(y / 30), G2 = GLASS[(bx + by) & 1], fr = (x - 2) % 40 < 2 || y % 30 < 2;
      c = fr ? [150, 90, 130] : ((x + y) % 17 < 2 ? G2[1] : G2[0]);
      if (nb(j, k => KD[k] === KR.fwall)) c = [50, 20, 40];
      wallMask[j] = 1;
    } else if (kd === KR.island) {
      // islands of brittle in the moor (solid): light, with nuts, a dark rim
      c = NV() > .55 ? K.isl : K.isl1; if (h < .1) c = K.islS; if (h > .95) c = [150, 100, 50];
      if (nb(j, k => KD[k] === KR.island)) c = K.islE;
      wallMask[j] = 1;
    } else if (kd === KR.floor || kd === KR.grate) {
      if (t === BELT) c = null; // (belts below)
      else if (kd === KR.grate) { c = (x % 6 === 0 || y % 6 === 0) ? K.grD : (x + y) % 5 ? K.gr : K.grL; if (dd >= HALF && nb(j, k => KD[k] === KR.grate || KD[k] === KR.floor)) c = [250, 210, 40]; } // (a yellow rim along the walk)
      else { const tx = Math.floor(x / 12), ty = Math.floor(y / 12); c = (x % 12 === 0 || y % 12 === 0) ? K.tileJ : (tx + ty) & 1 ? K.tile : K.tile1; if (dd > HALF - 2) c = [250, 210, 40]; }
      if (c) { set(j, c); continue; }
    }
    if (c) { set(j, c); continue; }
    if (t === BELT) {
      // conveyor belts: grey, rollers across them, light ribs (they move while racing, suess.js)
      c = y % 8 < 1 ? K.beltD : y % 8 < 3 ? K.beltL : NV() > .55 ? K.belt : K.belt1;
      if (KD[j] === KR.grate) c = y % 8 < 1 ? K.beltD : y % 8 < 3 ? [180, 130, 140] : [150, 104, 116]; // (the belt in the walk runs the wrong way: reddish)
    } else if (bridgeMask[j]) {
      if (y < 600) { const a = near[j] * 2, o = off(j) + 100; c = dd > HALF - 3 ? K.waE : (a % 7 < 1.6 || o % 7 < 1.6) ? K.waR : K.waP; if (h < .04 && c === K.waP) c = K.wa; } // (the waffle bridge)
      else { const a = Math.floor(near[j] / 3); c = dd > HALF - 3 ? K.brE : near[j] % 3 === 0 ? K.br1 : (h < .2 ? K.brN : a & 1 ? K.brN2 : [176, 120, 60]); } // (the brittle bridge: planks of nut brittle)
    } else if (stoneMask[j] || t === MARSH) {
      const q = def.stones[(stoneMask[j] || 1) - 1], ddx = x + .5 - q[0], ddy = y + .5 - q[1], e = Math.hypot(ddx, ddy / (q[3] || 1)) / q[2];
      c = e > .86 ? K.msE : (ddx + ddy / 2) / q[2] > .35 ? K.msS : ((stoneMask[j] || 1) & 1) ? K.ms : K.msP;
    } else if (t === CARA) {
      // caramel: amber, glossy streaks, a dark rim (it stands out from the liquorice and from the icing)
      const v = vnoise(x / 6, y / 6, sd + 142) * .6 + h * .4;
      c = v < .36 ? K.ca1 : v > .7 ? K.ca2 : K.ca; if (Math.abs(vnoise(x / 14, y / 5, sd + 143) - .5) < .03) c = K.caH;
      if (nb(j, isCara)) c = K.caE; else if (nb2(j, isCara)) c = K.caE2;
      if (h < .015) caraPix.push(j);
    } else if (t === GUM) {
      c = nb(j, isGum) ? K.gumD : NV() > .62 ? K.gumH : K.gum;
    } else if (t === 4) continue; // (fizz pads below)
    else if (t === 5) {
      // the chocolate river and lake: dark, swirls, glossy highlights
      const v = vnoise(x / 18, y / 10, sd + 144), sw = Math.abs(vnoise(x / 16, y / 16, sd + 145) - .5);
      c = v > .62 ? K.dp2 : v < .35 ? K.dp : K.dp1; if (sw < .025) c = K.dpS; if (h < .004) c = K.dpH;
      if (nb(j, k => ter[k] === 5)) c = K.dpE;
      if (h > .985) chocPix.push(j);
    } else if (t === ICING) {
      // the icing of the forest: very light pink with sprinkles (a tile), the liquorice dashes of the way
      const v = NV() * .7 + h * .3, s2 = TL[(y & 63) * 64 + (x & 63)];
      c = s2 ? SPR[s2 - 1] : v < .3 ? K.fi1 : v > .7 ? K.fi2 : K.fi;
      if (dd < 1.6 && near[j] % 16 < 8) c = K.lic; else if (dd < 2.6 && near[j] % 16 < 8) c = K.licH;
    } else if (kd === KR.cookie) {
      // the cookie road: dark chocolate cookies side by side with cream in the gaps
      const a = near[j] * 2, o = off(j), row = Math.round(o / 15), ca = Math.round((a + (row & 1) * 10) / 20) * 20 - (row & 1) * 10, rd = Math.hypot(a - ca, o - row * 15);
      c = rd > 9.2 ? K.ckDot : rd > 8.2 ? K.ckE : NV() > .6 ? K.ck2 : h < .5 ? K.ck : K.ck1;
      if (rd < 7.5 && (Math.round(a) % 4 === 0) && (Math.round(o + 100) % 4 === 0)) c = K.ckE;
      if (dd > HALF - 2) c = K.ckE;
    } else if (kd === KR.spur) {
      // the brittle lane: dark with light nuts, a dark rim
      c = h < .12 ? K.brN : h > .93 ? K.brN2 : NV() > .55 ? K.br : K.br1;
      if (nb(j, k => ter[k] === 1 || ter[k] === 4 || ter[k] === GUM)) c = K.brE;
    } else if (kd === KR.bay) {
      // the lemonade bay: pale yellow, bubbles rise in it; it washes round the fountain
      c = NV() > .62 ? K.le2 : NV() < .3 ? K.le1 : K.le; if (h < .03) c = [255, 255, 255];
      if (nb(j, k => KD[k] === KR.bay || ter[k] === 1)) c = K.leE;
      if (Math.abs(x - fbx) < 46) { washMask[j] = 1; if (h > .97) lemPix.push(j); }
    } else if (t === 1) {
      // liquorice: black and glossy, a shine along one side, a dashed line of icing in the middle
      const o = off(j), i = near[j], lane = kd === KR.path;
      c = NV() > .62 ? K.lic2 : h < .5 ? K.lic : K.lic1;
      if (!lane && Math.abs(o + HALF * .4) < 1.3 && (i % 9) > 1) c = K.licH; else if (!lane && Math.abs(o + HALF * .4 + 2) < .8 && (i % 13) > 6) c = K.licH2;
      if (lane ? nb(j, k => ter[k] !== 0) : dd > HALF - 2.2) c = K.licE; else if (!lane && Math.abs(o) < 1.3 && i % 16 < 8) c = K.dash;
    } else continue;
    set(j, c);
  }
  for (const w of RT.mtnWalls.concat(RT.hedgeWalls, RT.islandWalls, RT.factoryWalls)) walls.push(w);
  yield;

  // ----- shadows: the hedge, the brittle islands, the mountain cast a shadow to the bottom right -----
  const shaded = new Uint8Array(A);
  for (const [x0, y0, x1, y1] of RT.boxes) for (let y = Math.max(6, y0); y <= Math.min(MH - 1, y1 + 6); y++) for (let x = Math.max(6, x0); x <= Math.min(MW - 1, x1 + 6); x++) {
    const j = y * MW + x; if (shaded[j] || (KD[j] && KD[j] !== KR.slope && KD[j] !== KR.rill) || ter[j] === 5) continue;
    for (let q = 2; q <= 5; q++) { const k = KD[j - q * MW - q]; if (k === KR.hedge || k === KR.island || k === KR.mtn) { dk(x, y, .72 + q * .04); shaded[j] = 1; break; } }
    if (!shaded[j] && ter[j] <= 1 && Math.hypot(x - 14 - mx, y - 14 - my) < RT.Rm(x - 14, y - 14) * .97) { dk(x, y, .8); shaded[j] = 1; } // (the mountain casts a long shadow)
  }
  yield;
  startLine(S);

  // ----- the fizz pads: pastel stripes with white chevrons -----
  for (const P of RT.pads) for (let a = -14; a <= 14; a += .5) for (let c2 = -11; c2 <= 11; c2 += .5) {
    const X = Math.round(P.x + P.tx * a + P.nx * c2), Y = Math.round(P.y + P.ty * a + P.ny * c2); if (ter[Y * MW + X] !== 4) continue;
    const ac = Math.abs(c2);
    px(X, Y, ac > 10 || Math.abs(a) > 13 ? hex('#ff8ac0') : ((a + ac * .8 + 100) % 9) < 3 ? [255, 255, 255] : (((a + 100) / 9 | 0) & 1) ? hex('#7ee8c8') : hex('#ffd1e8'));
  }

  // ----- the bridges: rails along both sides (solid). Waffle rolls on the waffle bridge, brittle posts on the brittle bridge -----
  for (let i = 0; i < N; i += 3) if (isBridge[i]) for (const s of [-1, 1]) walls.push({ x: path[i].x + nrm[i].x * s * HALF, y: path[i].y + nrm[i].y * s * HALF, r: 3 });
  for (let j = 0; j < A; j++) {
    if (!isBridge[near[j]] || dist[j] < HALF - 3 || dist[j] > HALF + 3) continue;
    const dd = dist[j], i = near[j], x = j % MW, y = j / MW | 0, waffle = y < 600;
    if (dd > HALF + 1.5) { if (ter[j] === 5) set(j, K.dpE); continue; }
    setT(x, y, dd < HALF - 2.2 || dd > HALF + .8 ? (waffle ? K.waE : K.brE) : (i >> 1) % 2 ? (waffle ? hex('#f2d08a') : K.brN) : (waffle ? hex('#c8904a') : K.br));
  }
  yield;

  // ----- the lollipops in the forest: a stick and a swirl (solid), a shadow -----
  for (const L of RT.lollis) {
    const { x, y, r: rr, k } = L, [c1, c2] = LOLLI[k % LOLLI.length];
    walls.push({ x, y, r: rr - 1 }); solid(x, y, rr + 2);
    darken(x, y, rr, 4, 5);
    for (let q = 0; q < 10; q++) { px(x + 2 + q * .4, y + rr + q * .5, hex('#c8c0b4')); px(x + 1 + q * .4, y + rr + q * .5, hex('#f4f0ea')); }
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      const e = Math.hypot(dx, dy); if (e > rr) continue;
      const an = Math.atan2(dy, dx), sw = ((an / TAU * 3 + e / rr * 1.6) % 1 + 1) % 1;
      let c = sw < .5 ? c1 : c2;
      if (e > rr - 1.2) c = c.map(v => v * .5 | 0); else if (dx + dy < -rr * .6 && e > rr * .4) c = c.map(v => Math.min(255, v + 50));
      px(x + dx, y + dy, c);
    }
    px(x - Math.round(rr * .4), y - Math.round(rr * .4), [255, 255, 255]);
  }
  // the caramel springs at the hedge: a tipped-over pot of caramel (where the brooks come from, Grundsatz 2)
  for (const B of RT.brooks) {
    const [x, y] = B.spring.map(Math.round);
    for (let dy = -7; dy <= 7; dy++) for (let dx = -8; dx <= 8; dx++) { const e = (dx / 8) ** 2 + (dy / 7) ** 2; if (e <= 1) setT(x + dx, y + dy, e > .7 ? [60, 40, 50] : dy < -2 ? [230, 120, 160] : [200, 90, 130]); }
    for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) if ((dx / 4) ** 2 + (dy / 3) ** 2 <= 1) setT(x + dx, y + dy, dx + dy < -1 ? K.caH : K.ca);
  }
  yield;

  // ----- the candyfloss banks along the pass (soft: you bounce off without losing speed; a scrap of floss stays on the car) -----
  const [iP0, iP1] = RT.iP, puff = (x, y, rr, blue) => {
    const P = blue ? ['#9cc8f0', '#c4e0ff', '#eef6ff'].map(hex) : ['#f08cbc', '#ffc0dc', '#ffeef6'].map(hex);
    darken(Math.round(x), Math.round(y), rr - 1, 3, 4);
    for (let dy = -rr - 2; dy <= rr + 2; dy++) for (let dx = -rr - 2; dx <= rr + 2; dx++) {
      const X = Math.round(x + dx), Y = Math.round(y + dy), e = Math.hypot(dx, dy) + (vnoise(X * .35, Y * .35, sd + 151) - .5) * 5; if (e > rr) continue;
      const lit = (dx + dy) / rr; setT(X, Y, e > rr - 1 ? P[0].map(v => v * .8 | 0) : lit < -.5 ? P[2] : lit < .2 ? P[1] : P[0]);
    }
  };
  for (let i = (iP0 - 10 + N) % N; ((iP1 + 10 - i + N) % N) > 0 && ((iP1 + 10 - i + N) % N) < N - 5; i = (i + 3) % N) for (const s of [-1, 1]) {
    const x = path[i].x + nrm[i].x * s * (HALF + 6), y = path[i].y + nrm[i].y * s * (HALF + 6), j = Math.round(y) * MW + Math.round(x);
    if (ter[j] !== 0 && ter[j] !== CARA) continue;
    walls.push({ x, y, r: 4, bob: true, floss: true }); solid(x, y, 6);
  }
  for (let i = (iP0 - 10 + N) % N, n = 0; ((iP1 + 10 - i + N) % N) > 0 && ((iP1 + 10 - i + N) % N) < N - 5; i = (i + 6) % N, n++) for (const s of [-1, 1]) {
    const o = HALF + 11 + hash(i, s, sd + 152) * 4, x = path[i].x + nrm[i].x * s * o, y = path[i].y + nrm[i].y * s * o;
    puff(x, y, 8 + (hash(s, i, sd + 153) * 4 | 0), ((i / 30) | 0) % 2 === 1);
  }
  yield;

  // ----- the sweet factory: a glass roof seen from outside (a sweet swirl on it, chimneys); inside the press and the belts move (suess.js) -----
  const FA = def.factory, [fx0, fy0, fx1, fy1] = FA.rect, FW = fx1 - fx0 + 1, FH = fy1 - fy0 + 1, roof = mk(FW, FH), rg = roof.getContext('2d'), rimg = rg.createImageData(FW, FH), rq = rimg.data;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const e = Math.min(x, FW - 1 - x, y, FH - 1 - y), pane = (x % 28 < 2 || y % 22 < 2), k = (y * FW + x) * 4;
    let c = e < 3 ? [90, 42, 72] : e < 6 ? [255, 140, 190] : pane ? [255, 255, 255] : (((x / 28 | 0) + (y / 22 | 0)) & 1 ? [200, 236, 255] : [180, 224, 250]);
    if (!pane && e >= 6 && (x + y) % 23 < 2) c = [240, 250, 255]; // (light on the glass)
    rq[k] = c[0]; rq[k + 1] = c[1]; rq[k + 2] = c[2]; rq[k + 3] = 255;
  }
  rg.putImageData(rimg, 0, 0);
  // a big sweet in its wrapper on the roof, chimneys of rock candy
  const cx0 = FW / 2, cy0 = FH / 2;
  rg.fillStyle = '#5a2a48'; rg.beginPath(); rg.ellipse(cx0, cy0, 54, 34, 0, 0, TAU); rg.fill();
  for (let k = 0; k < 8; k++) { rg.fillStyle = k % 2 ? '#ffffff' : '#ff4d6d'; rg.beginPath(); rg.moveTo(cx0, cy0); rg.ellipse(cx0, cy0, 50, 30, 0, k * TAU / 8, (k + 1) * TAU / 8); rg.closePath(); rg.fill(); }
  for (const s of [-1, 1]) { rg.fillStyle = '#ff4d6d'; rg.beginPath(); rg.moveTo(cx0 + s * 50, cy0); rg.lineTo(cx0 + s * 84, cy0 - 22); rg.lineTo(cx0 + s * 84, cy0 + 22); rg.closePath(); rg.fill(); }
  const chimneys = [[fx0 + 36, fy0 + 40], [fx1 - 40, fy0 + 70], [fx1 - 50, fy1 - 60]];
  for (const [x, y] of chimneys) { rg.fillStyle = '#3a2030'; rg.fillRect(x - fx0 - 9, y - fy0 - 9, 18, 18); rg.fillStyle = '#9b5de5'; rg.fillRect(x - fx0 - 7, y - fy0 - 7, 14, 14); rg.fillStyle = '#c8a0ff'; rg.fillRect(x - fx0 - 7, y - fy0 - 7, 6, 6); }
  const factory = { c: roof, x: fx0, y: fy0, W: FW, H: FH, chimneys, press: { x: FA.press[0], y: FA.press[1] }, belts: FA.belts };
  // the press: its frame stands on both sides of the belt (solid)
  for (const s of [-1, 1]) for (let q = -10; q <= 10; q += 5) walls.push({ x: FA.press[0] + s * (HALF + 3), y: FA.press[1] + q, r: 4 });
  // worker gummy bears at levers in the walls by the walk
  const workers = [[fx0 + 10, fy0 + 140], [fx0 + 10, fy0 + 300], [fx1 - 40, fy0 + 220], [fx1 - 40, fy0 + 330]];
  yield;

  // ----- signposts at the forks (big, readable): moor (cookie / brittle lane), factory (belts and press / walk), marshmallows -----
  const sign = (x, y, k) => {
    walls.push({ x: x + 12, y: y + 30, r: 3 }); solid(x + 12, y + 30, 3);
    for (let yy = 0; yy < 22; yy++) for (let xx = 0; xx < 26; xx++) setT(x + xx, y + yy, yy < 2 || xx < 2 || yy > 19 || xx > 23 ? [60, 30, 40] : [255, 240, 246]);
    for (let yy = 22; yy < 32; yy++) { setT(x + 11, y + yy, [200, 60, 80]); setT(x + 12, y + yy, (yy >> 1) & 1 ? [255, 255, 255] : [232, 52, 74]); }
    const ink = [40, 20, 30], R = (a, b, w, h2, c) => { for (let yy = 0; yy < h2; yy++) for (let xx = 0; xx < w; xx++) setT(x + a + xx, y + b + yy, c); };
    if (k === 'moor') { R(4, 5, 8, 8, [62, 42, 34]); R(6, 7, 2, 2, [244, 230, 208]); R(15, 9, 7, 2, ink); R(19, 7, 2, 6, ink); R(4, 15, 18, 3, [74, 50, 32]); } // cookie straight on, the lane to the right
    else if (k === 'factory') { R(4, 4, 8, 6, [138, 144, 152]); R(4, 11, 8, 3, [60, 62, 68]); R(15, 4, 7, 10, [106, 112, 120]); for (let q = 0; q < 7; q += 2) R(15 + q, 4, 1, 10, [58, 62, 68]); R(4, 16, 18, 2, ink); }
    else { for (const [a, b] of [[4, 8], [11, 8], [18, 8]]) { R(a, b, 5, 5, [255, 200, 224]); R(a + 1, b + 1, 2, 2, [255, 255, 255]); } R(3, 15, 20, 3, [64, 32, 16]); }
  };
  for (const [x, y, k] of def.signs) sign(x, y, k);
  yield;

  // ----- the gingerbread village by the start: houses with icing roofs and gumdrops (solid) -----
  for (const [hx0, hy0, hw, hh] of def.houses) {
    const hx1 = hx0 + hw, hy1 = hy0 + hh, hmx = (hx0 + hx1) / 2, fy = hy1 - 16;
    for (let y = hy0; y <= hy1; y++) for (let x = hx0; x <= hx1; x++) dk(x + 5, y + 6, .7);
    for (let y = hy0 - 3; y <= fy + 2; y++) for (let x = hx0 - 4; x <= hx1 + 4; x++) {
      const ex = Math.min(x - hx0 + 4, hx1 + 4 - x), row = Math.floor((y - hy0 + 3) / 6), tx = ((x - hx0 + (row & 1) * 4) % 8 + 8) % 8;
      const edge = (y - hy0 + 3) % 6 >= 5 - Math.round(Math.abs(tx - 4) * .5), lit = x < hmx;
      let c = edge ? (lit ? K.gb1 : K.gbD) : (lit ? K.gbL : K.gb);
      if (Math.abs(x - hmx) < 2 || ex < 2 || y < hy0 - 1) c = K.icg;
      px(x, y, c);
    }
    for (let x = hx0 - 4; x <= hx1 + 4; x++) { const n = 1 + (hash(x >> 1, hy0, sd) * 4 | 0); for (let k = 0; k < n; k++) px(x, fy + 3 + k, K.icg); }
    for (let y = hy0 + 4; y < fy - 2; y += 9) { const col = SPR[((y / 9) | 0) % SPR.length]; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]]) px(hmx + dx, y + dy, col); }
    for (let y = fy + 3; y <= hy1; y++) for (let x = hx0; x <= hx1; x++) {
      const e = Math.min(x - hx0, hx1 - x, hy1 - y), dx = x - hmx;
      let c = e < 1 ? K.gbD : (y - fy) % 6 === 0 ? K.gb1 : K.gb;
      if (Math.abs(dx) < 5 && y > hy1 - 11) c = Math.abs(dx) > 3.5 ? K.icg : [90, 48, 32];
      px(x, y, c);
    }
    for (let y = hy0; y <= hy1; y += 6) for (const x of [hx0, hx1]) walls.push({ x, y, r: 4 });
    for (let x = hx0; x <= hx1; x += 6) for (const y of [hy0, hy1]) walls.push({ x, y, r: 4 });
    solid(hmx, (hy0 + hy1) / 2, Math.max(hw, hh) / 2 + 6);
  }
  yield;

  // ----- the candy rainbow in the corner (only a picture on the ground, flat): six bands, clouds at its feet -----
  const RB = ['#ff4d6d', '#ff9f43', '#ffd93d', '#6bcb77', '#4d96ff', '#9b5de5'].map(hex), [rx0, ry0, rr0] = def.candyBow;
  for (let y = ry0 - rr0 - 30; y <= ry0; y++) for (let x = rx0 - rr0 - 30; x <= rx0 + rr0 + 30; x++) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    const j = y * MW + x; if (ter[j] !== 0 || KD[j] || wallMask[j]) continue;
    const e = Math.hypot(x + .5 - rx0, y + .5 - ry0), b = Math.floor((rr0 + 30 - e) / 5);
    if (b < 0 || b > 6) continue;
    set(j, b === 6 || e > rr0 + 29 ? [255, 255, 255] : RB[b]);
  }
  for (const s of [-1, 1]) for (let dy = -8; dy <= 8; dy++) for (let dx = -16; dx <= 16; dx++) { if ((dx / 16) ** 2 + (dy / 8) ** 2 <= 1) px(rx0 + s * (rr0 + 15) + dx, ry0 - 2 + dy, dy < -2 ? [255, 255, 255] : [236, 240, 250]); }
  yield;

  // ----- donut stacks at the corners, the candyfloss machine at the pass, ice cream cone lanterns (all solid) -----
  for (const [x, y] of def.donuts) {
    walls.push({ x, y, r: 12 }); solid(x, y, 16); darken(x, y, 13, 4, 6);
    for (const [ox, oy, k] of [[0, 4, 0], [0, 0, 1], [0, -4, 2]]) for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
      const e = Math.hypot(dx, dy); if (e > 12 || e < 4) continue;
      const icing = k === 2 || dy < -2;
      let c = e > 11 || e < 5 ? K.doughD : icing ? (k === 2 ? (hash(x + dx, y + dy, 160) < .1 ? SPR[(hash(dx, dy, 161) * 7) | 0] : K.pink) : K.dough) : K.dough;
      if (icing && k === 2 && dx + dy < -8 && e > 6) c = K.pinkL;
      setT(x + dx + ox, y + dy + oy, c);
    }
  }
  // the sugar land: gumdrops and lollipops stand about (solid: strong colours, a dark rim and a shadow); candy hearts and sprinkles lie flat and
  // pale on the ground (you drive over them, Grundsatz 10)
  const freeAt = (x, y, m) => {
    for (let dy = -m; dy <= m; dy += 3) for (let dx = -m; dx <= m; dx += 3) {
      const X = x + dx, Y = y + dy; if (X < 4 || Y < 4 || X >= MW - 4 || Y >= MH - 4) return false;
      const k = Y * MW + X; if (ter[k] !== 0 || KD[k] || wallMask[k] || shore[k] || dist[k] < HALF + 14) return false;
    }
    return true;
  };
  const stand = [def.machine, ...def.lamps, ...def.signs, ...def.bears, def.monster];
  for (let t = 0, n = 0; t < 4000 && n < 34; t++) {
    const x = 8 + (hash(t, 1, sd + 170) * (MW - 16) | 0), y = 8 + (hash(t, 2, sd + 170) * (MH - 16) | 0), rr = 7 + (hash(t, 3, sd + 170) * 4 | 0);
    if (!freeAt(x, y, rr + 16) || stand.some(q => Math.hypot(q[0] - x, q[1] - y) < 70)) continue;
    stand.push([x, y]); n++;
    walls.push({ x, y, r: rr - 1 }); solid(x, y, rr + 1); darken(x, y, rr, 3, 4);
    if (n % 3) {
      const col = SPR[n % 5];
      for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const e = Math.hypot(dx, dy); if (e > rr) continue; const lit = (dx + dy) / rr; px(x + dx, y + dy, e > rr - 1.2 ? col.map(v => v * .45 | 0) : lit < -.6 ? col.map(v => Math.min(255, v + 90)) : lit > .4 ? col.map(v => v * .8 | 0) : col); }
      for (let q = 0; q < 6; q++) px(x + (hash(q, n, 171) - .5) * rr * 1.2, y + (hash(n, q, 171) - .5) * rr * 1.2, [255, 255, 255]); // (sugar on the gumdrop)
    } else {
      const [c1, c2] = LOLLI[n % LOLLI.length];
      for (let q = 0; q < 9; q++) { px(x + 2 + q * .4, y + rr + q * .5, hex('#c8c0b4')); px(x + 1 + q * .4, y + rr + q * .5, hex('#f4f0ea')); }
      for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const e = Math.hypot(dx, dy); if (e > rr) continue; const sw = ((Math.atan2(dy, dx) / TAU * 3 + e / rr * 1.6) % 1 + 1) % 1; px(x + dx, y + dy, e > rr - 1.2 ? c1.map(v => v * .5 | 0) : sw < .5 ? c1 : c2); }
    }
  }
  for (let t = 0, n = 0; t < 6000 && n < 260; t++) {
    const x = 4 + (hash(t, 4, sd + 172) * (MW - 8) | 0), y = 4 + (hash(t, 5, sd + 172) * (MH - 8) | 0), j = y * MW + x;
    if (ter[j] !== 0 || KD[j] || wallMask[j] || shore[j] || dist[j] < HALF + 6) continue;
    n++;
    const col = SPR[n % SPR.length].map((v, q) => (v + K.fi[q] * 2) / 3 | 0);
    if (n % 4 === 0) for (const [dx, dy] of [[-1, 0], [1, 0], [-2, -1], [-1, -1], [1, -1], [2, -1], [0, 1]]) px(x + dx, y + dy, col); // (a candy heart)
    else for (let q = 0; q < 3; q++) px(x + (n & 1 ? q : 0), y + (n & 1 ? 0 : q), col);
  }
  const [cmx, cmy] = def.machine;
  walls.push({ x: cmx, y: cmy, r: 13 }); solid(cmx, cmy, 16); darken(cmx, cmy, 13, 4, 6);
  for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) { const e = Math.max(Math.abs(dx), Math.abs(dy)); px(cmx + dx, cmy + dy, e > 11 ? hex('#7a3a5a') : e > 9 ? hex('#ff7ab8') : Math.hypot(dx, dy) < 7 ? hex('#fff4fa') : hex('#ffc4e0')); }
  const lamps = [];
  for (const [x, y] of def.lamps) {
    walls.push({ x, y, r: 3 }); darken(x, y, 3, 2, 3);
    for (let k = 0; k < 7; k++) for (let q = -Math.floor((7 - k) / 2.5); q <= Math.floor((7 - k) / 2.5); q++) setT(x + q, y - k, (k + q) % 2 ? hex('#d89a50') : hex('#b87a38'));
    lamps.push({ x, y: y - 9, col: SPR[lamps.length % SPR.length] });
  }
  // the candy-cane fences of the village (solid): red and white, a dark rim, a shadow; the obstacles lie on the drawn line
  for (const [[ax, ay], [bx, by]] of def.fence) {
    const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
    for (let t = 0; t <= L; t += .5) {
      const x = ax + ux * t, y = ay + uy * t;
      for (let w = -2; w <= 2; w += .5) { dk(x - uy * w + 2, y + ux * w + 3, .9); }
      for (let w = -2; w <= 2; w += .5) px(x - uy * w, y + ux * w, Math.abs(w) > 1.5 ? K.caneE : ((t + w * 2) | 0) % 8 < 4 ? K.cane : K.caneW);
      if (t % 4 === 0) walls.push({ x, y, r: 2.5 });
      if (t % 12 === 0) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) px(x + dx, y + dy, Math.abs(dx) === 2 || Math.abs(dy) === 2 ? K.caneE : K.caneW);
    }
    for (let t = 0; t <= L; t += 2) { const X = Math.round(ax + ux * t), Y = Math.round(ay + uy * t); if (inBox(X, Y, MW, MH)) wallMask[Y * MW + X] = 1; }
  }
  // the lemonade fountain: two posts at the back of the bay (away from the road), the jets arch over it (suess.js)
  const fi = near[Math.round(fby) * MW + Math.round(fbx)], away = Math.sign((fbx - path[fi].x) * nrm[fi].x + (fby - path[fi].y) * nrm[fi].y) || 1;
  const posts = [-1, 1].map(s => [fbx + s * 30 + nrm[fi].x * away * 20, fby + nrm[fi].y * away * 20]);
  for (const [x, y] of posts) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (dx * dx + dy * dy <= 16) px(x + dx, y + dy, dx * dx + dy * dy > 9 ? [200, 150, 30] : [255, 240, 120]);
  yield;

  // ----- the chocolate streams of the event schoko: the pixels they cover in the order the chocolate reaches them. On the road they stay on the
  // side they come from (the other half stays clean, Grundsatz 12) -----
  const streams = def.streams.map(([pts, half], k) => {
    const L = [0]; for (let q = 1; q < pts.length; q++) L.push(L[q - 1] + Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1]));
    const len = L[L.length - 1], best = new Map(), [lx, ly] = pts[pts.length - 3], iS = nearestIdx(path, lx, ly), side = Math.sign((lx - path[iS].x) * nrm[iS].x + (ly - path[iS].y) * nrm[iS].y) || 1;
    for (let q = 1; q < pts.length; q++) {
      const [ax, ay] = pts[q - 1], [bx, by] = pts[q], seg = L[q] - L[q - 1], st = Math.max(1, Math.ceil(seg / 2));
      for (let s = 0; s <= st; s++) {
        const f = s / st, along = L[q - 1] + seg * f, cx = ax + (bx - ax) * f, cy = ay + (by - ay) * f, w = half * (.6 + .7 * smooth(along / len)), R2 = Math.ceil(w + 3);
        for (let y = Math.max(0, Math.floor(cy - R2)); y <= Math.min(MH - 1, cy + R2); y++) for (let x = Math.max(0, Math.floor(cx - R2)); x <= Math.min(MW - 1, cx + R2); x++) {
          const j = y * MW + x, kd = KD[j], t = ter[j];
          if (t === 5 || t === 4 || t === MARSH || t === CARA || kd === KR.hedge || kd === KR.island || kd === KR.fwall || (wallMask[j] && kd !== KR.mtn) || bridgeMask[j]) continue;
          if (dist[j] < HALF + 2 && off(j) * side < 3) continue;
          if (Math.hypot(x + .5 - cx, y + .5 - cy) > w + (vnoise(x * .12, y * .12, sd + 154 + k) - .5) * 6) continue;
          const o = best.get(j); if (o === undefined || along < o) best.set(j, along);
        }
      }
    }
    const list = [...best.entries()].sort((a, b) => a[1] - b[1]), n = list.length, idx = new Int32Array(n), al = new Float32Array(n), col = new Uint8Array(n * 3), ter0 = new Uint8Array(n);
    let x0 = MW, y0 = MH, x1 = 0, y1 = 0;
    list.forEach(([j, a], q) => {
      idx[q] = j; al[q] = a; ter0[q] = ter[j];
      const x = j % MW, y = j / MW | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const h = hash(x, y, sd + 155), edge = [-1, 1, -MW, MW].some(dj => !best.has(j + dj));
      const c = edge ? hex('#f6e6cc') : Math.abs(vnoise(x / 9, y / 4, sd + 156) - .5) < .04 ? hex('#d09a70') : h < .4 ? hex('#7a4428') : h > .8 ? hex('#9a5c38') : hex('#8a5030');
      col[q * 3] = c[0]; col[q * 3 + 1] = c[1]; col[q * 3 + 2] = c[2];
    });
    // where it reaches the road (for the warning triangle)
    let wx = pts[pts.length - 1][0], wy = pts[pts.length - 1][1];
    for (let q = 0; q < n; q++) if (dist[idx[q]] < HALF) { wx = idx[q] % MW; wy = idx[q] / MW | 0; break; }
    return { idx, al, col, ter0, n, len, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, head: pts[0], warn: [wx, wy] };
  });
  yield;

  // ----- decoration that moves (suess.js): gummy bears, gingerbread men, the cookie monster -----
  const bears = def.bears.filter(([x, y]) => ter[y * MW + x] === 0 && !KD[y * MW + x] && dist[y * MW + x] > HALF + 10).map(([x, y], k) => ({ x, y, col: BEARS[k % BEARS.length], hop: k % 2 === 0, ph: hash(x, y, 165) * TAU }));
  const men = def.men.map(([x0, y0, x1, y1], k) => ({ x0, y0, x1, y1, ph: k * 2.3 }));

  return { jumps: RT.jumps, nTramp: RT.nTramp, pushes: RT.pushes, alt: RT.alt, kind: KD, brookM: RT.brookM, brooks: RT.brooks, lollis: RT.lollis, chocoM: new Uint8Array(A), streams,
    caraPix, chocPix, lemPix, lamps, bears, men, factory, workers, iF: RT.iF, iP: RT.iP, iD: RT.iD, spurPts: RT.spurPts, stonePts: RT.stonePts, wayPts: RT.wayPts, bayPts: RT.bayPts,
    iSpur: RT.iSpur, iStones: RT.iStones, iWay: RT.iWay, iPress: RT.iPress, iBay: RT.iBay, gum: RT.gum, pads: RT.pads,
    mountain: def.mountain, fount: def.bay.fount, posts, machine: def.machine, monster: def.monster, clouds: def.clouds };
}
