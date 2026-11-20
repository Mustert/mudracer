import { G } from './g.js';
import { SFX } from './audio.js';
import { LAPS, SS, TAU, VH, VW, angDiff, clamp, ctx, hash, rotIndex } from './core.js';
import { R1, disc, ell, swirl } from './gfx.js';
import { warnAt } from './kit.js';
import { addP } from './particles.js';
import { cam } from './state.js';
import { RING, KD } from './spacemap.js';
import { fallCar, inView, near } from './trackfx.js';

// ---------- Weltall Rev 2 while racing (plaene/WELTALL_REV2.md) ----------
// Always: the platforms and the ring are weightless (little grip, the cars steer with small thruster puffs), next to them is nothing: a car that gets
// there drifts off and turns, after a moment the tractor beam of the station brings it back. The planet pulls every car near it, the closer the
// harder: whoever crosses its ring further in is quicker and leaves it with a swing-by (a boost, the bigger the further in he was; a glittering
// trail, no text); too slow and too far in, the planet pulls him down (the atmosphere glows, the tractor beam). The wormhole: its purple mouth sits on
// a little platform at the mouth of the asteroid field, whoever drives into it comes out of the turquoise one on the moon, as fast and in the same
// direction. The jump over the big crater flies long and slow (little gravity, trackfx.js `g`). The decontamination bay blows the dust off.
// Event "asteroiden": asteroids fly across the platforms, the edge of the asteroid field and the moon (never into the hangar, the tube, the
// wormhole or the reach of the black hole); a dashed line on the ground shows where, a red arrow at the edge of the screen where they come from, a
// radar beep. Lap 1 of the leader one every 6 to 9 s, lap 2 every 4 to 6 s, the last lap swarms of three. A big one breaks in two when it hits.
// Event "schwarzesloch": when the leader starts lap 2 the stars in the middle bend, its hum grows, the song drops, a warning triangle points to it;
// 2.5 s later it opens in the void between the station, the asteroid field and the wormhole. It pulls only within its reach (300 px, in the last
// lap 360 and the platforms at that edge flash red), it swallows asteroids; a car that drifts off near it spirals in before the beam gets it.

const PULL = { g: 55, ref: 170, reach: 300, max: 220 }, HOLE = { pre: 2.5, open: 3, r: 20, max: 150, k: 9000 }, WARP = { r: 13, cool: 1.2 };
const AST = { warn: 1.9, speed: 150, small: 6, big: 10, gap: [[6, 3], [4, 2], [4, 2]] }, SWING = { in: 205, span: 75 }, VOID_T = .12;
// the stars far away: how many, how much they move with the map, colour
const STARS = [[46, .25, '#5a6090'], [30, .45, '#a8b0e0'], [16, .65, '#ffffff']];
const leadLap = () => G.cars.reduce((m, c) => Math.max(m, c.lap || 1), 1);
const lastLead = () => leadLap() >= LAPS;

function initSpace(T) {
  const ev = T.ev, S = T.space, N = T.N;
  ev.spAsts = []; ev.spAstOn = false; ev.spAstN = 0; ev.spAstNext = 5; ev.spHoleOn = false; ev.spHole = null; ev.spHolePre = null; ev.spHumT = 0; ev.obst = [];
  // asteroids only fly over the open platforms, the edge of the asteroid field and the moon (not into the station, the tube, the wormhole or the hole)
  if (!S.astIdx) {
    S.astIdx = [];
    const [hx, hy] = S.hole, R = S.holeR[1] + 50;
    for (let i = 0; i < N; i += 2) {
      const p = T.path[i], kd = S.kind[(p.y | 0) * T.W + (p.x | 0)];
      if (kd === KD.deck || kd === KD.tube || Math.hypot(p.x - hx, p.y - hy) < R) continue;
      const w = Math.abs(i - S.portals.ia); if (Math.min(w, N - w) < 30) continue;
      S.astIdx.push(i);
    }
    S.rockObst = T.space.chunks.map(c => ({ x: c.x, y: c.y, r: c.r + 2 }));
    for (const [x, y, r] of S.rocks) S.rockObst.push({ x, y, r: r + 4 });
    S.ringLines = {};
  }
}

function initAsteroids(T) { T.ev.spAstOn = true; }
function initHole(T) { T.ev.spHoleOn = true; }

// the reach of the black hole now (0 = closed)
function holeReach(T) { const h = T.ev.spHole; return h ? T.space.holeR[lastLead() ? 1 : 0] * Math.min(1, h.t / HOLE.open) : 0; }

// ======================================================= always: gravity, the wormhole

