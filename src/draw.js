import { G } from './g.js';
import { carSet } from './cars.js';
import { FONT, HALF, LAPS, ROTS, SS, TAU, VH, VW, clamp, ctx, hash } from './core.js';
import { drawEventsAbove, drawEventsGround, drawNight, drawRain } from './events.js';
import { crossingAhead, placeOf } from './physics.js';
import { drawRunFinish, drawRunHud } from './run.js';
import { drawRingAbove, drawRingGround, drawStartLights, ghostUp } from './ring.js';
import { drawDesertAbove, drawDesertGround, drawStorm } from './desert.js';
import { drawIceAbove, drawIceGround, drawIceSky } from './ice.js';
import { drawVolcanoAbove, drawVolcanoGround, drawVolcanoSky } from './volcano.js';
import { drawJungleAbove, drawJungleGround, drawJungleSky } from './jungle.js';
import { cam } from './state.js';
import { GHOST_DT, fmtDelta, fmtTime, ghostAt } from './timetrial.js';
import { trail } from './tracks.js';
import { TRAIN } from './trainsprite.js';

// ---------- drawing ----------

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


export function rotIndex(a) { return (((Math.round(a / TAU * ROTS) % ROTS) + ROTS) % ROTS) || 0; }


function drawCar(c) {
  const F = c.cem && c.Fc ? c.Fc : c.F, rot = rotIndex(c.ang), lv = Math.min(5, Math.round(c.dirt * 5));
  if (c.fall > 0) {
    // into the gorge or under the quicksand: the car gets smaller for a moment, then it is gone (under water it is gone at once)
    const t = c.fallKind ? (c.fallT0 - c.fall) / .55 : 1; if (t >= 1) return;
    if (c.fallKind === 'lava') { // like on a hot stove: the car jumps up and is gone
      ctx.globalAlpha = 1 - t * .7; ctx.drawImage(F.frames[lv][rot], Math.round(c.fx0 - SS / 2), Math.round(c.fy0 - SS / 2 - Math.sin(t * Math.PI) * 18 - t * 6)); ctx.globalAlpha = 1;
      return;
    }
    const S = Math.max(4, Math.round(SS * (c.fallKind === 'sand' ? .55 : 1) * (1 - t * .85)));
    ctx.globalAlpha = 1 - t * .6; ctx.drawImage(F.frames[lv][rot], Math.round(c.fx0 - S / 2), Math.round(c.fy0 - S / 2 + (c.fallKind === 'abyss' ? t * 10 : 0)), S, S); ctx.globalAlpha = 1;
    return;
  }
  if (c.ghost > 0 && ((G.time * 12) | 0) % 2) return; // blinks after coming back out of the water
  if (c.flatT > 0) { // flattened by the stone ball: wide and thin for a moment
    const s = Math.min(1, c.flatT / .3);
    ctx.drawImage(F.frames[lv][rotIndex(c.ang)], Math.round(c.x - SS * (.5 + .25 * s)), Math.round(c.y - SS * (.5 - .3 * s)), Math.round(SS * (1 + .5 * s)), Math.round(SS * (1 - .6 * s)));
    return;
  }
  const x = Math.round(c.x) - SS / 2, y = Math.round(c.y) - SS / 2 - c.bump;
  if (c.sink > 0) { // sinking in quicksand: smaller, sand trickles round it
    const S = Math.round(SS * (1 - .45 * Math.min(1, c.sink / 1.2)));
    ctx.drawImage(F.frames[lv][rot], Math.round(c.x - S / 2), Math.round(c.y - S / 2), S, S);
    return;
  }
  if (c.z > 0) { // in the air: bigger car, shadow left on the ground
    const S = Math.round(SS * (1 + c.z / 90)), lift = Math.round(c.z * .6);
    ctx.globalAlpha = .3 * Math.max(.2, 1 - c.z / 80); ctx.drawImage(F.shadow[rot], x + 3 + Math.round(c.z * .3), y + 4 + Math.round(c.z * .4)); ctx.globalAlpha = 1;
    ctx.drawImage(F.frames[lv][rot], Math.round(c.x - S / 2), Math.round(c.y - S / 2) - lift, S, S);
    return;
  }
  ctx.globalAlpha = .3; ctx.drawImage(F.shadow[rot], x + 3, y + 4 + c.bump); ctx.globalAlpha = 1;
  ctx.drawImage(F.frames[lv][rot], x, y);
  if (c.snowT > 0) { // snowed in: a white lump of snow over the car
    const X = Math.round(c.x), Y = Math.round(c.y), w = Math.round(Math.sin(G.time * 40) * (c.shake || 0) * 2);
    ell(X + w, Y, 16, 12, '#9fb2c6'); ell(X + w, Y - 1, 15, 11, '#eef4fa'); ell(X - 4 + w, Y - 4, 8, 5, '#ffffff');
  }
}


