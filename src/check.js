import { G, PREFS } from './g.js';
import { AU } from './audio.js';
import { CAR_DEFS, completeSet } from './cars.js';
import { HALF, LAPS, MUD_A, MUD_B, angDiff } from './core.js';
import { CUPS } from './cups.js';
import { DIFFS } from './diff.js';
import { nearObstacles } from './grid.js';
import { hasSong } from './music.js';
import { raceSets } from './idle.js';
import { singleField, startRace } from './race.js';
import { FX_NAMES } from './raceopts.js';
import { score } from './rank.js';
import { setState } from './state.js';
import { TRACKS, ensureTrack } from './tracks.js';
import { update } from './update.js';

// ---------- dev server only: checks a track against the track design rules (CLAUDE.md) and prints a short text report ----------
// In the browser console (or through the preview): mudracer.check('WIESE'), mudracer.check(14, { sim: false }), mudracer.checkAll(),
// mudracer.checkPic('WIESE') shows the whole map with what the check found (click it or call checkPic() to close it).
// The race simulation runs a whole race at once (every car driven by the computer, yours at full throttle) and leaves the game in the
// main menu afterwards. The numbers are estimates for a person to judge, not a verdict: a short cut can be meant (the ice lake).

const BASE_EV = new Set(['t', 'cows', 'holes', 'rain', 'flood', 'pier', 'kois', 'kipper']);
const ROWS = 5, GRID_OK = 8; // 10 cars in 5 rows (race.js startRace); degrees the road may turn along the grid
let last = null;

const trackOf = q => typeof q === 'number' ? TRACKS[q] : TRACKS.find(t => t.name === String(q).toUpperCase());
const deg = a => Math.round(Math.abs(a) * 180 / Math.PI);
const ang = v => Math.atan2(v.y, v.x);
const px = n => Math.round(n) + ' px';

// where the track sits in the cups: cup number, place in the cup, track number 1..15
function placeOf(T) {
  for (const cup of CUPS) {
    if (!cup.tracks) continue;
    const k = cup.tracks.indexOf(T.name);
    if (k >= 0) return { cup: cup.n, nr: (cup.n - 1) * 3 + k + 1 };
  }
  return null;
}

// how fast a car (mud 1) is on a terrain, as a share of the road (physics.js surfOf); null: a car cannot cross it
function speedOn(T, t) {
  const mud = MUD_A + MUD_B;
  if (t === 5 || t === 11 || t === 15) return null; // deep water, gorge, lava
  if (t === 48 && T.rainbow) return null; // cloud hole
  if (t === 0) return T.space ? null : mud;
  if (t === 2 || t === 13) return mud;
  if (t === 6) return mud / 3.8;
  if (t === 3) return .72;
  if (t === 7 || t === 10) return .3;
  if (t === 60 || t === 61) return .7; // (desert: rally sand)
  if (t === 14) return .6;
  return 1;
}

// rule 5: the start grid stands on a straight; every spot on the road, free of obstacles and of bad ground
function gridCheck(T) {
  const N = T.N, ref = ang(T.tan[(N - 12) % N]);
  let worst = 0;
  for (let back = 0; back <= 12 + (ROWS - 1) * 22 + 6; back++) worst = Math.max(worst, Math.abs(angDiff(ang(T.tan[(N - back) % N]), ref)));
  const bad = [];
  for (let k = 0; k < ROWS * 2; k++) {
    const back = 12 + (k >> 1) * 22, side = k % 2 ? 13 : -13, i = (N - back) % N, p = T.path[i], n = T.nrm[i];
    const x = p.x + n.x * side, y = p.y + n.y * side, t = T.ter[(y | 0) * T.W + (x | 0)];
    const hit = nearObstacles(T.grid, x, y).some(o => Math.hypot(x - o.x, y - o.y) < o.r + 9);
    if (hit || speedOn(T, t) === null || speedOn(T, t) < 1) bad.push('Platz ' + (k + 1) + (hit ? ' Hindernis' : ' Boden ' + t));
  }
  return { turn: deg(worst), ok: deg(worst) <= GRID_OK && !bad.length, bad };
}

