import { G } from './g.js';
import { MAXS, VH, VW, clamp } from './core.js';
import { held } from './input.js';
import { Music } from './music.js';
import { cam } from './state.js';
import { TRAIN } from './trainsprite.js';

// ---------- audio: everything is synthesised live, no sound files ----------

export const AU = { a: null, muted: false, music: true, rev: 0, wave: 2 };


try { AU.music = localStorage.getItem('mudracer-music') !== '0'; } catch (e) {}


function makeCurve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }


export function audioInit() {
  if (AU.a) { if (AU.a.state === 'suspended') AU.a.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try {
    const a = new AC(); AU.a = a;
    const comp = a.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2;
    AU.m = a.createGain(); AU.m.gain.value = AU.muted ? 0 : .8; AU.m.connect(comp); comp.connect(a.destination);
    AU.sfx = a.createGain(); AU.sfx.connect(AU.m);
    const len = a.sampleRate * 2, b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    AU.nb = b; AU.curve = makeCurve(3);
    buildEngine(); buildSurface(); Music.init();
  } catch (e) { console.error(e); AU.a = null; }
}


export function voice(o) {
  const A = AU.a; if (!A) return;
  const T = o.at !== undefined ? o.at : A.currentTime + (o.t || 0), a = o.a || .005, hold = o.hold || 0, d = o.d || .2, vol = o.vol || .2, end = T + a + hold + d;
  const osc = A.createOscillator(), g = A.createGain();
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, T); if (o.detune) osc.detune.value = o.detune;
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, o.toAt ? T + o.toAt : end);
  let n = osc;
  if (o.lp || o.bp) {
    const fl = A.createBiquadFilter(); fl.type = o.lp ? 'lowpass' : 'bandpass'; fl.frequency.setValueAtTime(o.lp || o.bp, T);
    if (o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo, end); fl.Q.value = o.q || 1; osc.connect(fl); n = fl;
  }
  n.connect(g); g.connect(o.dest || AU.sfx);
  g.gain.setValueAtTime(.0001, T); g.gain.exponentialRampToValueAtTime(vol, T + a); g.gain.setValueAtTime(vol, T + a + hold); g.gain.exponentialRampToValueAtTime(.0001, end);
  osc.start(T); osc.stop(end + .05);
}


export function noise(o) {
  const A = AU.a; if (!A) return;
  const T = o.at !== undefined ? o.at : A.currentTime + (o.t || 0), a = o.a || .003, hold = o.hold || 0, d = o.d || .2, vol = o.vol || .2, end = T + a + hold + d;
  const s = A.createBufferSource(), fl = A.createBiquadFilter(), g = A.createGain();
  s.buffer = AU.nb; fl.type = o.type || 'bandpass'; fl.frequency.setValueAtTime(o.f || 1000, T);
  if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, end); fl.Q.value = o.q || 1;
  s.connect(fl).connect(g).connect(o.dest || AU.sfx);
  g.gain.setValueAtTime(.0001, T); g.gain.exponentialRampToValueAtTime(vol, T + a); g.gain.setValueAtTime(vol, T + a + hold); g.gain.exponentialRampToValueAtTime(.0001, end);
  s.start(T, Math.random() * 1.5); s.stop(end + .05);
}

// a note made of several oscillator "parts" sharing one envelope, optional filter and vibrato

export function synth(o) {
  const A = AU.a; if (!A) return;
  const T = o.at, a = o.a || .005, hold = o.hold || 0, d = o.d || .2, end = T + a + hold + d;
  const g = A.createGain(); let head = g;
  if (o.lp) {
    const fl = A.createBiquadFilter(); fl.type = o.ft || 'lowpass'; fl.frequency.setValueAtTime(o.lp, T);
    if (o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo, T + (o.lpT || (a + hold + d))); fl.Q.value = o.q || 1;
    g.connect(fl); head = fl;
  }
  head.connect(o.dest);
  g.gain.setValueAtTime(.0001, T); g.gain.exponentialRampToValueAtTime(o.vol, T + a); g.gain.setValueAtTime(o.vol, T + a + hold); g.gain.exponentialRampToValueAtTime(.0001, end);
  let lfo = null;
  if (o.vib) { lfo = A.createOscillator(); lfo.frequency.value = o.vib[0]; lfo.start(T); lfo.stop(end + .05); }
  for (const [type, mult, v, det] of o.parts) {
    const os = A.createOscillator(), pg = A.createGain();
    os.type = type; os.frequency.setValueAtTime(o.f * mult, T); if (det) os.detune.value = det;
    if (lfo) { const lg = A.createGain(); lg.gain.value = o.f * mult * o.vib[1]; lfo.connect(lg).connect(os.frequency); }
    pg.gain.value = v; os.connect(pg).connect(g); os.start(T); os.stop(end + .05);
  }
}

