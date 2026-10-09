import { G } from './g.js';
import { SFX } from './audio.js';
import { HALF, LAPS, TAU, VH, VW, WH, WW, clamp, ctx, hash, mk } from './core.js';
import { R1, disc, ell, text } from './draw.js';
import { addP } from './particles.js';
import { cam } from './state.js';
import { nearestIdx } from './bau.js';
import { near } from './trackfx.js';

// ---------- Dschungel while racing ----------
// Always: under the canopy you only see round your own car; the liana swings over the gorge (3 s each way) and throws you across when it hangs
// on your side as you get there, otherwise there is the log bridge; the temple is dark inside (torches, a waterfall in the hall).
// Event "baeume": four rotten trees fall across the road one after the other (creaking, leaves, their shadow first); a fallen trunk stays and is a
// little ramp (fast: you hop over it, slow: it shakes you and brakes hard). From lap 2 a stone ball rolls through the temple behind whoever comes in.
// Event "kroko": crocodiles in the ford and the swamp look like logs until they snap; one swims across the ford.

const LIANA = { per: 6, x: 562, y: 22 }, TREE = { creak: 2.2, fall: .6 }, BALL = { every: 15, speed: 60 }, CROC = { per: 5, snap: .7 };

export function initJungle(T) {
  const ev = T.ev, J = T.jungle;
  J.jumps.length = J.baseJumps; // the trunks of the last race are gone
  ev.trees = []; ev.crocs = []; ev.swimmer = null; ev.ball = null; ev.ballOn = false; ev.logs = []; ev.obst = []; ev.snaps = []; ev.plops = []; ev.parrots = 0;
  J.jumps[0].off = true;
}

// where the end of the liana is (it swings over the gorge from the west bank to the east bank and back)
const lianaAng = t => Math.sin(t / LIANA.per * TAU);

export function jungleUpdate(T, dt) {
  const ev = T.ev, J = T.jungle, P = G.player, t = ev.t;
  // the liana: on the west bank (your side when you come) it catches the cars that get to the edge in its lane
  J.lianaA = lianaAng(t); J.jumps[0].off = J.lianaA > -.55;
  // where the player is: under the canopy, in the temple
  const C = J.canopy, tp = J.temple, N = T.N;
  J.under = !!(P && P.x > C.x && P.x < C.x + C.W && P.y > C.y && P.y < C.y + C.H);
  const inT = i => tp.i0 <= tp.i1 ? i >= tp.i0 && i <= tp.i1 : i >= tp.i0 || i <= tp.i1;
  J.inTemple = !!(P && inT(P.idx) && P.off < HALF + 8);
  if (ev.treesOn) updateTrees(T, dt);
  if (ev.crocsOn) updateCrocs(T, dt);
  // the stone ball (from lap 2): ready at the door of the temple, it rolls behind the first car that comes in
  if (ev.ballOn && P && P.lap >= 2) {
    const b = ev.ball || (ev.ball = { s: -1, ready: 0, x: 0, y: 0, rot: 0 });
    b.ready -= dt;
    if (b.s < 0 && b.ready <= 0) {
      const car = G.cars.find(c => c.fall <= 0 && ((c.idx - tp.i0 + N) % N) < 8 && c.off < HALF);
      if (car) { b.s = tp.i0; b.ready = BALL.every; if (near(car.x, car.y) < 360) SFX.click(); }
    }
    if (b.s >= 0) {
      b.s += BALL.speed * dt; const i = Math.floor(b.s) % N, p = T.path[i]; b.x = p.x; b.y = p.y; b.rot += dt * 8;
      if (Math.random() < dt * 4 && near(b.x, b.y) < 300) SFX.roll();
      if (!inT(i) && ((i - tp.i1 + N) % N) < 20) { b.s = -1; if (near(b.x, b.y) < 320) SFX.splash(.6); }
    }
  }
  // parrots fly up when a car comes close to the edge of the jungle
  if (P && Math.random() < dt * .25 && P.off > 10 && Math.hypot(P.vx, P.vy) > 60) {
    for (let k = 0; k < 3; k++) addP({ t: 'parrot', x: P.x + (Math.random() - .5) * 60, y: P.y - 20, vx: (Math.random() - .5) * 80, vy: -40 - Math.random() * 30, life: 2.4, ml: 2.4, ph: Math.random() * 10, col: ['#e8452c', '#2f6fd8', '#f2c230', '#3aa845'][(Math.random() * 4) | 0] });
    SFX.parrot();
  }
  ev.snaps = ev.snaps.filter(s => (s.t -= dt) > 0); ev.plops = ev.plops.filter(s => (s.t -= dt) > 0);
  ev.obst = ev.swimmer && ev.swimmer.on ? [ev.swimmer] : [];
}