// rule 4: places where a straight line between two parts of the road is shorter than the road and a car can drive it.
// counts: the lap still counts (no checkpoint is skipped, physics.js updateProgress), i.e. the short cut works.
function shortcuts(T) {
  const N = T.N, step = 6, out = [];
  for (let a = 0; a < N; a += step) for (let b = a + 60; b < N; b += step) {
    const along = Math.min(b - a, N - (b - a)) * 2, p = T.path[a], q = T.path[b], d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d > 220 || along - d < 80) continue;
    let cost = 0, ok = true;
    for (let s = 0; s <= d; s += 2) {
      const x = p.x + (q.x - p.x) * s / d, y = p.y + (q.y - p.y) * s / d, t = T.ter[(y | 0) * T.W + (x | 0)], v = speedOn(T, t);
      if (v === null || nearObstacles(T.grid, x, y).some(o => !o.up && !o.down && Math.hypot(x - o.x, y - o.y) < o.r + 7)) { ok = false; break; }
      cost += 2 / v;
    }
    if (!ok) continue;
    const gain = along - cost;
    if (gain < 40) continue;
    // forward through the short cut: from the earlier sample to the later one (or across the line)
    const [from, to] = b - a <= N / 2 ? [a, b] : [b, a + N];
    let counts = true;
    for (let qq = 0; qq < 8; qq++) { const w0 = qq * N / 4, w1 = w0 + N / 8; if (w0 > from + 4 && w1 < to - 4) counts = false; }
    out.push({ a, b, x0: p.x, y0: p.y, x1: q.x, y1: q.y, len: Math.round(d), gain: Math.round(gain), counts });
  }
  // keep the best one of every cluster
  out.sort((u, v) => v.gain - u.gain);
  const keep = [];
  for (const s of out) if (!keep.some(k => Math.hypot(k.x0 - s.x0, k.y0 - s.y0) < 60 && Math.hypot(k.x1 - s.x1, k.y1 - s.y1) < 60)) keep.push(s);
  return keep.slice(0, 8);
}

// a whole race: every car by the computer (yours at full throttle), counts laps, falls, cars that are stuck
function simulate(T, o) {
  const keep = { mode: G.mode, track: PREFS.selTrack, count: PREFS.selCount, fx: PREFS.selFx, kids: PREFS.kids, gain: AU.m ? AU.m.gain.value : null, music: AU.music };
  if (AU.m) AU.m.gain.value = 0;
  AU.music = false;
  G.mode = 'single'; PREFS.selTrack = TRACKS.indexOf(T); PREFS.selCount = 9;
  PREFS.selFx = o.fx; PREFS.kids = false; // (startRace reads these: without them the events would not start at all)
  for (const s of raceSets(T, singleField())) completeSet(s);
  startRace();
  G.raceDiff = o.diff; G.fx = o.fx;
  const field = G.cars.length;
  G.cars.forEach((c, i) => { c.skill = i ? DIFFS[o.diff].skill[0] + (i - 1) / Math.max(1, field - 2) * (DIFFS[o.diff].skill[1] - DIFFS[o.diff].skill[0]) : 1; });
  G.player.ai = true;
  setState('race');
  const dt = 1 / 60, info = G.cars.map(() => ({ laps: [], lapT: 0, prog: 0, progT: 0, stuck: false, falls: 0, rev: 0, off: 0 }));
  const events = [];
  let t = 0;
  for (; t < o.maxT && !G.cars.every(c => c.finished); t += dt) {
    G.time += dt; G.stateTime += dt;
    const before = G.cars.map(c => [c.lap, c.fall, c.rev || 0]);
    update(dt);
    G.cars.forEach((c, i) => {
      const I = info[i], [lap0, fall0, rev0] = before[i];
      if (c.lap > lap0 && c.lap > 1 && c.lap <= LAPS + 1) { I.laps.push(+(t - I.lapT).toFixed(1)); I.lapT = t; } else if (c.lap > lap0) I.lapT = t;
      if (c.fall > 0 && !(fall0 > 0)) { I.falls++; events.push({ k: 'fall', x: c.x, y: c.y, what: c.fallKind || 'wasser', car: i }); }
      if ((c.rev || 0) > rev0 + .5) { I.rev++; if (I.rev % 3 === 1) events.push({ k: 'rev', x: c.x, y: c.y, car: i }); }
      const s = score(c);
      if (s > I.prog + 4) { I.prog = s; I.progT = t; } else if (!c.finished && t - I.progT > 8 && !I.stuck) { I.stuck = true; events.push({ k: 'stuck', x: c.x, y: c.y, car: i }); }
      if (!c.finished && T.dist && T.dist[(c.y | 0) * T.W + (c.x | 0)] >= HALF) I.off += dt;
    });
  }
  const evKeys = Object.keys(T.ev || {}).filter(k => !BASE_EV.has(k));
  const res = { t, info, events, evKeys, done: G.cars.filter(c => c.finished).length, field };
  G.mode = keep.mode; PREFS.selTrack = keep.track; PREFS.selCount = keep.count; PREFS.selFx = keep.fx; PREFS.kids = keep.kids; AU.music = keep.music;
  if (AU.m && keep.gain !== null) AU.m.gain.value = keep.gain;
  G.player.ai = false;
  setState('main');
  return res;
}

