import { G } from './g.js';
import { SFX } from './audio.js';
import { HALF, LAPS, TAU, VH, VW, angDiff, clamp, ctx, hash, mk, vnoise } from './core.js';
import { R1, disc, ell, text } from './gfx.js';
import { snap } from './undo.js';
import { addP } from './particles.js';
import { cam } from './state.js';
import { inView, near } from './trackfx.js';
import { GLASS, TUBE } from './volcanomap.js';

// ---------- Vulkan Rev 3 while racing (plaene/VULKAN_REV2.md, plaene/VULKAN_REV3.md) ----------
// Always: the lava lake boils (fountains that bubble before they spout, only to look at), the volcano smokes and rumbles now and then, the hornitos puff, the
// fire brigade sprays its bay (the only way to get clean), the lava tube is dark inside (the lava rill, the cat's eyes and the headlights show the way).
// Three ways down at the fork: the open way (long, the bay), the lava tube, the old lava channel (the shortest). The board at the fork shows which are open.
// The computer cars choose at the fork: the channel or the tube while they are open, the tube when a glowing cloud rolls, the open way when they are dirty (the bay).
// Event "lavastrom" (it goes with your laps: three ways in lap 1, two in lap 2, one in lap 3): near the end of your lap 1 the plug in the crater rim glows and
// smokes; when you start lap 2 it bursts and the channel fills with lava from the top; near the end of lap 2 the lava in the channel boils up, in lap 3 it spills
// over into the lava tube. Only the open way is left. (With your laps, not the leader's: the channel ends just before the line, so the first car down it would
// close it for everybody behind it.)
// Event "ausbruch": fireballs out of the crater all the lap long, more often from lap to lap, aimed a little ahead of a car (a shadow on the ground grows and
// darkens before they land). Where one lands it burns for a moment; who drives through (or is hit) burns: a little slower, then the driver leans out of the window
// and puts it out with an extinguisher; the car is white with foam afterwards (dirt, the second set of sprites; the fire brigade washes it off). From lap 2 a red
// sky, ash rain, a column of smoke, a helicopter; in the last lap sparks rain down and the lake spouts more.
// Event "glutwolke": in lap 2 every 14 to 20 s a glowing cloud rolls down the open way from the west rim (a bang, a plume, "GLUTWOLKE!", the lamp at the fork
// blinks); who is in it gets sooty and slow and coughs (in lap 3 there is no other way down, so no cloud then). No fireballs where the cloud rolls.

const BALL = { warn: 1.6, r: 15, h: 240, per: [[2.4, 3.2], [1.5, 2.1], [1, 1.5]], first: 9 }; // (per: seconds between two fireballs in lap 1, 2, 3; first: s after the countdown starts, not into the grid)
const FIRE = { life: 3, r: 13, burn: 1.4, ext: 1.1, foam: .4 }; // (life of a fire on the ground; a car burns burn s, then it is put out in ext s, then foam)
const FLOOD = { v: 70, warn: .8 }; // (the speed of the lava front in px/s; warn: the share of your lap after which the next plug glows)
const CLOUD = { v: 46, warn: 1.8, tail: 36, front: 12, wide: HALF + 16, per: [14, 20], first: 3 }; // (v, tail, front in points of the centre line: 2 px each)

// ======================================================= always

function initVolcano(T) {
  const ev = T.ev, V = T.volcano;
  ev.obst = V.hornitos.slice(); ev.vlBalls = []; ev.vlFires = []; ev.vlBallCd = BALL.first; ev.vlBallN = 0; ev.vlErupt = null; ev.vlLate = false;
  ev.vlCloud = null; ev.vlCloudCd = CLOUD.first; ev.vlCloudK = 0; ev.vlQuake = 0; ev.vlNextQuake = 6;
  ev.vlFlood = { r: null, t: null }; ev.vlWarn = { r: false, t: false }; ev.vlMsg = null; ev.vlShim = []; ev.vlSnap = false;
}

// the car in front (most laps, then furthest on)
function leader() {
  let b = null; for (const c of G.cars) if (!b || c.lap > b.lap || (c.lap === b.lap && c.idx > b.idx)) b = c;
  return b;
}

function volcanoUpdate(T, dt) {
  const ev = T.ev, V = T.volcano, t = ev.t;
  // it smokes and rumbles now and then (the camera shakes a little, the needle of the seismograph jumps)
  ev.vlQuake = Math.max(0, ev.vlQuake - dt);
  if (t > ev.vlNextQuake) { ev.vlNextQuake = t + 8 + hash(Math.floor(t), 1, 97) * 6; ev.vlQuake = 1.2; SFX.rumble(); G.jumpShake = Math.max(G.jumpShake, .25); }
  for (const v of V.vents) if (Math.random() < dt * 1.6 && near(v.x, v.y) < 320) addP({ t: 'smoke', x: v.x + (Math.random() - .5) * 6, y: v.y, vx: 3, vy: -9, life: 1.5, ml: 1.5 });
  for (const h of V.hornitos) if (Math.random() < dt * 2 && near(h.x, h.y) < 300) addP({ t: 'smoke', x: h.x, y: h.y - 2, vx: (Math.random() - .5) * 6, vy: -14, life: 1, ml: 1 });
  // from lap 2 (when you go into it): the eruption (sky, ash rain, helicopter)
  if (!ev.vlLate && G.player && G.player.lap >= 2) { ev.vlLate = true; if (ev.vlErOn) { ev.vlErupt = { t: 0 }; SFX.bang(); G.jumpShake = .9; ev.vlQuake = 2; } }
  if (ev.vlErupt) ev.vlErupt.t += dt;
  if (ev.vlLavaOn) updateFloods(T, dt);
  if (ev.vlErOn) updateBalls(T, dt);
  updateBurning(dt);
  if (ev.vlGlutOn && ev.vlLate) updateCloud(T, dt);
  if (ev.vlMsg && (ev.vlMsg.t += dt) > 3) ev.vlMsg = null;
  // (the core steers every computer car round T.ev.obst: only the hornitos; fireballs and fires each car sees or not, volcanoLane)
  ev.obst = V.hornitos;
  // the last lap: sparks rain down over the whole map
  if (ev.vlErupt && G.player && G.player.lap >= LAPS && Math.random() < dt * 30) addP({ t: 'd', x: cam.x + Math.random() * VW, y: cam.y + Math.random() * VH, z: 60, vx: (Math.random() - .5) * 20, vy: 10, vz: -20, col: ['#ff7a1a', '#ffd04a', '#ff4a1a'][(Math.random() * 3) | 0], s: 1, life: 1.4, ml: 1.4 });
}