function spaceUpdate(T, dt) {
  const ev = T.ev, S = T.space, P = S.portals, ia = P.ia, PL = S.planet, reach = holeReach(T), [hx, hy] = S.hole;
  for (const c of G.cars) {
    if (c.fall > 0) continue;
    c.warpT = Math.max(0, (c.warpT || 0) - dt);
    // the planet: the closer, the harder it pulls (inside the ring about as hard as a fast car needs to fly round it); the atmosphere glows
    const dx = PL.x - c.x, dy = PL.y - c.y, d = Math.hypot(dx, dy);
    if (d < PULL.reach && d > 20) {
      const g = Math.min(PULL.max, PULL.g * (PULL.ref / d) ** 2); c.vx += dx / d * g * dt; c.vy += dy / d * g * dt;
      if (d < PL.r + 22 && Math.random() < dt * 30 && near(c.x, c.y) < 300) addP({ t: 'glit', x: c.x + (Math.random() - .5) * 14, y: c.y + (Math.random() - .5) * 14, life: .5, ml: .5, col: '#ffb070' });
    }
    // the black hole: only within its reach, harder near it
    if (reach > 0) {
      const ex = hx - c.x, ey = hy - c.y, hd = Math.hypot(ex, ey) || 1;
      if (hd < reach) { const g = Math.min(HOLE.max, HOLE.k / hd) * (1 - (hd / reach) ** 4); c.vx += ex / hd * g * dt; c.vy += ey / hd * g * dt; }
    }
    // into the wormhole: out of the other mouth, as fast and in the same direction
    if (c.z <= 0 && c.warpT <= 0 && Math.hypot(c.x - P.a.x, c.y - P.a.y) < WARP.r) {
      const tg = T.tan[ia]; if (c.vx * tg.x + c.vy * tg.y < 20) continue;
      for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; addP({ t: 'warp', x: P.a.x + Math.cos(a) * 4, y: P.a.y + Math.sin(a) * 4, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: .5, ml: .5, col: '#c46bff' }); }
      const ox = (c.x - P.a.x) * .5, oy = (c.y - P.a.y) * .5;
      c.x = P.b.x + ox; c.y = P.b.y + oy; c.idx = P.ib; c.warpT = WARP.cool; c.okX = c.x; c.okY = c.y; c.spWay = null; c.warpTry = false;
      for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; addP({ t: 'warp', x: c.x, y: c.y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: .6, ml: .6, col: '#4ff0e0' }); }
      if (!c.ai || near(c.x, c.y) < 300) SFX.warp(c.ai ? .4 : 1);
    }
  }
  // the decontamination bay breathes white mist from its nozzles (you see it coming)
  if (Math.random() < dt * 12) { const z = S.nozzles[(Math.random() * S.nozzles.length) | 0]; if (z && inView(z.x, z.y, 60)) addP({ t: 'mist', x: z.x + (Math.random() - .5) * 8, y: z.y + (Math.random() - .5) * 8, vx: (Math.random() - .5) * 16, vy: -6 - Math.random() * 10, life: 1, ml: 1 }); }
  if (ev.spAstOn) updateAsteroids(T, dt);
  if (ev.spHoleOn) updateHole(T, dt);
  // the computer cars steer round asteroids that are about to cross the road in front of them, round the ice chunks and the rocks of the field near them
  const ais = G.cars.filter(c => c.ai && !c.fall);
  ev.obst = ev.spAsts.filter(a => !a.dead && a.t > AST.warn - 1 && a.t < AST.warn + .4);
  for (const o of S.rockObst) if (ais.some(c => Math.abs(c.x - o.x) < 110 && Math.abs(c.y - o.y) < 110)) ev.obst.push(o);
}

// the ground under a car (from update.js): over nothing it drifts off; leaving the ring the swing-by; thruster puffs; glowing tracks; moon dust; the bay
function spaceGround(c, j, sp, dt) {
  const T = G.T, S = T.space, PL = S.planet;
  if (c.surf === 0) { c.voidT = (c.voidT || 0) + dt; if (c.voidT > VOID_T) { c.voidT = 0; c.spRing = 0; fallCar(c, 'space'); return; } } else c.voidT = 0;
  // the swing-by: how far in the car was on the ring; leaving it towards its end gives a boost, the bigger the further in
  if (c.surf === RING) { const d = Math.hypot(c.x - PL.x, c.y - PL.y); c.spRing = c.spRing ? Math.min(c.spRing, d) : d; }
  else if (c.spRing) {
    const a = Math.atan2(c.y - PL.y, c.x - PL.x) * 180 / Math.PI, k = clamp((SWING.in - c.spRing) / SWING.span, 0, 1);
    c.spRing = 0;
    if (a > 35 && k > .1) {
      c.boost = Math.max(c.boost || 0, .5 + 1.1 * k);
      for (let q = 0; q < 10 + k * 14; q++) addP({ t: 'glit', x: c.x + (Math.random() - .5) * 16, y: c.y + (Math.random() - .5) * 16, vx: -c.vx * .2, vy: -c.vy * .2, life: .8, ml: .8, col: q % 3 ? '#e8f6ff' : '#ffe9a8' });
      if (!c.ai || near(c.x, c.y) < 300) SFX.swingby(c.ai ? .3 : .5 + k * .5);
    }
  }
  // the trail of a swing-by glitters behind the car
  if (c.boost > 0 && (c.surf === 17 || c.surf === RING) && Math.random() < dt * 30 && near(c.x, c.y) < 300) addP({ t: 'glit', x: c.x - Math.cos(c.ang) * 12, y: c.y - Math.sin(c.ang) * 12, life: .6, ml: .6, col: '#e8f6ff' });
  // in zero gravity the car steers with little thruster puffs
  const turn = c.lastAng === undefined ? 0 : angDiff(c.ang, c.lastAng) / dt; c.lastAng = c.ang;
  if ((c.surf === 17 || c.surf === RING) && Math.abs(turn) > 1.1 && sp > 20 && Math.random() < dt * 24 && near(c.x, c.y) < 300) {
    const s = turn > 0 ? -1 : 1, fx = Math.cos(c.ang), fy = Math.sin(c.ang), x = c.x + fx * 8 - fy * s * 8, y = c.y + fy * 8 + fx * s * 8;
    addP({ t: 'puff', x, y, vx: -fy * s * 40, vy: fx * s * 40, life: .35, ml: .35 });
    if (!c.ai && Math.random() < .3) SFX.thruster();
  }
  // the tracks of the tyres glow for a moment on the metal; the ice dust of the ring sprays up
  if (c.surf === 17 && sp > 30 && Math.random() < dt * 26 && near(c.x, c.y) < 320) {
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang), s = Math.random() < .5 ? -8 : 8;
    addP({ t: 'glow', x: c.x - fx * 11 - fy * s, y: c.y - fy * 11 + fx * s, life: .6, ml: .6 });
  }
  if (c.surf === RING && sp > 40 && Math.random() < dt * 24 && near(c.x, c.y) < 300) addP({ t: 'd', x: c.x - Math.cos(c.ang) * 12, y: c.y - Math.sin(c.ang) * 12, z: 1, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, vz: 20 + Math.random() * 20, g: 30, col: ['#eef6fa', '#b8c8d8', '#ffffff'][(Math.random() * 3) | 0], s: 1, life: 1.2, ml: 1.2 });
  // moon dust jumps up in little clouds and falls slowly (little gravity)
  if (c.surf === 2 && sp > 25 && Math.random() < dt * 30) addP({ t: 'd', x: c.x - Math.cos(c.ang) * 12, y: c.y - Math.sin(c.ang) * 12, z: 1, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, vz: 30 + Math.random() * 30, g: 45, col: T.th.mudP[(Math.random() * 4) | 0], s: 2, life: 1.6, ml: 1.6 });
  // the decontamination bay: nozzles blow the dust off with a hiss
  if (c.washing && !c.lockIn) { c.lockIn = true; if (!c.ai || near(c.x, c.y) < 260) SFX.airlock(c.ai ? .3 : 1); }
  if (!c.washing) c.lockIn = false;
  if (c.washing && Math.random() < dt * 40) addP({ t: 'mist', x: c.x + (Math.random() - .5) * 30, y: c.y + (Math.random() - .5) * 20, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, life: .7, ml: .7 });
}

