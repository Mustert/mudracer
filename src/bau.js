import { HALF, WH, WW, hash, hex } from './core.js';

// ---------- Baustelle: closed building yards, barriers that narrow the road, the crane with its hanging pipe, the leaking cement mixer ----------
// The whole infield is "yard": solid ground that nobody can enter (a ring of solid circles along its edge), so there are no short cuts. The yards are
// filled with building site things (pictures only). The road itself keeps its width except where barriers narrow it.

const C = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, hex(v)]));
const K = C({
  slab: '#c3bfb4', slab2: '#b5b1a6', rim: '#8f8b80', seam: '#a39f94', void: '#2c2824', col: '#dcd8cc', colS: '#6f6b62', rebar: '#7a4a32',
  yel: '#e0b020', yelD: '#8a6a10', blk: '#2a2826', sand: '#d8c28a', sandD: '#b89c5e', sandL: '#ead7a4', gravel: '#9a9a96', gravelD: '#6e6e6a', gravelL: '#bdbdb8',
  brick: '#b5502f', brickD: '#86361f', brickL: '#cf6c48', wood: '#c9a46a', woodD: '#8a6a3c', woodL: '#e0c088', tarp: '#2f6fb8', tarpD: '#1f4f88', tarpL: '#5a9ad8',
  white: '#e6e9ec', grey: '#9aa0a8', greyD: '#636a72', orange: '#f08a1f', orangeD: '#b8600a', cone: '#ff7a1a', coneD: '#c24e08', red: '#d6382e',
  bOut: '#4a4640', bOr: '#e8742a', bWh: '#f1ede2', earth: '#6a4b2e', earthD: '#4a321d', earthDD: '#2f2112', earthL: '#8a6440', pitW: '#4d7690', pitWL: '#7aa8bf',
  cem: '#8c9097', cemD: '#6b6f76', cemL: '#aeb3b9', paint: '#e8b020',
});
const PIPE = ['#e4e0d4', '#cac6ba', '#aeaa9d', '#86827a', '#5a574f'].map(hex);
const CONT = [['#2d6aa8', '#1d4a7c', '#4a8cd0'], ['#b8392e', '#862419', '#d85a4c'], ['#3a8a50', '#25613a', '#5cb072'], ['#d6a82c', '#9a7410', '#f0c654'], ['#d9dce0', '#9aa0a8', '#f4f6f8'], ['#7a5a9a', '#523a70', '#9c7cc0']].map(a => a.map(hex));

export const nearestIdx = (path, x, y) => { let bi = 0, bd = 1e12; for (let i = 0; i < path.length; i++) { const dx = path[i].x - x, dy = path[i].y - y, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; bi = i; } } return bi; };

// the yards: every free cell inside one of the rectangles that is further than 6px from the road edge
export function siteYards(def, ter, dist) {
  const yard = new Uint8Array(WW * WH);
  (def.yards || []).forEach(([x, y, w, h], k) => {
    for (let yy = Math.max(0, y); yy < Math.min(WH, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(WW, x + w); xx++) {
      const j = yy * WW + xx; if (ter[j] === 0 && dist[j] >= HALF + 6 && !yard[j]) yard[j] = k + 1;
    }
  });
  return yard;
}

// solid circles along the edge of the yards (cells on the edge of the world do not count as an edge)
export function siteRing(yard, walls) {
  const placed = [];
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const j = y * WW + x; if (!yard[j]) continue;
    const edge = (x > 0 && !yard[j - 1]) || (x < WW - 1 && !yard[j + 1]) || (y > 0 && !yard[j - WW]) || (y < WH - 1 && !yard[j + WW]);
    if (!edge) continue;
    const cx = x + .5, cy = y + .5;
    if (placed.some(p => (p[0] - cx) ** 2 + (p[1] - cy) ** 2 < 30)) continue;
    placed.push([cx, cy]); walls.push({ x: cx, y: cy, r: 5 });
  }
}

