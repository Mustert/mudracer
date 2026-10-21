import { G } from './g.js';
import { noise, voice } from './audio.js';
import { MUD_A, MUD_B, clamp, ctx } from './core.js';
import { R1, disc, ell } from './gfx.js';
import { addP } from './particles.js';
import { near } from './trackfx.js';
import { nearestIdx } from './bau.js';

// ---------- Strand while racing: the beach volleyball court (Rev 3) and the sea ----------
// Always (not an event): four players play over the net. Every ball changes sides; now and then one of them smashes it down onto the lane.
// The shadow on the sand shows where it comes down (principle 9). A ball that is low hits a car: it is thrown aside and slowed down, the ball
// flies on to the other side. The net across the lane brakes every car once (it bulges and swishes). The court sand beside the lane is slow.
// The sea (the beach at the bottom and everything the flood covers) brakes a little more than a puddle; it still washes.
// Computer cars take the short cut now and then (more often on SCHWER and when the pier is flooded). Fields in T.ev start with bv (T22).

const BALL = { pass: 1.3, passUp: 30, spike: .85, spikeUp: 20, spikeP: .35, hitZ: 12, hitR: 11, rest: 1 };
const SKIN = ['#f1c27d', '#c68642', '#8d5524', '#ffdbac'], SUIT = ['#e84a5f', '#2e86de', '#ffd93d', '#6bcb77'], HAIR = ['#3b2512', '#f2d16b', '#1b120c', '#a0522d'];

const loud = (x, y) => clamp(1 - near(x, y) / 300, 0, 1);
const SX = {
  // the ball is played: a dull pock
  pock: v => { if (v > .05) { voice({ f: 520, to: 260, a: .002, d: .07, vol: .2 * v }); noise({ type: 'bandpass', f: 1400, d: .05, vol: .1 * v }); } },
  // a car is hit: a rubbery boing and a cheer
  hit: v => { if (v > .05) { voice({ type: 'triangle', f: 380, to: 900, a: .004, d: .16, vol: .22 * v }); noise({ type: 'bandpass', f: 1800, to: 900, t: .1, a: .05, hold: .2, d: .3, vol: .07 * v, q: .8 }); } },
  // through the net: a swish
  net: v => { if (v > .05) noise({ type: 'highpass', f: 2600, to: 1200, a: .01, d: .22, vol: .12 * v }); },
};

function initBeach(T) {
  const B = T.beach, [cx, cy, hw, hh] = B.court, ev = T.ev;
  const side = [-1, -1, 1, 1], dy = [-1, 1, -1, 1];
  ev.bvPl = side.map((s, k) => {
    const hx = cx + s * hw * .55, hy = cy + dy[k] * (B.half + (hh - B.half) * .55);
    return { hx, hy, x: hx, y: hy, s, jump: 0, k };
  });
  ev.bvNet = 0; ev.bvNetY = cy; ev.obst = ev.obst || [];
  B.inI = nearestIdx(T.path, B.way[0].x, B.way[0].y); B.outI = nearestIdx(T.path, B.way[B.way.length - 1].x, B.way[B.way.length - 1].y);
  ev.bvBall = null; serve(T, ev.bvPl[0]);
}

// the ball leaves (x, y) to the other side: a pass to a player or a smash onto the lane
function shoot(T, x, y, to, spike) {
  const ev = T.ev, B = T.beach, [cx, cy] = B.court, s = Math.sign(cx - x) || 1;
  let tx, ty, pl = null;
  if (spike) { tx = cx + s * (12 + Math.random() * 44); ty = cy + (Math.random() - .5) * B.half; }
  else { pl = to || ev.bvPl.filter(p => p.s === s)[(Math.random() * 2) | 0]; tx = pl.hx; ty = pl.hy; }
  ev.bvBall = { x0: x, y0: y, x1: tx, y1: ty, x, y, z: 6, t: 0, dur: spike ? BALL.spike : BALL.pass, up: spike ? BALL.spikeUp : BALL.passUp, pl, spike, rest: 0 };
  ev.obst = (ev.obst || []).filter(o => !o.bv);
  if (spike) ev.obst.push({ x: tx, y: ty, bv: true });
  SX.pock(loud(x, y));
}

function serve(T, p) { p.jump = .35; shoot(T, p.x, p.y - 4, null, false); }

