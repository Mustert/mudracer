import { G } from './g.js';
import { SFX, noise, voice } from './audio.js';
import { HALF, LAPS, MAXS, SS, TAU, VH, VW, angDiff, clamp, ctx, hash, mk, rotIndex } from './core.js';
import { R1, disc } from './gfx.js';
import { nearObstacles } from './grid.js';
import { darkRect, warnAt } from './kit.js';
import { addP } from './particles.js';
import { fallCar, inView, near } from './trackfx.js';
import { tctx } from './tracks.js';
import { DUST, FLOORU, KD, PAINT, PLATE, STEPS, loopAt, loopSpeed } from './toymap.js';
import { bctx, snap } from './undo.js';

// ---------- Spielzimmer Rev 2 while racing (plaene/SPIELZIMMER_REV2.md) ----------
// Levels: the cars are toy cars in a kids' room; c.lvl 2 floor, 1 bed, 3 desk, 4 inside the marble run. The level follows where a car has been
// (toyGround): up the ramp of books onto the bed, up the stairs of blocks onto the desk, onto the desk from the pillow; a car up there that leaves
// the bed falls and lands UNDER the bed (it drives on there, the way under the bed), one that leaves the desk is set back on the desk. Up there a
// car is drawn bigger with its shadow further away; cars only collide with cars on the same level (update.js; walls with `down` only stop the
// cars on the floor, `up` only the cars on the bed). The bed is a picture of its own over the floor (hook deck): the cars under it are hidden
// below it; when you are under it yourself the bed is gone, it is dark (a light map), you see the slats above you and light falls in at the sides.
// Up on the bed the car reads the top of the bed (toymap.js bedT), not the floor under it.
// Event "spielzeug": the wooden train goes round its loop and stops at its station (wooden barriers close; you can drive through them, they fold
// away; the train throws you round), a wind-up car drives straight across the rug, marbles roll out of the marble run across the way into the
// town (a rattle first), the domino tower in the town falls across the way when you touch it (then you bump over the dominoes; 20 s later it
// stands up again).
// Event "saugroboter": from lap 2 the robot vacuum leaves its dock (a beep, blue blinking) and drives over the floor; when it has caught nobody for
// a while it hunts the nearest car on the floor (a warning triangle when it heads for you). It pulls the cars near it and swallows the ones that
// come too close, spits them out behind it, dusty grey. It eats marbles, fallen dominoes, the plasticine and the tyre marks. Never under the bed,
// never up on the furniture.
// Event "schlafenszeit": in the last lap the lamp flickers, a click, the light goes out: dark with headlights, the star projector on the desk
// throws turning stars and a moon over the room, the night light at the wall keeps the start line and the grid in light, a gap of light under the
// door. Fields in T.ev start with toy (T22).

const TRAIN = { v: 62, n: 3, gap: 19, hit: 12, stop: 3, warn: 58 };
const WIND = { v: 58, run: 7, wind: 2.2, r: 9 };
const MARBLE = { every: 6.5, warn: 1.1, v: 96, r: 5, rest: 5 };
const DOMINO = { dt: .07, back: 20, rise: .6 };
const ROBOT = { v: 46, hunt: 60, pull: 95, reach: 85, eat: 19, r: 16, bored: 7, turn: 1.4 };
const TUBE = { v: 118, out: 140 };
const NIGHT = { flick: 1.1 };
// the computer cars: who takes the way under the bed (by difficulty), who keeps the gas on over the pillow (the rest falls short now and then)
const AI = { under: [.75, .45, .15], jump: [.75, .92, 1], paint: [.7, .5, .35], dirty: [.4, .55, .7], dodge: [-6, 0, 6] };
const vol = (x, y, k = 1) => clamp(1 - near(x, y) / 380, 0, 1) * k;
const lastLap = () => !!G.player && G.player.lap >= LAPS && (G.state === 'race' || G.state === 'finish');
const inRng = (i, a, b, N) => (i - a + N) % N <= (b - a + N) % N;
const inBed = (S, x, y) => x >= S.bed[0] && x < S.bed[2] && y >= S.bed[1] && y < S.bed[3];
const jOf = (T, x, y) => clamp(y | 0, 0, T.H - 1) * T.W + clamp(x | 0, 0, T.W - 1);

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
  flicker: () => { for (let i = 0; i < 6; i++) noise({ t: i * .16 + Math.random() * .05, type: 'bandpass', f: 120, q: 4, d: .05, vol: .12 }); },
  boing: v => { voice({ type: 'sine', f: 160, to: 540, a: .005, d: .3, vol: .22 * v }); voice({ t: .05, type: 'triangle', f: 330, to: 260, a: .01, d: .25, vol: .06 * v }); },
  puff: v => { noise({ type: 'lowpass', f: 700, to: 300, a: .01, d: .14, vol: .14 * v }); },
  tube: v => { for (let i = 0; i < 10; i++) voice({ t: i * .05, f: 600 + i * 90, a: .002, d: .04, vol: .05 * v }); noise({ type: 'bandpass', f: 400, to: 2400, a: .05, hold: .3, d: .2, vol: .1 * v, q: 2 }); },
  plink: () => { for (const [t, f] of [[0, 1568], [.08, 2093], [.16, 2637]]) voice({ t, f, a: .002, d: .25, vol: .05 }); },
  whistle: v => { voice({ type: 'sine', f: 1900, to: 500, a: .01, d: .5, vol: .09 * v }); },
  dust: v => { noise({ type: 'bandpass', f: 900, to: 500, q: .8, a: .04, d: .2, vol: .1 * v }); },
  step: v => { noise({ type: 'bandpass', f: 1700, q: 3, d: .025, vol: .16 * v }); voice({ type: 'triangle', f: 380, to: 300, d: .04, vol: .06 * v }); },
  growl: v => { voice({ type: 'sawtooth', f: 70, to: 55, a: .1, hold: .4, d: .4, vol: .07 * v, lp: 400 }); noise({ type: 'lowpass', f: 300, a: .1, hold: .3, d: .3, vol: .06 * v }); },
};

function initToys(T) {
  const ev = T.ev, S = T.toys;
  ev.toyOn = false; ev.toyRobotOn = false; ev.toyNightOn = false;
  ev.toyGate = S.cross.map(() => 0); ev.toyKnock = S.cross.map(() => [0, 0]); ev.toyClosed = S.cross.map(() => false);
  // the train waits at its station at the top of the loop (that is where it stays when the event is off)
  ev.toyTrain = { th: -Math.PI / 2, wait: 2, prev: -Math.PI / 2 };
  ev.toyWind = null; ev.toyMarbles = []; ev.toyMarbleN = 0; ev.toyMarbleNext = 5; ev.toyMarbleWarn = 0; ev.toyDomino = null; ev.toyRobot = null;
  ev.toyDark = 0; ev.toyDarkOn = false; ev.toyFlick = 0; ev.toyKnete = S.knete.map(() => true); ev.toyFade = 0; ev.toyGrowl = 3; ev.obst = [];
  S.under = false;
}

function initToyEvents(T) {
  const ev = T.ev, S = T.toys; ev.toyOn = true;
  ev.toyWind = { x: S.wind.start[0], y: S.wind.start[1], a: .4, run: WIND.run, wind: 0, key: 0, n: 0 };
  ev.toyDomino = { st: 'up', t: 0, gone: [] };
}

function initRobot(T) {
  const [x, y] = T.toys.robot.dock;
  T.ev.toyRobotOn = true; T.ev.toyRobot = { x: x + 26, y, a: 0, out: false, n: 0, chew: 0, humT: 0, eaten: 0, idle: 0, prey: null, blink: 0 };
}

function initNight(T) { T.ev.toyNightOn = true; }

// ======================================================= every step (before the physics)

