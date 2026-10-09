import { G } from './g.js';
import { SFX } from './audio.js';
import { HALF, LAPS, TAU, VH, VW, WH, WW, clamp, ctx, hash, hex, mk, vnoise } from './core.js';
import { R1, disc, ell, text } from './draw.js';
import { snap } from './events.js';
import { addP } from './particles.js';
import { cam } from './state.js';
import { near } from './trackfx.js';

// ---------- Vulkan while racing ----------
// Always: the crust over the lava stream breaks through every 12 s (it glows 2 s before, then it is lava for 4 s), the geyser blows every 6 s
// (it throws the cars on the short cut over the lava ditch), at the ford one of the two stone bridges is always flooded (they swap every 10 s,
// the signal stone shows 3 s before which one opens next), the heat: close to lava a car gets hot, a hot car only makes 85 % (the fire engine cools
// itself with its own water), the waterfall cools and washes. In lap 1 the volcano only smokes and rumbles.
// Event "ausbruch": from lap 2 an eruption: lava bombs (a red circle shows where they land), a lava tongue over the serpentine, ash rain,
// the crust breaks through more often; in the last lap sparks rain down.

const CRUST = { per: 12, perErupt: 8, warn: 2, hot: 4 }, GEYSER = { per: 6, warn: 1.5, blow: 2 }, FORD = { per: 10, warn: 3, flood: 1.5 };
const BOMB = { warn: 1.5, r: 20, spot: 5, sr: 8 }, TONGUE = { per: 8, warn: 2, on: 5 };

const phase = (t, per, off = 0) => ((t + off) % per + per) % per;

export function initVolcano(T) {
  const ev = T.ev, V = T.volcano;
  ev.lanes = V.lanes.map((L, k) => ({ flood: k ? 1 : 0, wet: !!k }));
  V.lanes.forEach((L, k) => { for (const j of L.pix) T.ter[j] = k ? 15 : 1; });
  V.hot = false; V.glow = 0; V.jumps[0].off = true;
  ev.bombs = []; ev.spots = []; ev.erupt = null; ev.eruptOn = false; ev.obst = []; ev.quake = 0; ev.nextQuake = 6;
}

// ======================================================= always: crust, geyser, ford, rumbling

export function volcanoUpdate(T, dt) {
  const ev = T.ev, V = T.volcano, t = ev.t, P = G.player;
  // the crust
  const per = ev.erupt ? CRUST.perErupt : CRUST.per, u = phase(t, per, 5), hotAt = per - CRUST.hot, warnAt = hotAt - CRUST.warn;
  const was = V.hot;
  V.warn = u >= warnAt && u < hotAt; V.hot = u >= hotAt;
  V.glow = V.hot ? 1 : V.warn ? (u - warnAt) / CRUST.warn * .7 : u < 1.5 ? .5 * (1 - u / 1.5) : 0;
  const cx = T.def.stream[0];
  if (V.hot && !was && near(cx, 95) < 360) SFX.hiss(.8);
  if (V.warn && Math.random() < dt * 6 && near(cx, 95) < 300) SFX.crackle();
  // the geyser: it bubbles, then it blows (only then the short cut throws you over the ditch)
  const g = phase(t, GEYSER.per, 1), blowAt = GEYSER.per - GEYSER.blow;
  V.bubble = g >= blowAt - GEYSER.warn && g < blowAt; const blow = g >= blowAt;
  if (blow && V.jumps[0].off && near(V.geyser[0], V.geyser[1]) < 360) SFX.hiss(1);
  V.jumps[0].off = !blow; V.blow = blow;
  if (blow && near(V.geyser[0], V.geyser[1]) < 340) for (let k = 0; k < 3; k++) addP({ t: 'smoke', x: V.geyser[0] + (Math.random() - .5) * 10, y: V.geyser[1] - Math.random() * 40, vx: (Math.random() - .5) * 20, vy: -30 - Math.random() * 30, life: .9, ml: .9 });
  // the ford: which bridge is open, and the lava flooding over the other one
  const fk = Math.floor(t / FORD.per), open = fk % 2;
  V.open = open; V.next = (fk + 1) % 2; V.fordWarn = phase(t, FORD.per) > FORD.per - FORD.warn;
  ev.lanes.forEach((L, k) => {
    const tgt = k === open ? 0 : 1; L.flood = clamp(L.flood + Math.sign(tgt - L.flood) * dt / FORD.flood, 0, 1);
    const wet = L.flood > .5; if (wet !== L.wet) { L.wet = wet; for (const j of V.lanes[k].pix) T.ter[j] = wet ? 15 : 1; if (wet && near(T.def.ford.x, 410) < 340) SFX.hiss(.5); }
  });
  // lap 1: it only smokes and rumbles now and then (the camera shakes a little, the needle of the seismograph jumps)
  ev.quake = Math.max(0, ev.quake - dt);
  if (t > ev.nextQuake) { ev.nextQuake = t + 8 + hash(Math.floor(t), 1, 97) * 6; ev.quake = 1.2; SFX.rumble(); G.jumpShake = Math.max(G.jumpShake, .25); }
  // steam from the vents
  for (const v of V.vents) if (Math.random() < dt * 1.5 && near(v.x, v.y) < 320) addP({ t: 'smoke', x: v.x, y: v.y, vx: 3, vy: -8, life: 1.4, ml: 1.4 });
  if (ev.eruptOn) updateEruption(T, dt);
  ev.obst = ev.bombs.filter(b => b.t < BOMB.warn).concat(ev.spots);
}

