import { G } from './g.js';
import { SFX } from './audio.js';
import { HALF, TAU, VH, VW, clamp, ctx, hash, hex, mk, smooth, vnoise } from './core.js';
import { R1, disc, text } from './gfx.js';
import { snap } from './undo.js';
import { addP, drop } from './particles.js';
import { cam } from './state.js';
import { canyonX } from './desertmap.js';
import { fallCar, near, sinkInSand } from './trackfx.js';
import { tctx } from './tracks.js';

// ---------- Wueste while racing: cacti that sting, the gorge (the computer cars choose the jump or the long way to the rope bridge), the oasis
// on its side path (dirty computer cars go there to wash), the dark pyramid, and the event "sandsturm": from lap 2 a wall of sand sweeps in from
// the right, then you see less, sand whirls up round the cars and slowly makes them sandy, and sand drifts onto the road in three places (not in
// the pyramid). The fields of T.ev all start with ds (T22); the gorge and the quicksand are in the ground hook. ----------

const STORM = { wall: 6, sandy: .035 };

// ======================================================= always: cacti, dusty dunes

function initDesert(T) {
  const ev = T.ev;
  ev.dsCacti = T.desert.cacti.map(c => ({ x: c.x, y: c.y, r: c.r, cool: 0, ouch: 0 }));
  ev.obst = ev.dsCacti; ev.dsStorm = null; ev.dsStormOn = false;
}

// is (x, y) inside the big pyramid (no storm in there)
const inPyr = (py, x, y, m = 2) => !!py && Math.abs(x - py.cx) < py.hs - m && Math.abs(y - py.cy) < py.hs - m;

function desertUpdate(T, dt) {
  const ev = T.ev, D = T.desert;
  for (const k of ev.dsCacti) { k.cool = Math.max(0, k.cool - dt); k.ouch = Math.max(0, k.ouch - dt); }
  // the pyramid: is your car inside (then its roof is see-through)
  const P = G.player;
  D.inside = !!P && inPyr(D.pyr, P.x, P.y);
  if (ev.dsStormOn) updateStorm(T, dt);
  // a crooked landing makes the car spin (the sand takes the wheels)
  for (const c of G.cars) {
    if (c.fall > 0) continue;
    if (c.z > 0) c.dsAir = true;
    else if (c.dsAir) { c.dsAir = false; crookedLanding(c); }
  }
}

// a crooked landing: the car points away from where it flies, at speed the sand grabs the wheels and it spins round (nobody falls, but it costs)
function crookedLanding(c) {
  const sp = Math.hypot(c.vx, c.vy), mv = Math.atan2(c.vy, c.vx), d = Math.atan2(Math.sin(c.ang - mv), Math.cos(c.ang - mv));
  if (sp < 45 || Math.abs(d) < .38 || c.stun) return;
  c.stun = .55; c.spin = Math.sign(d) * 8; c.boost = 0; c.vx *= .6; c.vy *= .6;
  for (let i = 0; i < 12; i++) drop(c.x, c.y, Math.random() * TAU, 30 + Math.random() * 50, 30 + Math.random() * 40, ['#e3c48c', '#d4b074', '#f0d9a6'][i % 3], .9, false);
}

// on the dunes the car gets sandy (and throws up sand)
function desertGround(c, j, sp, dt) {
  const D = G.T.desert;
  if (c.surf === 11) { fallCar(c, 'abyss', D.landI); return; } // no ground in the gorge: set down behind it
  if (c.surf === 10) sinkInSand(c, D.quick, false, dt, true);       // quicksand: it pulls to the middle and swallows
  if (c.surf === 0 && c.z <= 0) {
    c.dirt = Math.min(1, c.dirt + .16 * dt * (sp > 8 ? 1 : .2));
    if (sp > 25 && Math.random() < dt * 18) drop(c.x - Math.cos(c.ang) * 12, c.y - Math.sin(c.ang) * 12, c.ang + Math.PI + (Math.random() - .5) * 1.4, 20 + Math.random() * 40, 30 + Math.random() * 40, ['#e3c48c', '#d4b074', '#f0d9a6'][(Math.random() * 3) | 0], .9, false);
  }
}

