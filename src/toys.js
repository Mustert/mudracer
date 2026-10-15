import { G } from './g.js';
import { SFX, noise, voice } from './audio.js';
import { HALF, LAPS, SS, TAU, VH, VW, clamp, ctx, hash, mk, rotIndex } from './core.js';
import { R1, disc, ell, text } from './gfx.js';
import { nearObstacles } from './grid.js';
import { addP } from './particles.js';
import { fallCar, inView, near } from './trackfx.js';
import { loopAt, loopSpeed } from './toymap.js';

// ---------- Spielzimmer while racing ----------
// The cars are toy cars in a kids' room. Levels: the floor, the bed and the desk. The level follows the place on the lap (c.idx, see
// toymap.js): up there a car is drawn bigger with its shadow further away, and cars only collide with cars on the same level (c.lvl: 2 floor,
// 1 bed, 3 desk, 4 inside the marble run; update.js and the walls with `down` only for the floor). A car up there that leaves the bed, the
// desk, the ramp or the ruler falls to the floor (whistle, set down on the road again; from the pillow it goes back to the start of the run-up).
// The pillow throws the cars over the gap onto the desk (a jump, see trackfx.js). The marble run takes the car from the desk down to the floor:
// two fast turns in the spiral, it comes out at the bottom with a push. Plasticine colours the car (the 'knete' sprites), watercolour too,
// without braking. The toy car wash has turning brushes.
// Event "spielzeug": the wooden train goes round its loop and stops at its station (wooden barriers close; you can drive through them, they fold
// away; the train throws you round), a wind-up car drives straight across the rug, bounces off whatever it meets and is wound up again by an
// invisible hand, marbles roll out of the marble run across the road below (a rattle first), the domino tower falls across the road when you
// touch it (then you bump over the dominoes; after 20 s it stands up again).
// Event "saugroboter": from lap 2 the robot vacuum leaves its dock and drives in straight lines over the floor; it pulls the cars near it and
// swallows the ones that come too close ("SCHLUERF!"), then spits them out behind it, dusty grey. It also eats marbles and fallen dominoes.
// In the last lap the light goes out ("SCHLAFENSZEIT!"): it is dark like the forest, the cars have headlights, the star projector on the night
// stand throws turning stars and a moon over the room, the night light glows.

const TRAIN = { v: 62, n: 3, gap: 19, hit: 12, stop: 3, warn: 58 };
const WIND = { v: 58, run: 7, wind: 2.2, r: 9 };
const MARBLE = { every: 6.5, warn: 1.1, v: 96, r: 5, rest: 5 };
const DOMINO = { dt: .07, back: 20, rise: .6 };
const ROBOT = { v: 46, pull: 95, reach: 85, eat: 19, r: 16 };
const TUBE = { v: 118, out: 140 };
const vol = (x, y, k = 1) => clamp(1 - near(x, y) / 380, 0, 1) * k;
const lastLap = () => !!G.player && G.player.lap >= LAPS && (G.state === 'race' || G.state === 'finish');

// ----- the sounds of the toy room (only here, so they live here) -----
const SND = {
  toot: v => { for (const [t, f] of [[0, 784], [.2, 622]]) { voice({ t, type: 'triangle', f, to: f * 1.01, a: .02, hold: .13, d: .08, vol: .09 * v, lp: 2600 }); noise({ t, type: 'bandpass', f: f * 2, q: 3, a: .02, hold: .1, d: .06, vol: .03 * v }); } },
  klack: v => { noise({ type: 'bandpass', f: 2300, q: 3, d: .03, vol: .22 * v }); voice({ type: 'square', f: 720, to: 420, d: .04, vol: .05 * v, lp: 2000 }); },
  domino: v => { noise({ type: 'bandpass', f: 2800 + Math.random() * 600, q: 4, d: .02, vol: .16 * v }); voice({ type: 'triangle', f: 1100, to: 800, d: .03, vol: .04 * v }); },
  ratchet: v => { for (let i = 0; i < 12; i++) noise({ t: i * .05, type: 'bandpass', f: 3200, q: 6, d: .014, vol: .12 * v }); },
  marbles: v => { for (let i = 0; i < 8; i++) voice({ t: i * .09 + Math.random() * .03, f: 2200 + Math.random() * 1800, a: .001, d: .05, vol: .06 * v }); },
  marbleHit: v => { voice({ f: 2600, to: 1800, a: .001, d: .08, vol: .1 * v }); noise({ type: 'highpass', f: 4000, d: .02, vol: .1 * v }); },
  slurp: v => { noise({ type: 'bandpass', f: 300, to: 3400, a: .05, hold: .25, d: .25, vol: .3 * v, q: 2 }); voice({ type: 'sawtooth', f: 240, to: 70, a: .02, hold: .2, d: .3, vol: .07 * v, lp: 900 }); },
  chew: v => { for (let i = 0; i < 12; i++) noise({ t: i * .07, type: 'bandpass', f: 900 + (i % 3) * 600, q: 3, d: .035, vol: .13 * v }); },
  spit: v => { voice({ f: 520, to: 140, d: .16, vol: .25 * v }); noise({ type: 'lowpass', f: 1600, to: 300, d: .18, vol: .22 * v }); },
  beep: () => { for (const [t, f] of [[0, 1568], [.16, 2093], [.32, 1568]]) voice({ t, type: 'square', f, a: .003, hold: .07, d: .05, vol: .05, lp: 4000 }); },
  hum: v => { voice({ type: 'sawtooth', f: 96, to: 92, a: .3, hold: 1.4, d: .4, vol: .05 * v, lp: 500 }); noise({ type: 'bandpass', f: 900, q: .8, a: .3, hold: 1.4, d: .4, vol: .04 * v }); },
  brush: v => { for (let i = 0; i < 7; i++) noise({ t: i * .08, type: 'bandpass', f: 1300 + (i % 2) * 500, q: 1.2, a: .02, d: .06, vol: .14 * v }); },
  click: () => { noise({ type: 'highpass', f: 3000, d: .02, vol: .3 }); voice({ type: 'square', f: 1400, d: .015, vol: .08, lp: 4000 }); },
  boing: v => { voice({ type: 'sine', f: 160, to: 540, a: .005, d: .3, vol: .22 * v }); voice({ t: .05, type: 'triangle', f: 330, to: 260, a: .01, d: .25, vol: .06 * v }); },
  tube: v => { for (let i = 0; i < 10; i++) voice({ t: i * .05, f: 600 + i * 90, a: .002, d: .04, vol: .05 * v }); noise({ type: 'bandpass', f: 400, to: 2400, a: .05, hold: .3, d: .2, vol: .1 * v, q: 2 }); },
  plink: () => { for (const [t, f] of [[0, 1568], [.08, 2093], [.16, 2637]]) voice({ t, f, a: .002, d: .25, vol: .05 }); },
};

