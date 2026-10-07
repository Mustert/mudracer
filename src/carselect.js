import { G } from './g.js';
import { CAR_DEFS, carSet, isLocked } from './cars.js';
import { SS, VW, ctx } from './core.js';
import { CUPS, cupTrackIdx, loadBestPlace } from './cups.js';
import { R1, ell, medal, star, text, tri } from './draw.js';
import { drawLock, drawMenuBg } from './screens.js';
import { MODES } from './state.js';
import { fmtTime, loadRecord } from './timetrial.js';
import { TRACKS } from './tracks.js';

// ---------- car selection: a rack with every car on top, the focused car big below ----------
// under each portrait sits a small info box: best time (time trial) or best place in the cup (Grand Prix)

const N = CAR_DEFS.length, PITCH = 46, SW = 44, X0 = Math.round((VW - (N * PITCH - (PITCH - SW))) / 2);
const PANEL = { y: 28, h: 70 }, WIN_Y = 46, WIN_H = 34, INFO_Y = 83, INFO_H = 12, CAR_Y = 79;

// which portrait (or -1) lies under a tap
export function carSlotAt(x, y) {
  if (y < PANEL.y || y > PANEL.y + PANEL.h) return -1;
  const i = Math.floor((x - X0) / PITCH);
  return i >= 0 && i < N && (x - X0) - i * PITCH < SW ? i : -1;
}

function bgTrack() {
  if (G.mode === 'gp' && G.cup) return TRACKS[cupTrackIdx(G.cup)[0]];
  if (G.mode === 'single' || G.mode === 'tt') return TRACKS[G.selTrack];
  return TRACKS[0];
}

// the info of every car depends on the mode; it is read from storage once per visit, not every frame
let cache = null, cacheT = Infinity;
function slotInfos() {
  if (!cache || G.stateTime < cacheT) {
    cache = CAR_DEFS.map(def => {
      if (isLocked(def)) return null;
      if (G.mode === 'gp' && G.cup) { const p = loadBestPlace(G.cup, def); return p ? { txt: String(p), col: medal(p), long: 'BESTER PLATZ ' + p } : { txt: '-', col: '#6b5a48', long: 'BESTER PLATZ -' }; }
      if (G.mode === 'tt') { const r = loadRecord(TRACKS[G.selTrack], def); return r ? { txt: fmtTime(r.t).slice(0, 4), col: '#ffd23f', long: 'BESTZEIT ' + fmtTime(r.t) } : { txt: '--', col: '#6b5a48', long: 'BESTZEIT -:--.--' }; }
      return null;
    });
  }
  cacheT = G.stateTime;
  return cache;
}

function smallLock(cx, cy) {
  R1(cx - 4, cy - 8, 8, 7, '#1b120c'); R1(cx - 3, cy - 7, 6, 6, '#c9ced6'); R1(cx - 2, cy - 6, 4, 5, '#1b120c');
  R1(cx - 6, cy - 3, 12, 10, '#1b120c'); R1(cx - 5, cy - 2, 10, 8, '#ffd23f'); R1(cx - 1, cy + 1, 2, 2, '#1b120c');
}

function drawRack(infos) {
  const x = X0 - 6, w = N * PITCH - (PITCH - SW) + 12;
  R1(x - 1, PANEL.y - 1, w + 2, PANEL.h + 2, '#1b120c'); R1(x, PANEL.y, w, PANEL.h, '#4a5443');
  R1(x, PANEL.y + 18, w, 1, '#3a4234'); R1(x, PANEL.y + 19, w, 1, '#5d6853');
  // checkered edge on top
  for (let cx = x; cx < x + w; cx += 3) for (let r = 0; r < 2; r++) R1(cx, PANEL.y + r * 3, Math.min(3, x + w - cx), 3, ((cx - x) / 3 + r) & 1 ? '#f2f2f2' : '#1b120c');
  CAR_DEFS.forEach((def, i) => {
    const sel = i === G.selCar, locked = isLocked(def), sx = X0 + i * PITCH, wy = sel ? WIN_Y - 2 : WIN_Y;
    if (sel) {
      R1(sx - 3, wy - 3, SW + 6, WIN_H + 6, '#ffd23f');
      R1(sx + (SW - 18) / 2, PANEL.y + 7, 18, 8, '#f07a1a'); text('1P', sx + SW / 2 + 1, PANEL.y + 7, 8, '#ffffff', 'center', null);
    }
    R1(sx - 1, wy - 1, SW + 2, WIN_H + 2, '#1b120c');
    R1(sx, wy, SW, WIN_H, locked ? '#3a4254' : '#8fd0f0'); R1(sx, wy + 24, SW, WIN_H - 24, locked ? '#2f3a2c' : '#4fae3a');
    const F = carSet(def, false);
    if (locked) { ctx.globalAlpha = .75; ctx.drawImage(F.shadow[0], 2, 7, 40, 30, sx + 2, wy + 2, 40, 30); ctx.globalAlpha = 1; smallLock(sx + SW / 2, wy + 17); }
    else ctx.drawImage(F.frames[0][0], 2, 7, 40, 30, sx + 2, wy + 2, 40, 30);
    // info box
    const info = infos[i];
    R1(sx - (sel ? 2 : 0), INFO_Y - (sel ? 1 : 0), SW + (sel ? 4 : 0), INFO_H + (sel ? 2 : 0), sel ? '#ffd23f' : '#1b120c'); R1(sx + 1, INFO_Y + 1, SW - 2, INFO_H - 2, '#2c3328');
    if (info) text(info.txt, sx + SW / 2, INFO_Y + 2, 8, info.col, 'center', null);
  });
}

