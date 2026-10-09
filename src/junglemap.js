import { HALF, TAU, WH, WW, clamp, hash, hex, mk, vnoise } from './core.js';
import { nearestIdx } from './bau.js';
import { stampLine } from './volcanomap.js';

// ---------- Dschungel: the camp, the canopy with the fork under it, the gorge with the liana and the log bridge, the temple ruin, the ford,
// the swamp with its boardwalk ----------
// Terrain: 1 earth road (and boardwalk, log bridge, the dry detour), 0 jungle floor, 2 swamp (like mud, it makes the car green),
// 10 deep swamp (pulls and swallows, softer than quicksand), 3 shallow water (the ford, the current pushes), 5 deep water (the river: you fall in).

const K = Object.fromEntries(Object.entries({
  fl: '#2f6a2a', fl1: '#286024', fl2: '#367a30', flE: '#22501e', litter: '#5a4a22', litter2: '#7a5a2a',
  road: '#7a5a36', road1: '#6e5030', road2: '#86643e', roadE: '#4e3a22', pud: '#5a4228',
  plank: '#9a7240', plank1: '#86622f', plankD: '#4e3418', log: '#7a5430', logL: '#9a7040', logD: '#3e2a16',
  duck: '#7aa83a', duck2: '#9ac84a', deep: '#22301a', deep1: '#2c3c20', bub: '#6a8a3a',
  leaf: '#1e5a24', leaf1: '#2a7030', leaf2: '#3a8a38', leaf3: '#5aa83e', leafD: '#0e3412', leafL: '#7ac84a',
  st: '#7a8070', st1: '#6a7062', st2: '#8a9080', stD: '#4a5044', moss: '#4a7a30', root: '#5a3e22',
  tent: '#d8a040', tentD: '#a07020', tent2: '#3a8a6a', tent2D: '#24604a', jeep: '#6a7a3a', jeepD: '#3e4a22',
}).map(([k, v]) => [k, hex(v)]));

// terrain, before the ground is painted. S: { def, ter, dist, near, path, tan, nrm, N }
export function jungleTerrain(S) {
  const { def, ter, dist, near, path, nrm, N } = S, A = WW * WH, alt = new Uint8Array(A), plankM = new Uint8Array(A), logM = new Uint8Array(A);
  const off = j => { const i = near[j], p = path[i]; return (j % WW + .5 - p.x) * nrm[i].x + ((j / WW | 0) + .5 - p.y) * nrm[i].y; };
  // the dry detour under the canopy: a narrow road of its own
  const detour = stampLine(def.detour.pts, def.detour.half, j => { if (ter[j] === 0 || ter[j] === 2) { ter[j] = 1; alt[j] = 1; } });
  // the river: deep everywhere, shallow in the box of the ford; where it crosses the road at the gorge only the log bridge stays
  const G = def.gorge, F = def.ford.rect, inFord = (x, y) => x >= F[0] && x <= F[2] && y >= F[1] && y <= F[3];
  const water = (x, y) => {
    if (x < 0 || y < 0 || x >= WW || y >= WH) return;
    const j = y * WW + x;
    if (inFord(x, y)) { ter[j] = 3; return; }
    if (dist[j] < HALF + 2 && Math.abs(y - G.log) <= G.lh && Math.abs(x - G.x) < G.hw + 8) { ter[j] = 1; logM[j] = 1; return; }
    ter[j] = 5;
  };
  for (const ch of def.river) for (let k = 1; k < ch.length; k++) {
    const [x0, y0, r0] = ch[k - 1], [x1, y1, r1] = ch[k], st = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
    for (let s = 0; s <= st; s++) {
      const f = s / st, cx = x0 + (x1 - x0) * f, cy = y0 + (y1 - y0) * f, r = r0 + (r1 - r0) * f;
      for (let y = Math.floor(cy - r - 3); y <= cy + r + 3; y++) for (let x = Math.floor(cx - r - 3); x <= cx + r + 3; x++)
        if (Math.hypot(x + .5 - cx, y + .5 - cy) < r + (vnoise(x * .12, y * .12, 111) - .5) * 4) water(x, y);
    }
  }
  for (let y = F[1]; y <= F[3]; y++) for (let x = F[0]; x <= F[2]; x++) ter[y * WW + x] = 3;
  // the boardwalk through the swamp: a narrow way of planks along one side of the road
  const [bx0, bx1, bo, bh] = def.boardwalk, bi0 = nearestIdx(path, bx0, 400), bi1 = nearestIdx(path, bx1, 400), onB = i => bi0 <= bi1 ? i >= bi0 && i <= bi1 : i >= bi0 || i <= bi1;
  for (let j = 0; j < A; j++) {
    if (dist[j] >= HALF || !onB(near[j])) continue;
    if (Math.abs(off(j) - bo) <= bh) { ter[j] = 1; plankM[j] = 1; }
  }
  // deep swamp: like quicksand, only softer
  for (const [qx, qy, qr] of def.quick || []) for (let y = qy - qr - 2; y <= qy + qr + 2; y++) for (let x = qx - qr - 2; x <= qx + qr + 2; x++)
    if (Math.hypot(x + .5 - qx, y + .5 - qy) < qr + (vnoise(x * .3, y * .3, 112) - .5) * 2) ter[y * WW + x] = 10;
  // the liana: it throws you over the gorge when it hangs on your side (see jungle.js); the current in the ford pushes towards the deep water
  const [l0, l1] = G.lane, lip = nearestIdx(path, G.x - G.hw - 4, 70), p = path[lip];
  const jumps = [{ x: G.x - G.hw - 4, y: p.y, tx: 1, ty: 0, lo: l0 - p.y, hi: l1 - p.y, vz: 95, push: 128, off: true, liana: true, sfx: 'tarzan' }];
  const pushes = [{ rect: F, fx: 0, fy: def.ford.push }];
  const T = def.temple.map(([x, y]) => nearestIdx(path, x, y));
  return { alt, plankM, logM, detour, jumps, pushes, templeI: T, quick: def.quick || [], gorgeI: nearestIdx(path, G.x, 70), detourI: nearestIdx(path, def.detour.pts[0][0], def.detour.pts[0][1]), boardI: [bi0, bi1], fordI: nearestIdx(path, (F[0] + F[2]) / 2, 400) };
}

