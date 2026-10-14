import { G } from './g.js';
import { LAPS } from './core.js';

// ---------- the song of Süßigkeitenland: "candy", bubblegum pop in F major, 128 BPM ----------
// A kazoo plays the bouncy tune (a saw through a nasal formant, a little buzz), a music-box celesta answers on the offbeats, pizzicato strings
// pluck the eighths. A soft four on the floor, hand claps on 2 and 4, fizzy blips instead of hi-hats, a hopping synth bass (root, octave,
// fifth). From lap 2 (the chocolate) a deep "melting" bass slides down at the end of every bar; in the last lap the song moves up to G major
// and a choir sings "ooh".
// The tones come from audio.js through music.js (`A` = { synth, voice, noise }), so this module does not import the sound (no import circle).

const lap = () => G.player && G.T && !G.T.run && (G.state === 'race' || G.state === 'finish') ? G.player.lap : 1;

export function candySong(A, hz, mel) {
  const { synth, voice, noise } = A;
  // the instruments of the song (M is the music player: sd = a sixteenth, out and leadBus are its outputs)
  const kazoo = (M, f, t, d) => {
    synth({ at: t, f, parts: [['sawtooth', 1, .7], ['square', 1, .3, 10]], a: .02, hold: Math.max(0, d * .8), d: .08, vol: .11, ft: 'bandpass', lp: 1250, q: 2.2, vib: [6.5, .012], dest: M.leadBus });
    synth({ at: t, f, parts: [['sawtooth', 2, .4]], a: .02, hold: Math.max(0, d * .7), d: .06, vol: .03, ft: 'bandpass', lp: 2800, q: 4, dest: M.leadBus });
    noise({ at: t, type: 'bandpass', f: Math.min(6000, f * 4), q: 3, a: .01, hold: Math.max(0, d * .6), d: .05, vol: .012, dest: M.leadBus });
  };
  const pizz = (M, f, t) => synth({ at: t, f, parts: [['triangle', 1, 1], ['sawtooth', 2, .2]], a: .002, d: .14, vol: .07, lp: 2600, lpTo: 600, lpT: .1, dest: M.out });
  const bounce = (M, f, t, d) => synth({ at: t, f, parts: [['square', 1, .5], ['triangle', 1, .8]], a: .004, hold: d * .3, d: d * .5, vol: .13, lp: 1200, lpTo: 300, dest: M.out });
  const fizz = (M, t) => { for (let k = 0; k < 2; k++) { const f = 2200 + Math.random() * 2600; voice({ at: t + Math.random() * M.sd * .8, f, to: f * 1.7, a: .002, d: .03, vol: .022, dest: M.out }); } };
  const melt = (M, f, t) => voice({ at: t, type: 'sawtooth', f, to: f / 2, a: .03, hold: M.sd * 2, d: M.sd * 2.5, vol: .1, lp: 700, dest: M.out });
  return {
    bpm: 128, swing: 0,
    up: () => lap() >= LAPS ? 2 : 0, // the last lap: up to G major
    chords: { F: { r: 41, n: [57, 60, 65] }, Dm: { r: 38, n: [57, 62, 65] }, Bb: { r: 46, n: [58, 62, 65] }, C: { r: 36, n: [55, 60, 64] }, Gm: { r: 43, n: [55, 58, 62] }, Am: { r: 45, n: [57, 60, 64] } },
    A: { ch: ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Gm', 'C'], mel: mel([
      'C6:0:2 A5:2:2 C6:4:2 F6:6:2 E6:8:2 F6:10:2 A6:12:4', 'G6:0:2 F6:2:2 D6:4:4 A5:8:2 C6:10:2 D6:12:4',
      'D6:0:2 F6:2:2 A#6:4:4 A6:8:2 G6:10:2 F6:12:4', 'E6:0:3 D6:3:1 C6:4:4 G5:8:2 A5:10:2 A#5:12:2 C6:14:2',
      'C6:0:2 A5:2:2 C6:4:2 F6:6:2 G6:8:2 A6:10:2 C7:12:4', 'A6:0:2 G6:2:2 F6:4:2 D6:6:2 F6:8:4 A6:12:4',
      'A#6:0:2 A6:2:2 G6:4:2 D6:6:2 G6:8:2 A6:10:2 A#6:12:4', 'C7:0:4 A#6:4:2 G6:6:2 E6:8:4 C6:12:4']) },
    B: { ch: ['Bb', 'C', 'Am', 'Dm', 'Gm', 'C', 'F', 'F'], mel: mel([
      'D6:0:1 D6:2:1 F6:3:3 D6:6:2 A#5:8:4 D6:12:4', 'E6:0:1 E6:2:1 G6:3:3 E6:6:2 C6:8:4 E6:12:4',
      'C6:0:2 E6:2:2 A6:4:4 G6:8:2 E6:10:2 C6:12:4', 'D6:0:4 F6:4:2 A6:6:2 D7:8:8',
      'A#6:0:2 G6:2:2 D6:4:2 G6:6:2 A#6:8:2 D7:10:2 A#6:12:4', 'C7:0:2 A#6:2:2 G6:4:2 E6:6:2 C6:8:2 E6:10:2 G6:12:4',
      'A6:0:3 G6:3:1 F6:4:2 C6:6:2 A5:8:2 C6:10:2 F6:12:4', 'F6:0:2 A6:2:2 C7:4:2 A6:6:2 F6:8:8']) },
    lead(M, m, t, d) { kazoo(M, hz(m - 12), t, d); },
    band(M, s, t, bi, ch) {
      const L = lap();
      if (s % 4 === 2) M.celesta(hz(ch.n[(s >> 2) % ch.n.length] + 24), t, M.sd * 2);
      if (s % 2 === 0) pizz(M, hz(ch.n[(s >> 1) % ch.n.length] + 12), t);
      for (const [st, o] of [[0, 0], [3, 0], [4, 12], [6, 7], [8, 0], [10, 12], [12, 7], [14, 12]]) if (st === s) bounce(M, hz(ch.r + o), t, (s === 3 ? 1 : 2) * M.sd);
      if (s % 4 === 0) M.kick(t, .55);
      if (s === 4 || s === 12) M.clap(t);
      if (s % 2 === 1 || Math.random() < .3) fizz(M, t);
      if (L >= 2 && s === 12) melt(M, hz(ch.r), t);
      if (L >= LAPS && s === 0) M.choir(ch.n.map(m => m + 12), t, 16 * M.sd);
      if (s === 0 && bi === 0) M.crash(t);
    } };
}