function drawParticles() {
  for (const p of G.parts) {
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.t === 'd') { ctx.fillStyle = p.col; ctx.fillRect(x, Math.round(p.y - p.z), p.s, p.s); }
    else if (p.t === 'ring') {
      const r = 2 + (1 - p.life / p.ml) * 11; ctx.fillStyle = '#d8f1ff';
      for (let k = 0; k < 18; k++) { const a = k / 18 * TAU; ctx.fillRect(Math.round(p.x + Math.cos(a) * r), Math.round(p.y + Math.sin(a) * r * .6), 1, 1); }
    } else if (p.t === 'bub') { ctx.fillStyle = '#bfe6ff'; ctx.fillRect(x, y, 3, 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 2, 2); }
    else if (p.t === 'mb') {
      const pr = 1 - p.life / p.ml; ctx.fillStyle = G.T.th.mudHi;
      if (pr < .35) ctx.fillRect(x, y, 2, 2); else if (pr < .7) { ctx.fillRect(x - 1, y, 4, 2); ctx.fillRect(x, y - 1, 2, 4); }
      else { ctx.fillRect(x - 2, y, 1, 1); ctx.fillRect(x + 3, y, 1, 1); ctx.fillRect(x, y - 2, 1, 1); ctx.fillRect(x + 1, y + 3, 1, 1); }
    } else if (p.t === 'dust') { ctx.globalAlpha = .4 * p.life / p.ml; ctx.fillStyle = '#e8d2a8'; ctx.fillRect(x, y, 3, 3); ctx.globalAlpha = 1; }
    else if (p.t === 'shoot') { for (let k = 0; k < 8; k++) { ctx.globalAlpha = (1 - k / 8) * Math.min(1, p.life); ctx.fillStyle = k < 2 ? '#ffffff' : '#ffe9a8'; ctx.fillRect(Math.round(p.x - p.vx * k * .012), Math.round(p.y - p.vy * k * .012), k < 2 ? 2 : 1, k < 2 ? 2 : 1); } ctx.globalAlpha = 1; }
  }
}


function drawSmoke() {
  for (const p of G.parts) if (p.t === 'smoke') {
    const pr = 1 - p.life / p.ml;
    ctx.globalAlpha = .55 * (1 - pr); disc(Math.round(p.x), Math.round(p.y), 2 + Math.round(pr * 7), pr < .3 ? '#f0f0f0' : '#b8b8b8');
  }
  ctx.globalAlpha = 1;
}

// beach life: rolling foam lines, a sailing boat and sideways-walking crabs

function drawBeach(cx) {
  const sy = G.T.shoreY;
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (let x = cx; x < cx + VW; x++) ctx.fillRect(x, Math.round(sy[x] + 3 + Math.sin(G.time * 1.3 + x * .025) * 2.5), 1, 1);
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  for (let x = cx; x < cx + VW; x++) { const y = Math.round(sy[x] + 11 + Math.sin(G.time * .9 + x * .035 + 1) * 3); ctx.fillRect(x, y, 1, x % 3 ? 1 : 2); }
  const bx = Math.round(G.T.boat.x), by = 438 + Math.round(Math.sin(G.time * 1.5));
  ctx.fillStyle = 'rgba(255,255,255,.6)'; for (let k = 0; k < 8; k++) ctx.fillRect(bx - 12 - k * 3, by + 1 + (k % 2), 2, 1);
  ctx.fillStyle = '#1b120c'; ctx.fillRect(bx - 10, by - 3, 21, 7);
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(bx - 9, by - 2, 19, 5);
  ctx.fillStyle = '#c49a6c'; ctx.fillRect(bx - 7, by - 1, 14, 3);
  for (let k = 0; k < 13; k++) { ctx.fillStyle = k === 4 ? '#e84a5f' : '#ffffff'; ctx.fillRect(bx, by - 3 - k, Math.max(1, 9 - Math.round(k * .7)), 1); }
  ctx.fillStyle = '#5a3a1c'; ctx.fillRect(bx - 1, by - 16, 1, 15);
}

// little animals on the ground: crabs, bunnies, a duck family, squirrels, hedgehogs

export function R1(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }


