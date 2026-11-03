import type { Worksheet } from '@tableau/extensions-api-types';
import { fireAndLog, getEncodingFields, readSummaryData, tupleIdForRow } from '@kit/tableau/api';
import { remapSelection, rowKey } from '@kit/tableau/selection';
import { allGroups, buildGrid, type Grid, type GridRecord, type Point } from '../chart/model';
import { DEFAULT_OPTIONS, type RaincloudOptions } from '../chart/options';
import { loadOptions, saveOptions } from './settings';
import { DEFAULT_THEME, renderRaincloud, styleSelection, type RenderTheme } from '../chart/render';
import '../chart/chart.css';
import { renderSplash } from './splash';
import { FORMAT_DIALOG } from '../dialog/shared';
import { inferFormat } from '@kit/format';

// Tableau adapter for the raincloud: reads record-level summary data, renders, and routes
// hover/selection back to Tableau so tooltips and actions are native.

const chartEl = document.getElementById('chart')!;
const splashEl = document.getElementById('splash')!;
const bannerEl = document.getElementById('banner')!;

const state = {
  worksheet: undefined as unknown as Worksheet,
  grid: undefined as Grid | undefined,
  totalRows: 0,
  selected: new Set<number>(),
  /** Each record's identity (tuple id → row key), to carry the selection across a refresh. */
  keys: new Map<number, string>(),
  options: structuredClone(DEFAULT_OPTIONS) as RaincloudOptions
};

const isNull = (v: unknown) => v === null || v === undefined || v === '%null%';

// Dragging fields fires several SummaryDataChanged events in a row. Each refresh takes a number, and only
// the latest one may update the chart, so an older, slower read can't overwrite a newer one.
let refreshSeq = 0;

async function refresh(): Promise<void> {
  const seq = ++refreshSeq;
  const enc = await getEncodingFields(state.worksheet);
  if (seq !== refreshSeq) return;
  const valueField = enc.value?.[0];
  const rowFields = enc.rows ?? [];
  const colFields = enc.columns ?? [];
  const colourField = enc.colour?.[0];
  if (!valueField) {
    state.grid = undefined;
    showSplash();
    bannerEl.hidden = true;
    chartEl.replaceChildren();
    return;
  }
  splashEl.hidden = true;

  const records: GridRecord[] = [];
  const keys = new Map<number, string>();
  const formatSamples: { value: number; formatted: string }[] = [];
  const t0 = performance.now();
  const { totalRows } = await readSummaryData(state.worksheet, (page, offset) => {
    const col = (name: string) => page.columns.find((c) => c.fieldName === name);
    const vCol = col(valueField.name);
    if (!vCol) return;
    const rCols = rowFields.map((f) => col(f.name));
    const cCols = colFields.map((f) => col(f.name));
    const kCol = colourField ? col(colourField.name) : undefined;
    const label = (cells: typeof page.data[number], c: typeof vCol | undefined) => {
      if (!c) return 'Null';
      const d = cells[c.index];
      return isNull(d.value) ? 'Null' : (d.formattedValue ?? String(d.value));
    };
    page.data.forEach((cells, i) => {
      keys.set(tupleIdForRow(offset + i), rowKey(cells));
      const v = cells[vCol.index];
      const num = isNull(v.value) ? null : Number(v.value);
      if (num !== null && Number.isFinite(num) && formatSamples.length < 200 && v.formattedValue) {
        formatSamples.push({ value: num, formatted: v.formattedValue });
      }
      records.push({
        rowPath: rCols.map((c) => label(cells, c)),
        colPath: cCols.map((c) => label(cells, c)),
        colour: kCol ? label(cells, kCol) : null,
        value: num === null || Number.isNaN(num) ? null : num,
        tupleId: tupleIdForRow(offset + i)
      });
    });
  });
  if (seq !== refreshSeq) return; // a newer refresh started while this one was reading
  state.totalRows = totalRows;
  state.grid = buildGrid(records, rowFields.map((f) => f.name), colFields.map((f) => f.name), valueField.name, colourField?.name ?? null);
  // Follow the measure's Tableau number format ($, %, K, separators) on ticks and labels.
  state.grid.valueFormat = inferFormat(formatSamples);
  // Tuple ids are row positions: a filter renumbers them, so keep the same records selected, not the same ids.
  state.selected = remapSelection(state.selected, state.keys, keys);
  state.keys = keys;
  const cellsWithData = allGroups(state.grid).length;
  console.info('[raincloud] read', {
    rows: totalRows, gridRows: state.grid.rows.length, gridCols: state.grid.cols.length, cellsWithData,
    ms: Math.round(performance.now() - t0)
  });

  // One record per cell means Tableau aggregated: there's no distribution to draw.
  const aggregated = records.length > 0 && records.length <= cellsWithData;
  bannerEl.hidden = !aggregated;
  bannerEl.innerHTML = aggregated
    ? 'Each cell has only one value, so Tableau is aggregating. Put a row ID dimension on <b>Detail</b>, or turn off <b>Analysis → Aggregate Measures</b>.'
    : '';
  draw();
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
  if (!state.grid || !allGroups(state.grid).length) {
    const msg = document.createElement('div');
    msg.className = 'rc-error rc-empty';
    msg.textContent = 'No values to show. Check the filters on this sheet.';
    chartEl.replaceChildren(msg);
    return;
  }
  try {
    drawChart();
  } catch (err) {
    // Never leave a blank frame: say what failed, and log the details for DevTools.
    console.error('[raincloud] draw failed', err, { options: state.options, rows: state.grid?.rows.length, cols: state.grid?.cols.length });
    const msg = document.createElement('div');
    msg.className = 'rc-error';
    msg.textContent = `The chart couldn't be drawn: ${err instanceof Error ? err.message : String(err)}`;
    chartEl.replaceChildren(msg);
  }
}

