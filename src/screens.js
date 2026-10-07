import { G } from './g.js';
import { CAR_DEFS, carSet, isLocked } from './cars.js';
import { SS, TAU, VH, VW, WH, WW, ctx } from './core.js';
import { R1, blink, disc, drawConfetti, ell, medal, medalL, panel, star, text, tri } from './draw.js';
import { singleField, standings } from './race.js';
import { MODES } from './state.js';
import { fmtTime, loadRecord } from './timetrial.js';
import { TRACKS } from './tracks.js';
import { TRAIN } from './trainsprite.js';

export function drawMenuBg(t) {
  t = t || TRACKS[(G.state === 'options' ? G.optFrom : G.state) === 'select_track' ? G.selTrack : 0];
  ctx.drawImage(t.base, 0, 0, t.W, t.H, 0, 0, VW, VH); ctx.drawImage(t.top, 0, 0, t.W, t.H, 0, 0, VW, VH);
  ctx.fillStyle = 'rgba(27,16,9,.62)'; ctx.fillRect(0, 0, VW, VH);
}


function drawTitle(cx, y) {
  text('MUDRACER', cx + 3, y + 4, 32, '#1b120c', 'center', null);
  text('MUDRACER', cx, y + 3, 32, '#6b3d17', 'center', null);
  text('MUDRACER', cx, y, 32, '#e8a860', 'center', null);
  const x0 = cx - 128;
  for (let i = 0; i < 8; i++) {
    const len = 2 + Math.round((Math.sin(G.time * 1.7 + i * 1.9) * .5 + .5) * 8), dx = x0 + i * 32 + 8 + (i * 7) % 13;
    ctx.fillStyle = '#6b3d17'; ctx.fillRect(dx, y + 32, 3, len); ctx.fillRect(dx - 1, y + 32 + len, 5, 3);
  }
}


export function drawTrophy(cx, cy, s = 1) {
  const G = '#ffd23f', GL = '#fff08a', GD = '#c79a06', O = '#1b120c', P = (x, y, w, h, c) => R1(Math.round(cx + x * s), Math.round(cy + y * s), Math.ceil(w * s), Math.ceil(h * s), c);
  P(-10, -14, 20, 2, O); for (let r = 0; r < 12; r++) { const w = 18 - r; P(-w / 2 - 1, -12 + r, w + 2, 1, O); P(-w / 2, -12 + r, w, 1, r < 3 ? GL : G); P(w / 2 - 3, -12 + r, 3, 1, GD); }
  P(-15, -11, 5, 2, O); P(-16, -9, 2, 5, O); P(-15, -4, 5, 2, O); P(10, -11, 5, 2, O); P(14, -9, 2, 5, O); P(10, -4, 5, 2, O);
  P(-15, -10, 4, 1, G); P(-15, -9, 1, 4, G); P(11, -10, 4, 1, G); P(14, -9, 1, 4, G);
  P(-2, 0, 4, 5, O); P(-1, 0, 2, 5, G); P(-7, 5, 14, 5, O); P(-6, 6, 12, 3, GD); P(-6, 6, 12, 1, G);
  P(-6, -10, 2, 3, '#ffffff');
  if (((G.time * 3) | 0) % 3 === 0) { P(8, -16, 1, 5, '#ffffff'); P(6, -14, 5, 1, '#ffffff'); }
}


export function drawLock(cx, cy) {
  R1(cx - 7, cy - 13, 14, 12, '#1b120c'); R1(cx - 5, cy - 11, 10, 10, '#c9ced6'); R1(cx - 3, cy - 9, 6, 8, '#1b120c');
  R1(cx - 10, cy - 3, 20, 16, '#1b120c'); R1(cx - 9, cy - 2, 18, 14, '#ffd23f'); R1(cx - 9, cy - 2, 18, 2, '#fff08a'); R1(cx - 9, cy + 10, 18, 2, '#c79a06');
  R1(cx - 1, cy + 2, 3, 3, '#1b120c'); R1(cx, cy + 5, 1, 4, '#1b120c');
}