// back from space: the tractor beam sets the car down on the road
function spaceRespawn(c) {
  c.spWay = null; c.spRing = 0;
  for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; addP({ t: 'warp', x: c.x + Math.cos(a) * 14, y: c.y + Math.sin(a) * 14, vx: -Math.cos(a) * 26, vy: -Math.sin(a) * 26, life: .5, ml: .5, col: '#8fd8ff' }); }
  if (!c.ai || near(c.x, c.y) < 260) SFX.tractor(c.ai ? .3 : 1);
}

// ======================================================= event "asteroiden"

function spawn(T, n, big, side) {
  const L = T.space.astIdx, i = L[Math.floor(hash(n, 1, 131) * L.length)], p = T.path[i], nm = T.nrm[i], tg = T.tan[i];
  const a = Math.atan2(nm.y, nm.x) + (hash(n, 2, 131) - .5) * 1.1 + (hash(n, 3, 131) < .5 ? Math.PI : 0), dx = Math.cos(a), dy = Math.sin(a);
  const sp = AST.speed * (.85 + hash(n, 4, 131) * .35), o = (hash(n, 5, 131) - .5) * 24;
  const tx = p.x + nm.x * o + tg.x * side, ty = p.y + nm.y * o + tg.y * side;
  return { x: tx - dx * sp * AST.warn, y: ty - dy * sp * AST.warn, vx: dx * sp, vy: dy * sp, tx, ty, t: 0, r: big ? AST.big : AST.small, big, rot: hash(n, 6, 131) * TAU, spin: (hash(n, 7, 131) - .5) * 4, beep: false, dead: false };
}

function updateAsteroids(T, dt) {
  const ev = T.ev, lap = Math.min(LAPS, leadLap()), [g0, g1] = AST.gap[lap - 1] || AST.gap[2], swarm = lap >= LAPS;
  // one at a time in lap 1, more often in lap 2 (the big ones break), swarms of three side by side in the last lap
  while (ev.t >= ev.spAstNext) {
    const n = ev.spAstN++;
    if (swarm) for (const side of [-26, 0, 26]) ev.spAsts.push(spawn(T, n, false, side));
    else ev.spAsts.push(spawn(T, n, lap >= 2 && hash(n, 8, 131) < .6, 0));
    ev.spAstNext += g0 + hash(n, 9, 131) * g1;
  }
  const S = T.space, h = ev.spHole, [hx, hy] = S.hole, reach = holeReach(T);
  for (const a of ev.spAsts) {
    a.t += dt; a.rot += a.spin * dt;
    // the black hole bends their way when they come into its reach, and swallows them
    if (h && h.t > .5) {
      const ex = hx - a.x, ey = hy - a.y, d = Math.hypot(ex, ey) || 1;
      if (d < reach) { const g = 12000 / d; a.vx += ex / d * g * dt; a.vy += ey / d * g * dt; }
      if (d < h.r + 6) { a.dead = true; for (let k = 0; k < 8; k++) addP({ t: 'warp', x: a.x, y: a.y, vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 40, life: .4, ml: .4, col: '#c8a0ff' }); }
    }
    a.x += a.vx * dt; a.y += a.vy * dt;
    if (a.t > AST.warn + 4 || a.x < -120 || a.y < -120 || a.x > T.W + 120 || a.y > T.H + 120) a.dead = a.dead || a.t > 1;
  }
  ev.spAsts = ev.spAsts.filter(a => !a.dead);
}

