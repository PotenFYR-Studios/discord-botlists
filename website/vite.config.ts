import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

/** custom domain support: website/CNAME presence switches the deploy mode. */
function customDomain(): string | null {
  try {
    const raw = readFileSync(new URL('./CNAME', import.meta.url), 'utf8').trim();
    return raw || null;
  } catch {
    return null;
  }
}

const DOMAIN = customDomain();

/** copies the generated status board into the build so the status page can fetch it */
function statusData(): Plugin {
  return {
    name: 'status-data',
    closeBundle() {
      const src = '../.status/status.json';
      const out = 'dist/status.json';
      if (existsSync(src)) copyFileSync(src, out);
      if (DOMAIN) writeFileSync('dist/CNAME', DOMAIN);
    },
  };
}

export default defineConfig({
  // custom domain (CNAME file present): root base. otherwise project path.
  base: DOMAIN ? '/' : '/discord-botlists/',
  plugins: [react(), statusData()],
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