// the ground under a car: heat (close to lava it gets hot, water cools), ash dust; a hot car smokes and is slower
export function volcanoGround(c, sp, dt) {
  const V = G.T.volcano, gi = ((clamp(c.y | 0, 0, WH - 1)) >> 2) * V.GW + (clamp(c.x | 0, 0, WW - 1) >> 2), fire = c.def.id === 'feuerwehr';
  c.heat = c.heat || 0;
  if (V.heat[gi] || c.surf === 16) c.heat = Math.min(1, c.heat + dt * (fire ? .15 : .3)); else c.heat = Math.max(0, c.heat - dt * .06);
  if (c.surf === 3) { c.heat = 0; c.hot = false; }
  if (c.heat >= 1) {
    if (fire) { // the fire engine cools itself: a fountain from its own tank
      c.heat = .35;
      for (let i = 0; i < 22; i++) addP({ t: 'd', x: c.x, y: c.y, z: 10, vx: Math.cos(i / 22 * TAU) * 50, vy: Math.sin(i / 22 * TAU) * 50, vz: 90, col: ['#9fd4ff', '#ffffff', '#5aa6e8'][i % 3], s: 1, life: 1, ml: 1 });
      if (!c.ai || near(c.x, c.y) < 250) SFX.splash(c.ai ? .3 : .7);
    } else if (!c.hot) { c.hot = true; if (!c.ai) SFX.cough(); }
  }
  if (c.hot && c.heat < .55) c.hot = false;
  if (c.hot && Math.random() < dt * 14) addP({ t: 'smoke', x: c.x - Math.cos(c.ang) * 10, y: c.y - Math.sin(c.ang) * 10, vx: (Math.random() - .5) * 10, vy: -12, life: .9, ml: .9 });
  if (c.hot && !c.ai && Math.random() < dt * .8) SFX.cough();
  if (c.surf === 2 && sp > 20 && Math.random() < dt * 25) addP({ t: 'smoke', x: c.x - Math.cos(c.ang) * 12, y: c.y - Math.sin(c.ang) * 12, vx: (Math.random() - .5) * 20, vy: (Math.random() - .5) * 20, life: .6, ml: .6 });
  c.burnT = Math.max(0, (c.burnT || 0) - dt);
}

// ======================================================= the computer cars

