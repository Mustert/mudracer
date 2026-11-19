import { G } from './g.js';
import { SFX } from './audio.js';
import { HALF, LAPS, SS, TAU, VH, VW, angDiff, clamp, ctx, hash, rotIndex } from './core.js';
import { R1, disc, ell, text } from './gfx.js';
import { snap } from './undo.js';
import { addP } from './particles.js';
import { cam } from './state.js';
import { inView, near } from './trackfx.js';

// ---------- Vulkan Rev 5 while racing (plaene/VULKAN_REV5.md) ----------
// Always: the crater lake boils (fountains that bubble before they spout), the volcano smokes and rumbles now and then, the hornitos puff, the base camp's
// blue lights blink and the reporter talks into the camera, the fire brigade sprays its bay on the start straight (the only way to get clean).
// Event "ausbruch" (the serpentine): fireballs out of the crater, more often from lap to lap, aimed a little ahead of a car (a shadow grows and darkens before
// they land). Where one lands it burns for a moment; who drives through (or is hit) burns: a little slower, then the driver puts it out with an extinguisher and
// the car is half white with foam (dirt, the second set of sprites). From lap 2 a red sky, ash rain, a column of smoke, a helicopter over the crater.
// Event "brueckenloch" (the steel bridge): from lap 2 (your laps) plates fall out of the deck one after the other, more in lap 3: a slalom. A plate shakes and
// glows red before it falls (and waits while a car is on it). Who falls through tumbles into the lava; a rescue helicopter brings the car back before the bridge.
// Event "lavastrom" (the maze of gullies): tongues of lava run from the feeders on both sides into the gullies, other ones every lap (def.maze.laps; every set
// leaves a way down). Before a tongue runs, its gate spits and glows; the old tongues cool to a crust you can drive on. The computer cars find their way round.

const BALL = { warn: 1.6, r: 15, h: 240, per: [[2.4, 3.2], [1.5, 2.1], [1, 1.5]], first: 9 }; // (per: seconds between two fireballs in lap 1, 2, 3; first: s after the start)
const FIRE = { life: 3, r: 13, burn: 1.4, ext: 1.1, foam: .42, most: .62 }; // (a car burns burn s, then it is put out in ext s, then foam: dirt at least foam, at most most)
const LAVA = { pre: 1.5, v: 105, cool: 3 }; // (a tongue: warning at its gate, speed of its front in px/s, how long the crust glows)
const HOLE = { warn: 1.3, stagger: .6, fall: .8 }; // (a plate shakes warn s before it falls, the plates of a lap one after the other)
const HELI = { t: 3.4, tumble: .85, come: 1.3, out: 1 }; // (the fall through the bridge: tumbling, the helicopter comes, then it flies off)

// ======================================================= always

function initVolcano(T) {
  const ev = T.ev, V = T.volcano;
  ev.obst = []; ev.vlBalls = []; ev.vlFires = []; ev.vlBallCd = BALL.first; ev.vlBallN = 0; ev.vlErupt = null; ev.vlLate = false;
  ev.vlQuake = 0; ev.vlNextQuake = 6; ev.vlAlarm = false;
  ev.vlTongues = V.maze.tongues.map(() => ({ ph: 'idle', t0: 0, i: 0, kf: 0, tc: 0, snap: false }));
  ev.vlMzLap = 0; ev.vlMzVer = 0;
  ev.vlHoles = V.bridge.holes.map(() => ({ ph: 'closed', due: -1, t0: 0 }));
}

// the car in front (most laps, then furthest on)
function leader() {
  let b = null; for (const c of G.cars) if (!b || c.lap > b.lap || (c.lap === b.lap && c.idx > b.idx)) b = c;
  return b;
}
const lapNow = () => { const P = G.player, L = leader(); return clamp(P && !P.finished ? P.lap : L ? L.lap : 1, 1, 3); };
// in the maze: on the floor of a gully or on its rock (the road before and after it is not)
const inMaze = (T, x, y) => { const j = clamp(Math.round(y), 0, T.H - 1) * T.W + clamp(Math.round(x), 0, T.W - 1); return !!T.volcano.maze.gully[j] || T.ter[j] === 80; };

function volcanoUpdate(T, dt) {
  const ev = T.ev, V = T.volcano, t = ev.t;
  // it smokes and rumbles now and then (the camera shakes a little, the needle of the seismograph jumps)
  ev.vlQuake = Math.max(0, ev.vlQuake - dt);
  if (t > ev.vlNextQuake) { ev.vlNextQuake = t + 8 + hash(Math.floor(t), 1, 97) * 6; ev.vlQuake = 1.2; SFX.rumble(); G.jumpShake = Math.max(G.jumpShake, .25); }
  for (const v of V.vents) if (Math.random() < dt * 1.6 && near(v.x, v.y) < 320) addP({ t: 'smoke', x: v.x + (Math.random() - .5) * 6, y: v.y, vx: 3, vy: -9, life: 1.5, ml: 1.5 });
  for (const h of V.hornitos) if (Math.random() < dt * 2 && near(h.x, h.y) < 300) addP({ t: 'smoke', x: h.x, y: h.y - 4, vx: (Math.random() - .5) * 6, vy: -14, life: 1, ml: 1 });
  // steam over the lava under the bridge
  if (Math.random() < dt * 6) { const x = 660 + Math.random() * 440, y = 340 + Math.random() * 90; if (near(x, y) < 300 && T.ter[Math.round(y) * T.W + Math.round(x)] === 15) addP({ t: 'smoke', x, y, vx: 2, vy: -12, life: 1.2, ml: 1.2 }); }
  // from lap 2 (when you go into it): the eruption (sky, ash rain, helicopter)
  if (!ev.vlLate && G.player && G.player.lap >= 2) { ev.vlLate = true; if (ev.vlErOn) { ev.vlErupt = { t: 0 }; SFX.bang(); G.jumpShake = .9; ev.vlQuake = 2; } }
  if (ev.vlErupt) ev.vlErupt.t += dt;
  ev.vlAlarm = false;
  if (ev.vlLavaOn) updateTongues(T, dt);
  if (ev.vlHoleOn) updateHoles(T, dt);
  if (ev.vlErOn) updateBalls(T, dt);
  updateBurning(dt);
  updateRescue(T, dt);
  // the last lap: sparks rain down over the whole map
  if (ev.vlErupt && G.player && G.player.lap >= LAPS && Math.random() < dt * 30) addP({ t: 'd', x: cam.x + Math.random() * VW, y: cam.y + Math.random() * VH, z: 60, vx: (Math.random() - .5) * 20, vy: 10, vz: -20, col: ['#ff7a1a', '#ffd04a', '#ff4a1a'][(Math.random() * 3) | 0], s: 1, life: 1.4, ml: 1.4 });
}

// the ground under a car: the fire brigade's water; foam and soot go when the car is clean
function volcanoGround(c, j, sp, dt) {
  const T = G.T;
  if (T.washMask[j]) { if (!c.vWash) { c.vWash = true; if (!c.ai || near(c.x, c.y) < 260) SFX.hose(c.ai ? .4 : 1); } } else c.vWash = false;
  if (c.dirt < .03) c.cem = false;
  c.burnT = Math.max(0, (c.burnT || 0) - dt);
}

// in the maze the progress goes by the height (the gullies lie side by side); elsewhere parts of the centre line lie close together (the serpentine legs):
// look for the nearest point a little further round
function volcanoProgress(c, best) {
  const T = G.T, N = T.N, M = T.volcano.maze, y = Math.round(c.y);
  if (inMaze(T, c.x, c.y) && y >= 0 && y < T.H && M.rowIdx[y] >= 0) return M.rowIdx[y];
  let bi = best, bd = 1e9;
  for (let k = -200; k <= 200; k++) { const i = (c.idx + k + N) % N, p = T.path[i], d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (d < bd) { bd = d; bi = i; } }
  return bd < 22500 ? bi : best;
}

// ======================================================= event "lavastrom": the tongues of the maze

