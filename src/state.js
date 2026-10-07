import { G } from './g.js';
import { TRACKS } from './tracks.js';

// ---------- game state ----------

G.state = 'title';
G.stateTime = 0;
G.time = 0;
G.selCar = 0;
G.selTrack = 0;
G.selAnim = -1;
G.selMode = 0;
G.selCount = 3;
G.mode = 'single';

// options menu (gear) and pause menu; both remember where they were opened from
// CTRL: 'std' = steering from the car's point of view (up = straight ahead), 'alt' = arrows point where the car should go on screen

G.optFrom = 'main';
G.optSel = 0;
G.pauseFrom = 'race';
G.pauseT = 0;
G.pauseSel = 0;
G.CTRL = 'std';


try { G.CTRL = localStorage.getItem('mudracer-ctrl') === 'alt' ? 'alt' : 'std'; } catch (e) {}


G.T = TRACKS[0];
G.cars = [];
G.player = null;
G.parts = [];
G.finCount = 0;
G.lastCount = -1;


G.gp = null;
G.ceremony = null;
G.run = null;
G.tt = null;
G.ttRand = null;
G.selGhost = true;


export const cam = { x: 0, y: 0 };


export const MODES = [{ id: 'gp', name: 'GRAND PRIX', sub: '5 RENNEN' }, { id: 'single', name: 'EINZELSTRECKE', sub: 'FREIE WAHL' }, { id: 'tt', name: 'ZEITFAHREN', sub: 'BESTZEITEN' }, { id: 'run', name: 'MATSCHFAHRT', sub: 'GELAENDE' }];


try { G.selGhost = localStorage.getItem('mudracer-ghost') !== '0'; } catch (e) {}