// the long way round the crust: when the stream will break through about the time they get there (they see the glow like you)
export function volcanoTarget(c) {
  const T = G.T, V = T.volcano, P = V.bypass, N = T.N; if (!P || c.finished || G.state !== 'race') return null;
  if (!c.bypass) {
    const ahead = (V.bypassI - c.idx + N) % N; if (ahead < 3 || ahead > 26) return null;
    const sp = Math.max(60, Math.hypot(c.vx, c.vy)), arr = (T.def.stream[0] - c.x) / sp, ev = T.ev;
    const per = ev.erupt ? CRUST.perErupt : CRUST.per, hotAt = per - CRUST.hot;
    let risky = false; for (let dt = -.3; dt <= 1; dt += .1) { const u = phase(ev.t + arr + dt, per, 5); if (u >= hotAt - .4) risky = true; }
    if (!risky) return null;
    c.bypass = true; c.byK = 0;
  }
  let k = c.byK, bd = 1e9;
  for (let q = c.byK; q < Math.min(P.length, c.byK + 30); q++) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  c.byK = k;
  if (k >= P.length - 5 || bd > 60 * 60) { c.bypass = false; return null; }
  const t = P[Math.min(P.length - 1, k + 10)];
  return [t.x, t.y];
}

export function volcanoLane(c, i, lane) {
  const T = G.T, V = T.volcano, ev = T.ev, N = T.N, p = T.path[i], n = T.nrm[i];
  // the ford: the bridge that will be open when they get there
  const ahead = (V.fordI - c.idx + N) % N, past = (c.idx - V.fordI + N) % N;
  if (ahead < 60 || past < 14) {
    const sp = Math.max(60, Math.hypot(c.vx, c.vy)), arr = past < 14 ? 0 : ahead * 2 / sp;
    const k = Math.floor((ev.t + arr + .6) / FORD.per) % 2, now = ev.lanes[k].flood < .3 || past < 14 ? k : V.open;
    return V.lanes[past < 14 ? V.open : now].off;
  }
  // the lava tongue over the serpentine: take the other half of the road
  if (ev.tongue && ev.tongue.on && Math.hypot(p.x - ev.tongue.x, p.y - ev.tongue.y) < 50) return -16;
  // where a lava bomb will land (on LEICHT they do not always see it)
  if ((G.raceDiff || 0) > 0 || (c.seed * 3.1) % 1 < .5) for (const b of ev.bombs) {
    if (b.t >= BOMB.warn) continue;
    const x = p.x + n.x * lane, y = p.y + n.y * lane; if (Math.hypot(x - b.x, y - b.y) > BOMB.r + 8) continue;
    const o = (b.x - p.x) * n.x + (b.y - p.y) * n.y; return clamp(o > 0 ? o - 30 : o + 30, -26, 26);
  }
  return lane;
}

// ======================================================= event "ausbruch"

export function initEruption(T) { T.ev.eruptOn = true; }

