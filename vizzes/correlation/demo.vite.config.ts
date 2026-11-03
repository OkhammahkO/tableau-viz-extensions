import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { vizConfig } from '../../kit/build/vite';

// The live demo for the website: the dev harness (dev.html) built on its own, with the correlation CSVs bundled.
// scripts/build-site.mjs renames dev.html to index.html.
const base = vizConfig('correlation', { demo: 'dev.html' });
export default defineConfig({
  ...base,
  publicDir: false, // the demo runs outside Tableau, so it doesn't need the Extensions API library
  build: { ...base.build, outDir: fileURLToPath(new URL('../../dist/site/correlation/demo', import.meta.url)) }
});