// car horns: detuned saw+square pairs through a soft clipper and a horn-shaped band pass

function hornChain(T, dur, vol, bp) {
  const A = AU.a, sh = A.createWaveShaper(), f1 = A.createBiquadFilter(), f2 = A.createBiquadFilter(), g = A.createGain();
  sh.curve = AU.curve; f1.type = 'bandpass'; f1.frequency.value = bp; f1.Q.value = .7; f2.type = 'lowpass'; f2.frequency.value = 4000;
  sh.connect(f1).connect(f2).connect(g).connect(AU.sfx);
  g.gain.setValueAtTime(.0001, T); g.gain.exponentialRampToValueAtTime(vol, T + .025); g.gain.setValueAtTime(vol, T + dur); g.gain.exponentialRampToValueAtTime(.0001, T + dur + .08);
  return sh;
}


function horn(freqs, t, dur, vol, bp = 1300) {
  if (!AU.a) return;
  const T = AU.a.currentTime + t, inp = hornChain(T, dur, vol, bp);
  for (const f of freqs) for (const [ty, dt] of [['sawtooth', 0], ['square', 9]]) {
    const o = AU.a.createOscillator(), og = AU.a.createGain();
    o.type = ty; o.frequency.value = f; o.detune.value = dt; og.gain.value = .35;
    o.connect(og).connect(inp); o.start(T); o.stop(T + dur + .12);
  }
}


function bell(f, t, vol) { [1, 2, 3, 4.2, 5.4].forEach((p, i) => voice({ f: f * p, t, a: .002, d: 1.1 / (i + 1) + .15, vol: vol / (i * 1.3 + 1) })); }


