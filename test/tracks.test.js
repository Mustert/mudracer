import { describe, expect, it } from 'vitest';
import { CUPS, cupTrackIdx } from '../src/cups.js';
import { PREFS } from '../src/g.js';
import '../src/state.js';
import { TRACKS, centreLine } from '../src/tracks.js';

describe('tracks', () => {
  it('nothing is built when the game loads (ANALYSE.md T3)', () => {
    expect(TRACKS.length).toBeGreaterThan(10);
    expect(TRACKS.every(t => !t.built && !t.base && !t.ter)).toBe(true);
  });
  it('names are unique', () => {
    expect(new Set(TRACKS.map(t => t.name)).size).toBe(TRACKS.length);
  });
  it('every centre line is closed and sampled every 2 px', () => {
    for (const t of TRACKS) {
      const { path, N } = centreLine(t.def);
      expect(N).toBeGreaterThan(300);
      for (let i = 0; i < N; i++) {
        const p = path[i], q = path[(i + 1) % N], d = Math.hypot(q.x - p.x, q.y - p.y);
        expect(d, t.name + ' point ' + i).toBeLessThan(i === N - 1 ? 3 : 2.05); // the seam where the loop closes may be a little longer
      }
    }
  });
  it('every track event can be switched off (PREFS.events)', () => {
    for (const t of TRACKS) for (const e of t.def.events || []) expect(PREFS.events[e], t.name + ': ' + e).toBe(true);
  });
  it('every cup only names tracks that exist', () => {
    for (const cup of CUPS) if (!cup.custom) expect(cupTrackIdx(cup).every(i => i >= 0)).toBe(true);
  });
});
