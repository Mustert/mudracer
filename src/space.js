import { G } from './g.js';
import { SFX } from './audio.js';
import { SS, TAU, VH, VW, angDiff, clamp, ctx, hash, rotIndex } from './core.js';
import { R1, disc, ell, swirl, text } from './gfx.js';
import { addP } from './particles.js';
import { cam } from './state.js';
import { fallCar, inView, lastLap, near } from './trackfx.js';

// ---------- Weltall while racing ----------
// Always: the platforms are weightless (little grip, the cars steer with small thruster puffs), next to them is nothing: a car that gets
// there drifts off and turns, after a moment the tractor beam of the station brings it back to the road. The planet pulls every car towards
// it, strongest on its ring: whoever drives the ring from one way to the other gets a SWING-BY (a boost). The wormhole: the purple mouth
// sits on a little platform beside the road over the asteroid, whoever drives into it comes out of the turquoise one further down, as fast
// and in the same direction.
// The airlock blows the moon dust off (it washes).
// Event "asteroiden": asteroids fly across the map; a dashed line on the ground shows where, and a red arrow at the edge of the screen where
// they come from. A hit throws the car round (like a cow), a big asteroid breaks into two small ones. From lap 2 they come in swarms of three.
// Event "schwarzesloch": from lap 2 a black hole opens in the middle and pulls everybody a little towards it (closer: harder), it swallows
// asteroids; in the last lap it grows and the platforms near it flash red.

const PULL = { g: 110, reach: 330 }, HOLE = { pull: 7000, max: 52, open: 3, r: 20, last: 1.35 }, WARP = { r: 13, cool: 1.2 };
const AST = { warn: 1.9, speed: 150, small: 6, big: 10 }, VOID_T = .12;
// the stars far away: how many, how much they move with the map, colour
const STARS = [[46, .25, '#5a6090'], [30, .45, '#a8b0e0'], [16, .65, '#ffffff']];

function initSpace(T) {
  const ev = T.ev;
  ev.asts = []; ev.astOn = false; ev.astN = 0; ev.astNext = 4; ev.holeOn = false; ev.hole = null; ev.holeMsg = 0; ev.swings = []; ev.obst = []; ev.humT = 0;
  const S = T.space; S.ax = S.portals.a.x; S.ay = S.portals.a.y; // (where the purple mouth is)
  // asteroids only fly over the open platforms and the moon (not into the glass tube or the station)
  if (!S.astIdx) { S.astIdx = []; for (let i = 0; i < T.N; i += 2) { const p = T.path[i], j = (p.y | 0) * T.W + (p.x | 0), kd = S.kind[j]; if (kd !== 1 && kd !== 2) S.astIdx.push(i); } }
}

function initAsteroids(T) { T.ev.astOn = true; }
function initHole(T) { T.ev.holeOn = true; }

// ======================================================= always: gravity, the wormhole

