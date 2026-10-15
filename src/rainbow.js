import { G } from './g.js';
import { SFX } from './audio.js';
import { HALF, LAPS, SS, TAU, VH, VW, clamp, ctx, hash, rotIndex } from './core.js';
import { R1, disc, ell, text } from './gfx.js';
import { WATC, addP } from './particles.js';
import { cam } from './state.js';
import { fallCar, near } from './trackfx.js';
import { bctx, eventOn, snap } from './undo.js';
import { nearestIdx } from './bau.js';
import { ASPH, HOLE, LANE, RB } from './rainbowmap.js';

// ---------- Regenbogen while racing (the finale) ----------
// Always: the six colour lanes of the rainbow road work differently (red is fast, green grips, blue is slippery, violet is soft and brakes a
// little; orange and yellow are normal). Whoever gets over a cloud hole falls through the clouds, a unicorn catches the car and brings it back
// (after the gap of the arch it sets it down behind the gap). The arch makes the cars bigger the higher they are. On the bronze coin two cows
// graze on the road (switch kuehe), on the silver coin koi leap over the bridge (switch kois). The wormhole on the platinum coin takes you over
// the next bend. The rain shower washes; whoever comes out of it clean leaves a glitter trail for a while.
// Event "einhorn": unicorns gallop through the air across the road and leave a rainbow trail (3 s) that works like a boost pad; whoever rams a
// unicorn spins like after a cow ("WIEHER!").
// Event "gewitter" (the story of the three laps): lap 1 a sunrise (the lanes are pale); from lap 2 a storm comes in from the right (dark, rain
// that washes a little, more storm clouds on the road, the lanes go grey and lose their effect except a little of red and blue, lightning
// every 4 to 6 s after a yellow target circle, never on the coins); as soon as the leader goes into the last lap the sun breaks through: the
// storm clouds turn to glitter, the lanes work twice as hard, a double rainbow cuts the spiral short (no rails), fireworks.

const UNI = { speed: 175, reach: 190, hit: 14, trail: 3 }, BOLT = { warn: 1.5, r: 22, show: .3 }, STORM = { front: 5, grey: 3, spots: 1.6 }, WARP = { r: 10, cool: 1.2 };
const inView = (x, y, m = 40) => x > cam.x - m && x < cam.x + VW + m && y > cam.y - m && y < cam.y + VH + m;
const inRange = (i, a, b) => a <= b ? i >= a && i <= b : i >= a || i <= b;
const lap = () => G.player && !G.T.run ? G.player.lap : 0;
const lead = () => G.cars.reduce((m, c) => Math.max(m, c.lap), 0);

function initRainbow(T) {
  const ev = T.ev, def = T.def;
  Object.assign(ev, { unis: [], trail: [], uniOn: false, uniN: 0, uniNext: 3.5, stormOn: false, storm: null, sun: null, bolts: [], flash: 0, fw: [], fwNext: 0, texts: [], obst: [], msg: null, dblT: 0 });
  // the two cows of the bronze coin (like on the meadow, only slower)
  if (eventOn('kuehe')) ev.cows = (def.cows || []).map(([x, y, range, ph], k) => {
    const i = nearestIdx(T.path, x, y), tg = T.tan[i], a = ph * .45, ca = Math.cos(a), sa = Math.sin(a);
    return { bx: x, by: y, dx: tg.x * ca - tg.y * sa, dy: tg.x * sa + tg.y * ca, range, ph, x, y, face: k % 2 ? -1 : 1, graze: 0, mooT: 0, cool: 0, k, sp: .3 };
  });
  // the koi of the silver coin leap across the bridge, from the pond on one side to the other
  if (eventOn('kois') && def.pond) {
    const i = nearestIdx(T.path, def.pond[0], def.pond[1]), p = T.path[i], n = T.nrm[i];
    ev.kois = [0, 1].map(k => ({ x: p.x + T.tan[i].x * (k ? 8 : -8), y: p.y + T.tan[i].y * (k ? 8 : -8), ang: Math.atan2(n.y, n.x) + (k ? Math.PI : 0), half: 44, per: 7.2 + k * 1.3, off: 2 + k * 3.1, p: -1, px: p.x, py: p.y, z: 0, k }));
  }
}

function initUnicorns(T) { T.ev.uniOn = true; }
function initThunder(T) { T.ev.stormOn = true; }

// how strongly a lane works: 1 normally; in the storm the colours go grey (red and blue keep a little); in the sun twice as strong
function laneK(ln) {
  const ev = G.T.ev; if (!ev) return 1;
  if (ev.sun) return 2;
  const g = ev.storm ? ev.storm.grey : 0;
  return ln === 0 || ln === 4 ? 1 - .6 * g : 1 - g;
}

// the ground under a car (physics.js): the lanes, the asphalt of the gold coin, a cloud hole (no grip, no gas)
function rainbowSurf(c) {
  const t = c.surf;
  if (t === ASPH) return [1.03, 10, 1];
  if (t === HOLE) return [1, .3, .15, 0];
  const ln = t - LANE, k = laneK(ln);
  if (ln === 0) return [1 + .08 * k, 10, 1];
  if (ln === 3) return [1, 10 + 5 * k, 1 + .06 * k];
  if (ln === 4) return [1, Math.max(2, 10 - 4.5 * k) * c.def.turn, Math.max(.5, 1 - .25 * k), Math.max(.5, 1 - .25 * k)];
  if (ln === 5) return [1 - .06 * k, 10, 1];
  return [1, 10, 1];
}