function initToys(T) {
  const ev = T.ev, S = T.toys;
  ev.toyOn = false; ev.robotOn = false; ev.gate = S.cross.map(() => 0); ev.knock = S.cross.map(() => [0, 0]); ev.closed = S.cross.map(() => false);
  // the train waits at its station at the top of the loop (that is where it stays when the event is off)
  ev.train = { th: -Math.PI / 2, wait: 2, prev: -Math.PI / 2 };
  ev.windup = null; ev.marbles = []; ev.marbleN = 0; ev.marbleNext = 5; ev.marbleWarn = 0; ev.domino = null; ev.robot = null;
  ev.dark = 0; ev.darkOn = false; ev.msg = null; ev.msgT = 0; ev.pops = []; ev.obst = [];
}

function initToyEvents(T) {
  const ev = T.ev, S = T.toys; ev.toyOn = true;
  ev.windup = { x: S.wind.start[0], y: S.wind.start[1], a: 0, run: WIND.run, wind: 0, key: 0, n: 0 };
  ev.domino = { st: 'up', t: 0, gone: [] };
}

function initRobot(T) {
  const [x, y] = T.toys.robot.dock;
  T.ev.robotOn = true; T.ev.robot = { x: Math.max(x + 4, T.toys.robot.box[0] + 6), y, a: 0, out: false, n: 0, chew: 0, humT: 0, eaten: 0 };
}

// ======================================================= every step (before the physics)

function toyUpdate(T, dt) {
  const ev = T.ev, S = T.toys;
  for (const c of G.cars) {
    // the level and the height on the lap; inside the marble run a level of its own
    c.h = c.tube ? S.hgt[S.t0] * (1 - c.tube.f) : S.hgt[c.idx]; c.lvl = c.tube ? 4 : S.lv[c.idx];
    if (c.z > 0 && !c.boinged) { c.boinged = true; if (c.idx >= S.lipI - 30 && c.idx <= S.landI) SND.boing(c.ai ? vol(c.x, c.y, .4) : 1); }
    if (c.z <= 0) c.boinged = false;
  }
  updateTrain(T, dt);
  if (ev.toyOn) { updateWind(T, dt); updateMarbles(T, dt); updateDomino(T, dt); }
  if (ev.robotOn) updateRobot(T, dt);
  // the light goes out in the last lap (with the robot vacuum)
  if (ev.robotOn && lastLap() && !ev.darkOn) { ev.darkOn = true; SND.click(); say(ev, 'SCHLAFENSZEIT!', '#ffe9a0', 2.8); }
  ev.dark = clamp(ev.dark + (ev.darkOn ? dt / .5 : -dt), 0, 1);
  ev.msgT = Math.max(0, ev.msgT - dt);
  ev.pops = ev.pops.filter(p => (p.t -= dt) > 0);
  // the computer cars steer round the robot, the wind-up car and rolling marbles
  ev.obst = [];
  if (ev.robot && ev.robot.out) ev.obst.push(ev.robot);
  if (ev.windup) ev.obst.push(ev.windup);
  for (const m of ev.marbles) if (Math.hypot(m.vx, m.vy) > 20) ev.obst.push(m);
  // the car wash: soap bubbles
  const W = S.wash;
  if (inView(W.x, W.y) && Math.random() < dt * 14) addP({ t: 'bub', x: W.x + W.nm.x * (Math.random() - .5) * 2 * HALF, y: W.y + W.nm.y * (Math.random() - .5) * 2 * HALF, vx: (Math.random() - .5) * 10, vy: -10 - Math.random() * 10, life: .9, ml: .9 });
}

function say(ev, s, col, t) { ev.msg = { s, col }; ev.msgT = t; }
const pop = (ev, s, x, y, col) => ev.pops.push({ s, x, y, col, t: 1.1 });

// ----- the wooden train: round the loop, a stop at the station at the top, the barriers close while it is near a crossing -----
function updateTrain(T, dt) {
  const ev = T.ev, S = T.toys, L = S.train, tr = ev.train;
  if (ev.toyOn) {
    if (tr.wait > 0) tr.wait -= dt;
    else {
      tr.prev = tr.th; tr.th += TRAIN.v / loopSpeed(L, tr.th) * dt;
      // once a round it stops at the station (the top of the loop, away from the road)
      const st = -Math.PI / 2 + TAU * Math.ceil((tr.prev + Math.PI / 2) / TAU - 1e-6);
      if (tr.prev < st && tr.th >= st) { tr.th = st; tr.wait = TRAIN.stop; if (vol(loopAt(L, st).x, loopAt(L, st).y) > .05) SND.toot(vol(loopAt(L, st).x, loopAt(L, st).y)); }
    }
  }
  const P = trainPieces(S, tr);
  S.cross.forEach((cr, k) => {
    // closed while the engine comes close or a piece of the train is still on the crossing
    const head = P[0], dh = Math.hypot(head.x - cr.x, head.y - cr.y), app = ((cr.th - tr.th) % TAU + TAU) % TAU < 1.4;
    const shut = ev.toyOn && tr.wait <= 0 && ((dh < TRAIN.warn && app) || P.some(p => Math.hypot(p.x - cr.x, p.y - cr.y) < 26));
    if (shut && !ev.closed[k]) { const v = vol(cr.x, cr.y); if (v > .05) SND.toot(v * .8); }
    ev.closed[k] = shut;
    ev.gate[k] = clamp(ev.gate[k] + (shut ? dt * 3 : -dt * 2), 0, 1);
    ev.knock[k] = ev.knock[k].map(q => Math.max(0, q - dt / 1.2));
  });
}

// the engine and its wagons: positions along the loop (each one a fixed distance behind the one in front)
function trainPieces(S, tr) {
  const L = S.train, out = [];
  let th = tr.th;
  for (let k = 0; k < TRAIN.n; k++) {
    const p = loopAt(L, th), q = loopAt(L, th + .05);
    out.push({ x: p.x, y: p.y, a: Math.atan2(q.y - p.y, q.x - p.x), k });
    th -= TRAIN.gap / loopSpeed(L, th);
  }
  return out;
}

