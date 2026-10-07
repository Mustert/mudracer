import { G } from './g.js';
import { AU } from './audio.js';
import { VH, VW, ctx } from './core.js';
import { R1, drawRace, panel, text } from './draw.js';
import { OPT, PAU } from './menus.js';
import { drawSelectCar } from './carselect.js';
import { drawSelectCup } from './cupselect.js';
import { drawCeremony, drawMain, drawSelectCount, drawSelectTrack, drawStandings } from './screens.js';
import { drawTitleScreen } from './title.js';

// ---------- gear (options) and menu button ----------

export function drawGear(active) {
  const x = VW - 31, y = 2;
  R1(x, y, 26, 26, '#1b120c'); R1(x + 1, y + 1, 24, 24, active ? '#e8a860' : '#5a3a1f');
  for (let j = 0; j < 11; j++) for (let i = 0; i < 11; i++) {
    const dx = i - 5, dy = j - 5, rr = Math.hypot(dx, dy), an = Math.atan2(dy, dx);
    const on = (rr <= 3.9 || (rr <= 5.3 && Math.cos(8 * an) > .15)) && rr > 1.6;
    if (on) R1(x + 2 + i * 2, y + 2 + j * 2, 2, 2, active ? '#1b120c' : (i + j < 8 ? '#fff08a' : '#ffd23f'));
  }
}


export function drawMenuBtn() {
  R1(3, 1, 22, 14, '#1b120c'); R1(4, 2, 20, 12, '#5a3a1f');
  for (let i = 0; i < 3; i++) R1(8, 4 + i * 3, 12, 2, '#ffd23f');
}


function drawChoiceRow(x, y, w, h, sel, label, value) {
  R1(x, y, w, h, sel ? '#e8a860' : '#3a2a1c');
  text(label, x + 6, y + (h - 8) / 2, 8, sel ? '#1b120c' : '#fff3dc', 'left', null);
  if (value) text(value, x + w - 6, y + (h - 8) / 2, 8, sel ? '#1b120c' : '#ffd23f', 'right', null);
}


export function drawOptions() {
  ctx.fillStyle = 'rgba(27,18,12,.5)'; ctx.fillRect(0, 0, VW, VH);
  const h = 112; panel(OPT.x, OPT.y, OPT.w, h);
  text('OPTIONEN', OPT.x + OPT.w / 2, OPT.y + 9, 8, '#ffd23f', 'center');
  const rows = [['MUSIK', AU.music ? 'AN' : 'AUS'], ['STEUERUNG', G.CTRL === 'std' ? 'STANDARD' : 'ALTERNATIV'], ['ZURUECK', '']];
  rows.forEach(([a, b], i) => drawChoiceRow(OPT.x + 6, OPT.y + OPT.r0 + i * OPT.row, OPT.w - 12, OPT.row - 2, G.optSel === i, a, b));
  const hint = G.CTRL === 'std' ? ['HOCH=GAS RUNTER=BREMSE', 'LINKS/RECHTS = LENKEN'] : ['PFEIL = RICHTUNG AUF', 'DEM BILDSCHIRM'];
  hint.forEach((s, i) => text(s, OPT.x + OPT.w / 2, OPT.y + OPT.r0 + 3 * OPT.row + 2 + i * 11, 8, '#d8c4a8', 'center'));
  drawGear(true);
}


export function drawPause() {
  ctx.fillStyle = 'rgba(27,18,12,.6)'; ctx.fillRect(0, 0, VW, VH);
  panel(PAU.x, PAU.y, PAU.w, PAU.h);
  text('PAUSE', VW / 2, PAU.y + 14, 16, '#ffd23f', 'center');
  ['WEITER', 'RENNEN BEENDEN'].forEach((s, i) => {
    const y = PAU.y + PAU.r0 + i * PAU.row, sel = G.pauseSel === i;
    R1(PAU.x + 14, y, PAU.w - 28, PAU.rh, sel ? '#e8a860' : '#3a2a1c');
    text(s, VW / 2, y + 7, 8, sel ? '#1b120c' : '#fff3dc', 'center', null);
  });
  text('ESC = WEITER', VW / 2, PAU.y + PAU.h - 18, 8, '#d8c4a8', 'center');
}


export function drawState(s) {
  if (s === 'title') drawTitleScreen();
  else if (s === 'main') drawMain();
  else if (s === 'select_cup') drawSelectCup();
  else if (s === 'select_car') drawSelectCar();
  else if (s === 'select_track') drawSelectTrack();
  else if (s === 'select_count') drawSelectCount();
  else if (s === 'standings') drawStandings();
  else if (s === 'ceremony') drawCeremony();
  else drawRace();
}