// ======================================================= always: the wormhole, the shower, the arch

function rainbowUpdate(T, dt) {
  const ev = T.ev, R = T.rainbow, P = R.portals;
  for (const c of G.cars) {
    c.warpT = Math.max(0, (c.warpT || 0) - dt);
    if (c.fall > 0 || c.z > 0 || c.warpT > 0 || Math.hypot(c.x - P.a.x, c.y - P.a.y) > WARP.r) continue;
    // into the wormhole: out at the road behind the next bend, as fast, in the direction of the road
    const tg = T.tan[P.ib], sp = Math.max(70, Math.hypot(c.vx, c.vy));
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; addP({ t: 'warp', x: P.a.x + Math.cos(a) * 4, y: P.a.y + Math.sin(a) * 4, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: .5, ml: .5, col: '#c46bff' }); }
    c.x = P.b.x; c.y = P.b.y; c.vx = tg.x * sp; c.vy = tg.y * sp; c.ang = Math.atan2(tg.y, tg.x); c.idx = P.ib; c.warpT = WARP.cool; c.okX = c.x; c.okY = c.y;
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; addP({ t: 'warp', x: c.x, y: c.y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: .6, ml: .6, col: '#4ff0e0' }); }
    if (!c.ai || near(c.x, c.y) < 300) SFX.warp(c.ai ? .4 : 1);
  }
  // the little rain cloud over the shower
  const S = R.shower; if (inView(S.x, S.y, 60)) for (let q = 0, n = dt * 50 + Math.random(); q < n && q < 3; q++) addP({ t: 'd', x: S.x + (Math.random() - .5) * 2 * HALF, y: S.y + (Math.random() - .5) * 14, z: 26, vx: 0, vy: 0, vz: -60, col: WATC[(Math.random() * 4) | 0], s: 1, life: 1, ml: 1 });
  if (ev.uniOn) updateUnicorns(T, dt);
  if (ev.stormOn) updateStorm(T, dt);
  ev.flash = Math.max(0, ev.flash - dt * 3);
  ev.texts = ev.texts.filter(s => (s.t -= dt) > 0);
  if (ev.msg && (ev.msg.t -= dt) <= 0) ev.msg = null;
  // the computer cars steer round unicorns that are about to cross in front of them
  ev.obst = ev.unis.filter(u => u.t > .3 && u.t < u.dur - .3);
}

// the ground under a car (update.js): falling through a hole, the brown mud of the bronze coin, the arch, kerbs, the shower and the glitter
// trail, the rain of the storm, sparks after a lightning strike
function rainbowGround(c, j, sp, dt) {
  const T = G.T, R = T.rainbow, ev = T.ev, N = T.N, A = R.arch, Rp = R.ramp;
  if (c.surf === HOLE) {
    c.holeT = (c.holeT || 0) + dt;
    if (c.holeT > .12) { c.holeT = 0; c.lift = 0; fallCar(c, 'cloud', inRange(c.idx, (A.g0 - 4 + N) % N, (A.g1 + 4) % N) ? A.landI : inRange(c.idx, Rp.rl, (Rp.rg + 4) % N) ? Rp.land : undefined); return; }
  } else c.holeT = 0;
  // mud on the bronze coin is brown (the second set of sprites); the storm clouds make the car grey
  if (c.surf === 2 && R.brown[j]) c.cem = true;
  // the arch: the higher the car, the bigger it is drawn (its shadow falls far away, see draw.js)
  if (inRange(c.idx, A.a0, A.a1) && c.off < HALF + 8) c.lift = Math.sin(Math.PI * ((c.idx - A.a0 + N) % N) / ((A.a1 - A.a0 + N) % N));
  else c.lift = Math.max(0, (c.lift || 0) - dt * 3);
  c.kerb = !!R.kerb[j];
  // the rain shower: whoever comes out of it clean leaves a glitter trail in all colours for a while (about a lap)
  if (c.washing) c.inShower = true;
  else if (c.inShower) { c.inShower = false; if (c.dirt < .05) { c.glitter = 14; if (!c.ai) SFX.glitter(1); } }
  if (c.glitter > 0) {
    c.glitter -= dt;
    if (sp > 20 && Math.random() < dt * 34) addP({ t: 'glit', x: c.x - Math.cos(c.ang) * 13 + (Math.random() - .5) * 8, y: c.y - Math.sin(c.ang) * 13 + (Math.random() - .5) * 8, vx: 0, vy: 0, life: .9, ml: .9, col: RB[(Math.random() * 6) | 0] });
  }
  // the rain of the storm washes slowly (about a third of a puddle), not on the storm clouds
  if (ev && ev.rain && c.surf !== 2) c.dirt = Math.max(0, c.dirt - .23 * dt);
  // after a lightning strike: zig-zag sparks round the car
  if (c.zap > 0) { c.zap -= dt; if (Math.random() < dt * 30) addP({ t: 'spark', x: c.x + (Math.random() - .5) * 26, y: c.y + (Math.random() - .5) * 20, vx: 0, vy: 0, life: .2, ml: .2 }); }
}

