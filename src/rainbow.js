import { G } from './g.js';
import { SFX } from './audio.js';
import { HALF, LAPS, SS, TAU, VH, VW, clamp, ctx, hash, inRange, rotIndex } from './core.js';
import { R1, disc, ell, swirl } from './gfx.js';
import { WATC, addP } from './particles.js';
import { cam } from './state.js';
import { fallCar, inView, near } from './trackfx.js';
import { bctx, eventOn, snap } from './undo.js';
import { nearestIdx } from './bau.js';
import { darkRect } from './kit.js';
import { ASPH, CLOUD, HOLE, LANE, LIFT, RB, drawTiles } from './rainbowmap.js';

// ---------- Regenbogen Rev 2 while racing (the finale, plaene/REGENBOGEN_REV2.md) ----------
// Always: the six colour lanes work differently (red is fast, green grips, blue is slippery, violet is soft and brakes a little; orange and yellow
// are normal). Whoever gets over a cloud hole falls through the clouds, a unicorn catches the car and brings it back (after the gap of the arch
// behind the gap, after the crack of the platinum coin back before it). The arch makes the cars bigger the higher they are. On the bronze coin two
// cows graze on the road (switch kuehe), on the silver coin koi leap over the bridge (switch kois) and the cloud train crosses the road now and
// then (warning light; a ramp on the left half of the road jumps over it). The chair lift carries every car over the crevasse onto the platinum
// coin. The lava tube is dark inside. The liana carries you over the crack while it hangs on your side. The wormhole takes you over the next bend.
// Only the rain bay before the finish washes; whoever comes out of it clean leaves a glitter trail for a while.
// Event "einhorn": unicorns gallop through the air across the road and leave a rainbow trail (3 s) that works like a boost pad; whoever rams one
// spins. Lap 1 now and then, none in the storm, many in the last lap; hoofbeats and glitter at the edge of the screen before they come.
// Event "gewitter" (the story of the three laps): lap 1 a sunrise (the lanes are pale); from lap 2 a storm comes in from the right (dark, rain that
// makes the cars grey, more storm clouds on the road, the lanes go grey, lightning every 4 to 6 s after a yellow target circle, never on the coins
// and never at the gap of the arch); as soon as the leader goes into the last lap the sun breaks through: the storm clouds turn to glitter, the
// lanes work twice as hard, the double rainbow cuts the spiral short (no rails), fireworks.

const UNI = { speed: 175, reach: 190, hit: 14, trail: 3 }, BOLT = { warn: 1.5, r: 22, show: .3 }, STORM = { front: 5, grey: 3, spots: 1.6, rainDirt: .05, rainMax: .4 };
const WARP = { r: 10, cool: 1.2 }, LIFTC = { t: 1.15, v: 95 }, TRAIN = { first: 7, per: 15, warn: 2.4, v: 240, len: 110 }, LIANA = { per: 4.4, on: .35, swing: 38 };
const lap = () => G.player && !G.T.run ? G.player.lap : 0;
const lead = () => G.cars.reduce((m, c) => Math.max(m, c.lap), 0);
const dif = () => G.raceDiff || 0;

function initRainbow(T) {
  const ev = T.ev, def = T.def;
  Object.assign(ev, { rbUnis: [], rbTrail: [], rbUniOn: false, rbUniN: 0, rbUniNext: 6, rbStormOn: false, rbStorm: null, rbSun: null, rbBolts: [], rbFlash: 0, rbFw: [], rbFwNext: 0, rbDblT: 0, obst: [] });
  // the two cows of the bronze coin (like on the meadow, only slower)
  if (eventOn('kuehe')) ev.cows = (def.cows || []).map(([x, y, range, ph], k) => {
    const i = nearestIdx(T.path, x, y), tg = T.tan[i], a = ph * .45, ca = Math.cos(a), sa = Math.sin(a);
    return { bx: x, by: y, dx: tg.x * ca - tg.y * sa, dy: tg.x * sa + tg.y * ca, range, ph, x, y, face: k % 2 ? -1 : 1, graze: 0, cool: 0, k, sp: .3 };
  });
  // the koi of the silver coin leap across the bridge, from the pond on one side to the other
  if (eventOn('kois') && def.pond) {
    const i = nearestIdx(T.path, def.pond[0], def.pond[1]), p = T.path[i], n = T.nrm[i];
    ev.kois = [0, 1].map(k => ({ x: p.x + T.tan[i].x * (k ? 8 : -8), y: p.y + T.tan[i].y * (k ? 8 : -8), ang: Math.atan2(n.y, n.x) + (k ? Math.PI : 0), half: 44, per: 7.2 + k * 1.3, off: 2 + k * 3.1, p: -1, warn: -1, px: p.x, py: p.y, z: 0, k }));
  }
}

function initUnicorns(T) { T.ev.rbUniOn = true; }
function initThunder(T) { T.ev.rbStormOn = true; }

// how strongly a lane works: 1 normally; in the storm the colours go grey (red and blue keep a little); in the sun twice as strong
function laneK(ln) {
  const ev = G.T.ev; if (!ev) return 1;
  if (ev.rbSun) return 2;
  const g = ev.rbStorm ? ev.rbStorm.grey : 0;
  return ln === 0 || ln === 4 ? 1 - .6 * g : 1 - g;
}

// the ground under a car (physics.js): the lanes, the asphalt of the gold coin, a cloud hole (no grip, no gas), the cloud path, the lift station
function rainbowSurf(c) {
  const t = c.surf;
  if (t === ASPH || t === LIFT) return [1.03, 10, 1];
  if (t === HOLE) return [1, .3, .15, 0];
  if (t === CLOUD) return [.84, 6, .9];
  const ln = t - LANE, k = laneK(ln);
  if (ln === 0) return [1 + .08 * k, 10, 1];
  if (ln === 3) return [1, 10 + 5 * k, 1 + .06 * k];
  if (ln === 4) return [1, Math.max(2, 10 - 4.5 * k) * c.def.turn, Math.max(.5, 1 - .25 * k), Math.max(.5, 1 - .25 * k)];
  if (ln === 5) return [1 - .06 * k, 10, 1];
  return [1, 10, 1];
}

// the cloud train: where its head is (x) and whether it warns (null when there is none)
function trainAt(t) {
  const R = G.T.rainbow.train, u = t - TRAIN.first; if (u < 0) return null;
  const k = Math.floor(u / TRAIN.per), s = u - k * TRAIN.per;
  if (s < TRAIN.warn) return { warn: true, x: R.x0 - 4, k };
  const x = R.x0 + (s - TRAIN.warn) * TRAIN.v; return x - TRAIN.len > R.x1 ? null : { warn: false, x, k };
}
// the liana: its offset along the chord (negative: on the near side) and whether it can take a car now
const lianaS = t => Math.sin(t / LIANA.per * TAU);
const lianaOn = t => lianaS(t) > LIANA.on;

// ======================================================= always