export const SFX = {
  count: () => bell(784, 0, .22),
  go: () => { [1047, 1319, 1568].forEach(f => bell(f, 0, .15)); noise({ type: 'bandpass', f: 400, to: 5000, d: .6, vol: .15, q: 1.5 }); },
  select: () => { bell(1319, 0, .12); bell(1760, .09, .1); },
  click: () => voice({ type: 'triangle', f: 900, to: 450, d: .06, vol: .18 }),
  splash: v => {
    noise({ type: 'lowpass', f: 3000, to: 400, d: .4, vol: .45 * v, q: .7 });
    noise({ t: .02, type: 'bandpass', f: 1300, d: .55, vol: .16 * v, q: .8 });
    for (let i = 0; i < 8; i++) { const f0 = 600 + Math.random() * 1400; voice({ t: .05 + Math.random() * .4, f: f0, to: f0 * (1.8 + Math.random()), a: .002, d: .05 + Math.random() * .05, vol: .09 * v }); }
  },
  mud: v => {
    noise({ type: 'bandpass', f: 900, to: 170, d: .32, vol: .5 * v, q: 5 });
    voice({ f: 110, to: 45, d: .24, vol: .35 * v });
    noise({ t: .13, type: 'lowpass', f: 600, to: 150, d: .22, vol: .22 * v, q: 8 });
  },
  blubb: () => { const f0 = 110 + Math.random() * 110; voice({ f: f0, to: f0 * 2.6, a: .004, d: .08, vol: .22 }); },
  // cows, rain and flood
  moo: () => {
    voice({ type: 'sawtooth', f: 105, to: 160, d: .38, a: .06, lp: 520, lpTo: 700, vol: .2 }); voice({ type: 'sawtooth', f: 107, detune: 18, to: 162, d: .38, a: .06, lp: 520, vol: .12 });
    voice({ type: 'sawtooth', t: .3, f: 160, to: 90, d: .75, a: .02, lp: 600, lpTo: 260, vol: .2 }); voice({ type: 'sine', f: 55, d: 1, a: .08, vol: .16 });
  },
  // building site: reversing beeper, hydraulics and the load of earth coming down
  beep: v => voice({ type: 'square', f: 1020, a: .004, hold: .07, d: .1, vol: .06 * v, lp: 2600 }),
  hydr: v => voice({ type: 'sawtooth', f: 120, to: 210, a: .12, hold: .6, d: .3, vol: .045 * v, lp: 520 }),
  dump: v => { noise({ type: 'lowpass', f: 700, to: 120, a: .05, hold: .5, d: 1.6, vol: .4 * v, q: .7 }); voice({ f: 70, to: 38, d: .9, vol: .3 * v }); noise({ t: .15, type: 'bandpass', f: 1800, to: 500, d: .5, vol: .12 * v }); },
  // race circuit: start lights, the lights go out, tyres squeal on oil, the impact wrench in the box, the team radio, a tyre bouncing
  light: () => voice({ type: 'square', f: 440, a: .003, hold: .16, d: .08, vol: .07, lp: 2400 }),
  lightsOut: () => { voice({ type: 'square', f: 880, a: .003, hold: .34, d: .12, vol: .08, lp: 3000 }); noise({ type: 'bandpass', f: 400, to: 5000, d: .6, vol: .12, q: 1.5 }); },
  squeal: () => { voice({ type: 'sawtooth', f: 1150, to: 820, a: .02, hold: .2, d: .22, vol: .05, bp: 1600, q: 6 }); voice({ type: 'square', f: 1190, to: 860, a: .02, hold: .2, d: .22, vol: .03, bp: 1700, q: 6 }); },
  wrench: v => { for (let i = 0; i < 10; i++) { noise({ t: i * .034, type: 'bandpass', f: 2600, q: 3, d: .024, vol: .09 * v }); voice({ t: i * .034, type: 'square', f: 520, d: .02, vol: .03 * v, lp: 2000 }); } },
  radio: () => {
    noise({ type: 'bandpass', f: 1800, q: 1, d: .08, vol: .1 });
    for (const t of [.1, .32]) { voice({ t, type: 'square', f: 300, to: 240, a: .01, hold: .1, d: .05, vol: .06, bp: 900, q: 2 }); noise({ t: t + .1, type: 'bandpass', f: 3500, q: 2, d: .05, vol: .05 }); }
    noise({ t: .5, type: 'bandpass', f: 1800, q: 1, d: .06, vol: .08 });
  },
  tyre: v => { voice({ f: 190, to: 80, d: .16, vol: .25 * v }); noise({ type: 'lowpass', f: 900, d: .07, vol: .15 * v }); },
  // desert and ice: the big jump, touching down, falling into the gorge (a whistle going down, then a dull plop), sinking in quicksand,
  // sand trickling, the rope bridge creaking, a cactus ("autsch"), the storm, its gusts, a tumbleweed
  bigJump: v => { voice({ type: 'sawtooth', f: 160, to: 640, d: .5, vol: .08 * v, lp: 2200 }); noise({ type: 'bandpass', f: 600, to: 3000, a: .1, d: .7, vol: .1 * v }); },
  land: v => { voice({ f: 120, to: 40, d: .22, vol: .4 * v }); noise({ type: 'lowpass', f: 1200, to: 300, d: .25, vol: .25 * v }); },
  fall: v => { voice({ type: 'sine', f: 1300, to: 200, a: .02, hold: .7, d: .3, vol: .1 * v }); voice({ t: 1.05, f: 90, to: 40, d: .3, vol: .4 * v }); noise({ t: 1.05, type: 'lowpass', f: 600, to: 150, d: .4, vol: .3 * v }); },
  sink: v => { noise({ type: 'lowpass', f: 900, to: 140, a: .2, hold: .5, d: .5, vol: .35 * v }); voice({ f: 160, to: 50, a: .1, d: .9, vol: .2 * v }); },
  trickle: () => { for (let i = 0; i < 6; i++) noise({ t: i * .05 + Math.random() * .04, type: 'bandpass', f: 3000 + Math.random() * 2500, q: 2, d: .04, vol: .05 }); },
  creak: () => { voice({ type: 'sawtooth', f: 180 + Math.random() * 60, to: 120, a: .05, hold: .1, d: .15, vol: .05, bp: 600, q: 8 }); },
  ouch: v => { voice({ type: 'square', f: 620, to: 900, a: .01, hold: .06, d: .1, vol: .07 * v, lp: 2400 }); voice({ t: .14, type: 'square', f: 900, to: 420, a: .01, hold: .1, d: .2, vol: .07 * v, lp: 2400 }); },
  storm: () => { noise({ type: 'bandpass', f: 300, to: 1400, a: 2.5, hold: 3, d: 2, vol: .22, q: .8 }); noise({ type: 'lowpass', f: 200, a: 1.5, hold: 3, d: 2, vol: .2 }); },
  windLoop: () => { noise({ type: 'bandpass', f: 500 + Math.random() * 300, to: 900, a: 1.5, hold: 3, d: 2, vol: .09, q: 1.2 }); },
  gust: () => { noise({ type: 'bandpass', f: 400, to: 2400, a: .6, hold: .6, d: .9, vol: .2, q: 2.5 }); voice({ type: 'sine', f: 420, to: 780, a: .5, hold: .4, d: .8, vol: .03 }); },
  tumble: () => noise({ type: 'bandpass', f: 2600, q: 1.5, d: .12, vol: .12 }),
  // ice: the springy bob wall, cracking ice, the ice breaking, the frost coming, the avalanche rumbling, shaking free of the snow, a penguin
  bonk: () => { voice({ f: 220, to: 120, d: .12, vol: .3 }); voice({ type: 'triangle', f: 440, to: 300, d: .08, vol: .08 }); },
  crack: v => { for (let i = 0; i < 4; i++) noise({ t: i * .03 + Math.random() * .02, type: 'highpass', f: 3500, d: .025, vol: .12 * v }); voice({ type: 'square', f: 2400, to: 900, d: .05, vol: .03 * v, lp: 5000 }); },
  iceBreak: v => { for (let i = 0; i < 10; i++) noise({ t: i * .025, type: 'highpass', f: 2500 + i * 200, d: .04, vol: .14 * v }); noise({ t: .2, type: 'lowpass', f: 2500, to: 400, d: .45, vol: .35 * v }); },
  frost: () => { for (let i = 0; i < 7; i++) voice({ t: i * .12, type: 'sine', f: 2093 * [1, 1.26, 1.5, 1.68, 2, 1.5, 2.52][i], a: .002, d: .5, vol: .04 }); noise({ type: 'highpass', f: 6000, a: .8, hold: 1, d: 1.5, vol: .05 }); },
  rumble: () => { noise({ type: 'lowpass', f: 160, to: 90, a: 1, hold: 1.5, d: 1.5, vol: .5, q: .7 }); voice({ f: 48, to: 36, a: .8, hold: 1.4, d: 1.2, vol: .25 }); },
  crunch: v => { for (let i = 0; i < 8; i++) noise({ t: i * .04 + Math.random() * .03, type: 'bandpass', f: 1400 + Math.random() * 1600, q: 1.5, d: .05, vol: .16 * v }); },
  // volcano: hissing steam and lava, the crust crackling, a hot engine coughing, the eruption, a lava bomb whistling down and hitting, "aua, heiss!"
  hiss: v => noise({ type: 'highpass', f: 2500, to: 5000, a: .05, hold: .5, d: .8, vol: .16 * v }),
  crackle: () => { for (let i = 0; i < 3; i++) noise({ t: Math.random() * .1, type: 'bandpass', f: 2000 + Math.random() * 3000, q: 3, d: .02, vol: .08 }); },
  cough: () => { for (const t of [0, .14, .3]) { noise({ t, type: 'lowpass', f: 500, d: .08, vol: .2 }); voice({ t, type: 'square', f: 70, to: 50, d: .07, vol: .06, lp: 400 }); } },
  bang: () => { noise({ type: 'lowpass', f: 900, to: 60, a: .01, hold: .3, d: 2.4, vol: .8, q: .7 }); voice({ f: 60, to: 26, d: 1.8, vol: .5 }); noise({ t: .05, type: 'bandpass', f: 1500, to: 300, d: 1.2, vol: .25 }); },
  boom: v => { noise({ type: 'lowpass', f: 1400, to: 120, d: .6, vol: .5 * v }); voice({ f: 110, to: 40, d: .4, vol: .35 * v }); },
  bombWhistle: () => voice({ type: 'sine', f: 2200, to: 700, a: .05, hold: .6, d: .2, vol: .07 }),
  burn: v => {
    noise({ type: 'highpass', f: 3000, a: .01, hold: .3, d: .5, vol: .16 * v });
    voice({ t: .05, type: 'square', f: 520, to: 880, a: .01, hold: .08, d: .08, vol: .06 * v, lp: 2400 }); voice({ t: .25, type: 'square', f: 880, to: 600, a: .01, hold: .12, d: .15, vol: .06 * v, lp: 2400 });
  },
  // jungle: the Tarzan yell on the liana, the stone ball (click, rolling), a tree creaking and crashing down, a crocodile snapping, parrots, "plopp"
  tarzan: v => { [[0, 330, .32], [.3, 440, .2], [.48, 330, .2], [.66, 440, .2], [.84, 330, .4]].forEach(([t, f, d]) => voice({ t, type: 'sawtooth', f, to: f * 1.06, a: .03, hold: d * .7, d: d * .3, vol: .07 * v, bp: 1100, q: 2 })); },
  roll: () => noise({ type: 'lowpass', f: 180, a: .05, hold: .2, d: .2, vol: .25 }),
  creakTree: () => { voice({ type: 'sawtooth', f: 110, to: 70, a: .3, hold: .9, d: .5, vol: .06, bp: 400, q: 6 }); voice({ t: .5, type: 'sawtooth', f: 140, to: 90, a: .2, hold: .6, d: .4, vol: .05, bp: 500, q: 6 }); },
  thud: () => { noise({ type: 'lowpass', f: 600, to: 80, a: .01, hold: .1, d: .9, vol: .6 }); voice({ f: 70, to: 32, d: .7, vol: .45 }); },
  snap: () => { noise({ type: 'bandpass', f: 1800, q: 2, d: .05, vol: .3 }); voice({ type: 'square', f: 300, to: 120, d: .08, vol: .1, lp: 1500 }); },
  parrot: () => { for (let i = 0; i < 3; i++) voice({ t: i * .12 + Math.random() * .05, type: 'sawtooth', f: 1400 + Math.random() * 600, to: 900, a: .01, d: .1, vol: .04, bp: 2200, q: 3 }); },
  plopp: () => { voice({ f: 300, to: 900, a: .005, d: .12, vol: .25 }); voice({ t: .08, f: 600, to: 1200, d: .08, vol: .12 }); },
  quack: v => { for (const t of [0, .16]) voice({ t, type: 'sawtooth', f: 700, to: 420, a: .01, hold: .04, d: .09, vol: .06 * v, bp: 1200, q: 4 }); },
  rain: () => noise({ type: 'highpass', f: 4200, q: .5, a: 1.2, hold: 5.5, d: 2.5, vol: .09 }),
  thunder: () => { noise({ type: 'lowpass', f: 300, to: 70, a: .05, d: 2, vol: .45, q: .7 }); voice({ f: 62, to: 34, d: 1.6, vol: .3 }); },
  flood: () => { noise({ type: 'lowpass', f: 260, to: 1100, a: 2, hold: 4, d: 3.5, vol: .28, q: .6 }); noise({ type: 'bandpass', f: 2500, to: 700, a: 1, hold: 3, d: 3, vol: .1 }); },
  bump: () => { voice({ f: 140, to: 45, d: .2, vol: .45 }); noise({ type: 'lowpass', f: 1400, d: .09, vol: .3 }); voice({ type: 'square', f: 230, to: 180, d: .05, vol: .05, lp: 900 }); },
  boost: v => { voice({ type: 'sawtooth', f: 220, to: 1400, d: .45, vol: .08 * v, lp: 3500 }); noise({ type: 'highpass', f: 1500, to: 6000, d: .4, vol: .08 * v }); bell(2093, .12, .05 * v); bell(2637, .2, .04 * v); },
  whistle: v => {
    for (const f of [466, 587, 698]) voice({ type: 'sawtooth', f: f * .96, to: f, toAt: .15, a: .1, hold: .9, d: .35, vol: .05 * v, bp: f * 2, q: 3 });
    noise({ type: 'bandpass', f: 2200, q: 1.5, a: .1, hold: .9, d: .35, vol: .05 * v });
  },
  crash: () => {
    noise({ type: 'lowpass', f: 2500, to: 300, d: .5, vol: .55 }); voice({ type: 'square', f: 160, to: 50, d: .3, vol: .2, lp: 800 });
    bell(420, .02, .12); voice({ t: .25, f: 220, to: 880, d: .25, vol: .15 }); voice({ t: .5, f: 880, to: 330, d: .3, vol: .12 });
  },
  jump: () => { voice({ type: 'sawtooth', f: 180, to: 520, d: .3, vol: .07, lp: 1800 }); noise({ type: 'bandpass', f: 800, to: 2400, d: .3, vol: .08 }); },
  gull: () => {
    voice({ type: 'sawtooth', f: 1500, to: 950, a: .02, d: .28, vol: .05, bp: 1900, q: 4 });
    voice({ t: .34, type: 'sawtooth', f: 1650, to: 1000, a: .02, d: .22, vol: .04, bp: 2000, q: 4 });
    voice({ t: .62, type: 'sawtooth', f: 1600, to: 900, a: .02, d: .2, vol: .03, bp: 2000, q: 4 });
  },
  // a new car is revealed: a whoosh and a bright rising chime
  unlock: () => { noise({ type: 'bandpass', f: 300, to: 6000, d: .5, vol: .16, q: 1.4 }); [784, 988, 1175, 1568, 2093].forEach((f, i) => bell(f, .08 + i * .07, .14)); voice({ type: 'sawtooth', f: 220, to: 880, d: .4, vol: .05, lp: 2600 }); },
  lap: () =>[1047, 1319, 1568, 2093].forEach((f, i) => bell(f, i * .09, .13)),
  fanfare: () => {
    const notes = [[523, 0, .12], [659, .15, .12], [784, .3, .12]];
    for (const [f, t, h] of notes) { voice({ type: 'sawtooth', f, t, a: .02, hold: h, d: .1, vol: .09, lp: 2600 }); voice({ type: 'sawtooth', f, detune: 10, t, a: .02, hold: h, d: .1, vol: .07, lp: 2600 }); }
    for (const f of [523, 659, 784, 1047]) voice({ type: 'sawtooth', f, t: .45, a: .03, hold: .9, d: .4, vol: .06, lp: 2400 });
    voice({ f: 150, to: 42, toAt: .12, t: .45, a: .002, d: .25, vol: .6 });
    noise({ t: .45, type: 'highpass', f: 5000, d: 1.8, vol: .22 });
    for (let i = 0; i < 320; i++) { const t = .5 + Math.random() * 3; noise({ t, type: 'bandpass', f: 1200 + Math.random() * 2800, q: 1.2, d: .015 + Math.random() * .03, vol: (.04 + Math.random() * .08) * (1 - (t - .5) / 3.3) }); }
  },
  honk: {
    meep: () => { horn([415, 523], 0, .13, .13); horn([415, 523], .19, .2, .13); },
    horn: () => horn([185, 233, 277], 0, .75, .15, 700),
    tractor: () => { horn([98, 123], 0, .22, .17, 500); horn([98, 123], .3, .22, .17, 500); horn([82, 103], .6, .6, .18, 450); },
    police: () => { for (let i = 0; i < 2; i++) { horn([440], i * .9, .42, .11, 1100); horn([587], i * .9 + .45, .42, .11, 1100); } },
    fire: () => { for (let i = 0; i < 2; i++) { horn([392, 395], i * 1.1, .52, .12, 900); horn([523, 526], i * 1.1 + .55, .52, .12, 900); } },
    jingle: () => [1047, 1319, 1568, 1319, 1175, 1397, 1568].forEach((f, i) => { voice({ type: 'triangle', f, t: i * .13, a: .003, d: .22, vol: .14 }); voice({ f: f * 2, t: i * .13, a: .002, d: .1, vol: .04 }); }),
    ambulance: () => { for (let i = 0; i < 3; i++) { horn([415], i * .7, .32, .11, 1100); horn([554], i * .7 + .35, .32, .11, 1100); } },
    quad: () => { horn([880, 1110], 0, .09, .11, 1800); horn([880, 1110], .14, .12, .11, 1800); },
    rally: () => { horn([466, 587], 0, .1, .13); horn([466, 587], .15, .32, .13); },
    // La Cucaracha, the classic motorhome horn tune
    batmobil: () => {
      const C = 262, D = 294, E = 330, F = 349, A = 440;
      [[C, 0, .09], [C, .12, .09], [C, .24, .09], [F, .38, .2], [A, .64, .4], [C, 1.2, .09], [C, 1.32, .09], [C, 1.44, .09], [F, 1.58, .2], [A, 1.84, .4],
        [F, 2.4, .12], [F, 2.56, .12], [E, 2.72, .12], [E, 2.88, .12], [D, 3.04, .12], [D, 3.2, .12], [C, 3.36, .45]].forEach(([f, t, d]) => horn([f, f * 1.5], t, d, .13, 900));
    },
  },
};


