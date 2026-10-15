import { G } from './g.js';
import { SFX } from './audio.js';
import { TAU, VH, VW, clamp, ctx, hash, hex, mk, smooth, vnoise } from './core.js';
import { R1, disc, text, tri } from './gfx.js';
import { snap } from './undo.js';
import { addP, drop } from './particles.js';
import { cam } from './state.js';
import { canyonX } from './desertmap.js';
import { fallCar, near, sinkInSand } from './trackfx.js';
import { tctx } from './tracks.js';

// ---------- Wueste while racing: cacti that sting, the gorge (the computer cars choose the jump or the rope bridge), the dark pyramid,
// and the event "sandsturm": from lap 2 a wall of sand sweeps in from the right, then you only see a little in front of you, the wind
// pushes everybody to the left (gusts come with a warning), sand drifts onto the road in four places, tumbleweeds roll across. The fields of
// T.ev all start with ds (T22); the wind is applied here (the core does not read it), the gorge and the quicksand are in the ground hook. ----------

const STORM = { wall: 6, gusts: 1.6 };

// ======================================================= always: cacti, dusty dunes

function initDesert(T) {
  const ev = T.ev;
  ev.dsCacti = T.desert.cacti.map(c => ({ x: c.x, y: c.y, r: c.r, cool: 0, ouch: 0 }));
  ev.dsTumble = []; ev.obst = ev.dsCacti.slice(); ev.dsStorm = null; ev.dsWind = { x: 0, y: 0 }; ev.dsGust = 0; ev.dsWarn = 0; ev.dsStormOn = false;
}

function desertUpdate(T, dt) {
  const ev = T.ev, D = T.desert;
  for (const k of ev.dsCacti) { k.cool = Math.max(0, k.cool - dt); k.ouch = Math.max(0, k.ouch - dt); }
  // the pyramid: is your car inside (then its roof is see-through)
  const P = G.player, py = D.pyr;
  D.inside = !!(P && py && Math.abs(P.x - py.cx) < py.hs - 2 && Math.abs(P.y - py.cy) < py.hs - 2);
  if (ev.dsStormOn) updateStorm(T, dt);
  ev.obst = ev.dsTumble.length ? ev.dsCacti.concat(ev.dsTumble) : ev.dsCacti;
  // the wind pushes everybody; in the air it blows more than twice as hard. A crooked landing makes the car spin (the sand takes the wheels)
  const w = ev.dsWind;
  for (const c of G.cars) {
    if (c.fall > 0) continue;
    if (w.x || w.y) { const k = c.z > 0 ? 2.2 : 1; c.vx += w.x * k * dt; c.vy += w.y * k * dt; }
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

// cacti on the road: a hard hit makes you spin (spines fly, "AUTSCH!"), a slow touch only pushes you back.
// Tumbleweeds shove hard and spin a fast car.
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
  for (const w of ev.dsTumble) for (const c of G.cars) {
    if (c.z > 0 || c.fall > 0) continue;
    const dx = c.x - w.x, dy = c.y - w.y, d = Math.hypot(dx, dy); if (d >= 15 || d === 0) continue;
    // a tumbleweed in the face: a hard shove, and at speed the car swings round (only a weed, but a big and fast one)
    c.vx += dx / d * 70 + w.vx * .3; c.vy += dy / d * 70;
    if (!c.stun && Math.hypot(c.vx, c.vy) > 60 && w.hop <= 0) { c.stun = .4; c.spin = (dy > 0 ? 1 : -1) * 6; c.boost = 0; }
    w.vx = -Math.abs(w.vx) * .6 - 20; w.vy += (dy > 0 ? -1 : 1) * 40; w.hop = 1;
    if (!c.ai) SFX.tumble();
  }
}

// ======================================================= the computer cars: quicksand and the gorge

// lane (offset from the centre line) for a computer car looking at point i of the centre line: everybody keeps away from the middle of
// the quicksand; at the gorge they choose the jump or the rope bridge
function desertLane(c, i, lane) {
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
    // the centre line runs along y = 390 at the ramp (going left): the offset to y is measured along the normal there; before it (in the bend of
    // the road) the car moves over to that lane step by step (the bend itself keeps its own normal), after it the lane holds
    const pr = T.path[D.rampI], nr = T.nrm[D.rampI], target = clamp((ym - pr.y) / (nr.y || 1), -40, 40);
    return past < 24 ? target : lane + (target - lane) * smooth(clamp((90 - ahead) / 55, 0, 1));
  }
  // quicksand: never near it (the car is 18 wide: look 8 px to both sides of the lane too, or the slow cars brush the rim, are pulled in and sink)
  const qs = l => [l - 8, l, l + 8].some(m => { const x = (p.x + n.x * m) | 0, y = (p.y + n.y * m) | 0; return x >= 0 && y >= 0 && x < T.W && y < T.H && T.ter[y * T.W + x] === 10; });
  if (qs(lane)) for (const l of [lane + 14, lane - 14, lane + 24, lane - 24, 20, -20, 26, -26]) if (Math.abs(l) <= 27 && !qs(l)) return l;
  return lane;
}