export function drawMain() {
  drawMenuBg(TRACKS[0]);
  drawTitle(VW / 2, 8);
  const cw = 108, chh = 150, gap = 6, nm = MODES.length, x0 = (VW - (nm * cw + (nm - 1) * gap)) / 2, y0 = 62;
  const pop = Math.round(Math.max(0, 1 - (G.time - G.selAnim) * 4) * 5);
  for (let i = 0; i < nm; i++) {
    const sel = i === G.selMode, lift = sel ? 3 + Math.round(Math.abs(Math.sin(G.time * 3)) * 2) + pop : 0, x = x0 + i * (cw + gap), y = y0 - lift;
    ctx.fillStyle = sel ? '#ffd23f' : '#3a2a1c'; ctx.fillRect(x - 3, y - 3, cw + 6, chh + 6);
    ctx.fillStyle = '#1b120c'; ctx.fillRect(x - 1, y - 1, cw + 2, chh + 2);
    ctx.fillStyle = '#5a3a1f'; ctx.fillRect(x, y, cw, chh);
    const t = TRACKS[[0, 2, 4, 1][i]], ih = 92;
    ctx.drawImage(t.base, 120, 60, 460, 330, x, y, cw, ih);
    const cx = x + cw / 2, cy = y + ih / 2;
    if (i === 0) { drawTrophy(cx, cy + 6, 1.6); }
    else if (i === 1) {
      R1(cx - 26, cy - 26, 3, 52, '#1b120c'); R1(cx - 25, cy - 25, 1, 50, '#d8c4a8');
      for (let r = 0; r < 5; r++) for (let q = 0; q < 8; q++) { const wv = Math.round(Math.sin(G.time * 5 + q * .7) * 2); R1(cx - 22 + q * 5, cy - 24 + r * 5 + wv, 5, 5, (r + q) & 1 ? '#222' : '#fff'); }
      ctx.drawImage(carSet(CAR_DEFS[G.selCar], false).frames[0][0], cx - 12, cy + 4);
    } else if (i === 2) {
      // stopwatch with a ghost car behind the real one
      const hand = G.time * 2.2, F0 = carSet(CAR_DEFS[G.selCar], false).frames[0][0];
      ctx.globalAlpha = .4; ctx.drawImage(F0, cx - 34 + Math.round(Math.sin(G.time * 2) * 3), cy + 18); ctx.globalAlpha = 1;
      ctx.drawImage(F0, cx - 22, cy + 18);
      R1(cx - 3, cy - 30, 6, 4, '#1b120c'); R1(cx - 2, cy - 29, 4, 2, '#ffd23f');
      disc(cx, cy - 6, 22, '#1b120c'); disc(cx, cy - 6, 20, '#fff3dc'); disc(cx, cy - 6, 17, '#ffffff');
      for (let q = 0; q < 12; q++) { const a = q / 12 * TAU; R1(Math.round(cx + Math.cos(a) * 15) - 1, Math.round(cy - 6 + Math.sin(a) * 15) - 1, q % 3 ? 1 : 2, q % 3 ? 1 : 2, '#1b120c'); }
      for (let q = 0; q < 10; q++) R1(Math.round(cx + Math.cos(hand) * q * 1.3), Math.round(cy - 6 + Math.sin(hand) * q * 1.3), 2, 2, '#d62828');
      R1(cx - 1, cy - 7, 3, 3, '#1b120c');
    } else {
      ell(cx, cy + 14, 42, 14, '#3b2512'); ell(cx, cy + 14, 39, 12, '#5a3a1f'); ell(cx - 10, cy + 12, 14, 4, '#6b4626');
      for (let q = 0; q < 10; q++) { const a = Math.PI + q / 9 * Math.PI, rr = 30 + ((G.time * 40 + q * 13) % 16); R1(Math.round(cx + Math.cos(a) * rr), Math.round(cy + 14 + Math.sin(a) * rr * .6), 3, 3, q % 2 ? '#4a2f18' : '#7d5a36'); }
      ctx.drawImage(carSet(CAR_DEFS[G.selCar], false).frames[3][0], cx - 22, cy - 12 + (((G.time * 10) | 0) % 2));
    }
    text(MODES[i].name, cx, y + ih + 14, 8, sel ? '#ffd23f' : '#fff3dc', 'center');
    text(MODES[i].sub, cx, y + ih + 32, 8, '#d8c4a8', 'center');
    if (!sel) { ctx.fillStyle = 'rgba(27,16,9,.35)'; ctx.fillRect(x, y, cw, chh); }
  }
  text('< > WAEHLEN    ENTER = LOS', VW / 2, 234, 8, '#d8c4a8', 'center');
  const open = CAR_DEFS.filter(d => !isLocked(d)).length;
  text('AUTOS ' + open + '/' + CAR_DEFS.length, VW / 2, 252, 8, open === CAR_DEFS.length ? '#ffd23f' : '#9a8a78', 'center');
}


