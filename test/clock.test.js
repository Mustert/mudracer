import { describe, expect, it } from 'vitest';
import { MAX_STEPS, STEP, makeClock } from '../src/clock.js';

describe('clock (fixed time step)', () => {
  it('runs the same number of steps for the same time, whatever the frame rate', () => {
    for (const hz of [30, 60, 144, 240]) {
      const c = makeClock(); let n = 0;
      for (let i = 0; i < hz * 10; i++) c.advance(1 / hz, () => n++);
      expect(Math.abs(n - 600)).toBeLessThanOrEqual(1);
    }
  });
  it('hands every step exactly STEP seconds', () => {
    const c = makeClock(), got = [];
    c.advance(.1, dt => got.push(dt));
    expect(got.every(dt => dt === STEP)).toBe(true);
  });
  it('never runs more than MAX_STEPS in one frame (a very slow frame slows the game down)', () => {
    const c = makeClock(); let n = 0;
    c.advance(5, () => n++);
    expect(n).toBe(MAX_STEPS);
    n = 0; c.advance(0, () => n++);
    expect(n).toBe(0);
  });
  it('returns how far it is to the next step (0..1)', () => {
    const c = makeClock();
    const a = c.advance(STEP * 2.5, () => {});
    expect(a).toBeCloseTo(.5, 6);
  });
});