// ----- the wind-up car -----
function updateWind(T, dt) {
  const w = T.ev.windup, [x0, y0, x1, y1] = T.toys.wind.box;
  if (w.run > 0) {
    w.run -= dt;
    const v = WIND.v * Math.min(1, w.run / 1.2), nx = w.x + Math.cos(w.a) * v * dt, ny = w.y + Math.sin(w.a) * v * dt;
    let hit = nx < x0 || nx > x1 || ny < y0 || ny > y1;
    if (nx < x0 || nx > x1) w.a = Math.PI - w.a;
    if (ny < y0 || ny > y1) w.a = -w.a;
    if (!hit) for (const o of nearObstacles(T.grid, nx, ny)) {
      if (o.down) continue;
      const dx = nx - o.x, dy = ny - o.y, d = Math.hypot(dx, dy);
      if (d < o.r + WIND.r && d > 0) { const n = Math.atan2(dy, dx); w.a = 2 * n - w.a + Math.PI + (hash(w.n++, 1, 151) - .5) * .6; hit = true; break; }
    }
    if (hit) { if (inView(w.x, w.y)) SND.klack(vol(w.x, w.y, .6)); }
    else { w.x = nx; w.y = ny; }
    w.key += dt * 3 * Math.min(1, w.run);
    if (w.run <= 0) { w.wind = WIND.wind; if (inView(w.x, w.y, 80)) SND.ratchet(vol(w.x, w.y)); }
  } else {
    // wound up again by an invisible hand: the key turns fast, then off it goes in a new direction
    w.wind -= dt; w.key += dt * 14;
    if (w.wind <= 0) { w.run = WIND.run; w.a += 1.2 + hash(w.n++, 2, 151) * 3; }
  }
}

// ----- marbles out of the marble run -----
function updateMarbles(T, dt) {
  const ev = T.ev, M = T.toys.marble;
  if (ev.t >= ev.marbleNext - MARBLE.warn && ev.marbleWarn <= 0) { ev.marbleWarn = MARBLE.warn; const v = vol(M.out[0], M.out[1]); if (v > .05) SND.marbles(v); }
  if (ev.marbleWarn > 0) {
    ev.marbleWarn -= dt;
    if (ev.marbleWarn <= 0) {
      const n = ev.marbleN++, a = Math.atan2(M.dir[1], M.dir[0]) + (hash(n, 1, 152) - .5) * .5, sp = MARBLE.v * (.85 + hash(n, 2, 152) * .3);
      ev.marbles.push({ x: M.out[0], y: M.out[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rest: 0, col: n % 4, rot: 0 });
      if (hash(n, 3, 152) < .4) ev.marbles.push({ x: M.out[0] + 4, y: M.out[1] + 2, vx: Math.cos(a + .25) * sp * .8, vy: Math.sin(a + .25) * sp * .8, rest: 0, col: (n + 2) % 4, rot: 0 });
      ev.marbleNext = ev.t + MARBLE.every * (.8 + hash(n, 4, 152) * .4);
    }
  }
  for (const m of ev.marbles) {
    const f = Math.exp(-.35 * dt); m.vx *= f; m.vy *= f;
    const nx = m.x + m.vx * dt, ny = m.y + m.vy * dt;
    let ok = nx > 8 && ny > 8 && nx < T.W - 8 && ny < T.H - 8;
    if (!ok) { if (nx <= 8 || nx >= T.W - 8) m.vx = -m.vx * .6; else m.vy = -m.vy * .6; }
    else for (const o of nearObstacles(T.grid, nx, ny)) {
      const dx = nx - o.x, dy = ny - o.y, d = Math.hypot(dx, dy);
      if (d < o.r + MARBLE.r && d > 0) { const ux = dx / d, uy = dy / d, vn = m.vx * ux + m.vy * uy; if (vn < 0) { m.vx -= 1.7 * vn * ux; m.vy -= 1.7 * vn * uy; } ok = false; break; }
    }
    if (ok) { m.x = nx; m.y = ny; }
    m.rot += Math.hypot(m.vx, m.vy) * dt / MARBLE.r;
    if (Math.hypot(m.vx, m.vy) < 10) m.rest += dt;
  }
  ev.marbles = ev.marbles.filter(m => m.rest < MARBLE.rest && !m.eaten);
}

// ----- the domino tower: knocked over, the stones fall one after another across the road; 20 s later it stands up again -----
function updateDomino(T, dt) {
  const D = T.ev.domino, Q = T.toys.domino; D.t += dt;
  if (D.st === 'fall') {
    const k = Math.floor(D.t / DOMINO.dt);
    if (k !== D.k && k <= Q.n) { D.k = k; if (k < Q.n) SND.domino(vol(Q.x, Q.y + k * Q.step)); }
    if (D.t > DOMINO.back) { D.st = 'rise'; D.t = 0; }
  } else if (D.st === 'rise' && D.t > DOMINO.rise) { D.st = 'up'; D.t = 0; D.gone = []; if (inView(Q.x, Q.y)) SND.plink(); }
}

// how many dominoes lie on the road already (they fall one after another)
const fallen = D => D.st === 'fall' ? Math.min(G.T.toys.domino.n, Math.floor(D.t / DOMINO.dt) + 1) : 0;

// ----- the robot vacuum: out of its dock in lap 2, straight lines, it turns at whatever is in its way; it pulls the cars on the floor -----
function updateRobot(T, dt) {
  const R = T.ev.robot, S = T.toys, [x0, y0, x1, y1] = S.robot.box;
  if (!R.out) {
    if (!G.player || G.player.lap < 2) return;
    R.out = true; SND.beep(); say(T.ev, 'SAUGROBOTER!', '#8fd8ff', 2.4);
  }
  R.chew = Math.max(0, R.chew - dt);
  if (R.chew <= 0) {
    const nx = R.x + Math.cos(R.a) * ROBOT.v * dt, ny = R.y + Math.sin(R.a) * ROBOT.v * dt;
    let hit = nx < x0 || nx > x1 || ny < y0 || ny > y1 || !!S.upM[(ny | 0) * T.W + (nx | 0)];
    if (!hit) for (const o of nearObstacles(T.grid, nx, ny)) { if (Math.hypot(nx - o.x, ny - o.y) < o.r + ROBOT.r - 2) { hit = true; break; } }
    if (hit) R.a += Math.PI / 2 + hash(R.n++, 1, 153) * Math.PI;
    else { R.x = nx; R.y = ny; }
  }
  // the suction: the closer, the harder (heavy off-road cars hold on better)
  for (const c of G.cars) {
    if (c.lvl !== 2 || c.fall > 0 || c.z > 0 || c.ghost > 0) continue;
    const dx = R.x - c.x, dy = R.y - c.y, d = Math.hypot(dx, dy);
    if (d < ROBOT.reach && d > 1) { const f = (ROBOT.pull * (1 - d / ROBOT.reach) + 25) / c.def.mud; c.vx += dx / d * f * dt; c.vy += dy / d * f * dt; }
  }
  R.humT -= dt;
  if (R.humT <= 0) { R.humT = 1.8; const v = vol(R.x, R.y); if (v > .05) SND.hum(v); }
  // it eats marbles and fallen dominoes
  for (const m of T.ev.marbles) if (Math.hypot(m.x - R.x, m.y - R.y) < ROBOT.eat) m.eaten = true;
  const D = T.ev.domino, Q = S.domino;
  if (D && D.st === 'fall') for (let k = 0; k < fallen(D); k++) if (!D.gone[k] && Math.hypot(Q.x - R.x, Q.y + Q.step * (k + .5) - R.y) < ROBOT.eat) D.gone[k] = true;
}

// ======================================================= collisions (after the walls)

function toyCollisions() {
  const T = G.T, ev = T.ev, S = T.toys; if (!ev || !S) return;
  // the train throws a car round (softer than the real one)
  if (ev.toyOn) for (const p of trainPieces(S, ev.train)) for (const c of G.cars) {
    if (c.lvl !== 2 || c.fall > 0 || c.z > 0 || c.ghost > 0 || c.stun > 0) continue;
    const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy); if (d > TRAIN.hit + 9 || d === 0) continue;
    c.vx = Math.cos(p.a) * 150 + dx / d * 70; c.vy = Math.sin(p.a) * 150 + dy / d * 70; c.spin = 14; c.stun = 1.1; c.boost = 0;
    if (!c.ai) SFX.crash(); else if (near(c.x, c.y) < 260) SFX.bump();
    pop(ev, 'TUUT!', p.x, p.y, '#ffe9a0');
  }
  // the wooden barriers fold away when a car drives through them
  S.cross.forEach((cr, k) => {
    if (ev.gate[k] < .5) return;
    const tg = T.tan[cr.i];
    for (const c of G.cars) for (const s of [0, 1]) {
      const bx = cr.x - tg.x * (s ? -18 : 18), by = cr.y - tg.y * (s ? -18 : 18), a = (c.x - bx) * tg.x + (c.y - by) * tg.y;
      if (Math.abs(a) < 6 && Math.hypot(c.x - bx, c.y - by) < HALF + 4 && ev.knock[k][s] <= 0 && Math.hypot(c.vx, c.vy) > 25) { ev.knock[k][s] = 1; SND.klack(c.ai ? vol(c.x, c.y, .6) : 1); }
    }
  });
  // the wind-up car: pushed away, a hard hit makes the car spin
  const w = ev.windup;
  if (w) for (const c of G.cars) {
    if (c.lvl !== 2 || c.fall > 0 || c.z > 0 || c.ghost > 0) continue;
    const dx = c.x - w.x, dy = c.y - w.y, d = Math.hypot(dx, dy), mn = WIND.r + 9; if (d >= mn || d === 0) continue;
    const nx = dx / d, ny = dy / d, vn = c.vx * nx + c.vy * ny;
    c.x = w.x + nx * mn; c.y = w.y + ny * mn;
    if (vn < -40 && !c.stun) { c.vx = nx * 120; c.vy = ny * 120; c.spin = 10; c.stun = .7; if (!c.ai) SFX.bump(); SND.klack(c.ai ? vol(c.x, c.y, .5) : 1); }
    else if (vn < 0) { c.vx -= 1.4 * vn * nx; c.vy -= 1.4 * vn * ny; }
    w.a = Math.atan2(-ny, -nx);
  }
  // marbles: the car spins for a moment, the marble flies off
  for (const m of ev.marbles) for (const c of G.cars) {
    if (c.lvl !== 2 || c.fall > 0 || c.z > 0 || c.ghost > 0) continue;
    const dx = c.x - m.x, dy = c.y - m.y, d = Math.hypot(dx, dy), mn = MARBLE.r + 9; if (d >= mn || d === 0) continue;
    const sp = Math.hypot(c.vx, c.vy);
    m.vx = -dx / d * (sp * 1.2 + 40); m.vy = -dy / d * (sp * 1.2 + 40); m.rest = 0;
    if (sp > 30 && !c.stun) { c.stun = .5; c.spin = (hash(m.col, ev.marbleN, 154) < .5 ? -1 : 1) * 10; c.vx *= .6; c.vy *= .6; }
    SND.marbleHit(c.ai ? vol(c.x, c.y, .5) : 1);
  }
  // the domino tower falls when a car touches it
  const D = ev.domino, Q = S.domino;
  if (D && D.st === 'up') for (const c of G.cars) if (c.lvl === 2 && c.fall <= 0 && c.z <= 0 && Math.hypot(c.x - Q.x, c.y - Q.y) < 17 && Math.hypot(c.vx, c.vy) > 15) {
    D.st = 'fall'; D.t = 0; D.k = -1; D.gone = []; pop(ev, 'KLACK!', Q.x, Q.y - 14, '#ffffff'); break;
  }
  // the robot swallows a car that comes too close
  const R = ev.robot;
  if (R && R.out) for (const c of G.cars) {
    if (c.lvl !== 2 || c.fall > 0 || c.z > 0 || c.ghost > 0) continue;
    if (Math.hypot(c.x - R.x, c.y - R.y) > ROBOT.eat) continue;
    c.fall = 1.2; c.fallT0 = 1.2; c.fallKind = 'suck'; c.fx0 = c.x; c.fy0 = c.y; c.vx = c.vy = 0; c.boost = 0; c.stun = 0; c.spit = R;
    R.chew = 1.2; R.eaten++;
    SND.slurp(c.ai ? vol(c.x, c.y, .6) : 1); SND.chew(c.ai ? vol(c.x, c.y, .4) : .8);
    pop(ev, 'SCHLUERF!', R.x, R.y - 16, '#8fd8ff');
  }
}

