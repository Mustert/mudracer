import { HALF, TAU, clamp, hash, hex, mk, vnoise } from './core.js';
import { nearestIdx, paintTools, startLine } from './bau.js';

// ---------- Wueste: the oasis, the dunes to jump over, the big pyramid (a tunnel), cacti, the gorge with its ramp and rope bridge, quicksand ----------
// Terrain: 1 sand road, 0 dunes (slow, they make the car sandy), 2 the damp bank of the oasis (mud), 3 the shallow rim of the oasis (washes),
// 5 its deep middle, 10 quicksand, 11 the gorge (no ground: you fall), 14 the swinging rope bridge over the gorge.

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
// half width of the gorge at (x, y): a thin crack at its head under the cliff, widening over 50 px, with a ragged edge along its whole length
// (only calm where it crosses the road)
export const canyonEdge = (C, x, y) => {
  const t = clamp((y - C.y0) / 50, 0, 1), taper = .12 + .88 * t * t * (3 - 2 * t);
  return C.hw * taper + (vnoise(x * .2, y * .2, 62) - .5) * 5 * clamp((Math.abs(y - 390) - 40) / 30, 0, 1) * (.4 + .6 * t);
};

// terrain, before the ground is painted. S: { def, ter, dist, near, path, tan, nrm, N }
export function* desertTerrain(S) {
  const { MW, MH, def, ter, dist, path } = S, A = MW * MH, alt = new Uint8Array(A), wet = new Uint8Array(A);
  yield;
  // the oasis: the shallow rim washes (also on the road), the deep middle lies beside the road; round it the ground is damp (mud: the
  // bank, where cars come out of the water with sand and wet on their wheels)
  if (def.oasis) {
    const [ox, oy, rx, ry] = def.oasis;
    for (let y = Math.max(0, oy - ry - 14); y < Math.min(MH, oy + ry + 14); y++) for (let x = Math.max(0, ox - rx - 14); x < Math.min(MW, ox + rx + 14); x++) {
      const j = y * MW + x, e = ((x + .5 - ox) / rx) ** 2 + ((y + .5 - oy) / ry) ** 2, lim = .85 + .3 * vnoise(x * .12, y * .12, 61);
      if (e >= lim) {
        // the bank: a ragged damp band of mud, thinner where the road is dry
        if (e < lim * 1.3 + .12 * vnoise(x * .25, y * .25, 66) && (ter[j] === 0 || ter[j] === 1)) ter[j] = 2;
        continue;
      }
      ter[j] = e < .42 && dist[j] > HALF + 6 ? 5 : 3;
    }
  }
  yield;
  // the gorge: no ground; the rope bridge beside the ramp, with a short piece of road at both ends. It begins as a crack under a cliff (the head)
  // and the edge is ragged all along.
  const C = def.canyon;
  if (C) for (let y = C.y0; y < MH; y++) {
    const cx = canyonX(C, y), onB = Math.abs(y - C.bridge) <= C.bh;
    for (let x = Math.floor(cx - C.hw - 26); x <= cx + C.hw + 26; x++) {
      const j = y * MW + x, dx = Math.abs(x + .5 - cx);
      if (onB) { alt[j] = 1; if (dx < C.hw + 1) ter[j] = 14; else if (ter[j] === 0) ter[j] = 1; continue; }
      if (dx < canyonEdge(C, x, y)) ter[j] = 11;
    }
  }
  yield;
  // quicksand: lying in a hollow of the dunes, uneven patches (long across the road, ragged), round them damp sand that slowly turns firm
  (def.quick || []).forEach(([qx, qy, qr], q) => {
    const R = qr * 1.7;
    for (let y = Math.max(0, Math.floor(qy - R)); y <= Math.min(MH - 1, qy + R); y++) for (let x = Math.max(0, Math.floor(qx - R)); x <= Math.min(MW - 1, qx + R); x++) {
      const dx = x + .5 - qx, dy = y + .5 - qy, a = Math.atan2(dy, dx), j = y * MW + x;
      const rr = qr * (.78 + .22 * vnoise(Math.cos(a) * 1.6 + q * 7, Math.sin(a) * 1.6, 63)) + (vnoise(x * .3, y * .3, 63) - .5) * 2, d = Math.hypot(dx * .94, dy);
      if (d < rr) { if (ter[j] === 0 || ter[j] === 1 || ter[j] === 10) ter[j] = 10; }
      else if (d < rr * 1.7) wet[j] = Math.max(wet[j], Math.round(255 * (1 - (d - rr) / (rr * .7))));
    }
  });
  yield;
  // jumps: the crests of the dunes (the whole width of the road) and the ramp in front of the gorge (only its lane)
  const jumps = [];
  for (const dx of def.dunes || []) { const i = nearestIdx(path, dx, 70), p = path[i]; jumps.push({ x: p.x, y: p.y, tx: 1, ty: 0, lo: -HALF - 4, hi: HALF + 4, vz: 64 }); }
  let rampI = 0, landI = 0;
  if (C) {
    const [y0, y1] = C.lane, ym = 390;
    jumps.push({ x: C.lip, y: ym, tx: -1, ty: 0, lo: ym - y1, hi: ym - y0, vz: 100 });
    rampI = nearestIdx(path, C.lip, ym); landI = nearestIdx(path, canyonX(C, ym) - C.hw - 30, ym);
    jumps[jumps.length - 1].land = landI; // (short of the far side: set down behind the gorge)
  }
  return { alt, jumps, rampI, landI, quick: def.quick || [], wet }; // (the patches are uneven, but never wider than their radius)
}

