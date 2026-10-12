import { G, UI, PREFS } from './g.js';
import { downloadSave, getItem, pickSave, setItem } from './save.js';
import { AU, SFX, honk } from './audio.js';
import { CAR_DEFS, isLocked } from './cars.js';
import { carSlotAt, pickCar } from './carselect.js';
import { CUPS, cupLocked, cupReady } from './cups.js';
import { DIFF_BOX, cupRowAt } from './cupselect.js';
import { customClick, customKey, openCustom } from './custom.js';
import { setDiff, setFx, toggleKids } from './diff.js';
import { VW, clamp } from './core.js';
import { is, setInputHandlers } from './input.js';
import { beginCeremony, startGP, startRace } from './race.js';
import { openRaceOpts, raceOptsClick, raceOptsKey } from './raceopts.js';
import { startRun } from './run.js';
import { KIDS_BTN, mainCardAt } from './screens.js';
import { openShop, shopClick, shopKey } from './shop.js';
import { MODES, setState } from './state.js';
import { TRACKS } from './tracks.js';

try { PREFS.selCar = clamp(parseInt(getItem('mudracer-car') || '0', 10) || 0, 0, CAR_DEFS.length - 1); } catch (e) {}


if (isLocked(CAR_DEFS[PREFS.selCar])) PREFS.selCar = 0;



const step = (v, k, n) => (v + (is(k, 'left') ? n - 1 : 1)) % n;


const toggleMusic = () => { AU.music = !AU.music; try { setItem('mudracer-music', AU.music ? '1' : '0'); } catch (e) {} };


const toggleCtrl = () => { PREFS.CTRL = PREFS.CTRL === 'std' ? 'alt' : 'std'; try { setItem('mudracer-ctrl', PREFS.CTRL); } catch (e) {} };


export const gearVisible = () => ['main', 'select_cup', 'select_car', 'select_track', 'select_count', 'custom', 'shop'].includes(G.state);


export const menuBtnVisible = () => G.state !== 'title' && G.state !== 'main' && G.state !== 'options' && G.state !== 'pause' && G.state !== 'loading';


function openOptions() { UI.optFrom = G.state; UI.optSel = 0; setState('options'); SFX.click(); }


function closeOptions() { setState(UI.optFrom); SFX.click(); }


// the rows of the options menu: music, steering, save to a file, load from a file, back
export const OPT_ROWS = 5;

// a short message in the options menu (saved, loaded, error)
const optMsg = (s, ok) => { UI.optMsg = { s, ok, t: G.time }; };

function saveToFile() {
  try { downloadSave(); optMsg('SPIELSTAND GESICHERT', true); SFX.select(); } catch (e) { optMsg('SICHERN GEHT NICHT', false); }
}

// a loaded save takes effect after a fresh start of the page (every module reads its values when it loads)
function loadFromFile() {
  try {
    pickSave(r => {
      if (!r.ok) { optMsg(r.error, false); SFX.click(); return; }
      optMsg('GELADEN - STARTE NEU', true); SFX.select();
      setTimeout(() => location.reload(), 900);
    });
  } catch (e) { optMsg('LADEN GEHT NICHT', false); }
}

function optAct(i) {
  if (i === 0) { toggleMusic(); SFX.click(); } else if (i === 1) { toggleCtrl(); SFX.click(); }
  else if (i === 2) saveToFile(); else if (i === 3) loadFromFile(); else closeOptions();
}


function optionsKey(k) {
  if (is(k, 'up')) { UI.optSel = (UI.optSel + OPT_ROWS - 1) % OPT_ROWS; SFX.click(); }
  else if (is(k, 'down')) { UI.optSel = (UI.optSel + 1) % OPT_ROWS; SFX.click(); }
  else if (is(k, 'left') || is(k, 'right')) { if (UI.optSel < 2) optAct(UI.optSel); }
  else if (is(k, 'ok')) optAct(UI.optSel);
  else if (is(k, 'back')) closeOptions();
}


function openPause() { UI.pauseFrom = G.state; UI.pauseT = G.stateTime; UI.pauseSel = 0; setState('pause'); SFX.click(); }


function pauseAct(i) { if (i === 0) { G.state = UI.pauseFrom; G.stateTime = UI.pauseT; SFX.select(); } else { SFX.click(); setState('main'); } }


