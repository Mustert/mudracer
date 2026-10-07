import { G } from './g.js';
import { SFX } from './audio.js';
import { HALF, TAU, VH, VW, WH, WW, clamp, ctx, hash, hex, mk, vnoise } from './core.js';
import { R1, text } from './draw.js';
import { addP, mudBurst, WATC } from './particles.js';
import { cam } from './state.js';
import { TRACKS, tctx } from './tracks.js';

// ---------- track events: the map changes while you race ----------
// Wiese: a herd of cows grazes on and next to the track (they are obstacles, they moo).
// Wald: dark holes in the road; after the first lap the rain fills them with mud. (The dusk and the headlights are not an event.)
// Strand: from lap 2 the tide floods the lower part of the track, only a thin pier stays dry.
// Every event can be switched off with G.events (see state.js). A track is changed in place; setupEvents/resetTrackEvents put it back.

export const eventOn = key => G.events[key] !== false;

// ----- undo: the base picture and the terrain of every changed area are saved first -----

const bctx = T => T.bctx || (T.bctx = T.base.getContext('2d'));

function snap(T, x, y, w, h) {
  x = clamp(x | 0, 0, WW - 1); y = clamp(y | 0, 0, WH - 1); w = Math.min(w, WW - x); h = Math.min(h, WH - y);
  const ter = new Uint8Array(w * h);
  for (let r = 0; r < h; r++) ter.set(T.ter.subarray((y + r) * WW + x, (y + r) * WW + x + w), r * w);
  (T.undo = T.undo || []).push({ x, y, w, h, ter, img: bctx(T).getImageData(x, y, w, h) });
  if (!T.pix0) T.pix0 = { mud: T.mudPix, wat: T.watPix };
}

function redrawMini(T) {
  if (!T.mini) return;
  const g = T.mini.getContext('2d'); g.imageSmoothingEnabled = true; g.clearRect(0, 0, 120, 68);
  g.drawImage(T.base, 0, 0, 120, 68); g.drawImage(T.top, 0, 0, 120, 68);
}

export function resetTrackEvents(T) {
  if (T.undo && T.undo.length) {
    const b = bctx(T);
    for (const u of T.undo.reverse()) {
      b.putImageData(u.img, u.x, u.y);
      for (let r = 0; r < u.h; r++) T.ter.set(u.ter.subarray(r * u.w, (r + 1) * u.w), (u.y + r) * WW + u.x);
    }
    T.undo = []; T.flooded = null; if (T.shoreY0) { T.shoreY.set(T.shoreY0); T.shoreY0 = null; } T.mudPix = T.pix0.mud; T.watPix = T.pix0.wat; redrawMini(T);
  }
  T.ev = null;
}

export function resetAllEvents() { for (const T of TRACKS) if (T.ev || (T.undo && T.undo.length)) resetTrackEvents(T); }

// ----- painting helpers -----

// an irregular blob: paint(rel, x, y) gets the distance from the middle (0..1) and returns a colour; ter (optional) is written, the indices are returned
function blob(T, cx, cy, rx, ry, seed, paint, ter) {
  const R = Math.ceil(Math.max(rx, ry) * 1.3) + 2, x0 = clamp(Math.floor(cx - R), 0, WW - 1), y0 = clamp(Math.floor(cy - R), 0, WH - 1);
  const x1 = clamp(Math.ceil(cx + R), 0, WW - 1), y1 = clamp(Math.ceil(cy + R), 0, WH - 1), w = x1 - x0 + 1, h = y1 - y0 + 1;
  const b = bctx(T), img = b.getImageData(x0, y0, w, h), d = img.data, hit = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = x + .5 - cx, dy = y + .5 - cy, e = (dx / rx) ** 2 + (dy / ry) ** 2, lim = .8 + .4 * vnoise(x * .14, y * .14, seed);
    if (e >= lim) continue;
    const c = paint(Math.sqrt(e / lim), x, y), k = ((y - y0) * w + (x - x0)) * 4;
    d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
    if (ter !== undefined) T.ter[y * WW + x] = ter;
    hit.push(y * WW + x);
  }
  b.putImageData(img, x0, y0);
  return hit;
}

// ======================================================= Wiese: cows

// [t along the track, offset from the centre line, how far the cow walks, phase]: the lower right edge, on and next to the track
const COWS = [[.545, 4, 15, 0], [.6, -10, 12, .5], [.57, -46, 10, 1], [.64, 46, 12, 2], [.665, -2, 12, 3.2]];