function updateTongues(T, dt) {
  const ev = T.ev, V = T.volcano, M = V.maze, t = ev.t;
  // a new lap (yours): the tongues of this lap run, the others cool
  const L = lapNow();
  if (G.state === 'race' && L !== ev.vlMzLap) {
    const set = M.laps[L - 1] || [];
    M.tongues.forEach((F, q) => {
      const f = ev.vlTongues[q], on = set.includes(q);
      if (on && (f.ph === 'idle' || f.ph === 'cool')) {
        if (f.ph === 'cool') for (let n = 0; n < f.i; n++) T.ter[F.J[n]] = F.old[n];
        f.ph = 'pre'; f.t0 = t; f.i = 0; f.kf = 0;
        if (!f.snap) { snap(T, F.x0 - 2, F.y0 - 2, F.W + 4, F.H + 4); f.snap = true; }
        if (near(F.gate.x, F.gate.y) < 420) SFX.rumble();
      } else if (!on && (f.ph === 'pre' || f.ph === 'flow' || f.ph === 'full')) {
        for (let n = 0; n < f.i; n++) T.ter[F.J[n]] = F.old[n];
        f.ph = 'cool'; f.tc = t; if (near(F.gate.x, F.gate.y) < 400) SFX.hiss(.6);
      }
    });
    ev.vlMzLap = L; ev.vlMzVer++;
  }
  M.tongues.forEach((F, q) => {
    const f = ev.vlTongues[q], v = clamp(1 - near(F.gate.x, F.gate.y) / 500, 0, 1);
    if (f.ph === 'pre') {
      if (Math.random() < dt * 16 && v > 0) addP({ t: 'd', x: F.gate.x, y: F.gate.y, z: 6, vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 30, vz: 60 + Math.random() * 40, col: Math.random() < .5 ? '#ffd04a' : '#ff7a1a', s: 2, life: .6, ml: .6 });
      if (G.player && Math.hypot(F.gate.x - G.player.x, F.gate.y - G.player.y) < 420) ev.vlAlarm = true;
      if (t - f.t0 < LAVA.pre) return;
      f.ph = 'flow'; if (v > .05) SFX.glut(v);
    }
    if (f.ph === 'flow') {
      // the front: every pixel it reaches is lava
      f.kf = Math.min(F.pts.length - 1, (t - f.t0 - LAVA.pre) * LAVA.v / 2);
      while (f.i < F.J.length && F.K[f.i] <= f.kf) T.ter[F.J[f.i++]] = 15;
      if (Math.random() < dt * 14 && v > 0) { const p = F.pts[Math.floor(f.kf)]; addP({ t: 'smoke', x: p.x + (Math.random() - .5) * 14, y: p.y - 4, vx: (Math.random() - .5) * 10, vy: -16, life: 1, ml: 1 }); }
      if (f.i >= F.J.length) f.ph = 'full';
    }
    if (f.ph === 'full' && Math.random() < dt * 3 && v > 0) { const p = F.pts[Math.floor(Math.random() * F.pts.length)]; addP({ t: 'smoke', x: p.x, y: p.y - 3, vx: 2, vy: -12, life: 1, ml: 1 }); }
    if (f.ph === 'cool') {
      if (Math.random() < dt * 10 && v > 0) { const p = F.pts[Math.floor(Math.random() * Math.min(F.pts.length, f.kf + 1))]; addP({ t: 'smoke', x: p.x + (Math.random() - .5) * 20, y: p.y, vx: 2, vy: -12, life: 1.1, ml: 1.1 }); }
      if (t - f.tc >= LAVA.cool) f.ph = 'idle';
    }
  });
}

// the nodes of the maze under lava (or about to be)
function blockedNodes(T) {
  const ev = T.ev, M = T.volcano.maze, out = new Set();
  if (!ev || !ev.vlTongues) return out;
  M.tongues.forEach((F, q) => { const ph = ev.vlTongues[q].ph; if (ph === 'pre' || ph === 'flow' || ph === 'full') F.nodes.forEach(n => out.add(n)); });
  return out;
}

// the way down from node `from` to Z through free nodes (a little different for every car: jitter); null if there is none
function mazeRoute(T, from, jit) {
  const M = T.volcano.maze, G2 = M.G, bl = blockedNodes(T), dist = { [from]: 0 }, prev = {}, todo = new Set(Object.keys(G2.nodes));
  while (todo.size) {
    let u = null; for (const n of todo) if (dist[n] !== undefined && (u === null || dist[n] < dist[u])) u = n;
    if (u === null || u === 'Z') break;
    todo.delete(u);
    for (const [w, q] of G2.adj[u]) {
      if (!todo.has(w) || (bl.has(w) && w !== 'Z')) continue;
      const nd = dist[u] + G2.edges[q].len * (1 + .45 * jit(q));
      if (dist[w] === undefined || nd < dist[w]) { dist[w] = nd; prev[w] = [u, q]; }
    }
  }
  if (dist.Z === undefined) return null;
  const nodes = ['Z'], pts = [];
  for (let n = 'Z'; n !== from; n = prev[n][0]) nodes.unshift(prev[n][0]);
  for (let k = 1; k < nodes.length; k++) {
    const e = G2.edges[prev[nodes[k]][1]], P = e.a === nodes[k - 1] ? e.pts : e.pts.slice().reverse();
    for (const p of P) pts.push(p);
  }
  return { nodes, pts };
}

// is there a way down at all (dev check of def.maze.laps, check.js)
export function mazeOpen(T, blocked) {
  const M = T.volcano.maze, seen = new Set(['A']), todo = ['A'];
  while (todo.length) { const n = todo.pop(); for (const [w] of M.G.adj[n]) if (!blocked.has(w) && !seen.has(w)) { seen.add(w); todo.push(w); } }
  return seen.has('Z');
}

function nearestNode(M, x, y, ok) {
  let b = null, bd = 1e9;
  for (const [n, [nx, ny]] of Object.entries(M.G.nodes)) { const dd = Math.hypot(nx - x, ny - y); if (dd < bd && (!ok || ok(n))) { bd = dd; b = n; } }
  return b;
}

// the computer cars in the maze: plan a way down through free gullies and follow it; plan again at every node and when the lava changes
function mazeTarget(c) {
  const T = G.T, M = T.volcano.maze, ev = T.ev, N = T.N, [ax, ay] = M.G.nodes.A, [zx, zy] = M.G.nodes.Z;
  const inside = inMaze(T, c.x, c.y);
  if (!c.vMz) {
    const ahead = (M.iA - c.idx + N) % N;
    if (!(inside || (ahead < 40 && Math.hypot(c.x - ax, c.y - ay) < 60))) return null;
    c.vMz = { at: inside ? nearestNode(M, c.x, c.y) : 'A', ver: -1, R: null, k: 0 };
  }
  const W = c.vMz;
  if (W.at === 'Z' || Math.hypot(c.x - zx, c.y - zy) < 24 || (!inside && Math.hypot(c.x - zx, c.y - zy) < 80 && c.x > zx)) { c.vMz = null; return null; }
  const seed = (c.seed * 1000) | 0, jit = q => hash(seed, q, 150);
  if (!W.R || W.ver !== (ev ? ev.vlMzVer : 0)) { W.R = mazeRoute(T, W.at, jit); W.k = 0; W.ver = ev ? ev.vlMzVer : 0; }
  if (!W.R) { const [nx, ny] = M.G.nodes[W.at]; return [nx, ny]; } // (no way down: wait at the node)
  // reached the next node: plan from there
  const nx = W.R.nodes[1];
  if (nx && Math.hypot(M.G.nodes[nx][0] - c.x, M.G.nodes[nx][1] - c.y) < M.nr - 6) { W.at = nx; W.R = mazeRoute(T, W.at, jit); W.k = 0; if (!W.R) return M.G.nodes[W.at].slice(); }
  const P = W.R.pts;
  let k = W.k, bd = 1e9;
  for (let q = W.k; q < Math.min(P.length, W.k + 40); q++) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  if (bd > 46 * 46) { W.at = nearestNode(M, c.x, c.y); W.R = null; return M.G.nodes[W.at].slice(); }
  W.k = k;
  const p = P[Math.min(P.length - 1, k + 10)];
  return [p.x, p.y];
}

// ======================================================= event "brueckenloch": the plates of the steel bridge

