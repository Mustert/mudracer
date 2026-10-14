import { G } from './g.js';
import { SFX, noise, voice } from './audio.js';
import { LAPS, TAU, VH, VW, clamp, ctx, hash, mk } from './core.js';
import { R1, disc, ell, text } from './gfx.js';
import { nearObstacles } from './grid.js';
import { addP, drop } from './particles.js';
import { cam } from './state.js';
import { near } from './trackfx.js';
import { tctx } from './tracks.js';

// ---------- Süßigkeitenland while racing ----------
// Always: caramel (terrain 2 where T.suess.cara is set) brakes like mud and makes the car golden; after you leave it, it sticks for another
// 1 s / mud (the car is slower and drags golden threads that stretch and snap). The gummy-bear trampolines throw every car equally high (the
// speed only decides how far; see suessmap.js, trackfx.js `airborne`). The candyfloss walls are soft (update.js `bob`), a scrap of floss stays
// on the car for a moment. Bubblegum bubbles grow out of the pink spots (solid, you bounce off softly) and burst after 3 s with a PLOPP:
// whoever stands next to it gets pink scraps and sticks for 0.5 s. The chocolate river and lake are deep: you fall in and come out brown with
// a blob of cream on top. The fizz pads push (boost), the lemonade fountain washes and leaves the car glittering.
// Event "schoko": from lap 2 three chocolate streams run one after the other from the lake over the road and stay there (flat chocolate, like
// mud, brown); in the last lap it rains sprinkles, the ones that land on the chocolate stay there.
// Event "zuckerwatte": pink candyfloss clouds drift over the map and hide what is under them (you can drive through); from lap 2 more of them,
// and the candyfloss machine at the edge puffs out new ones. The computer cars see through them (on LEICHT they go slower under them).

const BUB = { rest: 2.6, grow: 3, max: 14, cyc: 6.6, stick: .5 }, CLOUD = { lap1: 3, lap2: 6, most: 8, every: 5 };
const STREAM = { speed: 42, gap: 7 };
const inView = (x, y, m = 40) => x > cam.x - m && x < cam.x + VW + m && y > cam.y - m && y < cam.y + VH + m;
const lastLap = () => !!G.player && G.player.lap >= LAPS;
const smooth = f => f * f * (3 - 2 * f);
const loud = (c, m = 300) => c.ai ? clamp(1 - near(c.x, c.y) / m, 0, .45) : 1;
const SPR = ['#ff4d6d', '#ffd93d', '#6bcb77', '#4d96ff', '#9b5de5', '#ffffff', '#ff9f43'];
const GOLD = ['#e0a030', '#f0bc48', '#ffe08a', '#d08c20'], CHOC = ['#5a3020', '#4a2618', '#6a3a26', '#9a5a3a'];

// the sounds of the sweets (synthesised like all the others, see audio.js)
export const SX = {
  // the trampoline: a rubbery squeak and a wobble
  boing: v => { voice({ type: 'triangle', f: 700, to: 1500, a: .004, d: .14, vol: .09 * v }); for (let k = 0; k < 5; k++) voice({ t: .03 + k * .06, f: 200 + (k % 2) * 60, to: 170 + (k % 2) * 40, a: .005, d: .07, vol: .14 * v * (1 - k * .17) }); },
  // caramel threads: a stretched creak
  stretch: v => voice({ type: 'sawtooth', f: 150, to: 92, a: .05, hold: .25, d: .25, vol: .05 * v, lp: 800 }),
  // fizz (pads, lemonade): sparkling bubbles
  fizz: v => { noise({ type: 'highpass', f: 4200, a: .01, hold: .2, d: .35, vol: .08 * v }); for (let k = 0; k < 6; k++) { const f = 1800 + Math.random() * 2400; voice({ t: Math.random() * .4, f, to: f * 1.6, a: .002, d: .03, vol: .04 * v }); } },
  // a big plop into the chocolate
  choc: v => { noise({ type: 'lowpass', f: 900, to: 140, d: .45, vol: .4 * v, q: 2 }); voice({ f: 95, to: 40, d: .35, vol: .3 * v }); for (let k = 0; k < 4; k++) voice({ t: .12 + k * .09, f: 140 + Math.random() * 80, to: 300, a: .004, d: .07, vol: .12 * v }); },
  // the chocolate fountain overflows: deep glugs
  schoko: () => { for (let k = 0; k < 5; k++) { voice({ t: k * .22, f: 120 - k * 8, to: 55, a: .01, d: .18, vol: .22 }); noise({ t: k * .22, type: 'lowpass', f: 500, d: .15, vol: .12 }); } },
  // the candyfloss machine puffs
  puff: v => noise({ type: 'bandpass', f: 900, to: 300, a: .05, hold: .2, d: .3, vol: .1 * v, q: 1.2 }),
  // sprinkles start to fall: a glittering run
  sprinkle: () => { for (let k = 0; k < 8; k++) voice({ t: k * .05, f: 1568 * Math.pow(2, k / 12 * 2), a: .002, d: .2, vol: .04 }); },
};