function toyUpdate(T, dt) {
  const ev = T.ev, S = T.toys, P = G.player;
  for (const c of G.cars) if (!c.lvl) { c.lvl = 2; c.h = 0; }
  // where you are: under the bed (dark, the bed picture is gone)
  S.under = !!(P && P.lvl === 2 && P.fall <= 0 && inBed(S, P.x, P.y));
  for (const c of G.cars) {
    if (c.z > 0 && !c.boinged) { c.boinged = true; if (c.idx >= S.lipI - 30 && c.idx <= S.lipI + 40) SND.boing(c.ai ? vol(c.x, c.y, .4) : 1); else if (!c.ai) SND.puff(1); }
    if (c.z <= 0) c.boinged = false;
  }
  updateTrain(T, dt);
  if (ev.toyOn) { updateWind(T, dt); updateMarbles(T, dt); updateDomino(T, dt); }
  if (ev.toyRobotOn) updateRobot(T, dt);
  // bedtime: in the last lap the lamp flickers, a click, the light goes out
  if (ev.toyNightOn && lastLap() && !ev.toyDarkOn) {
    if (ev.toyFlick <= 0) { ev.toyFlick = NIGHT.flick; SND.flicker(); }
    ev.toyFlick -= dt;
    if (ev.toyFlick <= 0) { ev.toyDarkOn = true; ev.toyFlick = 0; SND.click(); }
  }
  ev.toyDark = clamp(ev.toyDark + (ev.toyDarkOn ? dt / .5 : -dt), 0, 1);
  // the computer cars steer round the robot, the wind-up car and rolling marbles
  const ob = ev.obst; ob.length = 0;
  const R = ev.toyRobot; if (R && R.out) ob.push({ x: R.x, y: R.y, r: ROBOT.r + AI.dodge[G.raceDiff || 0] });
  if (ev.toyWind) ob.push({ x: ev.toyWind.x, y: ev.toyWind.y, r: WIND.r });
  for (const m of ev.toyMarbles) if (Math.hypot(m.vx, m.vy) > 20) ob.push({ x: m.x, y: m.y, r: MARBLE.r });
  // the car wash: soap bubbles
  const W = S.wash;
  if (inView(W.x, W.y) && Math.random() < dt * 14) addP({ t: 'bub', x: W.x + W.nm.x * (Math.random() - .5) * 30, y: W.y + W.nm.y * (Math.random() - .5) * 30, vx: (Math.random() - .5) * 10, vy: -10 - Math.random() * 10, life: .9, ml: .9 });
  // the monster under the bed growls now and then while you are near it
  if (S.under && (ev.toyGrowl -= dt) <= 0) { ev.toyGrowl = 5 + Math.random() * 4; const v = vol(S.monster[0], S.monster[1], .8); if (v > .1) SND.growl(v); }
  // tyre marks and plasticine splashes fade away slowly (they do not stain the room for good, 1S14-4)
  if ((ev.toyFade += dt) > .5) { ev.toyFade = 0; tctx.globalCompositeOperation = 'destination-out'; tctx.globalAlpha = .035; tctx.fillStyle = '#000'; tctx.fillRect(0, 0, T.W, T.H); tctx.globalAlpha = 1; tctx.globalCompositeOperation = 'source-over'; }
}