// the ground under a car: fallen trunks shake slow cars and brake them hard (fast ones hop over, see the jumps); the swamp makes it green
export function jungleGround(c, sp, dt) {
  const ev = G.T.ev;
  for (const L of ev.logs) {
    const a = (c.x - L.x) * L.nx + (c.y - L.y) * L.ny, along = (c.x - L.x) * L.tx + (c.y - L.y) * L.ty, side = Math.sign(a), k = 'log' + L.k;
    if (Math.abs(along) < HALF + 4 && Math.abs(a) < 8 && c[k] !== undefined && c[k] !== side && c.z <= 0) { c.vx *= .35; c.vy *= .35; c.bump = 1; if (!c.ai) SFX.bump(); }
    c[k] = Math.abs(a) < 30 ? side : undefined;
  }
  if (c.surf === 2 && sp > 20 && Math.random() < dt * 4 && !c.ai) SFX.blubb();
}

// flattened by the stone ball: a moment flat on the ground, then it pops back ("PLOPP")
export function jungleStuck(c, dt) {
  c.vx = c.vy = 0; c.flatT -= dt;
  if (c.flatT <= 0) { c.flatT = 0; G.T.ev.plops.push({ x: c.x, y: c.y, t: .9 }); if (!c.ai || near(c.x, c.y) < 250) SFX.plopp(); }
}

// ======================================================= the computer cars

// the dry detour under the canopy: cars that are bad in mud (and not too brave) take it
export function jungleTarget(c) {
  const T = G.T, J = T.jungle, P = J.detour, N = T.N; if (!P || c.finished || G.state !== 'race') return null;
  if (!c.detour) {
    const ahead = (J.detourI - c.idx + N) % N; if (ahead < 3 || ahead > 24) return null;
    if (c.def.mud >= 1.15 || (c.seed * 4.7) % 1 < .35) return null;
    c.detour = true; c.dK = 0;
  }
  let k = c.dK, bd = 1e9;
  for (let q = c.dK; q < Math.min(P.length, c.dK + 30); q++) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  c.dK = k;
  if (k >= P.length - 5 || bd > 60 * 60) { c.detour = false; return null; }
  const t = P[Math.min(P.length - 1, k + 10)];
  return [t.x, t.y];
}

export function jungleLane(c, i, lane) {
  const T = G.T, J = T.jungle, N = T.N, p = T.path[i], n = T.nrm[i], g = J.gorge;
  // the gorge: the liana lane if it will hang on our side when we get there, otherwise the log bridge (it is narrow: aim at its middle)
  const ahead = (J.gorgeI - c.idx + N) % N, past = (c.idx - J.gorgeI + N) % N;
  if (ahead < 70 || past < 12) {
    if (ahead >= 40 && ahead < 70) { const sp = Math.max(60, Math.hypot(c.vx, c.vy)), arr = ahead * 2 / sp; c.liana = lianaAng(T.ev.t + arr) < -.7; }
    const y = c.liana && past >= 12 ? (g.lane[0] + g.lane[1]) / 2 : g.log;
    return clamp((y - p.y) / (n.y || 1), -40, 40);
  }
  // the ford: keep upstream, the current pushes towards the deep water
  const fa = (J.fordI - c.idx + N) % N, fp = (c.idx - J.fordI + N) % N;
  if (fa < 40 || fp < 16) return 16;
  // the swamp: cars that are bad in mud keep to the boardwalk
  const [b0, b1] = J.boardI, onB = b0 <= b1 ? i >= b0 && i <= b1 : i >= b0 || i <= b1;
  if (onB && c.def.mud < 1.15) return T.def.boardwalk[2];
  // deep swamp: never towards its middle
  const bad = l => { const x = (p.x + n.x * l) | 0, y = (p.y + n.y * l) | 0; return x >= 0 && y >= 0 && x < WW && y < WH && T.ter[y * WW + x] === 10; };
  if (bad(lane)) for (const l of [lane + 14, lane - 14, lane + 24, lane - 24]) if (Math.abs(l) < 28 && !bad(l)) return l;
  return lane;
}

