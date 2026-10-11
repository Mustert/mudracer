import { G } from './g.js';
import { audioInit } from './audio.js';
import { makeClock } from './clock.js';
import { FONT, VH, VW, angDiff, ctx } from './core.js';
import { drawRace } from './draw.js';
import { ERR, reportError } from './errors.js';
import { idleWork } from './idle.js';
import { gearVisible, menuBtnVisible } from './menus.js';
import { cam } from './state.js';
import { drawGear, drawMenuBtn, drawOptions, drawPause, drawState } from './ui.js';
import { update } from './update.js';
import fontUrl from '@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2?url';

// ---------- main loop: fixed steps (clock.js), drawn in between ----------

const clock = makeClock(), MOVING = new Set(['countdown', 'race', 'finish', 'pause']);

// where the cars and the camera were before the step, so a fast screen can draw them in between two steps
function remember() {
  for (const c of G.cars) { c.px = c.x; c.py = c.y; c.pa = c.ang; }
  cam.px = cam.x; cam.py = cam.y;
}

function tick(dt) {
  remember();
  G.time += dt; G.stateTime += dt;
  update(dt);
}

// draws with the cars and the camera a share `a` of the way from the last step to the current one (big jumps are not smoothed)
function drawBetween(a, draw) {
  if (!MOVING.has(G.state) || a <= 0) { draw(); return; }
  const keep = G.cars.map(c => [c.x, c.y, c.ang]), kx = cam.x, ky = cam.y, b = a - 1;
  for (const c of G.cars) if (c.px !== undefined && Math.abs(c.x - c.px) + Math.abs(c.y - c.py) < 40) { c.x += (c.x - c.px) * b; c.y += (c.y - c.py) * b; c.ang += angDiff(c.ang, c.pa) * b; }
  if (cam.px !== undefined && Math.abs(cam.x - cam.px) + Math.abs(cam.y - cam.py) < 60) { cam.x += (cam.x - cam.px) * b; cam.y += (cam.y - cam.py) * b; }
  try { draw(); } finally { G.cars.forEach((c, i) => { [c.x, c.y, c.ang] = keep[i]; }); cam.x = kx; cam.y = ky; }
}

function drawFrame() {
  ctx.imageSmoothingEnabled = false;
  if (G.state === 'options') { drawState(G.optFrom); drawOptions(); }
  else if (G.state === 'pause') { drawRace(); drawPause(); }
  else {
    drawState(G.state);
    if (gearVisible()) drawGear(false);
    if (menuBtnVisible()) drawMenuBtn();
  }
}

// dev server only: the last error stays on the screen
function drawError() {
  ctx.fillStyle = 'rgba(160,20,20,.85)'; ctx.fillRect(0, VH - 22, VW, 22);
  ctx.font = '8px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#ffffff';
  ctx.fillText(('FEHLER ' + ERR.n + ': ' + ERR.msg).slice(0, 58), 4, VH - 15);
}

function loop(now) {
  requestAnimationFrame(loop);
  frameAt(now);
}

function frameAt(now) {
  // the first rAF timestamp can be earlier than `last`, so never let time run backwards
  const frame = Math.max(0, now - G.last) / 1000; G.last = Math.max(G.last, now);
  try {
    const a = clock.advance(frame, tick);
    drawBetween(a, drawFrame);
    idleWork();
  } catch (e) { reportError(e, 'Hauptschleife'); }
  if (import.meta.env.DEV && ERR.n) drawError();
}

addEventListener('error', e => reportError(e.error || e.message, 'Fenster'));
addEventListener('unhandledrejection', e => reportError(e.reason, 'Promise'));

// the pixel font is part of the game (no font server, works offline); the first frame waits for it, a second at most
async function start() {
  try {
    const face = new FontFace('Press Start 2P', 'url(' + fontUrl + ')');
    document.fonts.add(face);
    await Promise.race([face.load(), new Promise(r => setTimeout(r, 1000))]);
  } catch (e) { reportError(e, 'Schrift'); }
  G.last = performance.now();
  requestAnimationFrame(loop);
}

start();

// the title screen has music too: start it right away; if the browser holds it back until the first touch or key, it starts then

audioInit();


addEventListener('pointerup', audioInit);

// dev server only: a handle for the browser console and for checks (the module instances the game really uses)
if (import.meta.env.DEV) Promise.all([import('./race.js'), import('./tracks.js'), import('./cars.js'), import('./clock.js')]).then(([race, tracks, cars, clockM]) => { window.mudracer = { G, cam, race, tracks, cars, clock: clockM, frameAt }; });