function updateHoles(T, dt) {
  const ev = T.ev, B = T.volcano.bridge, t = ev.t, L = lapNow();
  B.holes.forEach((H, q) => {
    const h = ev.vlHoles[q];
    if (h.ph === 'closed') {
      if (G.state !== 'race' || L < H.lap) return;
      if (h.due < 0) { const order = B.holes.filter(o => o.lap === H.lap).indexOf(H); h.due = t + .5 + order * HOLE.stagger; }
      if (t < h.due) return;
      h.ph = 'warn'; h.t0 = t; if (near(H.c.x, H.c.y) < 260) SFX.creak();
    }
    if (h.ph === 'warn') {
      if (G.player && Math.hypot(H.c.x - G.player.x, H.c.y - G.player.y) < 380) ev.vlAlarm = true;
      if (Math.random() < dt * 10 && near(H.c.x, H.c.y) < 300) addP({ t: 'd', x: H.c.x + (Math.random() - .5) * 18, y: H.c.y + (Math.random() - .5) * 18, z: 2, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, vz: 40, col: '#ffb040', s: 1, life: .4, ml: .4 });
      // (the plate holds while a car is on it)
      if (t - h.t0 < HOLE.warn || G.cars.some(c => !(c.fall > 0) && !(c.z > 0) && Math.hypot(c.x - H.c.x, c.y - H.c.y) < 15)) return;
      if (!h.snapped) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const j of H.J) { const x = j % T.W, y = (j / T.W) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } snap(T, x0, y0, x1 - x0 + 1, y1 - y0 + 1); h.snapped = true; }
      for (const j of H.J) T.ter[j] = 15;
      h.ph = 'open'; h.t0 = t;
      const v = clamp(1 - near(H.c.x, H.c.y) / 340, 0, 1); if (v > .02) { SFX.crunch(v); SFX.hiss(v * .5); }
      for (let i = 0; i < 14; i++) addP({ t: 'd', x: H.c.x, y: H.c.y, z: 2, vx: (Math.random() - .5) * 60, vy: (Math.random() - .5) * 60, vz: 50 + Math.random() * 40, col: i % 2 ? '#ffd04a' : '#ff7a1a', s: 2, life: .6, ml: .6 });
    }
  });
}

// who falls through a hole in the bridge (the core makes it a fall into the lava) tumbles down; a rescue helicopter brings the car back before the bridge
const onDeck = (T, x, y) => !!T.volcano.bridge.deckM[clamp(Math.round(y), 0, T.H - 1) * T.W + clamp(Math.round(x), 0, T.W - 1)];
function updateRescue(T, dt) {
  const B = T.volcano.bridge;
  for (const c of G.cars) {
    c.vHeliOut = Math.max(0, (c.vHeliOut || 0) - dt);
    if (!(c.fall > 0)) continue;
    if (c.fallKind === 'lava' && onDeck(T, c.fx0, c.fy0)) {
      // (set down 24 points before the row of holes it fell through: between two rows the deck is whole)
      const H = B.holes.reduce((b2, h) => (!b2 || Math.hypot(h.c.x - c.fx0, h.c.y - c.fy0) < Math.hypot(b2.c.x - c.fx0, b2.c.y - c.fy0) ? h : b2), null);
      c.vHeliI = H ? (H.i - 24 + T.N) % T.N : B.r0;
      // (and in the column that is whole in that row)
      const bl = H ? new Set(B.holes.filter((o, q) => o.i === H.i && T.ev.vlHoles[q].ph !== 'closed').map(o => o.col)) : new Set();
      c.vHeliO = ([0, -1, 1].find(k => !bl.has(k)) ?? 0) * 19;
      c.fallKind = 'bridge'; c.fall = c.fallT0 = HELI.t; c.respawnI = c.vHeliI; c.burnT = 0; c.vHeli = true; c.vSplash = false; c.vRotor = false; c.vHoleN = (c.vHoleN || 0) + 1;
      if (!c.ai) SFX.fall(1);
      G.parts = G.parts.filter(p => !(p.t === 'smoke' && Math.hypot(p.x - c.fx0, p.y - c.fy0) < 24)); // (the puff of the lava would hide the tumbling)
    }
    if (c.fallKind !== 'bridge') continue;
    const t = c.fallT0 - c.fall, v = c.ai ? clamp(1 - near(c.fx0, c.fy0) / 320, 0, .6) : 1;
    if (!c.vSplash && t > HELI.tumble) {
      c.vSplash = true; if (v > .02) SFX.burn(v);
      for (let i = 0; i < 18; i++) addP({ t: 'd', x: c.fx0, y: c.fy0 + 10, z: 2, vx: (Math.random() - .5) * 70, vy: (Math.random() - .5) * 50, vz: 60 + Math.random() * 60, col: ['#ff7a1a', '#ffd04a', '#fff2b0'][i % 3], s: 2, life: .7, ml: .7 });
    }
    if (!c.vRotor && t > HELI.come) { c.vRotor = true; if (v > .02) SFX.heli(v); }
  }
}

// ======================================================= event "ausbruch": fireballs on the serpentine

const inSpan = (i, [a, b]) => a <= b ? i >= a && i <= b : i >= a || i <= b;
const okIdx = (T, i) => inSpan(i, T.volcano.serp);
const canAim = (T, c) => !(c.finished || c.fall > 0 || c.z > 0 || c.vBay) && okIdx(T, c.idx);

function updateBalls(T, dt) {
  const ev = T.ev;
  if (G.state === 'race' && (ev.vlBallCd -= dt) <= 0) {
    const n = ev.vlBallN++, P = G.player, per = BALL.per[lapNow() - 1];
    ev.vlBallCd = per[0] + hash(n, 1, 130) * (per[1] - per[0]);
    // near a car (more often yours): where it will be on the road when the ball lands (along the centre line, so also in bends), a little to the side
    const ok = G.cars.filter(c => canAim(T, c)), c = !ok.length ? null : P && ok.includes(P) && hash(n, 2, 130) < .45 ? P : ok[Math.floor(hash(n, 3, 130) * ok.length)];
    if (c) {
      const N = T.N, f = BALL.warn * (.7 + hash(n, 4, 130) * .35), i0 = c.idx, p0 = T.path[i0], n0 = T.nrm[i0], side = clamp((c.x - p0.x) * n0.x + (c.y - p0.y) * n0.y, -HALF, HALF);
      const i = (i0 + Math.round(Math.hypot(c.vx, c.vy) * f / 2)) % N, p = T.path[i], o = clamp(side + (hash(n, 5, 130) - .5) * 34, -HALF, HALF);
      const x = p.x + T.nrm[i].x * o, y = p.y + T.nrm[i].y * o, j = Math.round(y) * T.W + Math.round(x), t = T.ter[j];
      if (x > 10 && y > 10 && x < T.W - 10 && y < T.H - 10 && (t === 0 || t === 1) && okIdx(T, T.near[j])) ev.vlBalls.push({ x, y, t: 0, whistle: false });
    }
  }
  for (let q = ev.vlBalls.length - 1; q >= 0; q--) {
    const b = ev.vlBalls[q]; b.t += dt;
    if (!b.whistle && b.t > BALL.warn - .9) { b.whistle = true; if (near(b.x, b.y) < 300) SFX.bombWhistle(); }
    if (b.t < BALL.warn) continue;
    ev.vlBalls.splice(q, 1);
    // the impact: who is in it is pushed away and catches fire; then it burns there for a moment
    for (const c of G.cars) {
      if (c.fall > 0 || c.z > 0) continue;
      const dx = c.x - b.x, dy = c.y - b.y, d = Math.hypot(dx, dy); if (d > BALL.r) continue;
      c.vx += (d ? dx / d : 1) * 90; c.vy += (d ? dy / d : 0) * 90; c.boost = 0; ignite(c);
      if (!c.ai) { SFX.crash(); G.jumpShake = Math.max(G.jumpShake, .4); }
    }
    for (let i = 0; i < 24; i++) addP({ t: 'd', x: b.x, y: b.y, z: 4, vx: Math.cos(i / 24 * TAU) * (40 + Math.random() * 60), vy: Math.sin(i / 24 * TAU) * (40 + Math.random() * 60), vz: 70, col: ['#ff7a1a', '#ffd04a', '#3a3836'][i % 3], s: 2, life: .7, ml: .7 });
    if (near(b.x, b.y) < 380) SFX.boom(clamp(1 - near(b.x, b.y) / 380, .2, 1));
    ev.vlFires.push({ x: b.x, y: b.y, t: 0, seed: (b.x * 7 + b.y * 3) | 0 });
  }
  for (let q = ev.vlFires.length - 1; q >= 0; q--) {
    const f = ev.vlFires[q]; f.t += dt; if (f.t > FIRE.life) { ev.vlFires.splice(q, 1); continue; }
    for (const c of G.cars) if (!(c.fall > 0) && !(c.z > 0) && Math.hypot(c.x - f.x, c.y - f.y) < FIRE.r + 4) ignite(c);
    if (Math.random() < dt * 6 && near(f.x, f.y) < 300) addP({ t: 'smoke', x: f.x + (Math.random() - .5) * 16, y: f.y - 6, vx: (Math.random() - .5) * 8, vy: -18, life: 1, ml: 1 });
  }
}

