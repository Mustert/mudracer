import { HALF, TAU, hash, hex, mk, vnoise } from './core.js';
import { nearestIdx } from './bau.js';
import { stampLine } from './volcanomap.js';

// ---------- Weltall: the space station with the start, the glass tube, the platforms in zero gravity round the satellite, the ringed planet (the
// short way on its ring), the asteroid belt with the wormhole, the moon with its dusty crater, the airlock ----------
// Terrain: 0 nothing (space: a car that gets there drifts off, see space.js), 1 floor with gravity (station deck, glass tube, the road over the moon),
// 17 metal platform in zero gravity (little grip, see physics.js), 2 moon dust (like mud, it makes the car silver), 13 the ground of the moon
// (slow like grass, it stays clean), 4 boost pad.

const K = Object.fromEntries(Object.entries({
  sp0: '#05061a', sp1: '#090a24', sp2: '#100e32', nebB: '#122a5a', nebB2: '#1a3a74', nebP: '#2a1450', nebP2: '#3c1c66',
  pl: '#3c465a', pl1: '#363f52', pl2: '#434e63', plD: '#1a202c', seam: '#2a3242', rivet: '#8a96ac', glow: '#5fe8ff', glowM: '#2fb4d4', glowD: '#1a5a72',
  hz: '#ffd23f', hzD: '#26262c',
  deck: '#5a6273', deck1: '#525a6a', deck2: '#646d7e', deckS: '#454c5a', lane: '#3e4552', lane1: '#383f4b', mark: '#e8eef4',
  tube: '#56607a', tube1: '#4e5870', tube2: '#606a84', groove: '#3e465a',
  moon: '#72747c', moon1: '#676970', moon2: '#7e8088', moonD: '#4c4e56', moonL: '#9c9ea6', moonE: '#3a3c43',
  road: '#aeb0b6', road1: '#a4a6ac', road2: '#b8bac0', roadE: '#55575f', rut: '#989aa1',
  dust: '#d2d5dc', dust1: '#c4c7cf', dust2: '#e2e4ea', dustE: '#a4a7b0', pdust: '#9599a3', pdust1: '#868a94',
  ring: '#d8c8a0', ring1: '#c8b48a', ring2: '#e8dcbc', ringD: '#7a6a4a',
  pa: '#c88a4a', pb: '#e0b070', pc: '#a8683a', pd: '#f0d0a0',
  ocean: '#1f5fb8', ocean1: '#2a74d0', land: '#3a9a4a', land1: '#8a7a3a', cloud: '#f2f6fa', atmo: '#7ab8f0',
  rock: '#7a7268', rock1: '#625a52', rock2: '#958c80', rockD: '#3e3832',
  hull: '#c8ced8', hull1: '#a8b0bc', hullD: '#6a7280', win: '#7fd8ff', win1: '#ffe9a8', solar: '#24407a', solar1: '#3a62b0', solarL: '#8ab0ff',
}).map(([k, v]) => [k, hex(v)]));

const smooth = f => f * f * (3 - 2 * f);

// the way from the road onto the ring of the planet (or back): points from angle a0 at radius r0 to angle a1 at radius r1 (degrees)
function curve(P, a0, r0, a1, r1) {
  const out = [];
  for (let k = 0; k <= 24; k++) { const f = k / 24, a = (a0 + (a1 - a0) * f) * Math.PI / 180, rr = r0 + (r1 - r0) * smooth(f); out.push([P[0] + Math.cos(a) * rr, P[1] + Math.sin(a) * rr, 0]); }
  return out;
}

