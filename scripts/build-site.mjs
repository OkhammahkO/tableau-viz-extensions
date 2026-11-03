// Builds the GitHub Pages site into dist/site/:
//   index.html, site.css, images/   the portfolio home page and shared styles (site/), showcase images (docs/images/)
//   <viz>/index.html                each viz's page (site/<viz>/index.html)
//   <viz>/                          the hosted extension (what <viz>.trex points at; its URL never changes)
//   <viz>/<viz>.trex                the manifest people download
//   <viz>/demo/                     the live demo (the dev harness with the synthetic datasets)
// for raincloud and correlation.
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
await build({ configFile: 'vizzes/correlation/vite.config.ts' });
await build({ configFile: 'vizzes/correlation/demo.vite.config.ts' });
renameSync(`${SITE}/correlation/demo/dev.html`, `${SITE}/correlation/demo/index.html`);
cpSync('dist/correlation', `${SITE}/correlation`, { recursive: true });
cpSync('correlation.trex', `${SITE}/correlation/correlation.trex`);
cpSync('site', SITE, { recursive: true });
mkdirSync(`${SITE}/images`, { recursive: true });
cpSync('docs/images', `${SITE}/images`, { recursive: true });
console.log(`site built in ${SITE}/`);