export const HONK_LEN = { meep: .45, horn: .85, tractor: .9, police: 1.8, fire: 2.2, jingle: 1, ambulance: 2.1, quad: .3, rally: .55, batmobil: 3.9 };


// engine: saw + sub square, clipped, filtered and pulsed at the firing rate, plus a little grit noise

function buildEngine() {
  const a = AU.a, E = {};
  E.o1 = a.createOscillator(); E.o1.type = 'sawtooth';
  E.o2 = a.createOscillator(); E.o2.type = 'square';
  E.g2 = a.createGain(); E.g2.gain.value = .5;
  E.mix = a.createGain(); E.mix.gain.value = .5;
  E.sh = a.createWaveShaper(); E.sh.curve = makeCurve(2.5);
  E.lp = a.createBiquadFilter(); E.lp.type = 'lowpass'; E.lp.frequency.value = 400; E.lp.Q.value = 3;
  E.am = a.createGain(); E.am.gain.value = .6;
  E.lfo = a.createOscillator(); E.lfoG = a.createGain(); E.lfoG.gain.value = .4; E.lfo.connect(E.lfoG).connect(E.am.gain);
  E.out = a.createGain(); E.out.gain.value = 0;
  E.o1.connect(E.mix); E.o2.connect(E.g2).connect(E.mix);
  E.mix.connect(E.sh).connect(E.lp).connect(E.am).connect(E.out).connect(AU.sfx);
  E.n = a.createBufferSource(); E.n.buffer = AU.nb; E.n.loop = true;
  E.nf = a.createBiquadFilter(); E.nf.type = 'bandpass'; E.nf.frequency.value = 900; E.nf.Q.value = 1.2;
  E.ng = a.createGain(); E.ng.gain.value = .25; E.n.connect(E.nf).connect(E.ng).connect(E.lp);
  [E.o1, E.o2, E.lfo, E.n].forEach(o => o.start());
  AU.E = E;
}

