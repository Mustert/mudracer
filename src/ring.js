import { G } from './g.js';
import { SFX } from './audio.js';
import { HALF, TAU, VH, VW, WH, WW, angDiff, clamp, ctx, hash } from './core.js';
import { R1, disc, text } from './draw.js';
import { eventOn, snap } from './events.js';
import { held } from './input.js';
import { WATC, addP, drop } from './particles.js';
import { placeOf } from './physics.js';
import { cam } from './state.js';
import { nearestIdx } from './bau.js';
import { tctx } from './tracks.js';

// ---------- Rennstrecke while racing: the bridge (two levels), slipstream, start lights with a rocket start, kerbs, gravel, the pit stop,
// and the event "reifen": tyres roll across the road, loose tyres from the tyre walls, the oil gets smeared from lap 2 on ----------

const gas = () =>G.CTRL === 'alt' ? ['left', 'right', 'up', 'down'].some(held) : held('up');
const near = (x, y) => Math.hypot(x - cam.x - VW / 2, y - cam.y - VH / 2);

// level at the crossing: 1 = up on the bridge, 2 = on the road below it, 0 = somewhere else. It follows the car's place on the lap.
function level(c, R) {
  if (!R.cross) return 0;
  const N = G.T.N, cd = i => { const d = Math.abs(c.idx - i) % N; return Math.min(d, N - d); };
  return cd(R.cross.i1) < 42 ? 1 : cd(R.cross.i2) < 42 ? 2 : 0;
}

export function ringUpdate(dt) {
  const R = G.T.ring; if (!R) return;
  for (const c of G.cars) {
    c.lvl = level(c, R);
    c.rocket = Math.max(0, c.rocket - dt);
    c.msgT = Math.max(0, (c.msgT || 0) - dt);
    // slipstream: right behind another car on asphalt, going the same way, the car gets faster (up to 7 %)
    let tgt = 0;
    const sp = Math.hypot(c.vx, c.vy);
    if ((c.surf === 1 || c.surf === 9) && !c.pit && sp > 70 && c.z <= 0) {
      const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
      for (const o of G.cars) {
        if (o === c || o.fall > 0 || (c.lvl && o.lvl && c.lvl !== o.lvl)) continue;
        const dx = o.x - c.x, dy = o.y - c.y, f = dx * fx + dy * fy, l = -dx * fy + dy * fx;
        if (f > 16 && f < 50 && Math.abs(l) < 11 && Math.abs(angDiff(o.ang, c.ang)) < .4) { tgt = 1; break; }
      }
    }
    c.draft += (tgt - c.draft) * Math.min(1, dt * (tgt ? 2.2 : 3));
  }
  // rocket start: gas within a quarter of a second after the lights go out (and not held before) gives a short push
  const P = G.player;
  if (P && G.state === 'race' && G.stateTime < .3 && !P.early && !P.launched && gas()) {
    P.launched = true; P.rocket = .8; P.msg = 'RAKETENSTART!'; P.msgT = 1.4; SFX.boost(1);
  }
  if (P && P.early && G.state === 'race' && G.stateTime < .7 && Math.random() < dt * 40) smoke(P);
}

function smoke(c) {
  for (const s of [-8, 8]) addP({ t: 'smoke', x: c.x - Math.cos(c.ang) * 12 - Math.sin(c.ang) * s, y: c.y - Math.sin(c.ang) * 12 + Math.cos(c.ang) * s, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, life: .9, ml: .9 });
}

// the countdown with the start lights: a lamp every half second, all five out = go. Holding gas at the end is too early.
export function ringCountdown() {
  const n = Math.min(5, Math.floor(G.stateTime / .5));
  if (n !== G.lastCount && n >= 1) { G.lastCount = n; SFX.light(); }
  if (G.stateTime > 2.6 && gas() && G.player) G.player.early = true;
}

// the lights go out: some of the computer cars get away well too (more often on the harder levels)
export function ringGo() {
  const p = [.15, .35, .6][G.raceDiff || 0];
  for (const c of G.cars) if (c.ai && Math.random() < p) c.rocket = .8;
}