// terrain, before the ground is painted. S: { MW, MH, def, ter, dist, near, path, tan, nrm, N }
export function* spaceTerrain(S) {
  const { MW, MH, def, ter, dist, near, path, tan, nrm, N } = S, A = MW * MH;
  // kind: 1 the station deck, 2 the glass tube, 3 the moon, 4 the ring of the planet, 5 a way onto the ring
  const alt = new Uint8Array(A), kind = new Uint8Array(A), conn = new Uint8Array(A), narrowM = new Uint8Array(A);
  const off = j => { const i = near[j], p = path[i]; return (j % MW + .5 - p.x) * nrm[i].x + ((j / MW | 0) + .5 - p.y) * nrm[i].y; };
  const [sx0, sy0, sx1, sy1] = def.station, [mx, my, mr] = def.moon;
  const onMoon = (x, y) => Math.hypot(x + .5 - mx, y + .5 - my) < mr + (vnoise(x * .05, y * .05, 121) - .5) * 14;
  const t0 = nearestIdx(path, def.tube[0][0], def.tube[0][1]), t1 = nearestIdx(path, def.tube[1][0], def.tube[1][1]);
  const inTube = i => t0 <= t1 ? i >= t0 && i <= t1 : i >= t0 || i <= t1;
  yield;
  for (let j = 0; j < A; j++) {
    if (j % 40000 === 39999) yield;
    const x = j % MW, y = j / MW | 0, t = ter[j], road = dist[j] < HALF;
    if (x >= sx0 && x <= sx1 && y >= sy0 && y <= sy1) { kind[j] = 1; if (t === 0 || t === 2) ter[j] = 1; continue; }
    if (onMoon(x, y)) { kind[j] = 3; if (t === 0) ter[j] = 13; continue; }
    if (!road) { if (t === 2) ter[j] = 0; continue; } // dust only lies on the road (or on the moon), never in the void
    if (inTube(near[j])) { kind[j] = 2; if (t === 2) ter[j] = 1; continue; }
    if (t === 1) ter[j] = 17;
  }
  yield;
  // dusty craters on the moon: their bowls are full of moon dust (also where the road runs over one)
  for (const [cx, cy, cr, dusty] of def.craters || []) {
    if (!dusty) continue;
    for (let y = Math.floor(cy - cr); y <= cy + cr; y++) for (let x = Math.floor(cx - cr); x <= cx + cr; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const j = y * MW + x; if (kind[j] !== 3 || ter[j] === 4) continue;
      if (Math.hypot(x + .5 - cx, y + .5 - cy) < cr * .78 + (vnoise(x * .2, y * .2, 122) - .5) * 4) ter[j] = 2;
    }
  }
  yield;
  // narrow bridges between two platforms: the sides of the road are open space there
  for (const [bx, by, hl, hw] of def.narrow || []) {
    const bi = nearestIdx(path, bx, by), tg = tan[bi], R = HALF + hl + 2, p = path[bi];
    for (let y = Math.floor(p.y - R); y <= p.y + R; y++) for (let x = Math.floor(p.x - R); x <= p.x + R; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const j = y * MW + x; if (dist[j] >= HALF || (ter[j] !== 17 && ter[j] !== 2)) continue;
      if (Math.abs((x + .5 - p.x) * tg.x + (y + .5 - p.y) * tg.y) < hl) { if (Math.abs(off(j)) > hw) ter[j] = 0; else narrowM[j] = 1; }
    }
  }
  yield;
  // round pads that widen a bend on its inside (where the platforms meet)
  for (const [cx, cy, cr] of def.pads || []) for (let y = cy - cr; y <= cy + cr; y++) for (let x = cx - cr; x <= cx + cr; x++) { const j = y * MW + x; if (Math.hypot(x + .5 - cx, y + .5 - cy) < cr && ter[j] === 0) ter[j] = 17; }
  // the ring of the planet: a lane all round it; two narrow ways lead from the road onto it and back
  const [px, py] = def.planet, R = def.orbit, [l0, l1] = R.lane, mid = (l0 + l1) / 2, rr = Math.round(def.planet[4]) + 2;
  for (let y = py - rr; y <= py + rr; y++) for (let x = px - rr; x <= px + rr; x++) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    const j = y * MW + x, d = Math.hypot(x + .5 - px, y + .5 - py);
    if (d >= l0 && d <= l1 && ter[j] === 0) { ter[j] = 17; kind[j] = 4; alt[j] = 1; }
  }
  const roadR = Math.hypot(path[nearestIdx(path, px, py - 200)].x - px, path[nearestIdx(path, px, py - 200)].y - py);
  const wayIn = curve(def.planet, R.out[0], roadR, R.on[0], mid), wayOut = curve(def.planet, R.on[1], mid, R.out[1], roadR);
  for (const k of [1, 2]) stampLine(k === 1 ? wayIn : wayOut, R.half, j => { if (ter[j] === 0 || kind[j] === 4) { if (ter[j] === 0) { ter[j] = 17; kind[j] = 5; } conn[j] = k; alt[j] = 1; } }, MW, MH);
  // the little round platform of the wormhole beside the road
  const [qx, qy, qr] = def.portals.a;
  for (let y = qy - qr - 1; y <= qy + qr + 1; y++) for (let x = qx - qr - 1; x <= qx + qr + 1; x++) { const j = y * MW + x; if (Math.hypot(x + .5 - qx, y + .5 - qy) < qr && ter[j] === 0) { ter[j] = 17; kind[j] = 6; alt[j] = 1; } }
  // the way the computer cars take over the ring: onto it, along it, back to the road
  const ringPts = [];
  for (const [x, y] of wayIn) ringPts.push({ x, y });
  for (let a = R.on[0] + 2; a < R.on[1]; a += 1.5) ringPts.push({ x: px + Math.cos(a * Math.PI / 180) * mid, y: py + Math.sin(a * Math.PI / 180) * mid });
  for (const [x, y] of wayOut) ringPts.push({ x, y });
  yield;
  return { alt, kind, conn, narrowM, t0, t1, ringPts, ringI: nearestIdx(path, wayIn[0][0], wayIn[0][1]), ringEndI: nearestIdx(path, wayOut[24][0], wayOut[24][1]), roadR, mid, N };
}