// ======================================================= event "baeume": falling trees and the stone ball

export function initTrees(T) {
  const ev = T.ev; ev.treesOn = true; ev.ballOn = true;
  ev.trees = T.jungle.trees.map(tr => ({ ...tr, state: 0, p: 0, shown: false }));
}

function updateTrees(T, dt) {
  const ev = T.ev, J = T.jungle;
  for (const tr of ev.trees) {
    if (tr.state === 2) continue;
    const u = ev.t - tr.t0;
    tr.creak = u > -TREE.creak && u < 0; tr.state = u >= 0 ? 1 : 0; tr.p = clamp(u / TREE.fall, 0, 1);
    if (tr.creak && !tr.cr) { tr.cr = true; if (near(tr.bx, tr.by) < 360) SFX.creakTree(); }
    if (tr.creak && Math.random() < dt * 12) addP({ t: 'leaf', x: tr.bx + (Math.random() - .5) * 30, y: tr.by - 20, vx: 10, vy: 20 + Math.random() * 10, life: 2, ml: 2, ph: Math.random() * 10, col: ['#3a8a38', '#5aa83e', '#8a6a2a'][(Math.random() * 3) | 0] });
    if (tr.p >= 1) {
      // it lies across the road now: a hit while it falls throws the car away; from now on it is a little ramp
      tr.state = 2;
      const mx = tr.bx + tr.nx * (HALF + 14), my = tr.by + tr.ny * (HALF + 14);
      for (const c of G.cars) {
        if (c.fall > 0 || c.z > 0) continue;
        const a = (c.x - mx) * tr.tx + (c.y - my) * tr.ty, b = (c.x - mx) * tr.nx + (c.y - my) * tr.ny;
        if (Math.abs(a) < 12 && Math.abs(b) < HALF + 16) { c.vx = tr.tx * Math.sign(a || 1) * 150; c.vy = tr.ty * Math.sign(a || 1) * 150; c.spin = 12; c.stun = 1; c.boost = 0; if (!c.ai) SFX.crash(); }
      }
      ev.logs.push({ k: tr.k, x: mx, y: my, tx: tr.tx, ty: tr.ty, nx: tr.nx, ny: tr.ny, r: 6 });
      J.jumps.push({ x: mx - tr.tx * 6, y: my - tr.ty * 6, tx: tr.tx, ty: tr.ty, lo: -HALF - 6, hi: HALF + 6, vz: 70, log: true });
      if (near(mx, my) < 400) { SFX.thud(); G.jumpShake = Math.max(G.jumpShake, .4); }
      for (let q = 0; q < 26; q++) addP({ t: 'dust', x: mx + tr.nx * (Math.random() - .5) * 60, y: my + tr.ny * (Math.random() - .5) * 60, vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 40, life: .9, ml: .9 });
    }
  }
}

// ======================================================= event "kroko"

export function initCrocs(T) {
  const ev = T.ev; ev.crocsOn = true;
  ev.crocs = T.jungle.crocs.map(([x, y], k) => ({ x, y, k, open: 0, face: k % 2 ? 1 : -1 }));
  const F = T.jungle.ford.rect; ev.swimmer = { x: (F[0] + F[2]) / 2, y: F[1], on: false, r: 8 };
}

