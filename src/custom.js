import { G } from './g.js';
import { SFX } from './audio.js';
import { VW, WH, WW, clamp, ctx } from './core.js';
import { CUPS, CUSTOM_MAX, saveCustom } from './cups.js';
import { DIFFS, setDiff, setFx } from './diff.js';
import { R1, text, tri } from './draw.js';
import { is } from './input.js';
import { setState } from './menus.js';
import { drawMenuBg } from './screens.js';
import { TRACKS } from './tracks.js';

// ---------- custom cup: put together your own Grand Prix ----------
// left the settings (add a track, remove the last one, opponents, difficulty), right the track being picked,
// below every chosen track in racing order (a tap on one takes it out again)

const ROWS = { x: 16, w: 220, y0: 36, h: 18, pitch: 22 };
const PREV = { x: 252, y: 36, w: 212, h: 119 };
const LIST = { y: 184, w: 52, h: 29, gap: 4, per: 6 };
const listX0 = () => Math.round(VW / 2 - (LIST.per * (LIST.w + LIST.gap) - LIST.gap) / 2);

G.cuRow = 0;
G.cuPick = 0;

const rows = () => G.kids ? ['track', 'remove', 'count', 'go'] : ['track', 'remove', 'count', 'diff', 'go'];

export function openCustom() { G.cuRow = 0; G.cup = CUPS.find(c => c.custom); setState('custom'); }

function add() {
  if (G.custom.tracks.length >= CUSTOM_MAX) { SFX.bump(); return; }
  G.custom.tracks.push(G.cuPick); saveCustom(); G.selAnim = G.time; SFX.select();
}

function removeAt(i) {
  if (!G.custom.tracks.length) { SFX.bump(); return; }
  G.custom.tracks.splice(i, 1); saveCustom(); SFX.click();
}

function go() {
  if (!G.custom.tracks.length) { SFX.bump(); G.cuRow = 0; return; }
  SFX.select(); setState('select_car');
}

function change(r, dir) {
  if (r === 'track') { G.cuPick = (G.cuPick + dir + TRACKS.length) % TRACKS.length; G.selAnim = G.time; }
  else if (r === 'count') { G.custom.count = clamp(G.custom.count + dir, 2, 7); saveCustom(); }
  else if (r === 'diff') { setDiff(G.diff + dir); setFx(G.diff > 0); }
  else return;
  SFX.click();
}

function act(r) {
  if (r === 'track') add();
  else if (r === 'remove') removeAt(G.custom.tracks.length - 1);
  else if (r === 'go') go();
  else change(r, 1);
}

export function customKey(k) {
  const R = rows(), r = R[G.cuRow] || 'go';
  if (is(k, 'up')) { G.cuRow = (G.cuRow + R.length - 1) % R.length; SFX.click(); }
  else if (is(k, 'down')) { G.cuRow = (G.cuRow + 1) % R.length; SFX.click(); }
  else if (is(k, 'left') || is(k, 'right')) change(r, is(k, 'left') ? -1 : 1);
  else if (is(k, 'ok')) act(r);
  else if (is(k, 'back')) { SFX.click(); setState('select_cup'); }
}

export function customClick(x, y) {
  const R = rows();
  for (let i = 0; i < R.length; i++) {
    const ry = ROWS.y0 + i * ROWS.pitch;
    if (x < ROWS.x || x > ROWS.x + ROWS.w || y < ry || y >= ry + ROWS.h) continue;
    if (i !== G.cuRow && R[i] !== 'remove' && R[i] !== 'go') { G.cuRow = i; SFX.click(); return; }
    G.cuRow = i;
    if (R[i] === 'track' || R[i] === 'count' || R[i] === 'diff') { if (x < ROWS.x + ROWS.w * .55) change(R[i], -1); else change(R[i], 1); }
    else act(R[i]);
    return;
  }
  // the picture of the track being picked: a tap adds it; left and right of it page through the tracks
  if (y >= PREV.y && y < PREV.y + PREV.h + 16) {
    if (x >= PREV.x + 30 && x < PREV.x + PREV.w - 30) { G.cuRow = 0; add(); }
    else if (x >= PREV.x - 12 && x < PREV.x + 30) change('track', -1);
    else if (x >= PREV.x + PREV.w - 30) change('track', 1);
    return;
  }
  const x0 = listX0();
  G.custom.tracks.forEach((ti, j) => {
    const tx = x0 + (j % LIST.per) * (LIST.w + LIST.gap), ty = LIST.y + Math.floor(j / LIST.per) * (LIST.h + LIST.gap);
    if (x >= tx && x < tx + LIST.w && y >= ty && y < ty + LIST.h) removeAt(j);
  });
}