function initCows(T) {
  T.ev.cows = COWS.map(([t, off, range, ph], k) => {
    const i = Math.floor(t * T.N) % T.N, p = T.path[i], n = T.nrm[i], tg = T.tan[i], a = ph * .45, ca = Math.cos(a), sa = Math.sin(a);
    return { bx: p.x + n.x * off, by: p.y + n.y * off, dx: tg.x * ca - tg.y * sa, dy: tg.x * sa + tg.y * ca, range, ph, x: 0, y: 0, face: k % 2 ? -1 : 1, graze: 0, mooT: 0, cool: 0, k };
  });
}

function updateCows(T, dt) {
  for (const w of T.ev.cows) {
    const a = T.ev.t * .45 + w.ph, s = Math.sin(a), v = Math.cos(a);
    w.x = w.bx + w.dx * s * w.range; w.y = w.by + w.dy * s * w.range;
    const vx = w.dx * v;
    if (Math.abs(vx) > .08) w.face = vx > 0 ? 1 : -1;
    w.graze = Math.abs(v) < .35;                  // at the turning points the cow stops and eats
    w.mooT = Math.max(0, w.mooT - dt); w.cool = Math.max(0, w.cool - dt);
  }
}

// a car hits a cow: pushed out, and hard hits throw it aside (like the train, only softer); the cow moos
export function eventCollisions() {
  const ev = G.T.ev; if (!ev) return;
  for (const w of ev.cows) for (const c of G.cars) {
    if (c.z > 0) continue;
    const dx = c.x - w.x, dy = c.y - w.y, d = Math.hypot(dx, dy), mn = 8 + 9;
    if (d >= mn || d === 0) continue;
    const nx = dx / d, ny = dy / d, vn = c.vx * nx + c.vy * ny;
    c.x = w.x + nx * mn; c.y = w.y + ny * mn;
    if (vn < -30 && !c.stun) {
      c.vx = nx * 150; c.vy = ny * 150; c.spin = 12; c.stun = 1.1; c.boost = 0;
      mudBurst(c, 6);
      if (!c.ai) SFX.crash(); else SFX.bump();
      if (w.cool <= 0) { w.mooT = 1.3; w.cool = 1.5; SFX.moo(); }
    } else if (vn < 0) { c.vx -= 1.4 * vn * nx; c.vy -= 1.4 * vn * ny; }
  }
}

// computer cars steer around cows that are ahead of them
export function steerAround(c, tx, ty) {
  const ev = G.T.ev; if (!ev || !ev.cows.length) return [tx, ty];
  const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
  for (const w of ev.cows) {
    const dx = w.x - c.x, dy = w.y - c.y, d = Math.hypot(dx, dy);
    if (d > 75 || d < 1 || dx * fx + dy * fy < 0) continue;
    const side = dx * -fy + dy * fx, k = (1 - d / 75) * 55 * (side > 0 ? -1 : 1);
    tx += -fy * k; ty += fx * k;
  }
  return [tx, ty];
}

function drawCow(w) {
  const x = Math.round(w.x), y = Math.round(w.y), f = w.face, O = '#1b120c', W = '#f4f1ea', B = '#2b2b30', PK = '#ffb3c6';
  const P = (dx, dy, ww, hh, c) => R1(f > 0 ? x + dx : x - dx - ww, y + dy, ww, hh, c);
  const step = w.graze ? 0 : ((G.time * 4 + w.k) | 0) % 2, hd = w.graze ? 3 : 0;
  ctx.globalAlpha = .25; R1(x - 10, y + 3, 21, 5, '#000'); ctx.globalAlpha = 1;
  // legs (the pairs swing), tail
  P(-8 + step, 3, 2, 3, W); P(-8 + step, 5, 2, 1, O); P(-5 - step, 3, 2, 3, W); P(-5 - step, 5, 2, 1, O);
  P(1 - step, 3, 2, 3, W); P(1 - step, 5, 2, 1, O); P(4 + step, 3, 2, 3, W); P(4 + step, 5, 2, 1, O);
  P(-10, -4, 1, 6, O); P(-11, 1, 2, 3, B);
  // body
  P(-9, -5, 15, 10, O); P(-8, -4, 13, 8, W); P(-8, -4, 13, 1, '#ffffff');
  P(-7, -4, 4, 3, B); P(-1, -1, 5, 4, B); P(-5, 1, 3, 2, B); P(-3, 4, 2, 1, PK);
  // head with horns, ears, muzzle
  P(5, -5 + hd, 7, 8, O); P(6, -4 + hd, 5, 6, W); P(9, -1 + hd, 3, 4, PK); P(11, hd, 1, 1, '#b0657a'); P(8, -3 + hd, 1, 1, O);
  P(6, -6 + hd, 2, 2, O); P(7, -7 + hd, 1, 2, '#e8d8a8'); P(10, -7 + hd, 1, 2, '#e8d8a8');
}

