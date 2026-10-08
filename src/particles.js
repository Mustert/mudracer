import { G } from './g.js';
import { TAU, pick } from './core.js';

// ---------- particles ----------

export const WATC = ['#9fd4ff', '#ffffff', '#5aa6e8', '#cfeeff'];


export const CEMP = ['#8c9097', '#a4a9af', '#c0c4c9', '#6f747a'];


export const CONF = ['#ff5a7a', '#ffd23f', '#5ab4ff', '#7bd37b', '#ffffff', '#b36bff'];


export const RAINBOW = ['#ff4d6d', '#ff9f43', '#ffd93d', '#6bcb77', '#4d96ff', '#9b5de5'];


export function addP(p) { if (G.parts.length < 900) G.parts.push(p); }


export function drop(x, y, a, sp, vz, col, life, mud) {
  const rnd = Math.random();
  addP({ t: 'd', x, y, z: 1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz, col, s: rnd < .25 ? 3 : rnd < .6 ? 2 : 1, life, ml: life, mud });
}


export function mudBurst(c, n) {
  for (let i = 0; i < n; i++) drop(c.x - Math.cos(c.ang) * 12, c.y - Math.sin(c.ang) * 12, c.ang + Math.PI + (Math.random() - .5) * 1.8, 25 + Math.random() * 65, 55 + Math.random() * 80, pick(c.surf === 6 ? CEMP : G.T.th.mudP), 1.6, true);
}


export function splash(x, y, n) {
  for (let i = 0; i < n; i++) drop(x, y, Math.random() * TAU, 15 + Math.random() * 70, 70 + Math.random() * 90, pick(WATC), 1.6, false);
  addP({ t: 'ring', x, y, life: .7, ml: .7 });
}