// S: { def, d, set, setT, px, darken, band, path, tan, nrm, yard, walls, scatter, rock, sd }
export function paintSite(S) {
  const { def, d, path, tan, nrm, yard, walls } = S, lights = [];
  const inY = (x, y) => x >= 0 && y >= 0 && x < WW && y < WH && yard[y * WW + x] > 0;
  const py = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (inY(x, y)) S.set(y * WW + x, c); };
  const rect = (x0, y0, w, h, c) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) py(x0 + xx, y0 + yy, c); };
  const shade = (x0, y0, w, h, k = .7, any = false) => {
    for (let yy = y0; yy < y0 + h; yy++) for (let xx = x0; xx < x0 + w; xx++) {
      if (xx < 0 || yy < 0 || xx >= WW || yy >= WH || (!any && !yard[yy * WW + xx])) continue;
      const i = (yy * WW + xx) * 4; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
    }
  };
  const ell = (cx, cy, rx, ry, f) => { for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) { const e = (dx / rx) ** 2 + (dy / ry) ** 2; if (e <= 1) { const c = f(dx, dy, e); if (c) py(cx + dx, cy + dy, c); } } };

  // ----- things lying around -----
  const heap = (cx, cy, rx, ry, [lo, mid, hi], sd = 1) => {
    S.darken(Math.round(cx), Math.round(cy), Math.round(Math.max(rx, ry) * .95), 3, 4);
    ell(cx, cy, rx, ry, (dx, dy, e) => { const s = (dx / rx + dy / ry) * .5, n = hash(cx + dx, cy + dy, S.sd + sd); return e > .86 ? lo : n < .08 ? lo : s < -.3 ? hi : s > .3 ? lo : mid; });
  };
  const pipeH = (x0, cy, len, dia) => {
    const hr = dia / 2; shade(x0 + 3, cy - hr + 4, len, dia, .68);
    for (let xx = 0; xx < len; xx++) for (let yy = -hr; yy <= hr; yy++) {
      const v = yy / hr, sock = xx < 4 ? 1 : 0;
      let k = Math.abs(v) > .86 ? 4 : v < -.45 ? 0 : v < .2 ? 1 : v < .6 ? 2 : 3;
      if (xx < 2 || xx === 4) k = Math.min(4, k + 1);
      py(x0 + xx, cy + yy, PIPE[k]);
    }
  };
  const cont = (x0, y0, w, h, col, vert = false, door = 1) => {
    const [m, dk, lt] = col; shade(x0 + 4, y0 + 5, w, h, .64);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const u = vert ? yy : xx, L = vert ? h : w, V = vert ? xx : yy, T = vert ? w : h;
      let c = (V < 1 || V >= T - 1 || u < 1 || u >= L - 1) ? dk : (u + 1) % 4 === 0 ? dk : (u % 4 === 1) ? lt : m;
      if (door && u >= L - 3 && V > 1 && V < T - 2) c = u === L - 2 ? dk : lt;
      if ((u < 3 || u > L - 4) && (V < 3 || V > T - 4)) c = dk;
      py(x0 + xx, y0 + yy, c);
    }
  };
  const bricks = (x0, y0, w, h) => { shade(x0 + 3, y0 + 4, w, h, .7); for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) py(x0 + xx, y0 + yy, (yy < 1 || xx < 1 || yy >= h - 1 || xx >= w - 1) ? K.brickD : (yy % 3 === 0 || (xx + (yy / 3 | 0) * 2) % 5 === 0) ? K.brickD : hash(x0 + xx, y0 + yy, S.sd + 3) < .15 ? K.brickL : K.brick); };
  const lumber = (x0, y0, w, h) => { shade(x0 + 3, y0 + 4, w, h, .7); for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) py(x0 + xx, y0 + yy, (yy % 3 === 0 || xx < 1 || xx >= w - 1) ? K.woodD : (xx + yy * 7) % 17 === 0 ? K.woodD : yy % 3 === 1 ? K.woodL : K.wood); };
  const barrel = (cx, cy, col = K.red) => { S.darken(cx, cy, 3, 2, 2); ell(cx, cy, 3, 3, (dx, dy, e) => e > .7 ? K.blk : dx + dy < -1 ? K.white : col); };
  const tires = (cx, cy) => { S.darken(cx, cy, 4, 2, 2); ell(cx, cy, 4, 4, (dx, dy, e) => e < .13 ? K.grey : e < .38 ? K.blk : e < .6 ? K.greyD : K.blk); };
  const silo = (cx, cy, r) => { S.darken(cx, cy, r, 4, 5); ell(cx, cy, r, r, (dx, dy, e) => e > .86 ? K.rim : e > .66 ? (dx + dy < 0 ? K.col : K.slab2) : e < .06 ? K.void : e < .2 ? K.rim : (dx + dy < 0 ? K.slab : K.seam)); };
  const trailer = (x0, y0, w, h) => {
    shade(x0 + 4, y0 + 5, w, h, .66);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) py(x0 + xx, y0 + yy, (yy < 1 || xx < 1 || yy >= h - 1 || xx >= w - 1) ? K.grey : Math.abs(yy - h / 2) < .8 ? K.greyD : yy < h / 2 ? K.white : K.slab2);
    ell(x0 + w - 7, y0 + h / 2 | 0, 3, 3, (dx, dy, e) => e > .5 ? K.greyD : K.blk); rect(x0 + 3, y0 + 3, 4, 2, K.tarpL);
  };
  const toilet = (x0, y0) => { shade(x0 + 2, y0 + 3, 6, 6, .66); rect(x0, y0, 6, 6, K.tarpD); rect(x0 + 1, y0 + 1, 4, 4, K.tarp); rect(x0 + 2, y0 + 2, 2, 2, K.tarpL); };
  const rebar = (x0, y0, len, n = 4) => { for (let q = 0; q < n; q++) for (let xx = 0; xx < len; xx++) py(x0 + xx, y0 + q * 2, q % 2 ? K.rebar : K.yelD); };
  const lightMast = (cx, cy) => { S.darken(cx, cy, 5, 2, 3); ell(cx, cy, 3, 3, (dx, dy, e) => e > .6 ? K.greyD : K.grey); for (const [dx, dy] of [[-5, 0], [5, 0], [0, -5], [0, 5]]) { rect(cx + dx - 1, cy + dy - 1, 3, 3, K.blk); py(cx + dx, cy + dy, K.paint); } };
  const pit = (x0, y0, w, h, water) => {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const dd = Math.min(xx, yy, w - 1 - xx, h - 1 - yy), n = hash(x0 + xx, y0 + yy, S.sd + 5);
      let c = dd < 2 ? K.earthL : dd < 5 ? K.earth : dd < 9 ? K.earthD : K.earthDD;
      if (n < .06 && dd < 9) c = dd < 5 ? K.earthD : K.earthDD;
      if (water && dd > 11 && xx > w * .35 && yy > h * .45 && ((xx - w * .6) / (w * .22)) ** 2 + ((yy - h * .7) / (h * .15)) ** 2 < 1) c = n < .3 ? K.pitWL : K.pitW;
      py(x0 + xx, y0 + yy, c);
    }
    // ladder along one side
    for (let k = 0; k < 14; k++) { py(x0 + 5, y0 + 3 + k, K.yel); py(x0 + 9, y0 + 3 + k, K.yel); if (k % 3 === 0) for (let q = 5; q <= 9; q++) py(x0 + q, y0 + 3 + k, K.yelD); }
  };
  const excavator = (cx, cy) => {
    // seen from above, the arm points up (north), cab and counterweight at the back
    shade(cx - 14, cy - 18, 30, 42, .66);
    rect(cx - 14, cy - 3, 6, 18, K.blk); rect(cx + 9, cy - 3, 6, 18, K.blk); for (let k = 0; k < 18; k += 3) { py(cx - 13, cy - 3 + k, K.greyD); py(cx + 10, cy - 3 + k, K.greyD); }
    rect(cx - 9, cy - 1, 18, 14, K.orange); rect(cx - 9, cy - 1, 18, 2, K.yel); rect(cx - 9, cy + 11, 18, 2, K.orangeD); rect(cx - 8, cy + 5, 16, 6, K.orangeD);
    rect(cx - 8, cy - 1, 8, 8, K.orange); rect(cx - 7, cy, 6, 5, K.tarpL); rect(cx - 7, cy, 6, 1, K.white);
    for (let k = 0; k < 17; k++) { rect(cx + 1, cy - 2 - k, 3, 1, k < 8 ? K.orange : K.yel); py(cx, cy - 2 - k, K.orangeD); py(cx + 4, cy - 2 - k, K.orangeD); }
    rect(cx - 2, cy - 22, 9, 4, K.greyD); rect(cx - 1, cy - 21, 7, 2, K.grey);
  };

  // ----- narrow places: concrete barriers, cones before and after, an amber warning lamp -----
  const cone = (cx, cy) => {
    cx = Math.round(cx); cy = Math.round(cy); S.darken(cx, cy, 2, 2, 2);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const dd = dx * dx + dy * dy; if (dd > 5) continue; S.px(cx + dx, cy + dy, dd <= 1 ? K.white : dd <= 2 ? K.cone : K.coneD); }
  };
  for (const [x, y, side] of def.narrows || []) {
    const i = nearestIdx(path, x, y), p = path[i], tg = tan[i], nm = nrm[i];
    S.band(i, 15, (xx, yy, a, c) => {
      const cs = c * side; if (cs < 15 || cs > 24 || Math.abs(a) > 13) return;
      S.set(yy * WW + xx, (cs > 22.6 || cs < 16.4 || Math.abs(a) > 11.6) ? K.bOut : (((a + 13) / 6.5 | 0) & 1) ? K.bOr : K.bWh);
    });
    for (const a of [-8, 0, 8]) walls.push({ x: p.x + tg.x * a + nm.x * side * 19.5, y: p.y + tg.y * a + nm.y * side * 19.5, r: 4.5 });
    for (const [a, l] of [[-54, 34], [-42, 30], [-30, 26], [-18, 22], [22, 23], [34, 28]]) {
      const cx = p.x + tg.x * a + nm.x * side * l, cy = p.y + tg.y * a + nm.y * side * l; cone(cx, cy); walls.push({ x: cx, y: cy, r: 2.5 });
    }
    lights.push({ x: p.x - tg.x * 12 + nm.x * side * 20, y: p.y - tg.y * 12 + nm.y * side * 20, k: lights.length });
  }

  // ----- narrow places made of traffic cones only: a funnel from both sides, the gap in the middle is just wide enough for one car -----
  const tight = [];
  for (const [x, y] of def.cones || []) {
    const i = nearestIdx(path, x, y), p = path[i], tg = tan[i], nm = nrm[i];
    for (const side of [-1, 1]) for (const [a, l] of [[-34, 28], [-26, 25], [-18, 22], [-10, 19], [0, 19], [10, 19], [18, 22], [26, 26]]) {
      const cx = p.x + tg.x * a + nm.x * side * l, cy = p.y + tg.y * a + nm.y * side * l; cone(cx, cy); walls.push({ x: cx, y: cy, r: 2.5 });
    }
    tight.push(i);
  }

  // ----- the water hose: a hydrant beside the outer edge of a curve sprays onto the road; driving through the spray washes the car
  // (also the cement off). It is on the outside of the curve, away from the ideal line, so a clean car costs a little time -----
  let hose = null;
  if (def.hose) {
    const { x: hx, y: hy, r: hr, rx, ry } = def.hose, wet = [hex('#4f6e78'), hex('#5d7f86'), hex('#a9cdd3')];
    for (let yy = Math.floor(hy - hr - 2); yy <= hy + hr + 2; yy++) for (let xx = Math.floor(hx - hr - 2); xx <= hx + hr + 2; xx++) {
      if (xx < 0 || yy < 0 || xx >= WW || yy >= WH) continue;
      const dd = Math.hypot(xx + .5 - hx, yy + .5 - hy) + (hash(xx, yy, S.sd + 31) - .5) * 2.5, j = yy * WW + xx;
      if (dd > hr + 1.5) continue;
      if (dd <= hr) S.washMask[j] = 1;
      // wet ground: mixed with the colour of water, darker at the rim
      const i = j * 4, m = dd > hr - 1.5 ? .35 : .55, W = dd > hr - 1.5 ? wet[0] : wet[1];
      for (let q = 0; q < 3; q++) d[i + q] = d[i + q] * (1 - m) + W[q] * m;
      if (dd < hr - 2 && hash(xx, yy, S.sd + 32) < .05) S.set(j, wet[2]);
    }
    // the hose from the hydrant to the nozzle at the edge of the road
    const ux = hx - rx, uy = hy - ry, ul = Math.hypot(ux, uy), nx = Math.round(rx + ux / ul * (ul - hr - 6)), ny = Math.round(ry + uy / ul * (ul - hr - 6));
    const HOSE = hex('#2f8a3a'), HOSED = hex('#1f5f28'), n = Math.max(Math.abs(nx - rx), Math.abs(ny - ry));
    for (let k = 0; k <= n; k++) { const t = k / n, sag = Math.sin(t * Math.PI) * 3; S.setT(rx + (nx - rx) * t + sag, ry + (ny - ry) * t + sag, k % 4 ? HOSE : HOSED); }
    // a coil of hose lying next to the hydrant
    for (let a = 0; a < 40; a++) { const an = a / 40 * Math.PI * 2; S.setT(rx + 10 + Math.cos(an) * 5, ry - 2 + Math.sin(an) * 4, a % 5 ? HOSE : HOSED); S.setT(rx + 10 + Math.cos(an) * 3, ry - 2 + Math.sin(an) * 2, HOSED); }
    // the hydrant: red body, a cap, two side valves
    for (let yy = -6; yy <= 5; yy++) for (let xx = -3; xx <= 3; xx++) S.setT(rx + xx, ry + yy, Math.abs(xx) === 3 || yy === 5 ? K.blk : yy < -3 ? (Math.abs(xx) < 2 ? K.red : K.blk) : xx < 0 ? hex('#ef5a4e') : K.red);
    for (const sx of [-5, 4]) { S.setT(rx + sx, ry - 1, K.greyD); S.setT(rx + sx + 1, ry - 1, K.grey); }
    S.setT(rx, ry - 7, K.grey);
    // the nozzle
    for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) S.setT(nx + xx, ny + yy, xx || yy ? K.greyD : K.grey);
    hose = { x: hx, y: hy, r: hr, nx, ny };
  }

  // ----- the big building (Rohbau): concrete slab, columns, lift shaft, stairs, safety rail -----
  const rohbau = (x0, y0, w, h) => {
    shade(x0 + 7, y0 + 9, w, h, .62);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const edge = xx < 2 || yy < 2 || xx >= w - 2 || yy >= h - 2, n = hash(x0 + xx, y0 + yy, S.sd + 8);
      py(x0 + xx, y0 + yy, edge ? K.rim : (xx % 16 === 0 || yy % 16 === 0) ? K.seam : n < .07 ? K.slab2 : n > .96 ? K.col : K.slab);
    }
    rect(x0 + w / 2 - 9, y0 + h / 2 - 12, 18, 22, K.void); rect(x0 + w / 2 - 8, y0 + h / 2 - 11, 16, 1, K.greyD);
    for (let k = 0; k < 18; k += 2) { py(x0 + w / 2 - 9 + k, y0 + h / 2 - 12 + k, K.yel); py(x0 + w / 2 + 8 - k, y0 + h / 2 - 12 + k, K.yel); }
    for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
      const cx = x0 + 12 + gx * ((w - 28) / 3 | 0), cy = y0 + 12 + gy * ((h - 28) / 3 | 0);
      if (Math.abs(cx - (x0 + w / 2)) < 14 && Math.abs(cy - (y0 + h / 2)) < 16) continue;
      rect(cx - 1, cy - 1, 7, 7, K.colS); rect(cx - 1, cy - 1, 6, 6, K.col); rect(cx, cy, 4, 4, K.slab);
      for (const [dx, dy] of [[-2, -2], [6, -2], [-2, 6], [6, 6]]) py(cx + dx, cy + dy, K.rebar);
    }
    for (let xx = 4; xx < w - 4; xx++) { if (xx % 6 < 4) { py(x0 + xx, y0 + 3, K.yel); py(x0 + xx, y0 + h - 4, K.yel); } }
    for (let yy = 4; yy < h - 4; yy++) { if (yy % 6 < 4) { py(x0 + 3, y0 + yy, K.yel); py(x0 + w - 4, y0 + yy, K.yel); } }
    rect(x0 + w - 24, y0 + 10, 14, 20, K.slab2); for (let k = 0; k < 20; k += 2) rect(x0 + w - 24, y0 + 10 + k, 14, 1, K.rim);
    rect(x0 + 8, y0 + h - 30, 22, 16, K.tarp); rect(x0 + 8, y0 + h - 30, 22, 2, K.tarpL); for (let k = 3; k < 22; k += 5) rect(x0 + 8 + k, y0 + h - 28, 1, 14, K.tarpD);
  };

  // ----- the yards -----
  rohbau(121, 121, 96, 96);
  // material yard: stacked pipes, brick pallets, sand and gravel heaps, site office, toilets
  for (const cy of [246, 257, 268]) pipeH(120, cy, 50, 10);
  for (const cy of [246, 257]) pipeH(176, cy, 44, 10);
  for (const [bx, by] of [[122, 284], [138, 284], [154, 284], [122, 296], [138, 296]]) bricks(bx, by, 14, 10);
  rebar(176, 284, 24, 5); rebar(176, 298, 24, 4);
  heap(204, 306, 16, 11, [K.sandD, K.sand, K.sandL]);
  heap(160, 326, 15, 9, [K.gravelD, K.gravel, K.gravelL], 2);
  trailer(122, 312, 30, 14);
  for (let k = 0; k < 4; k++) toilet(186 + k * 9, 322);
  barrel(212, 282); barrel(218, 288, K.tarp); tires(205, 330); tires(214, 332);
  // excavation pit with an excavator beside it
  pit(246, 257, 46, 52, true); excavator(268, 327);
  heap(284, 316, 9, 6, [K.earthD, K.earth, K.earthL], 3);
  // concrete plant (U pocket): silos, batching house, aggregate bins; the mixer truck is drawn below
  silo(322, 22, 12); silo(350, 22, 12);
  rect(318, 36, 36, 1, K.greyD); for (let yy = 36; yy < 62; yy++) { py(333, yy, K.greyD); py(334, yy, K.grey); py(335, yy, K.greyD); }
  shade(321, 60, 32, 18, .66); rect(320, 58, 32, 18, K.white); rect(320, 58, 32, 2, K.grey); rect(320, 74, 32, 2, K.greyD); rect(324, 63, 8, 5, K.tarpL); rect(340, 63, 8, 5, K.tarpL);
  for (const [by, cols] of [[98, [K.sandD, K.sand, K.sandL]], [124, [K.gravelD, K.gravel, K.gravelL]], [150, [K.earthD, K.earth, K.earthL]]]) {
    rect(341, by, 27, 23, K.slab2); rect(341, by, 27, 1, K.rim); rect(341, by + 22, 27, 1, K.rim); rect(341, by, 1, 23, K.rim);
    heap(356, by + 12, 10, 8, cols, by);
  }
  // foundation (∩ pocket): rebar mesh, a poured section, formwork boards, stacked formwork panels
  rect(375, 340, 60, 52, K.earthD); for (let xx = 0; xx < 60; xx += 4) rect(375 + xx, 340, 1, 52, K.rebar); for (let yy = 0; yy < 52; yy += 4) rect(375, 340 + yy, 60, 1, K.yelD);
  rect(375, 392, 60, 28, K.slab); for (let yy = 0; yy < 28; yy += 3) rect(375, 392 + yy, 60, 1, K.seam); rect(375, 392, 60, 2, K.rim);
  rect(373, 338, 64, 2, K.wood); rect(373, 338, 2, 84, K.wood); rect(435, 338, 2, 84, K.wood); rect(373, 420, 64, 2, K.wood);
  for (let k = 0; k < 4; k++) cont(378 + k * 14, 426, 12, 16, [K.tarpD, K.tarp, K.tarpL], true, 0);
  // hazard strip between the U and the ∩
  for (let xx = 299; xx < 441; xx++) for (let yy = 251; yy < 265; yy++) py(xx, yy, ((xx + yy) >> 2) & 1 ? K.yel : K.blk);
  // container village
  [[447, 117, 0], [487, 117, 1], [447, 139, 2], [487, 139, 3], [447, 161, 4], [487, 161, 5], [447, 183, 3], [487, 183, 0], [447, 205, 1], [487, 205, 4], [447, 227, 5], [487, 227, 2]].forEach(([x0, y0, k]) => cont(x0, y0, 36, 14, CONT[k]));
  cont(467, 148, 28, 12, CONT[(0 + 4) % 6]); cont(467, 194, 28, 12, CONT[2]);
  lightMast(505, 255); barrel(452, 258); barrel(458, 262, K.tarp);
  // corridor: lumber, heaps, barrels, a light mast
  lumber(516, 308, 44, 14); lumber(520, 324, 38, 12);
  heap(596, 323, 24, 12, [K.sandD, K.sand, K.sandL], 4); heap(646, 322, 20, 11, [K.gravelD, K.gravel, K.gravelL], 5);
  for (let k = 0; k < 4; k++) barrel(676, 310 + k * 7, k % 2 ? K.tarp : K.red);
  lightMast(622, 318);
  // crane strip: foundation of the tower crane, ballast slabs, crates, power cabinet
  rect(576, 113, 24, 24, K.slab); rect(576, 113, 24, 2, K.rim); rect(576, 135, 24, 2, K.rim); rect(576, 113, 2, 24, K.rim); rect(598, 113, 2, 24, K.rim);
  for (const [dx, dy] of [[580, 117], [594, 117], [580, 131], [594, 131]]) rect(dx, dy, 2, 2, K.colS);
  rect(582, 119, 12, 12, K.yelD); rect(583, 120, 10, 10, K.yel); for (let k = 0; k < 10; k += 2) { py(583 + k, 120 + k, K.yelD); py(592 - k, 120 + k, K.yelD); }
  for (let k = 0; k < 4; k++) { shade(610 + k * 14 + 3, 116 + 4, 12, 16, .7); rect(610 + k * 14, 116, 12, 16, K.slab2); rect(610 + k * 14, 116, 12, 2, K.slab); rect(610 + k * 14, 130, 12, 2, K.rim); }
  cont(545, 118, 12, 12, [K.wood, K.woodD, K.woodL], false, 0); cont(560, 118, 10, 12, [K.wood, K.woodD, K.woodL], false, 0); trailer(668, 118, 16, 12);
  // zigzag strip: concrete barrier blocks, cones, tyre stacks
  for (let xx = 601; xx < 800; xx += 22) { cont(xx, 217, 18, 7, [K.slab2, K.rim, K.slab], false, 0); for (let k = 0; k < 18; k += 6) { py(xx + k + 1, 219, K.bOr); py(xx + k + 1, 220, K.bOr); } }
  for (let xx = 612; xx < 790; xx += 26) tires(xx, 229);

  // ----- the leaking cement mixer next to the road (the drum turns, see events.js) -----
  let mixer = null;
  if (def.mixer) {
    const { x, y } = def.mixer;
    shade(x - 5, y + 6, 20, 56, .64);
    rect(x - 7, y + 6, 14, 48, K.blk); rect(x - 6, y + 8, 12, 44, K.greyD);
    rect(x - 9, y, 18, 12, K.white); rect(x - 9, y, 18, 2, K.grey); rect(x - 9, y + 10, 18, 2, K.orangeD); rect(x - 7, y + 2, 14, 3, K.tarpL); rect(x - 9, y + 5, 18, 1, K.orange);
    rect(x - 12, y + 18, 3, 3, K.blk); rect(x + 9, y + 18, 3, 3, K.blk); rect(x - 12, y + 40, 3, 3, K.blk); rect(x + 9, y + 40, 3, 3, K.blk);
    // the chute goes from the back of the drum to the south west, the grey trickle runs from its end across the road edge into the puddle
    const cx = x - 19, cy = y + 62;
    for (let k = 0; k <= 20; k++) { const q = k / 20; S.px(Math.round(x - 3 + (cx - x + 3) * q), Math.round(y + 50 + (cy - y - 50) * q), q > .8 ? K.cemD : K.grey); S.px(Math.round(x - 3 + (cx - x + 3) * q), Math.round(y + 51 + (cy - y - 50) * q), K.greyD); }
    const tr = [[cx, cy], [cx - 4, cy + 2], [cx - 9, cy + 4], [cx - 14, cy + 7], [cx - 18, cy + 9], [cx - 22, cy + 11]];
    for (let k = 1; k < tr.length; k++) for (let s = 0; s <= 6; s++) { const px0 = tr[k - 1][0] + (tr[k][0] - tr[k - 1][0]) * s / 6, py0 = tr[k - 1][1] + (tr[k][1] - tr[k - 1][1]) * s / 6; for (const w of [0, 1]) S.px(Math.round(px0), Math.round(py0) + w, w ? K.cemD : K.cem); }
    mixer = { x, y, cx, cy, ph: 0 };
  }

  // ----- outside the road: rubble, planks, barrels, cones -----
  S.scatter(34, 3, S.rock);
  S.scatter(20, 4, (x, y) => { for (let k = 0; k < 4; k++) S.px(x + k, y + (k > 1 ? 1 : 0), k % 2 ? K.brickD : K.brick); S.px(x + 1, y - 1, K.brickL); });
  S.scatter(14, 8, (x, y) => { S.darken(x + 4, y, 6, 2, 2); for (let k = 0; k < 3; k++) for (let xx = 0; xx < 12; xx++) S.px(x + xx, y + k * 2, k % 2 ? K.woodD : K.wood); });
  S.scatter(8, 4, (x, y) => { S.darken(x, y, 3, 2, 2); for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const dd = dx * dx + dy * dy; if (dd > 10) continue; S.px(x + dx, y + dy, dd < 2 ? K.grey : dd < 6 ? K.blk : K.greyD); } });
  S.scatter(7, 3, (x, y) => { S.darken(x, y, 3, 2, 2); for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const dd = dx * dx + dy * dy; if (dd > 10) continue; S.px(x + dx, y + dy, dd > 7 ? K.blk : dx + dy < -1 ? K.white : K.red); } });
  S.scatter(10, 3, (x, y) => { cone(x, y); cone(x + 6, y + 2); });
  S.scatter(6, 12, (x, y) => { S.darken(x + 6, y, 8, 2, 2); for (let k = 0; k < 12; k++) for (let w = 0; w < 4; w++) S.px(x + k, y + w, w === 0 || w === 3 ? K.sandD : (k % 3 ? K.sand : K.sandL)); });

  // ----- the tower crane: the foundation lies in the crane strip, jib and counter-jib are on the top layer (cars drive underneath) with the pipe on its hook -----
  const cr = def.crane;
  if (cr) {
    const { x, y } = cr, jx = x - 3, py2 = cr.pipeY;
    // shadow of the jib and the pipe on the ground
    shade(jx + 7, 22, 8, 150, .74, true); shade(cr.pipe0 + 8, py2 - 10 + 14, cr.pipeLen, 20, .6, true);
    const T = (px0, py0, c) => S.setT(px0, py0, c);
    // the pipe hangs below the crane: it is painted first, jib, trolley and slings come on top of it
    // the concrete pipe (spigot at one end, socket at the other, two yellow straps)
    const hr = cr.pipeD / 2;
    for (let xx = 0; xx < cr.pipeLen; xx++) for (let yy = -hr - 1; yy <= hr + 1; yy++) {
      const sock = xx < 7, v = yy / (hr + 1), a = Math.abs(v);
      if (!sock && Math.abs(yy) > hr) continue;
      let k = a > .88 ? 4 : v < -.5 ? 0 : v < .15 ? 1 : v < .55 ? 2 : 3;
      if (sock && a > .7) k = Math.min(4, k + 1);
      let c = PIPE[k];
      if (xx === 7 || xx === 8) c = PIPE[3];
      if (xx === 6 || xx === cr.pipeLen - 8 || xx === cr.pipeLen - 7) c = a > .88 ? K.blk : K.yel;
      if (hash(cr.pipe0 + xx, py2 + yy, S.sd + 20) < .05) c = PIPE[Math.min(4, k + 1)];
      T(cr.pipe0 + xx, py2 + yy, c);
    }
    // jib to the north, counter-jib to the south: two chords with diagonals
    const lattice = (y0, y1, hw) => { for (let yy = y0; yy <= y1; yy++) { T(x - hw, yy, K.yel); T(x + hw, yy, K.yel); const k = ((yy - y0) % 8); if (k < 4) T(x - hw + 1 + k * (2 * hw - 2) / 4 | 0, yy, K.yelD); else T(x + hw - 1 - (k - 4) * (2 * hw - 2) / 4 | 0, yy, K.yelD); } };
    lattice(14, y - 6, 3); lattice(y + 6, y + 42, 4);
    for (let yy = 14; yy < y - 6; yy += 8) for (let xx = x - 3; xx <= x + 3; xx++) T(xx, yy, K.yelD);
    for (let xx = x - 3; xx <= x + 3; xx++) { T(xx, 12, K.yelD); T(xx, 13, K.yel); }
    // counterweight blocks
    for (let k = 0; k < 3; k++) for (let yy = 0; yy < 4; yy++) for (let xx = -5; xx <= 5; xx++) T(x + xx, y + 32 + k * 4 + yy, yy === 0 ? K.slab : yy === 3 ? K.greyD : K.slab2);
    // cabin and slewing ring
    for (let yy = -7; yy <= 7; yy++) for (let xx = -6; xx <= 6; xx++) if (xx * xx + yy * yy * .7 <= 38) T(x + xx, y + yy, Math.abs(yy) > 5 || Math.abs(xx) > 5 ? K.greyD : K.white);
    for (let yy = -6; yy <= -3; yy++) for (let xx = -3; xx <= 3; xx++) T(x + xx, y + yy, yy === -6 ? K.white : K.tarpL);
    for (let xx = -5; xx <= 5; xx++) T(x + xx, y + 2, K.orange);
    // trolley on the jib, hook block, slings to the pipe
    const hy = py2 - 12;
    for (let yy = -4; yy <= 3; yy++) for (let xx = -5; xx <= 5; xx++) T(x - 3 + xx + 3, hy + yy, Math.abs(xx) > 4 || yy === -4 || yy === 3 ? K.blk : K.greyD);
    for (let yy = 4; yy <= 8; yy++) for (let xx = -2; xx <= 2; xx++) T(jx + 3 + xx, hy + yy, yy === 8 ? K.red : K.blk);
    const hookX = jx + 3, hookY = hy + 8;
    for (const [ex, ey] of [[cr.pipe0 + 6, py2 - 3], [cr.pipe0 + cr.pipeLen - 6, py2 - 3]]) {
      const n = Math.max(Math.abs(ex - hookX), Math.abs(ey - hookY));
      for (let s = 0; s <= n; s++) T(Math.round(hookX + (ex - hookX) * s / n), Math.round(hookY + (ey - hookY) * s / n), K.blk);
    }
  }
  return { lights, mixer, hose, tight };
}