// cacti on the road: a hard hit makes you spin (spines fly, "AUTSCH!"), a slow touch only pushes you back
function desertCollisions() {
  const ev = G.T.ev; if (!ev || !ev.dsCacti) return;
  for (const k of ev.dsCacti) for (const c of G.cars) {
    if (c.z > 3 || c.fall > 0 || c.ghost > 0) continue;
    const dx = c.x - k.x, dy = c.y - k.y, d = Math.hypot(dx, dy), mn = k.r + 9;
    if (d >= mn || d === 0) continue;
    const nx = dx / d, ny = dy / d, vn = c.vx * nx + c.vy * ny;
    c.x = k.x + nx * mn; c.y = k.y + ny * mn;
    if (vn < -45 && !c.stun) {
      c.vx = nx * 90; c.vy = ny * 90; c.spin = 8; c.stun = .6; c.boost = 0;
      for (let i = 0; i < 12; i++) addP({ t: 'd', x: k.x, y: k.y, z: 6, vx: Math.cos(i / 12 * TAU) * 70, vy: Math.sin(i / 12 * TAU) * 70, vz: 40, col: i % 2 ? '#f4f0d0' : '#3f9a4a', s: 1, life: .5, ml: .5 });
      if (k.cool <= 0) { k.cool = 1.2; k.ouch = 1.1; const v = c.ai ? clamp(1 - near(k.x, k.y) / 300, 0, .5) : 1; if (v > .02) SFX.ouch(v); }
    } else if (vn < 0) { c.vx -= 1.5 * vn * nx; c.vy -= 1.5 * vn * ny; }
  }
}

// ======================================================= the computer cars: the side paths, quicksand and the gorge

// the side paths: a sandy car turns off to the oasis and washes; at the gorge the car that chose the bridge (or is too slow for the jump) takes
// the long way. Then it follows the path to its end.
function desertTarget(c) {
  // (also after the finish: the cars drive on and would otherwise jump too slowly)
  const T = G.T, D = T.desert, N = T.N; if (G.state !== 'race' && G.state !== 'finish') { c.dsWay = null; return null; }
  if (!c.dsWay) {
    const sp = Math.hypot(c.vx, c.vy);
    for (const [P, i0, want] of [[D.oasisP, D.oasisI, c.dirt > .35], [D.bridgeP, D.bridgeI, c.route === 'bridge' || sp < 100]]) {
      // (shortly before the turn-off, or just past its point on the centre line while still near it: a car on the inside of the bend is
      // counted further on)
      const ahead = (i0 - c.idx + N) % N, past = (c.idx - i0 + N) % N;
      if (P.length && want && (ahead < 24 || (past < 25 && Math.hypot(c.x - P[0].x, c.y - P[0].y) < 70))) { c.dsWay = { P, k: 0 }; break; }
    }
    if (!c.dsWay) return null;
  }
  const W = c.dsWay, P = W.P; let k = W.k, bd = 1e9;
  for (let q = W.k; q < Math.min(P.length, W.k + 30); q++) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  W.k = k;
  if (k >= P.length - 4 || bd > 70 * 70) { c.dsWay = null; return null; }
  const t = P[Math.min(P.length - 1, k + 9)];
  return [t.x, t.y];
}

// lane (offset from the centre line) for a computer car looking at point i of the centre line: everybody keeps away from the quicksand;
// at the gorge they choose the jump or the long way to the rope bridge
function desertLane(c, i, lane) {
  const T = G.T, D = T.desert, N = T.N, C = D.canyon, p = T.path[i], n = T.nrm[i];
  // the gorge: decide for the jump or the rope bridge in time (easy: bridge, hard: jump), then stick to it (desertTarget takes the bridge)
  const ahead = (D.rampI - c.idx + N) % N, past = (c.idx - D.rampI + N) % N;
  if (C && (ahead < 90 || past < 24)) {
    if (ahead >= 60 && ahead < 90) {
      const diff = G.raceDiff || 0, brave = diff === 2 || (diff === 1 && (c.seed * 3.7) % 1 < .5) || (diff === 0 && (c.seed * 3.7) % 1 < .15);
      c.route = brave ? 'jump' : 'bridge';
    }
    // the ramp is as wide as the road: straight over the middle of it (a straight landing)
    return lane * smooth(clamp((ahead - 20) / 50, 0, 1));
  }
  // quicksand: never near it (the car is 18 wide: look 8 px to both sides of the lane too, or the slow cars brush the rim, are pulled in and sink)
  const qs = l => [l - 8, l, l + 8].some(m => { const x = (p.x + n.x * m) | 0, y = (p.y + n.y * m) | 0; return x >= 0 && y >= 0 && x < T.W && y < T.H && T.ter[y * T.W + x] === 10; });
  if (qs(lane)) for (const l of [lane + 14, lane - 14, lane + 24, lane - 24, 20, -20, 26, -26]) if (Math.abs(l) <= 27 && !qs(l)) return l;
  return lane;
}

