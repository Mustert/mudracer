import { HL, OUT } from './cars.js';
import { mk, outlineImg, toCanvas } from './core.js';

// ---------- steam train (28 wide, drawn heading down, locomotive at the bottom) ----------

function buildTrain() {
  const WAG = 48, GAP = 4, NW = 4, LOCO = 60, len = NW * (WAG + GAP) + LOCO;
  const c = mk(30, len + 2), g = c.getContext('2d');
  const R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x + 1, y + 1, w, h); };
  const WC = [['#2e86de', '#5dade2', '#1b4f72'], null, ['#27ae60', '#58d68d', '#145a32'], ['#e67e22', '#f0b27a', '#873600']];
  for (let k = 0; k < NW; k++) {
    const y = k * (WAG + GAP);
    if (k) R('#333333', 12, y - GAP, 4, GAP);
    if (!WC[k]) { // log wagon
      R('#5d4037', 2, y, 24, WAG);
      for (let j = 0; j < 5; j++) { R('#a1887f', 4, y + 3 + j * 9, 20, 7); R('#795548', 4, y + 8 + j * 9, 20, 1); R('#d7ccc8', 4, y + 3 + j * 9, 2, 7); R('#d7ccc8', 22, y + 3 + j * 9, 2, 7); R('#8d6e63', 3, y + 3 + j * 9, 1, 7); }
    } else {
      const [m, l, d] = WC[k];
      R(m, 2, y, 24, WAG); R(l, 3, y + 1, 22, 2); R(d, 2, y + WAG - 2, 24, 2); R(d, 13, y + 1, 2, WAG - 3);
      for (let j = 6; j < WAG - 6; j += 9) { R(l, 5, y + j, 6, 4); R(l, 17, y + j, 6, 4); }
    }
  }
  const ly = NW * (WAG + GAP);
  R('#333333', 12, ly - GAP, 4, GAP);
  R('#c0392b', 2, ly, 24, 14); R('#e74c3c', 3, ly + 1, 22, 2); R('#7b1e14', 2, ly + 12, 24, 2);
  R('#3a3a3a', 1, ly + 14, 26, 40); R('#c0392b', 1, ly + 14, 1, 40); R('#c0392b', 26, ly + 14, 1, 40);
  R('#262626', 6, ly + 14, 16, 40); R('#4a4a4a', 8, ly + 14, 3, 40);
  for (let y = ly + 18; y < ly + 52; y += 9) R('#d4a017', 6, y, 16, 1);
  R('#d4a017', 12, ly + 29, 4, 4); R('#f7dc6f', 12, ly + 29, 2, 2);
  R('#111111', 11, ly + 43, 6, 6); R('#444444', 12, ly + 44, 4, 4); R('#000000', 13, ly + 45, 2, 2);
  R('#c0392b', 2, ly + 54, 24, 3); R('#7f8c8d', 4, ly + 57, 20, 2); R('#7f8c8d', 8, ly + 59, 12, 1);
  R(HL, 13, ly + 55, 2, 2);
  const img = outlineImg(g.getImageData(0, 0, 30, len + 2), 30, len + 2, OUT);
  return { c: toCanvas(img), LEN: len + 2, chim: ly + 47 };
}


export const TRAIN = buildTrain();
