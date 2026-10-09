import { HALF, WH, WW, angDiff, hash, hex, mk, vnoise } from './core.js';
import { nearestIdx } from './bau.js';

// ---------- Rennstrecke: kerbs, gravel traps, oil, the pit lane, barriers all around and the bridge where the road crosses itself ----------
// The circuit is an 8: the centre line crosses itself once. The first time you drive over the bridge, the second time underneath it.
// Terrain: 1 asphalt (kerbs and the pit lane are road too), 7 gravel, 8 oil (9 smeared oil is made during the race, see ring.js).

const K = Object.fromEntries(Object.entries({
  asp: '#55565b', asp1: '#4d4e53', asp2: '#5d5e63', aspL: '#6b6c71', aspD: '#414246', pitA: '#4b4c51', line: '#ecece6',
  kr: '#d83a2c', kw: '#f0f0ea', krD: '#8a2018', kE: '#36363a',
  gr: '#cdbf98', gr1: '#bdae86', gr2: '#dccfab', grD: '#978b6a', grL: '#efe7cf',
  oil: '#17171b', oil1: '#1e1e24', oilE: '#2d2d35', sh1: '#4b3f72', sh2: '#2e6872',
  steel: '#d7dce3', steelD: '#8b929c', post: '#4a4f57', tyre: '#161618', hole: '#2c2c30',
  par: '#d2d2ca', parL: '#ecece6', parD: '#5c5c5e', joint: '#2a2a2e', wall: '#e2e2dc', wallD: '#5a5a5e', wallS: '#9c9c98', yel: '#f2c230',
  roof: '#c9ccd2', roofD: '#9ea3ab', roofL: '#e4e7eb', door: '#2a2c31',
}).map(([k, v]) => [k, hex(v)]));
const TYRE = ['#f2f2ee', '#d83a2c', '#f2c230', '#2f6fd8'].map(hex);
const TEAM = ['#d83a2c', '#2f6fd8', '#3aa845', '#f2c230', '#8e44ad', '#f07a1a', '#2ec4b6', '#eef3f8'].map(hex);

