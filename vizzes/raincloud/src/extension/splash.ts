import { buildGrid, type GridRecord } from '../chart/model';
import { DEFAULT_OPTIONS, type RaincloudOptions } from '../chart/options';
import { DEFAULT_THEME, renderRaincloud } from '../chart/render';
import { el, featureChips, pill, step } from '@kit/ui/splash';

// The getting-started screen shown before a measure is on Value. Live mini rainclouds drawn by the real
// engine from built-in sample data, three Tableau-style steps, and a few option thumbnails. Adapts to the
// frame: thumbnails go first when space is short; the steps always stay visible.

// Three textbook shapes, labelled by shape so the examples explain themselves. In the bimodal set, the
// sub-group mostly explains the two humps, which is what the "Colour by group" thumbnail shows off.
/** Generic example names, so the landing page is about roles, not a story; members keep the shape names. */
export const VALUE = 'Value';
export type Shape = 'Normal' | 'Bimodal' | 'Right-skewed';

export function sampleRecords(): GridRecord[] {
  let seed = 42;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const norm = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
  const out: GridRecord[] = [];
  let id = 1;
  const add = (shape: Shape, value: number, colour: string) =>
    out.push({ rowPath: [shape], colPath: [], colour, value: Math.round(value * 10) / 10, tupleId: id++ });
  for (let i = 0; i < 90; i++) add('Normal', 50 + norm() * 8, rand() < 0.5 ? 'Group A' : 'Group B');
  for (let i = 0; i < 90; i++) {
    const low = rand() < 0.5;
    const sub = rand() < 0.85 ? (low ? 'Group B' : 'Group A') : low ? 'Group A' : 'Group B';
    add('Bimodal', (low ? 33 : 67) + norm() * 5, sub);
  }
  for (let i = 0; i < 90; i++) add('Right-skewed', 24 + Math.exp(norm() * 0.6) * 11, rand() < 0.5 ? 'Group A' : 'Group B');
  return out;
}

const noop = { onHover() {}, onSelect() {} };
const base: RaincloudOptions = { ...structuredClone(DEFAULT_OPTIONS), axis: { ...DEFAULT_OPTIONS.axis, range: 'data' } };

// Each thumbnail uses the distribution that shows its option off best.
const THUMBS: { title: string; note: string; shape: Shape; opts: Partial<RaincloudOptions>; colour?: boolean; panels?: boolean }[] = [
  { title: 'Rows × Columns', note: "panels like Tableau's shelves", shape: 'Bimodal', opts: {}, panels: true },
  { title: 'Dot plot', note: 'stacks reveal two humps', shape: 'Bimodal', opts: {} },
  { title: 'Strip', note: 'compact rows', shape: 'Normal', opts: { rain: 'strip' } },
  { title: 'Histogram cloud', note: 'bins show the long tail', shape: 'Right-skewed', opts: { cloud: 'histogram', rain: 'strip' } },
  { title: 'Colour by group', note: 'sub-group explains the humps', shape: 'Bimodal', opts: {}, colour: true }
];


// Key Format Extension options, hinted on the landing page so people know to look there.
const FEATURES: [string, string][] = [
  ['Cloud', 'smooth or histogram'],
  ['Rain', 'stacked dots or strip'],
  ['Outliers', 'cut automatically · click the badge to show all'],
  ['Markers', 'median, mean, P5/P95 with values'],
  ['Layout', 'fit modes · panels per row'],
  ['Colour', 'split by sub-group']
];

// Hero: the three shapes stacked beside the steps, each its own small chart so each fills its own axis
// (one shared axis made them look chopped). Legend on the top chart only, axis title on the bottom one only.
const SHAPES: Shape[] = ['Normal', 'Bimodal', 'Right-skewed'];

