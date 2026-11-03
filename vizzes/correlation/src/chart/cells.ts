import type { Palette } from '@kit/colours';
import { formatTick } from '@kit/format';
import { fitText } from '@kit/grid/headers';
import type { RenderTheme } from '@kit/theme';
import { esc } from '@kit/ui/tooltip';
import type { Cell, G } from './geometry';
import type { Matrix } from './model';
import { markerDecimals, type CorrOptions } from './options';
import { formatSummary } from '@kit/format';
import { bandwidthOf, kde } from '@kit/stats';
import { binCounts, boxStats, mean, quantile, type PairStats } from './stats';

// The matrix's cells: each measure's histogram on the diagonal (split by colour, with its box), the coefficient
// above it, and density cells for big data below it. Points are drawn separately (points.ts).

const POS = '#2166ac'; // positive correlation (blue)
const NEG = '#b2182b'; // negative correlation (red)
/** The mean marker: a hollow orange circle, as in the raincloud. */
export const MEAN = '#f28e2b';

/** "-0.28" → "−.28": no leading zero, a true minus sign. */
export const formatR = (r: number): string => (Number.isNaN(r) ? '—' : `${r < 0 ? '−' : ''}${Math.abs(r).toFixed(2).replace(/^0/, '')}`);

/** Colour for a coefficient: grey near zero, blue positive, red negative. */
export const toneOf = (r: number, muted: string): string => (Number.isNaN(r) || Math.abs(r) < 0.1 ? muted : r > 0 ? POS : NEG);

