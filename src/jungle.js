import { G } from './g.js';
import { SFX } from './audio.js';
import { HALF, LAPS, SS, TAU, VH, VW, clamp, ctx, hash, mk } from './core.js';
import { R1, disc, ell } from './gfx.js';
import { darkRect, warnAt } from './kit.js';
import { addP, splash } from './particles.js';
import { fallCar, inView, near } from './trackfx.js';
import { BOARD, FIELD, FORD } from './junglemap.js';

// ---------- Dschungel Rev 2 while racing (plaene/DSCHUNGEL_REV2.md) ----------
// Always: under the canopy you only see round your own car; the liana swings over the gorge (3 s each way) and throws you across when it hangs on
// your side (the east) as you get there, otherwise there is the log (miss it and you fall: the river carries you a bit and you come back behind the
// gorge); the temple is dark inside (torches, car lamps, light through the hole over the waterfall grotto, which washes); the ford pushes you south.
// Event "baeume": rotten trees at the stairs and on the trail fall one by one, more often from lap to lap (creaking, leaves, their shadow, a warning
// triangle); a fallen trunk stays and is a little ramp (fast: you hop over, slow: it shakes you and brakes hard).
// Event "kroko": crocodiles in the ford and the swamp look like logs; eyes and bubbles, the jaw opens slowly, then they snap (spin, half the speed);
// from lap 2 one swims across the ford.
// Event "steinkugel": from lap 2 a stone ball rolls down the ball corridor behind whoever comes into the hall first, down the stairs into the basin;
// 15 s later it is back up; in the last lap two come one after the other. Whoever it catches is flat for a moment.
// Fields in T.ev start with jg (T22).

const LIANA = { per: 6, reach: 34, on: .55 }, TREE = { creak: 1.8, fall: .6, first: 14, gap: [[18, 24], [12, 16], [8, 12]] };
const BALL = { v: 112, every: 15, second: 1.4, flat: 1.2, r: 14 }, CROC = { per: 6, warn: 1, open: .45, reach: 24, stun: 1.2 }, SWIM = { every: 10, dur: 4 };

const leadLap = () => G.cars.reduce((m, c) => Math.max(m, c.lap || 1), 1);
const inRng = (i, a, b, N) => (i - a + N) % N <= (b - a + N) % N;

function initJungle(T) {
  const ev = T.ev, J = T.jungle;
  J.jumps.length = J.baseJumps; J.jumps[0].off = true; // (the trunks of the last race are gone)
  ev.jgTrees = []; ev.jgLogs = []; ev.jgCrocs = []; ev.jgSwim = null; ev.jgBalls = []; ev.jgQueue = []; ev.jgReady = 0; ev.obst = []; ev.jgAlarm = false; ev.jgNext = TREE.first;
}

// where the end of the liana is: -1 over the west bank, +1 over the east bank (the side you come from)
const lianaAng = t => Math.sin(t / LIANA.per * TAU);

function jungleUpdate(T, dt) {
  const ev = T.ev, J = T.jungle, P = G.player, t = ev.t;
  J.lianaA = lianaAng(t); J.jumps[0].off = J.lianaA < LIANA.on;
  // where the player is: under the canopy, in the temple
  const C = J.canopy, tp = J.temple;
  J.under = !!(P && P.x > C.x + 10 && P.x < C.x + C.W - 10 && P.y > C.y + 10 && P.y < C.y + C.H - 10 && !nearTrail(J, P.x, P.y));
  J.inTemple = !!(P && P.fall <= 0 && P.x > tp.x && P.x < tp.x + tp.W && P.y > tp.y && P.y < tp.y + tp.H - 4);
  if (ev.jgTreesOn) updateTrees(T, dt);
  if (ev.jgCrocsOn) updateCrocs(T, dt);
  if (ev.jgBallOn) updateBall(T, dt);
  // parrots fly up when a car races along the edge of the jungle
  if (P && Math.random() < dt * .25 && P.off > 10 && Math.hypot(P.vx, P.vy) > 60) {
    for (let k = 0; k < 3; k++) addP({ t: 'parrot', x: P.x + (Math.random() - .5) * 60, y: P.y - 20, vx: (Math.random() - .5) * 80, vy: -40 - Math.random() * 30, life: 2.4, ml: 2.4, ph: Math.random() * 10, col: ['#e8452c', '#2f6fd8', '#f2c230', '#3aa845'][(Math.random() * 4) | 0] });
    SFX.parrot();
  }
  if (P && Math.random() < dt * .08 && J.monkeys.some(([x, y]) => near(x, y) < 260)) SFX.monkey();
  // what the computer cars steer round: fig blobs near them, the swimming crocodile, crocodiles that are up, the stones in the ford
  const ob = ev.obst; ob.length = 0;
  for (const b of J.blobs) if (G.cars.some(c => c.ai && Math.abs(c.x - b.x) < 110 && Math.abs(c.y - b.y) < 110)) ob.push({ x: b.x, y: b.y, r: b.r + 4 });
  if (ev.jgSwim && ev.jgSwim.on) ob.push(ev.jgSwim);
  for (const cr of ev.jgCrocs) if (cr.st >= 1) ob.push({ x: cr.x, y: cr.y, r: 10 });
}

function nearTrail(J, x, y) { const P = J.trail; for (let k = 0; k < P.length; k += 3) if (Math.abs(P[k].x - x) < 28 && Math.abs(P[k].y - y) < 28) return true; return false; }