function rainbowUpdate(T, dt) {
  const ev = T.ev, R = T.rainbow, P = R.portals;
  for (const c of G.cars) {
    c.warpT = Math.max(0, (c.warpT || 0) - dt);
    if (c.fall > 0 || c.z > 0 || c.warpT > 0 || c.rbLift || Math.hypot(c.x - P.a.x, c.y - P.a.y) > WARP.r) continue;
    // into the wormhole: out at the road behind the next bend, as fast, in the direction of the road
    const tg = T.tan[P.ib], sp = Math.max(70, Math.hypot(c.vx, c.vy));
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; addP({ t: 'warp', x: P.a.x + Math.cos(a) * 4, y: P.a.y + Math.sin(a) * 4, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: .5, ml: .5, col: '#c46bff' }); }
    c.x = P.b.x; c.y = P.b.y; c.vx = tg.x * sp; c.vy = tg.y * sp; c.ang = Math.atan2(tg.y, tg.x); c.idx = P.ib; c.warpT = WARP.cool; c.okX = c.x; c.okY = c.y; c.rbWay = null;
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; addP({ t: 'warp', x: c.x, y: c.y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: .6, ml: .6, col: '#4ff0e0' }); }
    if (!c.ai || near(c.x, c.y) < 300) SFX.warp(c.ai ? .4 : 1);
  }
  // the liana: on while it hangs on the near side of the crack
  const lj = T.jumps.find(J => J.liana); if (lj) lj.off = !lianaOn(ev.t);
  // the cloud train: the warning light blinks, a bell; it comes out of its cloud bank
  const tr = trainAt(ev.t), was = R.trainK;
  if (tr && tr.warn && was !== tr.k) { R.trainK = tr.k; if (near(R.train.cross, R.train.y) < 360) SFX.whistle(.6); }
  R.tr = tr;
  // the little rain cloud over the bay and the shower of the pier (only drops)
  const B = R.bay; if (inView(B.x, B.y, 60)) for (let q = 0, n = dt * 50 + Math.random(); q < n && q < 3; q++) addP({ t: 'd', x: B.x + (Math.random() - .5) * 80, y: B.y + (Math.random() - .5) * 18, z: 26, vx: 0, vy: 0, vz: -60, col: WATC[(Math.random() * 4) | 0], s: 1, life: 1, ml: 1 });
  if (R.pier && inView(R.pier.x, R.pier.y, 30) && Math.random() < dt * 14) addP({ t: 'd', x: R.pier.x - 5 + (Math.random() - .5) * 4, y: R.pier.y, z: 14, vx: 0, vy: 0, vz: -40, col: WATC[(Math.random() * 4) | 0], s: 1, life: .5, ml: .5 });
  // where the player is: on a coin (the leitmotifs of the song), in the lava tube
  const pl = G.player;
  if (pl) { const j = clamp(pl.y | 0, 0, T.H - 1) * T.W + clamp(pl.x | 0, 0, T.W - 1); R.isle = pl.fall > 0 ? -1 : R.isleOf(j); R.inTube = !!R.tubeM[j] && pl.fall <= 0; }
  if (ev.rbUniOn) updateUnicorns(T, dt);
  if (ev.rbStormOn) updateStorm(T, dt);
  ev.rbFlash = Math.max(0, ev.rbFlash - dt * 3);
  // the computer cars steer round unicorns that are about to cross in front of them
  ev.obst = ev.rbUnis.filter(u => u.t > .3 && u.t < u.dur - .3);
}

// the ground under a car (update.js): falling through a hole, the lift, the brown mud of the bronze coin, the arch, kerbs, the bay and the
// glitter trail, the rain of the storm, sparks after a lightning strike
function rainbowGround(c, j, sp, dt) {
  const T = G.T, R = T.rainbow, ev = T.ev, N = T.N, A = R.arch;
  if (c.rbLift) { c.holeT = 0; return; } // (on the lift over the crevasse: it hangs on the cable)
  if (c.surf === HOLE) {
    c.holeT = (c.holeT || 0) + dt;
    if (c.holeT > .12) {
      c.holeT = 0; c.lift = 0; c.rbWay = null;
      const cr = R.crack, atCrack = Math.hypot(c.x - cr.x, c.y - cr.y) < 80;
      fallCar(c, 'cloud', inRange(c.idx, (A.g0 - 4 + N) % N, (A.g1 + 4) % N) ? A.landI : atCrack ? R.ways.liana.i0 : inRange(c.idx, (R.lift.s0 - 4 + N) % N, R.lift.land) ? R.lift.land : undefined);
      return;
    }
  } else c.holeT = 0;
  // the station of the lift: hooked on at once (no physics until it is over the crevasse, rainbowStuck)
  if (c.surf === LIFT && !c.rbLift) { liftIn(c); return; }
  // mud on the bronze coin is brown (the second set of sprites); the storm clouds make the car grey
  if (c.surf === 2 && R.brown[j]) c.cem = true;
  // the arch: the higher the car, the bigger it is drawn (its shadow falls far away, see draw.js)
  if (inRange(c.idx, A.a0, A.a1) && c.off < HALF + 8) c.lift = Math.sin(Math.PI * ((c.idx - A.a0 + N) % N) / ((A.a1 - A.a0 + N) % N));
  else c.lift = Math.max(0, (c.lift || 0) - dt * 3);
  c.kerb = !!R.kerb[j];
  // the rain bay: whoever comes out of it clean leaves a glitter trail in all colours for a while (about half a lap)
  if (c.washing) c.inShower = true;
  else if (c.inShower) { c.inShower = false; if (c.dirt < .05) { c.glitter = 14; if (!c.ai) SFX.glitter(1); } }
  if (c.glitter > 0) {
    c.glitter -= dt;
    if (sp > 20 && Math.random() < dt * 34) addP({ t: 'glit', x: c.x - Math.cos(c.ang) * 13 + (Math.random() - .5) * 8, y: c.y - Math.sin(c.ang) * 13 + (Math.random() - .5) * 8, vx: 0, vy: 0, life: .9, ml: .9, col: RB[(Math.random() * 6) | 0] });
  }
  // the rain of the storm makes the cars grey (like the storm clouds; it does not wash any more, Grundsatz 13), not in the bay, not in the tube
  if (ev && ev.rain && !c.washing && !R.tubeM[j] && c.dirt < STORM.rainMax) { c.dirt = Math.min(STORM.rainMax, c.dirt + STORM.rainDirt * dt); c.cem = false; }
  // after a lightning strike: zig-zag sparks round the car
  if (c.zap > 0) { c.zap -= dt; if (Math.random() < dt * 30) addP({ t: 'spark', x: c.x + (Math.random() - .5) * 26, y: c.y + (Math.random() - .5) * 20, vx: 0, vy: 0, life: .2, ml: .2 }); }
}

// the chair lift: the car is hooked on at the station and carried over the crevasse (no physics, no collisions with other cars)
function liftIn(c) {
  const T = G.T, L = T.rainbow.lift, i = c.idx, o = clamp((c.x - T.path[i].x) * T.nrm[i].x + (c.y - T.path[i].y) * T.nrm[i].y, -14, 14);
  c.rbLift = { s: 0, x0: c.x, y0: c.y, o, i0: i }; c.vx = c.vy = 0; c.rbWay = null;
  const p = T.path[L.land]; c.ang = Math.atan2(p.y - c.y, p.x - c.x);
  if (!c.ai || near(c.x, c.y) < 260) SFX.lift();
}
function liftStep(c, dt) {
  const T = G.T, L = T.rainbow.lift, Lf = c.rbLift, N = T.N, p = T.path[L.land], n = T.nrm[L.land];
  Lf.s = Math.min(1, Lf.s + dt / LIFTC.t);
  const tx = p.x + n.x * Lf.o, ty = p.y + n.y * Lf.o, s = Lf.s;
  c.x = Lf.x0 + (tx - Lf.x0) * s; c.y = Lf.y0 + (ty - Lf.y0) * s; c.lift = .25 + .45 * Math.sin(Math.PI * s);
  c.idx = (Lf.i0 + Math.round(((L.land - Lf.i0 + N) % N) * s)) % N; c.ghost = Math.max(c.ghost, .15); c.vx = c.vy = 0; c.off = 0;
  if (s >= 1) { const tg = T.tan[L.land]; c.rbLift = null; c.vx = tg.x * LIFTC.v; c.vy = tg.y * LIFTC.v; c.ang = Math.atan2(tg.y, tg.x); c.safe = L.land; c.surf = 1; }
}
function rainbowStuck(c, dt) {
  if (!c.rbLift) return false;
  liftStep(c, dt); return true;
}