/** Diagonal: the measure's histogram, with its name (which labels the row and the column). */
export function drawDiagonal(g: G, c: Cell, m: Matrix, cell: number, opts: CorrOptions, theme: RenderTheme, selected: Set<number>,
  palette: Palette | null, beyond: readonly [number, number] = [0, 0]): void {
  const values = m.columns[c.j].filter((v): v is number => v !== null);
  // The selection, drawn over the bars on the same scale: where the selected records sit in this measure.
  const chosen = selected.size ? m.records.filter((r) => selected.has(r.tupleId) && r.values[c.j] !== null).map((r) => r.values[c.j]!) : [];
  const [lo, hi] = c.x.domain();
  const bins = Math.max(6, Math.min(16, Math.floor(cell / 8)));
  const counts = binCounts(values, lo, hi, bins);
  const top = Math.max(1, ...counts);
  const head = 16;
  // Per colour member (legend order): values and bin counts, for the split histogram and per-colour boxes.
  const byMember = palette
    ? palette.legend.map((l) => {
      const vals = m.records.filter((r) => r.values[c.j] !== null && palette.keyOf(r.colour) === l.key).map((r) => r.values[c.j]!);
      return { label: l.label, colour: l.colour, n: vals.length, vals, counts: binCounts(vals, lo, hi, bins) };
    }).filter((mm) => mm.n)
    : [];
  const members = opts.diagSplit !== 'off' ? byMember : [];
  const mode = !members.length ? 'off' : opts.diagSplit === 'each' && members.length > 8 ? 'share' : opts.diagSplit;
  // Box strip: one combined box, or one thin box per member (2–4 members).
  const boxes = !opts.diagBox ? []
    : opts.diagBoxMode === 'colour' && byMember.length >= 2 && byMember.length <= 4
      ? byMember.map((mm) => ({ s: boxStats(mm.vals), colour: mm.colour }))
      : [{ s: boxStats(values), colour: theme.text }];
  const boxH = boxes.length > 1 ? 4 : 6;
  const strip = boxes.length ? boxes.length * (boxH + 1) + 5 : 0;
  const floor = c.y0 + cell - strip;
  const bw = cell / bins;
  const binW = (hi - lo) / bins;
  const chosenCounts = chosen.length ? binCounts(chosen, lo, hi, bins) : null;
  const barH = cell - head - strip - 2;
  const density = opts.diag === 'density';
  if (density) {
    // Smooth curves (Silverman bandwidth, clipped to the window): combined, one per member (each 100% or by share),
    // and the selection's curve scaled by its share.
    const bw0 = bandwidthOf(values);
    const curve = (vals: number[], weight: number) => (vals.length >= 3 ? kde([...vals].sort((p, q) => p - q), bandwidthOf(vals) || bw0, 96, lo, hi).map(([vx, vy]) => [vx, vy * weight] as [number, number]) : []);
    const curves = mode === 'off'
      ? [{ colour: opts.color, pts: curve(values, 1), fill: chosen.length ? 0.15 : 0.35 }]
      : members.map((mm) => ({ colour: mm.colour, pts: curve(mm.vals, mode === 'each' ? 1 : mm.n / values.length), fill: chosen.length ? 0.05 : 0.15 }));
    const sel = chosen.length >= 3 ? curve(chosen, chosen.length / values.length) : [];
    const peak = Math.max(1e-12, ...curves.flatMap((cv) => cv.pts.map((p) => p[1])), ...sel.map((p) => p[1]));
    const path = (pts: [number, number][]) => pts.length
      ? `M${c.x(pts[0][0])},${floor}` + pts.map(([vx, vy]) => `L${c.x(vx)},${floor - (vy / peak) * barH}`).join('') + `L${c.x(pts[pts.length - 1][0])},${floor}Z`
      : '';
    for (const cv of curves) {
      if (!cv.pts.length) continue;
      g.append('path').attr('class', 'cm-density').attr('d', path(cv.pts)).attr('fill', cv.colour).attr('fill-opacity', cv.fill)
        .attr('stroke', cv.colour).attr('stroke-width', 1.25).attr('stroke-linejoin', 'round').style('pointer-events', 'none');
    }
    if (sel.length) g.append('path').attr('class', 'cm-density-sel').attr('d', path(sel)).attr('fill', opts.color).attr('fill-opacity', 0.75).style('pointer-events', 'none');
  } else if (mode === 'each') {
    // Each member its own 100%: outlines on one shared scale of "share of the member's records per bin".
    const shareTop = Math.max(...members.flatMap((mm) => mm.counts.map((k) => k / mm.n)));
    for (const mm of members) {
      let d = `M${c.x0},${floor}`;
      mm.counts.forEach((k, b) => {
        const y = floor - ((k / mm.n) / shareTop) * barH;
        d += `L${c.x0 + b * bw},${y}L${c.x0 + (b + 1) * bw},${y}`;
      });
      d += `L${c.x0 + cell},${floor}Z`;
      g.append('path').attr('class', 'cm-split').attr('d', d).attr('fill', mm.colour).attr('fill-opacity', chosenCounts ? 0.05 : 0.12)
        .attr('stroke', mm.colour).attr('stroke-width', 1.25).attr('stroke-linejoin', 'round').style('pointer-events', 'none');
    }
  } else if (mode === 'share') {
    // Stacked by member, bottom-up in legend order, on the combined scale.
    counts.forEach((_, b) => {
      let acc = 0;
      for (const mm of members) {
        const k = mm.counts[b];
        if (!k) continue;
        const y1 = floor - (acc / top) * barH;
        acc += k;
        const y2 = floor - (acc / top) * barH;
        g.append('rect').attr('class', 'cm-split').attr('x', c.x0 + b * bw + 0.5).attr('y', y2).attr('width', Math.max(0.5, bw - 1)).attr('height', y1 - y2)
          .attr('fill', mm.colour).attr('fill-opacity', chosenCounts ? 0.25 : 0.7).style('pointer-events', 'none');
      }
    });
  }
  counts.forEach((n, b) => {
    if (!n) return;
    const h = (n / top) * barH;
    const b0 = lo + b * binW;
    const b1 = b0 + binW;
    const last = b === bins - 1;
    const perMember = members.length
      ? '<br>' + members.filter((mm) => mm.counts[b]).slice(0, 8).map((mm) => `<span style="color:${mm.colour}">●</span> ${esc(mm.label)} ${mm.counts[b].toLocaleString()}`).join(' · ')
      : '';
    // With a split, the combined bar is an invisible hit area: hover and click still pick the whole value range.
    const solid = mode === 'off' && !density; // otherwise the bar is an invisible hit area over curves or split shapes
    g.append('rect').attr('class', 'cm-bar').attr('x', c.x0 + b * bw + 0.5).attr('y', solid ? floor - h : floor - barH)
      .attr('width', Math.max(0.5, bw - 1)).attr('height', solid ? h : barH)
      .attr('fill', solid ? opts.color : 'transparent').attr('fill-opacity', solid ? (chosenCounts ? 0.22 : 0.5) : 0).style('cursor', 'pointer')
      .attr('data-bar', `${c.j}|${b0}|${b1}|${last ? 1 : 0}`)
      .attr('data-tip', `<b>${esc(m.names[c.j])}</b> ${formatTick(b0, m.formats[c.j], binW)} – ${formatTick(b1, m.formats[c.j], binW)}<br>${n.toLocaleString()} records` +
        `${chosenCounts ? ` · ${chosenCounts[b].toLocaleString()} selected` : ''}${perMember}<br><span style="color:${theme.muted}">click to select them</span>`);
    if (chosenCounts?.[b] && !density) {
      const hs = (chosenCounts[b] / top) * barH;
      g.append('rect').attr('class', 'cm-bar-sel').attr('x', c.x0 + b * bw + 0.5).attr('y', floor - hs).attr('width', Math.max(0.5, bw - 1)).attr('height', hs)
        .attr('fill', opts.color).attr('fill-opacity', 0.9).style('pointer-events', 'none');
    }
  });
  g.append('line').attr('x1', c.x0).attr('x2', c.x0 + cell).attr('y1', floor).attr('y2', floor).attr('stroke', theme.muted).attr('stroke-width', 0.8);
  boxes.forEach(({ s: box, colour }, k) => {
    if (!box) return;
    const yb = floor + 3 + k * (boxH + 1) + boxH / 2;
    const bh = boxH;
    g.append('line').attr('class', 'cm-box').attr('x1', c.x(box.lo)).attr('x2', c.x(box.hi)).attr('y1', yb).attr('y2', yb).attr('stroke', colour).attr('stroke-width', 1);
    g.append('rect').attr('class', 'cm-box').attr('x', c.x(box.q1)).attr('y', yb - bh / 2).attr('width', Math.max(1, c.x(box.q3) - c.x(box.q1))).attr('height', bh)
      .attr('rx', 1).attr('fill', theme.surface).attr('stroke', colour).attr('stroke-width', 1);
    g.append('line').attr('class', 'cm-box').attr('x1', c.x(box.median)).attr('x2', c.x(box.median)).attr('y1', yb - bh / 2).attr('y2', yb + bh / 2)
      .attr('stroke', colour).attr('stroke-width', 2);
    if (boxes.length === 1) {
      // Markers as in the raincloud (no labels: the cell is small); the values are in the tooltip.
      const fmt = m.formats[c.j];
      const dec = markerDecimals(opts, fmt, values);
      const v = (x: number) => formatSummary(x, fmt, dec);
      const avg = mean(values);
      const [xl, xh] = c.x.domain();
      for (const pc of opts.markers.percentiles) {
        const q = quantile(values, pc / 100);
        if (q < xl || q > xh) continue;
        g.append('line').attr('class', 'cm-box-pct').attr('x1', c.x(q)).attr('x2', c.x(q)).attr('y1', yb - bh / 2 - 2).attr('y2', yb + bh / 2 + 2)
          .attr('stroke', theme.text).attr('stroke-width', 1).attr('stroke-dasharray', '2 1.5');
      }
      if (opts.markers.mean && avg >= xl && avg <= xh) {
        g.append('circle').attr('class', 'cm-box-mean').attr('cx', c.x(avg)).attr('cy', yb).attr('r', Math.max(2.2, bh * 0.45))
          .attr('fill', 'none').attr('stroke', MEAN).attr('stroke-width', 1.4);
      }
      const pcts = opts.markers.percentiles.map((pc) => `P${pc} ${v(quantile(values, pc / 100))}`).join(' · ');
      g.append('rect').attr('class', 'cm-box-hit').attr('x', c.x0).attr('y', floor).attr('width', cell).attr('height', strip).attr('fill', 'transparent')
        .attr('data-tip', `<b>${esc(m.names[c.j])}</b><br>median ${v(box.median)} · mean ${v(avg)}<br>IQR ${v(box.q1)} – ${v(box.q3)} · whiskers ${v(box.lo)} – ${v(box.hi)}` +
          `${pcts ? `<br>${pcts}` : ''}<br>n ${values.length.toLocaleString()}`);
    }
  });
  // Values beyond a cut axis are counted at the histogram's edges, never silently dropped.
  const [below, above] = beyond;
  const countText = (x: number, anchor: string, text: string) => g.append('text').attr('class', 'cm-beyond').attr('x', x).attr('y', c.y0 + 24)
    .attr('text-anchor', anchor).attr('font-size', 9.5).attr('fill', theme.muted).text(text);
  if (below) countText(c.x0 + 2, 'start', `‹ ${below.toLocaleString()}`);
  if (above) countText(c.x0 + cell - 2, 'end', `${above.toLocaleString()} ›`);
  const missing = m.columns[c.j].length - values.length;
  g.append('text').attr('class', 'cm-name').attr('x', c.x0 + 2).attr('y', c.y0 + 12).attr('font-size', cell < 80 ? 10.5 : 12).attr('font-weight', 600)
    .attr('fill', theme.text).attr('data-tip', `<b>${esc(m.names[c.j])}</b><br>n ${values.length.toLocaleString()}${missing ? ` · ${missing} missing` : ''}`)
    .text(fitText(m.names[c.j], cell, cell < 80 ? 6 : 6.8));
}