// ======================================================= the ground under a car (from update.js)

function toyGround(c, j, sp, dt) {
  const T = G.T, S = T.toys, N = T.N, ev = T.ev;
  // the marble run: in at the top (from the desk), two fast turns in the spiral, out at the bottom with a push
  if (!c.tube && c.lvl === 3 && c.idx >= S.t0 && c.idx < S.t0 + 14) { c.tube = { f: 0 }; c.lvl = 4; SND.tube(c.ai ? vol(c.x, c.y, .5) : 1); }
  if (c.tube) {
    const len = S.t1 - S.t0;
    c.tube.f += TUBE.v * dt / (len * 2);
    const q = Math.min(S.t1, S.t0 + Math.floor(c.tube.f * len)), tg = T.tan[q];
    c.x = T.path[q].x; c.y = T.path[q].y; c.vx = tg.x * TUBE.v; c.vy = tg.y * TUBE.v; c.ang = Math.atan2(tg.y, tg.x); c.stun = 0;
    if (c.tube.f >= 1) {
      const o = (S.t1 + 10) % N, to = T.tan[o];
      c.tube = null; c.x = T.path[o].x; c.y = T.path[o].y; c.idx = o; c.vx = to.x * TUBE.out; c.vy = to.y * TUBE.out; c.ang = Math.atan2(to.y, to.x); c.boost = .45; c.lvl = 2;
      if (!c.ai || near(c.x, c.y) < 260) SND.klack(c.ai ? .4 : 1);
    }
    return;
  }
  // up on the bed or the desk and over the edge: down to the floor (from the pillow back to the start of the run-up)
  if ((c.lvl === 1 || c.lvl === 3) && !S.upM[j]) { fallCar(c, 'abyss', c.idx >= S.lipI - 6 && c.idx <= S.landI + 30 ? S.runI : undefined); return; }
  // watercolour: no brake, but it colours the car like plasticine
  if (c.surf === 32) {
    c.cem = false; c.dirt = Math.min(1, c.dirt + .45 * dt * (sp > 8 ? 1 : .3)); c.mudTrail = 1;
    if (sp > 30 && Math.random() < dt * 20) addP({ t: 'd', x: c.x, y: c.y, z: 2, vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 40, vz: 40, col: T.th.mudP[(Math.random() * 4) | 0], s: 1, life: .6, ml: .6, mud: true });
  }
  // the folds of the duvet: a little bumpy
  if (c.surf === 31 && sp > 30) c.bump = ((G.time * 9 + c.seed) | 0) % 3 === 0 ? 1 : 0;
  // fallen dominoes across the road: bumpy and slow
  const D = ev.domino, Q = S.domino;
  if (D && D.st === 'fall') {
    const n = fallen(D), k = Math.floor((c.y - Q.y) / Q.step);
    if (Math.abs(c.x - Q.x) < 9 && k >= 0 && k < n && !D.gone[k]) {
      const f = Math.exp(-2.2 * dt); c.vx *= f; c.vy *= f; c.bump = ((G.time * 16) | 0) % 2;
      if (Math.random() < dt * 8) SND.domino(c.ai ? vol(c.x, c.y, .4) : .8);
    }
  }
  // the toy car wash: brushes
  if (c.washing && !c.brushIn) { c.brushIn = true; SND.brush(c.ai ? vol(c.x, c.y, .4) : 1); }
  if (!c.washing) c.brushIn = false;
  // the computer cars know the pillow: on the run-up they go full speed, so they reach the desk
  if (c.ai && c.idx >= S.runI && c.idx < S.lipI) {
    const tg = T.tan[c.idx], f = c.vx * tg.x + c.vy * tg.y;
    if (f < 112) { c.vx += tg.x * 220 * dt; c.vy += tg.y * 220 * dt; }
  }
}

