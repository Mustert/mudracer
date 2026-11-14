import { G } from './g.js';
import { SFX } from './audio.js';
import { HALF, LAPS, TAU, VH, VW, angDiff, clamp, ctx, hash } from './core.js';
import { R1, disc, ell, text } from './gfx.js';
import { snap } from './undo.js';
import { addP } from './particles.js';
import { cam } from './state.js';
import { inView, near } from './trackfx.js';

// ---------- Vulkan Rev 4 while racing (plaene/VULKAN_REV2.md, plaene/VULKAN_REV4.md) ----------
// Always: the lava lake boils (fountains that bubble before they spout, only to look at), the volcano smokes and rumbles now and then, the hornitos puff, the
// lanterns on the causeway flicker, the fire brigade sprays its bay (the only way to get clean).
// Event "ausbruch" (the way up): fireballs out of the crater on the way up (from the start to the crater), more often from lap to lap, aimed a little ahead of a car
// (a shadow on the ground grows and darkens before they land). Where one lands it burns for a moment; who drives through (or is hit) burns: a little slower, then
// the driver leans out of the window and puts it out with an extinguisher; the car is half white with foam afterwards (dirt, the second set of sprites; the fire
// brigade washes it off). From lap 2 a red sky, ash rain, a column of smoke, a helicopter; in the last lap sparks rain down and the lake spouts more.
// Event "lavastrom" (the way down): the three lava fords. Each vent fills its gully in pulses: first it bubbles and spits and the warning lights at the road blink
// (FORD.pre), then the lava runs down the gully and reaches the road after FORD.warn, stays on it for FORD.hold and cools to a crust you can drive on again. More
// pulses from lap to lap (your laps). Who drives into the lava falls in (gone for a moment, set back before the ford). The computer cars wait (mostly).

const BALL = { warn: 1.6, r: 15, h: 240, per: [[2.4, 3.2], [1.5, 2.1], [1, 1.5]], first: 9 }; // (per: seconds between two fireballs in lap 1, 2, 3; first: s after the countdown starts, not into the grid)
const FIRE = { life: 3, r: 13, burn: 1.4, ext: 1.1, foam: .42, most: .62 }; // (life of a fire on the ground; a car burns burn s, then it is put out in ext s, then foam: the car is
// about half white (dirt .42: the second of five steps of the sprites), a second time a little more, never more than most (the third step))
const FORD = { pre: 1, warn: 2.2, hold: 2.6, cool: 2.5, v: 95, per: [[13, 16], [9.5, 12], [7, 8.5]], first: 11, stagger: 4.3 }; // (per: s from one pulse of a ford to the next in lap 1, 2, 3; v: px/s of the front after the road)

// ======================================================= always

function initVolcano(T) {
  const ev = T.ev, V = T.volcano;
  ev.obst = V.hornitos.slice(); ev.vlBalls = []; ev.vlFires = []; ev.vlBallCd = BALL.first; ev.vlBallN = 0; ev.vlErupt = null; ev.vlLate = false;
  ev.vlQuake = 0; ev.vlNextQuake = 6;
  ev.vlFords = V.fords.map((F, q) => plan({ ph: 'idle', pulse: 0, i: 0, kf: 0, t0: 0, tc: 0, snap: false }, F, FORD.first + q * FORD.stagger));
}

// the next pulse of a ford at time t: when the lava reaches the road (on) and when the road is cold again (off)
function plan(f, F, t) {
  f.next = t; f.on = t + FORD.pre + FORD.warn; f.off = f.on + (F.kEnd - F.kRoad) * 2 / FORD.v + FORD.hold; f.id = f.pulse + 1;
  return f;
}

// the car in front (most laps, then furthest on)
function leader() {
  let b = null; for (const c of G.cars) if (!b || c.lap > b.lap || (c.lap === b.lap && c.idx > b.idx)) b = c;
  return b;
}
const lapNow = () => { const P = G.player, L = leader(); return clamp(P && !P.finished ? P.lap : L ? L.lap : 1, 1, 3); };

