import { HALF, TAU, WH, WW, clamp, hash, hex, mk, vnoise } from './core.js';
import { nearestIdx } from './bau.js';

// ---------- Wueste: the oasis, the dunes to jump over, the big pyramid (a tunnel), cacti, the gorge with its ramp and rope bridge, quicksand ----------
// Terrain: 1 sand road, 0 dunes (slow, they make the car sandy), 3 the shallow rim of the oasis (washes), 5 its deep middle,
// 10 quicksand, 11 the gorge (no ground: you fall), 14 the swinging rope bridge over the gorge.

const K = Object.fromEntries(Object.entries({
  sand: '#ecca8a', sand1: '#e2bf7c', sand2: '#f4d69e', sandD: '#d2ac6c', sandL: '#fae4b4',
  road: '#d9b57c', road1: '#cfaa6e', road2: '#e2c08a', roadE: '#b8915a', peb: '#a07a48', pebL: '#f2dcb0',
  qs: '#b8915a', qs1: '#a8824c', qs2: '#c9a066', qsL: '#d8b47a',
  rim: '#c08a52', rimL: '#e0aa6a', rimD: '#7a4a26', deep1: '#4a2a16', deep2: '#2c180c', deep3: '#160a04',
  rock: '#b07a48', rockL: '#d49a62', rockD: '#7a4c28',
  st: '#d8b06a', stL: '#f0cc86', stD: '#a8803e', stDD: '#7e5c28', floor: '#8a6c44', floorD: '#6a5030', gold: '#ffd84a', goldD: '#c89a20',
  cac: '#3f9a4a', cacL: '#6cc070', cacD: '#256a30', spine: '#f4f0d0',
  camel: '#c89a5c', camelD: '#9a703c', camelL: '#e0b87a',
}).map(([k, v]) => [k, hex(v)]));

// the middle line of the gorge wanders a little away from the road
export const canyonX = (C, y) => C.x + Math.sin(y / 23) * 5 * clamp((Math.abs(y - 390) - 40) / 40, 0, 1);

// terrain, before the ground is painted. S: { def, ter, dist, near, path, tan, nrm, N }
export function desertTerrain(S) {
  const { def, ter, dist, path, N } = S, A = WW * WH, alt = new Uint8Array(A);
  // the oasis: the shallow rim washes (also on the road), the deep middle lies beside the road
  if (def.oasis) {
    const [ox, oy, rx, ry] = def.oasis;
    for (let y = Math.max(0, oy - ry - 6); y < Math.min(WH, oy + ry + 6); y++) for (let x = Math.max(0, ox - rx - 6); x < Math.min(WW, ox + rx + 6); x++) {
      const j = y * WW + x, e = ((x + .5 - ox) / rx) ** 2 + ((y + .5 - oy) / ry) ** 2, lim = .85 + .3 * vnoise(x * .12, y * .12, 61);
      if (e >= lim) continue;
      ter[j] = e < .42 && dist[j] > HALF + 6 ? 5 : 3;
    }
  }
  // the gorge: no ground; the rope bridge beside the ramp, with a short piece of road at both ends
  const C = def.canyon;
  if (C) for (let y = C.y0; y < WH; y++) {
    const cx = canyonX(C, y), onB = Math.abs(y - C.bridge) <= C.bh;
    for (let x = Math.floor(cx - C.hw - 26); x <= cx + C.hw + 26; x++) {
      const j = y * WW + x, dx = Math.abs(x + .5 - cx), edge = C.hw + (vnoise(x * .2, y * .2, 62) - .5) * 3 * clamp((Math.abs(y - 390) - 40) / 30, 0, 1);
      if (onB) { alt[j] = 1; if (dx < C.hw + 1) ter[j] = 14; else if (ter[j] === 0) ter[j] = 1; continue; }
      if (dx < edge) ter[j] = 11;
    }
  }
  // quicksand: round patches beside and on the ideal line
  for (const [qx, qy, qr] of def.quick || []) for (let y = qy - qr - 2; y <= qy + qr + 2; y++) for (let x = qx - qr - 2; x <= qx + qr + 2; x++) {
    if (Math.hypot(x + .5 - qx, y + .5 - qy) < qr + (vnoise(x * .3, y * .3, 63) - .5) * 2) ter[y * WW + x] = 10;
  }
  // jumps: the crests of the dunes (the whole width of the road) and the ramp in front of the gorge (only its lane)
  const jumps = [];
  for (const dx of def.dunes || []) { const i = nearestIdx(path, dx, 70), p = path[i]; jumps.push({ x: p.x, y: p.y, tx: 1, ty: 0, lo: -HALF - 4, hi: HALF + 4, vz: 64 }); }
  let rampI = 0, landI = 0;
  if (C) {
    const [y0, y1] = C.lane, ym = 390;
    jumps.push({ x: C.lip, y: ym, tx: -1, ty: 0, lo: ym - y1, hi: ym - y0, vz: 100 });
    rampI = nearestIdx(path, C.lip, ym); landI = nearestIdx(path, canyonX(C, ym) - C.hw - 30, ym);
  }
  return { alt, jumps, rampI, landI, quick: def.quick || [] };
}