// back on the road after a fall; a car the robot swallowed is spat out behind it, dusty grey
function toyRespawn(c) {
  const R = c.spit;
  if (R) {
    c.spit = null;
    const bx = R.x - Math.cos(R.a) * 30, by = R.y - Math.sin(R.a) * 30;
    c.x = clamp(bx, 14, G.T.W - 14); c.y = clamp(by, 14, G.T.H - 14); c.ang = R.a + Math.PI; c.vx = -Math.cos(R.a) * 110; c.vy = -Math.sin(R.a) * 110;
    c.cem = !!c.Fc; c.dirt = 1;
    for (let k = 0; k < 14; k++) addP({ t: 'smoke', x: c.x + (Math.random() - .5) * 14, y: c.y + (Math.random() - .5) * 10, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, life: .9, ml: .9 });
    SND.spit(c.ai ? vol(c.x, c.y, .6) : 1);
    return;
  }
  for (let k = 0; k < 8; k++) addP({ t: 'dust', x: c.x + (Math.random() - .5) * 20, y: c.y + (Math.random() - .5) * 14, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, life: .5, ml: .5 });
}

// ======================================================= the computer cars

// the middle of the ruler and the pillow, past the eraser, the clean way round the paint box, waiting at the barriers
function toyLane(c, i, lane) {
  const T = G.T, S = T.toys, ev = T.ev, N = T.N, sp = Math.hypot(c.vx, c.vy);
  const inR = (a, b) => ((c.idx - a + N) % N) <= ((b - a + N) % N);
  // the ruler, the run-up on the pillow: right in the middle
  if (inR(S.rulerI[0] - 20, S.rulerI[1] + 4) || inR(S.runI, S.lipI)) return 0;
  // the eraser lies on the left of the road: keep right
  if (inR(S.eraserI - 30, S.eraserI + 12)) return 16;
  // the clean way round the paint box: some of them (the ones that do not like dirt more often) take it
  if (inR(S.forkI[0] - 30, S.forkI[0] - 28)) c.forkWay = (c.seed * 4.1 + c.lap * .37) % 1 < (c.def.mud < 1.15 ? .6 : .3);
  if (c.forkWay && inR(S.forkI[0], S.forkI[1])) { const f = ((i - S.forkI[0] + N) % N) / ((S.forkI[1] - S.forkI[0] + N) % N); return 62 * clamp(Math.min(f / .18, (1 - f) / .18), 0, 1); }
  // up on the desk and the bed less wandering (the edge is near)
  if (c.lvl === 1 || c.lvl === 3) {
    lane = clamp(lane, -10, 10);
    // and they brake before the sharp bends there, so they do not fly off the edge
    const ta = T.tan[c.idx], tb = T.tan[(c.idx + 40) % N], bend = Math.abs(Math.atan2(ta.x * tb.y - ta.y * tb.x, ta.x * tb.x + ta.y * tb.y));
    if (bend > .7 && sp > 90 + 40 * (1.6 - bend)) c.brake = true;
  }
  // a closed barrier ahead: wait for the train
  if (ev) S.cross.forEach((cr, k) => { const a = (cr.i - c.idx + N) % N; if (ev.gate[k] > .4 && a > 6 && a < 40 && sp > 20) c.brake = true; });
  return lane;
}

// ======================================================= drawing

// cars up on the bed or the desk are bigger, their shadow lies further away; inside the marble run they are drawn later (over it); a car the
// robot swallows shrinks into it. True when the car is drawn here.
function drawToyCar(c, F, rot, lv) {
  if (c.tube) return true;
  if (c.fall > 0 && c.fallKind === 'suck') {
    const t = Math.min(1, (c.fallT0 - c.fall) / .4), R = c.spit; if (t >= 1 || !R) return true;
    const x = c.fx0 + (R.x - c.fx0) * t, y = c.fy0 + (R.y - c.fy0) * t, S = Math.max(4, Math.round(SS * (1 - t * .8)));
    ctx.drawImage(F.frames[lv][rotIndex(c.ang + t * 6)], Math.round(x - S / 2), Math.round(y - S / 2), S, S);
    return true;
  }
  const h = c.h || 0;
  if (h < .05 || c.fall > 0 || c.flatT > 0 || c.sink > 0 || c.snowT > 0) return false;
  if (c.ghost > 0 && ((G.time * 12) | 0) % 2) return true;
  const z = c.z > 0 ? c.z : 0, s = 1 + .16 * h + z / 90, S2 = Math.round(SS * s), lift = Math.round(z * .6);
  ctx.globalAlpha = .28 * Math.max(.3, 1 - z / 80);
  ctx.drawImage(F.shadow[rot], Math.round(c.x - S2 / 2 + 3 + 7 * h + z * .3), Math.round(c.y - S2 / 2 + 4 + 9 * h + z * .4), S2, S2);
  ctx.globalAlpha = 1;
  ctx.drawImage(F.frames[lv][rot], Math.round(c.x - S2 / 2), Math.round(c.y - S2 / 2) - lift - (c.bump || 0), S2, S2);
  return true;
}

