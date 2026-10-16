import { G } from './g.js';
import { AU } from './audio.js';
import { bugId, bugMeta, bugText } from './bugmeta.js';
import { cv } from './core.js';
import { ERR } from './errors.js';
import { releaseKeys } from './input.js';
import { openPause } from './menus.js';

// ---------- bugs and ideas (F8, dev server only) ----------
// F8 freezes the game, takes a picture of the screen and a snapshot (bugmeta.js) and opens a window: BUG or IDEE, a text,
// SPEICHERN. The dev server writes it to feedback/<art>_<id>.md and .jpg in the project (vite.config.js). main.js loads this
// module only on the dev server, so the published game knows nothing of it.

const RACE = new Set(['countdown', 'race']), KINDS = [['bug', 'BUG'], ['feature', 'IDEE / FEATURE']];
let box = null, cur = null;

/** the window is open: the game stands still (main.js) and the keys belong to the window (input.js) */
export const bugOpen = () => !!cur;

function el(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  Object.assign(e, attrs);
  e.append(...kids);
  return e;
}

function build() {
  const text = el('textarea', { id: 'bugtext', rows: 6, maxLength: 4000 });
  const info = el('div', { className: 'bugmeta' }), msg = el('div', { className: 'bugmsg' });
  const btn = (label, fn, title) => { const b = el('button', { type: 'button', textContent: label, title }); b.onclick = fn; return b; };
  // the kind: two boxes, one of them always ticked
  const kinds = KINDS.map(([v, label]) => {
    const inp = el('input', { type: 'checkbox', value: v });
    inp.onchange = () => setKind(inp.checked ? v : KINDS.find(k => k[0] !== v)[0]);
    return el('label', { className: 'bugkind' }, inp, ' ' + label);
  });
  box = el('div', { id: 'bug', hidden: true, role: 'dialog', ariaModal: 'true', ariaLabel: 'Bug oder Idee melden' },
    el('div', { className: 'bugwin' },
      el('h2', { textContent: 'MELDEN' }), info, el('div', { className: 'bugrow left' }, ...kinds), text,
      el('div', { className: 'bugrow' }, msg, btn('SPEICHERN', save, 'Strg+Enter'), btn('ABBRECHEN', close, 'Esc'))));
  box.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
  });
  document.body.append(box);
  Object.assign(box, { text, info, msg, kinds: kinds.map(l => l.querySelector('input')) });
}

function setKind(v) {
  cur.kind = v;
  for (const inp of box.kinds) inp.checked = inp.value === v;
  box.text.placeholder = v === 'bug' ? 'Was ist passiert? Was hast du erwartet?' : 'Was soll es geben? Wie soll es sich anfühlen?';
}

export function openBug() {
  if (cur) return;
  if (!box) build();
  const meta = bugMeta({ build: import.meta.env.MUDRACER_COMMIT || '?', fenster: innerWidth + 'x' + innerHeight, ...(ERR.n ? { fehler: ERR.n + ': ' + ERR.msg } : {}) });
  let img = null;
  try { img = cv.toDataURL('image/jpeg', .85); } catch (e) {}
  cur = { meta, img, was: G.state, kind: 'bug' };
  releaseKeys();
  AU.hold = true;
  if (AU.a && AU.a.state === 'running') { AU.a.suspend(); cur.sound = true; }
  box.info.textContent = [meta.strecke, meta.runde && 'RUNDE ' + meta.runde, meta.platz && 'PLATZ ' + meta.platz, meta.modus, meta.bildschirm].filter(Boolean).join(' · ');
  box.text.value = ''; box.msg.textContent = '';
  setKind('bug');
  box.hidden = false;
  box.text.focus();
}

function close() {
  if (!cur) return;
  box.hidden = true;
  AU.hold = false;
  if (cur.sound) AU.a.resume();
  const was = cur.was; cur = null;
  // a race does not go on by itself: the pause menu waits (ESC = WEITER)
  if (RACE.has(was) && G.state === was) openPause();
}

async function save() {
  if (!cur || cur.saving) return;
  cur.saving = true;
  const r = { id: bugId(cur.meta, cur.kind), kind: cur.kind, text: box.text.value, meta: cur.meta, img: cur.img };
  try {
    const res = await fetch('/__bug', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, md: bugText(r), img: r.img }) });
    const o = await res.json();
    if (!o.ok) throw new Error(o.error);
    close();
    flash('GESPEICHERT: ' + o.file);
  } catch (e) {
    cur.saving = false;
    box.msg.textContent = 'NICHT GESPEICHERT: ' + (e.message || e); // the text stays, try again
  }
}

// a short note at the bottom of the screen after saving
function flash(s) {
  const n = el('div', { className: 'bugflash', textContent: s });
  document.body.append(n);
  setTimeout(() => n.remove(), 2500);
}

addEventListener('keydown', e => {
  if (e.key !== 'F8') return;
  e.stopPropagation();
  e.preventDefault();
  if (cur) close(); else openBug();
}, true);
