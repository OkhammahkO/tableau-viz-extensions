import { select, type Selection } from 'd3-selection';
import { scaleLinear, type ScaleLinear } from 'd3-scale';
import { area, curveBasis } from 'd3-shape';
import { allGroups, type Grid, type Group, type Point } from './model';
import type { RaincloudOptions } from './options';
import { autoPerRow, computeGrid } from '@kit/grid/layout';
import { HEADER_H, drawColumnHeaders, drawRowHeaders, legendLayout } from '@kit/grid/headers';
import { DEFAULT_THEME, type RenderTheme } from '@kit/theme';
import { esc, showTip } from '@kit/ui/tooltip';
import { autoBinCount, dotLayout, histogram, kde, orderWithinStacks, quantileSorted, wilkinsonStacks, type Bin } from './stats';
import { NEUTRAL_CLOUD, assignColours, type Palette } from '@kit/colours';
import { axisTitle, formatSummary, formatTick } from '@kit/format';

export { DEFAULT_THEME, esc, showTip, type RenderTheme };

// Draws a grid of horizontal rainclouds (Rows × Columns, like Tableau's shelves): in each cell the cloud sits above
// the baseline, the box on it, the rain below. Knows nothing about Tableau: interaction goes out through handlers.

export interface Anchor {
  x: number;
  y: number;
}

export interface RenderHandlers {
  /** pageX/pageY of the pointer, for Tableau's tooltip anchor. */
  onHover(point: Point | undefined, anchor: Anchor, event: PointerEvent): void;
  onSelect(point: Point | undefined, additive: boolean, anchor: Anchor): void;
}

export interface RenderResult {
  /** Colour field in use and its member → colour map, for the caller to remember (stable colours). */
  colourField: string | null;
  colourAssignments: Record<string, string> | null;
}

const AXIS_TITLE_H = 16; // axis title strip at the bottom
const TICK_H = 16; // tick-label strip under every cell when Columns is used (user decision)
const PANEL_GAP = 14; // between column panels and between wrapped block rows
const RIGHT = 12;
const TOP = 4;
const CELL_PAD = 8; // inner horizontal padding of a cell's plot

let clipSeq = 0;
/**
 * The box gets its own lane between cloud and rain: a gap on each side that grows with the row (at least 6 px)
 * and a box 7–11 px tall, so it never looks squashed.
 */
