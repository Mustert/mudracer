import { G } from './g.js';
import { SFX } from './audio.js';
import { LAPS, SS, TAU, VH, VW, angDiff, clamp, ctx, hash, vnoise } from './core.js';
import { R1, disc, ell, text } from './gfx.js';
import { dirHeld } from './input.js';
import { addP, splash } from './particles.js';
import { cam } from './state.js';
import { inView, near } from './trackfx.js';
import { snap } from './undo.js';
import { LIFT, POWDER, RIM } from './icemap.js';

// ---------- Eis Rev 2 while racing (plaene/EIS_REV2.md): the chair lift (every car that reaches the line is hooked on at once, no waiting: its own chair the moment it
// arrives), the chess players, powder snow behind the cars, a crooked landing after the ski jump snows the car in, the foehn, the progress through the wood and the serpentines
// (parts of the centre line lie close together), the polar light in the last lap.
// Event "schneeball": every 8 to 14 s (lap 2: 5 to 8 s, lap 3: 3 to 5 s) a snowball comes loose from the rock face above the serpentines and rolls straight down over all the legs, growing and hopping over the cliffs;
// who it hits is snowed in until shaken free.
// Event "eisbruch": the big lake cracks under the cars and breaks (see below); the holes stay open. ----------

// the computer cars steer round the pines near them: only those within 90 px of a car go into T.ev.obst (steerAround, physics.js), not the whole wood
function iceUpdate(T, dt) {
  const ev = T.ev, I = T.ice;
  const mv = Math.floor(G.time / 2.4); if (mv !== ev.iceMove) { ev.iceMove = mv; if (I.chess && near(I.chess[0], I.chess[1]) < 300) SFX.tock(); }
  const out = [];
  for (const o of I.trees) for (const c of G.cars) if (c.ai && Math.abs(c.x - o.x) < 90 && Math.abs(c.y - o.y) < 90) { out.push(o); break; }
  if (ev.iceBalls) for (const b of ev.iceBalls) if (b.on) out.push({ x: b.bx, y: b.y, r: b.r + 4 });
  ev.obst = out;
  if (ev.iceBallOn) ballsUpdate(T, dt);
  if (ev.iceBreakOn) breakUpdate(T, dt);
}

// ======================================================= event "eisbruch"

// The lake is a grid of 16 px cells. Every car that drives into a cell of the lake ice counts once; when a cell has been crossed BREAK times it cracks and, as soon as
// the car has left it, breaks open: a hole of deep water (you fall in) that stays open for the rest of the race. BREAK grows with the field (1 car or 2: once, 3: twice,
// 10: six times) so that the lake gets full of holes about equally fast whatever the size of the field. Never breaks: the rim of the lake (RIM px, thick ice), a cell when more
// than 45 % of the lake would be open, a cell that would close the last free way across the lake (checked on the cells).
const CELL = 16;
const breakN = () => Math.max(1, Math.round(1 + (G.cars.length - 2) * .625));

function initBreak(T) {
  const ev = T.ev, I = T.ice, [lx, ly, rx, ry, rt = ry] = I.lake, cells = new Map(); let interior = 0;
  for (let cy = Math.floor((ly - rt) / CELL); cy <= Math.ceil((ly + ry) / CELL); cy++) for (let cx = Math.floor((lx - rx) / CELL); cx <= Math.ceil((lx + rx) / CELL); cx++) {
    const x = (cx + .5) * CELL, y = (cy + .5) * CELL, j = (y | 0) * T.W + (x | 0);
    if (x < 0 || y < 0 || x >= T.W || y >= T.H || !I.lakeM[j]) continue;
    const elig = I.lakeD[j] >= RIM + 6;
    cells.set(cy * 100 + cx, { k: cy * 100 + cx, x, y, n: 0, hole: false, pend: null, elig, risky: false });
    if (elig) interior++;
  }
  ev.iceBreakOn = true; ev.iceLake = { cells, interior, maxOpen: Math.floor(interior * .45), open: 0, holes: [], pend: [], risky: [], snapped: false };
}

// the ice a car can safely drive on: cells that are not holes and have no hole in the four cells next to them (a car is 18 px wide and slides on ice, so a way between two
// holes one cell apart is no way); cand = a cell that is about to become a hole
function safeCells(L, cand) {
  const E = new Map();
  for (const C of L.cells.values()) {
    if (C.hole || C === cand) continue;
    let ok = true;
    for (const d of [1, -1, 100, -100]) { const N2 = L.cells.get(C.k + d); if (N2 && (N2.hole || N2 === cand)) { ok = false; break; } }
    if (ok) E.set(C.k, C);
  }
  return E;
}

// is there still a safe way from the west end of the lake to its east end, if this cell becomes a hole too?
function wayAcross(L, cand) {
  const [lx, , rx] = G.T.ice.lake, E = safeCells(L, cand), seen = new Set(), todo = [];
  for (const C of E.values()) if (C.x < lx - rx + 40) { seen.add(C.k); todo.push(C); }
  while (todo.length) {
    const C = todo.pop(); if (C.x > lx + rx - 40) return true;
    for (const d of [1, -1, 100, -100, 101, 99, -101, -99]) { const N2 = E.get(C.k + d); if (N2 && !seen.has(N2.k)) { seen.add(N2.k); todo.push(N2); } }
  }
  return false;
}

function markRisky(L, C) { if (!C.risky) { C.risky = true; L.risky.push(C); } }

// a hole breaks open in the middle of its cell: dark water (deep, you fall in), a light rim
function paintHole(T, C) {
  const b = T.base.getContext('2d'), r = 11, x0 = Math.round(C.x - r - 2), y0 = Math.round(C.y - r - 2), w = r * 2 + 5, img = b.getImageData(x0, y0, w, w), d = img.data;
  for (let y = y0; y < y0 + w; y++) for (let x = x0; x < x0 + w; x++) {
    if (x < 0 || y < 0 || x >= T.W || y >= T.H) continue;
    const j = y * T.W + x; if (!T.ice.lakeM[j]) continue;
    const dd = Math.hypot(x + .5 - C.x, y + .5 - C.y) + (vnoise(x * .3, y * .3, 76) - .5) * 4; if (dd > r) continue;
    T.ter[j] = 5;
    const c = dd > r - 2 ? [230, 246, 255] : dd > r - 4 ? [44, 110, 150] : [22, 64, 102], k = ((y - y0) * w + x - x0) * 4; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2];
  }
  b.putImageData(img, x0, y0);
}

