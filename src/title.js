import { G } from './g.js';
import { FONT, TAU, VW, clamp, ctx, hash, mk, rng, vnoise } from './core.js';
import { R1, blink, disc, ell, text } from './draw.js';

// ---------- title screen: a big race car splashing through mud puddles, forever ----------

const TS = { art: null, ready: false, ink: [0, 0], dirt: 0, wheel: 0, spray: [], flecks: [], spots: [], stars: [], last: 0 };


{
  const r = rng(77), MC = ['#4b301a', '#5a3a1f', '#7d5a36', '#3b2512'];
  for (let i = 0; i < 70; i++) TS.flecks.push({ x: r() * VW, y: 208 + r() * 62, s: r() < .3 ? 3 : 2, c: MC[(r() * 3) | 0] });
  for (let i = 0; i < 56; i++) TS.spots.push({ x: 6 + r() * 82, y: 27 - r() * r() * 14, s: 1 + ((r() * 3) | 0), c: MC[(r() * 4) | 0] });
  for (let i = 0; i < 34; i++) TS.stars.push({ x: r() * VW, y: r() * 120, p: r() * 6 });
}


function makeArt(ready, px) {
  const W = VW, H = 78, c = mk(W, H), g = c.getContext('2d'), lay = mk(W, H), l = lay.getContext('2d'), r = rng(5);
  const word = 'MUDRACER', X = W / 2, Y = 12, font = px + 'px ' + FONT;
  for (const cx of [g, l]) { cx.textBaseline = 'top'; cx.textAlign = 'center'; cx.font = font; }
  g.fillStyle = '#0d0804'; g.fillText(word, X + 4, Y + 5);
  g.fillStyle = '#1b120c'; for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, -2], [-2, 2], [2, 2]]) g.fillText(word, X + dx, Y + dy);
  l.fillStyle = '#ffd23f'; l.fillText(word, X, Y);
  // where the letters really are, so the mud can sit on their lower half whatever the font metrics are
  const a = l.getImageData(0, 0, W, H).data; let y0 = H, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (a[(y * W + x) * 4 + 3]) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (y1 <= y0) { y0 = Y; y1 = Y + 36; }
  const h = y1 - y0;
  l.globalCompositeOperation = 'source-atop';
  l.fillStyle = '#fff08a'; l.fillRect(0, y0, W, 5);
  l.fillStyle = '#e0a416'; l.fillRect(0, y0 + h * .3, W, 3);
  const MUD = ['#5a3a1f', '#4b301a', '#664327'];
  const edge = x => y0 + h * .46 + (vnoise(x / 11, 3, 9) - .5) * h * .4 + Math.sin(x * .05) * 3;
  for (let x = 0; x < W; x += 2) {
    const e = Math.round(edge(x));
    l.fillStyle = '#3b2512'; l.fillRect(x, e - 1, 2, 1);
    l.fillStyle = MUD[(hash(x, 1, 3) * 3) | 0]; l.fillRect(x, e, 2, y1 + 2 - e);
    l.fillStyle = '#8a6440'; l.fillRect(x, e + 1, 2, 1);
  }
  for (let i = 0; i < 90; i++) { const x = r() * W | 0, y = edge(x) + 3 + r() * (y1 - edge(x)); l.fillStyle = r() < .5 ? '#7d5a36' : '#3b2512'; l.fillRect(x, y | 0, 2, 1); }
  for (let i = 0; i < 16; i++) {
    const bx = 24 + r() * (W - 48) | 0, by = (y0 + 2 + r() * (edge(bx) - y0 - 4)) | 0, br = 2 + (r() * 3 | 0);
    for (let dy = -br; dy <= br; dy++) { const w = Math.floor(Math.sqrt(br * br - dy * dy + br * .6)); l.fillStyle = dy < -br / 2 ? '#7d5a36' : '#4b301a'; l.fillRect(bx - w, by + dy, w * 2 + 1, 1); }
  }
  g.drawImage(lay, 0, 0);
  return { c, ink: [y0, y1] };
}


