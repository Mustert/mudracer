import { G } from './g.js';
import { SFX } from './audio.js';
import { HALF, TAU, VH, VW, clamp, ctx, hash, mk } from './core.js';
import { DIFFS } from './diff.js';
import { R1, disc, text } from './gfx.js';
import { addP, drop } from './particles.js';
import { fallCar, inView, near } from './trackfx.js';
import { tctx } from './tracks.js';
import { RALLY } from './desertmap.js';

// ---------- Wueste Rev 3 while racing (plaene/WUESTE_REV3.md): rally sand in the open field, the pyramid with its forks, and the event "sandsturm"
// (from lap 2 a storm outside, and the quicksand opens). The fields of T.ev all start with ds (T22). ----------

const STORM = { wall: 6 };

// ======================================================= always

function initDesert(T) {
  const ev = T.ev, D = T.desert;
  ev.dsCacti = D.cacti.map(c => ({ x: c.x, y: c.y, r: c.r, cool: 0, ouch: 0 }));
  // the scarab swarms of the second fork (slalom for the cars: they are obstacles to steer round, and slow you a little when you drive through)
  ev.dsBugs = D.bugs.map((b, k) => ({ x: b.x, y: b.y, cx: b.x, cy: b.y, r: 8, ph: k * 1.9, bugs: Array.from({ length: 12 }, (_, q) => ({ a: q * 2.4, r: 3 + (q % 4) * 3, ph: q * .7 })) }));
  ev.obst = D.obst.concat(ev.dsCacti, ev.dsBugs); ev.dsStorm = null; ev.dsStormOn = false;
}

// is (x, y) inside the pyramid, past its doorways (then the roof is see-through and no storm blows)
const inPyr = (T, x, y, m = 4) => { const P = T.desert.pyr; return x > P.x + m && x < P.x + P.W - m && y > P.y + m && y < P.y + P.H - m; };

function desertUpdate(T, dt) {
  const D = T.desert, P = G.player;
  for (const k of T.ev.dsCacti) { k.cool = Math.max(0, k.cool - dt); k.ouch = Math.max(0, k.ouch - dt); }
  // the swarms wander slowly across their branch
  for (const b of T.ev.dsBugs) { b.x = b.cx + Math.sin(T.ev.t * .3 + b.ph * 2) * 10; b.y = b.cy + Math.sin(T.ev.t * .55 + b.ph) * 15; }
  for (const c of G.cars) c.dsBugT = Math.max(0, (c.dsBugT || 0) - dt);
  D.inside = !!P && inPyr(T, P.x, P.y);
  if (T.ev.dsStormOn) updateStorm(T, dt);
  // a crooked landing makes the car spin (the sand takes the wheels)
  for (const c of G.cars) {
    if (c.fall > 0) { c.dsAir = false; continue; }
    if (c.z > 0) c.dsAir = true;
    else if (c.dsAir) { c.dsAir = false; if (!crookedLanding(c) && c.y < D.field[1]) c.boost = Math.max(c.boost, .4); } // (a straight landing on a dune: a little push)
  }
}

// a crooked landing: the car points away from where it flies, at speed the sand grabs the wheels and it spins round (nobody falls, but it costs)
function crookedLanding(c) {
  const sp = Math.hypot(c.vx, c.vy), mv = Math.atan2(c.vy, c.vx), d = Math.atan2(Math.sin(c.ang - mv), Math.cos(c.ang - mv));
  if (sp < 45 || Math.abs(d) < .38 || c.stun) return false;
  c.stun = .55; c.spin = Math.sign(d) * 8; c.boost = 0; c.vx *= .6; c.vy *= .6;
  for (let i = 0; i < 12; i++) drop(c.x, c.y, Math.random() * TAU, 30 + Math.random() * 50, 30 + Math.random() * 40, ['#e3c48c', '#d4b074', '#f0d9a6'][i % 3], .9, false);
  return true;
}

// rally sand: [speed, grip, steering] a little below the road
function desertSurf(c) { return c.surf === RALLY ? [.7, 5, .85] : null; }

