import { HALF, TAU, hash, hex, vnoise } from './core.js';
import { nearestIdx } from './bau.js';
import { stampLine } from './volcanomap.js';

// ---------- Süßigkeitenland: the liquorice road from the gingerbread house up through the lollipop forest (gummy-bear trampolines over caramel),
// through the caramel moor on a cookie road, down through the candyfloss clouds (soft walls), the U over the waffle bridge across the chocolate
// river (or straight on over the marshmallow stepping stones), the fizz field and the lemonade fountain back to the line ----------
// Terrain: 1 liquorice (the road, the path to the marshmallows, the cookie road in the moor), 0 icing with sprinkles beside it (slow like grass),
// 2 caramel (where `cara` is set: like mud, it makes the car golden and sticks after you leave it, see suess.js) or chocolate (like mud, brown),
// 5 the chocolate lake and river (deep: you fall in and come out brown), 3 the lemonade basin beside the road, 4 fizz pads (boost).
// zone: 1 the caramel moor, 2 the cookie road, 3 the path to the marshmallows, 4 the lemonade fountain (on the road it washes).

const K = Object.fromEntries(Object.entries({
  ice: '#f7b6d0', ice1: '#f2a8c6', ice2: '#fbc6dc', iceE: '#e48cb2', mint: '#bdeedc', mint1: '#b0e6d2', mint2: '#cdf5e6', drip: '#fff4fa',
  lic: '#2a2028', lic1: '#241b22', lic2: '#30262e', licE: '#0e080c', licH: '#5e4e5c', licH2: '#7a6a78', dash: '#fff4fa',
  ck: '#ecc890', ck1: '#e2bc80', ck2: '#f4d6a4', ckG: '#c8965a', ckE: '#6a3e18', ckD: '#b07a40', ckL: '#fff0d0',
  ca: '#e0a030', ca1: '#d08c20', ca2: '#f0bc48', caH: '#ffe08a', caE: '#a8620e',
  br: '#c8904a', br1: '#b88040', brN: '#f0d8a8', brD: '#8a5a2a',
  ch: '#5a3020', ch1: '#4a2618', ch2: '#6a3a26', chH: '#9a5a3a', chE: '#3a1a0e',
  dp: '#40200f', dp1: '#4a2615', dp2: '#56301c', dpS: '#70422a', dpH: '#a07050', dpE: '#2a120a',
  cream: '#fff8ec', cream1: '#f6e6cc', cream2: '#ead4b0',
  wa: '#e8b464', waR: '#f4cc80', waP: '#c88a40', waE: '#9a6228',
  ms: '#fffafc', ms1: '#fff0f6', msS: '#f0cfe0', msE: '#c898b0', msP: '#ffc8e0',
  le: '#fff27a', le1: '#ffe85a', le2: '#fff8b8', leE: '#f0c83a',
  gum: '#ff7ab8', gumH: '#ffb3d6', gumD: '#e0559a',
  fz: '#ffd6e8', fz1: '#fff3b0', fz2: '#cfe8ff', fz3: '#ffffff', fz4: '#d8f5c8',
  gb: '#b8743a', gb1: '#a8662e', gbD: '#7a4620', icg: '#ffffff',
  cane: '#e8344a', caneW: '#ffffff', stick: '#f4f0ea', stickD: '#c8c0b4',
  dough: '#e0a060', doughD: '#b07438', pink: '#ff9ac8', pinkL: '#ffc4e0',
}).map(([k, v]) => [k, hex(v)]));

const SPR = ['#ff4d6d', '#ffd93d', '#6bcb77', '#4d96ff', '#9b5de5', '#ffffff', '#ff9f43'].map(hex);
// lollipops: swirl colour, second colour
const LOLLI = [['#ff4d6d', '#ffffff'], ['#ffd93d', '#ff9f43'], ['#6bcb77', '#ffffff'], ['#4d96ff', '#bfe0ff'], ['#9b5de5', '#ffc4e0'], ['#ff7ab8', '#fff27a']].map(p => p.map(hex));
// the gummy bears (trampolines and decoration)
export const BEARS = ['#ff4d4d', '#ffb02e', '#ffe14d', '#5ad15a', '#ffffff', '#ff7ab8'];

const smooth = f => f * f * (3 - 2 * f);

