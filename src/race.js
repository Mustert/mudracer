import { G } from './g.js';
import { AU, SFX } from './audio.js';
import { CAR_DEFS, GENERICS, carSet, isLocked } from './cars.js';
import { cupReward, cupTrackIdx, loadBestPlace, markCupWon, saveBestPlace } from './cups.js';
import { aiSkill, curDiff, fxActive } from './diff.js';
import { setupEvents } from './events.js';
import { VH, VW, clamp, rng } from './core.js';
import { POINTS, setState } from './menus.js';
import { score } from './physics.js';
import { cam } from './state.js';
import { loadRecord, saveRecord, ttLap, ttSample } from './timetrial.js';
import { TRACKS, tctx, trail } from './tracks.js';

// the Grand Prix field: your car, every other unlocked car, then plain cars up to eight (the custom cup: as many as chosen)
// the difficulty is fixed for the whole cup when it starts

export function startGP() {
  const me = CAR_DEFS[G.selCar], n = G.cup.custom ? G.custom.count + 1 : 8;
  const field = [me, ...CAR_DEFS.filter(d => d !== me && !isLocked(d)).sort(() => Math.random() - .5), ...GENERICS].slice(0, n);
  G.gp = { cup: G.cup, diff: curDiff(), tracks: cupTrackIdx(G.cup), race: 0, entries: field.map((def, i) => ({ def, pts: 0, last: 0, me: i === 0, skill: i ? aiSkill(i, field.length - 1) : 1 })) };
  startRace();
}


export function singleField() {
  const me = CAR_DEFS[G.selCar];
  return [me, ...CAR_DEFS.filter(d => d !== me && !isLocked(d)), ...GENERICS].slice(0, G.selCount + 1);
}


export function resetWorld() {
  if (trail.width !== G.T.W || trail.height !== G.T.H) { trail.width = G.T.W; trail.height = G.T.H; }
  tctx.clearRect(0, 0, G.T.W, G.T.H); G.parts = []; G.finCount = 0; G.lastCount = -1;
}


export function makeCar(def, x, y, ang, ai, skill, entry) {
  return { def, entry, F: carSet(def, G.T.th.goo), Fc: G.T.def.cement ? carSet(def, false, true) : null, cem: false, x, y, ang, vx: 0, vy: 0, dirt: 0, lap: 0, cp: 0, idx: 0, off: 0, ai, skill, seed: Math.random() * 100,
    surf: 1, mudTrail: 0, wetTrail: 0, finished: false, place: 0, honk: 0, bump: 0, washing: false, boost: 0, stun: 0, spin: 0, brake: false, z: 0, vz: 0, wet: 0, fall: 0, ghost: 0, safe: 0,
    // race circuit: level at the bridge, slipstream, rocket start, oil just driven through, on a kerb, in the pit lane
    lvl: 0, draft: 0, rocket: 0, oilT: 0, kerb: false, pit: false };
}


export function startRace() {
  let entries;
  if (G.mode === 'gp') { G.T = TRACKS[G.gp.tracks[G.gp.race]]; entries = G.gp.entries; }
  else if (G.mode === 'tt') { G.T = TRACKS[G.selTrack]; entries = [{ def: CAR_DEFS[G.selCar], me: true, skill: 1 }]; }
  else { G.T = TRACKS[G.selTrack]; entries = singleField().map((def, i, all) => ({ def, me: i === 0, skill: i ? aiSkill(i, all.length - 1) : 1 })); }
  G.raceDiff = G.mode === 'gp' ? G.gp.diff : curDiff();
  G.fx = G.mode === 'gp' ? G.gp.diff > 0 && !G.kids : fxActive();
  resetWorld();
  setupEvents(G.T);
  // two cars per row behind the start line; you start in the front row
  G.cars = entries.map((e, k) => {
    const back = 12 + (k >> 1) * 22, side = k % 2 ? 13 : -13;
    const i = (G.T.N - back) % G.T.N, p = G.T.path[i], n = G.T.nrm[i], tg = G.T.tan[i];
    const c = makeCar(e.def, p.x + n.x * side, p.y + n.y * side, Math.atan2(tg.y, tg.x), !e.me, e.skill, e);
    c.idx = i; return c;
  });
  G.player = G.cars[0];
  if (G.T.rail) Object.assign(G.T.rail, { x: G.T.rail.lines[0], sw: -1, gate: 0, signal: false, train: { phase: 'wait', t: 6, dir: 1, y: -9999 } });
  // time trial: the train keeps a fixed timetable so every run (and the ghost) meets it at the same moment
  G.ttRand = G.mode === 'tt' ? rng(2024) : null;
  G.tt = G.mode === 'tt' ? { t: 0, lapStart: 0, laps: [], rec: [], recT: 0, rec0: loadRecord(G.T, G.player.def), delta: null, deltaT: 0, done: false, newBest: false } : null;
  if (G.tt) ttSample(G.player);
  if (AU.E) AU.E.o1.type = G.player.def.id === 'traktor' ? 'square' : 'sawtooth';
  moveCamera(1, true);
  setState('countdown');
}

// called the moment you cross the line: everyone is ranked where they are, points are handed out

export function finishRace() {
  const order = [...G.cars].sort((a, b) => score(b) - score(a));
  if (G.mode === 'gp') order.forEach((c, i) => { c.entry.last = POINTS[i] || 0; c.entry.pts += c.entry.last; });
  if (G.mode === 'tt' && !G.tt.done) {
    ttLap(); ttSample(G.player); G.tt.done = true;
    const prev = G.tt.rec0;
    G.tt.total = G.tt.t; G.tt.diff = prev ? G.tt.t - prev.t : null;
    if (!prev || G.tt.t < prev.t) { G.tt.newBest = true; saveRecord(G.T, G.player.def, { t: G.tt.t, laps: G.tt.laps, g: G.tt.rec }); }
  }
}


export function standings() { return [...G.gp.entries].sort((a, b) => b.pts - a.pts); }


export function beginCeremony() {
  const sorted = standings(), won = sorted[0].me, cup = G.gp.cup, d = G.gp.diff;
  let newCar = null, trophy = -1;
  const mine = sorted.find(e => e.me), place = sorted.indexOf(mine) + 1;
  // the custom cup has no trophies and unlocks nothing; the kids mode wins trophies (LEICHT) but does not unlock cars for the normal game.
  // trophy: the difficulty when the place is better than the best one so far (a new cup in gold, silver or bronze, or a new ribbon)
  if (!cup.custom) {
    const old = loadBestPlace(cup, mine.def, d);
    if (!old || place < old) trophy = d;
    saveBestPlace(cup, mine.def, place, d);
    if (won && !G.kids && markCupWon(cup)) newCar = cupReward(cup) || null;
  }
  G.ceremony = { sorted, won, newCar, trophy, diff: d, place, def: mine.def };
  G.parts = [];
  setState('ceremony');
  SFX.fanfare();
}


export function moveCamera(dt, snap) {
  const tx = clamp(G.player.x + G.player.vx * .35 - VW / 2, 0, G.T.W - VW), ty = clamp(G.T.run ? G.player.y - VH * .66 : G.player.y + G.player.vy * .35 - VH / 2, 0, G.T.H - VH);
  const f = snap ? 1 : 1 - Math.exp(-5 * dt);
  cam.x += (tx - cam.x) * f; cam.y += (ty - cam.y) * f;
}
