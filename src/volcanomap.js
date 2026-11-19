import { HALF, clamp, hash, hex, mk, vnoise } from './core.js';
import { nearestIdx, paintTools, startLine } from './bau.js';

// ---------- Vulkan Rev 5 (plaene/VULKAN_REV5.md, the user's sketch Obsidian/Mudracer/Mockups/VUlkan_rev_selber.png): the south face of the volcano ----------
// The start straight lies at the foot of the mountain (asphalt; the base camp of the press, the police and the scientists below it, the fire brigade's washing
// bay beside it), a serpentine climbs the east of the face in terraces (dry-stone walls between the legs), a steel bridge runs along the face just below the
// crater over the lava that pours out of it (its plates fall out from lap 2: volcano.js), and the way down leads through a maze of gullies cut into the rock
// of the west face. The lava of a side stream runs along both sides of the maze and pushes tongues into it, other ones from lap to lap (volcano.js).
// Colours: green meadows at the foot, dry grass higher up, grey scree, black ash round the crater; light gravel roads, blue-grey basalt, green steel.
// Nothing can be cut off: the crater rim, the lava, the guard rail along the straight, the dry-stone walls between the serpentine legs and on their west end,
// the rock of the maze (solid along every gully), the girders of the bridges (CLAUDE.md, principle 4).
// Terrain: 0 ground beside the road, 1 road (also the gullies and the bridge deck), 15 lava (you burn: gone for a moment), 80 the rock of the maze (solid along
// its edges, no place to set a car back down). The tongues and the holes in the bridge turn 1 (and 80) into 15 while they are open (volcano.js).

const K = Object.fromEntries(Object.entries({
  // the ground by height: meadow, dry grass, scree, ash (three tones each), red oxidised scoria near the crater, shrubs
  g0: '#627a46', g1: '#566e3e', g2: '#708852', d0: '#968a5e', d1: '#887c54', d2: '#a4986a', s0: '#7c7470', s1: '#6c6662', s2: '#8a827c', a0: '#46403f', a1: '#3a3534', a2: '#544c4a',
  ox: '#7e4a38', flower: '#e2d26a', flowerW: '#efe9dc', shrub: '#3e5a32', shrubL: '#58784a', shrubD: '#2a3e22',
  // the gravel road, the asphalt of the straight
  rd: '#c2a47c', rd1: '#b69870', rd2: '#ccb088', rdE: '#8a7254', rut: '#a88c66', as: '#4e4e52', as1: '#46464a', as2: '#56565a', line: '#ecebe4',
  // lava, crust
  lava: '#ff7a1a', lava1: '#ffa21f', lava2: '#ffd04a', lavaD: '#d4481a', lavaW: '#fff2b0', crust: '#3a1e16', crustL: '#5c2c1a', crustD: '#26140f',
  // cold old lava (the flows on the face, the runnels of the maze)
  old: '#3e3c3e', old1: '#343234', old2: '#4a4648', oldR: '#58524f',
  // basalt (the rock of the maze, the crater rim, the columns)
  bas: '#5a6270', basL: '#8a94a2', basD: '#3a404a', basDD: '#22262e', basT: '#727c8a', basS: '#4a515c',
  // the floor of a gully: light grey ash, darker in the shadow of its north-west wall
  gf: '#a89c8c', gf1: '#9c9080', gf2: '#b4a898', gfS: '#7c7266',
  // the crater: its inner wall in layers, sulphur
  wal: '#3a2e2a', wal1: '#4a3a32', wal2: '#5c3a2c', wal3: '#2e2422', sul: '#e8d24a', sulD: '#a89428',
  // steel: the deck of the bridges, the girders (painted green), warning stripes
  st: '#8c969e', stL: '#a4aeb6', stD: '#646e76', stS: '#727c84', gir: '#3f6e6a', girL: '#64988e', girD: '#26443f', yel: '#f2c230', blk: '#1b1612',
  // dry-stone walls, the guard rail
  ds: '#9a9284', dsL: '#b8b0a2', dsD: '#6a6458', dsDD: '#47423a', rail: '#c8ccd0', railD: '#7c8288', post: '#5c6066',
  // the fire brigade, the base camp
  fire: '#d6382e', fireD: '#9a2018', white: '#f0ece4', chrome: '#b8c0c8', tyre: '#1a1818', tile: '#4e6a7a', tile2: '#3e5868', cont: '#d8d4cc', contD: '#8a867e', contO: '#e8742a', ant: '#9aa0a8',
  cin: '#4a2a24', cin1: '#3c221e', cin2: '#5c3428', cinL: '#7a4636', cinD: '#2a1814', cinH: '#a2603e', throat: '#1a0c08',
}).map(([k, v]) => [k, hex(v)]));

// a polyline with rounded corners ([x, y, r]) sampled every 2px
export function polyPts(P) {
  const pts = [], seg = (a, b) => { const m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)); for (let s = 0; s < m; s++) pts.push({ x: a[0] + (b[0] - a[0]) * s / m, y: a[1] + (b[1] - a[1]) * s / m }); };
  let cur = [P[0][0], P[0][1]];
  for (let k = 1; k < P.length; k++) {
    const [x, y, r] = P[k];
    if (k === P.length - 1 || !r) { seg(cur, [x, y]); cur = [x, y]; continue; }
    const [qx, qy] = P[k - 1], [nx, ny] = P[k + 1], dp = Math.hypot(qx - x, qy - y), dn = Math.hypot(nx - x, ny - y), rp = Math.min(r, dp / 2), rn = Math.min(r, dn / 2);
    const A0 = [x + (qx - x) / dp * rp, y + (qy - y) / dp * rp], B0 = [x + (nx - x) / dn * rn, y + (ny - y) / dn * rn];
    seg(cur, A0);
    const m = Math.max(8, Math.ceil((rp + rn) * .6));
    for (let q = 0; q < m; q++) { const t = q / m, u = 1 - t; pts.push({ x: u * u * A0[0] + 2 * u * t * x + t * t * B0[0], y: u * u * A0[1] + 2 * u * t * y + t * t * B0[1] }); }
    cur = B0;
  }
  pts.push({ x: cur[0], y: cur[1] });
  return pts;
}

// a narrow road of its own (a lane beside the road, a branch): every pixel within `half` of the line; fn(j, distance to the line, index of the nearest point)
export function stampLine(P, half, fn, MW, MH) {
  const pts = polyPts(P), R = Math.ceil(half + 1), D = new Map();
  pts.forEach((p, k) => {
    for (let y = Math.max(0, Math.floor(p.y - R)); y <= Math.min(MH - 1, p.y + R); y++) for (let x = Math.max(0, Math.floor(p.x - R)); x <= Math.min(MW - 1, p.x + R); x++) {
      const dd = Math.hypot(x + .5 - p.x, y + .5 - p.y); if (dd >= half) continue;
      const j = y * MW + x, o = D.get(j); if (o === undefined || dd < o[0]) D.set(j, [dd, k]);
    }
  });
  for (const [j, [dd, k]] of D) fn(j, dd, k);
  return pts;
}

// a chain of circles [x, y, half width], sampled every 2 px (one point per 2 px: k * 2 is about the way along it)
function chainPts(C) {
  const out = [];
  for (let k = 1; k < C.length; k++) {
    const [ax, ay, aw] = C[k - 1], [bx, by, bw] = C[k], m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 2));
    for (let s = k > 1 ? 1 : 0; s <= m; s++) { const f = s / m; out.push({ x: ax + (bx - ax) * f, y: ay + (by - ay) * f, w: aw + (bw - aw) * f }); }
  }
  return out;
}

// every pixel of a chain of circles (with a ragged edge): fn(j, k = the point of the chain, u = how far from its middle 0..1)
function stampChain(C, MW, MH, seed, fn) {
  const D = new Map();
  chainPts(C).forEach((p, k) => {
    const R = Math.ceil(p.w + 3);
    for (let y = Math.max(0, Math.floor(p.y - R)); y <= Math.min(MH - 1, p.y + R); y++) for (let x = Math.max(0, Math.floor(p.x - R)); x <= Math.min(MW - 1, p.x + R); x++) {
      const dd = Math.hypot(x + .5 - p.x, y + .5 - p.y), wn = p.w + (vnoise(x * .12, y * .12, seed) - .5) * 4; if (dd >= wn) continue;
      const j = y * MW + x, o = D.get(j); if (!o || dd < o[2]) D.set(j, [k, dd / wn, dd]);
    }
  });
  for (const [j, [k, u]] of D) fn(j, k, u);
  return D;
}

// cells of irregular polygons (Worley noise): the plates of crust on the lava lake. seam = how close to the edge of its cell (0 on the edge), id = which cell
function cells(x, y, C, sd) {
  const gx = Math.floor(x / C), gy = Math.floor(y / C);
  let d1 = 1e9, d2 = 1e9, id = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = gx + dx, cy = gy + dy, px = (cx + .15 + hash(cx, cy, sd) * .7) * C, py = (cy + .15 + hash(cx, cy, sd + 1) * .7) * C, d = Math.hypot(x - px, y - py);
    if (d < d1) { d2 = d1; d1 = d; id = cx * 7919 + cy; } else if (d < d2) d2 = d;
  }
  return { seam: d2 - d1, id };
}

