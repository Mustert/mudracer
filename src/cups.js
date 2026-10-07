import { G } from './g.js';
import { CAR_DEFS } from './cars.js';
import { TRACKS } from './tracks.js';

// ---------- cups: a Grand Prix is one cup (a short series of races). The first win of a cup unlocks its reward car ----------
// tracks: names of the TRACKS in racing order. A cup without tracks is not built yet and cannot be started.
// (see Obsidian/Mudracer/Strecken.md for the planned cups)

export const CUPS = [
  { n: 1, name: 'BRONZE', tracks: ['WIESE', 'WALD', 'STRAND'] },
  { n: 2, name: 'SILBER', tracks: [] },
  { n: 3, name: 'GOLD', tracks: [] },
  { n: 4, name: 'PLATIN', tracks: [] },
  { n: 5, name: 'FANTASY', tracks: [] },
];

export const cupReady = cup => cup.tracks.length > 0;
export const cupTrackIdx = cup => cup.tracks.map(name => TRACKS.findIndex(t => t.name === name));
export const cupReward = cup => CAR_DEFS.find(d => d.cup === cup.n);
export const cupWon = cup => G.cupsWon.includes(cup.n);

export function markCupWon(cup) {
  if (cupWon(cup)) return false;
  G.cupsWon.push(cup.n);
  try { localStorage.setItem('mudracer-cups', JSON.stringify(G.cupsWon)); } catch (e) {}
  return true;
}

// best final place of one car in one cup (0 = not driven yet)
const placeKey = (cup, def) => 'mudracer-gp-' + cup.n + '-' + def.id;

export function loadBestPlace(cup, def) {
  try { const v = parseInt(localStorage.getItem(placeKey(cup, def)), 10); return v >= 1 ? v : 0; } catch (e) { return 0; }
}

export function saveBestPlace(cup, def, place) {
  const old = loadBestPlace(cup, def);
  if (!old || place < old) try { localStorage.setItem(placeKey(cup, def), String(place)); } catch (e) {}
}