// a wooden barrier at a crossing: a post at the road edge, the red and white arm across the road (folded away when a car broke through)
function barrier(cr, k, s, ev) {
  const T = G.T, tg = T.tan[cr.i], nm = T.nrm[cr.i], sg = s ? -1 : 1, bx = cr.x - tg.x * 18 * sg + nm.x * sg * (HALF + 5), by = cr.y - tg.y * 18 * sg + nm.y * sg * (HALF + 5);
  const g = ev.gate[k], kn = ev.knock[k][s], ang = Math.atan2(-nm.y * sg, -nm.x * sg) - (1 - g) * 1.45 + kn * 1.6 * Math.sin(kn * 9), len = 2 * HALF + 6;
  ctx.globalAlpha = .25; for (let q = 0; q < len; q += 2) R1(Math.round(bx + Math.cos(ang) * q) + 2, Math.round(by + Math.sin(ang) * q) + 3, 2, 2, '#000'); ctx.globalAlpha = 1;
  for (let q = 0; q < len; q++) R1(Math.round(bx + Math.cos(ang) * q) - 1, Math.round(by + Math.sin(ang) * q) - 1, 3, 3, ((q >> 3) & 1) ? '#ffffff' : '#e84a4a');
  R1(Math.round(bx) - 3, Math.round(by) - 3, 7, 7, '#5a3418'); R1(Math.round(bx) - 2, Math.round(by) - 2, 5, 5, '#c8945a');
  if (g > .5) R1(Math.round(bx) - 1, Math.round(by) - 1, 3, 3, ((G.time * 4) | 0) % 2 ? '#ff4a4a' : '#7a1a1a');
}

// on the ground (under the cars): the train, the barriers, the wind-up car, the marbles, the dominoes, the robot vacuum and its dock
function drawToyGround() {
  const T = G.T, S = T.toys, ev = T.ev; if (!ev) return;
  for (let k = 0; k < S.cross.length; k++) { const cr = S.cross[k]; if (inView(cr.x, cr.y, 70)) for (const s of [0, 1]) barrier(cr, k, s, ev); }
  // the wooden train: a red engine with a chimney, a blue and a yellow wagon, round black wheels
  for (const p of trainPieces(S, ev.train)) {
    if (!inView(p.x, p.y)) continue;
    ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y)); ctx.rotate(p.a);
    ctx.globalAlpha = .25; R1(-7, -4, 18, 11, '#000'); ctx.globalAlpha = 1;
    for (const wx of [-6, 4]) { R1(wx, -6, 4, 2, '#1b120c'); R1(wx, 4, 4, 2, '#1b120c'); }
    const col = ['#e84a4a', '#3c78e0', '#f2c230'][p.k], dk = ['#a82a2a', '#24489a', '#b8920e'][p.k];
    R1(-9, -5, 18, 10, '#1b120c'); R1(-8, -4, 16, 8, col); R1(-8, 2, 16, 2, dk);
    if (p.k === 0) { R1(-7, -3, 6, 6, '#c8945a'); R1(3, -2, 4, 4, '#1b120c'); R1(4, -1, 2, 2, '#5a5a64'); R1(8, -1, 2, 2, '#ffe9a0'); }
    else { R1(-6, -3, 12, 6, dk); R1(-5, -2, 10, 4, p.k === 1 ? '#f2c230' : '#e84a4a'); }
    ctx.restore();
  }
  if (ev.toyOn && ev.train.wait <= 0 && Math.random() < .3) { const p = trainPieces(S, ev.train)[0]; if (inView(p.x, p.y)) addP({ t: 'smoke', x: p.x, y: p.y, vx: (Math.random() - .5) * 8, vy: -8, life: .7, ml: .7 }); }
  // the wind-up car: a little tin car with a big key on its roof
  const w = ev.windup;
  if (w && inView(w.x, w.y)) {
    ctx.save(); ctx.translate(Math.round(w.x), Math.round(w.y)); ctx.rotate(w.a);
    ctx.globalAlpha = .25; R1(-6, -3, 16, 11, '#000'); ctx.globalAlpha = 1;
    R1(-8, -6, 16, 12, '#1b120c'); R1(-7, -5, 14, 10, '#3ab0a0'); R1(-7, -5, 14, 2, '#8ae8d8'); R1(2, -4, 4, 8, '#bfe8ff'); R1(-6, -6, 3, 1, '#1b120c'); R1(-6, 5, 3, 1, '#1b120c');
    const kw = Math.round(Math.abs(Math.cos(w.key)) * 5) + 1;
    R1(-5, -1, 4, 2, '#8a8a92'); R1(-9, -kw, 3, kw * 2, '#1b120c'); R1(-8, -kw + 1, 1, kw * 2 - 2, '#d8d8e0');
    ctx.restore();
  }
  // marbles: glass with a coloured swirl and a highlight
  for (const m of ev.marbles) {
    if (!inView(m.x, m.y)) continue;
    const x = Math.round(m.x), y = Math.round(m.y), col = ['#e84a4a', '#3c78e0', '#f2c230', '#40b050'][m.col];
    ctx.globalAlpha = .25; disc(x + 2, y + 3, MARBLE.r, '#000'); ctx.globalAlpha = 1;
    disc(x, y, MARBLE.r, '#1b120c'); disc(x, y, MARBLE.r - 1, '#cfe8ff');
    R1(x + Math.round(Math.cos(m.rot) * 2) - 1, y + Math.round(Math.sin(m.rot) * 2) - 1, 3, 2, col); R1(x - 2, y - 2, 1, 1, '#ffffff');
  }
  // the domino tower (or the stones lying across the road, or standing up again)
  const D = ev.domino, Q = S.domino;
  if (inView(Q.x, Q.y, 80)) {
    if (!D || D.st === 'up' || D.st === 'rise') {
      const up = D && D.st === 'rise' ? D.t / DOMINO.rise : 1;
      ctx.globalAlpha = .3; R1(Q.x - 7 + 4, Q.y - 6 + 5, 14, 14, '#000'); ctx.globalAlpha = 1;
      for (let k = 0; k < 5; k++) { const yy = Q.y + 6 - Math.round(k * 4 * up); R1(Q.x - 8, yy - 3, 16, 6, '#1b120c'); R1(Q.x - 7, yy - 2, 14, 4, k % 2 ? '#f4f4ee' : '#2a2a32'); R1(Q.x - 4 + k, yy - 1, 2, 2, k % 2 ? '#1b120c' : '#ffffff'); R1(Q.x + 2 - k, yy - 1, 2, 2, k % 2 ? '#1b120c' : '#ffffff'); }
    } else {
      const n = fallen(D);
      for (let k = 0; k < Q.n; k++) {
        if (D.gone[k]) continue;
        const yy = Math.round(Q.y + Q.step * (k + .5));
        if (k < n) { R1(Q.x - 8, yy - 3, 16, 7, '#1b120c'); R1(Q.x - 7, yy - 2, 14, 5, '#f4f4ee'); R1(Q.x - 1, yy - 2, 1, 5, '#1b120c'); R1(Q.x - 4, yy, 2, 2, '#1b120c'); R1(Q.x + 3, yy - 1, 2, 2, '#1b120c'); }
        else { R1(Q.x - 2, yy - 6, 5, 11, '#1b120c'); R1(Q.x - 1, yy - 5, 3, 9, '#f4f4ee'); }
      }
    }
  }
  // the robot vacuum: a round grey disc with a bumper, two little blue lights, a turning side brush; it shakes while it chews
  const R = ev.robot;
  if (R && inView(R.x, R.y, 60)) {
    const sh = R.chew > 0 ? Math.round(Math.sin(G.time * 60) * 1.5) : 0, x = Math.round(R.x) + sh, y = Math.round(R.y), fx = Math.cos(R.a), fy = Math.sin(R.a);
    if (R.out) { ctx.globalAlpha = .18; disc(x, y, ROBOT.reach * .5 + Math.round(Math.sin(G.time * 8) * 3), '#8fd8ff'); ctx.globalAlpha = 1; }
    ctx.globalAlpha = .3; disc(x + 4, y + 5, ROBOT.r, '#000'); ctx.globalAlpha = 1;
    disc(x, y, ROBOT.r, '#1b120c'); disc(x, y, ROBOT.r - 1, '#5a5e68'); disc(x, y, ROBOT.r - 4, '#7a7e88'); disc(x - 3, y - 3, 4, '#9aa0aa');
    for (let a = -1; a <= 1; a += .1) R1(Math.round(x + Math.cos(R.a + a) * (ROBOT.r - 2)), Math.round(y + Math.sin(R.a + a) * (ROBOT.r - 2)), 2, 2, '#2a2a32');
    const bl = ((G.time * 3) | 0) % 2;
    R1(Math.round(x + fx * 8 - fy * 4), Math.round(y + fy * 8 + fx * 4), 2, 2, bl ? '#4ab8ff' : '#1a4a7a'); R1(Math.round(x + fx * 8 + fy * 4), Math.round(y + fy * 8 - fx * 4), 2, 2, bl ? '#1a4a7a' : '#4ab8ff');
    const bx = x + fx * 12 + fy * 11, by = y + fy * 12 - fx * 11;
    for (let q = 0; q < 3; q++) { const a = G.time * 20 + q * TAU / 3; R1(Math.round(bx + Math.cos(a) * 4), Math.round(by + Math.sin(a) * 4), 1, 1, '#d8d8e0'); }
    if (R.out && Math.random() < .5) addP({ t: 'dust', x: R.x + fx * 30 + (Math.random() - .5) * 30, y: R.y + fy * 30 + (Math.random() - .5) * 30, vx: -fx * 40, vy: -fy * 40, life: .5, ml: .5 });
  }
  // the dock: its light is green while the robot sleeps
  const [qx, qy] = S.robot.dock;
  if (inView(qx, qy)) R1(qx + 6, qy - 2, 3, 4, R && R.out ? '#5a1a1a' : ((G.time * 2) | 0) % 2 ? '#5fe36a' : '#2a6a2a');
}

