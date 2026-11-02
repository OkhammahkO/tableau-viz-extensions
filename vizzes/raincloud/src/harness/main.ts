import { buildGrid, type Grid, type GridRecord } from '../chart/model';
import { DEFAULT_OPTIONS, type RaincloudOptions } from '../chart/options';
import { DEFAULT_THEME, esc, renderRaincloud, showTip, styleSelection } from '../chart/render';
import '../chart/chart.css';
import { renderSplash } from '../extension/splash';

// Dev harness: renders the raincloud from data/synthetic CSVs outside Tableau, for fast visual iteration.
// Same render code as the extension; only the data source and the hover behaviour differ.

const files = import.meta.glob('../../../../data/synthetic/*.csv', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

// [category column, value column] per dataset
const COLUMNS: Record<string, [string, string]> = {
  'quirks.csv': ['category', 'value'],
  'skewed_delivery_minutes.csv': ['courier', 'delivery_minutes'],
  'outliers_response_ms.csv': ['server', 'response_ms'],
  'likert_satisfaction.csv': ['department', 'score'],
  'small_n.csv': ['category', 'value'],
  'many_categories.csv': ['store', 'value'],
  'edge_cases.csv': ['category', 'value'],
  'repeated_measures.csv': ['time', 'score'],
  'large_10k.csv': ['category', 'value'],
  'large_100k.csv': ['category', 'value'],
  'spikes_grid.csv': ['store', 'basket_value'],
  'large_grid.csv': ['store', 'basket_value']
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const chartEl = $('chart');
const status = $('status');
const options: RaincloudOptions = structuredClone(DEFAULT_OPTIONS);
let grid: Grid | undefined;
const selected = new Set<number>();
let table: { name: string; header: string[]; rows: string[][]; valueCol: string } | undefined;

// Our generator never writes quoted commas, so a plain split is enough.
function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  return { header: lines[0].split(','), rows: lines.slice(1).map((l) => l.split(',')) };
}

const member = (v: string | undefined) => (v === '' || v === undefined ? 'Null' : v); // Tableau labels a null member "Null"

/** Builds the grid from the current table and the Rows/Columns pickers (like dragging fields onto the tiles). */
function rebuild(): void {
  if (!table) return;
  const { header, rows, valueCol } = table;
  const pick = (id: string) => $<HTMLSelectElement>(id).value;
  const rowFields = [pick('rows1'), pick('rows2')].filter(Boolean);
  const colFields = [pick('cols1'), pick('cols2')].filter(Boolean);
  const colourField = pick('colour') || null;
  const idx = (f: string) => header.indexOf(f);
  const vi = idx(valueCol);
  const ri = idx('row_id');
  const records: GridRecord[] = rows.map((cells, i) => ({
    rowPath: rowFields.map((f) => member(cells[idx(f)])),
    colPath: colFields.map((f) => member(cells[idx(f)])),
    colour: colourField ? member(cells[idx(colourField)]) : null,
    value: cells[vi] === '' || cells[vi] === undefined ? null : Number(cells[vi]),
    tupleId: ri >= 0 ? Number(cells[ri]) : i + 1
  }));
  grid = buildGrid(records, rowFields, colFields, valueCol, colourField);
  selected.clear();
  const cellsWithData = grid.cells.flat().filter(Boolean).length;
  status.textContent = `· ${table.name} · ${rows.length.toLocaleString()} rows · ${grid.rows.length} × ${grid.cols.length} cells (${cellsWithData} with data)`;
  draw();
}

async function loadDataset(name: string): Promise<void> {
  const key = Object.keys(files).find((k) => k.endsWith('/' + name))!;
  const { header, rows } = parseCsv(await files[key]());
  const [cat, valueCol] = COLUMNS[name] ?? ['category', 'value'];
  table = { name, header, rows, valueCol };
  // Dimension columns for the Rows/Columns pickers: everything except the id and the measure.
  const dims = header.filter((h) => h !== 'row_id' && h !== valueCol);
  for (const id of ['rows1', 'rows2', 'cols1', 'cols2', 'colour']) {
    const sel = $<HTMLSelectElement>(id);
    sel.replaceChildren(new Option('(none)', ''), ...dims.map((d) => new Option(d, d)));
  }
  $<HTMLSelectElement>('rows1').value = cat;
  rebuild();
}

function draw(): void {
  // Landing-page mock-up: what the extension shows before a measure is on Value (not wired into the extension yet).
  if ($<HTMLInputElement>('landing').checked) {
    chartEl.parentElement?.querySelector(':scope > .rc-badge')?.remove();
    renderSplash(chartEl);
    return;
  }
  if (!grid) return;
  const t0 = performance.now();
  const result = renderRaincloud(chartEl, grid, options, DEFAULT_THEME, selected, {
    onHover(point, _anchor, e) {
      const tip = chartEl.querySelector<HTMLElement>('.rc-tip')!;
      if (!point) { tip.hidden = true; return; }
      showTip(chartEl, tip, `${esc(String(point.value))}<br><span style="color:#888">row ${point.tupleId}</span>`, e);
    },
    onSelect(point, additive) {
      if (!point) { if (!additive) selected.clear(); }
      else if (additive) selected.has(point.tupleId) ? selected.delete(point.tupleId) : selected.add(point.tupleId);
      else if (selected.size === 1 && selected.has(point.tupleId)) selected.clear();
      else { selected.clear(); selected.add(point.tupleId); }
      styleSelection(chartEl, selected);
    }
  });
  // Remember colours in memory, as the extension does in settings, so the harness shows stable colours too.
  if (result.colourField && result.colourAssignments) options.colour.assigned[result.colourField] = result.colourAssignments;
  status.dataset.render = `${Math.round(performance.now() - t0)} ms`;
  status.title = `last render ${status.dataset.render}`;
}

// Controls
const datasetSel = $<HTMLSelectElement>('dataset');
for (const name of Object.keys(COLUMNS).filter((n) => Object.keys(files).some((k) => k.endsWith('/' + n)))) {
  datasetSel.add(new Option(name, name));
}
datasetSel.addEventListener('change', () => void loadDataset(datasetSel.value));
$<HTMLSelectElement>('cloud').addEventListener('change', (e) => { options.cloud = (e.target as HTMLSelectElement).value as RaincloudOptions['cloud']; draw(); });
$<HTMLSelectElement>('rain').addEventListener('change', (e) => { options.rain = (e.target as HTMLSelectElement).value as RaincloudOptions['rain']; draw(); });
$<HTMLInputElement>('box').addEventListener('change', (e) => { options.lightning = (e.target as HTMLInputElement).checked ? 'box' : 'none'; draw(); });
$<HTMLInputElement>('bw').addEventListener('input', (e) => {
  options.bandwidth = Number((e.target as HTMLInputElement).value);
  $('bwv').textContent = options.bandwidth.toFixed(2) + '×';
  draw();
});
$<HTMLSelectElement>('axis').addEventListener('change', (e) => {
  const v = (e.target as HTMLSelectElement).value;
  if (v === 'data' || v === 'whiskers') options.axis = { ...options.axis, range: v };
  else { const [low, high] = v.split(',').map(Number); options.axis = { ...options.axis, range: 'percentile', low, high }; }
  draw();
});
for (const id of ['rows1', 'rows2', 'cols1', 'cols2', 'colour']) $<HTMLSelectElement>(id).addEventListener('change', rebuild);
$<HTMLInputElement>('split').addEventListener('change', (e) => { options.colour.splitCloud = (e.target as HTMLInputElement).checked; draw(); });
$<HTMLSelectElement>('wrap').addEventListener('change', (e) => {
  const v = (e.target as HTMLSelectElement).value;
  options.panels.wrap = v === 'auto' ? 'auto' : Number(v);
  draw();
});
$<HTMLSelectElement>('paxis').addEventListener('change', (e) => {
  options.panels.axis = (e.target as HTMLSelectElement).value as RaincloudOptions['panels']['axis'];
  draw();
});
$<HTMLSelectElement>('density').addEventListener('change', (e) => { options.density = (e.target as HTMLSelectElement).value as RaincloudOptions['density']; draw(); });
$<HTMLSelectElement>('size').addEventListener('change', (e) => {
  options.size.mode = (e.target as HTMLSelectElement).value as RaincloudOptions['size']['mode'];
  draw();
});
$<HTMLInputElement>('rowh').addEventListener('change', (e) => { options.size.rowHeight = Number((e.target as HTMLInputElement).value) || 90; draw(); });
$<HTMLInputElement>('panelw').addEventListener('change', (e) => { options.size.panelWidth = Number((e.target as HTMLInputElement).value) || 480; draw(); });
$<HTMLSelectElement>('bins').addEventListener('change', (e) => {
  const v = (e.target as HTMLSelectElement).value;
  options.bins = v === 'auto' ? 'auto' : Number(v);
  draw();
});
$<HTMLSelectElement>('cloudh').addEventListener('change', (e) => { options.scales.cloudHeight = (e.target as HTMLSelectElement).value as RaincloudOptions['scales']['cloudHeight']; draw(); });
$<HTMLSelectElement>('boxpos').addEventListener('change', (e) => { options.boxPosition = (e.target as HTMLSelectElement).value as RaincloudOptions['boxPosition']; draw(); });
$<HTMLInputElement>('ecdf').addEventListener('change', (e) => { options.ecdf = (e.target as HTMLInputElement).checked; draw(); });
$<HTMLSelectElement>('peaklabel').addEventListener('change', (e) => { options.scales.cloudLabel = (e.target as HTMLSelectElement).value as RaincloudOptions['scales']['cloudLabel']; draw(); });
$<HTMLSelectElement>('sizing').addEventListener('change', (e) => { options.colour.cloudSizing = (e.target as HTMLSelectElement).value as RaincloudOptions['colour']['cloudSizing']; draw(); });
$<HTMLSelectElement>('titlemode').addEventListener('change', (e) => { options.axis.titleMode = (e.target as HTMLSelectElement).value as RaincloudOptions['axis']['titleMode']; draw(); });
// Typing a title switches to Custom, as the dialog's text box only shows for Custom.
$<HTMLInputElement>('title').addEventListener('input', (e) => {
  options.axis.title = (e.target as HTMLInputElement).value;
  options.axis.titleMode = 'custom';
  $<HTMLSelectElement>('titlemode').value = 'custom';
  draw();
});
$<HTMLSelectElement>('ticks').addEventListener('change', (e) => { options.axis.ticks = (e.target as HTMLSelectElement).value as RaincloudOptions['axis']['ticks']; draw(); });
$<HTMLInputElement>('tickstep').addEventListener('change', (e) => { const v = Number((e.target as HTMLInputElement).value); options.axis.tickStep = v > 0 ? v : 0; draw(); });
$<HTMLInputElement>('gridlines').addEventListener('change', (e) => { options.axis.gridlines = (e.target as HTMLInputElement).checked; draw(); });
$<HTMLSelectElement>('meanstyle').addEventListener('change', (e) => { options.markers.meanStyle = (e.target as HTMLSelectElement).value as RaincloudOptions['markers']['meanStyle']; draw(); });
$<HTMLSelectElement>('meancolour').addEventListener('change', (e) => { options.markers.meanColour = (e.target as HTMLSelectElement).value; draw(); });
$<HTMLInputElement>('mean').addEventListener('change', (e) => { options.markers.mean = (e.target as HTMLInputElement).checked; draw(); });
$<HTMLInputElement>('landing').addEventListener('change', () => draw());
$<HTMLInputElement>('decimals').addEventListener('change', (e) => { options.markers.decimals = Number((e.target as HTMLInputElement).value) || 0; draw(); });
$<HTMLInputElement>('vals').addEventListener('change', (e) => { options.markers.showValues = (e.target as HTMLInputElement).checked; draw(); });
$<HTMLInputElement>('pct').addEventListener('change', (e) => {
  options.markers.percentiles = (e.target as HTMLInputElement).value.split(/[,\s]+/).map(Number).filter((p) => p > 0 && p < 100);
  draw();
});

let raf = 0;
new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }).observe(chartEl);
void loadDataset(datasetSel.value || 'quirks.csv');