export function boxLane(rowH: number, hasBox: boolean): { boxH: number; gap: number } {
  if (!hasBox) return { boxH: 0, gap: 2 };
  return { boxH: Math.min(11, Math.max(7, rowH * 0.08)), gap: Math.max(6, rowH * 0.06) };
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
type G = Selection<SVGGElement, unknown, null, undefined>;

interface Domain {
  lo: number;
  hi: number;
  /** Visible window (equals lo..hi unless the axis is cut). */
  vLo: number;
  vHi: number;
  pad: number;
  truncated: boolean;
}

/** Value range for a set of groups: the data range, or a cut window (percentiles / whiskers + margin). */
export function computeDomain(groups: Group[], opts: RaincloudOptions): Domain {
  let lo = Infinity;
  let hi = -Infinity;
  for (const g of groups) if (g.stats.n) { lo = Math.min(lo, g.stats.min); hi = Math.max(hi, g.stats.max); }
  if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
  if (lo === hi) { lo -= 1; hi += 1; }
  let vLo = lo;
  let vHi = hi;
  const truncated = opts.axis.range !== 'data';
  if (opts.axis.range === 'percentile') {
    const pooled = groups.flatMap((g) => g.values).sort((a, b) => a - b);
    const a = quantileSorted(pooled, opts.axis.low / 100);
    const b = quantileSorted(pooled, opts.axis.high / 100);
    if (b > a) { vLo = a; vHi = b; }
  } else if (opts.axis.range === 'whiskers') {
    const withData = groups.filter((g) => g.stats.n);
    if (withData.length) {
      const a = Math.min(...withData.map((g) => g.stats.whiskerLow));
      const b = Math.max(...withData.map((g) => g.stats.whiskerHigh));
      const margin = (b - a) * opts.axis.margin;
      if (b > a) { vLo = Math.max(lo, a - margin); vHi = Math.min(hi, b + margin); }
    }
  }
  return { lo, hi, vLo, vHi, pad: truncated ? 0 : (hi - lo) * 0.02, truncated };
}

// Per chart: the last render's arguments (so the badge can re-render) and whether the viewer chose "show all".
const lastRender = new WeakMap<HTMLElement, [Grid, RaincloudOptions, RenderTheme, Set<number>, RenderHandlers]>();
const showAllHosts = new WeakSet<HTMLElement>();

/** How many values the axis setting hides, using the same domains the renderer uses. */
export function countOutside(grid: Grid, opts: RaincloudOptions): number {
  if (opts.axis.range === 'data') return 0;
  const hasCols = grid.colLevels.length > 0;
  const shared = computeDomain(allGroups(grid), opts);
  let n = 0;
  grid.cols.forEach((_, c) => {
    const colGroups = grid.cells.map((row) => row[c]).filter((g): g is Group => !!g);
    const d = opts.panels.axis === 'independent' && hasCols ? computeDomain(colGroups, opts) : shared;
    for (const g of colGroups) for (const v of g.values) if (v < d.vLo || v > d.vHi) n++;
  });
  return n;
}

/**
 * The outlier flag, bottom right of the chart's frame (outside the scrolling area, so it stays put). Shown only
 * when values are actually cut. Clicking toggles "show all values" for this viewer only; nothing is saved.
 */
function drawCutBadge(host: HTMLElement, opts: RaincloudOptions, outside: number, showAll: boolean): void {
  const parent = host.parentElement ?? host;
  parent.querySelector(':scope > .rc-badge')?.remove();
  if (opts.axis.range === 'data' || outside === 0) return;
  const s = outside === 1 ? '' : 's';
  const method = opts.axis.range === 'whiskers'
    ? `whiskers + ${Math.round(opts.axis.margin * 100)}%`
    : `P${opts.axis.low}–P${opts.axis.high}`;
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.className = showAll ? 'rc-badge rc-badge-all' : 'rc-badge';
  badge.textContent = showAll
    ? `Showing all values · hide ${outside.toLocaleString()} outlier${s}`
    : `⚠ ${outside.toLocaleString()} value${s} outside the axis · show all`;
  badge.title = `Axis cut at ${method}. Statistics (box, mean, percentiles) always use all values.`;
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    if (showAllHosts.has(host)) showAllHosts.delete(host);
    else showAllHosts.add(host);
    const args = lastRender.get(host);
    if (args) renderRaincloud(host, ...args);
  });
  parent.appendChild(badge);
}

interface Cell {
  r: number;
  c: number;
  x0: number;
  y0: number;
  w: number;
  h: number;
  x: ScaleLinear<number, number>;
  domain: Domain;
  group?: Group;
  visible: Point[];
  pxs: number[];
}