// a car catches fire (once: a burning car does not catch fire again)
function ignite(c) {
  if (c.vFire > 0) return;
  c.vFire = .001; c.vExt = false;
  const v = c.ai ? clamp(1 - near(c.x, c.y) / 300, 0, .5) : 1; if (v > .02) SFX.ignite(v);
}

// a burning car: smoke, a little slower (physics.js), after FIRE.burn s the driver leans out and puts it out; then the car is half white with foam
function updateBurning(dt) {
  for (const c of G.cars) {
    if (!(c.vFire > 0)) continue;
    if (c.fall > 0) { c.vFire = 0; c.vExt = false; continue; }
    c.vFire += dt;
    if (Math.random() < dt * 16) addP({ t: 'smoke', x: c.x + (Math.random() - .5) * 8, y: c.y - 4, vx: (Math.random() - .5) * 10 - c.vx * .2, vy: -16 - c.vy * .2, life: .9, ml: .9 });
    if (!c.vExt && c.vFire > FIRE.burn) { c.vExt = true; const v = c.ai ? clamp(1 - near(c.x, c.y) / 260, 0, .4) : 1; if (v > .02) SFX.hiss(v); }
    if (c.vFire > FIRE.burn + FIRE.ext) {
      c.vFire = 0; c.vExt = false; c.dirt = Math.max(c.dirt, Math.min(FIRE.most, Math.max(c.dirt + .15, FIRE.foam))); c.cem = !!c.Fc;
      for (let i = 0; i < 10; i++) addP({ t: 'd', x: c.x, y: c.y, z: 4, vx: (Math.random() - .5) * 50, vy: (Math.random() - .5) * 50, vz: 30, col: i % 2 ? '#ffffff' : '#dfe8ee', s: 2, life: .5, ml: .5 });
    }
  }
}

// ======================================================= the computer cars

// follow the points of a lane (the bay) from where the car is: null when it is at the end or far off it
function follow(c, W, P) {
  let k = W.k, bd = 1e9;
  for (let q = W.k; q < Math.min(P.length, W.k + 30); q++) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  W.k = k;
  if (k >= P.length - 4 || bd > 70 * 70 || (G.state !== 'race' && G.state !== 'finish')) return null;
  const p = P[Math.min(P.length - 1, k + 9)];
  return [p.x, p.y];
}

const dirtyAt = () => [.4, .55, .7][G.raceDiff || 0];

// a dirty computer car turns into the fire brigade's bay beside the start straight (the same limits as the desert and the ice); in the maze it finds its way
function volcanoTarget(c) {
  const T = G.T, B = T.volcano.bay, N = T.N;
  if (B) {
    if (!c.vBay && (G.state === 'race' || G.state === 'finish') && c.dirt > dirtyAt() && (B.i0 - c.idx + N) % N < 40) c.vBay = { k: 0 };
    if (c.vBay) { const p = follow(c, c.vBay, B.P); if (!p) c.vBay = null; else return p; }
  }
  return mazeTarget(c);
}

// on the bridge they pick a column of plates that is whole (most of them: 86 / 93 / 98 % on LEICHT / MITTEL / SCHWER each hole, a new chance after every fall); on the serpentine they steer
// away from where a fireball will land and from fires, but not always (35 / 55 / 75 %), so that the computer cars burn too
function volcanoLane(c, i, lane) {
  const T = G.T, V = T.volcano, ev = T.ev, N = T.N, p = T.path[i], n = T.nrm[i]; if (!ev) return lane;
  if (ev.vlHoleOn && inSpan(c.idx, [(V.bridge.deckBig[0] - 40 + N) % N, V.bridge.deckBig[1]])) {
    const see = [.86, .93, .98][G.raceDiff || 0], seed = (c.seed * 100) | 0;
    const holes = V.bridge.holes.filter((H, q) => (ev.vlHoles[q].ph === 'warn' || ev.vlHoles[q].ph === 'open') && hash(seed, q * 13 + (c.vHoleN || 0), 151) < see); // (a new chance after every fall)
    // (the next row of holes the car has not passed: the column that is whole there)
    const ahead = H => { const a = (H.i - c.idx + N) % N; return a > N / 2 ? a - N : a; };
    const next = holes.filter(H => ahead(H) > -7 && ahead(H) < 70).reduce((b, H) => (!b || ahead(H) < ahead(b) ? H : b), null);
    if (!next) return lane * .5;
    const bl = new Set(holes.filter(H => H.i === next.i).map(H => H.col));
    const p0 = T.path[c.idx], n0 = T.nrm[c.idx], o = (c.x - p0.x) * n0.x + (c.y - p0.y) * n0.y;
    let best = 0, bd = 1e9; for (const col of [-1, 0, 1]) if (!bl.has(col) && Math.abs(col * 19 - o) < bd) { bd = Math.abs(col * 19 - o); best = col; }
    return best * 22; // (a little beyond the middle of the column: the car gets there sooner)
  }
  if (!inSpan(i, V.serp)) return lane;
  const see = [.35, .55, .75][G.raceDiff || 0];
  for (const b of ev.vlBalls.concat(ev.vlFires)) {
    const x = p.x + n.x * lane, y = p.y + n.y * lane; if (Math.hypot(x - b.x, y - b.y) > BALL.r + 8 || hash((c.seed * 100) | 0, (b.x * 3 + b.y) | 0, 132) > see) continue;
    const o = (b.x - p.x) * n.x + (b.y - p.y) * n.y; return clamp(o > 0 ? o - 30 : o + 30, -26, 26);
  }
  return lane;
}

// slowly through the bay and the gullies, a little less gas on the bridge with holes, before the hairpins of the serpentine
function volcanoThrottle(c, thr) {
  if (c.vBay) return Math.min(thr, .6);
  if (c.vMz) return c.vMz.R ? thr * .8 : Math.min(thr, .15);
  const T = G.T, V = T.volcano, N = T.N, i = c.idx;
  if (T.ev && T.ev.vlHoleOn && inSpan(i, V.bridge.deckBig) && T.ev.vlHoles.some(h => h.ph !== 'closed')) return thr * [.62, .72, .82][G.raceDiff || 0];
  if (!inSpan(i, V.serp)) return thr;
  const a = Math.atan2(T.tan[i].y, T.tan[i].x), b = Math.atan2(T.tan[(i + 34) % N].y, T.tan[(i + 34) % N].x);
  return thr * (1 - clamp((Math.abs(angDiff(a, b)) - .5) / 1.6, 0, .4));
}

// back on the road: after the bridge the helicopter flies off; in the maze the car is set down on the nearest free node above where it fell (turned
// towards the way down); a puff of smoke after the lava
function volcanoRespawn(c) {
  const T = G.T, M = T.volcano.maze;
  c.vFire = 0; c.vExt = false; c.cem = false; c.vMz = null;
  if (c.vHeli) {
    c.vHeli = false; c.vHeliOut = HELI.out;
    const i = c.vHeliI ?? c.idx, o = c.vHeliO || 0; c.x = T.path[i].x + T.nrm[i].x * o; c.y = T.path[i].y + T.nrm[i].y * o;
    return;
  }
  const fx = c.fx0 ?? c.x, fy = c.fy0 ?? c.y;
  if (inMaze(T, fx, fy)) {
    const bl = blockedNodes(T), n = nearestNode(M, fx, fy - 20, k => !bl.has(k) && M.G.nodes[k][1] <= fy + 30 && k !== 'Z' && !!mazeRoute(T, k, () => 0)) || 'A';
    const R = mazeRoute(T, n, () => 0), [x, y] = M.G.nodes[n], nx = R && R.pts[12];
    c.x = x; c.y = y; if (nx) c.ang = Math.atan2(nx.y - y, nx.x - x);
    const yi = Math.round(y); if (M.rowIdx[yi] >= 0) { c.idx = M.rowIdx[yi]; c.safe = c.idx; }
  }
  for (let i = 0; i < 10; i++) addP({ t: 'smoke', x: c.x + (Math.random() - .5) * 16, y: c.y + (Math.random() - .5) * 12, vx: (Math.random() - .5) * 16, vy: -10, life: .8, ml: .8 });
}