// ground under a car (from update.js): kerbs rattle, gravel throws up dust and stones, the pit lane has a speed limit, the box washes
export function ringGround(c, j, sp, dt) {
  const R = G.T.ring; if (!R) return;
  c.kerb = !!R.kerb[j]; c.oilT = Math.max(0, c.oilT - dt);
  const pit = !!R.pitMask[j];
  if (pit && !c.pit && !c.ai) { c.msg = 'BOX BOX!'; c.msgT = 1.6; SFX.radio(); }
  c.pit = pit;
  if (c.washing && !c.boxed && pit) { c.dirt = 0; if (near(c.x, c.y) < 300) SFX.wrench(c.ai ? .35 : 1); }
  c.boxed = c.washing && pit;
  if (c.surf === 7 && sp > 20) {
    if (Math.random() < dt * 30) addP({ t: 'dust', x: c.x - Math.cos(c.ang) * 12 + (Math.random() - .5) * 14, y: c.y - Math.sin(c.ang) * 12 + (Math.random() - .5) * 14, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, life: .8, ml: .8 });
    if (Math.random() < dt * 25) drop(c.x - Math.cos(c.ang) * 12, c.y - Math.sin(c.ang) * 12, c.ang + Math.PI + (Math.random() - .5) * 1.6, 20 + Math.random() * 50, 40 + Math.random() * 50, ['#bdae86', '#978b6a', '#dccfab'][(Math.random() * 3) | 0], 1, false);
  }
}

// computer cars that are dirty turn into the pit lane (and follow it to the end)
export function ringPitTarget(c) {
  const R = G.T.ring; if (!R || !R.pit) return null;
  const P = R.pit.pts, N = G.T.N;
  if (!c.pitting) {
    if (c.finished || c.dirt < .5 || G.state !== 'race') return null;
    const ahead = (R.pit.ie - c.idx + N) % N;
    if (ahead < 8 || ahead > 50) return null;
    c.pitting = true; c.pitK = 0;
  }
  let k = c.pitK, bd = 1e9;
  for (let q = c.pitK; q < Math.min(P.length, c.pitK + 30); q++) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  c.pitK = k;
  if (k >= P.length - 4 || bd > 70 * 70) { c.pitting = false; return null; }
  const t = P[Math.min(P.length - 1, k + 12)];
  return [t.x, t.y];
}

// the ghost of the time trial has no place on the lap: up on the bridge is the one that drives the way of the bridge
export function ghostUp(gh) {
  const R = G.T.ring, D = R && R.deck; if (!D || Math.hypot(gh.x - R.cross.x, gh.y - R.cross.y) > 80) return false;
  return Math.abs(Math.cos(angDiff(gh.ang, D.ang1))) > Math.abs(Math.cos(angDiff(gh.ang, D.ang2)));
}

// ======================================================= event "reifen": tyres

// a tyre rolls across the road from outside, the marshal next to it waves the yellow flag 2 s before
export function initReifen(T) {
  const ev = T.ev;
  ev.tyres = [];
  ev.rollers = (T.def.rollers || []).map(([x, y, per, t0], k) => {
    const i = nearestIdx(T.path, x, y), p = T.path[i], n = T.nrm[i], tg = T.tan[i];
    // from the side that lies further out
    const s = Math.hypot(p.x + n.x * 40 - WW / 2, p.y + n.y * 40 - WH / 2) > Math.hypot(p.x - n.x * 40 - WW / 2, p.y - n.y * 40 - WH / 2) ? 1 : -1;
    const o = HALF + 14;
    return { k, per, t0, sx: p.x + n.x * s * o, sy: p.y + n.y * s * o, ex: p.x - n.x * s * o, ey: p.y - n.y * s * o,
      mx: p.x + n.x * s * (HALF + 27) - tg.x * 22, my: p.y + n.y * s * (HALF + 27) - tg.y * 22, flag: false, cyc: -1 };
  });
  snap(T, 0, 0, WW, WH); // the smeared oil changes the ground; this puts it back after the race
}