/** Upper triangle: the coefficient. Size and tint grow with |r|; hover shows r, ρ and n. */
export function drawCoefficient(g: G, c: Cell, s: PairStats, cell: number, opts: CorrOptions, theme: RenderTheme, label: string, details: string,
  diverging: boolean): void {
  const r = opts.coefficient === 'spearman' ? s.spearman : s.pearson;
  // Plain-language reading first (details), then the numbers, then how to look closer.
  const tipHtml = `<b>${esc(label)}</b>${details}<br><span style="color:${theme.muted}">Pearson r ${formatR(s.pearson)} · Spearman ρ ${formatR(s.spearman)} · n ${s.n.toLocaleString()}</span>` +
    `<br><span style="color:${theme.muted}">click to look closer</span>`;
  const hit = g.append('rect').attr('class', 'cm-coef').attr('x', c.x0).attr('y', c.y0).attr('width', cell).attr('height', cell)
    .attr('fill', 'transparent').attr('data-tip', tipHtml).attr('data-pair', `${c.i},${c.j}`).style('cursor', 'pointer');
  if (opts.upper === 'blank') return;
  // Diverging: red/blue by sign. Neutral: the text colour, strength by size or shade only (the sign is the "−").
  const tone = diverging ? toneOf(r, theme.muted) : theme.text;
  const mag = Number.isNaN(r) ? 0 : Math.abs(r);
  const scale = Math.max(0.7, cell / 120);
  let fill = opts.upper === 'plain' ? theme.text : tone;
  if (opts.upper === 'number') hit.attr('fill', tone).attr('fill-opacity', (diverging ? 0.04 : 0.02) + (diverging ? 0.16 : 0.1) * mag);
  if (opts.upper === 'tile') {
    // Heatmap style: the tile carries strength, the number stays one size (light text on a dark tile).
    hit.attr('fill', tone).attr('fill-opacity', 0.08 + (diverging ? 0.62 : 0.5) * mag);
    fill = mag > 0.55 ? theme.surface : theme.text;
  }
  const fs = opts.upper === 'number' ? (13 + 17 * mag) * scale : 13 * scale;
  g.append('text').attr('class', 'cm-r').attr('x', c.x0 + cell / 2).attr('y', c.y0 + cell / 2 + fs * 0.35).attr('text-anchor', 'middle')
    .attr('font-size', fs).attr('font-weight', opts.upper === 'plain' ? 400 : 600).attr('fill', fill)
    .style('font-variant-numeric', 'tabular-nums').style('pointer-events', 'none').text(formatR(r));
}