// the cracking cells: wait until the car has left, crack for a third of a second, then break (when it is still allowed)
function breakUpdate(T, dt) {
  const ev = T.ev, L = ev.iceLake, I = T.ice; if (!L) return;
  for (const C of L.pend.slice()) {
    const p = C.pend; p.t += dt;
    if (!p.crack) {
      if (!p.car || p.car.fall > 0 || p.car.finished || p.t > 4 || Math.hypot(p.car.x - C.x, p.car.y - C.y) > 22) { p.crack = true; if (near(C.x, C.y) < 330) SFX.crack(.7); }
    } else {
      p.ct += dt;
      if (p.ct > .35 && !G.cars.some(c => c.fall <= 0 && c.z === 0 && Math.hypot(c.x - C.x, c.y - C.y) < 15)) {
        L.pend.splice(L.pend.indexOf(C), 1); C.pend = null;
        if (!wayAcross(L, C)) { C.n = breakN() - 1; continue; }
        if (!L.snapped) { L.snapped = true; const [lx, ly, rx, ry, rt = ry] = I.lake; snap(T, lx - rx - 10, ly - rt - 10, rx * 2 + 20, rt + ry + 20); }
        C.hole = true; L.open++; L.holes.push(C); markRisky(L, C); paintHole(T, C);
        for (const dd of [1, -1, 100, -100, 101, 99, -101, -99]) { const N2 = L.cells.get(C.k + dd); if (N2) N2.nh = true; } // (the hole reaches a few pixels into its neighbours)
        if (near(C.x, C.y) < 360) SFX.iceBreak(clamp(1 - near(C.x, C.y) / 360, .2, 1));
      }
    }
  }
}

// the ground of the lake under a car: every new cell it drives into counts once (from the cell it has left)
function lakeGround(c, j, sp) {
  const T = G.T, I = T.ice, L = T.ev.iceLake; if (!L) return;
  if (!I.lakeM[j]) { c.cell = -1; c.iceLX = undefined; return; }
  c.respawnI = c.idx; c.iceLX = c.x; c.iceLY = c.y; // (where it fell in, see lakeRespawn)
  if (c.surf !== 12 || sp < 10) return;
  const k = ((c.y / CELL) | 0) * 100 + ((c.x / CELL) | 0);
  if (k === c.cell) return;
  c.cell = k; const C = L.cells.get(k); if (!C || !C.elig || C.hole || C.pend) return;
  C.n++;
  const B = breakN(), v = c.ai ? clamp(1 - near(c.x, c.y) / 320, 0, .5) : 1;
  if (C.n >= Math.max(1, B - 1)) markRisky(L, C);
  if (v > .02 && C.n >= 2) SFX.crack(v * Math.min(1, C.n / B) * .6);
  if (C.n >= B) {
    if (L.open + L.pend.length >= L.maxOpen || !wayAcross(L, C)) { C.n = B - 1; return; }
    C.pend = { car: c, t: 0, crack: false, ct: 0 }; L.pend.push(C);
  }
}

// a car that fell in is set down behind the hole (to the east, in driving direction before it), on ice that is not a hole and does not touch one, as near to the road as
// possible; never at the shore further ahead
function lakeRespawn(c) {
  const T = G.T, L = T.ev && T.ev.iceLake, I = T.ice;
  if (!L || c.iceLX === undefined) { splash(c.x, c.y, 8); return; }
  const fx = c.iceLX, ly = I.lake[1] + 10; let best = null, bs = 1e9;
  for (const C of safeCells(L, null).values()) {
    if (C.x < fx + 24) continue;
    const s = (C.x - fx) + 2 * Math.abs(C.y - ly); if (s < bs) { bs = s; best = C; }
  }
  if (best) {
    c.x = best.x; c.y = best.y; c.ang = Math.PI; c.vx = c.vy = 0;
    const R = lakeRoute(L, c); if (R && R.length > 1) { const w = lakeWaypoint(L, c, R); c.ang = Math.atan2(w.y - c.y, w.x - c.x); } // (facing the way it has to go: on ice it turns slowly)
  }
  c.iceLX = undefined; splash(c.x, c.y, 8);
}

// the computer cars find their way across the lake over the cells: the cheapest way to the west end (next to the road) that goes round the holes, keeps a little room to them and
// avoids ice that is about to break (it is worked out again every third of a second; the next waypoint is about three cells ahead)
function lakeRoute(L, c) {
  const [lx, , rx] = G.T.ice.lake, start = L.cells.get(((c.y / CELL) | 0) * 100 + ((c.x / CELL) | 0)); if (!start || start.hole) return null;
  const B = breakN(), cost = new Map([[start.k, 0]]), from = new Map(), heap = [[0, start]], done = new Set();
  while (heap.length) {
    let bi = 0; for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[bi][0]) bi = i;
    const [d, C] = heap.splice(bi, 1)[0]; if (done.has(C.k)) continue; done.add(C.k);
    if (C.x < lx - rx + 34 && Math.abs(C.y - G.T.ice.lake[1] - 10) < 40) { const R = [C]; for (let k = C.k; from.has(k);) { k = from.get(k); R.push(L.cells.get(k)); } return R.reverse(); }
    for (const dd of [1, -1, 100, -100, 101, 99, -101, -99]) {
      const N2 = L.cells.get(C.k + dd); if (!N2 || N2.hole || done.has(N2.k)) continue;
      const w = (Math.abs(dd) === 1 || Math.abs(dd) === 100 ? 1 : 1.41) * (1 + (N2.nh ? 2 : 0) + (N2.n >= Math.max(1, B - 1) ? 5 : 0) + (N2.pend ? 8 : 0)) * (N2.x > C.x + 1 ? 2 : 1), nd = d + w;
      if (nd < (cost.get(N2.k) ?? 1e9)) { cost.set(N2.k, nd); from.set(N2.k, C.k); heap.push([nd, N2]); }
    }
  }
  return null;
}

// is the straight line free of holes (a car is over a hole when its middle is within 11 px of the middle of it; 15 px keeps a little room)
function clearLine(L, x0, y0, x1, y1) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
  for (const H of L.holes) { if (Math.abs(H.x - x0) > 90 || Math.abs(H.y - y0) > 90) continue; for (let i = 0; i <= n; i++) if (Math.hypot(x0 + (x1 - x0) * i / n - H.x, y0 + (y1 - y0) * i / n - H.y) < 15) return false; }
  return true;
}

// the farthest of the next few cells of the route that can be reached on a straight line
function lakeWaypoint(L, c, R) {
  for (let k = Math.min(R.length - 1, 4); k >= 1; k--) if (clearLine(L, c.x, c.y, R[k].x, R[k].y)) return R[k];
  return R[Math.min(R.length - 1, 1)];
}