// ======================================================= drawing

function drawVolcanoGround() {
  const T = G.T, V = T.volcano, ev = T.ev, k = Math.floor(G.time * 4);
  // the lava shimmers
  for (let q = 0; q < 90 && V.lavaPix.length; q++) { const p = V.lavaPix[(hash(q, k, 102) * V.lavaPix.length) | 0]; R1(p % T.W, (p / T.W) | 0, 2, 1, q % 3 ? '#ffe27a' : '#fff4c0'); }
  // bubbles burst on the crater lake; a fountain bubbles hard before it spouts
  const [cx, cy, crx, cry] = V.crater;
  if (inView(cx, cy, 200)) {
    for (let q = 0; q < 10; q++) {
      const ph = (G.time * .7 + q * .37) % 1, a = hash(q, Math.floor(G.time * .7 + q * .37), 104) * TAU, rr = Math.sqrt(hash(q, Math.floor(G.time * .7 + q * .37), 105)) * .75;
      const x = Math.round(cx + Math.cos(a) * crx * rr), y = Math.round(cy + Math.sin(a) * cry * rr), r = Math.round(1 + ph * 4);
      if (ph < .8) { ctx.globalAlpha = .9; disc(x, y, r, '#ffd04a'); R1(x - 1, y - r, 2, 1, '#fff4c0'); } else { ctx.globalAlpha = 1 - (ph - .8) * 5; for (let s = 0; s < 6; s++) R1(Math.round(x + Math.cos(s) * 6), Math.round(y + Math.sin(s) * 6), 1, 1, '#ffd04a'); }
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = .1 + .06 * Math.sin(G.time * 1.7); ell(cx, cy, crx - 30, cry - 20, '#ffb040'); ctx.globalAlpha = 1;
    V.fountains.forEach(([x, y], q) => { const f = fountain(q); if (f.warn) { ctx.globalAlpha = .6 + .3 * Math.sin(G.time * 25); disc(x, y, 5 + Math.round(f.u * 4), '#fff4c0'); ctx.globalAlpha = 1; } });
  }
  if (ev.vlTongues) drawTongues(T, V, ev);
  if (ev.vlHoles) drawHoles(T, V, ev);
  // fires on the ground: scorched and glowing; the shadow of a fireball grows and darkens before it lands
  for (const f of ev.vlFires) {
    if (!inView(f.x, f.y)) continue;
    const a = clamp((FIRE.life - f.t) / .6, 0, 1);
    ctx.globalAlpha = .55 * a; ell(Math.round(f.x), Math.round(f.y), FIRE.r + 4, FIRE.r + 1, '#1a0c08');
    ctx.globalAlpha = (.5 + .15 * Math.sin(G.time * 13 + f.seed)) * a; ell(Math.round(f.x), Math.round(f.y), FIRE.r, FIRE.r - 3, '#ff6a1a');
    ctx.globalAlpha = (.5 + .2 * Math.sin(G.time * 17 + f.seed)) * a; ell(Math.round(f.x), Math.round(f.y), FIRE.r - 5, FIRE.r - 7, '#ffd04a');
    ctx.globalAlpha = 1;
  }
  for (const b of ev.vlBalls) {
    if (!inView(b.x, b.y)) continue;
    const u = clamp(b.t / BALL.warn, 0, 1), r = Math.round(4 + u * (BALL.r - 2));
    ctx.globalAlpha = .25 + .45 * u; ell(Math.round(b.x), Math.round(b.y), r, Math.round(r * .75), '#000');
    ctx.globalAlpha = .3 + .5 * u * u; ell(Math.round(b.x), Math.round(b.y), Math.round(r * .6), Math.round(r * .45), '#000');
    if (u > .7 && ((G.time * 12) | 0) % 2) { ctx.globalAlpha = .6; for (let a = 0; a < TAU; a += .2) R1(Math.round(b.x + Math.cos(a) * (r + 2)), Math.round(b.y + Math.sin(a) * (r + 2) * .75), 1, 1, '#ff6a1a'); }
    ctx.globalAlpha = 1;
  }
  // the seismograph of the scientists: the needle jumps when it rumbles
  const C = V.camp;
  if (C && inView(C.x, C.y, 200)) {
    const s = C.seis, a = Math.sin(G.time * 40) * (ev.vlQuake > 0 || ev.vlErupt ? 4 : .6);
    R1(s.x - 1, s.y - 1, 11, 7, '#1b120c'); R1(s.x, s.y, 9, 5, '#f4f0e8'); R1(s.x + 4 + Math.round(a), s.y + 1, 1, 3, '#d83a2c');
  }
}

// the lava of a tongue: down the gullies as far as the front, a glow round it; then the crust that cools
function drawTongues(T, V, ev) {
  V.maze.tongues.forEach((F, q) => {
    const f = ev.vlTongues[q]; if (!inView(F.x0 + F.W / 2, F.y0 + F.H / 2, Math.max(F.W, F.H) / 2 + 30)) return;
    if (f.ph === 'flow' || f.ph === 'full' || f.ph === 'cool') {
      const kf = Math.floor(f.kf), a = f.ph === 'cool' ? clamp(1 - (ev.t - f.tc) / LAVA.cool, 0, 1) : 1;
      if (f.ph !== 'cool') { ctx.globalAlpha = .12 + .04 * Math.sin(G.time * 3 + q); for (let k = 0; k <= kf; k += 8) { const p = F.pts[k]; disc(Math.round(p.x), Math.round(p.y), Math.round(p.w + 8), '#ff7a24'); } ctx.globalAlpha = 1; }
      ctx.save(); ctx.beginPath();
      for (let k = 0; k <= kf; k += 2) { const p = F.pts[k]; ctx.moveTo(p.x + p.w + 4, p.y); ctx.arc(p.x, p.y, p.w + 4, 0, TAU); }
      ctx.clip(); ctx.globalAlpha = a; ctx.drawImage(f.ph === 'cool' ? F.crust : F.lava, F.x0, F.y0); ctx.restore(); ctx.globalAlpha = 1;
      if (f.ph === 'flow') {
        const p = F.pts[kf]; ctx.globalAlpha = .7 + .3 * Math.sin(G.time * 20); disc(Math.round(p.x), Math.round(p.y), Math.round(p.w * .6), '#fff2b0'); ctx.globalAlpha = 1;
      }
      if (f.ph !== 'cool') for (let s = 0; s < 10; s++) { const k2 = Math.floor(hash(s, Math.floor(G.time * 6), q + 170) * (kf + 1)), r = F.pts[k2]; R1(Math.round(r.x + (hash(s, 2, 171) - .5) * r.w), Math.round(r.y + (hash(s, 3, 171) - .5) * r.w), 2, 1, s % 3 ? '#ffe27a' : '#fff4c0'); }
    }
    // the gate glows, harder before the lava comes
    const g = F.gate, hot = f.ph === 'pre' ? 1 : f.ph === 'flow' || f.ph === 'full' ? .6 : .2;
    ctx.globalAlpha = (.2 + .14 * Math.sin(G.time * (4 + hot * 10) + q)) * (.6 + hot); disc(g.x, g.y, Math.round(8 + hot * 7), '#ff7a24'); ctx.globalAlpha = 1;
  });
}

// the holes in the bridge: the lava far below glows through, a girder crosses it; a plate that is about to fall shakes and glows red, then it drops
function drawHoles(T, V, ev) {
  V.bridge.holes.forEach((H, q) => {
    const h = ev.vlHoles[q]; if (h.ph === 'closed' || !inView(H.c.x, H.c.y, 30)) return;
    const P = H.P, poly = (pts, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y); ctx.closePath(); ctx.fill(); };
    const shrink = (f, dx = 0, dy = 0) => P.map(p => ({ x: H.c.x + (p.x - H.c.x) * f + dx, y: H.c.y + (p.y - H.c.y) * f + dy }));
    if (h.ph === 'warn') {
      const u = (ev.t - h.t0) / HOLE.warn, j = ((G.time * 30) | 0) % 2 ? 1 : -1;
      ctx.globalAlpha = .25 + .35 * u + .2 * Math.sin(G.time * 22); poly(shrink(1, j * u, 0), '#ff3a1a'); ctx.globalAlpha = 1;
      ctx.strokeStyle = ((G.time * 8) | 0) % 2 ? '#ffd04a' : '#5a1810'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y); for (const p of P.slice(1)) ctx.lineTo(p.x, p.y); ctx.closePath(); ctx.stroke();
      return;
    }
    // open: the torn edge of the deck, a deep dark shaft (darker on its north-west side, in its own shadow), far below the lava glows dim and flickers,
    // two girders of the bridge cross it below the deck; the plate falls for a moment
    poly(shrink(1.05), '#141010');
    poly(shrink(.9), '#3a1610');
    ctx.globalAlpha = .75 + .15 * Math.sin(G.time * 5 + q); poly(shrink(.62, 1.5, 1.5), '#8a2a0e');
    ctx.globalAlpha = .45 + .3 * Math.sin(G.time * 7 + q); poly(shrink(.36, 2, 2), '#e0601a');
    ctx.globalAlpha = .25 + .3 * Math.sin(G.time * 11 + q * 2); poly(shrink(.16, 2, 2), '#ffb040'); ctx.globalAlpha = 1;
    const lerp = (a, b, f) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
    ctx.strokeStyle = '#1c2422'; ctx.lineWidth = 2;
    for (const f of [.3, .72]) { const a = lerp(P[0], P[1], f), b = lerp(P[3], P[2], f); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    ctx.lineWidth = 1;
    // (jagged bits of the torn plate along the edge)
    for (let s = 0; s < 4; s++) { const a = lerp(P[s], P[(s + 1) % 4], .25 + hash(q, s, 172) * .5); R1(Math.round(a.x + (H.c.x - a.x) * .1), Math.round(a.y + (H.c.y - a.y) * .1), 2, 2, '#646e76'); }
    const u = (ev.t - h.t0) / HOLE.fall;
    if (u < 1) { ctx.globalAlpha = 1 - u; poly(shrink(1 - u * .7, Math.sin(u * 9) * 2, u * 8), '#8c969e'); ctx.globalAlpha = 1; }
  });
}

