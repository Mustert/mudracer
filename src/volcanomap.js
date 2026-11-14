import { HALF, clamp, hash, hex, mk, vnoise } from './core.js';
import { nearestIdx, paintTools, startLine } from './bau.js';

// ---------- Vulkan Rev 4 (plaene/VULKAN_REV4.md, on Rev 2: plaene/VULKAN_REV2.md): the volcano you can see. A cone of black basalt with its crater lake in the
// middle; the road of red scoria starts at its foot, jumps a lava stream in the lava field (hornitos on the road), crosses the south-east stream on a basalt bridge,
// climbs the east flank in a serpentine (the fireballs fall there), crosses the crater lake on a causeway of basalt pavers with lanterns and comes down over the
// north-west flank and the west edge (the fire brigade's washing bay) through three lava fords: gullies of old lava that a vent fills in pulses (volcano.js).
// Nothing can be cut off: a solid crater rim, the lava streams, basalt levees between the serpentine legs and from the rim to the cinder cone and on to the top,
// the solid cinder cone, a lava pond inside the bend (CLAUDE.md, principle 4).
// Terrain: 0 black basalt beside the road, 1 the road of red scoria (lapilli), 15 lava (you burn: gone for a moment). The gullies of the fords are 0 or 1 while
// they are cold and 15 while the lava runs in them (volcano.js). (2 ash: only the soot when you fall into the lava; Rev 3 had ash drifts and obsidian.)

export const DIKE = 22; // (half the width of the causeway through the crater lake)

const K = Object.fromEntries(Object.entries({
  gnd: '#2b2523', gnd1: '#241f1e', gnd2: '#352d2a', rope: '#3f3531', speck: '#5e3428', grey: '#5a5450', high: '#5a4238',
  rd: '#7c4634', rd1: '#6f3e2e', rd2: '#88503c', rdL: '#a46650', rdD: '#58321f', kerb: '#bcab98', kerbD: '#8c7c6c', rut: '#6a3a2a',
  lava: '#ff7a1a', lava1: '#ffa21f', lava2: '#ffd04a', lavaD: '#d4481a', lavaW: '#fff2b0', crust: '#3a1e16', crustL: '#5c2c1a', crustD: '#26140f',
  bas: '#5c6470', basL: '#8a94a2', basD: '#3a404a', basDD: '#1e2128', basT: '#727c8a', basS: '#4a515c',
  cin: '#4a2a24', cin1: '#3c221e', cin2: '#5c3428', cinL: '#7a4636', cinD: '#2a1814', cinH: '#a2603e', throat: '#1a0c08',
  wal: '#3a2e2a', wal1: '#4a3a32', wal2: '#5c3a2c', wal3: '#2e2422',
  fire: '#d6382e', fireD: '#9a2018', white: '#f0ece4', chrome: '#b8c0c8', tyre: '#1a1818',
  tile: '#4e6a7a', tile2: '#3e5868',
  cont: '#d8d4cc', contD: '#8a867e', contO: '#e8742a', ant: '#9aa0a8', sul: '#e8d24a', sulD: '#a89428', obs: '#16141c', obsL: '#5a6a8e',
  yel: '#f2c230', blk: '#1b1612', slab: '#6e7680', slabD: '#555c66', slabL: '#8c949e', slabT: '#7a828c', iron: '#2a2624',
  rn: '#4a3e3a', rn1: '#433834', rn2: '#544640', rnR: '#66564e', rnD: '#2a221f', rnL: '#7a685e',
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

// a lava stream: a chain of circles [x, y, half width], sampled every 2 px (one point per 2 px: k * 2 is about the way along it)
function chainPts(C) {
  const out = [];
  for (let k = 1; k < C.length; k++) {
    const [ax, ay, aw] = C[k - 1], [bx, by, bw] = C[k], m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 2));
    for (let s = k > 1 ? 1 : 0; s <= m; s++) { const f = s / m; out.push({ x: ax + (bx - ax) * f, y: ay + (by - ay) * f, w: aw + (bw - aw) * f }); }
  }
  return out;
}

// cells of irregular polygons (Worley noise): the plates of crust on the lava lake, the basalt pavers of the causeway. seam = how close to the edge of its cell
// (0 on the edge), id = which cell
function cells(x, y, C, sd) {
  const gx = Math.floor(x / C), gy = Math.floor(y / C);
  let d1 = 1e9, d2 = 1e9, id = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = gx + dx, cy = gy + dy, px = (cx + .15 + hash(cx, cy, sd) * .7) * C, py = (cy + .15 + hash(cx, cy, sd + 1) * .7) * C, d = Math.hypot(x - px, y - py);
    if (d < d1) { d2 = d1; d1 = d; id = cx * 7919 + cy; } else if (d < d2) d2 = d;
  }
  return { seam: d2 - d1, id };
}

