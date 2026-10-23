import { HALF, clamp, hash, hex, mk, vnoise } from './core.js';
import { nearestIdx, startLine } from './bau.js';
import { stampLine } from './volcanomap.js';

// ---------- Wueste Rev 3: the desert rally, the big pyramid with its two forks ----------
// From the start line the road goes up the left straight, round one bend and then there is no road any more: open desert (rally sand) up to the
// ram avenue and the sphinx gate, where the road begins again. It turns down to the doorway on the east side of the pyramid and runs through it from
// right to left (two forks), out of the west side onto the start straight. See plaene/WUESTE_REV3.md.
// Terrain: 1 the road (sand road outside, stone slabs inside the pyramid), 60 rally sand (the whole open field: a little slower, a little sandy),
// 0 soft sand (a patch of the field: slow and sandy, a decision), solid rock and the walls inside the pyramid, 61 quicksand that is about to
// open (harmless, a warning), 10 quicksand (the pull, trackfx.js sinkInSand), 11 shaft (no ground: you fall), 3 shallow water of the oases (washes).

export const RALLY = 60;

const K = Object.fromEntries(Object.entries({
  sand: '#ecca8a', sand1: '#e2bf7c', sand2: '#f4d69e', sandD: '#d2ac6c', sandL: '#fae4b4', peb: '#a07a48', pebL: '#f2dcb0',
  road: '#d9b57c', road1: '#cfaa6e', road2: '#e2c08a', roadE: '#b8915a',
  st: '#d8b06a', stL: '#f0cc86', stD: '#a8803e', stDD: '#7e5c28', gold: '#ffd84a', goldD: '#c89a20',
  floor: '#8a6c44', floor1: '#7e6240', floor2: '#947650', floorD: '#6a5030', kerb: '#b08a54', wall: '#4a3420', wallL: '#6a4c2e', wallD: '#2e1e10',
}).map(([k, v]) => [k, hex(v)]));

// terrain, before the ground is painted. S: { def, ter, dist, near, path, tan, nrm, N }
export function* desertTerrain(S) {
  const { MW, MH, def, ter, near, path, N } = S, A = MW * MH, alt = new Uint8Array(A);
  const [fx1, fy1] = def.field;
  yield;
  // the open field: no road between the first bend and the gate (the road of the centre line turns into rally sand, with a ragged end), and all
  // the ground beside it, up to the pyramid wall at the bottom and the avenue on the right, is rally sand too
  const iA = path.findIndex(p => p.x > 175), iB = path.findIndex((p, i) => i > iA && p.x >= fx1);
  for (let j = 0; j < A; j++) {
    if (j % 60000 === 59999) yield;
    const x = j % MW, y = (j / MW) | 0;
    if (ter[j] === 1) {
      const i = near[j] + (vnoise(x * .09, y * .09, 71) - .5) * 40;
      if (i > iA && i < iB) { ter[j] = RALLY; alt[j] = 1; }
    } else if (ter[j] === 0 && x < fx1 && y < fy1) { ter[j] = RALLY; alt[j] = 1; }
  }
  yield;
  // the forks: the stretch of the centre line between the entry and the exit is a wall in the middle; the two branches are narrow roads of their own
  const forks = (def.forks || []).map(F => {
    const i1 = nearestIdx(path, F.from[0], F.from[1]), i2 = nearestIdx(path, F.to[0], F.to[1]), f = { ...F, i1, i2, len: (i2 - i1 + N) % N };
    for (let j = 0; j < A; j++) if (ter[j] === 1 && ((near[j] - i1 + N) % N) < f.len) ter[j] = 0;
    for (const side of ['up', 'down']) f[side + 'P'] = stampLine(F[side], F.half, j => { ter[j] = 1; alt[j] = 1; }, MW, MH);
    return f;
  });
  yield;
  return { alt, forks, iA, iB };
}

