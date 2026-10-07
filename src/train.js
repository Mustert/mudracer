import { G } from './g.js';
import { SFX } from './audio.js';
import { TRAIN_SPEED, VH, VW, WH, clamp } from './core.js';
import { addP, mudBurst } from './particles.js';
import { cam } from './state.js';
import { TRAIN } from './trainsprite.js';

// ---------- train ----------

export function updateTrain(dt) {
  const R = G.T.rail; if (!R) return;
  const tr = R.train;
  tr.t -= dt;
  const vol = () => { const cxm = cam.x + VW / 2, cym = cam.y + VH / 2; let dm = 1e9; for (const cr of R.cross) dm = Math.min(dm, Math.hypot(cr.x - cxm, cr.y - cym)); return clamp(1 - dm / 600, .35, 1); };
  if (tr.phase === 'wait' && tr.t <= 0) { tr.phase = 'warn'; tr.t = 2.5; SFX.whistle(vol() * .6); }
  else if (tr.phase === 'warn' && tr.t <= 0) { tr.phase = 'run'; tr.y = tr.dir > 0 ? -TRAIN.LEN - 40 : WH + 40; SFX.whistle(vol()); }
  else if (tr.phase === 'run') {
    tr.y += tr.dir * TRAIN_SPEED * dt;
    if ((R.smokeT -= dt) <= 0) {
      R.smokeT = .07;
      const cy = tr.dir > 0 ? tr.y + TRAIN.chim : tr.y + TRAIN.LEN - TRAIN.chim;
      addP({ t: 'smoke', x: R.x + (Math.random() - .5) * 4, y: cy, vx: 10 + Math.random() * 12, vy: -tr.dir * 25 + (Math.random() - .5) * 10, life: 1.4, ml: 1.4 });
    }
    for (const c of G.cars) {
      if (Math.abs(c.x - R.x) < 14 + 9 && c.y > tr.y - 9 && c.y < tr.y + TRAIN.LEN + 9 && !c.stun) {
        // bonk! the car is thrown aside, spins and sees stars for a moment
        const side = Math.sign(c.x - R.x) || 1;
        c.x = R.x + side * 25; c.vx = side * 230; c.vy = tr.dir * 120; c.spin = 16; c.stun = 1.6; c.boost = 0;
        if (!c.ai) SFX.crash(); else SFX.bump();
        mudBurst(c, 10);
      }
    }
    if ((tr.dir > 0 && tr.y > WH + 40) || (tr.dir < 0 && tr.y + TRAIN.LEN < -40)) { tr.phase = 'clear'; tr.t = .8; }
  } else if (tr.phase === 'clear' && tr.t <= 0) { tr.phase = 'wait'; tr.t = 7 + (G.ttRand || Math.random)() * 5; tr.dir *= -1; }
  R.signal = tr.phase === 'warn' || tr.phase === 'run';
  R.gate += ((R.signal ? 1 : 0) - R.gate) * Math.min(1, dt * 2.5);
}