// a lava fountain in the lake: every 5 to 8 s it bubbles (warn) and then spouts for 1.4 s; more often in the last lap
function fountain(q) {
  const last = G.player && G.player.lap >= LAPS && G.T.ev && G.T.ev.vlErupt, per = (last ? 3.2 : 5.5) + q * .9, t = (G.time + q * 1.7) % per, s = per - 1.4;
  return { warn: t > s - 1.1 && t < s, on: t >= s, u: t >= s ? (t - s) / 1.4 : (t - (s - 1.1)) / 1.1, big: last };
}

// a helicopter seen from above (red and white; rot = where its nose points; k = size, the rescue helicopter is twice as big as a car), its shadow far below
function heli(x, y, rot, shadow, k = 2) {
  x = Math.round(x); y = Math.round(y);
  if (shadow) { ctx.globalAlpha = .22; ell(x + 26, y + 44, 9 * k, 5 * k, '#000'); ctx.globalAlpha = 1; }
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  const fx = Math.cos(rot), fy = Math.sin(rot), P = (a, s) => [Math.round(fx * a - fy * s), Math.round(fy * a + fx * s)];
  for (let a = -16; a <= -5; a++) { const [px, py] = P(a, 0); R1(px, py, 2, 2, a < -13 ? '#f0ece4' : '#c8281a'); }
  const [tx, ty] = P(-16, 0), tr = G.time * 60; R1(Math.round(tx + Math.cos(tr) * 3), Math.round(ty + Math.sin(tr) * 3), 1, 1, '#2a2a30');
  for (let a = -6; a <= 7; a++) for (let s = -4; s <= 4; s++) { if ((a / 7) ** 2 + (s / 4.5) ** 2 > 1) continue; const [px, py] = P(a, s); R1(px, py, 1, 1, a > 3 ? '#8fd3f4' : Math.abs(s) < 1.5 ? '#f0ece4' : '#d83a2c'); }
  const rr = G.time * 32;
  ctx.fillStyle = '#2a2a30';
  for (const s of [0, Math.PI / 2]) { const dx = Math.cos(rr + s) * 15, dy = Math.sin(rr + s) * 15; for (let q = -1; q <= 1; q += .07) ctx.fillRect(Math.round(dx * q), Math.round(-1 + dy * q), 1, 1); }
  R1(-1, -2, 2, 2, '#1b1612');
  ctx.restore();
}

// the fall through the bridge: the car tumbles down (turning over and over, smaller), splashes into the lava; then it hangs on the rope of the helicopter
// that brings it back to the deck before that row of holes (the helicopter itself: drawVolcanoAbove)
function rescuePos(c) {
  const T = G.T, i = c.vHeliI ?? T.volcano.bridge.r0, o = c.vHeliO || 0, R = { x: T.path[i].x + T.nrm[i].x * o, y: T.path[i].y + T.nrm[i].y * o }, t = c.fallT0 - c.fall, u = clamp((t - HELI.come) / (HELI.t - HELI.come - .1), 0, 1), e = 1 - (1 - u) * (1 - u);
  return { x: R.x + 190 * (1 - e), y: R.y - 30 - 150 * (1 - e) + Math.sin(u * 9) * 2 * (1 - u), u, R };
}
function drawBridgeFall(c, F, lv) {
  const t = c.fallT0 - c.fall;
  if (c.fallKind === 'lava' || t < HELI.tumble) {
    const u = clamp(t / HELI.tumble, 0, 1), x = c.fx0 + (c.dvx || 0) * .2 * u, y = c.fy0 + (c.dvy || 0) * .2 * u + 8 * u * u, S = SS * (1 - .5 * u), flip = Math.cos(u * Math.PI * 3);
    const h = Math.max(2, Math.round(S * Math.max(.15, Math.abs(flip))));
    ctx.globalAlpha = 1 - .4 * u; ctx.drawImage(F.frames[Math.min(5, lv + (flip < 0 ? 1 : 0))][rotIndex(c.ang + u * 7)], Math.round(x - S / 2), Math.round(y - h / 2), Math.round(S), h); ctx.globalAlpha = 1;
    return;
  }
  if (t < HELI.come) return;
  const P = rescuePos(c), T = G.T, tg = T.tan[c.vHeliI ?? T.volcano.bridge.r0], S = Math.round(SS * (1.15 - .15 * P.u));
  ctx.strokeStyle = '#2a2624'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(P.x) + .5, Math.round(P.y) + .5); ctx.lineTo(Math.round(P.x) + .5, Math.round(P.y + 24) + .5); ctx.stroke();
  ctx.drawImage(F.frames[lv][rotIndex(Math.atan2(tg.y, tg.x) + Math.sin(G.time * 3) * .15)], Math.round(P.x - S / 2), Math.round(P.y + 30 - S / 2), S, S);
}

