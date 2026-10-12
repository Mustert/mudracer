import { G } from './g.js';
import { FONT, ctx } from './core.js';

// ---------- small drawing helpers (text, shapes, panels, the 1P sign) ----------
// They only draw on the canvas and know nothing of the game logic, so every module can use them without import circles.

export function text(s, x, y, size, col, align = 'left', sh = '#1b120c') {
  ctx.font = size + 'px ' + FONT; ctx.textAlign = align; ctx.textBaseline = 'top';
  if (sh) { ctx.fillStyle = sh; ctx.fillText(s, Math.round(x) + 1, Math.round(y) + 1); }
  ctx.fillStyle = col; ctx.fillText(s, Math.round(x), Math.round(y));
}


export function disc(cx, cy, r, col) { ctx.fillStyle = col; for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy + r * .8)); ctx.fillRect(cx - w, cy + dy, w * 2 + 1, 1); } }


export function ell(cx, cy, rx, ry, col) { ctx.fillStyle = col; for (let dy = -ry; dy <= ry; dy++) { const w = Math.round(rx * Math.sqrt(1 - (dy / ry) ** 2)); ctx.fillRect(cx - w, cy + dy, w * 2 + 1, 1); } }


const STAR = ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '##...##'];


export function star(x, y, on, col) { ctx.fillStyle = col || (on ? '#ffd23f' : '#4a3a2a'); for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (STAR[r][c] === '#') ctx.fillRect(x + c, y + r, 1, 1); }


export function tri(x, y, dir, size, col) {
  ctx.fillStyle = col;
  for (let i = 0; i < size; i++) {
    if (dir === 'left') ctx.fillRect(x + i, y - i, 1, 2 * i + 1);
    else if (dir === 'right') ctx.fillRect(x - i, y - i, 1, 2 * i + 1);
    else ctx.fillRect(x - i, y - i, 2 * i + 1, 1); // pointing down, tip at y
  }
}


export function R1(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }


const MEDAL = ['#ffd23f', '#d9dde3', '#d98a4a', '#6fb3ff'], MEDAL_L = ['#fff08a', '#f4f6f8', '#f0b27a', '#a9d4ff'];


export function drawConfetti() { for (const p of G.parts) if (p.t === 'conf') { ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, ((G.time * 8 + p.ph) | 0) % 2 ? 3 : 1); } }


export function drawFlag(x, y) {
  ctx.fillStyle = '#d8c4a8'; ctx.fillRect(x, y, 1, 10);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { ctx.fillStyle = (r + c) & 1 ? '#222' : '#fff'; ctx.fillRect(x + 1 + c * 2, y + r * 2, 2, 2); }
}


// the 1P sign: an orange tag with a little arrow, its tip at (x, y)
export function drawTag(x, y) {
  x = Math.round(x); y = Math.round(y);
  tri(x, y + 1, 'down', 5, '#1b120c'); tri(x, y, 'down', 4, '#f07a1a');
  R1(x - 12, y - 16, 24, 13, '#1b120c'); R1(x - 11, y - 15, 22, 11, '#f07a1a'); R1(x - 11, y - 15, 22, 1, '#ffb45e');
  text('1P', x + 1, y - 13, 8, '#ffffff', 'center', null);
}


export const medal = pl => MEDAL[Math.min(pl, 4) - 1], medalL = pl => MEDAL_L[Math.min(pl, 4) - 1];


export function panel(x, y, w, h) {
  ctx.fillStyle = '#1b120c'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#e8a860'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#5a3a1f'; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
}


export const blink = (rate = 2.5) => ((G.time * rate) | 0) % 2 === 0;

