// @vitest-environment happy-dom
// Renders showcase images (docs/images/*.svg) with the real chart engine, for the README and galleries.
// Run: npm run showcase
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { buildGrid, type Grid, type GridRecord } from '../../vizzes/raincloud/src/chart/model';
import { DEFAULT_OPTIONS, type RaincloudOptions } from '../../vizzes/raincloud/src/chart/options';
import { DEFAULT_THEME, renderRaincloud } from '../../vizzes/raincloud/src/chart/render';
import { VALUE, sampleRecords, type Shape } from '../../vizzes/raincloud/src/extension/splash';

const OUT = join(__dirname, '../../docs/images');
const noop = { onHover() {}, onSelect() {} };
const base: RaincloudOptions = { ...structuredClone(DEFAULT_OPTIONS), axis: { ...DEFAULT_OPTIONS.axis, range: 'data' } };
const records = sampleRecords();
const shape = (s: Shape) => records.filter((r) => r.rowPath[0] === s).map((r) => ({ ...r, rowPath: [] }));

function svg(name: string, grid: Grid, opts: Partial<RaincloudOptions>, w: number, h: number): void {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { value: w });
  Object.defineProperty(host, 'clientHeight', { value: h });
  document.body.appendChild(host);
  renderRaincloud(host, grid, { ...base, ...opts }, DEFAULT_THEME, new Set(), noop);
  const el = host.querySelector('svg')!;
  el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  el.setAttribute('viewBox', `0 0 ${el.getAttribute('width')} ${el.getAttribute('height')}`);
  el.removeAttribute('class');
  // White card behind the chart so it reads on GitHub's dark theme too.
  const bg = `<rect width="100%" height="100%" fill="#ffffff"/>`;
  writeFileSync(join(OUT, `${name}.svg`), el.outerHTML.replace(/(<svg[^>]*>)/, `$1${bg}`));
  host.remove();
}

function outliersGrid(): Grid {
  const lines = readFileSync(join(__dirname, '../../data/synthetic/outliers_response_ms.csv'), 'utf8').trim().split(/\r?\n/);
  const rows: GridRecord[] = lines.slice(1).map((l, i) => {
    const c = l.split(',');
    return { rowPath: [c[1]], colPath: [], colour: null, value: Number(c[2]), tupleId: i + 1 };
  });
  return buildGrid(rows, ['Server'], [], 'Response time (ms)');
}

it('renders showcase images', () => {
  mkdirSync(OUT, { recursive: true });
  const labels = { markers: { ...base.markers, showValues: true } };
  const quiet = { markers: { ...base.markers, percentiles: [], showValues: false, mean: false } };

  // Hero options for the landing page
  svg('hero-a-rows-columns', buildGrid(records.map((r) => ({ ...r, colPath: [r.colour ?? ''] })), ['Category'], ['Sub-group'], VALUE), labels, 900, 420);
  svg('hero-b-shape-panels', buildGrid(records.map((r) => ({ ...r, colPath: r.rowPath, rowPath: [] })), [], ['Category'], VALUE, 'Sub-group'),
    { ...labels, panels: { ...base.panels, axis: 'independent' } }, 900, 230);
  svg('hero-c-rows', buildGrid(records, ['Category'], [], VALUE), labels, 900, 300);

  // Feature thumbnails
  svg('feature-dot-plot', buildGrid(shape('Bimodal'), [], [], 'Bimodal'), quiet, 440, 150);
  svg('feature-strip', buildGrid(shape('Normal'), [], [], 'Normal'), { ...quiet, rain: 'strip' }, 440, 150);
  svg('feature-histogram', buildGrid(shape('Right-skewed'), [], [], 'Right-skewed'), { ...quiet, cloud: 'histogram', rain: 'strip' }, 440, 150);
  svg('feature-colour', buildGrid(shape('Bimodal'), [], [], 'Bimodal', 'Sub-group'), quiet, 440, 170);
  svg('feature-split-cloud', buildGrid(shape('Bimodal'), [], [], 'Bimodal', 'Sub-group'), { ...quiet, colour: { ...base.colour, splitCloud: true } }, 440, 170);
  svg('feature-outliers-cut', outliersGrid(), { ...labels, axis: { ...DEFAULT_OPTIONS.axis } }, 700, 260);
});
