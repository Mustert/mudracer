import { audioInit } from './audio.js';
import { VH, VW, cv } from './core.js';
import { onClick, onPress } from './menus.js';

// ---------- input ----------

const keys = {};


const KEYS = { left: ['ArrowLeft', 'a', 'A'], right: ['ArrowRight', 'd', 'D'], up: ['ArrowUp', 'w', 'W'], down: ['ArrowDown', 's', 'S'], ok: ['Enter', ' '], back: ['Escape', 'Backspace'] };


export const is = (k, g) => KEYS[g].includes(k);


export const held = g => KEYS[g].some(k => keys[k]);


addEventListener('keydown', e => {
  if (e.key.startsWith('Arrow') || e.key === ' ' || e.key === 'Backspace') e.preventDefault();
  audioInit();
  if (!keys[e.key]) onPress(e.key);
  keys[e.key] = true;
});


addEventListener('keyup', e => { keys[e.key] = false; });


addEventListener('blur', () => { for (const k in keys) keys[k] = false; });


cv.addEventListener('pointerdown', e => {
  audioInit();
  const r = cv.getBoundingClientRect();
  onClick((e.clientX - r.left) / r.width * VW, (e.clientY - r.top) / r.height * VH);
});


export const touchBox = document.getElementById('touch'), honkBtn = document.getElementById('bh');


export const coarse = matchMedia('(pointer: coarse)').matches;


touchBox.hidden = !coarse;


touchBox.querySelectorAll('[data-k]').forEach(b => {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); audioInit(); if (!keys[k]) onPress(k); keys[k] = true; b.classList.add('on'); };
  const off = () => { keys[k] = false; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
  b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
});
