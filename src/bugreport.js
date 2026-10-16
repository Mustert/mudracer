import { G } from './g.js';
import { AU } from './audio.js';
import { bugId, bugMeta, bugText } from './bugmeta.js';
import { cv } from './core.js';
import { ERR } from './errors.js';
import { releaseKeys, touchShown } from './input.js';
import { openPause } from './menus.js';
import { getJSON, setJSON } from './save.js';

// ---------- bug reports (F8) ----------
// F8 freezes the game, takes a picture of the screen and a snapshot (bugmeta.js) and opens a window to describe the bug.
// SPEICHERN keeps the report in the save game ('mudracer-bugs', the last KEEP reports, so they also travel with an exported
// save) and on the dev server writes it to bugs/<id>.md and bugs/<id>.jpg in the project (vite.config.js). KOPIEREN puts all
// kept reports on the clipboard as Markdown, DATEI downloads them as JSON (both for the published game, which has no server).

const KEY = 'mudracer-bugs', KEEP = 20, RACE = new Set(['countdown', 'race']);
let box = null, cur = null;

/** the bug window is open: the game stands still (main.js) and the keys belong to the window (input.js) */
export const bugOpen = () => !!cur;

const reports = () => getJSON(KEY, []);

// keeps the report; when the storage is full, the pictures of the oldest reports go first, then the oldest reports
function keep(r) {
  const list = [...reports(), r].slice(-KEEP);
  for (let i = 0; i <= list.length; i++) {
    if (setJSON(KEY, list)) return true;
    if (i < list.length - 1) delete list[i].img; else list.shift();
  }
  return false;
}

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  Object.assign(e, attrs);
  e.append(...kids);
  return e;
}

function build() {
  const text = el('textarea', { id: 'bugtext', placeholder: 'Was ist passiert? Was hast du erwartet?', rows: 6, maxLength: 4000 });
  const info = el('div', { className: 'bugmeta' }), msg = el('div', { className: 'bugmsg' });
  const btn = (label, fn, title = '') => { const b = el('button', { type: 'button', textContent: label, title }); b.onclick = fn; return b; };
  box = el('div', { id: 'bug', hidden: true, role: 'dialog', ariaModal: 'true', ariaLabel: 'Bug melden' },
    el('div', { className: 'bugwin' },
      el('h2', { textContent: 'BUG MELDEN' }), info, text,
      el('div', { className: 'bugrow' }, btn('SPEICHERN', save, 'Strg+Enter'), btn('ABBRECHEN', close, 'Esc')),
      el('div', { className: 'bugrow small' }, msg, btn('KOPIEREN', copyAll, 'alle gespeicherten Meldungen als Text'), btn('DATEI', download, 'alle gespeicherten Meldungen als JSON-Datei'))));
  box.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
  });
  document.body.append(box);
  Object.assign(box, { text, info, msg });
}

const say = s => { box.msg.textContent = s; };
const countMsg = () => { const n = reports().length; return n ? n + (n === 1 ? ' MELDUNG' : ' MELDUNGEN') + ' GESPEICHERT' : ''; };

export function openBug() {
  if (cur) return;
  if (!box) build();
  const meta = bugMeta({
    build: (import.meta.env.MUDRACER_COMMIT || '?') + (import.meta.env.DEV ? ' (dev)' : ''),
    fenster: innerWidth + 'x' + innerHeight, touch: touchShown(), browser: navigator.userAgent,
    ...(ERR.n ? { fehler: ERR.n + ': ' + ERR.msg } : {}),
  });
  let img = null;
  try { img = cv.toDataURL('image/jpeg', .85); } catch (e) {}
  cur = { meta, img, was: G.state };
  releaseKeys();
  if (AU.a && AU.a.state === 'running') { AU.a.suspend(); cur.sound = true; }
  box.info.textContent = [meta.strecke, meta.runde && 'RUNDE ' + meta.runde, meta.platz && 'PLATZ ' + meta.platz, meta.modus, meta.bildschirm].filter(Boolean).join(' · ');
  box.text.value = '';
  say(countMsg());
  box.hidden = false;
  box.text.focus();
}

function close() {
  if (!cur) return;
  box.hidden = true;
  if (cur.sound) AU.a.resume();
  const was = cur.was; cur = null;
  cv.focus();
  // a race does not go on by itself: the pause menu waits (ESC = WEITER)
  if (RACE.has(was) && G.state === was) openPause();
}

async function save() {
  if (!cur) return;
  const r = { id: bugId(cur.meta), text: box.text.value, meta: cur.meta, img: cur.img };
  const kept = keep(r);
  let where = kept ? 'GESPEICHERT' : 'SPEICHER VOLL';
  if (import.meta.env.DEV) {
    try {
      const res = await fetch('/__bug', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, md: bugText(r), img: r.img }) });
      const o = await res.json();
      where = o.ok ? 'GESPEICHERT: ' + o.file : 'FEHLER: ' + o.error;
    } catch (e) { where += ' (NICHT IN bugs/)'; }
  }
  close();
  flash(where);
}

// a short note at the bottom of the screen after saving
function flash(s) {
  const n = el('div', { className: 'bugflash', textContent: s });
  document.body.append(n);
  setTimeout(() => n.remove(), 2500);
}

async function copyAll() {
  const list = reports();
  if (!list.length) { say('NOCH NICHTS GESPEICHERT'); return; }
  try { await navigator.clipboard.writeText(list.map(bugText).join('\n---\n\n')); say(list.length + ' KOPIERT (OHNE BILDER)'); }
  catch (e) { say('KOPIEREN GESPERRT'); }
}

function download() {
  const list = reports();
  if (!list.length) { say('NOCH NICHTS GESPEICHERT'); return; }
  try {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ game: 'mudracer', bugs: list }, null, 1)], { type: 'application/json' })), a = el('a', { href: url, download: 'mudracer-bugs.json' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say(list.length + ' ALS DATEI');
  } catch (e) { say('DOWNLOAD GESPERRT'); }
}

addEventListener('keydown', e => {
  if (e.key !== 'F8') return;
  e.stopPropagation();
  e.preventDefault();
  if (cur) close(); else openBug();
}, true);