function drawCritters() {
  for (const c of G.T.critters) {
    if (c.type === 'crab') {
      const x = Math.round(c.x + Math.sin(G.time * .7 + c.ph) * c.range), y = Math.round(c.y), st = ((G.time * 8 + c.ph) | 0) % 2;
      if (G.T.ter[y * G.T.W + x] === 3) continue; // under water
      R1(x - 4, y + st, 1, 1, '#8a2a1a'); R1(x + 4, y + 1 - st, 1, 1, '#8a2a1a'); R1(x - 4, y + 2 - st, 1, 1, '#8a2a1a'); R1(x + 4, y + 1 + st, 1, 1, '#8a2a1a');
      R1(x - 3, y - 1, 7, 4, '#1b120c'); R1(x - 6, y - 3, 3, 3, '#1b120c'); R1(x + 4, y - 3, 3, 3, '#1b120c');
      R1(x - 2, y, 5, 2, '#e8452c'); R1(x - 5, y - 2, 1, 1, '#e8452c'); R1(x + 5, y - 2, 1, 1, '#e8452c');
      R1(x - 2, y, 5, 1, '#ff8a6a'); R1(x - 1, y - 2, 1, 1, '#ffffff'); R1(x + 1, y - 2, 1, 1, '#ffffff');
    } else if (c.type === 'bunny') {
      const p = G.time * .6 + c.ph, x = Math.round(c.x + Math.sin(p) * c.range), dir = Math.cos(p) >= 0 ? 1 : -1;
      const hop = Math.round(Math.abs(Math.sin(G.time * 7 + c.ph)) * 3), y = Math.round(c.y) - hop;
      const B = c.brown ? '#b08a60' : '#f4f1ea', B2 = c.brown ? '#8a6a48' : '#d8d2c4';
      ctx.globalAlpha = .25; R1(x - 3, Math.round(c.y) + 3, 7, 2, '#000'); ctx.globalAlpha = 1;
      R1(x - 4, y - 1, 8, 5, '#1b120c'); R1(x + dir * 3 - 1, y - 3, 3, 4, '#1b120c'); R1(x + dir * 2, y - 6, 1, 4, '#1b120c'); R1(x + dir * 4, y - 6, 1, 4, '#1b120c');
      R1(x - 3, y, 6, 3, B); R1(x - 3, y + 2, 6, 1, B2); R1(x + dir * 3, y - 2, 2, 2, B); R1(x + dir * 2, y - 5, 1, 3, B); R1(x + dir * 4, y - 5, 1, 3, B);
      R1(x + dir * 2, y - 4, 1, 1, '#ffb3c6'); R1(x + dir * 4 - (dir > 0 ? 0 : 1), y - 2, 1, 1, '#1b120c'); R1(x - dir * 4, y, 2, 2, '#ffffff');
    } else if (c.type === 'koi') {
      // koi swim slow circles under the surface
      const a = G.time * .32 + c.ph, x = c.x + Math.cos(a) * c.rx, y = c.y + Math.sin(a) * c.ry, h = Math.atan2(Math.cos(a) * c.ry, -Math.sin(a) * c.rx), wag = Math.sin(G.time * 6 + c.ph * 4) * .4;
      if (G.T.ter[(Math.round(y)) * G.T.W + Math.round(x)] !== 5) continue; // only in open water, not over stones or bridges
      const B = [['#ff7a1a', '#fff7e8'], ['#fff7e8', '#ff7a1a'], ['#2b2b30', '#ff7a1a']][c.col];
      ctx.save(); ctx.globalAlpha = .85; ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(h);
      R1(-5, -2, 9, 4, B[0]); R1(0, -2, 3, 4, B[1]); R1(3, -1, 2, 2, B[0]);
      ctx.save(); ctx.translate(-5, 0); ctx.rotate(wag); R1(-4, -2, 4, 4, B[0]); ctx.restore();
      ctx.restore();
    } else if (c.type === 'ducks') {
      for (let k = 0; k < 4; k++) {
        const a = G.time * .25 + c.ph - k * .22, x = Math.round(c.x + Math.cos(a) * c.rx), y = Math.round(c.y + Math.sin(a) * c.ry), dir = -Math.sin(a) >= 0 ? 1 : -1;
        R1(x - dir * 6, y + 2, 3, 1, 'rgba(255,255,255,.6)');
        if (!k) { R1(x - 4, y - 1, 8, 5, '#1b120c'); R1(x - 3, y, 6, 3, '#f4f4f0'); R1(x + dir * 3 - 1, y - 3, 3, 3, '#1b120c'); R1(x + dir * 3 - (dir > 0 ? 1 : 0), y - 2, 2, 2, '#f4f4f0'); R1(x + dir * 5 - (dir > 0 ? 0 : 1), y - 2, 1, 1, '#ff9f1c'); R1(x + dir * 3, y - 2, 1, 1, '#1b120c'); }
        else { R1(x - 2, y, 4, 3, '#1b120c'); R1(x - 1, y + 1, 2, 1, '#ffd93d'); R1(x + dir * 2 - (dir > 0 ? 1 : 0), y, 2, 1, '#ffd93d'); R1(x + dir * 3 - (dir > 0 ? 0 : 1), y, 1, 1, '#ff9f1c'); }
      }
    } else if (c.type === 'squirrel') {
      const p = G.time * .8 + c.ph, run = Math.sin(p), x = Math.round(c.x + Math.sign(run) * Math.pow(Math.abs(run), .4) * c.range), dir = Math.cos(p) >= 0 ? 1 : -1, y = Math.round(c.y);
      R1(x - 3, y - 1, 6, 4, '#1b120c'); R1(x - dir * 5 - 1, y - 4, 4, 5, '#1b120c');
      R1(x - 2, y, 4, 2, '#b5562a'); R1(x - dir * 5, y - 3, 2, 3, '#d9803e'); R1(x + dir * 2, y - 1, 1, 1, '#1b120c'); R1(x - 1, y + 1, 2, 1, '#e8c7a0');
    } else if (c.type === 'hedgehog') {
      const p = G.time * .3 + c.ph, x = Math.round(c.x + Math.sin(p) * c.range), dir = Math.cos(p) >= 0 ? 1 : -1, y = Math.round(c.y);
      R1(x - 4, y - 2, 8, 5, '#1b120c'); R1(x - 3, y - 1, 6, 3, '#5a4632');
      for (let q = -3; q < 3; q += 2) R1(x + q, y - 1 + (q & 1), 1, 1, '#2e2418');
      R1(x + dir * 4 - (dir > 0 ? 0 : 1), y, 2, 2, '#d8b89a'); R1(x + dir * 5 - (dir > 0 ? 0 : 1), y, 1, 1, '#1b120c');
    }
  }
}