/**
 * Checks one track and returns the report as text.
 * @param {string|number} q the track name (WIESE) or its index in TRACKS
 * @param {{ sim?: boolean, diff?: number, fx?: boolean, maxT?: number }} [opt] sim: run a race (default true), diff 0..2 (default 2), fx: track events (default true)
 */
export function check(q, opt = {}) {
  const o = { sim: true, diff: 2, fx: true, maxT: 400, ...opt }, T = trackOf(q);
  if (!T) return 'Keine Strecke ' + q + '. Namen: ' + TRACKS.map(t => t.name).join(', ');
  const L = [], warn = [], def = T.def, wasBuilt = T.built, t0 = performance.now();
  ensureTrack(T);
  const buildMs = Math.round(performance.now() - t0), at = placeOf(T);
  L.push(T.name + (at ? ' (Strecke ' + at.nr + ', Cup ' + at.cup + ')' : ' (in keinem Cup)') + ', ' + T.W + 'x' + T.H + ', rev ' + (def.rev || 0) + ', Thema ' + def.theme + ', Lied ' + def.song);
  L.push('Bau: ' + (wasBuilt ? 'war schon gebaut' : buildMs + ' ms am Stück') + '; Mittellinie ' + T.N + ' Punkte (' + px(T.N * 2) + ')');
  // rules 7 and 8: events that can be switched off and have a name in the race options, a song of its own
  const evs = def.events || [];
  if (!evs.length) warn.push('Grundsatz 7: kein Streckenereignis');
  for (const e of evs) {
    if (PREFS.events[e] !== true) warn.push('Grundsatz 7: Ereignis ' + e + ' fehlt in PREFS.events (state.js)');
    if (!FX_NAMES[e]) warn.push('Ereignis ' + e + ' hat keinen Namen in FX_NAMES (raceopts.js)');
  }
  if (!hasSong(def.song)) warn.push('Grundsatz 8: Lied ' + def.song + ' gibt es nicht (music.js)');
  else { const same = TRACKS.filter(t => t !== T && t.def.song === def.song).map(t => t.name); if (same.length) warn.push('Grundsatz 8: Lied ' + def.song + ' auch auf ' + same.join(', ')); }
  L.push('Ereignisse: ' + (evs.join(', ') || '-'));
  // rule 5
  const g = gridCheck(T);
  L.push('Startaufstellung: Straße dreht sich auf ' + px((12 + (ROWS - 1) * 22) * 2) + ' um ' + g.turn + '°' + (g.ok ? ' (ok)' : '') + (g.bad.length ? '; ' + g.bad.join(', ') : ''));
  if (!g.ok) warn.push('Grundsatz 5: Startaufstellung nicht gerade/frei (' + g.turn + '°, erlaubt ' + GRID_OK + '°' + (g.bad.length ? ', ' + g.bad.join(', ') : '') + ')');
  // rule 4
  const sc = shortcuts(T);
  L.push('Abkürzungen (gerade Linie fahrbar, Gewinn in Straßen-px): ' + (sc.length ? '' : 'keine'));
  for (const s of sc) L.push('  ' + Math.round(s.x0) + ',' + Math.round(s.y0) + ' -> ' + Math.round(s.x1) + ',' + Math.round(s.y1) + ': ' + s.len + ' px Luftlinie, spart ~' + s.gain + ' px, Runde zählt ' + (s.counts ? 'JA' : 'nein'));
  if (sc.some(s => s.counts)) warn.push('Grundsatz 4: ' + sc.filter(s => s.counts).length + ' fahrbare Abkürzung(en), bei denen die Runde zählt (gewollt?)');
  // terrain codes (ANALYSE.md T21)
  const hist = new Map(); for (let j = 0; j < T.ter.length; j++) hist.set(T.ter[j], (hist.get(T.ter[j]) || 0) + 1);
  L.push('Boden-Codes: ' + [...hist].sort((a, b) => a[0] - b[0]).map(([k, n]) => k + ':' + (n * 100 / T.ter.length).toFixed(1) + '%').join(' '));
  const res = { name: T.name, nr: at && at.nr, size: T.W + 'x' + T.H, buildMs: wasBuilt ? null : buildMs, grid: g.turn, gridOk: g.ok, shortcuts: sc, codes: [...hist.keys()], warn };
  if (o.sim) {
    const s = simulate(T, o), me = s.info[0], best = s.info.reduce((m, I) => I.laps.length ? Math.min(m, ...I.laps) : m, Infinity);
    L.push('Rennen (' + DIFFS[o.diff].name + ', Effekte ' + (o.fx ? 'an' : 'aus') + ', ' + s.field + ' Autos, ' + LAPS + ' Runden): ' + s.done + '/' + s.field + ' im Ziel nach ' + s.t.toFixed(0) + ' s');
    L.push('  Bot (Vollgas, ' + CAR_DEFS[PREFS.selCar].name + '): Runden ' + (me.laps.join(' / ') || '-') + ' s, neben der Straße ' + me.off.toFixed(1) + ' s, Stürze ' + me.falls + ', Zurücksetzen ' + me.rev);
    L.push('  schnellste Runde im Feld ' + (best < Infinity ? best + ' s' : '-') + '; Stürze gesamt ' + s.info.reduce((n, I) => n + I.falls, 0) + ', Zurücksetzen gesamt ' + s.info.reduce((n, I) => n + I.rev, 0));
    const stuck = s.events.filter(e => e.k === 'stuck');
    for (const e of stuck) L.push('  hängt fest (8 s ohne Fortschritt): Auto ' + e.car + ' bei ' + Math.round(e.x) + ',' + Math.round(e.y));
    if (stuck.length) warn.push(stuck.length + ' Auto(s) hängen fest');
    if (s.done < s.field) warn.push('nur ' + s.done + ' von ' + s.field + ' Autos im Ziel (' + o.maxT + ' s)');
    const falls = s.events.filter(e => e.k === 'fall');
    if (falls.length) L.push('  Stürze: ' + Object.entries(falls.reduce((m, e) => (m[e.what] = (m[e.what] || 0) + 1, m), {})).map(([k, n]) => k + ' ' + n).join(', '));
    L.push('  eigene Felder in T.ev: ' + (s.evKeys.join(', ') || '-'));
    Object.assign(res, { lap: me.laps, best: best < Infinity ? best : null, falls: falls.length, stuck: stuck.length, evKeys: s.evKeys, events: s.events });
  }
  L.push(warn.length ? 'PRÜFEN:\n' + warn.map(w => '  - ' + w).join('\n') : 'Keine Auffälligkeiten.');
  last = { T, res };
  console.log(L.join('\n'));
  return L.join('\n');
}