// terrain, before the ground is painted. S: { MW, MH, def, ter, dist, near, path, tan, nrm, N, deep }
export function* suessTerrain(S) {
  const { MW, MH, def, ter, dist, near, path, tan, nrm } = S, A = MW * MH;
  const cara = new Uint8Array(A), zone = new Uint8Array(A), alt = new Uint8Array(A);
  const off = j => { const i = near[j], p = path[i]; return (j % MW + .5 - p.x) * nrm[i].x + ((j / MW | 0) + .5 - p.y) * nrm[i].y; };
  // the caramel moor: a wide patch round the cookie road (top) and a band along the road on the side of the infield
  const [mx, my, mrx, mry] = def.moor, [k0, k1] = def.cookie.map(([x, y]) => nearestIdx(path, x, y));
  const cookie = i => k0 <= k1 ? i >= k0 && i <= k1 : i >= k0 || i <= k1;
  const inMoor = (x, y, j) => ((x + .5 - mx) / mrx) ** 2 + ((y + .5 - my) / mry) ** 2 < .7 + .6 * vnoise(x * .02, y * .02, 141) ||
    (dist[j] < HALF + 10 + 30 * vnoise(x * .04, y * .04, 145) && cookie(near[j]));
  yield;
  // the caramel moor: the ground is caramel with islands of nut brittle; the road through it is made of cookies, caramel runs over it in places,
  // one winding lane stays clean
  for (let j = 0; j < A; j++) {
    if (j % 40000 === 39999) yield;
    const x = j % MW, y = j / MW | 0;
    if (dist[j] < HALF) {
      if (!cookie(near[j])) continue;
      zone[j] = 2;
      if (ter[j] !== 1) continue;
      const i = near[j], lane = Math.sin(i / 23) * 13, spill = vnoise(x * .06, y * .06, 142);
      if (Math.abs(off(j) - lane) > 12 && spill > .64) { ter[j] = 2; cara[j] = 1; }
    } else if (!inMoor(x, y, j)) continue;
    else if (ter[j] === 0) {
      zone[j] = 1;
      if (vnoise(x * .035, y * .035, 143) > .36 || dist[j] < HALF + 6) { ter[j] = 2; cara[j] = 1; }
    }
  }
  yield;
  // caramel fields on the road (behind the trampolines: jump over them) and chocolate puddles (on the banks of the river)
  const blob = (cx, cy, i, rx, ry, fn) => {
    const tg = tan[i], nm = nrm[i], R = Math.ceil(Math.max(rx, ry) * 1.25) + 2;
    for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(MH - 1, cy + R); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(MW - 1, cx + R); x++) {
      const dx = x + .5 - cx, dy = y + .5 - cy, a = dx * tg.x + dy * tg.y, c = dx * nm.x + dy * nm.y;
      if ((a / rx) ** 2 + (c / ry) ** 2 < .8 + .4 * vnoise(x * .14, y * .14, 144)) fn(y * MW + x);
    }
  };
  for (const [x, y, rx, ry] of def.caramel || []) blob(x, y, nearestIdx(path, x, y), rx, ry, j => { if (ter[j] === 0 || ter[j] === 1) { ter[j] = 2; cara[j] = 1; } });
  for (const [x, y, rx, ry] of def.chocoAt || []) blob(x, y, nearestIdx(path, x, y), rx, ry, j => { if (ter[j] === 0 || ter[j] === 1) { ter[j] = 2; cara[j] = 0; } });
  // the liquorice path to the marshmallows (the stones themselves are road already, see tracks.js)
  stampLine(def.shortcut.pts.map(p => [p[0], p[1], 0]), def.shortcut.half, j => { if (ter[j] === 0) { ter[j] = 1; zone[j] = 3; } if (ter[j] === 1) alt[j] = 1; }, MW, MH);
  // the lemonade fountain: its basin reaches into the road (there it washes), beside the road it is lemonade (water)
  const [lx, ly, lrx, lry] = def.lemon;
  for (let y = ly - lry - 3; y <= ly + lry + 3; y++) for (let x = lx - lrx - 3; x <= lx + lrx + 3; x++) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    const j = y * MW + x, e = ((x + .5 - lx) / lrx) ** 2 + ((y + .5 - ly) / lry) ** 2;
    if (e > 1) continue;
    zone[j] = 4; if (dist[j] >= HALF && ter[j] === 0) ter[j] = 3;
  }
  // the trampolines: a soft jump, the height does not depend on the speed (only how far you fly)
  const jumps = (def.tramps || []).map(([x, y], k) => { const i = nearestIdx(path, x, y), p = path[i]; return { x: p.x, y: p.y, tx: tan[i].x, ty: tan[i].y, lo: -HALF - 4, hi: HALF + 4, vz: 118, i, bear: BEARS[(k * 2 + 1) % BEARS.length], sq: 0 }; });
  yield;
  return { cara, zone, alt, jumps };
}