// back from a cloud hole: the unicorn sets the car down, it glitters
function rainbowRespawn(c) {
  c.rbWay = null;
  for (let k = 0; k < 18; k++) { const a = k / 18 * TAU; addP({ t: 'glit', x: c.x + Math.cos(a) * 16, y: c.y + Math.sin(a) * 12, vx: -Math.cos(a) * 24, vy: -Math.sin(a) * 24, life: .7, ml: .7, col: RB[k % 6] }); }
  if (!c.ai || near(c.x, c.y) < 260) SFX.neigh(c.ai ? .3 : 1);
}

// the cloud train against the cars: whoever is on the rails when it comes is pushed along and spins (in the air over the ramp: no)
function rainbowCollisions() {
  const T = G.T, R = T.rainbow, ev = T.ev; if (!ev) return;
  const tr = R.tr;
  if (tr && !tr.warn) for (const c of G.cars) {
    if (c.z > 6 || c.fall > 0 || c.rbLift || Math.abs(c.y - R.train.y) > 11 || c.x < tr.x - TRAIN.len - 6 || c.x > tr.x + 6 || (c.trainHit || 0) > ev.t) continue;
    c.trainHit = ev.t + 1.2; c.vx = TRAIN.v * .7; c.vy = (c.y < R.train.y ? -1 : 1) * 60; c.spin = 12; c.stun = 1.1; c.boost = 0;
    if (!c.ai) { SFX.crash(); G.jumpShake = Math.max(G.jumpShake, .35); } else if (near(c.x, c.y) < 260) SFX.bump();
  }
  // a car rams a unicorn: thrown aside like by a cow
  for (const u of ev.rbUnis) for (const c of G.cars) {
    if (c.z > 0 || c.fall > 0 || c.ghost > 0 || u.hits.includes(c)) continue;
    const dx = c.x - u.x, dy = c.y - u.y, d = Math.hypot(dx, dy); if (d > UNI.hit || !d) continue;
    u.hits.push(c);
    c.vx = dx / d * 150 + u.vx * .3; c.vy = dy / d * 150 + u.vy * .3; c.spin = 12; c.stun = 1.1; c.boost = 0;
    if (!c.ai) { SFX.crash(); SFX.neigh(1); } else if (near(c.x, c.y) < 260) SFX.bump();
  }
}

// ======================================================= event "einhorn"

// how many unicorns: lap 1 now and then, none in the storm, many in the last lap (the feast)
const uniGap = () => { const ev = G.T.ev; if (ev.rbSun) return [2.2, 1.6]; if (ev.rbStorm || lap() >= 2) return null; return [9, 4]; };

function spawnUnicorn(T, n) {
  const R = T.rainbow, N = T.N, P = G.player;
  let i = P && hash(n, 1, 151) < .6 ? (P.idx + 70 + Math.floor(hash(n, 2, 151) * 90)) % N : Math.floor(hash(n, 3, 151) * N);
  // only over the rainbow road (not over the coins, not at the arch)
  for (let k = 0; k < 300; k += 6) { const q = (i + k) % N, p = T.path[q], j = (p.y | 0) * T.W + (p.x | 0); if (R.lane[j] && !inRange(q, R.arch.a0, R.arch.a1)) { i = q; break; } if (k >= 294) return null; }
  const p = T.path[i], nm = T.nrm[i], s = hash(n, 4, 151) < .5 ? 1 : -1, tilt = (hash(n, 5, 151) - .5) * .7;
  const dx = -nm.x * s * Math.cos(tilt) - nm.y * s * Math.sin(tilt), dy = -nm.y * s * Math.cos(tilt) + nm.x * s * Math.sin(tilt);
  return { x: p.x - dx * UNI.reach, y: p.y - dy * UNI.reach, vx: dx * UNI.speed, vy: dy * UNI.speed, t: 0, dur: 2 * UNI.reach / UNI.speed, id: n, hits: [], neigh: false, last: null };
}

function updateUnicorns(T, dt) {
  const ev = T.ev, gap = uniGap();
  if (!gap) ev.rbUniNext = Math.max(ev.rbUniNext, ev.t + 1);
  else while (ev.t >= ev.rbUniNext) {
    const n = ev.rbUniN++, u = spawnUnicorn(T, n); if (u) ev.rbUnis.push(u);
    ev.rbUniNext += gap[0] + hash(n, 6, 151) * gap[1];
  }
  for (const u of ev.rbUnis) {
    u.t += dt; u.x += u.vx * dt; u.y += u.vy * dt;
    if (!u.neigh && near(u.x, u.y) < 280) { u.neigh = true; SFX.neigh(.45); }
    if (!u.hoof && near(u.x, u.y) < 420) { u.hoof = true; SFX.clack(); }
    // the rainbow trail behind it, only where it crosses the road
    const j = clamp(u.y | 0, 0, T.H - 1) * T.W + clamp(u.x | 0, 0, T.W - 1);
    if (T.dist[j] < HALF + 3 && (!u.last || Math.hypot(u.x - u.last.x, u.y - u.last.y) >= 4)) { u.last = { x: u.x, y: u.y, t: UNI.trail, id: u.id, a: Math.atan2(u.vy, u.vx) }; ev.rbTrail.push(u.last); }
  }
  ev.rbUnis = ev.rbUnis.filter(u => u.t < u.dur);
  ev.rbTrail = ev.rbTrail.filter(q => (q.t -= dt) > 0);
  // over the trail: a boost (once per trail)
  for (const c of G.cars) {
    if (c.fall > 0 || c.z > 0) continue;
    for (const q of ev.rbTrail) if (c.trailId !== q.id && Math.abs(c.x - q.x) < 9 && Math.abs(c.y - q.y) < 9) { c.trailId = q.id; c.boost = Math.max(c.boost, 1.2); if (!c.ai || near(c.x, c.y) < 260) SFX.boost(c.ai ? .3 : 1); break; }
  }
}

// ======================================================= event "gewitter"

function updateStorm(T, dt) {
  const ev = T.ev, R = T.rainbow;
  // the last lap: the sun breaks through (as soon as the leader is in it)
  if (!ev.rbSun && lead() >= LAPS && G.state === 'race') sunBreak(T);
  if (ev.rbSun) { updateSun(T, dt); return; }
  if (!ev.rbStorm) {
    if (lap() < 2) return;
    ev.rbStorm = { t: 0, grey: 0, spot: 0, next: STORM.front * .6, n: 0, rumble: 6 };
    SFX.thunder();
  }
  const s = ev.rbStorm; s.t += dt;
  s.grey = clamp((s.t - 1) / STORM.grey, 0, 1);
  // the front of dark clouds comes in from the right; behind it it rains
  const fx = T.W + 60 - s.t / STORM.front * (T.W + 120);
  if (!ev.rain && fx < cam.x + VW / 2) { ev.rain = { t: 0, snd: 7 }; SFX.rain(); }
  if (ev.rain) { ev.rain.t += dt; if ((ev.rain.snd -= dt) <= 0) { ev.rain.snd = 7; SFX.rain(); } }
  if ((s.rumble -= dt) <= 0) { s.rumble = 8 + hash(s.n, 9, 161) * 4; SFX.thunder(); }
  // more storm clouds on the road, one after the other
  while (s.spot < R.stormSpots.length && s.t > STORM.front * .6 + s.spot * STORM.spots) stormSpot(T, R.stormSpots[s.spot++]);
  // lightning: a yellow circle first, then the strike
  while (s.t >= s.next) { const b = boltAt(T, s.n++); if (b) ev.rbBolts.push(b); s.next += 4 + hash(s.n, 3, 161) * 2; }
  for (const b of ev.rbBolts) { b.t += dt; if (!b.hit && b.t >= BOLT.warn) strike(T, b); }
  ev.rbBolts = ev.rbBolts.filter(b => b.t < BOLT.warn + BOLT.show);
}