function addTyre(ev, t) {
  ev.tyres.push(Object.assign({ z: 0, rot: 0, hitT: 0, ownT: 0, owner: null, idle: 0, roll: true }, t));
  if (ev.tyres.length > 14) { const q = ev.tyres.findIndex(o => !o.roll); ev.tyres.splice(q < 0 ? 0 : q, 1); }
}

export function updateReifen(T, dt) {
  const ev = T.ev;
  for (const r of ev.rollers) {
    const tn = ev.t - r.t0, ph = ((tn % r.per) + r.per) % r.per;
    r.flag = (tn > -2.2 && ph > r.per - 2.2) || (tn >= 0 && ph < 1.3);
    const cyc = tn >= 0 ? Math.floor(tn / r.per) : -1;
    if (cyc > r.cyc) {
      r.cyc = cyc;
      const dx = r.ex - r.sx, dy = r.ey - r.sy, l = Math.hypot(dx, dy);
      addTyre(ev, { x: r.sx, y: r.sy, vx: dx / l * 92, vy: dy / l * 92 });
      if (near(r.sx, r.sy) < 320) SFX.tyre(.5);
    }
  }
  for (let q = ev.tyres.length - 1; q >= 0; q--) {
    const ty = ev.tyres[q];
    ty.x += ty.vx * dt; ty.y += ty.vy * dt; ty.hitT -= dt; ty.ownT -= dt;
    const sp = Math.hypot(ty.vx, ty.vy), t = T.ter[clamp(ty.y | 0, 0, WH - 1) * WW + clamp(ty.x | 0, 0, WW - 1)], road = t === 1 || t === 9 || t === 8;
    // a rolling tyre keeps going on the road, grass and gravel stop it
    const f = road ? (ty.roll ? .25 : 3) : t === 7 ? 4 : 1.8;
    ty.vx *= Math.exp(-f * dt); ty.vy *= Math.exp(-f * dt);
    if (ty.roll) { ty.rot += sp * dt / 5; ty.z = Math.abs(Math.sin(ty.rot * .6)) * 2.5 * Math.min(1, sp / 60); if (sp < 14) { ty.roll = false; ty.z = 0; } }
    for (const o of T.trees) {
      if (o.up || o.down) continue;
      const dx = ty.x - o.x, dy = ty.y - o.y, d = Math.hypot(dx, dy), mn = o.r + 5;
      if (d < mn && d > 0) { const nx = dx / d, ny = dy / d, vn = ty.vx * nx + ty.vy * ny; ty.x = o.x + nx * mn; ty.y = o.y + ny * mn; if (vn < 0) { ty.vx -= 1.4 * vn * nx; ty.vy -= 1.4 * vn * ny; } }
    }
    ty.x = clamp(ty.x, 4, WW - 4); ty.y = clamp(ty.y, 4, WH - 4);
    ty.idle = !road && !ty.roll ? ty.idle + dt : 0;
    if (ty.idle > 5) ev.tyres.splice(q, 1); // tyres that lie off the road are cleared away
  }
  // from lap 2 the oil gets smeared: cars that drove through oil leave a slippery black trail for a moment
  if (G.player && G.player.lap >= 2) for (const c of G.cars) {
    if (c.oilT <= 0 || c.surf === 8 || c.z > 0 || c.fall > 0 || Math.hypot(c.vx, c.vy) < 20) continue;
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
    for (const s of [-8, 8]) {
      const wx = Math.round(c.x - fx * 11 - fy * s), wy = Math.round(c.y - fy * 11 + fx * s);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = wx + dx, y = wy + dy; if (x < 0 || y < 0 || x >= WW || y >= WH) continue;
        const j = y * WW + x; if (T.ter[j] === 1 && !T.ring.pitMask[j]) T.ter[j] = 9;
      }
      tctx.globalAlpha = .3 * c.oilT; tctx.fillStyle = '#0a0a0c'; tctx.fillRect(wx - 1, wy - 1, 3, 3); tctx.globalAlpha = 1;
    }
  }
}

