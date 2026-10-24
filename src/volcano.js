import { G } from './g.js';
import { SFX } from './audio.js';
import { HALF, LAPS, TAU, VH, VW, angDiff, clamp, ctx, hash, hex, mk, vnoise } from './core.js';
import { R1, disc, ell, text } from './gfx.js';
import { snap } from './undo.js';
import { addP } from './particles.js';
import { cam } from './state.js';
import { inView, near } from './trackfx.js';
import { GLASS, TUBE } from './volcanomap.js';

// ---------- Vulkan Rev 2 while racing (plaene/VULKAN_REV2.md) ----------
// Always: the lava lake boils (fountains that bubble before they spout, only to look at), the volcano smokes and rumbles now and then, the hornitos puff, the
// fire brigade sprays its bay (the only way to get clean), the lava tube is dark inside (the lava rill, the cat's eyes and the headlights show the way).
// The computer cars choose at the fork: the tube when a glowing cloud is rolling down or about to come (and some always), the open way when they are dirty (the bay).
// Event "ausbruch": from lap 2 the volcano erupts: a red sky, ash rain, a column of smoke, a helicopter, and lava bombs in the lava field (a red circle shows where
// they land; there a little lava stays for a moment and cools to ash). In the last lap sparks rain down and the lake spouts more.
// Event "glutwolke": from lap 2 every 14 to 20 s a glowing cloud rolls down the open way from the west rim (a bang, a plume, "GLUTWOLKE!", the lamp at the fork
// blinks); who is in it gets sooty and slow and coughs. The two events never meet: the bombs fall in the lava field, the cloud rolls down the west flank.

const BOMB = { warn: 1.5, r: 20, spot: 5, sr: 8, per: [4, 6] };
const CLOUD = { v: 46, warn: 1.8, tail: 36, front: 12, wide: HALF + 16, per: [14, 20], first: 3 }; // (v, tail, front in points of the centre line: 2 px each)

// ======================================================= always

function initVolcano(T) {
  const ev = T.ev, V = T.volcano;
  ev.obst = V.hornitos.slice(); ev.vlBombs = []; ev.vlSpots = []; ev.vlErupt = null; ev.vlLate = false; ev.vlCloud = null; ev.vlCloudCd = CLOUD.first; ev.vlCloudK = 0;
  ev.vlQuake = 0; ev.vlNextQuake = 6;
}