// ======================================================= event "sandsturm"

function initStorm(T) { T.ev.dsStormOn = true; }

// the player is shortly before or behind the ramp of the gorge: no gust is announced and no tumbleweed rolls in now (principle 9)
function nearRamp(T) {
  const P = G.player, D = T.desert, N = T.N; if (!P || !D.canyon) return false;
  return (D.rampI - P.idx + N) % N < 110 || (P.idx - D.rampI + N) % N < 30;
}

function updateStorm(T, dt) {
  const ev = T.ev;
  if (!ev.dsStorm) {
    if (!G.player || G.player.lap < 2) return;
    ev.dsStorm = { t: 0, drift: 0, snd: 0, nextT: 3, gustN: 0 };
    snap(T, 0, 0, T.W, T.H); // drifts change the ground; this puts it back after the race
    SFX.storm();
  }
  const s = ev.dsStorm; s.t += dt;
  const p = Math.min(1, s.t / STORM.wall);
  if ((s.snd -= dt) <= 0) { s.snd = 5.5; SFX.windLoop(); }
  // gusts: one every 6 to 9 seconds (fixed by the race time), announced 1 s before by the windsocks and an arrow
  if (s.t - s.nextT < -1 && nearRamp(T)) s.nextT += dt; // (no gust is announced while the player is at the ramp: one danger at a time)
  const gt = s.t - s.nextT;
  ev.dsWarn = gt > -1 && gt < 0 ? 1 : 0;
  if (gt >= 0 && gt < STORM.gusts) ev.dsGust = Math.sin(gt / STORM.gusts * Math.PI);
  else ev.dsGust = 0;
  if (gt >= STORM.gusts) { s.gustN++; s.nextT = s.t + 6 + hash(s.gustN, 3, 81) * 3; }
  if (gt >= 0 && gt - dt < 0) SFX.gust();
  ev.dsWind.x = p < .5 ? 0 : -(26 + 80 * ev.dsGust); ev.dsWind.y = 0;
  // the drifts: one after the other, once the wall has passed
  const D = T.def.drifts || [];
  while (s.drift < D.length && s.t > STORM.wall + .5 + s.drift * 1.3) { paintDrift(T, D[s.drift]); s.drift++; }
  // tumbleweeds roll with the wind across the road
  if (p >= 1 && Math.random() < dt * .6 && ev.dsTumble.length < 6 && !nearRamp(T)) {
    const y = cam.y + 20 + Math.random() * (VH - 40);
    ev.dsTumble.push({ x: Math.min(T.W + 10, cam.x + VW + 20), y, vx: -(70 + Math.random() * 50), vy: 0, rot: 0, hop: 0, z: 0 });
  }
  for (let q = ev.dsTumble.length - 1; q >= 0; q--) {
    const w = ev.dsTumble[q];
    w.vx += (-(90 + 60 * ev.dsGust) - w.vx) * Math.min(1, dt * .8); w.vy *= Math.exp(-2 * dt);
    w.x += w.vx * dt; w.y += w.vy * dt; w.rot += w.vx * dt / 6; w.z = Math.abs(Math.sin(w.rot * .5)) * 4; w.hop = Math.max(0, w.hop - dt);
    if (w.x < -20) ev.dsTumble.splice(q, 1);
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

// on the ground: the quicksand turns, the rope bridge swings, the windsocks, the tumbleweeds
function drawDesertGround() {
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
    const w = ev ? Math.min(1, Math.abs(ev.dsWind.x) / 60 + ev.dsWarn * .6) : 0, flap = ev && (ev.dsWarn || ev.dsGust > .3) ? Math.sin(G.time * 30) : 0;
    R1(s.x, s.y - 12, 1, 13, '#5a5a5e'); R1(s.x - 1, s.y, 3, 1, '#3a3a3e');
    for (let k = 0; k < 4; k++) {
      const len = 3, ax = s.x - (2 + k * len) * w, ay = s.y - 11 + (2 + k * 2) * (1 - w) + flap * k * .5;
      R1(Math.round(ax) - 2, Math.round(ay) - 1, 3, 3 - (k > 2 ? 1 : 0), k % 2 ? '#ffffff' : '#f07a1a');
    }
  }
  if (ev && ev.dsTumble) for (const w of ev.dsTumble) {
    const x = Math.round(w.x), y = Math.round(w.y - w.z);
    ctx.globalAlpha = .25; R1(x - 5, Math.round(w.y) + 4, 10, 3, '#000'); ctx.globalAlpha = 1;
    for (let k = 0; k < 14; k++) { const a = k * 2.4 + w.rot, rr = 3 + (k % 3) * 1.6; R1(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr), 2, 1, k % 2 ? '#8a6436' : '#b08a52'); }
  }
}

