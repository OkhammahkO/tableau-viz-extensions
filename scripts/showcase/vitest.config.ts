import { defineConfig } from 'vitest/config';
import { kitAlias } from '../../kit/build/vite';

// Separate from the test suite: `npm run showcase` writes docs/images/*.svg.
export default defineConfig({ resolve: { alias: [kitAlias] }, test: { include: ['scripts/showcase/showcase.test.ts'] } });