// the sand of the field makes the car sandy, a little on rally sand, quickly on soft sand (and it throws up sand)
function desertGround(c, j, sp, dt) {
  if (c.surf === 11) { // no ground in the shaft: set down behind it (the shaft of this fork)
    const D = G.T.desert, R = D.shafts.reduce((a, b) => Math.abs(b.y - c.y) < Math.abs(a.y - c.y) ? b : Math.abs(b.y - c.y) === Math.abs(a.y - c.y) && Math.abs(b.x0 - c.x) < Math.abs(a.x0 - c.x) ? b : a);
    fallCar(c, 'abyss', R.landI); return;
  }
  if (c.z > 0) return;
  const soft = c.surf === 0, rally = c.surf === RALLY;
  if (!soft && !rally) return;
  c.dirt = Math.min(1, c.dirt + (soft ? .16 : .07) * dt * (sp > 8 ? 1 : .2));
  if (sp > 25 && Math.random() < dt * (soft ? 18 : 10)) drop(c.x - Math.cos(c.ang) * 12, c.y - Math.sin(c.ang) * 12, c.ang + Math.PI + (Math.random() - .5) * 1.4, 20 + Math.random() * 40, 30 + Math.random() * 40, ['#e3c48c', '#d4b074', '#f0d9a6'][(Math.random() * 3) | 0], .9, false);
}

// ======================================================= the computer cars: the oases, the field, the forks

// a dirty car on its way along the field turns off to an oasis that lies ahead and drives to its middle until it is clean (or has had enough)
function washTarget(c) {
  const T = G.T, D = T.desert, N = T.N;
  if (!c.dsWash && G.state === 'race' && c.dirt > [.6, .7, .8][G.raceDiff || 0] && c.idx >= D.iA && c.idx < D.iB) {
    for (const O of D.oases) { const ahead = (O.i - c.idx + N) % N; if (ahead < 70 && Math.hypot(O.x - c.x, O.y - c.y) < 150) { c.dsWash = { O, t0: G.time }; break; } }
  }
  const w = c.dsWash; if (!w) return null;
  if (c.dirt < .12 || G.time - w.t0 > 4 || G.state !== 'race') { c.dsWash = null; return null; }
  return [w.O.x, w.O.y];
}

// the open field: everybody wanders wide, and the cars that mind soft sand look for a way round it
function desertLane(c, i, lane) {
  const T = G.T, D = T.desert; if (i < D.iA || i > D.iB) return lane;
  const p = T.path[i], n = T.nrm[i], A = DIFFS[G.raceDiff || 0].avoid;
  lane *= 3;
  if (c.def.mud < 1.15 && A && (c.seed * 7.31) % 1 < A) {
    const bad = l => [l - 9, l, l + 9].some(m => { const x = (p.x + n.x * m) | 0, y = (p.y + n.y * m) | 0; return x >= 0 && y >= 0 && x < T.W && y < T.H && T.ter[y * T.W + x] === 0; });
    if (bad(lane)) for (const l of [lane + 16, lane - 16, lane + 30, lane - 30, lane + 46, lane - 46]) if (Math.abs(l) <= 70 && !bad(l)) return l;
  }
  return lane;
}

