import { G } from './g.js';
import { VH, VW, ctx, mk } from './core.js';
import { R1 } from './gfx.js';
import { polyPts } from './volcanomap.js';

// ---------- shared building blocks of the reworked tracks (ROADMAP 1T-13, plaene/REWORKS_CUP4_CUP5.md) ----------
// - warnSign: the warning triangle at the edge of the screen over a danger that is coming (no text, 1S9-12): ice (snowballs), jungle (trees, stone ball)
// - lampSprites: soft light spots for a light map (torches, the lamp round a car, its headlight cone): desert (pyramid), jungle (temple)
// - darkRect: a light map over one rectangle of the world (dark, torches and car lamps cut holes into it), drawn in world coordinates
// - smin: a smooth minimum (walls and massifs that melt into one shape, 1S9-9)
// - edgeCircles: solid circles along the outline of a free area (they follow the drawn edge, so the picture and the collision agree)
// - stampWay: a narrow way of its own (a polyline with rounded corners), stamped over a distance buffer: jungle (boardwalk, trail, grotto), space (forks, bay, detour)

// a warning triangle (yellow, black rim and exclamation mark), its tip at x, y
export function warnSign(x, y) {
  x = Math.round(x); y = Math.round(y);
  for (let r = 0; r < 16; r++) { const w = Math.floor(r * .62); R1(x - w - 1, y + r, w * 2 + 3, 1, '#1b120c'); if (r > 1 && r < 15) R1(x - w + 1, y + r, w * 2 - 1, 1, '#ffd23f'); }
  R1(x - 1, y + 5, 2, 5, '#1b120c'); R1(x - 1, y + 11, 2, 2, '#1b120c');
}

// the warning triangle for a danger at (x, y): over it when it is on the screen, otherwise at the edge of the screen in its direction (cx, cy = camera)
export function warnAt(x, y, cx, cy) {
  const m = 10, sx = Math.min(cx + VW - m, Math.max(cx + m, x)), sy = Math.min(cy + VH - 18, Math.max(cy + 4, y - 30));
  if (((G.time * 5) | 0) % 2 === 0) warnSign(sx, sy);
}

let SP = null;
export function lampSprites() {
  if (SP) return SP;
  const rad = (r, a) => { const c = mk(r * 2, r * 2), g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c; };
  const cone = mk(96, 64), g = cone.getContext('2d'), gr = g.createLinearGradient(0, 0, 96, 0);
  gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr;
  g.beginPath(); g.moveTo(0, 27); g.lineTo(96, 0); g.lineTo(96, 64); g.lineTo(0, 37); g.closePath(); g.fill();
  SP = { torch: rad(34, .6), car: rad(24, .45), glow: rad(36, .8), shaft: rad(40, .95), cone }; return SP;
}

// a light map over the rectangle R = { x, y, W, H } (only the part on the screen): dark with alpha a; lights = [{ x, y, k }] (torches, they flicker),
// shafts = [{ x, y }] (light falling in from above), and every car has its lamp and headlight cone. cx, cy = camera
let LM = null;
export function darkRect(cx, cy, R, a, lights = [], shafts = []) {
  const S = lampSprites(); if (!LM) LM = mk(VW, VH);
  const sx = Math.max(R.x, cx), sy = Math.max(R.y, cy), ex = Math.min(R.x + R.W, cx + VW), ey = Math.min(R.y + R.H, cy + VH);
  if (ex <= sx || ey <= sy) return;
  const g = LM.getContext('2d');
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, VW, VH);
  g.fillStyle = 'rgba(6,8,4,' + a + ')'; g.fillRect(sx - cx, sy - cy, ex - sx, ey - sy);
  g.globalCompositeOperation = 'destination-out';
  for (const t of lights) { const x = t.x - cx, y = t.y - cy; if (x < -40 || x > VW + 40 || y < -40 || y > VH + 40) continue; g.globalAlpha = .8 + .2 * Math.sin(G.time * 13 + (t.k || 0)); g.drawImage(S.torch, Math.round(x - 34), Math.round(y - 34)); }
  g.globalAlpha = 1;
  for (const s of shafts) { const x = s.x - cx, y = s.y - cy; if (x < -50 || x > VW + 50 || y < -50 || y > VH + 50) continue; g.drawImage(S.shaft, Math.round(x - 40), Math.round(y - 40)); }
  for (const c of G.cars) {
    const x = c.x - cx, y = c.y - cy; if (c.fall > 0 || x < -110 || x > VW + 110 || y < -110 || y > VH + 110) continue;
    g.drawImage(S.car, Math.round(x - 24), Math.round(y - 24));
    g.save(); g.translate(x, y); g.rotate(c.ang); g.drawImage(S.cone, 8, -32); g.restore();
  }
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(LM, sx - cx, sy - cy, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);
}

// a smooth minimum of a and b (k = how far the shapes melt into each other, in px)
export function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; }

// solid circles r along the edge of a free area: free(x, y) says whether a pixel is free; in the box [x0, y0, x1, y1] every pixel that is not free but
// touches a free one is an edge pixel; a circle sits there, pushed `out` px away from the free side, at most one per `step` px (a grid)
export function edgeCircles(free, x0, y0, x1, y1, r = 4, out = 4, step = 5) {
  const res = [], taken = new Set();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (free(x, y)) continue;
    let fx = 0, fy = 0, n = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (free(x + dx, y + dy)) { fx += dx; fy += dy; n++; }
    if (!n) continue;
    const key = ((x / step) | 0) + ',' + ((y / step) | 0); if (taken.has(key)) continue; taken.add(key);
    const l = Math.hypot(fx, fy) || 1;
    res.push({ x: x - fx / l * out, y: y - fy / l * out, r });
  }
  return res;
}

// a narrow way of its own (a polyline with rounded corners, every 2 px): every pixel nearer than half to it, fn(j, distance); returns the points.
// Like stampLine (volcanomap.js), but with a distance buffer over its box instead of a Map (fast)
export function stampWay(P, half, fn, MW, MH) {
  const pts = polyPts(P), R = Math.ceil(half + 1);
  let x0 = MW, y0 = MH, x1 = 0, y1 = 0; for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  x0 = Math.max(0, Math.floor(x0 - R)); y0 = Math.max(0, Math.floor(y0 - R)); x1 = Math.min(MW - 1, Math.ceil(x1 + R)); y1 = Math.min(MH - 1, Math.ceil(y1 + R));
  const BW = x1 - x0 + 1, D = new Float32Array(BW * (y1 - y0 + 1)).fill(1e9), h2 = half * half;
  for (const p of pts) for (let y = Math.max(y0, Math.floor(p.y - R)); y <= Math.min(y1, p.y + R); y++) { const dy = y + .5 - p.y, row = (y - y0) * BW; for (let x = Math.max(x0, Math.floor(p.x - R)); x <= Math.min(x1, p.x + R); x++) { const dx = x + .5 - p.x, dd = dx * dx + dy * dy; if (dd < h2 && dd < D[row + x - x0]) D[row + x - x0] = dd; } }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dd = D[(y - y0) * BW + x - x0]; if (dd < h2) fn(y * MW + x, Math.sqrt(dd)); }
  return pts;
}
