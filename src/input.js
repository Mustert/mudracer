import { VH, VW, cv } from './core.js';
import { stickRead } from './stick.js';

// ---------- input ----------
// The menus (menus.js) and the sound (main.js: audio may only start after a touch or key) register what happens on a key
// press, a tap and any first contact; input.js itself depends on nothing, so the game logic can ask held() without import circles.

/** @type {{ press: (k: string) => void, click: (x: number, y: number) => void, touch: () => void }} */
const H = { press: () => {}, click: () => {}, touch: () => {} };
export function setInputHandlers(h) { Object.assign(H, h); }

const keys = {};


// touch controls on screen: from the start on touch screens (pointer: coarse), on any other screen as soon as a finger
// touches it (laptops with a touch screen); a key press hides them again
let touchOn = matchMedia('(pointer: coarse)').matches;


const KEYS = { left: ['ArrowLeft', 'a', 'A'], right: ['ArrowRight', 'd', 'D'], up: ['ArrowUp', 'w', 'W'], down: ['ArrowDown', 's', 'S'], ok: ['Enter', ' '], back: ['Escape', 'Backspace'] };


export const is = (k, g) => KEYS[g].includes(k);


export const held = g => KEYS[g].some(k => keys[k]);


addEventListener('keydown', e => {
  if (e.key.startsWith('Arrow') || e.key === ' ' || e.key === 'Backspace') e.preventDefault();
  H.touch();
  touchOn = false;
  if (!keys[e.key]) H.press(e.key);
  keys[e.key] = true;
});


addEventListener('keyup', e => { keys[e.key] = false; });


addEventListener('blur', () => { for (const k in keys) keys[k] = false; });


addEventListener('pointerdown', e => { if (e.pointerType === 'touch') touchOn = true; }, true);


cv.addEventListener('pointerdown', e => {
  H.touch();
  const r = cv.getBoundingClientRect();
  H.click((e.clientX - r.left) / r.width * VW, (e.clientY - r.top) / r.height * VH);
});


// ---------- touch controls ----------
// update.js shows them (touchShown) and picks the layout (setTouchMode):
//   'menu'   arrow cross on the left, OK on the right
//   'std'    race with standard steering: left/right on the left, GAS and brake on the right, one job per thumb
//   'stick'  race with alternative steering: a stick on the left that points where the car should go, at any angle
export const touchBox = document.getElementById('touch'), honkBtn = document.getElementById('bh');


export const touchShown = () => touchOn;


let mode = 'menu';


// the fingers on each button: a button lets go of its key only when its last finger is off
const fingers = new Map();


function pressBtn(b, id) {
  const k = b.dataset.k, f = fingers.get(b);
  f.add(id);
  if (f.size > 1) return;
  H.touch(); if (!keys[k]) H.press(k); keys[k] = true; b.classList.add('on');
}


function releaseBtn(b, id) {
  const f = fingers.get(b);
  if (!f.delete(id) || f.size) return;
  keys[b.dataset.k] = false; b.classList.remove('on');
}


touchBox.querySelectorAll('[data-k]').forEach((/** @type {HTMLElement} */ b) => {
  fingers.set(b, new Set());
  // no pointer capture: a thumb may slide from one button to the next (left to right) without lifting
  b.addEventListener('pointerdown', e => { e.preventDefault(); if (b.hasPointerCapture(e.pointerId)) b.releasePointerCapture(e.pointerId); pressBtn(b, e.pointerId); });
  b.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse' && e.buttons) pressBtn(b, e.pointerId); });
  for (const t of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(t, (/** @type {PointerEvent} */ e) => releaseBtn(b, e.pointerId));
});


// the stick: wherever the thumb lands in the zone at the bottom left, the stick moves there and the knob follows the thumb
const zone = document.getElementById('sz'), base = document.getElementById('sb'), knob = document.getElementById('sk');
const BASE_R = 64, TRAVEL = 48;
let stickId = null, sx = 0, sy = 0, st = stickRead(0, 0, TRAVEL);


function stickMove(e) {
  st = stickRead(e.clientX - sx, e.clientY - sy, TRAVEL);
  knob.style.transform = `translate(${st.x * TRAVEL}px, ${st.y * TRAVEL}px)`;
  base.classList.toggle('on', st.on);
}


function stickUp() {
  stickId = null; st = stickRead(0, 0, TRAVEL);
  base.removeAttribute('style'); knob.removeAttribute('style'); base.classList.remove('on');
}


zone.addEventListener('pointerdown', e => {
  e.preventDefault(); H.touch();
  if (stickId !== null) return;
  stickId = e.pointerId;
  sx = Math.max(BASE_R + 4, Math.min(innerWidth - BASE_R - 4, e.clientX));
  sy = Math.max(BASE_R + 4, Math.min(innerHeight - BASE_R - 4, e.clientY));
  Object.assign(base.style, { left: sx - BASE_R + 'px', top: sy - BASE_R + 'px', bottom: 'auto' });
  stickMove(e);
  try { zone.setPointerCapture(e.pointerId); } catch (err) {} // the thumb may leave the zone and still steer
});
zone.addEventListener('pointermove', e => { if (e.pointerId === stickId) stickMove(e); });
for (const t of ['pointerup', 'pointercancel']) zone.addEventListener(t, (/** @type {PointerEvent} */ e) => { if (e.pointerId === stickId) stickUp(); });


/** where the stick points (radians on the screen), or null when it is not pushed */
export const stickDir = () => mode === 'stick' && st.on ? st.ang : null;


/** any direction held, by key, button or stick (that is gas in the alternative steering) */
export const dirHeld = () => ['left', 'right', 'up', 'down'].some(held) || stickDir() !== null;


/** the layout of the touch controls; on a change every touch button and the stick let go, so nothing stays held */
export function setTouchMode(m) {
  if (m === mode) return;
  mode = m; touchBox.dataset.mode = m;
  for (const [b, f] of fingers) if (f.size) { f.clear(); keys[b.dataset.k] = false; b.classList.remove('on'); }
  stickUp();
}