// a hard hit into a tyre wall knocks one or two tyres loose, they roll onto the road
export function ringStackHit(c, o, v) {
  const ev = G.T.ev; if (!ev || !ev.rollers || !eventOn('reifen') || (o.cool || 0) > G.time) return;
  o.cool = G.time + 3;
  const dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy) || 1;
  for (let k = 0; k < (v > 110 ? 2 : 1); k++) {
    const a = Math.atan2(dy, dx) + (Math.random() - .5) * 1.2, s = 60 + v * .35;
    addTyre(ev, { x: o.x + dx / d * 6, y: o.y + dy / d * 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s, owner: c, ownT: 1.2 });
  }
  SFX.tyre(c.ai ? .4 : 1);
}

// cars and tyres: a fast rolling tyre knocks a car around (like a cow, only shorter), a slow or lying one is kicked away
export function tyreCollisions() {
  const ev = G.T.ev; if (!ev || !ev.tyres || !ev.tyres.length) return;
  for (const ty of ev.tyres) for (const c of G.cars) {
    if (c.z > 0 || c.fall > 0 || c.ghost > 0 || c.lvl === 1) continue;
    const dx = c.x - ty.x, dy = c.y - ty.y, d = Math.hypot(dx, dy), mn = 14;
    if (d >= mn || d === 0) continue;
    const nx = dx / d, ny = dy / d, tsp = Math.hypot(ty.vx, ty.vy), mine = ty.owner === c && ty.ownT > 0;
    if (ty.roll && tsp > 45 && !c.stun && ty.hitT <= 0 && !mine) {
      c.vx = nx * 95; c.vy = ny * 95; c.spin = 9; c.stun = .65; c.boost = 0; c.rocket = 0;
      ty.vx = -nx * tsp * .45; ty.vy = -ny * tsp * .45; ty.hitT = .5;
      if (!c.ai) SFX.crash(); else SFX.tyre(.4);
      continue;
    }
    c.x = ty.x + nx * mn; c.y = ty.y + ny * mn;
    const vn = c.vx * nx + c.vy * ny;
    if (vn < 0) {
      const s = 40 + -vn * 1.1;
      ty.vx = -nx * s + c.vx * .35; ty.vy = -ny * s + c.vy * .35; ty.roll = s > 30; ty.owner = c; ty.ownT = 1.5;
      c.vx *= .85; c.vy *= .85;
      if (-vn > 30) SFX.tyre(c.ai ? .3 : 1);
    }
  }
}

export function drawTyres(ev) {
  for (const ty of ev.tyres) {
    const x = Math.round(ty.x), y = Math.round(ty.y);
    if (x < cam.x - 20 || x > cam.x + VW + 20 || y < cam.y - 20 || y > cam.y + VH + 20) continue;
    ctx.globalAlpha = .3; R1(x - 4, y + 3, 9, 3, '#000'); ctx.globalAlpha = 1;
    if (ty.roll) {
      // standing on its edge, seen from above: a short dark bar along the way it rolls, the tread runs round
      const a = Math.atan2(ty.vy, ty.vx), yy = y - Math.round(ty.z);
      ctx.save(); ctx.translate(x, yy); ctx.rotate(a);
      R1(-6, -3, 12, 6, '#0c0c0e'); R1(-5, -2, 10, 4, '#26262a');
      for (let k = 0; k < 4; k++) R1(-5 + ((Math.floor(ty.rot * 3) + k * 3) % 10), -2, 1, 4, '#4a4a50');
      R1(-5, -1, 10, 1, '#f2f2ee');
      ctx.restore();
    } else {
      disc(x, y, 5, '#0c0c0e'); disc(x, y, 4, '#232327'); disc(x, y, 2, '#8a8d94'); R1(x - 1, y - 1, 2, 2, '#c9ccd2');
    }
  }
}