// terrain, before the ground is painted. S: { def, ter, dist, near, path, tan, nrm, N, stampAt }
export function ringTerrain(S) {
  const { def, ter, dist, near, path, tan, nrm, N } = S, A = WW * WH;
  // curvature of the centre line (turn per pixel), and the strongest one nearby, so the kerbs run through the whole corner
  const ang = tan.map(t => Math.atan2(t.y, t.x)), cv = new Float32Array(N), kc = new Float32Array(N);
  for (let i = 0; i < N; i++) cv[i] = angDiff(ang[(i + 5) % N], ang[(i - 5 + N) % N]) / 20;
  for (let i = 0; i < N; i++) { let m = 0; for (let k = -10; k <= 10; k++) { const v = cv[(i + k + N) % N]; if (Math.abs(v) > Math.abs(m)) m = v; } kc[i] = m; }
  const off = j => { const i = near[j], p = path[i]; return (j % WW + .5 - p.x) * nrm[i].x + ((j / WW | 0) + .5 - p.y) * nrm[i].y; };

  // the crossing: two points of the centre line that meet although they are far apart along the lap. The first one is the bridge.
  let cross = null, bd = 1e9;
  for (let i = 0; i < N; i += 2) for (let k = i + (N >> 2); k < Math.min(N, i + N - (N >> 2)); k += 2) {
    const dd = (path[i].x - path[k].x) ** 2 + (path[i].y - path[k].y) ** 2; if (dd < bd) { bd = dd; cross = { i1: i, i2: k }; }
  }
  if (cross && bd < 64) {
    for (let i = cross.i1 - 3; i <= cross.i1 + 3; i++) for (let k = cross.i2 - 3; k <= cross.i2 + 3; k++) {
      const a = path[(i + N) % N], b = path[(k + N) % N], dd = (a.x - b.x) ** 2 + (a.y - b.y) ** 2; if (dd < bd) { bd = dd; cross.i1 = (i + N) % N; cross.i2 = (k + N) % N; }
    }
    cross.x = (path[cross.i1].x + path[cross.i2].x) / 2; cross.y = (path[cross.i1].y + path[cross.i2].y) / 2;
  } else cross = null;

  const kerb = new Uint8Array(A), pitMask = new Uint8Array(A), pitD = new Float32Array(A).fill(1e4), pitK = new Int32Array(A), hatch = new Uint8Array(A);
  // kerbs: on the inside of every corner, reaching a little beyond the edge of the road (that strip is road as well)
  for (let j = 0; j < A; j++) {
    if (dist[j] >= HALF + 5) continue;
    const k = kc[near[j]]; if (Math.abs(k) < .008) continue;
    if (off(j) * Math.sign(k) > HALF - 7) { kerb[j] = 1; if (ter[j] === 0) ter[j] = 1; }
  }
  // gravel traps on the outside of the corners: [x, y, radius]
  for (const [gx, gy, gr] of def.gravel || []) {
    for (let y = Math.max(0, gy - gr); y < Math.min(WH, gy + gr); y++) for (let x = Math.max(0, gx - gr); x < Math.min(WW, gx + gr); x++) {
      const j = y * WW + x;
      if (Math.hypot(x - gx, y - gy) > gr || ter[j] !== 0 || dist[j] < HALF + 1 || dist[j] > HALF + 25 + vnoise(x * .15, y * .15, 7) * 7) continue;
      const k = kc[near[j]]; if (Math.abs(k) > .004 && off(j) * Math.sign(k) > 0) continue;
      ter[j] = 7;
    }
  }
  // oil instead of mud
  (def.oilAt || []).forEach(m => S.stampAt(m, 8));
  // the pit lane: a narrow road of its own along the start straight. Its speed limit holds only outside the race track.
  let pit = null;
  if (def.pit) {
    // the lane: [x, y, curve radius] like the circuit itself, with smooth curves into and out of it
    const P = def.pit, pts = [], seg = (a, b) => { const m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)); for (let s = 0; s < m; s++) pts.push({ x: a[0] + (b[0] - a[0]) * s / m, y: a[1] + (b[1] - a[1]) * s / m }); };
    let cur = [P.pts[0][0], P.pts[0][1]];
    for (let k = 1; k < P.pts.length; k++) {
      const [x, y, r] = P.pts[k];
      if (k === P.pts.length - 1 || !r) { seg(cur, [x, y]); cur = [x, y]; continue; }
      const [qx, qy] = P.pts[k - 1], [nx, ny] = P.pts[k + 1], dp = Math.hypot(qx - x, qy - y), dn = Math.hypot(nx - x, ny - y), rp = Math.min(r, dp / 2), rn = Math.min(r, dn / 2);
      const A0 = [x + (qx - x) / dp * rp, y + (qy - y) / dp * rp], B0 = [x + (nx - x) / dn * rn, y + (ny - y) / dn * rn];
      seg(cur, A0);
      const m = Math.max(8, Math.ceil((rp + rn) * .6));
      for (let q = 0; q < m; q++) { const t = q / m, u = 1 - t; pts.push({ x: u * u * A0[0] + 2 * u * t * x + t * t * B0[0], y: u * u * A0[1] + 2 * u * t * y + t * t * B0[1] }); }
      cur = B0;
    }
    pts.push({ x: cur[0], y: cur[1] });
    const R = P.half + 14;
    pts.forEach((p, k) => {
      for (let y = Math.max(0, Math.floor(p.y - R)); y <= Math.min(WH - 1, p.y + R); y++) for (let x = Math.max(0, Math.floor(p.x - R)); x <= Math.min(WW - 1, p.x + R); x++) {
        const j = y * WW + x, dd = Math.hypot(x + .5 - p.x, y + .5 - p.y); if (dd < pitD[j]) { pitD[j] = dd; pitK[j] = k; }
      }
    });
    for (let j = 0; j < A; j++) if (pitD[j] < P.half) { if (dist[j] >= HALF) pitMask[j] = 1; if (ter[j] === 0 || ter[j] === 7) ter[j] = 1; }
    // where the pit lane forks off and where it comes back, the wedge between the two roads is asphalt with white hatching
    for (let j = 0; j < A; j++) if (ter[j] === 0 && dist[j] < HALF + 14 && pitD[j] < P.half + 14) { ter[j] = 1; hatch[j] = 1; }
    pit = { pts, half: P.half, ie: nearestIdx(path, pts[0].x, pts[0].y), box: P.box, wall: P.wall, garage: P.garage };
  }
  return { kc, cross, kerb, pitMask, pitD, pitK, pit, hatch };
}

