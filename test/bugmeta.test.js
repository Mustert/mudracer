import { describe, expect, it } from 'vitest';
import { G, PREFS, UI } from '../src/g.js';
import { bugId, bugMeta, bugText } from '../src/bugmeta.js';

const car = (name, ai, o) => ({ def: { name }, ai, x: 100.4, y: 50.6, ang: Math.PI / 2, vx: 30, vy: 40, lap: 2, idx: 10, finished: false, place: 0, dirt: .456, surf: 1, ...o });

function race() {
  Object.assign(G, { state: 'race', stateTime: 42.37, mode: 'gp', raceDiff: 1, fx: true, tt: null, run: null,
    gp: { cup: { name: 'GOLD' }, race: 1, tracks: [6, 7, 8] } });
  G.T = { name: 'WUESTE', N: 1000, def: { rev: 1, events: ['sandsturm'] } };
  G.cars = [car('FLITZER', false, {}), car('MONSTER', true, { idx: 20, spin: .25 })];
  G.player = G.cars[0];
  Object.assign(PREFS, { diff: 0, kids: false, events: { sandsturm: true } });
}

describe('bug report', () => {
  it('knows track, lap, place, mode and every car', () => {
    race();
    const m = bugMeta({ build: 'abc' });
    expect(m).toMatchObject({ bildschirm: 'race', modus: 'GRAND PRIX', strecke: 'WUESTE (rev 1)', schwierigkeit: 'MITTEL', cup: 'GOLD, Rennen 2/3',
      runde: '2/3', platz: '2/2', auto: 'FLITZER', rennzeit: '42.4 s (race)', ereignisse: 'sandsturm', build: 'abc' });
    expect(m.autos[0]).toMatchObject({ nr: 1, auto: 'FLITZER', ich: true, x: 100, y: 51, winkel: 90, tempo: 50, runde: 2, platz: 2, dreck: .5 });
    expect(m.autos[1]).toMatchObject({ ich: false, platz: 1, spin: .3 });
    expect(m.autos[0].spin).toBeUndefined();
  });

  it('keeps the race state in the pause menu and leaves cars out in the menus', () => {
    race();
    Object.assign(G, { state: 'pause', stateTime: 3 }); Object.assign(UI, { pauseFrom: 'race', pauseT: 12 });
    expect(bugMeta()).toMatchObject({ bildschirm: 'pause (race)', rennzeit: '12 s (race)' });
    G.state = 'main';
    const m = bugMeta();
    expect(m.autos).toBeUndefined();
    expect(m.runde).toBeUndefined();
  });

  it('writes Markdown with the text, the snapshot and the cars', () => {
    race();
    const meta = bugMeta(), r = { id: bugId(meta, 'feature'), kind: 'feature', text: 'Auto haengt | fest', meta, img: 'data:x' };
    expect(r.id).toMatch(/^feature_\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d_WUESTE$/);
    const md = bugText(r);
    expect(md).toContain('# Idee ' + r.id);
    expect(md).toContain('Auto haengt | fest');
    expect(md).toContain('| strecke | WUESTE (rev 1) |');
    expect(md).toContain('| 2 | MONSTER |');
    expect(md).toContain('![Bildschirm](' + r.id + '.jpg)');
  });
});
