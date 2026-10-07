import { G } from './g.js';
import { isLocked } from './cars.js';
import { VW, WH, WW, ctx } from './core.js';
import { CUPS, cupReady, cupReward, cupTrackIdx, cupWon } from './cups.js';
import { R1, disc, text } from './draw.js';
import { drawMenuBg, drawTrophy } from './screens.js';
import { TRACKS } from './tracks.js';

// ---------- cup selection (Grand Prix): one row per cup, the focused row steps out of the list ----------

const ROW = { x: 40, w: VW - 80, y0: 28, h: 30, hSel: 46, gap: 4, pad: 4 };

// y and height of every row: the focused one is taller and gets extra room above and below
function layout() {
  const out = []; let y = ROW.y0;
  CUPS.forEach((c, i) => {
    const sel = i === G.selCup;
    if (sel) y += ROW.pad;
    const h = sel ? ROW.hSel : ROW.h;
    out.push({ y, h, sel }); y += h + ROW.gap + (sel ? ROW.pad : 0);
  });
  return out;
}

export function cupRowAt(py) { return layout().findIndex(r => py >= r.y && py < r.y + r.h); }

// the cup coins: bronze with a road, silver with a bonsai, gold with a star, platinum with a bolt, rainbow with a unicorn
const COIN = [['#8a5a2b', '#cd7f32', '#f0b070'], ['#6e7680', '#c0c8d0', '#f2f6fa'], ['#c79a06', '#ffd23f', '#fff08a'], ['#566c85', '#a9c4de', '#e8f4ff']];
const RAINBOW = ['#ff4d6d', '#ff9f43', '#ffd93d', '#6bcb77', '#4d96ff', '#9b5de5'];
const SYMBOL = [
  ['...#...', '...#...', '..#.#..', '..#.#..', '.#.#.#.', '.#.#.#.', '#..#..#'],
  ['..###..', '.#####.', '..###..', '...#...', '...#...', '.#####.', '#######'],
  ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '##...##'],
  ['....##.', '...##..', '..##...', '.#####.', '...##..', '..##...', '.##....'],
  ['.....#.', '....#..', '.####..', '######.', '##.###.', '...##..', '...#...'],
];

function drawCoin(cx, cy, k, i) {
  const r = 6 * k, ink = '#1b120c';
  disc(cx, cy, r, ink);
  if (i < 4) {
    const [edge, mid, hi] = COIN[i];
    disc(cx, cy, r - 1, edge); disc(cx, cy, r - k, mid); R1(cx - Math.round(r * .6), cy - Math.round(r * .6), k * 2, k, hi); R1(cx - Math.round(r * .6), cy - Math.round(r * .6) + k, k, k, hi);
  } else {
    RAINBOW.forEach((c, j) => disc(cx, cy, r - 1 - Math.round(j * k * .5), c));
    disc(cx, cy, r - 1 - Math.round(3 * k), '#ffffff');
  }
  SYMBOL[i].forEach((row, ry) => { for (let rx = 0; rx < 7; rx++) if (row[rx] === '#') R1(Math.round(cx - 3.5 * k + rx * k), Math.round(cy - 3.5 * k + ry * k), k, k, ink); });
}

// a present that turns around: the box is squeezed and widened again, the front and the back are shaded differently
function drawGift(cx, cy, s) {
  const c = Math.cos(G.time * 3), w = Math.max(2, Math.round(Math.abs(c) * 12 * s)), h = Math.round(9 * s), lid = Math.round(3 * s);
  const x = Math.round(cx - w / 2), y = Math.round(cy - (h + lid) / 2 + lid), face = c > 0 ? '#e63946' : '#b32632', lidc = c > 0 ? '#ff6b73' : '#d8505a';
  R1(x - 1, y - lid - 1, w + 4, h + lid + 2, '#1b120c');
  R1(x, y, w, h, face); R1(x - 1, y - lid, w + 2, lid, lidc);
  const rw = Math.max(1, Math.round(w / 4)); R1(Math.round(cx - rw / 2), y - lid, rw, h + lid, '#ffd23f');
  R1(x, y + Math.round(h / 2) - 1, w, Math.max(1, Math.round(s)), '#ffd23f');
  const b = Math.max(2, Math.round(2.5 * s)); R1(Math.round(cx - b - Math.min(w / 2, b)), y - lid - b, b, b, '#ffd23f'); R1(Math.round(cx + Math.min(w / 2, b)), y - lid - b, b, b, '#ffd23f');
}

