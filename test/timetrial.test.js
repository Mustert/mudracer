import { describe, expect, it } from 'vitest';
import { convertRecord, fmtDelta, fmtTime, ghostAt } from '../src/timetrial.js';

describe('time formats', () => {
  it('fmtTime', () => {
    expect(fmtTime(0)).toBe('0:00.00');
    expect(fmtTime(61.234)).toBe('1:01.23');
    expect(fmtTime(59.999)).toBe('1:00.00');
    expect(fmtTime(-1)).toBe('-:--.--');
    expect(fmtTime(NaN)).toBe('-:--.--');
  });
  it('fmtDelta', () => {
    expect(fmtDelta(-1.5)).toBe('-1.50');
    expect(fmtDelta(.05)).toBe('+0.05');
  });
});

describe('records', () => {
  // ghost samples: x, y, turn, dirt every 0.05 s
  const rec = { t: 10, laps: [3, 3.5, 3.5], g: [0, 0, 0, 0, 10, 0, 1, 1, 20, 0, 47, 2, 30, 0, 1, 5] };
  it('convertRecord scales the times and the ghost and marks the new balance version', () => {
    const c = convertRecord(rec, 1.1);
    expect(c.t).toBeCloseTo(11, 9);
    expect(c.laps.map(l => +l.toFixed(6))).toEqual([3.3, 3.85, 3.85]);
    expect(c.g.length % 4).toBe(0);
    expect(c.g.slice(0, 4)).toEqual([0, 0, 0, 0]);
    expect(c.v).toBeGreaterThan(0);
  });
  it('convertRecord keeps the turn index in range when it wraps round', () => {
    const c = convertRecord(rec, .9);
    for (let i = 2; i < c.g.length; i += 4) { expect(c.g[i]).toBeGreaterThanOrEqual(0); expect(c.g[i]).toBeLessThan(48); }
  });
  it('ghostAt interpolates between samples and stops at the end', () => {
    const p = ghostAt(rec.g, .025);
    expect(p.x).toBeCloseTo(5, 9);
    expect(ghostAt(rec.g, 99).x).toBe(30);
  });
});
