import type { RenderTheme } from '@kit/theme';
import type { Group } from './model';
import type { RaincloudOptions } from './options';
import { quantileSorted } from './stats';
import type { CellFrame, G, Tip } from './frame';

// The summary layer ("lightning"): Tukey box, mean marker, percentile ticks and their value labels.

/** Slim box with Tukey whiskers; hovering the box shows the summary. `opaque` is false when it sits over the cloud. */
export function drawBox(f: CellFrame, g: Group, ink: string, opaque: boolean, theme: RenderTheme, tip: Tip, tipHtml: string): void {
  const { L, x, base, boxH: bh } = f;
  const s = g.stats;
  L.append('line').attr('x1', x(s.whiskerLow)).attr('x2', x(s.whiskerHigh)).attr('y1', base).attr('y2', base)
    .attr('stroke', ink).attr('stroke-width', 1.25);
  L.append('rect').attr('x', x(s.q1)).attr('y', base - bh / 2).attr('width', Math.max(1, x(s.q3) - x(s.q1))).attr('height', bh)
    .attr('rx', 1.5).attr('fill', theme.surface).attr('fill-opacity', opaque ? 1 : 0.7).attr('stroke', ink).attr('stroke-width', 1.25)
    .style('cursor', 'help')
    .on('pointermove', (e: PointerEvent) => tip.show(tipHtml, e))
    .on('pointerleave', () => tip.hide());
  L.append('line').attr('x1', x(s.median)).attr('x2', x(s.median)).attr('y1', base - bh / 2).attr('y2', base + bh / 2)
    .attr('stroke', ink).attr('stroke-width', 2.25).style('pointer-events', 'none');
}

/**
 * Mean marker (default: a hollow orange circle without fill, so the median line shows through and the two stay
 * distinct when they coincide; user, 2026-11-02).
 */
export function drawMean(f: CellFrame, g: Group, markers: RaincloudOptions['markers'], ink: string, hasBox: boolean, theme: RenderTheme): void {
  const { L, x, base, boxH } = f;
  const cx = x(g.stats.mean);
  const m = Math.min(6, Math.max(3, boxH * 0.75 + 1)); // smaller in thin rows
  const half = boxH / 2 || 4;
  const M = L.append('g').attr('class', 'rc-mean').style('pointer-events', 'none');
  const ring = (cy: number, r: number, fill: string) =>
    M.append('circle').attr('cx', cx).attr('cy', cy).attr('r', r).attr('fill', fill).attr('stroke', ink).attr('stroke-width', 1.5);
  switch (markers.meanStyle) {
    case 'circle-lift': {
      // On the box line, lifted above the box with a short tick down when it would sit on the median line.
      const r = m * 0.55;
      if (hasBox && Math.abs(cx - x(g.stats.median)) < r + 1.5) {
        const top = base - half;
        const cy = top - r - 3;
        M.append('line').attr('x1', cx).attr('x2', cx).attr('y1', cy + r).attr('y2', top).attr('stroke', ink).attr('stroke-width', 1);
        ring(cy, r, theme.surface);
      } else {
        ring(base, r, 'none');
      }
      break;
    }
    case 'circle':
      ring(base, m * 0.55, 'none');
      break;
    case 'dot':
      M.append('circle').attr('cx', cx).attr('cy', base).attr('r', m * 0.45).attr('fill', ink).attr('stroke', theme.surface).attr('stroke-width', 1);
      break;
    case 'cross': {
      const c = m * 0.6;
      M.append('path').attr('d', `M${cx - c},${base - c}L${cx + c},${base + c}M${cx - c},${base + c}L${cx + c},${base - c}`)
        .attr('stroke', ink).attr('stroke-width', 1.5).attr('stroke-linecap', 'round');
      break;
    }
    case 'triangle': { // above the box, pointing down at the mean: never covers the box or the median
      const tipY = base - half - 1;
      M.append('path').attr('d', `M${cx},${tipY}L${cx + 3.5},${tipY - 5}L${cx - 3.5},${tipY - 5}Z`).attr('fill', ink);
      break;
    }
    default: // hollow diamond (v1.0; the median line stays visible through it)
      M.append('path').attr('d', `M${cx},${base - m}L${cx + m},${base}L${cx},${base + m}L${cx - m},${base}Z`)
        .attr('fill', 'none').attr('stroke', ink).attr('stroke-width', 1.5);
  }
}

/** Percentile ticks, then value labels for the percentiles, median and mean above the box. */
export function drawPercentilesAndLabels(f: CellFrame, g: Group, markers: RaincloudOptions['markers'], hasBox: boolean,
  ink: string, fmt: (v: number) => string, theme: RenderTheme): void {
  const { L, x, y0, base, boxH } = f;
  const labels: { v: number; text: string }[] = [];
  for (const p of markers.percentiles) {
    const v = quantileSorted(g.values, p / 100);
    const tickHalf = Math.min(8, boxH + 1);
    L.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', base - tickHalf).attr('y2', base + tickHalf)
      .attr('stroke', ink).attr('stroke-width', 1).attr('stroke-dasharray', '2 1.5');
    labels.push({ v, text: markers.showValues ? `P${p} ${fmt(v)}` : `P${p}` });
  }
  if (markers.showValues && hasBox) labels.push({ v: g.stats.median, text: `Median ${fmt(g.stats.median)}` });
  if (markers.showValues && markers.mean) labels.push({ v: g.stats.mean, text: `Mean ${fmt(g.stats.mean)}` });
  // As many label rows as fit between the box and the top of the cell (up to 3); thin rows get fewer or none.
  const labelY = base - boxH / 2 - 5;
  const labelRows = Math.max(0, Math.min(3, Math.floor((labelY - 9 - y0) / 11) + 1));
  placeLabels(L, labels.map((l) => ({ x: x(l.v), text: l.text })), labelY, theme, labelRows);
}

/**
 * Marker labels above the box, centred on their value. A label that would overlap the one before it moves up a
 * row (up to `maxRows`, at most three). With fewer than three rows a label that still overlaps is dropped. A halo
 * in the surface colour keeps them readable over the cloud.
 */
function placeLabels(L: G, items: { x: number; text: string }[], y: number, theme: RenderTheme, maxRows = 3): void {
  if (maxRows <= 0) return;
  const rowsEnd: number[] = [];
  const overlaps = (row: number, left: number) => rowsEnd[row] !== undefined && rowsEnd[row] > left;
  for (const it of items.sort((a, b) => a.x - b.x)) {
    const w = it.text.length * 5.2 + 6; // ~9px font
    let row = 0;
    while (row < maxRows - 1 && overlaps(row, it.x - w / 2)) row++;
    if (maxRows < 3 && overlaps(row, it.x - w / 2)) continue; // no room left: drop it
    rowsEnd[row] = it.x + w / 2;
    L.append('text').attr('x', it.x).attr('y', y - row * 11).attr('text-anchor', 'middle').attr('font-size', 9)
      .attr('fill', theme.muted).attr('stroke', theme.surface).attr('stroke-width', 3).attr('paint-order', 'stroke')
      .style('font-variant-numeric', 'tabular-nums').text(it.text);
  }
}
