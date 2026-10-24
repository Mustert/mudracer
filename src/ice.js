import { G } from './g.js';
import { SFX } from './audio.js';
import { LAPS, SS, TAU, VH, VW, angDiff, clamp, ctx } from './core.js';
import { R1, ell, text } from './gfx.js';
import { dirHeld } from './input.js';
import { addP } from './particles.js';
import { cam } from './state.js';
import { inView, near } from './trackfx.js';
import { LIFT, POWDER } from './icemap.js';

// ---------- Eis Rev 2 while racing (the chair lift, the chess players,  (plaene/EIS_REV2.md): the chair lift (every car that reaches the line is hooked on at once, no waiting: its own chair the moment it arrives), powder snow behind the cars, a crooked landing after the ski jump snows the car in,
// the progress through the wood and the serpentines (parts of the centre line lie close together), the polar light in the last lap. ----------

// the computer cars steer round the pines near them: only those within 90 px of a car go into T.ev.obst (steerAround, physics.js), not the whole wood
function iceUpdate(T) {
  const ev = T.ev, I = T.ice;
  ev.obst = ev.obst.length ? [] : ev.obst;
  const out = [];
  for (const o of I.trees) for (const c of G.cars) if (c.ai && Math.abs(c.x - o.x) < 90 && Math.abs(c.y - o.y) < 90) { out.push(o); break; }
  ev.obst = out;
}

// ======================================================= the foehn (the only way to get clean)

// a dirty computer car turns into the foehn lane beside the climb (only when it is really dirty, the same limits as the desert), drives through under the hut and comes
// out above it; the washing itself is the ordinary washMask (it does not wash at once)
function foenTarget(c) {
  const T = G.T, B = T.ice.bay, N = T.N; if (!B) return null;
  if (!c.iceBay && G.state === 'race' && c.dirt > [.4, .55, .7][G.raceDiff || 0] && (B.i0 - c.idx + N) % N < 40) c.iceBay = { k: 0 };
  const W = c.iceBay; if (!W) return null;
  const P = B.P; let k = W.k, bd = 1e9;
  for (let q = W.k; q < Math.min(P.length, W.k + 30); q++) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  W.k = k;
  if (k >= P.length - 4 || bd > 70 * 70 || G.state !== 'race') { c.iceBay = null; return null; }
  const p = P[Math.min(P.length - 1, k + 9)];
  return [p.x, p.y];
}

// the computer cars ease off before the hairpins of the serpentines and slowly through the foehn
function iceThrottle(c, thr) {
  if (c.iceBay) return Math.min(thr, .6);
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
  L.s += LIFT_V * dt;
  const u = clamp(L.s / 36, 0, 1), sway = Math.sin(G.time * 2.4 + L.ph) * 1.6 * u, xt = lx - CABLE + L.off * .3;
  c.x = L.x0 + (xt - L.x0) * (u * u * (3 - 2 * u)) + sway; c.y = L.y0 - L.s; c.ang = -Math.PI / 2; c.vx = c.vy = 0; c.ghost = Math.max(c.ghost, .1);
  c.idx = clamp(Math.round(L.y0 - L.s - T.path[0].y) / -2 | 0, 0, T.N - 1); c.off = Math.abs(c.x - lx); c.safe = c.idx;
  if (c.y <= ly1) { // at the top: set down on the road, rolling
    c.iceLift = null; c.ghost = 0; c.x = lx + ((c.seed * 7.3) % 1 - .5) * 30; c.y = ly1; c.vx = 0; c.vy = -105; c.surf = 1;
  }
}

// the ground under a car: powder snow and steam of snow behind it
function iceGround(c, j, sp, dt) {
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
  const T = G.T, I = T.ice;
  drawLiftCables(); drawFoenSky();
  for (const c of G.cars) if (c.snowT > 0 && inView(c.x, c.y, 30)) {
    const X = Math.round(c.x), Y = Math.round(c.y), w = Math.round(Math.sin(G.time * 40) * (c.shake || 0) * 2);
    ell(X + w, Y, 16, 12, '#9fb2c6'); ell(X + w, Y - 1, 15, 11, '#eef4fa'); ell(X - 4 + w, Y - 4, 8, 5, '#ffffff');
  }
  if (G.player && G.player.lap >= LAPS && I.lake) drawAurora(T.ev, I.lake);
}

// the polar light of the last lap: three curtains hang in the sky over the lake (violet at the top, green at the lower edge, vertical rays that flicker and
// sway), and the lake ice mirrors them (flipped at the north shore, a little squeezed, with a green glow on the ice, fainter, rippling, only inside the lake)
const AURORA = Array.from({ length: 5 }, (_, i) => { const m = (a, b) => Math.round(a + (b - a) * i / 4); return 'rgb(' + m(150, 40) + ',' + m(80, 240) + ',' + m(255, 140) + ')'; });
function drawAurora(ev, [lx, ly, rx, ry]) {
  if (!inView(lx, ly - ry * .5, rx + 40) && !inView(lx, ly - ry - 140, rx + 40)) return;
  if (ev.iceAuroraT0 === undefined) ev.iceAuroraT0 = G.time;
  const fade = clamp((G.time - ev.iceAuroraT0) / 3, 0, 1), ym = ly - ry * .9, N = 5, x0 = Math.max(lx - rx - 40, cam.x - 6), x1 = Math.min(lx + rx + 40, cam.x + VW + 6);
  for (const mirror of [false, true]) {
    ctx.save();
    if (mirror) { ctx.beginPath(); ctx.ellipse(lx, ly, rx * .96, ry * .96, 0, 0, TAU); ctx.clip(); ctx.globalAlpha = .08 * fade; ctx.fillStyle = '#5cffb4'; ctx.fillRect(lx - rx, ly - ry, rx * 2, ry * 2); }
    for (let k = 0; k < 3; k++) for (let x = x0 - (x0 - (lx - rx - 40)) % 3; x < x1; x += 3) {
      const sway = Math.sin(x * .028 + G.time * (.5 + k * .17) + k * 2.2) * 9 + Math.sin(x * .011 - G.time * .35) * 7;
      const yb = ly - ry - 135 - k * 14 + sway, h = 46 + 18 * Math.sin(x * .05 + G.time * .8 + k) + k * 6;
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
  surf: iceSurf, progress: iceProgress, wander: .5, target: foenTarget, throttle: iceThrottle,
  stuck(c, dt, racing) {
    if (c.iceLift) { liftStep(c, dt); return true; }
    if (!(c.snowT > 0)) return false; iceStuck(c, dt, racing); return true;
  },
  noRespawn: t => t === LIFT, drawCar: drawLiftCar, airTop: c => c.z > 22,
  ground: iceGround, drawGround: drawChess, drawAbove: drawIceAbove,
};
