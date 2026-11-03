import type { Worksheet } from '@tableau/extensions-api-types';
import { inferFormat } from '@kit/format';
import { snapshotPng } from '@kit/ui/snapshot';
import { fireAndLog, getEncodingFields, readSummaryData, tupleIdForRow } from '@kit/tableau/api';
import { remapSelection, rowKey } from '@kit/tableau/selection';
import { buildMatrix, type Matrix, type MatrixRecord } from '../chart/model';
import { DEFAULT_OPTIONS, type CorrOptions } from '../chart/options';
import { FORMAT_DIALOG } from '../dialog/shared';
import { loadOptions, saveOptions } from './settings';
import { renderSplash } from './splash';
import { DEFAULT_THEME, renderMatrix, type RenderTheme } from '../chart/render';
import '../chart/chart.css';

// Tableau adapter for the correlation matrix: reads the Measures and Colour tiles at record level, renders with the
// saved options (Format Extension edits them live), and routes hover and selection back to Tableau so tooltips and
// actions are native. With fewer than two measures it shows the landing page (splash.ts).

const chartEl = document.getElementById('chart')!;
const bannerEl = document.getElementById('banner')!;
const splashEl = document.getElementById('splash')!;

const state = {
  worksheet: undefined as unknown as Worksheet,
  matrix: undefined as Matrix | undefined,
  selected: new Set<number>(),
  /** Each record's identity (tuple id → row key), to carry the selection across a refresh. */
  keys: new Map<number, string>(),
  options: structuredClone(DEFAULT_OPTIONS) as CorrOptions
};

const isNull = (v: unknown) => v === null || v === undefined || v === '%null%';

// Dragging fields fires several SummaryDataChanged events in a row: only the latest read may update the chart.
let refreshSeq = 0;

async function refresh(): Promise<void> {
  const seq = ++refreshSeq;
  const enc = await getEncodingFields(state.worksheet);
  if (seq !== refreshSeq) return;
  const measures = enc.measures ?? [];
  const colourField = enc.colour?.[0];
  if (measures.length < 2) {
    // Landing page until two measures are on the tile.
    state.matrix = undefined;
    bannerEl.hidden = true;
    chartEl.replaceChildren();
    splashEl.hidden = false;
    renderSplash(splashEl);
    void reportIfExporting();
    return;
  }
  splashEl.hidden = true;
  const records: MatrixRecord[] = [];
  const keys = new Map<number, string>();
  // Up to 200 (value, formatted) samples per measure, to follow its Tableau number format on ticks and tooltips.
  const samples: { value: number; formatted: string }[][] = measures.map(() => []);
  const t0 = performance.now();
  const { totalRows } = await readSummaryData(state.worksheet, (page, offset) => {
    const cols = measures.map((f) => page.columns.find((c) => c.fieldName === f.name));
    const kCol = colourField ? page.columns.find((c) => c.fieldName === colourField.name) : undefined;
    page.data.forEach((cells, i) => {
      keys.set(tupleIdForRow(offset + i), rowKey(cells));
      records.push({
        values: cols.map((c, j) => {
          if (!c) return null;
          const cellValue = cells[c.index];
          const num = isNull(cellValue.value) ? null : Number(cellValue.value);
          if (num === null || !Number.isFinite(num)) return null;
          if (samples[j].length < 200 && cellValue.formattedValue) samples[j].push({ value: num, formatted: cellValue.formattedValue });
          return num;
        }),
        colour: kCol ? (isNull(cells[kCol.index].value) ? 'Null' : (cells[kCol.index].formattedValue ?? String(cells[kCol.index].value))) : null,
        tupleId: tupleIdForRow(offset + i)
      });
    });
  });
  if (seq !== refreshSeq) return;
  state.matrix = buildMatrix(records, measures.map((f) => f.name), colourField?.name ?? null);
  state.matrix.formats = samples.map(inferFormat);
  // Tuple ids are row positions: a filter renumbers them, so keep the same records selected, not the same ids.
  state.selected = remapSelection(state.selected, state.keys, keys);
  state.keys = keys;
  console.info('[correlation] read', { rows: totalRows, measures: measures.length, ms: Math.round(performance.now() - t0) });
  // A handful of rows means Tableau aggregated: correlations need one row per record.
  const aggregated = records.length > 0 && records.length < 3;
  bannerEl.hidden = !aggregated;
  bannerEl.innerHTML = aggregated
    ? 'Only a few rows arrived, so Tableau is aggregating. Put a row ID dimension on <b>Detail</b>, or turn off <b>Analysis → Aggregate Measures</b>.'
    : '';
  draw();
  void reportIfExporting();
}

/**
 * Export (API 1.17, Tableau 2026.2+; feature-detected, not yet verified in Tableau): when Tableau is exporting the
 * sheet, hand it a PNG of the chart (SVG layers + the canvas points) and report that rendering is complete.
 */
