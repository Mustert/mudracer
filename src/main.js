import { G } from './g.js';
import { audioInit } from './audio.js';
import { clamp, ctx } from './core.js';
import { drawRace } from './draw.js';
import { gearVisible, menuBtnVisible } from './menus.js';
import { drawGear, drawMenuBtn, drawOptions, drawPause, drawState } from './ui.js';
import { update } from './update.js';

G.last = performance.now();


function loop(now) {
  // the first rAF timestamp can be earlier than `last`, so never let time run backwards
  const dt = clamp((now - G.last) / 1000, 0, .05); G.last = Math.max(G.last, now); G.time += dt; G.stateTime += dt;
  requestAnimationFrame(loop);
  try {
    update(dt);
    ctx.imageSmoothingEnabled = false;
    if (G.state === 'options') { drawState(G.optFrom); drawOptions(); }
    else if (G.state === 'pause') { drawRace(); drawPause(); }
    else {
      drawState(G.state);
      if (gearVisible()) drawGear(false);
      if (menuBtnVisible()) drawMenuBtn();
    }
  } catch (e) { console.error(e); }
}


requestAnimationFrame(loop);

// the title screen has music too: start it right away; if the browser holds it back until the first touch or key, it starts then

audioInit();


addEventListener('pointerup', audioInit);