// ======================================================= event "sandsturm"

function initStorm(T) { T.ev.dsStormOn = true; }

function updateStorm(T, dt) {
  const ev = T.ev;
  if (!ev.dsStorm) {
    if (!G.player || G.player.lap < 2) return;
    ev.dsStorm = { t: 0, drift: 0, snd: 0 };
    snap(T, 0, 0, T.W, T.H); // drifts change the ground; this puts it back after the race
    SFX.storm();
  }
  const s = ev.dsStorm; s.t += dt;
  const p = Math.min(1, s.t / STORM.wall), wx = T.W + 40 - p * (T.W + 80), py = T.desert.pyr;
  if ((s.snd -= dt) <= 0) { s.snd = 5.5; SFX.windLoop(); }
  // the drifts: one after the other, once the wall has passed
  const D = T.def.drifts || [];
  while (s.drift < D.length && s.t > STORM.wall + .5 + s.drift * 1.3) { paintDrift(T, D[s.drift]); s.drift++; }
  // the sand whirls up round every car the wall has reached and slowly makes it sandy (the oasis washes it off); not in the pyramid
  for (const c of G.cars) {
    if (c.fall > 0 || c.x < wx || inPyr(py, c.x, c.y)) continue;
    c.dirt = Math.min(1, c.dirt + STORM.sandy * dt);
  }
  // the storm blows the tyre tracks away
  tctx.globalCompositeOperation = 'destination-out'; tctx.globalAlpha = Math.min(1, dt * .5 * p); tctx.fillStyle = '#000'; tctx.fillRect(0, 0, T.W, T.H);
  tctx.globalCompositeOperation = 'source-over'; tctx.globalAlpha = 1;
}

// a drift of sand on the road: soft like mud, it makes the car sandy
function paintDrift(T, [cx, cy, r]) {
  const b = T.base.getContext('2d'), x0 = Math.max(0, cx - r * 2), y0 = Math.max(0, cy - r * 2), w = Math.min(T.W - x0, r * 4), h = Math.min(T.H - y0, r * 4), img = b.getImageData(x0, y0, w, h), d = img.data;
  const MUD = T.th.mud.map(hex), E = hex(T.th.mudEdge), hit = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const j = y * T.W + x, t = T.ter[j]; if (t !== 1 && t !== 0) continue;
    const dx = (x + .5 - cx) / (r * 1.5), dy = (y + .5 - cy) / r, e = dx * dx + dy * dy, lim = .8 + .4 * vnoise(x * .15, y * .15, 83);
    if (e >= lim) continue;
    T.ter[j] = 2; hit.push(j);
    const rip = Math.sin(x * .3 + y * .7), c = e > lim * .82 ? E : rip > .6 ? MUD[2] : rip < -.5 ? MUD[1] : MUD[0];
    const k = ((y - y0) * w + x - x0) * 4; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2];
  }
  b.putImageData(img, x0, y0);
  if (near(cx, cy) < 300) SFX.trickle();
}

// ======================================================= drawing

