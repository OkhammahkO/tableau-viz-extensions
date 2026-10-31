import { defineConfig } from 'vitest/config';
import { kitAlias } from './kit/build/vite';

export default defineConfig({
  resolve: { alias: [kitAlias] },
  test: { include: ['kit/**/*.test.ts', 'vizzes/**/*.test.ts'] }
});
