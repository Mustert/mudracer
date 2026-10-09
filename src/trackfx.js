import { G } from './g.js';
import { SFX } from './audio.js';
import { VH, VW, WH, WW, clamp } from './core.js';
import { addP, drop, splash } from './particles.js';
import { cam } from './state.js';

// ---------- Cup 3 building blocks (desert and ice): jumps in a race, stretches that push the cars (slope, wind), falling into a gorge,
// sinking in quicksand, burning in lava (volcano). Terrain codes: 10 quicksand, 11 gorge (no ground), 12 sheet ice, 14 swinging rope bridge,
// 15 lava, 16 the crust over the lava stream (lava while the stream breaks through, see volcano.js).
// A jump: { x, y (the lip), tx, ty (the way you jump), lo, hi (how far to the side of the lip, along the normal -ty, tx), vz (speed upwards),
// push (optional: at least this speed forwards, the geyser), off (true: it does not throw you right now) }.
// A push: { i0, i1 (stretch of the centre line, in driving order), f (push along the road, px/s²) }. ----------

const GRAV = 380;
G.jumpShake = 0;
export const near = (x, y) => Math.hypot(x - cam.x - VW / 2, y - cam.y - VH / 2);
const loud = (c, x, y) => c.ai ? clamp(1 - near(x, y) / 400, 0, .5) : 1;

// in the air: no grip, no steering; it takes off when it crosses the lip of a ramp going forwards
export function airborne(c, dt) {
  const T = G.T;
  if (c.fall > 0) return;
  if (c.z > 0) {
    c.vz -= GRAV * dt; c.z += c.vz * dt; c.air += dt;
    if (c.z <= 0) land(c);
    return;
  }
  if (!T.jumps.length) return;
  c.ja = c.ja || [];
  T.jumps.forEach((J, k) => {
    const dx = c.x - J.x, dy = c.y - J.y, a = dx * J.tx + dy * J.ty, l = -dx * J.ty + dy * J.tx, pa = c.ja[k];
    c.ja[k] = a;
    if (J.off || pa === undefined || pa >= 0 || a < 0 || a > 20 || l < J.lo || l > J.hi) return;
    const fwd = c.vx * J.tx + c.vy * J.ty; if (fwd < (J.push ? 5 : 30)) return;
    c.z = .01; c.vz = J.vz; c.air = 0;
    if (J.push && fwd < J.push) { c.vx += J.tx * (J.push - fwd); c.vy += J.ty * (J.push - fwd); }
    const v = loud(c, c.x, c.y); if (v > .02) (J.vz > 120 ? SFX.bigJump : SFX.jump)(v);
  });
}

// touching down: into the gorge, a splash, a cloud of sand or powder snow; a crooked landing on a big jump makes the car spin
function land(c) {
  const T = G.T, j = clamp(c.y | 0, 0, WH - 1) * WW + clamp(c.x | 0, 0, WW - 1), t = T.ter[j], v = loud(c, c.x, c.y), big = c.air > .7;
  c.z = 0; c.vz = 0;
  if (t === 11) { fallCar(c, 'abyss', T.desert && T.desert.landI); return; }
  if (t === 15 || (t === 16 && T.volcano && T.volcano.hot)) { fallCar(c, 'lava'); return; }
  if (t === 3 || t === 5) { splash(c.x, c.y, 24); SFX.splash(v); return; }
  const col = T.th.decor === 'eis' ? ['#ffffff', '#e6eef6', '#cfdcea'] : ['#e8d2a8', '#d9b878', '#c9a263'];
  for (let i = 0; i < (big ? 22 : 10); i++) drop(c.x + (Math.random() - .5) * 20, c.y + (Math.random() - .5) * 14, Math.random() * 6.3, 20 + Math.random() * 50, 30 + Math.random() * 50, col[(Math.random() * 3) | 0], .8, false);
  if (v > .02) SFX.land(v * (big ? 1 : .6));
  if (big && !c.ai) G.jumpShake = .35;
  if (big) {
    const sp = Math.hypot(c.vx, c.vy), mv = Math.atan2(c.vy, c.vx), d = Math.atan2(Math.sin(c.ang - mv), Math.cos(c.ang - mv));
    if (sp > 40 && Math.abs(d) > .55 && !c.stun) { c.stun = .5; c.spin = Math.sign(d) * 7; }
  }
}