const inPoly = (P, x, y) => { let c = false; for (let i = 0, k = P.length - 1; i < P.length; k = i++) { const [xi, yi] = P[i], [xk, yk] = P[k]; if ((yi > y) !== (yk > y) && x < (xk - xi) * (y - yi) / (yk - yi) + xi) c = !c; } return c; };

// the height of the face (0 at the foot, 1 at the crater rim; wider than high: the mountain is seen from the south) on a coarse grid (4 px), and from it the
// light on the slopes (from the north-west): height(x, y), shade(x, y) about 1 on flat ground
function hillShade(def, MW, MH) {
  const C4 = 4, GW = Math.ceil(MW / C4) + 2, GH = Math.ceil(MH / C4) + 2, h = new Float32Array(GW * GH), s = new Float32Array(GW * GH);
  const [cx, cy, R] = def.cone, [kx, ky, krx, kry] = def.crater;
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const x = gx * C4, y = gy * C4, r = Math.hypot((x - cx) * .55, y - cy);
    let v = clamp(1 - r / R, 0, 1);
    const e = Math.hypot((x - kx) / (krx + 30), (y - ky) / (kry + 30)); if (e < 1) v -= .3 * Math.pow(1 - e, .6);
    // ribs and runnels down the face, bumps
    v += .012 * Math.sin(Math.atan2(y - cy, (x - cx) * .55) * 40 + vnoise(x / 60, y / 60, 7) * 6) * clamp(r / 300, 0, 1) + .02 * (vnoise(x / 45, y / 45, 8) - .5);
    h[gy * GW + gx] = v;
  }
  for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
    const k = gy * GW + gx, ddx = (h[k + 1] - h[k - 1]) / (2 * C4), ddy = (h[k + GW] - h[k - GW]) / (2 * C4);
    // (the face falls to the south everywhere: lift it so that the mean stays about 1)
    s[k] = clamp(1.1 + 160 * (ddx * .6 + ddy * .8), .6, 1.45);
  }
  const at = (A, x, y) => {
    const fx = x / C4, fy = y / C4, ix = Math.min(GW - 2, Math.max(1, fx | 0)), iy = Math.min(GH - 2, Math.max(1, fy | 0)), u = fx - ix, w = fy - iy, k = iy * GW + ix;
    return (A[k] * (1 - u) + A[k + 1] * u) * (1 - w) + (A[k + GW] * (1 - u) + A[k + GW + 1] * u) * w;
  };
  return { shade: (x, y) => at(s, x, y), height: (x, y) => at(h, x, y) };
}

// the maze from the def: nodes, edges (their points), the neighbours of every node
export function mazeGraph(M) {
  const nodes = M.nodes, edges = M.edges.map((e, q) => {
    const [a, b, ...via] = typeof e === 'string' ? e.split('-') : e, [ax, ay] = nodes[a], [bx, by] = nodes[b], l = Math.hypot(bx - ax, by - ay);
    // (a straight edge bends a little to one side: the gullies look washed out, not drawn with a ruler)
    const mid = via.length ? via : [[(ax + bx) / 2 + (ay - by) / l * (hash(q, 1, 160) - .5) * 38, (ay + by) / 2 + (bx - ax) / l * (hash(q, 1, 160) - .5) * 38]];
    const P = [nodes[a], ...mid.map(v => [v[0], v[1], 40]), nodes[b]].map(([x, y, r]) => [x, y, r || 0]);
    const pts = polyPts(P); let len = 0; for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
    return { a, b, pts, len };
  });
  const adj = Object.fromEntries(Object.keys(nodes).map(n => [n, []]));
  edges.forEach((e, q) => { adj[e.a].push([e.b, q]); adj[e.b].push([e.a, q]); });
  return { nodes, edges, adj };
}