function spaceUpdate(T, dt) {
  const ev = T.ev, S = T.space, P = S.portals, ia = P.ia;
  const [px, py] = S.planet, h = ev.hole, hk = h ? Math.min(1, h.t / HOLE.open) * (lastLap() ? HOLE.last : 1) : 0;
  for (const c of G.cars) {
    if (c.fall > 0) continue;
    c.warpT = Math.max(0, (c.warpT || 0) - dt);
    // the planet: the closer, the harder it pulls (on its ring about as hard as a fast car needs to fly round it)
    const dx = px - c.x, dy = py - c.y, d = Math.hypot(dx, dy);
    if (d < PULL.reach && d > 30) { const g = Math.min(220, PULL.g * (S.mid / d) ** 3); c.vx += dx / d * g * dt; c.vy += dy / d * g * dt; }
    // the black hole: a little everywhere, harder near it
    if (hk > 0) { const hx = S.hole[0] - c.x, hy = S.hole[1] - c.y, hd = Math.hypot(hx, hy) || 1, g = Math.min(HOLE.max, HOLE.pull / hd) * hk; c.vx += hx / hd * g * dt; c.vy += hy / hd * g * dt; }
    // into the wormhole: out of the other mouth, as fast and in the same direction
    if (c.z <= 0 && c.warpT <= 0 && Math.hypot(c.x - S.ax, c.y - S.ay) < WARP.r) {
      const tg = T.tan[ia]; if (c.vx * tg.x + c.vy * tg.y < 20) continue;
      for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; addP({ t: 'warp', x: S.ax + Math.cos(a) * 4, y: S.ay + Math.sin(a) * 4, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: .5, ml: .5, col: '#c46bff' }); }
      const ib = P.ib, ox = (c.x - S.ax) * .5, oy = (c.y - S.ay) * .5;
      c.x = P.b.x + ox; c.y = P.b.y + oy; c.idx = ib; c.warpT = WARP.cool; c.okX = c.x; c.okY = c.y;
      for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; addP({ t: 'warp', x: c.x, y: c.y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: .6, ml: .6, col: '#4ff0e0' }); }
      if (!c.ai || near(c.x, c.y) < 300) SFX.warp(c.ai ? .4 : 1);
    }
  }
  if (ev.astOn) updateAsteroids(T, dt);
  if (ev.holeOn) updateHole(T, dt);
  ev.swings = ev.swings.filter(s => (s.t -= dt) > 0);
  ev.holeMsg = Math.max(0, ev.holeMsg - dt);
  // the computer cars steer round asteroids that are about to cross the road in front of them
  ev.obst = ev.asts.filter(a => !a.dead && a.t > AST.warn - 1 && a.t < AST.warn + .4);
}

// the ground under a car (from update.js): over nothing it drifts off; on the ring the swing-by; thruster puffs; glowing tracks; moon dust;
// the airlock
function spaceGround(c, j, sp, dt) {
  const T = G.T, S = T.space;
  if (c.surf === 0) { c.voidT = (c.voidT || 0) + dt; if (c.voidT > VOID_T) { c.voidT = 0; c.orbit = 0; fallCar(c, 'space'); return; } } else c.voidT = 0;
  // the swing-by: onto the ring by the first way, past its middle, off by the second way
  const kd = S.kind[j], cn = S.conn[j];
  if (kd === 4) { const a = Math.atan2(c.y - S.planet[1], c.x - S.planet[0]) * 180 / Math.PI; if (!c.orbit) c.orbit = 1; if (c.orbit === 1 && a > -12 && a < 30) c.orbit = 2; }
  else if (cn === 2 && c.orbit === 2) {
    c.orbit = 0; c.boost = 1.4; T.ev.swings.push({ x: c.x, y: c.y, t: 1.2 });
    if (!c.ai || near(c.x, c.y) < 300) SFX.swingby(c.ai ? .35 : 1);
  } else if (!cn) c.orbit = 0;
  // in zero gravity the car steers with little thruster puffs
  const turn = c.lastAng === undefined ? 0 : angDiff(c.ang, c.lastAng) / dt; c.lastAng = c.ang;
  if (c.surf === 17 && Math.abs(turn) > 1.1 && sp > 20 && Math.random() < dt * 24 && near(c.x, c.y) < 300) {
    const s = turn > 0 ? -1 : 1, fx = Math.cos(c.ang), fy = Math.sin(c.ang), x = c.x + fx * 8 - fy * s * 8, y = c.y + fy * 8 + fx * s * 8;
    addP({ t: 'puff', x, y, vx: -fy * s * 40, vy: fx * s * 40, life: .35, ml: .35 });
    if (!c.ai && Math.random() < .3) SFX.thruster();
  }
  // the tracks of the tyres glow for a moment on the metal
  if (c.surf === 17 && sp > 30 && Math.random() < dt * 26 && near(c.x, c.y) < 320) {
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang), s = Math.random() < .5 ? -8 : 8;
    addP({ t: 'glow', x: c.x - fx * 11 - fy * s, y: c.y - fy * 11 + fx * s, life: .6, ml: .6 });
  }
  // moon dust jumps up in little clouds and falls slowly (little gravity)
  if (c.surf === 2 && sp > 25 && Math.random() < dt * 30) addP({ t: 'd', x: c.x - Math.cos(c.ang) * 12, y: c.y - Math.sin(c.ang) * 12, z: 1, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, vz: 30 + Math.random() * 30, g: 45, col: T.th.mudP[(Math.random() * 4) | 0], s: 2, life: 1.6, ml: 1.6 });
  // the airlock: nozzles blow the dust off with a hiss
  if (c.washing && !c.lockIn) { c.lockIn = true; if (!c.ai || near(c.x, c.y) < 260) SFX.airlock(c.ai ? .3 : 1); }
  if (!c.washing) c.lockIn = false;
  if (c.washing && Math.random() < dt * 40) addP({ t: 'mist', x: c.x + (Math.random() - .5) * 30, y: c.y + (Math.random() - .5) * 20, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, life: .7, ml: .7 });
}