// ======================================================= Wald: holes that the rain fills with mud

// the dark holes as marked on the map (x, y, radius); they are moved onto the road if they lie beside it
const HOLES = [[193, 94, 7], [534, 98, 6], [713, 156, 6], [381, 299, 9], [728, 311, 6], [89, 331, 6], [235, 384, 7]];

function paintHole(T, h) {
  blob(T, h.x, h.y, h.r, h.r * .85, 31, rel => rel > .8 ? hex('#7a5a3a') : rel > .55 ? hex('#3b2512') : hex(hash(h.x + rel * 50 | 0, h.y, 4) < .2 ? '#2c1a0d' : '#1d1209'));
}

function fillHole(T, h) {
  const th = T.th, MUD = th.mud.map(hex), MUDE = hex(th.mudEdge), MUDH = hex(th.mudHi), sd = 41;
  const hit = blob(T, h.x, h.y, h.r * 1.5, h.r * 1.3, sd, (rel, x, y) => {
    if (rel > .86) return MUDE;
    const v = vnoise(x / 9, y / 9, sd) * .6 + hash(x, y, sd) * .4;
    return hash(x, y, sd + 1) < .025 ? MUDH : v < .38 ? MUD[1] : v > .66 ? MUD[2] : MUD[0];
  }, 2);
  T.mudPix = T.mudPix.concat(hit);
}

function initRain(T) {
  const ev = T.ev;
  ev.holes = HOLES.map(([x, y, r0]) => {
    const r = Math.round(r0 * 1.3);
    // onto the road: pull a hole that lies outside towards the centre line
    let j = clamp(y | 0, 0, WH - 1) * WW + clamp(x | 0, 0, WW - 1);
    if (T.dist[j] > HALF - 10) {
      const i = T.near[j], p = T.path[i], dx = x - p.x, dy = y - p.y, l = Math.hypot(dx, dy) || 1, k = (HALF - 12) / l;
      x = p.x + dx * Math.min(1, k); y = p.y + dy * Math.min(1, k);
    }
    const h = { x, y, r, filled: false };
    snap(T, x - r * 1.5 - 4, y - r * 1.5 - 4, Math.ceil(r * 3 + 9), Math.ceil(r * 3 + 9));
    paintHole(T, h);
    return h;
  });
  redrawMini(T);
}

const RAIN_LEN = 9;
const rainAlpha = r => clamp(r.t / 1.2, 0, 1) * clamp((RAIN_LEN - r.t) / 1.5, 0, 1);

function updateRain(T, dt) {
  const ev = T.ev;
  if (!ev.rain && G.player && G.player.lap >= 2) { ev.rain = { t: 0 }; ev.banner = { text: 'REGEN!', t: 2.4, col: '#9fd4ff' }; SFX.thunder(); SFX.rain(); }
  const r = ev.rain; if (!r) return;
  r.t += dt;
  let any = false;
  ev.holes.forEach((h, k) => { if (!h.filled && r.t > 1.3 + k * .55) { h.filled = true; fillHole(T, h); any = true; } });
  if (any) redrawMini(T);
}

export function drawRain() {
  const ev = G.T.ev, r = ev && ev.rain; if (!r) return;
  const a = rainAlpha(r); if (a <= 0) return;
  ctx.fillStyle = 'rgba(20,30,55,' + (.14 * a).toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = 'rgba(205,225,245,.6)';
  const n = Math.round(160 * a);
  for (let i = 0; i < n; i++) {
    const sp = 300 + hash(i, 1, 5) * 140, ph = (G.time * sp + hash(i, 2, 5) * VH * 3) % (VH + 12);
    ctx.fillRect(Math.round(hash(i, 3, 5) * VW - ph * .12), Math.round(ph - 6), 1, 4);
  }
}

