import { defineConfig } from 'vite';
import { vizConfig } from '../../kit/build/vite';

// dev.html (the harness) is served by the dev server only; it isn't part of the build.
export default defineConfig(vizConfig('raincloud', { raincloud: 'raincloud.html', 'raincloud-format': 'raincloud-format.html' }));