// painting, after the ground. S: { MW, MH, def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, shore, deep,
// bridgeMask, isBridge, stoneMask, sd, r, mudPix, watPix, darken, RT }
export function* paintSuess(S) {
  const { MW, MH, def, set, setT, path, nrm, N, ter, dist, near, walls, wallMask, washMask, shore, deep, bridgeMask, isBridge, stoneMask, sd, mudPix, watPix, darken, RT } = S, A = MW * MH;
  const { cara, zone } = RT;
  const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < MW && y < MH) set(y * MW + x, c); };
  const solid = (x, y, rr) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X >= 0 && Y >= 0 && X < MW && Y < MH) wallMask[Y * MW + X] = 1; } };
  const off = j => { const i = near[j], p = path[i]; return (j % MW + .5 - p.x) * nrm[i].x + ((j / MW | 0) + .5 - p.y) * nrm[i].y; };
  const at = (j, q) => { const x = j % MW + (q === 0 ? -1 : q === 1 ? 1 : 0), y = (j / MW | 0) + (q === 2 ? -1 : q === 3 ? 1 : 0); return x < 0 || y < 0 || x >= MW || y >= MH ? -1 : y * MW + x; };
  const edgeOf = (j, test) => { for (let q = 0; q < 4; q++) { const k = at(j, q); if (k >= 0 && !test(k)) return true; } return false; };
  const isCara = j => ter[j] === 2 && cara[j], isChoc = j => ter[j] === 2 && !cara[j], isDeep = j => ter[j] === 5;
  mudPix.length = 0; watPix.length = 0;
  const caraPix = [], chocPix = [], lemPix = [];
  const [brX0, brX1, brY0] = def.fizzField; // the fizz field: pastel fizz powder beside the road at the bottom (x from, to, y from)

  yield;
  // ----- the ground -----
  for (let j = 0; j < A; j++) {
    if (j % 30000 === 29999) yield;
    const x = j % MW, y = j / MW | 0, t = ter[j], h = hash(x, y, sd + 140), nv = vnoise(x / 9, y / 9, sd + 141), dd = dist[j], road = dd < HALF;
    let c;
    if (t === 4) continue; // the fizz pads are painted below
    if (road && (bridgeMask[j] || deep[j]) && !stoneMask[j]) {
      // the waffle bridge: a grid of pockets, a darker rim
      const a = near[j] * 2, o = off(j) + 100;
      c = dd > HALF - 3 ? K.waE : (a % 7 < 1.6 || o % 7 < 1.6) ? K.waR : K.waP;
      if (h < .04 && c === K.waP) c = K.wa;
    } else if (stoneMask[j]) {
      // marshmallows: white and pink, lit from the top left
      const q = (def.stones || []).find(s => Math.hypot(x + .5 - s[0], y + .5 - s[1]) < s[2] + 2.5) || [x, y, 1], ddx = x + .5 - q[0], ddy = y + .5 - q[1], e = Math.hypot(ddx, ddy) / q[2];
      const pink = (Math.round(q[0]) >> 3) & 1;
      c = e > .86 ? K.msE : (ddx + ddy) / q[2] > .35 ? K.msS : pink ? K.msP : (ddx + ddy) < -q[2] * .3 ? K.ms : K.ms1;
    } else if (zone[j] === 4 && (road || t === 3)) {
      // lemonade: pale yellow, bubbles rise in it
      c = nv > .62 ? K.le2 : nv < .3 ? K.le1 : K.le; if (h < .03) c = [255, 255, 255];
      if (edgeOf(j, k => zone[k] === 4)) c = K.leE;
      if (road) washMask[j] = 1;
      if (h > .97) lemPix.push(j);
    } else if (t === 2 && cara[j]) {
      // caramel: golden, glossy, a darker rim where it ends
      const v = vnoise(x / 6, y / 6, sd + 142) * .6 + h * .4;
      c = v < .38 ? K.ca1 : v > .68 ? K.ca2 : K.ca; if (Math.abs(vnoise(x / 14, y / 5, sd + 143) - .5) < .025) c = K.caH;
      if (edgeOf(j, isCara)) c = K.caE;
      if (h < .02) caraPix.push(j);
    } else if (t === 2) {
      // chocolate puddles
      const v = nv * .6 + h * .4; c = v < .38 ? K.ch1 : v > .66 ? K.ch2 : K.ch; if (h < .02) c = K.chH;
      if (edgeOf(j, isChoc)) c = K.chE; else mudPix.push(j);
    } else if (t === 5) {
      // the chocolate lake and river: dark, swirls, glossy highlights; darker at the bank
      const v = vnoise(x / 18, y / 10, sd + 144), sw = Math.abs(vnoise(x / 16, y / 16, sd + 145) - .5);
      c = v > .62 ? K.dp2 : v < .35 ? K.dp : K.dp1; if (sw < .025) c = K.dpS; if (h < .004) c = K.dpH;
      if (edgeOf(j, isDeep)) c = K.dpE;
      if (h > .985) chocPix.push(j);
    } else if (road || zone[j] === 3) {
      if (zone[j] === 2) {
        // the cookie road: round biscuits side by side, docking holes, crumbs in the gaps
        const a = near[j] * 2, o = off(j), row = Math.round(o / 15), ca = Math.round((a + (row & 1) * 10) / 20) * 20 - (row & 1) * 10, rd = Math.hypot(a - ca, o - row * 15);
        c = rd > 9.4 ? (h < .5 ? K.ckG : K.ckD) : rd > 8.4 ? K.ckE : nv > .6 ? K.ck2 : h < .5 ? K.ck : K.ck1;
        if (rd < 8 && (Math.round(a) % 5 === 0) && (Math.round(o + 100) % 5 === 0)) c = K.ckD;
        if (dd > HALF - 2) c = K.ckE; else if (dd > HALF - 3) c = K.ckL;
      } else {
        // liquorice: black and glossy, a shine along one side, a dashed line of icing in the middle
        const o = off(j), i = near[j], half = zone[j] === 3 ? def.shortcut.half : HALF, edge = zone[j] === 3 ? !road && edgeOf(j, k => ter[k] === 1 || stoneMask[k]) : dd > HALF - 2.2;
        c = nv > .62 ? K.lic2 : h < .5 ? K.lic : K.lic1;
        if (Math.abs(o + half * .4) < 1.3 && (i % 9) > 1) c = K.licH; else if (Math.abs(o + half * .4 + 2) < .8 && (i % 13) > 6) c = K.licH2;
        if (edge) c = K.licE; else if (zone[j] !== 3 && Math.abs(o) < 1.3 && i % 16 < 8) c = K.dash;
      }
    } else if (t === 3) c = K.le;
    else if (shore[j]) c = h < .5 ? K.cream : K.cream1; // whipped cream along the chocolate
    else if (zone[j] === 1) {
      // nut brittle in the moor between the caramel
      c = nv > .6 ? K.br : K.br1; if (h < .06) c = K.brN; else if (h > .95) c = K.brD;
    } else {
      // icing: pink with mint patches; fizz powder by the fizz field; a darker rim along the road
      const mint = vnoise(x / 70, y / 70, sd + 146) > .66, v = nv * .7 + h * .3;
      if (y > brY0 && x > brX0 && x < brX1 && vnoise(x / 30, y / 30, sd + 147) > .3) { const f = vnoise(x / 9, y / 9, sd + 157); c = h < .012 ? K.fz3 : f < .36 ? K.fz : f < .5 ? K.fz1 : f < .64 ? K.fz2 : K.fz4; }
      else if (mint) c = v < .38 ? K.mint1 : v > .66 ? K.mint2 : K.mint;
      else c = v < .38 ? K.ice1 : v > .66 ? K.ice2 : K.ice;
      if (dd < HALF + 2.5) c = K.iceE; else if (Math.abs(vnoise(x / 40, y / 12, sd + 148) - .5) < .012) c = K.drip;
    }
    set(j, c);
  }

  yield;
  // sprinkles on the icing
  for (let k = 0; k < A * .006; k++) {
    const x = 2 + (S.r() * (MW - 4) | 0), y = 2 + (S.r() * (MH - 4) | 0), j = y * MW + x;
    if (ter[j] !== 0 || zone[j] || shore[j] || dist[j] < HALF + 4) continue;
    const col = SPR[(S.r() * SPR.length) | 0], v = S.r() < .5;
    for (let q = 0; q < 3; q++) px(x + (v ? 0 : q), y + (v ? q : 0), col);
  }
  // the fizz pads: pastel stripes with white chevrons and bubbles
  for (const [bx, by] of def.boostAt || []) S.band(nearestIdx(path, bx, by), 16, (x, y, a, c) => {
    const ac = Math.abs(c); if (ac >= 18) return;
    const h = hash(x, y, sd + 149);
    set(y * MW + x, ac > 16 || Math.abs(a) > 14.5 ? hex('#ff8ac0') : ((a + ac * .8 + 100) % 10) < 3.5 ? [255, 255, 255] : h < .06 ? [255, 255, 255] : (((a + 100) / 10 | 0) & 1) ? hex('#7ee8c8') : hex('#ffd1e8'));
  });
  // the bubblegum spots on the road: a flat pink splat (the bubble grows out of it, see suess.js)
  for (const [gx, gy] of def.gum || []) for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
    const e = Math.hypot(dx, dy) + (vnoise((gx + dx) * .3, (gy + dy) * .3, sd + 150) - .5) * 4; if (e > 9) continue;
    px(gx + dx, gy + dy, e > 7.8 ? K.gumD : dx + dy < -5 ? K.gumH : K.gum);
  }
  // the start line (chequered)
  S.band(0, 6, (x, y, a, c) => { if (Math.abs(c) < HALF) set(y * MW + x, ((Math.floor(a + 6) >> 2) + (Math.floor(c + 100) >> 2)) & 1 ? [245, 245, 240] : [34, 30, 28]); });

  yield;
  // ----- the candy rainbow in the infield (only a picture) -----
  const RB = ['#ff4d6d', '#ff9f43', '#ffd93d', '#6bcb77', '#4d96ff', '#9b5de5'].map(hex), [rx0, ry0, rr0] = def.candyBow;
  for (let y = ry0 - rr0 - 30; y <= ry0; y++) for (let x = rx0 - rr0 - 30; x <= rx0 + rr0 + 30; x++) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    const j = y * MW + x; if (ter[j] !== 0 || zone[j]) continue;
    const dd = Math.hypot(x + .5 - rx0, y + .5 - ry0), b = Math.floor((rr0 + 30 - dd) / 5);
    if (b < 0 || b > 6) continue;
    set(j, b === 6 || (dd > rr0 + 29) ? [255, 255, 255] : RB[b]);
  }
  // clouds at the feet of the rainbow
  for (const s of [-1, 1]) for (let dy = -8; dy <= 8; dy++) for (let dx = -16; dx <= 16; dx++) { const e = (dx / 16) ** 2 + (dy / 8) ** 2; if (e <= 1) setT(rx0 + s * (rr0 + 15) + dx, ry0 - 2 + dy, dy < -2 ? [255, 255, 255] : [236, 240, 250]); }

  yield;
  // ----- the waffle bridge: rails of rolled wafers (solid), a shadow on the chocolate -----
  for (let i = 0; i < N; i += 3) if (isBridge[i]) for (const s of [-1, 1]) walls.push({ x: path[i].x + nrm[i].x * s * HALF, y: path[i].y + nrm[i].y * s * HALF, r: 3 });
  for (let j = 0; j < A; j++) {
    if (!isBridge[near[j]] || dist[j] < HALF - 3 || dist[j] > HALF + 3) continue;
    const dd = dist[j], i = near[j], x = j % MW, y = j / MW | 0;
    if (dd > HALF + 1.5) { if (ter[j] === 5) set(j, K.dpE); continue; }
    setT(x, y, dd < HALF - 2.2 || dd > HALF + .8 ? K.waE : (i >> 1) % 2 ? hex('#f2d08a') : hex('#c8904a'));
  }

  yield;
  // ----- candy canes along the lollipop forest (solid): red and white posts -----
  const [f0, f1] = def.forest.map(([x, y]) => nearestIdx(path, x, y));
  const inRange = (i, a, b) => a <= b ? i >= a && i <= b : i >= a || i <= b;
  for (let i = f0; inRange(i, f0, f1); i = (i + 6) % N) for (const s of [-1, 1]) {
    const x = Math.round(path[i].x + nrm[i].x * s * (HALF + 5)), y = Math.round(path[i].y + nrm[i].y * s * (HALF + 5)); if (x < 2 || y < 2 || x >= MW - 2 || y >= MH - 2) continue;
    const j = y * MW + x; if (ter[j] !== 0 || wallMask[j]) continue;
    walls.push({ x, y, r: 3 }); darken(x + 1, y, 1, 2, 2);
    // a cane standing upright: red and white stripes, the hook at the top bends to the right
    for (let k = 0; k <= 8; k++) for (const dx of [0, 1]) setT(x + dx, y - k, ((k + dx) >> 1) % 2 ? K.cane : K.caneW);
    setT(x + 1, y - 9, K.cane); setT(x + 2, y - 9, K.caneW); setT(x + 3, y - 8, K.cane); setT(x + 3, y - 7, K.caneW);
  }

  yield;
  // ----- lollipops (solid): a swirl on a stick; dense in the forest, some everywhere -----
  const free = (x, y, rr) => {
    if (x < rr || y < rr || x >= MW - rr || y >= MH - rr) return false;
    for (let dy = -rr; dy <= rr; dy += 3) for (let dx = -rr; dx <= rr; dx += 3) { const j = (y + dy) * MW + x + dx; if (ter[j] !== 0 || dist[j] < HALF + 8 || wallMask[j] || zone[j] || shore[j]) return false; }
    return true;
  };
  const lollis = [];
  const lolli = (x, y, rr, k) => {
    lollis.push({ x, y }); walls.push({ x, y, r: rr - 2 }); solid(x, y, rr + 2);
    const [c1, c2] = LOLLI[k % LOLLI.length];
    for (let q = 0; q < 12; q++) { setT(x + 2 + q * .3, y + 3 + q, K.stickD); setT(x + 1 + q * .3, y + 3 + q, K.stick); } // the stick, lying in the light
    darken(x, y, rr, 4, 6);
    for (let dy = -rr - 1; dy <= rr + 1; dy++) for (let dx = -rr - 1; dx <= rr + 1; dx++) {
      const dd = Math.hypot(dx, dy); if (dd > rr) continue;
      const an = Math.atan2(dy, dx), sw = ((an / TAU * 3 + dd / rr * 1.6) % 1 + 1) % 1;
      let c = sw < .5 ? c1 : c2;
      if (dd > rr - 1) c = c.map(v => v * .7 | 0); else if (dx + dy < -rr * .6 && dd > rr * .4) c = c.map(v => Math.min(255, v + 50));
      setT(x + dx, y + dy, c);
    }
    setT(x - Math.round(rr * .4), y - Math.round(rr * .4), [255, 255, 255]); setT(x - Math.round(rr * .4) + 1, y - Math.round(rr * .4), [255, 255, 255]);
  };
  let nl = 0;
  // the forest: on both sides of the road, in rows
  for (let i = f0; inRange(i, f0, f1); i = (i + 11) % N) for (const s of [-1, 1]) for (const o of [HALF + 18, HALF + 42, HALF + 66]) {
    const x = Math.round(path[i].x + nrm[i].x * s * o + (hash(i, o, sd) - .5) * 8), y = Math.round(path[i].y + nrm[i].y * s * o + (hash(o, i, sd) - .5) * 8), rr = 8 + (hash(i, s, sd) * 4 | 0);
    if (free(x, y, rr + 3) && !lollis.some(l => Math.hypot(l.x - x, l.y - y) < 2 * rr + 2)) lolli(x, y, rr, nl++);
  }
  for (let k = 0, tries = 0; k < 26 && tries < 2500; tries++) {
    const x = 20 + (S.r() * (MW - 40) | 0), y = 20 + (S.r() * (MH - 40) | 0), rr = 7 + (S.r() * 5 | 0);
    if (!free(x, y, rr + 10) || lollis.some(l => Math.hypot(l.x - x, l.y - y) < 40)) continue;
    if (Math.hypot(x - def.candyBow[0], y - def.candyBow[1]) < def.candyBow[2] + 40) continue;
    if (x > def.flossLand[0] - 20 && y > def.flossLand[1] - 20 && x < def.flossLand[2] + 20 && y < def.flossLand[3] + 20) continue; // (the candyfloss grows there)
    lolli(x, y, rr, nl++); k++;
  }

  yield;
  // ----- the candyfloss walls along the bends on the right (soft: you bounce off without losing speed, see update.js `bob`) -----
  const [w0, w1] = def.floss.map(([x, y]) => nearestIdx(path, x, y)), floss = [];
  const puff = (x, y, rr, blue) => {
    const P = blue ? ['#bfe0ff', '#d8ecff', '#f2f8ff'].map(hex) : ['#ffb8d8', '#ffd2e6', '#ffeef6'].map(hex);
    darken(Math.round(x), Math.round(y), rr - 1, 3, 5);
    for (let dy = -rr - 2; dy <= rr + 2; dy++) for (let dx = -rr - 2; dx <= rr + 2; dx++) {
      const X = Math.round(x + dx), Y = Math.round(y + dy), e = Math.hypot(dx, dy) + (vnoise(X * .35, Y * .35, sd + 151) - .5) * 5; if (e > rr) continue;
      const lit = (dx + dy) / rr; setT(X, Y, lit < -.5 ? P[2] : lit < .2 ? P[1] : P[0]);
    }
  };
  for (let i = w0; inRange(i, w0, w1); i = (i + 3) % N) for (const s of [-1, 1]) {
    const x = path[i].x + nrm[i].x * s * (HALF + 6), y = path[i].y + nrm[i].y * s * (HALF + 6);
    walls.push({ x, y, r: 4, bob: true, floss: true }); solid(x, y, 6);
  }
  for (let i = w0, n = 0; inRange(i, w0, w1); i = (i + 6) % N, n++) for (const s of [-1, 1]) {
    const o = HALF + 11 + hash(i, s, sd + 152) * 4, x = path[i].x + nrm[i].x * s * o, y = path[i].y + nrm[i].y * s * o;
    puff(x, y, 8 + (hash(s, i, sd + 153) * 4 | 0), ((i / 30) | 0) % 2 === 1); floss.push({ x, y });
  }
  // more candyfloss fills the land between the bends (solid as well)
  const [fx0, fy0, fx1, fy1] = def.flossLand;
  for (let k = 0, tries = 0; k < 40 && tries < 3000; tries++) {
    const x = fx0 + (S.r() * (fx1 - fx0) | 0), y = fy0 + (S.r() * (fy1 - fy0) | 0), j = y * MW + x, rr = 9 + (S.r() * 6 | 0);
    if (ter[j] !== 0 || dist[j] < HALF + rr + 4 || floss.some(f => Math.hypot(f.x - x, f.y - y) < rr + 6)) continue;
    puff(x, y, rr, S.r() < .45); walls.push({ x, y, r: rr - 3, bob: true, floss: true }); solid(x, y, rr); floss.push({ x, y }); k++;
  }

  yield;
  // ----- the gingerbread house by the start: a roof with icing and gumdrops (solid), candy canes at its fence -----
  const [hx0, hy0, hx1, hy1] = def.house, hw = hx1 - hx0, hh = hy1 - hy0, hmx = (hx0 + hx1) / 2;
  for (let y = hy0; y <= hy1; y++) for (let x = hx0; x <= hx1; x++) darken(x + 5, y + 6, 0, 0, 0);
  // the roof (its ridge runs from the back to the front, shingles of gingerbread, lit from the left), the front wall at the bottom
  const fy = hy1 - 22, GBL = hex('#d08848');
  for (let y = hy0 - 3; y <= fy + 2; y++) for (let x = hx0 - 4; x <= hx1 + 4; x++) {
    const ex = Math.min(x - hx0 + 4, hx1 + 4 - x), row = Math.floor((y - hy0 + 3) / 6), tx = ((x - hx0 + (row & 1) * 4) % 8 + 8) % 8;
    const edge = (y - hy0 + 3) % 6 >= 5 - Math.round(Math.abs(tx - 4) * .5), lit = x < hmx;
    let c = edge ? (lit ? K.gb1 : K.gbD) : (lit ? GBL : K.gb);
    if (Math.abs(x - hmx) < 2 || ex < 2 || y < hy0 - 1) c = K.icg;
    setT(x, y, c);
  }
  for (let x = hx0 - 4; x <= hx1 + 4; x++) { const n = 1 + (hash(x >> 1, 2, sd) * 4 | 0); for (let k = 0; k < n; k++) setT(x, fy + 3 + k, K.icg); } // icing drips from the eaves
  for (let y = hy0 + 4; y < fy - 2; y += 9) { const col = SPR[((y / 9) | 0) % SPR.length]; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [-1, 1], [1, -1]]) setT(hmx + dx, y + dy, col); } // gumdrops on the ridge
  for (let y = fy + 3; y <= hy1; y++) for (let x = hx0; x <= hx1; x++) {
    const e = Math.min(x - hx0, hx1 - x, hy1 - y), dx = x - hmx;
    let c = e < 1 ? K.gbD : (y - fy) % 7 === 0 ? K.gb1 : K.gb;
    if (Math.abs(dx) < 6 && y > hy1 - 15) c = Math.abs(dx) > 4.5 || y === hy1 - 14 ? K.icg : hy1 - y === 7 && dx === 2 ? hex('#ff4d6d') : K.ch; // the door of chocolate
    for (const wx of [hx0 + 12, hx1 - 12]) if (Math.abs(x - wx) <= 5 && y > fy + 7 && y < fy + 16) c = Math.abs(x - wx) === 5 || y === fy + 8 || y === fy + 15 || x === wx || y === fy + 11 ? K.icg : hex('#fff27a'); // windows
    setT(x, y, c);
  }
  for (const [cx, cy] of [[hx0 + 10, hy0 + 14], [hx1 - 16, hy0 + 40]]) for (let dy = 0; dy < 9; dy++) for (let dx = 0; dx < 7; dx++) setT(cx + dx, cy + dy, dy < 2 ? K.icg : dx === 0 || dx === 6 ? K.gbD : [190, 70, 60]); // chimneys
  for (let y = hy0; y <= hy1; y += 6) for (const x of [hx0, hx1]) walls.push({ x, y, r: 4 });
  for (let x = hx0; x <= hx1; x += 6) for (const y of [hy0, hy1]) walls.push({ x, y, r: 4 });
  solid(hmx, (hy0 + hy1) / 2, Math.max(hw, hh) / 2 + 6);

  yield;
  // ----- donut stacks at the outer corners (solid) -----
  for (const [x, y] of def.donuts || []) {
    walls.push({ x, y, r: 12 }); solid(x, y, 16); darken(x, y, 13, 4, 6);
    for (const [ox, oy, k] of [[0, 4, 0], [0, 0, 1], [0, -4, 2]]) for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
      const dd = Math.hypot(dx, dy); if (dd > 12 || dd < 4) continue;
      const icing = k === 2 || dy < -2;
      let c = dd > 11 || dd < 5 ? K.doughD : icing ? (k === 2 ? (hash(x + dx, y + dy, 160) < .1 ? SPR[(hash(dx, dy, 161) * 7) | 0] : K.pink) : K.dough) : K.dough;
      if (icing && k === 2 && dx + dy < -8 && dd > 6) c = K.pinkL;
      setT(x + dx + ox, y + dy + oy, c);
    }
  }
  // the candyfloss machine at the edge (solid; it puffs out new clouds, see suess.js)
  const [cmx, cmy] = def.machine;
  walls.push({ x: cmx, y: cmy, r: 13 }); solid(cmx, cmy, 16); darken(cmx, cmy, 13, 4, 6);
  for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) { const e = Math.max(Math.abs(dx), Math.abs(dy)); setT(cmx + dx, cmy + dy, e > 11 ? hex('#7a3a5a') : e > 9 ? hex('#ff7ab8') : Math.hypot(dx, dy) < 7 ? hex('#fff4fa') : hex('#ffc4e0')); }
  // ice cream cone lanterns along the outside of the road (solid posts)
  const lamps = [];
  for (let i = 30; i < N; i += 64) {
    const x = Math.round(path[i].x - nrm[i].x * (HALF + 9)), y = Math.round(path[i].y - nrm[i].y * (HALF + 9));
    if (x < 6 || y < 12 || x >= MW - 6 || y >= MH - 6) continue;
    const j = y * MW + x; if (ter[j] !== 0 || zone[j] || wallMask[j] || shore[j]) continue;
    walls.push({ x, y, r: 3 }); darken(x, y, 3, 2, 3);
    for (let k = 0; k < 7; k++) for (let q = -Math.floor((7 - k) / 2.5); q <= Math.floor((7 - k) / 2.5); q++) setT(x + q, y - k, (k + q) % 2 ? hex('#d89a50') : hex('#b87a38')); // the cone
    lamps.push({ x, y: y - 9, col: SPR[(i / 64 | 0) % SPR.length] });
  }
  // the lemonade fountain: a rim of sugar stones round the basin beside the road, the column in the middle (solid)
  const [lx, ly] = def.lemon;
  for (let j = 0; j < A; j++) {
    if (zone[j] !== 4 || ter[j] !== 3) continue;
    if (!edgeOf(j, k => zone[k] === 4)) continue;
    const x = j % MW, y = j / MW | 0; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) setT(x + dx, y + dy, hash(x >> 2, y >> 2, 162) < .5 ? [255, 255, 255] : hex('#ffb0d0'));
    if (hash(x, y, 163) < .25) walls.push({ x, y, r: 2 });
  }
  walls.push({ x: lx, y: ly, r: 8 });
  for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) { const dd = Math.hypot(dx, dy); if (dd <= 7) setT(lx + dx, ly + dy, dd > 6 ? hex('#c86a9a') : dd > 4 ? hex('#ffb0d0') : hex('#fff27a')); }

  yield;
  // ----- the chocolate streams of the event schoko: the pixels they cover in the order the chocolate reaches them -----
  const streams = (def.streams || []).map(([pts, half], k) => {
    const L = [0]; for (let q = 1; q < pts.length; q++) L.push(L[q - 1] + Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1]));
    const len = L[L.length - 1], best = new Map();
    for (let q = 1; q < pts.length; q++) {
      const [ax, ay] = pts[q - 1], [bx, by] = pts[q], seg = L[q] - L[q - 1], st = Math.max(1, Math.ceil(seg / 2));
      for (let s = 0; s <= st; s++) {
        // the stream winds a little and gets wider towards its end
        const f = s / st, along = L[q - 1] + seg * f, wob = Math.sin(along / 22 + k * 2) * 6 * Math.min(1, along / 30);
        const cx = ax + (bx - ax) * f - (by - ay) / seg * wob, cy = ay + (by - ay) * f + (bx - ax) / seg * wob, w = half * (.75 + .5 * smooth(along / len)), R = Math.ceil(w + 3);
        for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(MH - 1, cy + R); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(MW - 1, cx + R); x++) {
          const j = y * MW + x; if (ter[j] === 5 || ter[j] === 4 || wallMask[j] || stoneMask[j] || zone[j] === 4) continue;
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
      const c = edge ? K.chE : Math.abs(vnoise(x / 9, y / 4, sd + 156) - .5) < .04 ? K.chH : h < .4 ? K.ch1 : h > .8 ? K.ch2 : K.ch;
      col[q * 3] = c[0]; col[q * 3 + 1] = c[1]; col[q * 3 + 2] = c[2];
    });
    return { idx, al, col, ter0, n, len, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, head: pts[0] };
  });

  yield;
  // ----- decoration that moves or is drawn above the cars (see suess.js): gummy bears, gingerbread men -----
  const bears = [], men = [];
  for (let k = 0, tries = 0; k < 16 && tries < 2000; tries++) {
    const x = 12 + (S.r() * (MW - 24) | 0), y = 12 + (S.r() * (MH - 24) | 0);
    if (!free(x, y, 8) || bears.some(b => Math.hypot(b.x - x, b.y - y) < 30)) continue;
    bears.push({ x, y, col: BEARS[k % BEARS.length], hop: S.r() < .5, ph: S.r() * TAU }); k++;
  }
  for (const [x, y] of def.men || []) { men.push({ x, y, ph: hash(x, y, 164) * TAU }); walls.push({ x, y, r: 5 }); }

  return { jumps: RT.jumps, pushes: [], alt: RT.alt, cara, zone, chocoM: new Uint8Array(A), streams, caraPix, chocPix, lemPix, lamps, bears, men,
    lake: def.lake, lemon: def.lemon, machine: def.machine, gum: def.gum || [], flossI: [w0, w1] };
}