function pauseKey(k) {
  if (is(k, 'up') || is(k, 'down') || is(k, 'left') || is(k, 'right')) { UI.pauseSel = 1 - UI.pauseSel; SFX.click(); }
  else if (is(k, 'ok')) pauseAct(UI.pauseSel);
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
  if (G.state === 'custom') { customKey(k); return; }
  if (G.state === 'shop') { shopKey(k); return; }
  if (G.state === 'main') {
    if (k === 'k' || k === 'K') { toggleKids(); SFX.click(); return; }
    if (UI.mainRow === 1) {
      if (is(k, 'down') || back) { UI.mainRow = 0; SFX.click(); }
      else if (lr || ok) { toggleKids(); SFX.select(); }
      return;
    }
    if (is(k, 'up')) { UI.mainRow = 1; SFX.click(); }
    else if (lr) { UI.selMode = step(UI.selMode, k, MODES.length); UI.selAnim = G.time; SFX.click(); }
    else if (ok) {
      const id = MODES[UI.selMode].id; SFX.select();
      if (id === 'shop') { openShop(); return; }
      G.mode = id; G.tt = null; setState(G.mode === 'gp' ? 'select_cup' : G.mode === 'run' ? 'select_car' : 'select_track');
    }
  } else if (G.state === 'select_cup') {
    const ud = is(k, 'up') ? -1 : is(k, 'down') ? 1 : 0;
    if (ud) { PREFS.selCup = (PREFS.selCup + ud + CUPS.length) % CUPS.length; UI.selAnim = G.time; SFX.click(); }
    else if (lr) { if (PREFS.kids) SFX.bump(); else { setDiff(PREFS.diff + (is(k, 'left') ? -1 : 1)); setFx(PREFS.diff > 0); SFX.click(); } }
    else if (ok) {
      const cup = CUPS[PREFS.selCup];
      if (cupLocked(cup) || !cupReady(cup)) SFX.bump();
      else if (cup.custom) { SFX.select(); openCustom(); }
      else { PREFS.cup = cup; SFX.select(); setState('select_car'); }
    }
    else if (back) setState('main');
  } else if (G.state === 'select_car') {
    if (lr) pickCar(step(PREFS.selCar, k, CAR_DEFS.length));
    else if (ok) {
      if (isLocked(CAR_DEFS[PREFS.selCar])) { SFX.bump(); return; }
      SFX.select();
      if (G.mode === 'gp') startGP(); else if (G.mode === 'run') startRun(); else openRaceOpts();
    } else if (back) setState(G.mode === 'gp' ? (PREFS.cup && PREFS.cup.custom ? 'custom' : 'select_cup') : G.mode === 'run' ? 'main' : 'select_track');
  } else if (G.state === 'select_track') {
    if (lr) { PREFS.selTrack = step(PREFS.selTrack, k, TRACKS.length); UI.selAnim = G.time; SFX.click(); }
    else if (ok) { SFX.select(); setState('select_car'); }
    else if (back) setState('main');
  } else if (G.state === 'select_count') {
    raceOptsKey(k);
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
    else if (G.stateTime > 1) { SFX.select(); if (G.gp.race < G.gp.tracks.length - 1) { G.gp.race++; startRace(); } else beginCeremony(); }
  } else if (G.state === 'ceremony') {
    if (G.stateTime > 3 || k === 'Escape') { SFX.click(); setState('main'); }
  }
}

// panel geometry shared by drawing and clicking

export const OPT = { x: VW - 214, y: 32, w: 206, row: 18, r0: 28, h: 28 + 5 * 18 + 28 };


export const PAU = { x: VW / 2 - 100, y: 64, w: 200, h: 130, r0: 48, row: 30, rh: 22 };


function optionsClick(x, y) {
  if (x > VW - 34 && y < 30) { closeOptions(); return; }
  for (let i = 0; i < OPT_ROWS; i++) {
    const ry = OPT.y + OPT.r0 + i * OPT.row;
    if (x >= OPT.x + 6 && x < OPT.x + OPT.w - 6 && y >= ry && y < ry + OPT.row - 2) { UI.optSel = i; optAct(i); return; }
  }
  if (x < OPT.x || x > OPT.x + OPT.w || y > OPT.y + OPT.h) closeOptions();
}


function pauseClick(x, y) {
  for (let i = 0; i < 2; i++) {
    const ry = PAU.y + PAU.r0 + i * PAU.row;
    if (x >= PAU.x + 14 && x < PAU.x + PAU.w - 14 && y >= ry && y < ry + PAU.rh) { UI.pauseSel = i; pauseAct(i); return; }
  }
}


export function onClick(x, y) {
  if (G.state === 'options') { optionsClick(x, y); return; }
  if (G.state === 'pause') { pauseClick(x, y); return; }
  if (menuBtnVisible() && x < 30 && y < 24) { menuBtnAct(); return; }
  if (gearVisible() && x > VW - 34 && y < 30) { openOptions(); return; }
  if (G.state === 'main') {
    const b = KIDS_BTN;
    if (x >= b.x - 2 && x < b.x + b.w + 2 && y >= b.y - 2 && y < b.y + b.h + 4) { UI.mainRow = 1; onPress('Enter'); return; }
    const i = mainCardAt(x, y);
    UI.mainRow = 0;
    if (i >= 0) { if (i === UI.selMode) onPress('Enter'); else { UI.selMode = i; UI.selAnim = G.time; SFX.click(); } }
    return;
  }
  if (G.state === 'custom') { customClick(x, y); return; }
  if (G.state === 'shop') { shopClick(x, y); return; }
  if (G.state === 'select_count' && raceOptsClick(x, y)) return;
  if (G.state === 'select_cup') {
    const d = DIFF_BOX;
    if (y < d.y + d.h + 4 && x > d.x - 20 && x < d.x + d.w + 20) { onPress(x < d.x + d.w / 2 ? 'ArrowLeft' : 'ArrowRight'); return; }
    const i = cupRowAt(y);
    if (i >= 0) { if (i === PREFS.selCup) onPress('Enter'); else { PREFS.selCup = i; UI.selAnim = G.time; SFX.click(); } }
    return;
  }
  if (G.state === 'select_car') {
    const i = carSlotAt(x, y);
    if (i >= 0) { if (i === PREFS.selCar) onPress('Enter'); else pickCar(i); return; }
  }
  const side = x < VW * .27 ? 'ArrowLeft' : x > VW * .73 ? 'ArrowRight' : 'Enter';
  if (G.state === 'main' || G.state === 'select_cup' || G.state === 'select_car' || G.state === 'select_track' || G.state === 'select_count') onPress(side);
  else if (G.state === 'race' || G.state === 'countdown') onPress(' ');
  else if (G.state === 'finish' && G.mode === 'tt' && x < 60 && y < 40) onPress('Escape');
  else onPress('Enter');
}


setInputHandlers({ press: onPress, click: onClick });