// asteroids hit the cars: thrown round like by a cow; a big one breaks into two small ones, a small one into dust
function spaceCollisions() {
  const ev = G.T.ev; if (!ev || !ev.spAsts) return;
  const add = [];
  for (const a of ev.spAsts) for (const c of G.cars) {
    if (a.dead || c.fall > 0 || c.z > 0 || c.ghost > 0) continue;
    const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy); if (d > a.r + 9) continue;
    const v = Math.hypot(a.vx, a.vy) || 1;
    c.vx = a.vx / v * 120 + dx / (d || 1) * 40; c.vy = a.vy / v * 120 + dy / (d || 1) * 40; c.spin = 12; c.stun = a.big ? 1 : .7; c.boost = 0;
    if (!c.ai) SFX.crash(); else if (near(c.x, c.y) < 260) SFX.bump();
    a.dead = true;
    for (let k = 0; k < 12; k++) addP({ t: 'd', x: a.x, y: a.y, z: 3, vx: (Math.random() - .5) * 90, vy: (Math.random() - .5) * 90, vz: 30, g: 45, col: ['#7a7268', '#958c80', '#3e3832'][k % 3], s: 2, life: 1, ml: 1 });
    if (a.big) for (const s of [-.6, .6]) {
      const ca = Math.cos(s), sa = Math.sin(s);
      add.push({ ...a, dead: false, big: false, r: AST.small, x: a.x + (a.vx * ca - a.vy * sa) / v * 14, y: a.y + (a.vx * sa + a.vy * ca) / v * 14, vx: (a.vx * ca - a.vy * sa) * .9, vy: (a.vx * sa + a.vy * ca) * .9, t: AST.warn + .5 });
    }
    if (near(a.x, a.y) < 300) SFX.rockBreak();
  }
  if (add.length) ev.spAsts.push(...add);
}

// ======================================================= event "schwarzesloch"

function updateHole(T, dt) {
  const ev = T.ev, [hx, hy] = T.space.hole;
  if (!ev.spHole) {
    // the announcement: when the leader starts lap 2; it opens 2.5 s later
    if (!ev.spHolePre) { if (leadLap() < 2) return; ev.spHolePre = { t: 0 }; if (near(hx, hy) < 700) SFX.holeWarn(); }
    ev.spHolePre.t += dt;
    if (ev.spHolePre.t < HOLE.pre) return;
    ev.spHole = { t: 0, r: 0 }; SFX.holeOpen(); G.jumpShake = Math.max(G.jumpShake, .5);
  }
  const h = ev.spHole; h.t += dt;
  h.r = HOLE.r * Math.min(1, h.t / HOLE.open) * (lastLead() ? 1.35 : 1);
  ev.spHumT -= dt;
  if (ev.spHumT <= 0) { ev.spHumT = 3; const d = near(hx, hy); if (d < 460) SFX.holeHum(clamp(1 - d / 460, .15, 1)); }
}

// ======================================================= the computer cars

const diffOf = () => G.raceDiff || 0;
const coin = (c, k) => (c.seed * (3.1 + k * 1.7) + c.lap * (.37 + k * .11)) % 1;

// a line over the planet's ring at radius rl: off the road, round it, back onto the road (cached per radius)
function ringLine(S, rl) {
  if (S.ringLines[rl]) return S.ringLines[rl];
  const P = S.planet, pts = [], R0 = 246, sm = f => f * f * (3 - 2 * f);
  for (let a = -97; a <= 100; a += 2) {
    const f = a < -45 ? sm(clamp((a + 97) / 40, 0, 1)) : a > 50 ? 1 - sm(clamp((a - 50) / 45, 0, 1)) : 1, r = R0 + (rl - R0) * f, q = a * Math.PI / 180;
    pts.push({ x: P.x + Math.cos(q) * r, y: P.y + Math.sin(q) * r });
  }
  return (S.ringLines[rl] = pts);
}

// a way of its own: the wide platform of a fork, the line over the ring, the bay, the way round the crater; and the wormhole
function spaceTarget(c) {
  const T = G.T, S = T.space, N = T.N;
  if (c.finished || (G.state !== 'race' && G.state !== 'finish')) { c.spWay = null; return null; }
  const ahead = i => (i - c.idx + N) % N, diff = diffOf(), sp = Math.hypot(c.vx, c.vy);
  // the wormhole: right at its mouth
  const wa = ahead(S.portals.ia);
  if (c.warpTry && wa > 0 && wa < 40 && c.warpT <= 0) return [S.portals.a.x, S.portals.a.y];
  if (!c.spWay) {
    const pick = (i, pts, yes, kind) => { if (!c.spWay && ahead(i) >= 2 && ahead(i) < 20 && yes) c.spWay = { P: pts, k: 0, kind }; };
    // the forks: the wide platform for the careful ones (on EASY nearly all), the narrow bridge for the bold ones
    S.forks.forEach((F, k) => pick(F.i, F.pts, coin(c, k) < [.85, .5, .2][diff], 'wide'));
    // the ring: further in on a higher difficulty (EASY keeps to the road)
    const iR = S.iRing;
    if (diff > 0) { const q = coin(c, 3); pick(iR, ringLine(S, diff === 2 ? (q < .75 ? 170 : 192) : 192), q < [0, .5, .9][diff], 'ring'); }
    // the bay only when dirty, the way round the crater only when too slow for the jump
    pick(S.iBay, S.bayPts, c.dirt > [.4, .55, .7][diff], 'bay');
    pick(S.iDetour, S.detour, sp < 100, 'detour');
    if (!c.spWay) return null;
  }
  const W = c.spWay, P = W.P; let k = W.k, bd = 1e9;
  for (let q = W.k; q < Math.min(P.length, W.k + 30); q++) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  W.k = k;
  if (k >= P.length - 5 || bd > 70 * 70) { c.spWay = null; return null; }
  const t = P[Math.min(P.length - 1, k + (W.kind === 'ring' ? 6 : 9))];
  return [t.x, t.y];
}

// on a narrow grating bridge or just before it (index i)
const onNarrow = (S, i, N) => S.forks.some(F => { const a = (F.a - i + N) % N, b = (i - F.a + N) % N; return a < 36 || b <= (F.b - F.a + N) % N; });

