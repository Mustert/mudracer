import { G } from './g.js';
import { SFX, noise, voice } from './audio.js';
import { TAU, VH, VW, clamp, ctx, hash, mk, smooth } from './core.js';
import { R1, disc, ell } from './gfx.js';
import { warnAt } from './kit.js';
import { nearObstacles } from './grid.js';
import { addP, drop } from './particles.js';
import { cam } from './state.js';
import { inView, lastLap, near } from './trackfx.js';
import { tctx } from './tracks.js';
import { BELT, CARA, GUM, ICING, KR, MARSH } from './suessmap.js';

// ---------- Süßigkeitenland Rev 2 while racing (plaene/SUESS_REV2.md) ----------
// Always: caramel (terrain 111: brooks in the forest, the moor, spills on the cookie road) is slow and makes the car golden; after you leave it, it
// holds on for a moment (0.35 s / mud: the car is slower and drags golden threads that stretch and snap; terrain codes in surf, no damping).
// The gummy-bear trampolines throw every car equally high (the speed only decides how far). The marshmallows bounce you from one to the next. The
// candyfloss banks of the pass are soft, a scrap of floss stays on the car. Bubblegum bubbles grow out of the pink spots (solid, soft) and burst
// after 3 s: whoever stands next to them sticks for 0.5 s. The chocolate river and lake are deep: you fall in and come out brown with cream on top.
// In the factory the belts push, the press stamps every 2.4 s (its shadow grows 0.8 s before, it hisses): whoever is under it is flat for 1 s.
// The lemonade bay washes and leaves the car glittering.
// Event "schoko": when the leader starts lap 2 the fountain on the summit overflows: three streams run one after the other (4 s apart, each
// announced 2 s before by bubbling, a timpani roll and a warning triangle over the place) down the rills of the mountain (over the pass, over the
// descent to the factory) and out of the lake into the forest; they stay as flat chocolate on one half of the road. In the last lap it rains
// sprinkles, the ones that land on the chocolate stay.
// Event "zuckerwatte": pink candyfloss clouds drift over the forest and the moor (never the factory, the bridges or the line) and hide what is
// under them: three in lap 1, five in lap 2, eight in the last lap (the machine at the pass puffs them out).
// Fields in T.ev start with sw (T22).

const BUB = { rest: 2.6, grow: 3, max: 14, cyc: 6.6, stick: .5 }, CLOUD = { n: [3, 5, 8], every: 2.5 };
const STREAM = { speed: 46, gap: 4, pre: 2 }, PRESS = { per: 2.4, warn: .8, down: .3, flat: 1, hw: 30, hh: 12 };
const loud = (c, m = 300) => c.ai ? clamp(1 - near(c.x, c.y) / m, 0, .45) : 1;
const leadLap = () => G.cars.reduce((m, c) => Math.max(m, c.lap || 1), 1);
const inRng = (i, a, b, N) => (i - a + N) % N <= (b - a + N) % N;
const SPR = ['#ff4d6d', '#ffd93d', '#6bcb77', '#4d96ff', '#9b5de5', '#ffffff', '#ff9f43'];
const GOLD = ['#d88a1c', '#e69a2a', '#ffdc8a', '#c47812'], CHOC = ['#5a3020', '#4a2618', '#6a3a26', '#9a5a3a'];

// the sounds of the sweets (synthesised like all the others, see audio.js)
export const SX = {
  // the trampoline: a rubbery squeak and a wobble
  boing: v => { voice({ type: 'triangle', f: 700, to: 1500, a: .004, d: .14, vol: .09 * v }); for (let k = 0; k < 5; k++) voice({ t: .03 + k * .06, f: 200 + (k % 2) * 60, to: 170 + (k % 2) * 40, a: .005, d: .07, vol: .14 * v * (1 - k * .17) }); },
  // a marshmallow: a soft high boing
  marsh: v => { voice({ type: 'sine', f: 520, to: 980, a: .004, d: .12, vol: .1 * v }); voice({ t: .05, type: 'sine', f: 360, to: 300, a: .004, d: .1, vol: .07 * v }); },
  // caramel threads: a stretched creak
  stretch: v => voice({ type: 'sawtooth', f: 150, to: 92, a: .05, hold: .25, d: .25, vol: .05 * v, lp: 800 }),
  // fizz (pads, lemonade): sparkling bubbles
  fizz: v => { noise({ type: 'highpass', f: 4200, a: .01, hold: .2, d: .35, vol: .08 * v }); for (let k = 0; k < 6; k++) { const f = 1800 + Math.random() * 2400; voice({ t: Math.random() * .4, f, to: f * 1.6, a: .002, d: .03, vol: .04 * v }); } },
  // a big plop into the chocolate
  choc: v => { noise({ type: 'lowpass', f: 900, to: 140, d: .45, vol: .4 * v, q: 2 }); voice({ f: 95, to: 40, d: .35, vol: .3 * v }); for (let k = 0; k < 4; k++) voice({ t: .12 + k * .09, f: 140 + Math.random() * 80, to: 300, a: .004, d: .07, vol: .12 * v }); },
  // the chocolate fountain overflows: deep glugs
  schoko: v => { for (let k = 0; k < 5; k++) { voice({ t: k * .22, f: 120 - k * 8, to: 55, a: .01, d: .18, vol: .22 * v }); noise({ t: k * .22, type: 'lowpass', f: 500, d: .15, vol: .12 * v }); } },
  // the candyfloss machine puffs
  puff: v => noise({ type: 'bandpass', f: 900, to: 300, a: .05, hold: .2, d: .3, vol: .1 * v, q: 1.2 }),
  // sprinkles start to fall: a glittering run
  sprinkle: () => { for (let k = 0; k < 8; k++) voice({ t: k * .05, f: 1568 * Math.pow(2, k / 12 * 2), a: .002, d: .2, vol: .04 }); },
  // the press: it hisses before it comes down, then a heavy stamp
  hiss: v => noise({ type: 'highpass', f: 2600, to: 1800, a: .05, hold: .4, d: .3, vol: .07 * v }),
  stamp: v => { noise({ type: 'lowpass', f: 700, to: 90, d: .3, vol: .45 * v }); voice({ f: 90, to: 38, d: .25, vol: .4 * v }); voice({ t: .02, type: 'square', f: 1400, to: 900, a: .002, d: .05, vol: .05 * v }); },
  // the belts rattle
  rattle: v => { for (let k = 0; k < 4; k++) noise({ t: k * .06, type: 'bandpass', f: 700 + k * 90, q: 4, a: .002, d: .03, vol: .05 * v }); },
  // the cookie monster munches
  munch: v => { for (let k = 0; k < 4; k++) { noise({ t: k * .14, type: 'bandpass', f: 600, q: 1.5, a: .005, d: .08, vol: .12 * v }); voice({ t: k * .14, f: 160, to: 110, a: .005, d: .07, vol: .1 * v }); } },
};

