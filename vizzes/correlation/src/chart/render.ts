import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { assignColours, type Palette } from '@kit/colours';
import { formatTick } from '@kit/format';
import { legendLayout } from '@kit/grid/headers';
import { DEFAULT_THEME, type RenderTheme } from '@kit/theme';
import { esc, showTip } from '@kit/ui/tooltip';
import type { Matrix, MatrixRecord } from './model';
import type { CorrOptions } from './options';
import { renderFocus } from './focus';
import { binIdsOf, drawCoefficient, drawDensity, drawDiagonal, formatR } from './cells';
import { drawPoints } from './points';
import type { Cell } from './geometry';
import { readPair } from './interpret';
import { completePairs, cutWindow, formulaText, leastSquares, paddedExtent, pairStats, type PairStats } from './stats';

export { DEFAULT_THEME, type RenderTheme };
export { formatR, toneOf } from './cells';
export { drawOrder } from './points';

// Draws the correlation matrix: scatters below the diagonal (points on a canvas, or density cells for big data), each
// measure's histogram on the diagonal carrying its name, and the coefficient above, sized and tinted by strength.
// Knows nothing about Tableau: hover and selection go out through handlers.

export interface Anchor { x: number; y: number }

export interface MatrixHandlers {
  onHover(record: MatrixRecord | undefined, anchor: Anchor, event: PointerEvent): void;
  /** Records to select (empty = clear); additive with Ctrl/Cmd. */
  onSelect(tupleIds: number[], additive: boolean, anchor: Anchor): void;
}

export interface RenderResult {
  colourField: string | null;
  colourAssignments: Record<string, string> | null;
  /** Density cells were used (more records than the threshold, or chosen). */
  density: boolean;
}

const pairCache = new WeakMap<Matrix, Map<string, PairStats>>();
// The open focus view per chart (measures across, up), kept across redraws such as a selection change.
const focusOf = new WeakMap<HTMLElement, [number, number]>();
// Charts with a focus view open, for the one Esc listener (a listener per chart leaked: the landing page makes new
// charts on every resize).
const focusOpen = new Set<HTMLElement>();
let escWired = false;
// Viewer's "show all values" from the outlier badge (per chart, not saved), and the last render's arguments so the
// badge can redraw.
const showAllHosts = new WeakSet<HTMLElement>();
const lastRender = new WeakMap<HTMLElement, [Matrix, CorrOptions, RenderTheme, Set<number>, MatrixHandlers]>();

const TOP = 4;
const RIGHT = 6;
const MIN_CELL = 44;
const HIGHLIGHT = '#f28e2b'; // the hovered record, in every cell
const HIGHLIGHT_TEXT = '#b35f0a'; // names of the hovered pair (darker orange: readable as text)