function buildTitleArt(ready) { const a = makeArt(ready, 40); TS.art = a.c; TS.ready = ready; TS.ink = a.ink; }

// the same logo (yellow letters, dark outline, mud on the lower half, dripping) for the main menu, a bit smaller; y = top of the letters
const ML = { art: null, ready: false, ink: [0, 0] };

export function drawMenuLogo(y) {
  const ready = !document.fonts || document.fonts.check('16px "Press Start 2P"');
  if (!ML.art || (ready && !ML.ready)) { const a = makeArt(ready, 32); ML.art = a.c; ML.ready = ready; ML.ink = a.ink; }
  ctx.drawImage(ML.art, 0, y - ML.ink[0]);
  const bx = VW / 2 - 128, by = y + ML.ink[1] - ML.ink[0];
  for (let i = 0; i < 8; i++) {
    const len = 2 + Math.round((Math.sin(G.time * 1.7 + i * 1.9) * .5 + .5) * 8), dx = bx + i * 32 + 7 + (i * 7) % 11;
    R1(dx, by, 3, len, '#4b301a'); R1(dx, by, 1, len, '#7d5a36'); R1(dx - 1, by + len, 5, 3, '#4b301a'); R1(dx, by + len, 2, 1, '#7d5a36');
  }
}


function drawTitleCar(ox, oy, wa, dirt) {
  const U = 3, O = '#1b120c', RED = '#d62828', RL = '#ff5a4a', RD = '#8f1717', GL = '#8fd3f4';
  const P = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(ox + x * U), Math.round(oy + y * U), w * U, h * U); };
  const D = (cx, cy, rad, col) => { ctx.fillStyle = col; for (let dy = -rad; dy <= rad; dy++) { const w = Math.floor(Math.sqrt(rad * rad - dy * dy + rad * .8)); ctx.fillRect(Math.round(ox + (cx - w) * U), Math.round(oy + (cy + dy) * U), (w * 2 + 1) * U, U); } };
  // rear wing
  P(0, 4, 2, 7, O); P(1, 5, 1, 5, RED); P(1, 5, 18, 4, O); P(2, 6, 16, 2, '#2b2b33'); P(2, 6, 16, 1, '#6a6a80');
  P(5, 9, 3, 8, O); P(6, 9, 1, 8, '#2b2b33'); P(14, 9, 3, 8, O); P(15, 9, 1, 8, '#2b2b33');
  // body, nose and hood
  P(3, 15, 88, 13, O); P(4, 16, 86, 11, RED); P(4, 16, 86, 1, RL); P(4, 26, 86, 1, RD);
  P(57, 12, 29, 5, O); P(58, 13, 27, 4, RED); P(58, 13, 27, 1, RL);
  P(84, 18, 8, 9, O); P(85, 19, 6, 7, RED);
  // cabin: widens downwards into the windscreen
  for (let y = 5; y <= 15; y++) { const l = 34 - Math.max(0, y - 8), rr = 54 + Math.round(Math.max(0, y - 8) * 1.4); P(l - 1, y, rr - l + 2, 1, O); }
  for (let y = 6; y <= 15; y++) { const l = 34 - Math.max(0, y - 8), rr = 54 + Math.round(Math.max(0, y - 8) * 1.4); P(l, y, rr - l, 1, y < 9 ? RL : RED); }
  for (let y = 9; y <= 14; y++) { const l = 34 - Math.max(0, y - 8), rr = 54 + Math.round(Math.max(0, y - 8) * 1.4); P(l + 2, y, rr - l - 4, 1, y > 12 ? '#3b7ea8' : GL); }
  P(43, 9, 1, 6, RED); P(36, 10, 1, 3, '#e6f8ff');
  D(49, 12, 3, '#ffffff'); P(49, 11, 3, 2, '#222222');
  // livery
  P(5, 20, 84, 2, '#fff4e0'); P(30, 17, 1, 9, RD); P(58, 17, 1, 9, RD); P(14, 26, 60, 1, '#6e0f0f');
  D(44, 21, 5, '#ffffff'); P(42, 19, 5, 1, O); P(46, 20, 1, 1, O); P(45, 21, 1, 1, O); P(44, 22, 1, 3, O);
  P(86, 18, 5, 3, '#fff7c2'); P(88, 19, 2, 1, '#ffe14d'); P(3, 17, 2, 3, '#ff3b3b');
  P(82, 27, 14, 2, O); P(84, 27, 10, 1, '#444444'); P(0, 23, 5, 2, '#777777'); P(0, 23, 1, 2, '#333333');
  // wheels
  for (const cx of [20, 68]) {
    D(cx, 22, 9, '#241010'); D(cx, 22, 8, '#1e1e1e'); D(cx, 22, 5, '#c9ced6'); D(cx, 22, 4, '#8e96a3');
    for (let s = 0; s < 12; s++) { const a = wa + s * TAU / 12; P(Math.round(cx + Math.cos(a) * 7.2), Math.round(22 + Math.sin(a) * 7.2), 1, 1, '#3d3d3d'); }
    for (let s = 0; s < 5; s++) { const a = wa + s * TAU / 5; for (let t = 1; t <= 4; t++) P(Math.round(cx + Math.cos(a) * t), Math.round(22 + Math.sin(a) * t), 1, 1, '#eef2f7'); }
    D(cx, 22, 1, O);
    if (dirt > .15) for (let dx = -7; dx <= 7; dx++) P(cx + dx, 22 + Math.round(Math.sqrt(64 - dx * dx)) - 1 - (hash(dx, cx, 4) < dirt ? 1 : 0), 1, 1 + (hash(dx, cx, 5) < dirt ? 1 : 0), '#6b4a2b');
  }
  // mud thrown up on the paint
  const n = Math.round(dirt * TS.spots.length);
  for (let i = 0; i < n; i++) { const s = TS.spots[i]; P(s.x, s.y, s.s, s.s, s.c); }
}