export function initSuess(T) {
  const ev = T.ev, S = T.suess;
  ev.bubbles = S.gum.map(([x, y], k) => ({ x, y, t: (k * 2.9) % BUB.cyc, r: 0, pop: 0 }));
  ev.obst = []; ev.pops = []; ev.msg = null; ev.schoko = null; ev.watte = null; ev.sprinkle = false;
  // the chocolate of the last race is gone again
  S.chocoM.fill(0);
  for (const st of S.streams) {
    for (let q = 0; q < st.n; q++) T.ter[st.idx[q]] = st.ter0[q];
    st.k = 0; st.front = -1;
    if (!st.c) { st.c = mk(st.w, st.h); st.g = st.c.getContext('2d'); }
    st.g.clearRect(0, 0, st.w, st.h);
  }
  for (const J of T.jumps) { J.sq = 0; J.snd = v => { J.sq = .45; SX.boing(v); }; }
}

export function initSchoko(T) { T.ev.schoko = { t: -1 }; }

export function initWatte(T) {
  const ev = T.ev; ev.watte = { clouds: [], n: 0, next: 4, puffT: 0 };
  for (let k = 0; k < CLOUD.lap1; k++) ev.watte.clouds.push(newCloud(T, ev.watte.n++, null));
}

// a candyfloss cloud: somewhere on the map, or out of the machine; they all drift slowly to the left
function newCloud(T, n, from) {
  const r = 26 + hash(n, 1, 170) * 14;
  if (from) return { x: from[0] - 14, y: from[1], r, vx: -(9 + hash(n, 2, 170) * 5), vy: (hash(n, 3, 170) - .5) * 6, k: n, grow: 0 };
  return { x: 80 + hash(n, 4, 170) * (T.W - 160), y: 60 + hash(n, 5, 170) * (T.H - 120), r, vx: -(8 + hash(n, 2, 170) * 6), vy: (hash(n, 3, 170) - .5) * 6, k: n, grow: 1 };
}

// ======================================================= every frame