// cacti on the line: a hard hit makes you spin (spines fly, "AUTSCH!"), a slow touch only pushes you back
function desertCollisions() {
  const ev = G.T.ev; if (!ev || !ev.dsCacti) return;
  // a swarm of scarabs: whoever drives through is slowed a little (no spin) and the bugs rustle away
  for (const b of ev.dsBugs) for (const c of G.cars) {
    if (c.z > 3 || c.fall > 0 || c.dsBugT > 0 || Math.hypot(c.x - b.x, c.y - b.y) > b.r + 9) continue;
    c.dsBugT = .6; c.vx *= .88; c.vy *= .88;
    const v = c.ai ? clamp(1 - near(b.x, b.y) / 260, 0, .5) : 1; if (v > .02) SFX.crawl(v);
  }
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

// at a fork the car chooses a branch in time (the jump on HARD, the safe side on EASY, mixed on MEDIUM; too slow for a jump: the safe side) and
// follows it to its end, then the centre line takes over again
function desertTarget(c) {
  const T = G.T, D = T.desert, N = T.N; if (G.state !== 'race' && G.state !== 'finish') { c.dsFork = null; return null; }
  if (!c.dsFork) { const w = washTarget(c); if (w) return w; }
  if (!c.dsFork) {
    for (const F of D.forks) {
      const ahead = (F.i1 - c.idx + N) % N, within = (c.idx - F.i1 + N) % N;
      if (ahead < 40 || within < F.len * .5) {
        const diff = G.raceDiff || 0, brave = diff === 2 || (diff === 1 && (c.seed * 3.7) % 1 < .5) || (diff === 0 && (c.seed * 3.7) % 1 < .15);
        const jump = F.jump || 'up', side = brave && Math.hypot(c.vx, c.vy) > 100 ? jump : jump === 'up' ? 'down' : 'up';
        c.dsFork = { P: F[side + 'P'], k: 0, jump: side === jump && !!F.shaft }; break;
      }
    }
    if (!c.dsFork) return null;
  }
  const W = c.dsFork, P = W.P; let k = W.k, bd = 1e9;
  for (let q = W.k; q < Math.min(P.length, W.k + 30); q++) { const dd = (P[q].x - c.x) ** 2 + (P[q].y - c.y) ** 2; if (dd < bd) { bd = dd; k = q; } }
  W.k = k;
  if (k >= P.length - 4 || bd > 70 * 70) { c.dsFork = null; return null; }
  const t = P[Math.min(P.length - 1, k + 9)];
  return [t.x, t.y];
}

// the centre line runs through the field and, a little below it, through the pyramid: a car far off in the field is never counted as being in the pyramid
// (and the other way round)
function desertProgress(c, best) {
  const T = G.T, P = T.desert.pyr, inF = (x, y) => x > P.x && x < P.x + P.W && y > P.y && y < P.y + P.H;
  const side = inF(c.x, c.y); if (inF(T.path[best].x, T.path[best].y) === side) return best;
  let b = best, bd = 1e12;
  for (let i = 0; i < T.N; i++) { const p = T.path[i]; if (inF(p.x, p.y) !== side) continue; const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (d < bd) { bd = d; b = i; } }
  return b;
}

// ======================================================= event "sandsturm"

function initStorm(T) { T.ev.dsStormOn = true; }

function updateStorm(T, dt) {
  const ev = T.ev;
  if (!ev.dsStorm) {
    if (!G.player || G.player.lap < 2) return;
    ev.dsStorm = { t: 0, snd: 0 };
    SFX.storm();
  }
  const s = ev.dsStorm; s.t += dt;
  if ((s.snd -= dt) <= 0) { s.snd = 5.5; SFX.windLoop(); }
  // the storm blows the tyre tracks away
  tctx.globalCompositeOperation = 'destination-out'; tctx.globalAlpha = Math.min(1, dt * .5 * Math.min(1, s.t / STORM.wall)); tctx.fillStyle = '#000'; tctx.fillRect(0, 0, T.W, T.H);
  tctx.globalCompositeOperation = 'source-over'; tctx.globalAlpha = 1;
}

// ======================================================= drawing

// above the cars: the roof of the pyramid (only the part on the screen; see-through when you are inside)
function drawDesertAbove(cx, cy) {
  const T = G.T, D = T.desert, py = D.pyr;
  // a vulture circles over the field, its shadow on the ground; "AUTSCH!" over a cactus that stung
  const va = G.time * .25, vx = 640 + Math.cos(va) * 420, vy = 190 + Math.sin(va) * 90;
  if (near(vx, vy) < 360) {
    const flap = ((G.time * 3) | 0) % 2, dir = -Math.sin(va) > 0 ? 1 : -1;
    ctx.globalAlpha = .18; R1(Math.round(vx + 26) - 8, Math.round(vy + 36), 17, 3, '#000'); ctx.globalAlpha = 1;
    const x = Math.round(vx), y = Math.round(vy);
    R1(x - 9, y - (flap ? 2 : 0), 7, 2, '#3a2a20'); R1(x + 3, y - (flap ? 2 : 0), 7, 2, '#3a2a20'); R1(x - 2, y - 1, 5, 4, '#2a1c14'); R1(x + dir * 3, y - 2, 2, 2, '#e8c0a0');
  }
  for (const k of T.ev.dsCacti) if (k.ouch > 0) text('AUTSCH!', Math.round(k.x), Math.round(k.y - 16 - (1.1 - k.ouch) * 8), 8, '#ffd23f', 'center');
  if (D.inside) { drawDark(cx, cy, py); return; }
  const sx = Math.max(py.x, cx), sy = Math.max(py.y, cy), ex = Math.min(py.x + py.W, cx + VW), ey = Math.min(py.y + py.H, cy + VH);
  if (ex <= sx || ey <= sy) return;
  ctx.drawImage(py.c, sx - py.x, sy - py.y, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);
}

// the darkness inside the pyramid: one light map the size of the screen, put together every frame: dark over the whole pyramid, the glow of the floor cut
// out (you always see where the road goes), a few torches and the lamps of every car cut out (a soft round glow and a cone, made once)
let SP = null, LM = null;
function sprites() {
  if (SP) return SP;
  const rad = (r, a) => { const c = mk(r * 2, r * 2), g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c; };
  const cone = mk(96, 64), g = cone.getContext('2d'), gr = g.createLinearGradient(0, 0, 96, 0);
  gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr;
  g.beginPath(); g.moveTo(0, 27); g.lineTo(96, 0); g.lineTo(96, 64); g.lineTo(0, 37); g.closePath(); g.fill();
  SP = { torch: rad(34, .6), car: rad(24, .45), cone }; return SP;
}
function drawDark(cx, cy, py) {
  const S = sprites(); if (!LM) LM = mk(VW, VH);
  const g = LM.getContext('2d');
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, VW, VH);
  g.fillStyle = 'rgba(8,5,3,.88)'; g.fillRect(py.x - cx, py.y - cy, py.W, py.H);
  const sx = Math.max(py.x, cx), sy = Math.max(py.y, cy), ex = Math.min(py.x + py.W, cx + VW), ey = Math.min(py.y + py.H, cy + VH);
  if (ex > sx && ey > sy) {
    g.globalCompositeOperation = 'destination-out'; g.drawImage(py.glow, sx - py.x, sy - py.y, ex - sx, ey - sy, sx - cx, sy - cy, ex - sx, ey - sy);
    g.globalCompositeOperation = 'source-over'; g.drawImage(py.dark2, sx - py.x, sy - py.y, ex - sx, ey - sy, sx - cx, sy - cy, ex - sx, ey - sy);
  }
  g.globalCompositeOperation = 'destination-out';
  for (const t of py.torches) { const x = t.x - cx, y = t.y - cy; if (x < -40 || x > VW + 40 || y < -40 || y > VH + 40) continue; g.globalAlpha = .8 + .2 * Math.sin(G.time * 13 + t.k); g.drawImage(S.torch, Math.round(x - 34), Math.round(y - 34)); }
  g.globalAlpha = 1;
  for (const c of G.cars) {
    const x = c.x - cx, y = c.y - cy; if (c.fall > 0 || x < -110 || x > VW + 110 || y < -110 || y > VH + 110) continue;
    g.drawImage(S.car, Math.round(x - 24), Math.round(y - 24));
    g.save(); g.translate(x, y); g.rotate(c.ang); g.drawImage(S.cone, 8, -32); g.restore();
  }
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(LM, cx, cy);
  for (const t of py.torches) {
    const x = Math.round(t.x), y = Math.round(t.y), f = ((G.time * 10 + t.k) | 0) % 2;
    if (!inView(x, y, 8)) continue;
    R1(x - 1, y, 2, 4, '#5a3a1c'); R1(x - 1, y - 3 - f, 3, 3, '#ffb22e'); R1(x, y - 2 - f, 1, 2, '#fff1a8');
  }
}