// terrain, before the ground is painted. S: { def, ter, dist, near, path, tan, nrm, N, stampAt }
export function* volcanoTerrain(S) {
  const { MW, MH, def, ter, dist, near, path, nrm, N } = S, A = MW * MH;
  const alt = new Uint8Array(A), lakeM = new Uint8Array(A), bridgeM = new Uint8Array(A), fanM = new Uint8Array(A), laneM = new Uint8Array(A);
  const areaM = new Uint8Array(A), gullyM = new Uint8Array(A), conM = new Uint8Array(A), gd = new Uint8Array(A);
  const at = ([x, y]) => nearestIdx(path, x, y);
  yield;
  // the crater lake: lava
  const [kx, ky, krx, kry] = def.crater;
  for (let y = Math.max(0, ky - kry - 12); y < Math.min(MH, ky + kry + 12); y++) for (let x = Math.max(0, kx - krx - 12); x < Math.min(MW, kx + krx + 12); x++) {
    const j = y * MW + x, e = ((x + .5 - kx) / krx) ** 2 + ((y + .5 - ky) / kry) ** 2;
    if (e >= .9 + .2 * vnoise(x * .04, y * .04, 91)) continue;
    lakeM[j] = 1; ter[j] = 15;
  }
  // the lava under the steel bridge (it pours out of the crater and fans out on the face): the road over it is the bridge (bridgeM, its girders 4 px beyond)
  const [fx, fy, frx, fry] = def.fan;
  for (let y = Math.max(0, fy - fry - 8); y < Math.min(MH, fy + fry + 8); y++) for (let x = Math.max(0, fx - frx - 8); x < Math.min(MW, fx + frx + 8); x++) {
    const j = y * MW + x; if (((x + .5 - fx) / frx) ** 2 + ((y + .5 - fy) / fry) ** 2 >= .8 + .4 * vnoise(x * .022, y * .022, 95)) continue; // (lobes: it spreads unevenly)
    fanM[j] = 1;
    if (dist[j] < HALF + 4) { bridgeM[j] = 1; continue; }
    ter[j] = 15;
  }
  yield;
  // the lava streams (bridge: a short steel bridge where the road crosses) and the pools they run into
  def.flows.forEach((F, q) => {
    stampChain(F.c, MW, MH, 93 + q, j => { if (ter[j] === 15 || bridgeM[j]) return; if (F.bridge && dist[j] < HALF + 4) { bridgeM[j] = 1; return; } ter[j] = 15; });
  });
  for (const [px, py, prx, pry] of def.pools) {
    for (let y = Math.max(0, py - pry - 8); y < Math.min(MH, py + pry + 8); y++) for (let x = Math.max(0, px - prx - 8); x < Math.min(MW, px + prx + 8); x++) {
      const j = y * MW + x; if (dist[j] < HALF + 6) continue;
      if (((x + .5 - px) / prx) ** 2 + ((y + .5 - py) / pry) ** 2 < .85 + .3 * vnoise(x * .06, y * .06, 99)) ter[j] = 15;
    }
  }
  yield;
  // ----- the maze: gullies (road, 1) cut into rock (80) inside the area; gd = how far from the middle of a gully (x4) -----
  const M = def.maze, G = mazeGraph(M), [ax0, ay0, ax1, ay1] = M.area.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [1e9, 1e9, -1e9, -1e9]);
  for (let y = Math.max(0, ay0); y <= Math.min(MH - 1, ay1); y++) for (let x = Math.max(0, ax0); x <= Math.min(MW - 1, ax1); x++) {
    // (the edge of the rock is not straight: it wobbles, except along the feeder in the east and near the way out at Z)
    const f = clamp((540 - x) / 60, 0, 1) * clamp((Math.hypot(x - M.nodes.Z[0], y - M.nodes.Z[1]) - 40) / 60, 0, 1), wx = (vnoise(x / 34, y / 34, 161) - .5) * 110 * f, wy = (vnoise(x / 34, y / 34, 162) - .5) * 110 * f;
    if (inPoly(M.area, x + .5 + wx, y + .5 + wy)) areaM[y * MW + x] = 1;
  }
  const gStamp = (x0, y0, w) => {
    const R = Math.ceil(w + 3);
    for (let y = Math.max(0, Math.floor(y0 - R)); y <= Math.min(MH - 1, y0 + R); y++) for (let x = Math.max(0, Math.floor(x0 - R)); x <= Math.min(MW - 1, x0 + R); x++) {
      const j = y * MW + x, dd = Math.hypot(x + .5 - x0, y + .5 - y0) - (vnoise(x * .1, y * .1, 96) - .5) * 4; if (dd >= w) continue;
      gullyM[j] = 1; const v = Math.max(1, Math.round((dd + (w > M.gw ? M.gw - w : 0)) * 4)); if (!gd[j] || v < gd[j]) gd[j] = Math.min(255, v);
    }
  };
  for (const e of G.edges) { e.pts.forEach((p, k) => { if (k % 2 === 0) gStamp(p.x, p.y, M.gw); }); }
  for (const [x, y] of Object.values(M.nodes)) gStamp(x, y, M.nr);
  yield;
  // the runnels of old lava from the feeders to the gates (only lava runs there: they stay rock)
  const gates = {};
  for (const [name, [gx, gy, node]] of Object.entries(M.gates)) {
    const [nx, ny] = M.nodes[node];
    stampLine([[gx, gy], [nx, ny]], 8, j => { if (!gullyM[j] && ter[j] !== 15) conM[j] = 1; }, MW, MH);
    gates[name] = { x: gx, y: gy, node };
  }
  // (the road before and after the maze stays road: the rock only takes the centre line's road inside the maze)
  const iA = at(M.nodes.A), iZ = at(M.nodes.Z), inMaze = i => ((i - iA + N) % N) <= ((iZ - iA + N) % N);
  for (let j = 0; j < A; j++) {
    if (gullyM[j] && ter[j] !== 15) { ter[j] = 1; alt[j] = 1; continue; }
    if (areaM[j] && (ter[j] === 0 || (ter[j] === 1 && (dist[j] >= HALF || inMaze(near[j]))))) ter[j] = 80;
  }
  yield;
  // the lava tongues: from a gate down the gullies to their last node; their pixels sorted by how far down (j, k = point of the chain, old = terrain)
  const tongues = M.tongues.map((Tg, q) => {
    const g = gates[Tg.gate], C = [[g.x, g.y, 9]];
    Tg.nodes.forEach((n, i) => {
      const [x, y] = M.nodes[n];
      if (i) { const [px, py] = M.nodes[Tg.nodes[i - 1]]; C.push([(px + x) / 2, (py + y) / 2, M.gw + 2]); }
      C.push([x, y, M.nr + 2]);
    });
    const L = [];
    const D = stampChain(C, MW, MH, 98 + q, (j, k) => { if (gullyM[j] || conM[j]) L.push([j, k]); });
    L.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const pts = chainPts(C);
    return { gate: g, nodes: Tg.nodes, pts, J: Int32Array.from(L, e => e[0]), K: Int32Array.from(L, e => e[1]), U: Float32Array.from(L, e => D.get(e[0])[1]), old: Uint8Array.from(L, e => ter[e[0]]) };
  });
  // the progress in the maze goes by the height (the centre line runs down through it): the index of the centre line for every row
  const rowIdx = new Int32Array(MH).fill(-1);
  for (let i = iA; i !== iZ; i = (i + 1) % N) { const y = Math.round(path[i].y); if (y >= 0 && y < MH && rowIdx[y] < 0) rowIdx[y] = i; }
  for (let y = 1; y < MH; y++) if (rowIdx[y] < 0 && rowIdx[y - 1] >= 0 && y < M.nodes.Z[1] + 40) rowIdx[y] = rowIdx[y - 1];
  for (let y = MH - 2; y >= 0; y--) if (rowIdx[y] < 0 && rowIdx[y + 1] >= 0 && y > M.nodes.A[1] - 40) rowIdx[y] = rowIdx[y + 1];
  yield;
  // the fire brigade's bay beside the start straight: a lane that leaves the road and comes back (road; the way back arrow and c.safe know it as alt)
  const B = def.bay, bayPts = stampLine(B.lane, B.half, j => { laneM[j] = 1; if (ter[j] === 0 || ter[j] === 1) { if (ter[j] === 0) ter[j] = 1; if (dist[j] >= HALF) alt[j] = 1; } }, MW, MH);
  // ----- the steel bridges: the span of the deck (the index range of the centre line over the lava, a little further: the abutments) -----
  const spans = [];
  for (let i = 0; i < N; i++) {
    const p = path[i], j = Math.round(p.y) * MW + Math.round(p.x); if (!bridgeM[j]) continue;
    const s = spans[spans.length - 1]; if (s && (i - s[1] + N) % N < 6) s[1] = i; else spans.push([i, i]);
  }
  const big = spans.reduce((b, s) => ((s[1] - s[0] + N) % N > (b[1] - b[0] + N) % N ? s : b), spans[0]);
  const decks = spans.map(s => { const e = s === big ? 14 : 8; return [(s[0] - e + N) % N, (s[1] + e) % N]; }), deckBig = decks[spans.indexOf(big)];
  /** @param {number} i @param {number[]} s */
  const inSpan = (i, s) => s[0] <= s[1] ? i >= s[0] && i <= s[1] : i >= s[0] || i <= s[1];
  const deckM = new Uint8Array(A);
  for (let j = 0; j < A; j++) if (ter[j] === 1 && dist[j] < HALF && !gullyM[j] && decks.some(D => inSpan(near[j], D))) deckM[j] = 1;
  // the holes: plates of the big deck (20 px along, three columns of 20 px across), snapped to the seams of the plates
  const [f0, f1] = big, flen = (f1 - f0 + N) % N, holes = def.holes.map(([f, col, lap], q) => {
    const ic = (f0 + Math.round(f * flen / 10) * 10) % N, J = [], c0 = col * 20 - 10, c1 = col * 20 + 10;
    for (let k = -5; k <= 5; k++) {
      const i = (ic + k + N) % N, p = path[i];
      for (let c = -HALF - 2; c <= HALF + 2; c += .5) {
        const x = Math.round(p.x + nrm[i].x * c), y = Math.round(p.y + nrm[i].y * c), j = y * MW + x; if (x < 0 || y < 0 || x >= MW || y >= MH || !deckM[j]) continue;
        const o = (x + .5 - path[near[j]].x) * nrm[near[j]].x + (y + .5 - path[near[j]].y) * nrm[near[j]].y, dn = (near[j] - ic + N + N / 2) % N - N / 2;
        if (Math.abs(dn) > 4 || o < (col < 0 ? -HALF : c0 + 1) || o > (col > 0 ? HALF : c1 - 1)) continue;
        J.push(j);
      }
    }
    const uniq = Int32Array.from(new Set(J)), cor = (i, c) => ({ x: path[i].x + nrm[i].x * c, y: path[i].y + nrm[i].y * c }), ia = (ic - 5 + N) % N, ib = (ic + 5) % N;
    const ca = col < 0 ? -HALF : c0, cb = col > 0 ? HALF : c1;
    return { q, i: ic, col, lap, J: uniq, P: [cor(ia, ca), cor(ib, ca), cor(ib, cb), cor(ia, cb)], c: { x: path[ic].x + nrm[ic].x * col * 20, y: path[ic].y + nrm[ic].y * col * 20 } };
  });
  yield;
  const pushes = (def.slopes || []).map(([x0, y0, x1, y1, f]) => ({ i0: nearestIdx(path, x0, y0), i1: nearestIdx(path, x1, y1), f }));
  return { alt, lakeM, bridgeM, fanM, laneM, areaM, gullyM, conM, gd, deckM, G, gates, tongues, rowIdx, iA, iZ, holes, big, decks, deckBig, bayPts, bayI: at(B.lane[0]), jumps: [], pushes,
    serp: def.serp.map(at), straight: [at([480, 880]), at([1400, 880])] };
}