// marshals behind the barrier: orange overalls, the yellow flag waves before a tyre comes
export function drawMarshals(ev) {
  for (const r of ev.rollers) {
    const x = Math.round(r.mx), y = Math.round(r.my); if (near(x, y) > 320) continue;
    R1(x - 3, y - 2, 6, 7, '#1b120c'); R1(x - 2, y - 1, 4, 5, '#f07a1a'); R1(x - 2, y - 5, 4, 4, '#1b120c'); R1(x - 1, y - 4, 2, 2, '#f2c9a0');
    if (r.flag) {
      const w = ((G.time * 8) | 0) % 2, fx = x + 3, fy = y - 9 - w;
      R1(fx, fy, 1, 10, '#5a3a1c'); R1(fx + 1, fy, 7, 5, '#1b120c'); R1(fx + 1, fy + 1, 6 - w, 3, '#ffd23f');
      if (((G.time * 4) | 0) % 2) { ctx.globalAlpha = .35; disc(fx + 4, fy + 2, 6, '#ffd23f'); ctx.globalAlpha = 1; }
    }
  }
}

// ======================================================= drawing

// on the ground, below the cars: the oil shines, the pit crew waits next to the box
export function drawRingGround() {
  const R = G.T.ring; if (!R) return;
  const k = Math.floor(G.time * 4);
  for (let q = 0; q < 10 && R.oilPix.length; q++) { const p = R.oilPix[(hash(q, k, 79) * R.oilPix.length) | 0]; R1(p % WW, (p / WW) | 0, 1, 1, ['#7a5ab8', '#3fa0aa', '#b08a4a'][q % 3]); }
  // fans in the grandstands wave their flags
  for (const f of R.fans) {
    if (near(f.x, f.y) > 300) continue;
    const up = ((G.time * (3 + f.k % 3) + f.k) | 0) % 2, col = ['#e84a5f', '#ffd23f', '#4d96ff', '#ffffff', '#6bcb77'][f.k % 5];
    R1(f.x, f.y - 3 - up, 1, 4, '#5a3a1c'); R1(f.x + 1, f.y - 3 - up, 3 + up, 2, col);
  }
  // the big screen shows your place
  const S = R.screen;
  if (S && G.player && near(S.x, S.y) < 320) {
    R1(S.x, S.y, S.w, S.h, ((G.time * 2) | 0) % 2 ? '#1f3a6b' : '#20242c');
    text('P' + (G.player.finished ? G.player.place : placeOf(G.player)), S.x + S.w / 2 + 1, S.y + 7, 8, '#ffd23f', 'center', null);
  }
  if (!R.pit) return;
  const [b0, b1] = R.pit.box, busy = G.cars.find(c => c.pit && c.washing), lane = R.pit.pts.find(q => q.y > b0 && q.y < b1), cx = lane ? lane.x : 128;
  for (let m = 0; m < 3; m++) {
    const y = b0 + 6 + m * 14, x = cx + R.pit.half + 4 + (busy ? -3 : 0), bob = busy ? ((G.time * 10 + m) | 0) % 2 : 0;
    R1(x - 3, y - 3 - bob, 6, 7, '#1b120c'); R1(x - 2, y - 2 - bob, 4, 5, '#d83a2c'); R1(x - 2, y - 2 - bob, 4, 1, '#ffffff'); R1(x - 1, y - 5 - bob, 3, 3, '#f2f2ee');
    if (busy && Math.random() < .5) addP({ t: 'd', x: x - 3, y: y - 1, z: 6, vx: (busy.x - x) * 2 + (Math.random() - .5) * 20, vy: (busy.y - y) * 2 + (Math.random() - .5) * 20, vz: 30, col: WATC[(Math.random() * 4) | 0], s: 1, life: .5, ml: .5 });
  }
}