const GULL = [[[-4, -2], [-3, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, -1], [4, -2]], [[-4, 0], [-3, 0], [-2, -1], [-1, 0], [0, 0], [1, 0], [2, -1], [3, 0], [4, 0]]];

// everything that flies above the trees: gulls, butterflies, fireflies, falling leaves

function drawFlyers() {
  for (const p of G.parts) {
    if (p.t === 'gull') {
      const x = Math.round(p.x), y = Math.round(p.y + Math.sin(G.time * 2 + p.ph) * 3), shape = GULL[((G.time * 5 + p.ph) | 0) % 2];
      ctx.fillStyle = 'rgba(0,0,0,.16)'; for (const [dx, dy] of shape) ctx.fillRect(x + dx * 2 + 18, y + dy * 2 + 30, 2, 2);
      for (const [dx, dy] of shape) { ctx.fillStyle = Math.abs(dx) === 4 ? '#7d8a96' : '#ffffff'; ctx.fillRect(x + dx * 2, y + dy * 2, 2, 2); }
      ctx.fillStyle = '#ffb347'; ctx.fillRect(x + 2, y + 1, 1, 1);
    } else if (p.t === 'bfly') {
      const x = Math.round(p.x), y = Math.round(p.y), open = ((G.time * 10 + p.ph) | 0) % 2;
      ctx.globalAlpha = .2; R1(x + 6, y + 10, 3, 1, '#000'); ctx.globalAlpha = 1;
      R1(x, y - 1, 1, 3, '#1b120c');
      if (open) { R1(x - 3, y - 2, 3, 2, p.col); R1(x + 1, y - 2, 3, 2, p.col); R1(x - 2, y, 2, 2, p.col); R1(x + 1, y, 2, 2, p.col); }
      else { R1(x - 1, y - 2, 1, 3, p.col); R1(x + 1, y - 2, 1, 3, p.col); }
    } else if (p.t === 'ffly') {
      const glow = .5 + .5 * Math.sin(G.time * 4 + p.ph); if (glow < .15) continue;
      ctx.globalAlpha = .25 * glow; disc(Math.round(p.x), Math.round(p.y), 3, '#fff7a0');
      ctx.globalAlpha = glow; R1(Math.round(p.x), Math.round(p.y), 1, 1, '#fffde0'); ctx.globalAlpha = 1;
    } else if (p.t === 'leaf') {
      const f = ((G.time * 4 + p.ph) | 0) % 2; R1(Math.round(p.x), Math.round(p.y), f ? 2 : 1, f ? 1 : 2, p.col);
    } else if (p.t === 'petal') {
      const f = ((G.time * 5 + p.ph) | 0) % 3; R1(Math.round(p.x), Math.round(p.y), f === 1 ? 1 : 2, f === 1 ? 2 : 1, p.col);
    } else if (p.t === 'lantern') {
      // a paper lantern drifting over the track: a soft glow, the flickering flame inside, a shadow far below on the ground
      const x = Math.round(p.x + Math.sin(G.time * 1.4 + p.ph) * 2), y = Math.round(p.y), fl = .75 + .25 * Math.sin(G.time * 9 + p.ph * 3);
      ctx.globalAlpha = .18; R1(x - 3, y + 24, 8, 3, '#000');
      ctx.globalAlpha = .16 * fl; disc(x + 3, y + 4, 11, '#ffb347'); ctx.globalAlpha = .2 * fl; disc(x + 3, y + 4, 7, '#ffd27a'); ctx.globalAlpha = 1;
      R1(x, y - 1, 7, 1, '#3b2512'); R1(x, y + 9, 7, 1, '#3b2512'); R1(x - 1, y, 9, 9, '#1b120c'); R1(x, y, 7, 9, p.col);
      R1(x + 1, y + 2, 5, 5, fl > .85 ? '#fff3b0' : '#ffd96a'); R1(x + 3, y, 1, 9, 'rgba(120,40,20,.5)'); R1(x + 3, y + 10, 1, 3, '#e8c06a');
    }
  }
}