// above the cars: the cars in the marble run, a marble coming down the spiral, the brushes of the car wash, the keys while the countdown runs,
// little words
function drawToyAbove() {
  const T = G.T, S = T.toys, ev = T.ev; if (!ev) return;
  const [tx, ty, tr] = S.tower;
  // cars in the spiral: round and round and down, smaller and smaller
  for (const c of G.cars) {
    if (!c.tube) continue;
    const f = c.tube.f, a = Math.PI * .05 - f * TAU * 2, rr = (tr - 10) * (1 - f * .7), x = tx + Math.cos(a) * rr, y = ty + Math.sin(a) * rr, s = Math.max(.45, 1.2 - f * .7), S2 = Math.round(SS * s);
    const F = c.cem && c.Fc ? c.Fc : c.F, lv = Math.min(5, Math.round(c.dirt * 5));
    ctx.drawImage(F.frames[lv][rotIndex(a - Math.PI / 2)], Math.round(x - S2 / 2), Math.round(y - S2 / 2), S2, S2);
  }
  // a marble on its way down the spiral (it comes out soon)
  if (ev.marbleWarn > 0 && inView(tx, ty, 60)) {
    const f = 1 - ev.marbleWarn / MARBLE.warn, a = -f * TAU * 2.4, rr = (tr - 8) * (1 - f * .8);
    disc(Math.round(tx + Math.cos(a) * rr), Math.round(ty + Math.sin(a) * rr), 4, '#1b120c'); disc(Math.round(tx + Math.cos(a) * rr), Math.round(ty + Math.sin(a) * rr), 3, '#cfe8ff');
  }
  // the car wash: two brush rolls at the sides of the road and one over it, turning
  const W = S.wash;
  if (inView(W.x, W.y, 60)) {
    for (const s of [-1, 1]) {
      const bx = W.x + W.nm.x * s * (HALF - 3), by = W.y + W.nm.y * s * (HALF - 3);
      disc(Math.round(bx), Math.round(by), 8, '#1b4a9a'); disc(Math.round(bx), Math.round(by), 7, '#3c78e0');
      for (let q = 0; q < 6; q++) { const a = G.time * 9 * s + q * TAU / 6; R1(Math.round(bx + Math.cos(a) * 5), Math.round(by + Math.sin(a) * 5), 2, 2, '#9ac8ff'); }
      disc(Math.round(bx), Math.round(by), 2, '#f2cc30');
    }
    const ph = (G.time * 10) % 4;
    for (let o = -HALF + 6; o <= HALF - 6; o += 4) R1(Math.round(W.x + W.nm.x * o + W.tg.x * (ph - 2)), Math.round(W.y + W.nm.y * o + W.tg.y * (ph - 2)), 2, 2, '#ff8ab0');
  }
  // countdown: every car is wound up with a key
  if (G.state === 'countdown') for (const c of G.cars) {
    const kw = Math.round(Math.abs(Math.cos(G.time * 6 + c.seed)) * 6) + 1, x = Math.round(c.x - Math.cos(c.ang) * 6), y = Math.round(c.y - Math.sin(c.ang) * 6) - 14;
    R1(x - 1, y, 3, 8, '#1b120c'); R1(x, y + 1, 1, 6, '#d8d8e0'); R1(x - kw, y - 2, kw * 2 + 1, 4, '#1b120c'); R1(x - kw + 1, y - 1, kw * 2 - 1, 2, '#e8c890');
  }
  for (const p of ev.pops) text(p.s, Math.round(p.x), Math.round(p.y - 14 - (1.1 - p.t) * 12), 8, p.col, 'center');
}