// the ground under a car: fallen trunks and roots shake it (slow cars are braked hard by a trunk), the gorge swallows it (the river carries it, it comes back
// behind the gorge), the ford makes it a little green and splashes, the planks clatter, the swamp blubbers
function jungleGround(c, j, sp, dt) {
  const T = G.T, ev = T.ev, J = T.jungle;
  if (c.surf === 11 && c.z <= 0) { fallCar(c, 'abyss', J.iLand); return; }
  for (const L of ev.jgLogs) crossBar(c, L, 'jgL' + L.k, L.half + 4, .35);
  for (let k = 0; k < J.roots.length; k++) crossBar(c, J.roots[k], 'jgR' + k, HALF - 4, .9);
  if (c.surf === FORD) {
    c.dirt = Math.min(1, c.dirt + .08 * dt);
    if (sp > 30 && Math.random() < dt * 8) splash(c.x + (Math.random() - .5) * 10, c.y + 4, 3);
  }
  if (!c.ai) {
    if (c.surf === BOARD && sp > 30 && Math.random() < dt * 6) SFX.clack();
    if (c.surf === 2 && sp > 20 && Math.random() < dt * 4) SFX.blubb();
  }
}
// a bar across the way (a fallen trunk, a root): crossing it shakes the car and keeps k of its speed (cars in the air hop over)
function crossBar(c, L, key, half, k) {
  const a = (c.x - L.x) * L.nx + (c.y - L.y) * L.ny, along = (c.x - L.x) * L.tx + (c.y - L.y) * L.ty, side = Math.sign(a);
  if (Math.abs(a) < half && Math.abs(along) < 7 && c[key] !== undefined && c[key] !== side && c.z <= 0) { c.vx *= k; c.vy *= k; c.bump = k < .5 ? 2 : 1; if (!c.ai && k < .5) SFX.bump(); }
  c[key] = Math.abs(along) < 30 && Math.abs(a) < half + 10 ? Math.sign(along) : undefined;
}

// the undergrowth floor is a little slower than the road, the ford is shallow water, the planks are like a road (surf)
function jungleSurf(c) {
  if (c.surf === FIELD) return [.86, 8, .95];
  if (c.surf === FORD) return [.72, 1.6, .65];
  if (c.surf === BOARD) return [1, 10, 1];
  return null;
}

// flattened by the stone ball: a moment flat on the ground, then it pops back
function jungleStuck(c, dt) {
  c.vx = c.vy = 0; c.flatT -= dt;
  if (c.flatT <= 0) { c.flatT = 0; if (!c.ai || near(c.x, c.y) < 250) SFX.plopp(); }
}

// ======================================================= the computer cars

// a side way (the boardwalk, the trail of fork 1, the waterfall grotto): decided shortly before it leaves the road, followed to its end
function jungleTarget(c) {
  const T = G.T, J = T.jungle, N = T.N;
  if (c.finished || (G.state !== 'race' && G.state !== 'finish')) { c.jgWay = null; return null; }
  if (!c.jgWay) {
    const diff = G.raceDiff || 0, coin = (c.seed * 4.7) % 1, ahead = i => (i - c.idx + N) % N, ev = T.ev;
    const pick = (i, pts, yes) => { if (ahead(i) >= 2 && ahead(i) < 20 && yes) c.jgWay = { P: pts, k: 0, i }; };
    // the boardwalk: the cars that mind mud (on EASY nearly all of them)
    pick(J.iBoard, J.boards, c.def.mud < 1.15 && coin < [.9, .6, .35][diff]);
    // fork 1: the swamp gully for the cars good in mud and most on HARD, the dry trail for the others
    if (!c.jgWay) pick(J.iFork, J.trail, !(c.def.mud >= 1.15 || coin < [.1, .4, .75][diff]));
    // fork 2: the grotto only when dirty (EASY also when the ball is about to roll)
    if (!c.jgWay) {
      const ballSoon = ev.jgBallOn && c.lap >= 2 && ev.t >= ev.jgReady && !ev.jgBalls.length;
      pick(J.iGrotto, J.grotto, c.dirt > [.4, .55, .7][diff] || (diff === 0 && ballSoon && coin < .7));
    }
    if (!c.jgWay) return null;
  }
  const W = c.jgWay, P = W.P; let k = W.k, bd = 1e9;
  for (let q = W.k; q < Math.min(P.length, W.k + 30); q++) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  W.k = k;
  if (k >= P.length - 5 || bd > 70 * 70) { c.jgWay = null; return null; }
  const t = P[Math.min(P.length - 1, k + 9)];
  return [t.x, t.y];
}

// the liana or the log at the gorge, upstream in the ford, wider in the undergrowth, never towards the deep swamp
function jungleLane(c, i, lane) {
  const T = G.T, J = T.jungle, N = T.N, p = T.path[i], n = T.nrm[i], g = J.gorge;
  const ahead = (J.iG - c.idx + N) % N, past = (c.idx - J.iG + N) % N;
  if (ahead < 70 || past < 14) {
    // the liana if it will hang on our side when we get to the lip (the time ahead from our speed), otherwise the log (narrow: aim at its middle)
    if (ahead >= 36 && ahead < 70) { const sp = Math.max(60, Math.hypot(c.vx, c.vy)), arr = ahead * 2 / sp; c.jgLiana = lianaAng(T.ev.t + arr) > LIANA.on + .15 && lianaAng(T.ev.t + arr + .25) > LIANA.on; }
    const y = c.jgLiana && past >= 14 ? (g.lane[0] + g.lane[1]) / 2 : c.jgLiana ? (g.lane[0] + g.lane[1]) / 2 : g.log;
    return clamp((y - p.y) / (n.y || 1), -40, 40);
  }
  const fa = (J.iFord - c.idx + N) % N, fp = (c.idx - J.iFord + N) % N;
  if (fa < 40 || fp < 18) return -16 * Math.sign(n.y || 1); // (upstream = north; the current pushes south)
  if (inRng(i, J.iF[0], J.iF[1], N)) lane *= 1.6;
  const bad = l => { const x = (p.x + n.x * l) | 0, y = (p.y + n.y * l) | 0; return x < 0 || y < 0 || x >= T.W || y >= T.H || T.ter[y * T.W + x] === 10 || J.figM[y * T.W + x] === 1; };
  if (bad(lane)) for (const l of [lane * .5, 0, lane + 14, lane - 14]) if (!bad(l)) return l;
  return lane;
}

