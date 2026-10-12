// ---------- the save game ----------
// Everything the game keeps lives in localStorage under keys that start with 'mudracer-' (car, paint, cups, trophies, records,
// settings). The keys are never renamed or given a new meaning (ANALYSE.md: "Spielstände bleiben gültig"); new data gets new keys.
// SAVE_VERSION counts changes of the format as a whole and is kept in 'mudracer-save'; 1 = the keys as they have always been.
// All access goes through here: a browser without storage (private mode, blocked site data, tests) simply keeps nothing.
// The whole save can be written to a file and read back (options menu), e.g. to move it to another device.

export const PREFIX = 'mudracer-', SAVE_VERSION = 1, VERSION_KEY = PREFIX + 'save';

function store() { try { return globalThis.localStorage || null; } catch (e) { return null; } }

export function getItem(key) { try { const s = store(); return s ? s.getItem(key) : null; } catch (e) { return null; } }

export function setItem(key, value) { try { const s = store(); if (!s) return false; s.setItem(key, String(value)); return true; } catch (e) { return false; } }

// a whole number, or `fallback` when there is none (or it is not a number)
export function getInt(key, fallback = 0) { const v = parseInt(getItem(key), 10); return Number.isFinite(v) ? v : fallback; }

export function getJSON(key, fallback = null) {
  const v = getItem(key); if (v === null) return fallback;
  try { return JSON.parse(v); } catch (e) { return fallback; }
}

export const setJSON = (key, value) => setItem(key, JSON.stringify(value));

if (getItem(VERSION_KEY) === null) setItem(VERSION_KEY, SAVE_VERSION);

// ----- export and import -----

// every key of the game with its value
export function saveData() {
  const s = store(), data = {};
  if (s) for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k && k.startsWith(PREFIX)) data[k] = s.getItem(k); }
  return data;
}

export function exportSave() {
  return JSON.stringify({ game: 'mudracer', version: SAVE_VERSION, date: new Date().toISOString(), data: saveData() }, null, 1);
}

// reads an exported save back: its keys replace the ones here, keys it does not have stay as they are.
// Returns { ok, n } or { ok: false, error } (nothing is written then).
export function importSave(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { return { ok: false, error: 'KEINE SPIELSTAND-DATEI' }; }
  if (!o || o.game !== 'mudracer' || !o.data || typeof o.data !== 'object') return { ok: false, error: 'KEINE SPIELSTAND-DATEI' };
  if (!(o.version >= 1) || o.version > SAVE_VERSION) return { ok: false, error: 'ZU NEUE VERSION' };
  const entries = Object.entries(o.data).filter(([k, v]) => k.startsWith(PREFIX) && typeof v === 'string');
  if (!store()) return { ok: false, error: 'SPEICHER GESPERRT' };
  for (const [k, v] of entries) if (!setItem(k, v)) return { ok: false, error: 'SPEICHER VOLL' };
  return { ok: true, n: entries.length };
}

// ----- in the browser: as a file -----

export function downloadSave() {
  const url = URL.createObjectURL(new Blob([exportSave()], { type: 'application/json' })), a = document.createElement('a');
  a.href = url; a.download = 'mudracer-spielstand.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// lets the player pick a save file; done(result of importSave) once it is read
export function pickSave(done) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    f.text().then(t => done(importSave(t)), () => done({ ok: false, error: 'DATEI NICHT LESBAR' }));
  };
  inp.click();
}