// painting, after the ground. S: { def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, shore, sd, th, r, critters, darken, RT }
export function paintJungle(S) {
  const { def, d, set, setT, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, shore, sd, RT } = S, A = WW * WH;
  const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < WW && y < WH) set(y * WW + x, c); };
  const dk = (x, y, k) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= WW || y >= WH) return; const i = (y * WW + x) * 4; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; };
  const solid = (x, y, rr) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X >= 0 && Y >= 0 && X < WW && Y < WH) wallMask[Y * WW + X] = 1; } };
  const swampPix = [];

  // ----- the ground: jungle floor with leaf litter, a wet earth road with puddles, planks, the log bridge, duckweed on the swamp, deep swamp -----
  for (let j = 0; j < A; j++) {
    const x = j % WW, y = j / WW | 0, t = ter[j], h = hash(x, y, sd + 40), v = vnoise(x / 6, y / 6, sd + 41) * .55 + h * .45;
    if (shore[j]) continue;
    let c;
    if (t === 0) {
      c = dist[j] < HALF + 2.5 && !RT.alt[j] ? K.flE : v < .3 ? K.fl1 : v > .72 ? K.fl2 : K.fl;
      if (h < .03) c = h < .015 ? K.litter : K.litter2;
    } else if (t === 1 || t === 4) {
      if (t === 4) continue;
      if (RT.plankM[j]) { const i = near[j]; c = i % 4 === 0 ? K.plankD : (i >> 2) & 1 ? K.plank : K.plank1; if (Math.abs(((x + .5 - path[i].x) * nrm[i].x + (y + .5 - path[i].y) * nrm[i].y) - def.boardwalk[2]) > def.boardwalk[3] - 1) c = K.plankD; }
      else if (RT.logM[j]) { const dy = Math.abs(y - def.gorge.log); c = dy >= def.gorge.lh - 1 ? K.logD : dy < 2 ? K.logL : (x % 9 === 0 ? K.logD : K.log); }
      else {
        c = v < .33 ? K.road1 : v > .7 ? K.road2 : K.road;
        if (vnoise(x / 9, y / 9, sd + 42) > .74) c = K.pud;
        if (dist[j] > HALF - 2.5 && !RT.alt[j]) c = K.roadE;
      }
    } else if (t === 2) { if (h < .12) { set(j, h < .05 ? K.duck2 : K.duck); } swampPix.push(j); continue; }
    else if (t === 10) c = v < .45 ? K.deep : K.deep1;
    else continue;
    set(j, c);
  }
  // start line (chequered)
  S.band(0, 6, (x, y, a, c) => { if (Math.abs(c) < HALF) set(y * WW + x, ((Math.floor(a + 6) >> 2) + (Math.floor(c + 100) >> 2)) & 1 ? [245, 245, 240] : [34, 30, 28]); });

  // ----- the gorge: rocky banks where the river cuts through the road -----
  const G = def.gorge;
  for (let y = 30; y <= 110; y++) for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const x = Math.round(G.x + s * (G.hw + k)), j = y * WW + x; if (ter[j] === 5 || RT.logM[j]) continue;
    px(x, y, k === 0 ? K.stD : K.st1);
  }

  // ----- the ford: stones in the water (solid), a fallen trunk at its edge -----
  for (const [sx, sy, sr] of def.ford.stones) {
    walls.push({ x: sx, y: sy, r: sr });
    for (let dy = -sr; dy <= sr; dy++) for (let dx = -sr; dx <= sr; dx++) { const dd = Math.hypot(dx, dy); if (dd <= sr) px(sx + dx, sy + dy, dd > sr - 1 ? K.stD : (dx + dy) < -1 ? K.st2 : K.st); }
  }

  // ----- the temple: a roof of mossy stone blocks over the road (see-through and dark from inside), walls along it, statues at the doors,
  // a waterfall falling through a hole in the hall (it washes) -----
  const [ti0, ti1] = RT.templeI, inT = i => ti0 <= ti1 ? i >= ti0 && i <= ti1 : i >= ti0 || i <= ti1;
  let temple = null;
  {
    let x0 = WW, y0 = WH, x1 = 0, y1 = 0;
    for (let j = 0; j < A; j++) if (dist[j] < HALF + 12 && inT(near[j])) { const x = j % WW, y = j / WW | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const W = x1 - x0 + 1, H = y1 - y0 + 1, cv = mk(W, H), g = cv.getContext('2d'), img = g.createImageData(W, H), q = img.data, [hx, hy, hr] = def.hall;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const j = y * WW + x; if (!(dist[j] < HALF + 12 && inT(near[j]))) continue;
      const h = hash(x, y, sd + 43), bx = Math.floor((x + ((y >> 3) & 1) * 6) / 12), by = y >> 3, joint = (x + ((y >> 3) & 1) * 6) % 12 === 0 || y % 8 === 0;
      let c = joint ? K.stD : [K.st, K.st1, K.st2][(hash(bx, by, sd + 44) * 3) | 0];
      if (vnoise(x / 10, y / 10, sd + 45) > .64) c = h < .5 ? K.moss : [62, 106, 40];
      if (Math.abs(vnoise(x / 14, y / 14, sd + 46) - .5) < .02) c = K.root;
      if (Math.hypot(x - hx, y - hy) < hr) continue; // the hole in the roof over the hall
      const k = ((y - y0) * W + x - x0) * 4; q[k] = c[0]; q[k + 1] = c[1]; q[k + 2] = c[2]; q[k + 3] = 255;
      wallMask[j] = 1;
    }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < N; i += 3) if (inT(i)) for (const s of [-1, 1]) walls.push({ x: path[i].x + nrm[i].x * s * (HALF + 4), y: path[i].y + nrm[i].y * s * (HALF + 4), r: 4 });
    for (let y = hy - hr; y <= hy + hr; y++) for (let x = hx - hr; x <= hx + hr; x++) { const j = y * WW + x; if (Math.hypot(x - hx, y - hy) < hr && dist[j] < HALF) { washMask[j] = 1; set(j, (x + y) % 5 ? [96, 140, 150] : [150, 200, 210]); } }
    const torches = [];
    for (let i = ti0; inT(i); i = (i + 16) % N) { for (const s of [-1, 1]) torches.push({ x: path[i].x + nrm[i].x * s * (HALF + 3), y: path[i].y + nrm[i].y * s * (HALF + 3), k: torches.length }); if (torches.length > 30) break; }
    // stone statues beside both doors
    for (const ii of [ti0, ti1]) for (const s of [-1, 1]) {
      const x = Math.round(path[ii].x + nrm[ii].x * s * (HALF + 14)), y = Math.round(path[ii].y + nrm[ii].y * s * (HALF + 14));
      walls.push({ x, y, r: 6 }); solid(x, y, 8);
      for (let dy = -7; dy <= 7; dy++) for (let dx = -6; dx <= 6; dx++) { const e = (dx / 6) ** 2 + (dy / 7) ** 2; if (e <= 1) setT(x + dx, y + dy, e > .75 ? K.stD : dy < -2 ? K.st2 : K.st); }
      setT(x - 2, y - 3, [20, 20, 20]); setT(x + 2, y - 3, [20, 20, 20]); for (let k = -2; k <= 2; k++) setT(x + k, y + 2, K.stD);
    }
    temple = { c: cv, x: x0, y: y0, W, H, i0: ti0, i1: ti1, torches, hall: def.hall };
  }

  // ----- the canopy: giant trees close over the road; a picture of leaves (see-through only round your own car) -----
  const [cx0, cy0, cx1, cy1] = def.canopy, CW = cx1 - cx0, CH = cy1 - cy0, cc = mk(CW, CH), cg = cc.getContext('2d'), cimg = cg.createImageData(CW, CH), cq = cimg.data;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const X = cx0 + x, Y = cy0 + y, edge = Math.min(x, CW - 1 - x, y + 40, CH - 1 - y) + (vnoise(X * .08, Y * .08, sd + 47) - .5) * 26;
    if (edge < 2) continue;
    const big = vnoise(X / 16, Y / 16, sd + 48), sm = vnoise(X / 5, Y / 5, sd + 49), h = hash(X, Y, sd + 50);
    let c = big > .62 ? (sm > .55 ? K.leaf3 : K.leaf2) : big > .4 ? (sm > .6 ? K.leaf2 : K.leaf1) : sm > .62 ? K.leaf1 : K.leaf;
    if (big < .3 && sm < .35) c = K.leafD; if (h < .01) c = K.leafL; if (h > .997) c = [230, 80, 120]; // a few blossoms
    const k = (y * CW + x) * 4; cq[k] = c[0]; cq[k + 1] = c[1]; cq[k + 2] = c[2]; cq[k + 3] = 255;
  }
  cg.putImageData(cimg, 0, 0);
  // the trunks of the giant trees stand beside the road (solid)
  for (const [x, y] of [[110, 120], [250, 112], [470, 120], [300, 18], [150, 18], [430, 196]]) { const j = y * WW + x; if (dist[j] < HALF + 6 || RT.alt[j] || ter[j] !== 0) continue; walls.push({ x, y, r: 7 }); solid(x, y, 9); for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (dx * dx + dy * dy <= 36) px(x + dx, y + dy, dx * dx + dy * dy > 25 ? K.logD : K.log); }

  // ----- the camp: two tents, the jeep, crates, the camp fire (its flames are drawn while racing) -----
  let camp = null;
  if (def.camp) {
    const [sx, sy] = def.camp;
    const tent = (x, y, A0, A1) => { for (let dy = -9; dy <= 9; dy++) for (let dx = -12; dx <= 12; dx++) { if (Math.abs(dx) > 12 - Math.abs(dy) * .2) continue; setT(x + dx, y + dy, Math.abs(dy) < 1 ? A1 : dy < 0 ? A0 : A1.map(v => v * .85 | 0)); } for (let k = 0; k < 6; k++) dk(x + 13 + k, y + 4, .7); walls.push({ x, y, r: 9 }); solid(x, y, 11); };
    tent(sx - 26, sy - 20, K.tent, K.tentD); tent(sx + 4, sy - 22, K.tent2, K.tent2D);
    const R = (x, y, w, h, c) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) setT(sx + x + xx, sy + y + yy, c); };
    R(14, 2, 26, 13, [20, 20, 16]); R(15, 3, 24, 11, K.jeep); R(16, 4, 7, 9, K.jeepD); R(27, 4, 4, 9, [140, 200, 230]); walls.push({ x: sx + 27, y: sy + 8, r: 9 }); solid(sx + 27, sy + 8, 12);
    for (const [x, y] of [[-30, 4], [-22, 6], [-26, -2]]) { R(x, y, 7, 6, K.plankD); R(x + 1, y + 1, 5, 4, K.plank); }
    camp = { fire: { x: sx - 6, y: sy + 12 } };
    for (let a = 0; a < TAU; a += .6) px(sx - 6 + Math.cos(a) * 4, sy + 12 + Math.sin(a) * 3, K.st);
  }
  // stone heads of the ruin at the edges of the map
  for (const [x, y] of def.heads || []) {
    walls.push({ x, y, r: 10 }); solid(x, y, 13);
    for (let dy = -12; dy <= 12; dy++) for (let dx = -10; dx <= 10; dx++) { const e = (dx / 10) ** 2 + (dy / 12) ** 2; if (e > 1) continue; setT(x + dx, y + dy, e > .8 ? K.stD : vnoise((x + dx) / 4, (y + dy) / 4, 113) > .65 ? K.moss : dx < -2 ? K.st2 : K.st); }
    for (const [dx, dy, w, h] of [[-6, -4, 4, 2], [2, -4, 4, 2], [-1, -1, 2, 5], [-5, 6, 10, 2]]) for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) setT(x + dx + xx, y + dy + yy, K.stD);
  }
  // ferns and big blossoms on the jungle floor
  const okOff = (x, y, m) => { for (let dy = -m; dy <= m; dy += 2) for (let dx = -m; dx <= m; dx += 2) { const X = x + dx, Y = y + dy; if (X < 2 || Y < 2 || X >= WW - 2 || Y >= WH - 2) return false; const j = Y * WW + X; if (ter[j] !== 0 || dist[j] < HALF + 5 || wallMask[j] || RT.alt[j]) return false; } return true; };
  for (let k = 0, tries = 0; k < 60 && tries < 2000; tries++) {
    const x = 4 + (S.r() * (WW - 8) | 0), y = 4 + (S.r() * (WH - 8) | 0); if (!okOff(x, y, 6)) continue;
    const off0 = S.r() * TAU;
    for (let q = 0; q < 6; q++) { const a = off0 + q * TAU / 6; for (let s = 1; s <= 7; s++) { px(x + Math.cos(a) * s, y + Math.sin(a) * s, s < 3 ? K.leaf : K.leaf2); if (s > 2 && s < 7) px(x + Math.cos(a) * s - Math.sin(a), y + Math.sin(a) * s + Math.cos(a), K.leaf3); } }
    k++;
  }
  for (let k = 0, tries = 0; k < 40 && tries < 1200; tries++) {
    const x = 4 + (S.r() * (WW - 8) | 0), y = 4 + (S.r() * (WH - 8) | 0); if (!okOff(x, y, 2)) continue;
    const c = [[240, 60, 90], [255, 170, 40], [200, 80, 230], [255, 240, 90]][(S.r() * 4) | 0].map(v => v);
    px(x - 1, y, c); px(x + 1, y, c); px(x, y - 1, c); px(x, y + 1, c); px(x, y, [255, 230, 120]); k++;
  }

  // ----- the rotten trees of the event: where they stand and where they fall (across the road) -----
  const trees = (def.trees || []).map(([x, y, side, per, t0], k) => {
    const i = nearestIdx(path, x, y), p = path[i], n = nrm[i], tg = tan[i], bx = p.x + n.x * side * (HALF + 14), by = p.y + n.y * side * (HALF + 14);
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (dx * dx + dy * dy <= 22) px(bx + dx, by + dy, dx * dx + dy * dy > 14 ? K.logD : K.log);
    return { k, i, bx, by, nx: -n.x * side, ny: -n.y * side, tx: tg.x, ty: tg.y, per, t0 };
  });

  return { jumps: RT.jumps, baseJumps: RT.jumps.length, pushes: RT.pushes, alt: RT.alt, quick: RT.quick, detour: RT.detour, detourI: RT.detourI, gorgeI: RT.gorgeI, boardI: RT.boardI, fordI: RT.fordI,
    temple, canopy: { c: cc, x: cx0, y: cy0, W: CW, H: CH }, camp, trees, swampPix, gorge: def.gorge, ford: def.ford, crocs: def.crocs || [] };
}
