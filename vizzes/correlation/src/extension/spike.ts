import type { Worksheet } from '@tableau/extensions-api-types';
import { getEncodingFields, readSummaryData } from '@kit/tableau/api';

// Spike (2026-11-02): does a viz-extension encoding with role continuous-measure and max-count 8 accept several
// measures, and how do they arrive in the summary data? Shows what Tableau hands us; no chart yet.

const out = document.getElementById('out')!;
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; saa += da * da; sbb += db * db; }
  return sab / Math.sqrt(saa * sbb);
}

async function report(ws: Worksheet): Promise<void> {
  const enc = await getEncodingFields(ws);
  const measures = enc.measures ?? [];
  const rows: string[] = [];
  for (const [id, fields] of Object.entries(enc)) {
    for (const f of fields) rows.push(`<tr><td>${esc(id)}</td><td>${esc(f.name)}</td><td>${esc(String((f as { role?: string }).role ?? ''))}</td></tr>`);
  }
  let html = `<p>Measures on the tile: <span class="${measures.length > 1 ? 'ok' : 'bad'}">${measures.length}</span>
    ${measures.length > 1 ? '(several measures accepted)' : '(drag 2+ measures onto Measures)'}</p>
    <table><tr><th>Encoding</th><th>Field</th><th>Role</th></tr>${rows.join('')}</table>`;

  const cols: string[] = [];
  const values: Record<string, number[]> = {};
  const sample: string[] = [];
  const { totalRows } = await readSummaryData(ws, (page, offset) => {
    if (!cols.length) page.columns.forEach((c) => cols.push(`${c.fieldName} (${c.dataType})`));
    page.data.forEach((cells, i) => {
      if (offset + i < 3) sample.push(cells.map((c) => c.formattedValue).join(' | '));
      for (const m of measures) {
        const col = page.columns.find((c) => c.fieldName === m.name);
        const v = col ? Number(cells[col.index].value) : NaN;
        if (Number.isFinite(v)) (values[m.name] ??= []).push(v);
      }
    });
  });
  html += `<p>Summary data: <b>${totalRows.toLocaleString()}</b> rows (put a row ID on Detail for one row per record).</p>
    <pre>Columns: ${esc(cols.join(', '))}\n\nFirst rows:\n${esc(sample.join('\n'))}</pre>`;
  if (measures.length > 1) {
    const [a, b] = measures.map((m) => values[m.name] ?? []);
    if (a.length === b.length && a.length > 2) html += `<p>Pearson r (${esc(measures[0].name)}, ${esc(measures[1].name)}) = <b>${pearson(a, b).toFixed(3)}</b> over ${a.length} rows</p>`;
  }
  out.innerHTML = html;
}

tableau.extensions.initializeAsync().then(() => {
  const ws = tableau.extensions.worksheetContent!.worksheet;
  const run = () => report(ws).catch((err) => { out.innerHTML = `<p class="bad">Error: ${esc(String(err))}</p>`; console.error('[correlation-spike]', err); });
  ws.addEventListener(tableau.TableauEventType.SummaryDataChanged, run);
  run();
}).catch((err) => { out.textContent = `init failed: ${err}`; });