// gas: the log is narrow (slower), under the canopy the cars on EASY are a little slower (they see everything, you do not), the grotto washes slowly
function jungleThrottle(c, thr) {
  const T = G.T, J = T.jungle, N = T.N, ahead = (J.iG - c.idx + N) % N;
  if (!c.jgLiana && (ahead < 40 || (c.idx - J.iG + N) % N < 10)) thr = Math.min(thr, .7);
  if ((G.raceDiff || 0) === 0 && inRng(c.idx, J.iF[0], J.iF[1], N)) thr *= .88;
  if (c.jgWay && c.jgWay.P === J.grotto) thr = Math.min(thr, .62);
  return thr;
}

// ======================================================= event "baeume": falling trees

function initTrees(T) { const ev = T.ev; ev.jgTreesOn = true; ev.jgTrees = T.jungle.trees.map(tr => ({ ...tr, st: 0, p: 0, t0: 0 })); ev.jgOrder = ev.jgTrees.map((tr, k) => k).sort((a, b) => hash(a, 3, 117) - hash(b, 3, 117)); }

function updateTrees(T, dt) {
  const ev = T.ev, J = T.jungle;
  if (ev.t >= ev.jgNext && ev.jgOrder.length) {
    const tr = ev.jgTrees[ev.jgOrder.shift()]; tr.st = 1; tr.t0 = ev.t;
    const L = clamp(leadLap(), 1, 3), [a, b] = TREE.gap[L - 1]; ev.jgNext = ev.t + a + hash(ev.jgOrder.length, 5, 118) * (b - a);
    if (near(tr.bx, tr.by) < 360) SFX.creakTree();
  }
  for (const tr of ev.jgTrees) {
    if (tr.st !== 1) continue;
    const u = ev.t - tr.t0 - TREE.creak; tr.creak = u < 0; tr.p = clamp(u / TREE.fall, 0, 1);
    if (tr.creak && Math.random() < dt * 12) addP({ t: 'leaf', x: tr.bx + (Math.random() - .5) * 30, y: tr.by - 20, vx: 10, vy: 20 + Math.random() * 10, life: 2, ml: 2, ph: Math.random() * 10, col: ['#3a8a38', '#5aa83e', '#8a6a2a'][(Math.random() * 3) | 0] });
    if (tr.p < 1) continue;
    // it lies across the way now: a hit while it falls throws the car away; from now on it is a little ramp
    tr.st = 2;
    const reach = tr.half + 12, mx = tr.bx + tr.nx * reach, my = tr.by + tr.ny * reach;
    for (const c of G.cars) {
      if (c.fall > 0 || c.z > 0) continue;
      const a = (c.x - mx) * tr.tx + (c.y - my) * tr.ty, b = (c.x - mx) * tr.nx + (c.y - my) * tr.ny;
      if (Math.abs(a) < 12 && Math.abs(b) < reach + 4) { c.vx = tr.tx * Math.sign(a || 1) * 150; c.vy = tr.ty * Math.sign(a || 1) * 150; c.spin = 12; c.stun = 1; c.boost = 0; if (!c.ai) SFX.crash(); }
    }
    ev.jgLogs.push({ k: tr.k, x: mx, y: my, tx: tr.tx, ty: tr.ty, nx: tr.nx, ny: tr.ny, half: reach, r: 6 });
    J.jumps.push({ x: mx - tr.tx * 6, y: my - tr.ty * 6, tx: tr.tx, ty: tr.ty, lo: -reach - 6, hi: reach + 6, vz: 70, log: true });
    if (near(mx, my) < 400) { SFX.thud(); G.jumpShake = Math.max(G.jumpShake, .4); }
    for (let q = 0; q < 26; q++) addP({ t: 'dust', x: mx + tr.nx * (Math.random() - .5) * 60, y: my + tr.ny * (Math.random() - .5) * 60, vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 40, life: .9, ml: .9 });
  }
}

// ======================================================= event "kroko"

function initCrocs(T) {
  const ev = T.ev; ev.jgCrocsOn = true;
  ev.jgCrocs = T.jungle.crocs.map(([x, y], k) => ({ x, y, k, st: 0, u: 0, face: k % 2 ? 1 : -1 }));
  const R = T.jungle.fordR; ev.jgSwim = { x: (R[0] + R[2]) / 2, y: R[1], on: false, r: 8 };
}