export function suessUpdate(T, dt) {
  const ev = T.ev, S = T.suess;
  for (const J of T.jumps) J.sq = Math.max(0, J.sq - dt);
  // bubblegum: rest, grow for 3 s, burst
  for (const b of ev.bubbles) {
    const g0 = b.t - BUB.rest; b.t += dt; if (b.t >= BUB.cyc) b.t -= BUB.cyc;
    const g = b.t - BUB.rest; b.r = g > 0 && g < BUB.grow ? BUB.max * smooth(g / BUB.grow) : 0;
    b.pop = Math.max(0, b.pop - dt);
    if (g0 < BUB.grow && g >= BUB.grow) {
      b.pop = .6; ev.pops.push({ x: b.x, y: b.y, t: .9 });
      for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; addP({ t: 'gum', x: b.x + Math.cos(a) * 10, y: b.y + Math.sin(a) * 10, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: .45, ml: .45 }); }
      for (const c of G.cars) if (c.fall <= 0 && c.z <= 0 && Math.hypot(c.x - b.x, c.y - b.y) < BUB.max + 14) c.gumT = BUB.stick;
      const d = near(b.x, b.y); if (d < 320) SFX.plopp();
    }
  }
  ev.pops = ev.pops.filter(p => (p.t -= dt) > 0);
  if (ev.msg && (ev.msg.t -= dt) <= 0) ev.msg = null;
  for (const c of G.cars) {
    // into the chocolate: it comes out brown (with cream on top)
    if (c.fall > 0 && !c.fallKind) {
      if (!c.choc) {
        c.choc = true; c.dirt = 1; c.cem = false; c.stickT = 0; c.thread = null; c.inCara = false;
        for (let k = 0; k < 18; k++) drop(c.x, c.y, Math.random() * TAU, 30 + Math.random() * 60, 60 + Math.random() * 60, CHOC[k % 4], 1, false);
        if (loud(c) > .02) SX.choc(loud(c));
      }
      c.dirt = 1;
    } else if (c.choc) { c.choc = false; c.cream = 2.5; }
    for (const k of ['cream', 'flossT', 'glitT', 'gumT']) if (c[k] > 0) c[k] = Math.max(0, c[k] - dt);
  }
  if (ev.schoko) updateSchoko(T, dt);
  if (ev.watte) updateWatte(T, dt);
  // the computer cars steer round growing bubbles
  ev.obst = ev.bubbles.filter(b => b.r > 3 || (b.t > BUB.rest - .6 && b.t < BUB.rest));
  // the sprinkles of the last lap fall and stay on the chocolate
  for (const p of G.parts) if (p.t === 'spr') {
    p.z -= 90 * dt;
    if (p.z <= 0) {
      p.life = 0; const x = p.x | 0, y = p.y | 0; if (x < 0 || y < 0 || x >= T.W || y >= T.H) continue;
      const j = y * T.W + x; if (T.ter[j] === 2 && S.chocoM[j]) { tctx.globalAlpha = 1; tctx.fillStyle = p.col; tctx.fillRect(x, y, p.v ? 1 : 2, p.v ? 2 : 1); }
    }
  }
  S.fountainT = (S.fountainT || 0) + dt;
  // the chocolate fountain and the lemonade fountain splash (only near the screen)
  const [fx, fy] = S.lake; if (inView(fx, fy, 60) && Math.random() < dt * 25) { const a = Math.random() * TAU; addP({ t: 'd', x: fx + Math.cos(a) * 4, y: fy + Math.sin(a) * 3, z: 22, vx: Math.cos(a) * 28, vy: Math.sin(a) * 18, vz: 20, col: CHOC[(Math.random() * 4) | 0], s: 2, life: 1.2, ml: 1.2 }); }
  const [lx, ly] = S.lemon; if (inView(lx, ly, 60)) for (let q = 0; q < 2; q++) { const a = Math.random() * TAU, rr = 10 + Math.random() * 22; addP({ t: 'd', x: lx, y: ly, z: 16, vx: Math.cos(a) * rr * 1.6, vy: Math.sin(a) * rr, vz: 40 + Math.random() * 30, col: ['#fff27a', '#ffffff', '#ffe85a', '#fff8b8'][q * 2 + (Math.random() < .5 ? 1 : 0)], s: 1, life: 1.2, ml: 1.2 }); }
}

