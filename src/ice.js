import { G } from './g.js';
import { SFX } from './audio.js';
import { LAPS, TAU, VW, clamp, ctx } from './core.js';
import { ell } from './gfx.js';
import { dirHeld } from './input.js';
import { addP } from './particles.js';
import { cam } from './state.js';
import { inView, near } from './trackfx.js';
import { POWDER } from './icemap.js';

// ---------- Eis Rev 2 while racing (plaene/EIS_REV2.md): powder snow behind the cars, a crooked landing after the ski jump snows the car in,
// the progress through the wood and the serpentines (parts of the centre line lie close together), the polar light in the last lap. ----------

// the ground under a car: powder snow and steam of snow behind it
function iceGround(c, j, sp, dt) {
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

// above the cars: the snowed-in lump over a car (the shaking shows while it is held), the polar light in the last lap
function drawIceAbove() {
  const T = G.T, I = T.ice;
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
  init(T) { T.ev.obst = []; },
  surf: iceSurf, progress: iceProgress, wander: .5,
  stuck(c, dt, racing) { if (!(c.snowT > 0)) return false; iceStuck(c, dt, racing); return true; },
  ground: iceGround, drawAbove: drawIceAbove,
};