function initSuess(T) {
  const ev = T.ev, S = T.suess;
  ev.swBubbles = S.gum.map(([x, y], k) => ({ x, y, t: (k * 2.9) % BUB.cyc, r: 0, pop: 0 }));
  ev.obst = []; ev.swSchoko = null; ev.swWatte = null; ev.swSprinkle = false; ev.swAlarm = false; ev.swPress = 0;
  ev.swStats = { spur: 0, stones: 0, walk: 0, bay: 0, jump: 0, flat: 0, sink: 0 }; S.stats = ev.swStats; // (how often what happened in the last race: for tuning in the dev server)
  // the chocolate of the last race is gone again
  S.chocoM.fill(0);
  for (const st of S.streams) {
    for (let q = 0; q < st.n; q++) T.ter[st.idx[q]] = st.ter0[q];
    st.k = 0; st.front = -1; st.warned = false;
    if (!st.c) { st.c = mk(st.w, st.h); st.g = st.c.getContext('2d'); }
    st.g.clearRect(0, 0, st.w, st.h);
  }
  T.jumps.forEach((J, k) => { J.sq = 0; J.snd = k < S.nTramp ? v => { J.sq = .45; SX.boing(v); } : v => SX.marsh(v); });
  S.inFactory = false;
}

function initSchoko(T) { T.ev.swSchoko = { t: -1 }; }

function initWatte(T) {
  const ev = T.ev; ev.swWatte = { clouds: [], n: 0, next: 0, puffT: 0 };
  for (let k = 0; k < CLOUD.n[0]; k++) ev.swWatte.clouds.push(newCloud(T, ev.swWatte.n++, true));
}

// a candyfloss cloud in one of the boxes (forest, moor): somewhere in it (at the start) or coming in at its east edge; it drifts west slowly
function newCloud(T, n, anywhere) {
  const B = T.suess.clouds[n % T.suess.clouds.length], r = 24 + hash(n, 1, 170) * 14, [x0, y0, x1, y1] = B;
  return { b: n % T.suess.clouds.length, x: anywhere ? x0 + hash(n, 4, 170) * (x1 - x0) : x1 + r * .5, y: y0 + r * .6 + hash(n, 5, 170) * Math.max(1, y1 - y0 - r * 1.2), r,
    vx: -(7 + hash(n, 2, 170) * 6), vy: (hash(n, 3, 170) - .5) * 5, k: n, grow: anywhere ? 1 : 0 };
}

// ======================================================= every frame

function pressU(t) { return ((t % PRESS.per) + PRESS.per) % PRESS.per; }
const pressDown = u => u >= PRESS.per - PRESS.down, pressWarn = u => u >= PRESS.per - PRESS.down - PRESS.warn && !pressDown(u);

function suessUpdate(T, dt) {
  const ev = T.ev, S = T.suess, P = G.player, t = ev.t;
  for (let k = 0; k < S.nTramp; k++) T.jumps[k].sq = Math.max(0, T.jumps[k].sq - dt);
  // bubblegum: rest, grow for 3 s, burst
  for (const b of ev.swBubbles) {
    const g0 = b.t - BUB.rest; b.t += dt; if (b.t >= BUB.cyc) b.t -= BUB.cyc;
    const g = b.t - BUB.rest; b.r = g > 0 && g < BUB.grow ? BUB.max * smooth(g / BUB.grow) : 0;
    b.pop = Math.max(0, b.pop - dt);
    if (g0 < BUB.grow && g >= BUB.grow) {
      b.pop = .6;
      for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; addP({ t: 'gum', x: b.x + Math.cos(a) * 10, y: b.y + Math.sin(a) * 10, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: .45, ml: .45 }); }
      for (const c of G.cars) if (c.fall <= 0 && c.z <= 0 && Math.hypot(c.x - b.x, c.y - b.y) < BUB.max + 14) c.gumT = BUB.stick;
      if (near(b.x, b.y) < 320) SFX.plopp();
    }
  }
  for (const c of G.cars) {
    // into the chocolate: it comes out brown (with cream on top)
    if (c.fall > 0 && !c.fallKind) {
      if (!c.choc) {
        c.choc = true; c.dirt = 1; ev.swStats.sink++; c.cem = false; c.stickT = 0; c.thread = null; c.inCara = false;
        for (let k = 0; k < 18; k++) drop(c.x, c.y, Math.random() * TAU, 30 + Math.random() * 60, 60 + Math.random() * 60, CHOC[k % 4], 1, false);
        if (loud(c) > .02) SX.choc(loud(c));
      }
      c.dirt = 1;
    } else if (c.choc) { c.choc = false; c.cream = 2.5; }
    if (c.z > 0 && !c.swAir) { c.swAir = true; ev.swStats.jump++; } else if (c.z <= 0) c.swAir = false;
    for (const k of ['cream', 'flossT', 'glitT', 'gumT']) if (c[k] > 0) c[k] = Math.max(0, c[k] - dt);
  }
  // the press: it stamps in a fixed beat (learnable); whoever is under it when it comes down (or drives in while it is down) is flat for a moment
  const F = S.factory, u = pressU(t), u0 = pressU(t - dt), down = pressDown(u);
  if (pressWarn(u) && !pressWarn(u0) && near(F.press.x, F.press.y) < 300) SX.hiss(clamp(1 - near(F.press.x, F.press.y) / 300, .1, 1));
  if (down && !pressDown(u0) && near(F.press.x, F.press.y) < 340) { SX.stamp(clamp(1 - near(F.press.x, F.press.y) / 340, .1, 1)); if (P && Math.hypot(P.x - F.press.x, P.y - F.press.y) < 120) G.jumpShake = Math.max(G.jumpShake, .2); }
  if (down) for (const c of G.cars) {
    if (c.fall > 0 || c.z > 0 || c.flatT > 0 || Math.abs(c.x - F.press.x) > PRESS.hw || Math.abs(c.y - F.press.y) > PRESS.hh + 6) continue;
    ev.swStats.flat++; c.flatT = PRESS.flat; c.stun = 0; c.boost = 0; c.vx = c.vy = 0; c.stickT = 0; c.thread = null; if (!c.ai) SFX.crash();
    for (let k = 0; k < 10; k++) addP({ t: 'spr', x: c.x + (Math.random() - .5) * 30, y: c.y + (Math.random() - .5) * 10, z: 6, col: SPR[k % 7], v: k % 2 === 0, life: .8, ml: .8 });
  }
  ev.swPress = u;
  // where the player is: inside the factory (no roof, the machine beat in the song)
  S.inFactory = !!(P && P.fall <= 0 && P.x > F.x && P.x < F.x + F.W && P.y > F.y + 4 && P.y < F.y + F.H - 4);
  if (S.inFactory && Math.random() < dt * 1.5) SX.rattle(.6);
  if (ev.swSchoko) updateSchoko(T, dt); else ev.swAlarm = false;
  if (ev.swWatte) updateWatte(T, dt);
  // the computer cars steer round growing bubbles and the lollipops near them
  const ob = ev.obst; ob.length = 0;
  for (const b of ev.swBubbles) if (b.r > 3 || (b.t > BUB.rest - .6 && b.t < BUB.rest)) ob.push({ x: b.x, y: b.y, r: Math.max(b.r, 8) });
  for (const L of S.lollis) if (G.cars.some(c => c.ai && Math.abs(c.x - L.x) < 100 && Math.abs(c.y - L.y) < 100)) ob.push({ x: L.x, y: L.y, r: L.r + 2 });
  // the sprinkles of the last lap fall and stay on the chocolate
  for (const p of G.parts) if (p.t === 'spr' && p.z !== undefined) {
    p.z -= 90 * dt;
    if (p.z <= 0) {
      p.life = 0; const x = p.x | 0, y = p.y | 0; if (x < 0 || y < 0 || x >= T.W || y >= T.H) continue;
      const j = y * T.W + x; if (T.ter[j] === 2 && S.chocoM[j]) { tctx.globalAlpha = 1; tctx.fillStyle = p.col; tctx.fillRect(x, y, p.v ? 1 : 2, p.v ? 2 : 1); }
    }
  }
  S.fountainT = (S.fountainT || 0) + dt;
  // the fountain on the summit and the lemonade fountain splash; the factory chimneys smoke (only near the screen)
  const [mx, my] = S.mountain; if (inView(mx, my, 60) && Math.random() < dt * 25) { const a = Math.random() * TAU; addP({ t: 'd', x: mx + Math.cos(a) * 4, y: my + Math.sin(a) * 3, z: 26, vx: Math.cos(a) * 28, vy: Math.sin(a) * 18, vz: 20, col: CHOC[(Math.random() * 4) | 0], s: 2, life: 1.2, ml: 1.2 }); }
  const [lx, ly] = S.fount; if (inView(lx, ly, 60)) for (const [px2, py2] of S.posts) { const rr = Math.random(), d = Math.hypot(lx - px2, ly - py2) || 1; addP({ t: 'd', x: px2, y: py2, z: 14, vx: (lx - px2) / d * (30 + rr * 14), vy: (ly - py2) / d * (30 + rr * 14), vz: 50 + Math.random() * 20, col: ['#fff27a', '#ffffff', '#ffe85a', '#fff8b8'][(Math.random() * 4) | 0], s: 1, life: 1.1, ml: 1.1 }); }
  if (!S.inFactory) for (const [x, y] of F.chimneys) if (inView(x, y, 30) && Math.random() < dt * 4) addP({ t: 'puff', x, y: y - 6, vx: 6, vy: -14, life: 2, ml: 2, col: SPR[(Math.random() * 5) | 0] });
}