// painting, after the ground. S: { def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, shore, sd, th, r, critters, darken, RT }
export function paintDesert(S) {
  const { def, d, set, setT, path, nrm, N, ter, dist, near, walls, wallMask, shore, sd, RT } = S, A = WW * WH, C = def.canyon;
  const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < WW && y < WH) set(y * WW + x, c); };
  const dk = (x, y, k) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= WW || y >= WH) return; const i = (y * WW + x) * 4; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; };
  const solid = (x, y, rr) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X >= 0 && Y >= 0 && X < WW && Y < WH) wallMask[Y * WW + X] = 1; } };

  // ----- the ground: dunes with ripples, the sand road (tyre tracks show well on it), quicksand, the gorge -----
  for (let j = 0; j < A; j++) {
    const x = j % WW, y = j / WW | 0, t = ter[j], h = hash(x, y, sd + 40), v = vnoise(x / 7, y / 7, sd + 41) * .55 + h * .45;
    let c;
    if (t === 0) {
      if (shore[j]) continue;
      if (dist[j] < HALF + 2.5) c = K.sandD;
      else {
        // wind ripples across the dunes, with darker hollows between big dunes
        const big = vnoise(x / 60, y / 40, sd + 42), rip = Math.sin(x * .18 + y * .55 + vnoise(x / 18, y / 18, sd + 43) * 9);
        c = rip > .72 ? K.sandL : rip < -.6 ? K.sand1 : big < .32 ? K.sand1 : big > .7 ? K.sand2 : K.sand;
        if (h < .006) c = K.peb;
      }
    } else if (t === 1 || t === 4) {
      c = v < .33 ? K.road1 : v > .7 ? K.road2 : K.road;
      if (dist[j] > HALF - 3 && !RT.alt[j]) c = K.roadE; else if (h > .992) c = K.pebL; else if (h < .008) c = K.peb;
    } else if (t === 10) {
      // quicksand: darker wet sand with rings that will turn round (the turning is drawn while racing)
      c = v < .4 ? K.qs1 : v > .7 ? K.qs2 : K.qs;
    } else if (t === 11 || t === 14) {
      // the gorge: a sunlit rim, rock layers on its sides, darkness deep down
      const cx = canyonX(C, y), dd = C.hw - Math.abs(x + .5 - cx), east = x > cx;
      c = dd < 2.5 ? (east ? K.rimD : K.rimL) : dd < 5 ? (((y + (east ? 0 : 3)) >> 2) & 1 ? K.rock : K.rockD) : dd < 9 ? K.deep1 : dd < 14 ? K.deep2 : K.deep3;
      if (dd >= 5 && dd < 9 && h < .1) c = K.rockD;
    } else continue;
    set(j, c);
  }
  // start line (chequered)
  S.band(0, 6, (x, y, a, c) => { if (Math.abs(c) < HALF) set(y * WW + x, ((Math.floor(a + 6) >> 2) + (Math.floor(c + 100) >> 2)) & 1 ? [245, 245, 240] : [34, 30, 28]); });

  // ----- the dunes across the road: bright where you drive up, the crest, a shadow behind it -----
  for (const J of RT.jumps) if (J.vz < 90) {
    for (let y = Math.round(J.y - HALF); y <= J.y + HALF; y++) for (let x = Math.round(J.x - 22); x <= J.x + 12; x++) {
      const j = y * WW + x; if (ter[j] !== 1) continue;
      const a = x + .5 - J.x, k = a < 0 ? 1 + .14 * (1 + a / 22) : 1 - .22 * (1 - a / 12);
      const i = j * 4; d[i] = clamp(d[i] * k, 0, 255); d[i + 1] = clamp(d[i + 1] * k, 0, 255); d[i + 2] = clamp(d[i + 2] * k, 0, 255);
      if (Math.abs(a) < .8) set(j, K.sandL);
    }
  }

  // ----- the ramp in front of the gorge: a wedge of rock, lighter towards the lip; the rope bridge gets posts and is drawn while racing -----
  if (C) {
    const [y0, y1] = C.lane;
    for (let y = y0; y <= y1; y++) for (let x = C.lip; x <= C.lip + 34; x++) {
      const a = (x - C.lip) / 34, h = hash(x, y, sd + 44), course = ((x - C.lip + ((y >> 3) & 1) * 4) % 8 === 0) || y % 8 === 0;
      set(y * WW + x, y === y0 || y === y1 ? K.rockD : course ? K.rockD : a < .15 ? K.rimL : h < .1 ? K.rock : a < .5 ? K.rockL : K.rock);
    }
    // warning chevrons on the road before the ramp
    for (let y = y0 + 4; y < y1 - 2; y++) for (let x = C.lip + 36; x < C.lip + 60; x++) if (((x + Math.abs(y - (y0 + y1) / 2) * .8) % 12) < 3) set(y * WW + x, [214, 72, 52]);
    // the rails of the rope bridge are solid
    const cx = canyonX(C, C.bridge);
    for (let x = Math.round(cx - C.hw - 6); x <= cx + C.hw + 6; x += 5) for (const s of [-1, 1]) walls.push({ x, y: C.bridge + s * (C.bh + 1), r: 2.5 });
    // posts on both ends
    for (const ex of [cx - C.hw - 3, cx + C.hw + 3]) for (const s of [-1, 1]) { const X = Math.round(ex), Y = C.bridge + s * (C.bh + 1); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) px(X + dx, Y + dy, dx * dx + dy * dy < 3 ? [138, 96, 52] : [74, 46, 22]); }
  }

  // ----- the big pyramid: the road goes through it. Solid around the road inside; its roof is a picture of its own (see-through from inside) -----
  let pyr = null;
  if (def.pyramid) {
    const [qx, qy, hs] = def.pyramid, x0 = qx - hs, y0 = qy - hs, W = hs * 2 + 1;
    const inFoot = (x, y) => Math.abs(x - qx) <= hs && Math.abs(y - qy) <= hs;
    // the floor inside: stone slabs on the road, dark stone beside it
    for (let y = y0; y <= y0 + W; y++) for (let x = x0; x <= x0 + W; x++) {
      if (x < 0 || y < 0 || x >= WW || y >= WH) continue;
      const j = y * WW + x; wallMask[j] = 1;
      if (ter[j] === 1) set(j, (x % 10 === 0 || y % 10 === 0) ? K.floorD : K.floor);
      else set(j, K.stDD);
    }
    // walls along the road inside, and round the outside except where the road goes in and out
    for (let i = 0; i < N; i += 3) {
      const p = path[i]; if (!inFoot(p.x, p.y)) continue;
      for (const s of [-1, 1]) { const x = p.x + nrm[i].x * s * (HALF + 5), y = p.y + nrm[i].y * s * (HALF + 5); if (inFoot(x, y)) walls.push({ x, y, r: 4 }); }
    }
    for (let k = -hs; k <= hs; k += 6) for (const [x, y] of [[qx + k, y0], [qx + k, y0 + W - 1], [x0, qy + k], [x0 + W - 1, qy + k]]) {
      const j = clamp(Math.round(y), 0, WH - 1) * WW + clamp(Math.round(x), 0, WW - 1); if (dist[j] < HALF + 3) continue;
      walls.push({ x, y, r: 4 });
    }
    // the roof: four faces of sandstone courses, lit from the top left, a golden tip, dark doorways where the road goes in and out
    const cv = mk(W + 8, W + 8), g = cv.getContext('2d'), img = g.createImageData(W + 8, W + 8), q = img.data;
    const torches = [];
    for (let yy = 0; yy < W; yy++) for (let xx = 0; xx < W; xx++) {
      const dx = xx - hs, dy = yy - hs, ax = Math.abs(dx), ay = Math.abs(dy), m = Math.max(ax, ay), X = x0 + xx, Y = y0 + yy;
      const face = ay >= ax ? (dy < 0 ? 'n' : 's') : (dx < 0 ? 'w' : 'e');
      const lit = { n: 1, w: 1.08, s: .72, e: .8 }[face];
      const course = Math.floor((hs - m) / 5), along = face === 'n' || face === 's' ? dx : dy;
      const joint = (hs - m) % 5 === 0 || ((along + course * 5 + 400) % 11 === 0);
      let c = joint ? K.stD : hash(X, Y, sd + 45) < .08 ? K.stL : K.st;
      if (Math.abs(ax - ay) < .8) c = K.stDD; // the edges between the faces
      if (m < 7) c = m < 6 && (dx + dy) < 0 ? K.gold : K.goldD;
      c = c.map(v => clamp(v * lit, 0, 255));
      const j = Y * WW + X, door = dist[j] < HALF + 1 && m > hs - 9;
      const k = (yy * (W + 8) + xx) * 4;
      if (door) { const dd = hs - m; c = dd < 2 ? K.stDD : [40, 26, 14]; }
      q[k] = c[0]; q[k + 1] = c[1]; q[k + 2] = c[2]; q[k + 3] = 255;
    }
    // its shadow on the sand to the bottom right
    for (let yy = 0; yy < W + 8; yy++) for (let xx = 0; xx < W + 8; xx++) {
      const k = (yy * (W + 8) + xx) * 4; if (q[k + 3]) continue;
      const dx = xx - hs - 6, dy = yy - hs - 6; if (Math.max(Math.abs(dx), Math.abs(dy)) <= hs && xx > hs && yy > hs) { q[k + 3] = 90; }
    }
    g.putImageData(img, 0, 0);
    // torches on the walls inside, beside the road
    for (let i = 0; i < N; i += 14) {
      const p = path[i]; if (!inFoot(p.x, p.y) || !inFoot(p.x + 12, p.y + 12) || !inFoot(p.x - 12, p.y - 12)) continue;
      for (const s of [-1, 1]) torches.push({ x: p.x + nrm[i].x * s * (HALF + 3), y: p.y + nrm[i].y * s * (HALF + 3), k: torches.length });
    }
    pyr = { c: cv, x: x0, y: y0, W, cx: qx, cy: qy, hs, torches };
  }

  // ----- small pyramids and the sphinx at the edge: solid scenery -----
  const stone = (x, y, c) => px(x, y, c);
  for (const [mx, my, mh] of def.minis || []) {
    for (let dy = -mh; dy <= mh; dy++) for (let dx = -mh; dx <= mh; dx++) {
      const ax = Math.abs(dx), ay = Math.abs(dy), m = Math.max(ax, ay), face = ay >= ax ? (dy < 0 ? 1 : .72) : (dx < 0 ? 1.08 : .8);
      let c = (mh - m) % 4 === 0 ? K.stD : K.st; if (Math.abs(ax - ay) < .8) c = K.stDD; if (m < 3) c = K.gold;
      stone(mx + dx, my + dy, c.map(v => clamp(v * face, 0, 255)));
    }
    for (let dy = 0; dy <= mh; dy++) for (let dx = 1; dx <= 6; dx++) dk(mx + mh + dx, my + dy, .8);
    for (let k = -mh; k <= mh; k += 7) for (const [x, y] of [[mx + k, my - mh], [mx + k, my + mh], [mx - mh, my + k], [mx + mh, my + k]]) walls.push({ x, y, r: 4 });
    walls.push({ x: mx, y: my, r: mh - 4 }); solid(mx, my, mh + 6);
  }
  if (def.sphinx) {
    // lying lion with a human head, looking west: body, paws in front, the striped head cloth
    const [sx, sy] = def.sphinx, R = (x, y, w, h, c) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) stone(sx + x + xx, sy + y + yy, c); };
    for (let dy = 0; dy < 30; dy++) for (let dx = 0; dx < 10; dx++) dk(sx + 16 + dx, sy - 10 + dy, .8);
    R(-6, -12, 26, 24, K.stDD); R(-5, -11, 24, 22, K.st); R(-5, -11, 24, 3, K.stL); for (let k = 0; k < 22; k += 5) R(-3 + k, -8, 1, 18, K.stD);
    R(-26, -9, 22, 6, K.stDD); R(-25, -8, 20, 4, K.stL); R(-26, 3, 22, 6, K.stDD); R(-25, 4, 20, 4, K.stL);
    R(-14, -9, 13, 18, K.stDD); for (let yy = -8; yy < 9; yy++) R(-13, yy, 11, 1, (yy & 1) ? [70, 110, 190] : K.gold);
    R(-15, -4, 6, 8, K.stDD); R(-14, -3, 4, 6, K.stL); R(-15, -1, 1, 2, K.stDD);
    walls.push({ x: sx, y: sy, r: 12 }); walls.push({ x: sx - 16, y: sy - 6, r: 5 }); walls.push({ x: sx - 16, y: sy + 6, r: 5 }); solid(sx - 6, sy, 30);
  }

  // ----- cacti: the ones on the road are obstacles of their own (see desert.js), more of them out on the dunes -----
  const cactus = (x, y, big) => {
    const r0 = big ? 6 : 4;
    for (let dy = -r0; dy <= r0 + 3; dy++) for (let dx = -r0; dx <= r0 + 5; dx++) if (dx > 0 && dy > 0 && Math.hypot(dx - 3, dy - 3) < r0) dk(x + dx, y + dy, .78);
    const blob = (cx, cy, rr) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const dd = Math.hypot(dx, dy); if (dd > rr + .3) continue; px(cx + dx, cy + dy, dd > rr - 1 ? K.cacD : (dx + dy < -1 ? K.cacL : (Math.round(Math.atan2(dy, dx) * 3) & 1) ? K.cac : K.cacD)); } };
    if (big) { blob(x - 7, y - 1, 2); blob(x + 6, y + 2, 2); for (let k = -7; k <= -3; k++) px(x + k, y - 1, K.cac); for (let k = 3; k <= 6; k++) px(x + k, y + 2, K.cac); }
    blob(x, y, r0 - 1);
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; px(x + Math.cos(a) * (r0 - 1), y + Math.sin(a) * (r0 - 1), K.spine); }
    px(x, y, [255, 120, 160]);
  };
  const cacti = (def.cacti || []).map(([x, y]) => { cactus(x, y, true); return { x, y, r: 7 }; });
  const okOff = (x, y, m) => { for (let dy = -m; dy <= m; dy += 2) for (let dx = -m; dx <= m; dx += 2) { const X = x + dx, Y = y + dy; if (X < 2 || Y < 2 || X >= WW - 2 || Y >= WH - 2) return false; const j = Y * WW + X; if (ter[j] !== 0 || dist[j] < HALF + 8 || wallMask[j] || shore[j]) return false; } return true; };
  for (let k = 0, tries = 0; k < 16 && tries < 800; tries++) {
    const x = 6 + (S.r() * (WW - 12) | 0), y = 6 + (S.r() * (WH - 12) | 0); if (!okOff(x, y, 10)) continue;
    cactus(x, y, true); walls.push({ x, y, r: 6 }); solid(x, y, 9); k++;
  }

  // ----- the oasis: palm trees round the water (their crowns on the top layer), camels resting in the shade -----
  if (def.oasis) {
    const [ox, oy, rx, ry] = def.oasis, PAL = ['#2a8a3c', '#3cac4e', '#74d66c'].map(hex);
    const palm = (x, y) => {
      walls.push({ x, y, r: 4 }); solid(x, y, 6);
      for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) if (dx * dx + dy * dy < 50) dk(x + dx + 5, y + dy + 7, .75);
      const off = hash(x, y, 7) * TAU;
      for (let k = 0; k < 7; k++) {
        const a = off + k * TAU / 7, ca = Math.cos(a), sa = Math.sin(a);
        for (let s = 1; s <= 14; s++) {
          const X = x + ca * s, Y = y + sa * s + (s > 8 ? (s - 8) * .5 : 0);
          setT(X, Y, s < 4 ? PAL[2] : PAL[1]);
          if (s >= 4 && s <= 12) { setT(X - sa, Y + ca + .4, PAL[0]); setT(X + sa, Y - ca + .4, s % 2 ? PAL[2] : PAL[1]); }
        }
      }
      for (const [dx, dy] of [[-1, -1], [1, -1], [0, 1]]) { setT(x + dx, y + dy, [107, 68, 35]); setT(x + dx + 1, y + dy, [138, 90, 43]); }
    };
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * TAU + .3, x = Math.round(ox + Math.cos(a) * (rx + 12)), y = Math.round(oy + Math.sin(a) * (ry + 12));
      const j = clamp(y, 0, WH - 1) * WW + clamp(x, 0, WW - 1); if (dist[j] < HALF + 10) continue;
      palm(x, y);
    }
    const camel = (x, y, f) => {
      const R = (dx, dy, w, h, c) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) px(f > 0 ? x + dx + xx : x - dx - xx, y + dy + yy, c); };
      for (let dy = 0; dy < 6; dy++) for (let dx = -8; dx < 10; dx++) dk(x + dx + 2, y + 3 + dy, .85);
      R(-8, -3, 16, 8, [74, 50, 28]); R(-7, -2, 14, 6, K.camel); R(-4, -5, 6, 4, K.camel); R(-3, -6, 4, 2, K.camelL); R(-7, 2, 14, 2, K.camelD);
      R(7, -6, 3, 6, K.camel); R(8, -9, 5, 4, [74, 50, 28]); R(9, -8, 4, 2, K.camel); R(11, -8, 1, 1, [30, 20, 10]);
    };
    camel(ox + rx + 26, oy - 20, -1); camel(ox - 10, oy + ry + 26, 1); camel(ox + 30, oy + ry + 20, 1);
    solid(ox, oy, 4);
  }

  // ----- scattered bits: stones, animal skulls -----
  for (let k = 0, tries = 0; k < 40 && tries < 900; tries++) {
    const x = 4 + (S.r() * (WW - 8) | 0), y = 4 + (S.r() * (WH - 8) | 0); if (!okOff(x, y, 3)) continue;
    if (k % 5 === 0) { // a skull with horns
      for (const [dx, dy, c] of [[0, 0, '#f4ecd8'], [1, 0, '#f4ecd8'], [-1, 0, '#f4ecd8'], [0, 1, '#f4ecd8'], [0, -1, '#f4ecd8'], [-1, -1, '#2a1a10'], [1, -1, '#2a1a10'], [-3, -2, '#e0d4b8'], [3, -2, '#e0d4b8'], [-2, -1, '#e0d4b8'], [2, -1, '#e0d4b8'], [0, 2, '#d8ccb0']]) px(x + dx, y + dy, hex(c));
    } else for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 4; dx++) if (!((dx === 0 || dx === 3) && (dy === 0 || dy === 2))) px(x + dx, y + dy, dy === 0 ? K.rockL : dy === 2 ? K.rockD : K.rock);
    k++;
  }

  // windsocks beside the road (they show the wind of the storm)
  const socks = [[34, 122], [735, 196], [404, 432], [350, 112]].map(([x, y]) => ({ x, y }));
  for (const s of socks) walls.push({ x: s.x, y: s.y, r: 2 });

  return { jumps: RT.jumps, alt: RT.alt, quick: RT.quick, rampI: RT.rampI, landI: RT.landI, pyr, cacti, socks, canyon: C,
    qsPix: (() => { const a = []; for (let j = 0; j < A; j++) if (ter[j] === 10 && hash(j % WW, j / WW | 0, 64) < .2) a.push(j); return a; })() };
}
