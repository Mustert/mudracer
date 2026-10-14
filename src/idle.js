import { G, PREFS } from './g.js';
import { CAR_DEFS, GENERICS, carSet, isLocked, stepSet } from './cars.js';
import { cupReady, cupTrackIdx } from './cups.js';
import { VW, ctx } from './core.js';
import { R1, text } from './gfx.js';
import { setState } from './state.js';
import { drawMenuBg } from './screens.js';
import { TRACKS, stepTrack, trackPicture, useTrack } from './tracks.js';

// ---------- work in the background: nothing heavy is built at the start ----------
// Tracks (tracks.js) and the turns of the car sprites (cars.js) are built by generators that can stop after every slice.
// After each frame idleWork() runs slices for a few milliseconds while a menu is on screen, most urgent first: the track the
// menu points at, then the menu pictures of all tracks, then the sprites of the cars for the next race. During a race nothing runs
// here (main.js lets the Matschfahrt paint its tiles ahead, run.js). A race that needs something unfinished first waits on the
// loading screen, which works with a bigger budget.

const MENU_MS = 6, LOAD_MS = 40;
const BUSY = new Set(['countdown', 'race', 'finish', 'pause']);

// the track the next race will probably be on (or null)
export function upcomingTrack() {
  if (G.mode === 'gp') {
    if (G.state === 'standings' && G.gp) return TRACKS[G.gp.tracks[G.gp.race + 1]] || null;
    if (PREFS.cup && cupReady(PREFS.cup)) return TRACKS[cupTrackIdx(PREFS.cup)[0]] || null;
    return null;
  }
  return G.mode === 'single' || G.mode === 'tt' ? TRACKS[PREFS.selTrack] : null;
}

// the sprite sets a race on track T needs for these cars (the cement track also needs the grey ones; a second set from goo2: the golden caramel
// of Süßigkeitenland in its theme, the brown mud of the rainbow in its track definition)
export function raceSets(T, defs) {
  const out = [];
  for (const d of defs) { out.push(carSet(d, T.th.goo)); const g2 = T.th.goo2 || T.def.goo2; if (T.def.cement) out.push(carSet(d, false, true)); else if (g2) out.push(carSet(d, g2)); }
  return out;
}

// the cars that will probably drive the next race: your car, the unlocked ones, plain cars to fill the field
function upcomingField() {
  const me = CAR_DEFS[PREFS.selCar];
  if (G.mode === 'tt') return [me];
  if (G.gp && G.state === 'standings') return G.gp.entries.map(e => e.def);
  return [me, ...CAR_DEFS.filter(d => d !== me && !isLocked(d)), ...GENERICS].slice(0, 8);
}

// the next piece of work, or null when everything that is useful now is done
function nextJob() {
  const T = upcomingTrack();
  if (T && !T.built) { if (!T.job) useTrack(T); return until => stepTrack(T, until); }
  // the menu pictures: in the track choice the neighbours first
  const n = TRACKS.length, order = G.state === 'select_track' ? [1, -1, 2, -2].map(o => TRACKS[(PREFS.selTrack + o + n) % n]).concat(TRACKS) : TRACKS;
  const pic = order.find(t => !t.preview);
  if (pic) return until => stepTrack(pic, until);
  if (T) { const S = raceSets(T, upcomingField()).find(s => !s.done); if (S) return until => stepSet(S, until); }
  if (G.mode === 'run') { const S = carSet(CAR_DEFS[PREFS.selCar], false); if (!S.done) return until => stepSet(S, until); }
  return null;
}

export function idleWork() {
  if (G.state === 'loading') { runLoading(performance.now() + LOAD_MS); return; }
  if (BUSY.has(G.state)) return;
  const until = performance.now() + MENU_MS;
  while (performance.now() < until) { const job = nextJob(); if (!job) return; job(until); }
}

// ----- the loading screen: a race waits until its track and sprites are built -----

export function loadThen(T, sets, then) {
  G.loading = { T, sets, then, from: G.state };
  setState('loading');
}

function runLoading(until) {
  const L = G.loading;
  if (!L) { setState('main'); return; }
  if (!stepTrack(L.T, until)) return;
  for (const S of L.sets) if (!stepSet(S, until)) return;
  G.loading = null;
  L.then();
}

export function drawLoading() {
  const L = G.loading; if (!L) return;
  drawMenuBg(L.T);
  const done = L.sets.filter(s => s.done).length, f = (L.T.built ? 1 : L.T.progress) * .8 + (L.sets.length ? done / L.sets.length : 1) * .2;
  ctx.drawImage(trackPicture(L.T), 0, 0, VW, 270, VW / 2 - 112, 50, 224, 126);
  text(L.T.name, VW / 2, 188, 16, '#ffd23f', 'center');
  const w = 200, x = VW / 2 - w / 2, y = 214;
  R1(x - 2, y - 2, w + 4, 12, '#1b120c'); R1(x, y, w, 8, '#3a2a1c'); R1(x, y, Math.round(w * f), 8, '#7bd37b');
  text('STRECKE WIRD GEBAUT', VW / 2, 234, 8, '#d8c4a8', 'center');
}