// the ground under a car (from update.js): caramel sticks, gum holds, candyfloss scraps, fizz, lemonade
function suessGround(c, j, sp, dt) {
  const T = G.T, fx = Math.cos(c.ang), fy = Math.sin(c.ang), v = loud(c);
  const inCara = c.surf === CARA;
  if (c.surf === 2) c.cem = false; // (brown)
  if (inCara) {
    c.cem = true; c.dirt = Math.min(1, c.dirt + .4 * dt); // (golden: the second set, see race.js)
    if (!c.inCara && sp > 25 && v > .02) SFX.mud(v * .7);
    c.inCara = true; c.thread = null; c.stickT = 0;
    if (sp > 20 && Math.random() < dt * 25) drop(c.x - fx * 12, c.y - fy * 12, c.ang + Math.PI + (Math.random() - .5), 20 + Math.random() * 30, 30 + Math.random() * 30, GOLD[(Math.random() * 4) | 0], .7, true);
  } else if (c.inCara) {
    // out of the caramel: it still holds on for a moment (slower, see surf), golden threads stretch behind the car
    c.inCara = false; c.stick0 = c.stickT = .35 / c.def.mud; c.thread = { x: c.x - fx * 12, y: c.y - fy * 12 };
    if (v > .02) SX.stretch(v);
  }
  if (c.stickT > 0) {
    c.stickT = Math.max(0, c.stickT - dt);
    const th = c.thread;
    if (th && (c.stickT <= 0 || Math.hypot(c.x - th.x, c.y - th.y) > 60)) {
      for (let q = 0; q < 8; q++) addP({ t: 'd', x: th.x + (c.x - th.x) * q / 8, y: th.y + (c.y - th.y) * q / 8, z: 3, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, vz: 20, col: GOLD[q % 4], s: 1, life: .6, ml: .6 });
      c.thread = null; if (v > .02) SFX.snap();
    }
  }
  if (c.surf === GUM && c.lastSurf !== GUM && v > .02) SFX.plopp();
  // candyfloss: touching the soft bank leaves a scrap on the car, scraps fly off
  if (sp > 20) for (const o of nearObstacles(T.grid, c.x, c.y)) {
    if (!o.floss || Math.hypot(c.x - o.x, c.y - o.y) > o.r + 11) continue;
    if (!(c.flossT > 0)) { if (v > .02) SFX.plopp(); for (let k = 0; k < 6; k++) addP({ t: 'floss', x: o.x, y: o.y, vx: (Math.random() - .5) * 60, vy: -20 - Math.random() * 30, life: .9, ml: .9, col: k % 2 ? '#ffc0dc' : '#c4e0ff' }); }
    c.flossT = 1.2; break;
  }
  // fizz pads: fizzing when you hit one, bubbles while the boost lasts
  if (c.surf === 4 && c.lastSurf !== 4 && v > .02) SX.fizz(v);
  if (c.boost > 0 && Math.random() < dt * 30) addP({ t: 'fizz', x: c.x - fx * 14 + (Math.random() - .5) * 10, y: c.y - fy * 14 + (Math.random() - .5) * 10, vx: (Math.random() - .5) * 20, vy: -10 - Math.random() * 20, life: .7, ml: .7, col: SPR[(Math.random() * 7) | 0] });
  // the lemonade: fizz when you drive in, glitter when you come out (clean)
  if (c.washing && !c.lemIn) { c.lemIn = true; if (v > .02) SX.fizz(v * .8); }
  else if (!c.washing && c.lemIn) { c.lemIn = false; if (c.dirt < .05) c.glitT = 1.6; }
  c.lastSurf = c.surf;
}