async function reportIfExporting(): Promise<void> {
  const ext = tableau.extensions as unknown as { reportExtensionRenderComplete?: (media?: ArrayBuffer) => Promise<void> };
  const env = tableau.extensions.environment as unknown as { isExporting?: boolean };
  if (!env.isExporting || typeof ext.reportExtensionRenderComplete !== 'function') return;
  try {
    const png = await snapshotPng(splashEl.hidden ? chartEl : splashEl).catch((err) => { console.warn('[correlation] snapshot failed', err); return null; });
    await ext.reportExtensionRenderComplete(png ?? undefined);
    console.info('[correlation] export: render complete reported', { image: !!png });
  } catch (err) {
    console.warn('[correlation] export report failed', err);
  }
}

function message(text: string): void {
  const p = document.createElement('p');
  p.className = 'cm-empty';
  p.textContent = text;
  chartEl.replaceChildren(p);
}

function theme(): RenderTheme {
  const css = (tableau.extensions.environment.workbookFormatting?.formattingSheets?.find(
    (s) => s.classNameKey === tableau.ClassNameKey.Worksheet
  )?.cssProperties ?? {}) as Record<string, string>;
  return { ...DEFAULT_THEME, fontFamily: css['font-family'] ?? DEFAULT_THEME.fontFamily, text: css['color'] ?? DEFAULT_THEME.text };
}

let lastHover: number | undefined;
let lastHoverAt = 0;

function draw(): void {
  if (!state.matrix) return;
  try {
    const result = renderMatrix(chartEl, state.matrix, state.options, theme(), state.selected, {
      onHover(record, anchor) {
        // Never send an invalid tuple to clear hover (Tableau rejects it); just forget it.
        if (!record) { lastHover = undefined; return; }
        const now = Date.now();
        if (record.tupleId === lastHover && now - lastHoverAt < 50) return;
        lastHover = record.tupleId;
        lastHoverAt = now;
        fireAndLog('hoverTupleAsync', state.worksheet.hoverTupleAsync(record.tupleId, { tooltipAnchorPoint: anchor }));
      },
      onSelect(ids, additive, anchor) {
        const sel = state.selected;
        if (!additive) {
          // Clicking the only selected record again clears it, as in Tableau.
          const same = ids.length === 1 && sel.size === 1 && sel.has(ids[0]);
          sel.clear();
          if (!same) ids.forEach((id) => sel.add(id));
        } else if (ids.length === 1) {
          sel.has(ids[0]) ? sel.delete(ids[0]) : sel.add(ids[0]);
        } else ids.forEach((id) => sel.add(id));
        fireAndLog('selectTuplesAsync', state.worksheet.selectTuplesAsync([...sel], tableau.SelectOptions.Simple, ids.length ? { tooltipAnchorPoint: anchor } : undefined));
        draw(); // the canvas and the histograms show the selection
      }
    });
    rememberColours(result.colourField, result.colourAssignments);
  } catch (err) {
    // Never leave a blank frame: say what failed, and log the details for DevTools.
    console.error('[correlation] draw failed', err);
    message(`The chart couldn't be drawn: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Stable colours: save member → colour assignments with the workbook, so filtering members out and back in never
 * repaints the others. Only when something new was assigned (no save loop) and only while authoring.
 */
function rememberColours(field: string | null, assignments: Record<string, string> | null): void {
  if (!field || !assignments || tableau.extensions.environment.mode !== tableau.ExtensionMode.Authoring) return;
  const stored = state.options.colour.assigned[field] ?? {};
  if (Object.keys(assignments).every((k) => stored[k] === assignments[k])) return;
  state.options = { ...state.options, colour: { ...state.options.colour, assigned: { ...state.options.colour.assigned, [field]: assignments } } };
  saveOptions(state.options);
}

async function openFormatDialog(): Promise<void> {
  // A path relative to the .trex URL (absolute URLs break under sandbox hosting); modeless and narrow like Tableau's
  // own format panes; the dialog saves settings live.
  try {
    await tableau.extensions.ui.displayDialogAsync(FORMAT_DIALOG, '', { width: 320, height: 620, dialogStyle: tableau.DialogStyle.Modeless });
  } catch (err) {
    // Closing with the window's X rejects with DialogClosedByUser; that's normal.
    if ((err as { errorCode?: string }).errorCode !== tableau.ErrorCodes.DialogClosedByUser) console.warn('[correlation] format dialog', err);
  }
}

window.addEventListener('error', (e) => console.error('[correlation] uncaught error', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => console.error('[correlation] unhandled rejection', e.reason));

async function main(): Promise<void> {
  // The types declare context-menu callbacks as returning {}, hence the empty object.
  await tableau.extensions.initializeAsync({ configure: () => { void openFormatDialog(); return {}; } });
  state.worksheet = tableau.extensions.worksheetContent!.worksheet;
  state.options = loadOptions();
  tableau.extensions.settings.addEventListener(tableau.TableauEventType.SettingsChanged, () => {
    state.options = loadOptions();
    draw();
  });
  state.worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged, () =>
    void refresh().catch((e) => console.error('[correlation] refresh failed', e))
  );
  let raf = 0;
  new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }).observe(chartEl);
  let splashRaf = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(splashRaf);
    splashRaf = requestAnimationFrame(() => { if (!splashEl.hidden) renderSplash(splashEl); });
  }).observe(document.body);
  await refresh();
}

main().catch((err) => {
  console.error('[correlation] init failed', err);
  message(`Failed to initialize: ${err}`);
});
