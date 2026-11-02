import { pointer } from 'd3-selection';
import type { RenderTheme } from '@kit/theme';
import type { CellFrame, Tip } from './frame';

// Cumulative line (ECDF), Pareto-style: a second scale in the cloud area, so it gets its own 0–100% labels on the
// right, a faint 50% guide (it crosses there at the median) and a hover readout.

export interface EcdfLine {
  colour: string;
  /** Sorted values. */
  values: number[];
}

/** Number of sorted values ≤ v (binary search). */
export function countAtMost(sorted: number[], v: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Step path of the empirical CDF across the visible window [vLo, vHi], counting all values (so values cut off by the
 * axis still count: it starts at the share below vLo). One step per pixel at most, so 100k records stay light.
 */
export function ecdfPath(sorted: number[], x: (v: number) => number, ys: (f: number) => number, vLo: number, vHi: number): string {
  const n = sorted.length;
  if (!n) return '';
  let path = `M${x(vLo)},${ys(countAtMost(sorted, vLo - 1e-12) / n)}`;
  let lastPx = -Infinity;
  let i = sorted.findIndex((v) => v >= vLo);
  if (i < 0) i = n;
  while (i < n && sorted[i] <= vHi) {
    let j = i;
    while (j < n && sorted[j] === sorted[i]) j++; // ties step together
    const px = x(sorted[i]);
    const f = j / n;
    if (px - lastPx >= 1 || j >= n || sorted[j] > vHi) {
      path += `H${px}V${ys(f)}`;
      lastPx = px;
    } else {
      path += `V${ys(f)}`; // same pixel: just rise
    }
    i = j;
  }
  return path + `H${x(vHi)}`;
}

export interface EcdfOptions {
  vLo: number;
  vHi: number;
  /** One line per colour (the cloud is split): the readout marks each line's colour. */
  perColour: boolean;
  /** The n count's baseline and width when it's shown: "100%" goes just left of it, on the same baseline. */
  nLabel: { y: number; width: number } | null;
  /** Readout heading (the cell's label) and value format. */
  title: string;
  fmt: (v: number) => string;
}

/** Draws the ECDF lines over the cloud area: 100% at the top of the cell's plot, 0% on the cloud's baseline. */
export function drawEcdf(f: CellFrame, svgNode: SVGSVGElement, lines: EcdfLine[], o: EcdfOptions, theme: RenderTheme, tip: Tip): void {
  const { L, x, x0, y0, w, cloudBase } = f;
  const top = y0 + 4; // 100% = the top of the cloud area, where a fitted cloud's peak reaches
  const ys = (q: number) => cloudBase - q * (cloudBase - top);
  const E = L.append('g').attr('class', 'rc-ecdf').style('pointer-events', 'none');
  E.append('line').attr('x1', x0 + 1).attr('x2', x0 + w - 1).attr('y1', ys(0.5)).attr('y2', ys(0.5))
    .attr('stroke', theme.muted).attr('stroke-width', 0.75).attr('stroke-dasharray', '2 3').attr('stroke-opacity', 0.6);
  for (const ln of lines) E.append('path').attr('d', ecdfPath(ln.values, x, ys, o.vLo, o.vHi)).attr('fill', 'none')
    .attr('stroke', ln.colour).attr('stroke-width', 1.5).attr('stroke-linejoin', 'round');
  // "100%" just under its line, left of the n count on the same baseline; "50%" on its guide at the right edge.
  const labelAt = (lx: number, ly: number, label: string) => E.append('text').attr('x', lx).attr('y', ly).attr('text-anchor', 'end')
    .attr('font-size', 8.5).attr('fill', theme.muted).attr('stroke', theme.surface).attr('stroke-width', 3).attr('paint-order', 'stroke').text(label);
  labelAt(o.nLabel ? x0 + w - 4 - o.nLabel.width - 6 : x0 + w - 3, o.nLabel ? o.nLabel.y : top + 10, '100%');
  labelAt(x0 + w - 3, ys(0.5) + 3, '50%');
  // Hover readout over the cloud area: share of records ≤ the value under the pointer, per line.
  L.append('rect').attr('class', 'rc-ecdf-hit').attr('x', x0).attr('y', top).attr('width', w).attr('height', Math.max(0, cloudBase - top))
    .attr('fill', 'transparent').style('cursor', 'crosshair')
    .on('pointermove', (e: PointerEvent) => {
      const v = x.invert(pointer(e, svgNode)[0]);
      const rows = lines.map((ln) => {
        const share = countAtMost(ln.values, v) / ln.values.length;
        const who = o.perColour ? `<span style="color:${ln.colour}">●</span> ` : '';
        return `${who}${Math.round(share * 100)}% of records ≤ ${o.fmt(v)}`;
      });
      tip.show(`<b>${o.title}</b><br>${rows.join('<br>')}`, e);
    })
    .on('pointerleave', () => tip.hide());
}