// the sweet grounds (physics.js surfOf): icing a little slower, caramel slow (cars good in mud less so), gum holds, belts and marshmallows like the
// road; after the caramel the car is slower for a moment (it fades), after a bubble burst next to it it sticks
function suessSurf(c) {
  const m = c.def.mud, t = c.surf;
  let base = t === ICING ? [.86, 8, .95] : t === CARA ? [clamp(.38 + .16 * m, .45, .72), 3.5 * m, .75, .8] : t === GUM ? [.32, 7, .6, .7] : t === BELT || t === MARSH ? [1, 10, 1] : null;
  if (c.gumT > 0 && t !== CARA) return [.3, 8, .7, .7];
  if (c.stickT > 0 && t !== CARA && t !== GUM) {
    const k = c.stickT / (c.stick0 || .35), b = base || (t === 1 || t === 4 ? [1, 10, 1] : null);
    if (b) base = [b[0] * (1 - .42 * k), b[1], b[2] * (1 - .2 * k), b[3] || 1];
  }
  return base;
}

// flattened by the press: a moment flat on the ground, then it pops back
function suessStuck(c, dt) {
  if (!(c.flatT > 0)) return false;
  c.vx = c.vy = 0; c.flatT -= dt;
  if (c.flatT <= 0) { c.flatT = 0; if (!c.ai || near(c.x, c.y) < 250) SFX.plopp(); }
  return true;
}

// ======================================================= the computer cars

// a side way (the brittle lane round the moor, the marshmallows, the maintenance walk in the factory, the lemonade bay): decided shortly before it
// leaves the road, followed to its end
function suessTarget(c) {
  const T = G.T, S = T.suess, N = T.N;
  if (c.finished || (G.state !== 'race' && G.state !== 'finish')) { c.swWay = null; return null; }
  if (!c.swWay) {
    const diff = G.raceDiff || 0, coin = (c.seed * 4.7 + c.lap * .31) % 1, ahead = i => (i - c.idx + N) % N;
    const pick = (i, pts, kind, yes) => { if (!c.swWay && ahead(i) >= 2 && ahead(i) < 20 && yes) { c.swWay = { P: pts, k: 0, i, kind }; T.ev.swStats[kind]++; } };
    // the brittle lane: the cars that mind caramel (on EASY nearly all of them)
    pick(S.iSpur, S.spurPts, 'spur', c.def.mud < 1.15 && coin < [.85, .45, .15][diff]);
    // the marshmallows: on HARD now and then, on MEDIUM rarely (3B-4)
    pick(S.iStones, S.stonePts, 'stones', coin < [0, .12, .35][diff]);
    // the maintenance walk: on EASY mostly, and whenever the press would come down as the car gets there
    if (!c.swWay && ahead(S.iWay) >= 2 && ahead(S.iWay) < 20) pick(S.iWay, S.wayPts, 'walk', coin < [.8, .35, .1][diff] || pressDanger(c, (S.iPress - c.idx + N) % N, .25));
    // the lemonade bay: only when dirty
    pick(S.iBay, S.bayPts, 'bay', c.dirt > [.4, .55, .7][diff]);
    if (!c.swWay) return null;
  }
  const W = c.swWay, P = W.P; let k = W.k, bd = 1e9;
  for (let q = W.k; q < Math.min(P.length, W.k + 30); q++) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  W.k = k;
  if (k >= P.length - 5 || bd > 70 * 70) { c.swWay = null; return null; }
  const tp = P[Math.min(P.length - 1, k + (W.kind === 'stones' ? 6 : 9))];
  return [tp.x, tp.y];
}

// would the press be down while the car passes under it? (ahead = path indices to the press; the car's speed, a margin)
function pressDanger(c, ahead, m = .12) {
  if (ahead > 90 || ahead < -8) return false;
  const sp = Math.max(55, Math.hypot(c.vx, c.vy)), a = (ahead * 2 - PRESS.hh - 12) / sp, b = (ahead * 2 + PRESS.hh + 14) / sp, t = G.T.ev.t;
  for (let s = Math.max(0, a); s <= b; s += .04) { const u = pressU(t + s); if (u >= PRESS.per - PRESS.down - m || u < .03) return true; }
  return false;
}

// the forest: wider; at each brook the trampoline (on MEDIUM and HARD most of them) or round the far side of the pond; never into caramel,
// bubblegum or chocolate if it can be helped (the cars that mind it); the middle of the belt under the press
function suessLane(c, i, lane) {
  const T = G.T, S = T.suess, N = T.N, p = T.path[i], n = T.nrm[i], diff = G.raceDiff || 0;
  if (inRng(i, S.iF[0], S.iF[1], N)) {
    lane *= 2.2;
    for (let b = 0; b < S.brooks.length; b++) {
      const B = S.brooks[b], ah = (B.i - c.idx + N) % N, past = (c.idx - B.i + N) % N;
      if (ah < 75 || past < 18) {
        if (ah >= 60 && ah < 75) c.swBrook = (c.seed * 3.3 + b * .37 + c.lap * .21) % 1 < [.25, .7, .9][diff] ? B.tramps[(c.seed * 7 + b) % 1 < .75 ? 0 : 1] : B.clean;
        const want = c.swBrook ?? B.clean, k = past < 18 ? 1 : clamp((75 - ah) / 40, 0, 1); // (it moves over gradually: no aiming into the hedge from afar)
        return lane + (want - lane) * k;
      }
    }
  }
  const ap = (S.iPress - c.idx + N) % N;
  if (ap < 60 && !c.swWay) return 0;
  if (c.def.mud < 1.15 || diff > 0) {
    const bad = l => { const x = (p.x + n.x * l) | 0, y = (p.y + n.y * l) | 0; if (x < 0 || y < 0 || x >= T.W || y >= T.H) return true; const t = T.ter[y * T.W + x]; return t === CARA || t === GUM || t === 2 || t === 5 || S.kind[y * T.W + x] === KR.island; };
    if (bad(lane)) for (const l of [lane * .5, 0, lane + 14, lane - 14, lane + 24, lane - 24]) if (Math.abs(l) < 28 && !bad(l)) return l;
  }
  return lane;
}

// gas: the bay washes slowly, against the belt of the walk at full gas, carefully over the marshmallows; before the press wait for the beat;
// under the clouds the cars on EASY go a little slower (they see everything, you do not)
function suessThrottle(c, thr) {
  const T = G.T, S = T.suess, N = T.N, W = c.swWay;
  if (W && W.kind === 'bay') thr = Math.min(thr, .6);
  else if (W && W.kind === 'walk') thr = c.surf === BELT ? 1 : Math.min(thr, .85);
  else if (W && W.kind === 'stones') thr = Math.min(thr, .82);
  else {
    const ap = (S.iPress - c.idx + N) % N;
    if (ap < 70 && pressDanger(c, ap, (G.raceDiff || 0) === 0 ? .25 : .12)) thr = ap < 22 ? -.5 : .12;
  }
  if (c.inCloud && !(G.raceDiff > 0)) thr *= .85;
  return thr;
}

