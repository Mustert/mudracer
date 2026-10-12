import { beforeEach, describe, expect, it } from 'vitest';

// a little localStorage for node
class Store {
  constructor() { this.m = new Map(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
globalThis.localStorage = new Store();
const S = await import('../src/save.js');

describe('save game', () => {
  beforeEach(() => { globalThis.localStorage = new Store(); });
  it('reads and writes values, numbers and JSON', () => {
    S.setItem('mudracer-car', 3);
    expect(S.getItem('mudracer-car')).toBe('3');
    expect(S.getInt('mudracer-car')).toBe(3);
    expect(S.getInt('mudracer-nix', 7)).toBe(7);
    S.setJSON('mudracer-cups', [1, 2]);
    expect(S.getJSON('mudracer-cups')).toEqual([1, 2]);
    localStorage.setItem('mudracer-bad', '{');
    expect(S.getJSON('mudracer-bad', 'x')).toBe('x');
  });
  it('exports only the keys of the game, and imports them back', () => {
    S.setItem('mudracer-tt-WIESE-flitzer', '{"t":40}'); S.setItem('mudracer-paint-quad', '4'); localStorage.setItem('other', 'x');
    const file = S.exportSave(), o = JSON.parse(file);
    expect(o.game).toBe('mudracer'); expect(o.version).toBe(S.SAVE_VERSION);
    expect(Object.keys(o.data).sort()).toEqual(['mudracer-paint-quad', 'mudracer-tt-WIESE-flitzer']);
    globalThis.localStorage = new Store();
    S.setItem('mudracer-car', '2');
    const r = S.importSave(file);
    expect(r).toEqual({ ok: true, n: 2 });
    expect(S.getItem('mudracer-tt-WIESE-flitzer')).toBe('{"t":40}');
    expect(S.getItem('mudracer-car')).toBe('2'); // keys the file does not have stay
  });
  it('refuses files that are no save, or from a newer game, and writes nothing then', () => {
    expect(S.importSave('hallo').ok).toBe(false);
    expect(S.importSave('{"game":"x","version":1,"data":{}}').ok).toBe(false);
    expect(S.importSave(JSON.stringify({ game: 'mudracer', version: S.SAVE_VERSION + 1, data: { 'mudracer-car': '1' } })).ok).toBe(false);
    expect(S.getItem('mudracer-car')).toBe(null);
  });
  it('ignores foreign keys and non-text values in a file', () => {
    const r = S.importSave(JSON.stringify({ game: 'mudracer', version: 1, data: { 'mudracer-car': '1', evil: 'x', 'mudracer-n': 5 } }));
    expect(r).toEqual({ ok: true, n: 1 });
    expect(localStorage.getItem('evil')).toBe(null);
  });
  it('keeps working without any storage', () => {
    globalThis.localStorage = undefined;
    expect(S.getItem('mudracer-car')).toBe(null);
    expect(S.setItem('mudracer-car', 1)).toBe(false);
    expect(S.importSave(JSON.stringify({ game: 'mudracer', version: 1, data: {} })).ok).toBe(false);
  });
});