export function renderMatrix(host: HTMLElement, m: Matrix, opts: CorrOptions, theme: RenderTheme, selected: Set<number>, handlers: MatrixHandlers): RenderResult {
  host.replaceChildren();
  lastRender.set(host, [m, opts, theme, selected, handlers]);
  const k = m.names.length;
  const palette: Palette | null = m.colourLevel ? assignColours(m.colourMembers, opts.colour.assigned[m.colourLevel] ?? {}) : null;
  const density = opts.points === 'density' || (opts.points === 'auto' && m.records.length > opts.densityThreshold);
  const result: RenderResult = { colourField: m.colourLevel, colourAssignments: palette?.assigned ?? null, density };
  if (k < 2) {
    const msg = document.createElement('p');
    msg.className = 'cm-empty';
    msg.textContent = k === 1 ? 'Add at least one more measure to compare.' : 'Add two or more measures to compare.';
    host.append(msg);
    return result;
  }

  const W = Math.max(200, host.clientWidth);
  const H = Math.max(160, host.clientHeight);
  const legend = palette && opts.colour.showLegend ? legendLayout(m.colourLevel!, palette, W - 16) : { items: [], height: 0 };
  const left = 36;
  // Axis windows: the outlier cut (unless off, or the viewer chose "show all"), else the padded data range.
  const showAll = showAllHosts.has(host);
  const windows = m.columns.map((col) => (opts.axisCut.on && !showAll ? cutWindow(col, opts.axisCut.margin) : { window: paddedExtent(col), cut: false }));
  const extents = windows.map((w) => w.window);
  const badged = windows.some((w) => w.cut) || showAll;
  const bottom = 18 + (badged ? 30 : 0); // room for the outlier badge below the ticks
  const top = TOP + legend.height;
  const gap = k > 5 ? 4 : 6;
  const fit = Math.floor(Math.min((W - left - RIGHT - (k - 1) * gap) / k, (H - top - bottom - (k - 1) * gap) / k));
  const cell = Math.max(MIN_CELL, fit); // the frame scrolls rather than squeezing cells below MIN_CELL
  const size = k * cell + (k - 1) * gap;
  const width = left + size + RIGHT;
  const height = top + size + bottom;
  const pos = (n: number) => n * (cell + gap);
  /** Values of measure j beyond its window: [below, above]. */
  const beyond = m.columns.map((col, j) => {
    if (!windows[j].cut) return [0, 0] as const;
    const [lo, hi] = extents[j];
    let below = 0;
    let above = 0;
    for (const v of col) if (v !== null) { if (v < lo) below++; else if (v > hi) above++; }
    return [below, above] as const;
  });
  const cells: Cell[] = [];
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    const x0 = left + pos(j);
    const y0 = top + pos(i);
    cells.push({ i, j, x0, y0, x: scaleLinear().domain(extents[j]).range([x0, x0 + cell]), y: scaleLinear().domain(extents[i]).range([y0 + cell, y0]) });
  }
  const at = (i: number, j: number) => cells[i * k + j];
  // Coefficients are cached per matrix: Spearman sorts, and a selection or resize redraws without new data.
  const pairs = pairCache.get(m) ?? pairCache.set(m, new Map()).get(m)!;
  const statsOf = (a: number, b: number) => {
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    if (!pairs.has(key)) pairs.set(key, pairStats(m.columns[a], m.columns[b]));
    return pairs.get(key)!;
  };
  const colourOf = (r: MatrixRecord) => (palette ? palette.colourOf(r.colour) : opts.color);
  // Extra tooltip lines for a pair: the trend line's formula and R², and r per colour member (a relationship can
  // reverse inside groups: Simpson's paradox). Measure a runs across the pair's scatter, measure b up it.
  const fits = new Map<string, ReturnType<typeof leastSquares>>();
  const fitOf = (a: number, b: number) => {
    const key = `${a},${b}`;
    if (!fits.has(key)) fits.set(key, leastSquares(...completePairs(m.columns[a], m.columns[b])));
    return fits.get(key)!;
  };
  const memberStats = (a: number, b: number, member: string) => {
    const key = `${Math.min(a, b)},${Math.max(a, b)},${member}`;
    if (!pairs.has(key)) {
      const keep = m.records.map((r) => palette!.keyOf(r.colour) === member);
      pairs.set(key, pairStats(m.columns[a].filter((_, n) => keep[n]), m.columns[b].filter((_, n) => keep[n])));
    }
    return pairs.get(key)!;
  };
  /** Per colour member: r (or ρ) and n for a pair. */
  const groupsOf = (a: number, b: number) => (palette ? palette.legend.map((l) => {
    const ms = memberStats(a, b, l.key);
    return { label: l.label, colour: l.colour, r: opts.coefficient === 'spearman' ? ms.spearman : ms.pearson, n: ms.n };
  }) : []);
  // Tooltip body for a pair (measure a across, b up): the reading in words, the formula, r per colour, caveats.
  const pairDetails = (a: number, b: number): string => {
    const s = statsOf(a, b);
    const groups = groupsOf(a, b);
    const reading = readPair(name(a), name(b), s, opts.coefficient, groups);
    const words = (t: string) => `<div style="white-space:normal;max-width:300px">${esc(t)}</div>`;
    const lines = [words(reading.headline)];
    if (reading.explained) lines.push(words(reading.explained));
    const f = fitOf(a, b);
    if (f && !Number.isNaN(s.pearson)) lines.push(`${esc(formulaText(name(b), name(a), f.slope, f.intercept))} · R² ${formatR(s.pearson ** 2)}`);
    for (const g of groups) lines.push(`<span style="color:${g.colour}">●</span> ${esc(g.label)}: ${opts.coefficient === 'spearman' ? 'ρ' : 'r'} ${formatR(g.r)} (n ${g.n.toLocaleString()})`);
    for (const cv of reading.caveats) lines.push(`<div style="white-space:normal;max-width:300px;color:#8a5a00">⚠ ${esc(cv)}</div>`);
    return lines.join('');
  };
  // Coefficient colour: red/blue only while the marks are grey (no Colour field), unless chosen otherwise.
  const diverging = opts.coefColour === 'diverging' || (opts.coefColour === 'auto' && !palette);

  // Layers: base SVG (cells, histograms, numbers, density cells) · canvas (points) · overlay SVG (lines, highlight).
  // Focus view: open (click a coefficient, the ⤢ on a hovered scatter, or double-click it), close (×, Esc); redrawn on every render.
  const openFocus = (a: number, b: number) => {
    focusOf.set(host, [a, b]);
    focusOpen.add(host);
    host.querySelector(':scope > .cm-focus')?.remove();
    renderFocus(host, m, a, b, opts, palette, theme, selected, { ...handlers, onClose: closeFocus }, [extents[a], extents[b]]);
  };
  const closeFocus = () => {
    focusOf.delete(host);
    focusOpen.delete(host);
    host.querySelector(':scope > .cm-focus')?.remove();
  };
  if (!escWired) {
    escWired = true;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      for (const h of focusOpen) {
        focusOf.delete(h);
        h.querySelector(':scope > .cm-focus')?.remove();
      }
      focusOpen.clear();
    });
  }

  const wrap = document.createElement('div');
  wrap.className = 'cm-wrap';
  wrap.style.cssText = `position:relative;width:${width}px;height:${height}px;margin:0 auto`; // square: centred in a wide frame
  host.append(wrap);
  const base = select(wrap).append('svg').attr('width', width).attr('height', height)
    .attr('class', typeof tableau !== 'undefined' ? tableau.ClassNameKey.Worksheet : null)
    .style('position', 'absolute').style('left', 0).style('top', 0).style('font-family', theme.fontFamily);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `position:absolute;left:0;top:0;width:${width}px;height:${height}px;pointer-events:none`;
  wrap.append(canvas);
  const overlay = select(wrap).append('svg').attr('width', width).attr('height', height)
    .style('position', 'absolute').style('left', 0).style('top', 0).style('pointer-events', 'none');
  const tip = document.createElement('div');
  tip.className = 'cm-tip';
  tip.hidden = true;
  host.append(tip);

  // Legend
  for (const it of legend.items) {
    if (it.kind === 'title') base.append('text').attr('x', it.x).attr('y', TOP + it.y).attr('font-size', 11).attr('font-weight', 600).attr('fill', theme.text).text(it.label);
    else {
      const key = palette!.legend.find((l) => l.label === it.label)?.key ?? it.label;
      base.append('circle').attr('cx', it.x + 5).attr('cy', TOP + it.y - 4).attr('r', 4.5).attr('fill', it.colour!).attr('data-member', key).style('cursor', 'default');
      base.append('text').attr('x', it.x + 14).attr('y', TOP + it.y).attr('font-size', 11).attr('fill', theme.text).attr('data-member', key).text(it.label);
    }
  }

  const name = (j: number) => m.names[j];
  for (const c of cells) {
    const g = base.append('g');
    if (c.i === c.j) drawDiagonal(g, c, m, cell, opts, theme, selected, palette, beyond[c.j]);
    else if (c.i > c.j) {
      g.append('rect').attr('x', c.x0).attr('y', c.y0).attr('width', cell).attr('height', cell).attr('fill', theme.grid).attr('fill-opacity', 0.35);
      if (density) drawDensity(g, c, m, cell, opts.color, theme);
    } else drawCoefficient(g, c, statsOf(c.i, c.j), cell, opts, theme, `${name(c.j)} · ${name(c.i)}`, pairDetails(c.i, c.j), diverging);
    // Dashed edge where the axis is cut and values lie beyond it (left/right: the column's measure; bottom/top: the row's).
    if (c.i >= c.j) {
      const edge = (x1: number, y1: number, x2: number, y2: number) => g.append('line').attr('class', 'cm-cut')
        .attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr('stroke', theme.muted).attr('stroke-dasharray', '3 3').attr('stroke-width', 1);
      const [bx, ax] = beyond[c.j];
      if (bx) edge(c.x0, c.y0, c.x0, c.y0 + cell);
      if (ax) edge(c.x0 + cell, c.y0, c.x0 + cell, c.y0 + cell);
      if (c.i > c.j) {
        const [by, ay] = beyond[c.i];
        if (by) edge(c.x0, c.y0 + cell, c.x0 + cell, c.y0 + cell);
        if (ay) edge(c.x0, c.y0, c.x0 + cell, c.y0);
      }
    }
  }

  // Trend lines (overlay, clipped to each scatter)
  if (opts.trendLine) {
    for (const c of cells.filter((cl) => cl.i > cl.j)) {
      const fit2 = fitOf(c.j, c.i);
      if (!fit2) continue;
      const [lo, hi] = extents[c.j];
      const id = `cm-clip-${c.i}-${c.j}-${Math.random().toString(36).slice(2, 7)}`;
      overlay.append('clipPath').attr('id', id).append('rect').attr('x', c.x0).attr('y', c.y0).attr('width', cell).attr('height', cell);
      overlay.append('line').attr('class', 'cm-trend').attr('clip-path', `url(#${id})`)
        .attr('x1', c.x(lo)).attr('y1', c.y(fit2.intercept + fit2.slope * lo)).attr('x2', c.x(hi)).attr('y2', c.y(fit2.intercept + fit2.slope * hi))
        .attr('stroke', theme.text).attr('stroke-opacity', 0.55).attr('stroke-width', 1.1);
    }
  }

  // Formula in each scatter (option): R² and the line, small, top-left over the points.
  if (opts.formula === 'cell' && cell >= 80) {
    for (const c of cells.filter((cl) => cl.i > cl.j)) {
      const f = fitOf(c.j, c.i);
      const s = statsOf(c.i, c.j);
      if (!f || Number.isNaN(s.pearson)) continue;
      const t = overlay.append('text').attr('class', 'cm-formula').attr('x', c.x0 + 3).attr('y', c.y0 + 11).attr('font-size', 9)
        .attr('fill', theme.text).attr('stroke', theme.surface).attr('stroke-width', 3).attr('paint-order', 'stroke');
      t.append('tspan').text(`R² ${formatR(s.pearson ** 2)}`);
      t.append('tspan').attr('x', c.x0 + 3).attr('dy', 11).attr('fill', theme.muted)
        .text(`y = ${f.slope < 0 ? '−' : ''}${Number(Math.abs(f.slope).toPrecision(2))}x ${f.intercept < 0 ? '−' : '+'} ${Number(Math.abs(f.intercept).toPrecision(2))}`);
    }
  }

  // Outer tick labels: x under the bottom row, y left of the first column (row 0 there is a histogram: no y scale).
  for (let j = 0; j < k; j++) {
    const c = at(k - 1, j);
    const fmtJ = m.formats[j];
    const all = c.x.ticks(cell < 90 ? 2 : 3);
    const step = all.length > 1 ? all[1] - all[0] : 1;
    const half = (t: number) => (formatTick(t, fmtJ, step).length * 5.4) / 2; // about 5.4 px a character at 9.5 px
    const ticks = keepInside(all, (t) => c.x(t) - half(t), (t) => c.x(t) + half(t), c.x0, c.x0 + cell);
    base.append('g').selectAll('text').data(ticks).join('text').attr('x', (t) => c.x(t)).attr('y', top + size + 13)
      .attr('text-anchor', 'middle').attr('font-size', 9.5).attr('fill', theme.muted).style('font-variant-numeric', 'tabular-nums')
      .text((t) => formatTick(t, fmtJ, step));
  }
  for (let i = 1; i < k; i++) {
    const c = at(i, 0);
    const fmtI = m.formats[i];
    const all = c.y.ticks(cell < 90 ? 2 : 3);
    const step = all.length > 1 ? all[1] - all[0] : 1;
    const ticks = keepInside(all, (t) => c.y(t) - 4, (t) => c.y(t) + 4, c.y0, c.y0 + cell);
    base.append('g').selectAll('text').data(ticks).join('text').attr('x', left - 4).attr('y', (t) => c.y(t) + 3)
      .attr('text-anchor', 'end').attr('font-size', 9.5).attr('fill', theme.muted).style('font-variant-numeric', 'tabular-nums')
      .text((t) => formatTick(t, fmtI, step));
  }

  // Points (canvas) and a spatial index per scatter for hover
  const index = new Map<Cell, Map<string, number[]>>();
  const radius = cell < 70 ? 1.4 : cell < 120 ? 1.8 : 2.2;
  if (!density) {
    const lower = cells.filter((c) => c.i > c.j);
    for (const c of lower) {
      const idx = new Map<string, number[]>();
      m.records.forEach((r, n) => {
        const vx = r.values[c.j];
        const vy = r.values[c.i];
        if (vx === null || vy === null) return;
        const [lx, hx] = extents[c.j];
        const [ly, hy] = extents[c.i];
        if (vx < lx || vx > hx || vy < ly || vy > hy) return; // beyond a cut axis: not drawn, not hoverable
        const key = `${Math.floor(c.x(vx) / 8)},${Math.floor(c.y(vy) / 8)}`;
        (idx.get(key) ?? idx.set(key, []).get(key)!).push(n);
      });
      index.set(c, idx);
    }
  }
  // Points are redrawn with an emphasis: the selection by default; while hovering a legend member, a histogram bar or
  // dragging a brush, the records it picks out (the rest fade).
  const lowerCells = cells.filter((c) => c.i > c.j);
  const selectionEmphasis = selected.size ? (r: MatrixRecord) => selected.has(r.tupleId) : null;
  let emphasisKey = '';
  const emphasise = (key: string, pick: ((r: MatrixRecord) => boolean) | null) => {
    if (density || key === emphasisKey) return;
    emphasisKey = key;
    drawPoints(canvas, m, lowerCells, width, height, radius, colourOf, pick ?? selectionEmphasis);
  };
  if (!density) drawPoints(canvas, m, lowerCells, width, height, radius, colourOf, selectionEmphasis);
  const inRange = (j: number, lo: number, hi: number, last: boolean) => (r: MatrixRecord) => {
    const v = r.values[j];
    return v !== null && v >= lo && (last ? v <= hi : v < hi);
  };
  const inBox = (c: Cell, x1: number, x2: number, y1: number, y2: number) => {
    const [vx1, vx2] = [c.x.invert(Math.min(x1, x2)), c.x.invert(Math.max(x1, x2))];
    const [vy1, vy2] = [c.y.invert(Math.max(y1, y2)), c.y.invert(Math.min(y1, y2))];
    return (r: MatrixRecord) => {
      const vx = r.values[c.j];
      const vy = r.values[c.i];
      return vx !== null && vy !== null && vx >= vx1 && vx <= vx2 && vy >= vy1 && vy <= vy2;
    };
  };
  const barRange = (el: Element) => {
    const [j, lo, hi, last] = el.getAttribute('data-bar')!.split('|');
    return inRange(Number(j), Number(lo), Number(hi), last === '1');
  };

  // Interaction: nearest point in a scatter, or the element under the pointer (numbers, histograms, density cells).
  const cellAt = (px: number, py: number) => cells.find((c) => px >= c.x0 && px <= c.x0 + cell && py >= c.y0 && py <= c.y0 + cell);
  const nearest = (c: Cell, px: number, py: number): number | undefined => {
    const idx = index.get(c);
    if (!idx) return undefined;
    let best: number | undefined;
    let bestD = 7 * 7;
    const gx = Math.floor(px / 8);
    const gy = Math.floor(py / 8);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const n of idx.get(`${gx + dx},${gy + dy}`) ?? []) {
        const r = m.records[n];
        const d = (c.x(r.values[c.j]!) - px) ** 2 + (c.y(r.values[c.i]!) - py) ** 2;
        if (d < bestD) { bestD = d; best = n; }
      }
    }
    return best;
  };
  const highlight = (n: number | undefined) => {
    overlay.selectAll('.cm-hl').remove();
    if (n === undefined) return;
    const r = m.records[n];
    const shown = (d: number) => r.values[d] !== null && r.values[d]! >= extents[d][0] && r.values[d]! <= extents[d][1];
    for (const c of cells.filter((cl) => cl.i > cl.j)) {
      if (!shown(c.j) || !shown(c.i)) continue; // missing, or beyond a cut axis: it isn't drawn in that scatter either
      const vx = r.values[c.j]!;
      const vy = r.values[c.i]!;
      overlay.append('circle').attr('class', 'cm-hl').attr('cx', c.x(vx)).attr('cy', c.y(vy)).attr('r', radius + 2.4)
        .attr('fill', HIGHLIGHT).attr('stroke', theme.surface).attr('stroke-width', 1.2);
    }
    // Where the record sits in each measure's distribution: a tick on every histogram.
    for (let d = 0; d < k; d++) {
      if (!shown(d)) continue; // beyond the cut: counted at the histogram's edge instead
      const v = r.values[d]!;
      const c = at(d, d);
      overlay.append('line').attr('class', 'cm-hl').attr('x1', c.x(v)).attr('x2', c.x(v)).attr('y1', c.y0 + 16).attr('y2', c.y0 + cell)
        .attr('stroke', HIGHLIGHT).attr('stroke-width', 2);
    }
  };
  // Cross-highlight: a scatter and its coefficient are one pair, shown together with the two measures' names; a
  // histogram brings up every pair its measure is in (its row and column).
  let lastCell: Cell | undefined;
  const pairHighlight = (c: Cell | undefined) => {
    if (c === lastCell) return;
    lastCell = c;
    overlay.selectAll('.cm-pair').remove();
    base.selectAll<SVGTextElement, unknown>('.cm-name').attr('fill', theme.text);
    if (!c) return;
    // Strong: the hovered cell and its partner. Row/column (from a histogram): a clear outline plus a light tint.
    const frame = (cl: Cell, strong: boolean) => overlay.insert('rect', ':first-child').attr('class', 'cm-pair')
      .attr('x', cl.x0 - 1).attr('y', cl.y0 - 1).attr('width', cell + 2).attr('height', cell + 2)
      .attr('fill', strong ? 'none' : HIGHLIGHT).attr('fill-opacity', strong ? 0 : 0.07)
      .attr('stroke', strong ? theme.text : HIGHLIGHT_TEXT).attr('stroke-opacity', strong ? 0.6 : 0.55).attr('stroke-width', 1.5).attr('rx', 2);
    const names = base.selectAll<SVGTextElement, unknown>('.cm-name');
    const emphasise = (ds: number[]) => names.attr('fill', (_, n) => (ds.includes(n) ? HIGHLIGHT_TEXT : theme.text));
    if (c.i === c.j) {
      for (const cl of cells) if ((cl.i === c.i || cl.j === c.j) && cl !== c) frame(cl, false);
      frame(c, true);
      emphasise([c.i]);
    } else {
      frame(c, true);
      frame(at(c.j, c.i), true);
      emphasise([c.i, c.j]);
    }
  };
  const local = (e: PointerEvent | MouseEvent) => {
    const b = wrap.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top] as const;
  };
  // Hover preview (user, 2026-11-02): after a pause over a scatter, a larger copy of the pair appears in the top-right
  // corner (over the upper triangle, never over the hovered scatter). Moving into it keeps it; clicking it opens the
  // full focus view; moving to another cell or leaving the chart closes it. Skipped when the corner is too small.
  const PREVIEW_DELAY = 500;
  const previewSize = Math.min(Math.floor(size / 2) - gap, 380);
  let previewTimer = 0;
  let previewFor: Cell | undefined;
  let previewEl: HTMLDivElement | undefined;
  const closePreview = () => {
    clearTimeout(previewTimer);
    previewFor = undefined;
    previewEl?.remove();
    previewEl = undefined;
  };
  const schedulePreview = (c: Cell | undefined) => {
    if (c === previewFor) return;
    closePreview();
    if (!c || c.i <= c.j || previewSize < 220) return;
    previewFor = c;
    previewTimer = window.setTimeout(() => {
      const box = document.createElement('div');
      box.className = 'cm-preview';
      box.title = 'Click to look closer';
      box.style.cssText = `position:absolute;left:${left + size - previewSize}px;top:${top}px;width:${previewSize}px;height:${previewSize}px`;
      Object.defineProperty(box, 'clientWidth', { value: previewSize, configurable: true });
      Object.defineProperty(box, 'clientHeight', { value: previewSize, configurable: true });
      wrap.append(box);
      renderFocus(box, m, c.j, c.i, opts, palette, theme, selected, { ...handlers, onClose: closePreview }, [extents[c.j], extents[c.i]]);
      box.addEventListener('click', (e) => {
        if ((e.target as Element).closest?.('.cm-focus-close')) return;
        e.stopPropagation();
        closePreview();
        openFocus(c.j, c.i);
      });
      previewEl = box;
    }, PREVIEW_DELAY);
  };

  // Expand button (user, 2026-11-03: a scatter is the obvious thing to click for detail): a ⤢ in the top-right corner of
  // the hovered scatter opens its focus view. A click on the scatter itself still selects, as in Tableau.
  const expand = document.createElement('button');
  expand.type = 'button';
  expand.className = 'cm-expand';
  expand.textContent = '⤢';
  expand.title = 'Look closer';
  expand.setAttribute('aria-label', 'Look closer at this pair');
  expand.hidden = true;
  wrap.append(expand);
  let expandFor: Cell | undefined;
  const placeExpand = (c: Cell | undefined) => {
    expandFor = c && c.i > c.j ? c : undefined;
    expand.hidden = !expandFor;
    if (expandFor) expand.style.cssText = `left:${expandFor.x0 + cell - 21}px;top:${expandFor.y0 + 3}px`;
  };
  expand.addEventListener('pointerdown', (e) => e.stopPropagation()); // not the start of a brush
  expand.addEventListener('click', (e) => {
    e.stopPropagation();
    const c = expandFor;
    if (!c) return;
    closePreview();
    placeExpand(undefined);
    openFocus(c.j, c.i); // its column across, its row up
  });

  // Brushing: drag a rectangle in any scatter to select every record inside it (Becker & Cleveland's SPLOM brush).
  let brush: { c: Cell; x: number; y: number; moved: boolean } | undefined;
  let suppressClick = false;
  wrap.addEventListener('pointerdown', (e) => {
    if (previewEl?.contains(e.target as Node)) return;
    const [px, py] = local(e);
    const c = cellAt(px, py);
    if (!c || c.i <= c.j || e.button !== 0) return;
    brush = { c, x: px, y: py, moved: false };
    wrap.setPointerCapture?.(e.pointerId);
  });
  wrap.addEventListener('pointerup', (e) => {
    if (!brush) return;
    const b = brush;
    brush = undefined;
    overlay.selectAll('.cm-brush').remove();
    if (!b.moved) return; // a click: handled by the click listener
    suppressClick = true;
    const [px, py] = local(e);
    const pick = inBox(b.c, b.x, Math.max(b.c.x0, Math.min(b.c.x0 + cell, px)), b.y, Math.max(b.c.y0, Math.min(b.c.y0 + cell, py)));
    emphasisKey = '';
    handlers.onSelect(m.records.filter(pick).map((r) => r.tupleId), e.ctrlKey || e.metaKey, { x: e.pageX, y: e.pageY });
  });
  wrap.addEventListener('pointermove', (e) => {
    const [px, py] = local(e);
    if (previewEl?.contains(e.target as Node)) return; // inside the preview: keep it
    if (brush) {
      const b = brush;
      const x2 = Math.max(b.c.x0, Math.min(b.c.x0 + cell, px));
      const y2 = Math.max(b.c.y0, Math.min(b.c.y0 + cell, py));
      if (!b.moved && Math.abs(x2 - b.x) < 4 && Math.abs(y2 - b.y) < 4) return;
      b.moved = true;
      tip.hidden = true;
      placeExpand(undefined);
      highlight(undefined);
      overlay.selectAll('.cm-brush').remove();
      overlay.append('rect').attr('class', 'cm-brush').attr('x', Math.min(b.x, x2)).attr('y', Math.min(b.y, y2))
        .attr('width', Math.abs(x2 - b.x)).attr('height', Math.abs(y2 - b.y))
        .attr('fill', HIGHLIGHT).attr('fill-opacity', 0.08).attr('stroke', HIGHLIGHT).attr('stroke-dasharray', '3 2');
      emphasise(`brush:${b.x},${b.y},${x2},${y2}`, inBox(b.c, b.x, x2, b.y, y2)); // live preview in every scatter
      return;
    }
    const target = e.target as Element;
    const member = target.closest?.('[data-member]')?.getAttribute('data-member');
    const bar = target.closest?.('[data-bar]');
    if (member) emphasise(`member:${member}`, (r) => palette?.keyOf(r.colour) === member);
    else if (bar) emphasise(`bar:${bar.getAttribute('data-bar')}`, barRange(bar));
    else emphasise('', null);
    const c = cellAt(px, py);
    const n = c && c.i > c.j && !density ? nearest(c, px, py) : undefined;
    schedulePreview(c);
    placeExpand(c);
    pairHighlight(c);
    highlight(n);
    handlers.onHover(n === undefined ? undefined : m.records[n], { x: e.pageX, y: e.pageY }, e);
    const t = (e.target as Element).closest?.('[data-tip]');
    if (n === undefined && t) showTip(host, tip, t.getAttribute('data-tip')!, e);
    else tip.hidden = true;
  });
  wrap.addEventListener('pointerleave', (e) => { closePreview(); placeExpand(undefined); emphasise('', null); pairHighlight(undefined); highlight(undefined); tip.hidden = true; handlers.onHover(undefined, { x: e.pageX, y: e.pageY }, e); });
  wrap.addEventListener('dblclick', (e) => {
    const [px, py] = local(e);
    const c = cellAt(px, py);
    if (c && c.i > c.j) openFocus(c.j, c.i); // a scatter: its column across, its row up
  });
  wrap.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; return; } // the end of a brush drag
    const [px, py] = local(e);
    const c = cellAt(px, py);
    const pairAttr = (e.target as Element).closest?.('[data-pair]')?.getAttribute('data-pair');
    if (pairAttr) { // a coefficient (row i, col j) opens its scatter (row j, col i): measure i across, j up
      const [pi, pj] = pairAttr.split(',').map(Number);
      return openFocus(pi, pj);
    }
    const additive = e.ctrlKey || e.metaKey;
    const anchor = { x: e.pageX, y: e.pageY };
    const binIds = binIdsOf((e.target as Element).closest?.('.cm-bin'));
    if (binIds) return handlers.onSelect(binIds, additive, anchor);
    const bar = (e.target as Element).closest?.('[data-bar]');
    if (bar) return handlers.onSelect(m.records.filter(barRange(bar)).map((r) => r.tupleId), additive, anchor);
    const n = c && c.i > c.j && !density ? nearest(c, px, py) : undefined;
    handlers.onSelect(n === undefined ? [] : [m.records[n].tupleId], additive, anchor);
  });

  drawCutBadge(host, m, extents, badged, showAll, opts.axisCut.margin);

  const open = focusOf.get(host);
  if (open && open[0] < k && open[1] < k) openFocus(open[0], open[1]);
  else closeFocus();

  return result;
}

