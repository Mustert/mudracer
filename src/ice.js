import { G } from './g.js';
import { SFX } from './audio.js';
import { LAPS, TAU, VH, VW, WH, WW, clamp, ctx, hash, hex, vnoise } from './core.js';
import { R1, disc, ell, text } from './draw.js';
import { held } from './input.js';
import { snap } from './events.js';
import { addP, splash } from './particles.js';
import { cam } from './state.js';
import { nearestIdx } from './bau.js';
import { near } from './trackfx.js';

// ---------- Eis while racing: the thin ice of the lake cracks under every car and breaks after about eight crossings (the hole freezes over
// again after 20 s), the computer cars take the short cut while it is safe, steam over the hot spring, snowfall.
// Event "frost": from lap 2 three corners freeze over (ice flowers grow in from the edge), the snow gets heavier, and about every 20 s an avalanche
// rolls down the slope on the right: a growing snowball, who it hits is snowed in until shaken free. In the last lap a polar light shines.
// Event "pinguine": little groups waddle across the road, one slides across the lake on its belly. ----------

const CELL = 16, BREAK = 8, REFREEZE = 20, AVAL = { per: 20, warn: 2.2, roll: 2.6, first: 4 };
const cellOf = (x, y) => ((y / CELL) | 0) * 100 + ((x / CELL) | 0);

// ======================================================= always: the lake, steam, snowfall

export function initIce(T) {
  const ev = T.ev;
  ev.cells = new Map(); ev.iceHoles = []; ev.peng = []; ev.obst = []; ev.frost = null; ev.frostOn = false; ev.aval = null; ev.pengOn = false; ev.lakeSnap = false;
}

function cell(ev, k) { let c = ev.cells.get(k); if (!c) { c = { n: 0, hole: null }; ev.cells.set(k, c); } return c; }

// a hole breaks open in the middle of the cell: dark water (deep, you fall in); it freezes over again, thin and light blue at first
function paintHole(T, h, open) {
  const b = T.base.getContext('2d'), r = 11, x0 = Math.round(h.x - r - 2), y0 = Math.round(h.y - r - 2), w = r * 2 + 5, img = b.getImageData(x0, y0, w, w), d = img.data;
  for (let y = y0; y < y0 + w; y++) for (let x = x0; x < x0 + w; x++) {
    if (x < 0 || y < 0 || x >= WW || y >= WH) continue;
    const j = y * WW + x; if (!T.ice.lakeM[j]) continue;
    const dd = Math.hypot(x + .5 - h.x, y + .5 - h.y) + (vnoise(x * .3, y * .3, 76) - .5) * 4; if (dd > r) continue;
    T.ter[j] = open ? 5 : 12;
    const c = open ? (dd > r - 2 ? [230, 246, 255] : dd > r - 4 ? [44, 110, 150] : [22, 64, 102]) : (dd > r - 1.5 ? [160, 210, 236] : hash(x, y, 77) < .1 ? [238, 250, 255] : [196, 234, 250]);
    const k = ((y - y0) * w + x - x0) * 4; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2];
  }
  b.putImageData(img, x0, y0);
}

export function iceUpdate(T, dt) {
  const ev = T.ev, I = T.ice;
  for (const h of ev.iceHoles) if (h.open && ev.t - h.t0 > REFREEZE) { h.open = false; paintHole(T, h, false); h.cell.n = BREAK - 3; h.cell.hole = null; }
  ev.iceHoles = ev.iceHoles.filter(h => h.open);
  // steam over the hot spring
  const S = I.spring;
  if (S && near(S[0], S[1]) < 320 && Math.random() < dt * 14) addP({ t: 'smoke', x: S[0] + (Math.random() - .5) * S[2] * 1.6, y: S[1] + (Math.random() - .5) * S[3], vx: 4 + Math.random() * 6, vy: -10 - Math.random() * 8, life: 1.6, ml: 1.6 });
  if (ev.frostOn) updateFrost(T, dt);
  if (ev.pengOn) updatePenguins(T, dt);
  ev.obst = ev.peng.filter(p => p.on);
}