function updateCrocs(T, dt) {
  const ev = T.ev;
  for (const cr of ev.crocs) {
    const u = ((ev.t + cr.k * 1.7) % CROC.per + CROC.per) % CROC.per, was = cr.open;
    cr.open = u > CROC.per - CROC.snap ? 1 : 0; cr.up = u > CROC.per - CROC.snap - .8;
    if (cr.open && !was) {
      if (near(cr.x, cr.y) < 300) SFX.snap();
      for (const c of G.cars) {
        if (c.fall > 0 || c.z > 0 || Math.hypot(c.x - cr.x, c.y - cr.y) > 26) continue;
        const dx = c.x - cr.x, dy = c.y - cr.y, d = Math.hypot(dx, dy) || 1; c.vx = dx / d * 90; c.vy = dy / d * 90; c.boost = 0;
        ev.snaps.push({ x: cr.x, y: cr.y, t: 1 });
      }
    }
  }
  // one crocodile swims across the ford every 9 s
  const F = T.jungle.ford.rect, s = ev.swimmer, u = (ev.t % 9) / 4;
  s.on = u < 1; s.x = (F[0] + F[2]) / 2 + Math.sin(ev.t) * 4; s.y = F[1] - 6 + u * (F[3] - F[1] + 12);
}

// cars and the stone ball (it flattens slower cars), cars and the swimming crocodile (it pushes them away)
export function jungleCollisions() {
  const ev = G.T.ev; if (!ev) return;
  const b = ev.ball;
  if (b && b.s >= 0) for (const c of G.cars) {
    if (c.fall > 0 || c.flatT > 0 || c.ghost > 0 || Math.hypot(c.x - b.x, c.y - b.y) > 16) continue;
    c.flatT = .9; c.stun = 0; c.boost = 0; c.vx = c.vy = 0; if (!c.ai) SFX.crash();
  }
  const s = ev.swimmer;
  if (s && s.on) for (const c of G.cars) {
    if (c.fall > 0 || c.z > 0) continue;
    const dx = c.x - s.x, dy = c.y - s.y, d = Math.hypot(dx, dy), mn = s.r + 9; if (d >= mn || !d) continue;
    const nx = dx / d, ny = dy / d, vn = c.vx * nx + c.vy * ny; c.x = s.x + nx * mn; c.y = s.y + ny * mn;
    if (vn < 0) { c.vx -= 1.5 * vn * nx; c.vy -= 1.5 * vn * ny; }
  }
}

// ======================================================= drawing

const inView = (x, y, m = 40) => x > cam.x - m && x < cam.x + VW + m && y > cam.y - m && y < cam.y + VH + m;

function drawCroc(x, y, f, open, up) {
  x = Math.round(x); y = Math.round(y);
  if (!up) { R1(x - 8, y - 2, 16, 4, '#2a3a1e'); R1(x + f * 5 - 1, y - 2, 2, 1, '#e8e070'); R1(x + f * 7 - 1, y - 2, 2, 1, '#e8e070'); return; } // only the back and the eyes
  R1(x - 12, y - 4, 24, 8, '#1b120c'); R1(x - 11, y - 3, 22, 6, '#3a6a2a'); for (let k = -9; k < 8; k += 3) R1(x + k, y - 3, 1, 1, '#2a4a1e');
  R1(x - f * 15 - (f > 0 ? 0 : 4), y - 1, 5, 2, '#3a6a2a'); // tail
  const hx = x + f * 12;
  if (open) { R1(hx - (f > 0 ? 0 : 8), y - 6, 9, 3, '#3a6a2a'); R1(hx - (f > 0 ? 0 : 8), y + 3, 9, 3, '#3a6a2a'); R1(hx - (f > 0 ? 0 : 8), y - 3, 9, 6, '#c83a3a'); for (let k = 0; k < 8; k += 2) { R1(hx + f * k, y - 3, 1, 1, '#ffffff'); R1(hx + f * k, y + 2, 1, 1, '#ffffff'); } }
  else R1(hx - (f > 0 ? 0 : 7), y - 2, 8, 4, '#3a6a2a');
  R1(x + f * 9, y - 4, 2, 1, '#e8e070');
}