export function drawSelectTrack() {
  drawMenuBg();
  text('STRECKE', VW / 2, 12, 16, '#ffd23f', 'center');
  if (G.mode === 'tt') { const rec = loadRecord(TRACKS[G.selTrack], CAR_DEFS[G.selCar]); text('BEST ' + (rec ? fmtTime(rec.t) : '-:--.--'), VW - 8, 34, 8, rec ? '#ffd23f' : '#9a8a78', 'right'); }
  const n = TRACKS.length, cw = 224, chh = 126, cx0 = VW / 2 - cw / 2, cy0 = 38;
  // neighbours peek in from the sides
  for (const off of [-1, 1]) {
    const t = TRACKS[(G.selTrack + off + n) % n], w = 96, h = 54, x = off < 0 ? 16 : VW - 16 - w, y = cy0 + 36;
    ctx.fillStyle = '#1b120c'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.drawImage(t.base, 0, 0, WW, WH, x, y, w, h); ctx.drawImage(t.top, 0, 0, WW, WH, x, y, w, h);
    ctx.fillStyle = 'rgba(27,16,9,.55)'; ctx.fillRect(x, y, w, h);
  }
  const t = TRACKS[G.selTrack], pop = Math.round(Math.max(0, 1 - (G.time - G.selAnim) * 4) * 6), b = Math.round(Math.abs(Math.sin(G.time * 3)) * 2) + pop;
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(cx0 - 4, cy0 - 4 - b, cw + 8, chh + 8);
  ctx.fillStyle = '#1b120c'; ctx.fillRect(cx0 - 1, cy0 - 1 - b, cw + 2, chh + 2);
  ctx.drawImage(t.base, 0, 0, WW, WH, cx0, cy0 - b, cw, chh); ctx.drawImage(t.top, 0, 0, WW, WH, cx0, cy0 - b, cw, chh);
  if (t.rail) ctx.drawImage(TRAIN.c, cx0 + Math.round(t.rail.x * cw / WW) - 5, cy0 - b + 30, 10, Math.round(TRAIN.LEN * chh / WH));
  const wig = Math.round(Math.sin(G.time * 5) * 3);
  tri(cx0 - 12 - wig + 1, cy0 + chh / 2 + 1, 'left', 10, '#1b120c'); tri(cx0 - 12 - wig, cy0 + chh / 2, 'left', 10, '#ffd23f');
  tri(cx0 + cw + 12 + wig + 1, cy0 + chh / 2 + 1, 'right', 10, '#1b120c'); tri(cx0 + cw + 12 + wig, cy0 + chh / 2, 'right', 10, '#ffd23f');
  text(t.name, VW / 2, cy0 + chh + 10, 16, '#ffd23f', 'center');
  for (let i = 0; i < n; i++) { ctx.fillStyle = i === G.selTrack ? '#ffd23f' : '#6b5a48'; ctx.fillRect(VW / 2 - n * 5 + i * 10, cy0 + chh + 32, 7, 2); }
  // the chosen car drives through mud (gets dirty) and then a puddle (gets clean again)
  const th = t.th, F = carSet(CAR_DEFS[G.selCar], th.goo);
  const cx = ((G.time * 90) % (VW + 100)) - 50, py = 224, mudX = 170, watX = 320;
  ell(mudX, py + 6, 30, 7, th.mudEdge); ell(mudX, py + 6, 28, 6, th.mud[0]); ctx.fillStyle = th.mudHi; ctx.fillRect(mudX - 10, py + 4, 4, 1); ctx.fillRect(mudX + 12, py + 8, 3, 1);
  ell(watX, py + 6, 30, 7, th.shore[0]); ell(watX, py + 6, 27, 6, th.water[1]); ell(watX + 4, py + 5, 18, 3, th.water[3]); ctx.fillStyle = '#e8f7ff'; ctx.fillRect(watX - 10, py + 4, 3, 1);
  let lv = 0;
  if (cx > mudX - 26) lv = Math.min(5, Math.round((cx - (mudX - 26)) / 52 * 5));
  if (cx > watX - 26) lv = Math.max(0, 5 - Math.round((cx - (watX - 26)) / 52 * 5));
  const inPuddle = Math.abs(cx - mudX) < 30 || Math.abs(cx - watX) < 30;
  ctx.drawImage(F.frames[lv][0], Math.round(cx) - 22, py - 22 + (inPuddle ? ((G.time * 14) | 0) % 2 : 0));
  text('< > STRECKE    ENTER = WEITER', VW / 2, 256, 8, '#d8c4a8', 'center');
}