function beachUpdate(T, dt) {
  const ev = T.ev, b = ev.bvBall, B = T.beach; if (!b) return;
  ev.bvNet = Math.max(0, ev.bvNet - dt);
  for (const p of ev.bvPl) {
    p.jump = Math.max(0, p.jump - dt);
    // the players of the side the ball flies to walk to where it comes down (not onto the lane)
    const goal = b.rest <= 0 && p.s === Math.sign(b.x1 - B.court[0]) && (!b.pl || b.pl === p) ? [b.x1, p.hy] : [p.hx, p.hy];
    p.x += clamp(goal[0] - p.x, -40 * dt, 40 * dt); p.y += clamp(goal[1] - p.y, -40 * dt, 40 * dt);
  }
  if (b.rest > 0) {
    // the ball lies on the lane after a smash; then the nearest player of that side fetches it and plays on
    b.rest -= dt;
    if (b.rest <= 0) { const s = Math.sign(b.x - B.court[0]) || 1, p = ev.bvPl.filter(q => q.s === s).sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))[0]; serve(T, p); }
    return;
  }
  b.t += dt / b.dur;
  const t = Math.min(1, b.t);
  b.x = b.x0 + (b.x1 - b.x0) * t; b.y = b.y0 + (b.y1 - b.y0) * t; b.z = 6 * (1 - t) + b.up * 4 * t * (1 - t) + (b.pl ? 6 * t : 0);
  // a low ball hits a car on the lane
  if (b.z < BALL.hitZ) for (const c of G.cars) {
    if (c.z > 0 || c.fall > 0 || (c.bvT || 0) > G.time) continue;
    const dx = c.x - b.x, dy = c.y - b.y, d = Math.hypot(dx, dy); if (d > BALL.hitR) continue;
    const bx = b.x1 - b.x0, by = b.y1 - b.y0, bl = Math.hypot(bx, by) || 1;
    c.vx = c.vx * .4 + bx / bl * 70; c.vy = c.vy * .4 + by / bl * 70; c.stun = .5; c.spin = (Math.random() < .5 ? -1 : 1) * 7; c.bvT = G.time + 1.5;
    SX.hit(c.ai ? loud(c.x, c.y) * .6 : 1);
    for (let q = 0; q < 8; q++) addP({ t: 'd', x: c.x, y: c.y, z: 4, vx: (Math.random() - .5) * 60, vy: (Math.random() - .5) * 60, vz: 40 + Math.random() * 30, col: ['#f3dc9e', '#ffffff', '#e0be82'][q % 3], s: 1, life: .5, ml: .5 });
    shoot(T, b.x, b.y, null, false);
    return;
  }
  if (t < 1) return;
  if (b.spike) { b.rest = BALL.rest; b.z = 0; ev.obst = ev.obst.filter(o => !o.bv); SX.pock(loud(b.x, b.y) * .6); return; }
  // a player gets the ball: now and then a smash, else a pass over the net
  b.pl.jump = .35; shoot(T, b.pl.x, b.pl.y - 4, null, Math.random() < BALL.spikeP);
}

// the ground of the court and the sea (terrain codes 50-52, see strandmap.js; 3 where the sea is)
function beachSurf(c) {
  const T = G.T, m = c.def.mud;
  if (c.surf === 50) return [.84, 7, .95];
  if (c.surf === 51) return [.6, 6, .8];
  if (c.surf === 52) return [MUD_A + MUD_B * m, 2.4 * m, Math.min(.8, .55 * m)];
  if (c.surf === 3) {
    const x = clamp(c.x | 0, 0, T.W - 1), j = clamp(c.y | 0, 0, T.H - 1) * T.W + x;
    if ((T.flooded && T.flooded[j]) || c.y >= (T.shoreY0 || T.shoreY)[x]) return [.6, 1.3, .6];
  }
  return null;
}

// the net: every car is braked once when it drives through
function beachGround(c, j, sp, dt) {
  if (c.surf !== 51 || (c.bvNetT || 0) > G.time) return;
  c.bvNetT = G.time + .6; c.vx *= .5; c.vy *= .5;
  G.T.ev.bvNet = .5; G.T.ev.bvNetY = c.y;
  SX.net(c.ai ? loud(c.x, c.y) * .6 : 1);
}

