// @vitest-environment happy-dom
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGrid, type GridRecord } from './model';
import { buildGroups, gridFromGroups, type RecordPoint } from './test-helpers';
import { DEFAULT_OPTIONS, type RaincloudOptions } from './options';
import { DEFAULT_THEME, boxLane, renderRaincloud } from './render';

// Smoke test: every synthetic dataset × every cloud/rain combination renders without throwing,
// and draws exactly one mark per non-null record.

const DIR = join(__dirname, '../../../../data/synthetic');
const COLS: Record<string, [string, string]> = {
  'quirks.csv': ['category', 'value'],
  'skewed_delivery_minutes.csv': ['courier', 'delivery_minutes'],
  'outliers_response_ms.csv': ['server', 'response_ms'],
  'likert_satisfaction.csv': ['department', 'score'],
  'small_n.csv': ['category', 'value'],
  'many_categories.csv': ['store', 'value'],
  'edge_cases.csv': ['category', 'value'],
  'repeated_measures.csv': ['time', 'score']
};

function load(file: string): RecordPoint[] {
  const [c, v] = COLS[file];
  const lines = readFileSync(join(DIR, file), 'utf8').trim().split(/\r?\n/);
  const h = lines[0].split(',');
  const ci = h.indexOf(c), vi = h.indexOf(v);
  return lines.slice(1).map((l, i) => {
    const cells = l.split(',');
    return { category: cells[ci] || 'Null', value: cells[vi] === '' ? null : Number(cells[vi]), tupleId: i + 1 };
  });
}

function host(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 900 });
  Object.defineProperty(el, 'clientHeight', { value: 420 });
  document.body.appendChild(el);
  return el;
}

const files = readdirSync(DIR).filter((f) => f in COLS);
const noop = { onHover() {}, onSelect() {} };

describe.each(files)('%s', (file) => {
  const groups = buildGroups(load(file));
  const nonNull = groups.reduce((a, g) => a + g.stats.n, 0);
  it.each([
    ['density', 'dots'], ['density', 'strip'], ['histogram', 'dots'], ['histogram', 'strip'], ['none', 'none']
  ] as const)('cloud=%s rain=%s', (cloud, rain) => {
    const el = host();
    const opts: RaincloudOptions = { ...DEFAULT_OPTIONS, cloud, rain, axis: { ...DEFAULT_OPTIONS.axis, range: 'data' }, markers: { ...DEFAULT_OPTIONS.markers, mean: true, percentiles: [10, 90], showValues: false, decimals: 0 } };
    renderRaincloud(el, gridFromGroups(groups), opts, DEFAULT_THEME, new Set(), noop);
    expect(el.querySelectorAll('circle.rc-dot').length).toBe(rain === 'none' ? 0 : nonNull);
    expect(el.innerHTML).not.toMatch(/NaN|undefined/);
  });

  it('truncates at P1–P99: draws only in-window points and counts the rest', () => {
    const el = host();
    const opts: RaincloudOptions = { ...DEFAULT_OPTIONS, axis: { ...DEFAULT_OPTIONS.axis, range: 'percentile', low: 1, high: 99 } };
    renderRaincloud(el, gridFromGroups(groups), opts, DEFAULT_THEME, new Set(), noop);
    const drawn = el.querySelectorAll('circle.rc-dot').length;
    expect(drawn).toBeLessThanOrEqual(nonNull);
    const badge = document.querySelector('.rc-badge');
    if (nonNull > drawn) expect(badge?.textContent).toContain(`${(nonNull - drawn).toLocaleString()} value`);
    else expect(badge).toBeNull(); // nothing cut → no badge
    expect(el.innerHTML).not.toMatch(/NaN|undefined/);
  });
});

describe('markers', () => {
  it('draws a hollow mean circle (the median shows through) and value labels for median, mean and percentiles', () => {
    const el = host();
    const groups = buildGroups(load('quirks.csv'));
    renderRaincloud(el, gridFromGroups(groups), { ...DEFAULT_OPTIONS, markers: { ...DEFAULT_OPTIONS.markers, mean: true, percentiles: [10, 90], showValues: true, decimals: 2 } }, DEFAULT_THEME, new Set(), noop);
    const means = [...el.querySelectorAll('g.rc-mean > *')];
    expect(means.length).toBe(groups.length);
    means.forEach((m) => {
      expect(m.tagName.toLowerCase()).toBe('circle');
      expect(m.getAttribute('fill')).toBe('none');
      expect(m.getAttribute('stroke')).toBe('#f28e2b'); // orange by default, distinct from the dark median
    });
    const text = el.textContent ?? '';
    expect(text).toContain(`Median ${groups[0].stats.median.toFixed(2)}`);
    expect(text).toMatch(/Mean \d/);
    expect(text).toMatch(/P10 \d/);
    expect(text).toMatch(/P90 \d/);
  });
});