function updateCrocs(T, dt) {
  const ev = T.ev;
  for (const cr of ev.jgCrocs) {
    const u = ((ev.t + cr.k * 1.7) % CROC.per + CROC.per) % CROC.per, was = cr.st, w0 = CROC.per - CROC.warn - CROC.open;
    // 0 a log in the water, 1 eyes and bubbles, 2 the jaw opens slowly, 3 snap
    cr.st = u < w0 ? 0 : u < CROC.per - CROC.open ? 1 : u < CROC.per - .08 ? 2 : 3; cr.u = u;
    if (cr.st === 3 && was !== 3) {
      if (near(cr.x, cr.y) < 300) SFX.snap();
      for (const c of G.cars) {
        if (c.fall > 0 || c.z > 0 || Math.hypot(c.x - cr.x, c.y - cr.y) > CROC.reach) continue;
        const dx = c.x - cr.x, dy = c.y - cr.y, d = Math.hypot(dx, dy) || 1;
        c.vx = dx / d * 60; c.vy = dy / d * 60; c.boost = 0; c.stun = CROC.stun; c.spin = (dx > 0 ? 1 : -1) * 6; if (!c.ai) SFX.crash();
      }
    }
  }
  // from lap 2 one crocodile swims across the ford every 10 s
  const R = T.jungle.fordR, s = ev.jgSwim, u = (ev.t % SWIM.every) / SWIM.dur;
  s.on = leadLap() >= 2 && u < 1; s.x = (R[0] + R[2]) / 2 + 6 + Math.sin(ev.t) * 4; s.y = R[1] + u * (R[3] - R[1]);
}

// ======================================================= event "steinkugel": the stone ball in the ball corridor

function initBall(T) { T.ev.jgBallOn = true; }

function updateBall(T, dt) {
  const ev = T.ev, J = T.jungle, N = T.N, P = G.player;
  // ready: the first car (lap 2 or later) that comes into the hall on the corridor side sets it off; a click and dust from the ceiling first
  if (!ev.jgBalls.length && !ev.jgQueue.length && ev.t >= ev.jgReady) {
    const car = G.cars.find(c => c.fall <= 0 && c.lap >= 2 && !c.finished && inRng(c.idx, J.iHall - 4, J.iHall + 14, N) && !(c.jgWay && c.jgWay.P === J.grotto));
    if (car) {
      ev.jgQueue.push(ev.t + .5); if (car.lap >= LAPS) ev.jgQueue.push(ev.t + .5 + BALL.second);
      if (near(car.x, car.y) < 360) SFX.click();
      for (let q = 0; q < 18; q++) addP({ t: 'dust', x: T.path[J.iHall].x + (Math.random() - .5) * 60, y: T.path[J.iHall].y + (Math.random() - .5) * 40, vx: 0, vy: 8, life: 1.2, ml: 1.2 });
    }
  }
  while (ev.jgQueue.length && ev.t >= ev.jgQueue[0]) { ev.jgQueue.shift(); ev.jgBalls.push({ s: (J.iHall - 18 + N) % N, x: 0, y: 0, rot: 0, st: 0, u: 0 }); }
  ev.jgAlarm = false;
  for (const b of ev.jgBalls) {
    if (b.st === 0) {
      b.s += BALL.v / 2 * dt; const i = Math.floor(b.s) % N, p = T.path[i]; b.x = p.x; b.y = p.y; b.rot += dt * 8;
      if (Math.random() < dt * 4 && near(b.x, b.y) < 300) SFX.roll();
      if (P && near(b.x, b.y) < 320) ev.jgAlarm = true;
      if (!inRng(i, J.iHall - 20, J.iS[1], N)) { b.st = 1; b.u = 0; b.x0 = b.x; b.y0 = b.y; }
    } else if (b.st === 1) { // off the end of the stairs into the basin
      const [qx, qy] = J.basin; b.u += dt / .45; b.x = b.x0 + (qx - b.x0) * Math.min(1, b.u); b.y = b.y0 + (qy - b.y0) * Math.min(1, b.u); b.rot += dt * 6;
      if (b.u >= 1) { b.st = 2; b.u = 0; if (near(qx, qy) < 360) { SFX.splash(.8); SFX.fountain(); } for (let q = 0; q < 30; q++) addP({ t: 'd', x: qx, y: qy, z: 2, vx: (Math.random() - .5) * 60, vy: (Math.random() - .5) * 60, vz: 60 + Math.random() * 80, col: ['#cfeef4', '#9edcf0', '#ffffff'][q % 3], s: 1, life: 1, ml: 1 }); }
    } else { b.u += dt; if (b.u > .6) b.st = 3; }
  }
  if (ev.jgBalls.length && ev.jgBalls.every(b => b.st === 3) && !ev.jgQueue.length) { ev.jgBalls.length = 0; ev.jgReady = ev.t + BALL.every; }
}

// cars and the stone ball (it flattens them), cars and the swimming crocodile (it pushes them away)
function jungleCollisions() {
  const ev = G.T.ev; if (!ev) return;
  for (const b of ev.jgBalls || []) {
    if (b.st > 1) continue;
    for (const c of G.cars) {
      if (c.fall > 0 || c.flatT > 0 || c.ghost > 0 || c.z > 0 || Math.hypot(c.x - b.x, c.y - b.y) > BALL.r + 4) continue;
      c.flatT = BALL.flat; c.stun = 0; c.boost = 0; c.vx = c.vy = 0; if (!c.ai) SFX.crash();
    }
  }
  const s = ev.jgSwim;
  if (s && s.on) for (const c of G.cars) {
    if (c.fall > 0 || c.z > 0) continue;
    const dx = c.x - s.x, dy = c.y - s.y, d = Math.hypot(dx, dy), mn = s.r + 9; if (d >= mn || !d) continue;
    const nx = dx / d, ny = dy / d, vn = c.vx * nx + c.vy * ny; c.x = s.x + nx * mn; c.y = s.y + ny * mn;
    if (vn < 0) { c.vx -= 1.5 * vn * nx; c.vy -= 1.5 * vn * ny; }
  }
}