// ======================================================= Strand: the flood

// The sea rises: the shoreline moves from the beach up to y1 (just below the lagoon) across the whole width. Behind it everything is water,
// the foam line and the waves (drawBeach) move with it. Only a pier along the track stays dry.
const FLOOD = { y0: 412, y1: 284, dur: 9, pier: 8 };
const WAVE = x => Math.sin(x / 40) * 5 + Math.sin(x / 13) * 2; // the same wavy line as the original shore

function initFlood(T) { T.ev.flood = null; }

function startFlood(T) {
  snap(T, 0, FLOOD.y1 - 12, WW, WH - (FLOOD.y1 - 12));
  T.watPix = T.pix0.wat.slice(); T.flooded = new Uint8Array(WW * WH);
  T.shoreY0 = Float32Array.from(T.shoreY);
  T.ev.flood = { p: 0, yf: FLOOD.y0 };
  T.ev.pier = true;
  T.ev.banner = { text: 'FLUT!', t: 2.4, col: '#8aeee6' };
  SFX.flood();
}

function paintFloodRows(T, f, yTop, yBot) {
  const WAT = T.th.water.map(hex), b = bctx(T), h = yBot - yTop + 1, img = b.getImageData(0, yTop, WW, h), d = img.data, sd = 53, PIER = FLOOD.pier;
  for (let y = yTop; y <= yBot; y++) {
    for (let x = 0; x < WW; x++) {
      const fc = f.yf + WAVE(x); if (y < fc) continue;
      const j = y * WW + x, k = ((y - yTop) * WW + x) * 4, sy0 = T.shoreY0[x], land = y < sy0;
      if (y - sy0 >= 24) continue;                       // the deep sea stays as it is
      let c;
      if (land && T.dist[j] < PIER) {
        // the pier: planks across the track, dark rim
        T.ter[j] = 1;
        c = T.dist[j] > PIER - 1.6 ? [74, 47, 24] : ((T.near[j] >> 1) & 1) ? [184, 134, 76] : [163, 114, 56];
        if (hash(x, y, sd) < .03) c = [118, 82, 40];
      } else {
        if (land && T.ter[j] === 3 && !T.flooded[j]) continue; // ponds and puddles keep their own look
        if (land) T.ter[j] = 3;
        T.flooded[j] = 1;
        const nv = vnoise(x / 9, y / 9, sd);
        c = y < fc + 3 ? (hash(x, y, sd + 1) < .6 ? [244, 251, 255] : [207, 238, 245]) : nv > .74 ? WAT[3] : nv > .3 ? WAT[2] : WAT[1];
        if (hash(x, y, sd + 2) < .035) T.watPix.push(j);
      }
      d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
    }
  }
  b.putImageData(img, 0, yTop);
  // piles on both sides of the pier
  for (let i = 0; i < T.N; i += 7) {
    const p = T.path[i]; if (p.y < yTop || p.y > yBot || p.y < f.yf + WAVE(p.x) + 4) continue;
    for (const s of [-1, 1]) {
      const x = Math.round(p.x + T.nrm[i].x * s * (PIER + 2)), y = Math.round(p.y + T.nrm[i].y * s * (PIER + 2));
      b.fillStyle = '#3b2512'; b.fillRect(x - 1, y - 1, 3, 3); b.fillStyle = '#8a6440'; b.fillRect(x, y - 1, 1, 1);
    }
  }
  tctx.clearRect(0, yTop, WW, h); // tyre tracks and mud splashes are washed away
}

function updateFlood(T, dt) {
  const ev = T.ev;
  if (!ev.flood && G.player && G.player.lap >= 2) startFlood(T);
  const f = ev.flood; if (!f || f.p >= 1) return;
  const prev = f.yf;
  f.p = Math.min(1, f.p + dt / FLOOD.dur);
  f.yf = FLOOD.y0 - (FLOOD.y0 - FLOOD.y1) * f.p;
  paintFloodRows(T, f, Math.max(0, Math.floor(f.yf - 8)), Math.min(WH - 1, Math.ceil(prev + 8 + 3)));
  for (let x = 0; x < WW; x++) T.shoreY[x] = Math.min(T.shoreY0[x], f.yf + WAVE(x)); // foam lines and waves follow the rising sea
  redrawMini(T);
}

// ======================================================= Strand: beach showers (always on, not an event)