function label(r) {
  if (r === 'track') return ['STRECKE +', TRACKS[G.cuPick].name, '#fff3dc'];
  if (r === 'remove') return ['LETZTE WEG', '', ''];
  if (r === 'count') return ['GEGNER', String(G.custom.count), '#ffd23f'];
  if (r === 'diff') return ['STUFE', DIFFS[G.diff].name, DIFFS[G.diff].col];
  return ['WEITER', '', ''];
}

export function drawCustom() {
  drawMenuBg(TRACKS[G.cuPick]);
  text('CUSTOM CUP', VW / 2, 8, 16, '#ffd23f', 'center');
  const R = rows(), n = G.custom.tracks.length;
  R.forEach((r, i) => {
    const sel = i === G.cuRow, y = ROWS.y0 + i * ROWS.pitch, [a, b, col] = label(r), go = r === 'go', off = (go && !n) || (r === 'remove' && !n);
    R1(ROWS.x - 1, y - 1, ROWS.w + 2, ROWS.h + 2, sel ? '#ffd23f' : '#1b120c');
    R1(ROWS.x, y, ROWS.w, ROWS.h, go ? (sel ? '#7bd37b' : '#3f6b35') : sel ? '#5a3a1f' : '#3a2a1c');
    if (go) { text(a, ROWS.x + ROWS.w / 2, y + 5, 8, off ? '#6b8a60' : sel ? '#1b120c' : '#fff3dc', 'center', null); return; }
    text(a, ROWS.x + 6, y + 5, 8, off ? '#6b5a48' : sel ? '#ffd23f' : '#fff3dc');
    if (b) text(b, ROWS.x + ROWS.w - 8, y + 5, 8, col, 'right');
  });
  // the track being picked, big, with arrows
  const pop = Math.round(Math.max(0, 1 - (G.time - G.selAnim) * 5) * 3), t = TRACKS[G.cuPick], wig = Math.round(Math.sin(G.time * 5) * 2);
  R1(PREV.x - 3, PREV.y - 3 - pop, PREV.w + 6, PREV.h + 6, G.cuRow === 0 ? '#ffd23f' : '#3a2a1c'); R1(PREV.x - 1, PREV.y - 1 - pop, PREV.w + 2, PREV.h + 2, '#1b120c');
  ctx.drawImage(t.base, 0, 0, WW, WH, PREV.x, PREV.y - pop, PREV.w, PREV.h); ctx.drawImage(t.top, 0, 0, WW, WH, PREV.x, PREV.y - pop, PREV.w, PREV.h);
  tri(PREV.x - 9 - wig, PREV.y + PREV.h / 2, 'left', 7, '#ffd23f'); tri(PREV.x + PREV.w + 9 + wig, PREV.y + PREV.h / 2, 'right', 7, '#ffd23f');
  text(t.name, PREV.x + PREV.w / 2, PREV.y + PREV.h + 6, 8, '#ffd23f', 'center');
  // the chosen tracks in racing order
  text('DEIN CUP: ' + n + (n === 1 ? ' STRECKE' : ' STRECKEN') + '  (MAX ' + CUSTOM_MAX + ')', VW / 2, LIST.y - 13, 8, n ? '#fff3dc' : '#9a8a78', 'center');
  const x0 = listX0();
  for (let j = 0; j < CUSTOM_MAX; j++) {
    const tx = x0 + (j % LIST.per) * (LIST.w + LIST.gap), ty = LIST.y + Math.floor(j / LIST.per) * (LIST.h + LIST.gap);
    R1(tx - 1, ty - 1, LIST.w + 2, LIST.h + 2, '#1b120c');
    if (j >= n) { R1(tx, ty, LIST.w, LIST.h, '#2a1d12'); continue; }
    const tt = TRACKS[G.custom.tracks[j]];
    ctx.drawImage(tt.base, 0, 0, WW, WH, tx, ty, LIST.w, LIST.h); ctx.drawImage(tt.top, 0, 0, WW, WH, tx, ty, LIST.w, LIST.h);
    R1(tx, ty, j >= 9 ? 19 : 11, 10, '#1b120c'); text(String(j + 1), tx + 1, ty + 1, 8, '#ffd23f', 'left', null);
  }
  text('ENTER = HINZUFUEGEN   ESC = ZURUECK', VW / 2, 256, 8, '#d8c4a8', 'center');
}
