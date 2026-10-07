import { G } from './g.js';
import { AU, HONK_LEN, SFX } from './audio.js';
import { CAR_DEFS, isLocked } from './cars.js';
import { VW, clamp } from './core.js';
import { is } from './input.js';
import { beginCeremony, startGP, startRace } from './race.js';
import { startRun } from './run.js';
import { MODES } from './state.js';
import { TRACKS } from './tracks.js';

export const GP_ORDER = [0, 1, 2, 4, 3];
 // Wiese, Wald, Strand, Zug, Regenbogen (Weltraum)

export const POINTS = [10, 8, 6, 5, 4, 3, 2, 1];


try { G.selCar = clamp(parseInt(localStorage.getItem('mudracer-car') || '0', 10) || 0, 0, CAR_DEFS.length - 1); } catch (e) {}


if (isLocked(CAR_DEFS[G.selCar])) G.selCar = 0;



export function setState(s) { G.state = s; G.stateTime = 0; }


export function honk(c) {
  if (c.honk > 0) return;
  c.honk = HONK_LEN[c.def.honk];
  SFX.honk[c.def.honk]();
}


const step = (v, k, n) => (v + (is(k, 'left') ? n - 1 : 1)) % n;


const toggleMusic = () => { AU.music = !AU.music; try { localStorage.setItem('mudracer-music', AU.music ? '1' : '0'); } catch (e) {} };


const toggleCtrl = () => { G.CTRL = G.CTRL === 'std' ? 'alt' : 'std'; try { localStorage.setItem('mudracer-ctrl', G.CTRL); } catch (e) {} };


export const gearVisible = () => G.state === 'main' || G.state === 'select_car' || G.state === 'select_track' || G.state === 'select_count';


export const menuBtnVisible = () => G.state !== 'title' && G.state !== 'main' && G.state !== 'options' && G.state !== 'pause';


function openOptions() { G.optFrom = G.state; G.optSel = 0; setState('options'); SFX.click(); }


function closeOptions() { setState(G.optFrom); SFX.click(); }


function optAct(i) { if (i === 0) { toggleMusic(); SFX.click(); } else if (i === 1) { toggleCtrl(); SFX.click(); } else closeOptions(); }


function optionsKey(k) {
  if (is(k, 'up')) { G.optSel = (G.optSel + 2) % 3; SFX.click(); }
  else if (is(k, 'down')) { G.optSel = (G.optSel + 1) % 3; SFX.click(); }
  else if (is(k, 'left') || is(k, 'right')) { if (G.optSel < 2) optAct(G.optSel); }
  else if (is(k, 'ok')) optAct(G.optSel);
  else if (is(k, 'back')) closeOptions();
}


function openPause() { G.pauseFrom = G.state; G.pauseT = G.stateTime; G.pauseSel = 0; setState('pause'); SFX.click(); }


function pauseAct(i) { if (i === 0) { G.state = G.pauseFrom; G.stateTime = G.pauseT; SFX.select(); } else { SFX.click(); setState('main'); } }


function pauseKey(k) {
  if (is(k, 'up') || is(k, 'down') || is(k, 'left') || is(k, 'right')) { G.pauseSel = 1 - G.pauseSel; SFX.click(); }
  else if (is(k, 'ok')) pauseAct(G.pauseSel);
  else if (k === 'Escape' || k === 'p' || k === 'P') pauseAct(0);
}

// the menu button (top left) goes straight to the main menu, during a race it opens the pause menu first

function menuBtnAct() { if (G.state === 'countdown' || G.state === 'race') openPause(); else { SFX.click(); setState('main'); } }