/**
 * All tracks in one table (rule 1: is a later track at least as demanding?). Without sim it is quick; with sim it takes a while.
 * @param {{ sim?: boolean, diff?: number, fx?: boolean }} [opt]
 */
export function checkAll(opt = {}) {
  const o = { sim: false, ...opt }, rows = [], evOwners = new Map(), codeOwners = new Map();
  for (const T of [...TRACKS].sort((a, b) => ((placeOf(a) || { nr: 99 }).nr - (placeOf(b) || { nr: 99 }).nr))) {
    check(T.name, o);
    const r = last.res;
    for (const k of r.evKeys || []) evOwners.set(k, [...(evOwners.get(k) || []), r.name]);
    for (const k of r.codes) if (k >= 18) codeOwners.set(k, [...(codeOwners.get(k) || []), r.name]);
    rows.push((r.nr || '-') + ' ' + r.name.padEnd(12) + r.size.padStart(10) + '  Bau ' + String(r.buildMs ?? '-').padStart(5) + ' ms  Start ' + String(r.grid).padStart(3) + '°' + (r.gridOk ? '   ' : ' ! ') +
      ' Abk. ' + r.shortcuts.filter(s => s.counts).length + '/' + r.shortcuts.length + (o.sim ? '  Runde ' + String(r.best ?? '-').padStart(5) + ' s  Stürze ' + r.falls + '  fest ' + r.stuck : '') + '  ' + r.warn.length + ' Hinweise');
  }
  const L = ['Nr Strecke         Größe  Bau        Start    Abk. (zählt/alle)' + (o.sim ? '  schnellste Runde' : ''), ...rows];
  const shared = [...codeOwners].filter(([, v]) => v.length > 1);
  if (shared.length) L.push('Boden-Codes ab 18 auf mehreren Strecken: ' + shared.map(([k, v]) => k + ' (' + v.join(', ') + ')').join('; '));
  const evShared = [...evOwners].filter(([, v]) => v.length > 1);
  if (evShared.length) L.push('T.ev-Felder auf mehreren Strecken: ' + evShared.map(([k, v]) => k + ' (' + v.join(', ') + ')').join('; '));
  console.log(L.join('\n'));
  return L.join('\n');
}