// back from a cloud hole: the unicorn sets the car down, it glitters
function rainbowRespawn(c) {
  for (let k = 0; k < 18; k++) { const a = k / 18 * TAU; addP({ t: 'glit', x: c.x + Math.cos(a) * 16, y: c.y + Math.sin(a) * 12, vx: -Math.cos(a) * 24, vy: -Math.sin(a) * 24, life: .7, ml: .7, col: RB[k % 6] }); }
  if (!c.ai || near(c.x, c.y) < 260) SFX.neigh(c.ai ? .3 : 1);
}

// ======================================================= event "einhorn"

function spawnUnicorn(T, n) {
  const R = T.rainbow, N = T.N, P = G.player;
  let i = P && hash(n, 1, 151) < .6 ? (P.idx + 70 + Math.floor(hash(n, 2, 151) * 90)) % N : Math.floor(hash(n, 3, 151) * N);
  // only over the rainbow road (not over the coins, not at the gap of the arch)
  for (let k = 0; k < 300; k += 6) { const q = (i + k) % N, p = T.path[q], j = (p.y | 0) * T.W + (p.x | 0); if (R.lane[j] && !inRange(q, R.arch.a0, R.arch.a1)) { i = q; break; } if (k >= 294) return null; }
  const p = T.path[i], nm = T.nrm[i], s = hash(n, 4, 151) < .5 ? 1 : -1, tilt = (hash(n, 5, 151) - .5) * .7;
  const dx = -nm.x * s * Math.cos(tilt) - nm.y * s * Math.sin(tilt), dy = -nm.y * s * Math.cos(tilt) + nm.x * s * Math.sin(tilt);
  return { x: p.x - dx * UNI.reach, y: p.y - dy * UNI.reach, vx: dx * UNI.speed, vy: dy * UNI.speed, t: 0, dur: 2 * UNI.reach / UNI.speed, id: n, hits: [], neigh: false, last: null };
}

function updateUnicorns(T, dt) {
  const ev = T.ev;
  while (ev.t >= ev.uniNext) {
    const n = ev.uniN++, u = spawnUnicorn(T, n); if (u) ev.unis.push(u);
    ev.uniNext += 5 + hash(n, 6, 151) * 3;
  }
  for (const u of ev.unis) {
    u.t += dt; u.x += u.vx * dt; u.y += u.vy * dt;
    if (!u.neigh && near(u.x, u.y) < 280) { u.neigh = true; SFX.neigh(.45); }
    // the rainbow trail behind it, only where it crosses the road
    const j = clamp(u.y | 0, 0, T.H - 1) * T.W + clamp(u.x | 0, 0, T.W - 1);
    if (T.dist[j] < HALF + 3 && (!u.last || Math.hypot(u.x - u.last.x, u.y - u.last.y) >= 4)) { u.last = { x: u.x, y: u.y, t: UNI.trail, id: u.id, a: Math.atan2(u.vy, u.vx) }; ev.trail.push(u.last); }
  }
  ev.unis = ev.unis.filter(u => u.t < u.dur);
  ev.trail = ev.trail.filter(q => (q.t -= dt) > 0);
  // over the trail: a boost (once per trail)
  for (const c of G.cars) {
    if (c.fall > 0 || c.z > 0) continue;
    for (const q of ev.trail) if (c.trailId !== q.id && Math.abs(c.x - q.x) < 9 && Math.abs(c.y - q.y) < 9) { c.trailId = q.id; c.boost = Math.max(c.boost, 1.2); if (!c.ai || near(c.x, c.y) < 260) SFX.boost(c.ai ? .3 : 1); break; }
  }
}

// a car rams a unicorn: thrown aside like by a cow
function rainbowCollisions() {
  const ev = G.T.ev; if (!ev || !ev.unis) return;
  for (const u of ev.unis) for (const c of G.cars) {
    if (c.z > 0 || c.fall > 0 || c.ghost > 0 || u.hits.includes(c)) continue;
    const dx = c.x - u.x, dy = c.y - u.y, d = Math.hypot(dx, dy); if (d > UNI.hit || !d) continue;
    u.hits.push(c);
    c.vx = dx / d * 150 + u.vx * .3; c.vy = dy / d * 150 + u.vy * .3; c.spin = 12; c.stun = 1.1; c.boost = 0;
    ev.texts.push({ s: 'WIEHER!', x: u.x, y: u.y, t: 1.2 });
    if (!c.ai) { SFX.crash(); SFX.neigh(1); } else if (near(c.x, c.y) < 260) SFX.bump();
  }
}

// ======================================================= event "gewitter"

