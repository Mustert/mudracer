import fs from 'fs';
import { describe, expect, it } from 'vitest';

// the modules may not import each other in circles (ANALYSE.md T7); only the sound (audio.js and music.js) is one unit
describe('module imports', () => {
  it('have no circles', () => {
    const files = fs.readdirSync('src').filter(f => f.endsWith('.js')), deps = {};
    for (const f of files) deps[f] = [...fs.readFileSync('src/' + f, 'utf8').matchAll(/^import .* from '\.\/(\w+\.js)';/gm)].map(m => m[1]);
    let n = 0; const stack = [], on = new Set(), ix = {}, low = {}, circles = [];
    const visit = v => {
      ix[v] = low[v] = n++; stack.push(v); on.add(v);
      for (const w of deps[v] || []) { if (ix[w] === undefined) { visit(w); low[v] = Math.min(low[v], low[w]); } else if (on.has(w)) low[v] = Math.min(low[v], ix[w]); }
      if (low[v] === ix[v]) { const c = []; let w; do { w = stack.pop(); on.delete(w); c.push(w); } while (w !== v); if (c.length > 1) circles.push(c.sort().join(' ')); }
    };
    for (const f of files) if (ix[f] === undefined) visit(f);
    expect(circles).toEqual(['audio.js music.js']);
  });
});
