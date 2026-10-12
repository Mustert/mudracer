import { G } from './g.js';
import { clamp } from './core.js';

// ---------- what the track events share (events.js and the event parts of desert.js, ice.js, ring.js, volcano.js) ----------

// is this event on in the current race? (G.fx: all effects of the race, G.events: each one on its own)
export const eventOn = key => !!G.fx && G.events[key] !== false;

// ----- undo: the base picture and the terrain of every changed area are saved first (events.js resetTrackEvents puts them back) -----

export const bctx = T => T.bctx || (T.bctx = T.base.getContext('2d'));

export function snap(T, x, y, w, h) {
  x = clamp(x | 0, 0, T.W - 1); y = clamp(y | 0, 0, T.H - 1); w = Math.min(w, T.W - x); h = Math.min(h, T.H - y);
  const ter = new Uint8Array(w * h);
  for (let r = 0; r < h; r++) ter.set(T.ter.subarray((y + r) * T.W + x, (y + r) * T.W + x + w), r * w);
  (T.undo = T.undo || []).push({ x, y, w, h, ter, img: bctx(T).getImageData(x, y, w, h) });
  if (!T.pix0) T.pix0 = { mud: T.mudPix, wat: T.watPix };
}
