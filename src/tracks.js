import { HALF, TAU, WH, WW, angDiff, clamp, hash, hex, mk, outlineImg, rng, toCanvas, vnoise } from './core.js';

// ---------- tracks (800x450 world) ----------

const MUDDY = { mud: ['#5a3a1f', '#4b301a', '#664327'], mudEdge: '#3b2512', mudHi: '#8a6440', water: ['#2f69ad', '#3f86d0', '#4b97df', '#5aa8ec'],
  shore: ['#6b4a2b', '#5c3f24'], mudP: ['#4a2f18', '#5a3a1f', '#6b4626', '#7d5a36'], mudTrail: ['#3a2410', '#5a3a1c'], goo: false };


export const THEMES = {
  wiese:  { ...MUDDY, grass: ['#63c24a', '#55b03e', '#74d05a'], grassEdge: '#4a9a36', tuft: '#3e8e2e', track: ['#c99e69', '#bb905b', '#d5ad79'], trackEdge: '#9b7349', trail: '#2f6d24', decor: 'wiese', tree: 'round', treeCol: ['#2d7a34', '#3f9a3f', '#66c25a', '#17401c'], trees: 26, fence: 'picket', ambient: 'butterfly' },
  gelaende: { ...MUDDY, grass: ['#6cbf4a', '#5eae3f', '#7ccc58'], grassEdge: '#4f9a36', tuft: '#468a30', track: ['#b98b58', '#aa7e4d', '#c79a66'], trackEdge: '#8a6440', trail: '#2f6d24', treeCol: ['#2d7a34', '#3f9a3f', '#66c25a', '#17401c'], ambient: 'butterfly' },
  wald:   { ...MUDDY, water: ['#1f4a5e', '#2a6078', '#35708a', '#4f8ea6'], leafWater: true, dark: true, fence: 'log', ambient: 'firefly', grass: ['#3f8d3c', '#367c33', '#4a9c47'], grassEdge: '#2f6e2c', tuft: '#27612a', track: ['#a9815a', '#9b744f', '#b68e65'], trackEdge: '#7b583a', trail: '#1f4a1f', decor: 'wald', tree: 'pine', treeCol: ['#1b573a', '#277048', '#3d9160', '#0d2e1e'], trees: 62 },
  strand: { ...MUDDY, water: ['#1d8fb3', '#2bb3cc', '#48cfd9', '#8aeee6'], shore: ['#c9a060', '#bf9655'],
    grass: ['#f3d995', '#ebcc81', '#f8e6b0'], grassEdge: '#dcb96c', tuft: '#e2c275', track: ['#bb8c5a', '#ae8050', '#c69864'], trackEdge: '#8f6a42', trail: '#b89656',
    decor: 'strand', tree: 'palm', treeCol: ['#2a8a3c', '#3cac4e', '#74d66c', '#18521f'], trees: 18, sea: true, fence: 'rope', ambient: 'gull' },
  regenbogen: { mud: ['#c04dd8', '#a33bbf', '#d971f0'], mudEdge: '#6a1f7a', mudHi: '#ffe6ff', water: ['#1d6fd0', '#29a3f0', '#4cc3ff', '#8ae1ff'],
    shore: ['#3b2a6b', '#33245e'], mudP: ['#c04dd8', '#d971f0', '#ff9cf5', '#a33bbf'], mudTrail: ['#a33bbf', '#c04dd8'], goo: true,
    grass: ['#0c0a24', '#161040', '#24145a'], grassEdge: '#3a2a7a', tuft: '#0c0a24', track: ['#ffffff', '#ffffff', '#ffffff'], trackEdge: '#ffffff', trail: '#6b5bd6',
    decor: 'space', tree: 'none', treeCol: ['#000000', '#000000', '#000000', '#000000'], trees: 0, space: true, rainbow: true },
  garten: { ...MUDDY, water: ['#2a7184', '#34899b', '#43a0ae', '#7ccfd2'], shore: ['#8d8f86', '#777970'], grass: ['#6fb85a', '#62a84e', '#7ec766'], grassEdge: '#54944a', tuft: '#4d8a42',
    track: ['#c4ad86', '#b59d76', '#d0ba94'], trackEdge: '#948063', trail: '#3f7a35', decor: 'garten', tree: 'cherry', treeCol: ['#c4547f', '#e98cb0', '#f9cfdf', '#4a2438'], trees: 14, fence: 'bamboo', ambient: 'sakura' },
  bahn:   { ...MUDDY, grass: ['#8fbf4a', '#7fae3f', '#9fcc5a'], grassEdge: '#6f9a33', tuft: '#5f8a2a', track: ['#c99e69', '#bb905b', '#d5ad79'], trackEdge: '#9b7349', trail: '#4f7a22', decor: 'farm', tree: 'round', treeCol: ['#2d7a34', '#3f9a3f', '#66c25a', '#17401c'], trees: 18 },
};


// the wooden pier along the lower part of the beach track: it is there from the start, the flood rises around it later.
// It runs from where the track first dips below the line y (a wavy line, the same as the later shoreline, at the mud) to where it
// comes back up shortly before the finish, and bridges the dry stretch in between. 2 x half wide.
export const PIER = { half: 8, y: 284 };
export const PIER_WAVE = x => Math.sin(x / 40) * 5 + Math.sin(x / 13) * 2;
export function pierColor(d, nr, x, y) {
  if (hash(x, y, 53) < .03) return [118, 82, 40];
  return d > PIER.half - 1.6 ? [74, 47, 24] : ((nr >> 1) & 1) ? [184, 134, 76] : [163, 114, 56];
}


const S2 = a => a.map(p => [p[0] * 2, p[1] * 2]);


const B2 = a => a.map(m => [m[0], m[1] * 2, m[2] * 2, m[3] * 2]);


const TRACK_DEFS = [
  { name: 'WIESE', rev: 1, events: ['kuehe'], theme: 'wiese', song: 'kart', wallStyle: 'fence', wall: [{ x: 420, y: 190, ang: 0 }], pts: S2([[70, 125], [82, 60], [150, 40], [215, 72], [285, 40], [352, 60], [365, 140], [322, 193], [238, 188], [182, 152], [118, 193], [62, 182]]),
    mud: B2([[.14, 0, 16, 18], [.47, 5, 20, 18], [.72, -4, 14, 17]]), water: B2([[.3, -7, 11, 9], [.58, 0, 13, 18], [.84, 6, 9, 9]]), ponds: [[400, 226, 46, 26]], wash: .93 },
  { name: 'WALD', rev: 1, events: ['regen'], theme: 'wald', song: 'forest', wallStyle: 'logs', wall: [{ x: 410, y: 248, ang: 0 }], pts: S2([[60, 72], [150, 42], [205, 98], [262, 42], [345, 58], [360, 150], [292, 192], [205, 150], [125, 193], [48, 166]]),
    mud: B2([[.1, 0, 18, 18], [.35, 0, 15, 18], [.55, 5, 12, 12], [.76, 0, 20, 18]]), water: B2([[.22, -5, 10, 9], [.64, 0, 14, 18], [.86, 4, 10, 8]]), ponds: [], wash: .94 },
  { name: 'STRAND', rev: 1, events: ['flut'], pier: true, theme: 'strand', song: 'beach', wallStyle: 'bar', wall: [{ x: 330, y: 190, ang: 0 }], pts: S2([[60, 105], [112, 48], [200, 62], [282, 40], [352, 78], [335, 152], [262, 135], [205, 178], [120, 184], [52, 160]]),
    mud: B2([[.18, 0, 14, 18], [.5, 0, 18, 18], [.29, 4, 6, 7], [.78, -4, 6, 7]]), water: [], ponds: [[300, 240, 44, 26]], wash: null,
    // small beach showers that run all the time, each one leaves a mini puddle (t along the track, offset from the centre line); none on the lower part that gets flooded
    showers: [[.05, -15], [.25, 15], [.41, -15]] },
  { name: 'REGENBOGEN', theme: 'regenbogen', song: 'rainbow', wallStyle: 'rocks', wall: [{ x: 400, y: 262, ang: 0 }], pts: [[110, 230], [150, 90], [290, 60], [380, 150], [470, 70], [640, 70], [720, 170], [650, 260], [700, 360], [560, 400], [420, 330], [280, 400], [140, 370]],
    mud: [[.2, 0, 30, 36], [.56, 10, 26, 30]], water: [[.4, 0, 26, 36], [.79, -12, 20, 18]], boost: [.07, .3, .48, .67, .86], ponds: [], wash: .95 },
  { name: 'ZUG', theme: 'bahn', song: 'train', wallStyle: 'barrier', wall: [{ x: 365, y: 190, ang: 0 }], tunnels: [{ x: 365, y: 190, hw: 117, portals: [300, 430] }], pts: [[120, 250], [140, 110], [260, 80], [430, 88], [600, 80], [700, 130], [710, 300], [640, 370], [430, 362], [250, 370], [140, 340]],
    mud: [[.13, 0, 28, 36], [.47, 0, 30, 36], [.63, 8, 22, 24]], water: [[.36, -10, 20, 18], [.55, 0, 24, 36], [.86, 0, 22, 36]], ponds: [[560, 255, 40, 22]], rail: { x: 430, lines: [430, 300] }, wash: .94 },
  { name: 'GARTEN', theme: 'garten', song: 'garden', events: ['kois'], wall: [], wash: .06,
    pts: [[100, 290], [100, 252], [103, 224], [125, 204], [170, 198], [235, 198], [300, 198], [332, 187], [344, 159], [332, 131], [305, 120], [240, 120], [180, 120],
      [148, 108], [134, 80], [148, 52], [180, 40], [250, 40], [320, 40], [392, 42], [424, 52], [444, 80], [447, 125], [458, 168], [484, 198], [515, 211], [546, 198], [572, 168], [583, 125], [585, 90],
      [595, 62], [620, 43], [642, 38], [665, 43], [690, 62], [700, 90], [706, 140], [700, 200], [692, 255], [690, 300], [688, 335],
      [678, 368], [654, 392], [620, 402], [560, 403], [500, 403], [440, 402], [412, 401], [386, 396], [374, 380], [370, 355], [370, 335], [360, 322], [345, 317], [300, 316], [260, 318], [232, 328],
      [212, 350], [205, 376], [204, 392], [194, 404], [170, 408], [142, 397], [117, 372], [102, 336]],
    mud: [[.21, 0, 30, 34], [.27, 0, 30, 34], [.56, 0, 30, 34], [.69, 0, 30, 34], [.94, 0, 30, 34]], water: [[.10, 0, 28, 34], [.37, 0, 26, 34], [.62, 0, 26, 34], [.955, 0, 26, 34]], ponds: [],
    // deep water: rivers and ponds as chains of circles [x, y, radius]. The river from the top runs into the pool and the pond inside the first U, the second river crosses the
    // lower road twice and feeds the lake in the middle (a channel), the lake drains to the south. You fall into deep water, roads over it are bridges.
    rivers: [
      [[515, -14, 10], [515, 38, 11], [515, 82, 35], [515, 114, 14], [515, 140, 22]],
      [[812, 299, 13], [742, 301, 13], [660, 305, 13], [592, 312, 13], [543, 327, 13], [510, 350, 13], [500, 386, 13], [500, 422, 13], [502, 462, 13]],
      [[508, 350, 11], [462, 351, 10], [420, 352, 10], [372, 352, 10], [336, 360, 12]],
      [[264, 378, 24], [312, 378, 24]], [[288, 378, 26], [288, 378, 26]],
      [[288, 400, 12], [288, 462, 13]]],
    // stepping stones: the short cut across the pool at the top
    stones: [[493, 84, 10], [517, 74, 10], [540, 86, 10]],
    // clipped hedges that keep you from cutting across the garden: [x1, y1, x2, y2]
    hedges: [[12, 159, 333, 159], [172, 80, 396, 80], [135, 258, 396, 258], [396, 78, 396, 300], [396, 300, 520, 314], [642, 98, 642, 290], [152, 260, 152, 376]],
    pagodas: [[765, 142, 4, 1.15], [758, 388, 4, 1.15], [452, 262, 3, .85]],
    koi: [[515, 140, 11, 9], [288, 380, 36, 11], [515, 84, 14, 10], [655, 303, 40, 3]] },
];



