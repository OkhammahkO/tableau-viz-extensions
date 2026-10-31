// Builds the GitHub Pages site into dist/site/:
//   index.html, images/           the landing page (site/) and the showcase SVGs (docs/images/)
//   raincloud/                    the hosted extension (what raincloud.trex points at)
//   raincloud/raincloud.trex      the manifest people download
//   raincloud/demo/               the live demo (the dev harness with the synthetic datasets)
// Run: npm run site   (then `npx vite preview --outDir dist/site` to look at it locally)
import { cpSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { build } from 'vite';

const SITE = 'dist/site';
rmSync(SITE, { recursive: true, force: true });
await build({ configFile: 'vizzes/raincloud/vite.config.ts' });
await build({ configFile: 'vizzes/raincloud/demo.vite.config.ts' });
renameSync(`${SITE}/raincloud/demo/dev.html`, `${SITE}/raincloud/demo/index.html`);
cpSync('dist/raincloud', `${SITE}/raincloud`, { recursive: true });
cpSync('raincloud.trex', `${SITE}/raincloud/raincloud.trex`);
cpSync('site', SITE, { recursive: true });
mkdirSync(`${SITE}/images`, { recursive: true });
cpSync('docs/images', `${SITE}/images`, { recursive: true });
console.log(`site built in ${SITE}/`);