function drawSelectGhost() {
  drawMenuBg(TRACKS[G.selTrack]);
  text('GEIST', VW / 2, 14, 16, '#ffd23f', 'center');
  const pop = Math.round(Math.max(0, 1 - (G.time - G.selAnim) * 4) * 8), wig = Math.round(Math.sin(G.time * 5) * 3);
  text(G.selGhost ? 'AN' : 'AUS', VW / 2 + 2, 52 - pop, 48, G.selGhost ? '#7bd37b' : '#ff6b6b', 'center');
  tri(VW / 2 - 80 - wig + 1, 77, 'left', 13, '#1b120c'); tri(VW / 2 - 80 - wig, 76, 'left', 13, '#ffd23f');
  tri(VW / 2 + 80 + wig + 1, 77, 'right', 13, '#1b120c'); tri(VW / 2 + 80 + wig, 76, 'right', 13, '#ffd23f');
  // the car on the grid with its see-through ghost running just ahead of it
  const t = TRACKS[G.selTrack], def = CAR_DEFS[G.selCar], F = carSet(def, t.th.goo).frames[0][0], rec = loadRecord(t, def);
  const gx = VW / 2 - 22 + (((G.time * 40) % 60) - 30) * (G.selGhost ? 1 : 0), bob = Math.round(Math.abs(Math.sin(G.time * 4)) * 2);
  ctx.drawImage(F, VW / 2 - 22 - 40, 130 - bob);
  if (G.selGhost) { ctx.globalAlpha = .45; ctx.drawImage(F, Math.round(gx) + 40, 130 - bob); ctx.globalAlpha = 1; }
  text(t.name + ' / ' + def.name, VW / 2, 190, 8, '#fff3dc', 'center');
  text(rec ? 'BESTZEIT ' + fmtTime(rec.t) : 'NOCH KEINE BESTZEIT', VW / 2, 206, 8, rec ? '#ffd23f' : '#9a8a78', 'center');
  text(!G.selGhost ? 'KEIN GEIST AUF DER STRECKE' : rec ? 'DEINE BESTE FAHRT FAEHRT MIT' : 'DER GEIST ERSCHEINT NACH DEM 1. REKORD', VW / 2, 222, 8, '#d8c4a8', 'center');
  text('< > AN / AUS    ENTER = LOS!', VW / 2, 252, 8, '#d8c4a8', 'center');
}


export function drawSelectCount() {
  if (G.mode === 'tt') return drawSelectGhost();
  drawMenuBg(TRACKS[G.selTrack]);
  text('GEGNER', VW / 2, 14, 16, '#ffd23f', 'center');
  const pop = Math.round(Math.max(0, 1 - (G.time - G.selAnim) * 4) * 8), wig = Math.round(Math.sin(G.time * 5) * 3);
  text(String(G.selCount), VW / 2 + 2, 52 - pop, 48, '#ffd23f', 'center');
  tri(VW / 2 - 70 - wig + 1, 77, 'left', 13, '#1b120c'); tri(VW / 2 - 70 - wig, 76, 'left', 13, '#ffd23f');
  tri(VW / 2 + 70 + wig + 1, 77, 'right', 13, '#1b120c'); tri(VW / 2 + 70 + wig, 76, 'right', 13, '#ffd23f');
  const field = singleField().slice(1), sp = 60, x0 = VW / 2 - (field.length - 1) * sp / 2;
  field.forEach((def, i) => {
    const bob = Math.round(Math.abs(Math.sin(G.time * 4 + i)) * 3);
    ctx.globalAlpha = .3; ctx.drawImage(carSet(def, false).shadow[0], x0 + i * sp - 22 + 3, 150 + 4); ctx.globalAlpha = 1;
    ctx.drawImage(carSet(def, false).frames[0][0], x0 + i * sp - 22, 150 - bob);
  });
  text(G.selCount === 1 ? '1 AUTO FAEHRT MIT' : G.selCount + ' AUTOS FAHREN MIT', VW / 2, 214, 8, '#fff3dc', 'center');
  text('< > WENIGER / MEHR    ENTER = LOS!', VW / 2, 252, 8, '#d8c4a8', 'center');
}