export function drawSelectCup() {
  drawMenuBg(TRACKS[0]);
  text('CUP WAEHLEN', VW / 2, 6, 16, '#ffd23f', 'center');
  const L = layout(), pop = Math.round(Math.max(0, 1 - (G.time - G.selAnim) * 5) * 4);
  CUPS.forEach((cup, i) => {
    const { y, h, sel } = L[i], ready = cupReady(cup), x = ROW.x, w = ROW.w, cy = y + Math.round(h / 2) - (sel ? pop : 0);
    R1(x - 3, y - 3, w + 6, h + 6, sel ? '#ffd23f' : '#3a2a1c'); R1(x - 1, y - 1, w + 2, h + 2, '#1b120c'); R1(x, y, w, h, sel ? '#5a3a1f' : '#3a2a1c');
    const k = sel ? 3 : 2, coinR = 6 * k, lx = x + 8 + coinR * 2 + 8, bob = sel ? Math.round(Math.abs(Math.sin(G.time * 3)) * 2) : 0;
    drawCoin(x + 8 + coinR, cy - bob, k, i);
    text('CUP ' + cup.n, lx, y + Math.round(h / 2) - 9, 8, sel ? '#ffd23f' : '#fff3dc');
    text(cup.name, lx, y + Math.round(h / 2) + 1, 8, sel ? '#ffd23f' : '#d8c4a8');
    // the tracks of the cup, bigger when focused
    const tw = sel ? 60 : 40, th = sel ? 34 : 22, tx0 = lx + 62, ty = y + Math.round((h - th) / 2), span = 3 * tw + 12;
    if (ready) {
      cupTrackIdx(cup).forEach((ti, j) => {
        const t = TRACKS[ti], tx = tx0 + j * (tw + 6);
        R1(tx - 1, ty - 1, tw + 2, th + 2, '#1b120c');
        ctx.drawImage(t.base, 0, 0, WW, WH, tx, ty, tw, th); ctx.drawImage(t.top, 0, 0, WW, WH, tx, ty, tw, th);
        if (sel) text(t.name, tx + tw / 2, ty + th - 9, 8, '#fff3dc', 'center');
      });
    } else {
      R1(tx0 - 1, ty - 1, span + 2, th + 2, '#1b120c'); R1(tx0, ty, span, th, '#2a1d12');
      text('BALD VERFUEGBAR', tx0 + span / 2, ty + Math.round((th - 8) / 2), 8, '#9a8a78', 'center', null);
      ctx.fillStyle = 'rgba(27,16,9,.3)'; ctx.fillRect(x, y, w, h);
    }
    // the reward: a turning present as long as the car is still locked, a small trophy once the cup is won
    const gx = x + w - 20, reward = cupReward(cup);
    if (cupWon(cup)) drawTrophy(gx, cy + 2, sel ? 1 : .7);
    else if (reward && isLocked(reward)) {
      drawGift(gx, cy, sel ? 2 : 1);
      if (sel) { text('NEUES', gx - 20, cy - 10, 8, '#ffd23f', 'right'); text('AUTO', gx - 20, cy + 1, 8, '#ffd23f', 'right'); }
    }
  });
  text('HOCH/RUNTER WAEHLEN    ENTER = WEITER', VW / 2, 256, 8, '#d8c4a8', 'center');
}