// parts of the centre line lie close together (the forest S, the factory): search near the car's index, not the whole line
function suessProgress(c, best) {
  const T = G.T, N = T.N; let b = best, bd = 1e12;
  for (let k = -260; k <= 260; k++) { const i = (c.idx + k + N) % N, p = T.path[i], d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (d < bd) { bd = d; b = i; } }
  return b;
}

// the bubbles are solid while they grow: a soft bounce
function suessCollisions() {
  const ev = G.T.ev; if (!ev || !ev.swBubbles) return;
  for (const b of ev.swBubbles) {
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
  const ev = T.ev, sc = ev.swSchoko, S = T.suess, P = G.player;
  ev.swAlarm = false;
  if (sc.t < 0) { if (leadLap() < 2) return; sc.t = 0; }
  sc.t += dt;
  S.streams.forEach((st, k) => {
    const tw = k * STREAM.gap, t0 = tw + STREAM.pre; if (sc.t < tw || st.k >= st.n) return;
    const close = !!P && Math.hypot(P.x - st.warn[0], P.y - st.warn[1]) < 520;
    if (sc.t < t0) {
      // the announcement: it bubbles at the head of the rill, a roll in the song, a warning triangle over the place
      if (!st.warned) { st.warned = true; if (close || near(st.head[0], st.head[1]) < 500) SX.schoko(close ? 1 : .5); }
      if (close) ev.swAlarm = true;
      if (Math.random() < dt * 20) addP({ t: 'd', x: st.head[0] + (Math.random() - .5) * 14, y: st.head[1] + (Math.random() - .5) * 8, z: 2, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 10, vz: 40 + Math.random() * 30, col: CHOC[(Math.random() * 4) | 0], s: 2, life: .7, ml: .7 });
      return;
    }
    if (close && st.k < st.n * .6) ev.swAlarm = true;
    st.front = (sc.t - t0) * STREAM.speed;
    while (st.k < st.n && st.al[st.k] <= st.front) {
      const j = st.idx[st.k], q = st.k * 3; T.ter[j] = 2; S.chocoM[j] = 1;
      st.g.fillStyle = 'rgb(' + st.col[q] + ',' + st.col[q + 1] + ',' + st.col[q + 2] + ')'; st.g.fillRect(j % T.W - st.x0, (j / T.W | 0) - st.y0, 1, 1);
      st.k++;
    }
  });
  // the last lap: sprinkles rain over the map
  if (lastLap()) {
    if (!ev.swSprinkle) { ev.swSprinkle = true; SX.sprinkle(); }
    for (let q = 0; q < 3; q++) if (Math.random() < dt * 25) addP({ t: 'spr', x: cam.x + Math.random() * VW, y: cam.y + Math.random() * VH, z: 50 + Math.random() * 40, col: SPR[(Math.random() * 7) | 0], v: Math.random() < .5, life: 3, ml: 3 });
  }
}

// ======================================================= event "zuckerwatte"

function updateWatte(T, dt) {
  const W = T.ev.swWatte, S = T.suess, want = CLOUD.n[clamp(leadLap(), 1, 3) - 1];
  for (const cl of W.clouds) {
    const [x0, y0, , y1] = S.clouds[cl.b];
    cl.x += cl.vx * dt; cl.y += cl.vy * dt; cl.grow = Math.min(1, cl.grow + dt / 2);
    if (cl.y < y0 + cl.r * .5 || cl.y > y1 - cl.r * .5) cl.vy = -cl.vy;
    if (cl.x < x0 - cl.r * .3) cl.dead = true;
  }
  W.clouds = W.clouds.filter(cl => !cl.dead);
  W.puffT = Math.max(0, W.puffT - dt); W.next -= dt;
  if (W.clouds.length < want && W.next <= 0) {
    const cl = newCloud(T, W.n++, false); W.clouds.push(cl); W.next = CLOUD.every;
    if (cl.b === 1) { W.puffT = .8; if (near(S.machine[0], S.machine[1]) < 360) SX.puff(1); }
  }
  for (const c of G.cars) c.inCloud = W.clouds.some(cl => Math.hypot(c.x - cl.x, c.y - cl.y) < cl.r * cl.grow * .85);
}

// ======================================================= drawing

// a gummy bear lying across the way (the trampoline): head, ears, belly; it squashes when a car jumps off it
function drawTramp(J) {
  const nx = -J.ty, ny = J.tx, sq = J.sq > 0 ? Math.sin(J.sq * 30) * J.sq * 3 : 0, col = J.bear, x0 = J.x, y0 = J.y;
  const at = (o, a) => [Math.round(x0 + nx * o + J.tx * a), Math.round(y0 + ny * o + J.ty * a)];
  ctx.globalAlpha = .25; for (let o = -16; o <= 16; o += 4) { const [x, y] = at(o, 0); disc(x + 3, y + 4, 8, '#5a1a2a'); } ctx.globalAlpha = 1;
  for (let o = -8; o <= 10; o += 3) { const [x, y] = at(o, 0); disc(x, y, Math.round(9 + sq - Math.abs(o - 1) / 5), col); }
  const [hx, hy] = at(-14, 0); disc(hx, hy, Math.round(8 + sq), col);
  for (const s of [-1, 1]) { const [ex, ey] = at(-20, s * 6); disc(ex, ey, 3, col); const [fx, fy] = at(17, s * 6); disc(fx, fy, 4, col); const [ax, ay] = at(-3, s * 11); disc(ax, ay, 3, col); }
  ctx.globalAlpha = .45; for (let o = -6; o <= 8; o += 4) { const [x, y] = at(o, -3); disc(x, y, 4, '#ffffff'); } ctx.globalAlpha = 1;
  for (const s of [-1, 1]) { const [ex, ey] = at(-16, s * 3); R1(ex, ey, 2, 2, '#3a1020'); }
}

// the press: its frame, the head high up (it comes down every 2.4 s); its shadow on the belt grows before it falls
function drawPressShadow(F, u) {
  const { x, y } = F.press, w = pressWarn(u) ? (u - (PRESS.per - PRESS.down - PRESS.warn)) / PRESS.warn : pressDown(u) ? 1 : 0;
  ctx.globalAlpha = .12 + .45 * w; ctx.fillStyle = '#1a0a14';
  const g = Math.round(PRESS.hh * (.4 + .6 * w)); ctx.fillRect(x - PRESS.hw, y - g, PRESS.hw * 2, g * 2);
  if (pressWarn(u) && ((G.time * 8) | 0) % 2) { ctx.globalAlpha = .7; ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - PRESS.hw - 4, y - PRESS.hh - 2, 3, PRESS.hh * 2 + 4); ctx.fillRect(x + PRESS.hw + 1, y - PRESS.hh - 2, 3, PRESS.hh * 2 + 4); }
  ctx.globalAlpha = 1;
}
function drawPressHead(F, u) {
  const { x, y } = F.press, lift = pressDown(u) ? 0 : pressWarn(u) ? 26 - 8 * (u - (PRESS.per - PRESS.down - PRESS.warn)) / PRESS.warn : 26;
  const yy = Math.round(y - lift);
  for (const s of [-1, 1]) { R1(x + s * (PRESS.hw + 3) - 3, y - 44, 6, 56, '#5a2a48'); R1(x + s * (PRESS.hw + 3) - 2, y - 44, 2, 56, '#a0607e'); }
  R1(x - PRESS.hw - 8, y - 48, PRESS.hw * 2 + 16, 7, '#5a2a48'); R1(x - PRESS.hw - 8, y - 48, PRESS.hw * 2 + 16, 2, '#c890a8');
  R1(x - 3, y - 41, 6, Math.max(0, yy - PRESS.hh - (y - 41)), '#b8bcc4');
  R1(x - PRESS.hw, yy - PRESS.hh, PRESS.hw * 2, PRESS.hh * 2, '#3a1828');
  for (let q = -PRESS.hw + 1; q < PRESS.hw - 1; q += 6) R1(x + q, yy - PRESS.hh + 1, 3, PRESS.hh * 2 - 2, (q / 6 | 0) % 2 ? '#ff4d6d' : '#ffffff');
  R1(x - PRESS.hw, yy - PRESS.hh, PRESS.hw * 2, 2, '#ffb3c6');
}

