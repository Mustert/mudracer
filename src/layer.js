import { mk } from './core.js';

// ---------- a drawing layer as big as the world, made of tiles ----------
// The tyre tracks lie on such a layer. A tile (TILE x TILE px) is only made where something is drawn, so a big map or the long
// Matschfahrt costs memory only where cars drove. It takes the few calls the game makes on a 2D context (fillRect, clearRect,
// globalAlpha, fillStyle, globalCompositeOperation) and passes them to the tiles they touch. With `keep` set, the tiles
// farthest from the camera are let go when there are more than that (the Matschfahrt: old tracks far below are forgotten).

export const TILE = 256;

export class TiledLayer {
  constructor(w, h) { this.globalAlpha = 1; this.fillStyle = '#000'; this.globalCompositeOperation = 'source-over'; this.keep = Infinity; this.resize(w, h); }

  resize(w, h) { this.w = w; this.h = h; this.cols = Math.ceil(w / TILE); this.rows = Math.ceil(h / TILE); this.tiles = new Map(); }

  // the tiles a rectangle touches (made if `make`)
  *each(x, y, w, h, make) {
    const x0 = Math.max(0, Math.floor(x / TILE)), x1 = Math.min(this.cols - 1, Math.floor((x + w - 1e-9) / TILE));
    const y0 = Math.max(0, Math.floor(y / TILE)), y1 = Math.min(this.rows - 1, Math.floor((y + h - 1e-9) / TILE));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const k = ty * this.cols + tx; let g = this.tiles.get(k);
      if (!g) { if (!make) continue; g = mk(TILE, TILE).getContext('2d'); this.tiles.set(k, g); }
      yield [g, tx * TILE, ty * TILE];
    }
  }

  fillRect(x, y, w, h) {
    // rubbing out (destination-out) never needs a new tile
    for (const [g, ox, oy] of this.each(x, y, w, h, this.globalCompositeOperation !== 'destination-out')) {
      g.globalAlpha = this.globalAlpha; g.fillStyle = this.fillStyle; g.globalCompositeOperation = this.globalCompositeOperation;
      g.fillRect(x - ox, y - oy, w, h);
    }
  }

  clearRect(x, y, w, h) {
    if (x <= 0 && y <= 0 && x + w >= this.w && y + h >= this.h) { this.tiles.clear(); return; }
    for (const [g, ox, oy] of this.each(x, y, w, h, false)) g.clearRect(x - ox, y - oy, w, h);
  }

  // draws the window (sx, sy, w, h) of the world onto ctx at (dx, dy)
  draw(ctx, sx, sy, w, h, dx, dy) {
    for (const [g, ox, oy] of this.each(sx, sy, w, h, false)) ctx.drawImage(g.canvas, dx + ox - sx, dy + oy - sy);
    if (this.tiles.size > this.keep) {
      const cx = (sx + w / 2) / TILE, cy = (sy + h / 2) / TILE, cols = this.cols;
      const dist = k => Math.hypot(k % cols + .5 - cx, Math.floor(k / cols) + .5 - cy);
      const far = [...this.tiles.keys()].sort((a, b) => dist(b) - dist(a));
      for (const k of far.slice(0, this.tiles.size - this.keep)) this.tiles.delete(k);
    }
  }
}