// ======================================================= drawing

function drawCroc(x, y, f, st, u) {
  x = Math.round(x); y = Math.round(y);
  if (st === 0) { R1(x - 8, y - 2, 16, 4, '#2a3a1e'); R1(x - 6, y - 2, 3, 1, '#3a4a26'); return; } // (only the back: a log)
  if (st === 1) { // the eyes come up, bubbles
    R1(x - 10, y - 3, 20, 5, '#2a3a1e'); R1(x + f * 6 - 1, y - 3, 2, 2, '#ffe060'); R1(x + f * 9 - 1, y - 3, 2, 2, '#ffe060');
    for (let k = 0; k < 3; k++) { const ph = (G.time * 2 + k * .33) % 1; ctx.globalAlpha = 1 - ph; R1(x + f * 14 + k * 3 - 4, y - 2 - Math.round(ph * 6), 2, 2, '#cfe8d0'); }
    ctx.globalAlpha = 1; return;
  }
  R1(x - 12, y - 4, 24, 8, '#1b120c'); R1(x - 11, y - 3, 22, 6, '#3a6a2a'); for (let k = -9; k < 8; k += 3) R1(x + k, y - 3, 1, 1, '#2a4a1e');
  R1(x - f * 15 - (f > 0 ? 0 : 4), y - 1, 5, 2, '#3a6a2a'); // (tail)
  const hx = x + f * 12, o = st === 3 ? 1 : clamp((u - (CROC.per - CROC.open)) / CROC.open, 0, 1), gap = Math.round(1 + o * 4);
  R1(hx - (f > 0 ? 0 : 8), y - 2 - gap, 9, 3, '#3a6a2a'); R1(hx - (f > 0 ? 0 : 8), y + gap - 1, 9, 3, '#3a6a2a');
  if (gap > 1) { R1(hx - (f > 0 ? 0 : 8), y - gap + 1, 9, gap * 2 - 2, '#c83a3a'); for (let k = 0; k < 8; k += 2) { R1(hx + f * k, y - gap + 1, 1, 1, '#ffffff'); R1(hx + f * k, y + gap - 2, 1, 1, '#ffffff'); } }
  R1(x + f * 9, y - 4, 2, 1, '#ffe060');
}