function lakeTarget(c) {
  const T = G.T, I = T.ice, ev = T.ev, L = ev.iceLake; if (!L || c.finished || c.fall > 0 || (G.state !== 'race' && G.state !== 'finish')) return null;
  const [lx, ly, rx, ry, rt = ry] = I.lake;
  if (c.x > lx + rx - 10 || c.x < lx - rx + 40 || c.y < ly - rt || c.y > ly + ry) { c.iceRoute = null; return null; }
  if (!c.iceRoute || G.time - c.iceRouteT > .33) { c.iceRoute = lakeRoute(L, c); c.iceRouteT = G.time; }
  const R = c.iceRoute; if (!R) return null;
  const C = lakeWaypoint(L, c, R);
  return [C.x, C.y];
}

// ======================================================= event "schneeball"

// def.balls = { x0, x1: the stretch of the rock face the balls come loose from (anywhere on it), y0: the foot of the face, y1: where the ball bursts, hops: y of the cliffs }.
// The timer only runs while a car is on the serpentines (so there is always one coming for whoever is there), at most two balls at a time (three in lap 3). First a warning (snow trickles
// down the face, a warning triangle blinks at the top edge of the screen above the place, a rumble), then the roll (it gets faster and bigger, hops over each cliff),
// at the end it bursts without leaving a heap.
// (from lap to lap of the leader they come more often and more at a time: the pause is scaled by lapK, the number at once is lapMax)
const BALL = { warn: 2.4, roll: 5.2, first: 4, per: [8, 14], lapK: [1, .6, .38], lapMax: [2, 2, 3] };
const ballLap = () => clamp(Math.max(...G.cars.filter(c => !c.finished).map(c => c.lap), 1), 1, 3) - 1;

function initBalls(T) { const ev = T.ev; ev.iceBallOn = true; ev.iceBalls = []; ev.iceBallCd = BALL.first; ev.iceBallK = 0; }

function ballsUpdate(T, dt) {
  const ev = T.ev, I = T.ice, B = I.balls, N = T.N; if (!B) return;
  if (G.cars.some(c => !c.finished && !c.iceLift && (c.idx - (I.serp[0] - 140) + N) % N < I.serp[1] - I.serp[0] + 160)) ev.iceBallCd -= dt;
  if (ev.iceBallCd <= 0 && ev.iceBalls.length < BALL.lapMax[ballLap()]) {
    const k = ev.iceBallK++, x = Math.round(B.x0 + hash(k, 1, 95) * (B.x1 - B.x0));
    ev.iceBalls.push({ x, t: 0, hit: new Set(), y: B.y0, r: 6, z: 0, on: false, warn: true, p: 0, bx: x, burst: false });
    ev.iceBallCd = (BALL.per[0] + hash(k, 2, 95) * (BALL.per[1] - BALL.per[0])) * BALL.lapK[ballLap()];
    if (near(x, (B.y0 + B.y1) / 2) < 520) SFX.rumble();
  }
  for (const b of ev.iceBalls) {
    b.t += dt; b.warn = b.t < BALL.warn;
    const u = clamp((b.t - BALL.warn) / BALL.roll, 0, 1); b.p = u; b.on = b.t >= BALL.warn && u < 1;
    b.y = B.y0 + (B.y1 - B.y0) * Math.pow(u, 1.45); b.r = 6 + 11 * u; b.bx = b.x + Math.sin(u * 9 + b.x) * 4;
    b.z = 0; for (const ky of B.hops) if (Math.abs(b.y - ky) < 24) b.z = 13 * Math.sin(Math.PI * (b.y - ky + 24) / 48);
    if (u >= 1 && !b.burst) {
      b.burst = true;
      for (let i = 0; i < 40; i++) addP({ t: 'd', x: b.bx, y: b.y, z: 6, vx: Math.cos(i / 40 * TAU) * (60 + Math.random() * 60), vy: Math.sin(i / 40 * TAU) * (40 + Math.random() * 40), vz: 60, col: i % 3 ? '#ffffff' : '#dce8f2', s: 2, life: .8, ml: .8 });
      if (near(b.bx, b.y) < 360) SFX.crunch(1);
    }
    // the trickle of snow at the foot of the face while it is coming loose
    if (b.warn && Math.random() < dt * 25 && inView(b.x, B.y0, 60)) addP({ t: 'd', x: b.x + (Math.random() - .5) * 18, y: B.y0 - 4 + Math.random() * 6, z: 10, vx: (Math.random() - .5) * 6, vy: 8 + Math.random() * 10, vz: -10, col: '#ffffff', s: 1, life: .7, ml: .7 });
  }
  ev.iceBalls = ev.iceBalls.filter(b => b.t < BALL.warn + BALL.roll + .15);
}

// the balls hit the cars on the road (not while it hops over a cliff, not a car in the air or on the lift)
function iceCollisions() {
  const ev = G.T.ev; if (!ev || !ev.iceBalls) return;
  for (const b of ev.iceBalls) if (b.on && b.z < 6) for (const c of G.cars) {
    if (c.fall > 0 || c.z > 0 || c.snowT > 0 || c.ghost > 0 || c.iceLift || b.hit.has(c) || Math.hypot(c.x - b.bx, c.y - b.y) > b.r + 10) continue;
    b.hit.add(c); c.snowT = 1.05; c.vx = c.vy = 0; c.stun = 0; c.boost = 0; c.shake = 1;
    if (!c.ai) SFX.crash(); else if (near(c.x, c.y) < 260) SFX.crunch(.4);
  }
}

// ======================================================= the foehn (the only way to get clean)

// a dirty computer car turns into the foehn lane beside the climb (only when it is really dirty, the same limits as the desert), drives through under the hut and comes
// out above it; the washing itself is the ordinary washMask (it does not wash at once)
function foenTarget(c) {
  const T = G.T, B = T.ice.bay, N = T.N; if (!B) return null;
  if (!c.iceBay && (G.state === 'race' || G.state === 'finish') && c.dirt > [.4, .55, .7][G.raceDiff || 0] && (B.i0 - c.idx + N) % N < 40) c.iceBay = { k: 0 };
  const W = c.iceBay; if (!W) return null;
  const P = B.P; let k = W.k, bd = 1e9;
  for (let q = W.k; q < Math.min(P.length, W.k + 30); q++) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  W.k = k;
  if (k >= P.length - 4 || bd > 70 * 70 || (G.state !== 'race' && G.state !== 'finish')) { c.iceBay = null; return null; }
  const p = P[Math.min(P.length - 1, k + 9)];
  return [p.x, p.y];
}

