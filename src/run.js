import { G } from './g.js';
import { AU, SFX } from './audio.js';
import { CAR_DEFS } from './cars.js';
import { TAU, VH, VW, clamp, ctx, hash, hex, outlineImg, rng, toCanvas, vnoise } from './core.js';
import { R1, blink, disc, drawConfetti, drawFlag, panel, text } from './draw.js';
import { setState } from './menus.js';
import { addP, mudBurst, splash } from './particles.js';
import { makeCar, moveCamera, resetWorld } from './race.js';
import { THEMES } from './tracks.js';

// ---------- Matschfahrt: one long off-road course driven upwards ----------

const RUN_W = 480, RUN_H = 6400, RUN_HALF = 96;


function buildRun() {
  const W = RUN_W, H = RUN_H, A = W * H, sd = 4242, r = rng(sd), th = THEMES.gelaende;
  const roadX = y => 240 + Math.sin(y / 700) * 36 + Math.sin(y / 260) * 10;
  const startY = H - 300, finishY = 300;
  const ter = new Uint8Array(A), dx0 = new Float32Array(A);
  for (let y = 0; y < H; y++) { const cx = roadX(y); for (let x = 0; x < W; x++) { const j = y * W + x, dd = x + .5 - cx; dx0[j] = dd; ter[j] = Math.abs(dd) < RUN_HALF ? 1 : 0; } }
  // obstacles: hills with a puddle to land in, big mud holes, big puddles, and side-by-side pairs
  const hills = [], feats = [];
  for (let y = startY - 260; y > finishY + 260;) {
    const k = r(), cx = roadX(y);
    if (k < .4) {
      hills.push({ x: cx + (r() - .5) * 30, y, rx: 70 + r() * 20, ry: 22 });
      const ly = y - 118 - r() * 24; feats.push({ x: roadX(ly) + (r() - .5) * 40, y: ly, rx: 72 + r() * 22, ry: 36 + r() * 10, type: r() < .5 ? 3 : 2 });
      y -= 270 + r() * 80;
    } else if (k < .62) { feats.push({ x: cx + (r() - .5) * 50, y, rx: 86 + r() * 24, ry: 36 + r() * 16, type: 2 }); y -= 190 + r() * 80; }
    else if (k < .84) { feats.push({ x: cx + (r() - .5) * 50, y, rx: 86 + r() * 24, ry: 36 + r() * 16, type: 3 }); y -= 190 + r() * 80; }
    else { feats.push({ x: cx - 46, y, rx: 46, ry: 30, type: 2 }); feats.push({ x: cx + 46, y: y - 24, rx: 46, ry: 30, type: 3 }); y -= 220 + r() * 60; }
  }
  const blob = (f, type, noisy) => {
    const R = Math.ceil(Math.max(f.rx, f.ry) * 1.25) + 2;
    for (let y = Math.max(0, Math.floor(f.y - R)); y <= Math.min(H - 1, f.y + R); y++) for (let x = Math.max(0, Math.floor(f.x - R)); x <= Math.min(W - 1, f.x + R); x++) {
      const j = y * W + x; if (Math.abs(dx0[j]) > RUN_HALF + 10) continue;
      if (((x + .5 - f.x) / f.rx) ** 2 + ((y + .5 - f.y) / f.ry) ** 2 < (noisy ? .8 + .4 * vnoise(x * .1, y * .1, sd + type) : 1)) ter[j] = type;
    }
  };
  feats.forEach(f => blob(f, f.type, true));
  hills.forEach(h => blob(h, 5, false));
  const shore = new Uint8Array(A);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (ter[y * W + x] !== 3) continue;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (dx * dx + dy * dy > 10) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const k = yy * W + xx; if (ter[k] !== 3) shore[k] = 1;
    }
  }
  const ed = (x, y, type, mr) => {
    for (let rr = 1; rr <= mr; rr++) for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      if (ter[yy * W + xx] !== type) return rr;
    }
    return mr + 1;
  };
  const img = new ImageData(W, H), d = img.data;
  const set = (j, c) => { d[j * 4] = c[0]; d[j * 4 + 1] = c[1]; d[j * 4 + 2] = c[2]; d[j * 4 + 3] = 255; };
  const G = th.grass.map(hex), TRK = th.track.map(hex), TE = hex(th.trackEdge), GE = hex(th.grassEdge), TU = hex(th.tuft);
  const MUD = th.mud.map(hex), MUDE = hex(th.mudEdge), MUDH = hex(th.mudHi), WAT = th.water.map(hex), SHORE = th.shore.map(hex);
  const RUT = hex('#8f6a44'), MID = [hex('#8a9a4a'), hex('#7a8a3e')], HILL = ['#f0d8a8', '#dcb885', '#c79d68', '#a07a4c'].map(hex), CHEV = hex('#ffe066');
  const mudPix = [], watPix = [], hillOf = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = y * W + x, t = ter[j], nv = vnoise(x / 9, y / 9, sd), h = hash(x, y, sd), ddx = dx0[j], ad = Math.abs(ddx);
    let col;
    if (t === 3) { watPix.push(j); const e = ed(x, y, 3, 4); col = e === 1 ? WAT[0] : e <= 3 ? WAT[1] : nv > .55 ? WAT[3] : WAT[2]; }
    else if (shore[j]) col = SHORE[h < .5 ? 0 : 1];
    else if (t === 2) { const e = ed(x, y, 2, 1); if (e === 1) col = MUDE; else { if (h < .3) mudPix.push(j); const v = nv * .6 + h * .4; col = v < .38 ? MUD[1] : v > .66 ? MUD[2] : MUD[0]; if (h < .025) col = MUDH; } }
    else if (t === 5) {
      let hh = null; for (const q of hills) if (Math.abs(y - q.y) <= q.ry + 1 && Math.abs(x - q.x) <= q.rx + 1) { hh = q; break; }
      const v = (y + .5 - hh.y) / hh.ry, ax = Math.abs(x + .5 - hh.x);
      col = Math.abs(v) < .1 ? HILL[0] : v < -.35 ? HILL[1] : v < .35 ? HILL[2] : HILL[3];
      if (ax < 26 && v > -.1 && ((y - hh.y + ax * .7 + 200) % 12) < 3) col = CHEV;
    } else if (t === 1) {
      const v = nv * .6 + h * .4; col = v < .35 ? TRK[1] : v > .68 ? TRK[2] : TRK[0];
      if (Math.abs(ad - 34) < 4 && h > .15) col = RUT;
      if (ad < 7) col = hash(x, y, sd + 1) < .45 ? MID[0] : MID[1];
      if (ad > RUN_HALF - 3) col = TE;
    } else {
      if (ad < RUN_HALF + 2.5) col = GE;
      else { const v = nv * .7 + h * .3; col = v < .38 ? G[1] : v > .66 ? G[2] : G[0]; if (h < .025 || hash(x, y + 1, sd) < .025) col = TU; }
    }
    set(j, col);
  }
  // start line and a checkered finish banner
  const checker = (yc, fnSet) => { for (let y = yc - 6; y < yc + 6; y++) { const cx = roadX(y); for (let x = Math.floor(cx - RUN_HALF); x < cx + RUN_HALF; x++) fnSet(x, y, ((Math.floor(x - cx + 200) >> 2) + (Math.floor(y - yc + 200) >> 2)) & 1 ? [245, 245, 240] : [34, 30, 28]); } };
  checker(startY, (x, y, c) => set(y * W + x, c));
  const tp = new Uint8ClampedArray(A * 4);
  const setT = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; tp[i] = c[0]; tp[i + 1] = c[1]; tp[i + 2] = c[2]; tp[i + 3] = 255; };
  checker(finishY, setT);
  for (const s of [-1, 1]) { const px0 = roadX(finishY) + s * (RUN_HALF + 8); for (let y = finishY - 8; y < finishY + 8; y++) for (let x = px0 - 3; x <= px0 + 3; x++) setT(x, y, Math.abs(x - px0) < 2 ? [217, 83, 79] : [140, 40, 40]); }
  // warning signs beside every hill
  for (const q of hills) for (const s of [-1, 1]) {
    const sx = Math.round(q.x + s * (q.rx + 8)), sy = Math.round(q.y);
    for (let k = 0; k < 7; k++) for (let w = -k; w <= k; w++) setT(sx + w, sy - 6 + k, k === 6 || Math.abs(w) === k ? [27, 18, 12] : [255, 210, 63]);
    setT(sx, sy - 3, [27, 18, 12]); setT(sx, sy - 2, [27, 18, 12]); setT(sx, sy, [27, 18, 12]);
  }
  // trees, flowers and rocks on the verges
  const C = th.treeCol.map(hex), trees = [];
  const darken = (x, y, rad) => { for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) { if (dx * dx + dy * dy > rad * rad) continue; const xx = x + dx + 5, yy = y + dy + 7; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const i = (yy * W + xx) * 4; d[i] *= .7; d[i + 1] *= .7; d[i + 2] *= .72; } };
  for (let y = 20; y < H - 20; y += 14) for (const s of [-1, 1]) {
    if (r() < .45) continue;
    const cx = roadX(y), x = Math.round(cx + s * (RUN_HALF + 26 + r() * (W / 2 - RUN_HALF - 30))), yy = y + Math.round((r() - .5) * 10);
    if (x < 10 || x > W - 10 || Math.abs(x - cx) < RUN_HALF + 22 || trees.some(o => Math.hypot(o.x - x, o.y - yy) < 24)) continue;
    trees.push({ x, y: yy, r: 9 }); darken(x, yy, 11);
    const pine = r() < .4, rot = r() * TAU;
    for (let dy = -14; dy <= 14; dy++) for (let dx = -14; dx <= 14; dx++) {
      const X = x + dx, Y = yy + dy;
      if (pine) {
        const dd = Math.hypot(dx, dy), an = Math.atan2(dy, dx), rad = 9 + 3 * Math.abs(Math.cos(an * 4 + rot)), inner = 5 + 2 * Math.abs(Math.cos(an * 4 + rot + Math.PI / 4));
        if (dd <= rad) setT(X, Y, dd < 2 ? [61, 145, 96] : dd < inner ? ((dx + dy) < 0 ? [61, 145, 96] : [39, 112, 72]) : ((dx + dy) < -2 ? [39, 112, 72] : [27, 87, 58]));
      } else {
        const dd = Math.hypot(dx, dy) + (vnoise(X * .45, Y * .45, 5) - .5) * 3.5; if (dd > 11.5) continue;
        const s2 = (dx + dy) / 11 + (vnoise(X * .5, Y * .5, 6) - .5) * .9;
        setT(X, Y, s2 < -.55 ? C[2] : s2 > .45 ? C[0] : C[1]);
      }
    }
  }
  const px = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H && ter[y * W + x] === 0 && Math.abs(dx0[y * W + x]) > RUN_HALF + 4) set(y * W + x, c); };
  const PET = ['#ff5a7a', '#ffe14d', '#ffffff', '#b36bff', '#5ab4ff'].map(hex);
  for (let k = 0; k < 1400; k++) { const x = r() * W | 0, y = r() * H | 0, pc = PET[(r() * 5) | 0]; px(x - 1, y, pc); px(x + 1, y, pc); px(x, y - 1, pc); px(x, y + 1, pc); px(x, y, hex('#ffe14d')); }
  for (let k = 0; k < 160; k++) { const x = r() * W | 0, y = r() * H | 0; px(x, y, hex('#c4c4bb')); px(x + 1, y, hex('#9a9a92')); px(x, y + 1, hex('#9a9a92')); px(x + 1, y + 1, hex('#6e6e68')); }
  const top = toCanvas(outlineImg(new ImageData(tp, W, H), W, H, C[3]));
  return { W, H, run: true, def: { name: 'MATSCHFAHRT', song: 'train' }, name: 'MATSCHFAHRT', th, path: [], tan: [], nrm: [], N: 1, ter, washMask: new Uint8Array(A),
    trees, critters: [], windmill: null, shoreY: null, base: toCanvas(img), top, mini: null, mudPix, watPix, starPix: [], rail: null, washC: null,
    hills, startY, finishY, roadX };
}


