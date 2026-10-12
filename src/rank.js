import { G } from './g.js';

// ---------- ranking: how far a car is in the race, and its place ----------

// a finished car counts by its finishing place, the others by laps and the point of the centre line they reached
export const score = c => c.finished ? 1e6 - c.place * 1000 : (c.lap - 1) * G.T.N + c.idx;


export const placeOf = c => 1 + G.cars.filter(o => o !== c && score(o) > score(c)).length;


// Grand Prix points for the places 1 to 8
export const POINTS = [10, 8, 6, 5, 4, 3, 2, 1];


// the Grand Prix table: entries by points
export function standings() { return [...G.gp.entries].sort((a, b) => b.pts - a.pts); }