// painting, after the ground: S: { def, d, set, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, sd, th, RT }
export function paintRing(S) {
  const { def, d, set, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, sd, th, RT } = S, A = WW * WH;
  const { kc, cross, kerb, pitD, pit } = RT, oilPix = [];
  const GR = th.grass.map(hex), GE = hex(th.grassEdge), TU = hex(th.tuft);
  const inPit = j => pit && pitD[j] < pit.half && dist[j] >= HALF - 1;
  const darken = (j, k) => { const i = j * 4; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; };

  // ----- the ground: asphalt with white edge lines, red and white kerbs, gravel, shiny oil, mown grass in stripes -----
  for (let j = 0; j < A; j++) {
    const x = j % WW, y = j / WW | 0, t = ter[j], h = hash(x, y, sd + 40), v = vnoise(x / 6, y / 6, sd + 41) * .55 + h * .45;
    let c;
    if (t === 8) {
      let e = false; for (const q of [j - 1, j + 1, j - WW, j + WW]) if (q >= 0 && q < A && ter[q] !== 8) e = true;
      c = e ? K.oilE : v < .5 ? K.oil : K.oil1;
      if (!e && h < .04) { c = h < .02 ? K.sh1 : K.sh2; oilPix.push(j); }
    } else if (t === 7) c = h < .06 ? K.grD : h > .96 ? K.grL : v < .36 ? K.gr1 : v > .68 ? K.gr2 : K.gr;
    else if (t === 1 || t === 4) {
      const i = near[j], p = path[i], k = kc[i], cin = ((x + .5 - p.x) * nrm[i].x + (y + .5 - p.y) * nrm[i].y) * Math.sign(k || 1);
      const lane = pit && pitD[j] < pit.half + .5;
      if (RT.hatch[j]) c = (x + y) % 7 < 2 ? K.line : v < .4 ? K.asp1 : K.asp; // the hatched wedge where the pit lane forks off and comes back
      else if (kerb[j] && !lane) c = cin > HALF + 3.6 ? K.krD : cin < HALF - 6 ? K.kE : (i >> 3) & 1 ? K.kr : K.kw;
      else if (inPit(j)) c = pitD[j] > pit.half - 3.2 && pitD[j] < pit.half - 1.4 ? K.line : h > .99 ? K.aspL : v < .4 ? K.asp1 : K.pitA;
      // where the pit lane runs over the race track (entry and exit): its edge is a solid white line, the edge line of the track stops there
      else if (lane) c = pitD[j] > pit.half - 1.8 && RT.pitK[j] > 0 && RT.pitK[j] < pit.pts.length - 1 ? K.line : v < .33 ? K.asp1 : v > .7 ? K.asp2 : K.asp;
      else if (dist[j] > HALF - 5 && dist[j] < HALF - 2.6) c = K.line;
      else c = h > .988 ? K.aspL : h < .01 ? K.aspD : v < .33 ? K.asp1 : v > .7 ? K.asp2 : K.asp;
    } else if (t === 0) {
      if (dist[j] < HALF + 2.5 && !kerb[j]) c = GE;
      else { c = (Math.floor((x + y * .5) / 24) & 1) ? GR[2] : GR[0]; if (v < .22) c = GR[1]; if (h < .012) c = TU; }
    } else continue;
    set(j, c);
  }

  // ----- start line (chequered) and the grid: a white bracket for every place, open towards the back -----
  S.band(0, 6, (x, y, a, c) => { if (Math.abs(c) < HALF - 2) set(y * WW + x, ((Math.floor(a + 6) >> 2) + (Math.floor(c + 100) >> 2)) & 1 ? K.kw : K.tyre); });
  for (let k = 0; k < 8; k++) {
    const i = (N - 12 - (k >> 1) * 22 + N) % N, side = k % 2 ? 13 : -13;
    S.band(i, 12, (x, y, a, c) => { const dc = c - side; if ((Math.abs(a - 10) < .8 && Math.abs(dc) < 9.2) || (a > 2 && a < 10.5 && Math.abs(Math.abs(dc) - 8.6) < .7)) set(y * WW + x, K.line); });
  }

  // ----- pit lane: the box (it washes the car), white lines where the speed limit starts and ends, the pit wall, the garages -----
  if (pit) {
    const across = (k, col) => {
      const a = pit.pts[Math.max(0, k - 1)], b = pit.pts[Math.min(pit.pts.length - 1, k + 1)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1, tx = (b.x - a.x) / l, ty = (b.y - a.y) / l, p = pit.pts[k];
      for (let q = -pit.half + 1; q < pit.half - 1; q += .5) for (const s of [0, 1]) { const X = Math.round(p.x - ty * q + tx * s), Y = Math.round(p.y + tx * q + ty * s); set(Y * WW + X, col); }
    };
    let k0 = pit.pts.findIndex(p => S.dist[Math.round(p.y) * WW + Math.round(p.x)] >= HALF + pit.half + 2), k1 = pit.pts.length - 1;
    while (k1 > 0 && S.dist[Math.round(pit.pts[k1].y) * WW + Math.round(pit.pts[k1].x)] < HALF + pit.half + 2) k1--;
    if (k0 > 0) across(k0, K.line); if (k1 > 0) across(k1, K.line);
    pit.k0 = k0; pit.k1 = k1;
    const [b0, b1] = pit.box;
    for (let j = 0; j < A; j++) {
      const y = j / WW | 0; if (y < b0 || y > b1 || !inPit(j) || pitD[j] > pit.half - 1) continue;
      washMask[j] = 1;
      if (y - b0 < 2 || b1 - y < 2 || pitD[j] > pit.half - 3) set(j, K.yel);
      else if ((y - b0) % 10 < 1) set(j, K.line);
    }
    // the pit wall between the start straight and the pit lane: concrete, solid
    const [wx, wy0, wy1] = pit.wall;
    for (let y = wy0; y <= wy1; y++) for (let dx = -2; dx <= 2; dx++) {
      const j = y * WW + wx + dx; wallMask[j] = 1;
      set(j, dx === -2 ? K.wallD : dx === 2 ? K.wallS : y === wy0 || y === wy1 ? K.wallS : (y >> 4) % 3 === 0 && dx === 0 ? hex('#d83a2c') : K.wall);
    }
    for (let y = wy0; y <= wy1; y += 6) walls.push({ x: wx + .5, y, r: 3 });
    // the garages: a long building with a door for every team
    if (pit.garage) {
      const [gx0, gy0, gx1, gy1] = pit.garage;
      for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1 + 6; x++) {
        const j = y * WW + x; if (x > gx1) { if (y > gy0 + 6) darken(j, .72); continue; }
        wallMask[j] = 1;
        const door = x - gx0 < 4, slot = (y - gy0) % 22, team = TEAM[((y - gy0) / 22 | 0) % TEAM.length];
        let c = (x - gx0) % 12 === 0 ? K.roofD : (y - gy0) % 22 === 0 ? K.roofD : K.roof;
        if (x === gx1 || y === gy0 || y === gy1) c = K.roofD; else if (x - gx0 < 6 && x - gx0 > 3) c = K.roofL;
        if (door && slot > 2 && slot < 20) c = x - gx0 < 1 ? team : K.door;
        set(j, c);
      }
    }
  }

  // ----- barriers: everything that is far enough from the road is closed off (armco, tyre walls at the gravel traps) -----
  // near the crossing the barrier comes close to the road, so nobody can turn from one road onto the other
  const bar = new Uint8Array(A), stackAt = (x, y) => (def.gravel || []).some(([gx, gy, gr]) => Math.hypot(x - gx, y - gy) < gr + 10) || (def.stacks || []).some(([sx, sy, sr]) => Math.hypot(x - sx, y - sy) < sr);
  for (let j = 0; j < A; j++) {
    if (ter[j] !== 0) continue;
    const x = j % WW, y = j / WW | 0;
    let L = HALF + 18;
    if (cross && Math.hypot(x - cross.x, y - cross.y) < 115) L = HALF + 7;
    if (pit && pit.wall && Math.abs(x - pit.wall[0]) < 10 && y >= pit.wall[1] - 3 && y <= pit.wall[2] + 3) continue; // the pit wall does that job
    for (const [gx, gy, gr] of def.gravel || []) if (Math.hypot(x - gx, y - gy) < gr + 8) L = HALF + 33;
    if (dist[j] >= L && (!pit || pitD[j] >= pit.half + 9)) bar[j] = 1;
  }
  const edge = new Uint8Array(A), grid = new Map(), key = (x, y) => (x >> 3) * 1000 + (y >> 3);
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const j = y * WW + x; if (!bar[j]) continue;
    if (!((x > 0 && !bar[j - 1]) || (x < WW - 1 && !bar[j + 1]) || (y > 0 && !bar[j - WW]) || (y < WH - 1 && !bar[j + WW]))) continue;
    edge[j] = 1;
    let close = false;
    for (let gy = (y >> 3) - 1; gy <= (y >> 3) + 1 && !close; gy++) for (let gx = (x >> 3) - 1; gx <= (x >> 3) + 1; gx++) {
      const l = grid.get(gx * 1000 + gy); if (l && l.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < 34)) { close = true; break; }
    }
    if (close) continue;
    const st = stackAt(x, y), w = { x: x + .5, y: y + .5, r: st ? 4 : 3.5, stack: st };
    walls.push(w); (grid.get(key(x, y)) || grid.set(key(x, y), []).get(key(x, y))).push(w);
  }
  // armco, clearly a wall: a dark outline towards the track, a bright steel rail, its shaded underside, a dark back, a shadow on the grass behind.
  // depth = how far a cell of the barrier lies behind its edge
  const depth = new Uint8Array(A).fill(9);
  for (let j = 0; j < A; j++) if (edge[j]) depth[j] = 0;
  for (let k = 1; k <= 6; k++) for (let j = 0; j < A; j++) {
    if (!bar[j] || depth[j] < 9) continue;
    for (const q of [j - 1, j + 1, j - WW, j + WW]) if (q >= 0 && q < A && depth[q] === k - 1) { depth[j] = k; break; }
  }
  const RAIL = [hex('#23262c'), K.steel, hex('#f6f8fb'), hex('#a3aab4'), hex('#4c525b')];
  for (let j = 0; j < A; j++) {
    if (!bar[j]) continue;
    const x = j % WW, y = j / WW | 0, dp = depth[j]; if (stackAt(x, y)) continue;
    if (dp < RAIL.length) set(j, RAIL[dp]); else if (dp < 8) darken(j, .62 + dp * .03);
  }
  let n = 0;
  for (const w of walls) {
    if (w.stack === undefined) continue;
    const X = Math.floor(w.x), Y = Math.floor(w.y);
    // the posts: dark blocks every few metres, reaching over the rail
    if (!w.stack) { if (n++ % 2 === 0) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = (Y + dy) * WW + X + dx; if (q >= 0 && q < A && bar[q] && depth[q] <= 4) set(q, dx + dy < 0 ? hex('#6b727c') : K.post); } continue; }
    // a stack of tyres, painted in turn white, red, yellow and blue
    const col = TYRE[(hash(X, Y, 5) * 4) | 0];
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const dd = Math.hypot(dx, dy); if (dd > 4.2 || X + dx < 0 || Y + dy < 0 || X + dx >= WW || Y + dy >= WH) continue;
      set((Y + dy) * WW + X + dx, dd < 1.3 ? K.hole : dd < 2.5 ? col : K.tyre);
    }
  }
  for (let j = 0; j < A; j++) if (bar[j] && dist[j] < HALF + 45) wallMask[j] = 1;

  // ----- outside the barriers: grandstands full of fans, the paddock with the team trucks, a helipad, a big screen, a flag mown into the grass -----
  const put = (x, y, c, solid = true) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= WW || y >= WH) return; const j = y * WW + x; set(j, c); if (solid) wallMask[j] = 1; };
  const rect = (x0, y0, w, h, c) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x0 + x, y0 + y, c); };
  const shade = (x0, y0, w, h, k = .66) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < WW && y < WH) darken(y * WW + x, k); };
  const SHIRT = ['#e84a5f', '#ffd23f', '#4d96ff', '#6bcb77', '#ffffff', '#ff9f43', '#b36bff', '#2b2b30'].map(hex), fans = [];
  const stand = (x0, y0, w, h, face) => {
    shade(x0 + 4, y0 + 5, w, h);
    const roofH = Math.round(h * .38);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const back = face > 0 ? y : h - 1 - y, X = x0 + x, Y = y0 + y;
      let c;
      if (back < roofH) c = back === 0 || x === 0 || x === w - 1 ? K.parD : ((x >> 3) & 1) ? K.kr : K.kw; // the roof over the back rows
      else if (back === h - 1) c = K.kw; // the railing in front
      else if ((back - roofH) % 3 === 0) c = K.parD;
      else { c = hex('#9a9ca2'); if (x % 2 === 0 && hash(X, Y, sd + 60) < .7) c = SHIRT[(hash(X, Y, sd + 61) * SHIRT.length) | 0]; }
      put(X, Y, c);
    }
    // waving fans with little flags in the front rows (drawn while racing, see ring.js)
    for (let x = 4; x < w - 4; x += 9) fans.push({ x: x0 + x, y: face > 0 ? y0 + h - 4 : y0 + 3, k: fans.length });
  };
  const truck = (x0, y0, col) => {
    shade(x0 + 3, y0 + 4, 12, 44, .66);
    rect(x0, y0, 12, 10, hex('#1b120c')); rect(x0 + 1, y0 + 1, 10, 8, col); rect(x0 + 2, y0 + 2, 8, 3, hex('#8fd3f4'));
    rect(x0, y0 + 11, 12, 33, hex('#1b120c')); rect(x0 + 1, y0 + 12, 10, 31, K.roofL); rect(x0 + 1, y0 + 12, 10, 2, col); rect(x0 + 5, y0 + 14, 2, 29, col);
  };
  const ring = (cx, cy, r, f) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const dd = Math.hypot(x, y); if (dd <= r) { const c = f(dd, x, y); if (c) put(cx + x, cy + y, c); } } };
  for (const [x, y, w, h, face] of def.stands || []) stand(x, y, w, h, face);
  for (const [x, y, k] of def.trucks || []) truck(x, y, TEAM[k % TEAM.length]);
  if (def.heli) {
    const [hx, hy] = def.heli;
    shade(hx - 17, hy - 15, 36, 36, .8);
    ring(hx, hy, 17, dd => dd > 16 ? K.parD : dd > 14 ? K.yel : hex('#7d8a80'));
    for (let k = -7; k <= 7; k++) { rect(hx - 6, hy + k, 2, 1, K.kw); rect(hx + 5, hy + k, 2, 1, K.kw); } rect(hx - 6, hy, 12, 2, K.kw);
  }
  let screen = null;
  if (def.screen) {
    const [sx, sy] = def.screen;
    shade(sx + 3, sy + 4, 44, 26, .62);
    rect(sx, sy, 44, 26, hex('#1b120c')); rect(sx + 2, sy + 2, 40, 22, hex('#20242c'));
    rect(sx + 8, sy + 26, 3, 6, hex('#5a5c62')); rect(sx + 33, sy + 26, 3, 6, hex('#5a5c62'));
    screen = { x: sx + 2, y: sy + 2, w: 40, h: 22 };
  }
  if (def.flag) {
    // a chequered flag mown into the grass, with its pole
    const [fx, fy, fw, fh] = def.flag, G1 = hex('#4f9a3c'), G2 = hex('#79c862');
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const wav = Math.round(Math.sin((x / fw) * Math.PI * 2) * 3), j = (fy + y + wav) * WW + fx + x;
      if (ter[j] !== 0) continue;
      set(j, ((((x / 8) | 0) + (((y) / 8) | 0)) & 1) ? G1 : G2);
    }
    for (let y = -4; y < fh + 14; y++) put(fx - 2, fy + y, hex('#e6e1d2'), false);
  }
  for (const [tx, ty] of def.towers || []) {
    // a camera tower: a square platform on legs, a camera man under a sunshade
    shade(tx + 4, ty + 6, 14, 14, .6);
    rect(tx, ty, 14, 14, hex('#1b120c')); rect(tx + 1, ty + 1, 12, 12, hex('#8d939d')); rect(tx + 1, ty + 1, 12, 2, hex('#c9ccd2'));
    ring(tx + 7, ty + 7, 4, dd => dd > 3 ? K.parD : K.yel);
  }

  // ----- the bridge: baked into the ground picture, and once more as a picture of its own that is drawn over the cars below it -----
  let deck = null;
  if (cross) {
    const p = path[cross.i1], tg = tan[cross.i1], nm = nrm[cross.i1], q2 = path[cross.i2], t2 = tan[cross.i2], n2 = nrm[cross.i2];
    const sn = Math.abs(tg.x * t2.y - tg.y * t2.x) || 1, L = HALF / sn + 9, W = 130, x0 = Math.round(p.x - W / 2), y0 = Math.round(p.y - W / 2);
    const cv = mk(W, W), g = cv.getContext('2d'), img = g.createImageData(W, W), q = img.data;
    // the side of the bridge that lies towards the bottom right gets the deep shadow (the light comes from the top left)
    const PW = 5, sh = (nm.x + nm.y) > 0 ? 1 : -1;
    for (let yy = 0; yy < W; yy++) for (let xx = 0; xx < W; xx++) {
      const X = x0 + xx + .5, Y = y0 + yy + .5, k = (yy * W + xx) * 4, j = (y0 + yy) * WW + x0 + xx;
      if (x0 + xx < 0 || y0 + yy < 0 || x0 + xx >= WW || y0 + yy >= WH) continue;
      const dx = X - p.x, dy = Y - p.y, a = dx * tg.x + dy * tg.y, cc = dx * nm.x + dy * nm.y, ac = Math.abs(cc);
      if (Math.abs(a) > L || ac > HALF + PW) {
        // the shadow of the bridge on the road below it
        if (Math.abs(a) <= L - 1 && ac > HALF + PW) {
          const o = ac - HALF - PW, deep = cc * sh > 0;
          if (o < (deep ? 9 : 3)) { const al = deep ? (o < 6 ? 120 : 70) : 60; q[k + 3] = al; darken(j, 1 - al / 255 * .9); }
        }
        continue;
      }
      const hh = hash(x0 + xx, y0 + yy, sd + 50), v = vnoise(X / 6, Y / 6, sd + 41) * .55 + hh * .45;
      let c;
      // the parapets: a dark outer face, a light top, a grey inner face; a seam every few pixels
      if (ac > HALF) c = ac > HALF + PW - 1 ? K.parD : ac < HALF + 1 ? K.wallS : (Math.round(a + 50) % 10 === 0 ? K.par : K.parL);
      else if (Math.abs(a) > L - 1.6) c = K.joint;
      else if (ac > HALF - 5 && ac < HALF - 2.6) c = K.line;
      else c = hh > .988 ? K.aspL : v < .33 ? K.asp1 : v > .7 ? K.asp2 : K.asp;
      q[k] = c[0]; q[k + 1] = c[1]; q[k + 2] = c[2]; q[k + 3] = 255;
      set(j, c);
    }
    g.putImageData(img, 0, 0);
    // railings: solid only for the cars up on the bridge; the walls under it: only for the cars below
    for (let a = -L - 14; a <= L + 14; a += 5) for (const s of [-1, 1]) walls.push({ x: p.x + tg.x * a + nm.x * s * (HALF + 2.5), y: p.y + tg.y * a + nm.y * s * (HALF + 2.5), r: 2.5, up: 1 });
    for (let a = -HALF - 18; a <= HALF + 18; a += 5) for (const s of [-1, 1]) walls.push({ x: q2.x + t2.x * a + n2.x * s * (HALF + 1.5), y: q2.y + t2.y * a + n2.y * s * (HALF + 1.5), r: 2.5, down: 1 });
    deck = { c: cv, x: x0, y: y0, ang1: Math.atan2(tg.y, tg.x), ang2: Math.atan2(t2.y, t2.x) };
  }

  return { deck, cross, kerb: RT.kerb, pitMask: RT.pitMask, pit, oilPix, bar, fans, screen };
}
