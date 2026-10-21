import { ringHooks } from './ring.js';
import { desertHooks } from './desert.js';
import { iceHooks } from './ice.js';
import { volcanoHooks } from './volcano.js';
import { jungleHooks } from './jungle.js';
import { spaceHooks } from './space.js';
import { suessHooks } from './suess.js';
import { toyHooks } from './toys.js';
import { rainbowHooks } from './rainbow.js';
import { strandHooks } from './strand.js';

// ---------- the special tracks: the flag in their TRACK_DEFS entry (desert: true ...) -> the hooks of their runtime module ----------
// What each hook does and when it is called: _template.js. G.T.<flag> is what the map module built (tracks.js MAPS), a track has one flag at most.
// The track modules import tracks.js and trackfx.js, so those two (and the sound) cannot ask for hooks; the rest of the core asks here.

/** @typedef {import('./_template.js').TrackHooks} TrackHooks */

/** @type {Record<string, TrackHooks>} */
const HOOKS = { ring: ringHooks, desert: desertHooks, ice: iceHooks, volcano: volcanoHooks, jungle: jungleHooks, space: spaceHooks, suess: suessHooks, toys: toyHooks, rainbow: rainbowHooks, beach: strandHooks };
const NONE = /** @type {TrackHooks} */ ({});

/** @returns {TrackHooks} the hooks of track T (an empty object for the plain tracks) */
export function trackHooks(T) {
  if (T) for (const k in HOOKS) if (T[k]) return HOOKS[k];
  return NONE;
}

// the events of all special tracks by name (events.js INIT)
export const TRACK_EVENTS = Object.assign({}, ...Object.values(HOOKS).map(h => h.events || {}));