// back from space: the tractor beam sets the car down on the road
function spaceRespawn(c) {
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
  const ev = T.ev, swarm = !!G.player && G.player.lap >= 2;
  // single ones in lap 1 (every 2 to 3 s), from lap 2 a swarm of three side by side (every 3 to 4 s)
  while (ev.t >= ev.astNext) {
    const n = ev.astN++;
    if (swarm) for (const side of [-26, 0, 26]) ev.asts.push(spawn(T, n, false, side));
    else ev.asts.push(spawn(T, n, hash(n, 8, 131) < .55, 0));
    ev.astNext += (swarm ? 3.2 : 2.5) * (.8 + hash(n, 9, 131) * .4);
  }
  const S = T.space, h = ev.hole;
  for (const a of ev.asts) {
    a.t += dt; a.rot += a.spin * dt;
    // the black hole bends their way a little when they come close, and swallows them
    if (h && h.t > .5) {
      const hx = S.hole[0] - a.x, hy = S.hole[1] - a.y, d = Math.hypot(hx, hy) || 1;
      if (d < 170) { const g = 9000 / d; a.vx += hx / d * g * dt; a.vy += hy / d * g * dt; }
      if (d < h.r + 6) { a.dead = true; for (let k = 0; k < 8; k++) addP({ t: 'warp', x: a.x, y: a.y, vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 40, life: .4, ml: .4, col: '#c8a0ff' }); }
    }
    a.x += a.vx * dt; a.y += a.vy * dt;
    if (a.t > AST.warn + 4 || a.x < -120 || a.y < -120 || a.x > T.W + 120 || a.y > T.H + 120) a.dead = a.dead || a.t > 1;
  }
  ev.asts = ev.asts.filter(a => !a.dead);
}

