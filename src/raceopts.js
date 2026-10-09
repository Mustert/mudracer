import { G } from './g.js';
import { SFX } from './audio.js';
import { CAR_DEFS, carSet } from './cars.js';
import { VW, clamp, ctx } from './core.js';
import { DIFFS, setDiff, setFx } from './diff.js';
import { R1, text, tri } from './draw.js';
import { is } from './input.js';
import { setState } from './menus.js';
import { singleField, startRace } from './race.js';
import { drawMenuBg } from './screens.js';
import { fmtTime, loadRecord } from './timetrial.js';
import { TRACKS } from './tracks.js';

// ---------- race options before a single race or a time trial: one row per setting, the last row starts ----------
// Einzelstrecke: opponents, difficulty, track effects. Zeitfahren: ghost, track effects. The kids mode hides what it decides itself.

const ROWS = { x: VW / 2 - 130, w: 260, y0: 44, h: 20, pitch: 24 };
const FX_NAMES = { kuehe: 'KUEHE', regen: 'REGEN', flut: 'FLUT', zug: 'ZUG', kipper: 'KIPPLASTER', kois: 'KOIS', reifen: 'REIFEN', sandsturm: 'SANDSTURM', frost: 'FROST', pinguine: 'PINGUINE', ausbruch: 'AUSBRUCH' };

G.raceRow = 0;

const trackFx = () => (TRACKS[G.selTrack].def.events || []).map(e => FX_NAMES[e]);

function rows() {
  if (G.mode === 'tt') return G.kids ? ['go'] : ['ghost', 'fx', 'go'];
  return G.kids ? ['count', 'go'] : ['count', 'diff', 'fx', 'go'];
}

export function openRaceOpts() { G.raceRow = 0; setState('select_count'); }

function label(r) {
  if (r === 'count') return ['GEGNER', String(G.selCount), '#ffd23f'];
  if (r === 'diff') return ['SCHWIERIGKEIT', DIFFS[G.diff].name, DIFFS[G.diff].col];
  if (r === 'ghost') return ['GEIST', G.selGhost ? 'AN' : 'AUS', G.selGhost ? '#7bd37b' : '#ff6b6b'];
  if (r === 'fx') return trackFx().length ? ['STRECKENEFFEKTE', G.selFx ? 'AN' : 'AUS', G.selFx ? '#7bd37b' : '#ff6b6b'] : ['STRECKENEFFEKTE', 'KEINE', '#9a8a78'];
  return ['LOS!', '', ''];
}

function change(r, dir) {
  if (r === 'count') G.selCount = clamp(G.selCount + dir, 1, 7);
  else if (r === 'diff') { setDiff(G.diff + dir); setFx(G.diff > 0); } // LEICHT means no effects, from MITTEL on they are on (the switch below can still change it)
  else if (r === 'ghost') { G.selGhost = !G.selGhost; try { localStorage.setItem('mudracer-ghost', G.selGhost ? '1' : '0'); } catch (e) {} }
  else if (r === 'fx') { if (!trackFx().length) { SFX.bump(); return; } setFx(!G.selFx); }
  else return;
  G.selAnim = G.time; SFX.click();
}

export function raceOptsKey(k) {
  const R = rows(), r = R[G.raceRow] || 'go';
  if (is(k, 'up')) { G.raceRow = (G.raceRow + R.length - 1) % R.length; SFX.click(); }
  else if (is(k, 'down')) { G.raceRow = (G.raceRow + 1) % R.length; SFX.click(); }
  else if (is(k, 'left') || is(k, 'right')) { if (r !== 'go') change(r, is(k, 'left') ? -1 : 1); }
  else if (is(k, 'ok')) startRace(); // ENTER starts from every row
  else if (is(k, 'back')) setState('select_car');
}

// a tap on a row focuses it, a second tap changes it (or starts on LOS!); false = the tap missed every row
export function raceOptsClick(x, y) {
  const R = rows();
  for (let i = 0; i < R.length; i++) {
    const ry = ROWS.y0 + i * ROWS.pitch;
    if (x < ROWS.x - 20 || x > ROWS.x + ROWS.w + 20 || y < ry || y >= ry + ROWS.h) continue;
    if (R[i] === 'go') { startRace(); return true; }
    if (i !== G.raceRow) { G.raceRow = i; SFX.click(); return true; }
    change(R[i], x < ROWS.x + ROWS.w / 3 ? -1 : 1);
    return true;
  }
  return false;
}