// tyre noise that changes with the ground: gravel crunch, soft grass, squelchy mud, water hiss, car wash spray

function buildSurface() {
  const a = AU.a, S = {};
  S.n = a.createBufferSource(); S.n.buffer = AU.nb; S.n.loop = true;
  S.f = a.createBiquadFilter(); S.g = a.createGain(); S.g.gain.value = 0;
  S.n.connect(S.f).connect(S.g).connect(AU.sfx); S.n.start();
  AU.S = S;
}


const driving = () => G.player && (G.state === 'race' || G.state === 'countdown' || G.state === 'finish');


export function engineSound(dt) {
  if (!AU.a) return;
  const E = AU.E, t = AU.a.currentTime;
  let g = 0, rpm = 0;
  const throttle = driving() && G.state !== 'finish' && !G.player.stun && ['left', 'right', 'up', 'down'].some(held);
  AU.rev += ((throttle ? 1 : 0) - AU.rev) * Math.min(1, dt * 6);
  if (driving()) {
    const sp = Math.hypot(G.player.vx, G.player.vy);
    rpm = G.state === 'countdown' ? AU.rev * .8 : sp / (MAXS * G.player.def.speed) * .85 + AU.rev * .2;
    g = G.state === 'finish' ? .05 : .12 * (.65 + .35 * AU.rev);
  }
  const base = G.player ? G.player.def.engine : 50, f = base * (1 + rpm * 1.6) * (1 - .1 * (G.player ? G.player.dirt : 0));
  E.o1.frequency.setTargetAtTime(f, t, .05); E.o2.frequency.setTargetAtTime(f * .5 * 1.003, t, .05); E.lfo.frequency.setTargetAtTime(f * .5, t, .05);
  E.lp.frequency.setTargetAtTime(250 + rpm * 900 + AU.rev * 300, t, .05);
  E.out.gain.setTargetAtTime(g, t, .08);
  const S = AU.S; let sg = 0, type = 'bandpass', sf = 2000, q = .8;
  if (driving()) {
    const sp = Math.min(1, Math.hypot(G.player.vx, G.player.vy) / MAXS);
    if (G.player.washing) { type = 'highpass'; sf = 3500; q = .5; sg = .18; }
    else if (G.player.kerb && sp > .2) { sf = Math.random() < .5 ? 160 : 320; q = 4; sg = .22 * sp; } // kerbs rattle
    else if (G.player.surf === 7) { type = 'bandpass'; sf = 700 + Math.random() * 1600; q = .9; sg = .2 * Math.max(sp, .1); } // gravel crunches
    else if (G.player.surf === 1 || G.player.surf === 4 || G.player.surf >= 8) { sf = 1800 + sp * 900; q = .6; sg = .07 * sp; }
    else if (G.player.surf === 0) { type = 'lowpass'; sf = 700; q = .7; sg = .06 * sp; }
    else if (G.player.surf === 6) { type = 'lowpass'; sf = 160 + Math.random() * 200; q = 7; sg = .2 * Math.max(sp, .1); }
    else if (G.player.surf === 2) { type = 'lowpass'; sf = 250 + Math.random() * 350; q = 6; sg = .16 * Math.max(sp, .1); }
    else if (G.player.surf === 3) { type = 'highpass'; sf = 2500; q = .5; sg = .14 * sp; }
  }
  if (S.f.type !== type) S.f.type = type;
  S.f.frequency.setTargetAtTime(sf, t, .03); S.f.Q.setTargetAtTime(q, t, .05); S.g.gain.setTargetAtTime(sg, t, .06);
}

