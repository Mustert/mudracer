// view (what the screen shows) and world (the whole track, the camera follows the player)

export const VW = 480, VH = 270, WW = 800, WH = 450;


export const HALF = 30, LAPS = 3, TAU = Math.PI * 2, ROTS = 48, SS = 44;


export const MAXS = 135, ACC = 230, TRAIN_SPEED = 230, SOIL_LO = .04, SOIL_HI = .21, MUD_A = .16, MUD_B = .30;


export const FONT = '"Press Start 2P", monospace';


export const cv = document.getElementById('game'), ctx = cv.getContext('2d');


ctx.imageSmoothingEnabled = false;



function fit() {
  const s = Math.min(innerWidth / VW, innerHeight / VH);
  const sc = s >= 3 ? Math.floor(s) : s;
  cv.style.width = Math.floor(VW * sc) + 'px';
  cv.style.height = Math.floor(VH * sc) + 'px';
}


addEventListener('resize', fit);
 
fit();


if (document.fonts && document.fonts.load) document.fonts.load('16px "Press Start 2P"').catch(() => {});


// ---------- helpers ----------

export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;


export const pick = a => a[(Math.random() * a.length) | 0];


export function hash(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}


export function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}


export function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }


export const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];


export function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }


export function angDiff(a, b) { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }


export function toCanvas(img) { const c = mk(img.width, img.height); c.getContext('2d').putImageData(img, 0, 0); return c; }


export function outlineImg(img, w, h, col) {
  const d = img.data, o = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3]) continue;
    if ((x > 0 && d[i - 1]) || (x < w - 1 && d[i + 7]) || (y > 0 && d[i - w * 4 + 3]) || (y < h - 1 && d[i + w * 4 + 3])) {
      o[i] = col[0]; o[i + 1] = col[1]; o[i + 2] = col[2]; o[i + 3] = 255;
    }
  }
  return new ImageData(o, w, h);
}