// ----- the dark room in the last lap: a veil with holes for the headlights, the night light and the star projector -----
const night = mk(VW, VH), nctx = night.getContext('2d');
function veil(cx, cy, k) {
  const T = G.T, S = T.toys;
  nctx.globalCompositeOperation = 'source-over'; nctx.clearRect(0, 0, VW, VH);
  nctx.fillStyle = 'rgba(10,12,40,' + (.7 * k).toFixed(3) + ')'; nctx.fillRect(0, 0, VW, VH);
  nctx.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a) => { nctx.fillStyle = 'rgba(0,0,0,' + a + ')'; nctx.beginPath(); nctx.arc(Math.round(x), Math.round(y), r, 0, TAU); nctx.fill(); };
  for (const c of G.cars) {
    if (c.fall > 0 && c.fallKind === 'suck') continue;
    const x = c.x - cx, y = c.y - cy; if (x < -90 || x > VW + 90 || y < -90 || y > VH + 90) continue;
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang), nx = -fy, ny = fx;
    for (const [r, a] of [[24, .16], [16, .18]]) hole(x, y, r, a);
    for (let q = 0; q < 4; q++) {
      const len = 80 - q * 14, hw = 30 - q * 6, sx = x + fx * 8, sy = y + fy * 8;
      nctx.fillStyle = 'rgba(0,0,0,.24)'; nctx.beginPath();
      nctx.moveTo(Math.round(sx + nx * 4), Math.round(sy + ny * 4)); nctx.lineTo(Math.round(sx + fx * len + nx * hw), Math.round(sy + fy * len + ny * hw));
      nctx.lineTo(Math.round(sx + fx * len - nx * hw), Math.round(sy + fy * len - ny * hw)); nctx.lineTo(Math.round(sx - nx * 4), Math.round(sy - ny * 4)); nctx.closePath(); nctx.fill();
    }
  }
  const [lx, ly] = S.nightlight; for (const [r, a] of [[70, .2], [46, .25], [24, .3]]) hole(lx - cx, ly - cy, r, a);
  const [px, py] = S.projector; for (const [r, a] of [[40, .2], [20, .3]]) hole(px - cx, py - cy, r, a);
  ctx.drawImage(night, 0, 0);
}

// on the screen: the light from the window by day, the night with the projected stars, the messages
function drawToySky(cx, cy) {
  const T = G.T, S = T.toys, ev = T.ev; if (!ev) return;
  const k = ev.dark;
  if (k < 1) {
    // sunlight falls through the window in slanted beams, dust floats in them
    const [wx0, wx1] = S.window;
    ctx.save(); ctx.globalAlpha = .07 * (1 - k); ctx.fillStyle = '#fff3c0';
    for (let q = 0; q < 3; q++) {
      const x0 = wx0 + q * (wx1 - wx0) / 3 - cx, x1 = x0 + (wx1 - wx0) / 3 - 14;
      ctx.beginPath(); ctx.moveTo(x0, -cy); ctx.lineTo(x1, -cy); ctx.lineTo(x1 + 360, 520 - cy); ctx.lineTo(x0 + 330, 520 - cy); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = .5 * (1 - k);
    for (let q = 0; q < 26; q++) {
      const t = G.time * .05 + hash(q, 1, 155), u = t % 1, x = wx0 + hash(q, 2, 155) * (wx1 - wx0) + u * 330 + Math.sin(G.time + q) * 6 - cx, y = u * 500 - cy;
      if (x > -2 && x < VW + 2 && y > -2 && y < VH + 2) R1(Math.round(x), Math.round(y), 1, 1, '#fff8dc');
    }
    ctx.globalAlpha = 1;
  }
  if (k > 0) {
    veil(cx, cy, k);
    // the star projector throws turning stars and a moon over the whole room
    const [px, py] = S.projector;
    ctx.globalAlpha = .8 * k;
    for (let q = 0; q < 90; q++) {
      const a = hash(q, 1, 156) * TAU + G.time * .12, d = 60 + hash(q, 2, 156) * 1300, x = px + Math.cos(a) * d - cx, y = py + Math.sin(a) * d * .75 - cy;
      if (x < -3 || x > VW + 3 || y < -3 || y > VH + 3) continue;
      const tw = (Math.sin(G.time * 3 + q) + 1) / 2, big = hash(q, 3, 156) < .25;
      R1(Math.round(x), Math.round(y), 1, 1, '#fff6c8');
      if (big && tw > .4) { R1(Math.round(x) - 1, Math.round(y), 3, 1, '#ffe9a0'); R1(Math.round(x), Math.round(y) - 1, 1, 3, '#ffe9a0'); }
    }
    { const a = G.time * .12 + 2, d = 420, x = Math.round(px + Math.cos(a) * d - cx), y = Math.round(py + Math.sin(a) * d * .75 - cy);
      if (x > -20 && x < VW + 20 && y > -20 && y < VH + 20) { disc(x, y, 9, '#fff3b0'); disc(x + 4, y - 2, 8, '#1a1c48'); } }
    ctx.globalAlpha = .35 * k; disc(Math.round(S.nightlight[0] - cx), Math.round(S.nightlight[1] - cy), 9, '#ffd27a'); ctx.globalAlpha = 1;
    // the little blue lights of the robot in the dark
    const R = ev.robot;
    if (R && R.out) { const x = Math.round(R.x - cx), y = Math.round(R.y - cy); ctx.globalAlpha = .45 * k; disc(x, y, 8, '#4ab8ff'); ctx.globalAlpha = 1; R1(x - 1, y - 1, 3, 3, '#bfe8ff'); }
  }
  if (ev.msgT > 0 && ev.msg && ((G.time * 4) | 0) % 2) text(ev.msg.s, VW / 2, 34, 8, ev.msg.col, 'center');
  // where the computer cars and you are: an arrow when the robot is close behind you
  const P = G.player, R = ev.robot;
  if (R && R.out && P && P.lvl === 2 && Math.hypot(P.x - R.x, P.y - R.y) < 140 && !inView(R.x, R.y, -10) && ((G.time * 6) | 0) % 2) {
    const a = Math.atan2(R.y - P.y, R.x - P.x), x = clamp(P.x - cx + Math.cos(a) * 60, 12, VW - 12), y = clamp(P.y - cy + Math.sin(a) * 60, 22, VH - 12);
    ell(Math.round(x), Math.round(y), 5, 5, '#4ab8ff');
  }
}

// ---------- hooks: how the core calls this track (hooks.js; what each hook does: _template.js) ----------
/** @type {import('./_template.js').TrackHooks} */
export const toyHooks = {
  init: initToys, events: { spielzeug: initToyEvents, saugroboter: initRobot }, update: toyUpdate, collisions: toyCollisions, lane: toyLane, ground: toyGround,
  respawn: toyRespawn, drawCar: drawToyCar, drawGround: drawToyGround, drawAbove: drawToyAbove, drawSky: drawToySky,
};