// asteroids hit the cars: thrown round like by a cow; a big one breaks into two small ones, a small one into dust
function spaceCollisions() {
  const ev = G.T.ev; if (!ev || !ev.asts) return;
  const add = [];
  for (const a of ev.asts) for (const c of G.cars) {
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
  if (add.length) ev.asts.push(...add);
}

// ======================================================= event "schwarzesloch"

function updateHole(T, dt) {
  const ev = T.ev;
  if (!ev.hole) {
    if (!G.player || G.player.lap < 2) return;
    ev.hole = { t: 0, r: 0 }; ev.holeMsg = 2.6; SFX.holeOpen(); G.jumpShake = Math.max(G.jumpShake, .5);
  }
  const h = ev.hole; h.t += dt;
  h.r = HOLE.r * Math.min(1, h.t / HOLE.open) * (lastLap() ? 1.4 : 1);
  ev.humT -= dt;
  if (ev.humT <= 0) { ev.humT = 3; const d = near(T.space.hole[0], T.space.hole[1]); if (d < 420) SFX.holeHum(clamp(1 - d / 420, .15, 1)); }
}

// ======================================================= the computer cars

// the short way over the planet's ring: some of them try it (the more on a higher difficulty)
function spaceTarget(c) {
  const T = G.T, S = T.space, P = S.ringPts, N = T.N; if (!P || c.finished || G.state !== 'race') return null;
  // the wormhole: right at its mouth
  const wa = (S.portals.ia - c.idx + N) % N;
  if (c.warpTry && wa > 0 && wa < 40 && c.warpT <= 0) return [S.ax, S.ay];
  if (!c.ringWay) {
    const ahead = (S.ringI - c.idx + N) % N; if (ahead < 2 || ahead > 22) return null;
    if (c.ringNo === S.ringI) return null;
    c.ringNo = S.ringI; // decided for this lap
    if ((c.seed * 5.3 + c.lap * .37) % 1 > [.2, .4, .6][G.raceDiff || 0]) return null;
    c.ringWay = true; c.rK = 0;
  }
  let k = c.rK, bd = 1e9;
  for (let q = c.rK; q < Math.min(P.length, c.rK + 30); q++) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  c.rK = k;
  if (k >= P.length - 4 || bd > 50 * 50) { c.ringWay = false; return null; }
  if (Math.hypot(c.vx, c.vy) > 150 && S.conn[(c.y | 0) * T.W + (c.x | 0)] !== 2) c.brake = true; // not too fast onto the ring (and on it about as fast as you need to fly round the planet)
  const t = P[Math.min(P.length - 1, k + 8)];
  return [t.x, t.y];
}

// the wormhole, a little outside on the curve round the planet, never at the edge of a platform
function spaceLane(c, i, lane) {
  const T = G.T, S = T.space, N = T.N, p = T.path[i], n = T.nrm[i];
  if (c.idx < S.ringI - 30 && c.ringNo === S.ringI) c.ringNo = -1; // a new lap: decide again
  // the wormhole: some of them steer onto its little platform beside the road (the more on a higher difficulty)
  const P = S.portals, ahead = (P.ia - c.idx + N) % N;
  if (ahead > 60 && ahead < 70) c.warpTry = (c.seed * 3.7 + c.lap * .51) % 1 < [.15, .3, .5][G.raceDiff || 0];
  if (c.warpTry && ahead < 60 && ahead >= 40) return P.off * .5; // (closer they aim right at its mouth, see spaceTarget)
  // a sharp bend ahead on the platforms: brake in time (there is little grip)
  const sp = Math.hypot(c.vx, c.vy), ta = T.tan[c.idx], tb = T.tan[(c.idx + 44) % N], bend = Math.abs(angDiff(Math.atan2(tb.y, tb.x), Math.atan2(ta.y, ta.x)));
  if (c.surf === 17 && bend > .8 && sp > 100 + 40 * (1.6 - bend)) c.brake = true;
  // and keep to the outside before it, so they do not cut through the void on the inside
  if (bend > .6) lane = clamp(lane - Math.sign(ta.x * tb.y - ta.y * tb.x) * 14 * Math.min(1, bend), -20, 20);
  // round the planet: a little outside the middle, its pull drags them inwards
  if (Math.hypot(p.x - S.planet[0], p.y - S.planet[1]) < 240) lane = clamp(lane + 8 * Math.sign((p.x - S.planet[0]) * n.x + (p.y - S.planet[1]) * n.y), -18, 18);
  // never next to the edge of a platform (narrow bridges): back towards the middle
  const free = l => { for (const q of [l - 10, l, l + 10]) { const x = (p.x + n.x * q) | 0, y = (p.y + n.y * q) | 0; if (x < 0 || y < 0 || x >= T.W || y >= T.H || T.ter[y * T.W + x] === 0) return false; } return true; };
  if (!free(lane)) for (const l of [lane * .5, 0, 8, -8]) if (free(l)) return l;
  return lane;
}

// ======================================================= drawing

// a car that drifted off: it turns and gets smaller (it floats away), then the tractor beam pulls it back; near the open black hole it spirals
function drawSpaceFall(c, F, lv) {
  const t = c.fallT0 - c.fall, h = G.T.ev && G.T.ev.hole, S = G.T.space;
  let x = c.fx0 + (c.dvx || 0) * .45 * t * (1 - t / 2.6), y = c.fy0 + (c.dvy || 0) * .45 * t * (1 - t / 2.6);
  if (h && h.r > 4) {
    const hx = S.hole[0], hy = S.hole[1], d0 = Math.hypot(c.fx0 - hx, c.fy0 - hy);
    if (d0 < 260) { const a = Math.atan2(c.fy0 - hy, c.fx0 - hx) + t * 3, d = d0 * (1 - t * .6); x = hx + Math.cos(a) * d; y = hy + Math.sin(a) * d; }
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

// on the ground (under the cars): stars far away that move slower than the map, glowing edges, the wormhole, where asteroids will fly, the
// black hole, the lamps on the moon, glowing tyre tracks
function drawSpaceGround() {
  const T = G.T, S = T.space, ev = T.ev, [plx, ply, , , pr1] = S.planet, [ex, ey, er] = S.earth;
  // the parallax stars: three layers, the far ones move least
  for (const L of STARS) {
    const [n, f, col] = /** @type {[number, number, string]} */ (L);
    for (let s = 0; s < n; s++) {
      const W2 = VW + 30, H2 = VH + 30, sx = ((hash(s, 1, n) * W2 - cam.x * f) % W2 + W2) % W2 - 15, sy = ((hash(s, 2, n) * H2 - cam.y * f) % H2 + H2) % H2 - 15;
      const x = Math.round(cam.x + sx), y = Math.round(cam.y + sy); if (x < 0 || y < 0 || x >= T.W || y >= T.H) continue;
      const j = y * T.W + x; if (T.ter[j] !== 0 || S.kind[j] || Math.hypot(x - plx, y - ply) < pr1 + 2 || Math.hypot(x - ex, y - ey) < er + 4) continue;
      R1(x, y, 1, 1, col);
    }
  }
  // the edges of the platforms and the ring glitter
  const k = Math.floor(G.time * 6);
  for (let q = 0; q < 40 && S.glowPix.length; q++) { const p = S.glowPix[(hash(q, k, 132) * S.glowPix.length) | 0]; R1(p % T.W, (p / T.W) | 0, 1, 1, '#e8ffff'); }
  // the force fields shimmer
  for (let q = 0; q < 30 && S.fieldPix.length; q++) { const p = S.fieldPix[(hash(q, k, 135) * S.fieldPix.length) | 0]; R1(p % T.W, (p / T.W) | 0, 1, 1, q % 2 ? '#ffffff' : '#5fe8ff'); }
  // the platforms near the black hole flash red in the last lap
  if (ev && ev.hole && lastLap() && ((G.time * 4) | 0) % 2) for (let q = 0; q < 60 && S.redPix.length; q++) { const p = S.redPix[(hash(q, k, 133) * S.redPix.length) | 0]; R1(p % T.W, (p / T.W) | 0, 2, 2, '#ff3b4a'); }
  // the lamps along the road over the moon
  for (const L of S.lamps) if (inView(L.x, L.y)) R1(L.x, L.y, 1, 1, ((G.time * 3 + L.k * .2) | 0) % 2 ? '#ffd23f' : '#7a5a10');
  // the airlock: the nozzles in the floor
  for (const z of S.nozzles) if (inView(z.x, z.y)) R1(Math.round(z.x) - 1, Math.round(z.y) - 1, 3, 3, ((G.time * 8) | 0) % 2 ? '#e8f4ff' : '#8a96ac');
  // the black hole: a dark middle, a bright disc round it that turns, stars pulled into streaks
  const h = ev && ev.hole, [hx, hy] = S.hole;
  if (h && h.r > .5 && inView(hx, hy, 120)) {
    const r = h.r;
    for (let q = 0; q < 26; q++) { const a = hash(q, 1, 134) * TAU + G.time * .4, d = r + 10 + hash(q, 2, 134) * 60; ctx.globalAlpha = .5; for (let s = 0; s < 6; s++) R1(Math.round(hx + Math.cos(a + s * .03) * (d - s * 2)), Math.round(hy + Math.sin(a + s * .03) * (d - s * 2) * .8), 1, 1, '#c8c8ff'); }
    ctx.globalAlpha = .3; ell(hx, hy, Math.round(r * 2.2), Math.round(r * 1.2), '#5a2a9a'); ctx.globalAlpha = .55; ell(hx, hy, Math.round(r * 1.7), Math.round(r * .9), '#ff9a4a'); ctx.globalAlpha = 1;
    for (let q = 0; q < 40; q++) { const a = q / 40 * TAU + G.time * 2.4; R1(Math.round(hx + Math.cos(a) * r * 1.5), Math.round(hy + Math.sin(a) * r * .8), 2, 1, q % 3 ? '#ffd27a' : '#ffffff'); }
    disc(hx, hy, Math.round(r), '#000000'); ctx.globalAlpha = .6; disc(hx, hy, Math.round(r) + 1, '#1a0a2a'); ctx.globalAlpha = 1; disc(hx, hy, Math.max(1, Math.round(r) - 1), '#000000');
  }
  // the wormhole: the purple mouth on its little platform, the turquoise one is where you come out
  const P = S.portals, rot = G.time * 5;
  if (inView(P.b.x, P.b.y)) swirl(P.b.x, P.b.y, 10, '#1fb8b0', '#9ffff0', -rot, '#0a0618');
  if (inView(S.ax, S.ay)) swirl(S.ax, S.ay, 11, '#8a3ad8', '#e0a8ff', rot, '#0a0618');
  // where asteroids will fly: a dashed line along their way, until they are past
  if (ev && ev.asts) for (const a of ev.asts) {
    if (a.t > AST.warn + .2 || !inView(a.tx, a.ty, 120)) continue;
    const v = Math.hypot(a.vx, a.vy) || 1, dx = a.vx / v, dy = a.vy / v, bl = ((G.time * 8) | 0) % 2;
    for (let s = -40; s < 260; s += 4) {
      if (((s + G.time * 60) % 16 + 16) % 16 > 8) continue;
      const x = a.tx - dx * (s - 120), y = a.ty - dy * (s - 120);
      R1(Math.round(x), Math.round(y), 2, 2, bl ? '#ff4a4a' : '#ffd0d0');
    }
  }
  // glowing tyre tracks (particles)
  for (const p of G.parts) if (p.t === 'glow') { ctx.globalAlpha = p.life / p.ml * .8; R1(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2, '#6ad8ff'); }
  ctx.globalAlpha = 1;
}

// above the cars: the roof of the glass tube, the turning ring of the station, the asteroids, falling cars in the tractor beam, the
// astronaut and the UFO, thruster puffs, the mist of the airlock, "SWING-BY!"
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
  // the blinking light of the satellite
  const [sx, sy] = S.sat; if (inView(sx, sy) && ((G.time * 2) | 0) % 2) { R1(sx - 1, sy - 11, 3, 3, '#ff4a4a'); ctx.globalAlpha = .3; disc(sx, sy - 10, 5, '#ff4a4a'); ctx.globalAlpha = 1; }
  // flying asteroids: a lumpy rock that turns
  if (ev && ev.asts) for (const a of ev.asts) {
    if (!inView(a.x, a.y)) continue;
    const x = Math.round(a.x), y = Math.round(a.y), r = a.r;
    ctx.globalAlpha = .25; disc(x + 6, y + 8, r, '#000'); ctx.globalAlpha = 1;
    disc(x, y, r + 1, '#2a2622'); disc(x, y, r, '#7a7268'); disc(x - Math.round(r / 3), y - Math.round(r / 3), Math.round(r / 2), '#958c80');
    for (let q = 0; q < 3; q++) { const ca = a.rot + q * 2.1, cr = r * .55; R1(Math.round(x + Math.cos(ca) * cr) - 1, Math.round(y + Math.sin(ca) * cr) - 1, 2 + (a.big ? 1 : 0), 2, '#4e4842'); }
    // a little fire trail behind it
    const v = Math.hypot(a.vx, a.vy) || 1; for (let s = 1; s < 5; s++) { ctx.globalAlpha = .4 - s * .08; disc(Math.round(a.x - a.vx / v * (r + s * 4)), Math.round(a.y - a.vy / v * (r + s * 4)), Math.max(1, r - s * 2), '#ffb04a'); }
    ctx.globalAlpha = 1;
  }
  // the astronaut floats over the middle and waves; now and then a UFO flies past
  const ax = Math.round(430 + Math.sin(G.time * .11) * 120), ay = Math.round(270 + Math.cos(G.time * .17) * 70);
  if (inView(ax, ay)) {
    const w = ((G.time * 3) | 0) % 2;
    R1(ax - 4, ay - 3, 9, 11, '#1b1e2a'); R1(ax - 3, ay - 2, 7, 9, '#f2f4f8'); R1(ax - 3, ay - 7, 7, 6, '#1b1e2a'); R1(ax - 2, ay - 6, 5, 4, '#f2f4f8'); R1(ax - 1, ay - 5, 3, 2, '#ffb04a');
    R1(ax + 4, ay - 3 - w * 2, 2, 4, '#f2f4f8'); R1(ax - 6, ay, 2, 4, '#f2f4f8'); R1(ax - 2, ay + 7, 2, 3, '#f2f4f8'); R1(ax + 1, ay + 7, 2, 3, '#f2f4f8'); R1(ax - 5, ay - 1, 2, 6, '#a8b0bc');
  }
  const u = (G.time % 23) / 2.6;
  if (u < 1) {
    const x = Math.round(cam.x - 30 + u * (VW + 60)), y = Math.round(cam.y + 34 + Math.sin(u * 9) * 8);
    ctx.globalAlpha = .2; ell(x + 14, y + 26, 10, 3, '#000'); ctx.globalAlpha = 1;
    ell(x, y, 12, 4, '#1b1e2a'); ell(x, y, 11, 3, '#a8b0bc'); ell(x, y - 3, 5, 3, '#7fd8ff'); R1(x - 2, y - 5, 2, 1, '#ffffff');
    for (let q = 0; q < 4; q++) R1(x - 8 + q * 5, y, 2, 1, ((G.time * 10 + q) | 0) % 2 ? '#ffd23f' : '#ff4a4a');
  }
  // puffs of the thrusters, the mist of the airlock, swirls of the wormhole
  for (const p of G.parts) {
    if (p.t === 'puff') { const f = p.life / p.ml; ctx.globalAlpha = f * .8; disc(Math.round(p.x), Math.round(p.y), Math.max(1, Math.round(3 - f * 2)), '#f2f8ff'); }
    else if (p.t === 'mist') { const f = p.life / p.ml; ctx.globalAlpha = f * .5; disc(Math.round(p.x), Math.round(p.y), Math.round(2 + (1 - f) * 5), '#ffffff'); }
    else if (p.t === 'warp') { ctx.globalAlpha = p.life / p.ml; R1(Math.round(p.x), Math.round(p.y), 2, 2, p.col); }
  }
  ctx.globalAlpha = 1;
  if (ev) for (const s of ev.swings) text('SWING-BY!', Math.round(s.x), Math.round(s.y - 22 - (1.2 - s.t) * 12), 8, '#5fe8ff', 'center');
}

// on the screen: red arrows at the edge where an asteroid comes from, the message when the black hole opens, its violet shimmer
function drawSpaceSky() {
  const T = G.T, ev = T.ev, P = G.player; if (!ev) return;
  if (ev.asts) for (const a of ev.asts) {
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
  const h = ev.hole;
  if (h && P) { const d = Math.hypot(P.x - T.space.hole[0], P.y - T.space.hole[1]); if (d < 340) { ctx.fillStyle = 'rgba(70,20,120,' + (.16 * (1 - d / 340)).toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH); } }
  if (ev.holeMsg > 0 && ((G.time * 4) | 0) % 2) text('SCHWARZES LOCH!', VW / 2, 34, 8, '#c8a0ff', 'center');
}

// ---------- hooks: how the core calls this track (hooks.js; what each hook does: _template.js) ----------
/** @type {import('./_template.js').TrackHooks} */
export const spaceHooks = {
  init: initSpace, events: { asteroiden: initAsteroids, schwarzesloch: initHole }, update: spaceUpdate, collisions: spaceCollisions,
  surf: c => c.surf === 0 ? [1, .3, .15, 0] : null, // nothing beside the road: no grip, no gas (the car drifts off)
  target: spaceTarget, lane: spaceLane, ground: spaceGround, noRespawn: t => t === 0, respawn: spaceRespawn,
  drawFall(c, F, lv) { if (c.fallKind !== 'space') return false; drawSpaceFall(c, F, lv); return true; }, // drifting off, then the tractor beam
  drawGround: drawSpaceGround, drawAbove: drawSpaceAbove, drawSky: drawSpaceSky,
};