// on the ground: the swamp bubbles, crocodiles, fallen trunks, standing rotten trees (their shadow first), the camp fire, the water in the temple hall
export function drawJungleGround() {
  const T = G.T, J = T.jungle, ev = T.ev, k = Math.floor(G.time * 3);
  for (let q = 0; q < 8 && J.swampPix.length; q++) { const p = J.swampPix[(hash(q, k, 114) * J.swampPix.length) | 0]; R1(p % WW, (p / WW) | 0, 2, 2, '#8aa83a'); }
  for (const [qx, qy, qr] of J.quick) if (inView(qx, qy)) { const ph = (G.time * 1.3 + qx) % 1; ctx.globalAlpha = 1 - ph; disc(Math.round(qx + Math.sin(qx + Math.floor(G.time * 1.3)) * qr * .5), Math.round(qy), Math.round(1 + ph * 3), '#6a8a3a'); ctx.globalAlpha = 1; }
  // the ford: lines of the current running downstream
  const F = J.ford.rect;
  if (inView(F[0], F[1], 80)) { ctx.fillStyle = 'rgba(220,250,255,.55)'; for (let q = 0; q < 14; q++) { const x = F[0] + hash(q, 1, 115) * (F[2] - F[0]), y = F[1] + ((G.time * 40 + hash(q, 2, 115) * (F[3] - F[1])) % (F[3] - F[1])); ctx.fillRect(Math.round(x), Math.round(y), 1, 4); } }
  if (ev) {
    for (const cr of ev.crocs || []) if (inView(cr.x, cr.y)) drawCroc(cr.x, cr.y, cr.face, cr.open, cr.up);
    if (ev.swimmer && ev.swimmer.on && inView(ev.swimmer.x, ev.swimmer.y)) { ctx.save(); ctx.translate(Math.round(ev.swimmer.x), Math.round(ev.swimmer.y)); ctx.rotate(Math.PI / 2); drawCroc(0, 0, 1, 0, true); ctx.restore(); }
    for (const L of ev.logs) if (inView(L.x, L.y, 60)) {
      // a fallen trunk across the road
      ctx.save(); ctx.translate(Math.round(L.x), Math.round(L.y)); ctx.rotate(Math.atan2(L.ny, L.nx));
      ctx.globalAlpha = .3; R1(-HALF - 12, 3, 2 * HALF + 26, 4, '#000'); ctx.globalAlpha = 1;
      R1(-HALF - 14, -5, 2 * HALF + 28, 10, '#3e2a16'); R1(-HALF - 13, -4, 2 * HALF + 26, 8, '#7a5430'); R1(-HALF - 13, -4, 2 * HALF + 26, 2, '#9a7040');
      for (let q = -HALF; q < HALF; q += 7) R1(q, -3, 1, 6, '#5a3e22');
      R1(HALF + 10, -5, 4, 10, '#c9a066'); R1(HALF + 11, -2, 2, 4, '#9a7040');
      ctx.restore();
    }
    for (const tr of ev.trees || []) {
      if (tr.state === 2 || !inView(tr.bx, tr.by, 80)) continue;
      // the shadow of the falling tree moves over the road
      const reach = (HALF + 14) * 2 * (tr.creak ? .3 + .2 * Math.sin(G.time * 4) : tr.p);
      ctx.globalAlpha = .28; for (let s = 0; s < reach; s += 2) ell(Math.round(tr.bx + tr.nx * s + 4), Math.round(tr.by + tr.ny * s + 4), 3, 3, '#000'); ctx.globalAlpha = 1;
    }
  }
  // the camp fire
  const C = J.camp;
  if (C && inView(C.fire.x, C.fire.y)) { const f = ((G.time * 10) | 0) % 2; R1(C.fire.x - 2, C.fire.y - 3 - f, 5, 4, '#ff7a1a'); R1(C.fire.x - 1, C.fire.y - 4 - f, 3, 3, '#ffd04a'); if (Math.random() < .2) addP({ t: 'smoke', x: C.fire.x, y: C.fire.y - 6, vx: 4, vy: -14, life: 1.4, ml: 1.4 }); }
}