// on the ground: the swamp bubbles, crocodiles, fallen trunks, the shadows of falling trees and of the liana, the current in the ford, the camp fire,
// the foam under the waterfall and in the basin
function drawJungleGround() {
  const T = G.T, J = T.jungle, ev = T.ev, k = Math.floor(G.time * 3);
  for (let q = 0; q < 10 && J.swampPix.length; q++) { const p = J.swampPix[(hash(q, k, 114) * J.swampPix.length) | 0]; if (inView(p % T.W, (p / T.W) | 0)) R1(p % T.W, (p / T.W) | 0, 2, 2, '#8aa83a'); }
  for (const [qx, qy, qr] of J.quick) if (inView(qx, qy)) { const ph = (G.time * 1.3 + qx) % 1; ctx.globalAlpha = 1 - ph; disc(Math.round(qx + Math.sin(qx + Math.floor(G.time * 1.3)) * qr * .5), Math.round(qy), Math.round(1 + ph * 3), '#6a8a3a'); ctx.globalAlpha = 1; }
  // the ford: lines of the current running downstream
  const R = J.fordR;
  if (inView((R[0] + R[2]) / 2, (R[1] + R[3]) / 2, 120)) {
    ctx.fillStyle = 'rgba(220,250,240,.5)';
    for (let q = 0; q < 24; q++) { const x = R[0] + hash(q, 1, 115) * (R[2] - R[0]), y = R[1] + ((G.time * 40 + hash(q, 2, 115) * (R[3] - R[1])) % (R[3] - R[1])), j = (y | 0) * T.W + (x | 0); if (T.ter[j] === FORD) ctx.fillRect(Math.round(x), Math.round(y), 1, 4); }
  }
  // foam where the waterfall falls into its pool
  const [wx, wy] = J.falls;
  if (inView(wx, wy + 30, 60)) for (let q = 0; q < 14; q++) { const a = hash(q, 7, 119) * TAU, r = 6 + ((G.time * 14 + q * 3) % 18); ctx.globalAlpha = 1 - r / 24; R1(Math.round(wx + Math.cos(a) * r), Math.round(wy + 30 + Math.sin(a) * r * .5), 2, 1, '#ffffff'); ctx.globalAlpha = 1; }
  // the liana's shadow on the road: you see from afar where it is
  const [lx] = J.liana, gy = J.gorge.y, ex = lx + J.lianaA * LIANA.reach;
  if (inView(lx, gy, 80)) { ctx.globalAlpha = .3; ell(Math.round(ex), Math.round((J.gorge.lane[0] + J.gorge.lane[1]) / 2 + 6), 8, 4, '#000'); ctx.globalAlpha = 1; }
  if (ev) {
    for (const cr of ev.jgCrocs || []) if (inView(cr.x, cr.y)) drawCroc(cr.x, cr.y, cr.face, cr.st, cr.u);
    const s = ev.jgSwim;
    if (s && s.on && inView(s.x, s.y)) { ctx.save(); ctx.translate(Math.round(s.x), Math.round(s.y)); ctx.rotate(Math.PI / 2); drawCroc(0, 0, 1, 2, CROC.per - CROC.open); ctx.restore(); }
    for (const L of ev.jgLogs || []) if (inView(L.x, L.y, 60)) {
      ctx.save(); ctx.translate(Math.round(L.x), Math.round(L.y)); ctx.rotate(Math.atan2(L.ny, L.nx));
      const h = L.half;
      ctx.globalAlpha = .35; R1(-h - 12, 3, 2 * h + 26, 4, '#000'); ctx.globalAlpha = 1;
      R1(-h - 14, -5, 2 * h + 28, 10, '#3e2a16'); R1(-h - 13, -4, 2 * h + 26, 8, '#7a5430'); R1(-h - 13, -4, 2 * h + 26, 2, '#9a7040');
      for (let q = -h; q < h; q += 7) R1(q, -3, 1, 6, '#5a3e22');
      R1(h + 10, -5, 4, 10, '#c9a066'); R1(h + 11, -2, 2, 4, '#9a7040');
      ctx.restore();
    }
    for (const tr of ev.jgTrees || []) {
      if (tr.st !== 1 || !inView(tr.bx, tr.by, 80)) continue;
      const reach = (tr.half + 12) * 2 * (tr.creak ? .3 + .2 * Math.sin(G.time * 4) : tr.p);
      ctx.globalAlpha = .3; for (let s2 = 0; s2 < reach; s2 += 2) ell(Math.round(tr.bx + tr.nx * s2 + 4), Math.round(tr.by + tr.ny * s2 + 4), 3, 3, '#000'); ctx.globalAlpha = 1;
    }
    // the basin: rings where the ball went down
    for (const b of ev.jgBalls || []) if (b.st === 2 && inView(b.x, b.y)) { ctx.strokeStyle = 'rgba(255,255,255,' + (1 - b.u / .6) + ')'; ctx.beginPath(); ctx.ellipse(b.x, b.y, 4 + b.u * 30, 2 + b.u * 15, 0, 0, TAU); ctx.stroke(); }
  }
  // the camp fire and the explorer (he runs off when the stone ball comes down the stairs)
  const C = J.camp;
  if (inView(C.fire.x, C.fire.y)) {
    const f = ((G.time * 10) | 0) % 2; R1(C.fire.x - 2, C.fire.y - 3 - f, 5, 4, '#ff7a1a'); R1(C.fire.x - 1, C.fire.y - 4 - f, 3, 3, '#ffd04a');
    if (Math.random() < .2) addP({ t: 'smoke', x: C.fire.x, y: C.fire.y - 6, vx: 4, vy: -14, life: 1.4, ml: 1.4 });
    const run = ev && ev.jgBalls && ev.jgBalls.some(b => b.st < 2), mx = Math.round(C.man.x + (run ? Math.sin(G.time * 3) * 18 : 0)), my = Math.round(C.man.y), leg = ((G.time * (run ? 14 : 2)) | 0) % 2;
    R1(mx - 1, my - 7, 3, 5, '#c8b070'); R1(mx - 2, my - 9, 5, 2, '#e8d8a0'); R1(mx - 1, my - 2, 1, 2 + leg, '#5a4a2a'); R1(mx + 1, my - 2, 1, 3 - leg, '#5a4a2a');
  }
}

