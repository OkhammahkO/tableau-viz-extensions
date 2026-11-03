import { select } from 'd3-selection';
import { scaleLinear, type ScaleLinear } from 'd3-scale';
import type { Palette } from '@kit/colours';
import { formatSummary, formatTick, type NumberFormat } from '@kit/format';
import type { RenderTheme } from '@kit/theme';
import { esc, showTip } from '@kit/ui/tooltip';
import { MEAN, formatR } from './cells';
import { NOT_CAUSE, readPair } from './interpret';
import type { Matrix, MatrixRecord } from './model';
import { markerDecimals, type CorrOptions } from './options';
import { binCounts, boxStats, completePairs, leastSquares, mean, paddedExtent, pairStats, quantile, type BoxStats } from './stats';

// Focus view (user, 2026-11-02/03): one pair, large, over the matrix. The scatter with its trend line and 95%
// confidence band (and, with a Colour field, a dashed line per group), each measure's histogram along its edge with a
// box plot beside it (split by colour like the diagonal), the pair's numbers, and a plain-language reading below.
// Opened by clicking a coefficient, the ⤢ on a hovered scatter, or double-clicking a scatter; closed with × or Esc.
// Hover, selection and brushing work as in the matrix (user, 2026-11-03): drag a rectangle in the scatter, hover or
// click a marginal histogram bar. Small hosts (the hover preview) drop the reading and shrink the margins.

export interface FocusHandlers {
  onHover(record: MatrixRecord | undefined, anchor: { x: number; y: number }, event: PointerEvent): void;
  onSelect(tupleIds: number[], additive: boolean, anchor: { x: number; y: number }): void;
  onClose(): void;
}

