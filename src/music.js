import { G } from './g.js';
import { AU, noise, synth, voice } from './audio.js';
import { LAPS } from './core.js';

// ---------- music: one original tune per track, sequenced live ----------

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };


const midi = s => { const m = s.match(/^([A-G]#?)(\d)$/); return (+m[2] + 1) * 12 + NOTE[m[1]]; };


const hz = m => 440 * Math.pow(2, (m - 69) / 12);


const mel = bars => bars.map(b => b.split(' ').map(tok => { const [n, s, l] = tok.split(':'); return [midi(n), +s, +l]; }));


const SONGS = {
  // menu: starts as a gentle music box, builds up, then turns into a full-throttle kart anthem and stays there
  menu: { bpm: 146, swing: 0, order: ['I', 'J', 'A', 'B'], loop: 2,
    chords: { G: { r: 43, n: [55, 59, 62, 67] }, D: { r: 38, n: [57, 62, 66, 69] }, Em: { r: 40, n: [55, 59, 64, 67] }, C: { r: 36, n: [55, 60, 64, 67] }, A: { r: 45, n: [57, 61, 64, 69] } },
    I: { ch: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D'], mel: mel([
      'B5:0:8 D6:8:8', 'G6:0:8 E6:8:8', 'E6:0:8 C6:8:8', 'D6:0:12 A5:12:4', 'B5:0:8 D6:8:8', 'G6:0:8 B6:8:8', 'A6:0:8 G6:8:4 E6:12:4', 'F#6:0:16']) },
    J: { ch: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D'], mel: mel([
      'G5:0:4 B5:4:4 D6:8:6 B5:14:2', 'E6:0:4 D6:4:4 B5:8:8', 'C6:0:4 E6:4:4 G6:8:6 E6:14:2', 'F#6:0:4 E6:4:4 D6:8:4 A5:12:4',
      'G5:0:4 B5:4:4 D6:8:6 G6:14:2', 'B6:0:4 A6:4:4 G6:8:8', 'E6:0:2 F#6:2:2 G6:4:4 A6:8:4 B6:12:4', 'A6:0:2 F#6:2:2 D6:4:2 A5:6:2 D6:8:2 F#6:10:2 A6:12:4']) },
    A: { ch: ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D'], mel: mel([
      'D6:0:2 D6:2:1 B5:3:2 D6:5:1 G6:6:4 F#6:10:2 D6:12:4', 'A5:0:2 A5:2:1 F#5:3:2 A5:5:1 D6:6:4 C#6:10:2 A5:12:4',
      'B5:0:2 E6:2:2 G6:4:2 B6:6:4 A6:10:2 G6:12:4', 'E6:0:3 D6:3:1 C6:4:2 E6:6:2 G6:8:4 E6:12:2 D6:14:2',
      'D6:0:2 D6:2:1 B5:3:2 D6:5:1 G6:6:4 A6:10:2 B6:12:4', 'A6:0:3 G6:3:1 F#6:4:2 D6:6:2 A5:8:4 D6:12:4',
      'E6:0:2 G6:2:2 C7:4:4 B6:8:2 A6:10:2 G6:12:4', 'F#6:0:2 G6:2:2 A6:4:4 D6:8:2 E6:10:2 F#6:12:4']) },
    B: { ch: ['Em', 'C', 'G', 'D', 'Em', 'C', 'A', 'D'], mel: mel([
      'G6:0:1 G6:2:1 E6:3:3 G6:6:2 B6:8:4 A6:12:4', 'G6:0:1 G6:2:1 E6:3:3 C6:6:2 E6:8:4 D6:12:4',
      'B5:0:2 D6:2:2 G6:4:4 F#6:8:2 G6:10:2 A6:12:4', 'A6:0:6 F#6:6:2 D6:8:8',
      'E6:0:2 G6:2:2 B6:4:4 C7:8:2 B6:10:2 G6:12:4', 'E6:0:2 G6:2:2 C7:4:4 D7:8:4 C7:12:4',
      'C#7:0:4 A6:4:2 E6:6:2 A6:8:4 C#7:12:4', 'D7:0:2 A6:2:2 F#6:4:2 D6:6:2 A5:8:2 D6:10:2 F#6:12:2 A6:14:2']) },
    lead(M, m, t, d, sec) {
      if (sec === 'I') { M.glock(hz(m), t, 2.2); M.vibe(hz(m - 12), t); }
      else if (sec === 'J') M.flute(hz(m - 12), t, d);
      else { M.lead(hz(m - 12), t, d); M.glock(hz(m), t); }
    },
    band(M, s, t, bi, ch, sec) {
      if (sec === 'I') {
        if (s === 0) M.pad(ch.n, t, 16 * M.sd, .03);
        if (s % 4 === 2) M.glock(hz(ch.n[(s >> 2) % ch.n.length] + 12), t, .8);
        return;
      }
      if (sec === 'J') {
        if (s === 0) M.pad(ch.n, t, 16 * M.sd, .026);
        if (s === 0 || s === 8) { M.bassT(hz(ch.r), t, 7 * M.sd); M.kick(t, .45 + bi * .05); }
        if (s % 2 === 0) { M.hat(t, false, .4 + bi * .07); M.arp(hz(ch.n[(s >> 1) % 4] + 12), t); }
        if (bi >= 4 && (s === 4 || s === 12)) M.clap(t);
        if (bi === 7) { if (s === 0) M.riser(t, 16 * M.sd); if (s >= 8) M.snare(t, .3 + (s - 8) * .09); }
        return;
      }
      for (const [st, off, l] of [[0, 0, 2], [3, 0, 1], [4, 12, 2], [6, 7, 2], [8, 0, 2], [10, 12, 2], [12, 7, 2], [14, 7, 1], [15, 12, 1]]) if (st === s) M.bassKart(hz(ch.r + off - 12), t, l * M.sd);
      if ((s & 3) === 2) M.stab(ch.n, t);
      if (s % 2 === 1) M.arp(hz(ch.n[s % 4] + 24), t);
      if (s % 4 === 0) M.kick(t);
      if (s === 4 || s === 12) { M.snare(t); M.clap(t); }
      if (bi === 7 && s > 12) M.snare(t, .7);
      if (s === 0 && bi === 0) M.crash(t);
      M.hat(t, s === 14, s % 2 ? .6 : 1);
    } },
  // bouncy kart racer: square lead, slap bass, offbeat chord stabs
  kart: { bpm: 144, swing: 0,
    chords: { C: { r: 36, n: [60, 64, 67, 71] }, Am: { r: 33, n: [57, 60, 64, 67] }, Dm: { r: 38, n: [57, 60, 62, 65] }, G: { r: 31, n: [55, 59, 62, 65] }, F: { r: 29, n: [53, 57, 60, 64] }, Em: { r: 40, n: [55, 59, 62, 64] } },
    A: { ch: ['C', 'Am', 'Dm', 'G', 'F', 'Em', 'Dm', 'G'], mel: mel([
      'E5:0:2 G5:2:2 C6:4:2 B5:6:1 A5:7:1 G5:8:4 E5:12:4', 'A5:0:2 G5:2:2 E5:4:2 C5:6:2 D5:8:3 E5:11:1 D5:12:4',
      'F5:0:2 A5:2:2 D6:4:2 C6:6:1 A5:7:1 F5:8:4 A5:12:2 G5:14:2', 'G5:0:3 F5:3:1 E5:4:2 D5:6:2 B4:8:2 D5:10:2 G5:12:4',
      'A5:0:2 C6:2:2 E6:4:3 D6:7:1 C6:8:2 A5:10:2 F5:12:4', 'G5:0:2 B5:2:2 E6:4:2 D6:6:1 B5:7:1 G5:8:4 E5:12:4',
      'F5:0:2 E5:2:2 D5:4:2 F5:6:2 A5:8:2 C6:10:2 B5:12:2 A5:14:2', 'G5:0:4 D5:4:2 F5:6:2 B5:8:2 D6:10:6']) },
    B: { ch: ['F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'G'], mel: mel([
      'C6:0:1 C6:2:1 A5:3:2 C6:6:2 D6:8:3 C6:11:1 A5:12:4', 'B5:0:1 B5:2:1 G5:3:2 B5:6:2 D6:8:3 B5:11:1 G5:12:4',
      'G5:0:2 B5:2:2 D6:4:2 E6:6:4 D6:10:2 B5:12:4', 'C6:0:2 A5:2:2 E5:4:2 A5:6:4 G5:10:2 E5:12:4',
      'F5:0:2 A5:2:2 C6:4:2 D6:6:2 F6:8:4 E6:12:2 D6:14:2', 'D6:0:2 B5:2:2 G5:4:2 F5:6:2 D5:8:2 F5:10:2 G5:12:2 B5:14:2',
      'C6:0:3 G5:3:1 E5:4:2 G5:6:2 C6:8:6', 'D6:0:2 C6:2:2 B5:4:2 A5:6:2 G5:8:2 F5:10:2 D5:12:2 B4:14:2']) },
    lead(M, m, t, d) { M.lead(hz(m - 12), t, d); },
    band(M, s, t, bi, ch) {
      for (const [st, off, l] of [[0, 0, 2], [3, 0, 1], [4, 12, 2], [6, 7, 2], [8, 0, 2], [10, 12, 2], [12, 7, 2], [14, 7, 1], [15, 12, 1]]) if (st === s) M.bassKart(hz(ch.r + off), t, l * M.sd);
      if ((s & 3) === 2) M.stab(ch.n, t);
      if (s === 0 || s === 8 || (s === 10 && bi % 2)) M.kick(t);
      if (s === 4 || s === 12) M.snare(t);
      if (bi === 7 && s > 12) M.snare(t, .6);
      if (s % 2 === 0) M.hat(t, s === 14);
    } },
  // forest adventure in A minor: flute over marimba, toms and shaker
  forest: { bpm: 120, swing: 0,
    chords: { Am: { r: 45, n: [57, 60, 64] }, F: { r: 41, n: [57, 60, 65] }, C: { r: 48, n: [55, 60, 64] }, G: { r: 43, n: [55, 59, 62] }, Dm: { r: 50, n: [57, 62, 65] }, E: { r: 40, n: [56, 59, 64] }, Em: { r: 40, n: [55, 59, 64] } },
    A: { ch: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'], mel: mel([
      'E5:0:4 A5:4:2 B5:6:2 C6:8:4 B5:12:2 A5:14:2', 'C6:0:6 A5:6:2 F5:8:8', 'E5:0:2 G5:2:2 C6:4:4 B5:8:2 C6:10:2 D6:12:4', 'B5:0:6 G5:6:2 D5:8:8',
      'E5:0:4 A5:4:2 B5:6:2 C6:8:4 E6:12:4', 'D6:0:2 C6:2:2 A5:4:4 F5:8:4 A5:12:4', 'F5:0:2 A5:2:2 D6:4:4 C6:8:2 B5:10:2 A5:12:4', 'G#5:0:8 B5:8:4 E6:12:4']) },
    B: { ch: ['F', 'G', 'Em', 'Am', 'Dm', 'Am', 'E', 'E'], mel: mel([
      'A5:0:2 C6:2:2 F6:4:4 E6:8:4 C6:12:4', 'B5:0:2 D6:2:2 G6:4:4 F6:8:2 E6:10:2 D6:12:4', 'E6:0:6 D6:6:2 B5:8:8', 'C6:0:2 B5:2:2 A5:4:4 E5:8:4 A5:12:4',
      'F5:0:4 A5:4:4 D6:8:6 C6:14:2', 'C6:0:4 B5:4:2 A5:6:2 E5:8:8', 'B5:0:4 G#5:4:4 E5:8:4 G#5:12:4', 'B5:0:16']) },
    lead(M, m, t, d) { M.flute(hz(m), t, d); },
    band(M, s, t, bi, ch) {
      if (s % 2 === 0) M.marimba(hz(ch.n[[0, 1, 2, 1, 0, 2, 1, 2][s >> 1]] + 12), t);
      if (s === 0) M.pad(ch.n, t, 16 * M.sd, .02);
      for (const [st, off, l] of [[0, 0, 3], [3, 0, 1], [6, 7, 2], [8, 0, 3], [11, 12, 1], [12, 7, 2], [14, 0, 2]]) if (st === s) M.bassT(hz(ch.r + off - 12), t, l * M.sd);
      if (s === 0 || s === 8) M.kick(t, .8);
      if (s === 4 || s === 12) M.rim(t);
      if (bi % 2 === 1 && s >= 13) M.tom([220, 180, 140][s - 13], t);
      M.shaker(t, s % 4 === 0 ? 1 : .5);
    } },
  // laid-back island tune: steel drum, strummed ukulele, congas, lush 7th chords
  // island breeze: rolled steel pans, vibraphone, calypso bass, son clave, conga tumbao, wind chimes
  beach: { bpm: 94, swing: .32,
    chords: { F: { r: 41, n: [53, 57, 60, 64] }, Am: { r: 45, n: [55, 57, 60, 64] }, Gm: { r: 43, n: [55, 58, 62, 65] }, Cs: { r: 36, n: [55, 58, 60, 65] },
      Dm: { r: 38, n: [57, 60, 62, 65] }, C7: { r: 36, n: [55, 58, 60, 64] }, Bb: { r: 46, n: [53, 57, 58, 62] } },
    A: { ch: ['F', 'Am', 'Gm', 'Cs', 'F', 'Dm', 'Gm', 'F'], mel: mel([
      'C6:0:2 A5:3:1 C6:4:2 F6:6:4 E6:10:2 C6:12:4', 'E6:0:3 D6:3:1 C6:4:2 A5:6:6 G5:12:2 A5:14:2',
      'A#5:0:3 A5:3:1 G5:4:2 D6:6:4 C6:10:2 A#5:12:4', 'A5:0:6 G5:6:2 F5:8:8',
      'C6:0:2 A5:3:1 C6:4:2 F6:6:3 G6:9:1 A6:10:4 G6:14:2', 'F6:0:3 E6:3:1 D6:4:2 A5:6:6 C6:12:4',
      'A#5:0:2 D6:2:2 G6:4:3 F6:7:1 E6:8:4 C6:12:4', 'F6:0:10']) },
    B: { ch: ['Bb', 'Am', 'Gm', 'F', 'Bb', 'Am', 'Gm', 'C7'], mel: mel([
      'D6:0:2 F6:2:2 A6:4:6 G6:10:2 F6:12:4', 'E6:0:2 C6:2:2 A5:4:6 G5:10:2 A5:12:4',
      'A#5:0:2 D6:2:2 F6:4:4 E6:8:2 D6:10:2 C6:12:4', 'A5:0:12',
      'F6:0:3 D6:3:1 A#5:4:2 D6:6:4 F6:10:2 A6:12:4', 'G6:0:3 E6:3:1 C6:4:2 E6:6:4 A5:10:2 C6:12:4',
      'D6:0:2 C6:2:2 A#5:4:2 A5:6:2 G5:8:4 A5:12:2 A#5:14:2', 'C6:0:4 E6:4:4 G6:8:4 A#6:12:4']) },
    lead(M, m, t, d) {
      // long notes are rolled like a real steel pan; a second pan doubles an octave below
      const steps = Math.max(1, Math.round(d / M.sd / .95));
      for (let k = 0; k < (steps >= 4 ? steps : 1); k++) M.steel(hz(m), t + k * M.sd, k ? .5 : 1);
      M.steel(hz(m - 12), t, .35);
    },
    band(M, s, t, bi, ch) {
      if (s === 0) { M.pad(ch.n, t, 16 * M.sd, .024); if (bi === 0) [96, 93, 91, 88, 86].forEach((m, i) => M.glock(hz(m), t + i * .09)); }
      if (s === 3 || s === 10) M.vibe(hz(ch.n[s === 3 ? 2 : 3] + 12), t);
      if ((s & 3) === 2) ch.n.slice(1).forEach((m, i) => M.uke(hz(m + 12), t + i * .016));
      if (s === 4 || s === 12) M.chuck(t);
      for (const [st, off, l] of [[0, 0, 3], [3, 0, 1], [6, 7, 2], [8, 12, 3], [11, 7, 1], [14, 7, 2]]) if (st === s) M.bassWarm(hz(ch.r + off - 12), t, l * M.sd);
      if (s === 0 || s === 8) M.kick(t, .55);
      if ((bi % 2 === 0 ? [0, 6, 12] : [4, 8]).includes(s)) M.clave(t);
      if (s === 6 || s === 7) M.conga(330, t); if (s === 14) M.conga(247, t); if (s === 15) M.conga(220, t);
      if (s === 0 || s === 8) M.conga(290, t, .45);
      M.shaker(t, (s & 3) === 2 ? 1 : .4);
    } },
  // space disco: four on the floor, octave bass, sparkly arpeggios
  rainbow: { bpm: 150, swing: 0,
    chords: { D: { r: 38, n: [62, 66, 69, 73] }, Bm: { r: 35, n: [59, 62, 66, 69] }, G: { r: 43, n: [59, 62, 66, 67] }, A: { r: 45, n: [57, 61, 64, 69] }, Em: { r: 40, n: [59, 62, 64, 67] }, Fm: { r: 42, n: [61, 64, 66, 69] }, A7: { r: 45, n: [57, 61, 64, 67] } },
    A: { ch: ['D', 'Bm', 'G', 'A', 'Em', 'Fm', 'G', 'A7'], mel: mel([
      'F#5:0:2 A5:2:2 C#6:4:2 D6:6:4 C#6:10:2 A5:12:4', 'B5:0:2 D6:2:2 F#6:4:4 E6:8:2 D6:10:2 B5:12:4', 'D6:0:3 B5:3:3 G5:6:2 F#5:8:4 G5:12:2 A5:14:2', 'A5:0:6 E5:6:2 A5:8:2 C#6:10:2 E6:12:4',
      'G6:0:2 F#6:2:2 E6:4:4 B5:8:4 D6:12:4', 'C#6:0:2 E6:2:2 F#6:4:4 E6:8:2 C#6:10:2 A5:12:4', 'B5:0:2 D6:2:2 F#6:4:2 G6:6:2 F#6:8:2 D6:10:2 B5:12:4', 'C#6:0:4 E6:4:4 A6:8:8']) },
    B: { ch: ['G', 'A', 'Fm', 'Bm', 'Em', 'A7', 'D', 'A7'], mel: mel([
      'D6:0:1 D6:2:1 B5:3:3 D6:6:2 G6:8:4 F#6:12:4', 'E6:0:1 E6:2:1 C#6:3:3 E6:6:2 A6:8:4 G6:12:2 E6:14:2', 'F#6:0:4 E6:4:2 C#6:6:2 A5:8:4 C#6:12:4', 'D6:0:4 C#6:4:2 B5:6:2 F#5:8:8',
      'E6:0:2 G6:2:2 B6:4:4 A6:8:2 G6:10:2 E6:12:4', 'C#6:0:2 E6:2:2 G6:4:4 F#6:8:2 E6:10:2 C#6:12:4', 'D6:0:3 F#6:3:3 A6:6:6 F#6:12:4', 'E6:0:2 C#6:2:2 A5:4:2 G5:6:2 E5:8:2 C#5:10:2 A4:12:4']) },
    lead(M, m, t, d) { M.lead(hz(m - 12), t, d); M.glock(hz(m), t); },
    band(M, s, t, bi, ch) {
      const tones = [...ch.n, ...ch.n.map(m => m + 12)];
      M.arp(hz(tones[s % 8] + 12), t);
      if (s === 0) { M.pad(ch.n, t, 16 * M.sd, .022); if (bi === 0) M.crash(t); }
      if (s % 2 === 0) M.bassDisco(hz(ch.r + ((s >> 1) % 2 ? 12 : 0)), t, M.sd * 1.8);
      if (s % 4 === 0) M.kick(t);
      if (s === 4 || s === 12) M.clap(t);
      if ((s & 3) === 2) M.hat(t, true); else if (s % 2) M.hat(t, false, .6);
    } },
  // country train shuffle: harmonica, banjo rolls, boom-chick bass, brushed "chugga" snare
  train: { bpm: 172, swing: .15,
    chords: { G: { r: 43, n: [55, 59, 62] }, C: { r: 48, n: [55, 60, 64] }, D: { r: 50, n: [57, 62, 66] }, A7: { r: 45, n: [57, 61, 64, 67] } },
    A: { ch: ['G', 'C', 'G', 'D', 'G', 'C', 'D', 'G'], mel: mel([
      'D5:0:2 G5:2:2 B5:4:4 A5:8:2 G5:10:2 E5:12:2 D5:14:2', 'E5:0:4 G5:4:2 C6:6:2 B5:8:4 G5:12:4', 'B5:0:2 A5:2:2 G5:4:2 D5:6:2 B4:8:4 D5:12:4', 'A5:0:4 F#5:4:2 D5:6:2 E5:8:2 F#5:10:2 A5:12:4',
      'D5:0:2 G5:2:2 B5:4:4 D6:8:4 B5:12:4', 'C6:0:2 B5:2:2 A5:4:2 G5:6:2 E5:8:4 G5:12:4', 'F#5:0:2 A5:2:2 D6:4:4 C6:8:2 A5:10:2 F#5:12:4', 'G5:0:8 D5:8:4 G4:12:4']) },
    B: { ch: ['C', 'C', 'G', 'G', 'A7', 'D', 'G', 'D'], mel: mel([
      'E5:0:2 G5:2:2 C6:4:6 B5:10:2 A5:12:4', 'G5:0:4 E5:4:4 C5:8:8', 'D5:0:2 G5:2:2 B5:4:6 A5:10:2 G5:12:4', 'D6:0:4 B5:4:4 G5:8:8',
      'C#6:0:2 A5:2:2 E5:4:2 G5:6:2 A5:8:4 C#6:12:4', 'D6:0:4 A5:4:2 F#5:6:2 D5:8:8', 'B5:0:2 A5:2:2 G5:4:2 B5:6:2 D6:8:4 B5:12:4', 'A5:0:2 B5:2:2 A5:4:2 F#5:6:2 D5:8:4 A4:12:4']) },
    lead(M, m, t, d) { M.harmonica(hz(m - 12), t, d); },
    band(M, s, t, bi, ch) {
      if (s % 2 === 0) M.banjo(hz(ch.n[[0, 1, 2, 0, 1, 2, 0, 1][s >> 1] % ch.n.length] + 12), t);
      if (s === 0) M.bassT(hz(ch.r - 12), t, 3 * M.sd);
      if (s === 8) M.bassT(hz(ch.r - 5), t, 3 * M.sd);
      if (s === 0 || s === 8) M.kick(t, .7);
      if (s === 4 || s === 12) M.snare(t, .45);
      M.brush(t, (s & 3) === 2 ? 1 : .5);
    } },
  // quiet garden: pentatonic D major, a singing erhu over rippling yangqin, soft bass, wood block and a low drum
  garden: { bpm: 84, swing: 0,
    chords: { D: { r: 38, n: [62, 66, 69] }, Bm: { r: 35, n: [59, 62, 66] }, G: { r: 43, n: [62, 67, 71] }, A: { r: 45, n: [61, 64, 69] } },
    A: { ch: ['D', 'D', 'Bm', 'Bm', 'G', 'D', 'A', 'D'], mel: mel([
      'F#5:0:4 A5:4:4 B5:8:6 A5:14:2', 'F#5:0:6 E5:6:2 D5:8:8', 'D5:0:4 F#5:4:4 B5:8:4 D6:12:4', 'B5:0:6 A5:6:2 F#5:8:8',
      'B5:0:4 A5:4:4 F#5:8:4 E5:12:4', 'D5:0:4 E5:4:4 F#5:8:8', 'A5:0:4 F#5:4:2 E5:6:2 D5:8:4 E5:12:4', 'D5:0:12']) },
    B: { ch: ['G', 'D', 'Bm', 'A', 'G', 'D', 'A', 'D'], mel: mel([
      'D6:0:4 B5:4:4 A5:8:8', 'F#5:0:4 A5:4:4 D6:8:8', 'B5:0:6 D6:6:2 E6:8:4 D6:12:4', 'A5:0:8 E5:8:8',
      'B5:0:4 D6:4:4 F#6:8:8', 'E6:0:4 D6:4:4 A5:8:4 F#5:12:4', 'E5:0:4 F#5:4:4 A5:8:4 B5:12:4', 'A5:0:4 F#5:4:4 D5:8:8']) },
    lead(M, m, t, d) { M.erhu(hz(m), t, d); },
    band(M, s, t, bi, ch) {
      if (s % 2 === 0) M.yangqin(hz(ch.n[[0, 1, 2, 1, 2, 1, 0, 1][s >> 1] % ch.n.length] + 12), t, s % 4 === 0 ? 1 : .55);
      if (s === 0) M.pad(ch.n, t, 16 * M.sd, .016);
      if (s === 0 || s === 10) M.bassWarm(hz(ch.r - 12 + (s === 10 ? 7 : 0)), t, 5 * M.sd);
      if (s === 0 && bi % 2 === 0) M.tom(130, t);
      if (s === 12) M.rim(t);
      M.shaker(t, s % 4 === 0 ? .55 : .2);
    } },
  // building site: stomping industrial funk in E minor, a reversing-beeper lead, saw bass, anvil clangs and a jackhammer rattle
  site: { bpm: 126, swing: .08,
    chords: { Em: { r: 40, n: [64, 67, 71] }, C: { r: 36, n: [60, 64, 67] }, D: { r: 38, n: [62, 66, 69] }, B7: { r: 35, n: [59, 63, 66, 69] }, Am: { r: 33, n: [57, 60, 64] }, G: { r: 43, n: [59, 62, 67] } },
    A: { ch: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'Am', 'B7'], mel: mel([
      'E5:0:1 E5:2:1 B5:4:1 E5:6:1 G5:8:2 E5:11:1 D5:12:2', 'E5:0:1 E5:2:1 B5:4:1 E5:6:1 A5:8:2 G5:11:1 E5:12:2',
      'C5:0:1 C5:2:1 G5:4:1 C5:6:1 E5:8:2 C5:11:1 B4:12:2', 'D5:0:1 D5:2:1 A5:4:1 D5:6:1 F#5:8:2 E5:11:1 D5:12:2',
      'E5:0:1 E5:2:1 B5:4:1 E5:6:1 G5:8:2 E5:11:1 D5:12:2', 'E5:0:1 G5:2:1 B5:4:1 E6:6:2 D6:10:2 B5:12:4',
      'A5:0:1 A5:2:1 E5:4:1 A5:6:1 C6:8:2 B5:11:1 A5:12:2', 'B5:0:2 A5:2:1 G5:4:2 F#5:6:2 D#5:8:4 E5:12:4']) },
    B: { ch: ['Am', 'G', 'C', 'D', 'Am', 'G', 'B7', 'Em'], mel: mel([
      'A5:0:2 C6:4:2 E6:8:4 C6:12:2 A5:14:2', 'G5:0:2 B5:4:2 D6:8:4 B5:12:4', 'E5:0:2 G5:4:2 C6:8:4 G5:12:4', 'F#5:0:2 A5:4:2 D6:8:4 A5:12:2 F#5:14:2',
      'A5:0:2 C6:4:2 E6:8:2 A6:10:2 G6:12:4', 'G6:0:2 D6:4:2 B5:8:4 G5:12:4', 'F#6:0:2 D#6:4:2 B5:8:2 F#5:10:2 D#5:12:4', 'E6:0:2 B5:4:2 G5:8:2 E5:12:4']) },
    lead(M, m, t, d) { M.beeper(hz(m), t, d); },
    band(M, s, t, bi, ch) {
      for (const [st, off, l] of [[0, 0, 2], [3, 0, 1], [6, 12, 2], [8, 0, 2], [11, 7, 1], [14, 12, 2]]) if (st === s) M.bassSaw(hz(ch.r + off - 12), t, l * M.sd);
      if ((s & 7) === 2) M.stab(ch.n, t);
      if (s === 0 || s === 8 || (s === 6 && bi % 2)) M.kick(t, .9);
      if (s === 4 || s === 12) { M.snare(t, .8); M.clap(t); }
      if (bi % 4 === 3 && s >= 8) M.jack(t, s > 12 ? .7 : 1);
      else if (s % 2 === 0) M.hat(t, s === 14, s % 4 === 0 ? 1 : .6);
      if (bi % 2 === 1 && (s === 2 || s === 10)) M.anvil(t);
      if (s === 0 && bi === 0) M.crash(t);
      if (s === 0) M.pad(ch.n, t, 16 * M.sd, .014);
    } },
  // race circuit: Eurobeat in A minor, a supersaw hook in sixteenths, octave bass, four on the floor, a car racing past before every new part.
  // In the last lap the tune moves up a whole tone and plays only the refrain (up / upOrder).
  circuit: { bpm: 160, swing: 0,
    up: () => G.player && !G.T.run && G.player.lap >= LAPS && (G.state === 'race' || G.state === 'finish') ? 2 : 0, upOrder: ['B'],
    chords: { Am: { r: 45, n: [57, 60, 64, 69] }, F: { r: 41, n: [57, 60, 65, 69] }, G: { r: 43, n: [55, 59, 62, 67] }, Em: { r: 40, n: [55, 59, 64, 67] }, E: { r: 40, n: [56, 59, 64, 68] } },
    A: { ch: ['Am', 'F', 'G', 'Em', 'Am', 'F', 'G', 'G'], mel: mel([
      'A5:0:1 C6:1:1 E6:2:2 A5:4:1 C6:5:1 E6:6:2 D6:8:2 C6:10:2 B5:12:2 C6:14:2', 'A5:0:1 C6:1:1 F6:2:2 A5:4:1 C6:5:1 F6:6:2 E6:8:2 D6:10:2 C6:12:4',
      'G5:0:1 B5:1:1 D6:2:2 G5:4:1 B5:5:1 D6:6:2 E6:8:2 D6:10:2 B5:12:2 G5:14:2', 'E5:0:2 G5:2:2 B5:4:2 E6:6:2 D6:8:3 B5:11:1 G5:12:4',
      'A5:0:1 C6:1:1 E6:2:2 A5:4:1 C6:5:1 E6:6:2 A6:8:2 G6:10:2 E6:12:2 C6:14:2', 'F6:0:2 E6:2:2 C6:4:2 A5:6:2 C6:8:2 F6:10:2 A6:12:4',
      'G6:0:2 F6:2:2 D6:4:2 B5:6:2 D6:8:2 G6:10:2 B6:12:2 A6:14:2', 'G6:0:3 D6:3:1 B5:4:2 G5:6:2 B5:8:1 D6:9:1 G6:10:2 B6:12:4']) },
    B: { ch: ['F', 'G', 'Em', 'Am', 'F', 'G', 'E', 'E'], mel: mel([
      'C7:0:3 A6:3:1 F6:4:2 A6:6:2 C7:8:4 A6:12:2 C7:14:2', 'D7:0:3 B6:3:1 G6:4:2 B6:6:2 D7:8:4 E7:12:4',
      'E7:0:2 D7:2:2 B6:4:2 G6:6:2 B6:8:2 D7:10:2 E7:12:2 G7:14:2', 'E7:0:6 C7:6:2 A6:8:6 E6:14:2',
      'A6:0:2 C7:2:2 F7:4:4 E7:8:2 C7:10:2 A6:12:4', 'B6:0:2 D7:2:2 G7:4:4 F7:8:2 D7:10:2 B6:12:4',
      'G#6:0:2 B6:2:2 E7:4:2 G#6:6:2 B6:8:2 E7:10:2 G#7:12:4', 'B7:0:4 G#7:4:2 E7:6:2 B6:8:2 G#6:10:2 E6:12:2 B5:14:2']) },
    lead(M, m, t, d, sec) { M.supersaw(hz(m - 12), t, d); if (sec === 'B') M.supersaw(hz(m - 24), t, d, .55); },
    band(M, s, t, bi, ch, sec) {
      if (s % 2 === 0) M.bassEuro(hz(ch.r + ((s >> 1) % 2 ? 12 : 0)), t, M.sd * 1.6);
      if (s % 4 === 0) M.kick(t);
      if (s === 4 || s === 12) { M.clap(t); M.snare(t, .45); }
      if ((s & 3) === 2) M.hat(t, true, .9); else if (s % 2) M.hat(t, false, .5);
      if (s === 3 || s === 6 || s === 11 || s === 14) M.stab(ch.n, t);
      if (sec === 'B' || s % 2) M.arp(hz(ch.n[(s * 3) % ch.n.length] + 12), t);
      if (s === 0) M.pad(ch.n, t, 16 * M.sd, .014);
      if (s === 0 && bi === 0) M.crash(t);
      if (bi === 7 && s === 0) M.zoom(t, 16 * M.sd);
      if (bi === 7 && s >= 12) M.snare(t, .35 + (s - 12) * .15);
    } },
  // desert: D phrygian dominant (D Eb F# G A Bb C), a snake charmer's reed flute, oud, darbuka in the maqsum rhythm, finger cymbals, a drone on D and A.
  // In the sandstorm a layer of wind comes in (its filter opens with the gusts) and the darbuka plays twice as fast.
  desert: { bpm: 132, swing: 0,
    chords: { D: { r: 38, n: [62, 66, 69] }, Eb: { r: 39, n: [63, 67, 70] }, Gm: { r: 43, n: [62, 67, 70] }, Cm: { r: 36, n: [60, 63, 67] }, Bb: { r: 34, n: [62, 65, 70] } },
    A: { ch: ['D', 'Eb', 'D', 'D', 'Gm', 'Eb', 'D', 'D'], mel: mel([
      'D5:0:2 D#5:2:2 F#5:4:4 G5:8:2 F#5:10:2 D#5:12:2 D5:14:2', 'D#5:0:3 G5:3:1 A#5:4:4 A5:8:2 G5:10:2 F#5:12:4',
      'A5:0:2 A#5:2:2 A5:4:2 G5:6:2 F#5:8:4 D#5:12:2 F#5:14:2', 'D5:0:12 A4:12:4',
      'G5:0:2 A5:2:2 A#5:4:4 D6:8:4 C6:12:2 A#5:14:2', 'A#5:0:2 G5:2:2 D#5:4:4 G5:8:2 A#5:10:2 C6:12:4',
      'D6:0:3 C6:3:1 A#5:4:2 A5:6:2 G5:8:2 F#5:10:2 D#5:12:2 F#5:14:2', 'D5:0:8 A5:8:2 F#5:10:2 D5:12:4']) },
    B: { ch: ['Cm', 'Bb', 'Eb', 'D', 'Gm', 'Cm', 'Eb', 'D'], mel: mel([
      'C6:0:2 D#6:2:2 G6:4:4 F#6:8:1 G6:9:1 F#6:10:2 D#6:12:2 C6:14:2', 'D6:0:2 F6:2:2 A#6:4:4 A6:8:1 A#6:9:1 A6:10:2 F6:12:2 D6:14:2',
      'D#6:0:2 G6:2:2 A#6:4:2 G6:6:2 D#6:8:2 C6:10:2 A#5:12:4', 'A5:0:1 A#5:1:1 A5:2:1 G5:3:1 F#5:4:4 D#5:8:2 F#5:10:2 D5:12:4',
      'G5:0:1 A5:1:1 A#5:2:1 C6:3:1 D6:4:4 D#6:8:2 D6:10:2 C6:12:4', 'C6:0:1 D6:1:1 D#6:2:1 F#6:3:1 G6:4:4 F#6:8:2 D#6:10:2 C6:12:4',
      'A#5:0:2 D#6:2:2 G6:4:4 F#6:8:2 D#6:10:2 D6:12:2 C6:14:2', 'D6:0:6 A5:6:2 F#5:8:2 D#5:10:2 D5:12:4']) },
    lead(M, m, t, d, sec) { M.reed(hz(m), t, d); if (sec === 'B') M.oud(hz(m - 12), t, .5); },
    band(M, s, t, bi, ch, sec) {
      const ev = G.T && G.T.ev, storm = !!(ev && ev.storm && G.T.desert);
      // the oud: arpeggios in part A, tremolo on the root in part B
      if (sec === 'A' ? s % 4 === 2 : s % 2 === 0) M.oud(hz((sec === 'A' ? ch.n[(s >> 2) % ch.n.length] : ch.n[0]) - 12), t, sec === 'A' ? .8 : .45);
      if (s === 0) { M.drone(hz(38), t, 16 * M.sd); M.drone(hz(45), t, 16 * M.sd, .5); }
      if (sec === 'B' && s % 4 === 0) M.bassWarm(hz(ch.r - 12 + [0, 7, 12, 7][s >> 2]), t, 3 * M.sd);
      // maqsum: dum, tek, -, tek, dum, -, tek, - (in eighths); in the storm twice as fast
      if (s === 0 || s === 8) M.dum(t); if (s === 2 || s === 6 || s === 12) M.tek(t, 1);
      if (storm && (s % 2 === 1)) M.tek(t, .5); if (storm && s === 10) M.dum(t, .7);
      if (s % 4 === 0) M.zill(t);
      if (storm && s === 0) M.sandWind(t, 16 * M.sd, ev.gust || 0, ev.warn || 0);
      if (s === 0 && bi === 0 && sec === 'A') M.crash(t);
    } },
  // volcano: C minor, metal and orchestra, 150 BPM. Taiko drums carry it, brass stabs on 1 and 3+, a distorted guitar plays palm-muted eighths
  // (power chords in part B), the bass under it. From the eruption a double bass drum and a low choir; in the last lap it speeds up to 160 BPM
  // (the song "volcanoFast") and the brass plays the tune as well.
  volcano: { bpm: 150, swing: 0, swap: () => G.player && !G.T.run && G.player.lap >= LAPS && (G.state === 'race' || G.state === 'finish') ? 'volcanoFast' : null,
    chords: { Cm: { r: 36, n: [60, 63, 67] }, Ab: { r: 44, n: [60, 63, 68] }, Bb: { r: 46, n: [62, 65, 70] }, G: { r: 43, n: [59, 62, 67] }, Fm: { r: 41, n: [60, 65, 68] } },
    A: { ch: ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Fm', 'G'], mel: mel([
      'C5:0:4 D#5:4:2 G5:6:2 C6:8:4 A#5:12:2 G5:14:2', 'G#5:0:4 G5:4:2 D#5:6:2 C5:8:6 D#5:14:2', 'D5:0:4 F5:4:2 A#5:6:2 D6:8:4 C6:12:2 A#5:14:2', 'B5:0:6 G5:6:2 D5:8:4 B4:12:4',
      'C6:0:4 A#5:4:2 G5:6:2 D#5:8:4 G5:12:4', 'G#5:0:2 G5:2:2 F5:4:2 D#5:6:2 C5:8:8', 'F5:0:4 G#5:4:2 C6:6:2 F6:8:4 D#6:12:2 C6:14:2', 'D6:0:4 B5:4:4 G5:8:4 D5:12:4']) },
    B: { ch: ['Ab', 'Bb', 'Cm', 'Cm', 'Fm', 'G', 'Ab', 'G'], mel: mel([
      'D#6:0:6 C6:6:2 G#5:8:4 C6:12:4', 'F6:0:6 D6:6:2 A#5:8:4 D6:12:4', 'G6:0:8 D#6:8:4 C6:12:4', 'C6:0:2 D6:2:2 D#6:4:2 F6:6:2 G6:8:8',
      'G#6:0:6 F6:6:2 C6:8:4 G#5:12:4', 'G6:0:6 D6:6:2 B5:8:4 D6:12:4', 'C6:0:4 D#6:4:4 G#6:8:4 G6:12:4', 'F6:0:4 D6:4:4 B5:8:8']) },
    lead(M, m, t, d) { M.gtrLead(hz(m - 12), t, d); if (M.song.fast) M.brass([m - 12, m - 24], t, d * .9, 1.4); },
    band(M, s, t, bi, ch, sec) {
      const ev = G.T && G.T.ev, erupt = !!(ev && ev.erupt && G.T.volcano);
      if (s === 0 || s === 6 || (s === 8 && bi % 2) || s === 11) M.taiko(s === 0 ? 62 : 84, t, s === 0 ? 1 : .7);
      if (s === 0 || s === 10) M.brass(ch.n.map(m => m - 12), t, .14);
      if (sec === 'A') { if (s % 2 === 0) { M.gtr(hz(ch.r), t, M.sd * .8, true); M.bassSaw(hz(ch.r - 12), t, M.sd * .9); } }
      else if (s % 4 === 0) { M.gtr(hz(ch.r), t, M.sd * 3.6, false); M.gtr(hz(ch.r + 7), t, M.sd * 3.6, false); M.bassSaw(hz(ch.r - 12), t, M.sd * 3.6); }
      if (s === 4 || s === 12) M.snare(t, .9);
      if (erupt) { M.kick(t, s % 4 === 0 ? 1 : .6); if (s === 0) M.choir(ch.n.map(m => m - 12), t, 16 * M.sd); }
      else if (s % 4 === 0) M.kick(t);
      if (s % 2 === 1) M.hat(t, false, .5);
      if (s === 0 && bi === 0) M.crash(t);
    } },
  // ice: B minor, it builds up with the race. Lap 1: celesta, a glockenspiel echo, soft strings, sleigh bells, hardly any bass (it feels like 84 BPM).
  // From the frost (lap 2): a fast breakbeat, a deep sub bass and quick arpeggios ("ice crystals"). Last lap: a choir, strings in sixteenths, timpani.
  // Before every avalanche a low timpani roll.
  ice: { bpm: 168, swing: 0,
    chords: { Hm: { r: 35, n: [59, 62, 66] }, G: { r: 43, n: [59, 62, 67] }, D: { r: 38, n: [62, 66, 69] }, A: { r: 45, n: [61, 64, 69] }, Em: { r: 40, n: [59, 64, 67] },
      'F#7': { r: 42, n: [61, 64, 66, 70] }, 'F#m': { r: 42, n: [61, 66, 69] } },
    A: { ch: ['Hm', 'G', 'D', 'A', 'Em', 'G', 'F#7', 'Hm'], mel: mel([
      'F#6:0:8 D6:8:8', 'B5:0:8 D6:8:4 G6:12:4', 'F#6:0:12 E6:12:4', 'C#6:0:8 E6:8:8',
      'G6:0:8 E6:8:4 B5:12:4', 'D6:0:8 B5:8:8', 'A#5:0:8 C#6:8:4 E6:12:4', 'D6:0:12 B5:12:4']) },
    B: { ch: ['G', 'A', 'F#m', 'Hm', 'Em', 'F#7', 'Hm', 'Hm'], mel: mel([
      'G6:0:4 F#6:4:4 D6:8:8', 'E6:0:4 F#6:4:4 A6:8:8', 'C#7:0:8 A6:8:4 F#6:12:4', 'B6:0:12 F#6:12:4',
      'G6:0:4 B6:4:4 E7:8:8', 'D7:0:4 C#7:4:4 A#6:8:8', 'B6:0:8 D7:8:4 F#7:12:4', 'B6:0:16']) },
    lead(M, m, t, d) { M.celesta(hz(m - 12), t, d); M.glock(hz(m), t + 3 * M.sd, .5); },
    band(M, s, t, bi, ch, sec) {
      const P = G.player, lap = P && !G.T.run && (G.state === 'race' || G.state === 'finish') ? P.lap : 1, frost = lap >= 2, last = lap >= LAPS, ev = G.T && G.T.ev;
      if (s === 0) M.pad(ch.n, t, 16 * M.sd, frost ? .012 : .018);
      if (s % 2 === 0) M.sleigh(t, s % 4 === 0 ? 1 : .55);
      if (!frost) { if (s === 0 && bi % 2 === 0) M.bassWarm(hz(ch.r - 12), t, 14 * M.sd); }
      else {
        // drum and bass: kick on 1 and the "and" of 3, snare on 2 and 4, sixteenth hats; a sub bass under it; ice crystal arpeggios
        if (s === 0 || s === 10) M.kick(t); if (s === 4 || s === 12) M.snare(t, .8); if (s === 7 && bi % 2) M.snare(t, .3);
        M.hat(t, s === 14, s % 2 ? .45 : .8);
        if (s === 0 || s === 10) M.sub(hz(ch.r - 12), t, 6 * M.sd);
        M.arp(hz(ch.n[(s * 2) % ch.n.length] + 24), t);
      }
      if (last) {
        if (s === 0) M.choir(ch.n, t, 16 * M.sd);
        M.strings(hz(ch.n[[0, 1, 2, 1][s & 3] % ch.n.length]), t);
        if (s === 0 || (s === 8 && bi % 2)) M.timp(hz(ch.r), t);
      }
      // a low roll before the avalanche
      if (ev && ev.aval && ev.aval.warn) M.timp(hz(ch.r - 12), t, .45);
      if (s === 0 && bi === 0) M.crash(t);
    } },
};