// painting, after the ground. S: { MW, MH, def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, sd, r, starPix, RT }
export function* paintSpace(S) {
  const { MW, MH, def, d, set, setT, path, tan, nrm, N, ter, dist, near, walls, wallMask, washMask, sd, starPix, RT } = S, A = MW * MH, kind = RT.kind;
  const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < MW && y < MH) set(y * MW + x, c); };
  const dk = (x, y, k) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= MW || y >= MH) return; const i = (y * MW + x) * 4; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; };
  const solid = (x, y, rr) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X >= 0 && Y >= 0 && X < MW && Y < MH) wallMask[Y * MW + X] = 1; } };
  const off = j => { const i = near[j], p = path[i]; return (j % MW + .5 - p.x) * nrm[i].x + ((j / MW | 0) + .5 - p.y) * nrm[i].y; };
  // how far (1..3) a pixel is from the void, 4 = further
  const toVoid = (x, y) => {
    for (let q = 1; q <= 3; q++) for (let dy = -q; dy <= q; dy++) for (let dx = -q; dx <= q; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== q) continue;
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= MW || Y >= MH) continue;
      if (ter[Y * MW + X] === 0 && !kind[Y * MW + X]) return q;
    }
    return 4;
  };
  const [plx, ply, plr, r0, r1] = def.planet, [ex, ey, er] = def.earth, [mx, my, mr] = def.moon, [sx0, sy0, sx1, sy1] = def.station;
  starPix.length = 0;
  const glowPix = [], edgePix = [];

  yield;
  // ----- the ground -----
  for (let j = 0; j < A; j++) {
    if (j % 30000 === 29999) yield;
    const x = j % MW, y = j / MW | 0, t = ter[j], kd = kind[j], h = hash(x, y, sd + 60);
    if (t === 4) continue; // the boost pads are painted already
    let c;
    if (t === 0 && !kd) {
      const dp = Math.hypot(x + .5 - plx, y + .5 - ply), de = Math.hypot(x + .5 - ex, y + .5 - ey);
      if (dp < plr) {
        // the ringed planet: warm bands, lit from the top left
        const band = Math.floor((y - ply + (vnoise(x / 26, y / 7, sd + 61) - .5) * 9 + 200) / 9) % 4, sh = ((x - plx) + (y - ply)) / plr;
        c = [K.pa, K.pb, K.pc, K.pd][band].map(v => Math.min(255, v * (1.12 - .45 * Math.max(0, sh + .2))) | 0);
        if (dp > plr - 1.5) c = c.map(v => v * .55 | 0);
      } else if (dp < r1 && dp > r0) c = (Math.floor(dp / 3) % 2 ? K.ring1 : K.ringD).map(v => v * .8 | 0); // the thin rims of the ring beside the lane
      else if (de < er) {
        // the Earth at the corner of the map: oceans, land, clouds, the night side darker
        const v = vnoise(x / 22, y / 22, sd + 62), cl = vnoise(x / 14 + 9, y / 9, sd + 63), sh = ((x - ex) + (y - ey)) / er;
        c = cl > .64 ? K.cloud : v > .58 ? (v > .7 ? K.land1 : K.land) : v > .5 ? K.ocean1 : K.ocean;
        c = c.map(q => Math.min(255, q * (1.1 - .5 * Math.max(0, sh + .3))) | 0);
      } else if (de < er + 4) c = K.atmo.map(q => q * (1 - (de - er) / 5) | 0);
      else {
        // deep space: dark blue, clouds of a nebula in blue and purple, stars
        const v = vnoise(x / 80, y / 80, sd + 64) * .65 + vnoise(x / 24, y / 24, sd + 65) * .35, p = vnoise(x / 60 + 40, y / 60, sd + 66);
        c = v > .7 ? (p > .5 ? K.nebP2 : K.nebB2) : v > .6 ? (p > .5 ? K.nebP : K.nebB) : v > .48 ? K.sp2 : v > .36 ? K.sp1 : K.sp0;
        if (h < .0016) { c = [255, 255, 255]; starPix.push(j); } else if (h < .0036) c = [255, 233, 168]; else if (h < .0056) c = [159, 214, 255]; else if (h < .009) c = [70, 74, 110];
      }
    } else if (kd === 1) {
      // the station deck: tiles, hazard stripes at the edge; the road over it is a dark lane with a dashed line
      const e = Math.min(x - sx0, sx1 - x, y - sy0, sy1 - y);
      if (dist[j] < HALF) {
        c = (x + y) % 3 ? K.lane : K.lane1;
        if (dist[j] > HALF - 2) c = K.mark; else if (Math.abs(off(j)) < 1 && near[j] % 10 < 5) c = K.hz;
      } else if (e < 4) c = ((x + y) >> 2) & 1 ? K.hz : K.hzD;
      else { c = (x % 12 === 0 || y % 12 === 0) ? K.deckS : vnoise(x / 9, y / 9, sd + 67) > .55 ? K.deck2 : h < .5 ? K.deck : K.deck1; if (x % 12 === 2 && y % 12 === 2) c = K.rivet; }
    } else if (kd === 3 || t === 13) {
      // the moon: grey dust and stone; the road over it is pressed flat and lighter, dust lies in the craters
      const v = vnoise(x / 7, y / 7, sd + 68) * .6 + h * .4, dm = Math.hypot(x + .5 - mx, y + .5 - my);
      if (t === 2) { const e = toVoid(x, y); c = v < .4 ? K.dust1 : v > .7 ? K.dust2 : K.dust; if (e < 2) c = K.dustE; }
      else if (t === 1) { c = v < .35 ? K.road1 : v > .7 ? K.road2 : K.road; if (dist[j] > HALF - 2.5) c = K.roadE; else if (Math.abs(Math.abs(off(j)) - 11) < 1.6 && h < .75) c = K.rut; else if (h < .01) c = K.moonD; }
      else { c = v < .35 ? K.moon1 : v > .7 ? K.moon2 : K.moon; if (h < .012) c = K.moonD; else if (h > .992) c = K.moonL; if (dm > mr - 4) c = K.moonE; }
    } else if (kd === 4) {
      // the ring lane: icy rock in thin bands, it glitters
      const dp = Math.hypot(x + .5 - plx, y + .5 - ply), b = Math.floor(dp / 2.5) % 3;
      c = [K.ring, K.ring1, K.ring2][b]; if (h < .03) c = [255, 255, 255]; if (dp < RT.mid - 16 || dp > RT.mid + 16) c = K.ringD;
      if (h < .02) glowPix.push(j);
    } else if (t === 2) {
      // moon dust blown onto a platform from the asteroid next to it: grey, grainy, its edge frays into the metal
      const v = vnoise(x / 4, y / 4, sd + 69) * .5 + h * .5, edge = ter[j - 1] !== 2 || ter[j + 1] !== 2 || ter[j - MW] !== 2 || ter[j + MW] !== 2;
      c = edge ? (h < .5 ? K.pl1 : K.pdust1) : v < .45 ? K.pdust1 : v > .75 ? K.dust1 : K.pdust;
      const e = toVoid(x, y); if (e === 1) c = K.plD; else if (e === 2) c = K.glow; else if (e === 3) c = K.glowM;
    } else if (kd === 2 || t === 1) {
      // the floor of the glass tube: grooves along the way
      const o = Math.abs(off(j)); c = Math.round(o) % 6 === 0 ? K.groove : vnoise(x / 8, y / 8, sd + 70) > .6 ? K.tube2 : h < .5 ? K.tube : K.tube1;
      if (dist[j] > HALF - 2) c = K.hullD;
    } else if (t === 17) {
      // metal plates with seams and rivets, a glowing strip along every edge to space
      const i = near[j], o = off(j), e = toVoid(x, y);
      c = vnoise(x / 10, y / 10, sd + 71) > .62 ? K.pl2 : h < .5 ? K.pl : K.pl1;
      const way = kd === 5 || kd === 6 || RT.conn[j], bridge = RT.narrowM[j];
      if (bridge) c = ((x + y) % 4 === 0 || (x - y + 1000) % 4 === 0) ? K.seam : K.pl1; // a narrow bridge: a grating
      else if (kd !== 5 && kd !== 6) { if (i % 14 === 0 || Math.abs(Math.abs(o) - 12) < .6) c = K.seam; else if ((i % 14 === 4 || i % 14 === 10) && Math.abs(Math.abs(o) - 7) < .8) c = K.rivet; }
      else if ((x + y) % 7 === 0) c = K.seam;
      // the edges: cyan along the road; yellow and black at the narrow bridges and on the ways onto the ring (take care, a choice)
      if (e === 1) c = K.plD; else if ((way || bridge) && e <= 3) c = ((x + y) >> 2) & 1 ? K.hz : K.hzD; else if (e === 2) { c = K.glow; if (hash(i, 1, sd) < .5) glowPix.push(j); } else if (e === 3) c = K.glowM;
      if (e <= 3 && kd !== 4 && hash(x >> 2, y >> 2, sd + 72) < .08) edgePix.push(j);
    } else continue;
    set(j, c);
  }

  yield;
  // small craters on the moon (only a picture): a rim lit from the top left, a darker bowl
  for (const [cx, cy, cr, dusty] of def.craters || []) for (let y = Math.floor(cy - cr - 3); y <= cy + cr + 3; y++) for (let x = Math.floor(cx - cr - 3); x <= cx + cr + 3; x++) {
    if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    const j = y * MW + x; if (kind[j] !== 3 || dist[j] < HALF) continue;
    const dd = Math.hypot(x + .5 - cx, y + .5 - cy) / cr, sh = ((x - cx) + (y - cy)) / cr;
    if (dd > 1.12) continue;
    if (dd > .86) set(j, sh < 0 ? K.moonL : K.moonD);
    else if (!dusty || ter[j] !== 2) set(j, sh < 0 ? K.moonD : K.moon1);
    else if (sh < -.5) set(j, K.dust1);
  }
  for (let k = 0, tries = 0; k < 40 && tries < 900; tries++) {
    const x = S.r() * MW | 0, y = S.r() * MH | 0, j = y * MW + x, cr = 2 + (S.r() * 4 | 0);
    if (ter[j] !== 13 || dist[j] < HALF + cr + 3) continue;
    for (let dy = -cr - 1; dy <= cr + 1; dy++) for (let dx = -cr - 1; dx <= cr + 1; dx++) { const dd = Math.hypot(dx, dy); if (dd > cr + 1) continue; const q = (y + dy) * MW + x + dx; if (ter[q] !== 13) continue; set(q, dd > cr - .5 ? (dx + dy < 0 ? K.moonD : K.moonL) : K.moon1); }
    k++;
  }
  // the start line (chequered)
  S.band(0, 6, (x, y, a, c) => { if (Math.abs(c) < HALF) set(y * MW + x, ((Math.floor(a + 6) >> 2) + (Math.floor(c + 100) >> 2)) & 1 ? [245, 245, 240] : [34, 30, 28]); });

  yield;
  // ----- small asteroids drifting in space (only a picture) and the big ones of the belt (solid) -----
  const lump = (X, Y, rr, top, sd2) => {
    const cr = [[hash(X, 1, sd2) * rr - rr / 2, hash(X, 2, sd2) * rr - rr / 2, rr * .3], [hash(Y, 3, sd2) * rr - rr / 2, hash(Y, 4, sd2) * rr - rr / 2, rr * .2]];
    for (let dy = -rr - 3; dy <= rr + 3; dy++) for (let dx = -rr - 3; dx <= rr + 3; dx++) {
      const dd = Math.hypot(dx, dy) + (vnoise((X + dx) * 3 / rr, (Y + dy) * 3 / rr, sd2) - .5) * Math.min(rr * .5, 6); if (dd > rr) continue;
      const sh = (dx + dy) / rr; let c = sh < -.45 ? K.rock2 : sh > .4 ? K.rock1 : K.rock;
      for (const q of cr) if (Math.hypot(dx - q[0], dy - q[1]) < q[2]) c = sh < 0 ? K.rock1 : K.rockD;
      if (dd > rr - 1.2) c = K.rockD;
      if (top) setT(X + dx, Y + dy, c); else px(X + dx, Y + dy, c);
    }
  };
  for (let k = 0, tries = 0; k < 46 && tries < 3000; tries++) {
    const x = 8 + (S.r() * (MW - 16) | 0), y = 8 + (S.r() * (MH - 16) | 0), j = y * MW + x, rr = 2 + (S.r() * 5 | 0);
    if (ter[j] !== 0 || kind[j] || dist[j] < HALF + 12 + rr || Math.hypot(x - plx, y - ply) < r1 + 12 || Math.hypot(x - ex, y - ey) < er + 10) continue;
    // most of them in the belt (the lower right), some everywhere
    if (k > 12 && !(y > 470 && x > 560)) continue;
    lump(x, y, rr, false, sd + 73 + k); k++;
  }
  for (const [x, y, rr] of def.rocks || []) {
    lump(x, y, rr, true, sd + 90 + x);
    for (let a = 0; a < TAU; a += .5) walls.push({ x: x + Math.cos(a) * rr * .55, y: y + Math.sin(a) * rr * .55, r: rr * .5 });
    solid(x, y, rr + 4);
    // where an asteroid lies at the edge of a platform it casts a shadow onto it
    for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const X = x + dx + 5, Y = y + dy + 6, q = Y * MW + X; if (dx * dx + dy * dy <= rr * rr && X >= 0 && Y >= 0 && X < MW && Y < MH && ter[q] !== 0) dk(X, Y, .72); }
  }

  yield;
  // ----- the station: modules on the deck (solid), a railing round the deck, the airlock at the moon end, the turning ring beside it -----
  const box = (x, y, w, h, roof, roof2) => {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const e = Math.min(xx, yy, w - 1 - xx, h - 1 - yy);
      setT(x + xx, y + yy, e === 0 ? K.hullD : e === 1 ? (xx < w / 2 && yy < h / 2 ? K.hull : K.hull1) : (Math.floor(yy / 4) % 2 ? roof : roof2));
    }
    for (let q = 3; q < w - 3; q += 5) setT(x + q, y + 2, K.win);
    for (let yy = 0; yy <= h; yy += 6) for (const xx of [0, w]) { walls.push({ x: x + xx, y: y + yy, r: 4 }); }
    for (let xx = 0; xx <= w; xx += 6) for (const yy of [0, h]) walls.push({ x: x + xx, y: y + yy, r: 4 });
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) { const X = x + dx + 3, Y = y + dy + 4; if (X < MW && Y < MH) dk(X, Y, .78); }
    solid(x + w / 2, y + h / 2, Math.max(w, h) / 2 + 4);
  };
  for (const [x, y, w, h] of [[58, 236, 34, 54], [58, 318, 34, 92], [58, 446, 34, 74], [178, 240, 38, 46], [178, 380, 38, 128]]) box(x, y, w, h, K.hull1, K.hull);
  // the control tower with its big window, the robot arm, an antenna
  const ctl = [178, 306, 38, 52]; box(ctl[0], ctl[1], ctl[2], ctl[3], K.hullD, K.hull1);
  for (let yy = 4; yy < 14; yy++) for (let xx = 4; xx < ctl[2] - 4; xx++) setT(ctl[0] + xx, ctl[1] + yy, yy < 6 ? K.win1 : K.win);
  for (let k = 0; k < 26; k++) { setT(78 + k * .9, 300 - k * .4, K.hz); setT(79 + k * .9, 300 - k * .4, K.hzD); }
  for (const [x, y] of [[100, 286], [102, 287]]) setT(x, y, K.hz);
  // the railing round the deck: solid wherever the road does not go through
  for (let x = sx0; x <= sx1; x += 5) for (const y of [sy0, sy1]) if (dist[y * MW + x] > HALF + 3) { walls.push({ x, y, r: 3 }); setT(x, y, K.hz); setT(x + 1, y, K.hzD); }
  for (let y = sy0; y <= sy1; y += 5) for (const x of [sx0, sx1]) if (dist[y * MW + x] > HALF + 3) { walls.push({ x, y, r: 3 }); setT(x, y, K.hz); setT(x, y + 1, K.hzD); }
  // the airlock: a gate over the road (the beam is above the cars), nozzles in the floor; it blows the dust off (it washes)
  const [ax, ay] = def.airlock, ai = nearestIdx(path, ax, ay), atg = tan[ai], anm = nrm[ai];
  for (let y = ay - 20; y <= ay + 20; y++) for (let x = ax - HALF - 12; x <= ax + HALF + 12; x++) {
    const j = y * MW + x, a = (x + .5 - path[ai].x) * atg.x + (y + .5 - path[ai].y) * atg.y, o = (x + .5 - path[ai].x) * anm.x + (y + .5 - path[ai].y) * anm.y, ao = Math.abs(o);
    if (Math.abs(a) < 12 && ao < HALF) { washMask[j] = 1; set(j, (Math.floor(a + 20) % 5 === 0 || Math.floor(o + 40) % 5 === 0) ? K.deckS : (x + y) % 2 ? K.deck2 : K.deck); }
    if (Math.abs(a) < 3 && ao < HALF + 8) setT(x, y, ao > HALF + 5 ? K.hullD : ((Math.floor(o + 40) >> 2) & 1) ? K.hz : K.hzD);
    if (ao >= HALF + 2 && ao < HALF + 10 && Math.abs(a) < 10) { setT(x, y, ao > HALF + 8 || Math.abs(a) > 8 ? K.hullD : K.hull1); wallMask[j] = 1; }
  }
  for (const s of [-1, 1]) for (let q = -8; q <= 8; q += 4) walls.push({ x: ax + anm.x * s * (HALF + 6) + atg.x * q, y: ay + anm.y * s * (HALF + 6) + atg.y * q, r: 4 });
  const nozzles = []; for (let o = -HALF + 6; o < HALF; o += 12) nozzles.push({ x: ax + anm.x * o, y: ay + anm.y * o });
  // a gangway from the deck to the turning ring of the station (the ring itself turns while you race)
  const [wx, wy, wr] = def.wheel;
  for (let x = sx1 + 1; x < wx - wr + 2; x++) for (let dy = -3; dy <= 3; dy++) px(x, wy + dy, Math.abs(dy) === 3 ? K.hullD : dy < 0 ? K.hull : K.hull1);

  yield;
  // ----- the glass tube: glass walls along both sides (solid); its roof is a picture drawn over the cars (see-through) -----
  const inTube = i => RT.t0 <= RT.t1 ? i >= RT.t0 && i <= RT.t1 : i >= RT.t0 || i <= RT.t1;
  let tube;
  {
    for (let i = RT.t0; inTube(i); i = (i + 3) % N) for (const s of [-1, 1]) walls.push({ x: path[i].x + nrm[i].x * s * (HALF + 3), y: path[i].y + nrm[i].y * s * (HALF + 3), r: 3 });
    let x0 = MW, y0 = MH, x1 = 0, y1 = 0;
    for (let j = 0; j < A; j++) if (dist[j] < HALF + 4 && inTube(near[j])) { const x = j % MW, y = j / MW | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const W = x1 - x0 + 1, H = y1 - y0 + 1, cv = mk(W, H), g = cv.getContext('2d'), img = g.createImageData(W, H), q = img.data;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const j = y * MW + x; if (!(dist[j] < HALF + 4 && inTube(near[j]))) continue;
      const i = near[j], o = off(j), ao = Math.abs(o);
      // a metal rib every 16 px, the frame along the sides, light glass with a bright streak in between
      let c, a;
      if (ao > HALF + 1) { c = K.hullD; a = 255; } else if (ao > HALF - 1) { c = K.hull; a = 255; }
      else if (i % 8 === 0) { c = K.hull1; a = 210; } else if (Math.abs(o + 12) < 2.5) { c = [230, 248, 255]; a = 120; } else { c = [150, 215, 255]; a = 46; }
      const k = ((y - y0) * W + x - x0) * 4; q[k] = c[0]; q[k + 1] = c[1]; q[k + 2] = c[2]; q[k + 3] = a;
      if (ao > HALF - 1) wallMask[j] = 1;
    }
    g.putImageData(img, 0, 0);
    tube = { c: cv, x: x0, y: y0, W, H };
  }

  yield;
  // ----- force fields on the outside of the sharp bends: a glowing barrier between little posts; it bounces the cars back softly (like the
  // walls of the bob run). The wide bends stay open. -----
  const fieldPix = [];
  for (const [fx, fy, L] of def.fields || []) {
    const i0 = nearestIdx(path, fx, fy), t1 = tan[(i0 - 8 + N) % N], t2 = tan[(i0 + 8) % N];
    const s = Math.sign((t1.x - t2.x) * nrm[i0].x + (t1.y - t2.y) * nrm[i0].y) || 1;
    for (let k = -L; k <= L; k++) {
      const q = (i0 + k + N) % N, p = path[q], n = nrm[q];
      for (let o = HALF + 2; o <= HALF + 4; o += .5) { const x = Math.round(p.x + n.x * s * o), y = Math.round(p.y + n.y * s * o); if (x < 0 || y < 0 || x >= MW || y >= MH || ter[y * MW + x] !== 0) continue; px(x, y, o === HALF + 3 ? [190, 250, 255] : [70, 170, 220]); fieldPix.push(y * MW + x); }
      if (k % 3 === 0) walls.push({ x: p.x + n.x * s * (HALF + 4), y: p.y + n.y * s * (HALF + 4), r: 3, bob: true });
      if (k % 9 === 0) { const x = Math.round(p.x + n.x * s * (HALF + 3)), y = Math.round(p.y + n.y * s * (HALF + 3)); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setT(x + dx, y + dy, Math.abs(dx) === 2 || Math.abs(dy) === 2 ? K.hullD : dx === 0 && dy === 0 ? K.glow : K.hull1); }
    }
  }

  yield;
  // ----- the satellite above the dip in the road: a body, solar wings, a dish (only a picture: it floats in space) -----
  const [stx, sty] = def.sat;
  for (let yy = -9; yy <= 9; yy++) for (let xx = -14; xx <= 14; xx++) setT(stx + xx, sty + yy, Math.abs(yy) === 9 || Math.abs(xx) === 14 ? K.hullD : (yy < -5 ? K.hull : K.hull1));
  for (const s of [-1, 1]) {
    for (let xx = 15; xx < 24; xx++) setT(stx + s * xx, sty, K.hullD);
    for (let yy = -12; yy <= 12; yy++) for (let xx = 24; xx <= 96; xx++) setT(stx + s * xx, sty + yy, Math.abs(yy) === 12 || xx === 24 || xx === 96 ? K.hullD : (xx % 12 === 0 || yy === 0) ? K.solarL : (xx + yy) % 7 === 0 ? K.solar1 : K.solar);
  }
  for (let yy = 10; yy < 26; yy++) for (let xx = -6; xx <= 6; xx++) { const e = (xx / 6) ** 2 + ((yy - 18) / 8) ** 2; if (e <= 1) setT(stx + xx, sty + yy, e > .7 ? K.hullD : K.hull); }
  setT(stx, sty + 18, K.hz);

  yield;
  // ----- on the moon: the flag, a landing craft, boulders (solid), little lamps along the road -----
  const flag = [252, 600]; // on the moon: a racing flag
  for (let k = 0; k < 16; k++) setT(flag[0], flag[1] - k, K.hull1);
  for (let yy = 0; yy < 8; yy++) for (let xx = 1; xx < 13; xx++) setT(flag[0] + xx, flag[1] - 15 + yy, ((xx >> 1) + (yy >> 1)) & 1 ? [245, 245, 240] : [34, 30, 28]); // a chequered racing flag
  walls.push({ x: flag[0], y: flag[1], r: 2 });
  const disc = (cx, cy, rr, c) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) if (dx * dx + dy * dy <= rr * rr) setT(cx + dx, cy + dy, c); };
  const lander = [64, 712];
  for (const [dx, dy] of [[-12, 10], [12, 10], [-12, -6], [12, -6]]) { for (let k = 0; k < 8; k++) setT(lander[0] + dx * k / 8, lander[1] + dy * k / 8 + 4, K.hullD); disc(lander[0] + dx, lander[1] + dy + 4, 2, K.hull1); }
  for (let yy = -8; yy <= 8; yy++) for (let xx = -9; xx <= 9; xx++) { const e = (xx / 9) ** 2 + (yy / 8) ** 2; if (e <= 1) setT(lander[0] + xx, lander[1] + yy, e > .75 ? K.hullD : xx + yy < -3 ? [230, 200, 90] : [200, 168, 60]); }
  walls.push({ x: lander[0], y: lander[1], r: 12 }); solid(lander[0], lander[1], 14);
  const lamps = [];
  for (let i = 0; i < N; i += 18) for (const s of [-1, 1]) {
    const x = Math.round(path[i].x + nrm[i].x * s * (HALF + 3)), y = Math.round(path[i].y + nrm[i].y * s * (HALF + 3)); if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
    const j = y * MW + x;
    if (kind[j] === 3 && ter[j] === 13) { px(x, y, K.hullD); px(x, y - 1, K.hull1); lamps.push({ x, y: y - 1, k: i / 18 | 0 }); }
  }

  yield;
  // the edge of the platforms near the black hole (they flash red in the last lap)
  const [hx, hy] = def.hole, nearHole = edgePix.filter(j => Math.hypot(j % MW - hx, (j / MW | 0) - hy) < 330);
  const P = def.portals, ia = nearestIdx(path, P.a[0], P.a[1]), ib = nearestIdx(path, P.b[0], P.b[1]), aOff = (P.a[0] - path[ia].x) * nrm[ia].x + (P.a[1] - path[ia].y) * nrm[ia].y;
  return { jumps: [], pushes: [], alt: RT.alt, kind, conn: RT.conn, narrowM: RT.narrowM, ringPts: RT.ringPts, ringI: RT.ringI, ringEndI: RT.ringEndI, mid: RT.mid, tube, t0: RT.t0, t1: RT.t1,
    glowPix, redPix: nearHole, fieldPix, lamps, nozzles, airI: ai,
    portals: { ia, ib, off: aOff, a: { x: P.a[0], y: P.a[1] }, b: { x: path[ib].x, y: path[ib].y } },
    planet: def.planet, hole: def.hole, wheel: def.wheel, sat: def.sat, earth: def.earth };
}