// above the cars: the liana, standing and falling trees, the stone ball, the temple roof (dark inside), the canopy (see-through round your car), texts
let dark = null, leaves = null;
export function drawJungleAbove() {
  const T = G.T, J = T.jungle, ev = T.ev, P = G.player;
  // the liana: a thick vine from a branch over the gorge; a car that swings on it hangs at its end
  const ax = LIANA.x, ay = LIANA.y, flying = G.cars.find(c => c.z > 0 && c.lianaRide);
  for (const c of G.cars) if (c.z > 0 && c.x > ax - 60 && c.x < ax + 60 && c.y < 100 && c.air < .9) c.lianaRide = true; else if (c.z <= 0) c.lianaRide = false;
  if (inView(ax, ay, 80)) {
    const ex = flying ? flying.x : ax + J.lianaA * 34, ey = flying ? flying.y - flying.z * .6 : 60;
    ctx.fillStyle = '#3a6a1e'; for (let s = 0; s <= 1; s += .02) { const x = ax + (ex - ax) * s + Math.sin(s * Math.PI) * 4, y = ay + (ey - ay) * s; ctx.fillRect(Math.round(x), Math.round(y), 2, 2); if ((s * 50 | 0) % 7 === 0) R1(Math.round(x) + 2, Math.round(y), 3, 2, '#5aa83e'); }
    R1(ax - 18, ay - 4, 36, 6, '#4e3418'); R1(ax - 18, ay - 4, 36, 2, '#7a5430');
  }
  // standing rotten trees (they shake when they creak) and falling ones
  if (ev) for (const tr of ev.trees || []) {
    if (tr.state === 2 || !inView(tr.bx, tr.by, 80)) continue;
    const ang = tr.p * Math.PI / 2, sh = tr.creak ? Math.sin(G.time * 30) * 1.5 : 0, L = (HALF + 14) * 2;
    const ex = tr.bx + tr.nx * L * Math.sin(ang), ey = tr.by + tr.ny * L * Math.sin(ang) - (1 - Math.sin(ang)) * 28;
    ctx.strokeStyle = '#3e2a16'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(tr.bx, tr.by); ctx.lineTo(ex + sh, ey); ctx.stroke();
    ctx.strokeStyle = '#7a5430'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(tr.bx, tr.by); ctx.lineTo(ex + sh, ey); ctx.stroke(); ctx.lineWidth = 1;
    disc(Math.round(ex + sh), Math.round(ey), 12, '#0e2e12'); disc(Math.round(ex + sh), Math.round(ey), 11, '#4a6a2a'); disc(Math.round(ex + sh - 3), Math.round(ey - 3), 6, '#6a8a3a');
  }
  // the stone ball
  const b = ev && ev.ball;
  if (b && b.s >= 0 && inView(b.x, b.y)) { ctx.globalAlpha = .3; ell(Math.round(b.x + 4), Math.round(b.y + 6), 14, 6, '#000'); ctx.globalAlpha = 1; disc(Math.round(b.x), Math.round(b.y), 14, '#3a3e34'); disc(Math.round(b.x), Math.round(b.y), 13, '#8a9080'); disc(Math.round(b.x - 4), Math.round(b.y - 4), 5, '#a8ae9c'); for (let q = 0; q < 3; q++) R1(Math.round(b.x + Math.cos(b.rot + q * 2) * 8), Math.round(b.y + Math.sin(b.rot + q * 2) * 8), 3, 1, '#5a6052'); }
  // the temple: opaque from outside; inside see-through and dark (torches, light falls through the hole in the hall)
  const tp = J.temple;
  if (tp) {
    if (J.inTemple) {
      const g = (dark && dark.width === tp.W && dark.height === tp.H ? dark : (dark = mk(tp.W, tp.H))).getContext('2d');
      g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, tp.W, tp.H); g.drawImage(tp.c, 0, 0);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(8,12,6,.76)'; g.fillRect(0, 0, tp.W, tp.H);
      g.globalCompositeOperation = 'destination-out';
      for (const t2 of tp.torches) { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(t2.x - tp.x, t2.y - tp.y, 16, 0, TAU); g.fill(); }
      for (const c of G.cars) { if (c.fall > 0) continue; const x = c.x - tp.x, y = c.y - tp.y, fx = Math.cos(c.ang), fy = Math.sin(c.ang), nx = -fy, ny = fx; g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(x, y, 14, 0, TAU); g.fill(); for (let q = 0; q < 3; q++) { const len = 70 - q * 16, half = 26 - q * 6; g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.moveTo(x + fx * 8 + nx * 4, y + fy * 8 + ny * 4); g.lineTo(x + fx * len + nx * half, y + fy * len + ny * half); g.lineTo(x + fx * len - nx * half, y + fy * len - ny * half); g.lineTo(x + fx * 8 - nx * 4, y + fy * 8 - ny * 4); g.closePath(); g.fill(); } }
      g.globalCompositeOperation = 'source-over';
      ctx.drawImage(dark, tp.x, tp.y);
      for (const t2 of tp.torches) { const x = Math.round(t2.x), y = Math.round(t2.y), f = ((G.time * 10 + t2.k) | 0) % 2; R1(x - 1, y, 2, 4, '#5a3a1c'); R1(x - 1, y - 3 - f, 3, 3, '#ffb22e'); R1(x, y - 2 - f, 1, 2, '#fff1a8'); }
      // the treasure chest and the waterfall in the hall
      const [hx, hy, hr] = tp.hall;
      for (let q = 0; q < 12; q++) R1(Math.round(hx - hr + hash(q, 1, 116) * hr * 2), Math.round(hy - hr + ((G.time * 70 + q * 9) % (hr * 2))), 1, 3, q % 2 ? '#ffffff' : '#9edcf0');
      R1(hx + HALF - 12, hy - 4, 9, 7, '#1b120c'); R1(hx + HALF - 11, hy - 3, 7, 5, '#a8743c'); R1(hx + HALF - 11, hy - 3, 7, 1, '#ffd23f'); R1(hx + HALF - 8, hy - 1, 1, 1, '#ffd23f');
    } else ctx.drawImage(tp.c, tp.x, tp.y);
  }
  // the canopy: leaves over everything, a hole round your own car when you drive under it
  const C = J.canopy;
  if (inView(C.x + C.W / 2, C.y + C.H / 2, C.W)) {
    if (J.under && P) {
      const g = (leaves && leaves.width === C.W ? leaves : (leaves = mk(C.W, C.H))).getContext('2d');
      g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, C.W, C.H); g.drawImage(C.c, 0, 0);
      g.globalCompositeOperation = 'destination-out';
      for (const [r, a] of [[64, .35], [56, .5], [48, 1]]) { g.fillStyle = 'rgba(0,0,0,' + a + ')'; g.beginPath(); g.arc(P.x - C.x, P.y - C.y, r, 0, TAU); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      ctx.drawImage(leaves, C.x, C.y);
    } else ctx.drawImage(C.c, C.x, C.y);
    // the leaves move a little: bright flecks of sun wander over them
    for (let q = 0; q < 20; q++) { const x = C.x + hash(q, 1, 117) * C.W + Math.sin(G.time + q) * 3, y = C.y + hash(q, 2, 117) * C.H; if (!J.under || !P || Math.hypot(x - P.x, y - P.y) > 64) R1(Math.round(x), Math.round(y), 2, 1, '#9ad86a'); }
  }
  if (ev) {
    for (const s of ev.snaps) text('SCHNAPP!', Math.round(s.x), Math.round(s.y - 16 - (1 - s.t) * 8), 8, '#ffffff', 'center');
    for (const s of ev.plops) text('PLOPP!', Math.round(s.x), Math.round(s.y - 20 - (.9 - s.t) * 10), 8, '#ffd23f', 'center');
  }
  for (const p of G.parts) if (p.t === 'parrot') { const w = ((G.time * 12 + p.ph) | 0) % 2; R1(Math.round(p.x) - 1, Math.round(p.y), 3, 3, p.col); R1(Math.round(p.x) - 3, Math.round(p.y) - w, 2, 1, p.col); R1(Math.round(p.x) + 2, Math.round(p.y) - w, 2, 1, p.col); }
}

// on the screen: sun beams through the leaves (the vignette of the forest comes with the theme)
export function drawJungleSky() {
  const J = G.T.jungle;
  if (J.inTemple) { ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, 0, VW, VH); }
}