function updateStorm(T, dt) {
  const ev = T.ev, R = T.rainbow;
  // the last lap: the sun breaks through (as soon as the leader is in it)
  if (!ev.sun && lead() >= LAPS && G.state === 'race') sunBreak(T);
  if (ev.sun) { updateSun(T, dt); return; }
  if (!ev.storm) {
    if (lap() < 2) return;
    ev.storm = { t: 0, grey: 0, spot: 0, next: STORM.front * .6, n: 0, rumble: 6 };
    ev.msg = { s: 'GEWITTER!', t: 2.6 }; SFX.thunder();
  }
  const s = ev.storm; s.t += dt;
  s.grey = clamp((s.t - 1) / STORM.grey, 0, 1);
  // the front of dark clouds comes in from the right; behind it it rains
  const fx = T.W + 60 - s.t / STORM.front * (T.W + 120);
  if (!ev.rain && fx < cam.x + VW / 2) { ev.rain = { t: 0, snd: 7 }; SFX.rain(); }
  if (ev.rain) { ev.rain.t += dt; if ((ev.rain.snd -= dt) <= 0) { ev.rain.snd = 7; SFX.rain(); } }
  if ((s.rumble -= dt) <= 0) { s.rumble = 8 + hash(s.n, 9, 161) * 4; SFX.thunder(); }
  // more storm clouds on the road, one after the other
  while (s.spot < R.stormSpots.length && s.t > STORM.front * .6 + s.spot * STORM.spots) stormSpot(T, R.stormSpots[s.spot++]);
  // lightning: a yellow circle first, then the strike
  while (s.t >= s.next) { const b = boltAt(T, s.n++); if (b) ev.bolts.push(b); s.next += 4 + hash(s.n, 3, 161) * 2; }
  for (const b of ev.bolts) {
    b.t += dt;
    if (!b.hit && b.t >= BOLT.warn) strike(T, b);
  }
  ev.bolts = ev.bolts.filter(b => b.t < BOLT.warn + BOLT.show);
}

function stormSpot(T, sp) {
  if (!sp.px.length) return;
  snap(T, sp.box[0], sp.box[1], sp.box[2], sp.box[3]); // the ground under it (and this snapshot puts it back after the race)
  for (const j of sp.px) T.ter[j] = 2;
  sp.on = true; T.mudPix = T.mudPix.concat(sp.px);
  if (near(sp.x, sp.y) < 320) for (let k = 0; k < 14; k++) addP({ t: 'puff', x: sp.x + (Math.random() - .5) * 40, y: sp.y + (Math.random() - .5) * 24, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, life: .8, ml: .8 });
}

// where the next lightning strikes: on the road ahead of you (or of a computer car), never on a coin
function boltAt(T, n) {
  const R = T.rainbow, N = T.N, cs = G.cars.filter(c => c.ai), c = n % 3 === 2 && cs.length ? cs[Math.floor(hash(n, 1, 162) * cs.length)] : G.player; if (!c) return null;
  for (let k = 0; k < 6; k++) {
    const i = (c.idx + 45 + Math.floor(hash(n, 2, 162) * 70) + k * 30) % N, p = T.path[i], o = (hash(n, 3, 162) - .5) * 40;
    const x = p.x + T.nrm[i].x * o, y = p.y + T.nrm[i].y * o, j = (y | 0) * T.W + (x | 0);
    if (!R.coin[j] && T.ter[j] !== HOLE) return { x, y, t: 0, hit: false, seed: n };
  }
  return null;
}

function strike(T, b) {
  const ev = T.ev; b.hit = true;
  const d = near(b.x, b.y); if (d < 420) { SFX.strike(clamp(1 - d / 420, .25, 1)); ev.flash = Math.max(ev.flash, clamp(1 - d / 500, .2, 1)); }
  for (let k = 0; k < 16; k++) addP({ t: 'spark', x: b.x + (Math.random() - .5) * 30, y: b.y + (Math.random() - .5) * 24, vx: (Math.random() - .5) * 60, vy: (Math.random() - .5) * 60, life: .35, ml: .35 });
  for (const c of G.cars) {
    if (c.fall > 0 || c.z > 0 || Math.hypot(c.x - b.x, c.y - b.y) > BOLT.r) continue;
    // electric: it turns, it is grey, sparks fly for a moment
    c.zap = 1.4; c.spin = (hash(b.seed, c.seed | 0, 163) < .5 ? -1 : 1) * 10; c.stun = .9; c.vx *= .3; c.vy *= .3; c.boost = 0; c.dirt = 1; c.cem = false;
    ev.texts.push({ s: 'BZZZT!', x: c.x, y: c.y, t: 1.1 });
    if (!c.ai) { SFX.zap(); G.jumpShake = Math.max(G.jumpShake, .4); }
  }
}