// computer cars: now and then the short cut over the court (decided once per lap, shortly before it), then along the lane
function beachTarget(c) {
  const T = G.T, B = T.beach, N = T.N; if (G.state !== 'race' && G.state !== 'finish') { c.bvWay = null; return null; }
  if (!c.bvWay) {
    const ahead = (B.inI - c.idx + N) % N, past = (c.idx - B.inI + N) % N, P = B.way;
    if (c.bvLap !== c.lap && ahead < 60) {
      c.bvLap = c.lap;
      const p = [.15, .3, .45][G.raceDiff || 0] + (T.ev.flood ? .25 : 0), h = Math.abs(Math.sin(c.seed * 12.9898 + c.lap * 78.233) * 43758.5453) % 1;
      c.bvGo = B.force ?? h < p; // (B.force: true/false for every car, to compare both ways in the dev server)
    }
    if (!c.bvGo || !(ahead < 20 || (past < 20 && Math.hypot(c.x - P[0].x, c.y - P[0].y) < 50))) return null;
    c.bvWay = { k: 0 }; c.bvGo = false;
  }
  const W = c.bvWay, P = B.way; let k = W.k, bd = 1e9;
  for (let q = W.k; q < Math.min(P.length, W.k + 30); q++) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  W.k = k;
  if (k >= P.length - 4 || bd > 60 * 60) { c.bvWay = null; return null; }
  const t = P[Math.min(P.length - 1, k + 9)];
  return [t.x, t.y];
}

function drawPlayer(p, ev) {
  const x = Math.round(p.x), up = p.jump > 0 ? Math.round(Math.sin(p.jump / .35 * Math.PI) * 5) : 0, y = Math.round(p.y) - up, k = p.k, O = '#3a2a1a';
  ctx.globalAlpha = .25; ell(x, Math.round(p.y) + 6, 5, 2, '#000'); ctx.globalAlpha = 1;
  const walk = ((G.time * 6 + k) | 0) % 2 && !up && Math.hypot(p.x - p.hx, p.y - p.hy) > 1;
  // legs, swimsuit, arms (up while the player plays the ball), head with hair; a dark outline so they stand out on the light sand
  R1(x - 3, y + 1, 2, 5 - (walk ? 1 : 0), SKIN[k]); R1(x + 1, y + 1, 2, 5 - (walk ? 0 : 1), SKIN[k]);
  R1(x - 4, y - 5, 8, 7, O); R1(x - 3, y - 4, 6, 5, SUIT[k]);
  if (up || (ev.bvBall && ev.bvBall.pl === p && ev.bvBall.t > .8)) { R1(x - 5, y - 11, 2, 7, SKIN[k]); R1(x + 3, y - 11, 2, 7, SKIN[k]); }
  else { R1(x - 5, y - 4, 2, 5, SKIN[k]); R1(x + 3, y - 4, 2, 5, SKIN[k]); }
  R1(x - 3, y - 11, 6, 6, O); R1(x - 2, y - 10, 4, 4, SKIN[k]); R1(x - 2, y - 11, 4, 2, HAIR[k]);
}

function drawBeachGround() {
  const ev = G.T.ev; if (!ev || !ev.bvPl) return;
  for (const p of ev.bvPl) drawPlayer(p, ev);
  const b = ev.bvBall; if (!b) return;
  // the shadow of the ball: the lower it is, the bigger and darker (a smash comes down where it is)
  const s = clamp(1 - b.z / 40, .3, 1);
  ctx.globalAlpha = .18 + .3 * s * (b.spike ? 1 : .6); ell(Math.round(b.x), Math.round(b.y) + 1, Math.round(3 + 2 * s), Math.round(1 + 1.5 * s), '#2a1e0c'); ctx.globalAlpha = 1;
}

function drawBeachAbove() {
  const ev = G.T.ev; if (!ev || !ev.bvBall) return;
  const B = G.T.beach, [cx] = B.court;
  // the net bulges where a car went through
  if (ev.bvNet > 0) { const a = ev.bvNet / .5, w = Math.round(3 * a); ctx.globalAlpha = .8 * a; for (let dy = -6; dy <= 6; dy++) R1(cx + Math.round(Math.cos(dy / 6 * Math.PI / 2) * w), Math.round(ev.bvNetY) + dy, 1, 1, dy % 2 ? '#2b2f38' : '#ffffff'); ctx.globalAlpha = 1; }
  const b = ev.bvBall, x = Math.round(b.x), y = Math.round(b.y - b.z);
  disc(x, y, 4, '#3a2a1a'); disc(x, y, 3, '#ffffff'); R1(x - 3, y, 7, 2, '#ffd93d'); R1(x, y - 3, 2, 7, '#2e86de'); R1(x - 1, y - 2, 1, 1, '#ffffff');
}

export const strandHooks = { init: initBeach, update: beachUpdate, surf: beachSurf, ground: beachGround, target: beachTarget, drawGround: drawBeachGround, drawAbove: drawBeachAbove };