// over the cars: lava fountains, fireballs, fires, burning cars and their extinguishers, the hornitos, the smoke, the helicopters, the base camp, words
function drawVolcanoAbove() {
  const T = G.T, V = T.volcano, ev = T.ev, P = G.player;
  V.fountains.forEach(([x, y], q) => {
    const f = fountain(q); if (!f.on || !inView(x, y, 60)) return;
    const hgt = f.big ? 46 : 30;
    for (let d = 0; d < 14; d++) {
      const a = hash(q, d, 110) * TAU, sp = 4 + hash(d, q, 111) * 10, u = clamp(f.u * 1.2 - hash(d, 2, 112) * .2, 0, 1);
      const dx = Math.cos(a) * sp * u * 2, dy = Math.sin(a) * sp * u, h = hgt * 4 * u * (1 - u) * (.6 + hash(d, 3, 113) * .4);
      R1(Math.round(x + dx), Math.round(y + dy - h), 2, 2, d % 3 ? '#ffa21f' : '#ffe27a');
    }
  });
  for (const h of V.hornitos) if (inView(h.x, h.y, 20)) { ctx.globalAlpha = .25 + .2 * Math.sin(G.time * 3 + h.x); disc(Math.round(h.x), Math.round(h.y), 6, '#ff7a24'); ctx.globalAlpha = 1; }
  // the warning signs before the bridge blink while plates are falling; "LAVA!" at a gate before its tongue runs
  if (ev.vlHoles && ev.vlHoles.some(h => h.ph === 'warn')) for (const s of V.signs) if (inView(s.x, s.y, 30) && ((G.time * 4) | 0) % 2) { ctx.globalAlpha = .5; disc(s.x, s.y - 22, 9, '#ff3b2a'); ctx.globalAlpha = 1; }
  if (ev.vlTongues) V.maze.tongues.forEach((F, q) => { if (ev.vlTongues[q].ph === 'pre' && P && near(F.gate.x, F.gate.y) < 320 && ((G.time * 4) | 0) % 2 === 0) text('LAVA!', F.gate.x, F.gate.y - 18, 8, '#ff9a3a', 'center'); });
  if (ev.vlHoles && P && ev.vlHoles.some(h => h.ph === 'warn')) { const H = V.bridge.holes.find((_, q) => ev.vlHoles[q].ph === 'warn'); if (H && near(H.c.x, H.c.y) < 320 && ((G.time * 4) | 0) % 2 === 0) text('ES KNACKT!', Math.round(H.c.x), Math.round(H.c.y - 26), 8, '#ff9a3a', 'center'); }
  // fires on the ground: tongues of flame
  for (const f of ev.vlFires) {
    if (!inView(f.x, f.y)) continue;
    const a = clamp((FIRE.life - f.t) / .6, 0, 1) * clamp(f.t / .15, 0, 1);
    for (let q = 0; q < 13; q++) {
      const ang = hash(q, f.seed, 140) * TAU, rr = Math.sqrt(hash(q, f.seed, 141)) * (FIRE.r - 2);
      flame(f.x + Math.cos(ang) * rr, f.y + Math.sin(ang) * rr * .75, (8 + hash(q, Math.floor(G.time * 12), f.seed) * 10) * a, q, 3);
    }
  }
  // burning cars: flames on the body; while it is put out the driver leans out of the window with an extinguisher and sprays foam on them
  for (const c of G.cars) {
    if (!(c.vFire > 0) || c.fall > 0 || !inView(c.x, c.y)) continue;
    const out = c.vExt ? clamp(1 - (c.vFire - FIRE.burn) / FIRE.ext, 0, 1) : 1, fx = Math.cos(c.ang), fy = Math.sin(c.ang);
    ctx.globalAlpha = .3 * out; disc(Math.round(c.x), Math.round(c.y - 2), 15, '#ff7a1a'); ctx.globalAlpha = 1;
    for (let q = 0; q < 8; q++) {
      const al = (hash(q, 1, 142) - .5) * 16, ac = (hash(q, 2, 142) - .5) * 8;
      flame(c.x + fx * al - fy * ac, c.y + fy * al + fx * ac - 1, (7 + hash(q, Math.floor(G.time * 14), 143) * 9) * (.2 + .8 * out), q, 3);
    }
    if (c.vExt) extinguisher(c, fx, fy, out);
  }
  // fireballs: they fall out of the sky from the direction of the crater, glowing, with a trail of smoke and sparks
  const [cx, cy] = V.crater;
  for (const b of ev.vlBalls) {
    const u = b.t / BALL.warn; if (u < .2 || !inView(b.x, b.y, 120)) continue;
    const dx = cx - b.x, dy = cy - b.y, dl = Math.hypot(dx, dy) || 1, far = Math.min(160, dl * .5);
    const at = v => [b.x + dx / dl * far * (1 - v), b.y + dy / dl * far * (1 - v) - BALL.h * Math.pow(1 - v, 1.2)];
    for (let q = 8; q >= 1; q--) { const [tx, ty] = at(Math.max(0, u - q * .03)); ctx.globalAlpha = .6 - q * .06; disc(Math.round(tx), Math.round(ty), 6 - (q >> 1), q < 3 ? '#ff7a1a' : '#6a5a54'); }
    const [x, y] = at(u);
    ctx.globalAlpha = .35; disc(Math.round(x), Math.round(y), 13, '#ffb040'); ctx.globalAlpha = 1;
    disc(Math.round(x), Math.round(y), 7, '#3a1a10'); disc(Math.round(x), Math.round(y), 6, '#ff7a1a'); disc(Math.round(x) - 1, Math.round(y) - 1, 3, '#ffd04a'); R1(Math.round(x) - 2, Math.round(y) - 3, 2, 2, '#fff4c0');
    if (Math.random() < .5) addP({ t: 'd', x, y: y + 40, z: 40, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, vz: 10, col: '#ffb040', s: 1, life: .4, ml: .4 });
  }
  ctx.globalAlpha = 1;
  // the volcano smokes; in the eruption a big dark column rises out of the crater
  if (inView(cx, cy, 200)) {
    const big = !!ev.vlErupt;
    for (let q = 0; q < (big ? 16 : 6); q++) {
      const ph = (G.time * (big ? .35 : .2) + q / (big ? 16 : 6)) % 1, x = cx + Math.sin(q * 2.1 + G.time * .3) * (10 + ph * 30) + ph * 40, y = cy - 40 - ph * (big ? 200 : 110);
      ctx.globalAlpha = (1 - ph) * (big ? .55 : .3); disc(Math.round(x), Math.round(y), Math.round((big ? 12 : 7) + ph * (big ? 26 : 14)), big ? '#3a3432' : '#8a8682');
    }
    ctx.globalAlpha = 1;
  }
  // in the eruption a helicopter of the press circles over the crater
  if (ev.vlErupt) { const a = G.time * .5, x = cx + Math.cos(a) * 200, y = cy + 40 + Math.sin(a) * 90; if (inView(x, y, 40)) heli(x, y, a + Math.PI / 2, true, 1.5); }
  // the rescue helicopter: it brings a car that fell through the bridge and flies off again
  for (const c of G.cars) {
    if (c.fall > 0 && c.fallKind === 'bridge' && c.fallT0 - c.fall >= HELI.come) { const p = rescuePos(c); if (inView(p.x, p.y, 40)) heli(p.x, p.y, Math.PI * .8, true); }
    else if (c.vHeliOut > 0) {
      const u = 1 - c.vHeliOut / HELI.out, x = c.x - 160 * u * u, y = c.y - 30 - 150 * u * u;
      if (inView(x, y, 40)) { ctx.strokeStyle = '#2a2624'; ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, Math.round(y) + .5); ctx.lineTo(Math.round(x) + .5, Math.round(y + 24 * (1 - u)) + .5); ctx.stroke(); heli(x, y, Math.PI * 1.2, true); }
    }
  }
  drawCamp(V);
  drawCrew(V);
  for (const c of G.cars) if (c.burnT > 0) text('AUA, HEISS!', Math.round(c.fx0 || c.x), Math.round((c.fy0 || c.y) - 24 - (1.3 - c.burnT) * 10), 8, '#ffb02e', 'center');
  if (P && P.vFire > 0 && !(P.fall > 0)) text(P.vExt ? 'PFFFT!' : 'ES BRENNT!', Math.round(P.x), Math.round(P.y - 44), 8, P.vExt ? '#f4f8fa' : '#ff8a3a', 'center');
  if (P && P.fall > 0 && P.fallKind === 'bridge' && P.fallT0 - P.fall > HELI.come) text('HILFE KOMMT!', Math.round(P.fx0), Math.round(P.fy0 - 30), 8, '#f4f8fa', 'center');
  const B = V.bay; if (B && inView(B.sign[0], B.sign[1], 120)) text('FEUERWEHR', B.sign[0], B.sign[1] - 30, 6, '#ff6b5a', 'center');
}

// one tongue of flame standing on (x, y), h px high: red at the foot, orange, yellow at the tip, swaying
function flame(x, y, h, q, w0 = 2) {
  if (h < 1) return;
  const sw = Math.sin(G.time * 11 + q * 1.7);
  for (let s = 0; s < h; s++) {
    const f = s / h, w = f < .3 ? w0 : f < .7 ? Math.max(1, w0 - 1) : 1, col = f < .25 ? '#c8281a' : f < .6 ? '#ff7a1a' : f < .85 ? '#ffc040' : '#fff0a0';
    R1(Math.round(x + sw * f * 2) - (w >> 1), Math.round(y - s), w, 1, col);
  }
}