// the computer cars ease off before the hairpins of the serpentines, slowly through the foehn and over a lake with holes in it
function iceThrottle(c, thr) {
  if (c.iceBay) return Math.min(thr, .6);
  const L = G.T.ev && G.T.ev.iceLake; if (L && L.open > 0 && c.iceLX !== undefined) return Math.min(thr, .6);
  const T = G.T, I = T.ice, N = T.N, i = c.idx; if (!I.serp || i < I.serp[0] - 40 || i > I.serp[1] + 20) return thr;
  const a = Math.atan2(T.tan[i].y, T.tan[i].x), b = Math.atan2(T.tan[(i + 34) % N].y, T.tan[(i + 34) % N].x);
  return thr * (1 - clamp((Math.abs(angDiff(a, b)) - .5) / 1.6, 0, .45));
}

// ======================================================= the chair lift

// Every car that reaches the lift line is hooked on at once (c.iceLift, in the hook stuck: no physics, no steering, no collisions with other cars) and rides up
// at a fixed speed, a little swaying; at the top it is set down on the road with the speed of the road. Nobody waits: all ride together, over each other if need be.
const LIFT_V = 190, CABLE = 18;

function liftIn(c) {
  const I = G.T.ice, [lx, ly0] = I.lift;
  c.iceLift = { s: 0, y0: Math.min(c.y, ly0), x0: c.x, off: clamp(c.x - lx, -14, 14), ph: c.seed * 9 };
  c.vx = c.vy = 0; c.stun = 0; c.spin = 0; c.boost = 0;
}

function liftStep(c, dt) {
  const T = G.T, I = T.ice, L = c.iceLift, [lx, , ly1] = I.lift;
  const s0 = L.s; L.s += LIFT_V * dt;
  if (!c.ai && Math.floor(s0 / 150) !== Math.floor(L.s / 150)) SFX.lift(); // (a clack at every mast)
  const u = clamp(L.s / 36, 0, 1), sway = Math.sin(G.time * 2.4 + L.ph) * 1.6 * u, xt = lx - CABLE + L.off * .3;
  c.x = L.x0 + (xt - L.x0) * (u * u * (3 - 2 * u)) + sway; c.y = L.y0 - L.s; c.ang = -Math.PI / 2; c.vx = c.vy = 0; c.ghost = Math.max(c.ghost, .1);
  c.idx = clamp(Math.round(L.y0 - L.s - T.path[0].y) / -2 | 0, 0, T.N - 1); c.off = Math.abs(c.x - lx); c.safe = c.idx;
  if (c.y <= ly1) { // at the top: set down on the road, rolling
    c.iceLift = null; c.ghost = 0; c.x = lx + ((c.seed * 7.3) % 1 - .5) * 30; c.y = ly1; c.vx = 0; c.vy = -105; c.surf = 1;
  }
}

// the ground under a car: powder snow and steam of snow behind it
function iceGround(c, j, sp, dt) {
  if (G.T.washMask[j]) { if (!c.iceWash) { c.iceWash = true; if (!c.ai || near(c.x, c.y) < 260) SFX.foen(c.ai ? .4 : 1); } } else c.iceWash = false;
  if (G.T.ev.iceBreakOn) lakeGround(c, j, sp);
  if (c.surf === LIFT && !c.iceLift && !c.finished && c.y > G.T.ice.lift[1] - 60 && c.vy < 0) { liftIn(c); return; }
  // a crooked landing after the big jump (trackfx.js land() spins the car): it ploughs into the snow and is snowed in until it shakes free
  if (c.z > 0) c.iceAir = c.air; else if (c.iceAir) {
    if (c.iceAir > .7 && c.stun > 0) { c.snowT = 1.05; c.shake = 1; c.vx = c.vy = 0; c.stun = 0; c.spin = 0; if (!c.ai) SFX.crash(); else if (near(c.x, c.y) < 260) SFX.crunch(.4); }
    c.iceAir = 0;
  }
  if (c.surf === 12 && sp > 50 && Math.random() < dt * 8) addP({ t: 'd', x: c.x - Math.cos(c.ang) * 12, y: c.y - Math.sin(c.ang) * 12, z: 1, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, vz: 20, col: '#ffffff', s: 1, life: .4, ml: .4 });
  if ((c.surf === 0 || c.surf === POWDER) && sp > 30 && Math.random() < dt * 14) addP({ t: 'd', x: c.x - Math.cos(c.ang) * 12, y: c.y - Math.sin(c.ang) * 12, z: 1, vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 40, vz: 40, col: ['#ffffff', '#e6eef6'][(Math.random() * 2) | 0], s: 2, life: .6, ml: .6 });
}

// snowed in: stuck until shaken free (about a second); every new press of the gas shakes it a little faster
function iceStuck(c, dt, racing) {
  c.vx = c.vy = 0;
  let k = 1;
  if (!c.ai && racing) { const g = dirHeld(); if (g && !c.gasPrev) { k = 0; c.snowT -= .14; c.shake = 1; } c.gasPrev = g; }
  c.snowT -= dt * k; c.shake = Math.max(0, (c.shake || 0) - dt * 4);
  if (Math.random() < dt * 10) addP({ t: 'd', x: c.x + (Math.random() - .5) * 26, y: c.y + (Math.random() - .5) * 18, z: 6, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, vz: 30, col: '#ffffff', s: 2, life: .5, ml: .5 });
  if (c.snowT <= 0) {
    c.snowT = 0; c.dirt = 1;
    for (let i = 0; i < 26; i++) addP({ t: 'd', x: c.x, y: c.y, z: 4, vx: Math.cos(i / 26 * TAU) * 80, vy: Math.sin(i / 26 * TAU) * 80, vz: 50, col: i % 2 ? '#ffffff' : '#dce8f2', s: 2, life: .7, ml: .7 });
    if (!c.ai || near(c.x, c.y) < 250) SFX.crunch(c.ai ? .4 : 1);
  }
}

// parts of the centre line lie close together (the wood beside the climb, the serpentine legs): far off the line a car keeps its place in the lap,
// the nearest point within 200 points of where it was (and not on the other part of the line)
function iceProgress(c, best) {
  const T = G.T, N = T.N; let bi = best, bd = 1e9;
  for (let k = -200; k <= 200; k++) { const i = (c.idx + k + N) % N, p = T.path[i], d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (d < bd) { bd = d; bi = i; } }
  return bd < 22500 ? bi : best;
}

// ======================================================= drawing

