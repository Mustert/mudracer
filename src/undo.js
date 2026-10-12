import { G } from './g.js';
import { WH, WW, clamp } from './core.js';

// ---------- what the track events share (events.js and the event parts of desert.js, ice.js, ring.js, volcano.js) ----------

// is this event on in the current race? (G.fx: all effects of the race, G.events: each one on its own)
export const eventOn = key => !!G.fx && G.events[key] !== false;

// ----- undo: the base picture and the terrain of every changed area are saved first (events.js resetTrackEvents puts them back) -----

export const bctx = T => T.bctx || (T.bctx = T.base.getContext('2d'));

export function snap(T, x, y, w, h) {
  x = clamp(x | 0, 0, WW - 1); y = clamp(y | 0, 0, WH - 1); w = Math.min(w, WW - x); h = Math.min(h, WH - y);
  const ter = new Uint8Array(w * h);
  for (let r = 0; r < h; r++) ter.set(T.ter.subarray((y + r) * WW + x, (y + r) * WW + x + w), r * w);
  (T.undo = T.undo || []).push({ x, y, w, h, ter, img: bctx(T).getImageData(x, y, w, h) });
  if (!T.pix0) T.pix0 = { mud: T.mudPix, wat: T.watPix };
}