// the wormhole, a little outside on the bends, never at the edge of a platform, wider in the asteroid field
function spaceLane(c, i, lane) {
  const T = G.T, S = T.space, N = T.N, p = T.path[i], n = T.nrm[i];
  // the wormhole: some of them steer onto its little platform (the more on a higher difficulty; with the black hole open only when fast)
  const P = S.portals, ahead = (P.ia - c.idx + N) % N, sp = Math.hypot(c.vx, c.vy);
  if (ahead > 60 && ahead < 70) c.warpTry = coin(c, 5) < [.1, .35, .7][diffOf()] && !(T.ev.spHole && sp < 110);
  if (c.warpTry && ahead < 60 && ahead >= 40) return clamp(S.padOff * .6, -40, 40); // (closer they aim right at its mouth, see spaceTarget)
  // a narrow grating bridge: right in its middle, not too fast
  if (!c.spWay && onNarrow(S, c.idx, N)) { if (sp > 118) c.brake = true; return 0; }
  // a sharp bend ahead on the platforms: brake in time (there is little grip)
  const ta = T.tan[c.idx], tb = T.tan[(c.idx + 44) % N], bend = Math.abs(angDiff(Math.atan2(tb.y, tb.x), Math.atan2(ta.y, ta.x)));
  if (c.surf === 17 && bend > .8 && sp > 100 + 40 * (1.6 - bend)) c.brake = true;
  // and keep to the outside before it, so they do not cut through the void on the inside
  if (bend > .6) lane = clamp(lane - Math.sign(ta.x * tb.y - ta.y * tb.x) * 14 * Math.min(1, bend), -20, 20);
  // in the asteroid field they spread out
  const bi = (i - S.b0 + N) % N; if (bi < (S.b1 - S.b0 + N) % N) lane *= 2.2;
  // never next to the edge of a platform or a rock: back towards the middle
  const free = l => { for (const q of [l - 10, l, l + 10]) { const x = (p.x + n.x * q) | 0, y = (p.y + n.y * q) | 0; if (x < 0 || y < 0 || x >= T.W || y >= T.H || T.ter[y * T.W + x] === 0) return false; } return true; };
  if (!free(lane)) for (const l of [lane * .5, 0, 8, -8]) if (free(l)) return l;
  return lane;
}

// gas: full on the ring and before the crater jump, slow through the bay and round the crater
function spaceThrottle(c, thr) {
  const S = G.T.space, N = G.T.N, W = c.spWay;
  if (W && W.kind === 'bay') return Math.min(thr, .6);
  if (W && W.kind === 'detour') return Math.min(thr, .75);
  if (W && W.kind === 'ring') return Math.max(thr, .95);
  const la = (S.lip - c.idx + N) % N; if (la < 80) return Math.max(thr, .95);
  if (!W && onNarrow(S, c.idx, N)) return Math.min(thr, .78);
  if (c.warpTry && (S.portals.ia - c.idx + N) % N < 45) return Math.min(thr, .75);
  return thr;
}

// ======================================================= drawing

// a car that drifted off: it turns and gets smaller (it floats away), then the tractor beam pulls it back; near the open black hole it spirals in
function drawSpaceFall(c, F, lv) {
  const T = G.T, t = c.fallT0 - c.fall, h = T.ev && T.ev.spHole, S = T.space;
  let x = c.fx0 + (c.dvx || 0) * .45 * t * (1 - t / 2.6), y = c.fy0 + (c.dvy || 0) * .45 * t * (1 - t / 2.6);
  if (h && h.r > 4) {
    const [hx, hy] = S.hole, d0 = Math.hypot(c.fx0 - hx, c.fy0 - hy);
    if (d0 < holeReach(T)) { const a = Math.atan2(c.fy0 - hy, c.fx0 - hx) + t * 3, d = d0 * (1 - t * .6); x = hx + Math.cos(a) * d; y = hy + Math.sin(a) * d; }
  }
  const s = Math.max(.35, 1 - t * .45), S2 = Math.round(SS * s), up = t > .8 ? (t - .8) / .4 : 0;
  ctx.globalAlpha = 1 - up * .8;
  ctx.drawImage(F.frames[lv][rotIndex(c.ang + t * 5)], Math.round(x - S2 / 2), Math.round(y - S2 / 2 - up * 10), S2, S2);
  ctx.globalAlpha = 1;
  // the tractor beam: a blue cone of light from a little drone of the station
  if (t > .45) {
    const k = Math.min(1, (t - .45) / .3), bx = Math.round(x), by = Math.round(y);
    ctx.globalAlpha = .28 * k; ctx.fillStyle = '#8fd8ff';
    ctx.beginPath(); ctx.moveTo(bx - 3, by - 54); ctx.lineTo(bx + 3, by - 54); ctx.lineTo(bx + 15, by + 4); ctx.lineTo(bx - 15, by + 4); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = .5 * k; for (let q = 0; q < 4; q++) R1(bx - 10 + ((G.time * 40 + q * 7) % 20 | 0), by - 50 + ((G.time * 70 + q * 13) % 54 | 0), 1, 3, '#ffffff');
    ctx.globalAlpha = 1; R1(bx - 6, by - 60, 12, 5, '#1b1e2a'); R1(bx - 5, by - 59, 10, 3, '#c8ced8'); R1(bx - 1, by - 56, 2, 2, '#5fe8ff');
  }
}