/** Draws the focus panel over `host` for measures a (across) and b (up). */
export function renderFocus(host: HTMLElement, m: Matrix, a: number, b: number, opts: CorrOptions, palette: Palette | null,
  theme: RenderTheme, selected: Set<number>, handlers: FocusHandlers, domains?: [[number, number], [number, number]]): void {
  const W = Math.max(240, host.clientWidth);
  const H = Math.max(200, host.clientHeight);
  // The hover preview and a small sheet get the same view, smaller: only the reading in words is left out.
  const compact = W < 420 || H < 380;
  const panel = document.createElement('div');
  panel.className = 'cm-focus';
  panel.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;background:${theme.surface};z-index:4;overflow:hidden`;
  host.append(panel);

  const colour = opts.color;
  const s = pairStats(m.columns[a], m.columns[b]);
  const [va, vb] = completePairs(m.columns[a], m.columns[b]);
  const fit = leastSquares(va, vb);

  // Per colour member (legend order): values for split marginals and group lines.
  const members = palette ? palette.legend.map((l) => {
    const recs = m.records.filter((r) => palette.keyOf(r.colour) === l.key);
    const [xa, xb] = completePairs(recs.map((r) => r.values[a]), recs.map((r) => r.values[b]));
    return { label: l.label, colour: l.colour, xa, xb, fit: leastSquares(xa, xb), r: pairStats(xa, xb) };
  }).filter((g) => g.xa.length) : [];
  const split = members.length >= 2 && members.length <= 8;

  // The reading in words (as in the coefficient tooltip, plus the standing reminder).
  const reading = readPair(m.names[a], m.names[b], s, opts.coefficient,
    members.map((g) => ({ label: g.label, r: opts.coefficient === 'spearman' ? g.r.spearman : g.r.pearson, n: g.r.n })));
  const footerLines = compact ? [] : [reading.headline, ...(reading.explained ? [reading.explained] : []), ...reading.caveats.map((c) => `⚠ ${c}`), NOT_CAUSE];
  // The reading goes below the chart (HTML, so it wraps). It's built first and measured, because a wrapped caveat made
  // it taller than one line per item and it ran into the x-axis title.
  const foot = footerLines.length ? document.createElement('div') : null;
  if (foot) {
    foot.className = 'cm-focus-reading';
    foot.style.cssText = `position:absolute;left:10px;right:10px;bottom:8px;font:12px/1.35 ${theme.fontFamily};color:${theme.text}`;
    footerLines.forEach((t, k) => {
      const p = document.createElement('p');
      const warn = t.startsWith('⚠');
      const last = k === footerLines.length - 1;
      p.style.cssText = `margin:0 0 2px;${warn ? 'color:#8a5a00' : last ? `color:${theme.muted};font-size:11px` : k === 0 ? 'font-weight:600' : ''}`;
      p.textContent = t;
      foot.append(p);
    });
    panel.append(foot);
  }
  /** The reading's height with its sides at `inset` px (an estimate where nothing is laid out, e.g. a test DOM). */
  const footHeight = (inset: number) => {
    if (!foot) return 0;
    foot.style.left = `${inset}px`;
    foot.style.right = `${inset}px`;
    return (foot.offsetHeight || footerLines.length * 16) + 14;
  };

  // Layout: heading, top marginal (histogram + box), plot, right marginal (box + histogram), axis labels, reading.
  // Two header lines: the title, then the numbers below it with room between (they overlapped at 11 px apart).
  const head = compact ? 34 : 44;
  // Marginal histogram depth: about 16% of the panel, 70–110 px (user, 2026-11-03: "even bigger"); slim in the preview.
  const histH = compact ? Math.round(Math.max(34, Math.min(W, H) * 0.16)) : Math.round(Math.max(70, Math.min(110, Math.min(W, H) * 0.16)));
  const boxW = compact ? 10 : 12; // box strip between the histogram and the plot
  const margin = histH + boxW + 4;
  const bottom = 34;
  // The plot is square: in a wide panel, centre the whole block rather than leave the spare width on the right. The
  // reading lines up with the block, so its height depends on the plot's size: settle it in a couple of rounds.
  const sizeFor = (footH: number) => {
    const p = Math.max(110, Math.min(W - 50 - margin - 12, H - head - margin - bottom - footH));
    return { P: p, dx: Math.max(0, Math.floor((W - (50 + p + margin + 12)) / 2)) };
  };
  let footerH = footHeight(10);
  let { P, dx } = sizeFor(footerH);
  for (let round = 0; round < 2; round++) {
    const h = footHeight(10 + dx);
    if (h <= footerH) break;
    footerH = h;
    ({ P, dx } = sizeFor(footerH));
  }
  footHeight(10 + dx);
  const left = 50 + dx;
  const x0 = left;
  const y0 = head + margin;
  const x = scaleLinear().domain(domains?.[0] ?? paddedExtent(m.columns[a])).range([x0, x0 + P]);
  const y = scaleLinear().domain(domains?.[1] ?? paddedExtent(m.columns[b])).range([y0 + P, y0]);
  const svg = select(panel).append('svg').attr('width', W).attr('height', H - footerH).style('font-family', theme.fontFamily).style('display', 'block');

  // Heading: the pair and its numbers; the close button sits top right.
  svg.append('text').attr('x', 10 + dx).attr('y', compact ? 14 : 18).attr('font-size', compact ? 12 : 13).attr('font-weight', 600).attr('fill', theme.text)
    .text(`${m.names[b]} vs ${m.names[a]}`);
  const facts = [`r ${formatR(s.pearson)}`, `ρ ${formatR(s.spearman)}`, `n ${s.n.toLocaleString()}`];
  svg.append('text').attr('class', 'cm-focus-facts').attr('x', 10 + dx).attr('y', compact ? 29 : 35).attr('font-size', 11)
    .attr('fill', theme.muted).text(facts.join('  ·  '));
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'cm-focus-close';
  close.textContent = '×';
  close.title = 'Back to the matrix (Esc)';
  close.setAttribute('aria-label', 'Close the focus view');
  close.addEventListener('click', (e) => { e.stopPropagation(); handlers.onClose(); });
  panel.append(close);

  const clipId = `cm-focus-clip-${Math.random().toString(36).slice(2, 7)}`;
  svg.append('clipPath').attr('id', clipId).append('rect').attr('x', x0).attr('y', y0).attr('width', P).attr('height', P);
  svg.append('rect').attr('x', x0).attr('y', y0).attr('width', P).attr('height', P).attr('fill', theme.grid).attr('fill-opacity', 0.35);

  // Marginals: histogram along each edge (split by colour like the diagonal), box plot between it and the plot.
  const bins = compact ? 20 : 30;
  const values = (j: number) => m.columns[j].filter((v): v is number => v !== null);
  const chosen = (j: number) => (selected.size ? m.records.filter((r) => selected.has(r.tupleId) && r.values[j] !== null).map((r) => r.values[j]!) : []);
  drawMarginal(svg, 'x', x, values(a), split ? members.map((g) => ({ colour: g.colour, vals: g.xa })) : [], bins, colour,
    { at: y0 - boxW - 4, depth: histH }, theme, chosen(a), m.names[a], m.formats[a]);
  drawMarginal(svg, 'y', y, values(b), split ? members.map((g) => ({ colour: g.colour, vals: g.xb })) : [], bins, colour,
    { at: x0 + P + boxW + 4, depth: histH }, theme, chosen(b), m.names[b], m.formats[b]);
  // Boxes with the raincloud's markers; values labelled in the full view (over the histograms, haloed).
  const labels = opts.markers.showValues && !compact;
  const [decA, decB] = [markerDecimals(opts, m.formats[a], values(a)), markerDecimals(opts, m.formats[b], values(b))];
  drawBox(svg, 'x', x, boxStats(values(a)), y0 - boxW / 2 - 2, theme, values(a), opts.markers, labels, (v) => formatSummary(v, m.formats[a], decA));
  drawBox(svg, 'y', y, boxStats(values(b)), x0 + P + boxW / 2 + 2, theme, values(b), opts.markers, labels, (v) => formatSummary(v, m.formats[b], decB));

  const L = svg.append('g').attr('clip-path', `url(#${clipId})`);
  // Trend line with its 95% confidence band (the band shows how sure the line is, not where points fall).
  if (fit && va.length > 2) {
    const n = va.length;
    const mx = va.reduce((t, v) => t + v, 0) / n;
    const sxx = va.reduce((t, v) => t + (v - mx) ** 2, 0);
    const resid = Math.sqrt(va.reduce((t, v, k) => t + (vb[k] - (fit.intercept + fit.slope * v)) ** 2, 0) / (n - 2));
    const [lo, hi] = x.domain();
    const xsBand = Array.from({ length: 40 }, (_, k) => lo + ((hi - lo) * k) / 39);
    const half = (xv: number) => 1.96 * resid * Math.sqrt(1 / n + (xv - mx) ** 2 / sxx);
    const upper = xsBand.map((xv) => `${x(xv)},${y(fit.intercept + fit.slope * xv + half(xv))}`);
    const lower = xsBand.map((xv) => `${x(xv)},${y(fit.intercept + fit.slope * xv - half(xv))}`).reverse();
    L.append('path').attr('class', 'cm-focus-band').attr('d', `M${upper.join('L')}L${lower.join('L')}Z`)
      .attr('fill', theme.text).attr('fill-opacity', 0.08).style('pointer-events', 'none');
  }

  // Points
  const [xl, xh] = x.domain();
  const [yl, yh] = y.domain();
  const any = selected.size > 0;
  const pts = m.records.filter((r) => r.values[a] !== null && r.values[b] !== null
    && r.values[a]! >= xl && r.values[a]! <= xh && r.values[b]! >= yl && r.values[b]! <= yh);
  const alpha = pts.length <= 300 ? 0.6 : Math.max(0.12, 0.6 * Math.sqrt(300 / pts.length));
  const restingOpacity = (r: MatrixRecord) => (!any ? alpha : selected.has(r.tupleId) ? 0.95 : alpha * 0.25);
  const points = L.selectAll<SVGCircleElement, MatrixRecord>('circle').data(pts).join('circle').attr('class', 'cm-focus-pt')
    .attr('cx', (r) => x(r.values[a]!)).attr('cy', (r) => y(r.values[b]!)).attr('r', compact ? 2 : 2.6)
    .attr('fill', (r) => (palette ? palette.colourOf(r.colour) : colour))
    .attr('fill-opacity', restingOpacity)
    .style('cursor', 'pointer')
    // A point's tooltip is Tableau's own (via onHover), as in the matrix; a second, custom one overlapped it.
    .on('pointermove', (e: PointerEvent, r) => handlers.onHover(r, { x: e.pageX, y: e.pageY }, e))
    .on('pointerleave', (e: PointerEvent) => handlers.onHover(undefined, { x: e.pageX, y: e.pageY }, e))
    .on('click', (e: MouseEvent, r) => { e.stopPropagation(); handlers.onSelect([r.tupleId], e.ctrlKey || e.metaKey, { x: e.pageX, y: e.pageY }); });

  // Lines over the points: overall (solid) and one per colour group (dashed, its colour).
  const line = (f: { slope: number; intercept: number }, cls: string, stroke: string, dashed: boolean, width: number) =>
    L.append('line').attr('class', cls).attr('x1', x(xl)).attr('y1', y(f.intercept + f.slope * xl)).attr('x2', x(xh)).attr('y2', y(f.intercept + f.slope * xh))
      .attr('stroke', stroke).attr('stroke-width', width).attr('stroke-dasharray', dashed ? '5 3' : null).style('pointer-events', 'none');
  if (split) for (const g of members) if (g.fit && g.xa.length >= 5) line(g.fit, 'cm-focus-group-line', g.colour, true, 1.6);
  if (fit) line(fit, 'cm-focus-trend', theme.text, false, 1.4).attr('stroke-opacity', 0.7);

  // Direct labels at the lines' right ends (inside the plot, haloed): the overall line's formula and R², each group
  // line's r in its colour. Placed top-down and nudged apart so none overlap (user, 2026-11-03).
  const tags: { y: number; text: string; colour: string; cls: string }[] = [];
  const endY = (f: { slope: number; intercept: number }) => y(f.intercept + f.slope * xh);
  if (fit && !Number.isNaN(s.pearson)) {
    const sig = (v: number) => String(Number(Math.abs(v).toPrecision(compact ? 2 : 3)));
    const eq = `y = ${fit.slope < 0 ? '−' : ''}${sig(fit.slope)}x ${fit.intercept < 0 ? '−' : '+'} ${sig(fit.intercept)}`;
    tags.push({ y: endY(fit), text: compact ? `R² ${formatR(s.pearson ** 2)}` : `R² ${formatR(s.pearson ** 2)} · ${eq}`, colour: theme.text, cls: 'cm-focus-line-label' });
  }
  if (split && !compact) {
    for (const g of members) {
      if (!g.fit || g.xa.length < 5) continue;
      const r = opts.coefficient === 'spearman' ? g.r.spearman : g.r.pearson;
      tags.push({ y: endY(g.fit), text: `${g.label} ${opts.coefficient === 'spearman' ? 'ρ' : 'r'} ${formatR(r)}`, colour: g.colour, cls: 'cm-focus-group-label' });
    }
  }
  tags.sort((t1, t2) => t1.y - t2.y);
  let lastY = -Infinity;
  for (const tg of tags) {
    const ty = Math.min(y0 + P - 4, Math.max(y0 + 12, tg.y - 5, lastY + 12));
    lastY = ty;
    L.append('text').attr('class', tg.cls).attr('x', x0 + P - 4).attr('y', ty).attr('text-anchor', 'end').attr('font-size', compact ? 9.5 : 10.5)
      .attr('font-weight', 600).attr('fill', tg.colour).attr('stroke', theme.surface).attr('stroke-width', 3).attr('paint-order', 'stroke')
      .style('font-variant-numeric', 'tabular-nums').style('pointer-events', 'none').text(tg.text);
  }

  // Axes
  const tx = x.ticks(compact ? 4 : 6);
  const ty = y.ticks(compact ? 4 : 6);
  svg.append('g').selectAll('text').data(tx).join('text').attr('x', (t) => x(t)).attr('y', y0 + P + 14).attr('text-anchor', 'middle')
    .attr('font-size', 10).attr('fill', theme.muted).text((t) => formatTick(t, m.formats[a], tx[1] - tx[0] || 1));
  svg.append('g').selectAll('text').data(ty).join('text').attr('x', x0 - 5).attr('y', (t) => y(t) + 3).attr('text-anchor', 'end')
    .attr('font-size', 10).attr('fill', theme.muted).text((t) => formatTick(t, m.formats[b], ty[1] - ty[0] || 1));
  svg.append('text').attr('x', x0 + P / 2).attr('y', y0 + P + 28).attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', 600).attr('fill', theme.text).text(m.names[a]);
  svg.append('text').attr('transform', `translate(${12 + dx} ${y0 + P / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', 600).attr('fill', theme.text).text(m.names[b]);

  // Emphasis while brushing or hovering a histogram bar: the records it picks out solid, the rest faded.
  const emphasise = (pick: ((r: MatrixRecord) => boolean) | null) =>
    points.attr('fill-opacity', (r) => (pick ? (pick(r) ? 0.95 : alpha * 0.25) : restingOpacity(r)));
  const tip = document.createElement('div');
  tip.className = 'cm-tip';
  tip.hidden = true;
  panel.append(tip);
  const node = svg.node()!;
  const local = (e: PointerEvent | MouseEvent) => {
    const r = node.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  const clampX = (v: number) => Math.max(x0, Math.min(x0 + P, v));
  const clampY = (v: number) => Math.max(y0, Math.min(y0 + P, v));
  const inRect = (x1: number, x2: number, y1: number, y2: number) => {
    const [vx1, vx2] = [x.invert(Math.min(x1, x2)), x.invert(Math.max(x1, x2))];
    const [vy1, vy2] = [y.invert(Math.max(y1, y2)), y.invert(Math.min(y1, y2))];
    return (r: MatrixRecord) => r.values[a]! >= vx1 && r.values[a]! <= vx2 && r.values[b]! >= vy1 && r.values[b]! <= vy2;
  };
  /** A marginal bar's records: the measure's value in the bin (the top bin includes its upper edge). */
  const binPick = (el: Element) => {
    const [axis, lo, hi, last] = el.getAttribute('data-bin')!.split('|');
    const j = axis === 'x' ? a : b;
    return (r: MatrixRecord) => {
      const v = r.values[j];
      return v !== null && v >= Number(lo) && (last === '1' ? v <= Number(hi) : v < Number(hi));
    };
  };
  const brushLayer = svg.append('g');
  let brush: { x: number; y: number; moved: boolean; pick?: (r: MatrixRecord) => boolean } | undefined;
  let suppressClick = false; // the click that ends a brush drag selects nothing more (and doesn't open the preview)
  panel.addEventListener('click', (e) => { if (suppressClick) { suppressClick = false; e.stopPropagation(); } }, true);
  svg.on('pointerdown', (e: PointerEvent) => {
    const [px, py] = local(e);
    if (e.button !== 0 || px < x0 || px > x0 + P || py < y0 || py > y0 + P) return;
    brush = { x: px, y: py, moved: false };
    node.setPointerCapture?.(e.pointerId);
  });
  svg.on('pointermove.focus', (e: PointerEvent) => {
    if (brush) {
      const [px, py] = local(e);
      const [x2, y2] = [clampX(px), clampY(py)];
      if (!brush.moved && Math.abs(x2 - brush.x) < 4 && Math.abs(y2 - brush.y) < 4) return;
      brush.moved = true;
      brush.pick = inRect(brush.x, x2, brush.y, y2);
      brushLayer.selectAll('*').remove();
      brushLayer.append('rect').attr('class', 'cm-brush').attr('x', Math.min(brush.x, x2)).attr('y', Math.min(brush.y, y2))
        .attr('width', Math.abs(x2 - brush.x)).attr('height', Math.abs(y2 - brush.y))
        .attr('fill', '#f28e2b').attr('fill-opacity', 0.08).attr('stroke', '#f28e2b').attr('stroke-dasharray', '3 2').style('pointer-events', 'none');
      emphasise(brush.pick);
      return;
    }
    const bin = (e.target as Element).closest?.('.cm-focus-bin');
    if (bin) {
      emphasise(binPick(bin));
      showTip(panel, tip, bin.getAttribute('data-tip')!, e);
    } else if (!tip.hidden) {
      emphasise(null);
      tip.hidden = true;
    }
  });
  svg.on('pointerup', (e: PointerEvent) => {
    const b0 = brush;
    brush = undefined;
    brushLayer.selectAll('*').remove();
    if (!b0?.moved || !b0.pick) return;
    suppressClick = true;
    handlers.onSelect(pts.filter(b0.pick).map((r) => r.tupleId), e.ctrlKey || e.metaKey, { x: e.pageX, y: e.pageY });
  });
  svg.on('pointerleave', () => { if (!brush) { emphasise(null); tip.hidden = true; } });
  // Click: a marginal bar selects its records; empty space clears the selection, as in the matrix.
  svg.on('click', (e: MouseEvent) => {
    const bin = (e.target as Element).closest?.('.cm-focus-bin');
    const ids = bin ? m.records.filter(binPick(bin)).map((r) => r.tupleId) : [];
    handlers.onSelect(ids, e.ctrlKey || e.metaKey, { x: e.pageX, y: e.pageY });
  });

}

type Svg = ReturnType<typeof select<SVGSVGElement, unknown>>;

/**
 * A marginal histogram along the top (axis 'x') or the right (axis 'y'): bars growing away from the plot, or one
 * outline per colour member (each its own 100%), as on the diagonal. `at` is the edge nearest the plot.
 */
function drawMarginal(svg: Svg, axis: 'x' | 'y', scale: ScaleLinear<number, number>, values: number[],
  groups: { colour: string; vals: number[] }[], bins: number, colour: string, place: { at: number; depth: number }, theme: RenderTheme,
  chosen: number[] = [], name = '', fmt: NumberFormat | null = null): void {
  const [lo, hi] = scale.domain();
  const [r0, r1] = scale.range();
  const span = Math.abs(r1 - r0) / bins;
  const start = Math.min(r0, r1);
  // Position along the axis for bin k (y runs bottom-up, so its bins are flipped).
  const along = (k: number) => (axis === 'x' ? start + k * span : start + (bins - k - 1) * span);
  const g = svg.append('g').attr('class', 'cm-focus-hist');
  if (!groups.length) {
    const counts = binCounts(values, lo, hi, bins);
    const top = Math.max(1, ...counts);
    counts.forEach((n, k) => {
      if (!n) return;
      const d = (n / top) * place.depth;
      if (axis === 'x') g.append('rect').attr('x', along(k) + 0.5).attr('width', Math.max(0.5, span - 1)).attr('y', place.at - d).attr('height', d).attr('fill', colour).attr('fill-opacity', 0.5);
      else g.append('rect').attr('y', along(k) + 0.5).attr('height', Math.max(0.5, span - 1)).attr('x', place.at).attr('width', d).attr('fill', colour).attr('fill-opacity', 0.5);
    });
  } else {
    const shares = groups.map((gr) => binCounts(gr.vals, lo, hi, bins).map((c) => c / Math.max(1, gr.vals.length)));
    const top = Math.max(1e-9, ...shares.flat());
    groups.forEach((gr, i) => {
      let d = axis === 'x' ? `M${start},${place.at}` : `M${place.at},${start + bins * span}`;
      shares[i].forEach((sh, k) => {
        const depth = (sh / top) * place.depth;
        if (axis === 'x') d += `L${along(k)},${place.at - depth}L${along(k) + span},${place.at - depth}`;
        else d += `L${place.at + depth},${along(k) + span}L${place.at + depth},${along(k)}`;
      });
      d += axis === 'x' ? `L${start + bins * span},${place.at}Z` : `L${place.at},${start}Z`;
      g.append('path').attr('d', d).attr('fill', gr.colour).attr('fill-opacity', 0.12).attr('stroke', gr.colour).attr('stroke-width', 1.2).attr('stroke-linejoin', 'round');
    });
  }
  // The selection over the bars, on the combined scale (as on the matrix's diagonal).
  const counts = binCounts(values, lo, hi, bins);
  const top = Math.max(1, ...counts);
  if (chosen.length) {
    binCounts(chosen, lo, hi, bins).forEach((n, k) => {
      if (!n) return;
      const d = (n / top) * place.depth;
      const bar = g.append('rect').attr('class', 'cm-focus-bin-sel').attr('fill', colour).attr('fill-opacity', 0.9).style('pointer-events', 'none');
      if (axis === 'x') bar.attr('x', along(k) + 0.5).attr('width', Math.max(0.5, span - 1)).attr('y', place.at - d).attr('height', d);
      else bar.attr('y', along(k) + 0.5).attr('height', Math.max(0.5, span - 1)).attr('x', place.at).attr('width', d);
    });
  }
  // Hit areas, one per bin over the full depth: hover lights its records up in the scatter, click selects them.
  const w = (hi - lo) / bins;
  counts.forEach((n, k) => {
    if (!n) return;
    const b0 = lo + k * w;
    const b1 = b0 + w;
    const hit = g.append('rect').attr('class', 'cm-focus-bin').attr('fill', 'transparent').style('cursor', 'pointer')
      .attr('data-bin', `${axis}|${b0}|${b1}|${k === bins - 1 ? 1 : 0}`)
      .attr('data-tip', `<b>${esc(name)}</b> ${esc(formatTick(b0, fmt, w))} – ${esc(formatTick(b1, fmt, w))}<br>${n.toLocaleString()} records<br><span style="color:${theme.muted}">click to select them</span>`);
    if (axis === 'x') hit.attr('x', along(k)).attr('width', span).attr('y', place.at - place.depth).attr('height', place.depth);
    else hit.attr('y', along(k)).attr('height', span).attr('x', place.at).attr('width', place.depth);
  });
  // Baseline on the plot side
  if (axis === 'x') g.append('line').attr('x1', start).attr('x2', start + bins * span).attr('y1', place.at).attr('y2', place.at).attr('stroke', theme.muted).attr('stroke-width', 0.8);
  else g.append('line').attr('y1', start).attr('y2', start + bins * span).attr('x1', place.at).attr('x2', place.at).attr('stroke', theme.muted).attr('stroke-width', 0.8);
}

/**
 * A slim box plot along an axis, centred on `mid` across it (horizontal for x, vertical for y), with the raincloud's
 * markers: an orange hollow mean circle and dashed percentile ticks; with `labels`, the median, mean and percentile
 * values beside them (above the box for x, right of it for y), nudged apart so they never overlap.
 */
function drawBox(svg: Svg, axis: 'x' | 'y', scale: ScaleLinear<number, number>, box: BoxStats | null, mid: number, theme: RenderTheme,
  values: number[], markers: CorrOptions['markers'], labels: boolean, fmt: (v: number) => string): void {
  if (!box) return;
  const g = svg.append('g').attr('class', 'cm-focus-box');
  const t = 7;
  const [p1, p3, pm, pl, ph] = [scale(box.q1), scale(box.q3), scale(box.median), scale(box.lo), scale(box.hi)];
  if (axis === 'x') {
    g.append('line').attr('x1', pl).attr('x2', ph).attr('y1', mid).attr('y2', mid).attr('stroke', theme.text);
    g.append('rect').attr('x', Math.min(p1, p3)).attr('width', Math.max(1, Math.abs(p3 - p1))).attr('y', mid - t / 2).attr('height', t).attr('rx', 1)
      .attr('fill', theme.surface).attr('stroke', theme.text);
    g.append('line').attr('x1', pm).attr('x2', pm).attr('y1', mid - t / 2).attr('y2', mid + t / 2).attr('stroke', theme.text).attr('stroke-width', 2);
  } else {
    g.append('line').attr('y1', pl).attr('y2', ph).attr('x1', mid).attr('x2', mid).attr('stroke', theme.text);
    g.append('rect').attr('y', Math.min(p1, p3)).attr('height', Math.max(1, Math.abs(p3 - p1))).attr('x', mid - t / 2).attr('width', t).attr('rx', 1)
      .attr('fill', theme.surface).attr('stroke', theme.text);
    g.append('line').attr('y1', pm).attr('y2', pm).attr('x1', mid - t / 2).attr('x2', mid + t / 2).attr('stroke', theme.text).attr('stroke-width', 2);
  }
  const [d0, d1] = scale.domain();
  const inside = (v: number) => v >= Math.min(d0, d1) && v <= Math.max(d0, d1);
  const items: { v: number; text: string }[] = [{ v: box.median, text: `Median ${fmt(box.median)}` }];
  for (const pc of markers.percentiles) {
    const q = quantile(values, pc / 100);
    if (!inside(q)) continue;
    const p = scale(q);
    if (axis === 'x') g.append('line').attr('class', 'cm-focus-pct').attr('x1', p).attr('x2', p).attr('y1', mid - t / 2 - 3).attr('y2', mid + t / 2 + 3)
      .attr('stroke', theme.text).attr('stroke-dasharray', '2 1.5');
    else g.append('line').attr('class', 'cm-focus-pct').attr('y1', p).attr('y2', p).attr('x1', mid - t / 2 - 3).attr('x2', mid + t / 2 + 3)
      .attr('stroke', theme.text).attr('stroke-dasharray', '2 1.5');
    items.push({ v: q, text: `P${pc} ${fmt(q)}` });
  }
  const avg = mean(values);
  if (markers.mean && inside(avg)) {
    g.append('circle').attr('class', 'cm-focus-mean').attr(axis === 'x' ? 'cx' : 'cy', scale(avg)).attr(axis === 'x' ? 'cy' : 'cx', mid).attr('r', 3.4)
      .attr('fill', 'none').attr('stroke', MEAN).attr('stroke-width', 1.5);
    items.push({ v: avg, text: `Mean ${fmt(avg)}` });
  }
  if (!labels) return;
  // Place labels in order along the axis; one that would overlap the previous moves on (x: up a row; y: down a line).
  const sorted = items.map((it) => ({ ...it, p: scale(it.v) })).sort((p1, p2) => p1.p - p2.p);
  const label = (lx: number, ly: number, anchor: string, text: string) => g.append('text').attr('class', 'cm-focus-label')
    .attr('x', lx).attr('y', ly).attr('text-anchor', anchor).attr('font-size', 9.5).attr('fill', theme.muted)
    .attr('stroke', theme.surface).attr('stroke-width', 3).attr('paint-order', 'stroke').style('font-variant-numeric', 'tabular-nums').text(text);
  if (axis === 'x') {
    const rowsEnd: number[] = [];
    for (const it of sorted) {
      const w = it.text.length * 5.4 + 6;
      let row = 0;
      while (row < 2 && rowsEnd[row] !== undefined && rowsEnd[row] > it.p - w / 2) row++;
      rowsEnd[row] = it.p + w / 2;
      label(it.p, mid - t / 2 - 5 - row * 11, 'middle', it.text);
    }
  } else {
    let last = -Infinity;
    for (const it of sorted) { // pixel order is top first: walk down, nudging a crowded label below the previous one
      const ly = Math.max(it.p + 3, last + 11);
      last = ly;
      label(mid + t / 2 + 5, ly, 'start', it.text);
    }
  }
}
