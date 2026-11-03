import { defineConfig } from 'vite';
import { vizConfig } from '../../kit/build/vite';

// Correlation matrix (candidate 6): the extension and its Format dialog; dev.html (harness) and spike.html are dev only.
const base = vizConfig('correlation', { correlation: 'correlation.html', 'correlation-format': 'correlation-format.html' });
export default defineConfig({ ...base, server: { port: 5174, strictPort: true } }); // raincloud's dev server uses 5173
