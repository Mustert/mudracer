import { HALF, clamp, hash, hex, mk, vnoise } from './core.js';
import { nearestIdx, paintTools, startLine } from './bau.js';

// ---------- Vulkan Rev 2 (plaene/VULKAN_REV2.md): the volcano you can see. A cone of black basalt with its crater lake in the middle; the road of red scoria
// starts at its foot, jumps a lava stream in the lava field, crosses the south-east stream on a basalt bridge, climbs the east flank in a serpentine, runs on a
// narrow dike right through the crater lake and at the west rim forks: the open way over the north-west flank and down the west edge (flows of glassy obsidian,
// the fire brigade's washing bay) or the lava tube through the cinder cone (dark, narrow, lit by a lava rill). Nothing can be cut off: a solid crater rim, the
// lava streams, basalt levees between the serpentine legs and round the cinder cone, the solid cinder cone (CLAUDE.md, principle 4).
// Terrain: 0 black basalt beside the road, 1 the road of red scoria (lapilli), 2 ash (like mud, it makes the car sooty), 15 lava (you burn: gone for a moment),
// 80 the floor of the lava tube (rough, a little slower), 81 obsidian (black glass: full speed, hardly any grip; volcano.js surf).

export const TUBE = 80, GLASS = 81, DIKE = 22; // (DIKE: half the width of the dike through the crater lake)

