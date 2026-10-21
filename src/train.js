import { G } from './g.js';
import { SFX } from './audio.js';
import { TRAIN_SPEED, VH, VW, clamp } from './core.js';
import { addP, mudBurst } from './particles.js';
import { eventOn } from './undo.js';
import { cam } from './state.js';
import { trainOf } from './trainsprite.js';

// ---------- train ----------

// the pause between two trains on a line shrinks from lap to lap (lap 1, 2, 3): 3.5-6 s, then about 2.3-3.9 s, then 1.6-2.7 s
// (1S4-1; halved again in ZUG Rev 2, 1S4-4: on top of the warning of 2.5 s and the run of about 3.5 s)
const PAUSE = [1, .65, .45], WAIT = [3.5, 2.5]; // the pause in lap 1: from, plus up to


export function updateTrain(dt) {
  const R = G.T.rail; if (!R || !eventOn('zug')) return; // train switched off: the lines stay empty
  const cxm = cam.x + VW / 2, cym = cam.y + VH / 2;
  for (const tr of R.trains) {
    tr.t -= dt;
    const vol = () => { let dm = 1e9; for (const cr of R.cross) if (cr.x === tr.x) dm = Math.min(dm, Math.hypot(cr.x - cxm, cr.y - cym)); return clamp(1 - dm / 600, .35, 1); };
    if (tr.phase === 'wait' && tr.t <= 0) { tr.phase = 'warn'; tr.t = 2.5; SFX.whistle(vol() * .6); }
    else if (tr.phase === 'warn' && tr.t <= 0) {
      // every train has its own length: 3 to 12 wagons (the longest is longer than the map is high)
      tr.n = 3 + Math.floor((G.ttRand || Math.random)() * 10); tr.len = trainOf(tr.n).LEN;
      tr.phase = 'run'; tr.y = tr.dir > 0 ? -tr.len - 40 : G.T.H + 40; SFX.whistle(vol());
    }
    else if (tr.phase === 'run') {
      tr.y += tr.dir * TRAIN_SPEED * dt;
      if ((tr.smokeT -= dt) <= 0) {
        tr.smokeT = .07;
        const cy = tr.dir > 0 ? tr.y + trainOf(tr.n).chim : tr.y + tr.len - trainOf(tr.n).chim;
        addP({ t: 'smoke', x: tr.x + (Math.random() - .5) * 4, y: cy, vx: 10 + Math.random() * 12, vy: -tr.dir * 25 + (Math.random() - .5) * 10, life: 1.4, ml: 1.4 });
      }
      for (const c of G.cars) {
        if (c.z > 3) continue; // over the train on a ramp (tracks.js): nothing happens
        if (Math.abs(c.x - tr.x) < 14 + 9 && c.y > tr.y - 9 && c.y < tr.y + tr.len + 9 && !c.stun) {
          // bonk! the car is thrown aside, spins and sees stars for a moment
          const side = Math.sign(c.x - tr.x) || 1;
          c.x = tr.x + side * 25; c.vx = side * 230; c.vy = tr.dir * 120; c.spin = 16; c.stun = 1.6; c.boost = 0;
          if (!c.ai) SFX.crash(); else SFX.bump();
          mudBurst(c, 10);
        }
      }
      if ((tr.dir > 0 && tr.y > G.T.H + 40) || (tr.dir < 0 && tr.y + tr.len < -40)) { tr.phase = 'clear'; tr.t = .8; }
    } else if (tr.phase === 'clear' && tr.t <= 0) { tr.phase = 'wait'; tr.t = (WAIT[0] + (G.ttRand || Math.random)() * WAIT[1]) * PAUSE[clamp((G.player ? G.player.lap : 1) - 1, 0, 2)]; tr.dir *= -1; }
    tr.signal = tr.phase === 'warn' || tr.phase === 'run';
    tr.gate += ((tr.signal ? 1 : 0) - tr.gate) * Math.min(1, dt * 2.5);
  }
  R.signal = R.trains.some(tr => tr.signal);
}