// gone for a moment: into the gorge (it is set down behind it) or under the quicksand (beige, set down where it left the road)
export function fallCar(c, kind, at) {
  c.fall = kind === 'sand' ? 1.1 : 1.4; c.fallT0 = c.fall; c.fallKind = kind; c.fx0 = c.x; c.fy0 = c.y;
  c.vx = c.vy = 0; c.boost = 0; c.stun = 0; c.z = 0; c.sink = 0;
  c.respawnI = at === undefined ? null : at;
  // quicksand leaves the car beige, lava sooty (and it comes back hot)
  if (kind === 'sand' || kind === 'lava') c.dirt = 1;
  if (kind === 'lava') { c.heat = .6; c.burnT = 1.3; for (let i = 0; i < 16; i++) addP({ t: 'smoke', x: c.x + (Math.random() - .5) * 16, y: c.y + (Math.random() - .5) * 12, vx: (Math.random() - .5) * 20, vy: -15 - Math.random() * 20, life: 1.2, ml: 1.2 }); }
  const v = loud(c, c.x, c.y); if (v > .02) ({ abyss: SFX.fall, sand: SFX.sink, lava: SFX.burn }[kind] || SFX.sink)(v);
}

// the push of the slopes along the road, and the wind (desert storm) for everybody; in the air the wind blows twice as hard
export function pushCars(dt) {
  const T = G.T, w = T.ev && T.ev.wind;
  G.jumpShake = Math.max(0, G.jumpShake - dt);
  for (const c of G.cars) {
    if (c.fall > 0) continue;
    c.slope = 0;
    for (const P of T.pushes) {
      if (c.z > 0) continue;
      const inside = P.i0 <= P.i1 ? c.idx >= P.i0 && c.idx <= P.i1 : c.idx >= P.i0 || c.idx <= P.i1;
      if (!inside) continue;
      const tg = T.tan[c.idx]; c.vx += tg.x * P.f * dt; c.vy += tg.y * P.f * dt; c.slope = P.f / 300;
    }
    if (w && (w.x || w.y)) { const k = c.z > 0 ? 2.2 : 1; c.vx += w.x * k * dt; c.vy += w.y * k * dt; }
  }
}

// the ground of the Cup 3 tracks under a car (from update.js): quicksand pulls and swallows, the gorge has no ground
export function groundFx(c, sp, dt) {
  const T = G.T;
  if (c.surf === 11) { fallCar(c, 'abyss', T.desert && T.desert.landI); return; }
  if (c.surf === 15 || (c.surf === 16 && T.volcano && T.volcano.hot)) { fallCar(c, 'lava'); return; }
  if (c.surf === 10 && T.desert) {
    const q = T.desert.quick.find(([x, y, r]) => Math.hypot(c.x - x, c.y - y) < r + 2);
    if (q) {
      const dx = q[0] - c.x, dy = q[1] - c.y, d = Math.hypot(dx, dy) || 1, pull = 150 / c.def.mud;
      c.vx += dx / d * pull * dt; c.vy += dy / d * pull * dt;
      c.dirt = Math.min(1, c.dirt + .5 * dt);
      if (d < q[2] * .38) c.sink = (c.sink || 0) + dt; else c.sink = Math.max(0, (c.sink || 0) - dt * .8);
      if (Math.random() < dt * 25) addP({ t: 'd', x: c.x + (Math.random() - .5) * 18, y: c.y + (Math.random() - .5) * 12, z: 4, vx: 0, vy: 0, vz: 10, col: ['#e3c48c', '#c49a5c', '#f0d9a6'][(Math.random() * 3) | 0], s: 1, life: .6, ml: .6 });
      if (!c.ai && Math.random() < dt * 3) SFX.trickle();
      if (c.sink > 1.2) fallCar(c, 'sand');
      return;
    }
  }
  if (c.sink) c.sink = Math.max(0, c.sink - dt * 2);
  if (c.surf === 14 && sp > 20 && !c.ai && Math.random() < dt * 2.5) SFX.creak();
}
