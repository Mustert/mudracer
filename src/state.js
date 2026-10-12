import { G, UI, PREFS } from './g.js';
import { getItem } from './save.js';
import { TRACKS } from './tracks.js';

// ---------- game state ----------

G.state = 'title';
G.stateTime = 0;
G.time = 0;
PREFS.selCar = 0;
PREFS.selTrack = 0;
UI.selAnim = -1;
UI.selMode = 0;
PREFS.selCount = 3;
PREFS.selCup = 0;
// track events (cows, rain, flood, koi, dump trucks, train, tyres, sandstorm, frost, penguins), one switch each; G.fx turns all of them on or off for a race (diff.js)
PREFS.events = { kuehe: true, regen: true, flut: true, kois: true, kipper: true, zug: true, reifen: true, sandsturm: true, frost: true, pinguine: true, ausbruch: true, baeume: true, kroko: true };
G.fx = true;
PREFS.cup = null;
G.mode = 'single';

// options menu (gear) and pause menu; both remember where they were opened from
// CTRL: 'std' = steering from the car's point of view (up = straight ahead), 'alt' = arrows point where the car should go on screen

UI.optFrom = 'main';
UI.optSel = 0;
UI.pauseFrom = 'race';
UI.pauseT = 0;
UI.pauseSel = 0;
PREFS.CTRL = 'std';


try { PREFS.CTRL = getItem('mudracer-ctrl') === 'alt' ? 'alt' : 'std'; } catch (e) {}


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
PREFS.selGhost = true;


export const cam = { x: 0, y: 0 };

// a new screen (state): its clock starts at 0. Modules that have to act on a change register with onState (events.js puts
// the tracks back when a menu opens). This lives here and not in menus.js, so the game logic does not import the menus.
const watchers = [];
export function onState(fn) { watchers.push(fn); }
export function setState(s) { G.state = s; G.stateTime = 0; for (const fn of watchers) fn(s); }


// short: the name on a narrow (not focused) card of the main menu
export const MODES = [{ id: 'gp', name: 'GRAND PRIX', short: 'GRAND PRIX', sub: 'CUPS' }, { id: 'single', name: 'EINZELSTRECKE', short: 'EINZEL', sub: 'FREIE WAHL' }, { id: 'tt', name: 'ZEITFAHREN', short: 'ZEITFAHREN', sub: 'BESTZEITEN' },
  { id: 'run', name: 'MATSCHFAHRT', short: 'MATSCH', sub: 'GELAENDE' }, { id: 'shop', name: 'WERKSTATT', short: 'WERKSTATT', sub: 'LACKIEREN' }];

// main menu: 0 = the cards, 1 = the kids mode switch (top left)
UI.mainRow = 0;


try { PREFS.selGhost = getItem('mudracer-ghost') !== '0'; } catch (e) {}