export function onPress(k) {
  if (G.state === 'title') { if (!['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(k)) { SFX.select(); setState('main'); } return; }
  if (k === 'm' || k === 'M') { AU.muted = !AU.muted; if (AU.m) AU.m.gain.setTargetAtTime(AU.muted ? 0 : .8, AU.a.currentTime, .05); return; }
  if (k === 'n' || k === 'N') { toggleMusic(); return; }
  if ((k === 'o' || k === 'O') && (gearVisible() || G.state === 'options')) { if (G.state === 'options') closeOptions(); else openOptions(); return; }
  const lr = is(k, 'left') || is(k, 'right'), ok = is(k, 'ok'), back = is(k, 'back');
  if (G.state === 'options') { optionsKey(k); return; }
  if (G.state === 'pause') { pauseKey(k); return; }
  if (G.state === 'main') {
    if (lr) { G.selMode = step(G.selMode, k, MODES.length); G.selAnim = G.time; SFX.click(); }
    else if (ok) { G.mode = MODES[G.selMode].id; G.tt = null; SFX.select(); setState('select_car'); }
  } else if (G.state === 'select_car') {
    if (lr) {
      G.selCar = step(G.selCar, k, CAR_DEFS.length); G.selAnim = G.time;
      if (isLocked(CAR_DEFS[G.selCar])) SFX.click(); else { SFX.honk[CAR_DEFS[G.selCar].honk](); try { localStorage.setItem('mudracer-car', G.selCar); } catch (e) {} }
    } else if (ok) {
      if (isLocked(CAR_DEFS[G.selCar])) { SFX.bump(); return; }
      SFX.select();
      if (G.mode === 'gp') startGP(); else if (G.mode === 'run') startRun(); else setState('select_track');
    } else if (back) setState('main');
  } else if (G.state === 'select_track') {
    if (lr) { G.selTrack = step(G.selTrack, k, TRACKS.length); G.selAnim = G.time; SFX.click(); }
    else if (ok) { SFX.select(); setState('select_count'); }
    else if (back) setState('select_car');
  } else if (G.state === 'select_count') {
    if (lr && G.mode === 'tt') { G.selGhost = !G.selGhost; G.selAnim = G.time; SFX.click(); try { localStorage.setItem('mudracer-ghost', G.selGhost ? '1' : '0'); } catch (e) {} }
    else if (lr) { G.selCount = clamp(G.selCount + (is(k, 'left') ? -1 : 1), 1, 7); G.selAnim = G.time; SFX.click(); }
    else if (ok) startRace();
    else if (back) setState('select_track');
  } else if (G.state === 'countdown' || G.state === 'race') {
    if (k === ' ') honk(G.player);
    else if (k === 'Escape' || k === 'p' || k === 'P') openPause();
  } else if (G.state === 'finish') {
    if (k === 'Escape') { SFX.click(); setState('main'); }
    else if (k === ' ' && G.stateTime < 2) honk(G.player);
    else if (G.stateTime > 2) {
      SFX.click();
      if (G.mode === 'tt') { if (back) setState('main'); else startRace(); } // ENTER = one more try
      else setState(G.mode === 'gp' ? 'standings' : 'main');
    }
  } else if (G.state === 'standings') {
    if (k === 'Escape') { SFX.click(); setState('main'); }
    else if (G.stateTime > 1) { SFX.select(); if (G.gp.race < GP_ORDER.length - 1) { G.gp.race++; startRace(); } else beginCeremony(); }
  } else if (G.state === 'ceremony') {
    if (G.stateTime > 3 || k === 'Escape') { SFX.click(); setState('main'); }
  }
}

// panel geometry shared by drawing and clicking

export const OPT = { x: VW - 214, y: 32, w: 206, row: 18, r0: 28 };


export const PAU = { x: VW / 2 - 100, y: 64, w: 200, h: 130, r0: 48, row: 30, rh: 22 };


function optionsClick(x, y) {
  if (x > VW - 34 && y < 30) { closeOptions(); return; }
  for (let i = 0; i < 3; i++) {
    const ry = OPT.y + OPT.r0 + i * OPT.row;
    if (x >= OPT.x + 6 && x < OPT.x + OPT.w - 6 && y >= ry && y < ry + OPT.row - 2) { G.optSel = i; optAct(i); return; }
  }
  if (x < OPT.x || x > OPT.x + OPT.w || y > OPT.y + 120) closeOptions();
}


function pauseClick(x, y) {
  for (let i = 0; i < 2; i++) {
    const ry = PAU.y + PAU.r0 + i * PAU.row;
    if (x >= PAU.x + 14 && x < PAU.x + PAU.w - 14 && y >= ry && y < ry + PAU.rh) { G.pauseSel = i; pauseAct(i); return; }
  }
}


export function onClick(x, y) {
  if (G.state === 'options') { optionsClick(x, y); return; }
  if (G.state === 'pause') { pauseClick(x, y); return; }
  if (menuBtnVisible() && x < 30 && y < 24) { menuBtnAct(); return; }
  if (gearVisible() && x > VW - 34 && y < 30) { openOptions(); return; }
  const side = x < VW * .27 ? 'ArrowLeft' : x > VW * .73 ? 'ArrowRight' : 'Enter';
  if (G.state === 'main' || G.state === 'select_car' || G.state === 'select_track' || G.state === 'select_count') onPress(side);
  else if (G.state === 'race' || G.state === 'countdown') onPress(' ');
  else if (G.state === 'finish' && G.mode === 'tt' && x < 60 && y < 40) onPress('Escape');
  else onPress('Enter');
}
