import { fileURLToPath } from 'node:url';
import legacy from '@vitejs/plugin-legacy';
import type { UserConfig } from 'vite';

// Shared Vite setup for every viz in vizzes/<name>/:
// - pages live in vizzes/<name>/app and load code as /src/… (mapped to vizzes/<name>/src);
// - the kit is imported as @kit/…; the Tableau Extensions API library is served from kit/public/lib;
// - output goes to dist/<name>/ as classic SystemJS scripts without `crossorigin`. Tableau's sandbox hosting runs pages
//   with a null origin and no CORS headers, so module scripts would be refused there (verified with tabextsandbox).
// Tableau Desktop 2024.2–2025.1 embeds Chromium 87; 2025.2+ embeds Chromium 108.

const KIT = fileURLToPath(new URL('..', import.meta.url));
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

export const kitAlias = { find: /^@kit\//, replacement: `${KIT}/` };

export function vizConfig(name: string, pages: Record<string, string>): UserConfig {
  const viz = `${ROOT}/vizzes/${name}`;
  return {
    root: `${viz}/app`,
    base: './', // relative asset paths: required for sandboxed hosting
    publicDir: `${KIT}/public`,
    resolve: { alias: [kitAlias, { find: /^\/src\//, replacement: `${viz}/src/` }] },
    server: { port: 5173, strictPort: true },
    plugins: [
      legacy({ targets: ['chrome >= 87'], renderModernChunks: false }),
      { name: 'strip-crossorigin', enforce: 'post', transformIndexHtml: (html: string) => html.replace(/\s+crossorigin(="[^"]*")?/g, '') }
    ],
    build: {
      target: 'chrome87',
      outDir: `${ROOT}/dist/${name}`,
      emptyOutDir: true,
      rollupOptions: { input: Object.fromEntries(Object.entries(pages).map(([k, f]) => [k, `${viz}/app/${f}`])) }
    }
  };
}