// on the ground: the quicksand turns (a whirl of dark and light sand towards its middle, which is beside the road), the rope bridge swings
function drawDesertGround() {
  const T = G.T, D = T.desert;
  for (const [qx, qy, qr] of D.quick) {
    if (Math.abs(qx - cam.x - VW / 2) > VW / 2 + 40 || Math.abs(qy - cam.y - VH / 2) > VH / 2 + 40) continue;
    for (let k = 0; k < 4; k++) for (let a = 0; a < TAU; a += .16) {
      const rr = qr * (.18 + k * .19), an = a + G.time * (1.4 - k * .25) + rr * .14;
      if (((a * 6.25) | 0) % 3 === 2) continue; // (broken rings: they look like turning arms)
      R1(Math.round(qx + Math.cos(an) * rr), Math.round(qy + Math.sin(an) * rr), 2, 1, k % 2 ? '#5e3e1e' : '#d8b47a');
    }
    disc(qx, qy, 3, '#4a3018'); disc(qx, qy, 1, '#2a1a0c');
  }
  const C = D.canyon;
  if (C && near(C.x, C.bridge) < 330) {
    // the rope bridge: planks hanging between two ropes; it swings, more when somebody drives on it
    const cx = canyonX(C, C.bridge), busy = G.cars.some(c => c.surf === 14), x0 = Math.round(cx - C.hw - 2), x1 = Math.round(cx + C.hw + 2);
    for (let x = x0; x <= x1; x += 4) {
      const u = (x - x0) / (x1 - x0), sag = Math.sin(u * Math.PI), sw = Math.round(Math.sin(G.time * (busy ? 9 : 2.5) + u * 3) * sag * (busy ? 2.2 : 1));
      R1(x, C.bridge - C.bh + 1 + sw, 3, C.bh * 2 - 1, (x >> 2) % 3 ? '#a8743c' : '#8a5a2c'); R1(x + 3, C.bridge - C.bh + 1 + sw, 1, C.bh * 2 - 1, '#3a2410');
    }
    for (const s of [-1, 1]) for (let x = x0 - 3; x <= x1 + 3; x++) {
      const u = clamp((x - x0) / (x1 - x0), 0, 1), sw = Math.round(Math.sin(G.time * (busy ? 9 : 2.5) + u * 3) * Math.sin(u * Math.PI) * (busy ? 2.2 : 1));
      R1(x, C.bridge + s * (C.bh + 1) + sw, 1, 1, '#d8b878');
    }
  }
}