export function drawRaceOpts() {
  const t = TRACKS[G.selTrack], def = CAR_DEFS[G.selCar];
  drawMenuBg(t);
  text('EINSTELLUNGEN', VW / 2, 8, 16, '#ffd23f', 'center');
  text(t.name + ' / ' + def.name, VW / 2, 28, 8, '#d8c4a8', 'center');
  const R = rows(), pop = Math.round(Math.max(0, 1 - (G.time - G.selAnim) * 6) * 2);
  R.forEach((r, i) => {
    const sel = i === G.raceRow, y = ROWS.y0 + i * ROWS.pitch, [a, b, col] = label(r);
    R1(ROWS.x - 1, y - 1, ROWS.w + 2, ROWS.h + 2, sel ? '#ffd23f' : '#1b120c');
    R1(ROWS.x, y, ROWS.w, ROWS.h, r === 'go' ? (sel ? '#7bd37b' : '#3f6b35') : sel ? '#5a3a1f' : '#3a2a1c');
    if (r === 'go') { text(a, VW / 2, y + 6, 8, sel ? '#1b120c' : '#fff3dc', 'center', null); return; }
    text(a, ROWS.x + 8, y + 6, 8, sel ? '#ffd23f' : '#fff3dc');
    text(b, ROWS.x + ROWS.w - 24, y + 6 - (sel ? pop : 0), 8, col, 'right');
    if (sel) { tri(ROWS.x - 10, y + ROWS.h / 2, 'left', 5, '#ffd23f'); tri(ROWS.x + ROWS.w + 10, y + ROWS.h / 2, 'right', 5, '#ffd23f'); }
  });
  const py = ROWS.y0 + R.length * ROWS.pitch + 8;
  if (G.mode === 'tt') drawGhostPreview(t, def, py); else drawField(py);
  const fx = trackFx();
  if (G.kids) text(G.mode === 'tt' ? 'KINDERMODUS: OHNE GEIST UND EFFEKTE' : 'KINDERMODUS: LEICHT, OHNE EFFEKTE', VW / 2, 234, 8, '#9fd6ff', 'center');
  else if (fx.length) text((G.selFx ? 'EFFEKT: ' : 'OHNE ') + fx.join(', '), VW / 2, 234, 8, G.selFx ? '#d8c4a8' : '#9a8a78', 'center');
  text('HOCH/RUNTER  < > AENDERN  ENTER = LOS', VW / 2, 254, 8, '#d8c4a8', 'center');
}

function drawField(y) {
  const field = singleField().slice(1), sp = Math.min(60, 420 / field.length), x0 = VW / 2 - (field.length - 1) * sp / 2;
  field.forEach((def, i) => {
    const bob = Math.round(Math.abs(Math.sin(G.time * 4 + i)) * 3);
    ctx.globalAlpha = .3; ctx.drawImage(carSet(def, false).shadow[0], Math.round(x0 + i * sp) - 22 + 3, y + 4); ctx.globalAlpha = 1;
    ctx.drawImage(carSet(def, false).frames[0][0], Math.round(x0 + i * sp) - 22, y - bob);
  });
  text(G.selCount === 1 ? '1 AUTO FAEHRT MIT' : G.selCount + ' AUTOS FAHREN MIT', VW / 2, y + 50, 8, '#fff3dc', 'center');
}

function drawGhostPreview(t, def, y) {
  const ghost = G.selGhost && !G.kids, F = carSet(def, t.th.goo).frames[0][0], rec = loadRecord(t, def);
  const gx = VW / 2 - 22 + (((G.time * 40) % 60) - 30) * (ghost ? 1 : 0), bob = Math.round(Math.abs(Math.sin(G.time * 4)) * 2);
  ctx.drawImage(F, VW / 2 - 22 - 40, y - bob);
  if (ghost) { ctx.globalAlpha = .45; ctx.drawImage(F, Math.round(gx) + 40, y - bob); ctx.globalAlpha = 1; }
  text(rec ? 'BESTZEIT ' + fmtTime(rec.t) : 'NOCH KEINE BESTZEIT', VW / 2, y + 54, 8, rec ? '#ffd23f' : '#9a8a78', 'center');
  if (!G.kids) text(!ghost ? 'KEIN GEIST AUF DER STRECKE' : rec ? 'DEINE BESTE FAHRT FAEHRT MIT' : 'DER GEIST ERSCHEINT NACH DEM 1. REKORD', VW / 2, y + 70, 8, '#d8c4a8', 'center');
}
