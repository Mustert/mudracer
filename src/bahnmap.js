import { HALF, TAU, hash, hex, vnoise } from './core.js';

// ---------- ZUG: a Bavarian village around the railway (ZUG Rev 2, 1S4-2) ----------
// Everything here is scenery beside the road, painted onto the ground once while the map is built: a village with an onion dome church and a
// maypole on the left, a farm with a barn, a dung heap and a cow pasture in the infield, fields (wheat, ploughed earth, potatoes, hops,
// sunflowers), an orchard, the signal box between the lines and a little station at the bottom. Houses, the church, the maypole and the fruit
// trees are solid (they stand up, with a shadow); fields, gravel and the pale pasture fence are flat and can be driven over (slowly, as grass).
// The cows, the hens and the tractor on the ploughed field move (draw.js drawCritters).
// Every piece checks that it keeps clear of the road, the rails and the tunnel hill; a piece that does not fit is left out.

const C = Object.fromEntries(Object.entries({
  roof: '#c4583c', roof1: '#a8452f', roofD: '#7f3222', roofE: '#5a2216', ridge: '#d9785a',
  barn: '#8a5a34', barn1: '#6f4628', barnD: '#4f3019', barnE: '#33200f',
  slate: '#8c96a3', slate1: '#717b88', slateD: '#545d69', slateE: '#363c45',
  wall: '#f4f0e4', wallS: '#d9d3c2', wallD: '#b8b0a0', plank: '#9a6a3c', plankD: '#6b4422',
  wood: '#8a5a2e', woodD: '#5a3518', win: '#33435a', winL: '#7fa2c4', shut: '#3f7a3a', ger: '#e2332f', gerL: '#ff6a5a',
  cop: '#7cc3a6', cop1: '#4f9a80', copD: '#2f6a56', copE: '#1d4637', gold: '#f2c230', goldD: '#b88a14', clock: '#f8f4e8',
  blue: '#2f6fd0', white: '#f6f6f2', wreath: '#3f8a3a',
  gravel: '#cbbf9c', gravel1: '#bcae88', gravelD: '#a8996f',
  wheat: '#e3c35a', wheat1: '#d1ad44', wheatL: '#f2da86', soil: '#7a5230', soil1: '#634224', soilL: '#8f6440',
  leaf: '#4f9a3a', leafD: '#2f6d24', leafL: '#78c055', hop: '#5fae48', pole: '#7a5a38',
  fence: '#d8c49a', post: '#a8875a', dung: '#5a3a1f', dung1: '#3b2512', straw: '#e8cf7a',
  plat: '#a9a9a2', platL: '#c4c4bc', platE: '#f2c230', sun: '#ffcf1f', sunD: '#5a3a1f',
}).map(([k, v]) => [k, hex(v)]));

// the plan (world px of the 1120 x 630 map): houses [x, y, width, depth of the roof, facade height, kind], fields [x0, y0, x1, y1, kind]
/** @type {[number, number, number, number, number, string][]} */
const HOUSES = [
  [24, 36, 44, 28, 12, 'house'], [88, 96, 40, 28, 11, 'house'], [16, 150, 50, 34, 12, 'house'], [6, 360, 44, 32, 12, 'house'],
  [18, 448, 50, 32, 12, 'house'], [64, 530, 50, 30, 12, 'house'], [1032, 30, 62, 36, 14, 'house'], [700, 170, 72, 36, 14, 'house'],
  [800, 168, 82, 38, 14, 'barn'], [478, 188, 48, 28, 14, 'box'], [656, 574, 58, 26, 12, 'station'], [796, 572, 50, 28, 11, 'house'],
];
const CHURCH = { x: 44, y: 236, w: 36, d: 58, tower: 18, th: 34 };
const MAYPOLE = [108, 372];
/** @type {[number, number, number, number]} */
const SQUARE = [62, 338, 128, 384]; // the village square (gravel)
/** @type {[number, number, number, number, string][]} */
const FIELDS = [
  [232, 8, 392, 64, 'wheat'], [448, 8, 576, 60, 'potato'], [628, 8, 830, 60, 'hops'], [232, 170, 392, 252, 'plough'],
  [232, 348, 392, 460, 'wheat'], [450, 350, 574, 460, 'sun'], [300, 592, 396, 628, 'potato'], [870, 566, 1000, 626, 'wheat'],
];
const PASTURES = [[700, 326, 930, 462, 5], [1046, 362, 1114, 600, 3]]; // [x0, y0, x1, y1, cows]
const ORCHARD = [1046, 176, 1114, 336];
/** @type {[number, number, number, number]} */
const YARD = [690, 228, 906, 270]; // the farmyard (gravel) with the dung heap and the hens
const CROSSES = [[240, 340], [1050, 120]]; // wayside crosses (Feldkreuz)
const PLATFORM = [624, 562, 646, 629];