// the ground under a car (from update.js): caramel sticks, gum holds, candyfloss scraps, fizz, lemonade
export function suessGround(c, j, sp, dt) {
  const T = G.T, S = T.suess, fx = Math.cos(c.ang), fy = Math.sin(c.ang), v = loud(c);
  const inCara = c.surf === 2 && !!S.cara[j] && !S.chocoM[j];
  if (c.surf === 2) c.cem = inCara; // golden (the second set, see race.js) or brown
  if (inCara) {
    if (!c.inCara && sp > 25 && v > .02) SFX.mud(v * .7);
    c.inCara = true; c.caraT = 1 / c.def.mud; c.thread = null;
    if (sp > 20 && Math.random() < dt * 25) drop(c.x - fx * 12, c.y - fy * 12, c.ang + Math.PI + (Math.random() - .5), 20 + Math.random() * 30, 30 + Math.random() * 30, GOLD[(Math.random() * 4) | 0], .7, true);
  } else if (c.inCara) {
    // out of the caramel: it still holds on for a moment, golden threads stretch behind the car
    c.inCara = false; c.stickT = c.caraT || 1; c.stick0 = c.stickT; c.thread = { x: c.x - fx * 12, y: c.y - fy * 12 };
    if (v > .02) SX.stretch(v);
  }
  if (c.stickT > 0) {
    c.stickT -= dt; const k = 3.2 * Math.min(1, c.stickT / Math.max(.1, c.stick0) * 1.6);
    c.vx *= Math.exp(-k * dt); c.vy *= Math.exp(-k * dt);
    const th = c.thread;
    if (th && (c.stickT <= 0 || Math.hypot(c.x - th.x, c.y - th.y) > 70)) {
      for (let q = 0; q < 8; q++) addP({ t: 'd', x: th.x + (c.x - th.x) * q / 8, y: th.y + (c.y - th.y) * q / 8, z: 3, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, vz: 20, col: GOLD[q % 4], s: 1, life: .6, ml: .6 });
      c.thread = null; if (v > .02) SFX.snap();
    }
  }
  // stuck in bubblegum
  if (c.gumT > 0) { c.vx *= Math.exp(-11 * dt); c.vy *= Math.exp(-11 * dt); }
  // candyfloss: touching the soft wall leaves a scrap on the car
  if (sp > 20) for (const o of nearObstacles(T.grid, c.x, c.y)) {
    if (!o.floss || Math.hypot(c.x - o.x, c.y - o.y) > o.r + 11) continue;
    if (!(c.flossT > 0) && v > .02) SFX.plopp();
    c.flossT = 1.2; break;
  }
  // fizz pads: fizzing when you hit one, bubbles while the boost lasts
  if (c.surf === 4 && c.lastSurf !== 4 && v > .02) SX.fizz(v);
  if (c.boost > 0 && Math.random() < dt * 30) addP({ t: 'fizz', x: c.x - fx * 14 + (Math.random() - .5) * 10, y: c.y - fy * 14 + (Math.random() - .5) * 10, vx: (Math.random() - .5) * 20, vy: -10 - Math.random() * 20, life: .7, ml: .7, col: SPR[(Math.random() * 7) | 0] });
  // the lemonade: fizz when you drive in, glitter when you come out
  if (c.washing && !c.lemIn) { c.lemIn = true; if (v > .02) SX.fizz(v * .8); }
  else if (!c.washing && c.lemIn) { c.lemIn = false; c.glitT = 1.6; }
  // the computer cars see through the candyfloss, but on LEICHT they go slower under it
  if (c.ai && c.inCloud && !(G.raceDiff > 0)) { c.vx *= Math.exp(-.7 * dt); c.vy *= Math.exp(-.7 * dt); }
  c.lastSurf = c.surf;
}

// the bubbles are solid while they grow: a soft bounce
export function suessCollisions() {
  const ev = G.T.ev; if (!ev || !ev.bubbles) return;
  for (const b of ev.bubbles) {
    if (b.r < 3) continue;
    for (const c of G.cars) {
      if (c.fall > 0 || c.z > 0 || c.ghost > 0) continue;
      const dx = c.x - b.x, dy = c.y - b.y, d = Math.hypot(dx, dy), mn = b.r + 9; if (d >= mn || d < .01) continue;
      const nx = dx / d, ny = dy / d, vn = c.vx * nx + c.vy * ny;
      c.x = b.x + nx * mn; c.y = b.y + ny * mn;
      if (vn < 0) { c.vx -= 1.25 * vn * nx; c.vy -= 1.25 * vn * ny; if (!c.ai && -vn > 30) SX.boing(.5); }
    }
  }
}

// ======================================================= event "schoko"

function updateSchoko(T, dt) {
  const ev = T.ev, sc = ev.schoko, S = T.suess;
  if (sc.t < 0) {
    if (!G.player || G.player.lap < 2) return;
    sc.t = 0; ev.msg = { s: 'SCHOKOLADE!', col: '#c8885a', t: 2.6 }; SX.schoko();
  }
  sc.t += dt;
  S.streams.forEach((st, k) => {
    const t0 = k * STREAM.gap; if (sc.t < t0 || st.k >= st.n) return;
    st.front = (sc.t - t0) * STREAM.speed;
    while (st.k < st.n && st.al[st.k] <= st.front) {
      const j = st.idx[st.k], q = st.k * 3; T.ter[j] = 2; S.chocoM[j] = 1;
      st.g.fillStyle = 'rgb(' + st.col[q] + ',' + st.col[q + 1] + ',' + st.col[q + 2] + ')'; st.g.fillRect(j % T.W - st.x0, (j / T.W | 0) - st.y0, 1, 1);
      st.k++;
    }
    // where the chocolate runs, it bubbles at its front
    if (st.k < st.n && Math.random() < dt * 12) { const j = st.idx[Math.max(0, st.k - 1 - ((Math.random() * 40) | 0))]; addP({ t: 'd', x: j % T.W, y: j / T.W | 0, z: 2, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, vz: 30, col: CHOC[(Math.random() * 4) | 0], s: 2, life: .6, ml: .6 }); }
  });
  // the last lap: sprinkles rain over the map
  if (lastLap()) {
    if (!ev.sprinkle) { ev.sprinkle = true; ev.msg = { s: 'STREUSELREGEN!', col: '#ff9ac8', t: 2.4 }; SX.sprinkle(); }
    for (let q = 0; q < 3; q++) if (Math.random() < dt * 25) addP({ t: 'spr', x: cam.x + Math.random() * VW, y: cam.y + Math.random() * VH, z: 50 + Math.random() * 40, col: SPR[(Math.random() * 7) | 0], v: Math.random() < .5, life: 3, ml: 3 });
  }
}