// the ground under a car: the lake ice cracks (every new cell it drives into counts once), steam and powder snow
export function iceGround(c, j, sp, dt) {
  const T = G.T, I = T.ice, ev = T.ev;
  const onLake = !!I.lakeM[j];
  // fall through a hole: set down on the shore next to it
  c.respawnI = onLake ? nearestIdx(T.path, c.x, c.y) : null;
  if (onLake && c.surf === 12 && sp > 10) {
    const k = cellOf(c.x, c.y);
    if (k !== c.cell) {
      c.cell = k; const C = cell(ev, k);
      if (!C.hole) {
        C.n++;
        const v = c.ai ? clamp(1 - near(c.x, c.y) / 320, 0, .5) : 1;
        if (v > .02 && C.n >= 3) SFX.crack(v * Math.min(1, C.n / BREAK));
        if (C.n >= BREAK) {
          const h = { x: ((k % 100) + .5) * CELL, y: (((k / 100) | 0) + .5) * CELL, t0: ev.t, open: true, cell: C };
          if (!ev.lakeSnap) { ev.lakeSnap = true; const L = I.lake; snap(T, L[0] - L[2] - 10, L[1] - L[3] - 10, L[2] * 2 + 20, L[3] * 2 + 20); }
          C.hole = h; ev.iceHoles.push(h); paintHole(T, h, true);
          if (v > .02) SFX.iceBreak(v);
        }
      }
    }
  } else if (!onLake) c.cell = -1;
  if (c.surf === 3) c.dirt = Math.max(0, c.dirt - dt); // the hot spring washes fast
  if (c.surf === 12 && sp > 50 && Math.random() < dt * 8) addP({ t: 'd', x: c.x - Math.cos(c.ang) * 12, y: c.y - Math.sin(c.ang) * 12, z: 1, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, vz: 20, col: '#ffffff', s: 1, life: .4, ml: .4 });
  if (c.surf === 0 && sp > 30 && Math.random() < dt * 14) addP({ t: 'd', x: c.x - Math.cos(c.ang) * 12, y: c.y - Math.sin(c.ang) * 12, z: 1, vx: (Math.random() - .5) * 40, vy: (Math.random() - .5) * 40, vz: 40, col: ['#ffffff', '#e6eef6'][(Math.random() * 2) | 0], s: 2, life: .6, ml: .6 });
}

// snowed in: stuck until shaken free (about a second); every new press of the gas shakes it a little faster
export function iceStuck(c, dt, racing) {
  c.vx = c.vy = 0;
  let k = 1;
  if (!c.ai && racing) { const g = ['left', 'right', 'up', 'down'].some(held); if (g && !c.gasPrev) { k = 0; c.snowT -= .14; c.shake = 1; } c.gasPrev = g; }
  c.snowT -= dt * k; c.shake = Math.max(0, (c.shake || 0) - dt * 4);
  if (Math.random() < dt * 10) addP({ t: 'd', x: c.x + (Math.random() - .5) * 26, y: c.y + (Math.random() - .5) * 18, z: 6, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, vz: 30, col: '#ffffff', s: 2, life: .5, ml: .5 });
  if (c.snowT <= 0) {
    c.snowT = 0; c.dirt = 1;
    for (let i = 0; i < 26; i++) addP({ t: 'd', x: c.x, y: c.y, z: 4, vx: Math.cos(i / 26 * TAU) * 80, vy: Math.sin(i / 26 * TAU) * 80, vz: 50, col: i % 2 ? '#ffffff' : '#dce8f2', s: 2, life: .7, ml: .7 });
    if (!c.ai || near(c.x, c.y) < 250) SFX.crunch(c.ai ? .4 : 1);
  }
}

// ======================================================= the computer cars: the short cut over the lake

