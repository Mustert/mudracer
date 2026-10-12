import { describe, expect, it } from 'vitest';
import { G } from '../src/g.js';
import { placeOf, score } from '../src/rank.js';

describe('ranking', () => {
  it('orders by laps, then by the point of the lap, finished cars by their place', () => {
    G.T = { N: 1000 };
    const a = { lap: 2, idx: 10 }, b = { lap: 1, idx: 900 }, c = { lap: 3, idx: 5, finished: true, place: 2 }, d = { lap: 3, idx: 1, finished: true, place: 1 };
    G.cars = [a, b, c, d];
    expect(score(a)).toBeGreaterThan(score(b));
    expect(score(d)).toBeGreaterThan(score(c));
    expect(G.cars.map(placeOf)).toEqual([3, 4, 2, 1]);
  });
});