G.RUN = null;


export function startRun() {
  G.RUN = G.RUN || buildRun();
  G.T = G.RUN; resetWorld();
  const y = G.T.startY + 44, def = CAR_DEFS[G.selCar];
  G.cars = [makeCar(def, G.T.roadX(y), y, -Math.PI / 2, false, 1, { def, me: true })];
  G.player = G.cars[0];
  G.run = { jumps: 0, splashes: 0, muds: 0, shake: 0 };
  if (AU.E) AU.E.o1.type = G.player.def.id === 'traktor' ? 'square' : 'sawtooth';
  moveCamera(1, true);
  setState('countdown');
}

// airborne cars: take off over a hill crest, land with a thump, a splash or a mud bomb

export function updateJumps(c, dt) {
  if (G.run.shake > 0) G.run.shake -= dt;
  if (c.z > 0) {
    c.vz -= 380 * dt; c.z += c.vz * dt;
    if (c.z <= 0) {
      c.z = 0; G.run.shake = .3;
      const t = G.T.ter[clamp(c.y | 0, 0, G.T.H - 1) * G.T.W + clamp(c.x | 0, 0, G.T.W - 1)];
      if (t === 3) { splash(c.x, c.y, 40); addP({ t: 'ring', x: c.x, y: c.y, life: 1, ml: 1 }); SFX.splash(1.3); c.dirt = Math.max(0, c.dirt - .3); G.run.splashes++; }
      else if (t === 2) { mudBurst(c, 34); SFX.mud(1.3); c.dirt = Math.min(1, c.dirt + .3); G.run.muds++; }
      else { for (let i = 0; i < 12; i++) addP({ t: 'dust', x: c.x + (Math.random() - .5) * 30, y: c.y + (Math.random() - .5) * 16, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 20, life: .6, ml: .6 }); SFX.bump(); }
      c.surf = t;
    }
  } else if (G.T.hills) {
    for (const h of G.T.hills) if (c.prevY > h.y && c.y <= h.y && Math.abs(c.x - h.x) < h.rx * .95) {
      const sp = Math.hypot(c.vx, c.vy);
      if (sp > 40) { c.vz = 60 + sp * .55; c.z = .01; SFX.jump(); G.run.jumps++; }
    }
  }
  c.prevY = c.y;
}