function stormSpot(T, sp) {
  if (!sp.px.length) return;
  snap(T, sp.box[0], sp.box[1], sp.box[2], sp.box[3]); // the ground under it (and this snapshot puts it back after the race)
  for (const j of sp.px) T.ter[j] = 2;
  sp.on = true; T.mudPix = T.mudPix.concat(sp.px);
  if (near(sp.x, sp.y) < 320) for (let k = 0; k < 14; k++) addP({ t: 'puff', x: sp.x + (Math.random() - .5) * 40, y: sp.y + (Math.random() - .5) * 24, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, life: .8, ml: .8 });
}

// where the next lightning strikes: on the road ahead of you (or of a computer car), never on a coin, never at the arch, never in the tube
function boltAt(T, n) {
  const R = T.rainbow, N = T.N, A = R.arch, cs = G.cars.filter(c => c.ai), c = n % 3 === 2 && cs.length ? cs[Math.floor(hash(n, 1, 162) * cs.length)] : G.player; if (!c) return null;
  for (let k = 0; k < 6; k++) {
    const i = (c.idx + 45 + Math.floor(hash(n, 2, 162) * 70) + k * 30) % N, p = T.path[i], o = (hash(n, 3, 162) - .5) * 40;
    if (inRange(i, (A.a0 - 20 + N) % N, (A.a1 + 20) % N)) continue;
    const x = p.x + T.nrm[i].x * o, y = p.y + T.nrm[i].y * o, j = (y | 0) * T.W + (x | 0);
    if (!R.coin[j] && T.ter[j] !== HOLE) return { x, y, t: 0, hit: false, seed: n };
  }
  return null;
}

function strike(T, b) {
  const ev = T.ev; b.hit = true;
  const d = near(b.x, b.y); if (d < 420) { SFX.strike(clamp(1 - d / 420, .25, 1)); ev.rbFlash = Math.max(ev.rbFlash, clamp(1 - d / 500, .2, 1)); }
  for (let k = 0; k < 16; k++) addP({ t: 'spark', x: b.x + (Math.random() - .5) * 30, y: b.y + (Math.random() - .5) * 24, vx: (Math.random() - .5) * 60, vy: (Math.random() - .5) * 60, life: .35, ml: .35 });
  for (const c of G.cars) {
    if (c.fall > 0 || c.z > 0 || c.rbLift || Math.hypot(c.x - b.x, c.y - b.y) > BOLT.r) continue;
    // electric: it turns, it is grey, sparks fly for a moment
    c.zap = 1.4; c.spin = (hash(b.seed, c.seed | 0, 163) < .5 ? -1 : 1) * 10; c.stun = .9; c.vx *= .3; c.vy *= .3; c.boost = 0; c.dirt = 1; c.cem = false;
    if (!c.ai) { SFX.zap(); G.jumpShake = Math.max(G.jumpShake, .4); }
  }
}

// the sun breaks through: rain stops, storm clouds turn to glitter, the double rainbow opens, fireworks
function sunBreak(T) {
  const ev = T.ev, R = T.rainbow, b = bctx(T);
  ev.rbSun = { t: 0 }; ev.rain = null; ev.rbBolts = [];
  const glitter = (x, y) => { if (near(x, y) < 340) for (let k = 0; k < 24; k++) addP({ t: 'glit', x: x + (Math.random() - .5) * 50, y: y + (Math.random() - .5) * 30, vx: (Math.random() - .5) * 30, vy: -10 - Math.random() * 30, life: 1.2, ml: 1.2, col: RB[k % 6] }); };
  // the storm clouds that the storm brought
  for (const sp of R.stormSpots) if (sp.on) { sp.on = false; for (const j of sp.px) T.ter[j] = LANE + R.lane[j] - 1; glitter(sp.x, sp.y); }
  // the storm clouds that were always there: the clean rainbow under them is painted back
  const W = T.W, done = new Set();
  for (const j of R.stormPix) {
    if (done.has(j)) continue;
    const x = j % W, y = j / W | 0, x0 = Math.max(0, x - 40), y0 = Math.max(0, y - 40), w = Math.min(80, W - x0), h = Math.min(80, T.H - y0);
    snap(T, x0, y0, w, h); drawTiles(b, R.clean, x0, y0, w, h);
    for (const q of R.stormPix) { const qx = q % W, qy = q / W | 0; if (qx >= x0 && qx < x0 + w && qy >= y0 && qy < y0 + h) { done.add(q); T.ter[q] = LANE + R.lane[q] - 1; } }
    glitter(x, y);
  }
  T.mudPix = T.mudPix.filter(j => T.ter[j] === 2);
  // the double rainbow: a second, narrower road over the cloud gorge (no rails)
  const D = R.dbl; snap(T, D.pic.x, D.pic.y, D.pic.c.width, D.pic.c.height);
  D.pix.forEach((j, q) => { T.ter[j] = LANE + D.lanes[q]; });
  ev.rbDblT = 0; ev.rbFwNext = .5;
  SFX.sunburst();
}

function updateSun(T, dt) {
  const ev = T.ev; ev.rbSun.t += dt; ev.rbDblT += dt;
  // fireworks over the screen (at most 6 at once)
  if ((ev.rbFwNext -= dt) <= 0) {
    ev.rbFwNext = .7 + Math.random() * .8;
    if (ev.rbFw.length < 6) ev.rbFw.push({ x: 40 + Math.random() * (VW - 80), y: VH + 4, vy: -(150 + Math.random() * 60), top: 40 + Math.random() * 90, col: RB[(Math.random() * 6) | 0], bang: false, t: 0, parts: [] });
  }
  for (const f of ev.rbFw) {
    f.t += dt;
    if (!f.bang) { f.y += f.vy * dt; if (f.y <= f.top) { f.bang = true; f.t = 0; for (let k = 0; k < 26; k++) { const a = k / 26 * TAU, v = 50 + Math.random() * 30; f.parts.push({ x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v }); } SFX.firework(.5); } }
    else for (const q of f.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 40 * dt; q.vx *= .98; }
  }
  ev.rbFw = ev.rbFw.filter(f => !f.bang || f.t < 1.4);
}

// ======================================================= the computer cars

