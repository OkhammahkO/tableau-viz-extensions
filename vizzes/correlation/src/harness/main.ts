import { buildMatrix, type Matrix, type MatrixRecord } from '../chart/model';
import { DEFAULT_OPTIONS, type CorrOptions } from '../chart/options';
import { DEFAULT_THEME, renderMatrix } from '../chart/render';
import '../chart/chart.css';
import { renderSplash } from '../extension/splash';

// Dev harness: renders the correlation matrix from the data/synthetic correlation CSVs outside Tableau. Same render
// code as the extension; selection is kept here instead of in Tableau.

const files = {
  ...import.meta.glob('../../../../data/synthetic/corr_*.csv', { query: '?raw', import: 'default' }),
  ...import.meta.glob('../../../../data/synthetic/large_corr_*.csv', { query: '?raw', import: 'default' })
} as Record<string, () => Promise<string>>;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const chartEl = $('chart');
const status = $('status');
const options: CorrOptions = structuredClone(DEFAULT_OPTIONS);
const selected = new Set<number>();
let table: { header: string[]; rows: string[][]; numeric: string[]; text: string[] } | undefined;
let chosen: string[] = [];
let matrix: Matrix | undefined;

// Our generator never writes quoted commas, so a plain split is enough.
function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((l) => l.split(','));
  const isNumeric = (k: number) => rows.every((r) => r[k] === '' || Number.isFinite(Number(r[k])));
  return {
    header,
    rows,
    numeric: header.filter((h, k) => h !== 'row_id' && isNumeric(k)),
    text: header.filter((h, k) => h !== 'row_id' && !isNumeric(k))
  };
}

function rebuild(): void {
  if (!table) return;
  const { header, rows } = table;
  const colour = $<HTMLSelectElement>('colour').value || null;
  const ri = header.indexOf('row_id');
  const ci = colour ? header.indexOf(colour) : -1;
  const records: MatrixRecord[] = rows.map((cells, n) => ({
    values: chosen.map((name) => {
      const v = cells[header.indexOf(name)];
      return v === '' ? null : Number(v);
    }),
    colour: ci >= 0 ? cells[ci] : null,
    tupleId: ri >= 0 ? Number(cells[ri]) : n + 1
  }));
  // Field names as Tableau sends them (aggregated), so the label clean-up is exercised too.
  matrix = buildMatrix(records, chosen.map((c) => `SUM(${c})`), colour);
  draw();
}

function draw(): void {
  if ($<HTMLInputElement>('landing').checked) {
    renderSplash(chartEl);
    status.textContent = 'landing page';
    return;
  }
  if (!matrix) return;
  const t0 = performance.now();
  const result = renderMatrix(chartEl, matrix, options, DEFAULT_THEME, selected, {
    onHover() {},
    onSelect(ids, additive) {
      if (!additive) selected.clear();
      for (const id of ids) {
        if (additive && selected.has(id)) selected.delete(id);
        else selected.add(id);
      }
      draw();
    }
  });
  if (result.colourField && result.colourAssignments) options.colour.assigned[result.colourField] = result.colourAssignments;
  status.textContent = `${matrix.records.length.toLocaleString()} records · ${matrix.names.length} measures · ` +
    `${result.density ? 'density cells' : 'points'}${selected.size ? ` · ${selected.size.toLocaleString()} selected` : ''}` +
    ` · ${Math.round(performance.now() - t0)} ms`;
}

async function loadDataset(name: string): Promise<void> {
  const key = Object.keys(files).find((k) => k.endsWith('/' + name))!;
  table = parseCsv(await files[key]());
  selected.clear();
  chosen = table.numeric.slice(0, Math.min(5, table.numeric.length));
  $('measures').replaceChildren(...table.numeric.map((m) => {
    const label = document.createElement('label');
    label.className = 'row';
    const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: chosen.includes(m) });
    cb.addEventListener('change', () => {
      chosen = cb.checked ? [...chosen, m] : chosen.filter((c) => c !== m);
      rebuild();
    });
    label.append(cb, m);
    return label;
  }));
  $<HTMLSelectElement>('colour').replaceChildren(new Option('(none)', ''), ...table.text.map((t) => new Option(t, t)));
  rebuild();
}