// the height of the mountain on a coarse grid (4 px) and from it the light on the slopes (light from the north-west): the cone rises to the crater rim and falls into
// the crater, gullies run down its flanks, the cinder cone sits on the west flank. shade(x, y) is about 1 on flat ground, brighter on slopes that face the light
function hillShade(def, MW, MH) {
  const C4 = 4, GW = Math.ceil(MW / C4) + 2, GH = Math.ceil(MH / C4) + 2, h = new Float32Array(GW * GH), s = new Float32Array(GW * GH);
  const [cx, cy, R] = def.cone, [kx, ky, krx, kry] = def.crater, [sx, sy, srx, sry] = def.sub;
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const x = gx * C4, y = gy * C4, dx = x - cx, dy = (y - cy) * 1.2, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    let v = Math.pow(clamp(1 - r / R, 0, 1), 1.1);
    const e = Math.hypot((x - kx) / (krx + 30), (y - ky) / (kry + 30)); if (e < 1) v -= .32 * Math.pow(1 - e, .6);
    v += .022 * Math.sin(a * 23 + vnoise(x / 70, y / 70, 7) * 5) * clamp(r / 220, 0, 1) * clamp(1 - r / R, 0, 1);
    const es = Math.hypot((x - sx) / srx, (y - sy) / sry); if (es < 1.08) v += .62 * Math.pow((1.08 - es) / 1.08, .9) - (es < .24 ? .2 * (1 - es / .24) : 0);
    h[gy * GW + gx] = v;
  }
  for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
    const k = gy * GW + gx, ddx = (h[k + 1] - h[k - 1]) / (2 * C4), ddy = (h[k + GW] - h[k - GW]) / (2 * C4);
    s[k] = clamp(1 + 150 * (ddx + ddy), .55, 1.5);
  }
  const at = (A, x, y) => {
    const fx = x / C4, fy = y / C4, ix = Math.min(GW - 2, Math.max(1, fx | 0)), iy = Math.min(GH - 2, Math.max(1, fy | 0)), u = fx - ix, w = fy - iy, k = iy * GW + ix;
    return (A[k] * (1 - u) + A[k + 1] * u) * (1 - w) + (A[k + GW] * (1 - u) + A[k + GW + 1] * u) * w;
  };
  return { shade: (x, y) => at(s, x, y), height: (x, y) => at(h, x, y) };
}

// terrain, before the ground is painted. S: { def, ter, dist, near, path, tan, nrm, N, stampAt }
export function* volcanoTerrain(S) {
  const { MW, MH, def, ter, dist, near, path, tan, N } = S, A = MW * MH;
  const alt = new Uint8Array(A), lakeM = new Uint8Array(A), bridgeM = new Uint8Array(A), subM = new Uint8Array(A), laneM = new Uint8Array(A), pondM = new Uint8Array(A);
  yield;
  // the crater lake: lava, the causeway through it stays road (DIKE px to each side of the line, a ragged edge)
  const [kx, ky, krx, kry] = def.crater;
  for (let y = Math.max(0, ky - kry - 12); y < Math.min(MH, ky + kry + 12); y++) for (let x = Math.max(0, kx - krx - 12); x < Math.min(MW, kx + krx + 12); x++) {
    const j = y * MW + x, e = ((x + .5 - kx) / krx) ** 2 + ((y + .5 - ky) / kry) ** 2;
    if (e >= .9 + .2 * vnoise(x * .04, y * .04, 91)) continue;
    lakeM[j] = 1;
    if (ter[j] === 1 && dist[j] < DIKE + (vnoise(x * .11, y * .11, 92) - .5) * 7) continue;
    ter[j] = 15;
  }
  yield;
  // the lava streams out of breaches in the crater rim down to the edge of the map. Where the south stream meets the road, the road is lava too (the jump goes
  // over it); where the south-east stream meets it, a basalt bridge carries the road (bridgeM: the road and the parapets)
  for (const F of def.flows) {
    for (const p of chainPts(F.c)) {
      const R = Math.ceil(p.w + 4);
      for (let y = Math.max(0, Math.floor(p.y - R)); y <= Math.min(MH - 1, p.y + R); y++) for (let x = Math.max(0, Math.floor(p.x - R)); x <= Math.min(MW - 1, p.x + R); x++) {
        const j = y * MW + x; if (ter[j] === 15) continue;
        if (Math.hypot(x + .5 - p.x, y + .5 - p.y) >= p.w + (vnoise(x * .12, y * .12, 93) - .5) * 5) continue;
        if (F.bridge && dist[j] < HALF + 4) { bridgeM[j] = 1; continue; }
        ter[j] = 15;
      }
    }
    yield;
  }
  // the cinder cone on the west flank: solid (painted in paintVolcano)
  const [sx, sy, srx, sry] = def.sub;
  for (let y = Math.max(0, sy - sry - 12); y < Math.min(MH, sy + sry + 12); y++) for (let x = Math.max(0, sx - srx - 12); x < Math.min(MW, sx + srx + 12); x++) {
    const j = y * MW + x; if (ter[j] !== 0 || Math.hypot((x + .5 - sx) / srx, (y + .5 - sy) / sry) >= 1 + (vnoise(x * .05, y * .05, 94) - .5) * .08) continue;
    subM[j] = 1;
  }
  yield;
  // the fire brigade's bay beside the way down: a lane that leaves the road and comes back (road; the way back arrow and c.safe know it as alt)
  const B = def.bay, bayPts = stampLine(B.lane, B.half, j => { laneM[j] = 1; if (ter[j] === 0 || ter[j] === 1) { if (ter[j] === 0) ter[j] = 1; if (dist[j] >= HALF) alt[j] = 1; } }, MW, MH);
  yield;
  // the lava fords: a gully of old lava from a vent across the road, into a lava pond or off the edge of the map. While it is cold it is what it was (road or
  // basalt); in a pulse the lava runs down it (volcano.js). Per ford: its pixels sorted by how far down (j, k = point of the chain, u = how far from its middle
  // 0..1, the old terrain), where it crosses the road (points of the chain kRoad..kEnd, points of the centre line r0..r1)
  const fordAt = new Map(), fords = [];
  def.fords.forEach((F, q) => {
    if (F.pond) {
      const [px, py, prx, pry] = F.pond;
      for (let y = Math.max(0, py - pry - 8); y < Math.min(MH, py + pry + 8); y++) for (let x = Math.max(0, px - prx - 8); x < Math.min(MW, px + prx + 8); x++) {
        const j = y * MW + x; if (ter[j] !== 0 || dist[j] < HALF + 4) continue;
        if (((x + .5 - px) / prx) ** 2 + ((y + .5 - py) / pry) ** 2 < .85 + .3 * vnoise(x * .06, y * .06, 99)) { ter[j] = 15; pondM[j] = 1; }
      }
    }
    const pts = chainPts(F.c), D = new Map();
    pts.forEach((p, k) => {
      const R = Math.ceil(p.w + 3);
      for (let y = Math.max(0, Math.floor(p.y - R)); y <= Math.min(MH - 1, p.y + R); y++) for (let x = Math.max(0, Math.floor(p.x - R)); x <= Math.min(MW - 1, p.x + R); x++) {
        const j = y * MW + x; if ((ter[j] !== 0 && ter[j] !== 1) || lakeM[j] || laneM[j] || subM[j] || bridgeM[j]) continue;
        const dd = Math.hypot(x + .5 - p.x, y + .5 - p.y), wn = p.w + (vnoise(x * .12, y * .12, 98 + q) - .5) * 4; if (dd >= wn) continue;
        const o = D.get(j); if (!o || dd < o[2]) D.set(j, [k, dd / wn, dd]);
      }
    });
    const L = [...D].sort((a, b) => a[1][0] - b[1][0] || a[0] - b[0]);
    const J = Int32Array.from(L, e => e[0]), Kk = Int32Array.from(L, e => e[1][0]), U = Float32Array.from(L, e => e[1][1]), old = Uint8Array.from(L, e => ter[e[0]]);
    let kRoad = 1e9, kEnd = -1, r0 = 1e9, r1 = -1;
    L.forEach(([j, [k]]) => {
      fordAt.set(j, [q, D.get(j)[1], k]);
      if (dist[j] < HALF + 3) { kRoad = Math.min(kRoad, k); kEnd = Math.max(kEnd, k); }
      if (dist[j] < HALF) { r0 = Math.min(r0, near[j]); r1 = Math.max(r1, near[j]); }
    });
    fords.push({ pts, J, K: Kk, U, old, kRoad, kEnd, r0, r1, vent: { x: F.c[0][0], y: F.c[0][1] } });
  });
  yield;
  // the jump over the south stream: the lip a few px before the lava on the line; push: everybody who reaches the lip clears the stream
  const jumps = [];
  let lavaI = -1; for (let i = 0; i < N; i++) { const p = path[i]; if (ter[Math.round(p.y) * MW + Math.round(p.x)] === 15) { lavaI = i; break; } }
  if (lavaI >= 0) { const i = (lavaI - 5 + N) % N, p = path[i], tg = tan[i]; jumps.push({ x: p.x, y: p.y, tx: tg.x, ty: tg.y, lo: -HALF - 8, hi: HALF + 8, vz: def.jump.vz, push: def.jump.push }); }
  const pushes = (def.slopes || []).map(([x0, y0, x1, y1, f]) => ({ i0: nearestIdx(path, x0, y0), i1: nearestIdx(path, x1, y1), f }));
  const at = ([x, y]) => nearestIdx(path, x, y);
  return { alt, lakeM, bridgeM, subM, laneM, pondM, fordAt, fords, bayPts, bayI: at(B.lane[0]), jumps, pushes, lavaI,
    dike: [at([kx + krx + 20, ky]), at([kx - krx - 20, ky])], serp: def.serp.map(at) };
}

