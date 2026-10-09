import { G } from './g.js';
import { SFX } from './audio.js';
import { HALF, TAU, VH, VW, WH, WW, clamp, ctx, hash, hex, mk, pick, vnoise } from './core.js';
import { R1, disc, text } from './draw.js';
import { addP, drop, mudBurst, splash, WATC } from './particles.js';
import { cam } from './state.js';
import { PIER, PIER_WAVE, TRACKS, pierColor, tctx } from './tracks.js';
import { drawMarshals, drawTyres, initReifen, tyreCollisions, updateReifen } from './ring.js';
import { desertCollisions, desertUpdate, initDesert, initStorm } from './desert.js';
import { iceCollisions, iceUpdate, initFrost, initIce, initPenguins } from './ice.js';
import { initEruption, initVolcano, volcanoUpdate } from './volcano.js';
import { initCrocs, initJungle, initTrees, jungleCollisions, jungleUpdate } from './jungle.js';

// ---------- track events: the map changes while you race ----------
// Wiese: a herd of cows grazes on and next to the track (they are obstacles, they moo).
// Wald: dark holes in the road; after the first lap the rain fills them with mud. (The dusk and the headlights are not an event.)
// Strand: from lap 2 the tide floods the lower part of the track, only a thin pier stays dry.
// Garten: koi carp leap out of the water and over the bridges and the stepping stones (obstacles while they fly over the track).
// Zug: the train (it can be switched off like the others, then it never comes).
// Rennstrecke: tyres roll across the road (a marshal waves the yellow flag first), hard hits knock tyres out of the tyre walls,
// from lap 2 the oil gets smeared along the road (see ring.js).
// Wueste: from lap 2 a sandstorm (little to see, wind from the right, sand drifts, tumbleweeds; see desert.js).
// Eis: from lap 2 frost (three corners freeze, avalanches); penguins cross the road (see ice.js).
// Vulkan: from lap 2 the eruption (lava bombs, a lava tongue over the serpentine, ash rain; see volcano.js).
// Dschungel: rotten trees fall across the road and stay there as little ramps, from lap 2 a stone ball rolls through the temple;
// crocodiles snap in the ford and the swamp (see jungle.js).
// Every event can be switched off with G.events (see state.js); G.fx switches all of them for the current race (difficulty,
// options, kids mode, see diff.js). A track is changed in place; setupEvents/resetTrackEvents put it back.

export const eventOn = key => !!G.fx && G.events[key] !== false;

// ----- undo: the base picture and the terrain of every changed area are saved first -----

const bctx = T => T.bctx || (T.bctx = T.base.getContext('2d'));

