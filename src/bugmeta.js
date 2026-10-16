import { G, PREFS, UI } from './g.js';
import { LAPS } from './core.js';
import { placeOf } from './rank.js';

// ---------- what a bug report or an idea knows about the moment it was written ----------
// bugMeta() takes a snapshot of the game (screen, mode, track, lap, place, every car); bugText() turns a report into Markdown,
// the text the dev server writes to feedback/ (bugreport.js). No DOM here, so it can be tested.

const KIND_NAMES = { bug: 'Bug', feature: 'Idee' };

const MODE_NAMES = { gp: 'GRAND PRIX', single: 'EINZELSTRECKE', tt: 'ZEITFAHREN', run: 'MATSCHFAHRT' };
const DIFF_NAMES = ['LEICHT', 'MITTEL', 'SCHWER'];
const RACING = new Set(['countdown', 'race', 'finish', 'pause']);
const r1 = v => Math.round(v * 10) / 10;

function carInfo(c, i) {
  const o = {
    nr: i + 1, auto: c.def.name, ich: !c.ai, x: Math.round(c.x), y: Math.round(c.y), winkel: Math.round(c.ang * 180 / Math.PI),
    tempo: Math.round(Math.hypot(c.vx, c.vy)), runde: c.lap, punkt: c.idx, platz: c.finished ? c.place : placeOf(c), fertig: c.finished,
    dreck: r1(c.dirt), boden: c.surf,
  };
  // only what is going on right now, so the table stays short
  for (const k of ['z', 'stun', 'spin', 'fall', 'boost', 'wet', 'off']) if (c[k]) o[k] = r1(c[k]);
  if (c.washing) o.waschen = true;
  return o;
}

/** a snapshot of the game for a bug report; `extra` adds fields (build, browser) the caller knows */
export function bugMeta(extra = {}) {
  const T = G.T, racing = RACING.has(G.state) && G.player, state = G.state === 'pause' ? 'pause (' + UI.pauseFrom + ')' : G.state;
  /** @type {Record<string, any>} */
  const m = { zeit: new Date().toISOString(), bildschirm: state, modus: MODE_NAMES[G.mode] || G.mode, ...extra };
  if (T) m.strecke = T.name + (T.def && T.def.rev ? ' (rev ' + T.def.rev + ')' : '');
  m.schwierigkeit = DIFF_NAMES[racing ? G.raceDiff : PREFS.diff] || '?';
  if (PREFS.kids) m.kindermodus = true;
  if (G.mode === 'gp' && G.gp) m.cup = G.gp.cup.name + ', Rennen ' + (G.gp.race + 1) + '/' + G.gp.tracks.length;
  if (racing) {
    const me = G.player;
    if (!T.run) m.runde = Math.min(Math.max(me.lap, 1), LAPS) + '/' + LAPS;
    m.platz = (me.finished ? me.place : placeOf(me)) + '/' + G.cars.length;
    m.auto = me.def.name;
    m.rennzeit = r1(G.state === 'pause' ? UI.pauseT : G.stateTime) + ' s (' + (G.state === 'pause' ? UI.pauseFrom : G.state) + ')';
    if (T.def && T.def.events) m.ereignisse = G.fx ? T.def.events.filter(e => PREFS.events[e]).join(', ') || 'aus' : 'aus';
    if (G.tt) m.zeitfahren = r1(G.tt.t) + ' s, Runden ' + G.tt.laps.map(r1).join(' / ');
    if (G.mode === 'run' && G.run) m.matschfahrt = 'Spruenge ' + G.run.jumps + ', Wasser ' + G.run.splashes + ', Matsch ' + G.run.muds;
    m.autos = G.cars.map(carInfo);
  }
  return m;
}

/** a report { id, kind: 'bug' | 'feature', text, meta, img } as Markdown: the text, the snapshot as a table, the cars as a table */
export function bugText(r) {
  const m = { ...r.meta }, cars = m.autos; delete m.autos;
  const out = ['# ' + (KIND_NAMES[r.kind] || 'Bug') + ' ' + r.id, '', r.text.trim() || '(ohne Text)', '', '## Stand', '', '| Feld | Wert |', '|---|---|'];
  for (const [k, v] of Object.entries(m)) out.push('| ' + k + ' | ' + String(v).replace(/\|/g, '/') + ' |');
  if (cars && cars.length) {
    const cols = [...new Set(cars.flatMap(c => Object.keys(c)))];
    out.push('', '## Autos', '', '| ' + cols.join(' | ') + ' |', '|' + cols.map(() => '---|').join(''));
    for (const c of cars) out.push('| ' + cols.map(k => c[k] === undefined ? '' : c[k] === true ? 'ja' : c[k] === false ? '' : String(c[k])).join(' | ') + ' |');
  }
  if (r.img) out.push('', '![Bildschirm](' + r.id + '.jpg)');
  return out.join('\n') + '\n';
}

/** a file name for the report: kind, date, time and track, e.g. bug_2026-10-16_14-03-22_WUESTE */
export function bugId(meta, kind = 'bug') {
  const d = new Date(meta.zeit), p = n => String(n).padStart(2, '0');
  const day = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + '-' + p(d.getMinutes()) + '-' + p(d.getSeconds());
  return kind + '_' + day + (meta.strecke ? '_' + meta.strecke.split(' ')[0].replace(/[^A-Z0-9]/gi, '') : '');
}