// a car on the lift hangs high above the road: its shadow lies far down on the snow, two hangers run up from the roof to the wheel on the cable
function drawLiftCar(c, F, rot, lv) {
  if (!c.iceLift) return false;
  const x = Math.round(c.x), y = Math.round(c.y), h = 15;
  ctx.globalAlpha = .26; ctx.drawImage(F.shadow[rot], x - SS / 2 + 10, y - SS / 2 + 18); ctx.globalAlpha = 1;
  ctx.drawImage(F.frames[lv][rot], x - SS / 2, y - SS / 2 - h);
  ctx.fillStyle = '#3a3a40'; for (let k = 0; k < 9; k++) { ctx.fillRect(x - 7 + Math.round(k * .45), y - h - 6 - k, 1, 1); ctx.fillRect(x + 7 - Math.round(k * .45), y - h - 6 - k, 1, 1); }
  R1(x - 2, y - h - 17, 5, 4, '#5a5a64'); R1(x - 1, y - h - 16, 3, 2, '#c9ced6');
  return true;
}

// the cables of the lift with their empty chairs (up on the left cable, down on the right one), only in view
function drawLiftCables() {
  const I = G.T.ice, [lx, ly0, ly1] = I.lift;
  if (cam.x > lx + 60 || cam.x + VW < lx - 60 || cam.y > ly0 + 30 || cam.y + VH < ly1 - 30) return;
  const y0 = Math.max(ly1 - 8, cam.y - 20), y1 = Math.min(ly0 - 8, cam.y + VH + 20);
  for (const s of [-1, 1]) {
    const x = lx + s * CABLE;
    ctx.globalAlpha = .18; ctx.fillStyle = '#304860'; ctx.fillRect(x + 8, y0 + 18, 1, y1 - y0);
    ctx.globalAlpha = 1; ctx.fillStyle = '#4a4a54'; ctx.fillRect(x, y0, 1, y1 - y0);
  }
  const gap = 140, ph = (G.time * LIFT_V) % gap;
  for (let k = -1; k * gap < ly0 - ly1 + gap; k++) for (const s of [-1, 1]) {
    const y = s < 0 ? ly0 - 8 - (k * gap + ph) : ly1 + (k * gap + ph), x = lx + s * CABLE;
    if (y < ly1 - 8 || y > ly0 - 8 || y < cam.y - 30 || y > cam.y + VH + 30) continue;
    if (s < 0 && G.cars.some(c => c.iceLift && Math.abs(c.y - y) < 30)) continue;
    ctx.globalAlpha = .2; R1(x + 8, y + 16, 8, 10, '#304860'); ctx.globalAlpha = 1;
    R1(x, y - 6, 1, 6, '#4a4a54'); R1(x - 4, y, 9, 8, '#1b120c'); R1(x - 3, y + 1, 7, 6, ['#d83a2c', '#2f6fd8', '#f2c230', '#3aa845'][(k + 4 + (s > 0 ? 2 : 0)) & 3]); R1(x - 3, y + 1, 7, 1, '#9fd6ff');
  }
}