export function drawRunHud() {
  ctx.fillStyle = 'rgba(27,18,12,.6)'; ctx.fillRect(0, 0, VW, 15);
  text('SPRUENGE ' + G.run.jumps, 32, 4, 8, '#fff3dc');
  text('PLATSCH ' + G.run.splashes, VW / 2, 4, 8, '#9fd6ff', 'center');
  text('MATSCH ' + G.run.muds, VW - 8, 4, 8, '#e0b080', 'right');
  // progress bar on the right: flag at the top, your car climbing towards it
  const x = VW - 12, y0 = 30, y1 = VH - 20, prog = clamp((G.T.startY - G.player.y) / (G.T.startY - G.T.finishY), 0, 1);
  R1(x - 2, y0, 5, y1 - y0, '#1b120c'); R1(x - 1, y0 + 1, 3, y1 - y0 - 2, '#6b4a2b');
  drawFlag(x - 4, y0 - 12);
  const py = Math.round(y1 - prog * (y1 - y0));
  disc(x, py, 5, '#1b120c'); disc(x, py, 4, G.player.def.M);
}


export function drawRunFinish() {
  if (G.stateTime < .6) { text('ZIEL!', VW / 2, VH / 2 - 20, 40, '#ffd23f', 'center'); drawConfetti(); return; }
  ctx.fillStyle = 'rgba(27,18,12,.5)'; ctx.fillRect(0, 0, VW, VH);
  const w = 280, h = 222, x = VW / 2 - w / 2, y = 24;
  panel(x, y, w, h);
  text('GESCHAFFT!', VW / 2, y + 14 + Math.round(Math.sin(G.time * 6) * 2), 16, '#ffd23f', 'center');
  ctx.drawImage(G.player.F.frames[Math.min(5, Math.round(G.player.dirt * 5))][0], VW / 2 - 66, y + 30, 132, 132);
  const rows = [['SPRUENGE', G.run.jumps, '#fff3dc'], ['PLATSCH', G.run.splashes, '#9fd6ff'], ['MATSCH', G.run.muds, '#e0b080'], ['DRECK', Math.round(G.player.dirt * 100) + '%', '#c9a36b']];
  rows.forEach(([k, v, c], i) => { text(k, VW / 2 - 10, y + 150 + i * 13, 8, c, 'right'); text(String(v), VW / 2 + 10, y + 150 + i * 13, 8, '#ffffff'); });
  if (G.stateTime > 2 && blink()) text('TASTE DRUECKEN', VW / 2, y + 206, 8, '#d8c4a8', 'center');
  drawConfetti();
}