// the scarab swarms crawl about on the floor (under the cars): little blue beetles that move in small circles round the middle of their swarm
function drawDesertGround() {
  const ev = G.T.ev;
  for (const b of ev.dsBugs) {
    if (!inView(b.x, b.y, 30)) continue;
    for (const q of b.bugs) {
      const a = q.a + G.time * (.8 + q.ph * .3) * (q.ph > 2 ? -1 : 1), x = Math.round(b.x + Math.cos(a) * (q.r + 3)), y = Math.round(b.y + Math.sin(a * 1.3) * (q.r + 2)), f = ((G.time * 8 + q.ph * 3) | 0) & 1;
      R1(x - 1, y - 1, 3, 2, '#1b120c'); R1(x - 1 + f, y - 1, 2, 2, '#2fa6b2'); R1(x, y - 1, 1, 1, '#9cf0f0');
    }
  }
}

function drawDesertSky(cx, cy) { drawStorm(cx, cy); }

// the sandstorm on the screen: an ochre wall that comes in from the right, then a haze of sand where you see less far; the inside of the pyramid
// and the finish line stay clear
const fog = mk(VW, VH), fctx = fog.getContext('2d');
function drawStorm(cx, cy) {
  const T = G.T, ev = T.ev, s = ev && ev.dsStorm; if (!s) return;
  const p = Math.min(1, s.t / STORM.wall), wx = Math.round(T.W + 40 - p * (T.W + 80) - cx), py = T.desert.pyr;
  if (wx >= VW) return;
  fctx.globalCompositeOperation = 'source-over'; fctx.clearRect(0, 0, VW, VH);
  fctx.fillStyle = 'rgba(184,138,74,.5)'; fctx.fillRect(Math.max(0, wx), 0, VW, VH);
  fctx.globalCompositeOperation = 'destination-out';
  fctx.fillStyle = '#000'; fctx.fillRect(py.x - cx, py.y - cy, py.W, py.H);
  const s0 = T.path[0]; fctx.fillRect(s0.x - HALF - 4 - cx, s0.y - 7 - cy, HALF * 2 + 8, 14); // (the finish line always stays clear)
  ctx.drawImage(fog, 0, 0);
  if (p < 1) for (let k = 0; k < 14; k++) { const y = k * VH / 13, r = 18 + 8 * Math.sin(G.time * 2 + k); ctx.globalAlpha = .55; disc(wx + Math.round(Math.sin(G.time * 3 + k * 1.7) * 6), Math.round(y), Math.round(r), '#c49a5c'); }
  ctx.globalAlpha = .4; ctx.fillStyle = '#f0d9a6';
  for (let i = 0; i < 50; i++) {
    const x = ((hash(i, 1, 85) * (VW + 60) - G.time * 200 * (.7 + hash(i, 2, 85) * .6)) % (VW + 60) + VW + 60) % (VW + 60) - 30, y = hash(i, 3, 85) * VH;
    if (x < wx || inPyr(T, x + cx, y + cy, -2)) continue; ctx.fillRect(Math.round(x), Math.round(y), 4 + (i % 3) * 2, 1);
  }
  ctx.globalAlpha = 1;
}

// ---------- hooks: how the core calls this track (hooks.js; what each hook does: _template.js) ----------
/** @type {import('./_template.js').TrackHooks} */
export const desertHooks = {
  progress: desertProgress,
  throttle: (c, thr) => c.dsFork && c.dsFork.jump ? 1 : thr, // (full gas on the way to a jump)
  init: initDesert, events: { sandsturm: initStorm }, update: desertUpdate, collisions: desertCollisions, surf: desertSurf, target: desertTarget, lane: desertLane, ground: desertGround,
  noRespawn: t => t === 0, drawGround: drawDesertGround, drawAbove: drawDesertAbove, drawSky: drawDesertSky,
};
