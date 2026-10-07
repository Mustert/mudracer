import { G } from './g.js';
import { SFX } from './audio.js';
import { ACC, LAPS, MAXS, MUD_A, MUD_B, angDiff, clamp } from './core.js';
import { steerAround } from './events.js';
import { setState } from './menus.js';
import { finishRace } from './race.js';
import { ttLap } from './timetrial.js';

// ---------- physics ----------

function surfOf(c) {
  const m = c.def.mud;
  switch (c.surf) {
    // off the road is as slow as mud, but the car stays clean (only the Matschfahrt is made of rough ground)
    case 0: return G.T.run ? [.6, 7, .9] : [MUD_A + MUD_B * m, 2.4 * m, Math.min(.8, .55 * m)];
    case 2: return [MUD_A + MUD_B * m, 2.4 * m, Math.min(.8, .55 * m)];
    case 3: return [.72, 1.6, .65];
    default: return [1, 10, 1];
  }
}


export function physics(c, dt, thr, tgt) {
  if (c.z > 0) { c.x += c.vx * dt; c.y += c.vy * dt; return; } // flying: no grip, no steering
  const [sp, grip, tm] = surfOf(c), dirt = c.dirt, soil = c.def.soil;
  const vf0 = c.vx * Math.cos(c.ang) + c.vy * Math.sin(c.ang);
  if (tgt !== null) {
    const d = angDiff(tgt, c.ang), tr = 4.6 * c.def.turn * tm * (1 - 2.5 * soil * dirt) * (.45 + .55 * Math.min(1, Math.abs(vf0) / 55)) * dt;
    c.ang += clamp(d, -tr, tr);
  }
  if (thr > 0 && dirt > .15) c.ang += Math.sin(G.time * 5.5 + c.seed) * dirt * 1.1 * (soil / .18) * dt;
  const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
  let vf = c.vx * fx + c.vy * fy, vl = -c.vx * fy + c.vy * fx;
  const max = MAXS * c.def.speed * sp * (1 - soil * dirt) * (c.boost > 0 ? 1.5 : 1);
  if (thr > 0 && vf < max * thr) {
    const sput = 1 - .35 * (soil / .18) * dirt * (.5 + .5 * Math.sin(G.time * 11 + c.seed * 3));
    vf += ACC * c.def.acc * sput * (.5 + .5 * sp) * dt;
  }
  else if (thr < 0 && vf > -35) vf -= ACC * c.def.acc * .5 * (.5 + .5 * sp) * dt;
  if (c.boost > 0) vf = Math.max(vf, max * .9);
  vf *= Math.exp(-(thr > 0 ? .25 : 3) * dt);
  if (c.brake) vf *= Math.exp(-6 * dt);
  if (vf > max) vf += (max - vf) * Math.min(1, 3.5 * dt);
  if (vf < -35) vf = -35;
  vl *= Math.exp(-grip * dt);
  c.vx = fx * vf - fy * vl; c.vy = fy * vf + fx * vl;
  c.x += c.vx * dt; c.y += c.vy * dt;
}


export function aiTarget(c) {
  const sp = Math.hypot(c.vx, c.vy), i = (c.idx + 18 + Math.round(sp / 8)) % G.T.N, p = G.T.path[i], n = G.T.nrm[i];
  // on the flooded pier there is no room to wander across the track
  const lane = Math.sin(G.time * .4 + c.seed) * (G.T.ev && G.T.ev.pier ? 1.5 : 14);
  const [tx, ty] = steerAround(c, p.x + n.x * lane, p.y + n.y * lane);
  return Math.atan2(ty - c.y, tx - c.x);
}

// distance (in path samples) to the next level crossing ahead, or Infinity

export function crossingAhead(c) {
  const R = G.T.rail; if (!R) return Infinity;
  let best = Infinity; for (const cr of R.cross) if (cr.x === R.x) best = Math.min(best, (cr.i - c.idx + G.T.N) % G.T.N);
  return best;
}


export const score = c => c.finished ? 1e6 - c.place * 1000 : (c.lap - 1) * G.T.N + c.idx;


export const placeOf = c => 1 + G.cars.filter(o => o !== c && score(o) > score(c)).length;



export function updateProgress(c) {
  const N = G.T.N; let best = c.idx, bd = 1e9;
  for (let k = -40; k <= 40; k++) { const i = (c.idx + k + N) % N, p = G.T.path[i], d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (d < bd) { bd = d; best = i; } }
  if (bd > 4900) for (let i = 0; i < N; i++) { const p = G.T.path[i], d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (d < bd) { bd = d; best = i; } }
  c.idx = best; c.off = Math.sqrt(bd);
  const q = Math.floor(best / (N / 4));
  if (best % (N / 4) < N / 8 && q === c.cp) {
    c.cp = (c.cp + 1) % 4;
    if (q === 0) {
      c.lap++;
      if (c.lap > LAPS) {
        c.finished = true; c.place = ++G.finCount;
        if (c === G.player) { finishRace(); setState('finish'); SFX.fanfare(); }
      } else if (c === G.player && c.lap > 1) { SFX.lap(); if (G.tt) ttLap(); }
    }
  }
}
