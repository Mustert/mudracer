import { G } from './g.js';
import { SFX } from './audio.js';
import { CAR_DEFS, PAINTS, carSet, isLocked, savePaint } from './cars.js';
import { SS, VW, clamp, ctx, hash } from './core.js';
import { carSlotAt, drawRack } from './carselect.js';
import { R1, ell, star, text, tri } from './draw.js';
import { is } from './input.js';
import { pickCar, setState } from './menus.js';
import { drawLock, drawMenuBg } from './screens.js';
import { TRACKS } from './tracks.js';

// ---------- Werkstatt: the car rack on top, below the garage. The chosen car drives in from the left, the old one drives out
// on the right. Row 2 is the paint: a row of colour pots, the car is sprayed at once (and keeps the colour everywhere) ----------

const GAR = { x: 16, y: 90, w: VW - 32, h: 118 }, FLOOR = 184;
const SW = { y: 214, w: 20, h: 16, gap: 4 };
const swX0 = () => Math.round(VW / 2 - (PAINTS.length * (SW.w + SW.gap) - SW.gap) / 2);

G.shop = { prev: -1, t: -10, row: 0, paintT: -10 };

export function openShop() { G.shop = { prev: -1, t: -10, row: 0, paintT: -10 }; setState('shop'); }

function choose(i) {
  if (i === G.selCar) return;
  // a car still driving in counts as arrived: it is the one that drives out now
  G.shop.prev = G.selCar; G.shop.t = G.time; pickCar(i);
}

function paint(i) {
  const def = CAR_DEFS[G.selCar];
  if (isLocked(def)) { SFX.bump(); return; }
  if (i === (def.paint || 0)) return;
  savePaint(def, (i + PAINTS.length) % PAINTS.length); G.shop.paintT = G.time; SFX.splash(.5);
}

export function shopKey(k) {
  const s = G.shop;
  if (is(k, 'up') || is(k, 'down')) { s.row = 1 - s.row; SFX.click(); }
  else if (is(k, 'left') || is(k, 'right')) {
    const d = is(k, 'left') ? -1 : 1;
    if (s.row === 0) choose((G.selCar + d + CAR_DEFS.length) % CAR_DEFS.length);
    else paint((CAR_DEFS[G.selCar].paint || 0) + d);
  }
  else if (is(k, 'ok')) { if (s.row === 0) { s.row = 1; SFX.click(); } else SFX.select(); }
  else if (is(k, 'back')) { SFX.click(); setState('main'); }
}

export function shopClick(x, y) {
  const i = carSlotAt(x, y);
  if (i >= 0) { G.shop.row = 0; choose(i); return; }
  const x0 = swX0();
  if (y >= SW.y - 3 && y < SW.y + SW.h + 3) for (let j = 0; j < PAINTS.length; j++) {
    const sx = x0 + j * (SW.w + SW.gap);
    if (x >= sx - 2 && x < sx + SW.w + 2) { G.shop.row = 1; paint(j); return; }
  }
}

// ----- drawing -----

function drawGarage() {
  const { x, y, w, h } = GAR;
  R1(x - 2, y - 2, w + 4, h + 4, '#1b120c');
  // brick wall
  R1(x, y, w, FLOOR - y, '#7a5444');
  for (let r = 0; y + r * 6 < FLOOR; r++) {
    R1(x, y + r * 6 + 5, w, 1, '#5e3e32');
    for (let bx = (r % 2) * 9; bx < w; bx += 18) R1(x + bx, y + r * 6, 1, 5, '#5e3e32');
  }
  for (let i = 0; i < 40; i++) R1(x + Math.floor(hash(i, 3, 9) * w), y + Math.floor(hash(i, 4, 9) * (FLOOR - y - 4)), 3, 2, '#8a6050');
  // the beam on top and the sign
  R1(x, y, w, 7, '#4a3a2a'); R1(x, y + 7, w, 1, '#1b120c');
  R1(VW / 2 - 52, y + 10, 104, 15, '#1b120c'); R1(VW / 2 - 51, y + 11, 102, 13, '#ffd23f');
  text('WERKSTATT', VW / 2, y + 14, 8, '#1b120c', 'center', null);
  // tool board with wrenches and a hammer
  const tb = { x: x + 52, y: y + 32, w: 78, h: 40 };
  R1(tb.x - 1, tb.y - 1, tb.w + 2, tb.h + 2, '#1b120c'); R1(tb.x, tb.y, tb.w, tb.h, '#c9a36b');
  for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) R1(tb.x + 6 + i * 11, tb.y + 5 + j * 10, 1, 1, '#8a6440');
  for (let i = 0; i < 3; i++) { const wx = tb.x + 10 + i * 12; R1(wx, tb.y + 8, 3, 24 - i * 4, '#9aa3ad'); R1(wx - 2, tb.y + 6, 7, 4, '#9aa3ad'); R1(wx, tb.y + 6, 3, 2, '#c9a36b'); }
  R1(tb.x + 50, tb.y + 10, 3, 24, '#8a5a2b'); R1(tb.x + 45, tb.y + 7, 13, 6, '#6e7680');
  R1(tb.x + 64, tb.y + 8, 2, 22, '#e03131'); R1(tb.x + 62, tb.y + 26, 6, 6, '#e03131');
  // paint shelf: one pot of every colour
  const sh = { x: x + w - 150, y: y + 52 };
  R1(sh.x - 4, sh.y + 14, 102, 3, '#4a3a2a'); R1(sh.x - 4, sh.y + 17, 102, 1, '#1b120c');
  PAINTS.slice(1).forEach((p, i) => { const px = sh.x + i * 9; R1(px - 1, sh.y + 3, 9, 11, '#1b120c'); R1(px, sh.y + 4, 7, 10, '#c9ced6'); R1(px, sh.y + 7, 7, 5, p.M); R1(px, sh.y + 4, 7, 1, '#ffffff'); });
  // the floor with an oil stain and a drain
  R1(x, FLOOR, w, y + h - FLOOR, '#8f8d86'); R1(x, FLOOR, w, 1, '#5e5c57');
  for (let fx = 40; fx < w; fx += 80) R1(x + fx, FLOOR + 1, 1, y + h - FLOOR - 1, '#7a7872');
  ell(x + 120, FLOOR + 14, 18, 4, '#6e6c66'); R1(VW / 2 - 8, y + h - 6, 16, 3, '#5e5c57');
  // the doors: open, the yard behind them
  for (const dx of [x, x + w - 26]) {
    R1(dx, y + 8, 26, FLOOR - y - 8, '#8fd0f0'); R1(dx, FLOOR - 22, 26, 22, '#6fae4a'); R1(dx, FLOOR - 22, 26, 1, '#4f8e3a');
    R1(dx + (dx === x ? 25 : 0), y + 8, 1, FLOOR - y - 8, '#1b120c');
    for (let s = 0; s < 4; s++) R1(dx, y + 9 + s * 3, 26, 1, '#5e5c57'); // the rolled-up shutter
  }
}

