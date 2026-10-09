import { G } from './g.js';
import { SFX } from './audio.js';
import { HALF, TAU, VH, VW, WH, WW, clamp, ctx, hash, hex, mk, vnoise } from './core.js';
import { DIFFS } from './diff.js';
import { R1, disc, text, tri } from './draw.js';
import { snap } from './events.js';
import { addP, drop } from './particles.js';
import { cam } from './state.js';
import { canyonX } from './desertmap.js';
import { near } from './trackfx.js';
import { tctx } from './tracks.js';

// ---------- Wueste while racing: cacti that sting, the gorge (the computer cars choose the jump or the rope bridge), the dark pyramid,
// and the event "sandsturm": from lap 2 a wall of sand sweeps in from the right, then you only see a little in front of you, the wind
// pushes everybody to the left (gusts come with a warning), sand drifts onto the road in five places, tumbleweeds roll across ----------

const STORM = { wall: 6, gusts: 1.6 };

// ======================================================= always: cacti, dusty dunes

export function initDesert(T) {
  const ev = T.ev;
  ev.cacti = T.desert.cacti.map(c => ({ x: c.x, y: c.y, r: c.r, cool: 0, ouch: 0 }));
  ev.tumble = []; ev.obst = ev.cacti.slice(); ev.storm = null; ev.wind = { x: 0, y: 0 }; ev.gust = 0; ev.warn = 0;
}

export function desertUpdate(T, dt) {
  const ev = T.ev, D = T.desert;
  for (const k of ev.cacti) { k.cool = Math.max(0, k.cool - dt); k.ouch = Math.max(0, k.ouch - dt); }
  // the pyramid: is your car inside (then its roof is see-through)
  const P = G.player, py = D.pyr;
  D.inside = !!(P && py && Math.abs(P.x - py.cx) < py.hs - 2 && Math.abs(P.y - py.cy) < py.hs - 2);
  if (ev.stormOn) updateStorm(T, dt);
  ev.obst = ev.tumble.length ? ev.cacti.concat(ev.tumble) : ev.cacti;
}

// on the dunes the car gets sandy (and throws up sand)
export function desertGround(c, sp, dt) {
  if (c.surf === 0 && c.z <= 0) {
    c.dirt = Math.min(1, c.dirt + .16 * dt * (sp > 8 ? 1 : .2));
    if (sp > 25 && Math.random() < dt * 18) drop(c.x - Math.cos(c.ang) * 12, c.y - Math.sin(c.ang) * 12, c.ang + Math.PI + (Math.random() - .5) * 1.4, 20 + Math.random() * 40, 30 + Math.random() * 40, ['#e3c48c', '#d4b074', '#f0d9a6'][(Math.random() * 3) | 0], .9, false);
  }
}

