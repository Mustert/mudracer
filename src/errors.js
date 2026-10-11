// ---------- errors are never swallowed silently ----------
// Everything that goes wrong is logged; on the dev server (npm run dev) main.js also shows the last error on the screen,
// so a broken frame cannot go unnoticed while testing.

export const ERR = { n: 0, msg: '' };

export function reportError(e, where) {
  ERR.n++;
  ERR.msg = (where ? where + ': ' : '') + ((e && e.message) || String(e));
  console.error(where || 'Fehler', e);
}