// while there is no hole on the way they go straight across the ice (on SCHWER also past holes); they leave it at the other side
export function iceTarget(c) {
  const T = G.T, S = T.ice.short, ev = T.ev; if (!S || c.finished || G.state !== 'race') return null;
  const N = T.N, ahead = (S.a - c.idx + N) % N;
  if (!c.short) {
    if (ahead > 26 || ahead < 4 || Math.abs(c.y - S.y) > 24) return null;
    const diff = G.raceDiff || 0, holes = ev.iceHoles.some(h => Math.abs(h.y - S.y) < 26);
    if ((holes && diff < 2) || (c.seed * 5.3) % 1 > [.35, .7, 1][diff]) { c.noShort = c.lap; return null; }
    if (c.noShort === c.lap) return null;
    c.short = S.y; // the line it is aiming for
  }
  // (south of the line the lake ends close to the edge of the map: whoever slides down there gives up the short cut)
  if (c.x < S.x1 + 14 || c.y > S.y + 34 || c.y < S.y - 70 || c.fall > 0) { c.short = false; return null; }
  // of three lines across the lake take the one with the most room to the holes (and to ice that is about to break) on the way ahead
  const tx = c.x - 60, risky = ev.iceHoles.map(h => [h.x, h.y]);
  for (const [k, C] of ev.cells) if (!C.hole && C.n >= BREAK - 1) risky.push([((k % 100) + .5) * CELL, (((k / 100) | 0) + .5) * CELL]);
  let best = c.short, bs = -1;
  for (const ty of [c.short, S.y, S.y - 28, S.y - 52]) {
    let room = 99;
    for (const [hx, hy] of risky) for (let u = 0; u <= 1; u += .25) room = Math.min(room, Math.hypot(c.x + (tx - c.x) * u - hx, c.y + (ty - c.y) * u - hy));
    if (room > bs + 4) { bs = room; best = ty; }
  }
  c.short = best;
  return [tx, best];
}

// ======================================================= event "frost": icy corners, avalanches, the polar light

export function initFrost(T) { T.ev.frostOn = true; }

