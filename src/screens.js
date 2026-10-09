import { G } from './g.js';
import { CAR_DEFS, carSet, isLocked } from './cars.js';
import { SS, TAU, VH, VW, WH, WW, ctx, hash } from './core.js';
import { cupLabel } from './cups.js';
import { DIFFS } from './diff.js';
import { R1, blink, disc, drawConfetti, drawTag, ell, medal, medalL, panel, star, text, tri } from './draw.js';
import { SFX } from './audio.js';
import { standings } from './race.js';
import { MODES } from './state.js';
import { fmtTime, loadRecord } from './timetrial.js';
import { TRACKS } from './tracks.js';
import { drawMenuLogo } from './title.js';
import { TRAIN } from './trainsprite.js';
import { drawPokal, drawRibbon } from './trophy.js';

export function drawMenuBg(t) {
  t = t || TRACKS[(G.state === 'options' ? G.optFrom : G.state) === 'select_track' ? G.selTrack : 0];
  ctx.drawImage(t.base, 0, 0, t.W, t.H, 0, 0, VW, VH); ctx.drawImage(t.top, 0, 0, t.W, t.H, 0, 0, VW, VH);
  ctx.fillStyle = 'rgba(27,16,9,.62)'; ctx.fillRect(0, 0, VW, VH);
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


// the cards of the main menu: the focused one is wider, the others make room
const CARD = { sel: 120, w: 82, gap: 4, y0: 62, h: 150 };
export function mainCardAt(px, py) {
  let x = (VW - (CARD.sel + (MODES.length - 1) * CARD.w + (MODES.length - 1) * CARD.gap)) / 2;
  for (let i = 0; i < MODES.length; i++) { const w = i === G.selMode ? CARD.sel : CARD.w; if (px >= x && px < x + w && py >= CARD.y0 - 8 && py < CARD.y0 + CARD.h) return i; x += w + CARD.gap; }
  return -1;
}

// kids mode switch, top left of the main menu
export const KIDS_BTN = { x: 4, y: 4, w: 84, h: 16 };
function drawKidsBtn() {
  const b = KIDS_BTN, on = G.kids, focus = G.mainRow === 1;
  R1(b.x - 2, b.y - 2, b.w + 4, b.h + 4, focus ? '#ffd23f' : '#1b120c'); R1(b.x, b.y, b.w, b.h, on ? '#3f6b35' : '#3a2a1c');
  const sx = b.x + 4, sy = b.y + 4;
  R1(sx, sy, 18, 8, '#1b120c'); R1(sx + 1, sy + 1, 16, 6, on ? '#7bd37b' : '#6b5a48');
  R1(on ? sx + 10 : sx + 1, sy - 1, 7, 10, '#1b120c'); R1(on ? sx + 11 : sx + 2, sy, 5, 8, '#fff3dc');
  text(on ? 'KINDER' : 'NORMAL', b.x + 26, b.y + 4, 8, on ? '#ffffff' : '#d8c4a8', 'left', null);
}

export function drawMain() {
  drawMenuBg(TRACKS[0]);
  drawMenuLogo(12);
  drawKidsBtn();
  const chh = CARD.h, nm = MODES.length, y0 = CARD.y0;
  let x = (VW - (CARD.sel + (nm - 1) * CARD.w + (nm - 1) * CARD.gap)) / 2;
  const pop = Math.round(Math.max(0, 1 - (G.time - G.selAnim) * 4) * 5);
  for (let i = 0; i < nm; i++, x += (i - 1 === G.selMode ? CARD.sel : CARD.w) + CARD.gap) {
    const sel = i === G.selMode, cw = sel ? CARD.sel : CARD.w, lift = sel ? 3 + Math.round(Math.abs(Math.sin(G.time * 3)) * 2) + pop : 0, y = y0 - lift;
    ctx.fillStyle = sel ? '#ffd23f' : '#3a2a1c'; ctx.fillRect(x - 3, y - 3, cw + 6, chh + 6);
    ctx.fillStyle = '#1b120c'; ctx.fillRect(x - 1, y - 1, cw + 2, chh + 2);
    ctx.fillStyle = '#5a3a1f'; ctx.fillRect(x, y, cw, chh);
    const t = TRACKS[[0, 2, 3, 1, 4][i]] || TRACKS[0], ih = 92, sw = Math.round(cw * 4.26);
    ctx.drawImage(t.base, 350 - sw / 2, 60, sw, 330, x, y, cw, ih);
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
    } else if (i === 4) {
      // the workshop: a car being sprayed in a changing colour, with a spanner beside it
      const F0 = carSet(CAR_DEFS[G.selCar], false).frames[0][0], pc = ['#e03131', '#ffd23f', '#2f6fd8', '#3aa845', '#ff5fa2'][((G.time * 1.5) | 0) % 5];
      ctx.drawImage(F0, cx - 30, cy - 8, 44, 44);
      R1(cx + 14, cy - 18, 10, 14, '#1b120c'); R1(cx + 15, cy - 17, 8, 12, '#c9ced6'); R1(cx + 15, cy - 14, 8, 5, pc); R1(cx + 17, cy - 21, 4, 3, '#1b120c');
      for (let q = 0; q < 8; q++) R1(Math.round(cx + 12 - q * 3 - hash(q, (G.time * 8) | 0, 3) * 4), Math.round(cy - 10 + (hash(q, (G.time * 8) | 0, 4) - .5) * 10), 2, 2, pc);
      R1(cx - 34, cy - 30, 4, 22, '#9aa3ad'); R1(cx - 37, cy - 34, 10, 6, '#9aa3ad'); R1(cx - 34, cy - 34, 4, 3, '#5a3a1f');
    } else {
      ell(cx, cy + 14, 42, 14, '#3b2512'); ell(cx, cy + 14, 39, 12, '#5a3a1f'); ell(cx - 10, cy + 12, 14, 4, '#6b4626');
      for (let q = 0; q < 10; q++) { const a = Math.PI + q / 9 * Math.PI, rr = 30 + ((G.time * 40 + q * 13) % 16); R1(Math.round(cx + Math.cos(a) * rr), Math.round(cy + 14 + Math.sin(a) * rr * .6), 3, 3, q % 2 ? '#4a2f18' : '#7d5a36'); }
      ctx.drawImage(carSet(CAR_DEFS[G.selCar], false).frames[3][0], cx - 22, cy - 12 + (((G.time * 10) | 0) % 2));
    }
    text(MODES[i].name.length * 8 > cw - 2 ? MODES[i].short : MODES[i].name, cx, y + ih + 14, 8, sel ? '#ffd23f' : '#fff3dc', 'center');
    text(MODES[i].sub, cx, y + ih + 32, 8, '#d8c4a8', 'center');
    if (!sel) { ctx.fillStyle = 'rgba(27,16,9,.35)'; ctx.fillRect(x, y, cw, chh); }
  }
  text(G.mainRow === 1 ? 'ENTER = MODUS WECHSELN   RUNTER = ZURUECK' : '< > WAEHLEN   HOCH = KINDERMODUS   ENTER = LOS', VW / 2, 234, 8, '#d8c4a8', 'center');
  if (G.kids) text('KINDERMODUS: ALLES FREI, LEICHT, OHNE EFFEKTE', VW / 2, 252, 8, '#9fd6ff', 'center');
  else { const open = CAR_DEFS.filter(d => !isLocked(d)).length; text('AUTOS ' + open + '/' + CAR_DEFS.length, VW / 2, 252, 8, open === CAR_DEFS.length ? '#ffd23f' : '#9a8a78', 'center'); }
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


export function drawStandings() {
  drawMenuBg(G.T);
  text('GESAMTWERTUNG', VW / 2, 8, 16, '#ffd23f', 'center');
  text(cupLabel(G.gp.cup) + '  RENNEN ' + (G.gp.race + 1) + '/' + G.gp.tracks.length + '  ' + G.T.name, VW / 2, 30, 8, '#d8c4a8', 'center');
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
  const cer = G.ceremony, custom = G.gp.cup.custom, pl = cer.place;
  text('SIEGEREHRUNG', VW / 2, 8, 16, '#ffd23f', 'center');
  // your cup (gold, silver, bronze) or your ribbon, and what you reached
  if (!custom) drawPokal(VW / 2, 82, cer.diff, 2, pl); else if (cer.won) drawTrophy(VW / 2, 52, 1.4);
  const msg = cer.won ? 'DU HAST GEWONNEN!' : pl === 2 ? 'PLATZ 2 - SILBER!' : pl === 3 ? 'PLATZ 3 - BRONZE!' : 'PLATZ ' + pl + ' - SUPER GEFAHREN!';
  text(msg, VW / 2, 86 + Math.round(Math.sin(G.time * 5) * 2), 8, '#ffffff', 'center');
  const blocks = [{ pl: 2, x: VW / 2 - 124, h: 48 }, { pl: 1, x: VW / 2 - 40, h: 64 }, { pl: 3, x: VW / 2 + 44, h: 40 }], bw = 80, base = 252;
  // not on the podium: you still stand next to it, on a low step of your own, with your ribbon
  if (pl > 3) blocks.push({ pl, x: VW / 2 + 134, h: 14, w: 64, me: true });
  // a spotlight on your car
  const mine = blocks.find(b => b.me || (cer.sorted[b.pl - 1] && cer.sorted[b.pl - 1].me));
  if (mine) {
    const cx = mine.x + (mine.w || bw) / 2, top = base - mine.h;
    ctx.save(); ctx.globalAlpha = .16 + .05 * Math.sin(G.time * 4); ctx.fillStyle = '#fff3b0';
    ctx.beginPath(); ctx.moveTo(cx - 6, 0); ctx.lineTo(cx + 6, 0); ctx.lineTo(cx + 44, top + 4); ctx.lineTo(cx - 44, top + 4); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  for (const b of blocks) {
    const e = b.me ? cer.sorted.find(q => q.me) : cer.sorted[b.pl - 1], top = base - b.h, w = b.w || bw;
    if (!e) continue;
    const col = b.me ? '#8d939d' : medal(b.pl), colL = b.me ? '#c9ccd2' : medalL(b.pl);
    R1(b.x - 1, top - 1, w + 2, b.h + 2, '#1b120c'); R1(b.x, top, w, b.h, col); R1(b.x, top, w, 3, colL); R1(b.x, base - 4, w, 4, 'rgba(0,0,0,.25)');
    if (b.me) { drawRibbon(b.x + w + 13, base, b.pl, 2); text(e.def.name.slice(0, 8), b.x + w / 2 + 1, top + 4, 8, '#1b120c', 'center', null); }
    else {
      text(String(b.pl), b.x + w / 2 + 1, top + 8, 16, '#1b120c', 'center', null);
      text(e.def.name.slice(0, 9), b.x + w / 2, top + 28, 8, e.me ? '#7a1c16' : '#1b120c', 'center', null);
    }
    const hop = b.pl === 1 ? Math.round(Math.abs(Math.sin(G.time * 4)) * 6) : 0;
    ctx.drawImage(carSet(e.def, false).frames[0][0], b.x + w / 2 - 33, top - 48 - hop, 66, 66);
    // your car: the 1P sign from the race floats over it
    if (e.me) drawTag(b.x + w / 2, top - 44 - hop - Math.round(Math.abs(Math.sin(G.time * 5)) * 3));
  }
  drawConfetti();
  // after a while a panel: first the new car (if any), then the new cup or ribbon (a better place than ever), otherwise just "cup won"
  const t = G.stateTime, carT = cer.newCar ? 5 : -1, trT = cer.trophy >= 0 && !custom ? (cer.newCar ? 10.5 : 5) : -1;
  if (t > 5 && (cer.newCar || cer.won || trT > 0)) {
    const w = 260, h = 170, x = VW / 2 - w / 2, y = 50;
    panel(x, y, w, h);
    if (trT > 0 && t > trT) {
      text(pl <= 3 ? 'NEUER POKAL!' : 'NEUE SCHLEIFE!', VW / 2, y + 12 + Math.round(Math.sin(G.time * 6) * 2), 16, '#ffd23f', 'center');
      drawPokal(VW / 2, y + 132, cer.trophy, 3, pl);
      text(cupLabel(G.gp.cup) + '  ' + DIFFS[cer.trophy].name + '  PLATZ ' + pl, VW / 2, y + 146, 8, DIFFS[cer.trophy].col, 'center');
    } else if (carT > 0) drawUnlock(t - carT, cer, x, y, w, h);
    else if (cer.won) {
      text('CUP', VW / 2, y + 50, 16, '#ffd23f', 'center');
      text('GEWONNEN!', VW / 2, y + 76, 16, '#ffd23f', 'center');
    }
  }
  if (t > 3 && blink()) text('TASTE = MENUE', VW / 2, 258, 8, '#d8c4a8', 'center');
}

// a new car is revealed: first only its dark shape behind a shaking lock, then the lock breaks off with a flash,
// the car pops out in its colours, light rays turn behind it and stars sparkle around it
function drawUnlock(u, cer, x, y, w, h) {
  const def = cer.newCar, F = carSet(def, false), cx = VW / 2, cy = y + 92, R = .9 + .35;
  ctx.save(); ctx.beginPath(); ctx.rect(x + 3, y + 3, w - 6, h - 6); ctx.clip();
  if (u >= R) {
    if (!cer.unlocked) { cer.unlocked = true; SFX.unlock(); }
    ctx.globalAlpha = Math.min(.22, (u - R) * .5); ctx.fillStyle = '#fff3b0';
    for (let k = 0; k < 12; k++) { const a = G.time * .7 + k * TAU / 12; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a - .12) * 200, cy + Math.sin(a - .12) * 200); ctx.lineTo(cx + Math.cos(a + .12) * 200, cy + Math.sin(a + .12) * 200); ctx.closePath(); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  const pop = u >= R ? 1 + .4 * Math.max(0, 1 - (u - R) / .35) : 1, bob = u >= R + .6 ? Math.round(Math.abs(Math.sin(G.time * 4)) * 4) : 0, S = Math.round(132 * pop);
  if (u < R) {
    // the dark shape, the lock shakes harder and harder
    ctx.globalAlpha = .9; ctx.drawImage(F.shadow[0], cx - S / 2, cy - S / 2, S, S); ctx.globalAlpha = 1;
    const sh = u * 3.5;
    ctx.save(); ctx.translate(Math.round(cx + (Math.random() - .5) * sh), Math.round(cy + 6 + (Math.random() - .5) * sh)); ctx.scale(2, 2); drawLock(0, 0); ctx.restore();
    text('???', cx, y + 146, 8, '#9a8a78', 'center');
  } else {
    ctx.drawImage(F.frames[0][0], cx - S / 2, cy - S / 2 - bob, S, S);
    const fade = 1 - (u - R) / .5; if (fade > 0) { ctx.globalAlpha = fade; ctx.drawImage(F.shadow[0], cx - S / 2, cy - S / 2 - bob, S, S); ctx.globalAlpha = 1; }
    // the lock flies off, turning
    const lu = u - R; if (lu < 1) { ctx.save(); ctx.translate(cx + lu * 120, cy + 6 - lu * 90 + lu * lu * 140); ctx.rotate(lu * 7); ctx.scale(2, 2); drawLock(0, 0); ctx.restore(); }
    for (let k = 0; k < 8; k++) { const a = G.time * 1.3 + k * TAU / 8, rr = 64 + Math.sin(G.time * 3 + k) * 6; if (((G.time * 6 + k) | 0) % 3) star(Math.round(cx + Math.cos(a) * rr * 1.4) - 3, Math.round(cy + Math.sin(a) * rr * .7) - 3, true, k % 2 ? '#ffffff' : '#ffd23f'); }
    text(def.name, cx, y + 146, 8, '#ffffff', 'center');
    // the flash
    const fl = 1 - (u - R) / .3; if (fl > 0) { ctx.globalAlpha = fl; R1(x, y, w, h, '#ffffff'); ctx.globalAlpha = 1; }
  }
  ctx.restore();
  text(u < R ? 'NEUES AUTO...' : 'NEUES AUTO!', cx, y + 12 + Math.round(Math.sin(G.time * 6) * 2), 16, '#ffd23f', 'center');
}
