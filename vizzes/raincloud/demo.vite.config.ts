import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { vizConfig } from '../../kit/build/vite';

// The live demo for the website: the dev harness (dev.html) built on its own, with the synthetic CSVs bundled.
// scripts/build-site.mjs renames dev.html to index.html.
const base = vizConfig('raincloud', { demo: 'dev.html' });
export default defineConfig({
  ...base,
  publicDir: false, // the demo runs outside Tableau, so it doesn't need the Extensions API library
  build: { ...base.build, outDir: fileURLToPath(new URL('../../dist/site/raincloud/demo', import.meta.url)) }
});
