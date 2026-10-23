import { HALF, TAU, clamp, hash, hex, mk, smooth, vnoise } from './core.js';
import { nearestIdx, startLine } from './bau.js';
import { stampLine } from './volcanomap.js';

// ---------- Wueste Rev 3: the desert rally, the big pyramid with its two forks ----------
// From the start line the road goes up the left straight, round one bend and then there is no road any more: open desert (rally sand) up to the
// ram avenue and the sphinx gate, where the road begins again. It turns down to the doorway on the east side of the pyramid and runs through it from
// right to left (two forks), out of the west side onto the start straight. See plaene/WUESTE_REV3.md.
// Terrain: 1 the road (sand road outside, stone slabs inside the pyramid), 60 rally sand (the whole open field: a little slower, a little sandy),
// 0 soft sand (a patch of the field: slow and sandy, a decision), 2 the damp bank of an oasis, 3 the shallow water of an oasis (washes), solid rock
// and the walls inside the pyramid, 61 quicksand that is about to open (harmless, a warning), 10 quicksand (the pull, trackfx.js sinkInSand),
// 11 shaft (no ground: you fall).

export const RALLY = 60;

const K = Object.fromEntries(Object.entries({
  sand: '#ecca8a', sand1: '#e2bf7c', sand2: '#f4d69e', sandD: '#d2ac6c', sandL: '#fae4b4', peb: '#a07a48', pebL: '#f2dcb0',
  soft1: '#f3dca6', soft2: '#e9ca8c', soft3: '#c9a468',
  road: '#d9b57c', road1: '#cfaa6e', road2: '#e2c08a', roadE: '#b8915a',
  water: '#2fa6b2', water1: '#1f8c9c', water2: '#46bcc2', waterL: '#8ee0dc', bank: '#b99a62', bank1: '#a98a54', bank2: '#c8aa72',
  st: '#d8b06a', stL: '#f0cc86', stD: '#a8803e', stDD: '#7e5c28', gold: '#ffd84a', goldD: '#c89a20',
  wallE: '#7a5a38', floor: '#8a6c44', floor1: '#7e6240', floor2: '#947650', floorD: '#6a5030', kerb: '#b08a54', wall: '#4a3420', wallL: '#6a4c2e', wallD: '#2e1e10',
  rock: '#b07a48', rockL: '#d49a62', rockD: '#7a4c28', rockDD: '#5a361a',
  cac: '#3f9a4a', cacL: '#6cc070', cacD: '#256a30', spine: '#f4f0d0',
  camel: '#c89a5c', camelD: '#9a703c', camelL: '#e0b87a',
}).map(([k, v]) => [k, hex(v)]));

// a soft sand patch: the oval distance in the turned frame of the patch, and its ragged outline (e below the limit is inside)
const softE = (P, x, y) => { const dx = x + .5 - P.x, dy = y + .5 - P.y, c = Math.cos(P.a), s = Math.sin(P.a); return ((dx * c + dy * s) / P.rx) ** 2 + ((-dx * s + dy * c) / P.ry) ** 2; };
const softLim = (P, x, y) => .8 + .4 * vnoise(x * .1, y * .1, 72 + P.k);

