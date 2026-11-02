import { select } from 'd3-selection';
import { scaleLinear, type ScaleLinear } from 'd3-scale';
import { allGroups, type Grid, type Group, type Point } from './model';
import { DENSITY, type Density, type RaincloudOptions } from './options';
import { autoPerRow, computeGrid } from '@kit/grid/layout';
import { HEADER_H, drawColumnHeaders, drawRowHeaders, legendLayout } from '@kit/grid/headers';
import { axisTicks, labelEvery } from '@kit/grid/ticks';
import { DEFAULT_THEME, type RenderTheme } from '@kit/theme';
import { esc, showTip } from '@kit/ui/tooltip';
import { autoBinCount, orderWithinStacks, quantileSorted, stackLayout, typicalDotDiameter, wilkinsonStacks } from './stats';
import { NEUTRAL_CLOUD, assignColours } from '@kit/colours';
import { axisTitle, formatSummary, formatTick } from '@kit/format';
import { computeCloud, drawCloud, drawPeakLabel, subGroups, type CellCloud, type CloudMode } from './cloud';
import { drawEcdf } from './ecdf';
import { drawBox, drawMean, drawPercentilesAndLabels } from './summary';
import type { CellFrame, G, Tip } from './frame';

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
const RIGHT = 12;
const TOP = 4;

let clipSeq = 0;
/**
 * The box gets its own lane between cloud and rain: a gap on each side that grows with the row (Comfortable: at
 * least 6 px, 6% of the row; tighter at Compact and Dense) and a box 7–11 px tall, so it never looks squashed.
 */