export function paintVillage(S) {
  const { MW, MH, d, set, ter, dist, walls, wallMask, critters, rail, r, sd } = S;
  const lines = rail ? rail.lines : [];
  const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < MW && y < MH) set(y * MW + x, c); };
  const shade = (x, y, k) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= MW || y >= MH) return; const i = (y * MW + x) * 4; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; };
  const box = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(x, y, c); };
  // is the rectangle clear of the road (m px beyond its edge), the water, the rails and the tunnel hill?
  const free = (x0, y0, x1, y1, m = 14) => {
    for (let y = Math.max(0, y0); y <= Math.min(MH - 1, y1); y += 2) for (let x = Math.max(0, x0); x <= Math.min(MW - 1, x1); x += 2) {
      const j = y * MW + x; if (ter[j] !== 0 || dist[j] < HALF + m || wallMask[j] || lines.some(L => Math.abs(x - L) < 22)) return false;
    }
    return true;
  };
  // keeps trees, flowers and hay bales away (margin m), and makes the footprint solid for the cars (circles every 8 px)
  const block = (x0, y0, x1, y1, m, solid) => {
    for (let y = Math.max(0, y0 - m); y <= Math.min(MH - 1, y1 + m); y++) for (let x = Math.max(0, x0 - m); x <= Math.min(MW - 1, x1 + m); x++) wallMask[y * MW + x] = 1;
    if (solid) for (let y = y0 + 4; y <= y1 - 2; y += 8) for (let x = x0 + 4; x <= x1 - 2; x += 8) walls.push({ x, y, r: 6 });
  };
  const skipped = [];

  // ---- the ground first: fields, gravel, the pasture fences ----
  for (const [x0, y0, x1, y1, kind] of FIELDS) {
    if (!free(x0, y0, x1, y1, 8)) { skipped.push(kind + '@' + x0 + ',' + y0); continue; }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      // ragged edges: the field frays into the grass
      const e = Math.min(x - x0, x1 - x, y - y0, y1 - y) + (vnoise(x * .3, y * .3, sd + 41) - .5) * 4; if (e < 0) continue;
      const h = hash(x, y, sd + 42), row = y % 6;
      let c;
      if (kind === 'wheat') c = row === 0 ? C.wheat1 : h < .08 ? C.wheatL : h > .97 ? C.wheat1 : C.wheat;
      else if (kind === 'plough') c = row < 2 ? C.soil1 : h < .06 ? C.soilL : C.soil;
      else if (kind === 'potato') c = row < 3 ? (h < .5 ? C.leaf : C.leafD) : row === 3 && h < .3 ? C.leafL : C.soil;
      else if (kind === 'hops') c = (x - x0) % 10 < 4 ? (h < .2 ? C.leafD : C.hop) : C.soil1;
      else c = (x - x0) % 12 < 7 && row < 4 ? C.leafD : C.soil;
      px(x, y, c);
    }
    if (kind === 'hops') for (let x = x0 + 2; x <= x1; x += 10) for (let y = y0 + 4; y <= y1; y += 14) { box(x, y - 3, x + 1, y, C.pole); shade(x + 2, y + 1, .75); }
    if (kind === 'sun') for (let x = x0 + 4; x <= x1 - 4; x += 12) for (let y = y0 + 5; y <= y1 - 4; y += 6) {
      // sunflowers: yellow petals round a brown seed head on a short stalk
      const sx = x + (r() * 3 | 0), sy = y;
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; px(sx + Math.round(Math.cos(a) * 2), sy + Math.round(Math.sin(a) * 2), C.sun); }
      px(sx, sy, C.sunD); px(sx + 1, sy, C.sunD); px(sx, sy + 1, C.sunD); px(sx + 1, sy + 1, C.sunD); px(sx + 1, sy + 3, C.leafD);
    }
    block(x0, y0, x1, y1, 0, false);
  }
  const gravel = ([x0, y0, x1, y1], m) => {
    if (!free(x0, y0, x1, y1, m)) { skipped.push('gravel@' + x0 + ',' + y0); return; }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      // a rounded patch (no hard rectangle): a superellipse with a frayed rim
      const qx = (x - (x0 + x1) / 2) / ((x1 - x0) / 2), qy = (y - (y0 + y1) / 2) / ((y1 - y0) / 2), e = 1 - qx ** 4 - qy ** 4 + (vnoise(x * .2, y * .2, sd + 43) - .5) * .5; if (e < 0) continue;
      const h = hash(x, y, sd + 44); px(x, y, h < .1 ? C.gravelD : h < .4 ? C.gravel1 : C.gravel);
    }
    block(x0, y0, x1, y1, 0, false);
  };
  gravel(SQUARE, 10); gravel(YARD, 10);
  // the village lane: a narrow gravel path that winds down the left edge, past the houses (it never meets the race road)
  for (let y = 84; y < MH - 4; y++) {
    const cx = 100 + Math.sin(y / 37) * 5;
    for (let x = Math.round(cx - 3); x <= Math.round(cx + 3); x++) { const j = y * MW + x; if (ter[j] === 0 && dist[j] > HALF + 20 && !wallMask[j]) { const h = hash(x, y, sd + 45); px(x, y, h < .15 ? C.gravelD : h < .5 ? C.gravel1 : C.gravel); } }
  }
  // the platform along the right line (grey slabs with a yellow safety line on the track side); it may touch the ballast
  {
    const [x0, y0, x1, y1] = PLATFORM;
    let ok = true; for (let y = y0; y <= y1 && ok; y += 2) for (let x = x0; x <= x1; x += 2) { const j = y * MW + x; if (ter[j] !== 0 || dist[j] < HALF + 14) { ok = false; break; } }
    if (ok) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(x, y, x === x0 + 1 ? C.platE : x === x0 ? C.slateE : (y % 8 === 0 || x === x1) ? C.plat : C.platL); block(x0, y0, x1, y1, 2, false); }
    else skipped.push('platform');
  }
  for (const [x0, y0, x1, y1, cows] of PASTURES) {
    if (!free(x0, y0, x1, y1, 6)) { skipped.push('pasture@' + x0 + ',' + y0); continue; }
    // a pale, flat wooden fence (Grundsatz 10: it does not stop a car), posts every 8 px
    for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) { px(x, y, C.fence); if ((x - x0) % 8 === 0) { px(x, y - 1, C.post); px(x, y, C.post); } }
    for (let y = y0; y <= y1; y++) for (const x of [x0, x1]) { px(x, y, C.fence); if ((y - y0) % 8 === 0) { px(x, y, C.post); px(x + 1, y, C.post); } }
    // trampled spots and a few darker tufts
    for (let k = 0; k < 6; k++) { const cx = x0 + 10 + r() * (x1 - x0 - 20), cy = y0 + 10 + r() * (y1 - y0 - 20); for (let dy = -4; dy <= 4; dy++) for (let dx = -6; dx <= 6; dx++) if (dx * dx / 36 + dy * dy / 16 < 1 && hash(cx + dx, cy + dy, sd + 46) < .5) shade(cx + dx, cy + dy, .9); }
    for (let k = 0; k < cows; k++) critters.push({ type: 'cow', x: x0 + 16 + r() * (x1 - x0 - 32), y: y0 + 12 + r() * (y1 - y0 - 24), range: 6 + r() * 10, ph: r() * TAU, brown: r() < .65 });
    block(x0, y0, x1, y1, 4, false);
  }

  // ---- things that stand up: drawn in the oblique view of the trees (shadow to the bottom right) ----
  const shadowRect = (x0, y0, x1, y1, ox, oy) => { for (let y = y0 + oy; y <= y1 + oy; y++) for (let x = x0 + ox; x <= x1 + ox; x++) shade(x, y, .72); };
  // a house: the roof seen from above (ridge along x, the upper slope in the light), below it the front wall with a wooden balcony full of
  // geraniums, windows with green shutters and a door. kind: house, barn (wooden walls, big doors, dark wooden roof), box (the signal box:
  // a band of windows), station (a clock and a bench)
  const house = (x, y, w, dp, fh, kind) => {
    const x1 = x + w, y1 = y + dp + fh;
    if (!free(x - 2, y - 2, x1 + 7, y1 + 6, 14)) { skipped.push(kind + '@' + x + ',' + y); return; }
    shadowRect(x + 2, y + 2, x1, y1, 6, 5);
    const R = kind === 'barn' ? [C.barn, C.barn1, C.barnD, C.barnE] : kind === 'box' ? [C.slate, C.slate1, C.slateD, C.slateE] : [C.roof, C.roof1, C.roofD, C.roofE];
    const wallC = kind === 'barn' ? C.plank : C.wall, wallD = kind === 'barn' ? C.plankD : C.wallS;
    // front wall
    for (let yy = y + dp; yy <= y1; yy++) for (let xx = x + 2; xx <= x1 - 2; xx++) {
      let c = yy === y1 ? C.slateE : xx === x + 2 || xx === x1 - 2 ? C.wallD : yy < y + dp + 2 ? wallD : wallC;
      if (kind === 'barn' && (xx - x) % 4 === 0 && yy < y1) c = C.plankD;
      px(xx, yy, c);
    }
    if (kind === 'barn') {
      // two big wooden doors with a cross brace
      for (const cx of [x + w * .3, x + w * .7]) { const dx0 = Math.round(cx - 7), dy0 = y + dp + 4; for (let yy = dy0; yy < y1; yy++) for (let xx = dx0; xx <= dx0 + 14; xx++) px(xx, yy, (xx - dx0 === (yy - dy0)) || (dx0 + 14 - xx === (yy - dy0)) || xx === dx0 || xx === dx0 + 14 ? C.woodD : C.wood); }
    } else {
      const wy = y + dp + 3, n = Math.max(2, Math.floor((w - 8) / 10));
      if (kind !== 'box' && fh >= 12) {
        // the wooden balcony along the upper floor, red geraniums in the boxes
        for (let xx = x + 4; xx <= x1 - 4; xx++) { px(xx, wy + 3, C.woodD); px(xx, wy + 4, (xx & 1) ? C.wood : C.woodD); px(xx, wy + 2, hash(xx, wy, sd + 47) < .55 ? ((xx & 1) ? C.ger : C.gerL) : C.leafD); }
      }
      for (let k = 0; k < n; k++) {
        const wx = Math.round(x + 6 + (k + .5) * (w - 12) / n) - 1;
        if (kind === 'box') { box(wx - 3, wy - 1, wx + 4, wy + 3, C.win); px(wx - 2, wy, C.winL); px(wx + 2, wy, C.winL); continue; }
        box(wx, wy - 1, wx + 2, wy + 1, C.win); px(wx, wy - 1, C.winL); px(wx - 1, wy - 1, C.shut); px(wx - 1, wy, C.shut); px(wx + 3, wy - 1, C.shut); px(wx + 3, wy, C.shut);
        if (fh >= 12) { box(wx, wy + 6, wx + 2, wy + 8, C.win); px(wx, wy + 6, C.winL); px(wx - 1, wy + 6, C.shut); px(wx + 3, wy + 6, C.shut); }
      }
      const dx0 = Math.round(x + w / 2) - 2; box(dx0, y1 - 6, dx0 + 4, y1 - 1, C.woodD); box(dx0 + 1, y1 - 5, dx0 + 3, y1 - 1, C.wood);
      if (kind === 'station') {
        // the station clock over the door and a bench beside it
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) px(dx0 + 2 + dx, y + dp + 2 + dy, dx * dx + dy * dy > 3 ? C.slateE : C.clock);
        px(dx0 + 2, y + dp + 1, C.slateE); px(dx0 + 3, y + dp + 2, C.slateE);
        box(x - 8, y1 - 3, x - 2, y1 - 3, C.wood); px(x - 8, y1 - 2, C.woodD); px(x - 2, y1 - 2, C.woodD);
      }
    }
    // the roof: two slopes, tile rows, a light ridge, dark eaves and gable edges; a chimney
    const mid = y + Math.floor(dp / 2);
    for (let yy = y; yy < y + dp; yy++) for (let xx = x; xx <= x1; xx++) {
      const up = yy < mid, edge = xx === x || xx === x1 || yy === y || yy === y + dp - 1;
      let c = edge ? R[3] : yy === mid || yy === mid - 1 ? (yy === mid - 1 ? (kind === 'barn' ? R[0] : C.ridge) : R[2]) : up ? R[0] : R[1];
      if (!edge && yy !== mid && yy !== mid - 1 && (Math.abs(yy - mid) % 3 === 0)) c = up ? R[1] : R[2];
      if (!edge && kind === 'barn' && (xx - x) % 6 === 0 && yy !== mid - 1) c = R[2];
      px(xx, yy, c);
    }
    if (kind === 'house' || kind === 'station') { const cx = x + Math.round(w * .72), cy = y + 3; box(cx, cy, cx + 3, cy + 4, C.roofE); box(cx + 1, cy, cx + 2, cy + 2, C.slateD); }
    block(x - 2, y - 2, x1 + 2, y1 + 2, 12, true);
  };
  for (const h of HOUSES) house(...h);

  // the church: a long nave (slate roof, ridge along y), the tower in front with a clock and the green onion dome with a golden knob and cross
  {
    const { x, y, w, d: dp, tower: tw, th } = CHURCH, tx = x + Math.round((w - tw) / 2), ty1 = y + dp + th;
    if (free(x - 2, y - 2, x + w + 7, ty1 + 6, 14)) {
      shadowRect(x + 2, y + 2, x + w, y + dp + 6, 7, 6); shadowRect(tx, y + dp, tx + tw, ty1, 9, 7);
      const mx = x + Math.floor(w / 2);
      for (let yy = y; yy <= y + dp + 6; yy++) for (let xx = x; xx <= x + w; xx++) {
        const edge = xx === x || xx === x + w || yy === y, left = xx < mx;
        let c = edge ? C.slateE : xx === mx ? C.platL : xx === mx + 1 ? C.slateD : left ? C.slate : C.slate1;
        if (!edge && xx !== mx && xx !== mx + 1 && (yy - y) % 4 === 0) c = left ? C.slate1 : C.slateD;
        px(xx, yy, c);
      }
      // the tower: white walls, the clock, the belfry opening
      for (let yy = y + dp - 4; yy <= ty1; yy++) for (let xx = tx; xx <= tx + tw; xx++) px(xx, yy, yy === ty1 ? C.slateE : xx === tx || xx === tx + tw ? C.wallD : xx > tx + tw - 4 ? C.wallS : C.wall);
      const cx = tx + tw / 2, cy = y + dp + 8;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const dd = dx * dx + dy * dy; if (dd <= 11) px(cx + dx, cy + dy, dd > 6 ? C.goldD : C.clock); }
      px(cx, cy - 1, C.slateE); px(cx, cy - 2, C.slateE); px(cx + 1, cy, C.slateE);
      box(Math.round(cx) - 1, cy + 7, Math.round(cx) + 1, cy + 11, C.slateE);
      box(Math.round(cx) - 2, ty1 - 7, Math.round(cx) + 2, ty1 - 1, C.woodD); // the church door
      // the onion dome above the tower: a neck, the bulb, a point, the golden knob and cross
      const base = y + dp - 4, prof = [9, 9, 8, 8, 9, 10, 10, 10, 9, 8, 7, 5, 4, 3, 2, 2, 1, 1, 1];
      for (let k = 0; k < prof.length; k++) {
        const yy = base - k, hw = prof[k];
        for (let dx = -hw; dx <= hw; dx++) px(cx + dx, yy, Math.abs(dx) === hw ? C.copE : dx < -hw * .35 ? C.cop : dx > hw * .45 ? C.copD : C.cop1);
      }
      const top = base - prof.length;
      px(cx, top, C.gold); px(cx, top - 1, C.goldD); px(cx - 1, top - 1, C.gold); px(cx + 1, top - 1, C.gold);
      for (let k = 2; k <= 6; k++) px(cx, top - k, C.goldD); px(cx - 1, top - 5, C.goldD); px(cx + 1, top - 5, C.goldD);
      block(x - 2, top - 6, x + w + 4, ty1 + 2, 12, true);
    } else skipped.push('church');
  }

  // the maypole on the village square: a tall pole with the blue and white spiral, signs of the trades and a wreath, the green top
  {
    const [mx, my] = MAYPOLE, hgt = 56;
    for (let k = 1; k <= hgt * .6; k++) shade(mx + 2 + k * .55, my + 1 + k * .45, .7);
    for (let k = 0; k < hgt; k++) for (let dx = 0; dx <= 1; dx++) px(mx + dx, my - k, ((k + dx * 2) % 8) < 4 ? C.blue : C.white);
    for (const [k, s] of [[18, -1], [26, 1], [34, -1], [42, 1]]) { const bx = mx + (s < 0 ? -6 : 3); box(bx, my - k - 2, bx + 4, my - k + 1, C.white); px(bx + 2, my - k, s < 0 ? C.blue : C.roof); px(bx + (s < 0 ? 5 : -1), my - k, C.woodD); }
    for (let a = 0; a < TAU; a += .3) px(mx + Math.round(Math.cos(a) * 5), my - hgt + 6 + Math.round(Math.sin(a) * 2), (a * 3 | 0) % 2 ? C.wreath : C.ger);
    for (let dy = -4; dy <= 0; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.abs(dx) <= 3 + dy * .6) px(mx + dx, my - hgt + dy, dy < -2 ? C.leafL : C.leafD);
    walls.push({ x: mx, y: my, r: 3 });
    block(mx - 4, my - hgt, mx + 4, my + 4, 16, false);
  }

  // wayside crosses: a small wooden cross with a little roof and flowers at its foot
  for (const [cx, cy] of CROSSES) {
    if (!free(cx - 4, cy - 14, cx + 6, cy + 2, 12)) { skipped.push('cross@' + cx); continue; }
    for (let k = 1; k <= 8; k++) shade(cx + 1 + k * .6, cy + k * .4, .75);
    box(cx, cy - 12, cx, cy, C.woodD); box(cx - 3, cy - 9, cx + 3, cy - 9, C.woodD); box(cx - 2, cy - 14, cx + 2, cy - 13, C.barnE);
    px(cx - 2, cy + 1, C.ger); px(cx + 2, cy + 1, C.sun); px(cx - 1, cy + 1, C.leafD); px(cx + 1, cy + 1, C.leafD);
    walls.push({ x: cx, y: cy, r: 2 }); block(cx - 4, cy - 4, cx + 4, cy + 3, 6, false);
  }

  // the orchard: small fruit trees in rows (red apples), solid like the big trees
  {
    const [x0, y0, x1, y1] = ORCHARD;
    for (let y = y0 + 10, row = 0; y <= y1 - 8; y += 26, row++) for (let x = x0 + 8 + (row & 1) * 13; x <= x1 - 6; x += 26) {
      if (!free(x - 8, y - 8, x + 12, y + 12, 12)) continue;
      for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) if (dx * dx + dy * dy <= 42) shade(x + dx + 4, y + dy + 5, .78);
      for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
        const dd = Math.hypot(dx, dy) + (vnoise((x + dx) * .5, (y + dy) * .5, sd + 48) - .5) * 2.5; if (dd > 6.5) continue;
        const s = (dx + dy) / 7; let c = dd > 5.6 ? C.leafD : s < -.4 ? C.leafL : s > .4 ? C.leafD : C.leaf;
        if (hash(x + dx, y + dy, sd + 49) < .07) c = C.ger;
        px(x + dx, y + dy, c);
      }
      walls.push({ x, y, r: 5 }); block(x - 7, y - 7, x + 7, y + 7, 8, false);
    }
  }

  // the farmyard: a steaming dung heap (Misthaufen) and a few hens pecking around it
  {
    const hx = YARD[2] - 26, hy = YARD[3] - 14;
    for (let dy = -8; dy <= 8; dy++) for (let dx = -14; dx <= 14; dx++) {
      const e = dx * dx / 196 + dy * dy / 64; if (e > 1) continue;
      const h = hash(hx + dx, hy + dy, sd + 50); px(hx + dx, hy + dy, e > .8 ? C.dung1 : h < .12 ? C.straw : dy < -2 ? C.soil : C.dung);
    }
    walls.push({ x: hx - 6, y: hy, r: 7 }, { x: hx + 6, y: hy, r: 7 });
    critters.push({ type: 'hens', x: YARD[0] + 50, y: YARD[1] + 22, ph: r() * TAU });
  }
  // the tractor ploughs the field in the infield, up and down its rows
  const pl = FIELDS.find(f => f[4] === 'plough');
  if (pl && !skipped.includes('plough@' + pl[0] + ',' + pl[1])) critters.push({ type: 'tractor', x0: pl[0] + 12, x1: pl[2] - 12, y0: pl[1] + 12, y1: pl[3] - 12, ph: r() * TAU });

  // telegraph poles along both lines (outside the road and the tunnel hill)
  for (const L of lines) for (let y = 10; y < MH; y += 64) {
    const x = L + 26, j = y * MW + x; if (ter[j] !== 0 || dist[j] < HALF + 10 || wallMask[j]) continue;
    for (let k = 1; k <= 8; k++) shade(x + 1 + k * .6, y + k * .45, .75);
    box(x, y - 12, x, y, C.woodD); box(x - 3, y - 11, x + 3, y - 11, C.woodD); px(x - 3, y - 12, C.white); px(x + 3, y - 12, C.white);
  }
  return skipped;
}