// on the ground (under the cars): stars far away that move slower than the map, glittering edges and ring, the buoys, the nozzles, the wormhole,
// where asteroids will fly, the black hole (and the bent stars before it opens), the lamps on the moon, glowing tyre tracks
function drawSpaceGround() {
  const T = G.T, S = T.space, ev = T.ev, PL = S.planet, [ex, ey, er] = S.earth;
  // the parallax stars: three layers, the far ones move least
  for (const L of STARS) {
    const [n, f, col] = /** @type {[number, number, string]} */ (L);
    for (let s = 0; s < n; s++) {
      const W2 = VW + 30, H2 = VH + 30, sx = ((hash(s, 1, n) * W2 - cam.x * f) % W2 + W2) % W2 - 15, sy = ((hash(s, 2, n) * H2 - cam.y * f) % H2 + H2) % H2 - 15;
      const x = Math.round(cam.x + sx), y = Math.round(cam.y + sy); if (x < 0 || y < 0 || x >= T.W || y >= T.H) continue;
      const j = y * T.W + x; if (T.ter[j] !== 0 || S.kind[j] || Math.hypot(x - PL.x, y - PL.y) < PL.ring[1] + 4 || Math.hypot(x - ex, y - ey) < er + 4) continue;
      R1(x, y, 1, 1, col);
    }
  }
  // the edges of the platforms and the ice dust of the ring glitter
  const k = Math.floor(G.time * 6);
  for (let q = 0; q < 40 && S.glowPix.length; q++) { const p = S.glowPix[(hash(q, k, 132) * S.glowPix.length) | 0]; R1(p % T.W, (p / T.W) | 0, 1, 1, '#e8ffff'); }
  for (let q = 0; q < 50 && S.ringPix.length; q++) { const p = S.ringPix[(hash(q, k, 136) * S.ringPix.length) | 0]; R1(p % T.W, (p / T.W) | 0, 1, 1, q % 4 ? '#ffffff' : '#bfe8ff'); }
  // the force fields shimmer
  for (let q = 0; q < 30 && S.fieldPix.length; q++) { const p = S.fieldPix[(hash(q, k, 135) * S.fieldPix.length) | 0]; R1(p % T.W, (p / T.W) | 0, 1, 1, q % 2 ? '#ffffff' : '#5fe8ff'); }
  // the platforms near the open black hole flash red in the last lap
  if (ev && ev.spHole && lastLead() && ((G.time * 4) | 0) % 2) for (let q = 0; q < 60 && S.redPix.length; q++) { const p = S.redPix[(hash(q, k, 133) * S.redPix.length) | 0]; R1(p % T.W, (p / T.W) | 0, 2, 2, '#ff3b4a'); }
  // the lamps along the road over the moon, the buoys of the asteroid field (red on one side, green on the other)
  for (const L of S.lamps) if (inView(L.x, L.y)) R1(L.x, L.y, 1, 1, ((G.time * 3 + L.k * .2) | 0) % 2 ? '#ffd23f' : '#7a5a10');
  for (const b of S.buoys) if (inView(b.x, b.y)) { const on = ((G.time * 2 + b.k * .3) | 0) % 2; R1(b.x - 2, b.y - 2, 4, 4, '#1b1e2a'); R1(b.x - 1, b.y - 1, 2, 2, b.s > 0 ? (on ? '#ff4a4a' : '#7a1a1a') : (on ? '#4aff7a' : '#1a6a2a')); if (on) { ctx.globalAlpha = .25; disc(b.x, b.y, 5, b.s > 0 ? '#ff4a4a' : '#4aff7a'); ctx.globalAlpha = 1; } }
  // the nozzles of the decontamination bay
  for (const z of S.nozzles) if (inView(z.x, z.y)) R1(Math.round(z.x) - 1, Math.round(z.y) - 1, 3, 3, ((G.time * 8) | 0) % 2 ? '#e8f4ff' : '#8a96ac');
  // before it opens the stars round the black hole bend into rings; then a dark middle, a bright disc round it that turns, stars pulled into streaks
  const h = ev && ev.spHole, pre = ev && !h && ev.spHolePre, [hx, hy] = S.hole;
  if (pre && inView(hx, hy, 140)) {
    const f = Math.min(1, pre.t / HOLE.pre);
    ctx.globalAlpha = .3 + .5 * f;
    for (let q = 0; q < 30; q++) { const a = hash(q, 1, 137) * TAU + G.time * (.3 + f), d = 20 + hash(q, 2, 137) * 90 * (1 - f * .4); for (let s = 0; s < 2 + f * 6; s++) R1(Math.round(hx + Math.cos(a + s * .04) * d), Math.round(hy + Math.sin(a + s * .04) * d * .8), 1, 1, '#c8c8ff'); }
    ctx.globalAlpha = 1;
  }
  if (h && h.r > .5 && inView(hx, hy, 120)) {
    const r = h.r;
    for (let q = 0; q < 26; q++) { const a = hash(q, 1, 134) * TAU + G.time * .4, d = r + 10 + hash(q, 2, 134) * 60; ctx.globalAlpha = .5; for (let s = 0; s < 6; s++) R1(Math.round(hx + Math.cos(a + s * .03) * (d - s * 2)), Math.round(hy + Math.sin(a + s * .03) * (d - s * 2) * .8), 1, 1, '#c8c8ff'); }
    ctx.globalAlpha = .3; ell(hx, hy, Math.round(r * 2.2), Math.round(r * 1.2), '#5a2a9a'); ctx.globalAlpha = .55; ell(hx, hy, Math.round(r * 1.7), Math.round(r * .9), '#ff9a4a'); ctx.globalAlpha = 1;
    for (let q = 0; q < 40; q++) { const a = q / 40 * TAU + G.time * 2.4; R1(Math.round(hx + Math.cos(a) * r * 1.5), Math.round(hy + Math.sin(a) * r * .8), 2, 1, q % 3 ? '#ffd27a' : '#ffffff'); }
    disc(hx, hy, Math.round(r), '#000000'); ctx.globalAlpha = .6; disc(hx, hy, Math.round(r) + 1, '#1a0a2a'); ctx.globalAlpha = 1; disc(hx, hy, Math.max(1, Math.round(r) - 1), '#000000');
  }
  // the wormhole: the purple mouth on its little platform, the turquoise one on the moon is where you come out
  const P = S.portals, rot = G.time * 5;
  if (inView(P.b.x, P.b.y)) swirl(P.b.x, P.b.y, 10, '#1fb8b0', '#9ffff0', -rot, '#0a0618');
  if (inView(P.a.x, P.a.y)) swirl(P.a.x, P.a.y, 11, '#8a3ad8', '#e0a8ff', rot, '#0a0618');
  // where asteroids will fly: a dashed line along their way, until they are past
  if (ev && ev.spAsts) for (const a of ev.spAsts) {
    if (a.t > AST.warn + .2 || !inView(a.tx, a.ty, 120)) continue;
    const v = Math.hypot(a.vx, a.vy) || 1, dx = a.vx / v, dy = a.vy / v, bl = ((G.time * 8) | 0) % 2;
    for (let s = -40; s < 260; s += 4) {
      if (((s + G.time * 60) % 16 + 16) % 16 > 8) continue;
      R1(Math.round(a.tx - dx * (s - 120)), Math.round(a.ty - dy * (s - 120)), 2, 2, bl ? '#ff4a4a' : '#ffd0d0');
    }
  }
  // glowing tyre tracks (particles)
  for (const p of G.parts) if (p.t === 'glow') { ctx.globalAlpha = p.life / p.ml * .8; R1(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2, '#6ad8ff'); }
  ctx.globalAlpha = 1;
}