function updateFrost(T, dt) {
  const ev = T.ev, I = T.ice;
  if (!ev.frost) {
    if (!G.player || G.player.lap < 2) return;
    ev.frost = { t: 0, done: I.frost.map(() => 0) };
    snap(T, 0, 0, WW, WH); // icy corners and snow piles change the ground; this puts it back after the race
    SFX.frost();
  }
  const f = ev.frost; f.t += dt;
  // ice flowers grow in from the edge of three corners, one after the other
  const b = T.base.getContext('2d');
  I.frost.forEach((F, k) => {
    const p = clamp((f.t - 1 - k * 2.5) / 2.2, 0, 1), n = Math.floor(F.px.length * p); if (n <= f.done[k]) return;
    let x0 = WW, y0 = WH, x1 = 0, y1 = 0;
    for (let q = f.done[k]; q < n; q++) { const j = F.px[q], x = j % WW, y = j / WW | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const img = b.getImageData(x0, y0, x1 - x0 + 1, y1 - y0 + 1), d = img.data, w = x1 - x0 + 1;
    for (let q = f.done[k]; q < n; q++) {
      const j = F.px[q], x = j % WW, y = j / WW | 0; if (T.ter[j] !== 1) continue;
      T.ter[j] = 12;
      const fern = Math.abs(Math.sin(x * .7 + Math.sin(y * .5) * 2)) > .86 || Math.abs(Math.sin(y * .7 + Math.sin(x * .45) * 2)) > .9;
      const c = fern ? [250, 254, 255] : hash(x, y, 78) < .5 ? [190, 228, 244] : [174, 216, 238];
      const i = ((y - y0) * w + x - x0) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
    }
    b.putImageData(img, x0, y0); f.done[k] = n;
    if (n && f.done[k] === n && near(F.x, F.y) < 300 && Math.random() < dt * 6) SFX.crack(.4);
  });
  updateAvalanche(T, dt);
}

// the avalanche: rumble and a shadow first, then a snowball rolls down and grows; where it bursts a heap of deep snow stays on the road
function updateAvalanche(T, dt) {
  const ev = T.ev, A = T.ice.avalanche; if (!A) return;
  const t = ev.frost.t - AVAL.first, k = Math.floor(t / AVAL.per), u = t - k * AVAL.per;
  if (t < 0) { ev.aval = null; return; }
  const [[ax, ay], [bx, by]] = A, ox = (hash(k, 1, 79) - .5) * 30, ex = bx + ox, ey = by + (hash(k, 2, 79) - .5) * 20;
  if (!ev.aval || ev.aval.k !== k) { ev.aval = { k, hit: new Set(), burst: false }; if (near(ex, ey) < 500) SFX.rumble(); }
  const a = ev.aval;
  a.warn = u < AVAL.warn; a.p = clamp((u - AVAL.warn) / AVAL.roll, 0, 1);
  a.x = ax + (ex - ax) * a.p; a.y = ay + (ey - ay) * a.p + Math.sin(a.p * Math.PI) * 10; a.r = 6 + 12 * a.p; a.on = u >= AVAL.warn && a.p < 1;
  if (a.p >= 1 && !a.burst) {
    a.burst = true;
    const b = T.base.getContext('2d'), R = 22, x0 = Math.round(ex - R), y0 = Math.round(ey - R), img = b.getImageData(x0, y0, R * 2, R * 2), d = img.data, MUD = T.th.mud.map(hex), E = hex(T.th.mudEdge);
    for (let y = y0; y < y0 + R * 2; y++) for (let x = x0; x < x0 + R * 2; x++) {
      const e = ((x + .5 - ex) / R) ** 2 + ((y + .5 - ey) / (R * .7)) ** 2, lim = .8 + .4 * vnoise(x * .2, y * .2, 80 + k); if (e >= lim) continue;
      const j = y * WW + x; if (T.ter[j] === 5) continue; T.ter[j] = 2;
      const c = e > lim * .8 ? E : hash(x, y, 81) < .3 ? MUD[2] : MUD[0], i = ((y - y0) * R * 2 + x - x0) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
    }
    b.putImageData(img, x0, y0);
    for (let i = 0; i < 40; i++) addP({ t: 'd', x: ex, y: ey, z: 6, vx: Math.cos(i / 40 * TAU) * (60 + Math.random() * 60), vy: Math.sin(i / 40 * TAU) * (40 + Math.random() * 40), vz: 60, col: i % 3 ? '#ffffff' : '#dce8f2', s: 2, life: .8, ml: .8 });
    if (near(ex, ey) < 360) SFX.crunch(1);
  }
}

// ======================================================= event "pinguine"

export function initPenguins(T) { T.ev.pengOn = true; }

// a group of three crosses the road from the colony and back (every 9 s), one slides across the lake on its belly (every 11 s)
function updatePenguins(T, dt) {
  const ev = T.ev, C = T.ice.colony; if (!C) return;
  if (!ev.peng.length) for (let k = 0; k < 4; k++) ev.peng.push({ k, x: 0, y: 0, on: false, slide: k === 3, cool: 0, quack: 0, face: 1 });
  for (const p of ev.peng) {
    p.cool = Math.max(0, p.cool - dt); p.quack = Math.max(0, p.quack - dt);
    if (p.slide) {
      const L = T.ice.lake, u = ((ev.t + 3) % 11) / 3.2; p.on = u < 1;
      p.x = L[0] - L[2] * .7 + u * L[2] * 1.4; p.y = L[1] - L[3] * .4 + u * L[3] * .9; p.face = 1; continue;
    }
    // 0..4 s over to the other side, a second there, 5..9 s back home
    const per = 9, u = ((ev.t - p.k * .45) % per + per) % per, go = u < 4 ? u / 4 : u < 5 ? 1 : 1 - (u - 5) / 4;
    const x0 = C.x - 36, x1 = 552, y = C.y - 10 + p.k * 9;
    p.x = x0 + (x1 - x0) * go; p.y = y + Math.sin(ev.t * 9 + p.k); p.face = u >= 5 ? 1 : -1;
    p.on = go > .05;
  }
}

// cars and the snowball, cars and penguins
export function iceCollisions() {
  const ev = G.T.ev; if (!ev) return;
  const a = ev.aval;
  if (a && a.on) for (const c of G.cars) {
    if (c.fall > 0 || c.z > 0 || c.snowT > 0 || c.ghost > 0 || a.hit.has(c) || Math.hypot(c.x - a.x, c.y - a.y) > a.r + 10) continue;
    a.hit.add(c); c.snowT = 1.05; c.vx = c.vy = 0; c.stun = 0; c.boost = 0; c.shake = 1;
    if (!c.ai) { SFX.crash(); } else if (near(c.x, c.y) < 260) SFX.crunch(.4);
  }
  for (const p of ev.peng) if (p.on) for (const c of G.cars) {
    if (c.z > 0 || c.fall > 0 || c.ghost > 0) continue;
    const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy), mn = 14; if (d >= mn || d === 0) continue;
    const nx = dx / d, ny = dy / d, vn = c.vx * nx + c.vy * ny;
    c.x = p.x + nx * mn; c.y = p.y + ny * mn;
    if (vn < -30 && !c.stun) { c.vx = nx * 130; c.vy = ny * 130; c.spin = 11; c.stun = .9; c.boost = 0; if (p.cool <= 0) { p.cool = 1.2; p.quack = 1.1; const v = c.ai ? clamp(1 - near(p.x, p.y) / 300, 0, .6) : 1; if (v > .02) SFX.quack(v); } if (!c.ai) SFX.crash(); }
    else if (vn < 0) { c.vx -= 1.4 * vn * nx; c.vy -= 1.4 * vn * ny; }
  }
}