export function drawStandings() {
  drawMenuBg(G.T);
  text('GESAMTWERTUNG', VW / 2, 8, 16, '#ffd23f', 'center');
  text('CUP ' + G.gp.cup.n + '  RENNEN ' + (G.gp.race + 1) + '/' + G.gp.tracks.length + '  ' + G.T.name, VW / 2, 30, 8, '#d8c4a8', 'center');
  standings().forEach((e, i) => {
    const y = 46 + i * 26, slide = Math.max(0, (i * .08 + .1 - G.stateTime) * 6) * VW;
    const x = 56 + slide;
    if (e.me) { ctx.fillStyle = 'rgba(255,210,63,.22)'; ctx.fillRect(x - 12, y - 3, 380, 24); ctx.strokeStyle = '#ffd23f'; ctx.strokeRect(x - 11.5, y - 2.5, 379, 23); }
    disc(Math.round(x), y + 9, 8, '#1b120c'); disc(Math.round(x), y + 9, 7, medal(i + 1));
    text(String(i + 1), x + 1, y + 6, 8, '#1b120c', 'center', null);
    ctx.drawImage(carSet(e.def, false).frames[0][0], x + 12, y - 5, 30, 30);
    text(e.me ? e.def.name + ' (DU)' : e.def.name, x + 50, y + 6, 8, e.me ? '#ffd23f' : '#fff3dc');
    if (e.last) text('+' + e.last, x + 280, y + 6, 8, '#7bd37b', 'right');
    text(e.pts + ' P', x + 360, y + 6, 8, '#ffffff', 'right');
  });
  if (G.stateTime > 1 && blink()) text(G.gp.race < G.gp.tracks.length - 1 ? 'TASTE = NAECHSTES RENNEN' : 'TASTE = SIEGEREHRUNG', VW / 2, 256, 8, '#d8c4a8', 'center');
}


export function drawCeremony() {
  drawMenuBg(TRACKS[0]);
  ctx.fillStyle = 'rgba(20,10,40,.45)'; ctx.fillRect(0, 0, VW, VH);
  // two sweeping spotlights
  ctx.save(); ctx.globalAlpha = .1; ctx.fillStyle = '#fff3b0';
  for (const s of [-1, 1]) { const sx = VW / 2 + s * 200, tx = VW / 2 + Math.sin(G.time * .9 + s) * 90; ctx.beginPath(); ctx.moveTo(sx - 8, 0); ctx.lineTo(sx + 8, 0); ctx.lineTo(tx + 60, VH); ctx.lineTo(tx - 60, VH); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  text('SIEGEREHRUNG', VW / 2, 8, 16, '#ffd23f', 'center');
  drawTrophy(VW / 2, 52, 1.4);
  text(G.ceremony.won ? 'DU HAST GEWONNEN!' : 'SUPER GEFAHREN!', VW / 2, 84 + Math.round(Math.sin(G.time * 5) * 2), 8, '#ffffff', 'center');
  const blocks = [{ pl: 2, x: VW / 2 - 124, h: 44 }, { pl: 1, x: VW / 2 - 40, h: 64 }, { pl: 3, x: VW / 2 + 44, h: 30 }], bw = 80, base = 252;
  for (const b of blocks) {
    const e = G.ceremony.sorted[b.pl - 1], top = base - b.h;
    R1(b.x - 1, top - 1, bw + 2, b.h + 2, '#1b120c'); R1(b.x, top, bw, b.h, medal(b.pl)); R1(b.x, top, bw, 3, medalL(b.pl)); R1(b.x, base - 4, bw, 4, 'rgba(0,0,0,.25)');
    text(String(b.pl), b.x + bw / 2 + 1, top + 8, 16, '#1b120c', 'center', null);
    text(e.def.name.slice(0, 9), b.x + bw / 2, top + 28, 8, '#1b120c', 'center', null);
    const hop = b.pl === 1 ? Math.round(Math.abs(Math.sin(G.time * 4)) * 6) : 0;
    ctx.drawImage(carSet(e.def, false).frames[0][0], b.x + bw / 2 - 33, top - 48 - hop, 66, 66);
    if (e.me && blink(4)) { text('DU', b.x + bw / 2, top - 62 - hop, 8, '#ffd23f', 'center'); }
  }
  drawConfetti();
  if (G.stateTime > 5 && (G.ceremony.newCar || G.ceremony.won)) {
    const w = 260, h = 170, x = VW / 2 - w / 2, y = 50;
    panel(x, y, w, h);
    if (G.ceremony.newCar) {
      text('NEUES AUTO!', VW / 2, y + 12 + Math.round(Math.sin(G.time * 6) * 2), 16, '#ffd23f', 'center');
      ctx.drawImage(carSet(G.ceremony.newCar, false).frames[0][0], VW / 2 - 66, y + 26, 132, 132);
      text(G.ceremony.newCar.name, VW / 2, y + 146, 8, '#ffffff', 'center');
    } else {
      text('CUP', VW / 2, y + 50, 16, '#ffd23f', 'center');
      text('GEWONNEN!', VW / 2, y + 76, 16, '#ffd23f', 'center');
    }
  }
  if (G.stateTime > 3 && blink()) text('TASTE = MENUE', VW / 2, 258, 8, '#d8c4a8', 'center');
}