// painting, after the ground. S: { def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, shore, sd, th, r, RT }
export function* paintVolcano(S) {
  const { MW, MH, def, d, set, setT, path, nrm, tan, N, ter, dist, near, walls, wallMask, sd, RT } = S, A = MW * MH;
  const { px, dk, solid, off } = paintTools(S);
  const { shade, height } = hillShade(def, MW, MH);
  const put = (j, c, s = 1) => { const o = j * 4; d[o] = clamp(c[0] * s, 0, 255); d[o + 1] = clamp(c[1] * s, 0, 255); d[o + 2] = clamp(c[2] * s, 0, 255); d[o + 3] = 255; };
  const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  const lavaCol = (x, y, h) => {
    // glowing lava with small dark plates of crust drifting on it, brighter streaks where it runs fast
    const v = vnoise(x / 7, y / 7, sd + 60), pl = vnoise(x / 7 + 3, y / 7, sd + 61);
    return pl > .76 ? (pl > .81 ? K.crust : K.crustL) : v > .7 ? K.lava2 : v > .45 ? K.lava1 : h < .05 ? K.lavaD : K.lava;
  };
  const [kx, ky, krx, kry] = def.crater, RIM = def.rim, rx2 = krx + RIM, ry2 = kry + RIM, rm = (rx2 + ry2) / 2;
  const inSpan = (i, [a, b]) => a <= b ? i >= a && i <= b : i >= a || i <= b;
  const M = def.maze;

  yield;
  // how far every pixel is from lava (chamfer, up to 12 px): the glow along the lava, the gaps of the rim, the scenery keeps clear
  const ld = new Uint8Array(A);
  for (let j = 0; j < A; j++) ld[j] = ter[j] === 15 ? 0 : 36;
  for (let y = 1; y < MH; y++) { for (let x = 1; x < MW - 1; x++) { const j = y * MW + x; if (ld[j]) ld[j] = Math.min(ld[j], ld[j - 1] + 3, ld[j - MW] + 3, ld[j - MW - 1] + 4, ld[j - MW + 1] + 4); } if (y % 200 === 0) yield; }
  for (let y = MH - 2; y >= 0; y--) { for (let x = MW - 2; x >= 1; x--) { const j = y * MW + x; if (ld[j]) ld[j] = Math.min(ld[j], ld[j + 1] + 3, ld[j + MW] + 3, ld[j + MW + 1] + 4, ld[j + MW - 1] + 4); } if (y % 200 === 0) yield; }
  for (let j = 0; j < A; j++) ld[j] = Math.min(12, Math.round(ld[j] / 3));
  // and how deep inside the lava (from its bank, up to 12 px): crust at the banks, the hot middle of a stream
  const lin = new Uint8Array(A);
  for (let j = 0; j < A; j++) lin[j] = ter[j] === 15 ? 36 : 0;
  for (let y = 1; y < MH; y++) { for (let x = 1; x < MW - 1; x++) { const j = y * MW + x; if (lin[j]) lin[j] = Math.min(lin[j], lin[j - 1] + 3, lin[j - MW] + 3, lin[j - MW - 1] + 4, lin[j - MW + 1] + 4); } if (y % 200 === 0) yield; }
  for (let y = MH - 2; y >= 0; y--) { for (let x = MW - 2; x >= 1; x--) { const j = y * MW + x; if (lin[j]) lin[j] = Math.min(lin[j], lin[j + 1] + 3, lin[j + MW] + 3, lin[j + MW + 1] + 4, lin[j + MW - 1] + 4); } if (y % 200 === 0) yield; }
  // the axis of the lava under the bridge: from the breach of the crater to where the stream leaves the fan (hot and bright along it, crust further out)
  const [fax, fay] = [def.crater[0], def.crater[1] + def.crater[3] + 10], [fbx, fby] = def.flows[1].c[0], fl = Math.hypot(fbx - fax, fby - fay);
  const axisD = (x, y) => { const t = clamp(((x - fax) * (fbx - fax) + (y - fay) * (fby - fay)) / (fl * fl), 0, 1); return Math.hypot(x - fax - (fbx - fax) * t, y - fay - (fby - fay) * t); };
  yield;
  // how deep every pixel lies in the rock of the maze (chamfer from everything that is not rock, up to 20 px): its lit and shaded faces, the solid circles
  const rd = new Uint8Array(A);
  for (let j = 0; j < A; j++) rd[j] = ter[j] === 80 ? 60 : 0;
  // (only round the maze: the rock is nowhere else)
  const [bx0, by0, bx1, by1] = M.area.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [1e9, 1e9, -1e9, -1e9]).map((v, k) => clamp(v + (k < 2 ? -70 : 70), 1, (k % 2 ? MH : MW) - 2));
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const j = y * MW + x; if (rd[j]) rd[j] = Math.min(rd[j], rd[j - 1] + 3, rd[j - MW] + 3, rd[j - MW - 1] + 4, rd[j - MW + 1] + 4); }
  for (let y = by1; y >= by0; y--) for (let x = bx1; x >= bx0; x--) { const j = y * MW + x; if (rd[j]) rd[j] = Math.min(rd[j], rd[j + 1] + 3, rd[j + MW] + 3, rd[j + MW + 1] + 4, rd[j + MW - 1] + 4); }
  yield;

  // ----- the ground -----
  // the old lava flows on the face (cold: dark grey, ropy)
  const oldM = new Uint8Array(A);
  def.old.forEach((C, q) => stampChain(C, MW, MH, 120 + q, (j, k, u) => { if (ter[j] === 0) oldM[j] = 1 + Math.min(200, k); }));
  const lavaPix = [], STR = RT.straight, ZC = [[K.g0, K.g1, K.g2], [K.d0, K.d1, K.d2], [K.s0, K.s1, K.s2], [K.a0, K.a1, K.a2]], ZH = [.4, .55, .72];
  for (let j = 0; j < A; j++) {
    if (j % 40000 === 39999) yield;
    const x = j % MW, y = j / MW | 0, t = ter[j], h = hash(x, y, sd + 40), v = vnoise(x / 6, y / 6, sd + 41) * .55 + h * .45;
    let c, s;
    if (t === 15) {
      if (RT.lakeM[j]) {
        // the crater lake: plates of black crust drifting on it, glowing seams between them; molten and bright along its shore
        const e = Math.hypot((x + .5 - kx) / krx, (y + .5 - ky) / kry), edge = clamp((e - .84) / .12, 0, 1);
        const cl = cells(x + vnoise(x / 30, y / 30, sd + 84) * 14, y, 15, sd + 85), sm = cl.seam;
        c = sm < 1.2 ? (h < .5 ? K.lavaW : K.lava2) : sm < 2.6 ? K.lava1 : sm < 4 ? K.lavaD : hash(cl.id, 5, sd + 86) < .5 ? K.crust : K.crustL;
        if (sm >= 4 && h < .04) c = K.crustD;
        if (edge > .4 && sm >= 2.6) c = edge > .75 ? (v > .55 ? K.lava2 : K.lava1) : (sm < 5 ? K.lava : K.lavaD);
      } else {
        // flowing lava: hot streaks in the middle of a stream, dark crust with glowing cracks at its banks; the wide lava under the bridge is mostly a crust of
        // plates that are cooling (glowing seams), only its channel from the crater down to the stream is open
        const sk = vnoise(x / 18, y / 5, sd + 62), deep = lin[j] / 3, ad = RT.fanM[j] ? axisD(x, y) + (vnoise(x / 26, y / 26, sd + 63) - .5) * 40 : 0;
        if (ad > 42 || deep < 2.2 + vnoise(x / 9, y / 9, sd + 64) * 2) {
          const cl = cells(x + vnoise(x / 24, y / 24, sd + 65) * 10, y, ad > 42 ? 13 : 8, sd + 66), sm = cl.seam, hot = ad > 42 ? clamp((70 - ad) / 28, 0, 1) : .4;
          c = sm < 1 ? (h < .5 ? K.lava2 : K.lava1) : sm < 2 + hot * 2 ? K.lavaD : hash(cl.id, 5, sd + 67) < .45 ? K.crust : hash(cl.id, 6, sd + 67) < .5 ? K.crustL : K.crustD;
          if (sm >= 2 && h < .05) c = K.crustD;
        } else c = sk > .72 ? K.lava2 : lavaCol(x, y, h);
      }
      if (h < .03) lavaPix.push(j); put(j, c); continue;
    }
    if (t === 80) {
      // the rock of the maze: blue-grey basalt, its edge falls into the gullies (lit where it faces the north-west, in shadow on the south-east), columns on top
      const r3 = rd[j] / 3;
      if (RT.conM[j]) {
        // a runnel of old lava from the feeder to a gate: dark crust, a faint glow in its cracks
        c = Math.abs(vnoise(x / 5, y / 5, sd + 75) - .5) < .05 ? K.lavaD : v < .4 ? K.old1 : K.old;
        put(j, c); continue;
      }
      if (r3 < 4) {
        // the face of the rock: which way it faces (the gradient of the depth)
        const gx = rd[j + 1] - rd[j - 1], gy = rd[j + MW] - rd[j - MW], l = (gx * .6 + gy * .8) / (Math.hypot(gx, gy) || 1);
        c = r3 < 1.4 ? K.basDD : l > .35 ? K.basL : l > -.2 ? K.basT : l > -.6 ? K.bas : K.basD;
      } else {
        // (the top of the rock: the heads of basalt columns, lighter and darker patches, scree in the hollows)
        const cl = cells(x, y, 9, sd + 76), big = vnoise(x / 34, y / 34, sd + 78);
        c = cl.seam < 1 ? K.basD : hash(cl.id, 2, sd + 77) < .3 ? K.basS : hash(cl.id, 3, sd + 77) < .25 ? K.basT : K.bas;
        if (cl.seam >= 1 && cl.seam < 2 && hash(cl.id, 4, sd + 77) < .5) c = K.basT;
        if (big > .66) c = mix(c, K.s2, .35); else if (big < .3) c = mix(c, K.basDD, .3);
      }
      put(j, c, .92 + .1 * shade(x, y)); continue;
    }
    if (t === 1 && RT.gullyM[j]) {
      // the floor of a gully: light ash, a little darker towards its walls, a hard shadow on the side of the north-west wall
      const gg = RT.gd[j] / 4, wall = ter[j - 3 * MW - 3] === 80 || ter[j - 2 * MW - 4] === 80 || ter[j - 4 * MW - 1] === 80;
      c = v < .3 ? K.gf1 : v > .72 ? K.gf2 : K.gf; if (h < .02) c = K.gfS;
      if (wall) c = mix(c, K.gfS, .75); else if (gg > M.gw - 3) c = mix(c, K.gfS, .35);
      put(j, c); continue;
    }
    if (t === 1 && RT.deckM[j]) {
      // the steel deck: plates of 20 x 20 px (seams along and across, rivets), a fine tread; yellow and black at its ends
      const i = near[j], o = off(j), a = ((i - RT.big[0] + N) % N) * 2, seamA = Math.abs(((a + 10) % 20 + 20) % 20 - 10) > 9, seamC = Math.abs(((o + 30) % 20 + 20) % 20 - 10) > 9.1;
      const D = RT.decks.find(S2 => inSpan(i, S2)) || [i, i], endD = Math.min((i - D[0] + N) % N, (D[1] - i + N) % N);
      c = seamA || seamC ? K.stD : ((x + y * 3) % 5 === 0 || (x * 3 - y + 999) % 7 === 0) ? K.stL : h < .1 ? K.stS : K.st;
      if (seamA && seamC) c = K.basDD;
      if (endD < 3) c = (Math.floor((o + 100) / 6) & 1) ? K.yel : K.blk;
      if (Math.abs(o) > HALF - 2) c = K.stD;
      put(j, c); continue;
    }
    if (t === 1 && RT.laneM[j] && dist[j] >= HALF - 1) {
      // the lane of the bay: concrete slabs
      c = (x % 16 === 0 || y % 16 === 0) ? [150, 148, 142] : h < .1 ? [176, 174, 168] : [188, 186, 180];
      put(j, c); continue;
    }
    if (t === 1) {
      const i = near[j], o = off(j);
      if (inSpan(i, STR) && dist[j] < HALF) {
        // the asphalt of the start straight: a white line at both edges, a dashed one in the middle
        c = v < .33 ? K.as1 : v > .7 ? K.as2 : K.as; if (h < .02) c = [36, 36, 40]; else if (h > .985) c = [104, 104, 108];
        if (Math.abs(Math.abs(o) - (HALF - 4)) < 1.2 || (Math.abs(o) < 1.1 && ((i >> 3) & 1))) c = K.line;
        if (Math.abs(o) > HALF - 1.5) c = [58, 54, 50];
        put(j, c); continue;
      }
      // light gravel: grains, two worn ruts, a darker edge
      c = v < .33 ? K.rd1 : v > .7 ? K.rd2 : K.rd; if (h < .03) c = [150, 128, 96]; else if (h > .975) c = [222, 204, 170];
      if (dist[j] > HALF - 2.5) c = K.rdE; else if (Math.abs(Math.abs(o) - 12) < 1.4 && h > .3) c = K.rut;
      s = .9 + .1 * shade(x, y);
    } else if (t === 0) {
      const er = Math.hypot((x + .5 - kx) / rx2, (y + .5 - ky) / ry2);
      if (er < 1 && !RT.lakeM[j]) {
        // inside the crater rim: the wall falls in layers to the lake, dark and rusty bands, yellow sulphur
        const band = Math.floor(er * rm / 5 + vnoise(x / 18, y / 18, sd + 77) * 2.2) & 3, su = vnoise(x / 9, y / 9, sd + 78);
        c = [K.wal, K.wal1, K.wal2, K.wal3][band]; if (h < .06) c = K.wal3; else if (h > .97) c = K.wal2;
        if (su > .78) c = su > .84 ? (h < .4 ? K.sul : K.sulD) : mix(c, K.sulD, .5);
        put(j, c); continue;
      }
      // the face of the mountain by height: meadow, dry grass, scree, ash (with soft wavy borders); old lava flows on it
      const e = height(x, y) + (vnoise(x / 40, y / 40, sd + 43) - .5) * .09, tone = v < .3 ? 1 : v > .72 ? 2 : 0;
      let zi = 0; while (zi < 3 && e > ZH[zi]) zi++;
      c = ZC[zi][tone];
      const nb = zi < 3 ? clamp((e - ZH[zi] + .025) / .05, 0, 1) : 0; if (nb > 0) c = mix(c, ZC[zi + 1][tone], nb * .5);
      if (zi === 0 && h > .992) c = h > .997 ? K.flowerW : K.flower; // (flowers in the meadow)
      if (zi === 0 && vnoise(x / 9, y / 9, sd + 44) > .74) c = mix(c, K.shrubD, .45); // (darker patches of scrub)
      if (zi >= 2 && h < .015) c = K.a1; // (black grit)
      if (zi === 3 && vnoise(x / 22, y / 22, sd + 45) > .8) c = mix(c, K.ox, .4); // (red oxidised scoria near the crater)
      if (oldM[j]) { const k = oldM[j], rope = Math.abs(Math.sin(k * .5 + vnoise(x / 12, y / 12, sd + 46) * 2)) > .88; c = rope ? K.oldR : v < .3 ? K.old1 : v > .72 ? K.old2 : K.old; }
      s = shade(x, y);
    } else continue;
    // the glow of the lava on everything close to it (it shows the danger from far away)
    const g = ld[j] <= 8 ? .6 * (1 - ld[j] / 9) ** 2 : 0;
    if (g > 0) { const o = j * 4; d[o] = clamp(c[0] * s * (1 - g) + 255 * g, 0, 255); d[o + 1] = clamp(c[1] * s * (1 - g) + 118 * g, 0, 255); d[o + 2] = clamp(c[2] * s * (1 - g) + 34 * g, 0, 255); d[o + 3] = 255; }
    else put(j, c, s);
  }
  yield;
  startLine(S);

  yield;
  // ----- the rock of the maze is solid along all its edges: circles 6 px inside, at least 5 px apart (the cars keep about 5 px from its edge) -----
  {
    const C = 6, GWd = Math.ceil(MW / C) + 1, cellsOf = new Map();
    for (let j = 0; j < A; j++) {
      if (ter[j] !== 80 || rd[j] < 18 || rd[j] > 20) continue;
      const x = j % MW + .5, y = (j / MW | 0) + .5, gx = x / C | 0, gy = y / C | 0;
      let free = true;
      for (let dy = -1; dy <= 1 && free; dy++) for (let dx = -1; dx <= 1 && free; dx++) for (const p of cellsOf.get((gy + dy) * GWd + gx + dx) || []) if (Math.hypot(p.x - x, p.y - y) < 5) { free = false; break; }
      if (!free) continue;
      const p = { x, y, r: 4 }, key = gy * GWd + gx; walls.push(p); (cellsOf.get(key) || cellsOf.set(key, []).get(key)).push(p);
    }
    for (let j = 0; j < A; j++) if (ter[j] === 80 && rd[j] > 12) wallMask[j] = 1;
  }

  yield;
  // ----- the crater rim: a ring of solid basalt round the lake, open only where the lava pours out, crowned with blocks (light from the north-west) -----
  const rimOK = j => dist[j] >= HALF + 2 && ter[j] !== 15 && ld[j] > 2 && !RT.alt[j];
  for (let y = Math.max(0, ky - ry2 - 20); y < Math.min(MH, ky + ry2 + 20); y++) for (let x = Math.max(0, kx - rx2 - 20); x < Math.min(MW, kx + rx2 + 20); x++) {
    const j = y * MW + x, e = Math.hypot((x + .5 - kx) / rx2, (y + .5 - ky) / ry2), dr = (e - 1) * rm, w = 7 + (vnoise(x * .1, y * .1, sd + 44) - .5) * 3;
    if (!rimOK(j)) continue;
    if (Math.abs(dr) <= w) {
      const top = (x - kx) * -.5 + (y - ky) * -.7 < 0;
      set(j, Math.abs(dr) > w - 1.2 ? K.basDD : dr < 0 === top ? K.basS : K.basD);
      wallMask[j] = 1;
    } else if (dr > w && dr < w + 9 && (x - kx) * .6 + (y - ky) > 0) dk(x, y, .6 + .04 * (dr - w));
  }
  {
    let a = 0, q = 0;
    while (a < Math.PI * 2) {
      const br = 4 + hash(q, 1, sd + 87) * 4.5, jit = (hash(q, 2, sd + 87) - .5) * 4, x0 = kx + Math.cos(a) * (rx2 + jit), y0 = ky + Math.sin(a) * (ry2 + jit);
      a += (br * 1.5) / rm; q++;
      const j0 = Math.round(y0) * MW + Math.round(x0); if (x0 < 0 || y0 < 0 || x0 >= MW || y0 >= MH || !rimOK(j0)) continue;
      for (let dy = -Math.ceil(br) - 1; dy <= br + 1; dy++) for (let dx = -Math.ceil(br) - 1; dx <= br + 1; dx++) {
        const X = Math.round(x0 + dx), Y = Math.round(y0 + dy), j = Y * MW + X; if (X < 0 || Y < 0 || X >= MW || Y >= MH || !rimOK(j)) continue;
        const dd = Math.hypot(dx, dy * 1.15) + (vnoise(X * .3, Y * .3, sd + 88 + q) - .5) * 2.2; if (dd > br) continue;
        const l = (dx * -.6 + dy * -.8) / Math.max(1, dd);
        set(j, dd > br - 1.1 ? K.basDD : l > .45 && dd > br * .4 ? K.basL : l > -.1 ? K.basT : l > -.5 ? K.bas : K.basD);
        wallMask[j] = 1;
      }
    }
  }
  for (let a = 0; a < Math.PI * 2; a += 6 / rm) {
    const x = kx + Math.cos(a) * rx2, y = ky + Math.sin(a) * ry2, j = Math.round(y) * MW + Math.round(x);
    if (x < 0 || y < 0 || x >= MW || y >= MH || dist[j] < HALF + 8 || ld[j] < 4) continue;
    walls.push({ x, y, r: 7 });
  }

  yield;
  // ----- basalt columns (hexagonal prisms seen from above and a little from the south, a long shadow): the walls near the crater, groups at the edges -----
  const column = (x, y, rr, hg) => {
    const inHex = (dx, dy) => Math.abs(dx) * .5 + Math.abs(dy) * .87 <= rr * .9 && Math.abs(dx) <= rr * .95;
    for (let dy = 0; dy <= rr + hg + 6; dy++) for (let dx = 0; dx <= rr + 8; dx++) if (Math.hypot(dx - 3, (dy - 3) * .8) < rr + 1) dk(x + dx, y + dy, .66);
    for (let dx = -rr; dx <= rr; dx++) {
      let yb = -99; for (let dy = rr; dy >= -rr; dy--) if (inHex(dx, dy)) { yb = dy; break; }
      if (yb === -99) continue;
      const ax = Math.abs(dx), edge = Math.abs(ax - rr * .48) < .8, side = dx < -rr * .48 ? K.bas : dx > rr * .48 ? K.basD : K.basS;
      for (let s = 1; s <= hg; s++) setT(x + dx, y - hg + yb + s, s === hg || ax >= rr * .95 - .5 ? K.basDD : edge ? K.basD : (hash(dx, s, x + y) < .08 ? K.basDD : side));
    }
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      if (!inHex(dx, dy)) continue;
      const rim = !inHex(dx + (dx > 0 ? 1.3 : -1.3), dy) || !inHex(dx, dy + (dy > 0 ? 1.3 : -1.3)), l = dx * -.6 + dy * -.8;
      setT(x + dx, y - hg + dy, rim ? (l > rr * .3 ? K.basL : K.basDD) : l > rr * .45 ? K.basL : l < -rr * .45 ? K.bas : (hash(dx, dy, x * 3 + y) < .06 ? K.basS : K.basT));
    }
  };
  // a retaining wall of dry stone between two legs of the serpentine (it holds the higher terrace, north of it): a cap of light stones on top, below it the
  // face of the wall in courses of blocks (seen from the south: it shows the drop), at its foot a shadow that fades down the slope to the lower leg; solid
  const ok = (x, y, w) => { const j = Math.round(y) * MW + Math.round(x); return x >= 0 && y >= 0 && x < MW && y < MH && dist[j] >= HALF + w + 1 && ter[j] !== 15 && !RT.alt[j]; };
  const dryWall = (x0, y0, x1, y1, w) => {
    const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len;
    for (let a = 0; a <= len; a += 4) { const x = x0 + ux * a, y = y0 + uy * a; if (ok(x, y, w)) { walls.push({ x, y, r: w }); solid(x, y, w); } }
    for (let a = 0; a <= len; a += 1) {
      const X = Math.round(x0 + ux * a), Y = Math.round(y0 + uy * a); if (!ok(X, Y, w)) continue;
      // (the slope below the wall: darker near its foot)
      for (let k = 7; k < 24; k++) { const j = (Y + k) * MW + X; if (Y + k < MH && ter[j] === 0 && dist[j] >= HALF) dk(X, Y + k, .6 + (k - 7) * .023); }
      for (let c = -4; c <= 6; c++) {
        const course = Math.floor((c + 9) / 3), blk = Math.floor((a + course * 4) / 8), jn = ((a + course * 4) % 8) < 1 || (c + 9) % 3 === 0;
        px(X, Y + c, c < -2 ? (hash(Math.floor(a / 5), 7, sd + 52) < .35 ? K.dsL : [200, 192, 178]) : c === -2 ? K.dsDD : c === 6 ? K.dsDD : jn ? K.dsDD : hash(blk, course, sd + 50) < .35 ? K.dsD : hash(blk, course, sd + 51) < .3 ? K.ds : [128, 120, 108]);
      }
    }
  };
  // a ridge of rough boulders (the natural edge of the serpentine to the west, it closes the slope): lit on the north-west, a shadow to the south-east; solid
  const rockRidge = (x0, y0, x1, y1, w) => {
    const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len;
    for (let a = 0; a <= len; a += 4) { const x = x0 + ux * a, y = y0 + uy * a; if (ok(x, y, w)) { walls.push({ x, y, r: w }); solid(x, y, w); } }
    for (let a = 0, q = 0; a <= len; q++) {
      const br = 5 + hash(q, 1, sd + 57) * 5, x = Math.round(x0 + ux * a + (hash(q, 2, sd + 57) - .5) * 5), y = Math.round(y0 + uy * a + (hash(q, 3, sd + 57) - .5) * 5); a += br * 1.1;
      if (!ok(x, y, w)) continue;
      for (let dy = 0; dy <= br + 5; dy++) for (let dx = 0; dx <= br + 6; dx++) if (Math.hypot(dx - 3, dy - 3) < br) dk(x + dx, y + dy, .7);
      for (let dy = -Math.ceil(br); dy <= br; dy++) for (let dx = -Math.ceil(br); dx <= br; dx++) {
        const dd = Math.hypot(dx, dy * 1.1) + (vnoise((x + dx) * .3, (y + dy) * .3, sd + 58 + q) - .5) * 2.4; if (dd > br) continue;
        const l = (dx * -.6 + dy * -.8) / Math.max(1, dd);
        setT(x + dx, y + dy, dd > br - 1 ? K.s1.map(v => v * .55) : l > .4 && dd > br * .35 ? K.s2.map(v => Math.min(255, v * 1.25)) : l > -.2 ? K.s2 : l > -.6 ? K.s0 : K.s1);
      }
    }
  };
  for (const [x0, y0, x1, y1, w, st] of def.walls) (st === 'r' ? rockRidge : dryWall)(x0, y0, x1, y1, w);

  yield;
  // ----- the serpentine: the uphill edge of every leg is cut into the slope (a dark face), the downhill edge has a low kerb of stones -----
  for (let i = RT.serp[0]; i !== RT.serp[1]; i = (i + 1) % N) {
    const p = path[i], up = nrm[i].y < 0 ? 1 : -1, ang = Math.abs(tan[i].x); if (ang < .7) continue;
    for (let k = 0; k < 6; k++) { const x = p.x + nrm[i].x * up * (HALF + k), y = p.y + nrm[i].y * up * (HALF + k), j = Math.round(y) * MW + Math.round(x); if (j >= 0 && j < A && ter[j] === 0) dk(x, y, .62 + k * .06); }
    if (i % 3 === 0) { const x = p.x - nrm[i].x * up * (HALF + 1), y = p.y - nrm[i].y * up * (HALF + 1), j = Math.round(y) * MW + Math.round(x); if (j >= 0 && j < A && ter[j] === 0) { px(x, y, K.dsL); px(x + 1, y, K.dsD); px(x, y + 1, K.dsDD); } }
  }

  yield;
  // ----- the guard rail along the north edge of the start straight (solid): posts every 8 px, a steel beam, its shadow -----
  for (let i = RT.straight[0]; i !== RT.straight[1]; i = (i + 1) % N) {
    if (RT.decks.some(D => inSpan(i, D))) continue;
    const p = path[i], s = nrm[i].y < 0 ? 1 : -1, x = p.x + nrm[i].x * s * (HALF + 3), y = p.y + nrm[i].y * s * (HALF + 3);
    if (i % 2 === 0) walls.push({ x, y, r: 3 });
    dk(x + 1, y + 3, .6); dk(x + 2, y + 4, .7);
    setT(x, y - 2, K.rail); setT(x, y - 1, K.railD); setT(x, y - 3, K.rail);
    if (i % 4 === 0) { setT(x, y, K.post); setT(x, y + 1, K.post); setT(x, y - 4, K.post); }
  }

  yield;
  // ----- the steel bridges: green truss girders on both sides (solid), stone abutments at their ends; the big one has warning signs before it -----
  for (const [a, b] of RT.decks) {
    for (let i = a; i !== (b + 1) % N; i = (i + 1) % N) {
      const p = path[i];
      for (const s of [-1, 1]) {
        const x = p.x + nrm[i].x * s * (HALF + 2), y = p.y + nrm[i].y * s * (HALF + 2);
        if (i % 2 === 0) walls.push({ x, y, r: 3 });
        // (the lower chord on the ground, the upper chord 6 px higher, posts and diagonals between)
        for (let q = -2; q <= 2; q++) px(x + nrm[i].x * s * q, y + nrm[i].y * s * q, Math.abs(q) === 2 ? K.girD : K.gir);
        const ph = ((i - a) % 8 + 8) % 8, hgt = 6;
        setT(x, y - hgt, K.girL); setT(x + tan[i].x, y + tan[i].y - hgt, K.girL);
        if (ph === 0) for (let k = 1; k < hgt; k++) setT(x, y - k, K.gir);
        else setT(x, y - (ph < 4 ? ph * 1.4 : (8 - ph) * 1.4), K.girD);
      }
    }
    for (const i of [a, b]) {
      const p = path[i], tg = tan[i], sgn = i === a ? -1 : 1;
      for (let along = 0; along < 5; along++) for (let c = -HALF - 6; c <= HALF + 6; c++) {
        if (Math.abs(c) < HALF + 1) continue;
        px(p.x + tg.x * along * sgn + nrm[i].x * c, p.y + tg.y * along * sgn + nrm[i].y * c, along === 4 || Math.abs(c) === HALF + 6 ? K.dsDD : K.ds);
      }
    }
  }
  // the warning signs before the big bridge: a post with a triangle (a hole in it) on both sides
  const signs = [];
  {
    const k = (RT.deckBig[0] - 30 + N) % N;
    for (const s of [-1, 1]) {
      const x = Math.round(path[k].x + nrm[k].x * s * (HALF + 8)), y = Math.round(path[k].y + nrm[k].y * s * (HALF + 8));
      walls.push({ x, y, r: 2 }); for (let q = 0; q < 4; q++) dk(x + 1 + q, y + 1, .6);
      for (let q = 0; q < 12; q++) setT(x, y - q, K.post);
      for (let r2 = 0; r2 < 8; r2++) for (let c = -r2; c <= r2; c++) setT(x + c, y - 26 + r2, r2 === 7 || Math.abs(c) === r2 ? K.fire : K.white);
      for (let q = 0; q < 3; q++) setT(x - 1 + q, y - 21, K.blk);
      setT(x, y - 23, K.blk);
      signs.push({ x, y });
    }
  }

  yield;
  // ----- spatter cones (hornitos, solid; their throats glow, volcano.js) -----
  const spatter = (hx, hy, hr, sdq) => {
    for (let dy = -2; dy <= hr + 7; dy++) for (let dx = -2; dx <= hr + 9; dx++) if (Math.hypot(dx - 4, (dy - 4) * 1.1) < hr + 2) dk(hx + dx, hy + dy, .55);
    const mouth = hr * .4;
    for (let dy = -hr - 3; dy <= hr + 3; dy++) for (let dx = -hr - 3; dx <= hr + 3; dx++) {
      const X = hx + dx, Y = hy + dy, dd = Math.hypot(dx, dy) + (vnoise(X * .45, Y * .45, sd + 46 + sdq) - .5) * 2.6; if (dd > hr + .5) continue;
      const a = Math.atan2(dy, dx), l = (dx * -.6 + dy * -.8) / Math.max(1, Math.hypot(dx, dy)), hh = hash(X, Y, sd + 90);
      let c;
      if (dd < mouth * .5) c = hh < .4 ? K.lavaW : K.lava2;
      else if (dd < mouth * .8) c = hh < .5 ? K.lava1 : K.lavaD;
      else if (dd < mouth) c = K.throat;
      else if (dd < mouth + 1.4) c = l > 0 ? K.cinD : K.lavaD;
      else if (dd < mouth + 2.6 && l < 0) c = K.cinH;
      else if (dd > hr - 1) c = K.cinD;
      else {
        c = l > .55 && dd > hr * .55 ? K.cinH : l > .3 ? K.cinL : l > -.05 ? K.cin2 : l > -.45 ? K.cin : K.cin1;
        if (Math.abs(Math.sin(a * 5 + sdq * 1.7)) > .965 && dd < hr - 2) c = l > 0 ? K.lavaD : K.crustL;
        else if (hh < .07) c = K.cinL; else if (hh > .95) c = K.blk;
      }
      setT(X, Y, c);
    }
  };
  const hornitos = [];
  def.hornitos.forEach(([hx, hy, hr], q) => { walls.push({ x: hx, y: hy, r: hr }); solid(hx, hy, hr); hornitos.push({ x: hx, y: hy, r: hr + 4 }); spatter(hx, hy, hr + 3, q); });

  yield;
  // ----- the lava tongues of the maze: a lava picture and a crust picture over each one (drawn while the lava runs and while it cools, volcano.js) -----
  const tongues = RT.tongues.map((F, q) => {
    let x0 = MW, y0 = MH, x1 = 0, y1 = 0;
    for (const j of F.J) { const x = j % MW, y = j / MW | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const W = x1 - x0 + 1, H = y1 - y0 + 1, lava = mk(W, H), crust = mk(W, H), li = lava.getContext('2d').createImageData(W, H), ci = crust.getContext('2d').createImageData(W, H);
    F.J.forEach((j, n) => {
      const x = j % MW, y = j / MW | 0, o = ((y - y0) * W + x - x0) * 4, h = hash(x, y, sd + 91), u = F.U[n];
      const lc = u > .9 ? K.lavaD : lavaCol(x, y, h), cr = Math.abs(vnoise(x / 6, y / 6, sd + 92) - .5) < .05 ? (h < .5 ? K.lava2 : K.lava) : h < .25 ? K.crustL : u > .85 ? K.crustD : K.crust;
      for (let c = 0; c < 3; c++) { li.data[o + c] = lc[c]; ci.data[o + c] = cr[c]; }
      li.data[o + 3] = 255; ci.data[o + 3] = 255;
    });
    lava.getContext('2d').putImageData(li, 0, 0); crust.getContext('2d').putImageData(ci, 0, 0);
    // (where the tongue meets the feeder: a little cone of spatter that spits before the lava comes)
    return { ...F, lava, crust, x0, y0, W, H, q };
  });
  // the gates: a breach in the rock with a glowing lip
  for (const g of Object.values(RT.gates)) for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const dd = Math.hypot(dx, dy); if (dd < 6) px(g.x + dx, g.y + dy, dd < 3 ? K.lava1 : K.lavaD); }

  yield;
  // ----- the fire brigade's washing bay beside the start straight: wet tiles, a low wall between the road and the lane, the fire engine behind it, a hydrant -----
  let bay;
  {
    const B = def.bay, [wx0, wy0, wx1, wy1] = B.wash, [lx0, lx1, ly] = B.wall;
    for (let y = wy0; y < wy1; y++) for (let x = wx0; x < wx1; x++) { const j = y * MW + x; if (RT.laneM[j] && ter[j] === 1) { S.washMask[j] = 1; set(j, ((x >> 2) + (y >> 2)) & 1 ? K.tile : K.tile2); } }
    for (let x = lx0; x <= lx1; x++) {
      for (let dy = -4; dy <= 4; dy++) { const c = Math.abs(dy) === 4 ? K.basDD : (x % 8 === 0) ? K.dsD : dy < 0 ? K.dsL : K.ds; px(x, ly + dy, c); wallMask[(ly + dy) * MW + x] = 1; }
      for (let dy = 5; dy <= 7; dy++) dk(x + 1, ly + dy, .7);
      if ((x - lx0) % 6 === 0) walls.push({ x, y: ly, r: 5 });
    }
    // the fire engine (seen from above, lying east: red cab, the ladder on its roof, blue lights) and the hydrant
    const [ex, ey] = B.engine, R = (x, y, w, h, c) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) setT(ex + x + xx, ey + y + yy, c); };
    for (let y = -8; y <= 16; y++) for (let x = -30; x <= 36; x++) dk(ex + x + 4, ey + y + 4, .6);
    R(-31, -10, 64, 20, K.tyre); R(-30, -9, 62, 18, K.fire); R(19, -9, 13, 18, K.fireD); R(27, -7, 4, 14, [150, 200, 230]);
    for (let x = -26; x < 14; x += 3) R(x, -5, 1, 10, K.chrome); R(-26, -5, 40, 1, K.chrome); R(-26, 4, 40, 1, K.chrome);
    R(21, -8, 2, 3, [60, 120, 255]); R(21, 5, 2, 3, [60, 120, 255]);
    for (let x = -26; x <= 28; x += 9) walls.push({ x: ex + x, y: ey, r: 10 });
    const [hx, hy] = B.hydrant; walls.push({ x: hx, y: hy, r: 3 });
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 9) setT(hx + dx, hy + dy, dx * dx + dy * dy > 5 ? K.fireD : K.fire);
    setT(hx, hy, K.chrome);
    const [gx, gy] = B.sign; walls.push({ x: gx, y: gy, r: 2 });
    for (let k = 0; k < 14; k++) setT(gx, gy - k, K.basD);
    for (let yy = 0; yy < 9; yy++) for (let xx = -8; xx <= 8; xx++) setT(gx + xx, gy - 22 + yy, yy === 0 || yy === 8 || Math.abs(xx) === 8 ? K.fireD : K.fire);
    for (let xx = -5; xx <= 5; xx += 2) for (let yy = 2; yy < 7; yy++) if ((xx + yy) % 3 === 0) setT(gx + xx, gy - 22 + yy, K.white);
    bay = { P: RT.bayPts, i0: RT.bayI, lane: RT.laneM, wash: B.wash, crew: B.crew, sign: B.sign, engine: B.engine };
  }

  yield;
  // ----- the base camp below the start straight: a police car and an ambulance (their blue lights blink, volcano.js), the TV van with its dish, the reporter
  // and the camera, dome tents, the containers of the scientists with the seismograph, red and white tape along the road -----
  let camp;
  {
    const [cx, cy] = def.camp, R = (x, y, w, h, c) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) setT(cx + x + xx, cy + y + yy, c); };
    const shadow = (x, y, w, h) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) dk(cx + x + xx + 3, cy + y + yy + 3, .6); };
    const block = (x, y, w, h) => { for (let yy = 0; yy < h; yy += 6) for (let xx = 0; xx < w; xx += 6) walls.push({ x: cx + x + Math.min(xx + 3, w - 3), y: cy + y + Math.min(yy + 3, h - 3), r: 5 }); solid(cx + x + w / 2, cy + y + h / 2, Math.max(w, h) / 2); };
    // (a trodden square of gravel under it all)
    for (let y = -78; y < 80; y++) for (let x = -190; x < 180; x++) { const X = cx + x, Y = cy + y, j = Y * MW + X; if (X < 0 || Y < 0 || X >= MW || Y >= MH || ter[j] !== 0 || dist[j] < HALF + 4) continue; const e = Math.hypot(x / 190, y / 82); if (e < 1 - .08 * vnoise(X / 20, Y / 20, sd + 52)) set(j, mix(hash(X, Y, sd + 53) < .5 ? K.rd1 : K.rd, K.g1, clamp((e - .7) / .3, 0, 1) * .6)); }
    // the police car (white and blue) and the ambulance (white with a red stripe), lying east
    shadow(-170, -46, 26, 13); R(-171, -47, 26, 13, K.tyre); R(-170, -46, 24, 11, K.white); R(-170, -42, 24, 3, [40, 80, 170]); R(-158, -46, 5, 11, [70, 110, 150]); R(-163, -45, 2, 9, [30, 30, 40]);
    block(-171, -47, 26, 13);
    shadow(-170, -18, 30, 15); R(-171, -19, 30, 15, K.tyre); R(-170, -18, 28, 13, K.white); R(-170, -13, 28, 3, K.fire); R(-148, -17, 6, 11, [150, 200, 230]); R(-163, -17, 2, 11, K.fire); R(-164, -13, 4, 3, K.fire);
    block(-171, -19, 30, 15);
    // the TV van with the dish on its roof, the reporter (microphone) and the cameraman in front of it, looking at the volcano
    shadow(-40, -62, 36, 16); R(-41, -63, 36, 16, K.tyre); R(-40, -62, 34, 14, [236, 234, 228]); R(-12, -62, 6, 14, [150, 200, 230]); R(-38, -58, 18, 2, [230, 120, 30]);
    for (let a = 0; a < 6.28; a += .2) for (let rr = 0; rr <= 5; rr++) setT(Math.round(cx - 26 + Math.cos(a) * rr), Math.round(cy - 55 + Math.sin(a) * rr), rr > 4 ? K.contD : [214, 218, 224]);
    setT(cx - 26, cy - 55, K.post); block(-41, -63, 36, 16);
    // the tents: domes in four colours, their poles crossing, a shadow
    /** @type {Array<[number, number, number[]]>} */
    const tents = [[-90, 40, [232, 120, 40]], [-40, 56, [52, 110, 190]], [8, 38, [70, 150, 70]], [62, 54, [230, 196, 50]], [-130, 52, [200, 70, 60]]];
    for (const [tx, ty, col] of tents) {
      for (let dy = -9; dy <= 9; dy++) for (let dx = -11; dx <= 11; dx++) { const e = Math.hypot(dx / 11, dy / 9); if (e < 1) dk(cx + tx + dx + 4, cy + ty + dy + 4, .62); }
      for (let dy = -9; dy <= 9; dy++) for (let dx = -11; dx <= 11; dx++) {
        const e = Math.hypot(dx / 11, dy / 9); if (e >= 1) continue;
        const l = (dx * -.6 + dy * -.8) / 11, pole = Math.abs(dx * .82 - dy) < .7 || Math.abs(dx * .82 + dy) < .7;
        setT(cx + tx + dx, cy + ty + dy, pole ? [40, 40, 44] : e > .9 ? col.map(v => v * .55) : col.map(v => clamp(v * (1 + l * .45), 0, 255)));
      }
      block(tx - 10, ty - 8, 20, 16);
    }
    // the containers of the scientists (one white, one orange) with antennas
    /** @type {Array<[number, number, number[]]>} */ ([[100, -40, K.cont], [100, -12, K.contO]]).forEach(([x, y, col]) => {
      shadow(x, y, 50, 22); R(x - 1, y - 1, 52, 24, [30, 26, 24]); R(x, y, 50, 22, col);
      for (let k = 3; k < 50; k += 4) R(x + k, y, 1, 22, col === K.cont ? K.contD : [180, 90, 30]);
      block(x, y, 50, 22);
    });
    R(144, -50, 1, 10, K.ant); R(141, -52, 7, 1, K.ant); R(144, -53, 1, 1, [255, 60, 60]);
    // the tape along the road: posts every 24 px, red and white
    for (let x = -186; x <= 176; x++) { const y = -76 + Math.round(Math.sin(x * .3) * .6); setT(cx + x, cy + y, (Math.floor(x / 4) & 1) ? K.fire : K.white); if ((x + 186) % 24 === 0) { for (let k = 0; k < 6; k++) setT(cx + x, cy + y + 2 - k, K.post); walls.push({ x: cx + x, y: cy + y, r: 2 }); } }
    camp = { x: cx, y: cy, police: { x: cx - 160, y: cy - 41 }, amb: { x: cx - 158, y: cy - 12 }, rep: { x: cx + 6, y: cy - 58 }, cam: { x: cx + 18, y: cy - 52 }, seis: { x: cx + 126, y: cy - 8 }, sci: { x: cx + 160, y: cy + 22 } };
  }

  yield;
  // ----- scenery: shrubs and pines in the meadows at the foot, rocks on the scree, fumaroles with sulphur higher up, groups of basalt columns -----
  const okOff = (x, y, m) => {
    for (let dy = -m; dy <= m; dy += 2) for (let dx = -m; dx <= m; dx += 2) {
      const X = x + dx, Y = y + dy; if (X < 2 || Y < 2 || X >= MW - 2 || Y >= MH - 2) return false;
      const j = Y * MW + X; if (ter[j] !== 0 || dist[j] < HALF + 10 || wallMask[j] || RT.alt[j] || RT.laneM[j] || RT.lakeM[j] || ld[j] < 5) return false;
    }
    const e = Math.hypot((x + .5 - kx) / rx2, (y + .5 - ky) / ry2); return e > 1.15 && Math.hypot(x - def.camp[0], (y - def.camp[1]) * 2) > 230;
  };
  const shrub = (x, y, rr, pine) => {
    for (let dy = -rr; dy <= rr + 4; dy++) for (let dx = -rr; dx <= rr + 5; dx++) if (Math.hypot(dx - 3, dy - 3) < rr) dk(x + dx, y + dy, .62);
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      const dd = pine ? Math.max(Math.abs(dx), Math.abs(dy)) * .7 + Math.hypot(dx, dy) * .4 : Math.hypot(dx, dy) + (vnoise((x + dx) * .4, (y + dy) * .4, sd + 54) - .5) * 2.5; if (dd > rr) continue;
      const l = (dx * -.6 + dy * -.8) / rr, hh = hash(x + dx, y + dy, sd + 55);
      setT(x + dx, y + dy, l > .35 && hh > .3 ? K.shrubL : l < -.3 ? K.shrubD : hh < .15 ? K.shrubD : K.shrub);
    }
  };
  for (let k = 0, tries = 0; k < 110 && tries < 6000; tries++) {
    const x = 8 + (S.r() * (MW - 16) | 0), y = 8 + (S.r() * (MH - 16) | 0), e = height(x, y); if (e > .4 || !okOff(x, y, 8)) continue;
    const pine = e < .26 && S.r() < .35, rr = pine ? 6 + (S.r() * 3 | 0) : 3 + (S.r() * 4 | 0); shrub(x, y, rr, pine); walls.push({ x, y, r: rr - 1 }); solid(x, y, rr - 1); k++;
  }
  for (let k = 0, tries = 0; k < 26 && tries < 4000; tries++) {
    const x = 6 + (S.r() * (MW - 12) | 0), y = 6 + (S.r() * (MH - 12) | 0), e = height(x, y);
    if (e < .5 || !okOff(x, y, 16)) continue;
    const n = 3 + (S.r() * 4 | 0), grp = [];
    for (let q = 0; q < n; q++) { const a = S.r() * 6.28, rr = q ? 7 + S.r() * 6 : 0; grp.push([Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr), 3 + (S.r() * 6 | 0)]); }
    grp.sort((a, b) => a[1] - b[1]).forEach(([X, Y, hg]) => { column(X, Y, 5, hg); walls.push({ x: X, y: Y, r: 4 }); solid(X, Y, 5); });
    k++;
  }
  const vents = [];
  for (let k = 0, tries = 0; k < 12 && tries < 2000; tries++) {
    const x = 8 + (S.r() * (MW - 16) | 0), y = 8 + (S.r() * (MH - 16) | 0); if (height(x, y) < .45 || !okOff(x, y, 8)) continue;
    for (let dy = -7; dy <= 7; dy++) for (let dx = -8; dx <= 8; dx++) {
      const dd = Math.hypot(dx, dy * 1.15) + (vnoise((x + dx) * .4, (y + dy) * .4, sd + 47) - .5) * 3; if (dd > 7) continue;
      px(x + dx, y + dy, dd < 2 ? [20, 16, 14] : dd < 3.2 ? K.sulD : hash(x + dx, y + dy, sd + 48) < .3 ? [250, 236, 120] : K.sul);
    }
    vents.push({ x, y }); k++;
  }
  for (let k = 0, tries = 0; k < 30 && tries < 3000; tries++) {
    const x = 8 + (S.r() * (MW - 16) | 0), y = 8 + (S.r() * (MH - 16) | 0); if (height(x, y) < .32 || !okOff(x, y, 7)) continue;
    const rr = 3 + (S.r() * 4 | 0); walls.push({ x, y, r: rr }); solid(x, y, rr);
    for (let dy = 0; dy <= rr + 3; dy++) for (let dx = 0; dx <= rr + 4; dx++) if (Math.hypot(dx - 2, dy - 2) < rr) dk(x + dx, y + dy, .65);
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const dd = Math.hypot(dx, dy) + (vnoise((x + dx) * .5, (y + dy) * .5, sd + 56) - .5) * 1.6; if (dd <= rr) setT(x + dx, y + dy, dd > rr - 1 ? K.s1.map(v => v * .6) : dx + dy < -rr * .5 ? K.s2.map(v => v * 1.2) : K.s0); }
    k++;
  }

  return { jumps: RT.jumps, pushes: RT.pushes, alt: RT.alt, bay, camp, vents, hornitos, signs, lavaPix, crater: def.crater, fountains: def.fountains, serp: RT.serp, laneM: RT.laneM,
    maze: { G: RT.G, tongues, gates: RT.gates, gully: RT.gullyM, rowIdx: RT.rowIdx, iA: RT.iA, iZ: RT.iZ, laps: M.laps, area: M.area, nr: M.nr },
    bridge: { big: RT.big, decks: RT.decks, deckBig: RT.deckBig, deckM: RT.deckM, holes: RT.holes, r0: (RT.big[0] - 30 + N) % N } };
}