/**
 * The outlier badge, bottom right of the chart's frame, as in the raincloud: how many records have a value beyond a
 * cut axis. Clicking toggles "show all values" for this viewer only; nothing is saved.
 */
function drawCutBadge(host: HTMLElement, m: Matrix, extents: [number, number][], active: boolean, showAll: boolean, margin: number): void {
  const parent = host.parentElement ?? host;
  parent.querySelector(':scope > .cm-badge')?.remove();
  if (!active) return;
  const outside = showAll ? 0 : m.records.filter((r) => r.values.some((v, j) => v !== null && (v < extents[j][0] || v > extents[j][1]))).length;
  if (!showAll && !outside) return;
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.className = showAll ? 'cm-badge cm-badge-all' : 'cm-badge';
  const s = outside === 1 ? '' : 's';
  badge.textContent = showAll ? 'Showing all values · cut outliers again' : `⚠ ${outside.toLocaleString()} record${s} beyond the axes · show all`;
  badge.title = `Axes cut at the whiskers + ${Math.round(margin * 100)}%. Correlations, boxes and histograms' counts always use all values.`;
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    if (showAllHosts.has(host)) showAllHosts.delete(host);
    else showAllHosts.add(host);
    const args = lastRender.get(host);
    if (args) renderMatrix(host, ...args);
  });
  parent.appendChild(badge);
}

/**
 * Ticks whose labels stay within [lo, hi] (a pixel of slack) and clear of each other (3 px); at least the one nearest
 * the middle. Ticks come in pixel order either way round (y runs upward), so sort by start first.
 */
function keepInside(ticks: number[], start: (t: number) => number, end: (t: number) => number, lo: number, hi: number): number[] {
  const kept: number[] = [];
  for (const t of ticks.filter((t) => start(t) >= lo - 1 && end(t) <= hi + 1).sort((p, q) => start(p) - start(q))) {
    if (!kept.length || start(t) >= end(kept[kept.length - 1]) + 3) kept.push(t);
  }
  if (kept.length || !ticks.length) return kept;
  const mid = (lo + hi) / 2;
  return [ticks.reduce((p, q) => (Math.abs((start(q) + end(q)) / 2 - mid) < Math.abs((start(p) + end(p)) / 2 - mid) ? q : p))];
}
