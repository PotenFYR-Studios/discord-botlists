import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

/** copies the generated status board into the build so the status page can fetch it */
function statusData(): Plugin {
  return {
    name: 'status-data',
    closeBundle() {
      const src = '../.status/status.json';
      const out = 'dist/status.json';
      if (existsSync(src)) copyFileSync(src, out);
    },
  };
}

export default defineConfig({
  base: '/discord-botlists/',
  plugins: [react(), statusData()],
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