// above the cars: the roof of the pyramid (see-through from inside, dark inside with torches), the vulture, "AUTSCH!"
function drawDesertAbove(cx, cy) {
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
  if (ev && ev.dsCacti) for (const k of ev.dsCacti) if (k.ouch > 0) text('AUTSCH!', Math.round(k.x), Math.round(k.y - 16 - (1.1 - k.ouch) * 8), 8, '#ffd23f', 'center');
}

// the heat over the long straights (ANALYSE I18): rows of the picture are pushed a pixel to the side in slow waves, the air flickers over the
// sand road. Not in the storm (it is cooler and you see nothing anyway).
function drawHeat(cx, cy) {
  const D = G.T.desert, ev = G.T.ev; if (!D.heat.length || (ev && ev.dsStorm) || !ctx) return;
  const src = ctx.canvas, t = G.time * 3.4;
  for (const [x0, y0, x1, y1] of D.heat) {
    const sx0 = Math.max(0, x0 - cx), sx1 = Math.min(VW, x1 - cx), sy0 = Math.max(0, y0 - cy), sy1 = Math.min(VH, y1 - cy);
    if (sx1 - sx0 < 4 || sy1 - sy0 < 2) continue;
    const edge = (y, a, b) => clamp(Math.min(y - a, b - y) / 10, 0, 1); // (fades out towards the top and bottom of the zone)
    for (let y = Math.ceil(sy0); y < sy1 - 1; y += 2) {
      const off = Math.round(Math.sin((y + cy) * .5 + t + Math.sin((y + cy) * .09 + t * .3) * 2) * 1.3 * edge(y + cy, y0, y1));
      if (off) ctx.drawImage(src, sx0, y, sx1 - sx0, 2, sx0 + off, y, sx1 - sx0, 2);
    }
  }
}

function drawDesertSky(cx, cy) { drawHeat(cx, cy); drawStorm(cx, cy); }

// the sandstorm on the screen: an ochre wall that comes in from the right, then you only see near your car; an arrow warns of gusts
const fog = mk(VW, VH), fctx = fog.getContext('2d');
function drawStorm(cx, cy) {
  const ev = G.T.ev, s = ev && ev.dsStorm; if (!s) return;
  const p = Math.min(1, s.t / STORM.wall), wx = Math.round(G.T.W + 40 - p * (G.T.W + 80) - cx);
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
  const sp = 260 + 220 * (ev.dsGust || 0);
  for (let i = 0; i < 90; i++) {
    const x = ((hash(i, 1, 85) * (VW + 60) - G.time * sp * (.7 + hash(i, 2, 85) * .6)) % (VW + 60) + VW + 60) % (VW + 60) - 30, y = hash(i, 3, 85) * VH;
    if (x < wx) continue; ctx.fillRect(Math.round(x), Math.round(y), 4 + (i % 3) * 2, 1);
  }
  ctx.globalAlpha = 1;
  // a gust is coming: a big arrow pointing left under the bar at the top
  if ((ev.dsWarn || ev.dsGust > .3) && ((G.time * 6) | 0) % 2 === 0) {
    const x = VW / 2, y = 34;
    R1(x - 14, y - 4, 34, 9, '#1b120c'); R1(x - 13, y - 3, 32, 7, '#ffd23f'); tri(x - 22, y, 'left', 9, '#1b120c'); tri(x - 21, y, 'left', 8, '#ffd23f');
    text('WIND!', x, y + 10, 8, '#ffd23f', 'center');
  }
}

// ---------- hooks: how the core calls this track (hooks.js; what each hook does: _template.js) ----------
/** @type {import('./_template.js').TrackHooks} */
export const desertHooks = {
  init: initDesert, events: { sandsturm: initStorm }, update: desertUpdate, collisions: desertCollisions, lane: desertLane, ground: desertGround,
  drawGround: drawDesertGround, drawAbove: drawDesertAbove, drawSky: drawDesertSky,
};