// ======================================================= event "zuckerwatte"

function updateWatte(T, dt) {
  const W = T.ev.watte, lap2 = !!G.player && G.player.lap >= 2;
  for (const cl of W.clouds) {
    cl.x += cl.vx * dt; cl.y += cl.vy * dt; cl.grow = Math.min(1, cl.grow + dt / 2);
    if (cl.y < 40 || cl.y > T.H - 40) cl.vy = -cl.vy;
    // off the map on the left: it comes back on the right (in lap 1), from lap 2 the machine makes new ones
    if (cl.x < -cl.r - 30) { if (lap2) cl.dead = true; else { cl.x = T.W + cl.r + 20; cl.y = 60 + hash(W.n++, 5, 170) * (T.H - 120); } }
  }
  W.clouds = W.clouds.filter(cl => !cl.dead);
  W.puffT = Math.max(0, W.puffT - dt);
  if (lap2) {
    W.next -= dt;
    if (W.next <= 0 && W.clouds.length < CLOUD.most) {
      W.next = W.clouds.length < CLOUD.lap2 ? CLOUD.every * .5 : CLOUD.every;
      W.clouds.push(newCloud(T, W.n++, T.suess.machine)); W.puffT = .8;
      if (near(T.suess.machine[0], T.suess.machine[1]) < 360) SX.puff(1);
    }
  }
  for (const c of G.cars) c.inCloud = W.clouds.some(cl => Math.hypot(c.x - cl.x, c.y - cl.y) < cl.r * cl.grow * .85);
}

// ======================================================= drawing

// a gummy bear lying across the road (the trampoline): head, ears, belly; it squashes when a car jumps off it
function drawTramp(J) {
  const nx = -J.ty, ny = J.tx, sq = J.sq > 0 ? Math.sin(J.sq * 30) * J.sq * 3 : 0, col = J.bear, x0 = J.x, y0 = J.y;
  const at = (o, a) => [Math.round(x0 + nx * o + J.tx * a), Math.round(y0 + ny * o + J.ty * a)];
  ctx.globalAlpha = .25; for (let o = -24; o <= 24; o += 4) { const [x, y] = at(o, 0); disc(x + 3, y + 4, 9, '#5a1a2a'); } ctx.globalAlpha = 1;
  // body along the road's width, the head on one side, the feet on the other
  for (let o = -10; o <= 14; o += 3) { const [x, y] = at(o, 0); disc(x, y, Math.round(12 + sq - Math.abs(o - 2) / 5), col); }
  const [hx, hy] = at(-18, 0); disc(hx, hy, Math.round(10 + sq), col);
  for (const s of [-1, 1]) { const [ex, ey] = at(-26, s * 7); disc(ex, ey, 4, col); const [fx, fy] = at(24, s * 8); disc(fx, fy, 5, col); const [ax, ay] = at(-4, s * 14); disc(ax, ay, 4, col); }
  ctx.globalAlpha = .45; for (let o = -8; o <= 10; o += 4) { const [x, y] = at(o, -4); disc(x, y, 5, '#ffffff'); } const [qx, qy] = at(-21, -3); disc(qx, qy, 4, '#ffffff'); ctx.globalAlpha = 1;
  for (const s of [-1, 1]) { const [ex, ey] = at(-20, s * 4); R1(ex, ey, 2, 2, '#3a1020'); }
  const [mx, my] = at(-13, 0); R1(mx - 1, my, 3, 1, '#3a1020');
}