export function boxLane(rowH: number, hasBox: boolean, density: Density = 'comfortable'): { boxH: number; gap: number } {
  if (!hasBox) return { boxH: 0, gap: 2 };
  const lg = DENSITY[density].laneGap;
  // Thin rows: a smaller box and at most a 2 px gap floor, so cloud and rain keep some height.
  if (rowH < 48) return { boxH: Math.min(7, Math.max(4, rowH * 0.14)), gap: Math.max(2, rowH * Math.min(0.06, lg.frac)) };
  return { boxH: Math.min(11, Math.max(7, rowH * 0.08)), gap: Math.max(lg.min, rowH * lg.frac) };
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

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

/** Smallest row the layout may use: the density's minimum (Comfortable: the saved one), lower for strip/no rain. */
export function minRowHeight(opts: RaincloudOptions): number {
  const den = DENSITY[opts.density] ?? DENSITY.comfortable;
  const base = opts.density === 'comfortable' ? opts.size.minRowHeight : den.minRow;
  return opts.rain === 'dots' ? base : Math.min(base, opts.rain === 'strip' ? 44 : 36);
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
  // Density: spacing, smallest row, and where tick labels go (see options.DENSITY).
  const density: Density = opts.density in DENSITY ? opts.density : 'comfortable';
  const den = DENSITY[density];
  const CELL_PAD = den.pad; // inner horizontal padding of a cell's plot
  const PANEL_GAP = den.gap; // between column panels and between wrapped block rows

  // Colour tile: dots take member colours; the combined cloud turns neutral so it doesn't clash (F4).
  const palette = grid.colourLevel ? assignColours(grid.colourMembers, opts.colour.assigned[grid.colourLevel] ?? {}) : null;
  // Summary values and ticks follow the field's Tableau number format when it could be inferred (F1).
  const fmt = (v: number) => formatSummary(v, grid.valueFormat, opts.markers.decimals);
  const split = !!palette && opts.colour.splitCloud;
  const each = split && opts.colour.cloudSizing === 'each';
  const cloudColour = palette && !split ? NEUTRAL_CLOUD : opts.color;
  const dotColour = (p: Point) => (palette ? palette.colourOf(p.colour) : opts.color);
  // Box, median and percentiles in text ink; only the mean gets an accent (markers.meanColour).
  const summaryInk = theme.text;
  const legend = palette && opts.colour.showLegend ? legendLayout(grid.colourLevel!, palette, W - 16) : { items: [], height: 0 };

  // Value ranges: one shared range, or one per column (user option).
  const shared = computeDomain(allGroups(grid), opts);
  const domains = grid.cols.map((_, c) =>
    opts.panels.axis === 'independent' && hasCols
      ? computeDomain(grid.cells.map((row) => row[c]).filter((g): g is Group => !!g), opts)
      : shared
  );

  // Row headers: one column per Rows level, capped at 45% of the width. With Rows empty there is no header at all
  // (like a single Tableau pane); it used to show the raw field name, e.g. "SUM(Value)" (user, 2026-11-02).
  const title = (opts.axis.titleMode === 'custom' && opts.axis.title.trim()) || axisTitle(grid.valueName);
  const showTitle = opts.axis.titleMode !== 'hidden';
  let levelW = grid.rowLevels.map((_, k) =>
    Math.min(170, Math.max(36, Math.max(3, ...grid.rows.map((p) => (p[k] ?? '').length)) * 6.6 + 16))
  );
  if (sum(levelW) > W * 0.45) levelW = levelW.map((w) => (w * W * 0.45) / sum(levelW));
  const levelX = levelW.map((_, k) => sum(levelW.slice(0, k)));
  const rowHeaderW = levelW.length ? sum(levelW) + 6 : 4;

  // Wrapping: only with exactly one Columns dimension.
  const canWrap = hasCols && grid.colLevels.length === 1 && nC > 1;
  const perRow = !canWrap ? nC : opts.panels.wrap === 'auto'
    ? autoPerRow(W, rowHeaderW, RIGHT, PANEL_GAP, nC)
    : Math.max(1, Math.min(nC, Math.round(opts.panels.wrap)));
  const wrapped = canWrap && perRow < nC;
  const colHeaderH = !hasCols ? 0 : wrapped ? HEADER_H : HEADER_H * grid.colLevels.length;
  const tickH = hasCols && !den.ticksPerBlock ? TICK_H : 0;
  const footH = hasCols && den.ticksPerBlock ? TICK_H : 0;
  const bottomH = (hasCols ? 0 : 20) + (showTitle ? AXIS_TITLE_H : 0) + 2;

  const geo = computeGrid({
    frameW: W, frameH: H, rowCount: nR, colCount: nC, perRow, rowHeaderW, right: RIGHT, top: TOP + legend.height,
    colHeaderH, tickH, footH, bottomH, gap: hasCols ? PANEL_GAP : 0,
    // Strip/none rain need less room, so rows may be smaller and more fit (user request).
    size: { ...opts.size, minRowHeight: minRowHeight(opts) }
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
  const lane = boxLane(geo.rowH, hasBox, density);
  const boxPos = opts.boxPosition === 'auto' || !opts.boxPosition
    ? ({ comfortable: 'lane', compact: 'baseline', dense: 'inside' } as const)[density] : opts.boxPosition;
  // Rain band: half the row for stacked dots, just a line for a strip, nothing for none. The cloud gets the rest.
  const rainH = opts.rain === 'dots' ? geo.rowH * 0.5 - (lane.boxH / 2 + lane.gap) - 3 : opts.rain === 'strip' ? 12 : 2;
  const maxN = Math.max(1, ...cells.map((cl) => cl.group?.stats.n ?? 0));
  const cloudMode: CloudMode = { split, each, palette, binCount: opts.bins === 'auto' ? autoBinCount(maxN) : opts.bins };
  const clouds = new Map<Cell, CellCloud>();
  for (const cl of cells) if (cl.group?.stats.n) clouds.set(cl, computeCloud(cl.group, cl.domain.vLo, cl.domain.vHi, opts, cloudMode));
  const maxD = Math.max(0, ...[...clouds.values()].map((c) => c.peak));

  // Dots: one size, sized for typical cells; a cell with a big pile compresses its own stacks (dots overlap), so one dot
  // is one record everywhere and one busy cell never shrinks the others (user, 2026-11-02).
  const noDots = { d: 0, step: 0, used: 0 };
  const typicalD = opts.rain === 'dots' ? typicalDotDiameter(cells.map((cl) => cl.pxs), rainH, 7, 1.5) : 0;
  const dotsOf = (cl: Cell) => (opts.rain === 'dots' ? stackLayout(cl.pxs, rainH, typicalD) : noDots);

  // Short stacks (dots at full size) leave the band part-empty: it shrinks to the tallest stack and the cloud gets
  // the room (user, 2026-11-02). Per grid row, not per cell, so boxes and cloud baselines line up across columns.
  const dotLayouts = new Map(cells.map((cl) => [cl, dotsOf(cl)] as const));
  const rowRainH = grid.rows.map((_, r) => Math.max(0, ...cells.filter((cl) => cl.r === r && cl.group?.stats.n).map((cl) => dotLayouts.get(cl)!.used)));
  drawColumnHeaders(svg, grid, geo, wrapped, theme);
  drawRowHeaders(svg, grid, geo, levelX, levelW, theme, RIGHT);

  const cellLabel = (cl: Cell) => [...grid.rows[cl.r], ...grid.cols[cl.c]].filter(Boolean).join(' · ') || title;
  const tipper: Tip = { show: (html, e) => showTip(host, tip, html, e), hide: () => (tip.hidden = true) };
  const showPeakLabels = opts.cloud !== 'none'
    && (opts.scales.cloudLabel === 'on' || (opts.scales.cloudLabel === 'auto' && opts.scales.cloudHeight === 'independent'));

  for (const cl of cells) {
    const { x, x0, y0, w, h, group: g, domain: d } = cl;
    const dots = dotLayouts.get(cl)!;
    const cellRainH = opts.rain === 'dots' ? Math.min(rainH, rowRainH[cl.r] || rainH) : rainH;
    // Box position: own lane (box between cloud and rain), on the cloud's baseline, or inside the cloud on it.
    const laneTop = y0 + h - 3 - cellRainH - lane.gap; // the rain starts below this
    const cloudBase = boxPos === 'lane' ? laneTop - lane.boxH - lane.gap : boxPos === 'baseline' ? laneTop - lane.boxH / 2 : laneTop;
    const base = boxPos === 'lane' ? laneTop - lane.boxH / 2 : boxPos === 'baseline' ? cloudBase : cloudBase - lane.boxH / 2 - 1; // box centre
    const cloudH = cloudBase - y0 - 4;
    const rainTop = laneTop + lane.gap;
    const clipId = `rc-clip-${++clipSeq}`;
    svg.append('clipPath').attr('id', clipId).append('rect').attr('x', x0 + 1).attr('y', y0).attr('width', Math.max(0, w - 2)).attr('height', h);

    // Gridlines (or short tick marks when gridlines are off) and, with Columns, tick labels under every cell.
    // Labels that would overlap are skipped (every k-th is kept); the lines stay on every tick.
    const ticks = axisTicks(x, w - 2 * CELL_PAD, opts.axis.ticks, opts.axis.tickStep);
    const tickStep = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
    const tickText = ticks.map((t) => formatTick(t, grid.valueFormat, tickStep));
    const every = labelEvery(ticks, x, tickText);
    const axisG = svg.append('g');
    axisG.selectAll('line').data(ticks).join('line')
      .attr('x1', (t) => x(t)).attr('x2', (t) => x(t)).attr('y1', opts.axis.gridlines ? y0 : y0 + h - 4).attr('y2', y0 + h)
      .attr('stroke', opts.axis.gridlines ? theme.grid : theme.muted).attr('stroke-width', 1);
    const isLastRow = cl.r === nR - 1;
    if (tickH || isLastRow) {
      axisG.selectAll('text').data(ticks.map((t, i) => ({ t, i })).filter(({ i }) => i % every === 0)).join('text')
        .attr('x', ({ t }) => x(t)).attr('y', y0 + h + (tickH || footH ? 12 : 15)).attr('text-anchor', 'middle')
        .attr('font-size', 10).attr('fill', theme.muted).style('font-variant-numeric', 'tabular-nums')
        .text(({ i }) => tickText[i]);
    }

    const L: G = svg.append('g').attr('clip-path', `url(#${clipId})`).attr('data-rain-bottom', y0 + h - 3);
    if (!g || g.stats.n === 0) {
      L.append('text').attr('x', x0 + w / 2).attr('y', base + 4).attr('text-anchor', 'middle').attr('font-size', 11)
        .attr('fill', theme.muted).text(g?.stats.missing ? `no values · ${g.stats.missing} missing` : 'no values');
      continue;
    }
    const f: CellFrame = { L, x, x0, y0, w, h, cloudBase, base, boxH: lane.boxH };

    // n in the cell's top-right corner (top-left holds the cloud's peak label); dropped in thin rows. With the ECDF on
    // it sits a little lower, under the line's flat 100% stretch, which runs along the top to the right edge.
    const showN = h >= 36;
    const nText = `n = ${g.stats.n.toLocaleString()}${g.stats.missing ? ` · ${g.stats.missing} missing` : ''}`;
    const nY = y0 + (opts.ecdf ? 15 : 11);
    if (showN) L.append('text').attr('x', x0 + w - 4).attr('y', nY).attr('text-anchor', 'end').attr('font-size', 10).attr('fill', theme.muted)
      .attr('stroke', theme.surface).attr('stroke-width', 3).attr('paint-order', 'stroke').text(nText);

    if (d.truncated) {
      for (const edge of [d.vLo, d.vHi]) {
        L.append('line').attr('x1', x(edge)).attr('x2', x(edge)).attr('y1', y0).attr('y2', y0 + h)
          .attr('stroke', theme.muted).attr('stroke-dasharray', '3 3');
      }
    }

    // Cloud: height scaled per cell (fit each chart) or across all cells (shared)
    const cloud = clouds.get(cl)!;
    const hs = scaleLinear().domain([0, (opts.scales.cloudHeight === 'independent' ? cloud.peak : maxD) || 1]).range([0, cloudH]);
    drawCloud(f, g, cloud, hs, cloudMode, cloudColour, opts, theme);

    // ECDF: follows the cloud, one line per colour when the cloud is split, else one combined line (user, 2026-11-02).
    if (opts.ecdf) {
      drawEcdf(f, svg.node()!, split ? subGroups(g, palette!) : [{ colour: theme.text, values: g.values }], {
        vLo: d.vLo, vHi: d.vHi, perColour: split, nLabel: showN ? { y: nY, width: nText.length * 5.6 } : null, title: esc(cellLabel(cl)), fmt
      }, theme, tipper);
    }

    if (showPeakLabels && cloud.peak > 0 && cloudH >= 14 && (cloud.dens?.length || cloud.hist)) {
      drawPeakLabel(f, g, cloud, hs, each, tickStep, grid.valueFormat, theme);
    }

    // Summary: box, mean, percentile ticks and value labels
    if (hasBox) {
      const s = g.stats;
      drawBox(f, g, summaryInk, boxPos === 'lane', theme, tipper,
        `<b>${esc(cellLabel(cl))}</b><br>median ${fmt(s.median)} · mean ${fmt(s.mean)}<br>IQR ${fmt(s.q1)} – ${fmt(s.q3)}<br>whiskers ${fmt(s.whiskerLow)} – ${fmt(s.whiskerHigh)} (1.5 × IQR)<br>n ${s.n}${s.missing ? ` · ${s.missing} missing` : ''}`);
    }
    if (opts.markers.mean) {
      drawMean(f, g, opts.markers, opts.markers.meanColour === 'mark' ? opts.color : opts.markers.meanColour || summaryInk, hasBox, theme);
    }
    drawPercentilesAndLabels(f, g, opts.markers, hasBox, summaryInk, fmt, theme);

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
      // Overlapping (compressed) stacks get more transparency, so crowding reads as darker density; dots ≥ 3 px get a
      // thin ring in the surface colour so touching dots stay separate records (user, 2026-11-02).
      const r = Math.max(0.4, (dots.d / 2) * 0.9);
      const dotsG = L.selectAll(null).data(cl.visible).join('circle').attr('class', 'rc-dot')
        .attr('cx', (_, k) => stacks[k].x).attr('cy', (_, k) => rainTop + dots.d / 2 + stacks[k].k * dots.step)
        .attr('r', r).attr('fill', dotColour).attr('data-base-opacity', dots.step < 2 * r ? 0.65 : 0.85);
      if (2 * r >= 3) dotsG.attr('stroke', theme.surface).attr('stroke-width', Math.min(1, r * 0.25));
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

  // Axis title once, centred under the plot area (Tableau's axis title equivalent); custom text or the field name.
  if (showTitle) {
    svg.append('text').attr('class', 'rc-axis-title')
      .attr('x', (rowHeaderW + geo.width - RIGHT) / 2).attr('y', geo.height - 6).attr('text-anchor', 'middle')
      .attr('font-size', 11).attr('font-weight', 600).attr('fill', theme.text).text(title);
  }

  drawCutBadge(host, cutOpts, countOutside(grid, cutOpts), showAll);

  styleSelection(host, selected);
  return { colourField: grid.colourLevel, colourAssignments: palette?.assigned ?? null };
}



/** Re-styles marks for the current selection without redrawing. */
export function styleSelection(host: HTMLElement, selected: Set<number>): void {
  const any = selected.size > 0;
  select(host).selectAll<SVGCircleElement, Point>('circle.rc-dot').attr('fill-opacity', function (d) {
    const base = Number(this.getAttribute('data-base-opacity')) || (this.classList.contains('rc-strip') ? 0.35 : 0.85);
    return !any ? base : selected.has(d.tupleId) ? 1 : 0.15;
  });
}