function drawWindmill() {
  const W = G.T.windmill; if (!W) return;
  for (const pass of [0, 1]) for (let k = 0; k < 4; k++) {
    const a = G.time * 1.1 + k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), ox = pass ? 0 : 7, oy = pass ? 0 : 9;
    if (!pass) ctx.globalAlpha = .18;
    for (let s = 3; s <= 27; s++) for (let w = s > 9 ? -3 : 0; w <= (s > 9 ? 3 : 0); w++) {
      const edge = s === 27 || Math.abs(w) === 3 || s % 4 === 0 || w === 0;
      ctx.fillStyle = pass ? (edge ? '#6b4226' : '#f4efe0') : '#000';
      ctx.fillRect(Math.round(W.x + ca * s - sa * w) + ox, Math.round(W.y + sa * s + ca * w) + oy, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  disc(W.x, W.y, 3, '#3b2512'); R1(W.x - 1, W.y - 1, 2, 2, '#8a5a2b');
}


G.VIGNETTE = null;

// forest mood: slanted sunbeams and a soft dark vignette

function drawMood() {
  if (!G.T.th.beams && !G.T.th.dark) return;
  if (G.T.th.beams) {
    ctx.save(); ctx.globalAlpha = .07; ctx.fillStyle = '#fff3b0';
    for (let k = 0; k < 4; k++) {
      const span = VW + 260, bx = (((k * 170 + G.time * 6 - cam.x * .3) % span) + span) % span - 100;
      ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx + 46, 0); ctx.lineTo(bx - 64, VH); ctx.lineTo(bx - 130, VH); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  if (!G.VIGNETTE) { G.VIGNETTE = ctx.createRadialGradient(VW / 2, VH / 2, VH * .45, VW / 2, VH / 2, VW * .62); G.VIGNETTE.addColorStop(0, 'rgba(10,25,15,0)'); G.VIGNETTE.addColorStop(1, 'rgba(10,25,15,.38)'); }
  ctx.fillStyle = G.VIGNETTE; ctx.fillRect(0, 0, VW, VH);
}


export function drawConfetti() { for (const p of G.parts) if (p.t === 'conf') { ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), 3, ((G.time * 8 + p.ph) | 0) % 2 ? 3 : 1); } }


export function drawFlag(x, y) {
  ctx.fillStyle = '#d8c4a8'; ctx.fillRect(x, y, 1, 10);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { ctx.fillStyle = (r + c) & 1 ? '#222' : '#fff'; ctx.fillRect(x + 1 + c * 2, y + r * 2, 2, 2); }
}


function drawCrossings(R) {
  const blink = ((G.time * 3) | 0) % 2;
  for (const cr of R.cross) {
    const p = G.T.path[cr.i], tg = G.T.tan[cr.i], nm = G.T.nrm[cr.i];
    for (const s of [-1, 1]) {
      const bx = p.x + tg.x * s * 30 + nm.x * s * (HALF + 7), by = p.y + tg.y * s * 30 + nm.y * s * (HALF + 7);
      const act = cr.x === R.x, sig = R.signal && act, len = 5 + (2 * HALF + 4) * (act ? R.gate : 0);
      for (const pass of [0, 1]) for (let k = 0; k < len; k++) {
        const x = Math.round(bx - nm.x * s * k), y = Math.round(by - nm.y * s * k);
        ctx.fillStyle = pass ? ((k >> 2) & 1 ? '#ffffff' : '#e53935') : '#1b120c';
        ctx.fillRect(x - 1 - (pass ? 0 : 1), y - 1 - (pass ? 0 : 1), pass ? 3 : 5, pass ? 3 : 5);
      }
      const px = Math.round(bx), py = Math.round(by);
      ctx.fillStyle = '#1b120c'; ctx.fillRect(px - 4, py - 4, 9, 9);
      ctx.fillStyle = '#555555'; ctx.fillRect(px - 3, py - 3, 7, 7);
      ctx.fillStyle = sig && blink ? '#ff2d2d' : '#5a1010'; ctx.fillRect(px - 3, py - 3, 3, 3);
      ctx.fillStyle = sig && !blink ? '#ff2d2d' : '#5a1010'; ctx.fillRect(px + 1, py + 1, 3, 3);
      if (sig) { ctx.globalAlpha = .35; disc(px + (blink ? -2 : 2), py + (blink ? -2 : 2), 5, '#ff4040'); ctx.globalAlpha = 1; }
    }
  }  // the switch stand (Weiche) between the two lines: the lever points to the line the next train will take, the lamp over it is green
  if (R.lines.length > 1) {
    const sx = Math.round((R.lines[0] + R.lines[1]) / 2), sy = 36, a = Math.round(R.sw * 14);
    ctx.fillStyle = '#1b120c'; ctx.fillRect(sx - 14, sy - 7, 29, 15); ctx.fillStyle = '#6b6f78'; ctx.fillRect(sx - 13, sy - 6, 27, 13); ctx.fillStyle = '#8d939d'; ctx.fillRect(sx - 13, sy - 6, 27, 2);
    ctx.fillStyle = '#1b120c'; ctx.fillRect(Math.min(sx, sx + a) - 1, sy - 1, Math.abs(a) + 3, 5); ctx.fillStyle = '#ffd23f'; ctx.fillRect(Math.min(sx, sx + a), sy, Math.abs(a) + 1, 3);
    ctx.fillStyle = R.sw < 0 ? '#5fe36a' : '#7a1c1c'; ctx.fillRect(sx - 11, sy - 4, 4, 4); ctx.fillStyle = R.sw > 0 ? '#5fe36a' : '#7a1c1c'; ctx.fillRect(sx + 8, sy - 4, 4, 4);
  }
}


function drawTrain(R) {
  const tr = R.train, x = R.x - 15, y = Math.round(tr.y);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 5, y + 6, 28, TRAIN.LEN);
  if (tr.dir > 0) ctx.drawImage(TRAIN.c, x, y);
  else { ctx.save(); ctx.translate(x, y + TRAIN.LEN); ctx.scale(1, -1); ctx.drawImage(TRAIN.c, 0, 0); ctx.restore(); }
}