const datasetSel = $<HTMLSelectElement>('dataset');
for (const k of Object.keys(files).sort()) {
  const name = k.split('/').pop()!;
  datasetSel.add(new Option(name, name));
}
datasetSel.addEventListener('change', () => void loadDataset(datasetSel.value));
$<HTMLSelectElement>('colour').addEventListener('change', () => rebuild());
// ?landing opens straight on the landing page; ?w=…&h=… size the frame (for screenshots).
const query = new URLSearchParams(location.search);
if (query.has('landing')) $<HTMLInputElement>('landing').checked = true;
for (const k of ['w', 'h'] as const) if (query.get(k)) $<HTMLElement>('frame').style[k === 'w' ? 'width' : 'height'] = `${query.get(k)}px`;
$<HTMLInputElement>('landing').addEventListener('change', () => draw());
$<HTMLSelectElement>('coef').addEventListener('change', (e) => { options.coefficient = (e.target as HTMLSelectElement).value as CorrOptions['coefficient']; draw(); });
$<HTMLSelectElement>('upper').addEventListener('change', (e) => { options.upper = (e.target as HTMLSelectElement).value as CorrOptions['upper']; draw(); });
$<HTMLSelectElement>('coefcolour').addEventListener('change', (e) => { options.coefColour = (e.target as HTMLSelectElement).value as CorrOptions['coefColour']; draw(); });
$<HTMLSelectElement>('points').addEventListener('change', (e) => { options.points = (e.target as HTMLSelectElement).value as CorrOptions['points']; draw(); });
$<HTMLInputElement>('threshold').addEventListener('change', (e) => { options.densityThreshold = Number((e.target as HTMLInputElement).value) || 5000; draw(); });
$<HTMLSelectElement>('formula').addEventListener('change', (e) => { options.formula = (e.target as HTMLSelectElement).value as CorrOptions['formula']; draw(); });
$<HTMLSelectElement>('diag').addEventListener('change', (e) => { options.diag = (e.target as HTMLSelectElement).value as CorrOptions['diag']; draw(); });
$<HTMLSelectElement>('decimals').addEventListener('change', (e) => { const v = (e.target as HTMLSelectElement).value; options.markers = { ...options.markers, decimals: v === 'auto' || v === 'field' ? v : Number(v) }; draw(); });
$<HTMLSelectElement>('diagsplit').addEventListener('change', (e) => { options.diagSplit = (e.target as HTMLSelectElement).value as CorrOptions['diagSplit']; draw(); });
$<HTMLSelectElement>('diagboxmode').addEventListener('change', (e) => { options.diagBoxMode = (e.target as HTMLSelectElement).value as CorrOptions['diagBoxMode']; draw(); });
$<HTMLInputElement>('diagbox').addEventListener('change', (e) => { options.diagBox = (e.target as HTMLInputElement).checked; draw(); });
$<HTMLInputElement>('cut').addEventListener('change', (e) => { options.axisCut = { ...options.axisCut, on: (e.target as HTMLInputElement).checked }; draw(); });
$<HTMLInputElement>('margin').addEventListener('change', (e) => { options.axisCut = { ...options.axisCut, margin: (Number((e.target as HTMLInputElement).value) || 0) / 100 }; draw(); });
$<HTMLInputElement>('trend').addEventListener('change', (e) => { options.trendLine = (e.target as HTMLInputElement).checked; draw(); });

let raf = 0;
new ResizeObserver(() => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(draw);
}).observe(chartEl);
datasetSel.value = 'corr_health_8.csv'; // as on the website and landing page
void loadDataset(datasetSel.value);