// ======================================================= drawing

function drawPenguin(x, y, f, slide, k) {
  x = Math.round(x); y = Math.round(y);
  ctx.globalAlpha = .25; R1(x - 4, y + 3, 9, 3, '#000'); ctx.globalAlpha = 1;
  if (slide) { R1(x - 6, y - 2, 12, 5, '#1b120c'); R1(x - 5, y - 1, 10, 3, '#2a2a34'); R1(x - 4, y, 7, 2, '#ffffff'); R1(f > 0 ? x + 5 : x - 7, y - 1, 2, 2, '#ffb02e'); return; }
  const st = ((G.time * 8 + k) | 0) % 2;
  R1(x - 3, y - 6, 7, 10, '#1b120c'); R1(x - 2, y - 5, 5, 8, '#2a2a34'); R1(x - 1, y - 3, 3, 6, '#ffffff');
  R1(x + (f > 0 ? 2 : -3), y - 5, 2, 1, '#ffb02e'); R1(x, y - 5, 1, 1, '#ffffff');
  R1(x - 2 + st, y + 4, 2, 1, '#ffb02e'); R1(x + 1 - st, y + 4, 2, 1, '#ffb02e');
}

// on the ground: cracks in the lake ice, the penguins and their colony, the cable of the ski lift with its gondolas
export function drawIceGround() {
  const T = G.T, I = T.ice, ev = T.ev;
  if (ev && ev.cells) for (const [k, C] of ev.cells) {
    if (!C.n || C.hole) continue;
    const cx = ((k % 100) + .5) * CELL, cy = (((k / 100) | 0) + .5) * CELL;
    if (Math.abs(cx - cam.x - VW / 2) > VW / 2 + 20 || Math.abs(cy - cam.y - VH / 2) > VH / 2 + 20) continue;
    // more and longer cracks the more often the ice was crossed: zigzag lines from the middle of the cell
    ctx.fillStyle = C.n >= BREAK - 2 ? '#4f86b0' : '#7fb0d2';
    for (let q = 0; q < Math.min(6, C.n); q++) {
      let x = cx + (hash(k, q, 82) - .5) * 6, y = cy + (hash(k, q, 83) - .5) * 6, a = hash(k, q, 84) * TAU;
      const len = 4 + C.n * 1.3;
      for (let s = 0; s < len; s++) { if (s % 3 === 0) a += (hash(k, q * 9 + s, 85) - .5) * 1.4; x += Math.cos(a); y += Math.sin(a); if (I.lakeM[clamp(Math.round(y), 0, WH - 1) * WW + clamp(Math.round(x), 0, WW - 1)]) ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
    }
  }
  if (I.colony && near(I.colony.x, I.colony.y) < 340) for (let k = 0; k < 6; k++) {
    const x = I.colony.x - 18 + (k % 3) * 16 + Math.sin(G.time + k) * 2, y = I.colony.y - 6 + (k >> 1) * 7 - (k % 2) * 4;
    drawPenguin(x, y, k % 2 ? 1 : -1, false, k);
  }
  if (ev && ev.peng) for (const p of ev.peng) if (p.on && near(p.x, p.y) < 340) drawPenguin(p.x, p.y, p.face, p.slide, p.k);
  // the snowball's shadow while it is still up the slope: it warns where it will come down
  const a = ev && ev.aval;
  if (a && (a.warn || a.on)) { ctx.globalAlpha = a.warn ? .15 + .15 * Math.abs(Math.sin(G.time * 8)) : .3; ell(Math.round(a.x + 3), Math.round(a.y + a.r * .6), Math.round(a.r + 4), Math.round(a.r * .5 + 2), '#304860'); ctx.globalAlpha = 1; }
}

// above the cars: the snowball, "LAWINE!", the gondolas of the ski lift, the polar light over the lake in the last lap, the penguins' "QUAEK!"
export function drawIceAbove() {
  const T = G.T, I = T.ice, ev = T.ev, a = ev && ev.aval;
  if (a && a.on) {
    const x = Math.round(a.x), y = Math.round(a.y), r = Math.round(a.r), rot = a.p * 20;
    disc(x, y, r + 1, '#9fb2c6'); disc(x, y, r, '#f4f8fc'); disc(x - Math.round(r * .3), y - Math.round(r * .3), Math.round(r * .45), '#ffffff');
    for (let q = 0; q < 5; q++) R1(Math.round(x + Math.cos(rot + q * 1.3) * r * .6), Math.round(y + Math.sin(rot + q * 1.3) * r * .6), 2, 2, '#c8d6e4');
    if (Math.random() < .6) addP({ t: 'd', x: a.x + (Math.random() - .5) * a.r * 2, y: a.y + a.r * .5, z: 3, vx: (Math.random() - .5) * 40, vy: -20, vz: 30, col: '#ffffff', s: 2, life: .5, ml: .5 });
  }
  if (a && a.warn && G.player && near(a.x, a.y) < 420 && ((G.time * 4) | 0) % 2 === 0) text('LAWINE!', Math.round(G.player.x), Math.round(G.player.y - 40), 8, '#ff6b6b', 'center');
  if (ev && ev.peng) for (const p of ev.peng) if (p.quack > 0) text('QUAEK!', Math.round(p.x), Math.round(p.y - 14 - (1.1 - p.quack) * 8), 8, '#ffffff', 'center');
  // ski lift
  const L = I.lift, len = L.y1 - L.y0;
  if (cam.x < 60) {
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(L.x - 3, L.y0, 1, len); ctx.fillRect(L.x + 3, L.y0, 1, len);
    for (let k = 0; k < 8; k++) {
      const up = k % 2, ph = ((G.time * 14 + k * len / 4) % len), y = Math.round(up ? L.y1 - ph : L.y0 + ph), x = L.x + (up ? 3 : -3);
      R1(x, y - 4, 1, 4, '#3a3a40'); R1(x - 3, y, 7, 6, '#1b120c'); R1(x - 2, y + 1, 5, 4, ['#d83a2c', '#2f6fd8', '#f2c230', '#3aa845'][k % 4]); R1(x - 2, y + 1, 5, 1, '#9fd6ff');
    }
  }
  // the polar light: green and violet curtains over the lake, their mirror image in the ice
  if (ev && ev.frost && G.player && G.player.lap >= LAPS && I.lake) {
    const [lx, ly, rx, ry] = I.lake, fade = clamp(G.player.lap >= LAPS ? 1 : 0, 0, 1);
    for (let k = 0; k < 3; k++) for (let x = lx - rx; x < lx + rx; x += 2) {
      const w = Math.sin(x * .03 + G.time * (.6 + k * .2) + k * 2) * 10 + Math.sin(x * .011 - G.time * .4) * 8, y = ly - ry - 34 + k * 9 + w, h = 16 + 8 * Math.sin(x * .05 + G.time + k);
      ctx.globalAlpha = .1 * fade; ctx.fillStyle = k === 1 ? '#b36bff' : '#6bffb0'; ctx.fillRect(x, Math.round(y), 2, Math.round(h));
      ctx.globalAlpha = .06 * fade; ctx.fillRect(x, Math.round(ly + ry * .2 - w * .5), 2, Math.round(h * .8));
    }
    ctx.globalAlpha = 1;
  }
}

// snow falling over the whole screen: light in lap 1, thick with the frost
export function drawIceSky(cx, cy) {
  const ev = G.T.ev, n = ev && ev.frost ? 170 : 60;

  for (let i = 0; i < n; i++) {
    const sp = 18 + hash(i, 1, 86) * 26, x = ((hash(i, 2, 86) * (VW + 40) + Math.sin(G.time * .8 + i) * 10 - cx * .4) % (VW + 40) + VW + 40) % (VW + 40) - 20;
    const y = ((hash(i, 3, 86) * (VH + 20) + G.time * sp - cy * .4) % (VH + 20) + VH + 20) % (VH + 20) - 10;
    // a flake with a little blue shadow, so it shows over the white snow too
    const s = i % 5 ? 1 : 2; ctx.globalAlpha = .55 + hash(i, 4, 86) * .45; ctx.fillStyle = '#8fa4ba'; ctx.fillRect(Math.round(x) + 1, Math.round(y) + 1, s, s); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x), Math.round(y), s, s);
  }
  ctx.globalAlpha = 1;
}