function drawChart(): void {
  const result = renderRaincloud(chartEl, state.grid!, state.options, theme(), state.selected, {
    onHover(point: Point | undefined, anchor) {
      // Never send an invalid tuple to clear hover (Tableau rejects it); just forget it.
      if (!point) { lastHover = undefined; return; }
      const now = Date.now();
      if (point.tupleId === lastHover && now - lastHoverAt < 50) return;
      lastHover = point.tupleId;
      lastHoverAt = now;
      fireAndLog('hoverTupleAsync', state.worksheet.hoverTupleAsync(point.tupleId, { tooltipAnchorPoint: anchor }));
    },
    onSelect(point, additive, anchor) {
      const sel = state.selected;
      if (!point) { if (additive) return; sel.clear(); }
      else if (additive) sel.has(point.tupleId) ? sel.delete(point.tupleId) : sel.add(point.tupleId);
      else if (sel.size === 1 && sel.has(point.tupleId)) sel.clear();
      else { sel.clear(); sel.add(point.tupleId); }
      fireAndLog('selectTuplesAsync', state.worksheet.selectTuplesAsync([...sel], tableau.SelectOptions.Simple, point ? { tooltipAnchorPoint: anchor } : undefined));
      styleSelection(chartEl, sel);
    }
  });
  rememberColours(result.colourField, result.colourAssignments);
}



async function openFormatDialog(): Promise<void> {
  // A path relative to the .trex URL, as Tableau's sandboxed sample does. An absolute URL built from location.href
  // points at /private-content/… under sandbox hosting, which isn't the registered extension URL, so Tableau refuses it.
  const url = FORMAT_DIALOG;
  try {
    // Modeless and narrow like Tableau's own format panes; the dialog saves settings live as you edit.
    await tableau.extensions.ui.displayDialogAsync(url, '', { width: 320, height: 620, dialogStyle: tableau.DialogStyle.Modeless });
  } catch (err) {
    // Closing with the window's X rejects with DialogClosedByUser; that's normal.
    if ((err as { errorCode?: string }).errorCode !== tableau.ErrorCodes.DialogClosedByUser) console.warn('[raincloud] format dialog', err);
  }
}

// Anything that slips through still gets logged with context, so a blank chart can be diagnosed in DevTools.
window.addEventListener('error', (e) => console.error('[raincloud] uncaught error', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => console.error('[raincloud] unhandled rejection', e.reason));

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

/** Landing page (getting started) while no measure is on Value; redrawn on resize so it adapts to the frame. */
function showSplash(): void {
  splashEl.hidden = false;
  renderSplash(splashEl);
}
new ResizeObserver(() => { if (!splashEl.hidden) renderSplash(splashEl); }).observe(document.body);

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
    void refresh().catch((e) => console.error('[raincloud] refresh failed', e))
  );
  if ('WorksheetFormattingChanged' in tableau.TableauEventType) {
    state.worksheet.addEventListener(tableau.TableauEventType.WorksheetFormattingChanged, () => draw());
  }
  // Size from the frame itself, not the window.
  let raf = 0;
  new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }).observe(chartEl);
  await refresh();
}

main().catch((err) => {
  console.error('[raincloud] init failed', err);
  splashEl.hidden = false;
  splashEl.replaceChildren(Object.assign(document.createElement('p'), { className: 'rc-error', textContent: `Failed to initialize: ${err}` }));
});