// terrain, before the ground is painted. S: { def, ter, dist, near, path, tan, nrm, N }
export function* desertTerrain(S) {
  const { MW, MH, def, ter, near, path, tan, nrm, N } = S, A = MW * MH, alt = new Uint8Array(A);
  const [fx1, fy1] = def.field;
  yield;
  // the open field: no road between the first bend and the gate (the road of the centre line turns into rally sand, with a ragged end), and all
  // the ground beside it, up to the pyramid wall at the bottom and the avenue on the right, is rally sand too
  const iA = path.findIndex(p => p.x > 175), iB = path.findIndex((p, i) => i > iA && p.x >= fx1);
  for (let j = 0; j < A; j++) {
    if (j % 60000 === 59999) yield;
    const x = j % MW, y = (j / MW) | 0;
    if (ter[j] === 1) {
      const i = near[j] + (vnoise(x * .09, y * .09, 71) - .5) * 40;
      if (i > iA && i < iB) { ter[j] = RALLY; alt[j] = 1; }
    } else if (ter[j] === 0 && x < fx1 && y < fy1) { ter[j] = RALLY; alt[j] = 1; }
  }
  yield;
  // the forks: the stretch of the centre line between the entry and the exit is a wall in the middle; the two branches are narrow roads of their own
  const forks = (def.forks || []).map(F => {
    const i1 = nearestIdx(path, F.from[0], F.from[1]), i2 = nearestIdx(path, F.to[0], F.to[1]), f = { ...F, i1, i2, len: (i2 - i1 + N) % N };
    for (let q = 0; q < f.len; q++) {
      const p = path[(i1 + q) % N];
      for (let y = Math.max(0, Math.floor(p.y - HALF - 1)); y <= Math.min(MH - 1, p.y + HALF + 1); y++) for (let x = Math.max(0, Math.floor(p.x - HALF - 1)); x <= Math.min(MW - 1, p.x + HALF + 1); x++) {
        const j = y * MW + x; if (ter[j] === 1 && ((near[j] - i1 + N) % N) < f.len) ter[j] = 0;
      }
    }
    for (const side of ['up', 'down']) f[side + 'P'] = stampLine(F[side], F.half, j => { ter[j] = 1; alt[j] = 1; }, MW, MH);
    // the shaft in the jump branch: no ground over the whole width, a few steps beyond the lip (the cars come from the east)
    if (F.shaft) {
      const cy = F[F.jump][1][1], sx1 = F.shaft.lip - 6, sx0 = sx1 - F.shaft.w;
      for (let y = cy - 30; y <= cy + 30; y++) for (let x = sx0; x <= sx1; x++) if (ter[y * MW + x] === 1) ter[y * MW + x] = 11;
      f.shaftR = { x0: sx0, x1: sx1, y: cy, lip: F.shaft.lip, landI: (i2 + 6) % N };
    }
    return f;
  });
  yield;
  // places in the field are given along the line (x on the field, offset to the side of the line: positive is to its right)
  const lineAt = x => { const i = path.findIndex((p, k) => k >= iA && k <= iB && p.x >= x); return i < 0 ? iB : i; };
  const onLine = (x, off) => { const i = lineAt(x), p = path[i], n = nrm[i], t = tan[i]; return { i, x: p.x + n.x * off, y: p.y + n.y * off, tx: t.x, ty: t.y, nx: n.x, ny: n.y }; };
  // soft sand: ragged patches that lie in a hollow of the dunes, mostly on the ideal line (the clean way round costs a detour)
  const soft = (def.soft || []).map(([x, off, rx, ry], k) => {
    const o = onLine(x, off), P = { x: o.x, y: o.y, rx, ry, a: Math.atan2(o.ty, o.tx), k }, R = Math.ceil(Math.max(rx, ry) * 1.3) + 2;
    for (let y = Math.max(0, Math.floor(o.y - R)); y <= Math.min(MH - 1, o.y + R); y++) for (let x2 = Math.max(0, Math.floor(o.x - R)); x2 <= Math.min(MW - 1, o.x + R); x2++) {
      const j = y * MW + x2;
      if (ter[j] === RALLY && softE(P, x2, y) < softLim(P, x2, y)) ter[j] = 0;
    }
    return P;
  });
  yield;
  // the oases: shallow water (it washes, nobody sinks), a damp bank of mud round it except on the side where you come from
  const oases = (def.oases || []).map(([ox, oy, rx, ry]) => {
    const near0 = path[nearestIdx(path, ox, oy)], open = Math.atan2(near0.y - oy, near0.x - ox), O = { x: ox, y: oy, rx, ry, open, i: nearestIdx(path, ox, oy) };
    for (let y = Math.max(0, oy - ry - 16); y < Math.min(MH, oy + ry + 16); y++) for (let x = Math.max(0, ox - rx - 16); x < Math.min(MW, ox + rx + 16); x++) {
      const j = y * MW + x, e = ((x + .5 - ox) / rx) ** 2 + ((y + .5 - oy) / ry) ** 2, lim = .85 + .3 * vnoise(x * .12, y * .12, 61);
      if (ter[j] !== RALLY && ter[j] !== 0) continue;
      if (e < lim * .8) { ter[j] = 3; alt[j] = 1; continue; }
      const an = Math.atan2(y - oy, x - ox), gap = Math.abs(Math.atan2(Math.sin(an - open), Math.cos(an - open)));
      if (e < lim * 1.3 + .1 * vnoise(x * .25, y * .25, 66) && gap > .75) ter[j] = 2;
    }
    return O;
  });
  yield;
  // the dunes to jump over: broad crests across the field, square to the line, as wide as the field is tall; blocks of sandstone (the cars go round
  // them), cacti, signposts
  const jumps = (def.dunes || []).map(x => { const o = onLine(x, 0); return { x: o.x, y: o.y, tx: o.tx, ty: o.ty, lo: -120, hi: 120, vz: 64, dune: true }; });
  // (the jumps over the shafts: from the lip to the west, the whole width of the branch; if it falls short it is set down behind the fork)
  for (const f of forks) if (f.shaftR) jumps.push({ x: f.shaftR.lip, y: f.shaftR.y, tx: -1, ty: 0, lo: -30, hi: 30, vz: 100, land: f.shaftR.landI, shaft: true });
  const blocks = (def.blocks || []).map(([x, off]) => { const o = onLine(x, off); return { x: o.x, y: o.y, nx: o.nx, ny: o.ny, tx: o.tx, ty: o.ty }; });
  const cacti = (def.cacti || []).map(([x, off]) => { const o = onLine(x, off); return { x: Math.round(o.x), y: Math.round(o.y), r: 8 }; });
  const signs = (def.signs || []).map((x, k) => { const o = onLine(x, k % 2 ? 88 : -88); return { x: Math.round(o.x), y: Math.round(o.y) }; });
  const bugs = forks.flatMap(f => (f.bugs || []).map(x => ({ x, y: f.up[1][1] })));
  return { alt, forks, iA, iB, soft, oases, jumps, blocks, cacti, signs, bugs, shafts: forks.filter(f => f.shaftR).map(f => f.shaftR), obst: [] };
}

