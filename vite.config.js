import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The build produces one self-contained dist/index.html (this is what gets published as the artifact).
export default defineConfig({
  plugins: [viteSingleFile()],
  server: { port: 5177, strictPort: true },
});