/**
 * The whole map of a track over the page, with the centre line, the checkpoints, the start grid, the short cuts (red: the lap counts,
 * orange: it does not) and from the last race falls (blue), backing up (yellow) and stuck cars (red X). No argument: closes it.
 * @param {string|number} [q]
 */
export function checkPic(q) {
  document.getElementById('mr-check')?.remove();
  if (q === undefined) return 'zu';
  const T = trackOf(q);
  if (!T) return 'Keine Strecke ' + q;
  if (!last || last.T !== T) check(q, { sim: false });
  ensureTrack(T);
  const r = last.res, s = Math.min(innerWidth / T.W, innerHeight / T.H), c = document.createElement('canvas');
  c.id = 'mr-check'; c.width = Math.round(T.W * s); c.height = Math.round(T.H * s);
  Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: '99', background: '#000', cursor: 'pointer' });
  c.onclick = () => c.remove();
  const g = c.getContext('2d');
  g.drawImage(T.base, 0, 0, c.width, c.height); g.drawImage(T.top, 0, 0, c.width, c.height);
  g.scale(s, s);
  g.lineWidth = 1.5 / s; g.strokeStyle = 'rgba(255,255,255,.7)'; g.setLineDash([6, 6]); g.beginPath();
  T.path.forEach((p, i) => (i ? g.lineTo : g.moveTo).call(g, p.x, p.y)); g.closePath(); g.stroke(); g.setLineDash([]);
  g.font = 14 / s + 'px monospace'; g.fillStyle = '#fff';
  for (let k = 0; k < 4; k++) { const i = Math.floor(k * T.N / 4), p = T.path[i], n = T.nrm[i]; g.lineWidth = 4 / s; g.strokeStyle = '#ff00ff'; g.beginPath(); g.moveTo(p.x - n.x * HALF, p.y - n.y * HALF); g.lineTo(p.x + n.x * HALF, p.y + n.y * HALF); g.stroke(); g.fillText('CP' + k, p.x + n.x * (HALF + 4), p.y + n.y * (HALF + 4)); }
  for (let k = 0; k < ROWS * 2; k++) {
    const i = (T.N - 12 - (k >> 1) * 22) % T.N, p = T.path[i], n = T.nrm[i], side = k % 2 ? 13 : -13;
    g.fillStyle = r.gridOk ? '#00ff66' : '#ff2222'; g.fillRect(p.x + n.x * side - 3, p.y + n.y * side - 3, 6, 6);
  }
  for (const sc of r.shortcuts) { g.strokeStyle = sc.counts ? '#ff2222' : '#ff9900'; g.lineWidth = 3 / s; g.beginPath(); g.moveTo(sc.x0, sc.y0); g.lineTo(sc.x1, sc.y1); g.stroke(); }
  for (const e of r.events || []) {
    g.strokeStyle = g.fillStyle = e.k === 'fall' ? '#3d7bff' : e.k === 'rev' ? '#ffd23f' : '#ff2222'; g.lineWidth = 3 / s;
    if (e.k === 'stuck') { g.beginPath(); g.moveTo(e.x - 8, e.y - 8); g.lineTo(e.x + 8, e.y + 8); g.moveTo(e.x + 8, e.y - 8); g.lineTo(e.x - 8, e.y + 8); g.stroke(); }
    else { g.beginPath(); g.arc(e.x, e.y, 4, 0, Math.PI * 2); g.fill(); }
  }
  document.body.appendChild(c);
  return T.name + ' gezeigt (' + c.width + 'x' + c.height + '), Klick schließt';
}