// painting, after the ground. S: { def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, sd, th, r, watPix, RT }
export function* paintDesert(S) {
  const { MW, MH, def, d, set, setT, path, nrm, N, ter, dist, walls, wallMask, sd, watPix, RT } = S, A = MW * MH;
  const [x0, y0, x1, y1] = def.pyramid, PW = x1 - x0, PH = y1 - y0, inFoot = (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < MW && y < MH) set(y * MW + x, c); };
  const dk = (x, y, k) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= MW || y >= MH) return; const i = (y * MW + x) * 4; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; };
  const solid = (x, y, rr) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X >= 0 && Y >= 0 && X < MW && Y < MH) wallMask[Y * MW + X] = 1; } };
  yield;
  // ----- the ground: rally sand and dunes with wind ripples, the sand road, the water and the bank of the oases, the stone floor inside the pyramid -----
  for (let j = 0; j < A; j++) {
    if (j % 40000 === 39999) yield;
    const x = j % MW, y = (j / MW) | 0, t = ter[j], h = hash(x, y, sd + 40);
    let c;
    if (inFoot(x, y)) {
      if (t === 1) {
        // slabs with joints and a darker kerb where the road meets the wall
        const slab = (x % 12 === 0 || (y + ((x / 12 | 0) & 1) * 6) % 12 === 0);
        c = slab ? K.floorD : h < .1 ? K.floor1 : h > .9 ? K.floor2 : K.floor;
        if (ter[j - 1] !== 1 || ter[j + 1] !== 1 || ter[j - MW] !== 1 || ter[j + MW] !== 1) c = K.kerb;
      } else {
        // the walls: courses of dark sandstone bricks, a lit edge where they meet the floor
        const road = u => u === 1 || u === 11, brick = y % 6 === 0 || (x + ((y / 6 | 0) & 1) * 6) % 12 === 0;
        c = road(ter[j - 1]) || road(ter[j + 1]) || road(ter[j - MW]) || road(ter[j + MW]) ? K.wallE : brick ? K.wallD : h < .08 ? K.wallL : K.wall;
      }
    } else if (t === 1) {
      const v = vnoise(x / 7, y / 7, sd + 41) * .55 + h * .45;
      c = v < .33 ? K.road1 : v > .7 ? K.road2 : K.road;
      if (dist[j] > HALF - 3 && !RT.alt[j]) c = K.roadE; else if (h > .992) c = K.pebL; else if (h < .008) c = K.peb;
    } else if (t === 3) {
      const v = vnoise(x / 6, y / 4, sd + 46);
      c = v < .35 ? K.water1 : v > .72 ? K.water2 : K.water;
      if (ter[j - 1] !== 3 || ter[j + 1] !== 3 || ter[j - MW] !== 3 || ter[j + MW] !== 3) c = K.waterL;
      if (h < .03) watPix.push(j);
    } else if (t === 2) {
      c = h < .25 ? K.bank1 : h > .75 ? K.bank2 : K.bank;
    } else if (t === 0 || t === RALLY) {
      // wind ripples across the sand, with darker hollows between big dunes (the rally sand is a little coarser)
      const big = vnoise(x / 60, y / 40, sd + 42), rip = Math.sin(x * .18 + y * .55 + vnoise(x / 18, y / 18, sd + 43) * 9);
      c = rip > .72 ? K.sandL : rip < -.6 ? K.sand1 : big < .32 ? K.sand1 : big > .7 ? K.sand2 : K.sand;
      if (h < .006) c = K.peb; else if (t === RALLY && h < .05) c = K.sandD;
    } else continue;
    set(j, c);
  }
  yield;
  startLine(S);

  yield;
  // ----- the dunes across the field: bright where you drive up, the crest, a shadow behind it (the ends fade out into the field) -----
  for (const J of RT.jumps) {
    if (!J.dune) continue;
    const nx = -J.ty, ny = J.tx, R = 135;
    for (let y = Math.floor(J.y - R); y <= J.y + R; y++) for (let x = Math.floor(J.x - R); x <= J.x + R; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const j = y * MW + x; if (ter[j] !== RALLY) continue;
      const dx = x + .5 - J.x, dy = y + .5 - J.y, a = dx * J.tx + dy * J.ty, l = dx * nx + dy * ny;
      if (a < -26 || a > 14 || Math.abs(l) > 120) continue;
      const fade = smooth(clamp((120 - Math.abs(l)) / 30, 0, 1)), k = 1 + (a < 0 ? .14 * (1 + a / 26) : -.22 * (1 - a / 14)) * fade, i = j * 4;
      d[i] = clamp(d[i] * k, 0, 255); d[i + 1] = clamp(d[i + 1] * k, 0, 255); d[i + 2] = clamp(d[i + 2] * k, 0, 255);
      if (Math.abs(a) < .8 && fade > .5) set(j, K.sandL);
    }
  }
  yield;
  // ----- soft sand: a hollow of loose, pale sand with a dark rim, the rally sand round it darkens towards it -----
  for (const P of RT.soft) {
    const R = Math.ceil(Math.max(P.rx, P.ry) * 1.7) + 2;
    for (let y = Math.max(0, Math.floor(P.y - R)); y <= Math.min(MH - 1, P.y + R); y++) for (let x = Math.max(0, Math.floor(P.x - R)); x <= Math.min(MW - 1, P.x + R); x++) {
      const j = y * MW + x, e = softE(P, x, y), lim = softLim(P, x, y);
      if (ter[j] === 0 && e < lim) {
        const q = e / lim, ring = Math.sin(Math.sqrt(e) * 11 + vnoise(x * .1, y * .1, 74) * 4);
        set(j, q > .82 ? K.soft3 : ring > .55 ? K.soft1 : q < .5 ? K.soft1 : K.soft2);
      } else if (ter[j] === RALLY && e < lim * 1.6) dk(x, y, 1 - .2 * (1 - (e - lim) / (lim * .6)));
    }
  }
  yield;
  // ----- the oases: palm trees round the water (their crowns on the top layer), a camel resting in the shade -----
  const PAL = ['#2a8a3c', '#3cac4e', '#74d66c'].map(hex);
  const palm = (x, y) => {
    walls.push({ x, y, r: 4 }); solid(x, y, 6);
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) if (dx * dx + dy * dy < 50) dk(x + dx + 5, y + dy + 7, .75);
    const off = hash(x, y, 7) * TAU;
    for (let k = 0; k < 7; k++) {
      const a = off + k * TAU / 7, ca = Math.cos(a), sa = Math.sin(a);
      for (let s = 1; s <= 14; s++) {
        const X = x + ca * s, Y = y + sa * s + (s > 8 ? (s - 8) * .5 : 0);
        setT(X, Y, s < 4 ? PAL[2] : PAL[1]);
        if (s >= 4 && s <= 12) { setT(X - sa, Y + ca + .4, PAL[0]); setT(X + sa, Y - ca + .4, s % 2 ? PAL[2] : PAL[1]); }
      }
    }
    for (const [dx, dy] of [[-1, -1], [1, -1], [0, 1]]) { setT(x + dx, y + dy, [107, 68, 35]); setT(x + dx + 1, y + dy, [138, 90, 43]); }
  };
  const camel = (x, y, f) => {
    const Rc = (dx, dy, w, h, c) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) px(f > 0 ? x + dx + xx : x - dx - xx, y + dy + yy, c); };
    for (let dy = 0; dy < 6; dy++) for (let dx = -8; dx < 10; dx++) dk(x + dx + 2, y + 3 + dy, .85);
    Rc(-8, -3, 16, 8, [74, 50, 28]); Rc(-7, -2, 14, 6, K.camel); Rc(-4, -5, 6, 4, K.camel); Rc(-3, -6, 4, 2, K.camelL); Rc(-7, 2, 14, 2, K.camelD);
    Rc(7, -6, 3, 6, K.camel); Rc(8, -9, 5, 4, [74, 50, 28]); Rc(9, -8, 4, 2, K.camel); Rc(11, -8, 1, 1, [30, 20, 10]);
  };
  RT.oases.forEach((O, n) => {
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * TAU + .3, gap = Math.abs(Math.atan2(Math.sin(a - O.open), Math.cos(a - O.open)));
      const x = Math.round(O.x + Math.cos(a) * (O.rx + 12)), y = Math.round(O.y + Math.sin(a) * (O.ry + 12));
      if (gap < 1.1 || y < 6 || y > def.field[1] - 10) continue;
      const t = ter[y * MW + x]; if (t === 3 || t === 2 || t === 1) continue;
      palm(x, y);
    }
    if (n === 0) camel(Math.round(O.x - O.rx - 26), Math.round(O.y + 4), 1);
    solid(O.x, O.y, 4);
  });
  yield;
  // ----- blocks of sandstone: short, solid, strong with a shadow (not to be mistaken for the pale decoration) -----
  for (const B of RT.blocks) {
    const len = 56, wd = 12;
    for (let t = -len / 2 - 2; t <= len / 2 + 6; t++) for (let w = -wd / 2; w <= wd / 2 + 6; w++) dk(B.x + B.nx * t + B.tx * w + 4, B.y + B.ny * t + B.ty * w + 5, .9);
    for (let t = -len / 2; t <= len / 2; t++) for (let w = -wd / 2; w < wd / 2; w++) {
      const joint = Math.round(t + len / 2) % 9 === 0 || Math.round(w + wd / 2) === 6, edge = Math.abs(t) > len / 2 - 1 || w < -wd / 2 + 1 || w > wd / 2 - 2;
      px(B.x + B.nx * t + B.tx * w, B.y + B.ny * t + B.ty * w, edge ? K.stDD : joint ? K.stD : w < -wd / 2 + 4 ? K.stL : K.st);
    }
    for (let t = -len / 2 + 4; t <= len / 2 - 4; t += 10) { const wx = B.x + B.nx * t, wy = B.y + B.ny * t; walls.push({ x: wx, y: wy, r: 7 }); RT.obst.push({ x: wx, y: wy, r: 7 }); solid(wx, wy, 8); }
  }
  yield;
  // ----- cacti: the ones on the line are obstacles of their own (see desert.js), the others beside it are pale decoration (principle 10) -----
  const blob = (cx, cy, rr, pal) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const dd = Math.hypot(dx, dy); if (dd > rr + .3) continue; px(cx + dx, cy + dy, dd > rr - 1 ? pal[2] : (dx + dy < -1 ? pal[1] : (Math.round(Math.atan2(dy, dx) * 3) & 1) ? pal[0] : pal[2])); } };
  const cactus = (x, y) => {
    for (let dy = -8; dy <= 14; dy++) for (let dx = -8; dx <= 20; dx++) if (dx > 0 && dy > -2 && Math.hypot((dx - 6) / 1.5, dy - 4) < 8.5) dk(x + dx, y + dy, .66);
    for (let k = 0; k < 11; k++) {
      const a = k / 11 * TAU + .3, rr = 11 + (k % 2) * 1.5, sx = Math.round(x + Math.cos(a) * rr), sy = Math.round(y + Math.sin(a) * rr * .8);
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 4; dx++) if (!((dx === 0 || dx === 3) && (dy === 0 || dy === 2))) px(sx + dx, sy + dy, dy === 0 ? K.rockL : dy === 2 ? K.rockD : K.rock);
    }
    const C3 = [K.cac, K.cacL, K.cacD];
    blob(x - 10, y - 2, 3, C3); blob(x + 9, y + 3, 3, C3); for (let k = -10; k <= -4; k++) px(x + k, y - 2, K.cac); for (let k = 4; k <= 9; k++) px(x + k, y + 3, K.cac);
    blob(x, y, 7, C3);
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; px(x + Math.cos(a) * 6, y + Math.sin(a) * 6, K.spine); }
    px(x, y, [255, 120, 160]); px(x + 1, y, [255, 120, 160]);
  };
  const deco = (x, y) => {
    const P = [[134, 178, 120], [160, 200, 140], [104, 148, 98]];
    for (let dy = -2; dy <= 5; dy++) for (let dx = 0; dx <= 7; dx++) if (Math.hypot(dx - 3, dy - 2) < 3.5) dk(x + dx, y + dy, .88);
    blob(x - 3, y - 1, 1, P); blob(x + 3, y, 1, P); blob(x, y, 2, P);
  };
  for (const c of RT.cacti) { cactus(c.x, c.y); solid(c.x, c.y, 12); }
  const okOff = (x, y, m) => { for (let dy = -m; dy <= m; dy += 2) for (let dx = -m; dx <= m; dx += 2) { const X = x + dx, Y = y + dy; if (X < 2 || Y < 2 || X >= MW - 2 || Y >= MH - 2) return false; const j = Y * MW + X; if (ter[j] !== RALLY || wallMask[j]) return false; } return true; };
  for (let k = 0, tries = 0; k < 24 && tries < 900; tries++) {
    const x = 6 + (S.r() * (def.field[0] - 12) | 0), y = 6 + (S.r() * (def.field[1] - 12) | 0); if (!okOff(x, y, 10)) continue;
    deco(x, y); solid(x, y, 5); k++; // (no wall: you drive over a little one)
  }
  yield;
  // ----- signposts: a pale board with an arrow to the right (flat decoration: you drive over it), so nobody has to guess -----
  for (const s of RT.signs) {
    for (let k = 0; k < 8; k++) px(s.x, s.y + k, [150, 122, 82]);
    for (let yy = -7; yy <= 0; yy++) for (let xx = -7; xx <= 7; xx++) px(s.x + xx, s.y + yy, yy === -7 || yy === 0 || Math.abs(xx) === 7 ? [168, 140, 98] : [226, 208, 166]);
    for (let xx = -4; xx <= 3; xx++) px(s.x + xx, s.y - 4, [176, 128, 84]);
    for (const [dx, dy] of [[2, -6], [3, -5], [4, -4], [3, -3], [2, -2]]) px(s.x + dx, s.y + dy, [176, 128, 84]);
    for (let dy = 1; dy <= 3; dy++) for (let dx = 1; dx <= 3; dx++) dk(s.x + dx, s.y + 8 + dy - 2, .9);
  }
  yield;
  // ----- the ram avenue and the sphinx gate: two rows of ram sphinxes and obelisks that close in on the gate (solid), two big sphinxes that look at
  // each other; behind them walls along the road all the way to the doorway of the pyramid -----
  const [ax0, ayN, ayS, axg] = def.avenue, [gx, gy] = def.gate;
  const ram = (x, y, f) => { // a lying ram with a curled horn, looking towards the road (f: -1 looks up, 1 looks down), dark outline so it stands out of the sand
    for (let dy = 0; dy < 9; dy++) for (let dx = 0; dx < 16; dx++) dk(x + dx - 6, y + dy * f + 2 * f + (f > 0 ? 1 : -1), .8);
    for (let yy = -1; yy < 8; yy++) for (let xx = -1; xx < 13; xx++) {
      const edge = yy < 0 || yy > 6 || xx < 0 || xx > 11; px(x - 6 + xx, y + yy * f, edge ? K.stDD : yy < 2 ? K.stL : yy > 4 ? K.stD : K.st);
    }
    for (let xx = -1; xx < 6; xx++) for (let yy = 0; yy < 7; yy++) {
      const edge = xx < 0 || xx > 4 || yy > 5; px(x + 5 + xx, y + yy * f + 6 * f, edge ? K.stDD : yy < 2 ? K.stL : K.st);
    }
    px(x + 7, y + 10 * f, K.stDD); px(x + 9, y + 8 * f, K.gold); px(x + 10, y + 8 * f, K.goldD);
  };
  const obelisk = (x, y) => {
    for (let dy = -4; dy <= 22; dy++) for (let dx = 0; dx <= 9; dx++) if (dx > 3 && dy > 0 && dx - 3 < 7 - dy * .15) dk(x + dx, y + dy, .78);
    for (let yy = 0; yy < 18; yy++) { const w = 7 - Math.floor(yy / 6); for (let xx = -w; xx <= w; xx++) px(x + xx, y + yy, xx < -w + 2 ? K.stL : xx > w - 2 ? K.stDD : K.st); }
    px(x, y - 1, K.gold); px(x - 1, y, K.gold); px(x + 1, y, K.goldD);
  };
  const arm = (ax, ay, bx, by, facing) => {
    const L = Math.hypot(bx - ax, by - ay), n = Math.round(L / 11), ux = (bx - ax) / L, uy = (by - ay) / L;
    for (let k = 0; k <= n; k++) { const x = ax + ux * k * 11, y = ay + uy * k * 11; walls.push({ x, y, r: 6 }); solid(x, y, 8); }
    for (let k = 0, m = Math.floor(L / 24); k <= m; k++) {
      const x = Math.round(ax + ux * k * 24), y = Math.round(ay + uy * k * 24 + facing * -9);
      if (k % 4 === 3) obelisk(x, y - (facing > 0 ? 10 : -2)); else ram(x, y, facing);
    }
  };
  arm(ax0, ayN, axg, gy - 38, 1); arm(ax0, ayS, axg, gy + 38, -1);
  // the closing wall north of the avenue (a ridge of boulders from the edge of the map down to the mouth)
  const boulder = (x, y, r) => {
    for (let dy = 1; dy <= r + 6; dy++) for (let dx = 1; dx <= r + 8; dx++) if (Math.hypot((dx - r * .5) / 1.3, dy - r * .6) < r + 1) dk(x + dx, y + dy, .72);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const d2 = Math.hypot(dx, dy * 1.1); if (d2 > r) continue;
      const lit = (dx + dy) / (r * 1.4), h = hash(x + dx, y + dy, sd + 47);
      px(x + dx, y + dy, d2 > r - 1.2 ? K.rockD : lit < -.35 ? (h < .15 ? K.rock : K.rockL) : lit > .35 ? K.rockD : (h < .12 ? K.rockD : K.rock));
    }
  };
  for (let y = 8; y <= ayN + 2; y += 12) { const x = ax0 + Math.round(Math.sin(y * .7) * 3), r = 9 + (y % 3); boulder(x, y, r); walls.push({ x, y, r: r - 1 }); solid(x, y, r + 4); }
  // the two big sphinxes (about 40 x 70), each lying with its back to the map and its face to the road
  const sphinx = (cx, cy, f) => {
    const Rr = (u, v, w, h, c) => { for (let vv = 0; vv < h; vv++) for (let uu = 0; uu < w; uu++) px(cx - 20 + u + uu, f > 0 ? cy - 35 + v + vv : cy + 35 - v - vv - 1, c); };
    for (let v = 0; v < 70; v++) for (let u = 0; u < 12; u++) dk(cx - 20 + 32 + u, (f > 0 ? cy - 35 + v : cy + 35 - v) + 3, .8);
    Rr(6, 0, 28, 50, K.stDD); Rr(7, 1, 26, 48, K.st); Rr(7, 1, 26, 3, K.stL); for (let k = 0; k < 44; k += 6) Rr(8, 6 + k, 24, 1, K.stD);
    Rr(3, 14, 5, 24, K.stDD); Rr(4, 15, 3, 22, K.st); Rr(32, 14, 5, 24, K.stDD); Rr(33, 15, 3, 22, K.st);
    Rr(7, 46, 9, 23, K.stDD); Rr(8, 47, 7, 21, K.stL); Rr(24, 46, 9, 23, K.stDD); Rr(25, 47, 7, 21, K.stL);
    Rr(13, 44, 14, 24, K.stDD); for (let k = 0; k < 22; k++) Rr(14, 45 + k, 12, 1, k & 1 ? [70, 110, 190] : K.gold);
    Rr(16, 56, 8, 11, K.stDD); Rr(17, 57, 6, 9, K.stL); Rr(18, 60, 1, 2, K.stDD); Rr(21, 60, 1, 2, K.stDD); Rr(19, 63, 2, 1, K.stD);
    for (let v = 6; v <= 66; v += 12) for (const s of [-8, 8]) { walls.push({ x: cx + s, y: f > 0 ? cy - 35 + v : cy + 35 - v, r: 9 }); }
    solid(cx, cy, 36);
  };
  sphinx(gx, gy - 77, 1); sphinx(gx, gy + 77, -1);
  // the walls along the road behind the gate, as far as the doorway
  const iEnd = path.findIndex((p, i) => i > RT.iB && p.y >= y0 && p.x > 1450);
  for (let i = path.findIndex((p, k) => k > RT.iB && p.x >= gx + 24); i < iEnd; i++) {
    const p = path[i], n = nrm[i];
    for (const s of [-1, 1]) for (let w = 0; w < 8; w++) {
      const X = p.x + n.x * s * (HALF + 2 + w), Y = p.y + n.y * s * (HALF + 2 + w);
      if (inFoot(X, Y)) continue;
      if (w === 0) dk(X + 3, Y + 4, .8);
      px(X, Y, w < 2 ? K.stL : w > 5 ? K.stDD : ((i >> 2) & 1) && w === 3 ? K.stD : K.st);
    }
    if (i % 3 === 0) for (const s of [-1, 1]) { const X = p.x + n.x * s * (HALF + 6), Y = p.y + n.y * s * (HALF + 6); if (!inFoot(X, Y)) { walls.push({ x: X, y: Y, r: 5 }); solid(X, Y, 5); } }
  }

  yield;
  // ----- inside the pyramid: the ramps and the shafts (the cars come from the east), torches on the walls, the light maps -----
  for (const R of RT.shafts) {
    for (let y = R.y - 28; y <= R.y + 28; y++) {
      for (let x = R.lip; x <= R.lip + 20; x++) { // the ramp: a wedge of lighter stone, lightest at the lip
        if (ter[y * MW + x] !== 1) continue;
        const a = (R.lip + 20 - x) / 20, course = (x - R.lip) % 5 === 0;
        set(y * MW + x, course ? K.stD : a < .2 ? K.stL : a < .6 ? K.st : [200, 160, 100]);
      }
      for (let x = R.x0; x <= R.x1; x++) { // the shaft: a lit rim on the far side, rock layers on its sides, darkness deep down
        const j = y * MW + x; if (ter[j] !== 11) continue;
        const dd = Math.min(x - R.x0, R.x1 - x), h = hash(x, y, sd + 48);
        set(j, dd < 2 ? (x - R.x0 < 2 ? K.stL : K.stDD) : dd < 5 ? (((y >> 2) & 1) ? K.rockD : K.rockDD) : dd < 9 ? [46, 26, 12] : dd < 14 ? [26, 14, 6] : h < .05 ? [30, 18, 8] : [14, 8, 4]);
      }
    }
    // warning chevrons on the floor before the ramp
    for (let y = R.y - 24; y <= R.y + 24; y++) for (let x = R.lip + 24; x < R.lip + 50; x++) if (ter[y * MW + x] === 1 && ((x - Math.abs(y - R.y) * .8) % 12 + 12) % 12 < 3) set(y * MW + x, [214, 72, 52]);
  }
  const torches = [];
  for (let i = 0, sd2 = 1; i < N; i += 36) {
    const p = path[i]; if (!inFoot(p.x, p.y) || !inFoot(p.x + 24, p.y + 24) || !inFoot(p.x - 24, p.y - 24)) continue;
    const f = RT.forks.find(F => ((i - F.i1 + N) % N) < F.len);
    if (f && f.dark) continue; // (the first fork has no light at all)
    if (f) { torches.push({ x: p.x, y: p.y, k: torches.length }); continue; } // (on the wall between the two branches)
    torches.push({ x: p.x + nrm[i].x * sd2 * (HALF + 3), y: p.y + nrm[i].y * sd2 * (HALF + 3), k: torches.length }); sd2 = -sd2;
  }
  // the light maps (footprint size, drawn cut to the screen while you are inside): the glow of the floor (cut out of the darkness: you always see
  // where the road goes) and the extra darkness of the pitch dark branch
  const gl = mk(PW, PH), gg = gl.getContext('2d'), gi = gg.createImageData(PW, PH), gq = gi.data;
  const dk2 = mk(PW, PH), dgc = dk2.getContext('2d'), di = dgc.createImageData(PW, PH), dq = di.data, F1 = RT.forks.find(f => f.dark);
  const rampX = x => F1 ? smooth(clamp((x - F1.dark[0]) / 30, 0, 1)) * smooth(clamp((F1.dark[1] - x) / 30, 0, 1)) : 0;
  const rd = u => u === 1 || u === 11;
  for (let yy = 2; yy < PH - 2; yy++) {
    if (yy % 40 === 39) yield;
    for (let xx = 2; xx < PW - 2; xx++) {
      const j = (y0 + yy) * MW + x0 + xx, t = ter[j], k = (yy * PW + xx) * 4;
      let a = t === 1 ? 150 : t === 11 ? 110 : (rd(ter[j - 1]) || rd(ter[j + 1]) || rd(ter[j - MW]) || rd(ter[j + MW]) || rd(ter[j - 2]) || rd(ter[j + 2])) ? 80 : 0;
      if (a && F1 && y0 + yy >= 584) { const r = rampX(x0 + xx); a *= 1 - r; if (r > 0 && t === 1) dq[k + 3] = 205 * r; }
      gq[k + 3] = a;
    }
  }
  gg.putImageData(gi, 0, 0); dgc.putImageData(di, 0, 0);

  yield;
  // ----- the pyramid: solid all over, the road is cut into it. Its roof is a picture of its own, drawn while racing (not when you are inside) -----
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) wallMask[y * MW + x] = 1;
  const seen = new Set(), wall = (x, y) => { const k = (y >> 2) * 1000 + (x >> 2); if (seen.has(k)) return; seen.add(k); walls.push({ x, y, r: 4 }); };
  // round the outside (not where the road goes in or out) ...
  for (let x = x0; x < x1; x += 4) for (const y of [y0 + 2, y1 - 3]) if (dist[y * MW + x] >= HALF + 3) wall(x, y);
  for (let y = y0; y < y1; y += 4) for (const x of [x0 + 2, x1 - 3]) if (dist[y * MW + x] >= HALF + 3) wall(x, y);
  // ... and along every edge of the road inside
  for (let y = y0 + 1; y < y1 - 1; y++) for (let x = x0 + 1; x < x1 - 1; x++) {
    const j = y * MW + x; if (rd(ter[j])) continue; // (the shaft is no wall: the cars jump across it)
    if (rd(ter[j - 1]) || rd(ter[j + 1]) || rd(ter[j - MW]) || rd(ter[j + MW])) wall(x, y);
  }
  yield;
  // the roof: four faces of sandstone courses, lit from the top left, a golden ridge, dark doorways where the road goes in and out
  const cv = mk(PW, PH), g = cv.getContext('2d'), img = g.createImageData(PW, PH), q = img.data;
  const ridge = Math.min(PW, PH) / 2;
  for (let yy = 0; yy < PH; yy++) {
    if (yy % 40 === 39) yield;
    for (let xx = 0; xx < PW; xx++) {
      const dN = yy, dS = PH - 1 - yy, dW = xx, dE = PW - 1 - xx, m = Math.min(dN, dS, dW, dE), X = x0 + xx, Y = y0 + yy;
      const face = m === dN ? 'n' : m === dW ? 'w' : m === dE ? 'e' : 's', lit = { n: 1, w: 1.08, s: .72, e: .8 }[face];
      const along = face === 'n' || face === 's' ? xx : yy, course = Math.floor(m / 5);
      const joint = m % 5 === 0 || ((along + course * 5 + 400) % 11 === 0);
      let c = joint ? K.stD : hash(X, Y, sd + 45) < .08 ? K.stL : K.st;
      if (m > ridge - 6) c = K.gold;
      const k = (yy * PW + xx) * 4, j = Y * MW + X;
      // (the doorways: the road under the roof is dark, with a frame of stone)
      const door = dist[j] < HALF + 3 && ter[j] === 1 && (yy < 48 || xx < 34);
      if (door) { const edge = dist[j] > HALF - 1; c = edge ? K.stDD : [40, 26, 14]; q[k + 3] = 255; q[k] = c[0]; q[k + 1] = c[1]; q[k + 2] = c[2]; continue; }
      q[k] = clamp(c[0] * lit, 0, 255); q[k + 1] = clamp(c[1] * lit, 0, 255); q[k + 2] = clamp(c[2] * lit, 0, 255); q[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const pyr = { c: cv, x: x0, y: y0, W: PW, H: PH, glow: gl, dark2: dk2, torches };

  return { alt: RT.alt, jumps: RT.jumps, pyr, forks: RT.forks, shafts: RT.shafts, bugs: RT.bugs, iA: RT.iA, iB: RT.iB, field: def.field, soft: RT.soft, oases: RT.oases, cacti: RT.cacti, obst: RT.obst, inside: false };
}
