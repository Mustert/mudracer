import { G } from './g.js';
import { CAR_DEFS } from './cars.js';
import { TRACKS } from './tracks.js';

// ---------- cups: a Grand Prix is one cup (a short series of races). The first win of a cup unlocks its reward car ----------
// tracks: names of the TRACKS in racing order. A cup without tracks is not built yet and cannot be started.
// all: n = every track of the cups 1..n in a row (Supercup, Superdupercup). custom: the tracks are chosen by the player.
// unlock: a cup that has to be earned first (the kids mode opens everything).
// (see Obsidian/Mudracer/Strecken.md for the planned cups)

export const CUPS = [
  { n: 1, name: 'BRONZE', tracks: ['WIESE', 'WALD', 'STRAND'] },
  { n: 2, name: 'SILBER', tracks: ['ZUG', 'BAUSTELLE', 'GARTEN'] },
  { n: 3, name: 'GOLD', tracks: ['RENNSTRECKE', 'WUESTE', 'EIS'] },
  { n: 4, name: 'PLATIN', tracks: ['VULKAN'] },
  { n: 5, name: 'FANTASY', tracks: [] },
  { n: 6, name: 'SUPER', label: 'SUPERCUP', all: 4, unlock: () => [1, 2, 3, 4].every(n => G.cupsWon.includes(n)), need: 'GEWINNE CUP 1 BIS 4' },
  { n: 7, name: 'SUPERDUPER', label: 'SUPERDUPER', all: 5, unlock: () => G.cupsWon.includes(5), need: 'GEWINNE CUP 5 (FANTASY)' },
  { n: 8, name: 'CUSTOM', label: 'CUSTOM CUP', custom: true },
];

export const cupLabel = cup => cup.label || 'CUP ' + cup.n;
export const cupLocked = cup => !G.kids && !!cup.unlock && !cup.unlock();
export const cupTrackIdx = cup => {
  if (cup.custom) return G.custom.tracks.slice();
  const names = cup.all ? CUPS.filter(c => c.n <= cup.all).flatMap(c => c.tracks) : cup.tracks;
  return names.map(name => TRACKS.findIndex(t => t.name === name));
};
export const cupReady = cup => cup.custom || cupTrackIdx(cup).length > 0;
export const cupReward = cup => CAR_DEFS.find(d => d.cup === cup.n);
export const cupWon = cup => G.cupsWon.includes(cup.n);

export function markCupWon(cup) {
  if (cupWon(cup)) return false;
  G.cupsWon.push(cup.n);
  try { localStorage.setItem('mudracer-cups', JSON.stringify(G.cupsWon)); } catch (e) {}
  return true;
}

// ----- the custom cup: which tracks (in order, a track may come more than once) and how many opponents -----

export const CUSTOM_MAX = 12;
G.custom = { tracks: [0, 1, 2], count: 5 };
try {
  const c = JSON.parse(localStorage.getItem('mudracer-custom') || 'null');
  if (c && Array.isArray(c.tracks)) G.custom.tracks = c.tracks.filter(i => Number.isInteger(i) && i >= 0 && i < TRACKS.length).slice(0, CUSTOM_MAX);
  if (c && c.count >= 2 && c.count <= 7) G.custom.count = c.count;
} catch (e) {}

export function saveCustom() { try { localStorage.setItem('mudracer-custom', JSON.stringify(G.custom)); } catch (e) {} }

// ----- best final place and trophies of one car in one cup, per difficulty (0 LEICHT, 1 MITTEL, 2 SCHWER) -----
// Saves from before the difficulties have no level in the key: those races were LEICHT (same opponents), a win there is the LEICHT trophy.

const placeKey = (cup, def, d) => 'mudracer-gp-' + cup.n + (d ? '-d' + d : '') + '-' + def.id;

export function loadBestPlace(cup, def, d) {
  try { const v = parseInt(localStorage.getItem(placeKey(cup, def, d)), 10); return v >= 1 ? v : 0; } catch (e) { return 0; }
}

export function saveBestPlace(cup, def, place, d) {
  const old = loadBestPlace(cup, def, d);
  if (!old || place < old) try { localStorage.setItem(placeKey(cup, def, d), String(place)); } catch (e) {}
}

// a trophy is the cup won (first place in the final standings) on that difficulty
export const hasTrophy = (cup, def, d) => loadBestPlace(cup, def, d) === 1;
export const trophies = (cup, def) => [0, 1, 2].map(d => hasTrophy(cup, def, d));
// the best final place per difficulty (0 = not raced yet): 1-3 a gold, silver or bronze cup, from 4 on a ribbon
export const places = (cup, def) => [0, 1, 2].map(d => loadBestPlace(cup, def, d));