function updateShowers(T, dt) {
  if (!T.showers || !T.showers.length) return;
  for (const s of T.showers) {
    if (s.x < cam.x - 30 || s.x > cam.x + VW + 30 || s.y < cam.y - 10 || s.y > cam.y + VH + 40) continue;
    const n = dt * 40 + Math.random();
    for (let q = 0; q < n && q < 3; q++) addP({ t: 'd', x: s.x + (Math.random() - .5) * 5, y: s.y + (Math.random() - .5) * 3, z: 11 + Math.random() * 2, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 4, vz: 0, col: WATC[(Math.random() * 4) | 0], s: Math.random() < .3 ? 2 : 1, life: 1, ml: 1 });
    if (Math.random() < dt * 2) addP({ t: 'ring', x: s.x, y: s.y, life: .7, ml: .7 });
  }
}

// ======================================================= setup, update, drawing

const INIT = { kuehe: initCows, regen: initRain, flut: initFlood };

export function setupEvents(T) {
  resetAllEvents();
  T.ev = { t: 0, cows: [], holes: [], rain: null, flood: null, pier: false, banner: null };
  for (const name of T.def.events || []) if (eventOn(name)) INIT[name](T);
}

export function updateEvents(dt) {
  const T = G.T; if (!T || T.run) return;
  updateShowers(T, dt);
  const ev = T.ev; if (!ev) return;
  ev.t += dt;
  if (ev.banner) { ev.banner.t -= dt; if (ev.banner.t <= 0) ev.banner = null; }
  if (ev.cows.length) updateCows(T, dt);
  if (ev.holes.length) updateRain(T, dt);
  if (T.def.events && T.def.events.includes('flut') && eventOn('flut')) updateFlood(T, dt);
}

// cows lie on the ground (below the cars); the moo is drawn above
export function drawEventsGround() { const ev = G.T.ev; if (ev) for (const w of ev.cows) drawCow(w); }

export function drawEventsAbove() {
  const ev = G.T.ev; if (!ev) return;
  for (const w of ev.cows) if (w.mooT > 0) text('MUH!', Math.round(w.x), Math.round(w.y - 16 - (1.3 - w.mooT) * 8), 8, '#ffffff', 'center');
}

// banner at the top: the event that just started
export function drawEventsHud() {
  const ev = G.T.ev, b = ev && ev.banner; if (!b) return;
  text(b.text, VW / 2, 34 + Math.round(Math.max(0, b.t - 2.1) * 20), 16, b.col, 'center');
}

// ======================================================= Wald: dusk and headlights

const night = mk(VW, VH), nctx = night.getContext('2d');

// the forest is dark: the picture gets a blue veil and every car cuts light cones out of it
export function drawNight(cx, cy) {
  nctx.globalCompositeOperation = 'source-over'; nctx.clearRect(0, 0, VW, VH);
  nctx.fillStyle = 'rgba(8,14,36,.64)'; nctx.fillRect(0, 0, VW, VH);
  nctx.globalCompositeOperation = 'destination-out';
  for (const c of G.cars) {
    const x = c.x - cx, y = c.y - cy;
    if (x < -90 || x > VW + 90 || y < -90 || y > VH + 90) continue;
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang), nx = -fy, ny = fx;
    // glow around the car, then the beam in four bands
    for (const [r, a] of [[26, .16], [19, .16], [12, .2]]) { nctx.fillStyle = 'rgba(0,0,0,' + a + ')'; nctx.beginPath(); nctx.arc(Math.round(x), Math.round(y), r, 0, TAU); nctx.fill(); }
    for (let k = 0; k < 4; k++) {
      const len = 84 - k * 15, half = 34 - k * 6, sx = x + fx * 8, sy = y + fy * 8;
      nctx.fillStyle = 'rgba(0,0,0,.24)'; nctx.beginPath();
      nctx.moveTo(Math.round(sx + nx * 4), Math.round(sy + ny * 4)); nctx.lineTo(Math.round(sx + fx * len + nx * half), Math.round(sy + fy * len + ny * half));
      nctx.lineTo(Math.round(sx + fx * len - nx * half), Math.round(sy + fy * len - ny * half)); nctx.lineTo(Math.round(sx - nx * 4), Math.round(sy - ny * 4)); nctx.closePath(); nctx.fill();
    }
  }
  ctx.drawImage(night, 0, 0);
}