export function drawSelectCar() {
  drawMenuBg(bgTrack());
  const infos = slotInfos(), def = CAR_DEFS[G.selCar], F = carSet(def, false), S3 = SS * 3, locked = isLocked(def);
  drawRack(infos);
  // what is being selected for, and the page-specific info of the focused car
  const ctxt = G.mode === 'gp' && G.cup ? 'GRAND PRIX  CUP ' + G.cup.n : G.mode === 'single' || G.mode === 'tt' ? MODES.find(m => m.id === G.mode).name + '  ' + TRACKS[G.selTrack].name : MODES.find(m => m.id === G.mode).name;
  text(ctxt, 8, 103, 8, '#d8c4a8');
  if (infos[G.selCar]) text(infos[G.selCar].long, VW - 8, 103, 8, '#ffd23f', 'right');
  // the car stands still, facing right, and gently idles
  const jump = Math.max(0, 1 - (G.time - G.selAnim) * 3.5), hop = Math.round(Math.sin(jump * Math.PI) * 14);
  const idle = locked ? 0 : ((G.time * 12) | 0) % 2;
  const x = VW / 2 - S3 / 2, y = CAR_Y - hop - idle;
  ell(VW / 2, CAR_Y + 66, 76, 12, 'rgba(0,0,0,.35)');
  if (locked) {
    ctx.globalAlpha = .9; ctx.drawImage(F.shadow[0], x, y, S3, S3); ctx.globalAlpha = 1;
    drawLock(VW / 2, CAR_Y + 58);
  } else {
    ctx.globalAlpha = .3; ctx.drawImage(F.shadow[0], x + 9, CAR_Y + 12, S3, S3); ctx.globalAlpha = 1;
    ctx.drawImage(F.frames[0][0], x, y, S3, S3);
    if (((G.time * 3) | 0) % 3 === 0) { ctx.fillStyle = 'rgba(220,220,220,.55)'; const pz = (G.time * 3 % 1) * 10; ctx.fillRect(x - pz | 0, CAR_Y + 64 - idle - pz | 0, 4, 4); }
  }
  const wig = Math.round(Math.sin(G.time * 5) * 3);
  tri(VW / 2 - 150 - wig + 1, CAR_Y + 67, 'left', 13, '#1b120c'); tri(VW / 2 - 150 - wig, CAR_Y + 66, 'left', 13, '#ffd23f');
  tri(VW / 2 + 150 + wig + 1, CAR_Y + 67, 'right', 13, '#1b120c'); tri(VW / 2 + 150 + wig, CAR_Y + 66, 'right', 13, '#ffd23f');
  text(locked ? '???' : def.name, VW / 2, 190, 16, locked ? '#9a8a78' : '#ffd23f', 'center');
  if (locked) {
    text('GESPERRT', VW / 2, 214, 8, '#ff6b6b', 'center');
    text('GEWINNE CUP ' + def.cup + ' (' + CUPS[def.cup - 1].name + ')', VW / 2, 227, 8, '#d8c4a8', 'center');
  } else {
    text('TEMPO', VW / 2 - 8, 214, 8, '#fff3dc', 'right');
    text('MATSCH', VW / 2 - 8, 227, 8, '#fff3dc', 'right');
    for (let i = 0; i < 5; i++) { star(VW / 2 + i * 10, 214, i < def.tempo); star(VW / 2 + i * 10, 227, i < def.matsch); }
  }
  text('< > AUTO WAEHLEN    ENTER = WEITER', VW / 2, 252, 8, '#d8c4a8', 'center');
}