export function renderSplash(host: HTMLElement): void {
  host.replaceChildren();
  const W = host.clientWidth || 600;
  const H = host.clientHeight || 400;
  const roomy = W >= 640 && H >= 400;
  const medium = W >= 420 && H >= 300;

  const page = el('div', `sp-page ${roomy ? 'sp-roomy' : medium ? 'sp-medium' : 'sp-small'}`);

  const head = el('header', 'sp-head');
  head.append(el('h1', 'sp-title', 'Raincloud'), el('p', 'sp-lede', 'See the whole distribution: its shape, its summary and every record.'));
  page.append(head);

  const main = el('div', 'sp-main');
  const steps = el('ol', 'sp-steps');
  steps.append(
    step(1, [pill('SUM(Value)', 'measure')], 'Value', 'The measure whose distribution you want to see.'),
    step(2, [pill('Category', 'dimension')], 'Rows', 'Optional: one raincloud per member. Add a dimension like Sub-group to Colour to split the dots by sub-group; Columns gives side-by-side panels.'),
    step(3, [pill('Row ID', 'dimension')], 'Detail', 'One dot per record (or turn off Analysis → Aggregate Measures).'),
    step(4, [pill('Format Extension', 'button')], 'Fine-tune', 'Below the tiles on the Marks card.', featureChips(FEATURES))
  );
  main.append(steps);

  if (medium) {
    const hero = el('div', 'sp-hero sp-hero-stack');
    hero.setAttribute('aria-hidden', 'true');
    for (const s of SHAPES) hero.append(Object.assign(el('div', 'sp-hero-panel'), { title: s }));
    main.append(hero);
  }
  page.append(main);

  if (roomy) {
    const more = el('section', 'sp-more');
    const title = el('h2', 'sp-more-title', 'Make it yours');
    const hint = el('p', 'sp-more-hint', 'A few of the looks you can switch to in Format Extension:');
    const grid = el('div', 'sp-thumbs');
    for (const t of THUMBS) {
      const card = el('figure', t.panels ? 'sp-thumb sp-thumb-wide' : 'sp-thumb');
      const chart = el('div', 'sp-thumb-chart');
      chart.setAttribute('aria-hidden', 'true');
      const cap = el('figcaption');
      cap.append(el('b', '', t.title), el('span', '', t.note));
      card.append(cap, chart); // title and note above the picture
      grid.append(card);
      (card as HTMLElement & { _opts?: unknown })._opts = t;
    }
    more.append(title, hint, grid);
    page.append(more);
  }
  host.append(page);

  // Draw the live previews now that their boxes have sizes.
  const records = sampleRecords();
  page.querySelectorAll<HTMLElement>('.sp-hero-panel').forEach((panel, i) => {
    const s = SHAPES[i];
    const last = i === SHAPES.length - 1;
    const grid = buildGrid(records.filter((r) => r.rowPath[0] === s), ['Category'], [], last ? VALUE : '', 'Sub-group');
    renderRaincloud(panel, grid,
      { ...base, colour: { ...base.colour, showLegend: i === 0 }, markers: { ...base.markers, showValues: true } }, DEFAULT_THEME, new Set(), noop);
  });
  page.querySelectorAll<HTMLElement>('.sp-thumb').forEach((card) => {
    const t = (card as HTMLElement & { _opts?: (typeof THUMBS)[number] })._opts!;
    const one = records.filter((r) => r.rowPath[0] === t.shape).map((r) => ({ ...r, rowPath: [] }));
    // The panels thumbnail: Category (Normal, Bimodal) on Rows × Sub-group on Columns.
    const grid = t.panels
      ? buildGrid(records.filter((r) => r.rowPath[0] !== 'Right-skewed').map((r) => ({ ...r, colPath: [r.colour ?? ''] })), ['Category'], ['Sub-group'], VALUE)
      : t.colour ? buildGrid(one, [], [], t.shape, 'Sub-group') : buildGrid(one, [], [], t.shape);
    renderRaincloud(card.querySelector<HTMLElement>('.sp-thumb-chart')!, grid,
      { ...base, ...t.opts, axis: { ...base.axis, titleMode: t.panels ? 'auto' : 'hidden' }, scales: { ...base.scales, cloudLabel: 'off' }, markers: { ...base.markers, percentiles: [], showValues: false, mean: false } }, DEFAULT_THEME, new Set(), noop);
  });
}