// the sun breaks through: rain stops, storm clouds turn to glitter, the double rainbow opens, fireworks
function sunBreak(T) {
  const ev = T.ev, R = T.rainbow, b = bctx(T);
  ev.sun = { t: 0 }; ev.rain = null; ev.bolts = []; ev.msg = { s: 'DIE SONNE KOMMT!', t: 3 };
  const glitter = (x, y) => { if (near(x, y) < 340) for (let k = 0; k < 24; k++) addP({ t: 'glit', x: x + (Math.random() - .5) * 50, y: y + (Math.random() - .5) * 30, vx: (Math.random() - .5) * 30, vy: -10 - Math.random() * 30, life: 1.2, ml: 1.2, col: RB[k % 6] }); };
  // the storm clouds that the storm brought
  for (const sp of R.stormSpots) if (sp.on) { sp.on = false; for (const j of sp.px) T.ter[j] = LANE + R.lane[j] - 1; glitter(sp.x, sp.y); }
  // the storm clouds that were always there: the clean rainbow under them is painted back
  const W = T.W, done = new Set();
  for (const j of R.stormPix) {
    if (done.has(j)) continue;
    const x = j % W, y = j / W | 0, x0 = Math.max(0, x - 40), y0 = Math.max(0, y - 40), w = Math.min(80, W - x0), h = Math.min(80, T.H - y0);
    snap(T, x0, y0, w, h); b.drawImage(R.clean, x0, y0, w, h, x0, y0, w, h);
    for (const q of R.stormPix) { const qx = q % W, qy = q / W | 0; if (qx >= x0 && qx < x0 + w && qy >= y0 && qy < y0 + h) { done.add(q); T.ter[q] = LANE + R.lane[q] - 1; } }
    glitter(x, y);
  }
  T.mudPix = T.mudPix.filter(j => T.ter[j] === 2);
  // the double rainbow: a second, narrower road over the cloud gorge (no rails)
  const D = R.dbl; snap(T, D.pic.x, D.pic.y, D.pic.c.width, D.pic.c.height);
  D.pix.forEach((j, q) => { T.ter[j] = LANE + D.lanes[q]; });
  ev.dblT = 0; ev.fwNext = .5;
  SFX.sunburst();
}

function updateSun(T, dt) {
  const ev = T.ev; ev.sun.t += dt; ev.dblT += dt;
  // fireworks over the screen, more and more towards the finish
  if ((ev.fwNext -= dt) <= 0) {
    ev.fwNext = .7 + Math.random() * .8;
    ev.fw.push({ x: 40 + Math.random() * (VW - 80), y: VH + 4, vy: -(150 + Math.random() * 60), top: 40 + Math.random() * 90, col: RB[(Math.random() * 6) | 0], bang: false, t: 0, parts: [] });
  }
  for (const f of ev.fw) {
    f.t += dt;
    if (!f.bang) { f.y += f.vy * dt; if (f.y <= f.top) { f.bang = true; f.t = 0; for (let k = 0; k < 26; k++) { const a = k / 26 * TAU, v = 50 + Math.random() * 30; f.parts.push({ x: f.x, y: f.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v }); } SFX.firework(.5); } }
    else for (const q of f.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 40 * dt; q.vx *= .98; }
  }
  ev.fw = ev.fw.filter(f => !f.bang || f.t < 1.4);
}

// ======================================================= the computer cars