// ----- the wooden train: round the loop, a stop at the station at the top, the barriers close while it is near a crossing -----
function updateTrain(T, dt) {
  const ev = T.ev, S = T.toys, L = S.train, tr = ev.toyTrain;
  if (ev.toyOn) {
    if (tr.wait > 0) tr.wait -= dt;
    else {
      tr.prev = tr.th; tr.th += TRAIN.v / loopSpeed(L, tr.th) * dt;
      // once a round it stops at the station (the top of the loop, away from the road)
      const st = -Math.PI / 2 + TAU * Math.ceil((tr.prev + Math.PI / 2) / TAU - 1e-6);
      if (tr.prev < st && tr.th >= st) { tr.th = st; tr.wait = TRAIN.stop; const p = loopAt(L, st), v = vol(p.x, p.y); if (v > .05) SND.toot(v); }
    }
  }
  const P = trainPieces(S, tr);
  S.cross.forEach((cr, k) => {
    // closed while the engine comes close or a piece of the train is still on the crossing
    const head = P[0], dh = Math.hypot(head.x - cr.x, head.y - cr.y), app = ((cr.th - tr.th) % TAU + TAU) % TAU < 1.4;
    const shut = ev.toyOn && tr.wait <= 0 && ((dh < TRAIN.warn && app) || P.some(p => Math.hypot(p.x - cr.x, p.y - cr.y) < 26));
    if (shut && !ev.toyClosed[k]) { const v = vol(cr.x, cr.y); if (v > .05) SND.toot(v * .8); }
    ev.toyClosed[k] = shut;
    ev.toyGate[k] = clamp(ev.toyGate[k] + (shut ? dt * 3 : -dt * 2), 0, 1);
    ev.toyKnock[k] = ev.toyKnock[k].map(q => Math.max(0, q - dt / 1.2));
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
  const w = T.ev.toyWind, [x0, y0, x1, y1] = T.toys.wind.box;
  if (w.run > 0) {
    w.run -= dt;
    const v = WIND.v * Math.min(1, w.run / 1.2), nx = w.x + Math.cos(w.a) * v * dt, ny = w.y + Math.sin(w.a) * v * dt;
    let hit = nx < x0 || nx > x1 || ny < y0 || ny > y1;
    if (nx < x0 || nx > x1) w.a = Math.PI - w.a;
    if (ny < y0 || ny > y1) w.a = -w.a;
    if (!hit) for (const o of nearObstacles(T.grid, nx, ny)) {
      if (o.down || o.up) continue;
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

// ----- marbles out of the marble run, across the way into the town (more from lap 2 of the leader) -----
function updateMarbles(T, dt) {
  const ev = T.ev, M = T.toys.marble, lead = G.cars.reduce((m, c) => Math.max(m, c.lap || 1), 1);
  if (ev.t >= ev.toyMarbleNext - MARBLE.warn && ev.toyMarbleWarn <= 0) { ev.toyMarbleWarn = MARBLE.warn; const v = vol(M.out[0], M.out[1]); if (v > .05) SND.marbles(v); }
  if (ev.toyMarbleWarn > 0) {
    ev.toyMarbleWarn -= dt;
    if (ev.toyMarbleWarn <= 0) {
      const n = ev.toyMarbleN++, a = Math.atan2(M.dir[1], M.dir[0]) + (hash(n, 1, 152) - .5) * .5, sp = MARBLE.v * (.85 + hash(n, 2, 152) * .3);
      ev.toyMarbles.push({ x: M.out[0], y: M.out[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rest: 0, col: n % 4, rot: 0 });
      if (hash(n, 3, 152) < (lead >= 2 ? .75 : .35)) ev.toyMarbles.push({ x: M.out[0] + 4, y: M.out[1] + 2, vx: Math.cos(a + .25) * sp * .8, vy: Math.sin(a + .25) * sp * .8, rest: 0, col: (n + 2) % 4, rot: 0 });
      ev.toyMarbleNext = ev.t + MARBLE.every * (lead >= 2 ? .75 : 1) * (.8 + hash(n, 4, 152) * .4);
    }
  }
  for (const m of ev.toyMarbles) {
    const f = Math.exp(-.35 * dt); m.vx *= f; m.vy *= f;
    const nx = m.x + m.vx * dt, ny = m.y + m.vy * dt;
    let ok = nx > 26 && ny > 26 && nx < T.W - 26 && ny < T.H - 26;
    if (!ok) { if (nx <= 26 || nx >= T.W - 26) m.vx = -m.vx * .6; else m.vy = -m.vy * .6; }
    else for (const o of nearObstacles(T.grid, nx, ny)) {
      if (o.up) continue;
      const dx = nx - o.x, dy = ny - o.y, d = Math.hypot(dx, dy);
      if (d < o.r + MARBLE.r && d > 0) { const ux = dx / d, uy = dy / d, vn = m.vx * ux + m.vy * uy; if (vn < 0) { m.vx -= 1.7 * vn * ux; m.vy -= 1.7 * vn * uy; } ok = false; break; }
    }
    if (ok) { m.x = nx; m.y = ny; }
    m.rot += Math.hypot(m.vx, m.vy) * dt / MARBLE.r;
    if (Math.hypot(m.vx, m.vy) < 10) m.rest += dt;
  }
  ev.toyMarbles = ev.toyMarbles.filter(m => m.rest < MARBLE.rest && !m.eaten);
}

// ----- the domino tower: knocked over, the stones fall one after another across the way; 20 s later it stands up again -----
function updateDomino(T, dt) {
  const D = T.ev.toyDomino, Q = T.toys.domino; D.t += dt;
  if (D.st === 'up') D.wob = Math.max(0, (D.wob || 0) - dt);
  if (D.st === 'fall') {
    const k = Math.floor(D.t / DOMINO.dt);
    if (k !== D.k && k <= Q.n) { D.k = k; if (k < Q.n) SND.domino(vol(Q.x, Q.y + k * Q.step)); }
    if (D.t > DOMINO.back) { D.st = 'rise'; D.t = 0; }
  } else if (D.st === 'rise' && D.t > DOMINO.rise) { D.st = 'up'; D.t = 0; D.gone = []; if (inView(Q.x, Q.y)) SND.plink(); }
}

// how many dominoes lie on the way already (they fall one after another)
const fallen = D => D.st === 'fall' ? Math.min(G.T.toys.domino.n, Math.floor(D.t / DOMINO.dt) + 1) : 0;

// ----- the robot vacuum: out of its dock in lap 2; straight lines, it turns at whatever is in its way; when it has caught nobody for a while it
// hunts the nearest car on the floor. It pulls the cars near it, eats marbles, fallen dominoes, the plasticine and the tyre marks -----
function updateRobot(T, dt) {
  const R = T.ev.toyRobot, S = T.toys, [x0, y0, x1, y1] = S.robot.box;
  if (!R.out) {
    if (!G.player || G.player.lap < 2) return;
    R.out = true; R.blink = 1.6; SND.beep();
  }
  R.blink = Math.max(0, R.blink - dt); R.chew = Math.max(0, R.chew - dt); R.idle += dt;
  const ok = c => c.lvl === 2 && c.fall <= 0 && c.z <= 0 && !inBed(S, c.x, c.y) && c.x > x0 && c.x < x1 && c.y > y0 && c.y < y1;
  // hunting: the nearest car on the floor (the computer cars too), after a while without a catch
  if (R.idle > ROBOT.bored) {
    if (!R.prey || !ok(R.prey) || Math.hypot(R.prey.x - R.x, R.prey.y - R.y) > 420) {
      let best = null, bd = 420; for (const c of G.cars) { if (!ok(c)) continue; const d = Math.hypot(c.x - R.x, c.y - R.y); if (d < bd) { bd = d; best = c; } }
      R.prey = best;
    }
  } else R.prey = null;
  if (R.chew <= 0) {
    if (R.prey) { const want = Math.atan2(R.prey.y - R.y, R.prey.x - R.x), d = angDiff(want, R.a); R.a += clamp(d, -ROBOT.turn * dt, ROBOT.turn * dt); }
    const v = R.prey ? ROBOT.hunt : ROBOT.v, nx = R.x + Math.cos(R.a) * v * dt, ny = R.y + Math.sin(R.a) * v * dt;
    let hit = nx < x0 || nx > x1 || ny < y0 || ny > y1 || !!S.upM[jOf(T, nx, ny)];
    if (!hit) for (const o of nearObstacles(T.grid, nx, ny)) { if (o.up) continue; if (Math.hypot(nx - o.x, ny - o.y) < o.r + ROBOT.r - 2) { hit = true; break; } }
    if (hit) R.a += R.prey ? (hash(R.n++, 1, 153) < .5 ? -1 : 1) * 1.2 : Math.PI / 2 + hash(R.n++, 1, 153) * Math.PI;
    else { R.x = nx; R.y = ny; }
  }
  // the suction: the closer, the harder (heavy off-road cars hold on better)
  for (const c of G.cars) {
    if (!ok(c) || c.ghost > 0) continue;
    const dx = R.x - c.x, dy = R.y - c.y, d = Math.hypot(dx, dy);
    if (d < ROBOT.reach && d > 1) { const f = (ROBOT.pull * (1 - d / ROBOT.reach) + 25) / c.def.mud; c.vx += dx / d * f * dt; c.vy += dy / d * f * dt; }
  }
  R.humT -= dt;
  if (R.humT <= 0) { R.humT = 1.8; const v = vol(R.x, R.y); if (v > .05) SND.hum(v); }
  // it eats marbles, fallen dominoes, the plasticine (the way gets cleaner) and the tyre marks
  for (const m of T.ev.toyMarbles) if (Math.hypot(m.x - R.x, m.y - R.y) < ROBOT.eat) m.eaten = true;
  const D = T.ev.toyDomino, Q = S.domino;
  if (D && D.st === 'fall') for (let k = 0; k < fallen(D); k++) if (!D.gone[k] && Math.hypot(Q.x - R.x, Q.y + Q.step * (k + .5) - R.y) < ROBOT.eat) D.gone[k] = true;
  S.knete.forEach(([kx, ky, kr], k) => { if (T.ev.toyKnete[k] && Math.hypot(kx - R.x, ky - R.y) < kr + 6) { T.ev.toyKnete[k] = false; eatKnete(T, k); SND.slurp(vol(kx, ky, .5)); } });
  tctx.globalCompositeOperation = 'destination-out'; tctx.globalAlpha = .3; tctx.fillStyle = '#000'; tctx.fillRect(R.x - 14, R.y - 14, 28, 28); tctx.globalAlpha = 1; tctx.globalCompositeOperation = 'source-over';
}

// the robot sucks up a patch of plasticine: the baseplate under it again (picture and terrain; events.js puts it back after the race)
function eatKnete(T, k) {
  const S = T.toys, [kx, ky, kr] = S.knete[k], R = Math.ceil(kr * 1.5), x0 = Math.max(0, kx - R | 0), y0 = Math.max(0, ky - R | 0), w = R * 2 + 2, h = R * 2 + 2;
  snap(T, x0, y0, w, h);
  const b = bctx(T), img = b.getImageData(x0, y0, w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = (y0 + y) * T.W + x0 + x, c = S.kneteUnder.get(j); if (!c || T.ter[j] !== 2) continue;
    const q = (y * w + x) * 4; d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; T.ter[j] = PLATE;
  }
  b.putImageData(img, x0, y0);
  for (let q = 0; q < 10; q++) addP({ t: 'dust', x: kx + (Math.random() - .5) * kr * 2, y: ky + (Math.random() - .5) * kr * 2, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, life: .6, ml: .6 });
}

// ======================================================= collisions (after the walls)

function toyCollisions() {
  const T = G.T, ev = T.ev, S = T.toys; if (!ev || !S) return;
  const floor = c => c.lvl === 2 && c.fall <= 0 && c.z <= 0 && c.ghost <= 0;
  // the train throws a car round (softer than the real one)
  if (ev.toyOn) for (const p of trainPieces(S, ev.toyTrain)) for (const c of G.cars) {
    if (!floor(c) || c.stun > 0) continue;
    const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy); if (d > TRAIN.hit + 9 || d === 0) continue;
    c.vx = Math.cos(p.a) * 150 + dx / d * 70; c.vy = Math.sin(p.a) * 150 + dy / d * 70; c.spin = 14; c.stun = 1.1; c.boost = 0;
    if (!c.ai) SFX.crash(); else if (near(c.x, c.y) < 260) SFX.bump();
  }
  // the wooden barriers fold away when a car drives through them
  S.cross.forEach((cr, k) => {
    if (ev.toyGate[k] < .5) return;
    const tg = T.tan[cr.i];
    for (const c of G.cars) for (const s of [0, 1]) {
      const bx = cr.x - tg.x * (s ? -18 : 18), by = cr.y - tg.y * (s ? -18 : 18), a = (c.x - bx) * tg.x + (c.y - by) * tg.y;
      if (Math.abs(a) < 6 && Math.hypot(c.x - bx, c.y - by) < HALF + 4 && ev.toyKnock[k][s] <= 0 && Math.hypot(c.vx, c.vy) > 25) { ev.toyKnock[k][s] = 1; SND.klack(c.ai ? vol(c.x, c.y, .6) : 1); }
    }
  });
  // the wind-up car: pushed away, a hard hit makes the car spin
  const w = ev.toyWind;
  if (w) for (const c of G.cars) {
    if (!floor(c)) continue;
    const dx = c.x - w.x, dy = c.y - w.y, d = Math.hypot(dx, dy), mn = WIND.r + 9; if (d >= mn || d === 0) continue;
    const nx = dx / d, ny = dy / d, vn = c.vx * nx + c.vy * ny;
    c.x = w.x + nx * mn; c.y = w.y + ny * mn;
    if (vn < -40 && !c.stun) { c.vx = nx * 120; c.vy = ny * 120; c.spin = 10; c.stun = .7; if (!c.ai) SFX.bump(); SND.klack(c.ai ? vol(c.x, c.y, .5) : 1); }
    else if (vn < 0) { c.vx -= 1.4 * vn * nx; c.vy -= 1.4 * vn * ny; }
    w.a = Math.atan2(-ny, -nx);
  }
  // marbles: the car spins for a moment, the marble flies off
  for (const m of ev.toyMarbles) for (const c of G.cars) {
    if (!floor(c)) continue;
    const dx = c.x - m.x, dy = c.y - m.y, d = Math.hypot(dx, dy), mn = MARBLE.r + 9; if (d >= mn || d === 0) continue;
    const sp = Math.hypot(c.vx, c.vy);
    m.vx = -dx / d * (sp * 1.2 + 40); m.vy = -dy / d * (sp * 1.2 + 40); m.rest = 0;
    if (sp > 30 && !c.stun) { c.stun = .5; c.spin = (hash(m.col, ev.toyMarbleN, 154) < .5 ? -1 : 1) * 10; c.vx *= .6; c.vy *= .6; }
    SND.marbleHit(c.ai ? vol(c.x, c.y, .5) : 1);
  }
  // the domino tower falls when a car touches it (it wobbles when one comes close)
  const D = ev.toyDomino, Q = S.domino;
  if (D && D.st === 'up') for (const c of G.cars) {
    if (c.lvl !== 2 || c.fall > 0 || c.z > 0) continue;
    const d = Math.hypot(c.x - Q.x, c.y - Q.y);
    if (d < 60) D.wob = .3;
    if (d < 17 && Math.hypot(c.vx, c.vy) > 15) { D.st = 'fall'; D.t = 0; D.k = -1; D.gone = []; break; }
  }
  // the robot swallows a car that comes too close
  const R = ev.toyRobot;
  if (R && R.out) for (const c of G.cars) {
    if (!floor(c) || inBed(S, c.x, c.y)) continue;
    if (Math.hypot(c.x - R.x, c.y - R.y) > ROBOT.eat) continue;
    c.fall = 1.2; c.fallT0 = 1.2; c.fallKind = 'suck'; c.fx0 = c.x; c.fy0 = c.y; c.vx = c.vy = 0; c.boost = 0; c.stun = 0; c.spit = R;
    R.chew = 1.2; R.eaten++; R.idle = 0; R.prey = null;
    SND.slurp(c.ai ? vol(c.x, c.y, .6) : 1); SND.chew(c.ai ? vol(c.x, c.y, .4) : .8);
  }
}

// ======================================================= the ground under a car (from update.js): the level, falls, the surfaces

// the height of a car for the drawing (0 floor, 1 bed, 1.25 desk; on the ramp and the stairs in between)
function heightAt(S, c, k, j) {
  if (c.lvl === 1) return k === KD.RAMP ? S.hM[j] / 100 : 1 + (S.bedT[bedQ(S, c.x, c.y)] === 1 ? .1 : 0);
  if (c.lvl === 3) return k === KD.STAIRS ? S.hM[j] / 100 : 1.25;
  return k === KD.RAMP ? S.hM[j] / 100 : k === KD.STAIRS ? S.hM[j] / 100 : 0;
}
const bedQ = (S, x, y) => (clamp(y | 0, S.bed[1], S.bed[3] - 1) - S.bed[1]) * (S.bed[2] - S.bed[0]) + clamp(x | 0, S.bed[0], S.bed[2] - 1) - S.bed[0];

function toyGround(c, j, sp, dt) {
  const T = G.T, S = T.toys, ev = T.ev;
  // the marble run: in at the top (from the desk), two fast turns in the spiral, out at the bottom with a push
  if (!c.tube && c.lvl === 3 && c.idx >= S.t0 && c.idx < S.t0 + 14) { c.tube = { f: 0 }; c.lvl = 4; SND.tube(c.ai ? vol(c.x, c.y, .5) : 1); }
  if (c.tube) {
    const len = S.t1 - S.t0;
    c.tube.f += TUBE.v * dt / (len * 2);
    const q = Math.min(S.t1, S.t0 + Math.floor(c.tube.f * len)), tg = T.tan[q];
    c.x = T.path[q].x; c.y = T.path[q].y; c.vx = tg.x * TUBE.v; c.vy = tg.y * TUBE.v; c.ang = Math.atan2(tg.y, tg.x); c.stun = 0; c.h = 1.25 * (1 - c.tube.f);
    if (c.tube.f >= 1) {
      const o = (S.t1 + 10) % T.N, to = T.tan[o];
      c.tube = null; c.x = T.path[o].x; c.y = T.path[o].y; c.idx = o; c.vx = to.x * TUBE.out; c.vy = to.y * TUBE.out; c.ang = Math.atan2(to.y, to.x); c.boost = .45; c.lvl = 2; c.h = 0;
      if (!c.ai || near(c.x, c.y) < 260) SND.klack(c.ai ? .4 : 1);
    }
    return;
  }
  // the level: up the ramp onto the bed, up the stairs onto the desk, down again; off the edge up there is a fall
  const k = S.kind[j];
  if (c.lvl === 1) {
    if (k === KD.RAMP) { if (S.hM[j] < 45) c.lvl = 2; }
    else if (k === KD.DESK) c.lvl = 3; // (the pillow threw it onto the desk)
    else if (k !== KD.BED) { dropCar(c, true); return; }
  } else if (c.lvl === 3) {
    if (k === KD.STAIRS) { if (S.hM[j] < 60) c.lvl = 2; }
    else if (k !== KD.DESK && k !== KD.RULER && k !== KD.TOWER) { dropCar(c, false); return; }
  } else if (k === KD.RAMP && S.hM[j] >= 55) c.lvl = 1;
  else if (k === KD.DESK || (k === KD.STAIRS && S.hM[j] > 118)) c.lvl = 3;
  c.h = heightAt(S, c, k, j);
  // up on the bed the car drives on the bed, not on the floor under it
  if (c.lvl === 1 && k === KD.BED) c.surf = S.bedT[bedQ(S, c.x, c.y)];
  // watercolour: no brake, but it colours the car like plasticine
  if (c.surf === PAINT) {
    c.cem = false; c.dirt = Math.min(1, c.dirt + .45 * dt * (sp > 8 ? 1 : .3)); c.mudTrail = 1;
    if (sp > 30 && Math.random() < dt * 20) addP({ t: 'd', x: c.x, y: c.y, z: 2, vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 40, vz: 40, col: T.th.mudP[(Math.random() * 4) | 0], s: 1, life: .6, ml: .6 });
  }
  // the dust under the bed: slow like mud, it makes the car grey; a soft wipe
  if (c.surf === DUST) {
    c.cem = !!c.Fc; c.dirt = Math.min(1, c.dirt + .4 * dt * (sp > 8 ? 1 : .3));
    if (sp > 20 && Math.random() < dt * 14) addP({ t: 'dust', x: c.x + (Math.random() - .5) * 14, y: c.y + (Math.random() - .5) * 10, vx: (Math.random() - .5) * 16, vy: (Math.random() - .5) * 16, life: .7, ml: .7 });
    if (!c.ai && sp > 20 && Math.random() < dt * 3) SND.dust(.8);
  }
  // the baseplate of the town shakes a little
  if (c.surf === PLATE && sp > 30) c.bump = ((G.time * 12 + c.seed) | 0) % 3 === 0 ? 1 : 0;
  // the stairs: a clack on every step
  if (k === KD.STAIRS) { const st = (c.y - S.stairs[1]) / 17 | 0; if (st !== c.tyStep) { c.tyStep = st; if (!c.ai || near(c.x, c.y) < 200) SND.step(c.ai ? .4 : 1); } }
  // fallen dominoes across the way: bumpy and slow
  const D = ev.toyDomino, Q = S.domino;
  if (D && D.st === 'fall') {
    const n = fallen(D), kk = Math.floor((c.y - Q.y) / Q.step);
    if (Math.abs(c.x - Q.x) < 9 && kk >= 0 && kk < n && !D.gone[kk]) {
      const f = Math.exp(-2.2 * dt); c.vx *= f; c.vy *= f; c.bump = ((G.time * 16) | 0) % 2;
      if (Math.random() < dt * 8) SND.domino(c.ai ? vol(c.x, c.y, .4) : .8);
    }
  }
  // the toy car wash: brushes
  if (c.washing && !c.brushIn) { c.brushIn = true; SND.brush(c.ai ? vol(c.x, c.y, .4) : 1); }
  if (!c.washing) c.brushIn = false;
}

// over the edge: from the bed (or the ramp, the pillow) down to the floor, it lands under the bed and drives on there; from the desk it is set
// back on the desk (behind the place where it fell)
function dropCar(c, under) {
  fallCar(c, 'abyss'); c.tyUnder = under; c.tyWay = null;
  SND.whistle(c.ai ? vol(c.x, c.y, .5) : 1);
}

// back after a fall: under the bed (the nearest place of the way under it), on the desk; a car the robot swallowed is spat out behind it, grey
function toyRespawn(c) {
  const T = G.T, S = T.toys, R = c.spit;
  if (R) {
    c.spit = null;
    const bx = R.x - Math.cos(R.a) * 30, by = R.y - Math.sin(R.a) * 30;
    c.x = clamp(bx, 30, T.W - 30); c.y = clamp(by, 30, T.H - 30); c.ang = R.a + Math.PI; c.vx = -Math.cos(R.a) * 110; c.vy = -Math.sin(R.a) * 110;
    c.cem = !!c.Fc; c.dirt = 1; c.lvl = 2; c.h = 0;
    for (let k = 0; k < 14; k++) addP({ t: 'smoke', x: c.x + (Math.random() - .5) * 14, y: c.y + (Math.random() - .5) * 10, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, life: .9, ml: .9 });
    SND.spit(c.ai ? vol(c.x, c.y, .6) : 1);
    return;
  }
  if (c.tyUnder) {
    c.tyUnder = false;
    const W = S.ways[0], P = W.P; let best = 0, bd = 1e12;
    for (let q = 0; q < P.length; q++) { const kd = S.kind[jOf(T, P[q].x, P[q].y)]; if (kd === KD.STAIRS || kd === KD.DESK) continue; const dd = (P[q].x - c.fx0) ** 2 + (P[q].y - c.fy0) ** 2; if (dd < bd) { bd = dd; best = q; } }
    const a = P[best], b = P[Math.min(P.length - 1, best + 3)];
    c.x = a.x; c.y = a.y; c.ang = Math.atan2(b.y - a.y, b.x - a.x); c.vx = c.vy = 0; c.idx = a.i; c.safe = a.i; c.lvl = 2; c.h = 0;
    if (c.ai) c.tyWay = { P, k: best };
  } else {
    const k = S.kind[jOf(T, c.x, c.y)];
    c.lvl = k === KD.DESK || k === KD.RULER || k === KD.TOWER ? 3 : k === KD.BED ? 1 : 2; c.h = c.lvl === 3 ? 1.25 : c.lvl === 1 ? 1 : 0;
  }
  for (let k = 0; k < 8; k++) addP({ t: 'dust', x: c.x + (Math.random() - .5) * 20, y: c.y + (Math.random() - .5) * 14, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, life: .5, ml: .5 });
}

// on a side way (under the bed, the wash bay, round the paint box) a car counts as the place on the centre line its point stands for
function toyProgress(c, best) {
  const T = G.T, S = T.toys, w = S.wayM[jOf(T, c.x, c.y)];
  if (!w || c.lvl === 1) return best;
  const P = S.ways[w - 1].P; let b = 0, bd = 1e12;
  for (let q = 0; q < P.length; q += 2) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; b = q; } }
  return P[b].i;
}

// ======================================================= the computer cars

// a side way: decided shortly before it leaves the road, followed to its end. Under the bed: on EASY most, on HARD few, and every car too slow
// for the pillow; round the paint box: the cars that mind dirt; the wash bay: only when dirty
function toyTarget(c) {
  const T = G.T, S = T.toys, N = T.N;
  if (c.finished || (G.state !== 'race' && G.state !== 'finish')) { c.tyWay = null; return null; }
  if (!c.tyWay) {
    const diff = G.raceDiff || 0, coin = (c.seed * 4.7 + c.lap * .31) % 1, ahead = i => (i - c.idx + N) % N;
    const pick = (W, yes) => { if (!c.tyWay && ahead(W.i0) >= 2 && ahead(W.i0) < 20 && yes) c.tyWay = { P: W.P, k: 0 }; };
    pick(S.ways[0], coin < AI.under[diff] || MAXS * c.def.speed < 112);
    pick(S.ways[2], c.def.mud < 1.15 && (c.seed * 2.3) % 1 < AI.paint[diff]);
    pick(S.ways[1], c.dirt > AI.dirty[diff]);
    // a car on the floor that ended up beside the ramp or under the bed (pushed off the books, back from a fall) drives on under the bed
    if (!c.tyWay && c.lvl === 2 && c.off > 40) {
      const P = S.ways[0].P; let b = -1, bd = 90 * 90;
      for (let q = 0; q < P.length; q += 2) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd && S.kind[jOf(T, P[q].x, P[q].y)] !== KD.DESK) { bd = dd; b = q; } }
      if (b >= 0) c.tyWay = { P, k: b };
    }
    if (!c.tyWay) return null;
  }
  const W = c.tyWay, P = W.P; let k = W.k, bd = 1e9;
  for (let q = W.k; q < Math.min(P.length, W.k + 30); q++) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  W.k = k;
  if (k >= P.length - 5 || bd > 70 * 70) { c.tyWay = null; return null; }
  const t = P[Math.min(P.length - 1, k + 9)];
  return [t.x, t.y];
}

// the middle of the ruler and the pillows, past the eraser, wider through the town, careful up on the furniture, waiting at the barriers
function toyLane(c, i, lane) {
  const T = G.T, S = T.toys, ev = T.ev, N = T.N, sp = Math.hypot(c.vx, c.vy);
  if (inRng(c.idx, S.rulerI[0] - 20, S.rulerI[1] + 4, N) || inRng(c.idx, S.lipI - 150, S.lipI, N)) return 0;
  if (inRng(c.idx, S.eraserI - 30, S.eraserI + 12, N)) return -16; // (the eraser lies on the right of the way: keep left)
  const p = T.path[i];
  if (S.kind[jOf(T, p.x, p.y)] === KD.CITY) lane *= 2;
  if (c.lvl === 1 || c.lvl === 3) {
    lane = clamp(lane, -10, 10);
    // and they brake before the sharp bends there, so they do not fly off the edge
    const ta = T.tan[c.idx], tb = T.tan[(c.idx + 40) % N], bend = Math.abs(Math.atan2(ta.x * tb.y - ta.y * tb.x, ta.x * tb.x + ta.y * tb.y));
    if (bend > .7 && sp > 90 + 40 * (1.6 - bend)) c.brake = true;
  }
  // a closed barrier ahead: wait for the train
  if (ev) S.cross.forEach((cr, k) => { const a = (cr.i - c.idx + N) % N; if (ev.toyGate[k] > .4 && a > 6 && a < 40 && sp > 20) c.brake = true; });
  return lane;
}

// gas: full over the pillow (on EASY not always: then the car falls short now and then), slow in the wash bay, a little careful under the bed
function toyThrottle(c, thr) {
  const T = G.T, S = T.toys, N = T.N, diff = G.raceDiff || 0;
  if (c.lvl === 1 && inRng(c.idx, S.lipI - 150, S.lipI + 2, N)) return hash(c.seed * 97 | 0, c.lap, 166) < AI.jump[diff] ? 1 : .62;
  if (c.tyWay && c.tyWay.P === S.ways[1].P) return Math.min(thr, .6);
  if (c.lvl === 2 && inBed(S, c.x, c.y)) return Math.min(thr, .9);
  return thr;
}

// ======================================================= drawing

// the bed over the cars under it (not when you are under it yourself)
function toyDeck() { const S = G.T.toys; return S.under ? null : { c: S.bedImg, x: S.bedAt[0], y: S.bedAt[1] }; }

// cars up on the bed or the desk are bigger, their shadow lies further away; inside the marble run they are drawn later (over it); a car the
// robot swallows shrinks into it; under the bed you do not see the cars up on it. True when the car is drawn here.
function drawToyCar(c, F, rot, lv) {
  const S = G.T.toys;
  if (c.tube) return true;
  if (c.fall > 0 && c.fallKind === 'suck') {
    const t = Math.min(1, (c.fallT0 - c.fall) / .4), R = c.spit; if (t >= 1 || !R) return true;
    const x = c.fx0 + (R.x - c.fx0) * t, y = c.fy0 + (R.y - c.fy0) * t, s = Math.max(4, Math.round(SS * (1 - t * .8)));
    ctx.drawImage(F.frames[lv][rotIndex(c.ang + t * 6)], Math.round(x - s / 2), Math.round(y - s / 2), s, s);
    return true;
  }
  if (S.under && c.lvl === 1 && c.fall <= 0 && inBed(S, c.x, c.y)) return true;
  if (c.fall > 0 && c.fallKind === 'abyss') {
    // falling off the furniture: it tips over the edge and drops (smaller, its shadow catches up with it)
    const t = (c.fallT0 - c.fall) / .5; if (t >= 1) return true;
    const s = Math.round(SS * (1 + .16 * (c.h || 0)) * (1 - t * .35)), drop = t * t * 26;
    ctx.globalAlpha = .3 * t; ctx.drawImage(F.shadow[rot], Math.round(c.fx0 - s / 2 + 3), Math.round(c.fy0 - s / 2 + 4 + 18), s, s); ctx.globalAlpha = 1;
    ctx.drawImage(F.frames[lv][rotIndex(c.ang + t * 2.5)], Math.round(c.fx0 - s / 2), Math.round(c.fy0 - s / 2 + drop), s, s);
    return true;
  }
  const h = c.h || 0;
  if (h < .05 || c.fall > 0 || c.flatT > 0 || c.sink > 0 || c.snowT > 0) return false;
  if (c.ghost > 0 && ((G.time * 12) | 0) % 2) return true;
  const z = c.z > 0 ? c.z : 0, s = 1 + .16 * h + z / 90, S2 = Math.round(SS * s), lift = Math.round(z * .6);
  ctx.globalAlpha = .34 * Math.max(.3, 1 - z / 80);
  ctx.drawImage(F.shadow[rot], Math.round(c.x - S2 / 2 + 3 + 8 * h + z * .3), Math.round(c.y - S2 / 2 + 4 + 11 * h + z * .4), S2, S2);
  ctx.globalAlpha = 1;
  ctx.drawImage(F.frames[lv][rot], Math.round(c.x - S2 / 2), Math.round(c.y - S2 / 2) - lift - (c.bump || 0), S2, S2);
  return true;
}

// a wooden barrier at a crossing: a post at the road edge, the red and white arm across the road (folded away when a car broke through)
function barrier(cr, k, s, ev) {
  const T = G.T, tg = T.tan[cr.i], nm = T.nrm[cr.i], sg = s ? -1 : 1, bx = cr.x - tg.x * 18 * sg + nm.x * sg * (HALF + 5), by = cr.y - tg.y * 18 * sg + nm.y * sg * (HALF + 5);
  const g = ev.toyGate[k], kn = ev.toyKnock[k][s], ang = Math.atan2(-nm.y * sg, -nm.x * sg) - (1 - g) * 1.45 + kn * 1.6 * Math.sin(kn * 9), len = 2 * HALF + 6;
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
  for (const p of trainPieces(S, ev.toyTrain)) {
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
  if (ev.toyOn && ev.toyTrain.wait <= 0 && Math.random() < .3) { const p = trainPieces(S, ev.toyTrain)[0]; if (inView(p.x, p.y)) addP({ t: 'smoke', x: p.x, y: p.y, vx: (Math.random() - .5) * 8, vy: -8, life: .7, ml: .7 }); }
  // the wind-up car: a little tin car with a big key on its roof
  const w = ev.toyWind;
  if (w && inView(w.x, w.y)) {
    ctx.save(); ctx.translate(Math.round(w.x), Math.round(w.y)); ctx.rotate(w.a);
    ctx.globalAlpha = .25; R1(-6, -3, 16, 11, '#000'); ctx.globalAlpha = 1;
    R1(-8, -6, 16, 12, '#1b120c'); R1(-7, -5, 14, 10, '#3ab0a0'); R1(-7, -5, 14, 2, '#8ae8d8'); R1(2, -4, 4, 8, '#bfe8ff'); R1(-6, -6, 3, 1, '#1b120c'); R1(-6, 5, 3, 1, '#1b120c');
    const kw = Math.round(Math.abs(Math.cos(w.key)) * 5) + 1;
    R1(-5, -1, 4, 2, '#8a8a92'); R1(-9, -kw, 3, kw * 2, '#1b120c'); R1(-8, -kw + 1, 1, kw * 2 - 2, '#d8d8e0');
    ctx.restore();
  }
  // marbles: glass with a coloured swirl and a highlight
  for (const m of ev.toyMarbles) {
    if (!inView(m.x, m.y)) continue;
    const x = Math.round(m.x), y = Math.round(m.y), col = ['#e84a4a', '#3c78e0', '#f2c230', '#40b050'][m.col];
    ctx.globalAlpha = .25; disc(x + 2, y + 3, MARBLE.r, '#000'); ctx.globalAlpha = 1;
    disc(x, y, MARBLE.r, '#1b120c'); disc(x, y, MARBLE.r - 1, '#cfe8ff');
    R1(x + Math.round(Math.cos(m.rot) * 2) - 1, y + Math.round(Math.sin(m.rot) * 2) - 1, 3, 2, col); R1(x - 2, y - 2, 1, 1, '#ffffff');
  }
  // the domino tower (or the stones lying across the way, or standing up again); it wobbles when a car comes close
  const D = ev.toyDomino, Q = S.domino;
  if (inView(Q.x, Q.y, 80)) {
    if (!D || D.st === 'up' || D.st === 'rise') {
      const up = D && D.st === 'rise' ? D.t / DOMINO.rise : 1, wob = D && D.wob > 0 ? Math.round(Math.sin(G.time * 40)) : 0;
      ctx.globalAlpha = .3; R1(Q.x - 7 + 4, Q.y - 6 + 5, 14, 14, '#000'); ctx.globalAlpha = 1;
      for (let k = 0; k < 5; k++) { const yy = Q.y + 6 - Math.round(k * 4 * up), xx = Q.x + (k > 2 ? wob : 0); R1(xx - 8, yy - 3, 16, 6, '#1b120c'); R1(xx - 7, yy - 2, 14, 4, k % 2 ? '#f4f4ee' : '#2a2a32'); R1(xx - 4 + k, yy - 1, 2, 2, k % 2 ? '#1b120c' : '#ffffff'); R1(xx + 2 - k, yy - 1, 2, 2, k % 2 ? '#1b120c' : '#ffffff'); }
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
  const R = ev.toyRobot;
  if (R && inView(R.x, R.y, 60)) {
    const sh = R.chew > 0 ? Math.round(Math.sin(G.time * 60) * 1.5) : 0, x = Math.round(R.x) + sh, y = Math.round(R.y), fx = Math.cos(R.a), fy = Math.sin(R.a);
    if (R.out) { ctx.globalAlpha = .16 + (R.prey ? .08 : 0); disc(x, y, ROBOT.reach * .5 + Math.round(Math.sin(G.time * 8) * 3), R.prey ? '#ff9a9a' : '#8fd8ff'); ctx.globalAlpha = 1; }
    ctx.globalAlpha = .3; disc(x + 4, y + 5, ROBOT.r, '#000'); ctx.globalAlpha = 1;
    disc(x, y, ROBOT.r, '#1b120c'); disc(x, y, ROBOT.r - 1, '#5a5e68'); disc(x, y, ROBOT.r - 4, '#7a7e88'); disc(x - 3, y - 3, 4, '#9aa0aa');
    for (let a = -1; a <= 1; a += .1) R1(Math.round(x + Math.cos(R.a + a) * (ROBOT.r - 2)), Math.round(y + Math.sin(R.a + a) * (ROBOT.r - 2)), 2, 2, '#2a2a32');
    const bl = ((G.time * (R.blink > 0 ? 10 : 3)) | 0) % 2;
    R1(Math.round(x + fx * 8 - fy * 4), Math.round(y + fy * 8 + fx * 4), 2, 2, bl ? '#4ab8ff' : '#1a4a7a'); R1(Math.round(x + fx * 8 + fy * 4), Math.round(y + fy * 8 - fx * 4), 2, 2, bl ? '#1a4a7a' : '#4ab8ff');
    if (R.blink > 0 && bl) { ctx.globalAlpha = .35; disc(x, y, ROBOT.r + 6, '#4ab8ff'); ctx.globalAlpha = 1; }
    const bx = x + fx * 12 + fy * 11, by = y + fy * 12 - fx * 11;
    for (let q = 0; q < 3; q++) { const a = G.time * 20 + q * TAU / 3; R1(Math.round(bx + Math.cos(a) * 4), Math.round(by + Math.sin(a) * 4), 1, 1, '#d8d8e0'); }
    if (R.out && Math.random() < .5) addP({ t: 'dust', x: R.x + fx * 30 + (Math.random() - .5) * 30, y: R.y + fy * 30 + (Math.random() - .5) * 30, vx: -fx * 40, vy: -fy * 40, life: .5, ml: .5 });
  }
  // the dock: its light is green while the robot sleeps
  const [qx, qy] = S.robot.dock;
  if (inView(qx, qy)) R1(qx + 8, qy - 2, 3, 4, R && R.out ? '#5a1a1a' : ((G.time * 2) | 0) % 2 ? '#5fe36a' : '#2a6a2a');
}

// under the bed: dark (light falls in only at the open sides), the slats of the bed above you, the frame round it; the eyes of the monster glow
function drawUnder(cx, cy) {
  const S = G.T.toys, [x0, y0, x1, y1] = S.bed, R = { x: x0, y: y0, W: x1 - x0, H: y1 - y0 + 8 };
  darkRect(cx, cy, R, .74, [], S.underLights.map(([x, y]) => ({ x, y })));
  ctx.globalAlpha = .55;
  for (const sx of S.slats) if (sx > cx - 20 && sx < cx + VW + 20) R1(sx - 7, y0 + 6, 14, y1 - y0 - 12, '#1e140c');
  R1(x0, y0, x1 - x0, 7, '#1e140c'); R1(x0, y1 - 7, x1 - x0, 7, '#1e140c'); R1(x0, y0, 7, y1 - y0, '#1e140c');
  ctx.globalAlpha = .25; R1(x0 + 7, y0 + Math.round((y1 - y0) / 2) - 3, x1 - x0 - 14, 6, '#1e140c'); ctx.globalAlpha = 1;
  const [mx, my] = S.monster, bl = ((G.time * .7) % 4) > 3.85;
  if (!bl) for (const s of [-1, 1]) { ctx.globalAlpha = .4; disc(mx + s * 8, my - 4, 5, '#c8ff5a'); ctx.globalAlpha = 1; disc(mx + s * 8, my - 4, 3, '#e8ff9a'); R1(mx + s * 8, my - 5, 1, 2, '#1b120c'); }
}

// above the cars: the cars in the marble run, a marble coming down the spiral, the brushes of the car wash, the keys while the countdown runs,
// the dark under the bed, the warning triangle when the robot hunts you
function drawToyAbove(cx, cy) {
  const T = G.T, S = T.toys, ev = T.ev; if (!ev) return;
  if (S.under) drawUnder(cx, cy);
  const [tx, ty, tr] = S.tower;
  // cars in the spiral: round and round and down, smaller and smaller
  for (const c of G.cars) {
    if (!c.tube) continue;
    const f = c.tube.f, a = Math.PI * .05 - f * TAU * 2, rr = (tr - 10) * (1 - f * .7), x = tx + Math.cos(a) * rr, y = ty + Math.sin(a) * rr, s = Math.max(.45, 1.2 - f * .7), S2 = Math.round(SS * s);
    const F = c.cem && c.Fc ? c.Fc : c.F, lv = Math.min(5, Math.round(c.dirt * 5));
    ctx.drawImage(F.frames[lv][rotIndex(a - Math.PI / 2)], Math.round(x - S2 / 2), Math.round(y - S2 / 2), S2, S2);
  }
  // a marble on its way down the spiral (it comes out soon)
  if (ev.toyMarbleWarn > 0 && inView(tx, ty, 60)) {
    const f = 1 - ev.toyMarbleWarn / MARBLE.warn, a = -f * TAU * 2.4, rr = (tr - 8) * (1 - f * .8);
    disc(Math.round(tx + Math.cos(a) * rr), Math.round(ty + Math.sin(a) * rr), 4, '#1b120c'); disc(Math.round(tx + Math.cos(a) * rr), Math.round(ty + Math.sin(a) * rr), 3, '#cfe8ff');
  }
  // the car wash: two brush rolls at the sides of the bay and a turning band over it
  const W = S.wash;
  if (inView(W.x, W.y, 60)) {
    for (const s of [-1, 1]) {
      const bx = W.x + W.nm.x * s * 14, by = W.y + W.nm.y * s * 14;
      disc(Math.round(bx), Math.round(by), 8, '#1b4a9a'); disc(Math.round(bx), Math.round(by), 7, '#3c78e0');
      for (let q = 0; q < 6; q++) { const a = G.time * 9 * s + q * TAU / 6; R1(Math.round(bx + Math.cos(a) * 5), Math.round(by + Math.sin(a) * 5), 2, 2, '#9ac8ff'); }
      disc(Math.round(bx), Math.round(by), 2, '#f2cc30');
    }
    const ph = (G.time * 10) % 4;
    for (let o = -14; o <= 14; o += 4) R1(Math.round(W.x + W.nm.x * o + W.tg.x * (ph - 2)), Math.round(W.y + W.nm.y * o + W.tg.y * (ph - 2)), 2, 2, '#ff8ab0');
  }
  // countdown: every car is wound up with a key
  if (G.state === 'countdown') for (const c of G.cars) {
    const kw = Math.round(Math.abs(Math.cos(G.time * 6 + c.seed)) * 6) + 1, x = Math.round(c.x - Math.cos(c.ang) * 6), y = Math.round(c.y - Math.sin(c.ang) * 6) - 14;
    R1(x - 1, y, 3, 8, '#1b120c'); R1(x, y + 1, 1, 6, '#d8d8e0'); R1(x - kw, y - 2, kw * 2 + 1, 4, '#1b120c'); R1(x - kw + 1, y - 1, kw * 2 - 1, 2, '#e8c890');
  }
  // the robot hunts you: a warning triangle over it (or at the edge of the screen in its direction)
  const R = ev.toyRobot, P = G.player;
  if (R && R.out && P && R.prey === P && Math.hypot(P.x - R.x, P.y - R.y) < 360) warnAt(R.x, R.y, cx, cy);
}

// ----- the dark room in the last lap: a veil with holes for the headlights, the night light, the door and the star projector -----
const night = mk(VW, VH), nctx = night.getContext('2d');
function veil(cx, cy, k) {
  const T = G.T, S = T.toys;
  nctx.globalCompositeOperation = 'source-over'; nctx.clearRect(0, 0, VW, VH);
  nctx.fillStyle = 'rgba(10,12,40,' + (.72 * k).toFixed(3) + ')'; nctx.fillRect(0, 0, VW, VH);
  nctx.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a) => { nctx.fillStyle = 'rgba(0,0,0,' + a + ')'; nctx.beginPath(); nctx.arc(Math.round(x), Math.round(y), r, 0, TAU); nctx.fill(); };
  const soft = (x, y, r, a) => { if (x < -r || x > VW + r || y < -r || y > VH + r) return; const g = nctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); nctx.fillStyle = g; nctx.fillRect(x - r, y - r, r * 2, r * 2); };
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
  // the night light keeps the start line and the grid in light (rule 14), the gap under the door, the projector
  const [lx, ly] = S.nightlight, p0 = T.path[0]; soft(lx - cx + 40, ly - cy + 40, 190, .75); soft(p0.x - cx, p0.y - cy, 90, .7); soft(p0.x - cx, p0.y + 110 - cy, 90, .55);
  const [d0, d1] = S.door; for (let x = d0; x < d1; x += 20) soft(x + 10 - cx, T.H - 24 - cy, 40, .45);
  const [px, py] = S.projector; soft(px - cx, py - cy, 50, .5);
  ctx.drawImage(night, 0, 0);
}

// on the screen: the light from the window by day, the flicker before bedtime, the night with the projected stars
function drawToySky(cx, cy) {
  const T = G.T, S = T.toys, ev = T.ev; if (!ev) return;
  const k = ev.toyDark;
  if (k < 1 && !S.under) {
    // sunlight falls through the window in slanted beams, dust floats only in them
    const [wx0, wx1] = S.window;
    ctx.save(); ctx.globalAlpha = .08 * (1 - k); ctx.fillStyle = '#fff3c0';
    for (let q = 0; q < 3; q++) {
      const x0 = wx0 + q * (wx1 - wx0) / 3 - cx, x1 = x0 + (wx1 - wx0) / 3 - 14;
      ctx.beginPath(); ctx.moveTo(x0, 14 - cy); ctx.lineTo(x1, 14 - cy); ctx.lineTo(x1 + 380, 560 - cy); ctx.lineTo(x0 + 350, 560 - cy); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = .55 * (1 - k);
    for (let q = 0; q < 30; q++) {
      const t = G.time * .05 + hash(q, 1, 155), u = t % 1, band = hash(q, 2, 155), x = wx0 + band * (wx1 - wx0 - 20) + u * 360 + Math.sin(G.time + q) * 6 - cx, y = 14 + u * 540 - cy;
      if (x > -2 && x < VW + 2 && y > -2 && y < VH + 2) R1(Math.round(x), Math.round(y), 1, 1, '#fff8dc');
    }
    ctx.globalAlpha = 1;
    // the curtains at the window sway
    for (const s of [-1, 1]) {
      const bx = (s < 0 ? wx0 - 30 : wx1 + 4) - cx, sw = Math.round(Math.sin(G.time * 1.3 + s) * 3);
      if (bx < -40 || bx > VW + 10) continue;
      for (let x = 0; x < 26; x++) { const f = Math.sin((x + sw) / 2.4); R1(Math.round(bx + x), -cy, 1, 34 + Math.round(Math.sin(x / 3 + G.time) * 2), f > .5 ? '#f48aa8' : f < -.5 ? '#c85a7a' : '#e87094'); }
    }
  }
  // the lamp flickers before the light goes out
  if (ev.toyFlick > 0 && ((G.time * 14) | 0) % 3 === 0) { ctx.fillStyle = 'rgba(10,12,40,.45)'; ctx.fillRect(0, 0, VW, VH); }
  if (k > 0) {
    veil(cx, cy, k);
    // the star projector throws turning stars and a moon over the whole room
    const [px, py] = S.projector;
    ctx.globalAlpha = .8 * k;
    for (let q = 0; q < 110; q++) {
      const a = hash(q, 1, 156) * TAU + G.time * .12, d = 60 + hash(q, 2, 156) * 1500, x = px + Math.cos(a) * d - cx, y = py + Math.sin(a) * d * .7 - cy;
      if (x < -3 || x > VW + 3 || y < -3 || y > VH + 3) continue;
      const tw = (Math.sin(G.time * 3 + q) + 1) / 2, big = hash(q, 3, 156) < .25;
      R1(Math.round(x), Math.round(y), 1, 1, '#fff6c8');
      if (big && tw > .4) { R1(Math.round(x) - 1, Math.round(y), 3, 1, '#ffe9a0'); R1(Math.round(x), Math.round(y) - 1, 1, 3, '#ffe9a0'); }
    }
    { const a = G.time * .12 + 2, d = 480, x = Math.round(px + Math.cos(a) * d - cx), y = Math.round(py + Math.sin(a) * d * .7 - cy);
      if (x > -20 && x < VW + 20 && y > -20 && y < VH + 20) { disc(x, y, 9, '#fff3b0'); disc(x + 4, y - 2, 8, '#1a1c48'); } }
    ctx.globalAlpha = .35 * k; disc(Math.round(S.nightlight[0] - cx), Math.round(S.nightlight[1] - cy), 10, '#ffd27a'); ctx.globalAlpha = 1;
    // the little blue lights of the robot in the dark
    const R = ev.toyRobot;
    if (R && R.out) { const x = Math.round(R.x - cx), y = Math.round(R.y - cy); ctx.globalAlpha = .45 * k; disc(x, y, 8, '#4ab8ff'); ctx.globalAlpha = 1; R1(x - 1, y - 1, 3, 3, '#bfe8ff'); }
  }
}

// parquet (30) is slippery like sheet ice, but only half as bad ("like in socks"); the soft way over the duvet (31) and the duvet itself (0 up on
// the bed) are a little slower; dust under the bed (120) is like mud; the baseplate of the town (121) is a little bumpy, full grip; the swept
// floor under the bed (122) is a little slower, the stairs of blocks (123) slow (you climb)
function toySurf(c) {
  if (c.surf === 30) return [1, 4.5 * c.def.turn * c.def.turn, .78, .8];
  if (c.surf === 31) return [.94, 8, .95];
  if (c.surf === DUST) return [.5, 3, .7];
  if (c.surf === FLOORU) return [.84, 9, .95];
  if (c.surf === STEPS) return [.48, 10, .9];
  if (c.surf === PLATE) return [.93, 9, .95];
  return null;
}

// ---------- hooks: how the core calls this track (hooks.js; what each hook does: _template.js) ----------
/** @type {import('./_template.js').TrackHooks} */
export const toyHooks = {
  surf: toySurf, init: initToys, events: { spielzeug: initToyEvents, saugroboter: initRobot, schlafenszeit: initNight }, update: toyUpdate, collisions: toyCollisions,
  target: toyTarget, lane: toyLane, throttle: toyThrottle, progress: toyProgress, ground: toyGround, respawn: toyRespawn,
  deck: toyDeck, drawCar: drawToyCar, drawGround: drawToyGround, drawAbove: drawToyAbove, drawSky: drawToySky, noBeams: () => true,
};
