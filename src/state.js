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
G.selCup = 0;
// track events (cows, rain, flood, koi, dump trucks, train, tyres, sandstorm, frost, penguins), one switch each; G.fx turns all of them on or off for a race (diff.js)
G.events = { kuehe: true, regen: true, flut: true, kois: true, kipper: true, zug: true, reifen: true, sandsturm: true, frost: true, pinguine: true, ausbruch: true };
G.fx = true;
G.cup = null;
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


// short: the name on a narrow (not focused) card of the main menu
export const MODES = [{ id: 'gp', name: 'GRAND PRIX', short: 'GRAND PRIX', sub: 'CUPS' }, { id: 'single', name: 'EINZELSTRECKE', short: 'EINZEL', sub: 'FREIE WAHL' }, { id: 'tt', name: 'ZEITFAHREN', short: 'ZEITFAHREN', sub: 'BESTZEITEN' },
  { id: 'run', name: 'MATSCHFAHRT', short: 'MATSCH', sub: 'GELAENDE' }, { id: 'shop', name: 'WERKSTATT', short: 'WERKSTATT', sub: 'LACKIEREN' }];

// main menu: 0 = the cards, 1 = the kids mode switch (top left)
G.mainRow = 0;


try { G.selGhost = localStorage.getItem('mudracer-ghost') !== '0'; } catch (e) {}