// the double rainbow (in the last lap, from MITTEL on) and the wormhole (some of them)
function rainbowTarget(c) {
  const T = G.T, R = T.rainbow, ev = T.ev, N = T.N; if (!R || c.finished || G.state !== 'race' || !ev) return null;
  const P = R.portals, wa = (P.ia - c.idx + N) % N;
  if (c.warpTry && wa > 0 && wa < 50 && c.warpT <= 0) return [P.a.x, P.a.y];
  const D = R.dbl;
  if (!c.dblWay) {
    if (!ev.sun || ev.dblT < 1) return null;
    const ahead = (D.i0 - c.idx + N) % N; if (ahead < 2 || ahead > 24 || c.dblNo === c.lap) return null;
    c.dblNo = c.lap;
    if ((c.seed * 4.7 + c.lap * .29) % 1 > [0, .55, .8][G.raceDiff || 0]) return null;
    c.dblWay = true; c.dK = 0;
  }
  let k = c.dK, bd = 1e9;
  for (let q = c.dK; q < Math.min(D.pts.length, c.dK + 30); q++) { const dd = (D.pts[q].x - c.x) ** 2 + (D.pts[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  c.dK = k;
  if (k >= D.pts.length - 6 || bd > (k < 8 ? 70 * 70 : 40 * 40)) { c.dblWay = false; return null; }
  const t = D.pts[Math.min(D.pts.length - 1, k + 9)];
  return [t.x, t.y];
}

// on the rainbow they keep to the red side (in left bends it is inside, in right bends they stay outside); away from lightning circles;
// some of them aim for the wormhole
function rainbowLane(c, i, lane) {
  const T = G.T, R = T.rainbow, ev = T.ev, N = T.N, p = T.path[i], n = T.nrm[i];
  const P = R.portals, ahead = (P.ia - c.idx + N) % N;
  if (ahead > 40 && ahead < 90 && c.warpLap !== c.lap) { c.warpLap = c.lap; c.warpTry = (c.seed * 3.3 + c.lap * .41) % 1 < [.12, .25, .4][G.raceDiff || 0]; }
  const j = (p.y | 0) * T.W + (p.x | 0);
  if (R.lane[j]) lane = clamp(lane - 13, -18, 14);
  if (ev && ev.bolts) for (const b of ev.bolts) {
    if (b.hit) continue;
    const x = p.x + n.x * lane, y = p.y + n.y * lane; if (Math.hypot(x - b.x, y - b.y) > BOLT.r + 8) continue;
    const o = (b.x - p.x) * n.x + (b.y - p.y) * n.y; return clamp(o > 0 ? o - 32 : o + 32, -24, 24);
  }
  return lane;
}

// up the arch nearly everybody goes at full throttle (a few do not, and fall through the gap)
function rainbowThrottle(c, thr) {
  const A = G.T.rainbow.arch;
  if (inRange(c.idx, A.a0, A.g0) && (c.seed * 7.7 + c.lap * .31) % 1 > .12) return Math.max(thr, .97);
  return thr;
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

// a swirl: the mouth of the wormhole
function swirl(x, y, r, col, col2, rot) {
  ctx.globalAlpha = .35; disc(Math.round(x), Math.round(y), r + 3, col); ctx.globalAlpha = 1;
  disc(Math.round(x), Math.round(y), r, '#120a28');
  for (let k = 0; k < 3; k++) for (let s = 0; s < 1; s += .06) { const a = rot + k * TAU / 3 + s * 4, d = s * r; R1(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), 2, 2, s > .6 ? col2 : col); }
  R1(Math.round(x) - 1, Math.round(y) - 1, 2, 2, '#ffffff');
}

// far below in the holes: little clouds drifting slower than the map (two layers)
const FAR = [[34, .3, '#b2bff0'], [20, .55, '#d8e0ff']];

// on the ground (under the cars): the grey or glowing lanes, the storm clouds of the storm, the double rainbow, unicorn trails, lightning
// circles, the wormhole, far clouds in the holes, glitter on the rainbow
function drawRainbowGround() {
  const T = G.T, R = T.rainbow, ev = T.ev;
  const x0 = clamp(Math.round(cam.x) - 20, 0, T.W - 1), y0 = clamp(Math.round(cam.y) - 20, 0, T.H - 1), w = Math.min(VW + 40, T.W - x0), h = Math.min(VH + 40, T.H - y0);
  for (const L of FAR) {
    const [n, f, col] = /** @type {[number, number, string]} */ (L);
    for (let s = 0; s < n; s++) {
      const W2 = VW + 60, H2 = VH + 60, sx = ((hash(s, 1, n) * W2 - cam.x * f + G.time * 4) % W2 + W2) % W2 - 30, sy = ((hash(s, 2, n) * H2 - cam.y * f) % H2 + H2) % H2 - 30;
      const x = Math.round(cam.x + sx), y = Math.round(cam.y + sy); if (x < 2 || y < 0 || x >= T.W - 4 || y >= T.H) continue;
      if (T.ter[y * T.W + x] !== HOLE || T.ter[y * T.W + x + 3] !== HOLE) continue;
      R1(x, y, 4, 1, col); R1(x + 1, y - 1, 2, 1, col);
    }
  }
  if (ev && ev.stormOn) {
    // lap 1 the lanes are pale (an early rainbow), in the storm grey; in the sun they glow
    const a = ev.sun ? 0 : ev.storm ? .3 + .62 * ev.storm.grey : .3;
    if (a > 0) { ctx.globalAlpha = a; ctx.drawImage(R.grey, x0, y0, w, h, x0, y0, w, h); ctx.globalAlpha = 1; }
    if (ev.sun) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .16 + .06 * Math.sin(G.time * 3); ctx.drawImage(R.clean, x0, y0, w, h, x0, y0, w, h); ctx.restore(); }
  }
  if (ev) for (const sp of R.stormSpots) if (sp.on && inView(sp.x, sp.y, 80)) ctx.drawImage(sp.pic.c, sp.pic.x, sp.pic.y);
  // the double rainbow: it appears with a shimmer
  if (ev && ev.sun) {
    const D = R.dbl, k = Math.min(1, ev.dblT / 1.2);
    ctx.globalAlpha = k; ctx.drawImage(D.pic.c, D.pic.x, D.pic.y); ctx.globalAlpha = 1;
    for (let q = 0; q < 30; q++) { const p = D.pts[(hash(q, Math.floor(G.time * 6), 171) * D.pts.length) | 0]; if (inView(p.x, p.y)) R1(Math.round(p.x) + ((q % 5) - 2) * 3, Math.round(p.y) + ((q % 3) - 1) * 4, 1, 1, '#ffffff'); }
  }
  // glitter on the rainbow road
  const kk = Math.floor(G.time * 5);
  for (let q = 0; q < 40 && R.glit.length; q++) { const p = R.glit[(hash(q, kk, 172) * R.glit.length) | 0], x = p % T.W, y = p / T.W | 0; if (inView(x, y)) { R1(x - 1, y, 3, 1, '#ffffff'); R1(x, y - 1, 1, 3, '#ffffff'); } }
  if (ev) {
    // the trails of the unicorns: six colours across, they fade
    for (const q of ev.trail) {
      if (!inView(q.x, q.y)) continue;
      const nx = -Math.sin(q.a), ny = Math.cos(q.a);
      ctx.globalAlpha = Math.min(1, q.t / 1.2) * .9;
      for (let b = 0; b < 6; b++) R1(Math.round(q.x + nx * (b - 2.5) * 2), Math.round(q.y + ny * (b - 2.5) * 2), 3, 2, RB[b]);
    }
    ctx.globalAlpha = 1;
    // where lightning will strike: a yellow circle that flickers and gets smaller
    for (const b of ev.bolts) {
      if (b.hit || !inView(b.x, b.y)) continue;
      const r = Math.round(BOLT.r * (1.6 - .6 * b.t / BOLT.warn)), bl = ((G.time * 12) | 0) % 2;
      ctx.fillStyle = bl ? '#ffe04a' : '#fff8c0';
      for (let a = 0; a < TAU; a += .12) ctx.fillRect(Math.round(b.x + Math.cos(a) * r), Math.round(b.y + Math.sin(a) * r * .8), 2, 2);
      ctx.globalAlpha = .2; ell(Math.round(b.x), Math.round(b.y), BOLT.r, Math.round(BOLT.r * .8), '#ffe04a'); ctx.globalAlpha = 1;
    }
  }
  // the wormhole: the purple mouth on its platform, the turquoise one on the road where you come out
  const P = R.portals, rot = G.time * 5;
  if (inView(P.b.x, P.b.y)) swirl(P.b.x, P.b.y, 9, '#1fb8b0', '#9ffff0', -rot);
  if (inView(P.a.x, P.a.y)) swirl(P.a.x, P.a.y, 10, '#8a3ad8', '#e0a8ff', rot);
}

// above the cars: the unicorns, the little rain cloud of the shower with the sun, balloons and birds, lightning, sparks, glitter, texts
function drawRainbowAbove() {
  const T = G.T, R = T.rainbow, ev = T.ev;
  // hot-air balloons in rainbow colours drift over the clouds
  for (let q = 0; q < 3; q++) {
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
  // the little cloud of the rain shower (the sun peeks out behind it)
  const S = R.shower;
  if (inView(S.x, S.y, 80)) {
    const sx = Math.round(S.x + 26), sy = Math.round(S.y - 44);
    ctx.globalAlpha = .9; disc(sx, sy, 9, '#ffd23f'); for (let q = 0; q < 8; q++) { const a = q / 8 * TAU + G.time * .5; R1(Math.round(sx + Math.cos(a) * 13), Math.round(sy + Math.sin(a) * 13), 2, 2, '#ffe88a'); }
    for (const [dx, dy, r] of [[-22, -30, 9], [-8, -34, 12], [8, -31, 10], [20, -28, 7], [-14, -26, 8], [2, -26, 9]]) { disc(Math.round(S.x + dx), Math.round(S.y + dy), r + 1, '#a8b0cc'); }
    for (const [dx, dy, r] of [[-22, -31, 8], [-8, -35, 11], [8, -32, 9], [20, -29, 6], [-14, -27, 7], [2, -27, 8]]) { disc(Math.round(S.x + dx), Math.round(S.y + dy), r, '#eef0fa'); disc(Math.round(S.x + dx - 2), Math.round(S.y + dy - 2), Math.max(1, r - 4), '#ffffff'); }
    ctx.globalAlpha = 1;
  }
  if (ev) {
    for (const u of ev.unis) {
      if (!inView(u.x, u.y, 30)) continue;
      ctx.globalAlpha = .22; ell(Math.round(u.x + 10), Math.round(u.y + 18), 10, 3, '#1b1440'); ctx.globalAlpha = 1;
      drawUnicorn(Math.round(u.x), Math.round(u.y - 10 + Math.sin(G.time * 10 + u.id) * 2), u.vx >= 0 ? 1 : -1, u.id);
    }
    // the strike: a zig-zag from the top of the screen down to its circle
    for (const b of ev.bolts) {
      if (!b.hit || !inView(b.x, b.y, 60)) continue;
      ctx.globalAlpha = 1 - (b.t - BOLT.warn) / BOLT.show;
      let x = b.x + (hash(b.seed, 1, 164) - .5) * 40, y = cam.y - 10;
      const steps = 9, dy = (b.y - y) / steps;
      for (let q = 1; q <= steps; q++) {
        const nx = q === steps ? b.x : b.x + (hash(b.seed, q, 165) - .5) * 40 * (1 - q / steps), ny = y + dy;
        const L = Math.max(1, Math.round(Math.hypot(nx - x, ny - y) / 2));
        for (let s = 0; s <= L; s++) { const px = Math.round(x + (nx - x) * s / L), py = Math.round(y + (ny - y) * s / L); R1(px - 1, py, 3, 2, '#fff8c0'); R1(px, py, 1, 2, '#ffffff'); }
        x = nx; y = ny;
      }
      ctx.globalAlpha = 1;
    }
    for (const s of ev.texts) text(s.s, Math.round(s.x), Math.round(s.y - 18 - (1.2 - s.t) * 10), 8, s.s === 'BZZZT!' ? '#ffe04a' : '#ffffff', 'center');
  }
  for (const p of G.parts) {
    if (p.t === 'glit') { ctx.globalAlpha = p.life / p.ml; R1(Math.round(p.x), Math.round(p.y), 2, 2, p.col); if (((G.time * 10) | 0) % 2) R1(Math.round(p.x), Math.round(p.y), 1, 1, '#ffffff'); }
    else if (p.t === 'spark') { ctx.globalAlpha = p.life / p.ml; const x = Math.round(p.x), y = Math.round(p.y); R1(x, y, 3, 1, '#fff070'); R1(x + 2, y + 1, 1, 2, '#fff070'); R1(x + 2, y + 3, 3, 1, '#ffffff'); }
    else if (p.t === 'puff') { const f = p.life / p.ml; ctx.globalAlpha = f * .6; disc(Math.round(p.x), Math.round(p.y), Math.round(3 + (1 - f) * 5), '#7e8492'); }
    else if (p.t === 'warp') { ctx.globalAlpha = p.life / p.ml; R1(Math.round(p.x), Math.round(p.y), 2, 2, p.col); }
  }
  ctx.globalAlpha = 1;
}

// on the screen: the sunrise (lap 1), the dark front and the darkness of the storm, lightning flashes, the sun, fireworks, messages
function drawRainbowSky() {
  const T = G.T, ev = T.ev; if (!ev) return;
  if (ev.stormOn && !ev.storm && !ev.sun) {
    // sunrise: golden light from the top left, slow beams
    ctx.fillStyle = 'rgba(255,186,96,.10)'; ctx.fillRect(0, 0, VW, VH);
    ctx.save(); ctx.globalAlpha = .07; ctx.fillStyle = '#fff1b0';
    for (let k = 0; k < 4; k++) { const span = VW + 260, bx = (((k * 170 + G.time * 5 - cam.x * .3) % span) + span) % span - 100; ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + 40, 0); ctx.lineTo(bx + 150, VH); ctx.lineTo(bx + 80, VH); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  const s = ev.storm;
  if (s && !ev.sun) {
    const p = Math.min(1, s.t / STORM.front), wx = Math.round(T.W + 60 - p * (T.W + 120) - cam.x);
    if (wx < VW) {
      ctx.fillStyle = 'rgba(22,26,52,' + (.32 * Math.min(1, s.t / 2)).toFixed(3) + ')'; ctx.fillRect(Math.max(0, wx), 0, VW, VH);
      if (p < 1) for (let k = 0; k < 14; k++) { const y = k * VH / 13, r = 18 + 8 * Math.sin(G.time * 2 + k); ctx.globalAlpha = .5; disc(wx + Math.round(Math.sin(G.time * 3 + k * 1.7) * 6), Math.round(y), Math.round(r), '#3a3f58'); }
      ctx.globalAlpha = 1;
    }
  }
  if (ev.sun) {
    const k = Math.min(1, ev.sun.t / 1.5);
    ctx.fillStyle = 'rgba(255,236,170,' + (.16 * (1 - k) + .05).toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH);
    ctx.save(); ctx.globalAlpha = .08; ctx.fillStyle = '#fff6c8';
    for (let q = 0; q < 6; q++) { const a = q / 6 * Math.PI / 2 + Math.sin(G.time * .3) * .05; ctx.beginPath(); ctx.moveTo(-20, -20); ctx.lineTo(-20 + Math.cos(a - .05) * 700, -20 + Math.sin(a - .05) * 700); ctx.lineTo(-20 + Math.cos(a + .05) * 700, -20 + Math.sin(a + .05) * 700); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    for (const f of ev.fw) {
      if (!f.bang) { R1(Math.round(f.x), Math.round(f.y), 1, 3, '#fff3c0'); continue; }
      ctx.globalAlpha = Math.max(0, 1 - f.t / 1.4);
      for (const q of f.parts) R1(Math.round(q.x), Math.round(q.y), 2, 2, ((G.time * 14) | 0) % 3 ? f.col : '#ffffff');
    }
    ctx.globalAlpha = 1;
  }
  if (ev.flash > 0) { ctx.fillStyle = 'rgba(255,255,240,' + (ev.flash * .55).toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH); }
  if (ev.msg && ((G.time * 4) | 0) % 2) {
    text(ev.msg.s, VW / 2, 34, 8, ev.sun ? '#ffd23f' : '#c8d0ff', 'center');
    if (ev.sun) text('DOPPELTER REGENBOGEN!', VW / 2, 46, 8, RB[((G.time * 6) | 0) % 6], 'center');
  }
}

// ---------- hooks: how the core calls this track (hooks.js; what each hook does: _template.js) ----------
/** @type {import('./_template.js').TrackHooks} */
export const rainbowHooks = {
  init: initRainbow, events: { einhorn: initUnicorns, gewitter: initThunder }, update: rainbowUpdate, collisions: rainbowCollisions,
  surf: c => c.surf >= 41 ? rainbowSurf(c) : null, // its colour lanes, the asphalt of the gold coin, cloud holes
  target: rainbowTarget, lane: rainbowLane, throttle: rainbowThrottle, ground: rainbowGround, noRespawn: t => t === 48, respawn: rainbowRespawn,
  drawFall(c, F, lv) { if (c.fallKind !== 'cloud') return false; drawRainbowFall(c, F, lv); return true; }, // through a cloud hole, then a unicorn catches it
  drawGround: drawRainbowGround, drawAbove: drawRainbowAbove, drawSky: drawRainbowSky,
};
