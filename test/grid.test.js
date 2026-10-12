import { describe, expect, it } from 'vitest';
import { CELL, REACH, nearObstacles, obstacleGrid } from '../src/grid.js';

// a small random generator, so the test is the same every time
const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(42);

describe('obstacle grid', () => {
  const W = 800, H = 450, list = Array.from({ length: 400 }, () => ({ x: rnd() * W, y: rnd() * H, r: 2 + rnd() * 20 }));
  const g = obstacleGrid(list, W, H);
  it('finds every obstacle a car (radius 9) or a tyre (7) can touch, in the original order', () => {
    for (let y = -5; y < H + 5; y += 3) for (let x = -5; x < W + 5; x += 3) {
      const near = nearObstacles(g, x, y);
      for (const rad of [9, 7]) {
        const hit = list.filter(o => Math.hypot(x - o.x, y - o.y) < o.r + rad);
        expect(hit.every(o => near.includes(o))).toBe(true);
      }
      const idx = near.map(o => list.indexOf(o));
      expect(idx).toEqual([...idx].sort((a, b) => a - b));
    }
  });
  it('is much smaller than the full list per cell', () => {
    const avg = g.cells.reduce((s, c) => s + c.length, 0) / g.cells.length;
    expect(avg).toBeLessThan(list.length / 10);
    expect(CELL).toBeGreaterThan(REACH);
  });
  it('refuses a missing world size and copes with NaN', () => {
    expect(() => obstacleGrid(list)).toThrow();
    expect(nearObstacles(g, NaN, 3)).toEqual([]);
    expect(nearObstacles(null, 3, 3)).toEqual([]);
  });
});