// painting, after the ground. S: { def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, shore, sd, th, r, critters, darken, RT }
export function* paintDesert(S) {
  const { MW, MH, def, d, set, setT, path, nrm, N, ter, dist, walls, wallMask, shore, sd, RT } = S, A = MW * MH, C = def.canyon;
  const { px, dk, solid } = paintTools(S), wet = RT.wet;

  yield;
  // ----- the ground: dunes with ripples, the sand road (tyre tracks show well on it), quicksand, the gorge -----
  for (let j = 0; j < A; j++) {
    if (j % 40000 === 39999) yield;
    const x = j % MW, y = j / MW | 0, t = ter[j], h = hash(x, y, sd + 40), v = vnoise(x / 7, y / 7, sd + 41) * .55 + h * .45;
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
      const cx = canyonX(C, y), dd = (t === 14 ? C.hw : canyonEdge(C, x, y)) - Math.abs(x + .5 - cx), east = x > cx;
      c = dd < 2.5 ? (east ? K.rimD : K.rimL) : dd < 5 ? (((y + (east ? 0 : 3)) >> 2) & 1 ? K.rock : K.rockD) : dd < 9 ? K.deep1 : dd < 14 ? K.deep2 : K.deep3;
      if (dd >= 5 && dd < 9 && h < .1) c = K.rockD;
    } else continue;
    // the hollow of a quicksand patch: the dunes (and the road) turn damp and dark towards it
    if (wet[j] && (t === 0 || t === 1)) { const k = wet[j] / 255 * .7; c = [c[0] + (K.qs1[0] - c[0]) * k, c[1] + (K.qs1[1] - c[1]) * k, c[2] + (K.qs1[2] - c[2]) * k]; }
    set(j, c);
  }
  yield;
  // start line (chequered)
  startLine(S);

  yield;
  // ----- the dunes across the road: bright where you drive up, the crest, a shadow behind it -----
  for (const J of RT.jumps) if (J.vz < 90) {
    for (let y = Math.round(J.y - HALF); y <= J.y + HALF; y++) for (let x = Math.round(J.x - 22); x <= J.x + 12; x++) {
      const j = y * MW + x; if (ter[j] !== 1) continue;
      const a = x + .5 - J.x, k = a < 0 ? 1 + .14 * (1 + a / 22) : 1 - .22 * (1 - a / 12);
      const i = j * 4; d[i] = clamp(d[i] * k, 0, 255); d[i + 1] = clamp(d[i + 1] * k, 0, 255); d[i + 2] = clamp(d[i + 2] * k, 0, 255);
      if (Math.abs(a) < .8) set(j, K.sandL);
    }
  }

  yield;
  // ----- the ramp in front of the gorge: a wedge of rock, lighter towards the lip; the rope bridge gets posts and is drawn while racing -----
  if (C) {
    const [y0, y1] = C.lane;
    for (let y = y0; y <= y1; y++) for (let x = C.lip; x <= C.lip + 34; x++) {
      const a = (x - C.lip) / 34, h = hash(x, y, sd + 44), course = ((x - C.lip + ((y >> 3) & 1) * 4) % 8 === 0) || y % 8 === 0;
      set(y * MW + x, y === y0 || y === y1 ? K.rockD : course ? K.rockD : a < .15 ? K.rimL : h < .1 ? K.rock : a < .5 ? K.rockL : K.rock);
    }
    // warning chevrons on the road before the ramp
    for (let y = y0 + 4; y < y1 - 2; y++) for (let x = C.lip + 36; x < C.lip + 60; x++) if (((x + Math.abs(y - (y0 + y1) / 2) * .8) % 12) < 3) set(y * MW + x, [214, 72, 52]);
    // the rails of the rope bridge are solid
    const cx = canyonX(C, C.bridge);
    for (let x = Math.round(cx - C.hw - 6); x <= cx + C.hw + 6; x += 5) for (const s of [-1, 1]) walls.push({ x, y: C.bridge + s * (C.bh + 1), r: 2.5 });
    // posts on both ends
    for (const ex of [cx - C.hw - 3, cx + C.hw + 3]) for (const s of [-1, 1]) { const X = Math.round(ex), Y = C.bridge + s * (C.bh + 1); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) px(X + dx, Y + dy, dx * dx + dy * dy < 3 ? [138, 96, 52] : [74, 46, 22]); }
  }

  yield;
  // ----- the big pyramid: the road goes through it. Solid around the road inside; its roof is a picture of its own (see-through from inside) -----
  let pyr = null;
  if (def.pyramid) {
    const [qx, qy, hs] = def.pyramid, x0 = qx - hs, y0 = qy - hs, W = hs * 2 + 1;
    const inFoot = (x, y) => Math.abs(x - qx) <= hs && Math.abs(y - qy) <= hs;
    // the floor inside: stone slabs on the road, dark stone beside it
    for (let y = y0; y <= y0 + W; y++) for (let x = x0; x <= x0 + W; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const j = y * MW + x; wallMask[j] = 1;
      if (ter[j] === 1) set(j, (x % 10 === 0 || y % 10 === 0) ? K.floorD : K.floor);
      else set(j, K.stDD);
    }
    // walls along the road inside, and round the outside except where the road goes in and out
    for (let i = 0; i < N; i += 3) {
      const p = path[i]; if (!inFoot(p.x, p.y)) continue;
      for (const s of [-1, 1]) { const x = p.x + nrm[i].x * s * (HALF + 5), y = p.y + nrm[i].y * s * (HALF + 5); if (inFoot(x, y)) walls.push({ x, y, r: 4 }); }
    }
    for (let k = -hs; k <= hs; k += 6) for (const [x, y] of [[qx + k, y0], [qx + k, y0 + W - 1], [x0, qy + k], [x0 + W - 1, qy + k]]) {
      const j = clamp(Math.round(y), 0, MH - 1) * MW + clamp(Math.round(x), 0, MW - 1); if (dist[j] < HALF + 3) continue;
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
      const j = Y * MW + X, door = dist[j] < HALF + 1 && m > hs - 9;
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

  yield;
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

  yield;
  // ----- rock: ridges of boulders (the middle of the loop is closed: from the oasis over the small pyramids to the head of the gorge and on to the
  // big pyramid), and the cliff the gorge comes out of, with a dry waterfall -----
  const boulder = (x, y, r) => {
    for (let dy = 1; dy <= r + 6; dy++) for (let dx = 1; dx <= r + 8; dx++) if (Math.hypot((dx - r * .5) / 1.3, dy - r * .6) < r + 1) dk(x + dx, y + dy, .72);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const d2 = Math.hypot(dx, dy * 1.1); if (d2 > r) continue;
      const lit = (dx + dy) / (r * 1.4), h = hash(x + dx, y + dy, sd + 47);
      px(x + dx, y + dy, d2 > r - 1.2 ? K.rockD : lit < -.35 ? (h < .15 ? K.rock : K.rockL) : lit > .35 ? K.rockD : (h < .12 ? K.rockD : K.rock));
    }
  };
  for (const line of def.ridges || []) for (let s = 0; s + 1 < line.length; s++) {
    const [x0, y0] = line[s], [x1, y1] = line[s + 1], n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 7));
    for (let k = 0; k <= n; k++) {
      const u = k / n, h1 = hash(k, s + 3, sd + 48), h2 = hash(k, s + 3, sd + 49);
      const x = Math.round(x0 + (x1 - x0) * u + (h1 - .5) * 4), y = Math.round(y0 + (y1 - y0) * u + (h2 - .5) * 4), r = 6 + ((h1 * 100) | 0) % 4;
      const j = clamp(y, 0, MH - 1) * MW + clamp(x, 0, MW - 1);
      if (ter[j] !== 0 || dist[j] < HALF + r + 2) continue;
      boulder(x, y, r); walls.push({ x, y, r: r - 1.5 }); solid(x, y, r + 3);
    }
  }
  if (C) {
    const hx = C.x, hy = C.y0 - 18, rx = 38, ry = 26;
    const inside = (x, y) => ((x - hx) / rx) ** 2 + ((y - hy) / ry) ** 2 < 1 + .5 * (vnoise(x * .11, y * .11, sd + 50) - .5) + (y < hy ? .12 * Math.sin(x * .45) : 0);
    for (let y = hy - ry - 4; y <= hy + ry + 12; y++) for (let x = hx - rx - 4; x <= hx + rx + 14; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const j = y * MW + x;
      if (!inside(x, y)) { if (inside(x - 3, y - 3) && ter[j] === 0) dk(x, y, .7); continue; } // (its shadow to the bottom right)
      if (ter[j] !== 0 && ter[j] !== 11) continue;
      const band = (Math.floor((y - (hy - ry)) / 4) + (hash(x >> 3, y >> 2, sd + 51) < .3 ? 1 : 0)) % 3, edge = !inside(x + 1, y + 1) || !inside(x - 1, y - 1);
      const fall = Math.abs(x - hx - Math.sin(y * .3) * 1.5) < 5 && y < C.y0 + 1;
      let c = edge ? K.rockD : fall ? ((y + (x >> 1)) % 6 < 2 ? K.sandL : K.st) : band === 0 ? K.rockL : band === 1 ? K.rock : K.rockD;
      if (fall && Math.abs(x - hx - Math.sin(y * .3) * 1.5) > 3.6) c = K.stD; // the dry bed: pale stone, darker at its sides
      if (hash(x, y, sd + 52) < .06) c = K.rockD;
      px(x, y, c);
    }
    for (const [dx, r] of [[-14, 5], [13, 4], [-4, 3], [6, 3]]) boulder(hx + dx, C.y0 + 2 - (r > 3 ? 0 : 3), r); // the fallen rocks at its foot
    for (let k = 0, n = 34; k < n; k++) {
      const a = k / n * TAU, x = Math.round(hx + Math.cos(a) * (rx - 2)), y = Math.round(hy + Math.sin(a) * (ry - 2)), j = clamp(y, 0, MH - 1) * MW + clamp(x, 0, MW - 1);
      if (ter[j] === 11 || dist[j] < HALF + 6) continue;
      walls.push({ x, y, r: 5 });
    }
    solid(hx, hy, rx + 4);
  }

  yield;
  // ----- cacti: the ones on the road are obstacles of their own (see desert.js), more of them out on the dunes -----
  // The ones ON the road (obstacle: big, dark green, a ring of stones, a long shadow across the road, a pink flower) and the ones beside it
  // (decoration: small, pale and dusty green, no stones, no flower) cannot be mistaken for each other (principle 10).
  const blob = (cx, cy, rr, pal) => { for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) { const dd = Math.hypot(dx, dy); if (dd > rr + .3) continue; px(cx + dx, cy + dy, dd > rr - 1 ? pal[2] : (dx + dy < -1 ? pal[1] : (Math.round(Math.atan2(dy, dx) * 3) & 1) ? pal[0] : pal[2])); } };
  const cactus = (x, y) => {
    for (let dy = -8; dy <= 14; dy++) for (let dx = -8; dx <= 20; dx++) if (dx > 0 && dy > -2 && Math.hypot((dx - 6) / 1.5, dy - 4) < 8.5) dk(x + dx, y + dy, .66);
    for (let k = 0; k < 11; k++) {
      const a = k / 11 * TAU + .3, rr = 11 + (k % 2) * 1.5, sx = Math.round(x + Math.cos(a) * rr), sy = Math.round(y + Math.sin(a) * rr * .8);
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 4; dx++) if (!((dx === 0 || dx === 3) && (dy === 0 || dy === 2))) px(sx + dx, sy + dy, dy === 0 ? K.rockL : dy === 2 ? K.rockD : K.rock);
    }
    const C3 = [K.cac, K.cacL, K.cacD];
    blob(x - 10, y - 2, 3, C3); blob(x + 9, y + 3, 3, C3); for (let k = -10; k <= -4; k++) px(x + k, y - 2, K.cac); for (let k = 4; k <= 9; k++) px(x + k, y + 3, K.cac);
    blob(x, y, 7, C3);
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; px(x + Math.cos(a) * 6, y + Math.sin(a) * 6, K.spine); }
    px(x, y, [255, 120, 160]); px(x + 1, y, [255, 120, 160]);
  };
  const deco = (x, y) => {
    const P = [[134, 178, 120], [160, 200, 140], [104, 148, 98]];
    for (let dy = -2; dy <= 5; dy++) for (let dx = 0; dx <= 7; dx++) if (Math.hypot(dx - 3, dy - 2) < 3.5) dk(x + dx, y + dy, .88);
    blob(x - 3, y - 1, 1, P); blob(x + 3, y, 1, P); blob(x, y, 2, P);
  };
  const cacti = (def.cacti || []).map(([x, y]) => { cactus(x, y); return { x, y, r: 8 }; });
  const okOff = (x, y, m) => { for (let dy = -m; dy <= m; dy += 2) for (let dx = -m; dx <= m; dx += 2) { const X = x + dx, Y = y + dy; if (X < 2 || Y < 2 || X >= MW - 2 || Y >= MH - 2) return false; const j = Y * MW + X; if (ter[j] !== 0 || dist[j] < HALF + 8 || wallMask[j] || shore[j]) return false; } return true; };
  for (let k = 0, tries = 0; k < 16 && tries < 800; tries++) {
    const x = 6 + (S.r() * (MW - 12) | 0), y = 6 + (S.r() * (MH - 12) | 0); if (!okOff(x, y, 10)) continue;
    deco(x, y); solid(x, y, 5); k++; // (no wall: you drive over a little one)
  }

  yield;
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
      const j = clamp(y, 0, MH - 1) * MW + clamp(x, 0, MW - 1); if (dist[j] < HALF + 10) continue;
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

  yield;
  // ----- scattered bits: stones, animal skulls -----
  for (let k = 0, tries = 0; k < 40 && tries < 900; tries++) {
    const x = 4 + (S.r() * (MW - 8) | 0), y = 4 + (S.r() * (MH - 8) | 0); if (!okOff(x, y, 3)) continue;
    if (k % 5 === 0) { // a skull with horns
      for (const [dx, dy, c] of /** @type {Array<[number, number, string]>} */ ([[0, 0, '#f4ecd8'], [1, 0, '#f4ecd8'], [-1, 0, '#f4ecd8'], [0, 1, '#f4ecd8'], [0, -1, '#f4ecd8'], [-1, -1, '#2a1a10'], [1, -1, '#2a1a10'], [-3, -2, '#e0d4b8'], [3, -2, '#e0d4b8'], [-2, -1, '#e0d4b8'], [2, -1, '#e0d4b8'], [0, 2, '#d8ccb0']])) px(x + dx, y + dy, hex(c));
    } else for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 4; dx++) if (!((dx === 0 || dx === 3) && (dy === 0 || dy === 2))) px(x + dx, y + dy, dy === 0 ? K.rockL : dy === 2 ? K.rockD : K.rock);
    k++;
  }

  yield;
  // windsocks beside the road (they show the wind of the storm)
  const socks = [[34, 122], [735, 196], [404, 432], [350, 112]].map(([x, y]) => ({ x, y }));
  for (const s of socks) walls.push({ x: s.x, y: s.y, r: 2 });

  return { jumps: RT.jumps, alt: RT.alt, quick: RT.quick, rampI: RT.rampI, landI: RT.landI, pyr, cacti, socks, canyon: C, heat: def.heat || [],
    qsPix: (() => { const a = []; for (let j = 0; j < A; j++) if (ter[j] === 10 && hash(j % MW, j / MW | 0, 64) < .2) a.push(j); return a; })() };
}