export function drawTitleScreen() {
  const dt = clamp(G.time - TS.last, 0, .05); TS.last = G.time;
  const ready = !document.fonts || document.fonts.check('16px "Press Start 2P"');
  if (!TS.art || (ready && !TS.ready)) buildTitleArt(ready);
  const GY = 236, SPD = 210, w = G.time * SPD;
  // sky
  ['#2a1d4a', '#3b2a62', '#55346e', '#7a3f78', '#a64c78', '#cf5f6e', '#ee7d62', '#ff9f58', '#ffc070'].forEach((c, i) => R1(0, i * 23, VW, 24, c));
  for (const s of TS.stars) if (((G.time * 1.5 + s.p) | 0) % 3) R1(s.x | 0, s.y | 0, 1, 1, '#fff3dc');
  disc(352, 198, 34, '#ffd27a'); disc(352, 198, 30, '#ffe9a8');
  // hills
  for (let x = 0; x < VW; x += 3) {
    const hf = 150 + Math.sin((x + w * .06) * .012) * 16 + Math.sin((x + w * .06) * .031 + 1) * 7;
    R1(x, hf | 0, 3, 205 - (hf | 0), '#5a3560');
    const hn = 170 + Math.sin((x + w * .16) * .02 + 2) * 12 + Math.sin((x + w * .16) * .053) * 5;
    R1(x, hn | 0, 3, 205 - (hn | 0), '#3a2236');
  }
  // ground
  R1(0, 205, VW, 10, '#6b4a2b'); R1(0, 215, VW, 28, '#5a3a1f'); R1(0, 243, VW, 27, '#4b301a'); R1(0, 205, VW, 1, '#8a6440');
  for (const f of TS.flecks) { const k = .5 + (f.y - 205) / 65 * 1.4, x = (((f.x - w * k) % (VW + 8)) + VW + 8) % (VW + 8) - 4; R1(x | 0, f.y | 0, f.s, 1, f.c); }
  for (let i = 0; i < 7; i++) { const x = (((i * 83 - w * 1.9) % (VW + 120)) + VW + 120) % (VW + 120) - 60; R1(x | 0, 222 + i * 6, 34 + (i % 3) * 14, 1, 'rgba(255,233,168,.18)'); }
  // puddles in the car's lane
  const PU = [[0, 70], [300, 56], [560, 90], [820, 62]], PER = 1000, lane = [];
  for (const [o, rx] of PU) {
    const x = (((o - w) % PER) + PER) % PER - 300;
    if (x + rx < -10 || x - rx > VW + 10) continue;
    lane.push([x, rx]);
    ell(x | 0, GY + 2, rx + 2, 9, '#3b2512'); ell(x | 0, GY + 2, rx, 7, '#5a3a1f'); ell((x - rx * .25) | 0, GY, rx * .55 | 0, 3, '#6b4626');
    R1((x + rx * .3) | 0, GY - 1, 8, 1, '#8a6440');
  }
  // the car: wheels dip into puddles, mud flies and sticks
  const ox = 107, wx = [ox + 20 * 3, ox + 68 * 3];
  const inP = wx.map(x => lane.some(([px, rx]) => Math.abs(x - px) < rx * .92));
  const any = inP[0] || inP[1];
  TS.dirt = any ? Math.min(1, TS.dirt + .3 * dt) : Math.max(0, TS.dirt - .06 * dt);
  TS.wheel += dt * SPD / 24;
  inP.forEach((on, k) => { if (on) for (let n = 0, cnt = dt * 110 + Math.random(); n < cnt && TS.spray.length < 420; n++) {
    const cl = ['#4a2f18', '#5a3a1f', '#6b4626', '#7d5a36'][(Math.random() * 4) | 0];
    TS.spray.push({ x: wx[k] + (Math.random() - .5) * 26, y: GY - 6, vx: (Math.random() - .75) * 150, vy: -(60 + Math.random() * 190), s: Math.random() < .3 ? 4 : 3, c: cl });
  } });
  for (let i = TS.spray.length - 1; i >= 0; i--) { const p = TS.spray[i]; p.vy += 560 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.y > GY + 6) TS.spray.splice(i, 1); }
  const bob = Math.round(Math.sin(G.time * 17) * 1) + (any ? Math.round(Math.sin(G.time * 31)) : 0);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(ox + 12, GY + 3, 270, 5);
  drawTitleCar(ox, GY - 90 + bob, TS.wheel, TS.dirt);
  for (const p of TS.spray) { ctx.fillStyle = p.c; ctx.fillRect(p.x | 0, p.y | 0, p.s, p.s); }
  // big puddles rushing past in the foreground
  for (const [o, rx, ry] of [[200, 110, 11], [820, 150, 13]]) {
    const x = (((o - w * 1.7) % 1250) + 1250) % 1250 - 330;
    if (x + rx < 0 || x - rx > VW) continue;
    ell(x | 0, 262, rx + 3, ry + 3, '#2c1a0c'); ell(x | 0, 262, rx, ry, '#4b301a'); ell((x - rx * .3) | 0, 260, rx * .5 | 0, 4, '#5f3f22'); R1((x + rx * .2) | 0, 257, 12, 1, '#7d5a36');
  }
  // title and prompt
  const ty = 22 + Math.round(Math.sin(G.time * 2) * 1.5);
  ctx.drawImage(TS.art, 0, ty);
  const bx = VW / 2 - 160, by = ty + TS.ink[1];
  for (let i = 0; i < 8; i++) {
    const len = 3 + Math.round((Math.sin(G.time * 1.7 + i * 1.9) * .5 + .5) * 9), dx = bx + i * 40 + 9 + (i * 7) % 15;
    R1(dx, by, 4, len, '#4b301a'); R1(dx, by, 1, len, '#7d5a36'); R1(dx - 1, by + len, 6, 3, '#4b301a'); R1(dx, by + len, 2, 1, '#7d5a36');
  }
  if (blink(1.4)) text('BELIEBIGE TASTE DRUECKEN', VW / 2, ty + TS.ink[1] + 36, 16, '#fff3dc', 'center');
}