// the ground under a car: where it is in a way down (c.vTk in the tube, c.vRk in the channel: its place in the lap, and where it is set back when it falls into
// the lava there), the fire brigade's water, ash dust, the smoke of a car that came out of a cloud; foam goes when the car is clean, ash makes it sooty again
function volcanoGround(c, j, sp, dt) {
  const T = G.T, V = T.volcano, tb = V.tube, rn = V.rinne, q = tb && tb.at.get(j), r = rn && rn.at.get(j);
  const inT = !!q && q[0] < tb.half + 2 && (T.ter[j] === TUBE || T.alt[j]), inR = !!r && r[0] < rn.half + 2 && !!T.alt[j] && !(inT && q[0] < r[0]);
  c.vTk = inT && !inR ? q[1] : undefined; c.vRk = inR ? r[1] : undefined;
  if (inT || inR) { c.respawnI = ((inR ? rn.fork : tb.fork) - 8 + T.N) % T.N; c.vResp = true; } else if (c.vResp) { c.respawnI = null; c.vResp = false; }
  if (T.washMask[j]) { if (!c.vWash) { c.vWash = true; if (!c.ai || near(c.x, c.y) < 260) SFX.hose(c.ai ? .4 : 1); } } else c.vWash = false;
  if (c.surf === 2) { c.cem = false; if (sp > 20 && Math.random() < dt * 25) addP({ t: 'smoke', x: c.x - Math.cos(c.ang) * 12, y: c.y - Math.sin(c.ang) * 12, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, life: .6, ml: .6 }); }
  if (c.dirt < .03) c.cem = false;
  if (c.vAsh > 0) { c.vAsh = Math.max(0, c.vAsh - dt); if (Math.random() < dt * 10) addP({ t: 'smoke', x: c.x, y: c.y, vx: (Math.random() - .5) * 14, vy: -10, life: .8, ml: .8 }); }
  c.burnT = Math.max(0, (c.burnT || 0) - dt);
}

// the floor of the lava tube is rough: a little slower, full grip. Obsidian is glass: full speed, but it slides like sheet ice (a little less), nimble cars hold best
function volcanoSurf(c) { return c.surf === TUBE ? [.86, 9, .95] : c.surf === GLASS ? [1, 1.6 * c.def.turn * c.def.turn, .6, .6] : null; }

// parts of the centre line lie close together (the serpentine legs); in the tube and the channel a car's place in the lap comes from its place there
function volcanoProgress(c, best) {
  const T = G.T, V = T.volcano, N = T.N;
  if (V.tube && c.vTk !== undefined) return V.tube.idx[c.vTk];
  if (V.rinne && c.vRk !== undefined) return V.rinne.idx[c.vRk];
  let bi = best, bd = 1e9;
  for (let k = -200; k <= 200; k++) { const i = (c.idx + k + N) % N, p = T.path[i], d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (d < bd) { bd = d; bi = i; } }
  return bd < 22500 ? bi : best;
}

// ======================================================= event "lavastrom": the ways down close one after the other

function updateFloods(T, dt) {
  const ev = T.ev, L = G.player || leader(); if (!L || G.state === 'countdown') return;
  const late = L.idx / T.N > FLOOD.warn;
  if (!ev.vlWarn.r && (L.lap >= 2 || (L.lap === 1 && late))) { ev.vlWarn.r = true; SFX.rumble(); ev.vlQuake = 1.4; }
  if (!ev.vlWarn.t && (L.lap >= 3 || (L.lap === 2 && late))) { ev.vlWarn.t = true; SFX.rumble(); ev.vlQuake = 1.4; }
  if (!ev.vlFlood.r && L.lap >= 2) startFlood(T, 'r');
  if (!ev.vlFlood.t && L.lap >= 3 && ev.vlFlood.r) startFlood(T, 't');
  for (const key of ['r', 't']) { const F = ev.vlFlood[key]; if (F && F.i < F.L.j.length) runFlood(T, F, dt); }
}