// the volcano in the last lap: the same song, faster, the brass plays the tune
SONGS.volcanoFast = { ...SONGS.volcano, bpm: 160, swap: null, fast: true };


export const Music = {
  init() {
    const A = AU.a;
    this.out = A.createGain(); this.out.gain.value = 0; this.out.connect(AU.m);
    this.leadBus = A.createGain(); this.leadBus.connect(this.out);
    this.dly = A.createDelay(1);
    this.fb = A.createGain(); this.fb.gain.value = .28; this.wet = A.createGain(); this.wet.gain.value = .3;
    this.leadBus.connect(this.dly); this.dly.connect(this.fb).connect(this.dly); this.dly.connect(this.wet).connect(this.out);
    this.cur = this.want = 'kart'; this.song = SONGS.kart; this.sd = 60 / this.song.bpm / 4;
    this.dly.delayTime.value = this.sd * 3;
    this.step = 0; this.next = A.currentTime + .1;
    setInterval(() => this.tick(), 25);
  },
  tick() {
    const A = AU.a; if (!A || A.state !== 'running') return;
    if (this.next < A.currentTime - .2) this.next = A.currentTime + .05; // tab was asleep: skip instead of piling up
    while (this.next < A.currentTime + .15) {
      if (this.want !== this.cur && this.step % 4 === 0) {
        this.cur = this.want; this.song = SONGS[this.cur]; this.sd = 60 / this.song.bpm / 4; this.step = 0; this.up = 0;
        this.dly.delayTime.setValueAtTime(this.sd * 3, this.next);
      }
      this.play(this.step, this.next); this.next += this.sd; this.step++;
    }
  },
  level() {
    if (!AU.a) return;
    const vs = G.state === 'options' ? G.optFrom : G.state;
    const menuish = ['title', 'main', 'select_cup', 'select_track', 'select_car', 'select_count', 'standings', 'ceremony'].includes(vs);
    let w = menuish ? 'menu' : G.T.def.song;
    if (SONGS[w] && SONGS[w].swap) w = SONGS[w].swap() || w; // a song can hand over to another one (the volcano gets faster in the last lap)
    this.want = SONGS[w] ? w : 'kart';
    let v = .5;
    if (G.state === 'pause') v = .22; else if (G.state === 'countdown') v = .32; else if (G.state === 'finish') v = G.stateTime < 3.5 ? .12 : .4; else if (G.state === 'ceremony') v = G.stateTime < 3.5 ? .15 : .45;
    this.out.gain.setTargetAtTime(AU.music ? v : 0, AU.a.currentTime, .3);
  },
  play(step, t) {
    if (!AU.music) return;
    const S = this.song;
    // a key change (up, in semitones) only starts with a new bar; it can bring its own order of the parts
    if ((step & 15) === 0) this.up = S.up ? S.up() : 0;
    const up = this.up || 0, order = (up && S.upOrder) || S.order || ['A', 'B'], total = order.length * 8, from = up && S.upOrder ? 0 : (S.loop || 0) * 8;
    let bar = step >> 4; if (bar >= total) bar = from + (bar - from) % (total - from);
    const s = step & 15, name = order[bar >> 3], sec = S[name], bi = bar & 7, c0 = S.chords[sec.ch[bi]], ch = up ? { r: c0.r + up, n: c0.n.map(m => m + up) } : c0;
    const tt = t + ((s & 3) === 2 ? S.swing * this.sd : 0);
    for (const n of sec.mel[bi]) if (n[1] === s) S.lead(this, n[0] + up, tt, n[2] * this.sd * .95, name);
    S.band(this, s, tt, bi, ch, name);
  },
  // instruments
  lead(f, t, d) { synth({ at: t, f, parts: [['square', 1, .6], ['sawtooth', 1, .45, 8]], a: .008, hold: Math.max(0, d - .06), d: .08, vol: .1, lp: 3000, dest: this.leadBus }); },
  flute(f, t, d) {
    synth({ at: t, f, parts: [['sine', 1, 1], ['triangle', 2, .12]], a: .05, hold: Math.max(0, d * .75), d: .14, vol: .14, vib: [5.2, .006], dest: this.leadBus });
    noise({ at: t, type: 'bandpass', f: Math.min(8000, f * 3), q: 2, d: .09, vol: .025, dest: this.leadBus });
  },
  steel(f, t, v = 1) {
    synth({ at: t, f, parts: [['sine', 1, 1], ['sine', 2, .35], ['sine', 2.98, .12]], a: .004, d: .75, vol: .14 * v, dest: this.leadBus });
    synth({ at: t, f, parts: [['sine', 3, .5], ['triangle', 4.02, .25]], a: .002, d: .14, vol: .06 * v, dest: this.leadBus });
  },
  vibe(f, t) { synth({ at: t, f, parts: [['sine', 1, 1], ['sine', 4, .08]], a: .004, d: 1.1, vol: .05, vib: [5.5, .004], dest: this.leadBus }); },
  clave(t) { voice({ at: t, f: 2500, to: 2300, a: .001, d: .05, vol: .07, dest: this.out }); voice({ at: t, f: 1250, a: .001, d: .04, vol: .03, dest: this.out }); },
  chuck(t) { noise({ at: t, type: 'bandpass', f: 2200, q: 1.2, a: .002, d: .04, vol: .06, dest: this.out }); },
  harmonica(f, t, d) { synth({ at: t, f, parts: [['sawtooth', 1, .6], ['square', 1, .45, 5]], a: .035, hold: Math.max(0, d * .8), d: .1, vol: .12, ft: 'bandpass', lp: Math.min(6000, f * 3), q: 1.1, vib: [6, .008], dest: this.leadBus }); },
  // erhu: a bowed, nasal string with a slow vibrato that sets in after the start of the note
  erhu(f, t, d) { synth({ at: t, f, parts: [['sawtooth', 1, .7], ['triangle', 1, .45], ['square', 2, .12]], a: .09, hold: Math.max(0, d * .85), d: .16, vol: .11, ft: 'bandpass', lp: Math.min(5500, f * 3.2), q: 1.3, vib: [5.3, .011], dest: this.leadBus }); },
  // yangqin: hammered dulcimer, bright pluck with a short ring (struck twice, slightly detuned)
  yangqin(f, t, v = 1) {
    synth({ at: t, f, parts: [['triangle', 1, 1], ['sine', 2, .4], ['square', 3, .1]], a: .002, d: .42, vol: .06 * v, lp: 5200, lpTo: 1400, lpT: .25, dest: this.out });
    synth({ at: t + .012, f: f * 1.004, parts: [['triangle', 1, 1]], a: .002, d: .3, vol: .03 * v, lp: 3600, dest: this.out });
  },
  beeper(f, t, d) { synth({ at: t, f, parts: [['square', 1, 1]], a: .003, hold: Math.max(0, Math.min(d, this.sd * 1.4) - .05), d: .05, vol: .085, lp: 3800, dest: this.leadBus }); },
  bassSaw(f, t, d) { synth({ at: t, f, parts: [['sawtooth', 1, .8], ['square', .5, .4]], a: .005, hold: d * .4, d: d * .6 + .03, vol: .16, lp: 1100, lpTo: 220, dest: this.out }); },
  anvil(t) { voice({ at: t, f: 1850, to: 1700, a: .001, d: .5, vol: .06, dest: this.out }); voice({ at: t, f: 2780, a: .001, d: .3, vol: .035, dest: this.out }); noise({ at: t, type: 'bandpass', f: 4200, q: 3, d: .05, vol: .08, dest: this.out }); },
  jack(t, v = 1) { noise({ at: t, type: 'bandpass', f: 260, q: 1.2, a: .001, d: .05, vol: .13 * v, dest: this.out }); voice({ at: t, type: 'square', f: 95, to: 60, d: .05, vol: .1 * v, lp: 600, dest: this.out }); },
  glock(f, t, v = 1) { synth({ at: t, f, parts: [['sine', 1, 1], ['sine', 2.76, .3]], a: .001, d: .5, vol: .035 * v, dest: this.leadBus }); },
  riser(t, dur) { noise({ at: t, type: 'bandpass', f: 300, to: 7000, a: dur * .95, d: .05, vol: .07, q: 3, dest: this.out }); },
  marimba(f, t) { synth({ at: t, f, parts: [['sine', 1, 1]], a: .003, d: .35, vol: .12, dest: this.out }); synth({ at: t, f, parts: [['sine', 4, 1]], a: .001, d: .04, vol: .035, dest: this.out }); },
  uke(f, t) { synth({ at: t, f, parts: [['sawtooth', 1, 1], ['square', 1, .3, 5]], a: .002, d: .3, vol: .035, lp: 3200, lpTo: 500, lpT: .25, dest: this.out }); },
  banjo(f, t) { synth({ at: t, f, parts: [['sawtooth', 1, 1], ['square', 2, .2]], a: .001, d: .18, vol: .04, lp: 5500, lpTo: 900, lpT: .15, dest: this.out }); },
  arp(f, t) { synth({ at: t, f, parts: [['square', 1, 1]], a: .002, d: .08, vol: .026, lp: 4500, dest: this.leadBus }); },
  pad(ns, t, d, v) { for (const m of ns) synth({ at: t, f: hz(m), parts: [['sawtooth', 1, .5, -7], ['sawtooth', 1, .5, 7]], a: .35, hold: Math.max(0, d - .7), d: .6, vol: v, lp: 1300, dest: this.out }); },
  stab(ns, t) { for (const m of ns) synth({ at: t, f: hz(m), parts: [['sawtooth', 1, 1]], a: .004, hold: .02, d: .08, vol: .03, lp: 2200, dest: this.out }); },
  bassKart(f, t, d) {
    synth({ at: t, f, parts: [['triangle', 1, 1]], a: .005, hold: d * .6, d: d * .4, vol: .3, dest: this.out });
    synth({ at: t, f, parts: [['square', 1, 1]], a: .005, d: d * .8, vol: .07, lp: 1400, lpTo: 300, dest: this.out });
  },
  bassT(f, t, d) { synth({ at: t, f, parts: [['triangle', 1, 1], ['sine', .5, .35]], a: .005, hold: d * .5, d: d * .5, vol: .3, dest: this.out }); },
  bassWarm(f, t, d) { synth({ at: t, f, parts: [['sine', 1, 1], ['triangle', 1, .35]], a: .012, hold: d * .6, d: d * .4 + .06, vol: .34, dest: this.out }); },
  bassDisco(f, t, d) { synth({ at: t, f, parts: [['sawtooth', 1, .7], ['square', .5, .35]], a: .004, d, vol: .15, lp: 1800, lpTo: 280, dest: this.out }); },
  kick(t, v = 1) { voice({ at: t, f: 150, to: 42, toAt: .12, a: .002, d: .2, vol: .5 * v, dest: this.out }); },
  snare(t, v = 1) { noise({ at: t, type: 'highpass', f: 1800, d: .12, vol: .18 * v, dest: this.out }); voice({ at: t, type: 'triangle', f: 210, to: 150, d: .07, vol: .12 * v, dest: this.out }); },
  hat(t, open, v = 1) { noise({ at: t, type: 'highpass', f: 8000, d: open ? .14 : .03, vol: (open ? .05 : .06) * v, dest: this.out }); },
  clap(t) { for (let i = 0; i < 3; i++) noise({ at: t + i * .012, type: 'bandpass', f: 1300, q: .9, d: .03, vol: .14, dest: this.out }); noise({ at: t + .036, type: 'bandpass', f: 1300, q: .9, d: .14, vol: .1, dest: this.out }); },
  rim(t) { voice({ at: t, type: 'square', f: 1700, d: .02, vol: .05, lp: 3000, dest: this.out }); noise({ at: t, type: 'bandpass', f: 3200, q: 2, d: .025, vol: .08, dest: this.out }); },
  shaker(t, v) { noise({ at: t, type: 'bandpass', f: 6500, q: 1.5, a: .006, d: .045, vol: .035 * v, dest: this.out }); },
  conga(f, t, v = 1) { voice({ at: t, f, to: f * .85, a: .002, d: .2, vol: .22 * v, dest: this.out }); noise({ at: t, type: 'bandpass', f: 1500, d: .02, vol: .05, dest: this.out }); },
  tom(f, t) { voice({ at: t, f, to: f * .6, a: .002, d: .25, vol: .3, dest: this.out }); },
  brush(t, v) { noise({ at: t, type: 'bandpass', f: 4000, q: .7, a: .01, d: .07, vol: .06 * v, dest: this.out }); },
  crash(t) { noise({ at: t, type: 'highpass', f: 5000, d: 1.3, vol: .09, dest: this.out }); },
  // Eurobeat: a wide supersaw (detuned saws over a square an octave below), a distorted octave bass, a car racing past (Doppler)
  supersaw(f, t, d, v = 1) { synth({ at: t, f, parts: [['sawtooth', 1, .45, -14], ['sawtooth', 1, .45, 14], ['sawtooth', 1, .35], ['square', .5, .18]], a: .006, hold: Math.max(0, d - .05), d: .09, vol: .055 * v, lp: 4200, lpTo: 2400, dest: this.leadBus }); },
  bassEuro(f, t, d) { synth({ at: t, f, parts: [['sawtooth', 1, .8], ['square', 1, .3, 6]], a: .003, hold: d * .3, d: d * .5, vol: .13, lp: 1500, lpTo: 260, q: 4, dest: this.out }); },
  zoom(t, dur) {
    voice({ at: t, type: 'sawtooth', f: 90, to: 420, toAt: dur * .6, a: dur * .55, hold: dur * .05, d: .05, vol: .045, lp: 1800, dest: this.out });
    voice({ at: t + dur * .6, type: 'sawtooth', f: 400, to: 140, a: .01, d: dur * .4, vol: .045, lp: 1500, dest: this.out });
    noise({ at: t, type: 'bandpass', f: 400, to: 3200, a: dur * .6, d: dur * .3, vol: .05, q: 2, dest: this.out });
  },
  // desert: a nasal reed flute with a slide into the note and vibrato, the oud (a pluck that bends up a little), the darbuka (dum, tek),
  // finger cymbals, a drone, the wind of the storm
  reed(f, t, d) {
    synth({ at: t, f, parts: [['sawtooth', 1, .5], ['square', 1, .3, 6], ['sine', 2, .2]], a: .04, hold: Math.max(0, d * .8), d: .12, vol: .1, ft: 'bandpass', lp: Math.min(5000, f * 2.6), q: 2.2, vib: [6.2, .014], dest: this.leadBus });
    voice({ at: t, type: 'sine', f: f * .94, to: f, toAt: .05, a: .01, d: .06, vol: .03, dest: this.leadBus });
  },
  oud(f, t, v = 1) { voice({ at: t, type: 'sawtooth', f: f * .97, to: f, toAt: .03, a: .002, d: .32, vol: .07 * v, lp: 2200, dest: this.out }); voice({ at: t, type: 'triangle', f: f * 2, a: .002, d: .12, vol: .03 * v, dest: this.out }); },
  dum(t, v = 1) { voice({ at: t, f: 120, to: 70, a: .002, d: .28, vol: .42 * v, dest: this.out }); noise({ at: t, type: 'lowpass', f: 500, d: .06, vol: .12 * v, dest: this.out }); },
  tek(t, v = 1) { noise({ at: t, type: 'bandpass', f: 3200, q: 1.6, a: .001, d: .045, vol: .16 * v, dest: this.out }); voice({ at: t, type: 'triangle', f: 760, d: .03, vol: .05 * v, dest: this.out }); },
  zill(t) { voice({ at: t, f: 3150, a: .001, d: .35, vol: .025, dest: this.out }); voice({ at: t, f: 4720, a: .001, d: .22, vol: .015, dest: this.out }); },
  drone(f, t, d, v = 1) { synth({ at: t, f, parts: [['sawtooth', 1, .5], ['sawtooth', 1.003, .5]], a: .3, hold: Math.max(0, d - .5), d: .3, vol: .045 * v, lp: 700, dest: this.out }); },
  sandWind(t, d, gust, warn) { noise({ at: t, type: 'bandpass', f: 500 + 1400 * Math.max(gust, warn * .6), to: 600 + 2200 * Math.max(gust, warn), a: d * .4, hold: d * .3, d: d * .3, vol: .07 + .06 * gust, q: 1.3, dest: this.out }); },
  // ice: celesta, sleigh bells, a sub bass, a choir singing "aah", strings in sixteenths, timpani
  celesta(f, t, d) { synth({ at: t, f, parts: [['sine', 1, 1], ['sine', 4, .25], ['triangle', 2, .15]], a: .002, d: Math.max(.6, d), vol: .07, dest: this.leadBus }); },
  sleigh(t, v = 1) { for (let i = 0; i < 3; i++) noise({ at: t + i * .012, type: 'bandpass', f: 7000 + i * 900, q: 4, a: .001, d: .05, vol: .03 * v, dest: this.out }); },
  sub(f, t, d) { synth({ at: t, f, parts: [['sine', 1, 1], ['triangle', 1, .2]], a: .01, hold: d * .6, d: d * .4, vol: .3, dest: this.out }); },
  choir(ns, t, d) { for (const m of ns) synth({ at: t, f: hz(m), parts: [['sawtooth', 1, .5, -6], ['sawtooth', 1, .5, 6]], a: .4, hold: Math.max(0, d - .8), d: .5, vol: .02, ft: 'bandpass', lp: 800, q: 1.4, vib: [5, .006], dest: this.out }); },
  strings(f, t) { synth({ at: t, f, parts: [['sawtooth', 1, .6], ['sawtooth', 1, .4, 9]], a: .01, hold: this.sd * .5, d: .06, vol: .03, lp: 2400, dest: this.out }); },
  // volcano: taiko (a deep drum with a long tail), brass stabs, a distorted guitar (palm-muted or ringing), a singing lead guitar
  taiko(f, t, v = 1) { voice({ at: t, f, to: f * .55, a: .003, d: .7, vol: .45 * v, dest: this.out }); noise({ at: t, type: 'lowpass', f: 400, d: .25, vol: .15 * v, dest: this.out }); },
  brass(ns, t, d, v = 1) { for (const m of ns) synth({ at: t, f: hz(m), parts: [['sawtooth', 1, .6], ['sawtooth', 1, .4, 8], ['square', .5, .2]], a: .015, hold: Math.max(0, d - .04), d: .08, vol: .045 * v, lp: 2600, lpTo: 1200, dest: this.out }); },
  gtr(f, t, d, mute) { synth({ at: t, f, parts: [['sawtooth', 1, .6], ['square', 1, .5, 12], ['sawtooth', 2, .25, -7]], a: .002, hold: mute ? d * .3 : d * .8, d: mute ? .05 : .15, vol: mute ? .07 : .06, lp: mute ? 900 : 1900, q: 3, dest: this.out }); },
  gtrLead(f, t, d) { synth({ at: t, f, parts: [['sawtooth', 1, .5], ['square', 1, .4, 9], ['sawtooth', 2, .2]], a: .01, hold: Math.max(0, d - .06), d: .1, vol: .06, lp: 2800, q: 2, vib: [5.5, .008], dest: this.leadBus }); },
  timp(f, t, v = 1) { voice({ at: t, f: f * 1.02, to: f, a: .003, d: .6, vol: .3 * v, dest: this.out }); noise({ at: t, type: 'lowpass', f: 300, d: .15, vol: .1 * v, dest: this.out }); },
};