// on the ground (under the cars): the chocolate streams, glossy glints, the trampolines, the caramel threads
export function drawSuessGround() {
  const T = G.T, S = T.suess, k = Math.floor(G.time * 5);
  for (const st of S.streams) if (st.k > 0) ctx.drawImage(st.c, st.x0, st.y0);
  for (let q = 0; q < 14 && S.caraPix.length; q++) { const p = S.caraPix[(hash(q, k, 171) * S.caraPix.length) | 0]; R1(p % T.W, (p / T.W) | 0, 2, 1, '#fff2c0'); }
  for (let q = 0; q < 14 && S.chocPix.length; q++) { const p = S.chocPix[(hash(q, k, 172) * S.chocPix.length) | 0]; R1(p % T.W, (p / T.W) | 0, 2, 1, '#a87452'); }
  for (let q = 0; q < 10 && S.lemPix.length; q++) { const p = S.lemPix[(hash(q, k, 173) * S.lemPix.length) | 0]; R1(p % T.W, (p / T.W) | 0, 1, 1, '#ffffff'); }
  // ripples round the chocolate fountain
  const [fx, fy] = S.lake;
  if (inView(fx, fy, 60)) for (let q = 0; q < 3; q++) { const r = 22 + ((S.fountainT || 0) * 8 + q * 8) % 24; ctx.globalAlpha = .5 * (1 - (r - 22) / 24); for (let a = 0; a < 28; a++) { const an = a / 28 * TAU; R1(Math.round(fx + Math.cos(an) * r), Math.round(fy + 6 + Math.sin(an) * r * .55), 2, 1, '#8a5a3a'); } } ctx.globalAlpha = 1;
  for (const J of T.jumps) if (inView(J.x, J.y)) drawTramp(J);
  // golden threads from the caramel to the car: they sag and get thinner as they stretch
  for (const c of G.cars) {
    const th = c.thread; if (!th || !(c.stickT > 0) || c.fall > 0) continue;
    const fx2 = Math.cos(c.ang), fy2 = Math.sin(c.ang), d = Math.hypot(c.x - th.x, c.y - th.y);
    for (const s of [-6, 0, 6]) {
      const ex = c.x - fx2 * 12 - fy2 * s, ey = c.y - fy2 * 12 + fx2 * s, n = Math.max(2, Math.round(d / 2)), sag = Math.min(7, d * .12);
      ctx.globalAlpha = clamp(1.2 - d / 70, .35, 1);
      for (let q = 0; q <= n; q++) { const f = q / n, x = th.x + s * .3 + (ex - th.x) * f, y = th.y + (ey - th.y) * f + Math.sin(f * Math.PI) * sag; R1(Math.round(x), Math.round(y), 1, 1, q % 3 ? '#f0bc48' : '#ffe08a'); }
    }
    ctx.globalAlpha = 1;
  }
}

function drawCloud(cl) {
  const g = cl.grow, R = cl.r * g; if (R < 2) return;
  const parts = [[0, 0, 1], [-.55, .1, .7], [.55, .05, .72], [-.25, -.4, .62], [.3, -.38, .6], [0, .35, .7]];
  ctx.globalAlpha = .5; for (const [ox, oy, s] of parts) disc(Math.round(cl.x + ox * R), Math.round(cl.y + oy * R + 6), Math.round(R * s), '#e080a8');
  ctx.globalAlpha = 1; for (const [ox, oy, s] of parts) disc(Math.round(cl.x + ox * R), Math.round(cl.y + oy * R), Math.round(R * s), '#ffb8d6');
  for (const [ox, oy, s] of parts) disc(Math.round(cl.x + ox * R - R * .12), Math.round(cl.y + oy * R - R * .12), Math.round(R * s * .7), '#ffd2e6');
  disc(Math.round(cl.x - R * .3), Math.round(cl.y - R * .45), Math.round(R * .3), '#fff0f7');
  for (let q = 0; q < 10; q++) { const a = hash(cl.k, q, 174) * TAU, d = R * (.2 + hash(q, cl.k, 175) * .7); R1(Math.round(cl.x + Math.cos(a) * d), Math.round(cl.y + Math.sin(a) * d), 1, 1, '#ffffff'); }
}