// ocean waves on the beach, crossing bell and puffing steam engine on the train track

export function ambience(dt) {
  if (!AU.a || !driving()) return;
  if (G.T.th.sea && (AU.wave -= dt) <= 0) {
    AU.wave = 5 + Math.random() * 3;
    noise({ type: 'lowpass', f: 350, to: 1100, a: 1.4, hold: .4, d: 2.6, vol: .08 });
    noise({ t: 1.7, type: 'highpass', f: 2500, a: .3, d: 1.6, vol: .025 });
  }
  const R = G.T.rail; if (!R) return;
  const cxm = cam.x + VW / 2, cym = cam.y + VH / 2, tr = R.train;
  if (R.signal && (R.bellT -= dt) <= 0) {
    R.bellT = .42;
    let dm = 1e9; for (const cr of R.cross) dm = Math.min(dm, Math.hypot(cr.x - cxm, cr.y - cym));
    bell(1350, 0, .08 * clamp(1 - dm / 450, .2, 1));
  }
  if (tr.phase === 'run' && (R.chuffT -= dt) <= 0) {
    R.chuffT = .19; R.chuffN++;
    const ty = clamp(cym, tr.y, tr.y + TRAIN.LEN), v = clamp(1 - Math.hypot(R.x - cxm, ty - cym) / 520, 0, 1);
    noise({ type: R.chuffN % 2 ? 'lowpass' : 'bandpass', f: R.chuffN % 2 ? 700 : 1600, d: .14, vol: .3 * v + .02 });
    if (R.chuffN % 4 === 0) { voice({ type: 'square', f: 1900, d: .015, vol: .05 * v }); voice({ t: .06, type: 'square', f: 1700, d: .015, vol: .05 * v }); }
  }
}
