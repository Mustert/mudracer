import { describe, expect, it } from 'vitest';
import { STICK_DEAD, stickRead } from '../src/stick.js';

describe('virtual stick', () => {
  it('keeps still inside the dead zone', () => {
    expect(stickRead(0, 0, 50).on).toBe(false);
    expect(stickRead(50 * STICK_DEAD - 1, 0, 50).on).toBe(false);
  });
  it('drives at any angle, not only in four directions', () => {
    const s = stickRead(30, 10, 50);
    expect(s.on).toBe(true);
    expect(s.ang).toBeCloseTo(Math.atan2(10, 30));
  });
  it('holds the knob at the rim when the finger goes further', () => {
    const s = stickRead(0, -200, 50);
    expect(s.x).toBeCloseTo(0);
    expect(s.y).toBeCloseTo(-1);
    expect(s.ang).toBeCloseTo(-Math.PI / 2);
  });
});