function volcanoUpdate(T, dt) {
  const ev = T.ev, V = T.volcano, t = ev.t;
  // it smokes and rumbles now and then (the camera shakes a little, the needle of the seismograph jumps)
  ev.vlQuake = Math.max(0, ev.vlQuake - dt);
  if (t > ev.vlNextQuake) { ev.vlNextQuake = t + 8 + hash(Math.floor(t), 1, 97) * 6; ev.vlQuake = 1.2; SFX.rumble(); G.jumpShake = Math.max(G.jumpShake, .25); }
  for (const v of V.vents) if (Math.random() < dt * 1.6 && near(v.x, v.y) < 320) addP({ t: 'smoke', x: v.x + (Math.random() - .5) * 6, y: v.y, vx: 3, vy: -9, life: 1.5, ml: 1.5 });
  for (const h of V.hornitos) if (Math.random() < dt * 2 && near(h.x, h.y) < 300) addP({ t: 'smoke', x: h.x, y: h.y - 4, vx: (Math.random() - .5) * 6, vy: -14, life: 1, ml: 1 });
  // steam over the lake beside the causeway
  if (Math.random() < dt * 5) { const [cx, cy, crx] = V.crater, x = cx + (Math.random() - .5) * crx * 1.6; if (near(x, cy) < 300) addP({ t: 'smoke', x, y: cy + (Math.random() < .5 ? -30 : 30), vx: 2, vy: -12, life: 1.4, ml: 1.4 }); }
  // from lap 2 (when you go into it): the eruption (sky, ash rain, helicopter)
  if (!ev.vlLate && G.player && G.player.lap >= 2) { ev.vlLate = true; if (ev.vlErOn) { ev.vlErupt = { t: 0 }; SFX.bang(); G.jumpShake = .9; ev.vlQuake = 2; } }
  if (ev.vlErupt) ev.vlErupt.t += dt;
  if (ev.vlLavaOn) updateFords(T, dt);
  if (ev.vlErOn) updateBalls(T, dt);
  updateBurning(dt);
  // (the core steers every computer car round T.ev.obst: only the hornitos; fireballs and fires each car sees or not, volcanoLane)
  ev.obst = V.hornitos;
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

// parts of the centre line lie close together (the serpentine legs): look for the nearest point a little further round
function volcanoProgress(c, best) {
  const T = G.T, N = T.N;
  let bi = best, bd = 1e9;
  for (let k = -200; k <= 200; k++) { const i = (c.idx + k + N) % N, p = T.path[i], d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (d < bd) { bd = d; bi = i; } }
  return bd < 22500 ? bi : best;
}

// ======================================================= event "lavastrom": the lava fords

function updateFords(T, dt) {
  const ev = T.ev, V = T.volcano, t = ev.t;
  V.fords.forEach((F, q) => {
    const f = ev.vlFords[q], v = clamp(1 - near(F.mid.x, F.mid.y) / 500, 0, 1);
    if (f.ph === 'idle') {
      if (G.state !== 'race' || t < f.next) return;
      f.ph = 'pre'; f.t0 = f.next; f.pulse = f.id; f.i = 0; f.kf = 0;
      // (the picture and the terrain of the gully are put back after the race)
      if (!f.snap) { snap(T, F.x0 - 2, F.y0 - 2, F.W + 4, F.H + 4); f.snap = true; }
      if (v > .05) SFX.rumble();
    }
    const tt = t - f.t0 - FORD.pre;
    if (f.ph === 'pre') {
      if (Math.random() < dt * 14 && v > 0) addP({ t: 'd', x: F.vent.x, y: F.vent.y, z: 6, vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 30, vz: 60 + Math.random() * 40, col: Math.random() < .5 ? '#ffd04a' : '#ff7a1a', s: 2, life: .6, ml: .6 });
      if (tt < 0) return;
      f.ph = 'flow'; if (v > .05) SFX.glut(v);
    }
    if (f.ph === 'flow') {
      // the front: down to the road in FORD.warn, then FORD.v px/s; every pixel it reaches is lava
      const front = tt < FORD.warn ? F.kRoad * 2 * tt / FORD.warn : F.kRoad * 2 + FORD.v * (tt - FORD.warn);
      f.kf = Math.min(F.pts.length - 1, front / 2);
      while (f.i < F.J.length && F.K[f.i] <= f.kf) T.ter[F.J[f.i++]] = 15;
      if (Math.random() < dt * 18 && v > 0) { const p = F.pts[Math.floor(f.kf)]; addP({ t: 'smoke', x: p.x + (Math.random() - .5) * 14, y: p.y - 4, vx: (Math.random() - .5) * 10, vy: -16, life: 1, ml: 1 }); }
      if (t < f.off) return;
      // it cools: a crust you can drive on (the old terrain comes back), steam
      for (let n = 0; n < f.i; n++) T.ter[F.J[n]] = F.old[n];
      f.ph = 'cool'; f.tc = t; if (v > .05) SFX.hiss(v * .6);
    }
    if (f.ph === 'cool') {
      if (Math.random() < dt * 10 && v > 0) { const p = F.pts[Math.floor(Math.random() * Math.min(F.pts.length, f.kf + 1))]; addP({ t: 'smoke', x: p.x + (Math.random() - .5) * 20, y: p.y, vx: 2, vy: -12, life: 1.1, ml: 1.1 }); }
      if (t - f.tc < FORD.cool) return;
      const per = FORD.per[lapNow() - 1];
      f.ph = 'idle'; plan(f, F, Math.max(t + 1, f.t0 + per[0] + hash(f.pulse, q, 134) * (per[1] - per[0])));
    }
  });
}

// ======================================================= event "ausbruch": fireballs on the way up

const inSpan = (i, [a, b]) => a <= b ? i >= a && i <= b : i >= a || i <= b;

// a car the volcano may aim at: on the way up (from the start line to the crater), not just before the ramp, not in the bay
function canAim(T, c) {
  return !(c.finished || c.fall > 0 || c.z > 0 || c.vBay) && okIdx(T, c.idx);
}
function okIdx(T, i) {
  const V = T.volcano, N = T.N;
  if (!inSpan(i, [10, (V.dike[0] - 12 + N) % N])) return false;
  let rj = (i - V.jumpI + N) % N; if (rj > N / 2) rj -= N;
  return !(rj > -34 && rj < 26);
}

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

// a burning car: smoke, a little slower (physics.js), after FIRE.burn s the driver leans out and puts it out; then the car is half white with foam (a second
// time a little more, never all white)
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

// a dirty computer car turns into the fire brigade's bay beside the way down (the same limits as the desert and the ice)
function bayTarget(c) {
  const T = G.T, B = T.volcano.bay, N = T.N; if (!B) return null;
  if (!c.vBay && (G.state === 'race' || G.state === 'finish') && c.dirt > dirtyAt() && (B.i0 - c.idx + N) % N < 40) c.vBay = { k: 0 };
  if (!c.vBay) return null;
  const p = follow(c, c.vBay, B.P); if (!p) c.vBay = null;
  return p;
}

// on the causeway they keep to the middle; they steer away from where a fireball will land and from fires, but not always (each car each ball: 35 / 55 / 75 % on
// LEICHT / MITTEL / SCHWER), so that the computer cars burn too
function volcanoLane(c, i, lane) {
  const T = G.T, V = T.volcano, ev = T.ev, p = T.path[i], n = T.nrm[i]; if (!ev) return lane;
  if (inSpan(i, V.dike)) return lane * .3;
  const see = [.35, .55, .75][G.raceDiff || 0];
  for (const b of ev.vlBalls.concat(ev.vlFires)) {
    const x = p.x + n.x * lane, y = p.y + n.y * lane; if (Math.hypot(x - b.x, y - b.y) > BALL.r + 8 || hash((c.seed * 100) | 0, (b.x * 3 + b.y) | 0, 132) > see) continue;
    const o = (b.x - p.x) * n.x + (b.y - p.y) * n.y; return clamp(o > 0 ? o - 30 : o + 30, -26, 26);
  }
  return lane;
}

// before a ford: if the car would be on the road while the lava is there, it slows down and waits before the gully (most of them: 70 / 85 / 95 % on LEICHT /
// MITTEL / SCHWER each pulse, the others try their luck)
function fordWait(c, thr) {
  const T = G.T, V = T.volcano, ev = T.ev, N = T.N; if (!ev || !ev.vlLavaOn || !ev.vlFords || G.state !== 'race') return thr;
  const sp = Math.hypot(c.vx, c.vy), v = Math.max(sp, 45), see = [.7, .85, .95][G.raceDiff || 0];
  for (let q = 0; q < V.fords.length; q++) {
    const F = V.fords[q], f = ev.vlFords[q], a = (F.r0 - c.idx + N) % N; if (a > 80 || a < 3) continue;
    const tA = ev.t + a * 2 / v, tB = ev.t + ((F.r1 - c.idx + N) % N + 8) * 2 / v;
    if (!(tB > f.on - .35 && tA < f.off + .25) || hash((c.seed * 100) | 0, f.id * 7 + q, 133) > see) continue;
    c.stuckT = 0; // (waiting is not being stuck)
    if (a < 34) { c.brake = sp > 6; return 0; }
    return Math.min(thr, .3);
  }
  return thr;
}

// slowly through the bay, a little less gas on the causeway, before the hairpins of the serpentine; wait at the fords
function volcanoThrottle(c, thr) {
  if (c.vBay) return Math.min(thr, .6);
  thr = fordWait(c, thr);
  const T = G.T, V = T.volcano, N = T.N, i = c.idx;
  if (inSpan(i, V.dike)) return thr * .92;
  if (!inSpan(i, V.serp)) return thr;
  const a = Math.atan2(T.tan[i].y, T.tan[i].x), b = Math.atan2(T.tan[(i + 34) % N].y, T.tan[(i + 34) % N].x);
  return thr * (1 - clamp((Math.abs(angDiff(a, b)) - .5) / 1.6, 0, .4));
}

// ======================================================= drawing

function drawVolcanoGround() {
  const T = G.T, V = T.volcano, ev = T.ev, k = Math.floor(G.time * 4);
  // the lava shimmers
  for (let q = 0; q < 70 && V.lavaPix.length; q++) { const p = V.lavaPix[(hash(q, k, 102) * V.lavaPix.length) | 0]; R1(p % T.W, (p / T.W) | 0, 2, 1, q % 3 ? '#ffe27a' : '#fff4c0'); }
  // bubbles burst on the crater lake; a fountain bubbles hard before it spouts
  const [cx, cy, crx, cry] = V.crater;
  if (inView(cx, cy, 200)) {
    for (let q = 0; q < 10; q++) {
      const ph = (G.time * .7 + q * .37) % 1, a = hash(q, Math.floor(G.time * .7 + q * .37), 104) * TAU, rr = Math.sqrt(hash(q, Math.floor(G.time * .7 + q * .37), 105)) * .75;
      const x = Math.round(cx + Math.cos(a) * crx * rr), y = Math.round(cy + Math.sin(a) * cry * rr), r = Math.round(1 + ph * 4);
      if (Math.abs(y - cy) < 28) continue; // (not on the causeway)
      if (ph < .8) { ctx.globalAlpha = .9; disc(x, y, r, '#ffd04a'); R1(x - 1, y - r, 2, 1, '#fff4c0'); } else { ctx.globalAlpha = 1 - (ph - .8) * 5; for (let s = 0; s < 6; s++) R1(Math.round(x + Math.cos(s) * 6), Math.round(y + Math.sin(s) * 6), 1, 1, '#ffd04a'); }
      ctx.globalAlpha = 1;
    }
    // the seams between the plates glow brighter and darker
    ctx.globalAlpha = .1 + .06 * Math.sin(G.time * 1.7); ell(cx, cy - 40, crx - 30, 28, '#ffb040'); ell(cx, cy + 40, crx - 30, 28, '#ffb040'); ctx.globalAlpha = 1;
    V.fountains.forEach(([x, y], q) => { const f = fountain(q); if (f.warn) { ctx.globalAlpha = .6 + .3 * Math.sin(G.time * 25); disc(x, y, 5 + Math.round(f.u * 4), '#fff4c0'); ctx.globalAlpha = 1; } });
  }
  drawFords(T, V, ev);
  // fires on the ground: scorched and glowing (the flames are drawn over the cars); the shadow of a fireball grows and darkens before it lands
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
  // the station: the needle of the seismograph jumps when it rumbles, the researcher waves
  const st = V.station;
  if (st && inView(st.x, st.y, 80)) {
    const s = st.seis, a = Math.sin(G.time * 40) * (ev.vlQuake > 0 || ev.vlErupt ? 4 : .6);
    R1(s.x - 1, s.y - 1, 11, 7, '#1b120c'); R1(s.x, s.y, 9, 5, '#f4f0e8'); R1(s.x + 4 + Math.round(a), s.y + 1, 1, 3, '#d83a2c');
    const m = st.man, w = ((G.time * 4) | 0) % 2;
    R1(m.x - 3, m.y - 2, 6, 7, '#1b120c'); R1(m.x - 2, m.y - 1, 4, 5, '#e8742a'); R1(m.x - 3, m.y - 6, 6, 4, '#1b120c'); R1(m.x - 2, m.y - 5, 4, 2, '#f2c230');
    R1(m.x + 3, m.y - 4 - w * 2, 1, 4, '#e8742a');
  }
}

// the lava in a ford: down the gully as far as the front, a glow round it; then the crust that cools (its cracks glow less and less)
function drawFords(T, V, ev) {
  V.fords.forEach((F, q) => {
    const f = ev.vlFords[q]; if (!inView(F.x0 + F.W / 2, F.y0 + F.H / 2, Math.max(F.W, F.H) / 2 + 30)) return;
    if (f.ph === 'flow' || f.ph === 'cool') {
      const kf = Math.floor(f.kf), a = f.ph === 'cool' ? clamp(1 - (ev.t - f.tc) / FORD.cool, 0, 1) : 1;
      if (f.ph === 'flow') { ctx.globalAlpha = .16; for (let k = 0; k <= kf; k += 6) { const p = F.pts[k]; disc(Math.round(p.x), Math.round(p.y), Math.round(p.w + 9), '#ff7a24'); } ctx.globalAlpha = 1; }
      ctx.save(); ctx.beginPath();
      for (let k = 0; k <= kf; k += 2) { const p = F.pts[k]; ctx.moveTo(p.x + p.w + 3, p.y); ctx.arc(p.x, p.y, p.w + 3, 0, TAU); }
      ctx.clip(); ctx.globalAlpha = a; ctx.drawImage(f.ph === 'flow' ? F.lava : F.crust, F.x0, F.y0); ctx.restore(); ctx.globalAlpha = 1;
      if (f.ph === 'flow') {
        const p = F.pts[kf]; ctx.globalAlpha = .7 + .3 * Math.sin(G.time * 20); disc(Math.round(p.x), Math.round(p.y), Math.round(p.w * .7), '#fff2b0'); ctx.globalAlpha = 1;
        for (let s = 0; s < 14; s++) { const k2 = Math.floor(hash(s, Math.floor(G.time * 6), q + 170) * (kf + 1)), r = F.pts[k2]; R1(Math.round(r.x + (hash(s, 2, 171) - .5) * r.w), Math.round(r.y + (hash(s, 3, 171) - .5) * r.w), 2, 1, s % 3 ? '#ffe27a' : '#fff4c0'); }
      }
    }
    // the vent glows, harder before a pulse
    const v = F.vent, hot = f.ph === 'pre' ? 1 : f.ph === 'flow' ? .7 : .25;
    ctx.globalAlpha = (.18 + .12 * Math.sin(G.time * (4 + hot * 10) + q)) * (.6 + hot); disc(v.x, v.y - 1, Math.round(9 + hot * 6), '#ff7a24'); ctx.globalAlpha = 1;
  });
}

// a lava fountain in the lake: every 5 to 8 s it bubbles (warn) and then spouts for 1.4 s (u = 0..1 while it spouts); more often in the last lap
function fountain(q) {
  const last = G.player && G.player.lap >= LAPS && G.T.ev && G.T.ev.vlErupt, per = (last ? 3.2 : 5.5) + q * .9, t = (G.time + q * 1.7) % per, s = per - 1.4;
  return { warn: t > s - 1.1 && t < s, on: t >= s, u: t >= s ? (t - s) / 1.4 : (t - (s - 1.1)) / 1.1, big: last };
}

// over the cars: lava fountains, fireballs, fires, burning cars and their extinguishers, the glow of the lanterns, the hornitos and the warning lights, the smoke,
// the helicopter, the fire brigade, words
function drawVolcanoAbove() {
  const T = G.T, V = T.volcano, ev = T.ev, P = G.player;
  // the fountains: a column of lava droplets thrown up and falling back
  V.fountains.forEach(([x, y], q) => {
    const f = fountain(q); if (!f.on || !inView(x, y, 60)) return;
    const hgt = f.big ? 46 : 30;
    for (let d = 0; d < 14; d++) {
      const a = hash(q, d, 110) * TAU, sp = 4 + hash(d, q, 111) * 10, u = clamp(f.u * 1.2 - hash(d, 2, 112) * .2, 0, 1);
      const dx = Math.cos(a) * sp * u * 2, dy = Math.sin(a) * sp * u, h = hgt * 4 * u * (1 - u) * (.6 + hash(d, 3, 113) * .4);
      R1(Math.round(x + dx), Math.round(y + dy - h), 2, 2, d % 3 ? '#ffa21f' : '#ffe27a');
    }
  });
  // the lanterns on the causeway flicker; the throats of the hornitos pulse
  for (const l of V.lanterns) if (inView(l.x, l.y, 20)) { ctx.globalAlpha = .22 + .1 * Math.sin(G.time * 9 + l.x * .7) * Math.sin(G.time * 5.3 + l.y); disc(l.x, l.y, 9, '#ffc040'); ctx.globalAlpha = 1; R1(l.x - 1, l.y - 1, 3, 3, '#fff2b0'); }
  for (const h of V.hornitos) if (inView(h.x, h.y, 20)) { ctx.globalAlpha = .25 + .2 * Math.sin(G.time * 3 + h.x); disc(Math.round(h.x), Math.round(h.y), 6, '#ff7a24'); ctx.globalAlpha = 1; }
  // the warning lights at the fords: they blink in turn while the vent spits and while the lava runs; "LAVA!" over the crossing
  V.fords.forEach((F, q) => {
    const f = ev.vlFords[q], on = ev.vlLavaOn && (f.ph === 'pre' || f.ph === 'flow');
    F.lights.forEach((l, s) => {
      if (!inView(l.x, l.y, 20)) return;
      const lit = on && ((G.time * 3) | 0) % 2 === s;
      R1(l.x - 1, l.y - 1, 3, 2, lit ? '#ff3b2a' : '#5a1810');
      if (lit) { ctx.globalAlpha = .35; disc(l.x, l.y, 8, '#ff3b2a'); ctx.globalAlpha = 1; }
    });
    if (on && P && near(F.mid.x, F.mid.y) < 320 && ((G.time * 4) | 0) % 2 === 0) text('LAVA!', Math.round(F.mid.x), Math.round(F.mid.y - 30), 8, '#ff9a3a', 'center');
  });
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
      const ph = (G.time * (big ? .35 : .2) + q / (big ? 16 : 6)) % 1, x = cx + Math.sin(q * 2.1 + G.time * .3) * (10 + ph * 30) + ph * 40, y = cy - 60 - ph * (big ? 200 : 110);
      ctx.globalAlpha = (1 - ph) * (big ? .55 : .3); disc(Math.round(x), Math.round(y), Math.round((big ? 12 : 7) + ph * (big ? 26 : 14)), big ? '#3a3432' : '#8a8682');
    }
    ctx.globalAlpha = 1;
  }
  // in the eruption a helicopter circles over the crater
  if (ev.vlErupt) {
    const a = G.time * .5, x = Math.round(cx + Math.cos(a) * 190), y = Math.round(cy + Math.sin(a) * 120 - 20), rot = G.time * 30;
    if (inView(x, y, 30)) {
      ctx.globalAlpha = .2; ell(x + 20, y + 40, 8, 3, '#000'); ctx.globalAlpha = 1;
      R1(x - 6, y - 3, 12, 7, '#1b120c'); R1(x - 5, y - 2, 10, 5, '#d83a2c'); R1(x + 2, y - 2, 3, 3, '#8fd3f4'); R1(x - 14, y - 1, 9, 2, '#d83a2c');
      for (const s of [0, Math.PI / 2]) { const dx = Math.cos(rot + s) * 13, dy = Math.sin(rot + s) * 13; ctx.fillStyle = '#2a2a30'; for (let q = -1; q <= 1; q += .1) ctx.fillRect(Math.round(x + dx * q), Math.round(y - 4 + dy * q * .4), 1, 1); }
    }
  }
  drawCrew(T, V);
  for (const c of G.cars) if (c.burnT > 0) text('AUA, HEISS!', Math.round(c.fx0 || c.x), Math.round((c.fy0 || c.y) - 24 - (1.3 - c.burnT) * 10), 8, '#ffb02e', 'center');
  if (P && P.vFire > 0 && !(P.fall > 0)) text(P.vExt ? 'PFFFT!' : 'ES BRENNT!', Math.round(P.x), Math.round(P.y - 44), 8, P.vExt ? '#f4f8fa' : '#ff8a3a', 'center');
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
  R1(X - 3, Y - 2, 6, 4, '#2a3a6a'); // (the shoulder in the window)
  R1(X - 2, Y - 7, 5, 5, '#1b1612'); R1(X - 1, Y - 6, 3, 4, '#f0c49a'); R1(X - 1, Y - 7, 3, 2, '#4a2e1a'); R1(X, Y - 5, 1, 1, '#1b1612'); // (the head)
  const ex = hx + lx * 5 + fx * 3, ey = hy + ly * 5 + fy * 3, EX = Math.round(ex), EY = Math.round(ey);
  R1(EX - 2, EY - 4, 4, 7, '#1b1612'); R1(EX - 1, EY - 3, 2, 5, '#e0402e'); R1(EX - 1, EY - 6, 2, 2, '#1b1612'); R1(EX + 1, EY - 6, 3, 1, '#1b1612'); // (the extinguisher, its hose)
  for (let q = 0; q < 22; q++) {
    const u = (G.time * 3 + q / 22) % 1, sp = (hash(q, 1, 144) - .5) * 14 * u;
    const x = ex + (c.x - ex) * u * 1.4 - fy * sp, y = ey - 6 + (c.y - 3 - (ey - 6)) * u * 1.4 + fx * sp;
    ctx.globalAlpha = .95 * (1 - u * .5) * (.4 + .6 * out); R1(Math.round(x), Math.round(y), u > .5 ? 3 : 2, u > .5 ? 3 : 2, q % 3 ? '#ffffff' : '#cfe6f0');
  }
  ctx.globalAlpha = 1;
}