// above the cars: the roof of the pyramid (see-through from inside, dark inside with torches), the vulture, "AUTSCH!"
function drawDesertAbove(cx, cy) {
  const T = G.T, D = T.desert, ev = T.ev, py = D.pyr;
  if (py) {
    if (D.inside) {
      // inside: deep dark beside the road, only dim over it (you always see the way); a few torches and the cars' lamps light it a little
      const W = py.W, dkc = D.dark || (D.dark = mk(W, W)), g = dkc.getContext('2d');
      g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, W); g.drawImage(py.dark, 0, 0);
      g.globalCompositeOperation = 'destination-out';
      for (const t of py.torches) { const fl = .85 + .15 * Math.sin(G.time * 13 + t.k); g.fillStyle = 'rgba(0,0,0,' + .4 * fl + ')'; g.beginPath(); g.arc(t.x - py.x, t.y - py.y, 14, 0, TAU); g.fill(); }
      for (const c of G.cars) {
        if (c.fall > 0) continue;
        const x = c.x - py.x, y = c.y - py.y, fx = Math.cos(c.ang), fy = Math.sin(c.ang), nx = -fy, ny = fx;
        g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(x, y, 15, 0, TAU); g.fill();
        if (c !== G.player) continue;
        g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); // (only your own lamps: one soft cone, not a tangle of lights)
        g.moveTo(x + fx * 8 + nx * 5, y + fy * 8 + ny * 5); g.lineTo(x + fx * 64 + nx * 22, y + fy * 64 + ny * 22); g.lineTo(x + fx * 64 - nx * 22, y + fy * 64 - ny * 22); g.lineTo(x + fx * 8 - nx * 5, y + fy * 8 - ny * 5); g.closePath(); g.fill();
      }
      ctx.drawImage(dkc, py.x, py.y);
      for (const t of py.torches) {
        const x = Math.round(t.x), y = Math.round(t.y), f = ((G.time * 10 + t.k) | 0) % 2;
        R1(x - 1, y, 2, 4, '#5a3a1c'); R1(x - 1, y - 3 - f, 3, 3, '#ffb22e'); R1(x, y - 2 - f, 1, 2, '#fff1a8');
        ctx.globalAlpha = .15; disc(x, y - 2, 5, '#ffb22e'); ctx.globalAlpha = 1;
      }
      // scarabs crawl along the walls
      for (let k = 0; k < 5; k++) {
        const t = py.torches[k % Math.max(1, py.torches.length)]; if (!t) break;
        const a = G.time * .7 + k * 1.7, x = Math.round(t.x + Math.cos(a) * 9), y = Math.round(t.y + 8 + Math.sin(a * 1.3) * 3);
        R1(x - 1, y - 1, 3, 3, '#1b120c'); R1(x, y - 1, 1, 2, '#2fa6b2');
      }
    } else ctx.drawImage(py.c, py.x, py.y);
  }
  // a vulture circles over the desert, its shadow on the ground
  const va = G.time * .25, vx = 400 + Math.cos(va) * 170, vy = 280 + Math.sin(va) * 110;
  if (near(vx, vy) < 360) {
    const flap = ((G.time * 3) | 0) % 2, dir = -Math.sin(va) > 0 ? 1 : -1;
    ctx.globalAlpha = .18; R1(Math.round(vx + 26) - 8, Math.round(vy + 36), 17, 3, '#000'); ctx.globalAlpha = 1;
    const x = Math.round(vx), y = Math.round(vy);
    R1(x - 9, y - (flap ? 2 : 0), 7, 2, '#3a2a20'); R1(x + 3, y - (flap ? 2 : 0), 7, 2, '#3a2a20'); R1(x - 2, y - 1, 5, 4, '#2a1c14'); R1(x + dir * 3, y - 2, 2, 2, '#e8c0a0');
  }
  if (ev && ev.dsCacti) for (const k of ev.dsCacti) if (k.ouch > 0) text('AUTSCH!', Math.round(k.x), Math.round(k.y - 16 - (1.1 - k.ouch) * 8), 8, '#ffd23f', 'center');
}

// the heat over the long straights (ANALYSE I18): a few rows of the picture are pushed a pixel to the side in slow waves, the air shimmers
// lightly over the sand road. Not in the storm (it is cooler and you see less anyway).
function drawHeat(cx, cy) {
  const D = G.T.desert, ev = G.T.ev; if (!D.heat.length || (ev && ev.dsStorm) || !ctx) return;
  const src = ctx.canvas, t = G.time * 2.2;
  for (const [x0, y0, x1, y1] of D.heat) {
    const sx0 = Math.max(0, x0 - cx), sx1 = Math.min(VW, x1 - cx), sy0 = Math.max(0, y0 - cy), sy1 = Math.min(VH, y1 - cy);
    if (sx1 - sx0 < 4 || sy1 - sy0 < 2) continue;
    const edge = (y, a, b) => clamp(Math.min(y - a, b - y) / 10, 0, 1); // (fades out towards the top and bottom of the zone)
    for (let y = Math.ceil(sy0); y < sy1 - 1; y += 2) {
      // (only where the wave is near its top: most rows stay still, a band of shifted rows wanders slowly over the road)
      const off = Math.trunc(Math.sin((y + cy) * .21 + t + Math.sin((y + cy) * .05 + t * .3) * 2) * 1.15 * edge(y + cy, y0, y1));
      if (off) ctx.drawImage(src, sx0, y, sx1 - sx0, 2, sx0 + off, y, sx1 - sx0, 2);
    }
  }
}

function drawDesertSky(cx, cy) { drawHeat(cx, cy); drawStorm(cx, cy); }

