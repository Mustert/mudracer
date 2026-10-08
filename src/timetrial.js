import { G } from './g.js';
import { ROTS, TAU, clamp } from './core.js';
import { fxActive } from './diff.js';
import { rotIndex } from './draw.js';

// ---------- Zeitfahren: lap times, best time per track and car, ghost of the best run ----------

export const GHOST_DT = .05;


// tracks with events or other layout changes carry a revision: their records start fresh (the old ones stay in storage untouched)
// Without track effects a lap is a different race (no flood, no train), so those runs keep their own records and ghosts ('-fx0').
const ttKey = (t, def) => 'mudracer-tt-' + t.name + '-' + def.id + (t.def && t.def.rev ? '-r' + t.def.rev : '') + (t.def && t.def.events && t.def.events.length && !fxActive() ? '-fx0' : '');

// Records saved before the balance rework carry no version (v). Their times came from the old driving values, so on load they
// are converted with the measured old-to-new lap time ratio per track and car (order of CAR_DEFS), ghost included. The stored
// data itself is never rewritten; a new best is saved as the current version.

const BAL = 2;


const BAL_OLD = {
  WIESE: [1.020, .977, .930, 1.012, .925, .896, 1.024, 1.139],
  WALD: [1.011, .970, .893, .986, .928, .911, 1.004, 1.109],
  STRAND: [1.002, 1.025, .974, 1.008, .984, .955, 1.022, 1.119],
  ZUG: [1.007, 1.011, .954, 1.001, .961, .928, 1.018, 1.122],
  REGENBOGEN: [.980, 1.025, .946, 1.012, .975, .955, 1.067, 1.151],
};


function convertRecord(r, f) {
  const n = r.g.length / 4, m = Math.max(2, Math.round((n - 1) * f) + 1), g = [];
  for (let k = 0; k < m; k++) {
    const u = Math.min(n - 1, k / f), i = Math.min(n - 2, Math.floor(u)), w = u - i, a = i * 4, b = a + 4;
    let dr = r.g[b + 2] - r.g[a + 2]; if (dr > ROTS / 2) dr -= ROTS; else if (dr < -ROTS / 2) dr += ROTS;
    g.push(Math.round(r.g[a] + (r.g[b] - r.g[a]) * w), Math.round(r.g[a + 1] + (r.g[b + 1] - r.g[a + 1]) * w),
      (Math.round(r.g[a + 2] + dr * w) % ROTS + ROTS) % ROTS, Math.round(r.g[a + 3] + (r.g[b + 3] - r.g[a + 3]) * w));
  }
  return { t: r.t * f, laps: r.laps.map(l => l * f), g, v: BAL };
}


export function loadRecord(t, def) {
  try {
    const r = JSON.parse(localStorage.getItem(ttKey(t, def)));
    if (r && r.t > 0 && Array.isArray(r.laps) && Array.isArray(r.g) && r.g.length >= 8 && r.g.length % 4 === 0) {
      const f = r.v === BAL ? 1 : BAL_OLD[t.name] && BAL_OLD[t.name][def.k];
      return f && f !== 1 ? convertRecord(r, f) : r;
    }
  } catch (e) {}
  return null;
}


export function saveRecord(t, def, r) { try { localStorage.setItem(ttKey(t, def), JSON.stringify({ ...r, v: BAL })); } catch (e) {} }


export function fmtTime(s) {
  if (!(s >= 0)) return '-:--.--';
  const c = Math.round(s * 100), m = Math.floor(c / 6000), r = c % 6000;
  return m + ':' + String((r / 100) | 0).padStart(2, '0') + '.' + String(r % 100).padStart(2, '0');
}


export function fmtDelta(d) { const c = Math.round(Math.abs(d) * 100); return (d < 0 ? '-' : '+') + ((c / 100) | 0) + '.' + String(c % 100).padStart(2, '0'); }


export function ttSample(c) { G.tt.rec.push(Math.round(c.x), Math.round(c.y), rotIndex(c.ang), Math.min(5, Math.round(c.dirt * 5))); }

// where the ghost is at time t: interpolated between the recorded samples

export function ghostAt(g, t) {
  const n = g.length / 4, f = clamp(t / GHOST_DT, 0, n - 1), i = Math.min(n - 2, Math.floor(f)), u = f - i, a = i * 4, b = a + 4;
  let dr = g[b + 2] - g[a + 2]; if (dr > ROTS / 2) dr -= ROTS; else if (dr < -ROTS / 2) dr += ROTS;
  return { x: g[a] + (g[b] - g[a]) * u, y: g[a + 1] + (g[b + 1] - g[a + 1]) * u, ang: (g[a + 2] + dr * u) / ROTS * TAU, dirt: g[a + 3] / 5 };
}


export function ttLap() { // the player crossed the line: lap time, and the gap to the ghost's lap
  const i = G.tt.laps.length, lapT = G.tt.t - G.tt.lapStart;
  G.tt.laps.push(lapT); G.tt.lapStart = G.tt.t;
  const ref = G.tt.rec0 && G.tt.rec0.laps[i];
  G.tt.delta = ref !== undefined ? lapT - ref : null; G.tt.deltaT = 3;
}
