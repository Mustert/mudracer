// shared mutable game state (what used to be top-level `let` variables). Who sets a field first is noted in brackets.
// The fields fall into four groups; new fields belong into one of them and into this list.
//
// Screens and clock
//   state       which screen: 'title', 'main', 'select_cup', 'select_car', 'select_track', 'select_count', 'custom', 'shop',
//               'options', 'pause', 'loading', 'countdown', 'race', 'finish', 'standings', 'ceremony' (change it with state.js setState)
//   stateTime   seconds on this screen; time = seconds since the start (both move in fixed steps, clock.js); last = rAF time (main.js)
//   optFrom, optSel, optMsg       options menu: where it was opened, focused row, message after saving or loading (state.js, menus.js)
//   pauseFrom, pauseT, pauseSel   pause menu: the race state it interrupts, its stateTime, focused row (state.js)
//   mainRow, selMode, selAnim     main menu row (cards / kids switch), focused card, when the last choice changed (pop animation)
//   cuRow, cuPick, raceRow, shop  custom cup editor, race options and workshop screens (custom.js, raceopts.js, shop.js)
//   loading     { T, sets, then } while the loading screen builds a track and sprites (idle.js)
//
// Choices and settings (most are kept in the save game, save.js)
//   mode        'gp', 'single', 'tt', 'run'; selCar, selTrack, selCount, selCup, cup (the chosen cup object), selGhost
//   diff, kids, selFx   difficulty 0..2, kids mode, track effects switch (diff.js); CTRL 'std' / 'alt' steering (state.js)
//   events      one switch per track event (state.js); custom = { tracks, count } the custom cup (cups.js)
//   cupsWon     numbers of the cups won (cars.js)
//
// The race
//   T           the current track (tracks.js, or the Matschfahrt RUN, run.js); cars, player, parts (particles)
//   fx, raceDiff  effects and difficulty of this race (race.js); finCount, lastCount (finish order, countdown beep)
//   gp          Grand Prix in progress { cup, diff, tracks, race, entries }; ceremony (the award screen)
//   tt, ttRand  time trial run and its fixed random numbers (timetrial.js); run = Matschfahrt counters; jumpShake (trackfx.js)
//   VIGNETTE    the dark gradient of the forest night (events.js, made once)
//
// Everything else the game keeps lives in its own module (e.g. cam in state.js, AU in audio.js).

/** @type {Record<string, any>} */
export const G = {};