function updateEruption(T, dt) {
  const ev = T.ev, V = T.volcano;
  if (!ev.erupt) {
    if (!G.player || G.player.lap < 2) return;
    ev.erupt = { t: 0, next: 1.5, n: 0 };
    snap(T, 0, 0, WW, WH); // lava spots turn to ash on the ground; this puts it back after the race
    SFX.bang(); G.jumpShake = .9; ev.quake = 2;
    // the two places of the lava tongue: the road pixels on one half, over the whole width of the stream
    ev.tongues = (T.def.tongue || []).map(([x, y]) => {
      const pix = [], i = T.near[y * WW + x], p = T.path[i], nm = T.nrm[i];
      for (let yy = y - 40; yy <= y + 40; yy++) for (let xx = x - 14; xx <= x + 14; xx++) {
        const j = yy * WW + xx; if (T.dist[j] >= HALF + 1 || T.ter[j] !== 1) continue;
        if ((xx + .5 - p.x) * nm.x + (yy + .5 - p.y) * nm.y > -1) pix.push(j);
      }
      return { x, y, pix, pic: lavaPic(pix) };
    });
  }
  const e = ev.erupt; e.t += dt;
  // lava bombs: every 3 to 5 s one somewhere on the road, the circle shrinks for 1.5 s, then it lands
  while (e.t >= e.next) {
    const i = Math.floor(hash(e.n, 1, 98) * T.N), p = T.path[i], o = (hash(e.n, 2, 98) - .5) * 44;
    ev.bombs.push({ x: p.x + T.nrm[i].x * o, y: p.y + T.nrm[i].y * o, t: 0, n: e.n, whistle: false });
    e.next += 3 + hash(e.n, 3, 98) * 2; e.n++;
  }
  for (let q = ev.bombs.length - 1; q >= 0; q--) {
    const b = ev.bombs[q]; b.t += dt;
    if (!b.whistle && b.t > BOMB.warn - .9) { b.whistle = true; if (near(b.x, b.y) < 300) SFX.bombWhistle(); }
    if (b.t < BOMB.warn) continue;
    ev.bombs.splice(q, 1);
    // the impact: who is in the circle is thrown away (like by a cow) and gets sooty; a little lava stays for a moment
    for (const c of G.cars) {
      if (c.fall > 0 || c.z > 0) continue;
      const dx = c.x - b.x, dy = c.y - b.y, d = Math.hypot(dx, dy); if (d > BOMB.r) continue;
      const nx = d ? dx / d : 1, ny = d ? dy / d : 0;
      c.vx = nx * 150; c.vy = ny * 150; c.spin = 12; c.stun = 1; c.boost = 0; c.dirt = 1; c.heat = Math.min(1, (c.heat || 0) + .4);
      if (!c.ai) SFX.crash();
    }
    for (let i = 0; i < 24; i++) addP({ t: 'd', x: b.x, y: b.y, z: 4, vx: Math.cos(i / 24 * TAU) * (40 + Math.random() * 60), vy: Math.sin(i / 24 * TAU) * (40 + Math.random() * 60), vz: 70, col: ['#ff7a1a', '#ffd04a', '#3a3836'][i % 3], s: 2, life: .7, ml: .7 });
    if (near(b.x, b.y) < 380) SFX.boom(clamp(1 - near(b.x, b.y) / 380, .2, 1));
    const pix = [], old = [];
    for (let y = Math.round(b.y - BOMB.sr); y <= b.y + BOMB.sr; y++) for (let x = Math.round(b.x - BOMB.sr); x <= b.x + BOMB.sr; x++) {
      if (x < 0 || y < 0 || x >= WW || y >= WH || Math.hypot(x + .5 - b.x, y + .5 - b.y) > BOMB.sr - .5 + (vnoise(x * .3, y * .3, 99) - .5) * 2) continue;
      const j = y * WW + x; if (T.ter[j] === 15 || T.ter[j] === 16 || T.ter[j] === 3) continue; pix.push(j); old.push(T.ter[j]); T.ter[j] = 15;
    }
    ev.spots.push({ x: b.x, y: b.y, t: 0, pix, pic: lavaPic(pix) });
  }
  for (let q = ev.spots.length - 1; q >= 0; q--) {
    const s = ev.spots[q]; s.t += dt; if (s.t < BOMB.spot) continue;
    // it cools down to a patch of ash
    const b = T.base.getContext('2d'), MUD = T.th.mud.map(hex), x0 = Math.round(s.x - 10), y0 = Math.round(s.y - 10), img = b.getImageData(x0, y0, 21, 21), d = img.data;
    for (const j of s.pix) { T.ter[j] = 2; const x = j % WW, y = j / WW | 0, c = MUD[(hash(x, y, 100) * 3) | 0], k = ((y - y0) * 21 + x - x0) * 4; if (k >= 0 && k < d.length) { d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; } }
    b.putImageData(img, x0, y0); ev.spots.splice(q, 1);
  }
  // the lava tongue over the serpentine: it glows, then it covers one half of the road for a while, then the other place
  if (ev.tongues && ev.tongues.length) {
    const k = Math.floor(e.t / TONGUE.per) % ev.tongues.length, u = phase(e.t, TONGUE.per), on = u >= TONGUE.warn && u < TONGUE.warn + TONGUE.on;
    ev.tongues.forEach((Tg, q) => { const want = q === k && on; if (want !== !!Tg.on) { Tg.on = want; for (const j of Tg.pix) T.ter[j] = want ? 15 : 1; } Tg.warn = q === k && u < TONGUE.warn; });
    ev.tongue = ev.tongues[k];
  }
  // the last lap: sparks rain down over the whole map
  if (G.player && G.player.lap >= LAPS && Math.random() < dt * 30) addP({ t: 'd', x: cam.x + Math.random() * VW, y: cam.y + Math.random() * VH, z: 60, vx: (Math.random() - .5) * 20, vy: 10, vz: -20, col: ['#ff7a1a', '#ffd04a', '#ff4a1a'][(Math.random() * 3) | 0], s: 1, life: 1.4, ml: 1.4 });
}