function volcanoUpdate(T, dt) {
  const ev = T.ev, V = T.volcano, t = ev.t;
  // lap 1: it only smokes and rumbles now and then (the camera shakes a little, the needle of the seismograph jumps)
  ev.vlQuake = Math.max(0, ev.vlQuake - dt);
  if (t > ev.vlNextQuake) { ev.vlNextQuake = t + 8 + hash(Math.floor(t), 1, 97) * 6; ev.vlQuake = 1.2; SFX.rumble(); G.jumpShake = Math.max(G.jumpShake, .25); }
  for (const v of V.vents) if (Math.random() < dt * 1.6 && near(v.x, v.y) < 320) addP({ t: 'smoke', x: v.x + (Math.random() - .5) * 6, y: v.y, vx: 3, vy: -9, life: 1.5, ml: 1.5 });
  for (const h of V.hornitos) if (Math.random() < dt * 2 && near(h.x, h.y) < 300) addP({ t: 'smoke', x: h.x, y: h.y - 2, vx: (Math.random() - .5) * 6, vy: -14, life: 1, ml: 1 });
  // from lap 2 (when you go into it): the eruption
  if (!ev.vlLate && G.player && G.player.lap >= 2) {
    ev.vlLate = true;
    if (ev.vlErOn) {
      ev.vlErupt = { t: 0, next: 1.5, n: 0 };
      // (lava spots turn to ash on the ground; this puts it back after the race. Only the lava field, where the bombs land: the whole map would make it jolt)
      const [z0, z1] = V.bombs; let x0 = T.W, y0 = T.H, x1 = 0, y1 = 0;
      for (let i = z0; i !== z1; i = (i + 1) % T.N) { const p = T.path[i]; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
      snap(T, Math.floor(x0 - HALF - 24), Math.floor(y0 - HALF - 24), Math.ceil(x1 - x0 + 2 * HALF + 48), Math.ceil(y1 - y0 + 2 * HALF + 48));
      SFX.bang(); G.jumpShake = .9; ev.vlQuake = 2;
    }
  }
  if (ev.vlErupt) updateBombs(T, dt);
  if (ev.vlGlutOn && ev.vlLate) updateCloud(T, dt);
  ev.obst = V.hornitos.concat(ev.vlBombs.filter(b => b.t < BOMB.warn), ev.vlSpots.map(s => ({ x: s.x, y: s.y, r: BOMB.sr + 2 })));
  // the last lap: sparks rain down over the whole map
  if (ev.vlErupt && G.player && G.player.lap >= LAPS && Math.random() < dt * 30) addP({ t: 'd', x: cam.x + Math.random() * VW, y: cam.y + Math.random() * VH, z: 60, vx: (Math.random() - .5) * 20, vy: 10, vz: -20, col: ['#ff7a1a', '#ffd04a', '#ff4a1a'][(Math.random() * 3) | 0], s: 1, life: 1.4, ml: 1.4 });
}

// the ground under a car: where it is in the lava tube (c.vTk, for its place in the lap), the fire brigade's water, ash dust, the smoke of a car that came out of a cloud
function volcanoGround(c, j, sp, dt) {
  const T = G.T, V = T.volcano, tb = V.tube, q = tb && tb.at.get(j);
  c.vTk = q && q[0] < tb.half + 2 && (T.ter[j] === TUBE || T.alt[j]) ? q[1] : undefined;
  if (T.washMask[j]) { if (!c.vWash) { c.vWash = true; if (!c.ai || near(c.x, c.y) < 260) SFX.hose(c.ai ? .4 : 1); } } else c.vWash = false;
  if (c.surf === 2 && sp > 20 && Math.random() < dt * 25) addP({ t: 'smoke', x: c.x - Math.cos(c.ang) * 12, y: c.y - Math.sin(c.ang) * 12, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, life: .6, ml: .6 });
  if (c.vAsh > 0) { c.vAsh = Math.max(0, c.vAsh - dt); if (Math.random() < dt * 10) addP({ t: 'smoke', x: c.x, y: c.y, vx: (Math.random() - .5) * 14, vy: -10, life: .8, ml: .8 }); }
  c.burnT = Math.max(0, (c.burnT || 0) - dt);
}

// the floor of the lava tube is rough: a little slower, full grip. Obsidian is glass: full speed, but it slides like sheet ice (a little less), nimble cars hold best
function volcanoSurf(c) { return c.surf === TUBE ? [.86, 9, .95] : c.surf === GLASS ? [1, 1.6 * c.def.turn * c.def.turn, .6, .6] : null; }

// parts of the centre line lie close together (the serpentine legs); in the tube a car's place in the lap comes from its place in the tube
function volcanoProgress(c, best) {
  const T = G.T, tb = T.volcano.tube, N = T.N;
  if (tb && c.vTk !== undefined) return tb.idx[c.vTk];
  let bi = best, bd = 1e9;
  for (let k = -200; k <= 200; k++) { const i = (c.idx + k + N) % N, p = T.path[i], d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (d < bd) { bd = d; bi = i; } }
  return bd < 22500 ? bi : best;
}

// ======================================================= the computer cars

// follow the points of a branch (the tube, the bay) from where the car is: null when it is at the end or far off it
function follow(c, W, P) {
  let k = W.k, bd = 1e9;
  for (let q = W.k; q < Math.min(P.length, W.k + 30); q++) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  W.k = k;
  if (k >= P.length - 4 || bd > 70 * 70 || (G.state !== 'race' && G.state !== 'finish')) return null;
  const p = P[Math.min(P.length - 1, k + 9)];
  return [p.x, p.y];
}

const dirtyAt = () => [.4, .55, .7][G.raceDiff || 0];

// at the fork, once a lap: into the tube when a cloud rolls down the open way or is about to come, and some cars always; a dirty car takes the open way (the bay)
function tubeTarget(c) {
  const T = G.T, tb = T.volcano.tube, N = T.N, ev = T.ev; if (!tb || !ev || c.finished) return null;
  if (!c.vTube) {
    const ahead = (tb.fork - c.idx + N) % N; if (ahead > 26 || ahead < 1 || c.vDecide === c.lap) return null; // (close to the fork: the way in is within reach)
    c.vDecide = c.lap;
    const cl = ev.vlCloud, soon = ev.vlGlutOn && ev.vlLate && ev.vlCloudCd < 3.5;
    const want = c.dirt <= dirtyAt() && ((cl && (cl.warn || cl.s < (T.volcano.cloud[1] - T.volcano.cloud[0] + N) % N * .75)) || soon || (c.seed * 7.7) % 1 < .3);
    if (!want) return null;
    c.vTube = { k: 0 };
  }
  const p = follow(c, c.vTube, tb.pts); if (!p) c.vTube = null;
  return p;
}

// a dirty computer car turns into the fire brigade's bay beside the open way (the same limits as the desert and the ice)
function bayTarget(c) {
  const T = G.T, B = T.volcano.bay, N = T.N; if (!B) return null;
  if (!c.vBay && (G.state === 'race' || G.state === 'finish') && c.dirt > dirtyAt() && !c.vTube && (B.i0 - c.idx + N) % N < 40) c.vBay = { k: 0 };
  if (!c.vBay) return null;
  const p = follow(c, c.vBay, B.P); if (!p) c.vBay = null;
  return p;
}

// on the dike they keep to the middle; they steer away from where a lava bomb will land (on LEICHT they do not always see it)
function volcanoLane(c, i, lane) {
  const T = G.T, V = T.volcano, ev = T.ev, p = T.path[i], n = T.nrm[i]; if (!ev) return lane;
  if (inSpan(i, V.dike)) return lane * .3;
  if ((G.raceDiff || 0) > 0 || (c.seed * 3.1) % 1 < .5) for (const b of ev.vlBombs) {
    if (b.t >= BOMB.warn) continue;
    const x = p.x + n.x * lane, y = p.y + n.y * lane; if (Math.hypot(x - b.x, y - b.y) > BOMB.r + 8) continue;
    const o = (b.x - p.x) * n.x + (b.y - p.y) * n.y; return clamp(o > 0 ? o - 30 : o + 30, -26, 26);
  }
  return lane;
}

const inSpan = (i, [a, b]) => a <= b ? i >= a && i <= b : i >= a || i <= b;

// slowly through the tube and the bay, a little less gas on the dike, before the hairpins of the serpentine
function volcanoThrottle(c, thr) {
  if (c.vBay) return Math.min(thr, .6);
  if (c.vTube || c.vTk !== undefined) return Math.min(thr, .82);
  const T = G.T, V = T.volcano, N = T.N, i = c.idx;
  if (inSpan(i, V.dike)) return thr * .92;
  if (!inSpan(i, V.serp)) return thr;
  const a = Math.atan2(T.tan[i].y, T.tan[i].x), b = Math.atan2(T.tan[(i + 34) % N].y, T.tan[(i + 34) % N].x);
  return thr * (1 - clamp((Math.abs(angDiff(a, b)) - .5) / 1.6, 0, .4));
}

// ======================================================= event "ausbruch": lava bombs in the lava field

function updateBombs(T, dt) {
  const ev = T.ev, e = ev.vlErupt, V = T.volcano, N = T.N, [z0, z1] = V.bombs; e.t += dt;
  // every 4 to 6 s a bomb, aimed a little ahead of a car in the lava field (not at the ramp: there you cannot steer)
  if (e.t >= e.next) {
    const inZ = G.cars.filter(c => !c.finished && c.fall <= 0 && inSpan(c.idx, [z0, z1]));
    e.next = e.t + BOMB.per[0] + hash(e.n, 3, 98) * (BOMB.per[1] - BOMB.per[0]);
    if (inZ.length) {
      const c = inZ[Math.floor(hash(e.n, 4, 98) * inZ.length)], i = (c.idx + 30 + Math.floor(hash(e.n, 1, 98) * 24)) % N;
      if (inSpan(i, [z0, z1]) && Math.abs(((i - V.jumpI + N) % N + N / 2) % N - N / 2) > 34) {
        const p = T.path[i], o = (hash(e.n, 2, 98) - .5) * 44;
        ev.vlBombs.push({ x: p.x + T.nrm[i].x * o, y: p.y + T.nrm[i].y * o, t: 0, whistle: false });
      }
    }
    e.n++;
  }
  for (let q = ev.vlBombs.length - 1; q >= 0; q--) {
    const b = ev.vlBombs[q]; b.t += dt;
    if (!b.whistle && b.t > BOMB.warn - .9) { b.whistle = true; if (near(b.x, b.y) < 300) SFX.bombWhistle(); }
    if (b.t < BOMB.warn) continue;
    ev.vlBombs.splice(q, 1);
    // the impact: who is in the circle is thrown away (like by a cow) and gets sooty; a little lava stays for a moment
    for (const c of G.cars) {
      if (c.fall > 0 || c.z > 0) continue;
      const dx = c.x - b.x, dy = c.y - b.y, d = Math.hypot(dx, dy); if (d > BOMB.r) continue;
      const nx = d ? dx / d : 1, ny = d ? dy / d : 0;
      c.vx = nx * 150; c.vy = ny * 150; c.spin = 12; c.stun = 1; c.boost = 0; c.dirt = 1;
      if (!c.ai) SFX.crash();
    }
    for (let i = 0; i < 24; i++) addP({ t: 'd', x: b.x, y: b.y, z: 4, vx: Math.cos(i / 24 * TAU) * (40 + Math.random() * 60), vy: Math.sin(i / 24 * TAU) * (40 + Math.random() * 60), vz: 70, col: ['#ff7a1a', '#ffd04a', '#3a3836'][i % 3], s: 2, life: .7, ml: .7 });
    if (near(b.x, b.y) < 380) SFX.boom(clamp(1 - near(b.x, b.y) / 380, .2, 1));
    const pix = [];
    for (let y = Math.round(b.y - BOMB.sr); y <= b.y + BOMB.sr; y++) for (let x = Math.round(b.x - BOMB.sr); x <= b.x + BOMB.sr; x++) {
      if (x < 0 || y < 0 || x >= T.W || y >= T.H || Math.hypot(x + .5 - b.x, y + .5 - b.y) > BOMB.sr - .5 + (vnoise(x * .3, y * .3, 99) - .5) * 2) continue;
      const j = y * T.W + x; if (T.ter[j] !== 0 && T.ter[j] !== 1 && T.ter[j] !== 2) continue; pix.push(j); T.ter[j] = 15;
    }
    ev.vlSpots.push({ x: b.x, y: b.y, t: 0, pix, pic: lavaPic(T, pix) });
  }
  for (let q = ev.vlSpots.length - 1; q >= 0; q--) {
    const s = ev.vlSpots[q]; s.t += dt; if (s.t < BOMB.spot) continue;
    // it cools down to a patch of ash
    const b = T.base.getContext('2d'), MUD = T.th.mud.map(hex), x0 = Math.round(s.x - 10), y0 = Math.round(s.y - 10), img = b.getImageData(x0, y0, 21, 21), d = img.data;
    for (const j of s.pix) { T.ter[j] = 2; const x = j % T.W, y = j / T.W | 0, c = MUD[(hash(x, y, 100) * 3) | 0], k = ((y - y0) * 21 + x - x0) * 4; if (k >= 0 && k < d.length) { d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; } }
    b.putImageData(img, x0, y0); ev.vlSpots.splice(q, 1);
  }
}

// a picture of lava over some pixels (a lava spot)
function lavaPic(T, pix) {
  if (!pix.length) return null;
  let x0 = T.W, y0 = T.H, x1 = 0, y1 = 0; for (const j of pix) { const x = j % T.W, y = j / T.W | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const W = x1 - x0 + 1, H = y1 - y0 + 1, cv = mk(W, H), g = cv.getContext('2d'), img = g.createImageData(W, H), q = img.data;
  for (const j of pix) {
    const x = j % T.W, y = j / T.W | 0, v = vnoise(x / 6, y / 6, 101), c = v > .7 ? [255, 208, 74] : v > .4 ? [255, 162, 31] : [255, 122, 26], k = ((y - y0) * W + x - x0) * 4;
    q[k] = c[0]; q[k + 1] = c[1]; q[k + 2] = c[2]; q[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return { c: cv, x: x0, y: y0 };
}

// ======================================================= event "glutwolke": a glowing cloud rolls down the open way

// the cloud: s = how far it has rolled (points of the centre line from cloud[0]); first it builds up at the rim for CLOUD.warn s. The countdown only runs while a car is
// on its way to the rim or on the open way down (nobody there: no cloud)
function updateCloud(T, dt) {
  const ev = T.ev, V = T.volcano, N = T.N, [c0, c1] = V.cloud, span = (c1 - c0 + N) % N;
  if (!ev.vlCloud) {
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
    if (c.fall > 0 || c.z > 0 || c.vTk !== undefined || T.volcano.laneM[(c.y | 0) * T.W + (c.x | 0)]) continue;
    let rel = (c.idx - ci + N) % N; if (rel > N / 2) rel -= N;
    if (rel < -CLOUD.tail || rel > CLOUD.front || c.off > CLOUD.wide || cl.fade > .6) continue;
    c.vAsh = .5; c.dirt = Math.min(1, c.dirt + 1.3 / 60);
    if (!cl.hit.has(c)) { cl.hit.add(c); if (!c.ai) SFX.cough(); }
  }
}

// ======================================================= drawing

function drawVolcanoGround() {
  const T = G.T, V = T.volcano, ev = T.ev, k = Math.floor(G.time * 4);
  // the lava shimmers
  for (let q = 0; q < 70 && V.lavaPix.length; q++) { const p = V.lavaPix[(hash(q, k, 102) * V.lavaPix.length) | 0]; R1(p % T.W, (p / T.W) | 0, 2, 1, q % 3 ? '#ffe27a' : '#fff4c0'); }
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
  // where a lava bomb will land: a red circle that gets smaller; the lava spots
  for (const s of ev.vlSpots) if (s.pic) { ctx.globalAlpha = s.t > BOMB.spot - 1 ? BOMB.spot - s.t : 1; ctx.drawImage(s.pic.c, s.pic.x, s.pic.y); ctx.globalAlpha = 1; }
  for (const b of ev.vlBombs) {
    if (!inView(b.x, b.y)) continue;
    const r = Math.round(BOMB.r * (1.6 - .6 * b.t / BOMB.warn)), bl = ((G.time * 10) | 0) % 2;
    ctx.fillStyle = bl ? '#ff3b2a' : '#ffd04a';
    for (let a = 0; a < TAU; a += .12) ctx.fillRect(Math.round(b.x + Math.cos(a) * r), Math.round(b.y + Math.sin(a) * r * .8), 2, 2);
    ctx.globalAlpha = .18; ell(Math.round(b.x), Math.round(b.y), BOMB.r, Math.round(BOMB.r * .8), '#ff3b2a'); ctx.globalAlpha = 1;
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
  // the lamp on the warning board at the fork: it blinks red while a cloud builds up or rolls, a black "!" on the board
  const [fx, fy] = V.sign;
  if (inView(fx, fy, 40)) {
    const on = ev.vlCloud && !(ev.vlCloud.fade > 0), bl = on && ((G.time * 6) | 0) % 2;
    R1(fx - 1, fy - 23, 2, 5, '#1b1612'); R1(fx - 1, fy - 17, 2, 2, '#1b1612');
    R1(fx - 3, fy - 31, 6, 5, '#1b1612'); R1(fx - 2, fy - 30, 4, 3, bl ? '#ff3b2a' : on ? '#7a1a10' : '#4a3a30');
    if (bl) { ctx.globalAlpha = .3; disc(fx, fy - 29, 7, '#ff3b2a'); ctx.globalAlpha = 1; }
  }
}

// a lava fountain in the lake: every 5 to 8 s it bubbles (warn) and then spouts for 1.4 s (u = 0..1 while it spouts); more often in the last lap
function fountain(q) {
  const last = G.player && G.player.lap >= LAPS && G.T.ev && G.T.ev.vlErupt, per = (last ? 3.2 : 5.5) + q * .9, t = (G.time + q * 1.7) % per, s = per - 1.4;
  return { warn: t > s - 1.1 && t < s, on: t >= s, u: t >= s ? (t - s) / 1.4 : (t - (s - 1.1)) / 1.1, big: last };
}

// over the cars: the roof of the lava tube (or, inside, its darkness), lava fountains, flying bombs, the smoke, the cloud, the helicopter, the fire brigade, words
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
  // lava bombs flying from the crater to their circle
  const [cx, cy] = V.crater;
  for (const b of ev.vlBombs) {
    const u = (b.t - (BOMB.warn - 1)) / 1; if (u < 0) continue;
    const x = cx + (b.x - cx) * u, y = cy + (b.y - cy) * u - Math.sin(u * Math.PI) * 140;
    for (let q = 1; q < 6; q++) { const v = Math.max(0, u - q * .04), tx = cx + (b.x - cx) * v, ty = cy + (b.y - cy) * v - Math.sin(v * Math.PI) * 140; ctx.globalAlpha = .5 - q * .08; disc(Math.round(tx), Math.round(ty), 2, '#ff7a1a'); }
    ctx.globalAlpha = 1; disc(Math.round(x), Math.round(y), 4, '#3a1a10'); disc(Math.round(x), Math.round(y), 3, '#ff7a1a'); R1(Math.round(x) - 1, Math.round(y) - 2, 2, 2, '#ffd04a');
  }
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
  for (const c of G.cars) if (c.burnT > 0) text('AUA, HEISS!', Math.round(c.fx0 || c.x), Math.round((c.fy0 || c.y) - 24 - (1.3 - c.burnT) * 10), 8, '#ffb02e', 'center');
  const cl = ev.vlCloud;
  if (cl && cl.warn && P && near(T.path[V.cloud[0]].x, T.path[V.cloud[0]].y) < 520 && ((G.time * 4) | 0) % 2 === 0) text('GLUTWOLKE!', Math.round(P.x), Math.round(P.y - 40), 8, '#ff6b3a', 'center');
  if (P && P.vAsh > 0) text('HUST!', Math.round(P.x), Math.round(P.y - 26), 8, '#d2ccc4', 'center');
  const B = V.bay; if (B && inView(B.sign[0], B.sign[1], 120)) text('FEUERWEHR', B.sign[0], B.sign[1] - 30, 6, '#ff6b5a', 'center');
}

// the lava tube: from outside its roof (the cone) hides it, the mouths glow; inside it is dark, only the lava rill, the cat's eyes and the headlights light it
function drawTube(T, V, P) {
  const tb = V.tube; if (!tb || !inView(tb.x + tb.W / 2, tb.y + tb.H / 2, Math.max(tb.W, tb.H) / 2 + 40)) return;
  const pj = P ? (P.y | 0) * T.W + (P.x | 0) : -1, inside = P && P.vTk !== undefined && P.fall <= 0 && tb.mask[((P.y | 0) - tb.y) * tb.W + (P.x | 0) - tb.x] && pj >= 0;
  if (!inside) {
    ctx.drawImage(tb.roof, tb.x, tb.y);
    // (the glow of the rill flickers in the mouths)
    for (const p of tb.portals) for (let q = 0; q < 6; q++) if (hash(q, Math.floor(G.time * 8), p.x | 0) < .6) R1(Math.round(p.x + (hash(q, 1, p.y | 0) - .5) * 26), Math.round(p.y + (hash(q, 2, p.y | 0) - .5) * 14), 2, 1, q % 2 ? '#ff9a3a' : '#ffd04a');
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
  init: initVolcano, update: volcanoUpdate, events: { ausbruch: T => { T.ev.vlErOn = true; }, glutwolke: T => { T.ev.vlGlutOn = true; } },
  surf: volcanoSurf, progress: volcanoProgress, target: c => tubeTarget(c) || bayTarget(c), lane: volcanoLane, throttle: volcanoThrottle, ground: volcanoGround,
  // (back on the road after the lava: a puff of smoke, not a splash of water)
  respawn(c) { for (let i = 0; i < 10; i++) addP({ t: 'smoke', x: c.x + (Math.random() - .5) * 16, y: c.y + (Math.random() - .5) * 12, vx: (Math.random() - .5) * 16, vy: -10, life: .8, ml: .8 }); },
  drawGround: drawVolcanoGround, drawAbove: drawVolcanoAbove, drawSky: drawVolcanoSky,
};