// painting, after the ground. S: { def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, shore, sd, th, r, RT }
export function* paintVolcano(S) {
  const { MW, MH, def, d, set, setT, path, nrm, N, ter, dist, walls, wallMask, sd, RT } = S, A = MW * MH;
  const { px, dk, solid } = paintTools(S);
  const { shade, height } = hillShade(def, MW, MH);
  const put = (j, c, s = 1) => { const o = j * 4; d[o] = clamp(c[0] * s, 0, 255); d[o + 1] = clamp(c[1] * s, 0, 255); d[o + 2] = clamp(c[2] * s, 0, 255); d[o + 3] = 255; };
  const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  const lavaCol = (x, y, h) => {
    // glowing lava with small dark plates of crust drifting on it, brighter streaks where it runs fast
    const v = vnoise(x / 7, y / 7, sd + 60), pl = vnoise(x / 7 + 3, y / 7, sd + 61);
    return pl > .76 ? (pl > .81 ? K.crust : K.crustL) : v > .7 ? K.lava2 : v > .45 ? K.lava1 : h < .05 ? K.lavaD : K.lava;
  };
  const [kx, ky, krx, kry] = def.crater, RIM = def.rim, rx2 = krx + RIM, ry2 = kry + RIM, rm = (rx2 + ry2) / 2;

  yield;
  // how far every pixel is from lava (chamfer, up to 12 px): the glow along the lava, the gaps of the rim, the scenery keeps clear
  const ld = new Uint8Array(A);
  for (let j = 0; j < A; j++) ld[j] = ter[j] === 15 ? 0 : 36;
  for (let y = 1; y < MH; y++) { for (let x = 1; x < MW - 1; x++) { const j = y * MW + x; if (ld[j]) ld[j] = Math.min(ld[j], ld[j - 1] + 3, ld[j - MW] + 3, ld[j - MW - 1] + 4, ld[j - MW + 1] + 4); } if (y % 200 === 0) yield; }
  for (let y = MH - 2; y >= 0; y--) { for (let x = MW - 2; x >= 1; x--) { const j = y * MW + x; if (ld[j]) ld[j] = Math.min(ld[j], ld[j + 1] + 3, ld[j + MW] + 3, ld[j + MW + 1] + 4, ld[j + MW - 1] + 4); } if (y % 200 === 0) yield; }
  for (let j = 0; j < A; j++) ld[j] = Math.min(12, Math.round(ld[j] / 3));
  yield;

  // ----- the ground -----
  const [sx, sy, srx, sry] = def.sub, lavaPix = [];
  for (let j = 0; j < A; j++) {
    if (j % 40000 === 39999) yield;
    const x = j % MW, y = j / MW | 0, t = ter[j], h = hash(x, y, sd + 40), v = vnoise(x / 6, y / 6, sd + 41) * .55 + h * .45, fa = RT.fordAt.get(j);
    let c, s;
    if (RT.subM[j]) {
      // the cinder cone: red-black scoria, a little crater on top, the light on its slopes
      // (layers of scoria as rings round the top, rusty and lighter higher up)
      const es = Math.hypot((x - sx) / srx, (y - sy) / sry), ring = Math.abs(Math.sin(es * 30 + vnoise(x / 12, y / 12, sd + 47) * 3)) > .94;
      c = es < .17 ? K.cinD : es < .24 ? (v > .5 ? K.cinL : K.cin2) : ring ? K.cin1 : v < .3 ? K.cin1 : v > .72 ? K.cin2 : K.cin; if (h < .02) c = K.cinL;
      const up = es < .24 ? 0 : clamp((1 - es) * .55, 0, .4); c = mix(c, K.cinL, up);
      s = shade(x, y);
    } else if (fa) {
      // the gully of a lava ford, cold: old ropy lava, grey-brown, the ropes bent downstream, a dark bank on the north-west (in its own shadow) and a lit one on
      // the other side; a pale kerb where the road meets it so that the crossing stands out
      const [q, u, k] = fa, p = RT.fords[q].pts[k];
      const rope = Math.abs(Math.sin(k * .6 - u * u * 3.4 + vnoise(x / 14, y / 14, sd + 73) * 2)) > .9;
      const nw = (x + .5 - p.x) * -.6 + (y + .5 - p.y) * -.8 > 0;
      c = u > .84 ? (nw ? K.rnD : K.rnL) : rope ? K.rnR : v < .3 ? K.rn1 : v > .72 ? K.rn2 : K.rn;
      if (u <= .84 && Math.abs(vnoise(x / 8, y / 8, sd + 74) - .5) < .014) c = K.rnD;
      if (u < .5) c = mix(c, K.crustL, .35 * (1 - u / .5)); // (still warm in the middle: rusty, a spark here and there)
      if (u < .6 && h < .012) c = K.lavaD;
      if (t === 1 && dist[j] > HALF - 3) c = (Math.floor((x + y) / 4) & 1) ? K.yel : K.blk; // (yellow and black where the gully crosses the kerb)
      s = .82 + .18 * shade(x, y);
    } else if (t === 0) {
      // black basalt: ropes of pahoehoe lava round the crater, red scoria and grey grit here and there; higher up the mountain it turns a warmer brown, and the
      // light on the slopes shows its shape. Inside the crater rim the wall falls in layers to the lake: dark and rusty bands, yellow sulphur
      const er = Math.hypot((x + .5 - kx) / rx2, (y + .5 - ky) / ry2);
      if (er < 1 && !RT.lakeM[j]) {
        const band = Math.floor(er * rm / 5 + vnoise(x / 18, y / 18, sd + 77) * 2.2) & 3, su = vnoise(x / 9, y / 9, sd + 78);
        c = [K.wal, K.wal1, K.wal2, K.wal3][band]; if (h < .06) c = K.wal3; else if (h > .97) c = K.wal2;
        if (su > .78 && (y < ky + kry * .3)) c = su > .84 ? (h < .4 ? K.sul : K.sulD) : mix(c, K.sulD, .5);
      } else {
        const r = Math.hypot(x - kx, (y - ky) * 1.2), rope = Math.abs(Math.sin(r * .33 + vnoise(x / 16, y / 16, sd + 42) * 7)) > .94;
        c = rope ? K.rope : v < .3 ? K.gnd1 : v > .72 ? K.gnd2 : K.gnd;
        if (h < .012) c = K.speck; else if (h > .992) c = K.grey;
        if (RT.bridgeM[j]) c = K.basDD;
        const hv = clamp((height(x, y) - .28) / .5, 0, .7);
        if (hv > 0) c = mix(c, K.high, hv);
      }
      s = shade(x, y);
    } else if (t === 1) {
      if (RT.bridgeM[j]) { c = (x + y) % 9 === 0 || (x - y + 900) % 9 === 0 ? K.slabD : h < .1 ? K.slabL : K.slab; put(j, c); continue; } // (basalt slabs on the bridge)
      if (RT.lakeM[j]) {
        // the causeway through the lake: pavers of basalt (the tops of columns, irregular polygons) with dark joints; a raised kerb of light stone, at the very
        // edge crust that glows where it meets the lava
        const cl = cells(x, y, 8, sd + 82), tone = hash(cl.id, 3, sd + 83);
        c = cl.seam < 1.1 ? K.basDD : tone < .3 ? K.slabD : tone < .62 ? K.slab : tone < .88 ? K.slabT : K.slabL;
        if (cl.seam > 1.1 && cl.seam < 2.2 && tone < .62) c = mix(c, K.slabL, .25);
        if (ld[j] <= 1) c = h < .5 ? K.crustD : K.crust; else if (ld[j] <= 2) c = (Math.floor(x / 5) & 1) ? K.basL : K.basS; else if (ld[j] <= 3) c = K.basDD;
        s = 1;
      } else {
        // red scoria: fine gravel with lighter and darker grains, two worn ruts, a pale kerb of ash along the edge so that the road stands out against the black
        c = v < .33 ? K.rd1 : v > .7 ? K.rd2 : K.rd; if (h < .03) c = K.rdD; else if (h > .975) c = K.rdL;
        const lane = RT.alt[j] || RT.laneM[j], laneE = lane && [-3, 3, -3 * MW, 3 * MW].some(o => ter[j + o] !== 1);
        if ((!lane && dist[j] > HALF - 3) || laneE) c = (!lane && dist[j] > HALF - 1.2) ? K.kerbD : K.kerb;
        else if (!lane && Math.abs(dist[j] - 13) < 1.3 && h > .35) c = K.rut;
        s = .85 + .15 * shade(x, y);
      }
    } else if (t === 15) {
      if (RT.lakeM[j]) {
        // the crater lake: plates of black crust drifting on it, glowing seams between them; molten and bright along its shore and along the causeway
        const e = Math.hypot((x + .5 - kx) / krx, (y + .5 - ky) / kry), edge = Math.max(clamp((e - .84) / .12, 0, 1), clamp(1 - (dist[j] - DIKE) / 7, 0, 1));
        const cl = cells(x + vnoise(x / 30, y / 30, sd + 84) * 14, y, 15, sd + 85), sm = cl.seam;
        c = sm < 1.2 ? (h < .5 ? K.lavaW : K.lava2) : sm < 2.6 ? K.lava1 : sm < 4 ? K.lavaD : hash(cl.id, 5, sd + 86) < .5 ? K.crust : K.crustL;
        if (sm >= 4 && h < .04) c = K.crustD;
        if (edge > .4 && sm >= 2.6) c = edge > .75 ? (v > .55 ? K.lava2 : K.lava1) : (sm < 5 ? K.lava : K.lavaD);
      } else c = lavaCol(x, y, h);
      if (h < .03) lavaPix.push(j); put(j, c); continue;
    } else continue;
    // the glow of the lava on everything close to it (it shows the danger from far away)
    const g = ld[j] <= 8 ? .6 * (1 - ld[j] / 9) ** 2 : 0;
    if (g > 0) { const o = j * 4; d[o] = clamp(c[0] * s * (1 - g) + 255 * g, 0, 255); d[o + 1] = clamp(c[1] * s * (1 - g) + 118 * g, 0, 255); d[o + 2] = clamp(c[2] * s * (1 - g) + 34 * g, 0, 255); d[o + 3] = 255; }
    else put(j, c, s);
  }
  yield;
  startLine(S);

  yield;
  // ----- the crater rim: a ring of solid basalt round the lake, open only where the road and the lava streams pass, crowned with blocks and boulders (light from
  // the north-west, dark joints); a hard shadow outside to the south-east -----
  const rimOK = j => dist[j] >= HALF + 2 && ter[j] !== 15 && ld[j] > 2 && !RT.alt[j];
  for (let y = Math.max(0, ky - ry2 - 20); y < Math.min(MH, ky + ry2 + 20); y++) for (let x = Math.max(0, kx - rx2 - 20); x < Math.min(MW, kx + rx2 + 20); x++) {
    const j = y * MW + x, e = Math.hypot((x + .5 - kx) / rx2, (y + .5 - ky) / ry2), dr = (e - 1) * rm, w = 7 + (vnoise(x * .1, y * .1, sd + 44) - .5) * 3;
    if (!rimOK(j)) continue;
    if (Math.abs(dr) <= w) {
      const top = (x - kx) * -.5 + (y - ky) * -.7 < 0; // (the inner and the outer face: lit from the north-west)
      set(j, Math.abs(dr) > w - 1.2 ? K.basDD : dr < 0 === top ? K.basS : K.basD);
      wallMask[j] = 1;
    } else if (dr > w && dr < w + 9 && (x - kx) * .6 + (y - ky) > 0) dk(x, y, .6 + .04 * (dr - w));
  }
  {
    // the blocks on the rim: irregular boulders of different sizes, lit on the north-west, a crack or two
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
        if (Math.abs(vnoise(X / 3, Y / 3, sd + 89 + q) - .5) < .03 && dd < br - 1.5) set(j, K.basD);
        wallMask[j] = 1;
      }
    }
  }
  for (let a = 0; a < Math.PI * 2; a += 6 / rm) {
    const x = kx + Math.cos(a) * rx2, y = ky + Math.sin(a) * ry2, j = Math.round(y) * MW + Math.round(x);
    if (x < 0 || y < 0 || x >= MW || y >= MH || dist[j] < HALF + 8 || ld[j] < 4 || RT.alt[j]) continue;
    walls.push({ x, y, r: 7 });
  }

  yield;
  // ----- basalt columns: hexagonal prisms seen from above and a little from the south (a lit top, a face below it with the edges of the prism), different
  // heights, a long shadow to the south-east. Levees of them between the serpentine legs, from the rim to the cinder cone and on to the top -----
  const column = (x, y, rr, hg) => {
    const inHex = (dx, dy) => Math.abs(dx) * .5 + Math.abs(dy) * .87 <= rr * .9 && Math.abs(dx) <= rr * .95;
    for (let dy = 0; dy <= rr + hg + 6; dy++) for (let dx = 0; dx <= rr + 8; dx++) if (Math.hypot(dx - 3, (dy - 3) * .8) < rr + 1) dk(x + dx, y + dy, .66);
    // the face: for every column of the hexagon from its lower edge down hg px
    for (let dx = -rr; dx <= rr; dx++) {
      let yb = -99; for (let dy = rr; dy >= -rr; dy--) if (inHex(dx, dy)) { yb = dy; break; }
      if (yb === -99) continue;
      const ax = Math.abs(dx), edge = Math.abs(ax - rr * .48) < .8, side = dx < -rr * .48 ? K.bas : dx > rr * .48 ? K.basD : K.basS;
      for (let s = 1; s <= hg; s++) setT(x + dx, y - hg + yb + s, s === hg || ax >= rr * .95 - .5 ? K.basDD : edge ? K.basD : (hash(dx, s, x + y) < .08 ? K.basDD : side));
    }
    // the top
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      if (!inHex(dx, dy)) continue;
      const rim = !inHex(dx + (dx > 0 ? 1.3 : -1.3), dy) || !inHex(dx, dy + (dy > 0 ? 1.3 : -1.3)), l = dx * -.6 + dy * -.8;
      setT(x + dx, y - hg + dy, rim ? (l > rr * .3 ? K.basL : K.basDD) : l > rr * .45 ? K.basL : l < -rr * .45 ? K.bas : (hash(dx, dy, x * 3 + y) < .06 ? K.basS : K.basT));
    }
  };
  const levee = (x0, y0, x1, y1, w) => {
    const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len, cols = [];
    for (let a = 0; a <= len; a += 6) {
      const x = x0 + ux * a, y = y0 + uy * a, j = Math.round(y) * MW + Math.round(x);
      if (x < 0 || y < 0 || x >= MW || y >= MH || dist[j] < HALF + w + 1 || ter[j] === 15 || RT.alt[j] || RT.fordAt.has(j)) continue;
      walls.push({ x, y, r: w }); solid(x, y, w); cols.push([x, y, cols.length]);
    }
    // (a column for every second wall point: a row of prisms that touch, a little out of line, of different heights)
    cols.filter(([, , k]) => k % 2 === 0).map(([x, y, k]) => [Math.round(x + (hash(k, 1, sd) - .5) * 3 - uy * (hash(k, 5, sd) - .5) * 4), Math.round(y + (hash(k, 2, sd) - .5) * 3 + ux * (hash(k, 5, sd) - .5) * 4), k])
      .sort((a, b) => a[1] - b[1]).forEach(([x, y, k]) => column(x, y, w + 2 + (hash(k, 3, sd) * 2 | 0), 4 + (hash(k, 4, sd) * 7 | 0)));
  };
  for (const [x0, y0, x1, y1, w] of def.levees) levee(x0, y0, x1, y1, w);

  yield;
  // ----- the cinder cone: solid all round (circles on its outline), a shadow to the south-east -----
  {
    for (let j = 0; j < A; j++) if (RT.subM[j]) wallMask[j] = 1;
    for (let a = 0; a < Math.PI * 2; a += 6 / ((srx + sry) / 2)) walls.push({ x: sx + Math.cos(a) * (srx - 4), y: sy + Math.sin(a) * (sry - 4), r: 6 });
    for (let y = sy - sry; y < sy + sry + 14; y++) for (let x = sx - srx; x < sx + srx + 14; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const j = y * MW + x; if (RT.subM[j] || ter[j] !== 0) continue;
      const e = Math.hypot((x - sx - 6) / srx, (y - sy - 8) / sry); if (e < 1) dk(x, y, .66);
    }
  }

  yield;
  // ----- the bridge over the south-east stream: parapets of basalt blocks (solid) on both sides where it runs over the lava -----
  for (let i = 0; i < N; i += 2) {
    const p = path[i]; if (!RT.bridgeM[Math.round(p.y) * MW + Math.round(p.x)]) continue;
    for (const s of [-1, 1]) {
      const x = p.x + nrm[i].x * s * (HALF + 2), y = p.y + nrm[i].y * s * (HALF + 2);
      if (i % 4 === 0) walls.push({ x, y, r: 3 });
      for (let q = -2; q <= 2; q++) for (let a = -1; a <= 1; a++) px(x + nrm[i].x * q + S.tan[i].x * a, y + nrm[i].y * q + S.tan[i].y * a, Math.abs(q) === 2 ? K.basDD : q * s < 0 ? K.basL : K.bas);
    }
  }

  yield;
  // ----- the lanterns on the causeway: iron posts on both edges every 64 px, a lamp on each (it glows, volcano.js) -----
  const lanterns = [];
  {
    const [i0, i1] = RT.dike;
    for (let k = 0, i = (i0 + 10) % N; k < 400 && i !== i1; k++, i = (i + 1) % N) {
      if (k % 30 !== 0) continue;
      for (const s of [-1, 1]) {
        // (on the kerb: the last paver before the lava, a little in)
        let o = DIKE - 8; while (o < DIKE + 6 && ter[Math.round(path[i].y + nrm[i].y * s * (o + 1)) * MW + Math.round(path[i].x + nrm[i].x * s * (o + 1))] !== 15) o++;
        o -= 3;
        const x = Math.round(path[i].x + nrm[i].x * s * o), y = Math.round(path[i].y + nrm[i].y * s * o), j = y * MW + x;
        if (!RT.lakeM[j] || ter[j] === 15 || o < DIKE - 8) continue;
        walls.push({ x, y, r: 2 });
        for (let q = 0; q < 3; q++) dk(x + 1 + q, y + 1, .6);
        for (let q = 0; q < 13; q++) { setT(x, y - q, q < 2 ? K.basDD : K.iron); if (q > 1) setT(x + 1, y - q, K.basD); }
        for (let dy = -17; dy <= -13; dy++) for (let dx = -2; dx <= 2; dx++) setT(x + dx, y + dy, Math.abs(dx) === 2 || dy === -17 || dy === -13 ? K.iron : K.lava2);
        setT(x - 1, y - 18, K.iron); setT(x, y - 18, K.iron); setT(x + 1, y - 18, K.iron); setT(x, y - 19, K.iron);
        lanterns.push({ x, y: y - 15 });
      }
    }
  }

  yield;
  // ----- the ramp before the south stream: basalt slabs rising to the lip, yellow and black chevrons on the lip, scorch marks where they land -----
  for (const J of RT.jumps) {
    const nx = -J.ty, ny = J.tx;
    for (let a = -26; a <= 0; a++) for (let c = -HALF + 2; c <= HALF - 2; c++) {
      const x = J.x + J.tx * a + nx * c, y = J.y + J.ty * a + ny * c;
      px(x, y, a > -4 ? ((Math.floor((c + 100 + a * .8) / 5)) & 1 ? K.yel : K.blk) : (a + 30) % 6 === 0 ? K.slabD : (a > -14 ? K.slabL : K.slab));
    }
    for (const s of [-1, 1]) { const x = J.x + nx * s * (HALF + 4), y = J.y + ny * s * (HALF + 4); walls.push({ x, y, r: 3 }); for (let k = 0; k < 9; k++) setT(x, y - k, K.basL); for (let q = 0; q < 4; q++) setT(x + 1 + q, y - 8 + (q & 1), K.yel); }
  }

  yield;
  // ----- spatter cones: the hornitos on the road in the lava field and the vents of the fords. A lumpy cone of red-black scoria (lit on the north-west, spatter
  // blobs, frozen drips running down), a dark throat with glowing lava in it, a shadow to the south-east (solid; the glow of the throat pulses, volcano.js) -----
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
      else if (dd < mouth + 1.4) c = l > 0 ? K.cinD : K.lavaD; // (the lip of the throat: its far side glows)
      else if (dd < mouth + 2.6 && l < 0) c = K.cinH;
      else if (dd > hr - 1) c = K.cinD;
      else {
        c = l > .55 && dd > hr * .55 ? K.cinH : l > .3 ? K.cinL : l > -.05 ? K.cin2 : l > -.45 ? K.cin : K.cin1;
        if (Math.abs(Math.sin(a * 5 + sdq * 1.7)) > .965 && dd < hr - 2) c = l > 0 ? K.lavaD : K.crustL; // (frozen drips of spatter)
        else if (hh < .07) c = K.cinL; else if (hh > .95) c = K.blk;
      }
      setT(X, Y, c);
    }
  };
  const hornitos = [];
  def.hornitos.forEach(([hx, hy, hr], q) => { walls.push({ x: hx, y: hy, r: hr }); solid(hx, hy, hr); hornitos.push({ x: hx, y: hy, r: hr + 4 }); spatter(hx, hy, hr + 3, q); });

  yield;
  // ----- the lava fords: the vent (a spatter cone at the top of the gully), a lava picture and a crust picture of the gully (drawn over it while the lava
  // runs and while it cools, volcano.js), warning lights on both sides of the road before the crossing -----
  const fords = RT.fords.map((F, q) => {
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
    const v = F.vent; walls.push({ x: v.x, y: v.y, r: 8 }); solid(v.x, v.y, 7); spatter(v.x, v.y, 10, 7 + q);
    // the lights: 24 px before the gully on both sides of the road, a post with a sign (a red and white triangle) and a red lamp
    const i = (F.r0 - 12 + N) % N, lights = [];
    for (const s of [-1, 1]) {
      const x = Math.round(path[i].x + nrm[i].x * s * (HALF + 6)), y = Math.round(path[i].y + nrm[i].y * s * (HALF + 6));
      walls.push({ x, y, r: 2 });
      for (let k = 0; k < 4; k++) dk(x + 1 + k, y + 1, .6);
      for (let k = 0; k < 14; k++) setT(x, y - k, k % 4 < 2 ? K.white : K.fire);
      for (let r2 = 0; r2 < 7; r2++) for (let c = -r2; c <= r2; c++) setT(x + c, y - 26 + r2, r2 === 6 || Math.abs(c) === r2 ? K.fire : r2 > 2 && Math.abs(c) < 2 && r2 < 5 ? K.blk : K.white);
      for (let dy = -18; dy <= -15; dy++) for (let dx = -2; dx <= 2; dx++) setT(x + dx, y + dy, Math.abs(dx) === 2 || dy === -18 || dy === -15 ? K.blk : [90, 20, 16]);
      lights.push({ x, y: y - 16 });
    }
    const m = F.pts[Math.round((F.kRoad + F.kEnd) / 2)] || F.pts[0];
    return { ...F, lava, crust, x0, y0, W, H, lights, mid: { x: m.x, y: m.y } };
  });

  yield;
  // ----- the fire brigade's washing bay: wet tiles, a low basalt wall between the road and the lane, the fire engine parked behind it, a hydrant, a signpost -----
  let bay;
  {
    const B = def.bay, [wx0, wy0, wx1, wy1] = B.wash, [lx, ly0, ly1] = B.wall;
    for (let y = wy0; y < wy1; y++) for (let x = wx0; x < wx1; x++) { const j = y * MW + x; if (RT.laneM[j] && ter[j] === 1) { S.washMask[j] = 1; set(j, ((x >> 2) + (y >> 2)) & 1 ? K.tile : K.tile2); } }
    for (let y = ly0; y <= ly1; y++) {
      for (let dx = -4; dx <= 4; dx++) { const c = Math.abs(dx) === 4 ? K.basDD : (y % 8 === 0) ? K.basD : dx < 0 ? K.basL : K.bas; px(lx + dx, y, c); wallMask[y * MW + lx + dx] = 1; }
      for (let dx = 5; dx <= 8; dx++) dk(lx + dx, y + 2, .7);
      if ((y - ly0) % 6 === 0) walls.push({ x: lx, y, r: 5 });
    }
    // the fire engine (seen from above: red cab, the ladder on its roof, blue lights) beside the lane, and the hydrant
    const [ex, ey] = B.engine, R = (x, y, w, h, c) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) setT(ex + x + xx, ey + y + yy, c); };
    for (let y = -30; y <= 34; y++) for (let x = -8; x <= 16; x++) dk(ex + x + 4, ey + y + 4, .6);
    R(-9, -30, 18, 62, K.tyre); R(-8, -29, 16, 60, K.fire); R(-8, -29, 16, 13, K.fireD); R(-6, -27, 12, 4, [150, 200, 230]);
    for (let y = -12; y < 28; y += 3) R(-5, y, 10, 1, K.chrome); R(-5, -12, 1, 40, K.chrome); R(4, -12, 1, 40, K.chrome);
    R(-7, -22, 3, 2, [60, 120, 255]); R(4, -22, 3, 2, [60, 120, 255]);
    for (let y = -26; y <= 26; y += 8) walls.push({ x: ex, y: ey + y, r: 9 });
    const [hx, hy] = B.hydrant; walls.push({ x: hx, y: hy, r: 3 });
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 9) setT(hx + dx, hy + dy, dx * dx + dy * dy > 5 ? K.fireD : K.fire);
    setT(hx, hy, K.chrome);
    const [gx, gy] = B.sign; walls.push({ x: gx, y: gy, r: 2 });
    for (let k = 0; k < 14; k++) setT(gx, gy - k, K.basD);
    for (let yy = 0; yy < 9; yy++) for (let xx = -8; xx <= 8; xx++) setT(gx + xx, gy - 22 + yy, yy === 0 || yy === 8 || Math.abs(xx) === 8 ? K.fireD : K.fire);
    for (let xx = -5; xx <= 5; xx += 2) for (let yy = 2; yy < 7; yy++) if ((xx + yy) % 3 === 0) setT(gx + xx, gy - 22 + yy, K.white);
    bay = { P: RT.bayPts, i0: RT.bayI, lane: RT.laneM, wash: B.wash, crew: B.crew, sign: B.sign };
  }

  yield;
  // ----- the research station south of the start straight: two containers with antennas, a seismograph, a researcher in a helmet -----
  let station;
  {
    const [tx, ty] = def.station, R = (x, y, w, h, c) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) setT(tx + x + xx, ty + y + yy, c); };
    for (let y = 0; y < 24; y++) for (let x = 0; x < 70; x++) dk(tx - 30 + x, ty - 6 + y, .7);
    for (const [x, col] of /** @type {Array<[number, any]>} */ ([[-34, K.cont], [2, K.contO]])) {
      R(x, -12, 30, 18, [30, 26, 24]); R(x + 1, -11, 28, 16, col); for (let k = 3; k < 28; k += 4) R(x + 1 + k, -11, 1, 16, col === K.cont ? K.contD : [180, 90, 30]);
      for (let yy = -12; yy < 6; yy++) for (let xx = x; xx < x + 30; xx++) wallMask[(ty + yy) * MW + tx + xx] = 1;
      walls.push({ x: tx + x + 8, y: ty - 3, r: 8 }); walls.push({ x: tx + x + 22, y: ty - 3, r: 8 });
    }
    R(-26, -22, 1, 10, K.ant); R(-29, -24, 7, 1, K.ant); R(-26, -25, 1, 1, [255, 60, 60]);
    R(10, -26, 1, 14, K.ant); for (let k = 0; k < 5; k++) R(6 + k, -26 + k, 9 - 2 * k, 1, K.ant);
    station = { x: tx, y: ty, seis: { x: tx + 12, y: ty - 8 }, man: { x: tx + 44, y: ty - 4 } };
  }

  yield;
  // ----- scenery: basalt columns in groups at the edges of the map (solid), fumaroles with yellow sulphur (steaming), obsidian boulders, charred stumps -----
  const okOff = (x, y, m) => {
    for (let dy = -m; dy <= m; dy += 2) for (let dx = -m; dx <= m; dx += 2) {
      const X = x + dx, Y = y + dy; if (X < 2 || Y < 2 || X >= MW - 2 || Y >= MH - 2) return false;
      const j = Y * MW + X; if (ter[j] !== 0 || dist[j] < HALF + 10 || wallMask[j] || RT.alt[j] || RT.laneM[j] || RT.subM[j] || RT.lakeM[j] || ld[j] < 5 || RT.fordAt.has(j)) return false;
    }
    return true;
  };
  for (let k = 0, tries = 0; k < 26 && tries < 4000; tries++) {
    const x = 6 + (S.r() * (MW - 12) | 0), y = 6 + (S.r() * (MH - 12) | 0), edge = x < 50 || y < 40 || x > MW - 60 || y > MH - 26;
    if (!edge || !okOff(x, y, 16)) continue;
    const n = 3 + (S.r() * 5 | 0), grp = [];
    for (let q = 0; q < n; q++) { const a = S.r() * 6.28, rr = q ? 7 + S.r() * 6 : 0; grp.push([Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr), 3 + (S.r() * 6 | 0)]); }
    grp.sort((a, b) => a[1] - b[1]).forEach(([X, Y, hg]) => { column(X, Y, 5, hg); walls.push({ x: X, y: Y, r: 4 }); solid(X, Y, 5); });
    k++;
  }
  const vents = [];
  for (let k = 0, tries = 0; k < 14 && tries < 2000; tries++) {
    const x = 8 + (S.r() * (MW - 16) | 0), y = 8 + (S.r() * (MH - 16) | 0); if (!okOff(x, y, 8)) continue;
    for (let dy = -7; dy <= 7; dy++) for (let dx = -8; dx <= 8; dx++) {
      const dd = Math.hypot(dx, dy * 1.15) + (vnoise((x + dx) * .4, (y + dy) * .4, sd + 47) - .5) * 3; if (dd > 7) continue;
      px(x + dx, y + dy, dd < 2 ? [20, 16, 14] : dd < 3.2 ? K.sulD : hash(x + dx, y + dy, sd + 48) < .3 ? [250, 236, 120] : K.sul);
    }
    vents.push({ x, y }); k++;
  }
  for (let k = 0, tries = 0; k < 12 && tries < 2000; tries++) {
    const x = 8 + (S.r() * (MW - 16) | 0), y = 8 + (S.r() * (MH - 16) | 0); if (!okOff(x, y, 8)) continue;
    const rr = 4 + (S.r() * 3 | 0); walls.push({ x, y, r: rr }); solid(x, y, rr);
    for (let dy = 0; dy <= rr + 3; dy++) for (let dx = 0; dx <= rr + 4; dx++) if (Math.hypot(dx - 2, dy - 2) < rr) dk(x + dx, y + dy, .65);
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const dd = Math.hypot(dx, dy); if (dd <= rr) setT(x + dx, y + dy, dd > rr - 1 ? [8, 6, 12] : dx + dy < -rr * .6 ? K.obsL : (dx + dy < 0 && hash(dx, dy, k) < .2) ? [90, 110, 150] : K.obs); }
    k++;
  }
  for (let k = 0, tries = 0; k < 10 && tries < 2000; tries++) {
    const x = 8 + (S.r() * (MW - 16) | 0), y = 8 + (S.r() * (MH - 16) | 0); if (!okOff(x, y, 6) || y < 600) continue;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 10) px(x + dx, y + dy, dx * dx + dy * dy > 6 ? [20, 16, 14] : (Math.round(Math.hypot(dx, dy)) % 2 ? [60, 40, 30] : [34, 26, 22]));
    walls.push({ x, y, r: 3 }); k++;
  }

  return { jumps: RT.jumps, pushes: RT.pushes, alt: RT.alt, fords, bay, station, vents, hornitos, lanterns, lavaPix, crater: def.crater, fountains: def.fountains,
    jumpI: RT.lavaI, dike: RT.dike, serp: RT.serp, laneM: RT.laneM };
}