function buildTrack(def, ti) {
  const th = THEMES[def.theme], sd = ti * 131 + 17, r = rng(sd);
  // centre line: closed Catmull-Rom, resampled every 2px
  const P = def.pts, n = P.length, raw = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n], d = P[(i + 2) % n];
    for (let k = 0; k < 40; k++) {
      const t = k / 40, t2 = t * t, t3 = t2 * t;
      const f = q => .5 * (2 * b[q] + (-a[q] + c[q]) * t + (2 * a[q] - 5 * b[q] + 4 * c[q] - d[q]) * t2 + (-a[q] + 3 * b[q] - 3 * c[q] + d[q]) * t3);
      raw.push([f(0), f(1)]);
    }
  }
  raw.push(raw[0]);
  const path = [{ x: raw[0][0], y: raw[0][1] }]; let acc = 0;
  for (let i = 1; i < raw.length; i++) {
    let ax = raw[i - 1][0], ay = raw[i - 1][1]; const bx = raw[i][0], by = raw[i][1];
    let seg = Math.hypot(bx - ax, by - ay);
    while (acc + seg >= 2) { const f = (2 - acc) / seg; ax += (bx - ax) * f; ay += (by - ay) * f; path.push({ x: ax, y: ay }); seg = Math.hypot(bx - ax, by - ay); acc = 0; }
    acc += seg;
  }
  const lp = path[path.length - 1]; if (Math.hypot(lp.x - path[0].x, lp.y - path[0].y) < 1) path.pop();
  const N = path.length, tan = [], nrm = [];
  for (let i = 0; i < N; i++) {
    const a = path[(i - 2 + N) % N], b = path[(i + 2) % N], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    tan.push({ x: dx / l, y: dy / l }); nrm.push({ x: -dy / l, y: dx / l });
  }
  // distance to centre line (and which centre point is nearest)
  const A = WW * WH, dist = new Float32Array(A).fill(1e8), near = new Int32Array(A), RR = HALF + 22;
  for (let pi = 0; pi < N; pi++) {
    const p = path[pi];
    const x0 = Math.max(0, Math.floor(p.x - RR)), x1 = Math.min(WW - 1, Math.ceil(p.x + RR));
    const y0 = Math.max(0, Math.floor(p.y - RR)), y1 = Math.min(WH - 1, Math.ceil(p.y + RR));
    for (let y = y0; y <= y1; y++) { const row = y * WW, dy = y + .5 - p.y, dy2 = dy * dy; for (let x = x0; x <= x1; x++) { const dx = x + .5 - p.x, dd = dx * dx + dy2; if (dd < dist[row + x]) { dist[row + x] = dd; near[row + x] = pi; } } }
  }
  for (let j = 0; j < A; j++) dist[j] = Math.sqrt(dist[j]);
  const band = (i, alongMax, fn) => {
    const p = path[i], tg = tan[i], nm = nrm[i], R = HALF + 16;
    for (let y = Math.max(0, Math.floor(p.y - R)); y <= Math.min(WH - 1, p.y + R); y++)
      for (let x = Math.max(0, Math.floor(p.x - R)); x <= Math.min(WW - 1, p.x + R); x++) {
        const dx = x + .5 - p.x, dy = y + .5 - p.y, a = dx * tg.x + dy * tg.y, c = dx * nm.x + dy * nm.y;
        if (Math.abs(a) < alongMax) fn(x, y, a, c);
      }
  };
  // terrain: 0 grass/space, 1 track, 2 mud, 3 water, 4 boost pad
  const ter = new Uint8Array(A), sea = new Uint8Array(A);
  for (let j = 0; j < A; j++) ter[j] = dist[j] < HALF ? 1 : 0;
  const shoreY = th.sea ? new Float32Array(WW) : null;
  if (th.sea) for (let x = 0; x < WW; x++) {
    shoreY[x] = 412 + Math.sin(x / 40) * 5 + Math.sin(x / 13) * 2;
    for (let y = Math.ceil(shoreY[x]); y < WH; y++) { ter[y * WW + x] = 3; sea[y * WW + x] = 1; }
  }
  const stamp = (cx, cy, tg, nm, rx, ry, type) => {
    const R = Math.ceil(Math.max(rx, ry) * 1.25) + 2;
    for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(WH - 1, cy + R); y++)
      for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(WW - 1, cx + R); x++) {
        const dx = x + .5 - cx, dy = y + .5 - cy, a = dx * tg.x + dy * tg.y, c = dx * nm.x + dy * nm.y;
        if ((a / rx) ** 2 + (c / ry) ** 2 < .8 + .4 * vnoise(x * .14, y * .14, sd + type)) ter[y * WW + x] = type;
      }
  };
  const onPath = (t, off, rx, ry, type) => { const i = Math.floor(t * N) % N, p = path[i]; stamp(p.x + nrm[i].x * off, p.y + nrm[i].y * off, tan[i], nrm[i], rx, ry, type); };
  // deep water (type 5): rivers, pools and lakes next to the road. A road over it stays road = a bridge. Stepping stones are road again.
  const deep = new Uint8Array(A), stoneMask = new Uint8Array(A), bridgeMask = new Uint8Array(A), isBridge = new Uint8Array(N), bridges = [];
  const capsule = (c0, c1) => {
    const st = Math.max(1, Math.ceil(Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) / 2));
    for (let s = 0; s <= st; s++) {
      const f = s / st, cx = c0[0] + (c1[0] - c0[0]) * f, cy = c0[1] + (c1[1] - c0[1]) * f, r = c0[2] + (c1[2] - c0[2]) * f, R = Math.ceil(r + 4);
      for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(WH - 1, Math.ceil(cy + R)); y++)
        for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(WW - 1, Math.ceil(cx + R)); x++)
          if (Math.hypot(x + .5 - cx, y + .5 - cy) < r + (vnoise(x * .12, y * .12, sd + 9) - .5) * 4) deep[y * WW + x] = 1;
    }
  };
  (def.rivers || []).forEach(ch => { for (let k = 1; k < ch.length; k++) capsule(ch[k - 1], ch[k]); });
  for (let j = 0; j < A; j++) if (deep[j] && ter[j] === 0) ter[j] = 5;
  if (def.rivers) {
    const inW = path.map(p => deep[Math.round(clamp(p.y, 0, WH - 1)) * WW + Math.round(clamp(p.x, 0, WW - 1))]), s0 = inW.indexOf(0);
    for (let k = 0, a = -1; k <= N; k++) {
      const i = (s0 + k) % N;
      if (k < N && inW[i]) { if (a < 0) a = k; }
      else if (a >= 0) { bridges.push([(s0 + a - 8 + N) % N, (s0 + k - 1 + 8) % N]); a = -1; }
    }
    for (const [a, b] of bridges) for (let i = a; ; i = (i + 1) % N) { isBridge[i] = 1; if (i === b) break; }
    for (let j = 0; j < A; j++) if (dist[j] < HALF && isBridge[near[j]]) bridgeMask[j] = 1;
  }
  for (const [sx, sy, sr] of def.stones || [])
    for (let y = Math.floor(sy - sr - 3); y <= Math.ceil(sy + sr + 3); y++) for (let x = Math.floor(sx - sr - 3); x <= Math.ceil(sx + sr + 3); x++)
      if (Math.hypot(x + .5 - sx, y + .5 - sy) < sr + (vnoise(x * .3, y * .3, sd + 4) - .5) * 2) { ter[y * WW + x] = 1; stoneMask[y * WW + x] = 1; }
  def.mud.forEach(m => onPath(m[0], m[1], m[2], m[3], 2));
  def.water.forEach(m => onPath(m[0], m[1], m[2], m[3], 3));
  def.ponds.forEach(p => stamp(p[0], p[1], { x: 1, y: 0 }, { x: 0, y: 1 }, p[2], p[3], 3));
  const showers = (def.showers || []).map(([t, off]) => {
    const i = Math.floor(t * N) % N, p = path[i], x = p.x + nrm[i].x * off, y = p.y + nrm[i].y * off, s = Math.sign(off) || 1;
    stamp(x, y, tan[i], nrm[i], 14, 12, 3);
    return { i, x, y, px: x + nrm[i].x * s * 18, py: y + nrm[i].y * s * 18 };
  });
  (def.boost || []).forEach(t => band(Math.floor(t * N) % N, 16, (x, y, a, c) => { if (Math.abs(c) < 18) ter[y * WW + x] = 4; }));
  // railway: a straight vertical line through the whole world
  let rail = null;
  if (def.rail) {
    const lines = def.rail.lines || [def.rail.x];
    for (const RX of lines) for (let y = 0; y < WH; y++) for (let x = RX - 18; x <= RX + 18; x++) { const j = y * WW + x; if (ter[j] >= 2) ter[j] = dist[j] < HALF ? 1 : 0; }
    const cross = [];
    for (const RX of lines) for (let i = 0; i < N; i++) { const a = path[i], b = path[(i + 1) % N]; if ((a.x - RX) * (b.x - RX) <= 0 && !cross.some(c => c.x === RX && Math.abs(c.i - i) < 30)) cross.push({ i, x: RX, y: (a.y + b.y) / 2 }); }
    rail = { x: def.rail.x, lines, sw: -1, cross, gate: 0, signal: false, bellT: 0, chuffT: 0, chuffN: 0, smokeT: 0, train: { phase: 'wait', t: 6, dir: 1, y: -9999 } };
  }
  const shore = new Uint8Array(A);
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const j = y * WW + x; if ((ter[j] !== 3 && ter[j] !== 5) || sea[j]) continue;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (dx * dx + dy * dy > 10) continue;
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= WW || yy >= WH) continue;
      const k = yy * WW + xx; if (ter[k] !== 3 && ter[k] !== 5 && (ter[j] === 3 || ter[k] === 0)) shore[k] = 1;
    }
  }
  const ed = (x, y, type, mr) => {
    for (let rr = 1; rr <= mr; rr++) for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= WW || yy >= WH) continue;
      if (ter[yy * WW + xx] !== type) return rr;
    }
    return mr + 1;
  };
  // paint ground
  const img = new ImageData(WW, WH), d = img.data;
  const set = (j, c) => { d[j * 4] = c[0]; d[j * 4 + 1] = c[1]; d[j * 4 + 2] = c[2]; d[j * 4 + 3] = 255; };
  const G = th.grass.map(hex), TRK = th.track.map(hex), TE = hex(th.trackEdge), GE = hex(th.grassEdge), TU = hex(th.tuft);
  const MUD = th.mud.map(hex), MUDE = hex(th.mudEdge), MUDH = hex(th.mudHi);
  const WAT = th.water.map(hex), SHORE = th.shore.map(hex);
  const SEA = ['#f4fbff', '#9df0e6', '#4fd0d8', '#2fa6d6', '#2285c4'].map(hex), WET = [hex('#c9a060'), hex('#d8b66e'), hex('#e2c47e')];
  const PEB = [hex('#e2cda6'), hex('#86653f')];
  const RB = ['#ff4d6d', '#ff9f43', '#ffd93d', '#6bcb77', '#4d96ff', '#9b5de5'].map(hex), RBL = ['#ff7a90', '#ffb86b', '#ffe46b', '#8fdc98', '#78b0ff', '#b585ee'].map(hex);
  const PLANK = [hex('#8d8373'), hex('#7a7163')], BAL = ['#8a8580', '#77726c', '#9c968f'].map(hex), SLEEPER = [hex('#6b4a2e'), hex('#56391f')], RAIL = [hex('#d5dae2'), hex('#6f757d')];
  const mudPix = [], watPix = [], starPix = [];
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
    const j = y * WW + x, t = ter[j], nv = vnoise(x / 9, y / 9, sd), h = hash(x, y, sd);
    let col;
    if (bridgeMask[j]) {
      // wooden bridge: planks across the road, rails along both edges (they are solid, see below)
      const i = near[j], dd = dist[j];
      col = dd > HALF - 2.5 ? (i % 6 < 2 ? [206, 156, 92] : [124, 82, 44]) : dd > HALF - 4.5 ? (i % 6 < 2 ? [168, 118, 66] : [84, 52, 26]) : i % 3 === 0 ? [96, 64, 34] : (Math.floor(i / 3) & 1) ? [176, 128, 74] : [160, 112, 62];
      if (h < .03 && dd < HALF - 4.5) col = [128, 88, 46];
    } else if (t === 3 || t === 5) {
      if (sea[j]) {
        // tropical sea: foam, turquoise shallows, deeper blue further out
        const dp = y - shoreY[x] + (nv - .5) * 3;
        col = dp < 2 ? SEA[0] : dp < 6 ? SEA[1] : dp < 14 ? SEA[2] : dp < 24 ? SEA[3] : SEA[4];
        if (dp > 8) watPix.push(j);
      }
      else {
        watPix.push(j); const e = ed(x, y, t, 4); col = e === 1 ? WAT[0] : e <= 3 ? WAT[1] : nv > .55 ? WAT[3] : WAT[2];
        if (th.leafWater && e > 2 && hash(x, y, sd + 5) < .012) col = [[224, 138, 44], [217, 180, 58], [181, 86, 42]][(h * 3) | 0];
      }
    } else if (shore[j]) col = SHORE[h < .5 ? 0 : 1];
    else if (t === 2) {
      const e = ed(x, y, 2, 1);
      if (e === 1) col = MUDE; else { mudPix.push(j); const v = nv * .6 + h * .4; col = v < .38 ? MUD[1] : v > .66 ? MUD[2] : MUD[0]; if (h < .025) col = MUDH; }
    } else if (t === 1 || t === 4) {
      if (th.rainbow) {
        const i = near[j], p = path[i], c = (x + .5 - p.x) * nrm[i].x + (y + .5 - p.y) * nrm[i].y;
        const b = clamp(Math.floor((c + HALF) / (2 * HALF) * 6), 0, 5);
        col = (i >> 3) & 1 ? RB[b] : RBL[b];
        if (dist[j] > HALF - 2.5) col = [255, 255, 255]; else if (h > .993) col = [255, 255, 255];
      } else {
        const v = nv * .6 + h * .4; col = v < .35 ? TRK[1] : v > .68 ? TRK[2] : TRK[0];
        if (dist[j] > HALF - 3) col = TE; else if (h > .988) col = PEB[0]; else if (h < .01) col = PEB[1];
      }
    } else if (th.space) {
      const neb = vnoise(x / 45, y / 45, sd + 3);
      col = neb > .62 ? G[2] : neb > .45 ? G[1] : G[0];
      if (h < .0015) { col = [255, 255, 255]; starPix.push(j); } else if (h < .004) col = [255, 233, 168]; else if (h < .0055) col = [159, 214, 255];
      if (dist[j] < HALF + 3) col = GE;
    } else if (th.sea && y > shoreY[x] - 14 && dist[j] >= HALF + 2.5) {
      const dd = shoreY[x] - y + (nv - .5) * 4; // wet sand darkens towards the waterline
      col = dd < 5 ? WET[0] : dd < 10 ? WET[1] : WET[2];
    } else {
      if (dist[j] < HALF + 2.5) col = GE;
      else { const v = nv * .7 + h * .3; col = v < .38 ? G[1] : v > .66 ? G[2] : G[0]; if (h < .025 || hash(x, y + 1, sd) < .025 || hash(x, y + 2, sd) < .012) col = TU; }
    }
    if (rail) for (const RX of rail.lines) {
      const dx = x - RX, ax = Math.abs(dx);
      if (ax <= 16) {
        if (dist[j] < HALF) col = (y >> 2) & 1 ? PLANK[0] : PLANK[1];
        else { col = BAL[(h * 3) | 0]; if (ax <= 12 && y % 7 < 3) col = SLEEPER[y % 7 === 0 ? 1 : 0]; }
        if (dx === -7 || dx === 6) col = RAIL[0]; else if (dx === -6 || dx === 7) col = RAIL[1];
      }
    }
    set(j, col);
  }
  // the pier: planks across the track and piles on both sides (still normal ground for the cars)
  let pier = null;
  if (def.pier) {
    let a = -1, b = -1;
    for (let i = Math.floor(.3 * N); i < N; i++) { const p = path[i]; if (p.y >= PIER.y + PIER_WAVE(p.x)) { if (a < 0) a = i; b = i; } }
    pier = [a, b];
    for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
      const j = y * WW + x;
      if (dist[j] >= PIER.half || near[j] < pier[0] || near[j] > pier[1]) continue;
      ter[j] = 1; set(j, pierColor(dist[j], near[j], x, y));
    }
    for (let i = pier[0]; i <= pier[1]; i += 7) {
      const p = path[i];
      for (const s of [-1, 1]) {
        const x = Math.round(p.x + nrm[i].x * s * (PIER.half + 2)), y = Math.round(p.y + nrm[i].y * s * (PIER.half + 2));
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < WW && y + dy < WH) set((y + dy) * WW + x + dx, dy === -1 && dx === 0 ? [138, 100, 64] : [59, 37, 18]);
      }
    }
  }
  // stepping stones: round grey stones with a dark rim, some moss, a ripple in the water around them
  for (const [sx, sy, sr] of def.stones || []) {
    for (let y = Math.floor(sy - sr - 4); y <= Math.ceil(sy + sr + 4); y++) for (let x = Math.floor(sx - sr - 4); x <= Math.ceil(sx + sr + 4); x++) {
      if (x < 0 || y < 0 || x >= WW || y >= WH) continue;
      const j = y * WW + x, dx = x + .5 - sx, dy = y + .5 - sy, dd = Math.hypot(dx, dy);
      if (!stoneMask[j]) { if (ter[j] === 5 && dd < sr + 3.5 && hash(x, y, sd + 6) < .5) set(j, [150, 214, 220]); continue; }
      const sh = (dx + dy) / sr;
      let c = dd > sr - 1.6 ? [84, 84, 80] : sh < -.35 ? [196, 194, 184] : sh > .4 ? [128, 127, 120] : [164, 162, 153];
      if (dd <= sr - 1.6 && hash(x, y, sd + 7) < .1) c = [96, 138, 72];
      set(j, c);
    }
  }
  // boost pads: yellow chevrons pointing the way
  (def.boost || []).forEach(t => band(Math.floor(t * N) % N, 16, (x, y, a, c) => {
    const ac = Math.abs(c); if (ac >= 18) return;
    set(y * WW + x, ac > 16 || Math.abs(a) > 14.5 ? [255, 255, 255] : ((a + ac * .8 + 100) % 10) < 4 ? [255, 230, 109] : [74, 36, 140]);
  }));
  // start line (checkered), stop lines at the level crossings, car wash
  band(0, 6, (x, y, a, c) => { if (Math.abs(c) < HALF) set(y * WW + x, ((Math.floor(a + 6) >> 2) + (Math.floor(c + 100) >> 2)) & 1 ? [245, 245, 240] : [34, 30, 28]); });
  if (rail) for (const cr of rail.cross) band(cr.i, 34, (x, y, a, c) => { if (Math.abs(c) < HALF - 2 && Math.abs(Math.abs(a) - 30) < 1.6) set(y * WW + x, [245, 245, 240]); });
  const hasWash = def.wash != null, wi = hasWash ? Math.floor(def.wash * N) % N : 0, washMask = new Uint8Array(A);
  const tp = new Uint8ClampedArray(A * 4);
  const setT = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= WW || y >= WH) return; const i = (y * WW + x) * 4; tp[i] = c[0]; tp[i + 1] = c[1]; tp[i + 2] = c[2]; tp[i + 3] = 255; };
  const FLOOR = [hex('#a9bccd'), hex('#93a8bb')], BEAM = [hex('#ffffff'), hex('#e84a5f'), hex('#b8354a')], POST = [hex('#4a5a8a'), hex('#6d7fb3')];
  if (hasWash) band(wi, 16, (x, y, a, c) => {
    const j = y * WW + x, ac = Math.abs(c), aa = Math.abs(a);
    if (ac < HALF && aa < 14) { washMask[j] = 1; set(j, ((Math.floor(a + 20) / 5 | 0) + (Math.floor(c + 100) / 5 | 0)) & 1 ? FLOOR[0] : FLOOR[1]); }
    if (aa < 5 && ac <= HALF + 5) setT(x, y, aa > 3.5 ? BEAM[2] : (Math.floor(c + 100) / 5 | 0) & 1 ? BEAM[0] : BEAM[1]);
    if (ac > HALF + 4 && ac <= HALF + 11 && aa < 7) setT(x, y, (ac < HALF + 7 || aa < 2) ? POST[1] : POST[0]);
  });
  // beach showers: a pole next to the track, an arm and the shower head hanging over the puddle
  for (const s of showers) {
    const bx = Math.round(s.px), by = Math.round(s.py), hx = Math.round(s.x), hy = Math.round(s.y) - 13;
    for (let k = 0; k <= 13; k++) { setT(bx, by - k, k % 4 === 3 ? hex('#8d97a3') : hex('#d4dbe3')); setT(bx + 1, by - k, hex('#9aa4b0')); }
    for (let k = -1; k <= 2; k++) setT(bx + k, by + 1, hex('#6b6f78'));
    const steps = Math.max(1, Math.abs(hx - bx)); for (let k = 0; k <= steps; k++) setT(bx + (hx - bx) * k / steps, by - 13 + (hy - (by - 13)) * k / steps, hex('#d4dbe3'));
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const dd = dx * dx + dy * dy; if (dd <= 9) setT(hx + dx, hy + dy, dd <= 3 ? hex('#4fb3e6') : hex('#b8c4d0')); }
  }
  // central wall across the infield: nobody can cut across the middle. Its ends stop at the track edge, solid circles every 8px.
  const walls = [], wallTrees = [], wallMask = new Uint8Array(A), wsegs = [];
  const maskAt = (x, y) => { for (let dy = -20; dy <= 20; dy++) for (let dx = -20; dx <= 20; dx++) { const xx = Math.round(x + dx), yy = Math.round(y + dy); if (dx * dx + dy * dy <= 400 && xx >= 0 && yy >= 0 && xx < WW && yy < WH) wallMask[yy * WW + xx] = 1; } };
  for (const w of def.wall || []) {
    const ca = Math.cos(w.ang), sa = Math.sin(w.ang);
    const end = dir => {
      let x = w.x, y = w.y;
      for (let k = 0; k < 500; k++) {
        const nx = x + ca * dir * 2, ny = y + sa * dir * 2;
        if (nx < 10 || ny < 10 || nx > WW - 10 || ny > WH - 10 || dist[(ny | 0) * WW + (nx | 0)] < HALF + 7) break;
        x = nx; y = ny;
      }
      return [x, y];
    };
    const dirs = w.dirs || [-1, 1], a = dirs.includes(-1) ? end(-1) : [w.x, w.y], b = dirs.includes(1) ? end(1) : [w.x, w.y];
    wsegs.push({ a, b, ca, sa, len: Math.hypot(b[0] - a[0], b[1] - a[1]) });
  }
  for (const sg of wsegs) for (let t = 0; t <= sg.len; t += 2) { const x = sg.a[0] + sg.ca * t, y = sg.a[1] + sg.sa * t; if (t % 8 === 0) walls.push({ x, y, r: 4 }); maskAt(x, y); }
  if (def.gate && rail) for (let x = rail.x - 24; x <= rail.x + 24; x += 8) { walls.push({ x, y: def.gate.y, r: 4 }); maskAt(x, def.gate.y); }
  // decor
  const ok = (x, y) => {
    x |= 0; y |= 0; if (x < 3 || y < 3 || x >= WW - 3 || y >= WH - 3) return false;
    const j = y * WW + x; return ter[j] === 0 && dist[j] > HALF + 4 && !shore[j] && !washMask[j] && !wallMask[j] && (!rail || rail.lines.every(L => Math.abs(x - L) > 20));
  };
  const px = (x, y, c) => { if (x >= 0 && y >= 0 && x < WW && y < WH) set(y * WW + x, c); };
  const scatter = (n, rad, fn) => { for (let k = 0, tries = 0; k < n && tries < n * 30; tries++) { const x = 5 + (r() * (WW - 10) | 0), y = 5 + (r() * (WH - 10) | 0); if (ok(x, y) && ok(x - rad, y) && ok(x + rad, y) && ok(x, y + rad) && ok(x, y - rad)) { fn(x, y); k++; } } };
  const rock = (x, y) => { const L2 = hex('#c4c4bb'), M2 = hex('#9a9a92'), D2 = hex('#6e6e68'); for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 4; dx++) if (!((dx === 0 || dx === 3) && (dy === 0 || dy === 2))) px(x + dx, y + dy, dy === 0 ? L2 : dy === 2 ? D2 : M2); };
  const trees = [], critters = [], C = th.treeCol.map(hex);
  let windmill = null;
  const darken = (x, y, rad, ox, oy) => { for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) { if (dx * dx + dy * dy > rad * rad) continue; const xx = x + dx + ox, yy = y + dy + oy; if (xx < 0 || yy < 0 || xx >= WW || yy >= WH) continue; const i = (yy * WW + xx) * 4; d[i] *= .78; d[i + 1] *= .76; d[i + 2] *= .76; } };
  const flowers = (n, PET) => scatter(n, 2, (x, y) => { const pc = PET[(r() * PET.length) | 0]; px(x - 1, y, pc); px(x + 1, y, pc); px(x, y - 1, pc); px(x, y + 1, pc); px(x, y, pc === PET[1] ? hex('#ff8c1a') : hex('#ffe14d')); });
  // wall look: fence + hay (meadow), log pile + pines (forest), beach bar + surfboards + palms (beach), asteroid belt (space), railway barrier (train)
  const kind = def.wallStyle, along = (sg, step, fn) => { for (let t = 0; t <= sg.len; t += step) fn(sg.a[0] + sg.ca * t, sg.a[1] + sg.sa * t, t); };
  const frac = (sg, fs) => { if (th.tree !== 'none') for (const f of fs) wallTrees.push({ x: Math.round(sg.a[0] + sg.ca * sg.len * f), y: Math.round(sg.a[1] + sg.sa * sg.len * f) }); };
  const at = (sg, x, y, a, b) => [Math.round(x + sg.ca * a - sg.sa * b), Math.round(y + sg.sa * a + sg.ca * b)];
  for (const sg of wsegs) {
    const shadow = rad => along(sg, 3, (x, y) => darken(Math.round(x), Math.round(y), rad, 2, 3));
    if (kind === 'fence') {
      const LT = hex('#d9b27c'), DK = hex('#7a5230'), PO = hex('#5a3a1c'), PH = hex('#c99e69');
      shadow(2);
      along(sg, 1, (x, y) => { for (const [k, c] of [[-2, LT], [2, DK]]) { const [qx, qy] = at(sg, x, y, 0, k); px(qx, qy, c); } });
      along(sg, 10, (x, y) => { for (let a = -1; a <= 1; a++) for (let b = -3; b <= 3; b++) { const [qx, qy] = at(sg, x, y, a, b); px(qx, qy, a < 0 && b < 3 ? PH : PO); } });
      along(sg, 1, (x, y, t) => {
        if (Math.round(t) % 70 !== 35) return;
        const X = Math.round(x), Y = Math.round(y); darken(X, Y, 6, 2, 3);
        for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const dd = Math.hypot(dx, dy); if (dd > 6) continue; px(X + dx, Y + dy, dd > 5.2 ? hex('#a8863a') : (Math.round(dd) % 2 ? hex('#e3c16f') : hex('#cfa84f'))); }
      });
      frac(sg, [.3, .7]);
    } else if (kind === 'logs') {
      const DK = hex('#4e3420'), R1c = hex('#d8b27a'), R2c = hex('#c49a5e'), RC = hex('#a07a45');
      shadow(4);
      along(sg, 1, (x, y) => { for (let b = -5; b <= 5; b++) { const [qx, qy] = at(sg, x, y, 0, b); px(qx, qy, DK); } });
      along(sg, 6, (x, y) => {
        for (const row of [-2.5, 2.5]) {
          const [cx, cy] = at(sg, x, y, row > 0 ? 3 : 0, row);
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const dd = Math.hypot(dx, dy); if (dd > 3) continue; px(cx + dx, cy + dy, dd > 2.2 ? DK : dd < 1 ? RC : Math.floor(dd * 1.3) % 2 ? R1c : R2c); }
        }
      });
      frac(sg, [.12, .3, .5, .7, .88]);
    } else if (kind === 'bar') {
      const SB = [['#ff7a45', '#ffd8b0'], ['#2fb5c8', '#e6fbff'], ['#ff5a9e', '#ffe0f0'], ['#ffd93d', '#fff6c8']].map(p => p.map(hex)), OU = hex('#6b4a2b');
      shadow(3);
      let n = 0;
      along(sg, 11, (x, y, t) => {
        if (Math.abs(t - sg.len / 2) < 36) return;
        const [c0, c1] = SB[n++ % 4];
        for (let a = -2; a <= 2; a++) for (let b = -6; b <= 6; b++) { const e = (a / 2.6) ** 2 + (b / 6.4) ** 2; if (e > 1) continue; const [qx, qy] = at(sg, x, y, a, b); px(qx, qy, e > .7 ? OU : Math.abs(a) < 1 ? c1 : c0); }
      });
      // the bar: plank floor, counter and stools on the ground, thatched roof with bunting on the top layer
      const mx = sg.a[0] + sg.ca * sg.len / 2, my = sg.a[1] + sg.sa * sg.len / 2;
      for (let a = -27; a <= 27; a++) for (let b = -15; b <= 15; b++) { const [qx, qy] = at(sg, mx, my, a, b); px(qx, qy, ((a + 40) >> 2) & 1 ? hex('#b8864c') : hex('#a8763c')); }
      for (let a = -24; a <= 24; a++) for (let b = 6; b <= 10; b++) { const [qx, qy] = at(sg, mx, my, a, b); px(qx, qy, b === 6 ? hex('#e8c88c') : hex('#5a3a1c')); }
      for (let a = -20; a <= 20; a += 10) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) { const [qx, qy] = at(sg, mx, my, a + dx, dy); px(qx, qy, a % 20 ? hex('#ffffff') : hex('#e84a5f')); }
      const TH = [[224, 184, 90], [201, 160, 64], [236, 206, 120]], BUN = ['#ff5a7a', '#ffd93d', '#4d96ff', '#6bcb77', '#ffffff'].map(hex);
      for (let a = -29; a <= 29; a++) for (let b = -17; b <= 14; b++) {
        const ed = Math.max(Math.abs(a) / 29, Math.abs(b + 1.5) / 15.5); if (ed > 1) continue;
        const [qx, qy] = at(sg, mx, my, a, b), v = hash(qx, qy, 3);
        setT(qx, qy, ed > .92 ? [150, 110, 40] : (Math.abs(b) + (a >> 1)) % 4 === 0 ? TH[1] : v < .15 ? TH[2] : TH[0]);
      }
      for (let a = -26; a <= 26; a += 4) { const bc = BUN[(a / 4 + 7) % 5 | 0]; for (const bb of [15, 16]) { const [qx, qy] = at(sg, mx, my, a, bb); setT(qx, qy, bc); } }
      frac(sg, [.18, .3, .7, .82]);
    } else if (kind === 'rocks') {
      const rr0 = rng(sd + 77);
      along(sg, 15, (x, y) => {
        const rr = 6 + (rr0() * 5 | 0), X = Math.round(x), Y = Math.round(y), cr = [[rr0() * 4 - 2, rr0() * 4 - 2, 2], [rr0() * 5 - 2, rr0() * 5 - 2, 1.4]];
        walls.push({ x, y, r: rr - 1 });
        for (let dy = -rr - 2; dy <= rr + 2; dy++) for (let dx = -rr - 2; dx <= rr + 2; dx++) {
          const dd = Math.hypot(dx, dy) + (vnoise((X + dx) * .4, (Y + dy) * .4, sd) - .5) * 4; if (dd > rr) continue;
          const sh = (dx + dy) / rr; let col = sh < -.4 ? [185, 185, 204] : sh > .4 ? [94, 94, 114] : [138, 138, 158];
          for (const c of cr) if (Math.hypot(dx - c[0], dy - c[1]) < c[2]) col = [94, 94, 114];
          setT(X + dx, Y + dy, col);
        }
      });
    } else if (kind === 'barrier') {
      const RD = hex('#e84a5f'), WH2 = hex('#ffffff'), PO = hex('#444444');
      shadow(2);
      along(sg, 1, (x, y, t) => { for (let b = -2; b <= 2; b++) { const [qx, qy] = at(sg, x, y, 0, b); px(qx, qy, ((Math.floor(t) >> 3) & 1) ? RD : WH2); } });
      along(sg, 24, (x, y) => { for (let a = -1; a <= 1; a++) for (let b = -4; b <= 4; b++) { const [qx, qy] = at(sg, x, y, a, b); px(qx, qy, PO); } });
    }
  }
  if (def.gate && rail) {
    // closed boom gate across the rail corridor
    const gy = def.gate.y, RD = hex('#e84a5f'), WH2 = hex('#ffffff'), PO = hex('#444444');
    for (let x = rail.x - 26; x <= rail.x + 26; x++) for (let b = -2; b <= 2; b++) px(x, gy + b, ((x >> 3) & 1) ? RD : WH2);
    for (const sx of [rail.x - 28, rail.x + 28]) { for (let dy = -4; dy <= 4; dy++) for (let dx = -3; dx <= 3; dx++) px(sx + dx, gy + dy, PO); px(sx, gy - 3, hex('#ff3b3b')); }
  }
  // fence along both sides of the track: rope (beach), white pickets (meadow), logs (forest)
  const FENCE = { rope: ['#f0dcaa', '#7a4f2a', '#a8743f', '#5a3a1c', 9], bamboo: ['#c9d49a', '#5f7d34', '#87a24b', '#364a1c', 9], picket: ['#e6e1d2', '#ffffff', '#f4f1e6', '#8a8472', 6], log: ['#8a6440', '#5a3a1c', '#7a5230', '#3b2512', 12] }[th.fence];
  if (FENCE) {
    const RL = hex(FENCE[0]), P0 = hex(FENCE[1]), P1 = hex(FENCE[2]), P2 = hex(FENCE[3]), RL2 = hex('#6b4a2e');
    for (let i = 0; i < N; i++) for (const s of [-1, 1]) {
      // the garden: if the first spot is already water, the fence moves out onto the grass strip next to the pond
      let x = 0, y = 0, j = -1;
      for (const o of th.decor === 'garten' ? [5, 7, 9, 11] : [5]) {
        x = Math.round(path[i].x + nrm[i].x * s * (HALF + o)); y = Math.round(path[i].y + nrm[i].y * s * (HALF + o));
        if (x < 1 || y < 1 || x >= WW - 3 || y >= WH - 3) { j = -1; break; }
        j = y * WW + x; if (ter[j] === 0 && dist[j] >= HALF + 4 && !washMask[j] && (!shore[j] || th.decor === 'garten')) break; j = -1;
      }
      if (j < 0) continue;
      // the garden: where deep water lies right behind the fence it is a solid barrier (except at the stepping stones, that is where you go in on purpose)
      if (th.decor === 'garten' && i % 3 === 0 && !(def.stones || []).some(q => Math.hypot(q[0] - x, q[1] - y) < 60)) {
        let wet = false; for (let dy = -12; dy <= 12 && !wet; dy += 4) for (let dx = -12; dx <= 12; dx += 4) { const xx = clamp(x + dx, 0, WW - 1), yy = clamp(y + dy, 0, WH - 1); if (ter[yy * WW + xx] === 5 && !bridgeMask[yy * WW + xx]) { wet = true; break; } }
        if (wet) walls.push({ x, y, r: 2.5 });
      }
      if (i % FENCE[4] === 0) { px(x + 2, y + 2, P2); px(x, y, P1); px(x + 1, y, P0); px(x, y + 1, P0); px(x + 1, y + 1, P2); }
      else { px(x, y, RL); if (th.fence === 'log') px(x + Math.round(nrm[i].x * s), y + Math.round(nrm[i].y * s), RL2); }
    }
  }
  // tunnel hills: a rocky hill with a grassy top on the wall line, the train disappears into it (the hill lies on the top layer, so it covers the train). Solid for cars.
  for (const { x: hx, y: hy, hw, portals } of def.tunnels || []) {
    const hh = 33, rr = 12, inside = (x, y) => { const qx = Math.abs(x - hx) - (hw - rr), qy = Math.abs(y - hy) - (hh - rr); return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr; };
    for (let q = hx - hw + 20; q <= hx + hw - 20; q += 20) darken(q, hy, 40, 6, 8);
    for (let y = hy - hh - 1; y <= hy + hh + 1; y++) for (let x = hx - hw - 1; x <= hx + hw + 1; x++) {
      const d = inside(x + .5, y + .5); if (d > 0) continue;
      const dep = -d, n = vnoise(x * .22, y * .22, sd + 11), lit = ((hx - x) + (hy - y)) / (hw + hh) * 18;
      let c;
      if (dep < 2) c = [52, 52, 58];
      else if (dep < 14) { const v = dep < 6 ? 98 : dep < 10 ? 124 : 146; const k = v + (n - .5) * 40 + lit; c = [k, k, k + 8]; if (hash(x, y, sd + 12) < .05) c = [k - 30, k - 30, k - 24]; }
      else { const g = 126 + (n - .5) * 60 + lit; c = [g * .62, g * 1.08, g * .5]; if (hash(x, y, sd + 13) < .02) c = [236, 120, 150]; }
      setT(x, y, c);
    }
    for (let gy = hy - hh + 4; gy <= hy + hh - 4; gy += 8) for (let gx = hx - hw + 4; gx <= hx + hw - 4; gx += 8) if (inside(gx, gy) < -3) walls.push({ x: gx, y: gy, r: 7 });
    for (let y = hy - hh - 8; y <= hy + hh + 8; y++) for (let x = hx - hw - 4; x <= hx + hw + 4; x++) if (y >= 0 && y < WH && x >= 0 && x < WW) wallMask[y * WW + x] = 1;
    // the tunnel mouths on both faces: stone frame and lintel, dark opening
    for (const sy of [-1, 1]) {
      const ye = hy + sy * hh;
      for (const px0 of portals) for (let k = -3; k <= 14; k++) for (let dx = -19; dx <= 19; dx++) {
        const ad = Math.abs(dx), y = ye - sy * k; let c = null;
        if (k < 0) c = k === -3 ? [112, 108, 98] : [188, 184, 170];
        else if (ad <= 14) c = k < 3 && ad >= 12 ? [60, 56, 60] : [Math.max(8, 26 - k), Math.max(8, 24 - k), Math.max(10, 30 - k)];
        else c = ad === 19 ? [112, 108, 98] : [176, 172, 160];
        if (c) setT(px0 + dx, y, c);
      }
    }
  }
  if (th.decor === 'wiese') {
    const PET = ['#ff5a7a', '#ffe14d', '#ffffff', '#b36bff', '#5ab4ff'].map(hex);
    flowers(320, PET);
    // pond life: lily pads, reeds and a duck family
    for (const p of def.ponds) {
      for (let k = 0; k < 10; k++) {
        const a = r() * TAU, q = Math.sqrt(r()) * .72, lx = Math.round(p[0] + Math.cos(a) * p[2] * q), ly = Math.round(p[1] + Math.sin(a) * p[3] * q), notch = r() * TAU;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const dd = dx * dx + dy * dy; if (dd > 10 || (dd > 1 && Math.abs(angDiff(Math.atan2(dy, dx), notch)) < .5)) continue;
          px(lx + dx, ly + dy, dx + dy < -1 ? hex('#6fca57') : hex('#3f9a3f'));
        }
        if (r() < .45) { px(lx, ly, hex('#ff9ecf')); px(lx + 1, ly, hex('#ffd1e8')); px(lx, ly - 1, hex('#ff9ecf')); }
      }
      for (let k = 0; k < 40; k++) {
        const a = r() * TAU, rx = Math.round(p[0] + Math.cos(a) * (p[2] + 6)), ry = Math.round(p[1] + Math.sin(a) * (p[3] + 6)); if (!ok(rx, ry)) continue;
        const hgt = 4 + (r() * 4 | 0);
        for (let q = 0; q < hgt; q++) px(rx, ry - q, hex(q > hgt - 3 ? '#6b4226' : '#2f6d24'));
        px(rx + 1, ry, hex('#3f8f2f'));
      }
      critters.push({ type: 'ducks', x: p[0], y: p[1], rx: p[2] * .55, ry: p[3] * .5, ph: r() * TAU });
    }
    // flower beds
    scatter(12, 8, (x, y) => { const pc = PET[(r() * PET.length) | 0]; for (let k = 0; k < 22; k++) { const a = r() * TAU, q = r() * 7, fx = Math.round(x + Math.cos(a) * q), fy = Math.round(y + Math.sin(a) * q); px(fx - 1, fy, pc); px(fx + 1, fy, pc); px(fx, fy - 1, pc); px(fx, fy + 1, pc); px(fx, fy, hex('#ffe14d')); } });
    scatter(40, 3, (x, y) => { const pc = PET[(r() * PET.length) | 0]; for (const [dx, dy] of [[-1, -2], [1, -2], [-2, 0], [2, 0], [-1, 2], [1, 2], [0, -2], [-2, -1], [2, -1], [-2, 1], [2, 1], [0, 2]]) px(x + dx, y + dy, pc); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) px(x + dx, y + dy, hex('#ffc93c')); });
    scatter(16, 6, (x, y) => { for (let dy = -5; dy <= 5; dy++) for (let dx = -6; dx <= 6; dx++) if ((dx / 6) ** 2 + (dy / 5) ** 2 <= 1) px(x + dx, y + dy, hash(x + dx, y + dy, 3) < .06 ? hex('#e84a5f') : dx + dy < -3 ? hex('#6fca57') : dx + dy > 3 ? hex('#2f7a26') : hex('#439a35')); });
    // picnic blanket with basket and plates
    scatter(2, 14, (x, y) => {
      darken(x, y, 10, 3, 3);
      for (let dy = -7; dy < 7; dy++) for (let dx = -10; dx < 10; dx++) px(x + dx, y + dy, (((dx + 10) / 4 | 0) + ((dy + 7) / 4 | 0)) & 1 ? hex('#e84a5f') : hex('#ffffff'));
      for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) px(x + 4 + dx, y - 1 + dy, (dx + dy) & 1 ? hex('#a8743f') : hex('#8a5a2b'));
      px(x + 3, y - 4, hex('#5a3a1c')); px(x + 4, y - 5, hex('#5a3a1c')); px(x + 5, y - 4, hex('#5a3a1c'));
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 4) px(x - 5 + dx, y + 2 + dy, hex('#f4f4f4'));
      px(x - 5, y + 2, hex('#e03b3b')); px(x - 4, y + 2, hex('#7bd37b'));
    });
    // windmill with a conical roof; the sails turn while you race
    scatter(1, 30, (x, y) => {
      windmill = { x, y }; trees.push({ x, y, r: 12 }); darken(x, y, 12, 7, 9);
      for (let dy = -11; dy <= 11; dy++) for (let dx = -11; dx <= 11; dx++) {
        const dd = Math.hypot(dx, dy); if (dd > 11) continue;
        const ring = Math.floor(dd / 2.5) % 2, lit = dx + dy < 0;
        setT(x + dx, y + dy, dd > 10 ? [120, 70, 40] : ring ? (lit ? [196, 120, 70] : [160, 90, 50]) : (lit ? [222, 146, 92] : [182, 106, 62]));
      }
    });
    scatter(7, 8, (x, y) => critters.push({ type: 'bunny', x, y, ph: r() * TAU, range: 10 + r() * 18, brown: r() < .5 }));
    scatter(26, 3, rock);
  } else if (th.decor === 'wald') {
    const LEAF = ['#e08a2c', '#d9b43a', '#b5562a', '#8a5a2b'].map(hex);
    scatter(800, 1, (x, y) => { const c = LEAF[(r() * 4) | 0]; px(x, y, c); if (r() < .5) px(x + 1, y, c); });
    scatter(50, 3, (x, y) => { const R2 = hex('#e03b3b'), R3 = hex('#a82424'), Wt = hex('#ffffff'); for (let dx = -2; dx <= 2; dx++) px(x + dx, y, R2); for (let dx = -1; dx <= 1; dx++) { px(x + dx, y - 1, R2); px(x + dx, y + 1, R3); } px(x - 1, y, Wt); px(x + 1, y - 1, Wt); px(x, y + 2, hex('#efe3c8')); px(x, y + 3, hex('#d8c9a8')); });
    // ferns
    const F1 = hex('#3f9a3f'), F2 = hex('#2c7a2f'), F3 = hex('#62b85a');
    scatter(50, 6, (x, y) => {
      const off = r() * TAU;
      for (let k = 0; k < 5; k++) {
        const a = off + k * TAU / 5, ca = Math.cos(a), sa = Math.sin(a);
        for (let s = 1; s <= 6; s++) { const fx = Math.round(x + ca * s), fy = Math.round(y + sa * s); px(fx, fy, F2); if (s > 1 && s < 6) { px(Math.round(fx - sa), Math.round(fy + ca), s % 2 ? F1 : F3); px(Math.round(fx + sa), Math.round(fy - ca), s % 2 ? F3 : F1); } }
      }
    });
    // mossy rocks
    scatter(16, 5, (x, y) => {
      darken(x, y, 4, 2, 3);
      for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) if ((dx / 4.3) ** 2 + (dy / 3.3) ** 2 <= 1) px(x + dx, y + dy, dy < 0 ? (hash(x + dx, y + dy, 4) < .5 ? hex('#5cb85c') : hex('#3f9a3f')) : dy > 1 ? hex('#6e6e68') : hex('#9a9a92'));
    });
    // tree stumps (solid)
    scatter(10, 7, (x, y) => {
      trees.push({ x, y, r: 5 }); darken(x, y, 5, 3, 4);
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) { const dd = Math.hypot(dx, dy); if (dd > 5.2) continue; px(x + dx, y + dy, dd > 4.3 ? hex('#5a3a1c') : dd < 1 ? hex('#a07a45') : Math.floor(dd * 1.3) % 2 ? hex('#d8b27a') : hex('#c49a5e')); }
    });
    // fallen logs (solid)
    scatter(6, 16, (x, y) => {
      const ang = r() * Math.PI, ca = Math.cos(ang), sa = Math.sin(ang);
      for (const q of [-8, 0, 8]) trees.push({ x: x + ca * q, y: y + sa * q, r: 5 });
      darken(x, y, 13, 3, 4);
      for (let dy = -15; dy <= 15; dy++) for (let dx = -15; dx <= 15; dx++) {
        const a = dx * ca + dy * sa, b = -dx * sa + dy * ca; if (Math.abs(a) > 14 || Math.abs(b) > 4.5) continue;
        let col = Math.abs(a) > 12.5 ? (Math.round(Math.abs(b) * 1.2) % 2 ? '#d8b27a' : '#b8905a') : b < -2.5 ? '#8a6440' : b > 2 ? '#4e3420' : Math.round(a) % 4 === 0 ? '#4e3420' : '#6b4a2e';
        if (Math.abs(a) <= 12.5 && b < 0 && hash(x + dx, y + dy, 6) < .1) col = '#5cb85c';
        px(x + dx, y + dy, hex(col));
      }
    });
    scatter(5, 6, (x, y) => critters.push({ type: 'squirrel', x, y, ph: r() * TAU, range: 10 + r() * 16 }));
    scatter(4, 6, (x, y) => critters.push({ type: 'hedgehog', x, y, ph: r() * TAU, range: 8 + r() * 10 }));
    scatter(20, 3, rock);
  } else if (th.decor === 'strand') {
    const SH = ['#ffffff', '#ffd1dc', '#f7e9d7'].map(hex), OUTL = hex('#6b4a2b');
    scatter(150, 2, (x, y) => { const c = SH[(r() * 3) | 0]; px(x, y, c); px(x + 1, y, c); px(x - 1, y, c); px(x, y - 1, c); px(x, y + 1, hex('#c9b8a0')); });
    scatter(22, 4, (x, y) => { const c = hex('#ff8a3d'), c2 = hex('#ffb77d'); px(x, y, c2); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU - Math.PI / 2; for (let s = 1; s <= 3; s++) px(Math.round(x + Math.cos(a) * s), Math.round(y + Math.sin(a) * s), c); } });
    scatter(8, 3, rock);
    // striped beach towels
    const TOW = [['#ff5a7a', '#ffffff'], ['#4d96ff', '#ffffff'], ['#ffd93d', '#ff9f43'], ['#6bcb77', '#ffffff'], ['#b36bff', '#ffd1f0']].map(p => p.map(hex));
    scatter(8, 12, (x, y) => {
      const [c0, c1] = TOW[(r() * TOW.length) | 0], vert = r() < .5, w = vert ? 11 : 19, h = vert ? 19 : 11;
      darken(x, y, 9, 2, 2);
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) { const q = vert ? dy : dx; px(x - (w >> 1) + dx, y - (h >> 1) + dy, (q >> 2) & 1 ? c1 : c0); }
    });
    // sandcastles with a little flag
    scatter(6, 10, (x, y) => {
      const S = ['#f5dca0', '#e9c57d', '#d9b064', '#b8904a'].map(hex);
      for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) { const dd = Math.hypot(dx, dy); if (dd > 8.5 && dd < 10) px(x + dx, y + dy, WET[0]); }
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) px(x + dx, y + dy, dx + dy < -4 ? S[0] : dx + dy > 4 ? S[2] : S[1]);
      for (const [cx2, cy2] of [[-5, -5], [5, -5], [-5, 5], [5, 5], [0, 0]]) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) px(x + cx2 + dx, y + cy2 + dy, dx + dy < 0 ? S[0] : dx + dy > 1 ? S[3] : S[1]);
      px(x, y - 1, hex('#6b4a2b')); px(x, y - 2, hex('#6b4a2b')); px(x + 1, y - 3, hex('#e03b3b')); px(x + 2, y - 3, hex('#e03b3b')); px(x + 1, y - 2, hex('#e03b3b'));
    });
    // beach balls
    scatter(7, 5, (x, y) => {
      const BC = ['#e03b3b', '#ffffff', '#2e86de', '#ffffff', '#ffd93d', '#ffffff'].map(hex);
      darken(x, y, 4, 2, 3);
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const dd = Math.hypot(dx, dy); if (dd > 4.3) continue; px(x + dx, y + dy, dd > 3.5 ? OUTL : dd < 1 ? hex('#ffffff') : BC[Math.floor((Math.atan2(dy, dx) + Math.PI) / TAU * 6) % 6]); }
    });
    // surfboards
    const SB = [['#ff7a45', '#ffd8b0'], ['#2fb5c8', '#e6fbff'], ['#ff5a9e', '#ffe0f0'], ['#ffd93d', '#fff6c8']].map(p => p.map(hex));
    scatter(5, 13, (x, y) => {
      const [c0, c1] = SB[(r() * SB.length) | 0], ang = r() * Math.PI, ca = Math.cos(ang), sa = Math.sin(ang);
      darken(x, y, 8, 3, 4);
      for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
        const a = dx * ca + dy * sa, b = -dx * sa + dy * ca, e = (a / 12) ** 2 + (b / 3.6) ** 2; if (e > 1) continue;
        px(x + dx, y + dy, e > .72 ? OUTL : Math.abs(b) < .7 ? c1 : c0);
      }
    });
    // beach umbrellas: solid obstacles, the striped canopy sits on the top layer
    const UM = ['#e84a5f', '#2e86de', '#ff9f43', '#6bcb77', '#b36bff'].map(hex), UW = hex('#ffffff');
    scatter(8, 14, (x, y) => {
      trees.push({ x, y, r: 9 });
      darken(x, y, 11, 6, 8);
      const c = UM[(r() * UM.length) | 0], rot = r() * TAU;
      for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) {
        const dd = Math.hypot(dx, dy), an = Math.atan2(dy, dx) + rot, wedge = Math.floor(((an % TAU) + TAU) % TAU / (TAU / 8));
        const edge = 11 - Math.abs(Math.sin(an * 4)) * 1.2; if (dd > edge) continue;
        let col = wedge % 2 ? UW : c;
        if (dx + dy < -8) col = col === UW ? [255, 255, 255] : col.map(v => Math.min(255, v + 40));
        else if (dx + dy > 8) col = col.map(v => v * .78 | 0);
        if (dd < 1.5) col = [240, 240, 240];
        setT(x + dx, y + dy, col);
      }
    });
    scatter(7, 8, (x, y) => critters.push({ type: 'crab', x, y, ph: r() * TAU, range: 8 + r() * 18 }));
  } else if (th.decor === 'garten') {
    const rc = (x0, y0, w, h, c) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) setT(x0 + xx, y0 + yy, c); };
    const GR = ['#2f6b3a', '#3f8a47', '#58a85a', '#e8a6c0', '#ffffff'].map(hex);
    // the rails of the bridges are solid
    for (let i = 0; i < N; i += 3) if (isBridge[i]) for (const s of [-1, 1]) walls.push({ x: path[i].x + nrm[i].x * s * HALF, y: path[i].y + nrm[i].y * s * HALF, r: 3 });
    // clipped hedges between the roads: solid, a few blossoms
    for (const [x1, y1, x2, y2] of def.hedges || []) {
      const L = Math.hypot(x2 - x1, y2 - y1);
      for (let t = 0; t <= L; t += 4) {
        const x = Math.round(x1 + (x2 - x1) * t / L), y = Math.round(y1 + (y2 - y1) * t / L), j = y * WW + x;
        if (dist[j] < HALF + 3 || ter[j] !== 0) continue;
        if (t % 8 === 0) { walls.push({ x, y, r: 5 }); darken(x, y, 5, 2, 3); for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) if (dx * dx + dy * dy <= 49) wallMask[clamp(y + dy, 0, WH - 1) * WW + clamp(x + dx, 0, WW - 1)] = 1; }
        for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
          if (dx * dx + dy * dy > 28) continue;
          const sh = (dx + dy) / 6, hh = hash(x + dx, y + dy, 3);
          setT(x + dx, y + dy, hh < .05 ? GR[3 + (hh < .02 ? 1 : 0)] : sh < -.4 ? GR[2] : sh > .4 ? GR[0] : GR[1]);
        }
      }
    }
    // large pagodas outside of the track: stone base, tiers of white walls with red posts and dark curved roofs
    const pagoda = (cx, cy, n, sc) => {
      // seen from above: stacked square tile roofs (four facets, ridges on the diagonals), each tier a bit smaller, a gold finial on top
      const hw0 = Math.round(21 * sc), RF = [['#8793a6', '#6c778a'], ['#566174', '#3f4859']].map(p => p.map(hex)), RD = hex('#2b303c'), EV = hex('#b83a2a'), EV2 = hex('#8a2a1e'), GD = hex('#e8c14a');
      walls.push({ x: cx, y: cy, r: Math.round(hw0 * .85) }); darken(cx, cy, Math.round(hw0 * 1.1), 5, 6);
      for (let dy = -hw0 - 3; dy <= hw0 + 3; dy++) for (let dx = -hw0 - 3; dx <= hw0 + 3; dx++) wallMask[clamp(cy + dy, 0, WH - 1) * WW + clamp(cx + dx, 0, WW - 1)] = 1;
      for (let t = 0; t < n; t++) {
        const hw = Math.round(hw0 - t * hw0 * .8 / n);
        for (let dy = -hw; dy <= hw; dy++) for (let dx = -hw; dx <= hw; dx++) {
          const ax = Math.abs(dx), ay = Math.abs(dy), m = Math.max(ax, ay);
          let c;
          if (m >= hw - 1) c = (dx + dy) > 0 ? EV2 : EV;
          else if (Math.abs(ax - ay) <= 0) c = RD;
          else { const up = ay >= ax ? dy < 0 : dx < 0; c = RF[(m + t) % 4 < 1 ? 1 : 0][up ? 0 : 1]; }
          setT(cx + dx, cy + dy, c);
        }
      }
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) setT(cx + dx, cy + dy, dx + dy < 0 ? hex('#fff0a8') : GD);
    };
    for (const [x, y, n, sc] of def.pagodas || []) pagoda(x, y, n, sc);
    flowers(240, ['#ffc2d6', '#ffffff', '#ff9fbf', '#ffe14d', '#b9a2ff'].map(hex));
    // bonsai trees in their pots
    scatter(9, 8, (x, y) => {
      walls.push({ x, y, r: 5 }); darken(x, y, 5, 2, 3);
      rc(x - 4, y + 1, 9, 4, hex('#8a5a3a')); rc(x - 5, y, 11, 1, hex('#b07a52')); rc(x - 3, y + 4, 7, 1, hex('#5a3a22'));
      for (let k = 0; k < 9; k++) rc(x - 1 + Math.round(Math.sin(k * .55) * 2), y - k, 2, 1, hex('#6b4a2e'));
      for (const [bx, by, rr] of [[x - 5, y - 7, 4], [x + 4, y - 10, 4], [x - 1, y - 14, 5]])
        for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr - 1; dx <= rr + 1; dx++) if ((dx / (rr + 1)) ** 2 + (dy / rr) ** 2 <= 1) setT(bx + dx, by + dy, dx + dy < -2 ? GR[2] : dx + dy > 2 ? GR[0] : GR[1]);
    });
    // stone lanterns
    scatter(8, 6, (x, y) => {
      const S0 = hex('#b9b7ac'), S1 = hex('#8f8d82'), S2 = hex('#6d6b62');
      walls.push({ x, y, r: 4 }); darken(x, y, 4, 2, 3);
      rc(x - 4, y, 9, 2, S1); rc(x - 1, y - 6, 3, 6, S0); rc(x - 4, y - 11, 9, 5, S1); rc(x - 3, y - 10, 7, 3, S0); rc(x - 1, y - 10, 3, 3, hex('#ffd36a'));
      rc(x - 5, y - 13, 11, 2, S2); rc(x - 3, y - 15, 7, 2, S1); rc(x - 1, y - 17, 3, 2, S0);
    });
    scatter(18, 3, rock);
    // lotus pads on the ponds
    for (const [lx, ly] of [[503, 152], [528, 141], [515, 164], [500, 102], [532, 100], [283, 376], [305, 381], [262, 394]]) {
      if (ter[ly * WW + lx] !== 5) continue;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const dd = dx * dx + dy * dy; if (dd > 10 || (dd > 1 && dx > 0 && dy === 0)) continue; px(lx + dx, ly + dy, dx + dy < -1 ? hex('#6fca57') : hex('#3f9a3f')); }
      px(lx - 1, ly - 1, hex('#ffb3cf')); px(lx, ly - 1, hex('#ffffff')); px(lx - 1, ly, hex('#ff8fb8'));
    }
    for (const [kx, ky, krx, kry] of def.koi || []) for (let k = 0; k < 3; k++) critters.push({ type: 'koi', x: kx, y: ky, rx: krx, ry: kry, ph: r() * TAU + k * 2.1, col: (r() * 3) | 0 });
  } else if (th.decor === 'farm') {
    flowers(160, ['#ff5a7a', '#ffe14d', '#ffffff'].map(hex));
    scatter(30, 4, (x, y) => { const Y = hex('#ffcf1f'), B = hex('#5a3a1f'); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; px(Math.round(x + Math.cos(a) * 3), Math.round(y + Math.sin(a) * 3), Y); } for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) px(x + dx, y + dy, B); });
    scatter(14, 7, (x, y) => { for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const dd = Math.hypot(dx, dy); if (dd > 6) continue; px(x + dx, y + dy, dd > 5.2 ? hex('#a8863a') : (Math.round(dd) % 2 ? hex('#e3c16f') : hex('#cfa84f'))); } });
    scatter(20, 3, rock);
  } else if (th.decor === 'space') {
    const planet = (x, y, rad, cols, ring) => {
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dy * dy > rad * rad) continue;
        const s = (dx + dy) / rad; let col = s < -.5 ? cols[2] : s > .45 ? cols[0] : cols[1];
        if (((y + dy) >> 2) % 3 === 0 && s > -.5) col = cols[3];
        px(x + dx, y + dy, col);
      }
      if (ring) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad * 2; dx <= rad * 2; dx++) {
        const e = (dx / (rad * 1.8)) ** 2 + (dy / (rad * .45)) ** 2;
        if (Math.abs(e - 1) < .12 && !(dy < 0 && dx * dx + dy * dy < rad * rad)) px(x + dx, y + dy, hex('#ffe9a8'));
      }
    };
    const PL = [['#7a2e8e', '#b04fc6', '#e8a3f5', '#9c3fb3'], ['#1f5f8b', '#2e86de', '#8fd3f4', '#2874b8'], ['#b35a1f', '#e67e22', '#f7c08a', '#d0701f'], ['#6f6f7a', '#a0a0ab', '#e0e0e8', '#8a8a95']].map(a => a.map(hex));
    scatter(5, 22, (x, y) => planet(x, y, 9 + (r() * 8 | 0), PL[(r() * 4) | 0], r() < .5));
    scatter(40, 3, (x, y) => { const c = r() < .5 ? hex('#ffffff') : hex('#ffe9a8'); px(x, y, c); px(x - 1, y, c); px(x + 1, y, c); px(x, y - 1, c); px(x, y + 1, c); starPix.push(y * WW + x); });
  }
  // trees: shadow on the ground, canopy on the top layer
  const forced = wallTrees.slice(), want = th.trees + forced.length;
  for (let tries = 0; (forced.length || trees.length < want) && tries < 6000; tries++) {
    const f = forced.shift();
    const x = f ? f.x : 14 + (r() * (WW - 28) | 0), y = f ? f.y : 14 + (r() * (WH - 28) | 0), j = y * WW + x;
    if (!f) {
      if (ter[j] !== 0 || dist[j] < HALF + 18 || shore[j] || wallMask[j]) continue;
      if (rail && rail.lines.some(L => Math.abs(x - L) < 36)) continue;
      if (trees.some(o => Math.hypot(o.x - x, o.y - y) < 26) || walls.some(o => Math.hypot(o.x - x, o.y - y) < 17)) continue;
      let wet = false; for (let dy = -14; dy <= 14 && !wet; dy += 7) for (let dx = -14; dx <= 14; dx += 7) { const xx = clamp(x + dx, 0, WW - 1), yy = clamp(y + dy, 0, WH - 1); if (ter[yy * WW + xx] === 3 || ter[yy * WW + xx] === 5) wet = true; }
      if (wet) continue;
    }
    trees.push({ x, y, r: th.tree === 'palm' ? 5 : 9 });
    for (let dy = -11; dy <= 11; dy++) for (let dx = -11; dx <= 11; dx++) {
      if (dx * dx + dy * dy > 110) continue;
      const xx = x + dx + 5, yy = y + dy + 7; if (xx < 0 || yy < 0 || xx >= WW || yy >= WH) continue;
      const i = (yy * WW + xx) * 4; d[i] *= .7; d[i + 1] *= .7; d[i + 2] *= .72;
    }
    if (th.tree === 'round' || th.tree === 'cherry') {
      for (let dy = -14; dy <= 14; dy++) for (let dx = -14; dx <= 14; dx++) {
        const X = x + dx, Y = y + dy, dd = Math.hypot(dx, dy) + (vnoise(X * .45, Y * .45, 5) - .5) * 3.5; if (dd > 11.5) continue;
        const s = (dx + dy) / 11 + (vnoise(X * .5, Y * .5, 6) - .5) * .9;
        let col = s < -.55 ? C[2] : s > .45 ? C[0] : C[1];
        if (vnoise(X * .7, Y * .7, 8) > .74 && s < .3) col = C[2];
        if (hash(X, Y, 7) < .015) col = th.tree === 'cherry' ? [255, 246, 250] : [224, 59, 59];
        setT(X, Y, col);
      }
    } else if (th.tree === 'pine') {
      const rot = r() * TAU;
      for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) {
        const X = x + dx, Y = y + dy, dd = Math.hypot(dx, dy), an = Math.atan2(dy, dx);
        const rad = 9 + 3 * Math.abs(Math.cos(an * 4 + rot)), inner = 5 + 2 * Math.abs(Math.cos(an * 4 + rot + Math.PI / 4));
        if (dd > rad) continue;
        setT(X, Y, dd < 2 ? C[2] : dd < inner ? ((dx + dy) < 0 ? C[2] : C[1]) : ((dx + dy) < -2 ? C[1] : C[0]));
      }
    } else {
      const off = r() * TAU;
      for (let k = 0; k < 7; k++) {
        const a = off + k * TAU / 7, ca = Math.cos(a), sa = Math.sin(a);
        for (let s = 1; s <= 15; s++) {
          const X = x + ca * s, Y = y + sa * s + (s > 9 ? (s - 9) * .5 : 0);
          setT(X, Y, s < 5 ? C[2] : C[1]); setT(X + ca * .5, Y + sa * .5, s < 5 ? C[2] : C[1]);
          if (s >= 4 && s <= 13) { const w = s < 11 ? 2 : 1; for (let q = 1; q <= w; q++) { setT(X - sa * q, Y + ca * q + q * .4, C[0]); setT(X + sa * q, Y - ca * q + q * .4, s % 2 ? C[2] : C[1]); } }
        }
      }
      for (const [dx, dy] of [[-1, -1], [1, -1], [0, 1]]) { setT(x + dx, y + dy, [107, 68, 35]); setT(x + dx + 1, y + dy, [138, 90, 43]); }
    }
  }
  const base = toCanvas(img);
  const top = toCanvas(outlineImg(new ImageData(tp, WW, WH), WW, WH, C[3]));
  const mini = mk(120, 68), mg = mini.getContext('2d');
  mg.imageSmoothingEnabled = true; mg.drawImage(base, 0, 0, 120, 68); mg.drawImage(top, 0, 0, 120, 68);
  const wp = path[wi];
  return { W: WW, H: WH, def, th, name: def.name, path, tan, nrm, N, ter, washMask, trees: trees.concat(walls), critters, windmill, shoreY, boat: { x: 60 }, base, top, mini, mudPix, watPix, starPix, rail,
    washC: hasWash ? { x: wp.x, y: wp.y, tg: tan[wi], nm: nrm[wi] } : null, dist, near, showers, pier, stone: stoneMask, bridges };
}


export const TRACKS = TRACK_DEFS.map(buildTrack);

export const trail = mk(WW, WH), tctx = trail.getContext('2d');