// A density cell's records. Kept off the DOM: as attributes, 100k records × 28 scatters made megabytes of strings.
const binIds = new WeakMap<Element, number[]>();
/** The tuple ids in a density cell (undefined for anything else). */
export const binIdsOf = (el: Element | null | undefined): number[] | undefined => (el ? binIds.get(el) : undefined);

/** Big data: shaded bins instead of points. Hover shows the count; clicking selects the bin's records. */
export function drawDensity(g: G, c: Cell, m: Matrix, cell: number, colour: string, theme: RenderTheme): void {
  const nb = Math.max(6, Math.min(16, Math.floor(cell / 8)));
  const bins = new Map<string, number[]>();
  for (const r of m.records) {
    const vx = r.values[c.j];
    const vy = r.values[c.i];
    if (vx === null || vy === null) continue;
    const fx = (c.x(vx) - c.x0) / cell;
    const fy = (c.y(vy) - c.y0) / cell;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) continue; // beyond a cut axis
    const bx = Math.min(nb - 1, Math.floor(fx * nb));
    const by = Math.min(nb - 1, Math.floor(fy * nb));
    const key = `${bx},${by}`;
    (bins.get(key) ?? bins.set(key, []).get(key)!).push(r.tupleId);
  }
  const most = Math.max(1, ...[...bins.values()].map((ids) => ids.length));
  for (const [key, ids] of bins) {
    const [bx, by] = key.split(',').map(Number);
    const rect = g.append('rect').attr('class', 'cm-bin').attr('x', c.x0 + (bx * cell) / nb).attr('y', c.y0 + (by * cell) / nb)
      .attr('width', cell / nb + 0.3).attr('height', cell / nb + 0.3).attr('fill', colour).attr('fill-opacity', 0.12 + 0.8 * (ids.length / most))
      .attr('data-tip', `<b>${ids.length.toLocaleString()}</b> records<br><span style="color:${theme.muted}">click to select them</span>`)
      .style('cursor', 'pointer');
    binIds.set(rect.node()!, ids);
  }
}