// the ways of their own: the cloud path (the better ones), the liana (when it will hang on this side as the car gets there), the rain bay (only
// dirty), the wormhole (some of them), the double rainbow (in the last lap, from MITTEL on)
function rainbowTarget(c) {
  const T = G.T, R = T.rainbow, ev = T.ev, N = T.N; if (!R || c.finished || (G.state !== 'race' && G.state !== 'finish') || !ev || c.rbLift) { c.rbWay = null; return null; }
  const P = R.portals, wa = (P.ia - c.idx + N) % N;
  if (c.warpTry && wa > 0 && wa < 50 && c.warpT <= 0 && !c.rbWay) return [P.a.x, P.a.y];
  if (!c.rbWay && !c.dblWay) {
    const d = dif(), coin = (c.seed * 4.7 + c.lap * .31) % 1, ahead = i => (i - c.idx + N) % N, W = R.ways;
    const pick = (way, kind, yes) => { if (!c.rbWay && ahead(way.i0) >= 2 && ahead(way.i0) < 20 && yes) c.rbWay = { P: way.pts, k: 0, kind }; };
    pick(W.cloud, 'cloud', coin < [0, .25, .55][d]);
    if (ahead(W.liana.i0) >= 2 && ahead(W.liana.i0) < 20) {
      const sp = Math.max(60, Math.hypot(c.vx, c.vy)), eta = (ahead(W.liana.i0) * 2 + 100) / sp;
      pick(W.liana, 'liana', coin < [.15, .45, .75][d] && lianaOn(ev.t + eta) && lianaOn(ev.t + eta + .25));
    }
    pick(W.bay, 'bay', c.dirt > [.4, .55, .7][d]);
  }
  if (c.rbWay) {
    const Wy = c.rbWay, Pp = Wy.P; let k = Wy.k, bd = 1e9;
    for (let q = Wy.k; q < Math.min(Pp.length, Wy.k + 30); q++) { const dd = (Pp[q].x - c.x) ** 2 + (Pp[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
    Wy.k = k;
    if (k >= Pp.length - 5 || bd > 70 * 70) { c.rbWay = null; return null; }
    // (thrown off the way, by a unicorn say: back onto it at the nearest point first, not straight at a point further on behind a coin)
    const tp = Pp[Math.min(Pp.length - 1, k + (bd > 22 * 22 ? 2 : 9))];
    return [tp.x, tp.y];
  }
  const D = R.dbl;
  if (!c.dblWay) {
    if (!ev.rbSun || ev.rbDblT < 1) return null;
    const ahead = (D.i0 - c.idx + N) % N; if (ahead < 2 || ahead > 24 || c.dblNo === c.lap) return null;
    c.dblNo = c.lap;
    if ((c.seed * 4.7 + c.lap * .29) % 1 > [0, .55, .8][dif()]) return null;
    c.dblWay = true; c.dK = 0;
  }
  let k = c.dK, bd = 1e9;
  for (let q = c.dK; q < Math.min(D.pts.length, c.dK + 30); q++) { const dd = (D.pts[q].x - c.x) ** 2 + (D.pts[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  c.dK = k;
  if (k >= D.pts.length - 6 || bd > (k < 8 ? 70 * 70 : 40 * 40)) { c.dblWay = false; return null; }
  const t = D.pts[Math.min(D.pts.length - 1, k + 9)];
  return [t.x, t.y];
}

// on the rainbow they keep to the red side; to the ramp at the cloud train when it comes; away from lightning circles; some aim for the wormhole
function rainbowLane(c, i, lane) {
  const T = G.T, R = T.rainbow, ev = T.ev, N = T.N, p = T.path[i], n = T.nrm[i];
  const P = R.portals, ahead = (P.ia - c.idx + N) % N;
  if (ahead > 40 && ahead < 90 && c.warpLap !== c.lap) { c.warpLap = c.lap; c.warpTry = (c.seed * 3.3 + c.lap * .41) % 1 < [.1, .3, .5][dif()]; }
  const j = (p.y | 0) * T.W + (p.x | 0);
  if (R.lane[j]) lane = clamp(lane - 13, -18, 14);
  // the cloud train: the left half (the ramp) when it will be at the crossing
  const ra = (R.train.rampI - c.idx + N) % N;
  if (ra < 70 && ra > 0) { const sp = Math.max(50, Math.hypot(c.vx, c.vy)), eta = ra * 2 / sp, tr = trainAt(ev.t + eta); if (tr && (tr.warn || tr.x - TRAIN.len < R.train.cross + HALF)) lane = -16; }
  if (ev && ev.rbBolts) for (const b of ev.rbBolts) {
    if (b.hit) continue;
    const x = p.x + n.x * lane, y = p.y + n.y * lane; if (Math.hypot(x - b.x, y - b.y) > BOLT.r + 8) continue;
    const o = (b.x - p.x) * n.x + (b.y - p.y) * n.y; return clamp(o > 0 ? o - 32 : o + 32, -24, 24);
  }
  return lane;
}

// up the arch nearly everybody goes at full throttle (a few do not, and fall through the gap); the liana and the cloud path at speed; slow in the bay
function rainbowThrottle(c, thr) {
  const A = G.T.rainbow.arch, W = c.rbWay;
  if (W && W.kind === 'bay') return Math.min(thr, .6);
  if (W && W.kind === 'liana') return Math.max(thr, .95);
  if (inRange(c.idx, A.a0, A.g0) && (c.seed * 7.7 + c.lap * .31) % 1 > .12) return Math.max(thr, .97);
  return thr;
}

// a car far from the centre line: on a way of its own it counts for the index of its way point; on the double rainbow along it; else near its index
function rainbowProgress(c, best) {
  const T = G.T, R = T.rainbow, N = T.N, j = clamp(c.y | 0, 0, T.H - 1) * T.W + clamp(c.x | 0, 0, T.W - 1), w = R.wayM[j];
  const nearPt = pts => { let b = 0, bd = 1e12; for (let k = 0; k < pts.length; k += 2) { const dd = (pts[k].x - c.x) ** 2 + (pts[k].y - c.y) ** 2; if (dd < bd) { bd = dd; b = k; } } return pts[b].i; };
  if (w === 1) return nearPt(R.ways.cloud.pts);
  if (w === 2) return nearPt(R.ways.bay.pts);
  if (w === 4) return nearPt(R.ways.liana.pts);
  const D = R.dbl;
  if (D && T.ter[j] >= LANE && T.ter[j] < LANE + 6 && !R.lane[j]) { let b = 0, bd = 1e12; for (let k = 0; k < D.pts.length; k += 3) { const dd = (D.pts[k].x - c.x) ** 2 + (D.pts[k].y - c.y) ** 2; if (dd < bd) { bd = dd; b = k; } } return (D.i0 + Math.round(((D.i1 - D.i0 + N) % N) * b / (D.pts.length - 1))) % N; }
  if ((best - c.idx + N) % N < 200 || (c.idx - best + N) % N < 200) return best;
  let b = c.idx, bd = 1e12; for (let k = -200; k <= 200; k++) { const i = (c.idx + k + N) % N, p = T.path[i], dd = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (dd < bd) { bd = dd; b = i; } }
  return b;
}

// ======================================================= drawing

// a unicorn in the air: white, a mane in all colours, a golden horn; legs galloping
function drawUnicorn(x, y, f, k, alpha = 1) {
  const O = '#3a2a4a', W = '#ffffff', W2 = '#e8e4f4', step = ((G.time * 10 + k) | 0) % 2;
  const P = (dx, dy, w, h, c) => R1(f > 0 ? x + dx : x - dx - w, y + dy, w, h, c);
  ctx.globalAlpha = alpha;
  P(-8 + step, 3, 2, 4, O); P(-5 - step, 3, 2, 4, O); P(2 - step, 3, 2, 4, O); P(5 + step, 3, 2, 4, O);
  P(-8 + step, 3, 1, 3, W2); P(-5 - step, 3, 1, 3, W2); P(2 - step, 3, 1, 3, W2); P(5 + step, 3, 1, 3, W2);
  P(-10, -5, 17, 9, O); P(-9, -4, 15, 7, W); P(-9, 1, 15, 2, W2);
  P(5, -10, 7, 8, O); P(6, -9, 5, 6, W); P(10, -6, 3, 3, W); P(11, -5, 2, 2, '#ffc2d6'); P(8, -8, 1, 1, O);
  P(9, -14, 1, 4, '#ffd23f'); P(10, -13, 1, 2, '#ffe88a');
  for (let q = 0; q < 6; q++) P(3 - q, -10 + q, 2, 2, RB[q]);
  for (let q = 0; q < 6; q++) P(-12 - (q >> 1), -4 + q, 2, 1, RB[q]);
  ctx.globalAlpha = 1;
}

// a car that fell through a cloud hole: it gets smaller and fades into the deep, then a unicorn swoops down and carries it up
function drawRainbowFall(c, F, lv) {
  const t = c.fallT0 - c.fall;
  if (t < .55) {
    const s = 1 - t / .55 * .7, S = Math.max(4, Math.round(SS * s));
    ctx.globalAlpha = 1 - t / .55 * .7; ctx.drawImage(F.frames[lv][rotIndex(c.ang + t * 4)], Math.round(c.fx0 - S / 2), Math.round(c.fy0 - S / 2 + t * 14), S, S); ctx.globalAlpha = 1;
    return;
  }
  const u = (t - .55) / .85, x = Math.round(c.fx0 + (1 - u) * 60 - 20), y = Math.round(c.fy0 + 10 - Math.sin(u * Math.PI) * 26), S = Math.round(SS * (.4 + u * .4));
  ctx.globalAlpha = Math.min(1, u * 3); ctx.drawImage(F.frames[lv][rotIndex(c.ang)], x - (S >> 1), y + 6 - (S >> 1), S, S); ctx.globalAlpha = 1;
  drawUnicorn(x, y - 8, -1, 0);
  for (let q = 0; q < 6; q++) R1(x + 14 + q * 3, y - 6 + Math.round(Math.sin(G.time * 12 + q) * 2), 2, 6, RB[q]);
}

// far below in the holes: three layers of little clouds drifting slower than the map (parallax, 1S15-2)
const FAR = [[40, .2, '#9aa8e0'], [34, .35, '#b2bff0'], [22, .55, '#d8e0ff']];

// on the ground (under the cars): far clouds in the holes, the grey or glowing lanes, the storm clouds of the storm, the double rainbow, unicorn
// trails, lightning circles, the wormhole, the rails of the train (the train itself is drawn above)
function drawRainbowGround() {
  const T = G.T, R = T.rainbow, ev = T.ev;
  const x0 = clamp(Math.round(cam.x) - 20, 0, T.W - 1), y0 = clamp(Math.round(cam.y) - 20, 0, T.H - 1), w = Math.min(VW + 40, T.W - x0), h = Math.min(VH + 40, T.H - y0);
  for (const L of FAR) {
    const [n, f, col] = /** @type {[number, number, string]} */ (L);
    for (let s = 0; s < n; s++) {
      const W2 = VW + 60, H2 = VH + 60, sx = ((hash(s, 1, n) * W2 - cam.x * f + G.time * 4 * (1 - f)) % W2 + W2) % W2 - 30, sy = ((hash(s, 2, n) * H2 - cam.y * f) % H2 + H2) % H2 - 30;
      const x = Math.round(cam.x + sx), y = Math.round(cam.y + sy), len = Math.round(3 + 5 * f); if (x < 2 || y < 0 || x >= T.W - 10 || y >= T.H) continue;
      if (T.ter[y * T.W + x] !== HOLE || T.ter[y * T.W + x + len] !== HOLE) continue;
      R1(x, y, len, 1, col); R1(x + 1, y - 1, len - 2, 1, col);
    }
  }
  if (ev && ev.rbStormOn) {
    // lap 1 the lanes are pale (an early rainbow), in the storm grey; in the sun they glow
    const a = ev.rbSun ? 0 : ev.rbStorm ? .3 + .62 * ev.rbStorm.grey : .3;
    if (a > 0) { ctx.globalAlpha = a; drawTiles(ctx, R.grey, x0, y0, w, h); ctx.globalAlpha = 1; }
    if (ev.rbSun) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .16 + .06 * Math.sin(G.time * 3); drawTiles(ctx, R.clean, x0, y0, w, h); ctx.restore(); }
  }
  if (ev) for (const sp of R.stormSpots) if (sp.on && inView(sp.x, sp.y, 80)) ctx.drawImage(sp.pic.c, sp.pic.x, sp.pic.y);
  // the double rainbow: it appears with a shimmer
  if (ev && ev.rbSun) {
    const D = R.dbl, k = Math.min(1, ev.rbDblT / 1.2);
    ctx.globalAlpha = k; ctx.drawImage(D.pic.c, D.pic.x, D.pic.y); ctx.globalAlpha = 1;
    for (let q = 0; q < 30; q++) { const p = D.pts[(hash(q, Math.floor(G.time * 6), 171) * D.pts.length) | 0]; if (inView(p.x, p.y)) R1(Math.round(p.x) + ((q % 5) - 2) * 3, Math.round(p.y) + ((q % 3) - 1) * 4, 1, 1, '#ffffff'); }
  }
  // glitter on the rainbow road
  const kk = Math.floor(G.time * 5);
  for (let q = 0; q < 40 && R.glit.length; q++) { const p = R.glit[(hash(q, kk, 172) * R.glit.length) | 0], x = p % T.W, y = p / T.W | 0; if (inView(x, y)) { R1(x - 1, y, 3, 1, '#ffffff'); R1(x, y - 1, 1, 3, '#ffffff'); } }
  if (ev) {
    for (const q of ev.rbTrail) {
      if (!inView(q.x, q.y)) continue;
      const nx = -Math.sin(q.a), ny = Math.cos(q.a);
      ctx.globalAlpha = Math.min(1, q.t / 1.2) * .9;
      for (let b = 0; b < 6; b++) R1(Math.round(q.x + nx * (b - 2.5) * 2), Math.round(q.y + ny * (b - 2.5) * 2), 3, 2, RB[b]);
    }
    ctx.globalAlpha = 1;
    for (const b of ev.rbBolts) {
      if (b.hit || !inView(b.x, b.y)) continue;
      const r = Math.round(BOLT.r * (1.6 - .6 * b.t / BOLT.warn)), bl = ((G.time * 12) | 0) % 2;
      ctx.fillStyle = bl ? '#ffe04a' : '#fff8c0';
      for (let a = 0; a < TAU; a += .12) ctx.fillRect(Math.round(b.x + Math.cos(a) * r), Math.round(b.y + Math.sin(a) * r * .8), 2, 2);
      ctx.globalAlpha = .2; ell(Math.round(b.x), Math.round(b.y), BOLT.r, Math.round(BOLT.r * .8), '#ffe04a'); ctx.globalAlpha = 1;
    }
  }
  // the wormhole: the purple mouth on its platform, the turquoise one on the road where you come out
  const P = R.portals, rot = G.time * 5;
  if (inView(P.b.x, P.b.y)) swirl(P.b.x, P.b.y, 9, '#1fb8b0', '#9ffff0', -rot, '#120a28');
  if (inView(P.a.x, P.a.y)) swirl(P.a.x, P.a.y, 10, '#8a3ad8', '#e0a8ff', rot, '#120a28');
  // the liana: its shadow swings over the crack
  const L = R.liana, s = lianaS(ev ? ev.t : G.time) * LIANA.swing;
  if (inView(L.pivot.x, L.pivot.y, 60)) { ctx.globalAlpha = .25; ell(Math.round(L.pivot.x - L.dx * s + 6), Math.round(L.pivot.y - L.dy * s + 8), 5, 2, '#1b1440'); ctx.globalAlpha = 1; }
}

// the cloud train: a little locomotive of cloud with a rainbow chimney and two wagons, the warning light blinks red while it comes
function drawTrain(R) {
  const tr = R.tr, TT = R.train;
  if (inView(TT.light[0], TT.light[1], 40)) {
    const on = tr && (tr.warn || tr.x - TRAIN.len < TT.cross + 40) && ((G.time * 4) | 0) % 2;
    disc(TT.light[0] - 3, TT.light[1] - 22, 2, on ? '#ff3030' : '#5a2020'); disc(TT.light[0] + 3, TT.light[1] - 22, 2, !on && tr ? '#ff3030' : '#5a2020');
  }
  if (!tr || tr.warn || !inView(tr.x - TRAIN.len / 2, TT.y, TRAIN.len)) return;
  for (let k = 0; k < 3; k++) {
    const x1 = Math.round(tr.x - k * 38), x0 = x1 - 34, y = TT.y; if (x1 < TT.x0) continue;
    const xa = Math.max(x0, TT.x0);
    ctx.globalAlpha = .25; R1(xa + 4, y + 6, x1 - xa, 5, '#1b1440'); ctx.globalAlpha = 1;
    R1(xa, y - 12, x1 - xa, 16, '#a8b0d8'); R1(xa + 1, y - 11, x1 - xa - 2, 13, k ? '#f2f3fc' : '#ffffff');
    for (let q = 0; q < 6; q++) if (x0 + 4 + q * 5 < x1 && x0 + 4 + q * 5 > xa) R1(x0 + 4 + q * 5, y - 7, 4, 3, RB[q]);
    if (!k) { R1(x1 - 8, y - 20, 5, 8, '#ff4d6d'); R1(x1 - 8, y - 22, 5, 2, '#ffd93d'); if (Math.random() < .5) addP({ t: 'puff', x: x1 - 6, y: y - 24, vx: -30, vy: -10, life: .6, ml: .6 }); }
    disc(x0 + 6, y + 4, 3, '#6a5aa0'); disc(x1 - 6, y + 4, 3, '#6a5aa0');
  }
}

// above the cars: the lift (cable, chairs), the liana, the train, the roof of the lava tube or its darkness, balloons and birds, the rain cloud of
// the bay with the sun and a rainbow in the spray, unicorns, lightning, sparks, glitter
function drawRainbowAbove(cx, cy) {
  const T = G.T, R = T.rainbow, ev = T.ev;
  // the lava tube: from outside its roof; inside dark, the lava rill glows
  const V = R.cone;
  if (R.inTube) { ctx.save(); ctx.beginPath(); ctx.arc(V.x, V.y, V.r + 2, 0, TAU); ctx.clip(); darkRect(cx, cy, V.box, .8, [{ x: V.x, y: V.y, k: 1 }, { x: V.x + 20, y: V.y - 14, k: 2 }]); ctx.restore(); }
  else if (inView(V.x, V.y, 70)) ctx.drawImage(V.roof, V.box.x, V.box.y);
  // the cable of the lift and the chairs on it
  const Ls = R.lift.masts;
  if (Ls && inView((Ls[0].x + Ls[1].x) / 2, (Ls[0].y + Ls[1].y) / 2, 120)) {
    ctx.strokeStyle = '#3a3a48'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Ls[0].x, Ls[0].y - 22); ctx.lineTo(Ls[1].x, Ls[1].y - 22); ctx.stroke();
    for (const c of G.cars) if (c.rbLift) {
      const s = c.rbLift.s, hx = Ls[0].x + (Ls[1].x - Ls[0].x) * s, hy = Ls[0].y - 22 + (Ls[1].y - Ls[0].y) * s;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(c.x, c.y - 10 - c.lift * 20); ctx.stroke();
    }
  }
  // the liana: a rope from the crown of the tree to its handle, swinging along the chord
  const L = R.liana, s = lianaS(ev ? ev.t : G.time) * LIANA.swing;
  if (inView(L.pivot.x, L.pivot.y, 80)) {
    const hx = L.pivot.x - L.dx * s, hy = L.pivot.y - L.dy * s - 14, on = ev && lianaOn(ev.t);
    ctx.strokeStyle = '#3e6a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L.pivot.x, L.pivot.y - 70); ctx.quadraticCurveTo((L.pivot.x + hx) / 2 + 4, (L.pivot.y - 70 + hy) / 2, hx, hy); ctx.stroke(); ctx.lineWidth = 1;
    R1(Math.round(hx) - 4, Math.round(hy), 9, 2, on ? '#ffd23f' : '#7a5a2a');
  }
  drawTrain(R);
  // hot-air balloons in rainbow colours drift over the clouds
  for (let q = 0; q < 4; q++) {
    const x = Math.round(((q * 520 + G.time * (6 + q * 2)) % (T.W + 200)) - 100), y = Math.round(150 + q * 230 + Math.sin(G.time * .3 + q) * 20);
    if (!inView(x, y, 60)) continue;
    ctx.globalAlpha = .18; ell(x + 26, y + 46, 8, 3, '#1b1440'); ctx.globalAlpha = 1;
    for (let dy = -12; dy <= 10; dy++) { const wv = Math.round(11 * Math.sqrt(Math.max(0, 1 - ((dy + 1) / 12) ** 2)) * (dy > 4 ? 1 - (dy - 4) / 9 : 1)); for (let b = 0; b < 6; b++) { const xa = x - wv + Math.round(b * 2 * wv / 6), xb = x - wv + Math.round((b + 1) * 2 * wv / 6); if (xb > xa) R1(xa, y + dy, xb - xa, 1, RB[(b + q) % 6]); } }
    R1(x - 4, y + 12, 1, 5, '#5a3a1c'); R1(x + 3, y + 12, 1, 5, '#5a3a1c'); R1(x - 4, y + 16, 8, 5, '#8a5a2b'); R1(x - 4, y + 16, 8, 1, '#c49a6c');
  }
  // a flock of birds now and then
  const bu = (G.time % 19) / 7;
  if (bu < 1) for (let q = 0; q < 5; q++) {
    const x = Math.round(cam.x - 20 + bu * (VW + 40) + (q % 2) * 8 - q * 6), y = Math.round(cam.y + 60 + q * 5 + (q % 2) * 4), f = ((G.time * 8 + q) | 0) % 2;
    R1(x - 3, y - f, 3, 1, '#3a3a5a'); R1(x + 1, y - f, 3, 1, '#3a3a5a'); R1(x, y, 1, 1, '#3a3a5a');
  }
  // the little rain cloud of the bay: the sun peeks out behind it, a rainbow stands in the spray
  const B = R.bay;
  if (inView(B.x, B.y, 90)) {
    const sx = Math.round(B.x + 34), sy = Math.round(B.y - 46);
    ctx.globalAlpha = .9; disc(sx, sy, 9, '#ffd23f'); for (let q = 0; q < 8; q++) { const a = q / 8 * TAU + G.time * .5; R1(Math.round(sx + Math.cos(a) * 13), Math.round(sy + Math.sin(a) * 13), 2, 2, '#ffe88a'); }
    ctx.globalAlpha = .45; for (let b = 0; b < 6; b++) { ctx.strokeStyle = RB[b]; ctx.beginPath(); ctx.arc(B.x, B.y + 6, 34 - b * 2, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); }
    ctx.globalAlpha = .9;
    for (const [dx, dy, r] of [[-28, -30, 9], [-12, -34, 12], [6, -31, 10], [20, -28, 7], [-20, -26, 8], [-2, -26, 9]]) disc(Math.round(B.x + dx), Math.round(B.y + dy), r + 1, '#a8b0cc');
    for (const [dx, dy, r] of [[-28, -31, 8], [-12, -35, 11], [6, -32, 9], [20, -29, 6], [-20, -27, 7], [-2, -27, 8]]) { disc(Math.round(B.x + dx), Math.round(B.y + dy), r, '#eef0fa'); disc(Math.round(B.x + dx - 2), Math.round(B.y + dy - 2), Math.max(1, r - 4), '#ffffff'); }
    ctx.globalAlpha = 1;
  }
  if (ev) {
    for (const u of ev.rbUnis) {
      if (!inView(u.x, u.y, 30)) continue;
      ctx.globalAlpha = .22; ell(Math.round(u.x + 10), Math.round(u.y + 18), 10, 3, '#1b1440'); ctx.globalAlpha = 1;
      drawUnicorn(Math.round(u.x), Math.round(u.y - 10 + Math.sin(G.time * 10 + u.id) * 2), u.vx >= 0 ? 1 : -1, u.id);
    }
    for (const b of ev.rbBolts) {
      if (!b.hit || !inView(b.x, b.y, 60)) continue;
      ctx.globalAlpha = 1 - (b.t - BOLT.warn) / BOLT.show;
      let x = b.x + (hash(b.seed, 1, 164) - .5) * 40, y = cam.y - 10;
      const steps = 9, dy = (b.y - y) / steps;
      for (let q = 1; q <= steps; q++) {
        const nx = q === steps ? b.x : b.x + (hash(b.seed, q, 165) - .5) * 40 * (1 - q / steps), ny = y + dy;
        const Ln = Math.max(1, Math.round(Math.hypot(nx - x, ny - y) / 2));
        for (let k = 0; k <= Ln; k++) { const px = Math.round(x + (nx - x) * k / Ln), py = Math.round(y + (ny - y) * k / Ln); R1(px - 1, py, 3, 2, '#fff8c0'); R1(px, py, 1, 2, '#ffffff'); }
        x = nx; y = ny;
      }
      ctx.globalAlpha = 1;
    }
  }
  for (const p of G.parts) {
    if (p.t === 'glit') { ctx.globalAlpha = p.life / p.ml; R1(Math.round(p.x), Math.round(p.y), 2, 2, p.col); if (((G.time * 10) | 0) % 2) R1(Math.round(p.x), Math.round(p.y), 1, 1, '#ffffff'); }
    else if (p.t === 'spark') { ctx.globalAlpha = p.life / p.ml; const x = Math.round(p.x), y = Math.round(p.y); R1(x, y, 3, 1, '#fff070'); R1(x + 2, y + 1, 1, 2, '#fff070'); R1(x + 2, y + 3, 3, 1, '#ffffff'); }
    else if (p.t === 'puff') { const f = p.life / p.ml; ctx.globalAlpha = f * .6; disc(Math.round(p.x), Math.round(p.y), Math.round(3 + (1 - f) * 5), '#9aa0b4'); }
    else if (p.t === 'warp') { ctx.globalAlpha = p.life / p.ml; R1(Math.round(p.x), Math.round(p.y), 2, 2, p.col); }
  }
  ctx.globalAlpha = 1;
}

// on the screen: the sunrise (lap 1), the dark front and the darkness of the storm, lightning flashes, the sun, fireworks; glitter at the edge of
// the screen where a unicorn is about to come in (no text, Grundsatz 9)
function drawRainbowSky() {
  const T = G.T, ev = T.ev; if (!ev) return;
  for (const u of ev.rbUnis) {
    if (u.t > 1.2 || inView(u.x, u.y, 0)) continue;
    const sx = clamp(u.x - cam.x, 4, VW - 6), sy = clamp(u.y - cam.y, 4, VH - 6);
    for (let q = 0; q < 6; q++) R1(Math.round(sx + Math.sin(G.time * 9 + q * 2) * 5), Math.round(sy + Math.cos(G.time * 7 + q * 3) * 5), 2, 2, ((G.time * 10 + q) | 0) % 2 ? RB[q] : '#ffffff');
  }
  if (ev.rbStormOn && !ev.rbStorm && !ev.rbSun) {
    ctx.fillStyle = 'rgba(255,186,96,.10)'; ctx.fillRect(0, 0, VW, VH);
    ctx.save(); ctx.globalAlpha = .07; ctx.fillStyle = '#fff1b0';
    for (let k = 0; k < 4; k++) { const span = VW + 260, bx = (((k * 170 + G.time * 5 - cam.x * .3) % span) + span) % span - 100; ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + 40, 0); ctx.lineTo(bx + 150, VH); ctx.lineTo(bx + 80, VH); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  const s = ev.rbStorm;
  if (s && !ev.rbSun) {
    const p = Math.min(1, s.t / STORM.front), wx = Math.round(T.W + 60 - p * (T.W + 120) - cam.x);
    if (wx < VW) {
      ctx.fillStyle = 'rgba(22,26,52,' + (.32 * Math.min(1, s.t / 2)).toFixed(3) + ')'; ctx.fillRect(Math.max(0, wx), 0, VW, VH);
      if (p < 1) for (let k = 0; k < 14; k++) { const y = k * VH / 13, r = 18 + 8 * Math.sin(G.time * 2 + k); ctx.globalAlpha = .5; disc(wx + Math.round(Math.sin(G.time * 3 + k * 1.7) * 6), Math.round(y), Math.round(r), '#3a3f58'); }
      ctx.globalAlpha = 1;
    }
  }
  if (ev.rbSun) {
    const k = Math.min(1, ev.rbSun.t / 1.5);
    ctx.fillStyle = 'rgba(255,236,170,' + (.16 * (1 - k) + .05).toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH);
    ctx.save(); ctx.globalAlpha = .08; ctx.fillStyle = '#fff6c8';
    for (let q = 0; q < 6; q++) { const a = q / 6 * Math.PI / 2 + Math.sin(G.time * .3) * .05; ctx.beginPath(); ctx.moveTo(-20, -20); ctx.lineTo(-20 + Math.cos(a - .05) * 700, -20 + Math.sin(a - .05) * 700); ctx.lineTo(-20 + Math.cos(a + .05) * 700, -20 + Math.sin(a + .05) * 700); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    for (const f of ev.rbFw) {
      if (!f.bang) { R1(Math.round(f.x), Math.round(f.y), 1, 3, '#fff3c0'); continue; }
      ctx.globalAlpha = Math.max(0, 1 - f.t / 1.4);
      for (const q of f.parts) R1(Math.round(q.x), Math.round(q.y), 2, 2, ((G.time * 14) | 0) % 3 ? f.col : '#ffffff');
    }
    ctx.globalAlpha = 1;
  }
  if (ev.rbFlash > 0) { ctx.fillStyle = 'rgba(255,255,240,' + (ev.rbFlash * .55).toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH); }
}

// ---------- hooks: how the core calls this track (hooks.js; what each hook does: _template.js) ----------
/** @type {import('./_template.js').TrackHooks} */
export const rainbowHooks = {
  init: initRainbow, events: { einhorn: initUnicorns, gewitter: initThunder }, update: rainbowUpdate, collisions: rainbowCollisions,
  surf: c => c.surf >= 41 && c.surf <= 48 || c.surf === CLOUD || c.surf === LIFT ? rainbowSurf(c) : null, // lanes, gold asphalt, holes, cloud path, lift
  target: rainbowTarget, lane: rainbowLane, throttle: rainbowThrottle, progress: rainbowProgress, ground: rainbowGround, stuck: rainbowStuck,
  noRespawn: t => t === HOLE || t === LIFT || t === 15, respawn: rainbowRespawn,
  drawFall(c, F, lv) { if (c.fallKind !== 'cloud') return false; drawRainbowFall(c, F, lv); return true; }, // through a cloud hole, then a unicorn catches it
  drawGround: drawRainbowGround, drawAbove: drawRainbowAbove, drawSky: drawRainbowSky, noBeams: () => !!(G.T.rainbow && G.T.rainbow.inTube),
};
