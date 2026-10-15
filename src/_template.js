// ---------- template: the runtime module of a special track (copy it to src/<name>.js and keep only the hooks the track needs) ----------
// A special track has a flag in its TRACK_DEFS entry (toys: true). Two tables hang it in:
// - tracks.js MAPS: its map module (<name>map.js) with terrain (before the painting) and paint (its decor); what paint returns becomes
//   G.T.<flag> (state of the track: masks, places, jumps, pushes, alt ...).
// - hooks.js HOOKS: this hooks object. The core only calls what is there: trackHooks(G.T).ground?.(c, j, sp, dt).
// Every hook is optional. c is a car, T the track (G.T during a race), j the index of the pixel under the car (y * T.W + x),
// sp its speed (px/s), dt the step (s). Fields in T.ev start with the short name of the track (T22), own terrain codes see physics.js surfOf (T21).

/**
 * @typedef {Object} TrackHooks
 * @property {(T: any) => void} [init] events.js setupEvents, at the start of a race: what the track always has (not an event), into T.ev
 * @property {Record<string, (T: any) => void>} [events] events.js: event name (def.events, PREFS.events) -> starts it at the start of a race, if it is on
 * @property {(T: any, dt: number) => void} [update] events.js updateEvents, every step of a race (not the Matschfahrt), before the shared events
 * @property {() => void} [collisions] events.js eventCollisions, every step: cars against the things of the track (after kois, trucks, tyres)
 * @property {(c: any) => (number[] | null)} [surf] physics.js surfOf, first: [speed, grip, steering, gas] on an own terrain code, null = shared table
 * @property {(c: any) => any} [target] physics.js aiTarget, first: a point [x, y] a computer car heads for instead of the road, or null
 * @property {number} [wander] physics.js aiTarget: how much the computer cars wander across the road (factor, default 1)
 * @property {boolean} [avoidAll] physics.js aiTarget: every computer car steers round bad ground, not only the ones bad in mud
 * @property {(c: any, i: number, lane: number) => number} [lane] physics.js aiTarget: the offset from the centre line at path index i (returns the new one)
 * @property {(c: any, thr: number) => number} [throttle] update.js updateRace: the gas of a computer car (returns the new one)
 * @property {(c: any, dt: number, racing: boolean) => boolean} [stuck] update.js updateRace, before steering: true = the car is held (snowed in ...) this step
 * @property {(c: any, j: number, sp: number, dt: number) => void} [ground] update.js updateRace, after the shared ground (mud, water, jumps): the car is
 *   skipped for the rest of the step when it falls (c.fall > 0)
 * @property {(t: number, T: any) => boolean} [noRespawn] update.js respawn: true = terrain t is no place to set a car back down
 * @property {(c: any) => void} [respawn] update.js respawn, after the car is set back on the road (instead of the splash)
 * @property {(c: any, F: any, rot: number, lv: number) => boolean} [drawCar] draw.js drawCar, first: true = the track drew the car itself
 * @property {(c: any, F: any, lv: number) => boolean} [drawFall] draw.js drawCar, while the car falls (c.fallKind): true = drawn
 * @property {() => void} [drawGround] draw.js drawRace: under the cars (in world coordinates)
 * @property {(cx: number, cy: number) => void} [drawAbove] draw.js drawRace: over the cars and the top layer (world coordinates; cx, cy = camera)
 * @property {(cx: number, cy: number) => void} [drawSky] draw.js drawRace: on the screen, after night and rain (weather, darkness, messages)
 */

/** @type {TrackHooks} */
export const TEMPLATE_HOOKS = {
  init(T) {},
  events: {},
  update(T, dt) {},
  collisions() {},
  surf(c) { return null; },
  target(c) { return null; },
  wander: 1,
  avoidAll: false,
  lane(c, i, lane) { return lane; },
  throttle(c, thr) { return thr; },
  stuck(c, dt, racing) { return false; },
  ground(c, j, sp, dt) {},
  noRespawn(t, T) { return false; },
  respawn(c) {},
  drawCar(c, F, rot, lv) { return false; },
  drawFall(c, F, lv) { return false; },
  drawGround() {},
  drawAbove(cx, cy) {},
  drawSky(cx, cy) {},
};