// above the cars: the roof of the glass tube, the turning ring of the station with a shuttle docking, the asteroids, the astronaut and the UFO,
// thruster puffs, the mist of the bay, swirls of the wormhole, the glitter of a swing-by
function drawSpaceAbove() {
  const T = G.T, S = T.space, ev = T.ev, tb = S.tube;
  ctx.drawImage(tb.c, tb.x, tb.y);
  // the turning ring of the station: spokes and modules on its rim
  const [wx, wy, wr] = S.wheel;
  if (inView(wx, wy, wr + 20)) {
    const a0 = G.time * .5;
    ctx.globalAlpha = .25; disc(wx + 5, wy + 6, wr, '#000'); ctx.globalAlpha = 1;
    for (let q = 0; q < 4; q++) { const a = a0 + q * TAU / 4; for (let s = 6; s < wr; s += 1) R1(Math.round(wx + Math.cos(a) * s), Math.round(wy + Math.sin(a) * s), 2, 2, '#8a92a0'); }
    for (let q = 0; q < 120; q++) { const a = q / 120 * TAU; R1(Math.round(wx + Math.cos(a) * wr) - 1, Math.round(wy + Math.sin(a) * wr) - 1, 3, 3, '#6a7280'); R1(Math.round(wx + Math.cos(a) * wr), Math.round(wy + Math.sin(a) * wr), 1, 1, '#c8ced8'); }
    for (let q = 0; q < 8; q++) { const a = a0 + q * TAU / 8 + .2, x = Math.round(wx + Math.cos(a) * wr), y = Math.round(wy + Math.sin(a) * wr); R1(x - 4, y - 4, 8, 8, '#1b1e2a'); R1(x - 3, y - 3, 6, 6, '#c8ced8'); R1(x - 1, y - 1, 2, 2, q % 2 ? '#7fd8ff' : '#ffe9a8'); }
    disc(wx, wy, 7, '#1b1e2a'); disc(wx, wy, 6, '#a8b0bc'); R1(wx - 1, wy - 1, 2, 2, '#5fe8ff');
  }
  // a shuttle comes in from the void and docks at the ring, waits, flies off again (every 24 s)
  const u = (G.time % 24) / 24, sxA = wx + 220, syA = wy - 160, sxB = wx + wr + 10, syB = wy;
  const f = u < .3 ? u / .3 : u < .6 ? 1 : 1 - (u - .6) / .4, e = f * f * (3 - 2 * f), shx = Math.round(sxA + (sxB - sxA) * e), shy = Math.round(syA + (syB - syA) * e);
  if (inView(shx, shy)) { ctx.globalAlpha = .2; ell(shx + 6, shy + 8, 8, 3, '#000'); ctx.globalAlpha = 1; ell(shx, shy, 9, 4, '#1b1e2a'); ell(shx, shy, 8, 3, '#c8ced8'); R1(shx - 3, shy - 1, 3, 2, '#7fd8ff'); if (f < 1 && ((G.time * 10) | 0) % 2) R1(shx + 8, shy, 3, 1, '#ffb04a'); }
  // the blinking light of the satellite
  const [sx, sy] = S.sat; if (inView(sx, sy) && ((G.time * 2) | 0) % 2) { R1(sx - 1, sy - 11, 3, 3, '#ff4a4a'); ctx.globalAlpha = .3; disc(sx, sy - 10, 5, '#ff4a4a'); ctx.globalAlpha = 1; }
  // flying asteroids: a lumpy rock that turns
  if (ev && ev.spAsts) for (const a of ev.spAsts) {
    if (!inView(a.x, a.y)) continue;
    const x = Math.round(a.x), y = Math.round(a.y), r = a.r;
    ctx.globalAlpha = .25; disc(x + 6, y + 8, r, '#000'); ctx.globalAlpha = 1;
    disc(x, y, r + 1, '#2a2622'); disc(x, y, r, '#7a7268'); disc(x - Math.round(r / 3), y - Math.round(r / 3), Math.round(r / 2), '#958c80');
    for (let q = 0; q < 3; q++) { const ca = a.rot + q * 2.1, cr = r * .55; R1(Math.round(x + Math.cos(ca) * cr) - 1, Math.round(y + Math.sin(ca) * cr) - 1, 2 + (a.big ? 1 : 0), 2, '#4e4842'); }
    const v = Math.hypot(a.vx, a.vy) || 1; for (let s = 1; s < 5; s++) { ctx.globalAlpha = .4 - s * .08; disc(Math.round(a.x - a.vx / v * (r + s * 4)), Math.round(a.y - a.vy / v * (r + s * 4)), Math.max(1, r - s * 2), '#ffb04a'); }
    ctx.globalAlpha = 1;
  }
  // the astronaut floats in the void beside the station and waves; now and then a UFO flies past
  const ax = Math.round(340 + Math.sin(G.time * .11) * 45), ay = Math.round(590 + Math.cos(G.time * .17) * 50);
  if (inView(ax, ay)) {
    const w = ((G.time * 3) | 0) % 2;
    R1(ax - 4, ay - 3, 9, 11, '#1b1e2a'); R1(ax - 3, ay - 2, 7, 9, '#f2f4f8'); R1(ax - 3, ay - 7, 7, 6, '#1b1e2a'); R1(ax - 2, ay - 6, 5, 4, '#f2f4f8'); R1(ax - 1, ay - 5, 3, 2, '#ffb04a');
    R1(ax + 4, ay - 3 - w * 2, 2, 4, '#f2f4f8'); R1(ax - 6, ay, 2, 4, '#f2f4f8'); R1(ax - 2, ay + 7, 2, 3, '#f2f4f8'); R1(ax + 1, ay + 7, 2, 3, '#f2f4f8'); R1(ax - 5, ay - 1, 2, 6, '#a8b0bc');
  }
  const uu = (G.time % 23) / 2.6;
  if (uu < 1) {
    const x = Math.round(cam.x - 30 + uu * (VW + 60)), y = Math.round(cam.y + 34 + Math.sin(uu * 9) * 8);
    ctx.globalAlpha = .2; ell(x + 14, y + 26, 10, 3, '#000'); ctx.globalAlpha = 1;
    ell(x, y, 12, 4, '#1b1e2a'); ell(x, y, 11, 3, '#a8b0bc'); ell(x, y - 3, 5, 3, '#7fd8ff'); R1(x - 2, y - 5, 2, 1, '#ffffff');
    for (let q = 0; q < 4; q++) R1(x - 8 + q * 5, y, 2, 1, ((G.time * 10 + q) | 0) % 2 ? '#ffd23f' : '#ff4a4a');
  }
  // puffs of the thrusters, the mist of the bay, swirls of the wormhole, glitter
  for (const p of G.parts) {
    if (p.t === 'puff') { const ff = p.life / p.ml; ctx.globalAlpha = ff * .8; disc(Math.round(p.x), Math.round(p.y), Math.max(1, Math.round(3 - ff * 2)), '#f2f8ff'); }
    else if (p.t === 'mist') { const ff = p.life / p.ml; ctx.globalAlpha = ff * .5; disc(Math.round(p.x), Math.round(p.y), Math.round(2 + (1 - ff) * 5), '#ffffff'); }
    else if (p.t === 'warp' || p.t === 'glit') { ctx.globalAlpha = p.life / p.ml; R1(Math.round(p.x), Math.round(p.y), p.t === 'glit' ? 1 : 2, p.t === 'glit' ? 1 : 2, p.col); }
  }
  ctx.globalAlpha = 1;
}