// above the cars: the liana, standing and falling trees, the stone ball, the temple (roof from outside, dark inside), the canopy (see-through round your car),
// the waterfall with its spray and a rainbow, monkeys, parrots, mist over the swamp, warning triangles
let leaves = null;
function drawJungleAbove(cx, cy) {
  const T = G.T, J = T.jungle, ev = T.ev, P = G.player;
  // the waterfall: white streaks falling off the edge of the table mountain, spray and a little rainbow in it
  const [wx, wy] = J.falls;
  if (inView(wx, wy, 80)) {
    for (let q = 0; q < 26; q++) { const x = wx - 12 + hash(q, 1, 120) * 24, y = wy - 40 + ((G.time * 120 + hash(q, 2, 120) * 70) % 70); R1(Math.round(x), Math.round(y), 1, 5, q % 3 ? '#e8f6fa' : '#9edcf0'); }
    ctx.globalAlpha = .18; for (let q = 0; q < 5; q++) ell(Math.round(wx + Math.sin(G.time + q) * 10), Math.round(wy + 26 + q * 3), 22 - q * 3, 8, '#ffffff');
    const rb = ['#ff4d4d', '#ffb340', '#ffe94d', '#5ed35e', '#4da6ff', '#9a6bff'];
    ctx.globalAlpha = .22; rb.forEach((col, k) => { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(wx, wy + 44, 30 - k, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }); ctx.globalAlpha = 1;
    if (P && Math.random() < .05 && near(wx, wy) < 280) SFX.rush();
  }
  // the liana: a thick vine from a branch over the gorge; a car that swings on it hangs at its end
  const [ax, ay] = J.liana, flying = G.cars.find(c => c.z > 0 && c.jgRide);
  for (const c of G.cars) if (c.z > 0 && Math.abs(c.x - ax) < 70 && Math.abs(c.y - J.gorge.y) < 50 && c.air < .9) c.jgRide = true; else if (c.z <= 0) c.jgRide = false;
  if (inView(ax, ay, 80)) {
    const ex = flying ? flying.x : ax + J.lianaA * LIANA.reach, ey = flying ? flying.y - flying.z * .6 : (J.gorge.lane[0] + J.gorge.lane[1]) / 2 - 6;
    ctx.fillStyle = '#3a6a1e'; for (let s = 0; s <= 1; s += .02) { const x = ax + (ex - ax) * s + Math.sin(s * Math.PI) * 4, y = ay + (ey - ay) * s; ctx.fillRect(Math.round(x), Math.round(y), 2, 2); if ((s * 50 | 0) % 7 === 0) R1(Math.round(x) + 2, Math.round(y), 3, 2, '#5aa83e'); }
    R1(ax - 24, ay - 4, 48, 6, '#4e3418'); R1(ax - 24, ay - 4, 48, 2, '#7a5430');
  }
  // standing rotten trees (they shake when they creak) and falling ones
  if (ev) for (const tr of ev.jgTrees || []) {
    if (tr.st === 2 || !inView(tr.bx, tr.by, 90)) continue;
    const ang = tr.p * Math.PI / 2, sh = tr.creak ? Math.sin(G.time * 30) * 1.5 : 0, L = (tr.half + 12) * 2;
    const ex = tr.bx + tr.nx * L * Math.sin(ang), ey = tr.by + tr.ny * L * Math.sin(ang) - (1 - Math.sin(ang)) * 28;
    ctx.strokeStyle = '#3e2a16'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(tr.bx, tr.by); ctx.lineTo(ex + sh, ey); ctx.stroke();
    ctx.strokeStyle = '#7a5430'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(tr.bx, tr.by); ctx.lineTo(ex + sh, ey); ctx.stroke(); ctx.lineWidth = 1;
    disc(Math.round(ex + sh), Math.round(ey), 12, '#0e2e12'); disc(Math.round(ex + sh), Math.round(ey), 11, '#4a6a2a'); disc(Math.round(ex + sh - 3), Math.round(ey - 3), 6, '#6a8a3a');
  }
  // the temple: opaque from outside; inside see-through and dark (torches, car lamps, the light shaft over the waterfall)
  const tp = J.temple;
  if (tp && inView(tp.x + tp.W / 2, tp.y + tp.H / 2, tp.W)) {
    if (J.inTemple) {
      darkRect(cx, cy, tp, .9, tp.torches, [tp.fall]);
      for (const t2 of tp.torches) { if (!inView(t2.x, t2.y, 8)) continue; const x = Math.round(t2.x), y = Math.round(t2.y), f = ((G.time * 10 + t2.k) | 0) % 2; R1(x - 1, y, 2, 4, '#5a3a1c'); R1(x - 1, y - 3 - f, 3, 3, '#ffb22e'); R1(x, y - 2 - f, 1, 2, '#fff1a8'); }
      // the waterfall in the grotto (light and water falling through a hole in the roof)
      const { x: fx, y: fy } = tp.fall;
      ctx.globalAlpha = .25; ctx.fillStyle = '#fff6c8'; ctx.fillRect(fx - 10, fy - 40, 20, 46); ctx.globalAlpha = 1;
      for (let q = 0; q < 14; q++) R1(Math.round(fx - 9 + hash(q, 1, 116) * 18), Math.round(fy - 30 + ((G.time * 80 + q * 9) % 36)), 1, 3, q % 2 ? '#ffffff' : '#9edcf0');
      // the ball hangs ready under the ceiling of the hall (pulled up on its rope while it is not)
      if (ev && ev.jgBallOn) { const p = T.path[J.iHall], up = ev.jgBalls.length ? 0 : clamp(1 - (ev.jgReady - ev.t) / BALL.every, 0, 1); if (up > 0) { const by = Math.round(p.y - 46 + up * 18); R1(Math.round(p.x), Math.round(p.y - 70), 1, by - Math.round(p.y - 70), '#8a7a5a'); disc(Math.round(p.x), by, 9, '#5a6052'); disc(Math.round(p.x - 2), by - 2, 4, '#9a9e8c'); } }
    } else ctx.drawImage(tp.c, tp.x, tp.y);
  }
  // the stone ball (over the dark, it is lit by the lamps of the cars behind it)
  for (const b of ev && ev.jgBalls || []) {
    if (b.st > 1 || !inView(b.x, b.y)) continue;
    if (!J.inTemple && b.x > tp.x && b.x < tp.x + tp.W && b.y > tp.y && b.y < tp.y + tp.H) continue;
    ctx.globalAlpha = .3; ell(Math.round(b.x + 4), Math.round(b.y + 6), 14, 6, '#000'); ctx.globalAlpha = 1;
    disc(Math.round(b.x), Math.round(b.y), 14, '#3a3e34'); disc(Math.round(b.x), Math.round(b.y), 13, '#8a9080'); disc(Math.round(b.x - 4), Math.round(b.y - 4), 5, '#a8ae9c');
    for (let q = 0; q < 3; q++) R1(Math.round(b.x + Math.cos(b.rot + q * 2) * 8), Math.round(b.y + Math.sin(b.rot + q * 2) * 8), 3, 1, '#5a6052');
  }
  // the canopy: leaves over everything, a hole round your own car when you drive under it; flecks of sun, fireflies in the hole
  const C = J.canopy;
  if (inView(C.x + C.W / 2, C.y + C.H / 2, C.W)) {
    if (J.under && P) {
      const g = (leaves && leaves.width === C.W ? leaves : (leaves = mk(C.W, C.H))).getContext('2d');
      g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, C.W, C.H); g.drawImage(C.c, 0, 0);
      g.globalCompositeOperation = 'destination-out';
      for (const [r, a] of [[74, .35], [64, .5], [54, 1]]) { g.fillStyle = 'rgba(0,0,0,' + a + ')'; g.beginPath(); g.arc(P.x - C.x, P.y - C.y, r, 0, TAU); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      ctx.drawImage(leaves, C.x, C.y);
      for (let q = 0; q < 24; q++) { const a = hash(q, 1, 121) * TAU + G.time * (.3 + hash(q, 2, 121) * .4), r = 12 + hash(q, 3, 121) * 46; if (((G.time * 2 + q) | 0) % 3 === 0) continue; R1(Math.round(P.x + Math.cos(a) * r), Math.round(P.y + Math.sin(a * 1.3) * r), 1, 1, '#e8ff7a'); }
    } else ctx.drawImage(C.c, C.x, C.y);
    for (let q = 0; q < 30; q++) { const x = C.x + hash(q, 1, 117) * C.W + Math.sin(G.time + q) * 3, y = C.y + hash(q, 2, 117) * C.H; if (!J.under || !P || Math.hypot(x - P.x, y - P.y) > 74) R1(Math.round(x), Math.round(y), 2, 1, '#9ad86a'); }
  }
  // monkeys in the crowns at the edge (they wave, one swings), only on the screen
  for (const [mx, my] of J.monkeys) if (inView(mx, my, 20)) {
    const w = ((G.time * 3 + mx) | 0) % 2, sw = Math.round(Math.sin(G.time * 1.5 + my) * 3);
    R1(mx - 3 + sw, my - 3, 6, 6, '#6a4220'); R1(mx - 2 + sw, my - 6, 5, 4, '#8a5a2c'); R1(mx - 1 + sw, my - 5, 3, 2, '#d8b080'); R1(mx + 3 + sw, my - 6 - w * 3, 2, 4, '#6a4220'); R1(mx - 5 + sw, my + 2, 2, 5, '#6a4220');
  }
  for (const p of G.parts) if (p.t === 'parrot') { const w = ((G.time * 12 + p.ph) | 0) % 2; R1(Math.round(p.x) - 1, Math.round(p.y), 3, 3, p.col); R1(Math.round(p.x) - 3, Math.round(p.y) - w, 2, 1, p.col); R1(Math.round(p.x) + 2, Math.round(p.y) - w, 2, 1, p.col); }
  // mist over the swamp (only the swamp, never the line)
  if (inView(620, 860, 160)) { ctx.globalAlpha = .1; for (let q = 0; q < 7; q++) ell(Math.round(560 + q * 30 + Math.sin(G.time * .3 + q) * 20), Math.round(900 + Math.sin(q * 2.1) * 30), 34, 10, '#e8f0e0'); ctx.globalAlpha = 1; }
  // a toucan on the signposts
  const [gx, gy] = J.signs;
  if (inView(gx, gy)) { R1(gx + 13, gy - 6, 5, 6, '#141414'); R1(gx + 13, gy - 4, 3, 2, '#f8f0e0'); R1(gx + 17, gy - 5, 5, 2, '#ff9a20'); R1(gx + 21, gy - 4, 1, 1, '#d83a2a'); }
  // warning triangles (no text): a tree about to fall, the stone ball behind you
  if (ev) {
    for (const tr of ev.jgTrees || []) if (tr.st === 1 && tr.creak && P && Math.hypot(tr.bx - P.x, tr.by - P.y) < 340) warnAt(tr.bx, tr.by, cx, cy);
    for (const b of ev.jgBalls || []) if (b.st === 0 && P && J.inTemple || (b.st === 0 && P && Math.hypot(b.x - P.x, b.y - P.y) < 300)) warnAt(b.x, b.y, cx, cy);
  }
}

// a car that misses the log: the river carries it a little way down the gorge
function drawJungleFall(c, F, lv) {
  if (c.fallKind !== 'abyss') return false;
  const t = (c.fallT0 - c.fall) / c.fallT0; if (t > .7) return true;
  const S = Math.max(4, Math.round(SS * (1 - t * .9))), x = c.fx0 + Math.sin(t * 9) * 3, y = c.fy0 + t * 70;
  ctx.globalAlpha = 1 - t; ctx.drawImage(F.frames[lv][((t * 20) | 0) % F.frames[lv].length], Math.round(x - S / 2), Math.round(y - S / 2), S, S); ctx.globalAlpha = 1;
  if (Math.random() < .3) splash(x, y, 2);
  return true;
}

// on the screen: the inside of the temple is a little darker overall (the light map does the rest)
function drawJungleSky() {
  if (G.T.jungle.inTemple) { ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, 0, VW, VH); }
}

// ---------- hooks: how the core calls this track (hooks.js; what each hook does: _template.js) ----------
/** @type {import('./_template.js').TrackHooks} */
export const jungleHooks = {
  init: initJungle, events: { baeume: initTrees, kroko: initCrocs, steinkugel: initBall }, update: jungleUpdate, collisions: jungleCollisions,
  surf: jungleSurf, target: jungleTarget, lane: jungleLane, throttle: jungleThrottle,
  stuck(c, dt) { if (!(c.flatT > 0)) return false; jungleStuck(c, dt); return true; },
  ground: jungleGround, drawGround: drawJungleGround, drawAbove: drawJungleAbove, drawSky: drawJungleSky, drawFall: drawJungleFall, noBeams: () => !!G.T.jungle.inTemple,
};