// on the ground (under the cars): the chocolate streams with their glossy front, glints, the moving belts, the press shadow, the trampolines,
// gingerbread men, the cookie monster, the caramel threads
function drawSuessGround() {
  const T = G.T, S = T.suess, ev = T.ev, k = Math.floor(G.time * 5);
  for (const st of S.streams) if (st.k > 0) {
    ctx.drawImage(st.c, st.x0, st.y0);
    // the front glistens
    if (st.k < st.n) for (let q = 0; q < 12; q++) { const p = st.idx[Math.max(0, st.k - 1 - ((hash(q, k, 176) * 60) | 0))]; R1(p % T.W, (p / T.W) | 0, 2, 1, q % 3 ? '#e8b890' : '#fff0e0'); }
  }
  for (let q = 0; q < 14 && S.caraPix.length; q++) { const p = S.caraPix[(hash(q, k, 171) * S.caraPix.length) | 0]; R1(p % T.W, (p / T.W) | 0, 2, 1, '#fff2c0'); }
  for (let q = 0; q < 14 && S.chocPix.length; q++) { const p = S.chocPix[(hash(q, k, 172) * S.chocPix.length) | 0]; R1(p % T.W, (p / T.W) | 0, 2, 1, '#a87452'); }
  for (let q = 0; q < 10 && S.lemPix.length; q++) { const p = S.lemPix[(hash(q, k, 173) * S.lemPix.length) | 0]; R1(p % T.W, (p / T.W) | 0, 1, 1, '#ffffff'); }
  // the belts move: light ribs run along the way they push
  const F = S.factory;
  if (inView(F.x + F.W / 2, F.y + F.H / 2, F.W)) {
    for (const [x0, y0, x1, y1, fx, fy] of F.belts) {
      if (!inView((x0 + x1) / 2, (y0 + y1) / 2, 60)) continue;
      ctx.fillStyle = fy < 0 ? 'rgba(255,200,210,.55)' : 'rgba(255,255,255,.5)';
      if (fy) { const o = ((G.time * Math.abs(fy) * .8) % 8) * Math.sign(fy); for (let y = y0 + ((o % 8) + 8) % 8; y <= y1; y += 8) ctx.fillRect(x0, Math.round(y), x1 - x0 + 1, 1); }
      else { const o = ((G.time * Math.abs(fx) * .8) % 8) * Math.sign(fx); for (let x = x0 + ((o % 8) + 8) % 8; x <= x1; x += 8) ctx.fillRect(Math.round(x), y0, 1, y1 - y0 + 1); for (let y = y0 + 6; y < y1; y += 14) for (let q = 0; q < 3; q++) R1(Math.round((x0 + x1) / 2 + 4 - q * 3), y + q, 2, 1, '#ffffff'); }
    }
    drawPressShadow(F, ev.swPress || 0);
  }
  for (let q = 0; q < S.nTramp; q++) { const J = T.jumps[q]; if (inView(J.x, J.y)) drawTramp(J); }
  // gingerbread men walk along the road and wave
  for (const m of S.men) {
    const f = .5 - .5 * Math.cos(G.time * .35 + m.ph), x = Math.round(m.x0 + (m.x1 - m.x0) * f), y = Math.round(m.y0 + (m.y1 - m.y0) * f);
    if (!inView(x, y)) continue;
    const w = ((G.time * 4 + m.ph) | 0) % 2, B = '#b8743a', D = '#7a4620', Wt = '#ffffff';
    ctx.globalAlpha = .25; ell(x + 3, y + 8, 6, 2, '#3a1a10'); ctx.globalAlpha = 1;
    disc(x, y - 7, 3, B); R1(x - 3, y - 4, 7, 8, B); R1(x - 4 + w, y + 4, 3, 4, B); R1(x + 2 - w, y + 4, 3, 4, B);
    R1(x - 6, y - 3, 3, 2, B); if (w) R1(x + 4, y - 7, 2, 4, B); else R1(x + 4, y - 3, 3, 2, B);
    R1(x - 1, y - 8, 1, 1, D); R1(x + 1, y - 8, 1, 1, D); R1(x - 1, y - 6, 3, 1, Wt); R1(x, y - 2, 1, 1, '#ff4d6d'); R1(x, y + 1, 1, 1, '#6bcb77');
  }
  // the cookie monster comes up out of the caramel now and then and munches (only a picture)
  const [ox, oy] = S.monster, mu = (G.time % 11) / 11;
  if (mu > .7 && inView(ox, oy)) {
    const up = Math.sin((mu - .7) / .3 * Math.PI), h = Math.round(up * 12), chew = ((G.time * 6) | 0) % 2;
    disc(ox, oy - h + 6, 9, '#2a6ad8'); disc(ox - 3, oy - h + 2, 3, '#ffffff'); disc(ox + 3, oy - h + 2, 3, '#ffffff'); R1(ox - 3, oy - h + 2, 1, 1, '#000000'); R1(ox + 4, oy - h + 3, 1, 1, '#000000');
    R1(ox - 4, oy - h + 7 + chew, 8, 2 - chew, '#1a0a0a'); if (h > 8) { R1(ox + 5, oy - h + 5, 4, 4, '#c88a40'); R1(ox + 6, oy - h + 6, 1, 1, '#3a2010'); }
    if (mu > .8 && mu < .81 && near(ox, oy) < 300) SX.munch(.6);
  }
  // golden threads from the caramel to the car: they sag and get thinner as they stretch
  for (const c of G.cars) {
    const th = c.thread; if (!th || !(c.stickT > 0) || c.fall > 0) continue;
    const fx2 = Math.cos(c.ang), fy2 = Math.sin(c.ang), d = Math.hypot(c.x - th.x, c.y - th.y);
    for (const s of [-6, 0, 6]) {
      const ex = c.x - fx2 * 12 - fy2 * s, ey = c.y - fy2 * 12 + fx2 * s, n = Math.max(2, Math.round(d / 2)), sag = Math.min(7, d * .12);
      ctx.globalAlpha = clamp(1.2 - d / 60, .35, 1);
      for (let q = 0; q <= n; q++) { const f = q / n, x = th.x + s * .3 + (ex - th.x) * f, y = th.y + (ey - th.y) * f + Math.sin(f * Math.PI) * sag; R1(Math.round(x), Math.round(y), 1, 1, q % 3 ? '#e69a2a' : '#ffdc8a'); }
    }
    ctx.globalAlpha = 1;
  }
}