// cracks in the lake ice: more and longer ones the more often the cell was crossed (zigzag lines from the middle of the cell), darker when it is about to break
function drawCracks() {
  const T = G.T, L = T.ev && T.ev.iceLake; if (!L) return;
  const B = breakN();
  for (const C of L.cells.values()) {
    if (!C.n || C.hole || Math.abs(C.x - cam.x - VW / 2) > VW / 2 + 20 || Math.abs(C.y - cam.y - VH / 2) > VH / 2 + 20) continue;
    const q = clamp(C.n / B, 0, 1), k = C.k;
    ctx.fillStyle = q > .7 || C.pend ? '#4f86b0' : '#7fb0d2';
    for (let w = 0, nw = Math.ceil(1 + q * 5); w < nw; w++) {
      let x = C.x + (hash(k, w, 82) - .5) * 6, y = C.y + (hash(k, w, 83) - .5) * 6, a = hash(k, w, 84) * TAU;
      const len = 4 + q * 11;
      for (let s = 0; s < len; s++) { if (s % 3 === 0) a += (hash(k, w * 9 + s, 85) - .5) * 1.4; x += Math.cos(a); y += Math.sin(a); if (T.ice.lakeM[clamp(Math.round(y), 0, T.H - 1) * T.W + clamp(Math.round(x), 0, T.W - 1)]) ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
    }
  }
}

// the animals (looks only): polar bears on the rock wall in front of the lake (they breathe, now and then a paw), reindeer (the head nods) and penguins (they waddle) in the snow below it
function drawAnimals() {
  const A = G.T.ice.animals; if (!A) return;
  for (const [x, y] of A.bears) {
    if (!inView(x, y, 40)) continue;
    const br = Math.sin(G.time * 1.6 + x) * .8, paw = Math.sin(G.time * .7 + x * .3) > .85;
    ctx.globalAlpha = .25; ell(x + 3, y + 5, 15, 8, '#000'); ctx.globalAlpha = 1;
    ell(x, y, 15, Math.round(9 + br), '#c4d0dc'); ell(x, y - 1, 14, Math.round(8 + br), '#f4f6f8'); ell(x + 12, y - 1, 6, 5, '#f4f6f8');
    R1(x + 17, y - 1, 3, 3, '#1b1b22'); R1(x + 10, y - 5, 2, 2, '#c4d0dc'); R1(x + 14, y - 5, 2, 2, '#c4d0dc'); R1(x + 14, y - 2, 1, 1, '#1b1b22');
    R1(x - 9, y + 6, 5, 3, '#dfe6ee'); R1(x + 5, y + (paw ? 3 : 6), 5, 3, '#dfe6ee');
  }
  for (const [x, y, f] of A.deer) {
    if (!inView(x, y, 30)) continue;
    const nod = Math.round(Math.sin(G.time * 1.3 + x) * 1.2);
    ctx.globalAlpha = .25; ell(x + 2, y + 5, 10, 5, '#000'); ctx.globalAlpha = 1;
    ell(x, y, 9, 5, '#755034'); ell(x, y - 1, 8, 4, '#8c623e'); R1(x - 6, y + 3, 2, 4, '#5a3c24'); R1(x + 4, y + 3, 2, 4, '#5a3c24');
    const hx = x + 10 * f, hy = y - 3 + nod; ell(hx, hy, 4, 3, '#8c623e'); R1(hx + 3 * f, hy, 2, 2, '#d83a2c');
    R1(hx - 2 * f, hy - 5, 1, 4, '#c8aa78'); R1(hx + 1 * f, hy - 5, 1, 4, '#c8aa78'); R1(hx - 3 * f, hy - 6, 3, 1, '#c8aa78');
  }
  for (const [x, y] of A.penguins) if (inView(x, y, 30)) drawPenguin(x + Math.sin(G.time * 2 + x) * 1.5, y, x % 2 ? 1 : -1, ((G.time * 2 + x) | 0) % 2);
  drawSkiers(); drawYeti(); drawSnowfight();
}

// the skiers at the in-run of the jump, getting ready: skis pointing down the hill, one bounces on his knees, one swings his poles, one looks round
function drawSkiers() {
  const S = G.T.ice.skiers; if (!S) return;
  S.forEach(([x, y], k) => {
    if (!inView(x, y, 30)) return;
    const t = G.time + k * 1.7, by = k === 0 ? Math.round(Math.abs(Math.sin(t * 5)) * 1.5) : 0, look = k === 2 ? Math.round(Math.sin(t * .9) * 1.5) : 0, pole = k === 1 ? Math.round(Math.sin(t * 3) * 2) : 0;
    ctx.globalAlpha = .22; ell(x + 2, y + 3, 5, 8, '#304860'); ctx.globalAlpha = 1;
    const col = ['#d83a2c', '#2f6fd8', '#f2c230'][k % 3];
    R1(x - 3, y - 7, 1, 15, '#1b120c'); R1(x + 2, y - 7, 1, 15, '#1b120c'); R1(x - 3, y - 7, 1, 1, col); R1(x + 2, y - 7, 1, 1, col); // (the skis, tips up the hill)
    R1(x - 6 - pole, y - 3, 1, 8, '#4a4a54'); R1(x + 5 + pole, y - 3, 1, 8, '#4a4a54');
    ell(x, y - by, 4, 3, col); R1(x - 4, y - 1 - by, 2, 2, col); R1(x + 3, y - 1 - by, 2, 2, col);
    disc(x + look, y - 3 - by, 2, '#f1d2b4'); R1(x - 2 + look, y - 6 - by, 5, 2, k === 1 ? '#ffffff' : '#1b1b22'); R1(x - 1 + look, y - 3 - by, 3, 1, '#7fd4ff'); // (helmet, goggles)
  });
}

// the yeti behind the pine: now and then it peeks out (to the west), but not while a car is close
function drawYeti() {
  const Y = G.T.ice.yeti; if (!Y || !inView(Y[0], Y[1], 40)) return;
  const ph = (G.time % 9) / 9, shy = G.cars.some(c => Math.hypot(c.x - Y[0], c.y - Y[1]) < 90);
  const out = shy ? 0 : ph < .55 ? 0 : ph < .62 ? (ph - .55) / .07 : ph < .9 ? 1 : 1 - (ph - .9) / .1, x = Math.round(Y[0] - out * 16), y = Y[1];
  ctx.globalAlpha = .25 * out; ell(x + 3, y + 6, 10, 5, '#304860'); ctx.globalAlpha = 1;
  ell(x, y, 9, 10, '#7f93a8'); ell(x, y - 1, 8, 9, '#eef3f8'); ell(x + 2, y + 2, 5, 6, '#d6e0ea'); ell(x - 1, y - 5, 5, 4, '#6f8aa6'); // (shaggy fur, the blue-grey face)
  const blink = ((G.time * 3) | 0) % 7 === 0;
  if (!blink) { R1(x - 4, y - 6, 2, 2, '#ffffff'); R1(x, y - 6, 2, 2, '#ffffff'); R1(x - 3, y - 5, 1, 1, '#1b1b22'); R1(x + 1, y - 5, 1, 1, '#1b1b22'); }
  R1(x - 3, y - 2, 4, 1, '#2e3846');
  if (out > .8) { R1(x - 11, y - 3, 4, 3, '#eef3f8'); R1(x - 12, y - 3, 1, 2, '#6f8aa6'); } // (a hand on the tree)
}

// the snowball fight: the two snowmen throw at each other in turn (a ball on an arc with its shadow, it bursts on the other one), the thrower lifts its stick arm
function drawSnowfight() {
  const F = G.T.ice.snowfight; if (!F || F.length < 2 || !inView((F[0][0] + F[1][0]) / 2, (F[0][1] + F[1][1]) / 2, 90)) return;
  const P = 1.6, k = Math.floor(G.time / P), u = (G.time % P) / P, [a, b] = k % 2 ? [F[1], F[0]] : [F[0], F[1]];
  // (the snowmen themselves are on the top layer: the stick arms reach out beside them)
  for (const [x, y] of F) { const thrower = x === a[0] && y === a[1] && u < .5; R1(x - 9, y - 1, 4, 1, '#6a4420'); R1(x - 10, y - 2, 1, 1, '#6a4420'); if (thrower) { R1(x + 6, y - 7, 1, 7, '#6a4420'); R1(x + 7, y - 8, 1, 1, '#6a4420'); } else { R1(x + 6, y - 1, 4, 1, '#6a4420'); R1(x + 10, y - 2, 1, 1, '#6a4420'); } }
  if (u < .6) {
    const t = u / .6, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = Math.sin(Math.PI * t) * 20;
    ctx.globalAlpha = .25; disc(Math.round(x + 1), Math.round(y + 2), 2, '#304860'); ctx.globalAlpha = 1;
    disc(Math.round(x), Math.round(y - 6 - z), 2, '#ffffff');
  } else if (u < .75) for (let q = 0; q < 6; q++) R1(Math.round(b[0] + Math.cos(q + k) * (u - .6) * 60), Math.round(b[1] - 6 + Math.sin(q + k) * (u - .6) * 40), 1, 1, '#ffffff');
}

// the Christmas lights on the eaves of the mountain hut and on its fir (they twinkle in turn), a star on top of the fir
function drawXmas() {
  const H = G.T.ice.hut; if (!H || !inView(H[0], H[1], 60)) return;
  const [hx, hy, fx, fy] = H, w = 44, h = 29, x0 = hx - w / 2, y0 = hy - 16, COL = ['#ff4a3c', '#ffd23f', '#4ad66a', '#4aa8ff'], t = (G.time * 3) | 0;
  let n = 0;
  const bulb = (x, y) => { const on = (n + t) % 4 !== 0; R1(Math.round(x), Math.round(y), 1, 1, on ? COL[n % 4] : '#5a5a64'); n++; };
  for (let x = x0 + 1; x < x0 + w; x += 4) { bulb(x, y0); bulb(x + 2, y0 + h); }
  for (let y = y0 + 4; y < y0 + h; y += 4) { bulb(x0, y); bulb(x0 + w - 1, y); }
  for (let q = 0; q < 12; q++) { const a = q * 2.4, r = 3 + (q % 4) * 2.3; bulb(fx + Math.cos(a) * r, fy + Math.sin(a) * r); }
  R1(fx - 1, fy, 3, 1, '#ffe27a'); R1(fx, fy - 1, 1, 3, '#ffe27a');
}

// a penguin: black back, white belly, orange beak and feet
function drawPenguin(x, y, f, st) {
  x = Math.round(x); y = Math.round(y);
  ctx.globalAlpha = .25; R1(x - 4, y + 3, 9, 3, '#000'); ctx.globalAlpha = 1;
  R1(x - 3, y - 6, 7, 10, '#1b120c'); R1(x - 2, y - 5, 5, 8, '#2a2a34'); R1(x - 1, y - 3, 3, 6, '#ffffff');
  R1(x + (f > 0 ? 2 : -3), y - 5, 2, 1, '#ffb02e'); R1(x, y - 5, 1, 1, '#ffffff');
  R1(x - 2 + st, y + 4, 2, 1, '#ffb02e'); R1(x + 1 - st, y + 4, 2, 1, '#ffb02e');
}

// the snowballs: the shadow of the ball while it rolls
function drawBallsGround() {
  const ev = G.T.ev, B = G.T.ice.balls; if (!ev || !ev.iceBalls || !B) return;
  for (const b of ev.iceBalls) {
    if (!inView(b.x, (B.y0 + B.y1) / 2, 300)) continue;
    if (b.on) { ctx.globalAlpha = .28; ell(Math.round(b.bx + 3 + b.z * .5), Math.round(b.y + b.r * .6 + b.z * .8), Math.round(b.r + 4), Math.round(b.r * .5 + 2), '#304860'); ctx.globalAlpha = 1; }
  }
}

// the foehn in view: the glow of the coils pulses red-orange at the front edge of the hut, the blades of the blower turn, warm air shimmers above the lane,
// and the washing floor steams a little
function drawFoenSky() {
  const T = G.T, B = T.ice.foen; if (!B) return;
  const [wx0, wy0, wx1, wy1] = B.wash, cx = (wx0 + wx1) / 2;
  if (!inView(cx, (wy0 + wy1) / 2, 60)) return;
  const ay0 = wy0 + 4, ay1 = ay0 + 15, g = .5 + .5 * Math.sin(G.time * 5);
  ctx.globalAlpha = .35 + .3 * g; R1(wx0 - 4, ay1 + 2, wx1 - wx0 + 8, 2, '#ff7a2e'); ctx.globalAlpha = .15 + .12 * g; R1(wx0 - 4, ay1 + 4, wx1 - wx0 + 8, 5, '#ff9a4e'); ctx.globalAlpha = 1;
  const a = G.time * 9, cy = (ay0 + ay1) / 2;
  for (let k = 0; k < 4; k++) { const an = a + k * Math.PI / 2; for (let r = 1; r <= 5; r++) R1(Math.round(cx + Math.cos(an) * r), Math.round(cy + Math.sin(an) * r), 1, 1, '#c8ced6'); }
  if (Math.random() < .5) addP({ t: 'smoke', x: wx0 + Math.random() * (wx1 - wx0), y: wy1 + 2, vx: (Math.random() - .5) * 6, vy: -16 - Math.random() * 10, life: 1.1, ml: 1.1 });
}

// the chess players under the lift: Santa Claus (left) and the Grinch (right) at a stump. Every 2.4 s one of them moves a piece, every fourth move the
// Grinch loses his temper (arms up, shaking), Santa Claus strokes his beard
function drawChess() {
  const F = G.T.ice.foen; if (F && inView(F.sign[0], F.sign[1], 120)) text('FOEN', F.sign[0], F.sign[1] - 20, 6, '#ff8a3c', 'center');
  const C = G.T.ice.chess; if (!C || !inView(C[0], C[1], 40)) return;
  const [cx, cy] = C, t = G.time / 2.4, k = Math.floor(t), u = t - k, santa = k % 2 === 0, rage = k % 4 === 3 && u > .35 && !santa;
  const body = (x, y, col, dark, hat, f, armsUp, sh) => {
    x = Math.round(x + sh); y = Math.round(y - (armsUp ? 1 : 0));
    ctx.globalAlpha = .25; ell(x + 3, y + 4, 8, 6, '#000'); ctx.globalAlpha = 1;
    ell(x, y, 8, 6, dark); ell(x, y - 1, 7, 5, col);
    ell(x + f * 2, y - 1, 4, 4, hat === 'santa' ? '#f1d2b4' : '#7cc050'); // the head
    if (hat === 'santa') { R1(x + f * 2 - 4, y - 5, 8, 3, '#d83a2c'); R1(x + f * 2 + f * 3, y - 6, 2, 2, '#ffffff'); R1(x + f * 2 - 2, y + 1, 5, 2, '#ffffff'); }
    else { R1(x + f * 2 - 4, y - 5, 8, 2, '#3e8a2c'); R1(x + f * 2 - 1, y - 1, 1, 1, '#d83a2c'); R1(x + f * 2 + 1, y - 1, 1, 1, '#d83a2c'); }
    if (armsUp) { R1(x - 7, y - 9, 2, 5, col); R1(x + 6, y - 9, 2, 5, col); }
  };
  const mv = u < .4 ? Math.sin(u / .4 * Math.PI) : 0;
  body(cx - 22, cy, '#d83a2c', '#8a1f16', 'santa', 1, false, 0);
  body(cx + 22, cy, '#4c9a32', '#2e6020', 'grinch', -1, rage, rage ? Math.sin(G.time * 40) * 1.2 : 0);
  // the arm of the mover reaches for the board and a piece slides
  const px = santa ? cx - 22 + 8 : cx + 22 - 8, qx = cx + (santa ? -4 : 4) + (santa ? 1 : -1) * mv * 6;
  if (mv > 0) { R1(Math.round(px + (qx - px) * mv), cy - 1, 4, 2, santa ? '#d83a2c' : '#4c9a32'); }
  R1(Math.round(qx) - 1, cy - 1, 3, 3, santa ? '#ffffff' : '#222');
  if (santa && u > .5 && u < .9) R1(cx - 20, cy + 2, 4, 3, '#ffffff'); // strokes his beard
  if (rage) text('!#*?', cx + 22, cy - 18, 6, '#ff6b6b', 'center');
}

// above the cars: the snowed-in lump over a car (the shaking shows while it is held), the polar light in the last lap
function drawIceAbove() {
  const T = G.T, I = T.ice, ev = T.ev;
  drawLiftCables(); drawFoenSky(); drawXmas();
  if (ev && ev.iceBalls) for (const b of ev.iceBalls) {
    if (b.on) {
      const x = Math.round(b.bx), y = Math.round(b.y - b.z), r = Math.round(b.r), rot = b.p * 22;
      disc(x, y, r + 1, '#9fb2c6'); disc(x, y, r, '#f4f8fc'); disc(x - Math.round(r * .3), y - Math.round(r * .3), Math.round(r * .45), '#ffffff');
      for (let q = 0; q < 5; q++) R1(Math.round(x + Math.cos(rot + q * 1.3) * r * .6), Math.round(y + Math.sin(rot + q * 1.3) * r * .6), 2, 2, '#c8d6e4');
      if (Math.random() < .6) addP({ t: 'd', x: b.bx + (Math.random() - .5) * b.r * 2, y: b.y - b.r * .5, z: 3, vx: (Math.random() - .5) * 40, vy: -20, vz: 30, col: '#ffffff', s: 2, life: .5, ml: .5 });
    }
    // the warning: a triangle blinks at the top edge of the screen right above the place (or at the foot of the face when it is in view), while it comes loose
    // and as long as the ball is still above the screen
    const B = I.balls, ty = Math.max(Math.round(cam.y) + 18, B.y0 + 2); // (below the bar at the top of the screen)
    if ((b.warn || (b.on && b.y < cam.y + 12)) && b.x > cam.x - 10 && b.x < cam.x + VW + 10 && cam.y + VH > B.y0 && ((G.time * 5) | 0) % 2 === 0) warnSign(b.x, ty);
  }
  for (const c of G.cars) if (c.snowT > 0 && inView(c.x, c.y, 30)) {
    const X = Math.round(c.x), Y = Math.round(c.y), w = Math.round(Math.sin(G.time * 40) * (c.shake || 0) * 2);
    ell(X + w, Y, 16, 12, '#9fb2c6'); ell(X + w, Y - 1, 15, 11, '#eef4fa'); ell(X - 4 + w, Y - 4, 8, 5, '#ffffff');
  }
  if (G.player && G.player.lap >= LAPS && I.lake) drawAurora(T.ev, I.lake);
}

// a warning triangle (yellow, black rim and exclamation mark), its tip at x, y
function warnSign(x, y) {
  x = Math.round(x);
  for (let r = 0; r < 16; r++) { const w = Math.floor(r * .62); R1(x - w - 1, y + r, w * 2 + 3, 1, '#1b120c'); if (r > 1 && r < 15) R1(x - w + 1, y + r, w * 2 - 1, 1, '#ffd23f'); }
  R1(x - 1, y + 5, 2, 5, '#1b120c'); R1(x - 1, y + 11, 2, 2, '#1b120c');
}

// the polar light of the last lap: three curtains hang in the sky over the lake (violet at the top, green at the lower edge, vertical rays that flicker and
// sway), and the lake ice mirrors them (flipped at the north shore, a little squeezed, with a green glow on the ice, fainter, rippling, only inside the lake)
const AURORA = Array.from({ length: 5 }, (_, i) => { const m = (a, b) => Math.round(a + (b - a) * i / 4); return 'rgb(' + m(150, 40) + ',' + m(80, 240) + ',' + m(255, 140) + ')'; });
function drawAurora(ev, [lx, ly, rx, ry, rt = ry]) {
  const yT = ly - rt, ym = yT + ry * .1, yc = (yT + ly + ry) / 2, rh = (rt + ry) / 2;
  if (!inView(lx, yc, rx + 40) && !inView(lx, yT - 140, rx + 40)) return;
  if (ev.iceAuroraT0 === undefined) ev.iceAuroraT0 = G.time;
  const fade = clamp((G.time - ev.iceAuroraT0) / 3, 0, 1), N = 5, x0 = Math.max(lx - rx - 40, cam.x - 6), x1 = Math.min(lx + rx + 40, cam.x + VW + 6);
  for (const mirror of [false, true]) {
    ctx.save();
    if (mirror) { ctx.beginPath(); ctx.ellipse(lx, yc, rx * .96, rh * .96, 0, 0, TAU); ctx.clip(); ctx.globalAlpha = .08 * fade; ctx.fillStyle = '#5cffb4'; ctx.fillRect(lx - rx, yc - rh, rx * 2, rh * 2); }
    for (let k = 0; k < 3; k++) for (let x = x0 - (x0 - (lx - rx - 40)) % 3; x < x1; x += 3) {
      const sway = Math.sin(x * .028 + G.time * (.5 + k * .17) + k * 2.2) * 9 + Math.sin(x * .011 - G.time * .35) * 7;
      const yb = yT - 135 - k * 14 + sway, h = 46 + 18 * Math.sin(x * .05 + G.time * .8 + k) + k * 6;
      const flick = (.5 + .5 * Math.sin(x * .31 + G.time * 2.3 + k * 1.7)) ** 2, taper = clamp(Math.min(x - (lx - rx - 40), lx + rx + 40 - x) / 60, 0, 1), a = (.1 + .42 * flick) * taper * fade * (mirror ? .6 : 1);
      for (let i = 0; i < N; i++) {
        const y0 = yb - h + h * i / N, y1 = yb - h + h * (i + 1) / N, d = mirror ? ym + (ym - y1) * .7 : y0, e = mirror ? (y1 - y0) * .7 : y1 - y0;
        ctx.globalAlpha = a * Math.pow((i + 1) / N, 1.5); ctx.fillStyle = AURORA[i];
        ctx.fillRect(x + (mirror ? Math.round(Math.sin(y0 * .2 + G.time * 2) * 1.5) : 0), Math.round(d), 3, Math.max(1, Math.round(e)));
      }
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// the powder snow is a little slower than the road, the car stays clean (surf): full grip, normal steering
function iceSurf(c) { return c.surf === POWDER ? [.9, 6, .9] : null; }

// ---------- hooks: how the core calls this track (hooks.js; what each hook does: _template.js) ----------
/** @type {import('./_template.js').TrackHooks} */
export const iceHooks = {
  init(T) { T.ev.obst = []; }, update: iceUpdate,
  surf: iceSurf, progress: iceProgress, wander: .5, target: c => foenTarget(c) || lakeTarget(c), throttle: iceThrottle,
  stuck(c, dt, racing) {
    if (c.iceLift) { liftStep(c, dt); return true; }
    if (!(c.snowT > 0)) return false; iceStuck(c, dt, racing); return true;
  },
  noRespawn: t => t === LIFT, respawn: lakeRespawn, drawCar: drawLiftCar, airTop: c => c.z > 22,
  ground: iceGround, drawGround() { drawChess(); drawAnimals(); drawCracks(); drawBallsGround(); }, collisions: iceCollisions, events: { schneeball: initBalls, eisbruch: initBreak }, drawAbove: drawIceAbove,
};