// painting, after the ground. S: { def, d, set, setT, band, path, tan, nrm, N, ter, dist, near, walls, wallMask, sd, th, r, RT }
export function* paintDesert(S) {
  const { MW, MH, def, set, ter, dist, walls, wallMask, sd, RT } = S, A = MW * MH;
  const [x0, y0, x1, y1] = def.pyramid, PW = x1 - x0, PH = y1 - y0, inFoot = (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
  yield;
  // ----- the ground: rally sand and dunes with wind ripples, the sand road, the stone floor inside the pyramid -----
  for (let j = 0; j < A; j++) {
    if (j % 40000 === 39999) yield;
    const x = j % MW, y = (j / MW) | 0, t = ter[j], h = hash(x, y, sd + 40);
    let c;
    if (inFoot(x, y)) {
      if (t === 1) {
        // slabs with joints and a darker kerb where the road meets the wall
        const slab = (x % 12 === 0 || (y + ((x / 12 | 0) & 1) * 6) % 12 === 0);
        c = slab ? K.floorD : h < .1 ? K.floor1 : h > .9 ? K.floor2 : K.floor;
        if (ter[j - 1] !== 1 || ter[j + 1] !== 1 || ter[j - MW] !== 1 || ter[j + MW] !== 1) c = K.kerb;
      } else c = h < .08 ? K.wallL : h > .93 ? K.wallD : K.wall;
    } else if (t === 1) {
      const v = vnoise(x / 7, y / 7, sd + 41) * .55 + h * .45;
      c = v < .33 ? K.road1 : v > .7 ? K.road2 : K.road;
      if (dist[j] > HALF - 3 && !RT.alt[j]) c = K.roadE; else if (h > .992) c = K.pebL; else if (h < .008) c = K.peb;
    } else if (t === 0 || t === RALLY) {
      // wind ripples across the sand, with darker hollows between big dunes (the rally sand is a little coarser)
      const big = vnoise(x / 60, y / 40, sd + 42), rip = Math.sin(x * .18 + y * .55 + vnoise(x / 18, y / 18, sd + 43) * 9);
      c = rip > .72 ? K.sandL : rip < -.6 ? K.sand1 : big < .32 ? K.sand1 : big > .7 ? K.sand2 : K.sand;
      if (h < .006) c = K.peb; else if (t === RALLY && h < .05) c = K.sandD;
    } else continue;
    set(j, c);
  }
  yield;
  startLine(S);

  yield;
  // ----- the pyramid: solid all over, the road is cut into it. Its roof is a picture of its own, drawn while racing (not when you are inside) -----
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) wallMask[y * MW + x] = 1;
  const seen = new Set(), wall = (x, y) => { const k = (y >> 2) * 1000 + (x >> 2); if (seen.has(k)) return; seen.add(k); walls.push({ x, y, r: 4 }); };
  // round the outside (not where the road goes in or out) ...
  for (let x = x0; x < x1; x += 4) for (const y of [y0 + 2, y1 - 3]) if (dist[y * MW + x] >= HALF + 3) wall(x, y);
  for (let y = y0; y < y1; y += 4) for (const x of [x0 + 2, x1 - 3]) if (dist[y * MW + x] >= HALF + 3) wall(x, y);
  // ... and along every edge of the road inside
  for (let y = y0 + 1; y < y1 - 1; y++) for (let x = x0 + 1; x < x1 - 1; x++) {
    const j = y * MW + x; if (ter[j] === 1) continue;
    if (ter[j - 1] === 1 || ter[j + 1] === 1 || ter[j - MW] === 1 || ter[j + MW] === 1) wall(x, y);
  }
  yield;
  // the roof: four faces of sandstone courses, lit from the top left, a golden ridge, dark doorways where the road goes in and out
  const cv = mk(PW, PH), g = cv.getContext('2d'), img = g.createImageData(PW, PH), q = img.data;
  const ridge = Math.min(PW, PH) / 2;
  for (let yy = 0; yy < PH; yy++) {
    if (yy % 40 === 39) yield;
    for (let xx = 0; xx < PW; xx++) {
      const dN = yy, dS = PH - 1 - yy, dW = xx, dE = PW - 1 - xx, m = Math.min(dN, dS, dW, dE), X = x0 + xx, Y = y0 + yy;
      const face = m === dN ? 'n' : m === dW ? 'w' : m === dE ? 'e' : 's', lit = { n: 1, w: 1.08, s: .72, e: .8 }[face];
      const along = face === 'n' || face === 's' ? xx : yy, course = Math.floor(m / 5);
      const joint = m % 5 === 0 || ((along + course * 5 + 400) % 11 === 0);
      let c = joint ? K.stD : hash(X, Y, sd + 45) < .08 ? K.stL : K.st;
      if (m > ridge - 6) c = K.gold;
      const k = (yy * PW + xx) * 4, j = Y * MW + X;
      // (the doorways: the road under the roof is dark, with a frame of stone)
      const door = dist[j] < HALF + 3 && ter[j] === 1 && (yy < 48 || xx < 34);
      if (door) { const edge = dist[j] > HALF - 1; c = edge ? K.stDD : [40, 26, 14]; q[k + 3] = 255; q[k] = c[0]; q[k + 1] = c[1]; q[k + 2] = c[2]; continue; }
      q[k] = clamp(c[0] * lit, 0, 255); q[k + 1] = clamp(c[1] * lit, 0, 255); q[k + 2] = clamp(c[2] * lit, 0, 255); q[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const pyr = { c: cv, x: x0, y: y0, W: PW, H: PH };

  return { alt: RT.alt, jumps: [], pyr, forks: RT.forks, iA: RT.iA, iB: RT.iB, field: def.field, inside: false };
}