function drawCloud(cl) {
  const g = cl.grow, R = cl.r * g; if (R < 2) return;
  const parts = [[0, 0, 1], [-.55, .1, .7], [.55, .05, .72], [-.25, -.4, .62], [.3, -.38, .6], [0, .35, .7]];
  ctx.globalAlpha = .45; for (const [ox, oy, s] of parts) disc(Math.round(cl.x + ox * R), Math.round(cl.y + oy * R + 8), Math.round(R * s), '#c06090');
  ctx.globalAlpha = 1; for (const [ox, oy, s] of parts) disc(Math.round(cl.x + ox * R), Math.round(cl.y + oy * R), Math.round(R * s), '#ffb8d6');
  for (const [ox, oy, s] of parts) disc(Math.round(cl.x + ox * R - R * .12), Math.round(cl.y + oy * R - R * .12), Math.round(R * s * .7), '#ffd2e6');
  disc(Math.round(cl.x - R * .3), Math.round(cl.y - R * .45), Math.round(R * .3), '#fff0f7');
  for (let q = 0; q < 10; q++) { const a = hash(cl.k, q, 174) * TAU, d = R * (.2 + hash(q, cl.k, 175) * .7); R1(Math.round(cl.x + Math.cos(a) * d), Math.round(cl.y + Math.sin(a) * d), 1, 1, '#ffffff'); }
}