function startFlood(T, key) {
  const ev = T.ev, V = T.volcano;
  if (!ev.vlSnap) {
    // (the picture and the terrain of the channel, the plug and the upper half of the tube are put back after the race)
    let x0 = T.W, y0 = T.H, x1 = 0, y1 = 0;
    for (const A of [V.rinne.flood.j, V.tube.flood.j, V.rinne.dam]) for (const j of A) { const x = j % T.W, y = j / T.W | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    snap(T, x0 - 2, y0 - 2, x1 - x0 + 5, y1 - y0 + 5); ev.vlSnap = true;
  }
  ev.vlFlood[key] = { L: key === 'r' ? V.rinne.flood : V.tube.flood, i: 0, front: 0 };
  if (key === 'r') { for (const j of V.rinne.dam) T.ter[j] = 15; paintLava(T, V.rinne.dam, null); } // (the plug bursts)
  const p = key === 'r' ? V.rinne.pts[0] : V.tube.pts[0], v = clamp(1 - near(p.x, p.y) / 800, .3, 1);
  SFX.bang(); SFX.glut(v); G.jumpShake = Math.max(G.jumpShake, .6); ev.vlQuake = 2;
  ev.vlMsg = { t: 0, s: key === 'r' ? 'LAVA IN DER RINNE!' : 'LAVA IN DER ROEHRE!' };
}

// the front runs down: every pixel it reaches turns to lava (the last few points of it are a crust that has stopped)
function runFlood(T, F, dt) {
  F.front += FLOOD.v / 2 * dt;
  const { j: J, k: K, kMax } = F.L, pix = [], crust = [];
  while (F.i < J.length && K[F.i] <= F.front) { const j = J[F.i], k = K[F.i++]; if (T.ter[j] === 15) continue; T.ter[j] = 15; pix.push(j); crust.push(k > kMax - 7); }
  if (pix.length) paintLava(T, pix, crust);
  if (Math.random() < dt * 20) { const k = Math.min(F.L.k.length - 1, F.i), j = J[Math.max(0, k - 1)]; if (j !== undefined) addP({ t: 'smoke', x: j % T.W, y: (j / T.W | 0) - 4, vx: (Math.random() - .5) * 12, vy: -16, life: 1, ml: 1 }); }
}

// paint lava onto the base picture (glowing, plates of crust drifting on it); crust[k]: this pixel is the cooled front (black with glowing cracks)
function paintLava(T, pix, crust) {
  let x0 = T.W, y0 = T.H, x1 = 0, y1 = 0; for (const j of pix) { const x = j % T.W, y = j / T.W | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const b = T.base.getContext('2d'), W = x1 - x0 + 1, img = b.getImageData(x0, y0, W, y1 - y0 + 1), d = img.data, sh = T.ev.vlShim;
  pix.forEach((j, n) => {
    const x = j % T.W, y = j / T.W | 0, v = vnoise(x / 7, y / 7, 151), pl = vnoise(x / 7 + 3, y / 7, 152), h = hash(x, y, 153), o = ((y - y0) * W + x - x0) * 4;
    const c = crust && crust[n] ? (Math.abs(vnoise(x / 5, y / 5, 154) - .5) < .06 ? [255, 122, 26] : h < .3 ? [92, 44, 26] : [58, 30, 22])
      : pl > .76 ? (pl > .81 ? [58, 30, 22] : [92, 44, 26]) : v > .7 ? [255, 208, 74] : v > .45 ? [255, 162, 31] : [255, 122, 26];
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    if (h < .03 && !(crust && crust[n])) sh.push(j);
  });
  b.putImageData(img, x0, y0);
}

// ======================================================= event "ausbruch": fireballs

// a car the volcano may aim at: not in a way down (narrow), not on the dike, not just before the ramp, not at the fork (you are choosing your way), not in the cloud
function canAim(T, c) {
  const V = T.volcano, N = T.N, ev = T.ev;
  if (c.finished || c.fall > 0 || c.z > 0 || c.vTk !== undefined || c.vRk !== undefined || c.vWay || c.vBay) return false;
  return okIdx(T, c.idx) && !(ev.vlCloud && inSpan(c.idx, [(V.cloud[0] - 30 + N) % N, V.cloud[1]]));
}
function okIdx(T, i) {
  const V = T.volcano, N = T.N, rel = (a, b) => { let r = (a - b + N) % N; if (r > N / 2) r -= N; return r; };
  if (inSpan(i, V.dike)) return false;
  const rj = rel(i, V.jumpI); if (rj > -34 && rj < 26) return false;
  const rf = rel(i, Math.min(V.tube.fork, V.rinne.fork)); return !(rf > -40 && rf < 10);
}

function updateBalls(T, dt) {
  const ev = T.ev, V = T.volcano;
  if (G.state === 'race' && (ev.vlBallCd -= dt) <= 0) {
    const n = ev.vlBallN++, P = G.player, L = leader(), lap = clamp(P && !P.finished ? P.lap : L ? L.lap : 1, 1, 3), per = BALL.per[lap - 1];
    ev.vlBallCd = per[0] + hash(n, 1, 130) * (per[1] - per[0]);
    // near a car (more often yours): where it will be on the road when the ball lands (along the centre line, so also in bends), a little to the side
    const ok = G.cars.filter(c => canAim(T, c)), c = !ok.length ? null : P && ok.includes(P) && hash(n, 2, 130) < .45 ? P : ok[Math.floor(hash(n, 3, 130) * ok.length)];
    if (c) {
      const N = T.N, f = BALL.warn * (.7 + hash(n, 4, 130) * .35), i0 = c.idx, p0 = T.path[i0], n0 = T.nrm[i0], side = clamp((c.x - p0.x) * n0.x + (c.y - p0.y) * n0.y, -HALF, HALF);
      const i = (i0 + Math.round(Math.hypot(c.vx, c.vy) * f / 2)) % N, p = T.path[i], o = clamp(side + (hash(n, 5, 130) - .5) * 34, -HALF, HALF);
      const x = p.x + T.nrm[i].x * o, y = p.y + T.nrm[i].y * o, j = Math.round(y) * T.W + Math.round(x), t = T.ter[j];
      const q = V.tube.at.get(j), r = V.rinne.at.get(j);
      if (x > 10 && y > 10 && x < T.W - 10 && y < T.H - 10 && (t === 0 || t === 1 || t === 2 || t === GLASS) && !V.laneM[j] && okIdx(T, T.near[j])
        && !(q && q[0] < V.tube.half + 8) && !(r && r[0] < V.rinne.half + 8)) {
        ev.vlBalls.push({ x, y, t: 0, whistle: false });
      }
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

// a burning car: smoke, a little slower (physics.js), after FIRE.burn s the driver leans out and puts it out; then the car is white with foam
function updateBurning(dt) {
  for (const c of G.cars) {
    if (!(c.vFire > 0)) continue;
    if (c.fall > 0) { c.vFire = 0; c.vExt = false; continue; }
    c.vFire += dt;
    if (Math.random() < dt * 16) addP({ t: 'smoke', x: c.x + (Math.random() - .5) * 8, y: c.y - 4, vx: (Math.random() - .5) * 10 - c.vx * .2, vy: -16 - c.vy * .2, life: .9, ml: .9 });
    if (!c.vExt && c.vFire > FIRE.burn) { c.vExt = true; const v = c.ai ? clamp(1 - near(c.x, c.y) / 260, 0, .4) : 1; if (v > .02) SFX.hiss(v); }
    if (c.vFire > FIRE.burn + FIRE.ext) {
      c.vFire = 0; c.vExt = false; c.dirt = Math.min(1, c.dirt + FIRE.foam); c.cem = !!c.Fc;
      for (let i = 0; i < 10; i++) addP({ t: 'd', x: c.x, y: c.y, z: 4, vx: (Math.random() - .5) * 50, vy: (Math.random() - .5) * 50, vz: 30, col: i % 2 ? '#ffffff' : '#dfe8ee', s: 2, life: .5, ml: .5 });
    }
  }
}

// ======================================================= the computer cars

// follow the points of a branch (the tube, the channel, the bay) from where the car is: null when it is at the end or far off it
function follow(c, W, P) {
  let k = W.k, bd = 1e9;
  for (let q = W.k; q < Math.min(P.length, W.k + 30); q++) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  W.k = k;
  if (k >= P.length - 4 || bd > 70 * 70 || (G.state !== 'race' && G.state !== 'finish')) return null;
  const p = P[Math.min(P.length - 1, k + 9)];
  return [p.x, p.y];
}

const dirtyAt = () => [.4, .55, .7][G.raceDiff || 0];

// at the fork, once a lap: the channel or the tube while they are open (the tube when a cloud rolls down the open way or is about to come); a dirty car takes the open
// way (the bay). If the lava comes before the car is in, it stays on the open way
function wayTarget(c) {
  const T = G.T, V = T.volcano, tb = V.tube, rn = V.rinne, N = T.N, ev = T.ev; if (!tb || !rn || !ev || c.finished) return null;
  if (!c.vWay) {
    const ahead = Math.min((tb.fork - c.idx + N) % N, (rn.fork - c.idx + N) % N); if (ahead > 18 || ahead < 1 || c.vDecide === c.lap) return null; // (close enough to reach the first points of both ways)
    c.vDecide = c.lap;
    if (c.dirt > dirtyAt()) return null;
    const h = hash(((c.seed * 100) | 0) * 31 + c.lap * 977, c.lap, 131), rOpen = !ev.vlFlood.r, tOpen = !ev.vlFlood.t;
    const cl = ev.vlCloud, soon = ev.vlGlutOn && ev.vlLate && ev.vlCloudCd < 3.5, cloud = (cl && (cl.warn || cl.s < (V.cloud[1] - V.cloud[0] + N) % N * .75)) || soon;
    const kind = rOpen && h < .42 ? 'r' : tOpen && (cloud || h < (rOpen ? .7 : .3)) ? 't' : null;
    if (!kind) return null;
    c.vWay = { kind, k: 0 };
  }
  const W = c.vWay;
  if (ev.vlFlood[W.kind] && W.k < 14) { c.vWay = null; return null; }
  const p = follow(c, W, W.kind === 'r' ? rn.pts : tb.pts); if (!p) c.vWay = null;
  return p;
}

// a dirty computer car turns into the fire brigade's bay beside the open way (the same limits as the desert and the ice)
function bayTarget(c) {
  const T = G.T, B = T.volcano.bay, N = T.N; if (!B) return null;
  if (!c.vBay && (G.state === 'race' || G.state === 'finish') && c.dirt > dirtyAt() && !c.vWay && (B.i0 - c.idx + N) % N < 40) c.vBay = { k: 0 };
  if (!c.vBay) return null;
  const p = follow(c, c.vBay, B.P); if (!p) c.vBay = null;
  return p;
}

// on the dike they keep to the middle; they steer away from where a fireball will land and from fires, but not always (each car each ball: 35 / 55 / 75 % on
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

const inSpan = (i, [a, b]) => a <= b ? i >= a && i <= b : i >= a || i <= b;

// slowly through the tube and the bay, a little careful in the channel, a little less gas on the dike, before the hairpins of the serpentine
function volcanoThrottle(c, thr) {
  if (c.vBay) return Math.min(thr, .6);
  if ((c.vWay && c.vWay.kind === 't') || c.vTk !== undefined) return Math.min(thr, .82);
  if ((c.vWay && c.vWay.kind === 'r') || c.vRk !== undefined) return Math.min(thr, .9);
  const T = G.T, V = T.volcano, N = T.N, i = c.idx;
  if (inSpan(i, V.dike)) return thr * .92;
  if (!inSpan(i, V.serp)) return thr;
  const a = Math.atan2(T.tan[i].y, T.tan[i].x), b = Math.atan2(T.tan[(i + 34) % N].y, T.tan[(i + 34) % N].x);
  return thr * (1 - clamp((Math.abs(angDiff(a, b)) - .5) / 1.6, 0, .4));
}

// ======================================================= event "glutwolke": a glowing cloud rolls down the open way

// the cloud: s = how far it has rolled (points of the centre line from cloud[0]); first it builds up at the rim for CLOUD.warn s. The countdown only runs while a car is
// on its way to the rim or on the open way down (nobody there: no cloud); a new one only in lap 2 (in lap 3 the open way is the only one left, unless the lava stays off)
function updateCloud(T, dt) {
  const ev = T.ev, V = T.volcano, N = T.N, [c0, c1] = V.cloud, span = (c1 - c0 + N) % N;
  if (!ev.vlCloud) {
    const L = G.player || leader(); if (!L || (ev.vlLavaOn && L.lap >= 3)) return;
    if (G.cars.some(c => !c.finished && (c.idx - (c0 - 420) + N) % N < span + 420)) ev.vlCloudCd -= dt;
    if (ev.vlCloudCd <= 0) {
      const k = ev.vlCloudK++;
      ev.vlCloud = { t: 0, s: 0, warn: true, hit: new Set(), fade: 0 };
      ev.vlCloudCd = CLOUD.per[0] + hash(k, 1, 96) * (CLOUD.per[1] - CLOUD.per[0]);
      const p = T.path[c0], v = clamp(1 - near(p.x, p.y) / 700, .25, 1); SFX.boom(v); SFX.glut(v);
    }
    return;
  }
  const cl = ev.vlCloud; cl.t += dt; cl.warn = cl.t < CLOUD.warn;
  if (cl.warn) return;
  if (cl.s < span) cl.s = Math.min(span, cl.s + CLOUD.v * dt); else { cl.fade += dt; if (cl.fade > 1.2) { ev.vlCloud = null; return; } }
  // who is in it: on the open way (not in the tube, not in the bay), between its tail and its front
  const ci = (c0 + Math.round(cl.s)) % N;
  for (const c of G.cars) {
    if (c.fall > 0 || c.z > 0 || c.vTk !== undefined || c.vRk !== undefined || T.volcano.laneM[(c.y | 0) * T.W + (c.x | 0)]) continue;
    let rel = (c.idx - ci + N) % N; if (rel > N / 2) rel -= N;
    if (rel < -CLOUD.tail || rel > CLOUD.front || c.off > CLOUD.wide || cl.fade > .6) continue;
    c.vAsh = .5; c.dirt = Math.min(1, c.dirt + 1.3 / 60); c.cem = false;
    if (!cl.hit.has(c)) { cl.hit.add(c); if (!c.ai) SFX.cough(); }
  }
}

// ======================================================= drawing

function drawVolcanoGround() {
  const T = G.T, V = T.volcano, ev = T.ev, k = Math.floor(G.time * 4);
  // the lava shimmers (also where it flowed in during the race)
  for (let q = 0; q < 70 && V.lavaPix.length; q++) { const p = V.lavaPix[(hash(q, k, 102) * V.lavaPix.length) | 0]; R1(p % T.W, (p / T.W) | 0, 2, 1, q % 3 ? '#ffe27a' : '#fff4c0'); }
  const sh = ev.vlShim; for (let q = 0; q < 24 && sh.length; q++) { const p = sh[(hash(q, k, 103) * sh.length) | 0]; R1(p % T.W, (p / T.W) | 0, 2, 1, q % 3 ? '#ffe27a' : '#fff4c0'); }
  // bubbles burst on the crater lake; a fountain bubbles hard before it spouts
  const [cx, cy, crx, cry] = V.crater;
  if (inView(cx, cy, 200)) {
    for (let q = 0; q < 8; q++) {
      const ph = (G.time * .7 + q * .37) % 1, a = hash(q, Math.floor(G.time * .7 + q * .37), 104) * TAU, rr = Math.sqrt(hash(q, Math.floor(G.time * .7 + q * .37), 105)) * .75;
      const x = Math.round(cx + Math.cos(a) * crx * rr), y = Math.round(cy + Math.sin(a) * cry * rr), r = Math.round(1 + ph * 4);
      if (Math.abs(y - cy) < 28) continue; // (not on the dike)
      if (ph < .8) { ctx.globalAlpha = .9; disc(x, y, r, '#ffd04a'); R1(x - 1, y - r, 2, 1, '#fff4c0'); } else { ctx.globalAlpha = 1 - (ph - .8) * 5; for (let s = 0; s < 6; s++) R1(Math.round(x + Math.cos(s) * 6), Math.round(y + Math.sin(s) * 6), 1, 1, '#ffd04a'); }
      ctx.globalAlpha = 1;
    }
    V.fountains.forEach(([x, y], q) => { const f = fountain(q); if (f.warn) { ctx.globalAlpha = .6 + .3 * Math.sin(G.time * 25); disc(x, y, 5 + Math.round(f.u * 4), '#fff4c0'); ctx.globalAlpha = 1; } });
  }
  drawPlugs(T, V, ev);
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

// the plug in the crater rim glows and smokes before it bursts; before the lava spills into the tube it boils up at the top of the channel
function drawPlugs(T, V, ev) {
  const rn = V.rinne, bl = .5 + .5 * Math.sin(G.time * 9);
  if (ev.vlWarn.r && !ev.vlFlood.r) {
    const [x0, y0, x1, y1] = rn.breach, x = (x0 + x1) / 2, y = (y0 + y1) / 2;
    if (inView(x, y, 60)) {
      ctx.globalAlpha = .25 + .35 * bl; ell(Math.round(x), Math.round(y), 40, 12, '#ff6a1a'); ctx.globalAlpha = 1;
      for (let q = 0; q < 10; q++) if (hash(q, Math.floor(G.time * 10), 160) < .6) R1(Math.round(x0 + (x1 - x0) * hash(q, 1, 161)), Math.round(y0 + (y1 - y0) * hash(q, 1, 161) + (hash(q, 2, 161) - .5) * 14), 2, 1, q % 2 ? '#ffd04a' : '#ff7a1a');
      if (Math.random() < .3) addP({ t: 'smoke', x: x + (Math.random() - .5) * 50, y, vx: (Math.random() - .5) * 10, vy: -14, life: 1.2, ml: 1.2 });
    }
  }
  if (ev.vlWarn.t && !ev.vlFlood.t && ev.vlFlood.r) {
    const P = rn.pts, p = P[Math.min(P.length - 1, 16)];
    if (inView(p.x, p.y, 60)) {
      for (let q = 0; q < 10; q++) {
        const ph = (G.time * 1.3 + q * .23) % 1, s = P[Math.floor(hash(q, Math.floor(G.time * 1.3 + q * .23), 162) * 30)];
        const x = Math.round(s.x + (hash(q, 3, 162) - .5) * 24), y = Math.round(s.y + (hash(q, 4, 162) - .5) * 10);
        ctx.globalAlpha = 1 - ph; disc(x, y, Math.round(1 + ph * 4), '#ffe27a');
      }
      ctx.globalAlpha = .2 + .3 * bl; ell(Math.round(p.x - 10), Math.round(p.y - 10), 34, 26, '#ff8a2a'); ctx.globalAlpha = 1;
    }
  }
}

// the board at the fork: an arrow for each way down (open way up-left, tube left, channel down), green while open, a red cross when the lava has it, blinking
// before; a lamp on top blinks red while a glowing cloud builds up or rolls
function drawBoard(T, V, ev) {
  const [fx, fy] = V.sign; if (!inView(fx, fy, 50)) return;
  const bl = ((G.time * 6) | 0) % 2, ARROW = { up: [[0, 0], [1, 1], [2, 2], [3, 3], [0, 1], [0, 2], [1, 0], [2, 0]], left: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [1, 1], [1, 3], [2, 0], [2, 4]], down: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4], [1, 3], [3, 3], [0, 2], [4, 2]] };
  [['up', null], ['left', 't'], ['down', 'r']].forEach(([a, key], q) => {
    const x = fx - 13 + q * 9, y = fy - 26, shut = key && ev.vlFlood[key], warn = key && !shut && ev.vlWarn[key];
    R1(x - 1, y - 1, 8, 8, '#1b1612');
    if (shut) { for (let s = 0; s < 6; s++) { R1(x + s, y + s, 1, 1, '#ff3b2a'); R1(x + 5 - s, y + s, 1, 1, '#ff3b2a'); } return; }
    const col = warn && bl ? '#ff9a2a' : '#3cd060';
    for (const [px, py] of ARROW[a]) R1(x + px + (a === 'up' ? 1 : 0), y + py + (a === 'up' ? 1 : 0), 1, 1, col);
  });
  const on = ev.vlCloud && !(ev.vlCloud.fade > 0), lb = on && bl;
  R1(fx - 3, fy - 35, 6, 5, '#1b1612'); R1(fx - 2, fy - 34, 4, 3, lb ? '#ff3b2a' : on ? '#7a1a10' : '#4a3a30');
  if (lb) { ctx.globalAlpha = .3; disc(fx, fy - 33, 7, '#ff3b2a'); ctx.globalAlpha = 1; }
}

// a lava fountain in the lake: every 5 to 8 s it bubbles (warn) and then spouts for 1.4 s (u = 0..1 while it spouts); more often in the last lap
function fountain(q) {
  const last = G.player && G.player.lap >= LAPS && G.T.ev && G.T.ev.vlErupt, per = (last ? 3.2 : 5.5) + q * .9, t = (G.time + q * 1.7) % per, s = per - 1.4;
  return { warn: t > s - 1.1 && t < s, on: t >= s, u: t >= s ? (t - s) / 1.4 : (t - (s - 1.1)) / 1.1, big: last };
}

// over the cars: the roof of the lava tube (or, inside, its darkness), lava fountains, fireballs, fires, burning cars and their extinguishers, the smoke, the
// cloud, the helicopter, the fire brigade, words
let tubeLM = null;
function drawVolcanoAbove() {
  const T = G.T, V = T.volcano, ev = T.ev, P = G.player;
  drawTube(T, V, P);
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
  drawCloud(T, V, ev);
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
  drawBoard(T, V, ev); // (over the top layer: the board is painted there)
  for (const c of G.cars) if (c.burnT > 0) text('AUA, HEISS!', Math.round(c.fx0 || c.x), Math.round((c.fy0 || c.y) - 24 - (1.3 - c.burnT) * 10), 8, '#ffb02e', 'center');
  if (P && P.vFire > 0 && !(P.fall > 0)) text(P.vExt ? 'PFFFT!' : 'ES BRENNT!', Math.round(P.x), Math.round(P.y - 44), 8, P.vExt ? '#f4f8fa' : '#ff8a3a', 'center');
  const cl = ev.vlCloud;
  if (cl && cl.warn && P && near(T.path[V.cloud[0]].x, T.path[V.cloud[0]].y) < 520 && ((G.time * 4) | 0) % 2 === 0) text('GLUTWOLKE!', Math.round(P.x), Math.round(P.y - 40), 8, '#ff6b3a', 'center');
  if (ev.vlMsg && P && ((G.time * 4) | 0) % 2 === 0) text(ev.vlMsg.s, Math.round(P.x), Math.round(P.y - 58), 8, '#ff9a3a', 'center');
  if (P && P.vAsh > 0) text('HUST!', Math.round(P.x), Math.round(P.y - 44), 8, '#d2ccc4', 'center');
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

// the lava tube: from outside its roof (the cone) hides it, the mouths glow; inside it is dark, only the lava rill, the cat's eyes and the headlights light it
function drawTube(T, V, P) {
  const tb = V.tube; if (!tb || !inView(tb.x + tb.W / 2, tb.y + tb.H / 2, Math.max(tb.W, tb.H) / 2 + 40)) return;
  const pj = P ? (P.y | 0) * T.W + (P.x | 0) : -1, inside = P && P.vTk !== undefined && P.fall <= 0 && tb.mask[((P.y | 0) - tb.y) * tb.W + (P.x | 0) - tb.x] && pj >= 0;
  if (!inside) {
    ctx.drawImage(tb.roof, tb.x, tb.y);
    // (the glow of the rill flickers in the mouths; a strong glow once the lava has spilled into the tube)
    const full = T.ev && T.ev.vlFlood && T.ev.vlFlood.t;
    for (const p of tb.portals) {
      for (let q = 0; q < 6; q++) if (hash(q, Math.floor(G.time * 8), p.x | 0) < .6) R1(Math.round(p.x + (hash(q, 1, p.y | 0) - .5) * 26), Math.round(p.y + (hash(q, 2, p.y | 0) - .5) * 14), 2, 1, q % 2 ? '#ff9a3a' : '#ffd04a');
      if (full) { ctx.globalAlpha = .35 + .1 * Math.sin(G.time * 6); ell(Math.round(p.x), Math.round(p.y), 22, 12, '#ff7a1a'); ctx.globalAlpha = 1; }
    }
    return;
  }
  if (!tubeLM || tubeLM.width !== tb.W || tubeLM.height !== tb.H) tubeLM = mk(tb.W, tb.H);
  const g = tubeLM.getContext('2d');
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, tb.W, tb.H); g.drawImage(tb.roof, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(10,5,3,.9)'; g.fillRect(0, 0, tb.W, tb.H);
  g.globalCompositeOperation = 'destination-out';
  g.globalAlpha = .82 + .12 * Math.sin(G.time * 7) * Math.sin(G.time * 3.1); g.drawImage(tb.lit, 0, 0); g.globalAlpha = 1;
  for (const c of G.cars) {
    if (c.fall > 0) continue;
    const x = c.x - tb.x, y = c.y - tb.y, fx = Math.cos(c.ang), fy = Math.sin(c.ang), nx = -fy, ny = fx;
    if (x < -90 || y < -90 || x > tb.W + 90 || y > tb.H + 90) continue;
    g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(x, y, 14, 0, TAU); g.fill();
    for (let q = 0; q < 3; q++) { const len = 80 - q * 18, half = 28 - q * 6; g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.moveTo(x + fx * 8 + nx * 4, y + fy * 8 + ny * 4); g.lineTo(x + fx * len + nx * half, y + fy * len + ny * half); g.lineTo(x + fx * len - nx * half, y + fy * len - ny * half); g.lineTo(x + fx * 8 - nx * 4, y + fy * 8 - ny * 4); g.closePath(); g.fill(); }
  }
  for (const e of tb.eyes) { g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(e.x - tb.x, e.y - tb.y, 5, 0, TAU); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(tubeLM, tb.x, tb.y);
  // the cat's eyes: amber on the left, white on the right, always bright
  for (const e of tb.eyes) if (inView(e.x, e.y, 6)) R1(e.x - 1, e.y - 1, 2, 2, e.s < 0 ? '#ffb22e' : '#f4f0e8');
  // sparks over the rill
  if (Math.random() < .4) { const k = (Math.random() * tb.pts.length) | 0, p = tb.pts[k]; if (inView(p.x, p.y, 20)) addP({ t: 'd', x: p.x + (Math.random() - .5) * 30, y: p.y + (Math.random() - .5) * 30, z: 4, vx: 0, vy: 0, vz: 30, col: '#ffb050', s: 1, life: .5, ml: .5 }); }
}

// the glowing cloud: while it builds up a dark plume rises at the west rim; then a wall of dark, glowing puffs rolls down the open way, wider than the road
function drawCloud(T, V, ev) {
  const cl = ev.vlCloud; if (!cl) return;
  const N = T.N, c0 = V.cloud[0];
  if (cl.warn) {
    const p = T.path[c0]; if (!inView(p.x, p.y, 160)) return;
    // (light grey billows with a dark underside and a glowing foot: they stand out on the black rock and on the red road)
    const u = cl.t / CLOUD.warn;
    for (let q = 0; q < 12; q++) {
      const ph = (G.time * .8 + q / 12) % 1, x = Math.round(p.x + 30 + Math.sin(q * 1.9 + G.time) * 18 * ph), y = Math.round(p.y - 6 - ph * 130 * u), r = Math.round(7 + ph * 22 * u);
      ctx.globalAlpha = (1 - ph * .8) * .9 * u; disc(x + 2, y + 3, r, '#2a2220'); disc(x, y, r, '#7a726c'); disc(x - Math.round(r * .3), y - Math.round(r * .3), Math.round(r * .55), '#aaa49e');
    }
    ctx.globalAlpha = 1;
    for (let q = 0; q < 10; q++) if (hash(q, Math.floor(G.time * 10), 123) < .7) R1(Math.round(p.x + 30 + (hash(q, 1, 124) - .5) * 30), Math.round(p.y - 4 - hash(q, 2, 124) * 60 * u), 1, 1, q % 2 ? '#ff7a1a' : '#ffd04a');
    return;
  }
  const a = cl.fade > 0 ? Math.max(0, 1 - cl.fade / 1.2) : 1, ci = (c0 + Math.round(cl.s)) % N, p0 = T.path[ci];
  if (!inView(p0.x, p0.y, 160)) return;
  for (let q = 0; q < 26; q++) {
    const along = CLOUD.front - (q / 25) * (CLOUD.tail + CLOUD.front), i = (ci + Math.round(along) + N) % N, p = T.path[i], n = T.nrm[i];
    const side = (hash(q, 1, 120) - .5) * 2 * (HALF + 8), roll = Math.sin(G.time * 3 + q * 1.3) * 4, r = 12 + hash(q, 2, 120) * 12 + Math.sin(G.time * 2 + q) * 2;
    const x = p.x + n.x * (side + roll), y = p.y + n.y * (side + roll) - 4;
    ctx.globalAlpha = .9 * a; disc(Math.round(x + 3), Math.round(y + 4), Math.round(r), '#1e1816');
    ctx.globalAlpha = .95 * a; disc(Math.round(x), Math.round(y), Math.round(r), q % 3 ? '#6e6660' : '#5a524e');
    ctx.globalAlpha = .85 * a; disc(Math.round(x - r * .3), Math.round(y - r * .35), Math.round(r * .55), '#a29c96');
  }
  // the glowing foot of the front
  { const p = T.path[(ci + CLOUD.front) % N]; ctx.globalAlpha = (.35 + .2 * Math.sin(G.time * 10)) * a; ell(Math.round(p.x), Math.round(p.y + 6), HALF + 6, 9, '#ff6a1a'); }
  // embers in it
  ctx.globalAlpha = a;
  for (let q = 0; q < 30; q++) {
    const i = (ci + Math.round(CLOUD.front - hash(q, 3, 121) * (CLOUD.tail + CLOUD.front)) + N) % N, p = T.path[i], n = T.nrm[i], s = (hash(q, 4, 121) - .5) * 2 * HALF;
    if (((G.time * 6 + q) | 0) % 3) R1(Math.round(p.x + n.x * s), Math.round(p.y + n.y * s - 6), 1, 1, q % 2 ? '#ff7a1a' : '#ffd04a');
  }
  ctx.globalAlpha = 1;
  if (Math.random() < .6) addP({ t: 'smoke', x: p0.x + (Math.random() - .5) * 60, y: p0.y + (Math.random() - .5) * 60, vx: (Math.random() - .5) * 20, vy: -12, life: 1.2, ml: 1.2 });
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

// on the screen: the red sky and the ash rain of the eruption; the dark of the cloud when you are in it
function drawVolcanoSky(cx, cy) {
  const ev = G.T.ev, P = G.player;
  if (ev && ev.vlErupt) {
    ctx.fillStyle = 'rgba(110,24,0,' + Math.min(.18, ev.vlErupt.t * .1).toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 80; i++) {
      const x = ((hash(i, 2, 107) * (VW + 40) + Math.sin(G.time * .6 + i) * 8 - cx * .3) % (VW + 40) + VW + 40) % (VW + 40) - 20;
      const y = ((hash(i, 3, 107) * (VH + 20) + G.time * (10 + hash(i, 1, 107) * 14) - cy * .3) % (VH + 20) + VH + 20) % (VH + 20) - 10;
      ctx.globalAlpha = .45 + hash(i, 4, 107) * .4; R1(Math.round(x), Math.round(y), 1 + (i % 4 === 0 ? 1 : 0), 1, i % 3 ? '#8a8682' : '#5a5652');
    }
    ctx.globalAlpha = 1;
  }
  if (P && P.vAsh > 0) {
    ctx.fillStyle = 'rgba(40,34,32,' + (.55 * Math.min(1, P.vAsh * 3)).toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 40; i++) R1((hash(i, Math.floor(G.time * 8), 122) * VW) | 0, (hash(i, 7, Math.floor(G.time * 8)) * VH) | 0, 1, 1, i % 2 ? '#ff7a1a' : '#ffd04a');
  }
}

// ---------- hooks: how the core calls this track (hooks.js; what each hook does: _template.js) ----------
/** @type {import('./_template.js').TrackHooks} */
export const volcanoHooks = {
  init: initVolcano, update: volcanoUpdate,
  events: { ausbruch: T => { T.ev.vlErOn = true; }, glutwolke: T => { T.ev.vlGlutOn = true; }, lavastrom: T => { T.ev.vlLavaOn = true; } },
  surf: volcanoSurf, progress: volcanoProgress, target: c => wayTarget(c) || bayTarget(c), lane: volcanoLane, throttle: volcanoThrottle, ground: volcanoGround,
  // (back on the road after the lava: a puff of smoke, not a splash of water; the fire is out, the soot is black)
  respawn(c) { c.vFire = 0; c.vExt = false; c.cem = false; for (let i = 0; i < 10; i++) addP({ t: 'smoke', x: c.x + (Math.random() - .5) * 16, y: c.y + (Math.random() - .5) * 12, vx: (Math.random() - .5) * 16, vy: -10, life: .8, ml: .8 }); },
  drawGround: drawVolcanoGround, drawAbove: drawVolcanoAbove, drawSky: drawVolcanoSky,
};
