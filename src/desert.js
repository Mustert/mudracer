import { G } from './g.js';
import { SFX } from './audio.js';
import { HALF, TAU, VH, VW, ctx, hash, mk } from './core.js';
import { disc } from './gfx.js';
import { drop } from './particles.js';
import { tctx } from './tracks.js';
import { RALLY } from './desertmap.js';

// ---------- Wueste Rev 3 while racing (plaene/WUESTE_REV3.md): rally sand in the open field, the pyramid with its forks, and the event "sandsturm"
// (from lap 2 a storm outside, and the quicksand opens). The fields of T.ev all start with ds (T22). ----------

const STORM = { wall: 6 };

// ======================================================= always

function initDesert(T) {
  const ev = T.ev;
  ev.obst = []; ev.dsStorm = null; ev.dsStormOn = false;
}

// is (x, y) inside the pyramid, past its doorways (then the roof is see-through and no storm blows)
const inPyr = (T, x, y, m = 4) => { const P = T.desert.pyr; return x > P.x + m && x < P.x + P.W - m && y > P.y + m && y < P.y + P.H - m; };

function desertUpdate(T, dt) {
  const D = T.desert, P = G.player;
  D.inside = !!P && inPyr(T, P.x, P.y);
  if (T.ev.dsStormOn) updateStorm(T, dt);
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

// rally sand: [speed, grip, steering] a little below the road
function desertSurf(c) { return c.surf === RALLY ? [.7, 5, .85] : null; }

// the sand of the field makes the car sandy, a little on rally sand, quickly on soft sand (and it throws up sand)
function desertGround(c, j, sp, dt) {
  if (c.z > 0) return;
  const soft = c.surf === 0, rally = c.surf === RALLY;
  if (!soft && !rally) return;
  c.dirt = Math.min(1, c.dirt + (soft ? .16 : .07) * dt * (sp > 8 ? 1 : .2));
  if (sp > 25 && Math.random() < dt * (soft ? 18 : 10)) drop(c.x - Math.cos(c.ang) * 12, c.y - Math.sin(c.ang) * 12, c.ang + Math.PI + (Math.random() - .5) * 1.4, 20 + Math.random() * 40, 30 + Math.random() * 40, ['#e3c48c', '#d4b074', '#f0d9a6'][(Math.random() * 3) | 0], .9, false);
}

// ======================================================= the computer cars: the forks

// at a fork the car chooses a branch in time (the jump on HARD, the safe side on EASY, mixed on MEDIUM; too slow for a jump: the safe side) and
// follows it to its end, then the centre line takes over again
function desertTarget(c) {
  const T = G.T, D = T.desert, N = T.N; if (G.state !== 'race' && G.state !== 'finish') { c.dsFork = null; return null; }
  if (!c.dsFork) {
    for (const F of D.forks) {
      const ahead = (F.i1 - c.idx + N) % N, within = (c.idx - F.i1 + N) % N;
      if (ahead < 40 || within < F.len * .5) {
        const diff = G.raceDiff || 0, brave = diff === 2 || (diff === 1 && (c.seed * 3.7) % 1 < .5) || (diff === 0 && (c.seed * 3.7) % 1 < .15);
        const jump = F.jump || 'up', side = brave && Math.hypot(c.vx, c.vy) > 100 ? jump : jump === 'up' ? 'down' : 'up';
        c.dsFork = { P: F[side + 'P'], k: 0 }; break;
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
  const D = G.T.desert, py = D.pyr;
  if (D.inside) return;
  const sx = Math.max(py.x, cx), sy = Math.max(py.y, cy), ex = Math.min(py.x + py.W, cx + VW), ey = Math.min(py.y + py.H, cy + VH);
  if (ex <= sx || ey <= sy) return;
  ctx.drawImage(py.c, sx - py.x, sy - py.y, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);
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
  init: initDesert, events: { sandsturm: initStorm }, update: desertUpdate, surf: desertSurf, target: desertTarget, ground: desertGround,
  noRespawn: t => t === 0, drawAbove: drawDesertAbove, drawSky: drawDesertSky,
};