// above the cars: the bubbles, the fountains, gummy bears and gingerbread men, what sticks to the cars, sprinkles, the clouds
export function drawSuessAbove() {
  const T = G.T, S = T.suess, ev = T.ev;
  // the chocolate fountain in the lake: three tiers, chocolate runs down in curtains
  const [fx, fy] = S.lake;
  if (inView(fx, fy, 60)) {
    ctx.globalAlpha = .3; ell(fx + 4, fy + 8, 20, 9, '#1a0a04'); ctx.globalAlpha = 1;
    for (const tier of [[4, 18, '#4a2615', '#6a3a24'], [-6, 12, '#56301c', '#7a4a2e'], [-14, 7, '#6a3a24', '#8a5a3a']]) {
      const [dy, r, col, col2] = /** @type {[number, number, string, string]} */ (tier);
      ell(fx, fy + dy, r, Math.round(r * .5), '#e8c070'); ell(fx, fy + dy - 1, r - 1, Math.round(r * .45), col);
      for (let q = 0; q < 10; q++) { const a = q / 10 * TAU + (S.fountainT || 0) * 2; R1(Math.round(fx + Math.cos(a) * (r - 2)), Math.round(fy + dy + Math.sin(a) * r * .4 + ((S.fountainT * 20 + q * 3) % 4)), 1, 3, col2); }
    }
    disc(fx, fy - 20, 3, '#e8c070'); R1(fx - 1, fy - 26, 2, 6, '#8a5a3a');
  }
  // the lemonade fountain: the spout glitters
  const [lx, ly] = S.lemon; if (inView(lx, ly) && ((G.time * 6) | 0) % 2) { R1(lx - 1, ly - 9, 3, 3, '#ffffff'); }
  // the ice cream lanterns glow
  for (const L of S.lamps) if (inView(L.x, L.y)) { ctx.globalAlpha = .25 + .1 * Math.sin(G.time * 3 + L.x); disc(L.x, L.y, 6, L.col); ctx.globalAlpha = 1; disc(L.x, L.y + 1, 3, L.col); R1(L.x - 1, L.y - 1, 1, 1, '#ffffff'); }
  // gummy bears (some hop on the spot) and gingerbread men that wave
  for (const b of S.bears) {
    if (!inView(b.x, b.y)) continue;
    const hop = b.hop ? Math.round(Math.abs(Math.sin(G.time * 4 + b.ph)) * 4) : 0, x = b.x, y = b.y - hop;
    ctx.globalAlpha = .25; ell(x + 2, b.y + 5, 4, 2, '#5a1a2a'); ctx.globalAlpha = 1;
    disc(x, y + 1, 3, b.col); disc(x, y - 3, 2, b.col); R1(x - 3, y - 5, 2, 2, b.col); R1(x + 2, y - 5, 2, 2, b.col); R1(x - 4, y, 2, 2, b.col); R1(x + 3, y, 2, 2, b.col);
    ctx.globalAlpha = .5; R1(x - 1, y - 4, 1, 1, '#ffffff'); R1(x - 1, y, 1, 2, '#ffffff'); ctx.globalAlpha = 1; R1(x - 1, y - 3, 1, 1, '#3a1020'); R1(x + 1, y - 3, 1, 1, '#3a1020');
  }
  for (const m of S.men) {
    if (!inView(m.x, m.y)) continue;
    const x = m.x, y = m.y, w = ((G.time * 3 + m.ph) | 0) % 2, B = '#b8743a', D = '#7a4620', Wt = '#ffffff';
    ctx.globalAlpha = .25; ell(x + 3, y + 8, 6, 2, '#3a1a10'); ctx.globalAlpha = 1;
    disc(x, y - 7, 3, B); R1(x - 3, y - 4, 7, 8, B); R1(x - 4, y + 4, 3, 4, B); R1(x + 2, y + 4, 3, 4, B);
    R1(x - 6, y - 3, 3, 2, B); if (w) R1(x + 4, y - 7, 2, 4, B); else R1(x + 4, y - 3, 3, 2, B); // one arm waves
    R1(x - 1, y - 8, 1, 1, D); R1(x + 1, y - 8, 1, 1, D); R1(x - 1, y - 6, 3, 1, Wt); R1(x, y - 2, 1, 1, '#ff4d6d'); R1(x, y + 1, 1, 1, '#6bcb77'); R1(x - 3, y + 7, 3, 1, Wt); R1(x + 2, y + 7, 3, 1, Wt);
  }
  // the candyfloss machine: the drum turns, it puffs when it makes a cloud
  const [mx, my] = S.machine;
  if (inView(mx, my)) { for (let q = 0; q < 6; q++) { const a = G.time * 6 + q * TAU / 6; R1(Math.round(mx + Math.cos(a) * 5), Math.round(my + Math.sin(a) * 5), 2, 2, q % 2 ? '#ff7ab8' : '#ffffff'); } if (ev.watte && ev.watte.puffT > 0) { ctx.globalAlpha = ev.watte.puffT; disc(mx - 16, my, Math.round(6 + (1 - ev.watte.puffT) * 10), '#ffd2e6'); ctx.globalAlpha = 1; } }
  // bubblegum bubbles: pink, glossy, they wobble; PLOPP when they burst
  for (const b of ev.bubbles || []) {
    if (!inView(b.x, b.y)) continue;
    if (b.r >= 1) {
      const r = Math.round(b.r + Math.sin(G.time * 9 + b.x) * .8), x = Math.round(b.x), y = Math.round(b.y - b.r * .4);
      ctx.globalAlpha = .25; ell(x + 3, Math.round(b.y) + 3, r, Math.round(r * .5), '#5a1a2a'); ctx.globalAlpha = 1;
      disc(x, y, r + 1, '#d0408a'); disc(x, y, r, '#ff8ac4'); disc(x - Math.round(r * .2), y - Math.round(r * .2), Math.round(r * .7), '#ffa6d2');
      ell(x - Math.round(r * .4), y - Math.round(r * .45), Math.max(1, Math.round(r * .3)), Math.max(1, Math.round(r * .18)), '#ffffff');
    }
  }
  for (const p of ev.pops || []) text('PLOPP!', Math.round(p.x), Math.round(p.y - 22 - (.9 - p.t) * 14), 8, '#ff7ab8', 'center');
  // what sticks to the cars: cream (after the chocolate), a scrap of floss, gum, glitter (after the lemonade)
  for (const c of G.cars) {
    if (c.fall > 0 || !inView(c.x, c.y)) continue;
    const x = Math.round(c.x), y = Math.round(c.y - (c.z || 0) * .6);
    if (c.cream > 0) { disc(x, y - 2, 5, '#f6e6cc'); disc(x, y - 3, 4, '#fffaf2'); disc(x + 1, y - 8, 2, '#e8344a'); R1(x + 2, y - 11, 1, 3, '#3a7a2a'); }
    if (c.flossT > 0) { ctx.globalAlpha = Math.min(1, c.flossT); disc(x - 5, y + 3, 4, '#ffb8d6'); disc(x - 3, y + 1, 3, '#ffe0ee'); ctx.globalAlpha = 1; }
    if (c.gumT > 0) for (let q = 0; q < 5; q++) { const a = q * 1.3 + c.seed; R1(Math.round(x + Math.cos(a) * 9), Math.round(y + Math.sin(a) * 6), 3, 2, '#ff7ab8'); }
    if (c.glitT > 0) for (let q = 0; q < 4; q++) { const a = G.time * 3 + q * TAU / 4 + c.seed, d = 8 + (q % 2) * 5; if (((G.time * 10 + q) | 0) % 2) R1(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * .7), 1, 1, '#ffffff'); else R1(Math.round(x + Math.cos(a) * d) - 1, Math.round(y + Math.sin(a) * d * .7), 3, 1, '#fff6a8'); }
  }
  // particles of the sweets: gum scraps, fizz bubbles, falling sprinkles
  for (const p of G.parts) {
    if (p.t === 'gum') { ctx.globalAlpha = p.life / p.ml; R1(Math.round(p.x), Math.round(p.y), 3, 2, '#ff7ab8'); }
    else if (p.t === 'fizz') { ctx.globalAlpha = p.life / p.ml; R1(Math.round(p.x), Math.round(p.y), 2, 2, p.col); R1(Math.round(p.x), Math.round(p.y), 1, 1, '#ffffff'); }
    else if (p.t === 'spr') { ctx.globalAlpha = 1; R1(Math.round(p.x), Math.round(p.y - p.z), p.v ? 1 : 3, p.v ? 3 : 1, p.col); }
  }
  ctx.globalAlpha = 1;
  // the candyfloss clouds over everything
  if (ev.watte) for (const cl of ev.watte.clouds) if (inView(cl.x, cl.y, cl.r + 10)) drawCloud(cl);
}

// on the screen: the messages of the events; a pink veil while you are under a cloud
export function drawSuessSky() {
  const ev = G.T.ev; if (!ev) return;
  if (G.player && G.player.inCloud) { ctx.fillStyle = 'rgba(255,170,210,.18)'; ctx.fillRect(0, 0, VW, VH); }
  if (ev.msg && ((G.time * 4) | 0) % 2) text(ev.msg.s, VW / 2, 34, 8, ev.msg.col, 'center');
}