const MEDAL = ['#ffd23f', '#d9dde3', '#d98a4a', '#6fb3ff'], MEDAL_L = ['#fff08a', '#f4f6f8', '#f0b27a', '#a9d4ff'];


// the ghost of the best run (only when switched on); it waits on the grid during the countdown and parks at the line once it is done

function ghostPose() {
  if (!G.tt || !G.selGhost || G.kids || !G.tt.rec0) return null; // no ghosts in the kids mode
  const g = G.tt.rec0.g, len = (g.length / 4 - 1) * GHOST_DT, t = G.state === 'countdown' ? 0 : G.tt.t;
  return t > len + 2 ? null : ghostAt(g, t);
}


export function drawRace() {
  // the camera shakes after a jump (Matschfahrt) and a little on the kerbs (race circuit)
  const P = G.player, kerb = P && P.kerb && G.state === 'race' && Math.hypot(P.vx, P.vy) > 40 ? Math.round(Math.random()) : 0;
  const shake = G.T.run && G.run && G.run.shake > 0 ? Math.round((Math.random() - .5) * 20 * G.run.shake) : G.jumpShake > 0 ? Math.round((Math.random() - .5) * 14 * G.jumpShake) : kerb;
  const cx = clamp(Math.round(cam.x) + shake, 0, G.T.W - VW), cy = clamp(Math.round(cam.y) + shake, 0, G.T.H - VH), R = G.T.rail;
  ctx.drawImage(G.T.base, cx, cy, VW, VH, 0, 0, VW, VH);
  ctx.drawImage(trail, cx, cy, VW, VH, 0, 0, VW, VH);
  ctx.save(); ctx.translate(-cx, -cy);
  const wp = G.T.watPix, k = Math.floor(G.time * 3);
  if (wp.length) for (let j = 0; j < 40; j++) { const p = wp[(hash(j, k, 77) * wp.length) | 0]; ctx.fillStyle = j % 2 ? '#e8f7ff' : '#9fd6ff'; ctx.fillRect(p % G.T.W, (p / G.T.W) | 0, 1, 1); }
  const cp = G.T.cemPix; if (cp && cp.length) for (let j = 0; j < 6; j++) { const p = cp[(hash(j, k, 78) * cp.length) | 0]; ctx.fillStyle = '#d4d8dc'; ctx.fillRect(p % G.T.W, (p / G.T.W) | 0, 1, 1); }
  if (G.T.shoreY) drawBeach(cx);
  drawCritters();
  drawEventsGround();
  const sp = G.T.starPix; if (sp.length) for (let j = 0; j < 30; j++) { const p = sp[(hash(j, Math.floor(G.time * 2), 91) * sp.length) | 0], x = p % G.T.W, y = (p / G.T.W) | 0; ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
  if (G.T.ring) drawRingGround();
  if (G.T.desert) drawDesertGround();
  if (G.T.ice) drawIceGround();
  if (G.T.volcano) drawVolcanoGround();
  if (G.T.jungle) drawJungleGround();
  const gh = ghostPose(), drawGhost = () => {
    const F = carSet(G.player.def, G.T.th.goo);
    ctx.globalAlpha = .45; ctx.drawImage(F.frames[Math.round(gh.dirt * 5)][rotIndex(gh.ang)], Math.round(gh.x) - SS / 2, Math.round(gh.y) - SS / 2); ctx.globalAlpha = 1;
  };
  // the bridge of the race circuit: first the cars on the road below, then the bridge, then the cars up on it
  const deck = G.T.ring && G.T.ring.deck, ghUp = gh && deck && ghostUp(gh);
  if (gh && !ghUp) drawGhost();
  const order = [...G.cars].sort((a, b) => a.y - b.y);
  for (const c of order) if (!deck || c.lvl !== 1) drawCar(c);
  if (deck) { ctx.drawImage(deck.c, deck.x, deck.y); if (ghUp) drawGhost(); for (const c of order) if (c.lvl === 1) drawCar(c); }
  if (R && R.train.phase === 'run') drawTrain(R);
  drawParticles();
  drawSmoke();
  ctx.drawImage(G.T.top, cx, cy, VW, VH, cx, cy, VW, VH);
  if (R) drawCrossings(R);
  drawWindmill();
  const dark = G.T.th.dark;
  if (!dark) drawFlyers();
  for (const c of G.cars) {
    if (c.honk > 0 && c.def.siren) {
      const f = ((G.time * 8) | 0) % 2, n = { x: -Math.sin(c.ang), y: Math.cos(c.ang) }, s = f ? 9 : -9;
      ctx.globalAlpha = .55; disc(Math.round(c.x + n.x * s), Math.round(c.y + n.y * s), 5, f ? '#3d7bff' : '#9cc3ff'); ctx.globalAlpha = 1;
    }
    if (c.stun > 0) for (let q = 0; q < 3; q++) { const a = G.time * 6 + q * TAU / 3; star(Math.round(c.x + Math.cos(a) * 13) - 3, Math.round(c.y - 22 + Math.sin(a) * 4) - 3, true); }
  }
  const px = Math.round(G.player.x), py = Math.round(G.player.y);
  // no arrow back to the road on the stepping stones and on a second way (rope bridge, frozen lake)
  const pj = clamp(py, 0, G.T.H - 1) * G.T.W + clamp(px, 0, G.T.W - 1);
  if (!G.T.run && G.state === 'race' && G.player.off > HALF + 20 && !G.player.pit && !(G.T.stone && G.T.stone[pj]) && !(G.T.alt && G.T.alt[pj]) && !(G.player.fall > 0) && !(G.player.z > 0) && ((G.time * 3) | 0) % 2 === 0) {
    const p = G.T.path[(G.player.idx + 14) % G.T.N], a = Math.atan2(p.y - G.player.y, p.x - G.player.x);
    ctx.save(); ctx.translate(px + Math.cos(a) * 28, py + Math.sin(a) * 28); ctx.rotate(a);
    ctx.fillStyle = '#1b120c'; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -10); ctx.lineTo(-3, 0); ctx.lineTo(-7, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  drawEventsAbove();
  if (G.T.ring) drawRingAbove();
  if (G.T.desert) drawDesertAbove(cx, cy);
  if (G.T.ice) drawIceAbove();
  if (G.T.volcano) drawVolcanoAbove();
  if (G.T.jungle) drawJungleAbove();
  ctx.restore();
  if (dark) { drawNight(cx, cy); ctx.save(); ctx.translate(-cx, -cy); drawFlyers(); ctx.restore(); }
  drawRain();
  if (G.T.desert) drawStorm(cx, cy);
  if (G.T.ice) drawIceSky(cx, cy);
  if (G.T.volcano) drawVolcanoSky(cx, cy);
  if (G.T.jungle) drawJungleSky(cx, cy);
  drawMood();
  // the 1P sign floats over your car the whole race, above night, storm and snow, so you find yourself among dirty (or snowed-in) cars;
  // at the start it bounces higher
  if (!(G.player.fall > 0)) {
    const hop = G.state === 'countdown' || (G.state === 'race' && G.stateTime < 2.5) ? Math.abs(Math.sin(G.time * 7)) * 6 : Math.abs(Math.sin(G.time * 3)) * 2;
    drawTag(px - cx, py - cy - 17 - Math.round((G.player.z || 0) * .6 + hop));
  }
  // HUD
  if (G.T.run) drawRunHud(); else {
  ctx.fillStyle = 'rgba(27,18,12,.6)'; ctx.fillRect(0, 0, VW, 15);
  drawFlag(31, 2);
  text('RUNDE ' + clamp(G.player.lap, 1, LAPS) + '/' + LAPS, 44, 4, 8, '#fff3dc');
  const pl = G.player.finished ? G.player.place : placeOf(G.player);
  if (G.tt) {
    text(fmtTime(G.tt.t), VW / 2 - 20, 4, 8, '#ffffff', 'center');
    text('BEST ' + (G.tt.rec0 ? fmtTime(G.tt.rec0.t) : '-:--.--'), VW - 6, 4, 8, '#ffd23f', 'right');
    if (G.tt.deltaT > 0 && G.tt.delta !== null) text(fmtDelta(G.tt.delta), VW / 2 - 20, 19, 8, G.tt.delta <= 0 ? '#7bd37b' : '#ff6b6b', 'center');
  } else {
    // place in the middle (word and medal as one group), the cup and race number on the right
    const px = VW / 2 - 29;
    text('PLATZ', px, 4, 8, '#fff3dc');
    disc(px + 52, 7, 6, '#1b120c'); disc(px + 52, 7, 5, medal(pl));
    text(String(pl), px + 53, 4, 8, '#1b120c', 'center', null);
    if (G.mode === 'gp') text((G.gp.cup.label || G.gp.cup.name + ' CUP') + ' ' + (G.gp.race + 1) + '/' + G.gp.tracks.length, VW - 6, 4, 8, '#ffd23f', 'right');
  }
  }
  // train warning: big stop sign while the lights flash and a crossing is ahead
  if (R && R.signal && G.state === 'race' && !G.player.stun) {
    const d = crossingAhead(G.player);
    if (d > 6 && d < 110 && ((G.time * 4) | 0) % 2 === 0) {
      const sx = VW / 2, sy = 44;
      disc(sx, sy, 19, '#1b120c'); disc(sx, sy, 18, '#ffffff'); disc(sx, sy, 15, '#d62828');
      text('STOP', sx + 1, sy - 4, 8, '#ffffff', 'center', null);
      text('ZUG KOMMT!', sx, sy + 24, 8, '#ffd23f', 'center');
    }
  }
  // countdown
  if (G.T.th.lights && (G.state === 'countdown' || (G.state === 'race' && G.stateTime < .9))) {
    drawStartLights();
    if (G.state === 'race') text('LOS!', VW / 2, VH / 2 - 20, 40, '#7bd37b', 'center');
  } else if (G.state === 'countdown') {
    const n = 3 - Math.floor(G.stateTime), f = G.stateTime % 1, sz = f < .15 ? 48 : 40;
    ell(VW / 2, VH / 2, 42, 32, 'rgba(27,18,12,.55)');
    text(String(n), VW / 2 + 2, VH / 2 - sz / 2, sz, ['#7bd37b', '#ffd23f', '#ff5a5a'][n - 1], 'center');
  } else if (G.state === 'race' && G.stateTime < .9) {
    text('LOS!', VW / 2, VH / 2 - 20, 40, '#7bd37b', 'center');
  }
  if (G.state === 'finish') { if (G.T.run) drawRunFinish(); else drawFinish(); }
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


function drawFinish() {
  if (G.stateTime < .6) { text('ZIEL!', VW / 2, VH / 2 - 20, 40, '#ffd23f', 'center'); drawConfetti(); return; }
  ctx.fillStyle = 'rgba(27,18,12,.5)'; ctx.fillRect(0, 0, VW, VH);
  const w = 240, h = 222, x = VW / 2 - w / 2, y = 24;
  panel(x, y, w, h);
  if (G.tt) {
    const fast = Math.min(...G.tt.laps);
    text(G.tt.newBest ? 'NEUER REKORD!' : 'GESCHAFFT!', VW / 2, y + 12 + Math.round(Math.sin(G.time * 6) * 2), 16, G.tt.newBest ? '#ffd23f' : '#ffffff', 'center');
    text(fmtTime(G.tt.total), VW / 2, y + 40, 16, '#ffffff', 'center');
    text(G.tt.diff === null ? 'ERSTE BESTZEIT' : fmtDelta(G.tt.diff) + ' ZUR BESTZEIT', VW / 2, y + 64, 8, G.tt.diff === null || G.tt.diff < 0 ? '#7bd37b' : '#ff6b6b', 'center');
    G.tt.laps.forEach((l, i) => {
      text('RUNDE ' + (i + 1), x + 28, y + 84 + i * 14, 8, '#d8c4a8');
      text(fmtTime(l), x + w - 28, y + 84 + i * 14, 8, l === fast ? '#7bd37b' : '#fff3dc', 'right');
    });
    ctx.drawImage(G.player.F.frames[Math.min(5, Math.round(G.player.dirt * 5))][0], VW / 2 - 28, y + 130, 56, 56);
    if (G.stateTime > 2) { text('ENTER: NOCHMAL', VW / 2, y + 192, 8, blink() ? '#ffd23f' : '#d8c4a8', 'center'); text('ESC: MENUE', VW / 2, y + 206, 8, '#d8c4a8', 'center'); }
    if (G.tt.newBest) drawConfetti();
    return;
  }
  const pl = G.player.place;
  text(pl === 1 ? 'GEWONNEN!' : 'SUPER!', VW / 2, y + 14 + Math.round(Math.sin(G.time * 6) * 2), 16, '#ffd23f', 'center');
  ctx.fillStyle = '#d62828'; ctx.fillRect(VW / 2 - 13, y + 40, 10, 24); ctx.fillStyle = '#1f5fd1'; ctx.fillRect(VW / 2 + 3, y + 40, 10, 24);
  disc(VW / 2, y + 80, 22, '#1b120c'); disc(VW / 2, y + 80, 20, medal(pl)); disc(VW / 2, y + 79, 14, medalL(pl));
  text(String(pl), VW / 2 + 1, y + 72, 16, '#1b120c', 'center', null);
  text(G.mode === 'gp' ? 'PLATZ ' + pl + '  +' + G.player.entry.last + ' PUNKTE' : 'PLATZ ' + pl, VW / 2, y + 110, 8, '#fff3dc', 'center');
  ctx.drawImage(G.player.F.frames[Math.min(5, Math.round(G.player.dirt * 5))][0], VW / 2 - 44, y + 116, 88, 88);
  if (G.stateTime > 2 && blink()) text('TASTE DRUECKEN', VW / 2, y + 204, 8, '#d8c4a8', 'center');
  drawConfetti();
}