// above the cars: the start gantry with its lamps, slipstream streaks, messages over your car, a sign at the pit lane
export function drawRingAbove() {
  const R = G.T.ring; if (!R) return;
  const p = G.T.path[0], n = G.T.nrm[0], lit = G.state === 'countdown' ? Math.min(5, Math.floor(G.stateTime / .5)) : 0;
  const ax = p.x - n.x * (HALF + 9), ay = p.y - n.y * (HALF + 9), L = 2 * (HALF + 9);
  ctx.globalAlpha = .25; for (let s = 0; s <= L; s += 1) R1(Math.round(ax + n.x * s) + 6, Math.round(ay + n.y * s) + 8, 2, 2, '#000'); ctx.globalAlpha = 1;
  for (let s = 0; s <= L; s += 1) { const x = Math.round(ax + n.x * s), y = Math.round(ay + n.y * s); R1(x - 1, y - 2, 3, 4, '#1b120c'); R1(x, y - 1, 1, 2, '#6b6f78'); }
  for (const s of [0, L]) { const x = Math.round(ax + n.x * s), y = Math.round(ay + n.y * s); R1(x - 3, y - 3, 7, 7, '#1b120c'); R1(x - 2, y - 2, 5, 5, '#8d939d'); }
  for (let k = 0; k < 5; k++) {
    const s = L / 2 + (k - 2) * 8, x = Math.round(ax + n.x * s), y = Math.round(ay + n.y * s), on = k < lit;
    R1(x - 3, y - 3, 7, 7, '#1b120c'); R1(x - 2, y - 2, 5, 5, on ? '#ff2d2d' : '#4a1010');
    if (on) { ctx.globalAlpha = .35; disc(x, y, 6, '#ff4040'); ctx.globalAlpha = 1; }
  }
  if (R.pit) {
    const q = R.pit.pts[Math.max(0, R.pit.k0)], x = Math.round(q.x + 26), y = Math.round(q.y - 2);
    R1(x - 6, y - 6, 13, 13, '#1b120c'); R1(x - 5, y - 5, 11, 11, '#2f6fd8'); text('P', x + 1, y - 4, 8, '#ffffff', 'center', null);
  }
  for (const c of G.cars) {
    if (c.draft > .3 && c.fall <= 0) {
      const fx = Math.cos(c.ang), fy = Math.sin(c.ang), nx = -fy, ny = fx;
      ctx.globalAlpha = .55 * c.draft; ctx.fillStyle = '#ffffff';
      for (const s of [-12, 12]) for (let k = 0; k < 3; k++) {
        const b = ((G.time * 90 + k * 9 + (s > 0 ? 4 : 0)) % 27) - 4;
        for (let q = 0; q < 6; q++) ctx.fillRect(Math.round(c.x + fx * (8 - b - q) + nx * s), Math.round(c.y + fy * (8 - b - q) + ny * s), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    if (c.rocket > 0 && Math.random() < .6) addP({ t: 'dust', x: c.x - Math.cos(c.ang) * 14, y: c.y - Math.sin(c.ang) * 14, vx: 0, vy: 0, life: .4, ml: .4 });
  }
  const P = G.player;
  if (P && P.msgT > 0) text(P.msg, Math.round(P.x), Math.round(P.y - 34 - (1.6 - P.msgT) * 6), 8, P.msg === 'BOX BOX!' ? '#9fd6ff' : '#ffd23f', 'center');
}

// the start lights in the middle of the screen, instead of the 3-2-1
export function drawStartLights() {
  const lit = G.state === 'countdown' ? Math.min(5, Math.floor(G.stateTime / .5)) : 0, w = 5 * 22 + 8, x0 = VW / 2 - w / 2, y0 = 52;
  R1(x0 - 2, y0 - 2, w + 4, 52, '#1b120c'); R1(x0, y0, w, 48, '#2c2e33');
  for (let k = 0; k < 5; k++) {
    const x = x0 + 8 + k * 22;
    R1(x - 1, y0 + 3, 16, 42, '#1b120c');
    for (const r of [0, 1]) { const cy = y0 + 13 + r * 21; disc(x + 7, cy, 7, '#140c0c'); disc(x + 7, cy, 6, k < lit ? '#ff2d2d' : '#3a1010'); if (k < lit) { R1(x + 4, cy - 4, 3, 2, '#ffb0b0'); ctx.globalAlpha = .25; disc(x + 7, cy, 10, '#ff4040'); ctx.globalAlpha = 1; } }
  }
}