const K = Object.fromEntries(Object.entries({
  gnd: '#2b2523', gnd1: '#241f1e', gnd2: '#352d2a', rope: '#3f3531', speck: '#5e3428', grey: '#5a5450', high: '#5a4238',
  gl: '#25223c', gl1: '#2c2948', gl2: '#3c3a66', glL: '#8a8ad0', glW: '#f0f2ff',
  rd: '#7c4634', rd1: '#6f3e2e', rd2: '#88503c', rdL: '#a46650', rdD: '#58321f', kerb: '#bcab98', kerbD: '#8c7c6c', rut: '#6a3a2a',
  ash: '#aaa49c', ash1: '#9a948c', ash2: '#bcb6ae', ashE: '#7c766e', ashL: '#d2ccc4',
  lava: '#ff7a1a', lava1: '#ffa21f', lava2: '#ffd04a', lavaD: '#d4481a', crust: '#3a1e16', crustL: '#5c2c1a', glowC: '#ff7a24',
  bas: '#5c6470', basL: '#8a94a2', basD: '#3a404a', basDD: '#1e2128', basT: '#727c8a',
  cin: '#4a2a24', cin1: '#3c221e', cin2: '#5c3428', cinL: '#7a4636', cinD: '#2a1814',
  tub: '#9a7a5e', tub1: '#8a6c52', tub2: '#aa8a6c', curb: '#cdbca6', curbD: '#7a6a5a',
  tile: '#4e6a7a', tile2: '#3e5868', fire: '#d6382e', fireD: '#9a2018', white: '#f0ece4', chrome: '#b8c0c8', tyre: '#1a1818',
  cont: '#d8d4cc', contD: '#8a867e', contO: '#e8742a', ant: '#9aa0a8', sul: '#e8d24a', sulD: '#a89428', obs: '#16141c', obsL: '#5a6a8e',
  yel: '#f2c230', blk: '#1b1612', slab: '#7e8690', slabD: '#5a626c', slabL: '#a2aab4',
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

// a lava stream: a chain of circles [x, y, half width], sampled every 2 px
function chainPts(C) {
  const out = [];
  for (let k = 1; k < C.length; k++) {
    const [ax, ay, aw] = C[k - 1], [bx, by, bw] = C[k], m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 2));
    for (let s = 0; s <= m; s++) { const f = s / m; out.push({ x: ax + (bx - ax) * f, y: ay + (by - ay) * f, w: aw + (bw - aw) * f }); }
  }
  return out;
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
  const { MW, MH, def, ter, dist, path, tan, N } = S, A = MW * MH;
  const alt = new Uint8Array(A), lakeM = new Uint8Array(A), bridgeM = new Uint8Array(A), subM = new Uint8Array(A), laneM = new Uint8Array(A);
  yield;
  // the crater lake: lava, the dike through it stays road (DIKE px to each side of the line, a ragged edge)
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
  // the cinder cone on the west flank: solid (painted in paintVolcano), only the lava tube runs through it
  const [sx, sy, srx, sry] = def.sub;
  for (let y = Math.max(0, sy - sry - 12); y < Math.min(MH, sy + sry + 12); y++) for (let x = Math.max(0, sx - srx - 12); x < Math.min(MW, sx + srx + 12); x++) {
    const j = y * MW + x; if (ter[j] !== 0 || Math.hypot((x + .5 - sx) / srx, (y + .5 - sy) / sry) >= 1 + (vnoise(x * .05, y * .05, 94) - .5) * .08) continue;
    subM[j] = 1;
  }
  yield;
  // the lava tube: a narrow branch from the fork at the west rim through the cinder cone down to the start straight. Inside the cone its floor is 80 (rough), outside
  // it is road. tubeAt: corridor pixel -> [distance to the line, nearest point] (walls, roof, light)
  const T = def.tube, tubeAt = new Map();
  const tubePts = stampLine(T.pts, T.half + 12, (j, dd, k) => {
    tubeAt.set(j, [dd, k]);
    if (dd >= T.half || (ter[j] !== 0 && ter[j] !== 1)) return;
    if (subM[j]) ter[j] = TUBE; else if (ter[j] === 0) ter[j] = 1;
    if (dist[j] >= HALF) alt[j] = 1;
  }, MW, MH);
  yield;
  // the fire brigade's bay beside the open way down: a lane that leaves the road and comes back (road; the way back arrow and c.safe know it as alt)
  const B = def.bay, bayPts = stampLine(B.lane, B.half, j => { laneM[j] = 1; if (ter[j] === 0 || ter[j] === 1) { if (ter[j] === 0) ter[j] = 1; if (dist[j] >= HALF) alt[j] = 1; } }, MW, MH);
  yield;
  // ash: drifts in the lee of the cone and in hollows, some reach into the inside of a bend (a shorter line through ash against a longer clean one);
  // obsidian: flows of black glass that run across the open way (on the road and beside it)
  const blobs = (list, code, sd) => {
    for (const [ax, ay, ex, ey, an] of list || []) {
      const R2 = Math.ceil(Math.max(ex, ey) * 1.3) + 2, ca = Math.cos(an || 0), sa = Math.sin(an || 0);
      for (let y = Math.max(0, ay - R2); y <= Math.min(MH - 1, ay + R2); y++) for (let x = Math.max(0, ax - R2); x <= Math.min(MW - 1, ax + R2); x++) {
        const j = y * MW + x; if ((ter[j] !== 0 && ter[j] !== 1) || alt[j] || laneM[j] || lakeM[j] || subM[j] || bridgeM[j]) continue;
        const dx = x + .5 - ax, dy = y + .5 - ay, e = ((dx * ca + dy * sa) / ex) ** 2 + ((-dx * sa + dy * ca) / ey) ** 2;
        if (e < .8 + .4 * vnoise(x * .09, y * .09, sd)) ter[j] = code;
      }
    }
  };
  blobs(def.ash, 2, 95); blobs(def.obsidian, GLASS, 96);
  yield;
  // the jump over the south stream: the lip a few px before the lava on the line; push: everybody who reaches the lip clears the stream
  const jumps = [];
  let lavaI = -1; for (let i = 0; i < N; i++) { const p = path[i]; if (ter[Math.round(p.y) * MW + Math.round(p.x)] === 15) { lavaI = i; break; } }
  if (lavaI >= 0) { const i = (lavaI - 5 + N) % N, p = path[i], tg = tan[i]; jumps.push({ x: p.x, y: p.y, tx: tg.x, ty: tg.y, lo: -HALF - 8, hi: HALF + 8, vz: def.jump.vz, push: def.jump.push }); }
  const pushes = (def.slopes || []).map(([x0, y0, x1, y1, f]) => ({ i0: nearestIdx(path, x0, y0), i1: nearestIdx(path, x1, y1), f }));
  // where the tube leaves the road and where it comes back: every point of the tube stands for a place in the lap (volcano.js progress)
  const forkI = nearestIdx(path, tubePts[0].x, tubePts[0].y), mergeI = nearestIdx(path, tubePts[tubePts.length - 1].x, tubePts[tubePts.length - 1].y), span = (mergeI - forkI + N) % N;
  const tubeIdx = tubePts.map((p, k) => (forkI + Math.round(span * k / (tubePts.length - 1))) % N);
  const at = ([x, y]) => nearestIdx(path, x, y);
  return { alt, lakeM, bridgeM, subM, laneM, tubeAt, tubePts, tubeIdx, forkI, mergeI, bayPts, bayI: at(B.lane[0]), jumps, pushes, lavaI,
    cloud: def.cloud.map(at), bombs: def.bombs.map(at), dike: [at([kx + krx + 20, ky]), at([kx - krx - 20, ky])], serp: def.serp.map(at) };
}

// painting, after the ground. S: { def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, shore, sd, th, r, RT }
export function* paintVolcano(S) {
  const { MW, MH, def, d, set, setT, path, nrm, N, ter, dist, walls, wallMask, sd, RT } = S, A = MW * MH;
  const { px, dk, solid } = paintTools(S);
  const { shade, height } = hillShade(def, MW, MH);
  const put = (j, c, s = 1) => { const o = j * 4; d[o] = clamp(c[0] * s, 0, 255); d[o + 1] = clamp(c[1] * s, 0, 255); d[o + 2] = clamp(c[2] * s, 0, 255); d[o + 3] = 255; };
  const lavaCol = (x, y, h) => {
    // glowing lava with small dark plates of crust drifting on it, brighter streaks where it runs fast
    const v = vnoise(x / 7, y / 7, sd + 60), pl = vnoise(x / 7 + 3, y / 7, sd + 61);
    return pl > .76 ? (pl > .81 ? K.crust : K.crustL) : v > .7 ? K.lava2 : v > .45 ? K.lava1 : h < .05 ? K.lavaD : K.lava;
  };

  yield;
  // how far every pixel is from lava (chamfer, up to 12 px): the glow along the lava, the gaps of the rim, the scenery keeps clear
  const ld = new Uint8Array(A);
  for (let j = 0; j < A; j++) ld[j] = ter[j] === 15 ? 0 : 36;
  for (let y = 1; y < MH; y++) { for (let x = 1; x < MW - 1; x++) { const j = y * MW + x; if (ld[j]) ld[j] = Math.min(ld[j], ld[j - 1] + 3, ld[j - MW] + 3, ld[j - MW - 1] + 4, ld[j - MW + 1] + 4); } if (y % 200 === 0) yield; }
  for (let y = MH - 2; y >= 0; y--) { for (let x = MW - 2; x >= 1; x--) { const j = y * MW + x; if (ld[j]) ld[j] = Math.min(ld[j], ld[j + 1] + 3, ld[j + MW] + 3, ld[j + MW + 1] + 4, ld[j + MW - 1] + 4); } if (y % 200 === 0) yield; }
  for (let j = 0; j < A; j++) ld[j] = Math.min(12, Math.round(ld[j] / 3));
  yield;

  // ----- the ground -----
  const [kx, ky] = def.crater, [sx, sy, srx, sry] = def.sub, lavaPix = [];
  for (let j = 0; j < A; j++) {
    if (j % 40000 === 39999) yield;
    const x = j % MW, y = j / MW | 0, t = ter[j], h = hash(x, y, sd + 40), v = vnoise(x / 6, y / 6, sd + 41) * .55 + h * .45;
    let c, s;
    if (RT.subM[j]) {
      // the cinder cone: red-black scoria, a little crater on top, the light on its slopes
      // (layers of scoria as rings round the top, rusty and lighter higher up)
      const es = Math.hypot((x - sx) / srx, (y - sy) / sry), ring = Math.abs(Math.sin(es * 30 + vnoise(x / 12, y / 12, sd + 47) * 3)) > .94;
      c = es < .17 ? K.cinD : es < .24 ? (v > .5 ? K.cinL : K.cin2) : ring ? K.cin1 : v < .3 ? K.cin1 : v > .72 ? K.cin2 : K.cin; if (h < .02) c = K.cinL;
      const up = es < .24 ? 0 : clamp((1 - es) * .55, 0, .4); c = [c[0] + (K.cinL[0] - c[0]) * up, c[1] + (K.cinL[1] - c[1]) * up, c[2] + (K.cinL[2] - c[2]) * up];
      s = shade(x, y);
    } else if (t === 0) {
      // black basalt: ropes of pahoehoe lava round the crater, red scoria and grey grit here and there; higher up the mountain it turns a warmer brown, and the
      // light on the slopes shows its shape
      const r = Math.hypot(x - kx, (y - ky) * 1.2), rope = Math.abs(Math.sin(r * .33 + vnoise(x / 16, y / 16, sd + 42) * 7)) > .94;
      c = rope ? K.rope : v < .3 ? K.gnd1 : v > .72 ? K.gnd2 : K.gnd;
      if (h < .012) c = K.speck; else if (h > .992) c = K.grey;
      if (RT.bridgeM[j]) c = K.basDD;
      const hv = clamp((height(x, y) - .28) / .5, 0, .7);
      if (hv > 0) c = [c[0] + (K.high[0] - c[0]) * hv, c[1] + (K.high[1] - c[1]) * hv, c[2] + (K.high[2] - c[2]) * hv];
      s = shade(x, y);
    } else if (t === GLASS) {
      // obsidian: a flat sheet of glass, smooth and glossy like ice (no rim, no shadow: you drive on it), long streaks of violet sheen, white glints
      const st = Math.sin((x * .8 - y * .55) * .12 + vnoise(x / 22, y / 22, sd + 44) * 4);
      c = st > .9 ? K.glL : st > .55 ? K.gl2 : v < .45 ? K.gl1 : K.gl; if (h < .008) c = K.glW;
      s = 1;
    } else if (t === 1 || t === TUBE) {
      if (RT.bridgeM[j]) { c = (x + y) % 9 === 0 || (x - y + 900) % 9 === 0 ? K.slabD : h < .1 ? K.slabL : K.slab; put(j, c); continue; } // (basalt slabs on the bridge)
      // red scoria: fine gravel with lighter and darker grains, two worn ruts, a pale kerb of ash along the edge so that the road stands out against the black;
      // on the dike through the lake the edge is dark crusted rock instead
      c = v < .33 ? K.rd1 : v > .7 ? K.rd2 : K.rd; if (h < .03) c = K.rdD; else if (h > .975) c = K.rdL;
      const lane = RT.alt[j] || RT.laneM[j], laneE = lane && [-3, 3, -3 * MW, 3 * MW].some(o => { const q = ter[j + o]; return q !== 1 && q !== TUBE && q !== 2; });
      if (RT.lakeM[j]) { if (ld[j] <= 2) c = h < .4 ? K.basDD : K.crust; else if (ld[j] <= 3 && h < .5) c = K.rdD; }
      else if ((!lane && dist[j] > HALF - 3) || laneE) c = (!lane && dist[j] > HALF - 1.2) ? K.kerbD : K.kerb;
      else if (!lane && Math.abs(dist[j] - 13) < 1.3 && h > .35) c = K.rut;
      s = .85 + .15 * shade(x, y);
    } else if (t === 2) {
      // ash: pale grey, rippled by the wind, a darker rim
      let e = false; for (const q of [j - 2, j + 2, j - 2 * MW, j + 2 * MW]) if (q >= 0 && q < A && ter[q] !== 2) e = true;
      c = e ? K.ashE : Math.sin(x * .7 + y * .4 + vnoise(x / 10, y / 10, sd + 43) * 6) > .6 ? K.ashL : v < .3 ? K.ash1 : v > .72 ? K.ash2 : K.ash;
      s = .9 + .1 * shade(x, y);
    } else if (t === 15) { c = lavaCol(x, y, h); if (h < .03) lavaPix.push(j); put(j, c); continue; }
    else continue;
    // the glow of the lava on everything close to it (it shows the danger from far away)
    const g = ld[j] <= 8 ? .6 * (1 - ld[j] / 9) ** 2 : 0;
    if (g > 0) { const o = j * 4; d[o] = clamp(c[0] * s * (1 - g) + 255 * g, 0, 255); d[o + 1] = clamp(c[1] * s * (1 - g) + 118 * g, 0, 255); d[o + 2] = clamp(c[2] * s * (1 - g) + 34 * g, 0, 255); d[o + 3] = 255; }
    else put(j, c, s);
  }
  yield;
  // a soft fringe of ash grains round every drift (it is blown there, it has no hard edge)
  for (const [ax, ay, ex, ey] of def.ash) {
    const R2 = Math.ceil(Math.max(ex, ey) * 1.3) + 8;
    for (let y = Math.max(5, ay - R2); y <= Math.min(MH - 6, ay + R2); y++) for (let x = Math.max(5, ax - R2); x <= Math.min(MW - 6, ax + R2); x++) {
      const j = y * MW + x; if (ter[j] !== 0 || RT.subM[j]) continue;
      let dd = 9; for (let q = -5; q <= 5 && dd > 1; q++) for (let p = -5; p <= 5; p++) if (ter[j + q * MW + p] === 2) dd = Math.min(dd, Math.hypot(p, q));
      if (dd < 6 && hash(x, y, sd + 49) < .75 * (1 - dd / 6)) set(j, dd < 2.5 ? K.ash1 : K.ashE);
    }
  }
  yield;
  startLine(S);

  yield;
  // ----- the crater rim: a ring of solid blue-grey basalt round the lake, open only where the road and the lava streams pass; a hard shadow outside to the south-east -----
  const [, , krx, kry] = def.crater, RIM = def.rim, rx2 = krx + RIM, ry2 = kry + RIM, rm = (rx2 + ry2) / 2;
  const rimOK = j => dist[j] >= HALF + 2 && ter[j] !== 15 && ld[j] > 2 && !RT.alt[j];
  for (let y = Math.max(0, ky - ry2 - 20); y < Math.min(MH, ky + ry2 + 20); y++) for (let x = Math.max(0, kx - rx2 - 20); x < Math.min(MW, kx + rx2 + 20); x++) {
    const j = y * MW + x, e = Math.hypot((x + .5 - kx) / rx2, (y + .5 - ky) / ry2), dr = (e - 1) * rm, w = 7 + (vnoise(x * .1, y * .1, sd + 44) - .5) * 3;
    if (!rimOK(j)) continue;
    if (Math.abs(dr) <= w) {
      const top = (x - kx) * -.5 + (y - ky) * -.7 < 0; // (the inner and the outer face: lit from the north-west)
      const h = hash(x, y, sd + 45);
      set(j, Math.abs(dr) > w - 1.2 ? K.basDD : h < .12 ? K.basL : (Math.floor((x + y) / 5) & 1) && Math.abs(dr) < 2.5 ? K.basT : dr < 0 === top ? K.bas : K.basD);
      wallMask[j] = 1;
    } else if (dr > w && dr < w + 8 && (x - kx) * .6 + (y - ky) > 0) dk(x, y, .62 + .04 * (dr - w));
  }
  for (let a = 0; a < Math.PI * 2; a += 6 / rm) {
    const x = kx + Math.cos(a) * rx2, y = ky + Math.sin(a) * ry2, j = Math.round(y) * MW + Math.round(x);
    if (x < 0 || y < 0 || x >= MW || y >= MH || dist[j] < HALF + 8 || ld[j] < 4 || RT.alt[j]) continue;
    walls.push({ x, y, r: 7 });
  }

  yield;
  // ----- levees: rows of solid blue-grey basalt columns between the serpentine legs and from the cinder cone to the rim; seen from above the columns are hexagons
  // with light tops, a long hard shadow to the south-east -----
  const column = (x, y, rr, edge) => {
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      const ax = Math.abs(dx), ay = Math.abs(dy); if (ax * .5 + ay * .87 > rr * .9 || ax > rr * .95) continue;
      const rim = ax * .5 + ay * .87 > rr * .9 - 1.3 || ax > rr * .95 - 1.3;
      setT(x + dx, y + dy, rim ? K.basDD : edge ? K.basD : dy < -1 && dx < 1 ? K.basL : dy > 1 ? K.basD : K.basT);
    }
  };
  const levee = (x0, y0, x1, y1, w) => {
    const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len, cols = [];
    for (let a = 0; a <= len; a += 6) {
      const x = x0 + ux * a, y = y0 + uy * a, j = Math.round(y) * MW + Math.round(x);
      if (x < 0 || y < 0 || x >= MW || y >= MH || dist[j] < HALF + w + 1 || ter[j] === 15 || RT.alt[j]) continue;
      walls.push({ x, y, r: w }); solid(x, y, w); cols.push([x, y]);
    }
    for (const [x, y] of cols) for (let dy = 0; dy <= w + 6; dy++) for (let dx = 0; dx <= w + 8; dx++) if (Math.hypot(dx - 4, dy - 4) < w + 3) dk(x + dx, y + dy, .7);
    cols.forEach(([x, y], k) => { column(Math.round(x + (hash(k, 1, sd) - .5) * 2), Math.round(y + (hash(k, 2, sd) - .5) * 2), w + 1 + (hash(k, 3, sd) * 2 | 0), false); });
  };
  for (const [x0, y0, x1, y1, w] of def.levees) levee(x0, y0, x1, y1, w);

  yield;
  // ----- the cinder cone: solid all round (circles on its outline, gaps for the tube), a shadow to the south-east -----
  {
    const tubeNear = (x, y) => { const q = RT.tubeAt.get(Math.round(y) * MW + Math.round(x)); return q && q[0] < def.tube.half + 9; };
    for (let j = 0; j < A; j++) if (RT.subM[j] && !(RT.tubeAt.get(j) && RT.tubeAt.get(j)[0] < def.tube.half + 4)) wallMask[j] = 1;
    for (let a = 0; a < Math.PI * 2; a += 6 / ((srx + sry) / 2)) {
      const x = sx + Math.cos(a) * (srx - 4), y = sy + Math.sin(a) * (sry - 4);
      if (!tubeNear(x, y)) walls.push({ x, y, r: 6 });
    }
    for (let y = sy - sry; y < sy + sry + 14; y++) for (let x = sx - srx; x < sx + srx + 14; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const j = y * MW + x; if (RT.subM[j] || ter[j] !== 0) continue;
      const e = Math.hypot((x - sx - 6) / srx, (y - sy - 8) / sry); if (e < 1) dk(x, y, .66);
    }
  }

  yield;
  // ----- the lava tube. The roof is a picture of the cone over the corridor (drawn over the cars while you are outside); under it the floor, a pale curb on both
  // sides, a lava rill on the right that lights the way, cat's eyes along the edges. light: how much the lava rill lights every pixel of the corridor -----
  let tube;
  {
    const TH = def.tube.half, P = RT.tubePts, nv = P.map((p, k) => { const q = P[Math.min(P.length - 1, k + 2)], o = P[Math.max(0, k - 2)], l = Math.hypot(q.x - o.x, q.y - o.y) || 1; return { x: -(q.y - o.y) / l, y: (q.x - o.x) / l }; });
    const inRoof = (j, dd) => dd < TH + 9 && RT.subM[j];
    let x0 = MW, y0 = MH, x1 = 0, y1 = 0;
    for (const [j, [dd]] of RT.tubeAt) if (inRoof(j, dd)) { const x = j % MW, y = j / MW | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const W = x1 - x0 + 1, H = y1 - y0 + 1, roof = mk(W, H), lit = mk(W, H), ri = roof.getContext('2d').createImageData(W, H), li = lit.getContext('2d').createImageData(W, H), mask = new Uint8Array(W * H);
    for (const [j, [dd, k]] of RT.tubeAt) {
      if (!inRoof(j, dd)) continue;
      const x = j % MW, y = j / MW | 0, q = ((y - y0) * W + x - x0) * 4, p = P[k], o = (x + .5 - p.x) * nv[k].x + (y + .5 - p.y) * nv[k].y;
      for (let c = 0; c < 3; c++) ri.data[q + c] = d[j * 4 + c]; ri.data[q + 3] = 255; mask[q >> 2] = 1;
      // the light of the rill (alpha = how bright), a little everywhere so that the walls show
      li.data[q + 3] = Math.round(255 * clamp(.1 + .9 * Math.max(0, 1 - Math.abs(o - (TH + 8)) / 32) ** 1.5, 0, 1));
      // the floor: rough pale rock with glowing cracks; the curb; the rill; the dark rock wall
      const h = hash(x, y, sd + 70), v = vnoise(x / 5, y / 5, sd + 71);
      let c;
      if (Math.abs(o) < TH - 2) { c = v < .3 ? K.tub1 : v > .7 ? K.tub2 : K.tub; if (Math.abs(vnoise(x / 9, y / 9, sd + 72) - .5) < .02) c = K.rdD; if (h < .02) c = K.curbD; }
      else if (Math.abs(o) < TH + 2) c = Math.abs(o) < TH ? K.curb : K.curbD;
      else if (o > TH + 4 && o < TH + 12) c = lavaCol(x, y, h);
      else c = o > TH + 2 && o <= TH + 4 ? K.curbD : v < .4 ? K.basDD : K.basD;
      set(j, c);
    }
    roof.getContext('2d').putImageData(ri, 0, 0); lit.getContext('2d').putImageData(li, 0, 0);
    // walls on both sides inside the cone (and a little beyond the portals); cat's eyes every 20 px
    const eyes = [];
    for (let k = 0; k < P.length; k += 3) {
      const p = P[k], inC = Math.hypot((p.x - sx) / srx, (p.y - sy) / sry) < 1.03;
      if (!inC) continue;
      for (const s of [-1, 1]) walls.push({ x: p.x + nv[k].x * s * (TH + 4), y: p.y + nv[k].y * s * (TH + 4), r: 4 });
      if (k % 10 === 0) for (const s of [-1, 1]) eyes.push({ x: Math.round(p.x + nv[k].x * s * (TH - 1)), y: Math.round(p.y + nv[k].y * s * (TH - 1)), s });
    }
    // the portals: a dark arch across the way in and out (top layer), the glow of the tube in the mouth
    const portals = [];
    for (const k of [P.findIndex(p => RT.subM[Math.round(p.y) * MW + Math.round(p.x)]), P.length - 1 - [...P].reverse().findIndex(p => RT.subM[Math.round(p.y) * MW + Math.round(p.x)])]) {
      if (k < 0 || k >= P.length) continue;
      const p = P[k];
      for (let a = -TH - 6; a <= TH + 6; a++) for (let b = -2; b <= 2; b++) {
        const q = P[Math.min(P.length - 1, Math.max(0, k + b))];
        setT(q.x + nv[k].x * a, q.y + nv[k].y * a, Math.abs(a) > TH + 3 ? K.basDD : b === 0 ? K.basL : K.basD);
      }
      portals.push({ x: p.x, y: p.y });
    }
    tube = { roof, lit, mask, x: x0, y: y0, W, H, eyes, portals, pts: P, idx: RT.tubeIdx, fork: RT.forkI, merge: RT.mergeI, half: TH, at: RT.tubeAt };
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
  // ----- hornitos in the lava field: little spatter cones on the road (solid), a glowing vent on top; the cars go round them -----
  const hornitos = [];
  for (const [hx, hy, hr] of def.hornitos) {
    walls.push({ x: hx, y: hy, r: hr }); solid(hx, hy, hr); hornitos.push({ x: hx, y: hy, r: hr + 4 });
    for (let dy = 0; dy <= hr + 6; dy++) for (let dx = 0; dx <= hr + 8; dx++) if (Math.hypot(dx - 3, dy - 3) < hr + 2) dk(hx + dx, hy + dy, .6);
    for (let dy = -hr - 2; dy <= hr + 2; dy++) for (let dx = -hr - 2; dx <= hr + 2; dx++) {
      const dd = Math.hypot(dx, dy) + (vnoise((hx + dx) * .5, (hy + dy) * .5, sd + 46) - .5) * 2; if (dd > hr + 1) continue;
      setT(hx + dx, hy + dy, dd < 2.2 ? K.lava2 : dd < 3.4 ? K.lavaD : dd > hr ? K.cinD : dx + dy < -2 ? K.cinL : dx + dy > 3 ? K.cin1 : K.cin2);
    }
  }

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
  // ----- the warning board at the fork: a post with a lamp (it blinks red while a glowing cloud rolls down, volcano.js) -----
  { const [fx, fy] = def.sign; walls.push({ x: fx, y: fy, r: 3 }); for (let k = 0; k < 16; k++) setT(fx, fy - k, K.basL); for (let yy = 0; yy < 10; yy++) for (let xx = -9; xx <= 9; xx++) setT(fx + xx, fy - 26 + yy, yy === 0 || yy === 9 || Math.abs(xx) === 9 ? K.blk : K.yel); }

  yield;
  // ----- scenery: basalt columns in groups at the edges of the map (solid), fumaroles with yellow sulphur (steaming), obsidian boulders, charred stumps -----
  const okOff = (x, y, m) => {
    for (let dy = -m; dy <= m; dy += 2) for (let dx = -m; dx <= m; dx += 2) {
      const X = x + dx, Y = y + dy; if (X < 2 || Y < 2 || X >= MW - 2 || Y >= MH - 2) return false;
      const j = Y * MW + X; if (ter[j] !== 0 || dist[j] < HALF + 10 || wallMask[j] || RT.alt[j] || RT.laneM[j] || RT.subM[j] || RT.lakeM[j] || ld[j] < 5 || RT.tubeAt.has(j)) return false;
    }
    return true;
  };
  for (let k = 0, tries = 0; k < 26 && tries < 4000; tries++) {
    const x = 6 + (S.r() * (MW - 12) | 0), y = 6 + (S.r() * (MH - 12) | 0), edge = x < 50 || y < 40 || x > MW - 60 || y > MH - 26;
    if (!edge || !okOff(x, y, 16)) continue;
    const n = 3 + (S.r() * 5 | 0);
    for (let q = 0; q < n; q++) {
      const a = S.r() * 6.28, rr = q ? 7 + S.r() * 6 : 0, X = Math.round(x + Math.cos(a) * rr), Y = Math.round(y + Math.sin(a) * rr);
      for (let dy = 0; dy < 10; dy++) for (let dx = 0; dx < 12; dx++) if (Math.hypot(dx - 4, dy - 4) < 7) dk(X + dx, Y + dy, .72);
      column(X, Y, 5, false); walls.push({ x: X, y: Y, r: 4 }); solid(X, Y, 5);
    }
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

  return { jumps: RT.jumps, pushes: RT.pushes, alt: RT.alt, tube, bay, station, vents, hornitos, lavaPix, crater: def.crater, fountains: def.fountains, sign: def.sign,
    cloud: RT.cloud, bombs: RT.bombs, jumpI: RT.lavaI, dike: RT.dike, serp: RT.serp, laneM: RT.laneM };
}