// a picture of lava over some pixels (lava spots, the tongue)
function lavaPic(pix) {
  if (!pix.length) return null;
  let x0 = WW, y0 = WH, x1 = 0, y1 = 0; for (const j of pix) { const x = j % WW, y = j / WW | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const W = x1 - x0 + 1, H = y1 - y0 + 1, cv = mk(W, H), g = cv.getContext('2d'), img = g.createImageData(W, H), q = img.data;
  for (const j of pix) {
    const x = j % WW, y = j / WW | 0, v = vnoise(x / 6, y / 6, 101), c = v > .7 ? [255, 208, 74] : v > .4 ? [255, 162, 31] : [255, 122, 26], k = ((y - y0) * W + x - x0) * 4;
    q[k] = c[0]; q[k + 1] = c[1]; q[k + 2] = c[2]; q[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return { c: cv, x: x0, y: y0 };
}

// ======================================================= drawing

const inView = (x, y, m = 40) => x > cam.x - m && x < cam.x + VW + m && y > cam.y - m && y < cam.y + VH + m;

export function drawVolcanoGround() {
  const T = G.T, V = T.volcano, ev = T.ev, k = Math.floor(G.time * 4);
  // the lava shimmers, the cracks in the road glow on and off
  for (let q = 0; q < 50 && V.lavaPix.length; q++) { const p = V.lavaPix[(hash(q, k, 102) * V.lavaPix.length) | 0]; R1(p % WW, (p / WW) | 0, 2, 1, q % 3 ? '#ffe27a' : '#fff4c0'); }
  for (let q = 0; q < 14 && V.glowPix.length; q++) { const p = V.glowPix[(hash(q, Math.floor(G.time * 2), 103) * V.glowPix.length) | 0]; R1(p % WW, (p / WW) | 0, 1, 1, '#ff9a4a'); }
  // bubbles burst on the crater lake
  const [cx, cy, crx, cry] = V.crater;
  if (inView(cx, cy, 120)) for (let q = 0; q < 6; q++) {
    const ph = (G.time * .7 + q * .37) % 1, a = hash(q, Math.floor(G.time * .7 + q * .37), 104) * TAU, rr = Math.sqrt(hash(q, Math.floor(G.time * .7 + q * .37), 105)) * .7;
    const x = Math.round(cx + Math.cos(a) * crx * rr), y = Math.round(cy + Math.sin(a) * cry * rr), r = Math.round(1 + ph * 4);
    if (ph < .8) { ctx.globalAlpha = .9; disc(x, y, r, '#ffd04a'); R1(x - 1, y - r, 2, 1, '#fff4c0'); } else { ctx.globalAlpha = 1 - (ph - .8) * 5; for (let s = 0; s < 6; s++) R1(Math.round(x + Math.cos(s) * 6), Math.round(y + Math.sin(s) * 6), 1, 1, '#ffd04a'); }
    ctx.globalAlpha = 1;
  }
  // the crust: it glows up before the stream breaks through, then it is lava, then it cools down again
  const C = V.crust.pic;
  if (C && V.glow > 0) { ctx.globalAlpha = clamp(V.glow * (V.warn ? .75 + .25 * Math.sin(G.time * 20) : 1), 0, 1); ctx.drawImage(C.c, C.x, C.y); ctx.globalAlpha = 1; }
  // the ford: lava flooding over a bridge, a wave at its edge
  ev.lanes.forEach((L, q) => { const pic = V.lanes[q].pic; if (pic && L.flood > 0) { ctx.globalAlpha = L.flood; ctx.drawImage(pic.c, pic.x, pic.y); ctx.globalAlpha = 1; } });
  // the signal stone: a green lamp for the bridge that opens next, red for the other; it blinks before they swap
  const S = V.signal;
  if (inView(S.x, S.y)) {
    R1(S.x - 6, S.y - 8, 13, 16, '#1b120c'); R1(S.x - 5, S.y - 7, 11, 14, '#7a746c'); R1(S.x - 5, S.y - 7, 11, 2, '#9a948a');
    const bl = V.fordWarn && ((G.time * 6) | 0) % 2;
    V.lanes.forEach((L, q) => { const on = V.fordWarn ? q === V.next : q === V.open, y = S.y - 4 + q * 7; R1(S.x - 3, y, 6, 4, on ? (bl ? '#2a5a2a' : '#5fe36a') : '#e8452c'); });
  }
  // the lava tongue
  if (ev.tongues) for (const Tg of ev.tongues) if (Tg.pic && (Tg.on || Tg.warn)) { ctx.globalAlpha = Tg.on ? 1 : .25 + .2 * Math.sin(G.time * 18); ctx.drawImage(Tg.pic.c, Tg.pic.x, Tg.pic.y); ctx.globalAlpha = 1; }
  for (const s of ev.spots) if (s.pic) { ctx.globalAlpha = s.t > BOMB.spot - 1 ? BOMB.spot - s.t : 1; ctx.drawImage(s.pic.c, s.pic.x, s.pic.y); ctx.globalAlpha = 1; }
  // where a lava bomb will land: a red circle that gets smaller
  for (const b of ev.bombs) {
    if (!inView(b.x, b.y)) continue;
    const r = Math.round(BOMB.r * (1.6 - .6 * b.t / BOMB.warn)), bl = ((G.time * 10) | 0) % 2;
    ctx.fillStyle = bl ? '#ff3b2a' : '#ffd04a';
    for (let a = 0; a < TAU; a += .12) ctx.fillRect(Math.round(b.x + Math.cos(a) * r), Math.round(b.y + Math.sin(a) * r * .8), 2, 2);
    ctx.globalAlpha = .18; ell(Math.round(b.x), Math.round(b.y), BOMB.r, Math.round(BOMB.r * .8), '#ff3b2a'); ctx.globalAlpha = 1;
  }
  // the geyser bubbles before it blows
  const [gx, gy] = V.geyser;
  if (V.bubble && inView(gx, gy)) for (let q = 0; q < 4; q++) disc(Math.round(gx + Math.sin(G.time * 9 + q * 2) * 4), Math.round(gy + Math.cos(G.time * 7 + q) * 3), 1 + (((G.time * 8 + q) | 0) % 2), '#e8f2f8');
  // the waterfall: water running down the cliff into the pool
  const [fx, fy] = V.fall;
  if (inView(fx, fy, 60)) for (let x = fx - 8; x <= fx + 8; x++) for (let k2 = 0; k2 < 3; k2++) {
    const y = fy - 30 + ((G.time * 60 + hash(x, k2, 106) * 30) % 24);
    R1(x, Math.round(y), 1, 3, k2 ? '#9edcf0' : '#ffffff');
  }
  // the station: the needle of the seismograph jumps when it rumbles, the researcher waves
  const st = V.station;
  if (st && inView(st.x, st.y, 80)) {
    const s = st.seis, a = Math.sin(G.time * 40) * (ev.quake > 0 ? 4 : .6);
    R1(s.x - 1, s.y - 1, 11, 7, '#1b120c'); R1(s.x, s.y, 9, 5, '#f4f0e8'); R1(s.x + 4 + Math.round(a), s.y + 1, 1, 3, '#d83a2c');
    const m = st.man, w = ((G.time * 4) | 0) % 2;
    R1(m.x - 3, m.y - 2, 6, 7, '#1b120c'); R1(m.x - 2, m.y - 1, 4, 5, '#e8742a'); R1(m.x - 3, m.y - 6, 6, 4, '#1b120c'); R1(m.x - 2, m.y - 5, 4, 2, '#f2c230');
    R1(m.x + 3, m.y - 4 - w * 2, 1, 4, '#e8742a');
  }
}

// above the cars: the roof of the lava tube (dark inside, glowing cracks), the flying lava bombs, the smoke over the crater, the helicopter, "AUA, HEISS!"
let tubeDark = null;
export function drawVolcanoAbove() {
  const T = G.T, V = T.volcano, ev = T.ev, P = G.player, tb = V.tube;
  if (tb) {
    const N = T.N, inT = i => tb.i0 <= tb.i1 ? i >= tb.i0 && i <= tb.i1 : i >= tb.i0 || i <= tb.i1;
    if (P && inT(P.idx) && P.off < HALF + 6) {
      const g = (tubeDark && tubeDark.width === tb.W && tubeDark.height === tb.H ? tubeDark : (tubeDark = mk(tb.W, tb.H))).getContext('2d');
      g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, tb.W, tb.H); g.globalAlpha = 1; g.drawImage(tb.c, 0, 0);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(12,6,4,.78)'; g.fillRect(0, 0, tb.W, tb.H);
      g.globalCompositeOperation = 'destination-out';
      for (const c of G.cars) {
        if (c.fall > 0) continue;
        const x = c.x - tb.x, y = c.y - tb.y, fx = Math.cos(c.ang), fy = Math.sin(c.ang), nx = -fy, ny = fx;
        g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(x, y, 14, 0, TAU); g.fill();
        for (let q = 0; q < 3; q++) { const len = 70 - q * 16, half = 26 - q * 6; g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.moveTo(x + fx * 8 + nx * 4, y + fy * 8 + ny * 4); g.lineTo(x + fx * len + nx * half, y + fy * len + ny * half); g.lineTo(x + fx * len - nx * half, y + fy * len - ny * half); g.lineTo(x + fx * 8 - nx * 4, y + fy * 8 - ny * 4); g.closePath(); g.fill(); }
      }
      for (const cr of tb.cracks) { g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.arc(cr.x - tb.x, cr.y - tb.y, 7, 0, TAU); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      ctx.drawImage(tubeDark, tb.x, tb.y);
      for (const cr of tb.cracks) if (hash(cr.x, cr.y, Math.floor(G.time * 3)) < .5) R1(cr.x, cr.y, 1, 1, '#ffb050');
      // bats flutter away from the light
      for (let q = 0; q < 4; q++) {
        const ph = (G.time * .5 + q * .25) % 1, x = Math.round(P.x + Math.cos(q * 1.7) * (20 + ph * 90)), y = Math.round(P.y + Math.sin(q * 1.7) * (14 + ph * 60) - ph * 10), w = ((G.time * 14 + q) | 0) % 2;
        R1(x - 1, y, 3, 2, '#1b120c'); R1(x - 4, y - w, 3, 1, '#1b120c'); R1(x + 2, y - w, 3, 1, '#1b120c');
      }
    } else ctx.drawImage(tb.c, tb.x, tb.y);
  }
  // lava bombs flying from the crater to their circle
  const [cx, cy] = V.crater;
  for (const b of ev.bombs) {
    const u = (b.t - (BOMB.warn - 1)) / 1; if (u < 0) continue;
    const x = cx + (b.x - cx) * u, y = cy + (b.y - cy) * u - Math.sin(u * Math.PI) * 120;
    for (let q = 1; q < 6; q++) { const v = Math.max(0, u - q * .04), tx = cx + (b.x - cx) * v, ty = cy + (b.y - cy) * v - Math.sin(v * Math.PI) * 120; ctx.globalAlpha = .5 - q * .08; disc(Math.round(tx), Math.round(ty), 2, '#ff7a1a'); }
    ctx.globalAlpha = 1; disc(Math.round(x), Math.round(y), 4, '#3a1a10'); disc(Math.round(x), Math.round(y), 3, '#ff7a1a'); R1(Math.round(x) - 1, Math.round(y) - 2, 2, 2, '#ffd04a');
  }
  // the volcano smokes; in the eruption a big dark column rises out of the crater
  if (inView(cx, cy, 160)) {
    const big = !!ev.erupt;
    for (let q = 0; q < (big ? 14 : 5); q++) {
      const ph = (G.time * (big ? .35 : .2) + q / (big ? 14 : 5)) % 1, x = cx + Math.sin(q * 2.1 + G.time * .3) * (10 + ph * 30) + ph * 30, y = cy - ph * (big ? 160 : 90);
      ctx.globalAlpha = (1 - ph) * (big ? .55 : .3); disc(Math.round(x), Math.round(y), Math.round((big ? 10 : 6) + ph * (big ? 22 : 12)), big ? '#3a3432' : '#8a8682');
    }
    ctx.globalAlpha = 1;
  }
  // in the eruption a helicopter circles over the crater
  if (ev.erupt) {
    const a = G.time * .5, x = Math.round(cx + Math.cos(a) * 150), y = Math.round(cy + Math.sin(a) * 90 - 20), rot = G.time * 30;
    ctx.globalAlpha = .2; ell(x + 20, y + 40, 8, 3, '#000'); ctx.globalAlpha = 1;
    R1(x - 6, y - 3, 12, 7, '#1b120c'); R1(x - 5, y - 2, 10, 5, '#d83a2c'); R1(x + 2, y - 2, 3, 3, '#8fd3f4'); R1(x - 14, y - 1, 9, 2, '#d83a2c');
    for (const s of [0, Math.PI / 2]) { const dx = Math.cos(rot + s) * 13, dy = Math.sin(rot + s) * 13; ctx.fillStyle = '#2a2a30'; for (let q = -1; q <= 1; q += .1) ctx.fillRect(Math.round(x + dx * q), Math.round(y - 4 + dy * q * .4), 1, 1); }
  }
  for (const c of G.cars) if (c.burnT > 0) text('AUA, HEISS!', Math.round(c.fx0 || c.x), Math.round((c.fy0 || c.y) - 24 - (1.3 - c.burnT) * 10), 8, '#ffb02e', 'center');
  if (V.warn && P && near(T.def.stream[0], 95) < 260 && ((G.time * 5) | 0) % 2) text('HEISS!', T.def.stream[0], 66, 8, '#ff6b3a', 'center');
}

// on the screen: the red sky and the ash rain of the eruption, and your heat
export function drawVolcanoSky(cx, cy) {
  const ev = G.T.ev, P = G.player;
  if (ev && ev.erupt) {
    ctx.fillStyle = 'rgba(110,24,0,' + Math.min(.2, ev.erupt.t * .1).toFixed(3) + ')'; ctx.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 90; i++) {
      const x = ((hash(i, 2, 107) * (VW + 40) + Math.sin(G.time * .6 + i) * 8 - cx * .3) % (VW + 40) + VW + 40) % (VW + 40) - 20;
      const y = ((hash(i, 3, 107) * (VH + 20) + G.time * (10 + hash(i, 1, 107) * 14) - cy * .3) % (VH + 20) + VH + 20) % (VH + 20) - 10;
      ctx.globalAlpha = .5 + hash(i, 4, 107) * .4; R1(Math.round(x), Math.round(y), 1 + (i % 4 === 0 ? 1 : 0), 1, i % 3 ? '#8a8682' : '#5a5652');
    }
    ctx.globalAlpha = 1;
  }
  // the thermometer: under the bar at the top left; it flashes red when the car is too hot
  if (P && !G.T.run && (G.state === 'race' || G.state === 'countdown')) {
    const h = P.heat || 0, x = 8, y = 22, hgt = 36, hot = P.hot && ((G.time * 6) | 0) % 2;
    R1(x - 1, y - 1, 7, hgt + 2, '#1b120c'); R1(x, y, 5, hgt, '#f4f0e8');
    const f = Math.round(hgt * h); R1(x + 1, y + hgt - f, 3, f, h > .75 ? '#e8452c' : h > .4 ? '#ffb02e' : '#5ab4ff');
    disc(x + 2, y + hgt + 3, 4, '#1b120c'); disc(x + 2, y + hgt + 3, 3, hot ? '#ffffff' : h > .75 ? '#e8452c' : '#5ab4ff');
    if (P.hot) text('HEISS', x + 10, y + hgt - 4, 8, hot ? '#ffffff' : '#e8452c');
  }
}