// on the screen: red arrows at the edge where an asteroid comes from, the warning triangle towards the black hole before it opens, its violet shimmer
function drawSpaceSky() {
  const T = G.T, ev = T.ev, P = G.player; if (!ev) return;
  if (ev.spAsts) for (const a of ev.spAsts) {
    if (a.t > AST.warn || !P) continue;
    // only asteroids that will cross the road somewhere you can see (or close to you), as long as they are not on the screen yet
    if (!inView(a.tx, a.ty, 60) || inView(a.x, a.y, -4)) continue;
    if (!a.beep) { a.beep = true; SFX.radar(); }
    const cx = VW / 2, cy = VH / 2 + 8, dx = a.x - cam.x - cx, dy = a.y - cam.y - cy, k = Math.min((VW / 2 - 14) / Math.abs(dx || 1e-3), (VH / 2 - 22) / Math.abs(dy || 1e-3));
    const x = cx + dx * k, y = cy + dy * k, an = Math.atan2(dy, dx), bl = ((G.time * 8) | 0) % 2;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(an + Math.PI);
    ctx.fillStyle = '#1b120c'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = bl ? '#ff3b3b' : '#ffd0d0'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  const [hx, hy] = T.space.hole;
  if (ev.spHolePre && !ev.spHole) { ctx.save(); ctx.translate(-cam.x, -cam.y); warnAt(hx, hy, cam.x, cam.y); ctx.restore(); }
  if (ev.spHole && P) { const d = Math.hypot(P.x - hx, P.y - hy), R = holeReach(T) + 40; if (d < R) { ctx.fillStyle = 'rgba(70,20,120,' + (.16 * (1 - d / R)).toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH); } }
}

// ---------- hooks: how the core calls this track (hooks.js; what each hook does: _template.js) ----------
/** @type {import('./_template.js').TrackHooks} */
export const spaceHooks = {
  init: initSpace, events: { asteroiden: initAsteroids, schwarzesloch: initHole }, update: spaceUpdate, collisions: spaceCollisions,
  // nothing beside the road: no grip, no gas (the car drifts off); the ice dust of the ring: a little slower than a platform, even less grip
  surf: c => c.surf === 0 ? [1, .3, .15, 0] : c.surf === RING ? [.94, 2.4 * c.def.turn * c.def.turn, .8, 1] : null,
  target: spaceTarget, lane: spaceLane, throttle: spaceThrottle, ground: spaceGround, noRespawn: t => t === 0, respawn: spaceRespawn,
  drawFall(c, F, lv) { if (c.fallKind !== 'space') return false; drawSpaceFall(c, F, lv); return true; }, // drifting off, then the tractor beam
  drawGround: drawSpaceGround, drawAbove: drawSpaceAbove, drawSky: drawSpaceSky,
};