// cacti on the road: a hard hit makes you spin (spines fly, "AUTSCH!"), a slow touch only pushes you back.
// Tumbleweeds are soft: a little push, nothing more.
export function desertCollisions() {
  const ev = G.T.ev; if (!ev || !ev.cacti) return;
  for (const k of ev.cacti) for (const c of G.cars) {
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
  for (const w of ev.tumble) for (const c of G.cars) {
    if (c.z > 0 || c.fall > 0) continue;
    const dx = c.x - w.x, dy = c.y - w.y, d = Math.hypot(dx, dy); if (d >= 15 || d === 0) continue;
    c.vx += dx / d * 40 + w.vx * .2; c.vy += dy / d * 40;
    w.vx = -Math.abs(w.vx) * .6 - 20; w.vy += (dy > 0 ? -1 : 1) * 40; w.hop = 1;
    if (!c.ai) SFX.tumble();
  }
}

// ======================================================= the computer cars: quicksand and the gorge

// lane (offset from the centre line) for a computer car looking at point i of the centre line
export function desertLane(c, i, lane) {
  const T = G.T, D = T.desert, N = T.N, C = D.canyon, p = T.path[i], n = T.nrm[i];
  // the gorge: decide for the jump or the rope bridge in time (easy: bridge, hard: jump; too slow: bridge), then stick to it
  const ahead = (D.rampI - c.idx + N) % N, past = (c.idx - D.rampI + N) % N;
  if (C && (ahead < 90 || past < 24)) {
    if (ahead >= 60 && ahead < 90) {
      const diff = G.raceDiff || 0, brave = diff === 2 || (diff === 1 && (c.seed * 3.7) % 1 < .5) || (diff === 0 && (c.seed * 3.7) % 1 < .15);
      c.route = brave ? 'jump' : 'bridge';
    }
    const sp = Math.hypot(c.vx, c.vy);
    if (c.route === 'jump' && ahead > 4 && ahead < 22 && sp < 84) c.route = 'bridge';
    const ym = c.route === 'jump' ? (C.lane[0] + C.lane[1]) / 2 + 2 : C.bridge;
    // the centre line runs along y = 390 there (going left): the offset to y is measured along the normal
    return clamp((ym - p.y) / (n.y || 1), -40, 40);
  }
  // quicksand: never towards its middle
  const qs = l => { const x = (p.x + n.x * l) | 0, y = (p.y + n.y * l) | 0; return x >= 0 && y >= 0 && x < WW && y < WH && T.ter[y * WW + x] === 10; };
  if (qs(lane)) for (const l of [lane + 14, lane - 14, lane + 24, lane - 24, 26, -26]) if (Math.abs(l) < 28 && !qs(l)) return l;
  return lane;
}

// ======================================================= event "sandsturm"

export function initStorm(T) { T.ev.stormOn = true; }

function updateStorm(T, dt) {
  const ev = T.ev;
  if (!ev.storm) {
    if (!G.player || G.player.lap < 2) return;
    ev.storm = { t: 0, drift: 0, snd: 0, nextT: 3, gustN: 0 };
    snap(T, 0, 0, WW, WH); // drifts change the ground; this puts it back after the race
    SFX.storm();
  }
  const s = ev.storm; s.t += dt;
  const p = Math.min(1, s.t / STORM.wall);
  if ((s.snd -= dt) <= 0) { s.snd = 5.5; SFX.windLoop(); }
  // gusts: one every 6 to 9 seconds (fixed by the race time), announced 1 s before by the windsocks and an arrow
  const gt = s.t - s.nextT;
  ev.warn = gt > -1 && gt < 0 ? 1 : 0;
  if (gt >= 0 && gt < STORM.gusts) ev.gust = Math.sin(gt / STORM.gusts * Math.PI);
  else ev.gust = 0;
  if (gt >= STORM.gusts) { s.gustN++; s.nextT = s.t + 6 + hash(s.gustN, 3, 81) * 3; }
  if (gt >= 0 && gt - dt < 0) SFX.gust();
  ev.wind.x = p < .5 ? 0 : -(26 + 80 * ev.gust); ev.wind.y = 0;
  // the drifts: one after the other, once the wall has passed
  const D = T.def.drifts || [];
  while (s.drift < D.length && s.t > STORM.wall + .5 + s.drift * 1.3) { paintDrift(T, D[s.drift]); s.drift++; }
  // tumbleweeds roll with the wind across the road
  if (p >= 1 && Math.random() < dt * .6 && ev.tumble.length < 6) {
    const y = cam.y + 20 + Math.random() * (VH - 40);
    ev.tumble.push({ x: Math.min(WW + 10, cam.x + VW + 20), y, vx: -(70 + Math.random() * 50), vy: 0, rot: 0, hop: 0, z: 0 });
  }
  for (let q = ev.tumble.length - 1; q >= 0; q--) {
    const w = ev.tumble[q];
    w.vx += (-(90 + 60 * ev.gust) - w.vx) * Math.min(1, dt * .8); w.vy *= Math.exp(-2 * dt);
    w.x += w.vx * dt; w.y += w.vy * dt; w.rot += w.vx * dt / 6; w.z = Math.abs(Math.sin(w.rot * .5)) * 4; w.hop = Math.max(0, w.hop - dt);
    if (w.x < -20) ev.tumble.splice(q, 1);
  }
  // the storm blows the tyre tracks away
  tctx.globalCompositeOperation = 'destination-out'; tctx.globalAlpha = Math.min(1, dt * .5 * p); tctx.fillStyle = '#000'; tctx.fillRect(0, 0, WW, WH);
  tctx.globalCompositeOperation = 'source-over'; tctx.globalAlpha = 1;
}

// a drift of sand on the road: soft like mud, it makes the car sandy
function paintDrift(T, [cx, cy, r]) {
  const b = T.base.getContext('2d'), x0 = Math.max(0, cx - r * 2), y0 = Math.max(0, cy - r * 2), w = Math.min(WW - x0, r * 4), h = Math.min(WH - y0, r * 4), img = b.getImageData(x0, y0, w, h), d = img.data;
  const MUD = T.th.mud.map(hex), E = hex(T.th.mudEdge), hit = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const j = y * WW + x, t = T.ter[j]; if (t !== 1 && t !== 0) continue;
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

// on the ground: the quicksand turns, the rope bridge swings, the windsocks, the tumbleweeds
export function drawDesertGround() {
  const T = G.T, D = T.desert, ev = T.ev;
  for (const [qx, qy, qr] of D.quick) {
    if (Math.abs(qx - cam.x - VW / 2) > VW / 2 + 30 || Math.abs(qy - cam.y - VH / 2) > VH / 2 + 30) continue;
    for (let k = 0; k < 3; k++) for (let a = 0; a < TAU; a += .22) {
      const rr = qr * (.25 + k * .25), an = a + G.time * (1.2 - k * .3) + rr * .12;
      R1(Math.round(qx + Math.cos(an) * rr), Math.round(qy + Math.sin(an) * rr), 1, 1, k === 1 ? '#9a7442' : '#c8a26a');
    }
    disc(qx, qy, 2, '#8a6436');
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
  // windsocks: hanging down, out to the left in the storm, flapping before a gust
  for (const s of D.socks) {
    if (near(s.x, s.y) > 320) continue;
    const w = ev ? Math.min(1, Math.abs(ev.wind.x) / 60 + ev.warn * .6) : 0, flap = ev && (ev.warn || ev.gust > .3) ? Math.sin(G.time * 30) : 0;
    R1(s.x, s.y - 12, 1, 13, '#5a5a5e'); R1(s.x - 1, s.y, 3, 1, '#3a3a3e');
    for (let k = 0; k < 4; k++) {
      const len = 3, ax = s.x - (2 + k * len) * w, ay = s.y - 11 + (2 + k * 2) * (1 - w) + flap * k * .5;
      R1(Math.round(ax) - 2, Math.round(ay) - 1, 3, 3 - (k > 2 ? 1 : 0), k % 2 ? '#ffffff' : '#f07a1a');
    }
  }
  if (ev && ev.tumble) for (const w of ev.tumble) {
    const x = Math.round(w.x), y = Math.round(w.y - w.z);
    ctx.globalAlpha = .25; R1(x - 5, Math.round(w.y) + 4, 10, 3, '#000'); ctx.globalAlpha = 1;
    for (let k = 0; k < 14; k++) { const a = k * 2.4 + w.rot, rr = 3 + (k % 3) * 1.6; R1(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr), 2, 1, k % 2 ? '#8a6436' : '#b08a52'); }
  }
}

// above the cars: the roof of the pyramid (see-through from inside, dark inside with torches), the vulture, "AUTSCH!"
export function drawDesertAbove(cx, cy) {
  const T = G.T, D = T.desert, ev = T.ev, py = D.pyr;
  if (py) {
    if (D.inside) {
      // inside: dark, the torches and the headlights light it up a little
      const W = py.W, dkc = D.dark || (D.dark = mk(W, W)), g = dkc.getContext('2d');
      g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, W); g.fillStyle = 'rgba(14,8,4,.74)'; g.fillRect(0, 0, W, W);
      g.globalCompositeOperation = 'destination-out';
      for (const t of py.torches) { const fl = .8 + .2 * Math.sin(G.time * 13 + t.k); for (const [r, a] of [[22, .25], [14, .35]]) { g.fillStyle = 'rgba(0,0,0,' + a * fl + ')'; g.beginPath(); g.arc(t.x - py.x, t.y - py.y, r, 0, TAU); g.fill(); } }
      for (const c of G.cars) {
        if (c.fall > 0) continue;
        const x = c.x - py.x, y = c.y - py.y, fx = Math.cos(c.ang), fy = Math.sin(c.ang), nx = -fy, ny = fx;
        g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(x, y, 14, 0, TAU); g.fill();
        for (let k = 0; k < 3; k++) {
          const len = 70 - k * 16, half = 26 - k * 6; g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath();
          g.moveTo(x + fx * 8 + nx * 4, y + fy * 8 + ny * 4); g.lineTo(x + fx * len + nx * half, y + fy * len + ny * half); g.lineTo(x + fx * len - nx * half, y + fy * len - ny * half); g.lineTo(x + fx * 8 - nx * 4, y + fy * 8 - ny * 4); g.closePath(); g.fill();
        }
      }
      ctx.drawImage(dkc, py.x, py.y);
      for (const t of py.torches) {
        const x = Math.round(t.x), y = Math.round(t.y), f = ((G.time * 10 + t.k) | 0) % 2;
        R1(x - 1, y, 2, 4, '#5a3a1c'); R1(x - 1, y - 3 - f, 3, 3, '#ffb22e'); R1(x, y - 2 - f, 1, 2, '#fff1a8');
        ctx.globalAlpha = .25; disc(x, y - 2, 6, '#ffb22e'); ctx.globalAlpha = 1;
      }
      // scarabs crawl along the walls
      for (let k = 0; k < 5; k++) {
        const t = py.torches[k % Math.max(1, py.torches.length)]; if (!t) break;
        const a = G.time * .7 + k * 1.7, x = Math.round(t.x + Math.cos(a) * 9), y = Math.round(t.y + 8 + Math.sin(a * 1.3) * 3);
        R1(x - 1, y - 1, 3, 3, '#1b120c'); R1(x, y - 1, 1, 2, '#2fa6b2');
      }
      ctx.globalAlpha = .18; ctx.drawImage(py.c, py.x, py.y); ctx.globalAlpha = 1;
    } else ctx.drawImage(py.c, py.x, py.y);
  }
  // a vulture circles over the desert, its shadow on the ground
  const va = G.time * .25, vx = 400 + Math.cos(va) * 170, vy = 210 + Math.sin(va) * 90;
  if (near(vx, vy) < 360) {
    const flap = ((G.time * 3) | 0) % 2, dir = -Math.sin(va) > 0 ? 1 : -1;
    ctx.globalAlpha = .18; R1(Math.round(vx + 26) - 8, Math.round(vy + 36), 17, 3, '#000'); ctx.globalAlpha = 1;
    const x = Math.round(vx), y = Math.round(vy);
    R1(x - 9, y - (flap ? 2 : 0), 7, 2, '#3a2a20'); R1(x + 3, y - (flap ? 2 : 0), 7, 2, '#3a2a20'); R1(x - 2, y - 1, 5, 4, '#2a1c14'); R1(x + dir * 3, y - 2, 2, 2, '#e8c0a0');
  }
  if (ev && ev.cacti) for (const k of ev.cacti) if (k.ouch > 0) text('AUTSCH!', Math.round(k.x), Math.round(k.y - 16 - (1.1 - k.ouch) * 8), 8, '#ffd23f', 'center');
}

// the sandstorm on the screen: an ochre wall that comes in from the right, then you only see near your car; an arrow warns of gusts
const fog = mk(VW, VH), fctx = fog.getContext('2d');
export function drawStorm(cx, cy) {
  const ev = G.T.ev, s = ev && ev.storm; if (!s) return;
  const p = Math.min(1, s.t / STORM.wall), wx = Math.round(WW + 40 - p * (WW + 80) - cx);
  if (wx >= VW) return;
  fctx.globalCompositeOperation = 'source-over'; fctx.clearRect(0, 0, VW, VH);
  fctx.fillStyle = 'rgba(184,138,74,.74)'; fctx.fillRect(Math.max(0, wx), 0, VW, VH);
  fctx.globalCompositeOperation = 'destination-out';
  for (const c of G.cars) {
    const x = c.x - cx, y = c.y - cy; if (x < -80 || x > VW + 80 || y < -80 || y > VH + 80 || c.fall > 0) continue;
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang), nx = -fy, ny = fx;
    for (const [r, a] of [[24, .22], [16, .3]]) { fctx.fillStyle = 'rgba(0,0,0,' + a + ')'; fctx.beginPath(); fctx.arc(x, y, r, 0, TAU); fctx.fill(); }
    for (let k = 0; k < 3; k++) {
      const len = 66 - k * 14, half = 24 - k * 5; fctx.fillStyle = 'rgba(0,0,0,.24)'; fctx.beginPath();
      fctx.moveTo(x + fx * 8 + nx * 4, y + fy * 8 + ny * 4); fctx.lineTo(x + fx * len + nx * half, y + fy * len + ny * half); fctx.lineTo(x + fx * len - nx * half, y + fy * len - ny * half); fctx.lineTo(x + fx * 8 - nx * 4, y + fy * 8 - ny * 4); fctx.closePath(); fctx.fill();
    }
  }
  ctx.drawImage(fog, 0, 0);
  // the front of the wall: billowing clouds; and sand streaks blowing to the left
  if (p < 1) for (let k = 0; k < 14; k++) { const y = k * VH / 13, r = 18 + 8 * Math.sin(G.time * 2 + k); ctx.globalAlpha = .55; disc(wx + Math.round(Math.sin(G.time * 3 + k * 1.7) * 6), Math.round(y), Math.round(r), '#c49a5c'); }
  ctx.globalAlpha = .5; ctx.fillStyle = '#f0d9a6';
  const sp = 260 + 220 * (ev.gust || 0);
  for (let i = 0; i < 90; i++) {
    const x = ((hash(i, 1, 85) * (VW + 60) - G.time * sp * (.7 + hash(i, 2, 85) * .6)) % (VW + 60) + VW + 60) % (VW + 60) - 30, y = hash(i, 3, 85) * VH;
    if (x < wx) continue; ctx.fillRect(Math.round(x), Math.round(y), 4 + (i % 3) * 2, 1);
  }
  ctx.globalAlpha = 1;
  // a gust is coming: a big arrow pointing left under the bar at the top
  if ((ev.warn || ev.gust > .3) && ((G.time * 6) | 0) % 2 === 0) {
    const x = VW / 2, y = 34;
    R1(x - 14, y - 4, 34, 9, '#1b120c'); R1(x - 13, y - 3, 32, 7, '#ffd23f'); tri(x - 22, y, 'left', 9, '#1b120c'); tri(x - 21, y, 'left', 8, '#ffd23f');
    text('WIND!', x, y + 10, 8, '#ffd23f', 'center');
  }
}