export function renderRaincloud(
  host: HTMLElement,
  grid: Grid,
  opts: RaincloudOptions,
  theme: RenderTheme,
  selected: Set<number>,
  handlers: RenderHandlers
): RenderResult {
  host.replaceChildren();
  lastRender.set(host, [grid, opts, theme, selected, handlers]);
  // The viewer can temporarily show all values from the badge; the saved setting (cutOpts) is untouched.
  const cutOpts = opts;
  const showAll = showAllHosts.has(host) && cutOpts.axis.range !== 'data';
  if (showAll) opts = { ...opts, axis: { ...opts.axis, range: 'data' } };
  const W = Math.max(240, host.clientWidth);
  const H = Math.max(120, host.clientHeight);
  const nR = grid.rows.length;
  const nC = grid.cols.length;
  const hasCols = grid.colLevels.length > 0;
  const hasBox = opts.lightning === 'box';

  // Colour tile: dots take member colours; the combined cloud turns neutral so it doesn't clash (F4).
  const palette = grid.colourLevel ? assignColours(grid.colourMembers, opts.colour.assigned[grid.colourLevel] ?? {}) : null;
  // Summary values and ticks follow the field's Tableau number format when it could be inferred (F1).
  const fmt = (v: number) => formatSummary(v, grid.valueFormat, opts.markers.decimals);
  const split = !!palette && opts.colour.splitCloud;
  const cloudColour = palette && !split ? NEUTRAL_CLOUD : opts.color;
  const dotColour = (p: Point) => (palette ? palette.colourOf(p.colour) : opts.color);
  const legend = palette && opts.colour.showLegend ? legendLayout(grid.colourLevel!, palette, W - 16) : { items: [], height: 0 };

  // Value ranges: one shared range, or one per column (user option).
  const shared = computeDomain(allGroups(grid), opts);
  const domains = grid.cols.map((_, c) =>
    opts.panels.axis === 'independent' && hasCols
      ? computeDomain(grid.cells.map((row) => row[c]).filter((g): g is Group => !!g), opts)
      : shared
  );

  // Row headers: one column per Rows level (or the measure name when Rows is empty), capped at 45% of the width.
  const levelCount = Math.max(1, grid.rowLevels.length);
  const rowLabels = (k: number) => (grid.rowLevels.length ? grid.rows.map((p) => p[k] ?? '') : [grid.valueName]);
  let levelW = Array.from({ length: levelCount }, (_, k) =>
    Math.min(170, Math.max(36, Math.max(3, ...rowLabels(k).map((s) => s.length)) * 6.6 + 16))
  );
  if (sum(levelW) > W * 0.45) levelW = levelW.map((w) => (w * W * 0.45) / sum(levelW));
  const levelX = levelW.map((_, k) => sum(levelW.slice(0, k)));
  const rowHeaderW = sum(levelW) + 6;

  // Wrapping: only with exactly one Columns dimension.
  const canWrap = hasCols && grid.colLevels.length === 1 && nC > 1;
  const perRow = !canWrap ? nC : opts.panels.wrap === 'auto'
    ? autoPerRow(W, rowHeaderW, RIGHT, PANEL_GAP, nC)
    : Math.max(1, Math.min(nC, Math.round(opts.panels.wrap)));
  const wrapped = canWrap && perRow < nC;
  const colHeaderH = !hasCols ? 0 : wrapped ? HEADER_H : HEADER_H * grid.colLevels.length;
  const tickH = hasCols ? TICK_H : 0;
  const bottomH = (hasCols ? 0 : 20) + AXIS_TITLE_H + 2;

  const geo = computeGrid({
    frameW: W, frameH: H, rowCount: nR, colCount: nC, perRow, rowHeaderW, right: RIGHT, top: TOP + legend.height,
    colHeaderH, tickH, bottomH, gap: hasCols ? PANEL_GAP : 0,
    // Strip/none rain need less room, so rows may be smaller and more fit (user request).
    size: { ...opts.size, minRowHeight: opts.rain === 'dots' ? opts.size.minRowHeight : Math.min(opts.size.minRowHeight, opts.rain === 'strip' ? 44 : 36) }
  });

  const svg = select(host)
    .append('svg')
    .attr('width', geo.width)
    .attr('height', geo.height)
    .attr('class', typeof tableau !== 'undefined' ? tableau.ClassNameKey.Worksheet : null)
    .style('font-family', theme.fontFamily)
    .style('display', 'block')
    .on('click', (e: MouseEvent) => handlers.onSelect(undefined, e.ctrlKey || e.metaKey, { x: e.pageX, y: e.pageY }));
  const tip = document.createElement('div');
  tip.className = 'rc-tip';
  tip.hidden = true;
  host.appendChild(tip);

  // Legend above the grid: "Field: ● member ● member …", wrapping onto more lines when needed.
  for (const it of legend.items) {
    if (it.kind === 'title') {
      svg.append('text').attr('x', it.x).attr('y', TOP + it.y).attr('font-size', 11).attr('font-weight', 600).attr('fill', theme.text).text(it.label);
    } else {
      svg.append('circle').attr('cx', it.x + 5).attr('cy', TOP + it.y - 4).attr('r', 4.5).attr('fill', it.colour!);
      svg.append('text').attr('x', it.x + 14).attr('y', TOP + it.y).attr('font-size', 11).attr('fill', theme.text).text(it.label);
    }
  }

  // Cells with their scales and visible points
  const cells: Cell[] = [];
  for (let r = 0; r < nR; r++) {
    for (let c = 0; c < nC; c++) {
      const b = Math.floor(c / geo.perRow);
      const j = c % geo.perRow;
      const x0 = geo.panelX(j);
      const y0 = geo.cellY(b, r);
      const d = domains[c];
      const x = scaleLinear().domain([d.vLo - d.pad, d.vHi + d.pad]).range([x0 + CELL_PAD, x0 + geo.panelW - CELL_PAD]);
      const group = grid.cells[r][c];
      const visible = group ? group.points.filter((p) => p.value >= d.vLo && p.value <= d.vHi) : [];
      cells.push({ r, c, x0, y0, w: geo.panelW, h: geo.rowH, x, domain: d, group, visible, pxs: visible.map((p) => x(p.value)) });
    }
  }

  // Shared scales across cells: cloud height, dot size, bins
  const lane = boxLane(geo.rowH, hasBox);
  // Rain band: half the row for stacked dots, just a line for a strip, nothing for none. The cloud gets the rest.
  const rainH = opts.rain === 'dots' ? geo.rowH * 0.5 - (lane.boxH / 2 + lane.gap) - 3 : opts.rain === 'strip' ? 12 : 2;
  const maxN = Math.max(1, ...cells.map((cl) => cl.group?.stats.n ?? 0));
  const binCount = opts.bins === 'auto' ? autoBinCount(maxN) : opts.bins;
  const dens = new Map<Cell, [number, number][]>();
  const hists = new Map<Cell, { bins: Bin[]; binW: number }>();
  let maxD = 0;
  for (const cl of cells) {
    const g = cl.group;
    if (!g || !g.stats.n) continue;
    if (opts.cloud === 'density' && g.stats.n >= opts.minNForDensity) {
      const pts = kde(g.values, g.stats.bandwidth * opts.bandwidth, 128, cl.domain.vLo, cl.domain.vHi);
      dens.set(cl, pts);
      for (const p of pts) maxD = Math.max(maxD, p[1]);
    } else if (opts.cloud === 'histogram') {
      const binW = (cl.domain.vHi - cl.domain.vLo) / binCount;
      const bins = histogram(g.values, cl.domain.vLo, cl.domain.vHi, binCount);
      hists.set(cl, { bins, binW });
      for (const bn of bins) maxD = Math.max(maxD, bn.count / (g.stats.n * binW));
    }
  }
  const dots = opts.rain === 'dots' ? dotLayout(cells.map((cl) => cl.pxs), rainH, 7, 1.5) : { d: 0, step: 0 };

  drawColumnHeaders(svg, grid, geo, wrapped, theme);
  drawRowHeaders(svg, grid, geo, levelX, levelW, theme, RIGHT);

  const cellLabel = (cl: Cell) => [...grid.rows[cl.r], ...grid.cols[cl.c]].filter(Boolean).join(' · ') || grid.valueName;

  for (const cl of cells) {
    const { x, x0, y0, w, h, group: g, domain: d } = cl;
    const base = y0 + h - 3 - rainH - lane.gap - lane.boxH / 2; // box centre; equals the row middle with dots
    const cloudBase = base - lane.boxH / 2 - lane.gap; // the cloud sits on this line
    const cloudH = cloudBase - y0 - 4;
    const rainTop = base + lane.boxH / 2 + lane.gap;
    const clipId = `rc-clip-${++clipSeq}`;
    svg.append('clipPath').attr('id', clipId).append('rect').attr('x', x0 + 1).attr('y', y0).attr('width', Math.max(0, w - 2)).attr('height', h);

    // Grid lines and (with Columns) tick labels under every cell
    const ticks = x.ticks(Math.max(2, Math.floor((w - 2 * CELL_PAD) / 90)));
    const axisG = svg.append('g');
    axisG.selectAll('line').data(ticks).join('line')
      .attr('x1', (t) => x(t)).attr('x2', (t) => x(t)).attr('y1', y0).attr('y2', y0 + h)
      .attr('stroke', theme.grid).attr('stroke-width', 1);
    const isLastRow = cl.r === nR - 1;
    if (tickH || isLastRow) {
      axisG.selectAll('text').data(ticks).join('text')
        .attr('x', (t) => x(t)).attr('y', y0 + h + (tickH ? 12 : 15)).attr('text-anchor', 'middle')
        .attr('font-size', 10).attr('fill', theme.muted).style('font-variant-numeric', 'tabular-nums')
        .text((t) => formatTick(t, grid.valueFormat, ticks.length > 1 ? ticks[1] - ticks[0] : 1));
    }

    const L: G = svg.append('g').attr('clip-path', `url(#${clipId})`).attr('data-rain-bottom', y0 + h - 3);
    if (!g || g.stats.n === 0) {
      L.append('text').attr('x', x0 + w / 2).attr('y', base + 4).attr('text-anchor', 'middle').attr('font-size', 11)
        .attr('fill', theme.muted).text(g?.stats.missing ? `no values · ${g.stats.missing} missing` : 'no values');
      continue;
    }

    // n in the cell's top-left corner
    L.append('text').attr('x', x0 + 4).attr('y', y0 + 11).attr('font-size', 10).attr('fill', theme.muted)
      .attr('stroke', theme.surface).attr('stroke-width', 3).attr('paint-order', 'stroke')
      .text(`n = ${g.stats.n.toLocaleString()}${g.stats.missing ? ` · ${g.stats.missing} missing` : ''}`);

    if (d.truncated) {
      for (const edge of [d.vLo, d.vHi]) {
        L.append('line').attr('x1', x(edge)).attr('x2', x(edge)).attr('y1', y0).attr('y2', y0 + h)
          .attr('stroke', theme.muted).attr('stroke-dasharray', '3 3');
      }
    }

    // Cloud
    const hs = scaleLinear().domain([0, maxD || 1]).range([0, cloudH]);
    const dpts = dens.get(cl);
    const hist = hists.get(cl);
    const curve = area<[number, number]>().x((p) => x(p[0])).y0(cloudBase).y1((p) => cloudBase - hs(p[1])).curve(curveBasis);
    if (dpts && dpts.length && split) {
      // One curve per colour member, scaled by its share of the cell, so the curves add up to the whole.
      for (const sub of subGroups(g, palette!)) {
        if (sub.values.length < opts.minNForDensity) continue;
        const share = sub.values.length / g.stats.n;
        const pts = kde(sub.values, g.stats.bandwidth * opts.bandwidth, 128, d.vLo, d.vHi).map(([vx, vy]) => [vx, vy * share] as [number, number]);
        if (!pts.length) continue;
        L.append('path').datum(pts).attr('d', curve).attr('fill', sub.colour).attr('fill-opacity', 0.2)
          .attr('stroke', sub.colour).attr('stroke-width', 1.25);
      }
    } else if (dpts && dpts.length) {
      L.append('path').datum(dpts).attr('d', curve).attr('fill', cloudColour).attr('fill-opacity', 0.35)
        .attr('stroke', cloudColour).attr('stroke-width', 1.25);
    } else if (hist && split) {
      // Stacked histogram: each bin's bar is divided by colour member, bottom-up in legend order.
      const binsBySub = subGroups(g, palette!).map((sub) => ({ colour: sub.colour, bins: histogram(sub.values, d.vLo, d.vHi, hist.bins.length) }));
      hist.bins.forEach((_, bi) => {
        let acc = 0;
        for (const s of binsBySub) {
          const bn = s.bins[bi];
          if (!bn.count) continue;
          const y1 = cloudBase - hs(acc / (g.stats.n * hist.binW));
          acc += bn.count;
          const y2 = cloudBase - hs(acc / (g.stats.n * hist.binW));
          L.append('rect').attr('x', x(bn.x0) + 0.5).attr('width', Math.max(0.5, x(bn.x1) - x(bn.x0) - 1))
            .attr('y', y2).attr('height', Math.max(0, y1 - y2)).attr('fill', s.colour).attr('fill-opacity', 0.75);
        }
      });
    } else if (hist) {
      L.selectAll(null).data(hist.bins.filter((bn) => bn.count)).join('rect')
        .attr('x', (bn) => x(bn.x0) + 0.5).attr('width', (bn) => Math.max(0.5, x(bn.x1) - x(bn.x0) - 1))
        .attr('y', (bn) => cloudBase - hs(bn.count / (g.stats.n * hist.binW)))
        .attr('height', (bn) => hs(bn.count / (g.stats.n * hist.binW)))
        .attr('fill', cloudColour).attr('fill-opacity', 0.45);
    } else if (opts.cloud === 'density' && g.stats.n < opts.minNForDensity) {
      L.append('text').attr('x', x0 + 4).attr('y', base - 8).attr('font-size', 10).attr('fill', theme.muted)
        .text(`too few values for a curve (n < ${opts.minNForDensity})`);
    }

    // Lightning: slim box with Tukey whiskers
    if (hasBox) {
      const s = g.stats;
      const bh = lane.boxH;
      L.append('line').attr('x1', x(s.whiskerLow)).attr('x2', x(s.whiskerHigh)).attr('y1', base).attr('y2', base)
        .attr('stroke', theme.text).attr('stroke-width', 1.25);
      L.append('rect').attr('x', x(s.q1)).attr('y', base - bh / 2).attr('width', Math.max(1, x(s.q3) - x(s.q1))).attr('height', bh)
        .attr('rx', 1.5).attr('fill', theme.surface).attr('stroke', theme.text).attr('stroke-width', 1.25)
        .style('cursor', 'help')
        .on('pointermove', (e: PointerEvent) =>
          showTip(host, tip, `<b>${esc(cellLabel(cl))}</b><br>median ${fmt(s.median)} · mean ${fmt(s.mean)}<br>IQR ${fmt(s.q1)} – ${fmt(s.q3)}<br>whiskers ${fmt(s.whiskerLow)} – ${fmt(s.whiskerHigh)} (1.5 × IQR)<br>n ${s.n}${s.missing ? ` · ${s.missing} missing` : ''}`, e))
        .on('pointerleave', () => (tip.hidden = true));
      L.append('line').attr('x1', x(s.median)).attr('x2', x(s.median)).attr('y1', base - bh / 2).attr('y2', base + bh / 2)
        .attr('stroke', theme.text).attr('stroke-width', 2.25).style('pointer-events', 'none');
    }

    // Extra markers: hollow mean diamond (the median line stays visible through it), percentile ticks
    if (opts.markers.mean) {
      const cx = x(g.stats.mean);
      L.append('path').attr('d', `M${cx},${base - 6}L${cx + 6},${base}L${cx},${base + 6}L${cx - 6},${base}Z`)
        .attr('fill', 'none').attr('stroke', theme.text).attr('stroke-width', 1.5).style('pointer-events', 'none');
    }
    const labels: { v: number; text: string }[] = [];
    for (const p of opts.markers.percentiles) {
      const v = quantileSorted(g.values, p / 100);
      L.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', base - 8).attr('y2', base + 8)
        .attr('stroke', theme.text).attr('stroke-width', 1).attr('stroke-dasharray', '2 1.5');
      labels.push({ v, text: opts.markers.showValues ? `P${p} ${fmt(v)}` : `P${p}` });
    }
    if (opts.markers.showValues && hasBox) labels.push({ v: g.stats.median, text: `Median ${fmt(g.stats.median)}` });
    if (opts.markers.showValues && opts.markers.mean) labels.push({ v: g.stats.mean, text: `Mean ${fmt(g.stats.mean)}` });
    placeLabels(L, labels.map((l) => ({ x: x(l.v), text: l.text })), base - lane.boxH / 2 - 5, theme);

    // Values cut off by the axis window: counted at the edges, never silently dropped.
    if (d.truncated) {
      const below = g.values.filter((v) => v < d.vLo).length;
      const above = g.values.filter((v) => v > d.vHi).length;
      if (below) L.append('text').attr('x', x0 + 3).attr('y', rainTop + 10).attr('font-size', 10).attr('fill', theme.muted).text(`‹ ${below}`);
      if (above) L.append('text').attr('x', x0 + w - 3).attr('y', rainTop + 10).attr('text-anchor', 'end').attr('font-size', 10).attr('fill', theme.muted).text(`${above} ›`);
    }

    // Rain: one mark per record, carrying its tuple id
    if (opts.rain === 'dots') {
      // With a Colour field, each stack lists one member's dots, then the next (legend order).
      let stacks = wilkinsonStacks(cl.pxs, dots.d);
      if (palette) stacks = orderWithinStacks(stacks, cl.visible.map((p) => palette.rankOf(p.colour)));
      L.selectAll(null).data(cl.visible).join('circle').attr('class', 'rc-dot')
        .attr('cx', (_, k) => stacks[k].x).attr('cy', (_, k) => rainTop + dots.d / 2 + stacks[k].k * dots.step)
        .attr('r', Math.max(0.4, (dots.d / 2) * 0.9)).attr('fill', dotColour);
    } else if (opts.rain === 'strip') {
      L.selectAll(null).data(cl.visible).join('circle').attr('class', 'rc-dot rc-strip')
        .attr('cx', (p) => x(p.value)).attr('cy', rainTop + 6).attr('r', 2.5).attr('fill', dotColour);
    }
    L.selectAll<SVGCircleElement, Point>('circle.rc-dot')
      .on('pointermove', (e: PointerEvent, p) => handlers.onHover(p, { x: e.pageX, y: e.pageY }, e))
      .on('pointerleave', (e: PointerEvent) => handlers.onHover(undefined, { x: e.pageX, y: e.pageY }, e))
      .on('click', (e: MouseEvent, p) => {
        e.stopPropagation();
        handlers.onSelect(p, e.ctrlKey || e.metaKey, { x: e.pageX, y: e.pageY });
      });
  }

  // Axis title once, centred under the plot area (Tableau's axis title equivalent).
  svg.append('text').attr('class', 'rc-axis-title')
    .attr('x', (rowHeaderW + geo.width - RIGHT) / 2).attr('y', geo.height - 6).attr('text-anchor', 'middle')
    .attr('font-size', 11).attr('font-weight', 600).attr('fill', theme.text).text(axisTitle(grid.valueName));

  drawCutBadge(host, cutOpts, countOutside(grid, cutOpts), showAll);

  styleSelection(host, selected);
  return { colourField: grid.colourLevel, colourAssignments: palette?.assigned ?? null };
}


