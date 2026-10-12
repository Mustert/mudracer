// ---------- shared mutable state, in three parts ----------
// What used to be top-level `let` variables. Who sets a field first is noted in brackets. New fields belong into one of the
// three objects and into its list here.

// G: the game flow and the race
//   state       which screen: 'title', 'main', 'select_cup', 'select_car', 'select_track', 'select_count', 'custom', 'shop',
//               'options', 'pause', 'loading', 'countdown', 'race', 'finish', 'standings', 'ceremony' (change it with state.js setState)
//   stateTime   seconds on this screen; time = seconds since the start (both move in fixed steps, clock.js); last = rAF time (main.js)
//   mode        what is played: 'gp', 'single', 'tt', 'run' (state.js)
//   loading     { T, sets, then } while the loading screen builds a track and sprites (idle.js)
//   T           the current track (tracks.js, or the Matschfahrt RUN, run.js); cars, player, parts (particles)
//   fx, raceDiff  effects and difficulty of this race (race.js); finCount, lastCount (finish order, countdown beep)
//   gp          Grand Prix in progress { cup, diff, tracks, race, entries }; ceremony (the award screen)
//   tt, ttRand  time trial run and its fixed random numbers (timetrial.js); run = Matschfahrt counters; jumpShake (trackfx.js)
//   VIGNETTE    the dark gradient of the forest night (events.js, made once)
/** @type {Record<string, any>} */
export const G = {};

// UI: where the menus are (nothing of it is saved)
//   optFrom, optSel, optMsg       options menu: where it was opened, focused row, message after saving or loading (state.js, menus.js)
//   pauseFrom, pauseT, pauseSel   pause menu: the race state it interrupts, its stateTime, focused row (state.js)
//   mainRow, selMode, selAnim     main menu row (cards / kids switch), focused card, when the last choice changed (pop animation)
//   cuRow, cuPick, raceRow, shop  custom cup editor, race options and workshop screens (custom.js, raceopts.js, shop.js)
/** @type {Record<string, any>} */
export const UI = {};

// PREFS: the player's choices and settings (most of them are kept in the save game, save.js)
//   selCar, selTrack, selCount, selCup, cup (the chosen cup object), selGhost (state.js, menus.js)
//   diff, kids, selFx   difficulty 0..2, kids mode, track effects switch (diff.js); CTRL 'std' / 'alt' steering (state.js)
//   events      one switch per track event (state.js); custom = { tracks, count } the custom cup (cups.js)
//   cupsWon     numbers of the cups won (cars.js)
/** @type {Record<string, any>} */
export const PREFS = {};

// Everything else lives in its own module (e.g. cam in state.js, AU in audio.js).