function drawCarAt(def, cx, moving) {
  const F = carSet(def, false), S3 = SS * 3, locked = isLocked(def);
  const bob = moving ? ((G.time * 14) | 0) % 2 : locked ? 0 : ((G.time * 12) | 0) % 2;
  const x = Math.round(cx - S3 / 2), y = FLOOR + 16 - 111 - bob;
  ell(Math.round(cx), FLOOR + 14, 64, 7, 'rgba(0,0,0,.3)');
  if (locked) { ctx.globalAlpha = .9; ctx.drawImage(F.shadow[0], x, y, S3, S3); ctx.globalAlpha = 1; drawLock(Math.round(cx), FLOOR - 40); }
  else ctx.drawImage(F.frames[0][0], x, y, S3, S3);
  if (moving && ((G.time * 10) | 0) % 2) { ctx.fillStyle = 'rgba(220,220,220,.5)'; ctx.fillRect(x - 4, FLOOR + 6, 5, 4); }
}

export function drawShop() {
  drawMenuBg(TRACKS[4] || TRACKS[0]);
  drawRack([]);
  drawGarage();
  // the cars: the new one comes in from the left and stops in the middle, the old one leaves on the right
  ctx.save(); ctx.beginPath(); ctx.rect(GAR.x, GAR.y + 8, GAR.w, GAR.h - 8); ctx.clip();
  const s = G.shop, p = clamp((G.time - s.t) / .9, 0, 1), q = clamp((G.time - s.t) / .75, 0, 1);
  if (s.prev >= 0 && q < 1) drawCarAt(CAR_DEFS[s.prev], VW / 2 + q * q * (VW / 2 + 90), true);
  const e = 1 - (1 - p) ** 3, def = CAR_DEFS[G.selCar];
  drawCarAt(def, -80 + e * (VW / 2 + 80), p < 1);
  // fresh paint: a cloud of spray around the car for a moment
  const pt = G.time - s.paintT;
  if (pt < .7) {
    const n = Math.round((1 - pt / .7) * 60);
    for (let i = 0; i < n; i++) {
      const a = hash(i, (G.time * 20) | 0, 5) * Math.PI * 2, r = 30 + hash(i, (G.time * 20) | 0, 6) * 50;
      R1(Math.round(VW / 2 + Math.cos(a) * r * 1.2), Math.round(FLOOR - 36 + Math.sin(a) * r * .5), 2, 2, i % 3 ? def.M : def.L);
    }
  }
  ctx.restore();
  // the colours
  const locked = isLocked(def), x0 = swX0(), cur = def.paint || 0, focus = s.row === 1;
  PAINTS.forEach((pp, j) => {
    const sx = x0 + j * (SW.w + SW.gap), sel = j === cur, lift = sel ? 2 : 0, col = j ? pp.M : def.own.M;
    R1(sx - 2, SW.y - 2 - lift, SW.w + 4, SW.h + 4, sel ? (focus ? '#ffd23f' : '#d8c4a8') : '#1b120c');
    R1(sx, SW.y - lift, SW.w, SW.h, col); R1(sx, SW.y - lift, SW.w, 2, j ? pp.L : def.own.L); R1(sx, SW.y + SW.h - 3 - lift, SW.w, 3, j ? pp.D : def.own.D);
    if (!j) star(sx + 6, SW.y + 4 - lift, true, '#1b120c');
    if (locked) { ctx.fillStyle = 'rgba(27,16,9,.6)'; ctx.fillRect(sx, SW.y - lift, SW.w, SW.h); }
  });
  if (focus) { const wig = Math.round(Math.sin(G.time * 5) * 2); tri(x0 - 12 - wig, SW.y + SW.h / 2, 'left', 5, '#ffd23f'); tri(x0 + PAINTS.length * (SW.w + SW.gap) + 8 + wig, SW.y + SW.h / 2, 'right', 5, '#ffd23f'); }
  text(locked ? def.cup ? '???  (GESPERRT)' : '???' : def.name + '  -  ' + PAINTS[cur].name, VW / 2, 238, 8, locked ? '#9a8a78' : '#ffd23f', 'center');
  text(s.row === 0 ? '< > AUTO   RUNTER = FARBE   ESC = MENUE' : '< > FARBE   HOCH = AUTO   ESC = MENUE', VW / 2, 254, 8, '#d8c4a8', 'center');
}