export function snap(T, x, y, w, h) {
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
  koiCollisions();
  truckCollisions();
  tyreCollisions();
  if (G.T.desert) desertCollisions();
  if (G.T.ice) iceCollisions();
  if (G.T.jungle) jungleCollisions();
  const ev = G.T.ev; if (!ev) return;
  for (const w of ev.cows) for (const c of G.cars) {
    if (c.z > 0 || c.fall > 0 || c.ghost > 0) continue;
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

// computer cars steer around cows (and loose tyres on the race circuit, cacti, tumbleweeds and penguins: ev.obst) that are ahead of them
export function steerAround(c, tx, ty) {
  const ev = G.T.ev; if (!ev || !(ev.cows.length || (ev.tyres && ev.tyres.length) || (ev.obst && ev.obst.length))) return [tx, ty];
  const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
  for (const w of ev.cows.concat(ev.tyres || [], ev.obst || [])) {
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

// the rain sets in slowly and then lasts for the rest of the race (its sound is renewed every few seconds)
const rainAlpha = r => clamp(r.t / 1.2, 0, 1);

function updateRain(T, dt) {
  const ev = T.ev;
  if (!ev.rain && G.player && G.player.lap >= 2) { ev.rain = { t: 0, snd: 7 }; SFX.thunder(); SFX.rain(); }
  const r = ev.rain; if (!r) return;
  r.t += dt;
  if ((r.snd -= dt) <= 0) { r.snd = 7; SFX.rain(); }
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
const FLOOD = { y0: 412, y1: PIER.y, dur: 9, pier: PIER.half };
const WAVE = PIER_WAVE; // the same wavy line as the original shore

function initFlood(T) { T.ev.flood = null; }

function startFlood(T) {
  snap(T, 0, FLOOD.y1 - 12, WW, WH - (FLOOD.y1 - 12));
  T.watPix = T.pix0.wat.slice(); T.flooded = new Uint8Array(WW * WH);
  T.shoreY0 = Float32Array.from(T.shoreY);
  T.ev.flood = { p: 0, yf: FLOOD.y0 };
  T.ev.pier = true;
  SFX.flood();
}

function paintFloodRows(T, f, yTop, yBot) {
  const WAT = T.th.water.map(hex), b = bctx(T), h = yBot - yTop + 1, img = b.getImageData(0, yTop, WW, h), d = img.data, sd = 53;
  for (let y = yTop; y <= yBot; y++) {
    for (let x = 0; x < WW; x++) {
      const fc = f.yf + WAVE(x); if (y < fc) continue;
      const j = y * WW + x, k = ((y - yTop) * WW + x) * 4, sy0 = T.shoreY0[x], land = y < sy0;
      if (y - sy0 >= 24) continue;                       // the deep sea stays as it is
      let c;
      if (land && T.dist[j] < FLOOD.pier && T.near[j] >= T.pier[0] && T.near[j] <= T.pier[1]) {
        // the pier: planks across the track, dark rim
        T.ter[j] = 1;
        c = pierColor(T.dist[j], T.near[j], x, y);
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
      const x = Math.round(p.x + T.nrm[i].x * s * (FLOOD.pier + 2)), y = Math.round(p.y + T.nrm[i].y * s * (FLOOD.pier + 2));
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
    for (let q = 0; q < n && q < 3; q++) addP({ t: 'd', x: s.x + (Math.random() - .5) * 11, y: s.y + (Math.random() - .5) * 8, z: 11 + Math.random() * 2, vx: (Math.random() - .5) * 8, vy: (Math.random() - .5) * 6, vz: 0, col: WATC[(Math.random() * 4) | 0], s: Math.random() < .3 ? 2 : 1, life: 1, ml: 1 });
    if (Math.random() < dt * 2) addP({ t: 'ring', x: s.x + (Math.random() - .5) * 14, y: s.y + (Math.random() - .5) * 8, life: .7, ml: .7 });
  }
}

// ======================================================= Garten: leaping koi

// [x, y, direction of the jump (the river's direction), half length, seconds between two jumps, offset]: bridges and stepping stones
const KOIS = [[690, 303, 0, 54, 6.6, 1.2], [500, 403, Math.PI / 2, 54, 7.4, 3.3], [371, 352, 0, 46, 8.2, 5.1], [516, 80, Math.PI / 2, 46, 6.9, 2.4]];
const KOI_DUR = 1.25;

function initKois(T) { T.ev.kois = KOIS.map(([x, y, ang, half, per, off], k) => ({ x, y, ang, half, per, off, p: -1, px: x, py: y, z: 0, k })); }

// the position depends only on the race time: in the time trial every try meets the koi at the same moment
function updateKois(T, dt) {
  for (const f of T.ev.kois) {
    const tt = (T.ev.t + f.off) % f.per, p = tt / KOI_DUR, was = f.p;
    f.p = p < 1 ? p : -1;
    if (f.p < 0) { if (was >= 0) splashAt(f, 1); continue; }
    const u = -f.half + 2 * f.half * f.p;
    f.px = f.x + Math.cos(f.ang) * u; f.py = f.y + Math.sin(f.ang) * u; f.z = Math.sin(Math.PI * f.p) * 18;
    if (was < 0) splashAt(f, -1);
  }
}

function splashAt(f, end) {
  const x = f.x + Math.cos(f.ang) * f.half * end, y = f.y + Math.sin(f.ang) * f.half * end;
  if (Math.hypot(x - cam.x - VW / 2, y - cam.y - VH / 2) > 330) return;
  splash(x, y, 7); if (end < 0) SFX.splash(.2);
}

// is a point (relative to the fish) on one of the fish's pixels? body, tail fin and side fins, like drawKoi paints them
function koiAt(dx, dy, c, sn, s) {
  const lx = (dx * c + dy * sn) / s, ly = (-dx * sn + dy * c) / s;
  return (lx >= -13 && lx <= 11 && Math.abs(ly) <= 4) || (lx >= -18 && lx < -13 && Math.abs(ly) <= 4.5) || (lx >= -3 && lx <= 1 && Math.abs(ly) <= 6);
}

// a koi flying over the road knocks a car off like a cow does
function koiCollisions() {
  const ev = G.T.ev; if (!ev || !ev.kois.length) return;
  for (const f of ev.kois) {
    if (f.p < .1 || f.p > .9) continue;
    // the fish as it is drawn (lifted by its height, tilted, scaled), checked against points all over the car
    const s = 1 + f.z / 40, fx = f.px, fy = f.py - f.z * .7, fa = f.ang + (f.p > .5 ? .25 : -.25) * .5, fc = Math.cos(fa), fs = Math.sin(fa);
    for (const c of G.cars) {
      if (c.z > 0 || c.stun || c.ghost > 0 || c.fall > 0) continue;
      if (Math.hypot(c.x - fx, c.y - fy) > 40) continue;
      const cc = Math.cos(c.ang), cs = Math.sin(c.ang);
      let hit = false;
      for (let u = -15; u <= 15 && !hit; u += 5) for (let v = -9; v <= 9 && !hit; v += 4.5) hit = koiAt(c.x + cc * u - cs * v - fx, c.y + cs * u + cc * v - fy, fc, fs, s);
      if (!hit) continue;
      const dx = c.x - fx, dy = c.y - fy, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
      c.vx = nx * 150; c.vy = ny * 150; c.spin = 12; c.stun = 1.1; c.boost = 0; mudBurst(c, 4);
      SFX.blubb(); setTimeout(SFX.blubb, 110); if (!c.ai) setTimeout(SFX.blubb, 230);
      addP({ t: 'ring', x: f.px, y: f.py, life: .7, ml: .7 });
    }
  }
}

function drawKoi(f) {
  if (f.p < 0) return;
  const s = 1 + f.z / 40, x = Math.round(f.px), y = Math.round(f.py - f.z * .7), wag = Math.sin(G.time * 22 + f.k) * .35;
  ctx.globalAlpha = .28; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(Math.round(f.px + 4), Math.round(f.py + 5), 8, 3.5, f.ang, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(x, y); ctx.rotate(f.ang + (f.p > .5 ? .25 : -.25) * .5); ctx.scale(s, s);
  const R = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(dx, dy, w, h); };
  R(-13, -4, 24, 8, '#1b120c'); R(-12, -3, 22, 6, '#ff7a1a');
  R(-1, -3, 6, 6, '#fff7e8'); R(-7, -2, 4, 3, '#e8452c'); R(5, -3, 5, 6, '#fff7e8'); R(8, -2, 1, 1, '#1b120c');
  ctx.save(); ctx.translate(-12, 0); ctx.rotate(wag); R(-5, -4, 6, 8, '#1b120c'); R(-4, -3, 5, 6, '#ffb35a'); ctx.restore();
  R(-3, 3, 4, 3, '#ffb35a'); R(-3, -6, 4, 3, '#ffb35a');
  ctx.restore();
}

// ======================================================= Baustelle: the dump trucks

// A truck backs up to the road edge from outside (beeping), tips its load next to the road and drives away. The tipping raises a cloud of earth
// that drifts onto the road and makes cars dirty. Everything depends only on the race time, so a time trial repeats it.
const DT = { len: 46, arrive: 2.8, wait: 3.4, up: 4.4, down: 6.6, down2: 7.6, leave: 10.2, cloud0: 4.7, cloud: 6.5 };
const SOIL = ['#4a321d', '#5a3a1f', '#6a4b2e', '#8a6440'];
const ease = x => x * x * (3 - 2 * x);

function initKipper(T) {
  T.ev.kipper = (T.def.kipper || []).map(([x, y, side, per, t0], k) => {
    let bi = 0, bd = 1e12; for (let i = 0; i < T.N; i++) { const dd = (T.path[i].x - x) ** 2 + (T.path[i].y - y) ** 2; if (dd < bd) { bd = dd; bi = i; } }
    const p = T.path[bi], n = T.nrm[bi], tg = T.tan[bi], ox = n.x * side, oy = n.y * side, cx = p.x + ox * (HALF + 3 + DT.len / 2), cy = p.y + oy * (HALF + 3 + DT.len / 2);
    // the truck starts outside of the world, so it drives in from the edge
    let far = 40; while (far < 170) { const qx = cx + ox * far, qy = cy + oy * far; if (qx < -26 || qy < -26 || qx > WW + 26 || qy > WH + 26) break; far += 6; }
    let ang = Math.atan2(oy, ox); const q = Math.round(ang / (Math.PI / 2)) * Math.PI / 2; if (Math.abs(ang - q) < .25) ang = q;
    return { k, per, t0, p, tg, ox, oy, cx, cy, far, ang, last: -1, dist: far, tilt: 0, rem: 1, show: false, cloud: null, piles: 0, beepN: -1 };
  });
}

const near = (x, y) => Math.hypot(x - cam.x - VW / 2, y - cam.y - VH / 2);
const vol = (x, y) => clamp(1 - near(x, y) / 460, 0, 1);

function paintPile(T, s, stage) {
  const horiz = Math.abs(s.tg.x) > Math.abs(s.tg.y), cx = s.p.x + s.ox * (HALF + 11), cy = s.p.y + s.oy * (HALF + 11);
  const along = [13, 17, 21][stage - 1] + s.piles % 2 * 2, across = [7, 10, 12][stage - 1];
  const rx = horiz ? along : across, ry = horiz ? across : along, S4 = SOIL.map(hex);
  snap(T, cx - 28, cy - 28, 56, 56);
  blob(T, cx, cy, rx, ry, 61 + s.k * 7 + s.piles, (rel, x, y) => {
    const lit = ((x - cx) + (y - cy)) / (rx + ry), n = hash(x, y, 71);
    return rel > .84 ? S4[0] : n < .1 ? S4[0] : lit < -.12 ? (n > .85 ? S4[3] : S4[2]) : lit > .22 ? S4[1] : S4[2];
  });
  redrawMini(T);
}

function updateKipper(T, dt) {
  for (const s of T.ev.kipper) {
    const t = T.ev.t - s.t0; if (t < 0) { s.show = false; s.cloud = null; continue; }
    const u = t % s.per, prev = s.last >= 0 && s.last <= u ? s.last : -1, cross = a => prev < a && u >= a;
    s.last = u; s.show = u < DT.leave;
    s.dist = u < DT.arrive ? s.far * (1 - ease(u / DT.arrive)) : u < DT.down2 ? 0 : s.far * ((u - DT.down2) / (DT.leave - DT.down2)) ** 2;
    s.tilt = u < DT.wait ? 0 : u < DT.up ? ease((u - DT.wait) / (DT.up - DT.wait)) : u < DT.down ? 1 : u < DT.down2 ? 1 - ease((u - DT.down) / (DT.down2 - DT.down)) : 0;
    const d0 = DT.up + .3;
    s.rem = u < d0 ? 1 : u < DT.down ? 1 - .96 * (u - d0) / (DT.down - d0) : u < DT.down2 ? .04 : 1;
    const v = vol(s.cx, s.cy);
    if (u < DT.arrive) { const n = Math.floor(u / .55); if (n !== s.beepN) { s.beepN = n; if (v > .02) SFX.beep(v); } } else s.beepN = -1;
    if (cross(DT.wait) && v > .02) SFX.hydr(v);
    if (cross(d0) && v > .02) SFX.dump(v);
    if (cross(DT.up + 1)) paintPile(T, s, 1);
    if (cross(DT.up + 1.9)) paintPile(T, s, 2);
    if (cross(DT.down)) { paintPile(T, s, 3); s.piles++; }
    // the earth pours out at the back
    if (u >= d0 && u < DT.down && s.dist === 0 && near(s.cx, s.cy) < 330) {
      const bx = s.p.x + s.ox * (HALF + 4), by = s.p.y + s.oy * (HALF + 4), back = Math.atan2(-s.oy, -s.ox);
      for (let q = 0, n = dt * 38 + Math.random(); q < n && q < 3; q++) drop(bx + s.tg.x * (Math.random() - .5) * 12, by + s.tg.y * (Math.random() - .5) * 12, back + (Math.random() - .5) * 1.5, 10 + Math.random() * 32, 25 + Math.random() * 50, pick(SOIL), 1.2, Math.random() < .5);
    }
    // the cloud of earth: it grows, drifts across the road edge towards the middle and thins out
    const cu = u - DT.cloud0;
    if (cu >= 0 && cu < DT.cloud) {
      const r = 16 + 30 * Math.min(1, cu / 2.2), a = clamp(cu / .7, 0, 1) * (1 - clamp((cu - 4.2) / 2.3, 0, 1));
      s.cloud = { x: s.p.x + s.ox * (HALF + 2 - cu * 4.2) + s.tg.x * cu * 2, y: s.p.y + s.oy * (HALF + 2 - cu * 4.2) + s.tg.y * cu * 2, r, a };
      for (const c of G.cars) {
        if (c.fall > 0 || c.z > 0 || Math.hypot(c.x - s.cloud.x, c.y - s.cloud.y) > r * .95) continue;
        c.dirt = Math.min(1, c.dirt + 1.1 * a * dt); c.mudTrail = Math.max(c.mudTrail, .8);
      }
    } else s.cloud = null;
  }
}

function truckCollisions() {
  const ev = G.T.ev; if (!ev || !ev.kipper.length) return;
  for (const s of ev.kipper) {
    if (!s.show) continue;
    const tx = s.cx + s.ox * s.dist, ty = s.cy + s.oy * s.dist;
    for (const c of G.cars) {
      if (c.z > 0 || c.fall > 0 || c.ghost > 0) continue;
      for (const q of [-16, 0, 16]) {
        const px = tx + s.ox * q, py = ty + s.oy * q, dx = c.x - px, dy = c.y - py, d = Math.hypot(dx, dy), mn = 18;
        if (d >= mn || d === 0) continue;
        const nx = dx / d, ny = dy / d, vn = c.vx * nx + c.vy * ny;
        c.x = px + nx * mn; c.y = py + ny * mn;
        if (vn < 0) { c.vx -= 1.5 * vn * nx; c.vy -= 1.5 * vn * ny; if (!c.ai && -vn > 35) SFX.bump(); }
      }
    }
  }
}

function drawTruck(s) {
  if (!s.show) return;
  const x = s.cx + s.ox * s.dist, y = s.cy + s.oy * s.dist;
  if (x < cam.x - 50 || x > cam.x + VW + 50 || y < cam.y - 50 || y > cam.y + VH + 50) return;
  ctx.globalAlpha = .25; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(Math.round(x) + 3, Math.round(y) + 4, 24, 12, s.ang, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(s.ang); ctx.scale(1.2, 1.2);
  const R = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(dx, dy, w, h); }, moving = s.dist > 0, tl = s.tilt;
  for (const wx of [11, -3, -12]) { R(wx, -10, 6, 3, '#1b120c'); R(wx, 7, 6, 3, '#1b120c'); }
  R(-19, -5, 38, 10, '#2c2c30');
  // the bed: the front lifts when tipping, so seen from above it gets shorter; the earth slides out at the back
  const fx = 8 - 6 * tl;
  R(-20, -10, fx + 20, 20, '#1b120c'); R(-19, -9, fx + 18, 18, '#f2b81c'); R(-18, -7, fx + 16, 14, '#8a6a10');
  const sl = Math.round((fx + 17) * s.rem);
  if (sl > 1) { R(fx - sl, -7, sl, 14, '#5a3a1f'); R(fx - sl, -7, sl, 4, '#6a4b2e'); R(fx - sl + 2, -2, Math.max(0, sl - 5), 3, '#8a6440'); }
  if (tl > .2) R(-22, -9, 2, 18, '#7a5a1a');
  R(8, -9, 13, 18, '#1b120c'); R(9, -8, 11, 16, '#f2b81c'); R(10, -7, 4, 14, '#ffd75a'); R(16, -7, 3, 14, '#7ec3e8'); R(13, -11, 3, 2, '#1b120c'); R(13, 9, 3, 2, '#1b120c');
  R(11, -1, 3, 3, moving && ((G.time * 5) | 0) % 2 ? '#ff9a1f' : '#8a4a10');
  ctx.restore();
}

function drawDust(s) {
  const c = s.cloud; if (!c || c.a <= 0 || near(c.x, c.y) > 330) return;
  for (let i = 0; i < 22; i++) {
    const a = hash(i, s.k, 11) * TAU + G.time * .3 * (hash(i, s.k, 14) - .5), rr = Math.sqrt(hash(i, s.k, 12)) * c.r * .8, rad = c.r * (.3 + .22 * hash(i, s.k, 13));
    ctx.globalAlpha = .34 * c.a; disc(Math.round(c.x + Math.cos(a) * rr), Math.round(c.y + Math.sin(a) * rr * .85), Math.round(rad), i % 3 ? '#7e5c3a' : '#a07c52');
  }
  ctx.globalAlpha = 1;
}

// ======================================================= Baustelle: the leaking cement mixer (always) and the warning lamps

function updateMixer(T, dt) {
  const m = T.mixer; if (!m || near(m.cx, m.cy) > 330) return;
  if (Math.random() < dt * 9) addP({ t: 'd', x: m.cx + (Math.random() - .5) * 2, y: m.cy + 1, z: 5, vx: -3 - Math.random() * 3, vy: 1 + Math.random() * 2, vz: 0, col: Math.random() < .5 ? '#9aa0a6' : '#c0c5ca', s: Math.random() < .3 ? 2 : 1, life: .5, ml: .5 });
}

// the drum of the mixer turns (stripes run around it)
function drawMixer(T) {
  const m = T.mixer; if (!m || near(m.x, m.y + 31) > 300) return;
  const cx = m.x, cy = m.y + 31;
  for (let dy = -19; dy <= 19; dy++) {
    const w = Math.round(8.5 * Math.sqrt(1 - (dy / 19.6) ** 2));
    for (let dx = -w; dx <= w; dx++) {
      const stripe = Math.floor((dy + dx * 1.3 + G.time * 12) / 5) & 1, edge = Math.abs(dx) >= w, lit = dx < -2;
      ctx.fillStyle = edge ? '#1b120c' : stripe ? (lit ? '#ff9a4a' : '#e8742a') : (lit ? '#fffaf0' : '#e6dcc6');
      ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }
  ctx.fillStyle = '#1b120c'; ctx.fillRect(cx - 3, cy - 20, 7, 2); ctx.fillStyle = '#8d939d'; ctx.fillRect(cx - 2, cy - 21, 5, 2);
}

function drawLights(T) {
  for (const L of T.lights || []) {
    if (near(L.x, L.y) > 330) continue;
    const on = ((G.time * 2.2 - L.k * .3) % 1 + 1) % 1 < .5, x = Math.round(L.x), y = Math.round(L.y);
    ctx.fillStyle = '#1b120c'; ctx.fillRect(x - 2, y - 2, 5, 5); ctx.fillStyle = on ? '#ffb22e' : '#7a4a10'; ctx.fillRect(x - 1, y - 1, 3, 3);
    if (on) { ctx.globalAlpha = .3; disc(x, y, 8, '#ffb22e'); ctx.globalAlpha = .25; disc(x, y, 4, '#fff1a8'); ctx.globalAlpha = 1; }
  }
}

// ======================================================= setup, update, drawing

const INIT = { kuehe: initCows, regen: initRain, flut: initFlood, kois: initKois, kipper: initKipper, reifen: initReifen, zug: () => {}, sandsturm: initStorm, frost: initFrost, pinguine: initPenguins, ausbruch: initEruption, baeume: initTrees, kroko: initCrocs };

export function setupEvents(T) {
  resetAllEvents();
  T.ev = { t: 0, cows: [], holes: [], rain: null, flood: null, pier: false, kois: [], kipper: [] };
  // the desert and the ice have things that are always there (cacti, cracking lake ice) besides their events
  if (T.desert) initDesert(T);
  if (T.ice) initIce(T);
  if (T.volcano) initVolcano(T);
  if (T.jungle) initJungle(T);
  for (const name of T.def.events || []) if (eventOn(name)) INIT[name](T);
}

export function updateEvents(dt) {
  const T = G.T; if (!T || T.run) return;
  updateShowers(T, dt);
  updateMixer(T, dt);
  const ev = T.ev; if (!ev) return;
  ev.t += dt;
  if (T.desert) desertUpdate(T, dt);
  if (T.ice) iceUpdate(T, dt);
  if (T.volcano) volcanoUpdate(T, dt);
  if (T.jungle) jungleUpdate(T, dt);
  if (ev.cows.length) updateCows(T, dt);
  if (ev.holes.length) updateRain(T, dt);
  if (ev.kois.length) updateKois(T, dt);
  if (ev.kipper.length) updateKipper(T, dt);
  if (ev.rollers && ev.rollers.length) updateReifen(T, dt);
  if (T.def.events && T.def.events.includes('flut') && eventOn('flut')) updateFlood(T, dt);
}

// cows, trucks and the mixer drum lie on the ground (below the cars); the moo, the dust cloud and the lamps are drawn above
export function drawEventsGround() {
  const T = G.T; drawMixer(T);
  const ev = T.ev; if (ev) { for (const w of ev.cows) drawCow(w); for (const s of ev.kipper) drawTruck(s); if (ev.tyres) drawTyres(ev); }
}

export function drawEventsAbove() {
  const T = G.T; drawLights(T);
  const ev = T.ev; if (!ev) return;
  for (const f of ev.kois) drawKoi(f);
  for (const s of ev.kipper) drawDust(s);
  if (ev.rollers) drawMarshals(ev);
  for (const w of ev.cows) if (w.mooT > 0) text('MUH!', Math.round(w.x), Math.round(w.y - 16 - (1.3 - w.mooT) * 8), 8, '#ffffff', 'center');
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