/** A cell's values split by colour member (Other grouped), in legend order. */
function subGroups(g: Group, palette: Palette): { colour: string; values: number[] }[] {
  const byKey = new Map<string, number[]>();
  for (const p of g.points) {
    const k = palette.keyOf(p.colour);
    let arr = byKey.get(k);
    if (!arr) byKey.set(k, (arr = []));
    arr.push(p.value); // points are sorted, so each list stays sorted
  }
  return palette.legend.filter((l) => byKey.has(l.key)).map((l) => ({ colour: l.colour, values: byKey.get(l.key)! }));
}

/**
 * Marker labels above the box, centred on their value. A label that would overlap the one before it moves up a
 * row (up to three rows). A halo in the surface colour keeps them readable over the cloud.
 */
function placeLabels(L: G, items: { x: number; text: string }[], y: number, theme: RenderTheme): void {
  const rowsEnd: number[] = [];
  for (const it of items.sort((a, b) => a.x - b.x)) {
    const w = it.text.length * 5.2 + 6; // ~9px font
    let row = 0;
    while (row < 2 && rowsEnd[row] !== undefined && rowsEnd[row] > it.x - w / 2) row++;
    rowsEnd[row] = it.x + w / 2;
    L.append('text').attr('x', it.x).attr('y', y - row * 11).attr('text-anchor', 'middle').attr('font-size', 9)
      .attr('fill', theme.muted).attr('stroke', theme.surface).attr('stroke-width', 3).attr('paint-order', 'stroke')
      .style('font-variant-numeric', 'tabular-nums').text(it.text);
  }
}

/** Re-styles marks for the current selection without redrawing. */
export function styleSelection(host: HTMLElement, selected: Set<number>): void {
  const any = selected.size > 0;
  select(host).selectAll<SVGCircleElement, Point>('circle.rc-dot').attr('fill-opacity', function (d) {
    const base = this.classList.contains('rc-strip') ? 0.35 : 0.85;
    return !any ? base : selected.has(d.tupleId) ? 1 : 0.15;
  });
}