describe('whisker-based axis', () => {
  it('cuts exactly the values beyond the outermost whiskers + margin', () => {
    const groups = buildGroups(load('outliers_response_ms.csv'));
    const el = host();
    renderRaincloud(el, gridFromGroups(groups), { ...DEFAULT_OPTIONS, axis: { ...DEFAULT_OPTIONS.axis, range: 'whiskers' } }, DEFAULT_THEME, new Set(), noop);
    const a = Math.min(...groups.map((g) => g.stats.whiskerLow));
    const b = Math.max(...groups.map((g) => g.stats.whiskerHigh));
    const lo = a - (b - a) * 0.05, hi = b + (b - a) * 0.05;
    const expected = groups.reduce((n, g) => n + g.values.filter((v) => v >= lo && v <= hi).length, 0);
    expect(el.querySelectorAll('circle.rc-dot').length).toBe(expected);
    expect(document.querySelector('.rc-badge')?.getAttribute('title')).toContain('Axis cut at whiskers + 5%');
  });
});

describe('size modes', () => {
  const groups = buildGroups(load('many_categories.csv')); // 24 categories
  const svgSize = (el: HTMLElement) => {
    const svg = el.querySelector('svg')!;
    return { w: Number(svg.getAttribute('width')), h: Number(svg.getAttribute('height')) };
  };

  it('Entire view: 24 rows in a 420 px frame keep 64 px each and scroll', () => {
    const el = host();
    renderRaincloud(el, gridFromGroups(groups), DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
    const { w, h } = svgSize(el);
    expect(w).toBe(900);
    expect(h).toBeGreaterThan(420);
    expect(h).toBeGreaterThanOrEqual(24 * 64);
  });

  it('Fit width: fixed row height', () => {
    const el = host();
    renderRaincloud(el, gridFromGroups(groups), { ...DEFAULT_OPTIONS, size: { ...DEFAULT_OPTIONS.size, mode: 'fitWidth', rowHeight: 100 } }, DEFAULT_THEME, new Set(), noop);
    expect(svgSize(el).h).toBeGreaterThanOrEqual(24 * 100);
  });

  it('Standard: fixed panel width can make the chart wider than the frame', () => {
    const el = host();
    renderRaincloud(el, gridFromGroups(buildGroups(load('quirks.csv'))), { ...DEFAULT_OPTIONS, size: { ...DEFAULT_OPTIONS.size, mode: 'standard', panelWidth: 1400 } }, DEFAULT_THEME, new Set(), noop);
    expect(svgSize(el).w).toBeGreaterThan(900);
  });
});

describe('large data', () => {
  it('keeps every stacked dot inside its own band (30k records)', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const records: RecordPoint[] = [];
    for (let i = 0; i < 30000; i++) {
      const cat = ['Normal', 'Bimodal', 'Tied'][i % 3];
      const v = cat === 'Tied' ? Math.round(rand() * 5) : cat === 'Bimodal' ? (rand() < 0.5 ? 30 : 70) + rand() * 6 : 50 + (rand() + rand() + rand() - 1.5) * 20;
      records.push({ category: cat, value: v, tupleId: i + 1 });
    }
    const el = host();
    renderRaincloud(el, gridFromGroups(buildGroups(records)), DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
    let overflow = -Infinity; // worst dot bottom below its band's bottom, over all dots (one expect: 30k is slow)
    for (const g of el.querySelectorAll('g[data-rain-bottom]')) {
      const bottom = Number(g.getAttribute('data-rain-bottom'));
      for (const c of g.querySelectorAll('circle.rc-dot')) {
        overflow = Math.max(overflow, Number(c.getAttribute('cy')) + Number(c.getAttribute('r')) - bottom);
      }
    }
    expect(overflow).toBeLessThanOrEqual(0.01);
  }, 30_000); // slow CI runners take longer than the 5 s default
});

describe('Rows × Columns grid', () => {
  // quirks.csv: category, value, segment, region
  function gridRecords(rowCols: string[], colCols: string[]): GridRecord[] {
    const lines = readFileSync(join(DIR, 'quirks.csv'), 'utf8').trim().split(/\r?\n/);
    const h = lines[0].split(',');
    const at = (cells: string[], f: string) => cells[h.indexOf(f)];
    return lines.slice(1).map((l, i) => {
      const cells = l.split(',');
      return {
        rowPath: rowCols.map((f) => at(cells, f)), colPath: colCols.map((f) => at(cells, f)), colour: null,
        value: Number(at(cells, 'value')), tupleId: i + 1
      };
    });
  }

  it('draws one raincloud per cell, a dot per record, and headers for both tiles', () => {
    const grid = buildGrid(gridRecords(['category'], ['region']), ['category'], ['region'], 'value');
    expect(grid.rows.length).toBe(3);
    expect(grid.cols.length).toBe(4);
    const el = host();
    renderRaincloud(el, grid, { ...DEFAULT_OPTIONS, axis: { ...DEFAULT_OPTIONS.axis, range: 'data' } }, DEFAULT_THEME, new Set(), noop);
    expect(el.querySelectorAll('circle.rc-dot').length).toBe(373);
    expect(el.querySelectorAll('g[data-rain-bottom]').length).toBe(12);
    const text = el.textContent ?? '';
    for (const r of ['North', 'South', 'East', 'West', 'Group A (uniform)']) expect(text).toContain(r);
    expect(el.innerHTML).not.toMatch(/NaN|undefined/);
  });

  it('spans an outer Rows level and shows every combination, empty ones as "no values"', () => {
    // Remove every Group B record in the West: that combination must still get a cell.
    const records = gridRecords(['region', 'category'], []).filter((r) => !(r.rowPath[0] === 'West' && r.rowPath[1].startsWith('Group B')));
    const grid = buildGrid(records, ['region', 'category'], [], 'value');
    expect(grid.rows.length).toBe(12); // 4 regions × 3 categories
    const el = host();
    renderRaincloud(el, grid, DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
    expect(el.textContent).toContain('no values');
    // Each region label appears once (spanning), not once per category row.
    const regionLabels = [...el.querySelectorAll('text')].filter((t) => t.textContent === 'North');
    expect(regionLabels.length).toBe(1);
  });

  it('wraps column panels and repeats each panel header', () => {
    const grid = buildGrid(gridRecords([], ['region']), [], ['region'], 'value');
    const el = host(); // 900 px wide: auto wrap fits 2–3 panels of ≥ 260 px
    renderRaincloud(el, grid, { ...DEFAULT_OPTIONS, panels: { wrap: 2, axis: 'shared' } }, DEFAULT_THEME, new Set(), noop);
    const svg = el.querySelector('svg')!;
    const headers = [...el.querySelectorAll('text')].filter((t) => ['North', 'South', 'East', 'West'].includes(t.textContent ?? ''));
    expect(headers.length).toBe(4);
    expect(new Set(headers.map((t) => t.getAttribute('y'))).size).toBe(2); // two block rows
    expect(Number(svg.getAttribute('width'))).toBeLessThanOrEqual(900);
  });

  it('shared axes give every panel the same ticks; independent axes do not', () => {
    // The three groups have different ranges (B is 26–75, C is −6–131), so independent ticks must differ.
    const grid = buildGrid(gridRecords([], ['category']), [], ['category'], 'value');
    const tickSets = (axis: 'shared' | 'independent') => {
      const el = host();
      renderRaincloud(el, grid, { ...DEFAULT_OPTIONS, axis: { ...DEFAULT_OPTIONS.axis, range: 'data' }, panels: { wrap: 'auto', axis }, size: { ...DEFAULT_OPTIONS.size, mode: 'standard', panelWidth: 300 } }, DEFAULT_THEME, new Set(), noop);
      const axisGroups = [...el.querySelectorAll('svg > g')].filter((g) => g.querySelector('text') && !g.hasAttribute('data-rain-bottom'));
      return axisGroups.map((g) => [...g.querySelectorAll('text')].map((t) => t.textContent).join(','));
    };
    const shared = tickSets('shared');
    expect(shared.length).toBe(3);
    expect(new Set(shared).size).toBe(1);
    expect(new Set(tickSets('independent')).size).toBeGreaterThan(1);
  });
});

describe('Colour tile', () => {
  function colourGrid(): ReturnType<typeof buildGrid> {
    const lines = readFileSync(join(DIR, 'quirks.csv'), 'utf8').trim().split(/\r?\n/);
    const h = lines[0].split(',');
    const at = (cells: string[], f: string) => cells[h.indexOf(f)];
    const records: GridRecord[] = lines.slice(1).map((l, i) => {
      const cells = l.split(',');
      return { rowPath: [at(cells, 'category')], colPath: [], colour: at(cells, 'segment'), value: Number(at(cells, 'value')), tupleId: i + 1 };
    });
    return buildGrid(records, ['category'], [], 'value', 'segment');
  }

  it('colours dots by member, shows a legend and turns the combined cloud neutral', () => {
    const el = host();
    renderRaincloud(el, colourGrid(), DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
    const fills = new Set([...el.querySelectorAll('circle.rc-dot')].map((c) => c.getAttribute('fill')));
    expect(fills).toEqual(new Set(['#4e79a7', '#f28e2b'])); // Tableau 10 slots 1 and 2 for Alpha/Beta
    expect(el.textContent).toContain('segment:');
    const clouds = [...el.querySelectorAll('path')].filter((p) => (p.getAttribute('d') ?? '').includes('C'));
    expect(clouds.length).toBe(3);
    clouds.forEach((p) => expect(p.getAttribute('fill')).toBe('#9aa0a6'));
  });

  it('split cloud: one curve per member per row, in member colours', () => {
    const el = host();
    renderRaincloud(el, colourGrid(), { ...DEFAULT_OPTIONS, colour: { ...DEFAULT_OPTIONS.colour, splitCloud: true, showLegend: true, assigned: {} } }, DEFAULT_THEME, new Set(), noop);
    const clouds = [...el.querySelectorAll('path')].filter((p) => (p.getAttribute('d') ?? '').includes('C'));
    expect(clouds.length).toBe(6); // 3 rows × 2 segments
    expect(new Set(clouds.map((p) => p.getAttribute('fill')))).toEqual(new Set(['#4e79a7', '#f28e2b']));
  });

  it('split histogram: bars stack by member', () => {
    const el = host();
    renderRaincloud(el, colourGrid(), { ...DEFAULT_OPTIONS, cloud: 'histogram', colour: { ...DEFAULT_OPTIONS.colour, splitCloud: true, cloudSizing: 'share', showLegend: true, assigned: {} } }, DEFAULT_THEME, new Set(), noop);
    const bars = [...el.querySelectorAll('g[data-rain-bottom] rect')].filter((r) => r.getAttribute('fill') !== DEFAULT_THEME.surface);
    expect(new Set(bars.map((b) => b.getAttribute('fill')))).toEqual(new Set(['#4e79a7', '#f28e2b']));
    expect(el.innerHTML).not.toMatch(/NaN|undefined/);
  });

  it('groups dots by colour within each stack (first member nearest the box)', () => {
    const el = host();
    renderRaincloud(el, colourGrid(), DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
    // Within each stack (same cx), every Alpha dot sits above (smaller cy) every Beta dot.
    const byStack = new Map<string, { cy: number; fill: string }[]>();
    for (const c of el.querySelectorAll('g[data-rain-bottom]')) {
      for (const d of c.querySelectorAll('circle.rc-dot')) {
        const key = `${c.getAttribute('data-rain-bottom')}|${d.getAttribute('cx')}`;
        const list = byStack.get(key) ?? [];
        list.push({ cy: Number(d.getAttribute('cy')), fill: d.getAttribute('fill')! });
        byStack.set(key, list);
      }
    }
    for (const list of byStack.values()) {
      const sorted = list.sort((a, b) => a.cy - b.cy).map((d) => d.fill);
      const firstBeta = sorted.indexOf('#f28e2b');
      if (firstBeta >= 0) expect(sorted.slice(firstBeta).every((f) => f === '#f28e2b')).toBe(true);
    }
  });
});

describe('polish: box lane, decimals, stable colours', () => {
  it('gives the box its own lane: gaps grow with the row, never below 6 px', () => {
    expect(boxLane(64, true).gap).toBe(6);
    expect(boxLane(200, true).gap).toBeCloseTo(12);
    expect(boxLane(64, true).boxH).toBe(7);
    expect(boxLane(200, true).boxH).toBe(11);
    expect(boxLane(200, false).boxH).toBe(0);
    // Denser settings tighten the gaps at the same row height
    expect(boxLane(120, true, 'compact').gap).toBeLessThan(boxLane(120, true).gap);
    expect(boxLane(120, true, 'dense').gap).toBeLessThan(boxLane(120, true, 'compact').gap);
  });

  it('labels use 0 decimals by default', () => {
    const el = host();
    renderRaincloud(el, gridFromGroups(buildGroups(load('quirks.csv'))), DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
    expect(el.textContent).toMatch(/Median \d+(?![.\d])/);
    expect(el.textContent).not.toMatch(/Median \d+\.\d/);
  });

  it('returns colour assignments and honours remembered ones', () => {
    const records: GridRecord[] = [
      { rowPath: ['r'], colPath: [], colour: 'A', value: 1, tupleId: 1 },
      { rowPath: ['r'], colPath: [], colour: 'C', value: 2, tupleId: 2 }
    ];
    const grid = buildGrid(records, ['row'], [], 'v', 'seg');
    const remembered = { A: '#4e79a7', B: '#f28e2b', C: '#e15759' }; // B currently filtered out
    const el = host();
    const result = renderRaincloud(el, grid, { ...DEFAULT_OPTIONS, colour: { ...DEFAULT_OPTIONS.colour, splitCloud: false, showLegend: true, assigned: { seg: remembered } } }, DEFAULT_THEME, new Set(), noop);
    const fills = [...el.querySelectorAll('circle.rc-dot')].map((c) => c.getAttribute('fill'));
    expect(fills).toContain('#e15759'); // C keeps its colour instead of taking B's
    expect(result.colourAssignments).toEqual(remembered);
  });
});

describe('outlier default and badge', () => {
  it('cuts outliers by default and flags them with a badge that toggles "show all"', () => {
    const groups = buildGroups(load('outliers_response_ms.csv'));
    const nonNull = groups.reduce((a, g) => a + g.stats.n, 0);
    const el = host();
    renderRaincloud(el, gridFromGroups(groups), DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
    const cutDots = el.querySelectorAll('circle.rc-dot').length;
    expect(cutDots).toBeLessThan(nonNull);
    const badge = document.querySelector<HTMLButtonElement>('.rc-badge')!;
    expect(badge.textContent).toContain(`${nonNull - cutDots} values outside the axis`);
    badge.click(); // viewer: show all
    expect(el.querySelectorAll('circle.rc-dot').length).toBe(nonNull);
    expect(document.querySelector('.rc-badge')!.textContent).toContain('Showing all values');
    document.querySelector<HTMLButtonElement>('.rc-badge')!.click(); // back to the cut
    expect(el.querySelectorAll('circle.rc-dot').length).toBe(cutDots);
  });

  it('shows no badge when the default cut hides nothing', () => {
    const el = host();
    const records = Array.from({ length: 50 }, (_, i) => ({ category: 'A', value: i, tupleId: i + 1 }));
    renderRaincloud(el, gridFromGroups(buildGroups(records)), DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
    expect(el.querySelectorAll('circle.rc-dot').length).toBe(50);
    expect(document.querySelector('.rc-badge')).toBeNull();
  });

  it('strip rain compresses rows: more rows fit before scrolling', () => {
    const groups = buildGroups(load('many_categories.csv'));
    const height = (rain: 'dots' | 'strip') => {
      const el = host();
      renderRaincloud(el, gridFromGroups(groups), { ...DEFAULT_OPTIONS, rain }, DEFAULT_THEME, new Set(), noop);
      return Number(el.querySelector('svg')!.getAttribute('height'));
    };
    expect(height('strip')).toBeLessThan(height('dots'));
  });
});

describe('axis title and number format', () => {
  it('draws the axis title without SUM() and formats ticks and labels with the field format', () => {
    const groups = buildGroups(load('quirks.csv'));
    const grid = { ...gridFromGroups(groups, 'Category', 'SUM(Sales)'), valueFormat: { prefix: '$', suffix: '', scale: 1, thousands: true, decimals: 2 } };
    const el = host();
    renderRaincloud(el, grid, DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
    expect(el.querySelector('.rc-axis-title')?.textContent).toBe('Sales');
    const ticks = [...el.querySelectorAll('svg > g text')].map((t) => t.textContent ?? '');
    expect(ticks.some((t) => /^\$\d/.test(t))).toBe(true);
    expect(el.textContent).toMatch(/Median \$\d+/);
  });
});

describe('axis labels and ticks (v1.1)', () => {
  // Axis groups: the svg's direct <g> children that aren't a cell's plot layer
  const axisMarks = (el: HTMLElement, tag: string) => [...el.querySelectorAll('svg > g')]
    .filter((g) => !g.hasAttribute('data-rain-bottom')).flatMap((g) => [...g.children].filter((c) => c.tagName.toLowerCase() === tag));
  const single = () => gridFromGroups(buildGroups(load('quirks.csv').filter((r) => r.category === 'Group A (uniform)')), 'Category', 'SUM(Value)');

  it('draws no row header when Rows is empty (it used to show the raw field name)', () => {
    const grid = buildGrid([{ rowPath: [], colPath: [], colour: null, value: 1, tupleId: 1 }, { rowPath: [], colPath: [], colour: null, value: 3, tupleId: 2 }], [], [], 'SUM(Value)');
    const el = host();
    renderRaincloud(el, grid, DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
    expect(el.textContent).not.toContain('SUM(Value)');
    expect(el.querySelector('.rc-axis-title')?.textContent).toBe('Value');
  });

  it('uses a custom axis title, or none', () => {
    const custom = host();
    renderRaincloud(custom, single(), { ...DEFAULT_OPTIONS, axis: { ...DEFAULT_OPTIONS.axis, titleMode: 'custom', title: 'Delivery time (min)' } }, DEFAULT_THEME, new Set(), noop);
    expect(custom.querySelector('.rc-axis-title')?.textContent).toBe('Delivery time (min)');
    const none = host();
    renderRaincloud(none, single(), { ...DEFAULT_OPTIONS, axis: { ...DEFAULT_OPTIONS.axis, titleMode: 'hidden' } }, DEFAULT_THEME, new Set(), noop);
    expect(none.querySelector('.rc-axis-title')).toBeNull();
  });

  it('draws short tick marks instead of gridlines when gridlines are off', () => {
    const lineLengths = (gridlines: boolean) => {
      const el = host();
      renderRaincloud(el, single(), { ...DEFAULT_OPTIONS, axis: { ...DEFAULT_OPTIONS.axis, gridlines } }, DEFAULT_THEME, new Set(), noop);
      return axisMarks(el, 'line').map((l) => Number(l.getAttribute('y2')) - Number(l.getAttribute('y1')));
    };
    expect(Math.min(...lineLengths(true))).toBeGreaterThan(20);
    expect(Math.max(...lineLengths(false))).toBe(4);
  });

  it('labels ticks at a fixed interval', () => {
    const el = host();
    renderRaincloud(el, single(), { ...DEFAULT_OPTIONS, axis: { ...DEFAULT_OPTIONS.axis, range: 'data', tickStep: 5 } }, DEFAULT_THEME, new Set(), noop);
    const labels = axisMarks(el, 'text').map((t) => Number(t.textContent));
    expect(labels.length).toBeGreaterThan(2);
    labels.forEach((v) => expect(v % 5).toBe(0));
  });
});

describe('rain band (v1.1)', () => {
  it('shrinks to the tallest stack, so no blank strip is left under short rain', () => {
    // 3 rows of 12 spread-out values: stacks of 1–2 dots at full size in tall rows
    const records: GridRecord[] = [];
    ['a', 'b', 'c'].forEach((r, k) => { for (let i = 0; i < 12; i++) records.push({ rowPath: [r], colPath: [], colour: null, value: i * 10 + k, tupleId: k * 100 + i + 1 }); });
    const el = host();
    renderRaincloud(el, buildGrid(records, ['row'], [], 'v'), DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
    for (const g of el.querySelectorAll('g[data-rain-bottom]')) {
      const bottom = Number(g.getAttribute('data-rain-bottom'));
      const lowest = Math.max(...[...g.querySelectorAll('circle.rc-dot')].map((c) => Number(c.getAttribute('cy')) + Number(c.getAttribute('r'))));
      expect(bottom - lowest).toBeLessThan(2);
    }
  });
});

describe('dot size across cells (v1.1)', () => {
  // Row "spike": 600 values at 0 plus a spread; rows "a", "b": 30 spread values each.
  function spikeGrid(): ReturnType<typeof buildGrid> {
    const records: GridRecord[] = [];
    let id = 1;
    for (let i = 0; i < 600; i++) records.push({ rowPath: ['spike'], colPath: [], colour: null, value: 0, tupleId: id++ });
    for (const r of ['spike', 'a', 'b']) for (let i = 0; i < 30; i++) records.push({ rowPath: [r], colPath: [], colour: null, value: i * 3, tupleId: id++ });
    return buildGrid(records, ['row'], [], 'v');
  }
  const radii = (el: HTMLElement) => [...el.querySelectorAll('g[data-rain-bottom]')].map((g) => Number(g.querySelector('circle.rc-dot')?.getAttribute('r')));
  const render = () => {
    const el = host();
    renderRaincloud(el, spikeGrid(), { ...DEFAULT_OPTIONS, axis: { ...DEFAULT_OPTIONS.axis, range: 'data' } }, DEFAULT_THEME, new Set(), noop);
    return el;
  };

  it("keeps one dot size everywhere, and the spike doesn't shrink the other rows' dots", () => {
    const r = radii(render());
    expect(new Set(r).size).toBe(1);
    expect(r[1]).toBeCloseTo((7 / 2) * 0.9); // full-size dots, not squeezed to fit the spike's 600-dot pile
  });

  it('overlapping stacks get more transparency; full-size dots get a surface ring', () => {
    const el = render();
    const [spike, quiet] = [...el.querySelectorAll('g[data-rain-bottom]')].map((g) => g.querySelector('circle.rc-dot')!);
    expect(Number(spike.getAttribute('fill-opacity'))).toBeLessThan(Number(quiet.getAttribute('fill-opacity')));
    expect(quiet.getAttribute('stroke')).toBe(DEFAULT_THEME.surface);
  });

  it("keeps the spike's overlapping stacks inside its band", () => {
    const el = render();
    for (const g of el.querySelectorAll('g[data-rain-bottom]')) {
      const bottom = Number(g.getAttribute('data-rain-bottom'));
      for (const c of g.querySelectorAll('circle.rc-dot')) expect(Number(c.getAttribute('cy')) + Number(c.getAttribute('r'))).toBeLessThanOrEqual(bottom + 0.01);
    }
  });
});

describe('cloud peak label (v1.1)', () => {
  const grid = () => gridFromGroups(buildGroups(load('quirks.csv')));
  const labels = (scales: Partial<RaincloudOptions['scales']>, cloud: RaincloudOptions['cloud'] = 'density') => {
    const el = host();
    renderRaincloud(el, grid(), { ...DEFAULT_OPTIONS, cloud, scales: { ...DEFAULT_OPTIONS.scales, ...scales } }, DEFAULT_THEME, new Set(), noop);
    return [...el.querySelectorAll('text.rc-peak')].map((t) => t.firstChild?.textContent ?? '');
  };

  it('labels each cloud when heights fit each chart, and not when they are shared (auto)', () => {
    const fit = labels({ cloudHeight: 'independent' });
    expect(fit).toHaveLength(3);
    fit.forEach((t) => expect(t).toMatch(/^\d+(\.\d)?% per \d+$/));
    expect(labels({ cloudHeight: 'shared' })).toHaveLength(0);
    expect(labels({ cloudHeight: 'shared', cloudLabel: 'on' })).toHaveLength(3);
    expect(labels({ cloudLabel: 'off' })).toHaveLength(0);
  });

  it('never exceeds 100%, even for a spike much narrower than the gridline interval', () => {
    const records: GridRecord[] = [];
    for (let i = 0; i < 500; i++) records.push({ rowPath: ['r'], colPath: [], colour: null, value: i < 450 ? 0 : (i - 450) * 4, tupleId: i + 1 });
    const el = host();
    renderRaincloud(el, buildGrid(records, ['row'], [], 'v'), { ...DEFAULT_OPTIONS, axis: { ...DEFAULT_OPTIONS.axis, range: 'data' } }, DEFAULT_THEME, new Set(), noop);
    const text = el.querySelector('text.rc-peak')!.firstChild!.textContent!;
    const pct = Number(/^([\d.]+)%/.exec(text)![1]);
    expect(pct).toBeLessThanOrEqual(100);
    expect(pct).toBeGreaterThanOrEqual(90); // 450 of 500 records sit in the spike
  });

  it('histogram: the tallest bar as % of the chart per bin', () => {
    labels({}, 'histogram').forEach((t) => expect(t).toMatch(/% per bin$/));
  });
});

describe('density (v1.1)', () => {
  // 30 rows × 3 columns, 40 values each
  function bigGrid(): ReturnType<typeof buildGrid> {
    const records: GridRecord[] = [];
    let id = 1;
    for (let r = 0; r < 30; r++) for (const c of ['N', 'S', 'W']) for (let i = 0; i < 40; i++) {
      records.push({ rowPath: [`Store ${r}`], colPath: [c], colour: null, value: (i * 7 + r) % 50, tupleId: id++ });
    }
    return buildGrid(records, ['store'], ['region'], 'v');
  }
  const render = (density: RaincloudOptions['density']) => {
    const el = host();
    renderRaincloud(el, bigGrid(), { ...DEFAULT_OPTIONS, density }, DEFAULT_THEME, new Set(), noop);
    return el;
  };
  const height = (el: HTMLElement) => Number(el.querySelector('svg')!.getAttribute('height'));
  const tickLabels = (el: HTMLElement) => [...el.querySelectorAll('svg > g')].filter((g) => !g.hasAttribute('data-rain-bottom'))
    .reduce((n, g) => n + g.querySelectorAll(':scope > text').length, 0);

  it('denser settings make the grid shorter (smaller rows, one tick strip per block)', () => {
    const [comfortable, compact, dense] = (['comfortable', 'compact', 'dense'] as const).map(render);
    expect(height(compact)).toBeLessThan(height(comfortable));
    expect(height(dense)).toBeLessThan(height(compact));
    expect(tickLabels(dense)).toBeLessThan(tickLabels(comfortable) / 10); // labels under the last row only
  });

  it('dense rows drop the n count and never stack marker labels past the top of the cell', () => {
    const el = render('dense');
    expect(el.textContent).not.toMatch(/n = /);
    for (const g of el.querySelectorAll('g[data-rain-bottom]')) {
      const top = Number(g.getAttribute('data-rain-bottom')) + 3 - 24; // cell top at the 24 px minimum
      for (const t of g.querySelectorAll('text')) expect(Number(t.getAttribute('y'))).toBeGreaterThanOrEqual(top);
    }
    expect(el.innerHTML).not.toMatch(/NaN|undefined/);
  });
});

describe('alignment across columns (v1.1)', () => {
  it('boxes in the same row line up across columns, even when one column has much taller stacks', () => {
    const records: GridRecord[] = [];
    let id = 1;
    for (let i = 0; i < 300; i++) records.push({ rowPath: ['r'], colPath: ['pile'], colour: null, value: i % 5, tupleId: id++ });
    for (let i = 0; i < 12; i++) records.push({ rowPath: ['r'], colPath: ['sparse'], colour: null, value: i * 10, tupleId: id++ });
    const el = host();
    renderRaincloud(el, buildGrid(records, ['row'], ['col'], 'v'), { ...DEFAULT_OPTIONS, axis: { ...DEFAULT_OPTIONS.axis, range: 'data' } }, DEFAULT_THEME, new Set(), noop);
    const boxYs = [...el.querySelectorAll('g[data-rain-bottom] rect')].filter((r) => r.getAttribute('rx') === '1.5').map((r) => Number(r.getAttribute('y')));
    expect(boxYs).toHaveLength(2);
    expect(boxYs[0]).toBeCloseTo(boxYs[1]);
  });
});

describe('ECDF line (v1.1)', () => {
  const render = (colour: boolean, splitCloud = false) => {
    const records: GridRecord[] = [];
    for (let i = 0; i < 200; i++) records.push({ rowPath: ['r'], colPath: [], colour: colour ? (i % 4 ? 'A' : 'B') : null, value: (i * 37) % 100, tupleId: i + 1 });
    const el = host();
    renderRaincloud(el, buildGrid(records, ['row'], [], 'v', colour ? 'seg' : null), { ...DEFAULT_OPTIONS, ecdf: true, axis: { ...DEFAULT_OPTIONS.axis, range: 'data' }, colour: { ...DEFAULT_OPTIONS.colour, splitCloud } }, DEFAULT_THEME, new Set(), noop);
    return el;
  };

  it('follows the cloud: one line, or one per colour member when the cloud is split; own 50% and 100% labels', () => {
    const one = render(false);
    expect(one.querySelectorAll('g.rc-ecdf path')).toHaveLength(1);
    expect([...one.querySelectorAll('g.rc-ecdf text')].map((t) => t.textContent)).toEqual(['100%', '50%']);
    expect(render(true).querySelectorAll('g.rc-ecdf path')).toHaveLength(1); // Colour field, cloud not split
    expect(render(true, true).querySelectorAll('g.rc-ecdf path')).toHaveLength(2);
  });

  it('only rises (y never goes back down) and ends at 100%', () => {
    const el = render(false);
    const d = el.querySelector('g.rc-ecdf path')!.getAttribute('d')!;
    const ys = [...d.matchAll(/V(-?[\d.]+)/g)].map((m) => Number(m[1]));
    ys.slice(1).forEach((y, i) => expect(y).toBeLessThanOrEqual(ys[i] + 1e-9));
    // 100% sits at the top of the cloud area: as far above the 50% guide as the start (0%) is below it
    const y50 = Number(el.querySelector('g.rc-ecdf line')!.getAttribute('y1'));
    const y0 = Number(/^M[^,]+,(-?[\d.]+)/.exec(d)![1]);
    expect(ys[ys.length - 1]).toBeCloseTo(2 * y50 - y0);
  });

  it('keeps the n count below the 100% line, with the 100% label beside it', () => {
    const el = render(false);
    const d = el.querySelector('g.rc-ecdf path')!.getAttribute('d')!;
    const top = Math.min(...[...d.matchAll(/V(-?[\d.]+)/g)].map((m) => Number(m[1])));
    const n = [...el.querySelectorAll('text')].find((t) => t.textContent?.startsWith('n = '))!;
    expect(Number(n.getAttribute('y')) - 9).toBeGreaterThan(top); // text top (≈ 9 px above its baseline) under the line
    const hundred = [...el.querySelectorAll('g.rc-ecdf text')].find((t) => t.textContent === '100%')!;
    expect(hundred.getAttribute('y')).toBe(n.getAttribute('y'));
    expect(Number(hundred.getAttribute('x'))).toBeLessThan(Number(n.getAttribute('x')) - 30);
  });
});

describe('split cloud sizing (v1.1)', () => {
  // Row "r": 40 values of A spread wide, 4 values of B packed tight, so B is a small, peaky member.
  function skewedGrid(): ReturnType<typeof buildGrid> {
    const records: GridRecord[] = [];
    for (let i = 0; i < 40; i++) records.push({ rowPath: ['r'], colPath: [], colour: 'A', value: i, tupleId: i + 1 });
    for (let i = 0; i < 6; i++) records.push({ rowPath: ['r'], colPath: [], colour: 'B', value: 20 + i * 0.1, tupleId: 100 + i });
    return buildGrid(records, ['row'], [], 'v', 'seg');
  }
  const opts = (cloud: 'density' | 'histogram', cloudSizing: 'share' | 'each'): RaincloudOptions =>
    ({ ...DEFAULT_OPTIONS, cloud, colour: { ...DEFAULT_OPTIONS.colour, splitCloud: true, cloudSizing } });
  // Topmost y of a member's curve (smaller = taller)
  const peakY = (el: HTMLElement, fill: string) => Math.min(...[...el.querySelectorAll(`path[fill="${fill}"]`)]
    .flatMap((p) => (p.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)!.map(Number).filter((_, i) => i % 2 === 1)));

  it("'each' makes a small member's curve as big as its own shape, not its share", () => {
    const share = host();
    renderRaincloud(share, skewedGrid(), opts('density', 'share'), DEFAULT_THEME, new Set(), noop);
    const each = host();
    renderRaincloud(each, skewedGrid(), opts('density', 'each'), DEFAULT_THEME, new Set(), noop);
    expect(peakY(each, '#f28e2b')).toBeLessThan(peakY(share, '#f28e2b'));
  });

  it("'each' histogram: one outline per member instead of stacked bars", () => {
    const el = host();
    renderRaincloud(el, skewedGrid(), opts('histogram', 'each'), DEFAULT_THEME, new Set(), noop);
    const outlines = [...el.querySelectorAll('g[data-rain-bottom] path')].filter((p) => p.getAttribute('fill-opacity') === '0.12');
    expect(new Set(outlines.map((p) => p.getAttribute('fill')))).toEqual(new Set(['#4e79a7', '#f28e2b']));
    expect(el.innerHTML).not.toMatch(/NaN|undefined/);
  });
});

describe('legend option', () => {
  it('hides the colour legend when showLegend is off', () => {
    const records: GridRecord[] = [
      { rowPath: ['r'], colPath: [], colour: 'A', value: 1, tupleId: 1 },
      { rowPath: ['r'], colPath: [], colour: 'B', value: 2, tupleId: 2 }
    ];
    const grid = buildGrid(records, ['row'], [], 'v', 'seg');
    const shown = host();
    renderRaincloud(shown, grid, DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
    expect(shown.textContent).toContain('seg:');
    const hidden = host();
    renderRaincloud(hidden, grid, { ...DEFAULT_OPTIONS, colour: { ...DEFAULT_OPTIONS.colour, showLegend: false } }, DEFAULT_THEME, new Set(), noop);
    expect(hidden.textContent).not.toContain('seg:');
  });
});