// the sandstorm on the screen: an ochre wall that comes in from the right, then a haze of sand where you see less far, sand whirling up round
// the cars; the inside of the pyramid stays clear
const fog = mk(VW, VH), fctx = fog.getContext('2d');
function drawStorm(cx, cy) {
  const ev = G.T.ev, s = ev && ev.dsStorm; if (!s) return;
  const p = Math.min(1, s.t / STORM.wall), wx = Math.round(G.T.W + 40 - p * (G.T.W + 80) - cx), py = G.T.desert.pyr;
  if (wx >= VW) return;
  fctx.globalCompositeOperation = 'source-over'; fctx.clearRect(0, 0, VW, VH);
  fctx.fillStyle = 'rgba(184,138,74,.5)'; fctx.fillRect(Math.max(0, wx), 0, VW, VH);
  fctx.globalCompositeOperation = 'destination-out';
  fctx.fillStyle = '#000'; if (py) fctx.fillRect(py.x - cx, py.y - cy, py.W, py.W);
  const s0 = G.T.path[0]; fctx.fillRect(s0.x - HALF - 4 - cx, s0.y - 7 - cy, HALF * 2 + 8, 14); // (the finish line always stays clear)
  for (const c of G.cars) {
    const x = c.x - cx, y = c.y - cy; if (x < -80 || x > VW + 80 || y < -80 || y > VH + 80 || c.fall > 0) continue;
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang), nx = -fy, ny = fx;
    for (const [r, a] of [[30, .3], [18, .4]]) { fctx.fillStyle = 'rgba(0,0,0,' + a + ')'; fctx.beginPath(); fctx.arc(x, y, r, 0, TAU); fctx.fill(); }
    fctx.fillStyle = 'rgba(0,0,0,.35)'; fctx.beginPath();
    fctx.moveTo(x + fx * 8 + nx * 6, y + fy * 8 + ny * 6); fctx.lineTo(x + fx * 90 + nx * 34, y + fy * 90 + ny * 34); fctx.lineTo(x + fx * 90 - nx * 34, y + fy * 90 - ny * 34); fctx.lineTo(x + fx * 8 - nx * 6, y + fy * 8 - ny * 6); fctx.closePath(); fctx.fill();
  }
  ctx.drawImage(fog, 0, 0);
  // the front of the wall: billowing clouds; and a few sand streaks drifting to the left (not over the pyramid)
  if (p < 1) for (let k = 0; k < 14; k++) { const y = k * VH / 13, r = 18 + 8 * Math.sin(G.time * 2 + k); ctx.globalAlpha = .55; disc(wx + Math.round(Math.sin(G.time * 3 + k * 1.7) * 6), Math.round(y), Math.round(r), '#c49a5c'); }
  ctx.globalAlpha = .4; ctx.fillStyle = '#f0d9a6';
  for (let i = 0; i < 50; i++) {
    const x = ((hash(i, 1, 85) * (VW + 60) - G.time * 200 * (.7 + hash(i, 2, 85) * .6)) % (VW + 60) + VW + 60) % (VW + 60) - 30, y = hash(i, 3, 85) * VH;
    if (x < wx || inPyr(py, x + cx, y + cy, -2)) continue; ctx.fillRect(Math.round(x), Math.round(y), 4 + (i % 3) * 2, 1);
  }
  // the sand whirls up round the cars: grains spiral round each car and rise (higher on screen), then start again
  for (const c of G.cars) {
    const x = c.x - cx, y = c.y - cy; if (x < -30 || x > VW + 30 || y < -30 || y > VH + 30 || c.fall > 0 || c.x - cx < wx || inPyr(py, c.x, c.y)) continue;
    for (let k = 0; k < 10; k++) {
      const u = (G.time * .9 + k / 10 + c.seed) % 1, a = k * 2.4 + G.time * 7 + c.seed * 5, r = 8 + u * 12;
      ctx.globalAlpha = .7 * (1 - u); ctx.fillStyle = k % 2 ? '#f0d9a6' : '#c49a5c';
      ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * .5 - u * 14), 2, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// ---------- hooks: how the core calls this track (hooks.js; what each hook does: _template.js) ----------
/** @type {import('./_template.js').TrackHooks} */
export const desertHooks = {
  init: initDesert, events: { sandsturm: initStorm }, update: desertUpdate, collisions: desertCollisions, target: desertTarget, lane: desertLane, ground: desertGround,
  drawGround: drawDesertGround, drawAbove: drawDesertAbove, drawSky: drawDesertSky,
};