// the fire brigade: two firefighters (helmets, dark jackets) spray arcs of water over the tiled floor of the bay
function drawCrew(T, V) {
  const B = V.bay; if (!B) return;
  const [wx0, wy0, wx1, wy1] = B.wash;
  if (!inView((wx0 + wx1) / 2, (wy0 + wy1) / 2, 80)) return;
  B.crew.forEach(([x, y], q) => {
    R1(x - 3, y - 3, 6, 7, '#1b1612'); R1(x - 2, y - 2, 4, 5, '#2a3a6a'); R1(x - 3, y - 6, 6, 4, '#1b1612'); R1(x - 2, y - 5, 4, 2, '#f2c230'); R1(x - 2, y + 1, 4, 1, '#d8d040');
    R1(x + 2, y - 1, 5, 2, '#5a5a5a');
    for (let d = 0; d < 12; d++) {
      const u = ((G.time * 1.6 + d / 12 + q * .5) % 1), sx = x + 7 + u * (wx1 - x - 6), sy = y + (q ? -1 : 1) * Math.sin(u * Math.PI) * 4 + u * (q ? 18 : -14) - Math.sin(u * Math.PI) * 10;
      R1(Math.round(sx), Math.round(sy), 2, 1, d % 3 ? '#9edcf0' : '#ffffff');
    }
  });
  if (Math.random() < .5) addP({ t: 'd', x: wx0 + Math.random() * (wx1 - wx0), y: wy0 + Math.random() * (wy1 - wy0), z: 2, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, vz: 30, col: '#9edcf0', s: 1, life: .4, ml: .4 });
}

// on the screen: the red sky and the ash rain of the eruption
function drawVolcanoSky(cx, cy) {
  const ev = G.T.ev;
  if (ev && ev.vlErupt) {
    ctx.fillStyle = 'rgba(110,24,0,' + Math.min(.18, ev.vlErupt.t * .1).toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH);
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
  events: { ausbruch: T => { T.ev.vlErOn = true; }, lavastrom: T => { T.ev.vlLavaOn = true; } },
  progress: volcanoProgress, target: bayTarget, lane: volcanoLane, throttle: volcanoThrottle, ground: volcanoGround,
  // (back on the road after the lava: a puff of smoke, not a splash of water; the fire is out, the soot is black)
  respawn(c) { c.vFire = 0; c.vExt = false; c.cem = false; for (let i = 0; i < 10; i++) addP({ t: 'smoke', x: c.x + (Math.random() - .5) * 16, y: c.y + (Math.random() - .5) * 12, vx: (Math.random() - .5) * 16, vy: -10, life: .8, ml: .8 }); },
  drawGround: drawVolcanoGround, drawAbove: drawVolcanoAbove, drawSky: drawVolcanoSky,
};
