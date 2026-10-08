import { G } from './g.js';

// ---------- difficulty, kids mode and track effects ----------
// LEICHT is the game as it always was (calm opponents), but without track effects. From MITTEL on the effects are on.
// The opponents get stronger with the difficulty, they never drive faster than their car can: skill is the throttle (0..1),
// the car's own values (speed, mud, acc, turn) stay the same on every level, so every car keeps its character.
// ahead: an opponent this far ahead of you (share of a lap) lifts off to `slow`; behind: one this far back pushes up to `catchUp` x skill.

export const DIFFS = [
  { name: 'LEICHT', col: '#7bd37b', skill: [.52, .66], ahead: .08, slow: .7, behind: .1, catchUp: 1.25, wander: 14, avoid: 0 },
  { name: 'MITTEL', col: '#ffd23f', skill: [.68, .80], ahead: .12, slow: .8, behind: .1, catchUp: 1.15, wander: 11, avoid: .5 },
  { name: 'SCHWER', col: '#ff6b6b', skill: [.80, .91], ahead: .18, slow: .88, behind: .12, catchUp: 1.1, wander: 8, avoid: 1 },
];

G.diff = 0;
G.kids = false;
G.selFx = false;
try {
  G.diff = Math.min(2, Math.max(0, parseInt(localStorage.getItem('mudracer-diff') || '0', 10) || 0));
  G.kids = localStorage.getItem('mudracer-kids') === '1';
  const fx = localStorage.getItem('mudracer-fx');
  G.selFx = fx === null ? G.diff > 0 : fx === '1';
} catch (e) {}

// the difficulty that really counts: the kids mode always drives on LEICHT
export const curDiff = () => G.kids ? 0 : G.diff;

export function setDiff(d) {
  G.diff = (d + 3) % 3;
  try { localStorage.setItem('mudracer-diff', String(G.diff)); } catch (e) {}
}

export function setFx(on) {
  G.selFx = on;
  try { localStorage.setItem('mudracer-fx', on ? '1' : '0'); } catch (e) {}
}

export function toggleKids() {
  G.kids = !G.kids;
  try { localStorage.setItem('mudracer-kids', G.kids ? '1' : '0'); } catch (e) {}
}

// are the track effects on? Grand Prix: from MITTEL. Single race and time trial: the switch in the options. Kids mode: never.
export function fxActive() {
  if (G.kids) return false;
  return G.mode === 'gp' ? G.diff > 0 : G.selFx;
}

// the throttle of opponent i (1..n) in a field of n opponents: the first ones are the calmest
export function aiSkill(i, n) {
  const [lo, hi] = DIFFS[curDiff()].skill;
  return lo + (n > 1 ? (i - 1) / (n - 1) : 0) * (hi - lo);
}