// above the cars: the fountain on the summit, the factory (roof from outside, the press inside), the lemonade jets, lanterns, bears, the machine,
// bubbles, what sticks to the cars, sweet particles, the clouds, warning triangles
function drawSuessAbove(cx, cy) {
  const T = G.T, S = T.suess, ev = T.ev, P = G.player;
  // the chocolate fountain on the summit: three tiers, chocolate runs down in curtains; it bubbles over before a stream comes
  const [fx, fy] = S.mountain;
  if (inView(fx, fy, 60)) {
    ctx.globalAlpha = .3; ell(fx + 4, fy + 8, 20, 9, '#1a0a04'); ctx.globalAlpha = 1;
    for (const tier of [[4, 18, '#4a2615', '#6a3a24'], [-6, 12, '#56301c', '#7a4a2e'], [-14, 7, '#6a3a24', '#8a5a3a']]) {
      const [dy, r, col, col2] = /** @type {[number, number, string, string]} */ (tier);
      ell(fx, fy + dy, r, Math.round(r * .5), '#e8c070'); ell(fx, fy + dy - 1, r - 1, Math.round(r * .45), col);
      for (let q = 0; q < 10; q++) { const a = q / 10 * TAU + (S.fountainT || 0) * 2; R1(Math.round(fx + Math.cos(a) * (r - 2)), Math.round(fy + dy + Math.sin(a) * r * .4 + ((S.fountainT * 20 + q * 3) % 4)), 1, 3, col2); }
    }
    disc(fx, fy - 20, 3, '#e8c070'); R1(fx - 1, fy - 26, 2, 6, '#8a5a3a');
    if (ev.swAlarm || (ev.swSchoko && ev.swSchoko.t >= 0 && ev.swSchoko.t < STREAM.gap * 3)) for (let q = 0; q < 6; q++) { const a = G.time * 5 + q; disc(Math.round(fx + Math.cos(a) * 16), Math.round(fy + 4 + Math.sin(a) * 6), 2, '#8a5a3a'); }
  }
  // the factory: opaque glass roof from outside; inside the press head
  const F = S.factory;
  if (inView(F.x + F.W / 2, F.y + F.H / 2, F.W)) {
    if (S.inFactory) drawPressHead(F, ev.swPress || 0);
    else ctx.drawImage(F.c, F.x, F.y);
  }
  // worker gummy bears at their levers (inside, only when you are in there)
  if (S.inFactory) for (const [x, y] of S.workers) { const w = ((G.time * 2 + x) | 0) % 2; disc(x + 10, y, 4, '#ffb02e'); disc(x + 10, y - 5, 3, '#ffb02e'); R1(x + 14, y - 8 - w * 3, 2, 6, '#5a5a62'); R1(x + 13, y - 10 - w * 3, 4, 3, '#ff4d6d'); }
  // the lemonade fountain: two jets arch over the bay
  const [lx, ly] = S.fount;
  if (inView(lx, ly, 60)) for (const [px2, py2] of S.posts) for (let q = 0; q <= 12; q++) { const f = q / 12, x = px2 + (lx - px2) * f * 1.1, y = py2 + (ly - py2) * f * 1.1 - 20 * Math.sin(f * Math.PI); R1(Math.round(x), Math.round(y + ((G.time * 30 + q) % 2)), 2, 2, q % 3 ? '#fff27a' : '#ffffff'); }
  // the ice cream lanterns glow
  for (const L of S.lamps) if (inView(L.x, L.y)) { ctx.globalAlpha = .25 + .1 * Math.sin(G.time * 3 + L.x); disc(L.x, L.y, 6, L.col); ctx.globalAlpha = 1; disc(L.x, L.y + 1, 3, L.col); R1(L.x - 1, L.y - 1, 1, 1, '#ffffff'); }
  // gummy bears (some hop on the spot)
  for (const b of S.bears) {
    if (!inView(b.x, b.y)) continue;
    const hop = b.hop ? Math.round(Math.abs(Math.sin(G.time * 4 + b.ph)) * 4) : 0, x = b.x, y = b.y - hop;
    ctx.globalAlpha = .25; ell(x + 2, b.y + 5, 4, 2, '#5a1a2a'); ctx.globalAlpha = 1;
    disc(x, y + 1, 3, b.col); disc(x, y - 3, 2, b.col); R1(x - 3, y - 5, 2, 2, b.col); R1(x + 2, y - 5, 2, 2, b.col); R1(x - 4, y, 2, 2, b.col); R1(x + 3, y, 2, 2, b.col);
    ctx.globalAlpha = .5; R1(x - 1, y - 4, 1, 1, '#ffffff'); ctx.globalAlpha = 1; R1(x - 1, y - 3, 1, 1, '#3a1020'); R1(x + 1, y - 3, 1, 1, '#3a1020');
  }
  // the candyfloss machine: the drum turns, it puffs when it makes a cloud
  const [mx, my] = S.machine;
  if (inView(mx, my)) { for (let q = 0; q < 6; q++) { const a = G.time * 6 + q * TAU / 6; R1(Math.round(mx + Math.cos(a) * 5), Math.round(my + Math.sin(a) * 5), 2, 2, q % 2 ? '#ff7ab8' : '#ffffff'); } if (ev.swWatte && ev.swWatte.puffT > 0) { ctx.globalAlpha = ev.swWatte.puffT; disc(mx - 4, my - 16, Math.round(6 + (1 - ev.swWatte.puffT) * 10), '#ffd2e6'); ctx.globalAlpha = 1; } }
  // bubblegum bubbles: pink, glossy, they wobble
  for (const b of ev.swBubbles || []) {
    if (!inView(b.x, b.y) || b.r < 1) continue;
    const r = Math.round(b.r + Math.sin(G.time * 9 + b.x) * .8), x = Math.round(b.x), y = Math.round(b.y - b.r * .4);
    ctx.globalAlpha = .25; ell(x + 3, Math.round(b.y) + 3, r, Math.round(r * .5), '#5a1a2a'); ctx.globalAlpha = 1;
    disc(x, y, r + 1, '#b0286a'); disc(x, y, r, '#ff7ab8'); disc(x - Math.round(r * .2), y - Math.round(r * .2), Math.round(r * .7), '#ffa6d2');
    ell(x - Math.round(r * .4), y - Math.round(r * .45), Math.max(1, Math.round(r * .3)), Math.max(1, Math.round(r * .18)), '#ffffff');
  }
  // what sticks to the cars: cream (after the chocolate), a scrap of floss, gum, glitter (after the lemonade)
  for (const c of G.cars) {
    if (c.fall > 0 || !inView(c.x, c.y)) continue;
    const x = Math.round(c.x), y = Math.round(c.y - (c.z || 0) * .6);
    if (c.cream > 0) { disc(x, y - 2, 5, '#f6e6cc'); disc(x, y - 3, 4, '#fffaf2'); disc(x + 1, y - 8, 2, '#e8344a'); R1(x + 2, y - 11, 1, 3, '#3a7a2a'); }
    if (c.flossT > 0) { ctx.globalAlpha = Math.min(1, c.flossT); disc(x - 5, y + 3, 4, '#ffb8d6'); disc(x - 3, y + 1, 3, '#ffe0ee'); ctx.globalAlpha = 1; }
    if (c.gumT > 0) for (let q = 0; q < 5; q++) { const a = q * 1.3 + c.seed; R1(Math.round(x + Math.cos(a) * 9), Math.round(y + Math.sin(a) * 6), 3, 2, '#ff7ab8'); }
    if (c.glitT > 0) for (let q = 0; q < 4; q++) { const a = G.time * 3 + q * TAU / 4 + c.seed, d = 8 + (q % 2) * 5; if (((G.time * 10 + q) | 0) % 2) R1(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * .7), 1, 1, '#ffffff'); else R1(Math.round(x + Math.cos(a) * d) - 1, Math.round(y + Math.sin(a) * d * .7), 3, 1, '#fff6a8'); }
  }
  // particles of the sweets: gum scraps, fizz bubbles, floss scraps, chimney puffs, falling sprinkles
  for (const p of G.parts) {
    if (p.t === 'gum') { ctx.globalAlpha = p.life / p.ml; R1(Math.round(p.x), Math.round(p.y), 3, 2, '#ff7ab8'); }
    else if (p.t === 'fizz') { ctx.globalAlpha = p.life / p.ml; R1(Math.round(p.x), Math.round(p.y), 2, 2, p.col); R1(Math.round(p.x), Math.round(p.y), 1, 1, '#ffffff'); }
    else if (p.t === 'floss') { ctx.globalAlpha = p.life / p.ml; disc(Math.round(p.x), Math.round(p.y), 2, p.col); }
    else if (p.t === 'puff') { ctx.globalAlpha = .6 * p.life / p.ml; disc(Math.round(p.x), Math.round(p.y), Math.round(3 + (1 - p.life / p.ml) * 5), p.col); }
    else if (p.t === 'spr') { ctx.globalAlpha = 1; R1(Math.round(p.x), Math.round(p.y - (p.z || 0)), p.v ? 1 : 3, p.v ? 3 : 1, p.col); }
  }
  ctx.globalAlpha = 1;
  // the candyfloss clouds over everything (forest and moor only)
  if (ev.swWatte) for (const cl of ev.swWatte.clouds) if (inView(cl.x, cl.y, cl.r + 10)) drawCloud(cl);
  // warning triangles (no text): a chocolate stream about to come down onto the road near you
  if (ev.swSchoko && ev.swSchoko.t >= 0 && P) S.streams.forEach((st, k) => {
    const tw = k * STREAM.gap, t0 = tw + STREAM.pre, s = ev.swSchoko.t;
    if (s >= tw && s < t0 + 2 && Math.hypot(st.warn[0] - P.x, st.warn[1] - P.y) < 420) warnAt(st.warn[0], st.warn[1], cx, cy);
  });
}

// on the screen: a pink veil while you are under a cloud
function drawSuessSky() {
  if (G.player && G.player.inCloud) { ctx.fillStyle = 'rgba(255,170,210,.18)'; ctx.fillRect(0, 0, VW, VH); }
}


// ---------- hooks: how the core calls this track (hooks.js; what each hook does: _template.js) ----------
/** @type {import('./_template.js').TrackHooks} */
export const suessHooks = {
  init: initSuess, events: { schoko: initSchoko, zuckerwatte: initWatte }, update: suessUpdate, collisions: suessCollisions, ground: suessGround,
  surf: suessSurf, target: suessTarget, lane: suessLane, throttle: suessThrottle, progress: suessProgress, stuck: suessStuck,
  noRespawn: t => t === CARA || t === GUM || t === MARSH,
  drawGround: drawSuessGround, drawAbove: drawSuessAbove, drawSky: drawSuessSky,
};