// the driver leans out of the window on the left and sprays foam over the car with a red extinguisher
function extinguisher(c, fx, fy, out) {
  const lx = fy, ly = -fx, hx = c.x + fx * 1 + lx * 8, hy = c.y + fy * 1 + ly * 8;
  const X = Math.round(hx), Y = Math.round(hy);
  R1(X - 3, Y - 2, 6, 4, '#2a3a6a');
  R1(X - 2, Y - 7, 5, 5, '#1b1612'); R1(X - 1, Y - 6, 3, 4, '#f0c49a'); R1(X - 1, Y - 7, 3, 2, '#4a2e1a'); R1(X, Y - 5, 1, 1, '#1b1612');
  const ex = hx + lx * 5 + fx * 3, ey = hy + ly * 5 + fy * 3, EX = Math.round(ex), EY = Math.round(ey);
  R1(EX - 2, EY - 4, 4, 7, '#1b1612'); R1(EX - 1, EY - 3, 2, 5, '#e0402e'); R1(EX - 1, EY - 6, 2, 2, '#1b1612'); R1(EX + 1, EY - 6, 3, 1, '#1b1612');
  for (let q = 0; q < 22; q++) {
    const u = (G.time * 3 + q / 22) % 1, sp = (hash(q, 1, 144) - .5) * 14 * u;
    const x = ex + (c.x - ex) * u * 1.4 - fy * sp, y = ey - 6 + (c.y - 3 - (ey - 6)) * u * 1.4 + fx * sp;
    ctx.globalAlpha = .95 * (1 - u * .5) * (.4 + .6 * out); R1(Math.round(x), Math.round(y), u > .5 ? 3 : 2, u > .5 ? 3 : 2, q % 3 ? '#ffffff' : '#cfe6f0');
  }
  ctx.globalAlpha = 1;
}

// the base camp: the blue lights of the police car and the ambulance, the reporter talks into the camera (a red light on it), a scientist walks about
function drawCamp(V) {
  const C = V.camp; if (!C || !inView(C.x, C.y, 220)) return;
  const b = ((G.time * 6) | 0) % 2;
  for (const [p, cols] of /** @type {Array<[any, string[]]>} */ ([[C.police, ['#3a7aff', '#3a7aff']], [C.amb, ['#3a7aff', '#ff3a3a']]])) {
    R1(p.x - 1, p.y - 4, 2, 2, b ? cols[0] : '#1a2a5a'); R1(p.x - 1, p.y + 2, 2, 2, b ? '#1a2a5a' : cols[1]);
    ctx.globalAlpha = .28; disc(p.x, b ? p.y - 3 : p.y + 3, 9, b ? cols[0] : cols[1]); ctx.globalAlpha = 1;
  }
  const r = C.rep, w = Math.sin(G.time * 5) > 0 ? 1 : 0;
  R1(r.x - 3, r.y - 2, 6, 7, '#1b1612'); R1(r.x - 2, r.y - 1, 4, 5, '#2f6fb8'); R1(r.x - 2, r.y - 5, 4, 4, '#1b1612'); R1(r.x - 1, r.y - 4, 2, 3, '#f0c49a');
  R1(r.x + 2, r.y - 3 - w, 2, 1, '#1b1612'); R1(r.x + 3, r.y - 4 - w, 1, 1, '#d83a2c');
  const m = C.cam;
  R1(m.x - 3, m.y - 2, 6, 7, '#1b1612'); R1(m.x - 2, m.y - 1, 4, 5, '#5a5a52'); R1(m.x - 2, m.y - 5, 4, 4, '#4a2e1a');
  R1(m.x - 6, m.y - 5, 5, 3, '#2a2a30'); if (((G.time * 2) | 0) % 2) R1(m.x - 6, m.y - 6, 1, 1, '#ff3a3a');
  const s = C.sci, sx = Math.round(s.x + Math.sin(G.time * .5) * 22);
  R1(sx - 2, s.y - 2, 4, 6, '#1b1612'); R1(sx - 1, s.y - 1, 2, 4, '#f0ece4'); R1(sx - 2, s.y - 5, 4, 3, '#f2c230');
}

// the fire brigade: two firefighters (helmets, dark jackets) spray arcs of water over the tiled floor of the bay
function drawCrew(V) {
  const B = V.bay; if (!B) return;
  const [wx0, wy0, wx1, wy1] = B.wash;
  if (!inView((wx0 + wx1) / 2, (wy0 + wy1) / 2, 100)) return;
  B.crew.forEach(([x, y], q) => {
    R1(x - 3, y - 3, 6, 7, '#1b1612'); R1(x - 2, y - 2, 4, 5, '#2a3a6a'); R1(x - 3, y - 6, 6, 4, '#1b1612'); R1(x - 2, y - 5, 4, 2, '#f2c230'); R1(x - 2, y + 1, 4, 1, '#d8d040');
    R1(x - 1, y - 9, 2, 4, '#5a5a5a');
    const tx = (wx0 + wx1) / 2 + (q ? 18 : -18), ty = (wy0 + wy1) / 2;
    for (let d = 0; d < 12; d++) {
      const u = ((G.time * 1.6 + d / 12 + q * .5) % 1), sx = x + (tx - x) * u + Math.sin(u * Math.PI) * (q ? 6 : -6), sy = y - 8 + (ty - y + 8) * u - Math.sin(u * Math.PI) * 12;
      R1(Math.round(sx), Math.round(sy), 2, 1, d % 3 ? '#9edcf0' : '#ffffff');
    }
  });
  if (Math.random() < .5) addP({ t: 'd', x: wx0 + Math.random() * (wx1 - wx0), y: wy0 + Math.random() * (wy1 - wy0), z: 2, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, vz: 30, col: '#9edcf0', s: 1, life: .4, ml: .4 });
}

// on the screen: the red sky and the ash rain of the eruption
function drawVolcanoSky(cx, cy) {
  const ev = G.T.ev;
  if (ev && ev.vlErupt) {
    ctx.fillStyle = 'rgba(110,24,0,' + Math.min(.16, ev.vlErupt.t * .1).toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 80; i++) {
      const x = ((hash(i, 2, 107) * (VW + 40) + Math.sin(G.time * .6 + i) * 8 - cx * .3) % (VW + 40) + VW + 40) % (VW + 40) - 20;
      const y = ((hash(i, 3, 107) * (VH + 20) + G.time * (10 + hash(i, 1, 107) * 14) - cy * .3) % (VH + 20) + VH + 20) % (VH + 20) - 10;
      ctx.globalAlpha = .45 + hash(i, 4, 107) * .4; R1(Math.round(x), Math.round(y), 1 + (i % 4 === 0 ? 1 : 0), 1, i % 3 ? '#8a8682' : '#5a5652');
    }
    ctx.globalAlpha = 1;
  }
}

// ---------- hooks: how the core calls this track (hooks.js; what each hook does: _template.js) ----------
/** @type {import('./_template.js').TrackHooks} */
export const volcanoHooks = {
  init: initVolcano, update: volcanoUpdate,
  events: { ausbruch: T => { T.ev.vlErOn = true; }, lavastrom: T => { T.ev.vlLavaOn = true; }, brueckenloch: T => { T.ev.vlHoleOn = true; } },
  // (the rock of the maze: slow like the ground beside the road, no place to set a car back down)
  surf(c) { const m = c.def.mud; return c.surf === 80 ? [.16 + .3 * m, 2.4 * m, Math.min(.8, .55 * m)] : null; },
  noRespawn: t => t === 80,
  progress: volcanoProgress, target: volcanoTarget, lane: volcanoLane, throttle: volcanoThrottle, ground: volcanoGround, respawn: volcanoRespawn,
  drawFall(c, F, lv) { if (c.fallKind !== 'bridge' && !(c.fallKind === 'lava' && onDeck(G.T, c.fx0, c.fy0))) return false; drawBridgeFall(c, F, lv); return true; },
  drawGround: drawVolcanoGround, drawAbove: drawVolcanoAbove, drawSky: drawVolcanoSky,
};
