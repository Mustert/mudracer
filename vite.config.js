import { execSync } from 'child_process';
import fs from 'fs';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// the commit the game is built from; a bug report names it (bugreport.js)
let commit = '?';
try { commit = execSync('git rev-parse --short HEAD').toString().trim() + (execSync('git status --porcelain').toString().trim() ? '+' : ''); } catch (e) {}

// dev server only: the bug window (F8, bugreport.js) posts its report here, it lands in bugs/<id>.md and bugs/<id>.jpg
function bugInbox() {
  return {
    name: 'mudracer-bugs',
    configureServer(server) {
      server.middlewares.use('/__bug', (req, res) => {
        let body = '';
        req.on('data', d => { body += d; });
        req.on('end', () => {
          const answer = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
          try {
            const { id, md, img } = JSON.parse(body);
            if (!/^[\w-]{1,80}$/.test(id) || typeof md !== 'string') return answer({ ok: false, error: 'UNGUELTIG' });
            fs.mkdirSync('bugs', { recursive: true });
            fs.writeFileSync('bugs/' + id + '.md', md);
            if (typeof img === 'string' && img.startsWith('data:image/jpeg;base64,')) fs.writeFileSync('bugs/' + id + '.jpg', Buffer.from(img.slice(23), 'base64'));
            answer({ ok: true, file: 'bugs/' + id + '.md' });
          } catch (e) { answer({ ok: false, error: String(e.message || e).slice(0, 60) }); }
        });
      });
    },
  };
}

// The build produces one self-contained dist/index.html (this is what gets published as the artifact).
export default defineConfig({
  plugins: [viteSingleFile(), bugInbox()],
  server: { port: 5177, strictPort: true },
  define: { 'import.meta.env.MUDRACER_COMMIT': JSON.stringify(commit) },
});
