import { area, curveBasis } from 'd3-shape';
import type { ScaleLinear } from 'd3-scale';
import type { Palette } from '@kit/colours';
import { formatTick, type NumberFormat } from '@kit/format';
import type { RenderTheme } from '@kit/theme';
import type { Group } from './model';
import type { RaincloudOptions } from './options';
import { histogram, kde, type Bin } from './stats';
import type { CellFrame } from './frame';

// The cloud: a density curve or histogram per cell, optionally split by colour member, and its peak label.

/** A cell's cloud, worked out before drawing so heights can be scaled across cells. */
export interface CellCloud {
  dens?: [number, number][];
  hist?: { bins: Bin[]; binW: number };
  /** Split cloud, density: one curve per colour member. */
  subDens: { colour: string; values: number[]; pts: [number, number][] }[];
  /** Split cloud, histogram: one set of bins per colour member. */
  subHists: { colour: string; n: number; bins: Bin[] }[];
  /** The tallest point drawn (density units). In 'each' mode a member is its own 100%, so it can peak above the
   *  combined cloud: the height scale must include it. */
  peak: number;
}

export interface CloudMode {
  /** Cloud split by colour member. */
  split: boolean;
  /** Split, each colour its own 100% (else scaled by its share of the cell). */
  each: boolean;
  palette: Palette | null;
  binCount: number;
}

/** A cell's values split by colour member (Other grouped), in legend order. */
export function subGroups(g: Group, palette: Palette): { colour: string; values: number[] }[] {
  const byKey = new Map<string, number[]>();
  for (const p of g.points) {
    const k = palette.keyOf(p.colour);
    let arr = byKey.get(k);
    if (!arr) byKey.set(k, (arr = []));
    arr.push(p.value); // points are sorted, so each list stays sorted
  }
  return palette.legend.filter((l) => byKey.has(l.key)).map((l) => ({ colour: l.colour, values: byKey.get(l.key)! }));
}

export function computeCloud(g: Group, vLo: number, vHi: number, opts: RaincloudOptions, mode: CloudMode): CellCloud {
  const out: CellCloud = { subDens: [], subHists: [], peak: 0 };
  const bump = (v: number) => (out.peak = Math.max(out.peak, v));
  if (opts.cloud === 'density' && g.stats.n >= opts.minNForDensity) {
    const bw = g.stats.bandwidth * opts.bandwidth;
    out.dens = kde(g.values, bw, 128, vLo, vHi);
    for (const p of out.dens) bump(p[1]);
    if (mode.split) {
      out.subDens = subGroups(g, mode.palette!).filter((sub) => sub.values.length >= opts.minNForDensity).map((sub) => {
        const weight = mode.each ? 1 : sub.values.length / g.stats.n;
        return { colour: sub.colour, values: sub.values, pts: kde(sub.values, bw, 128, vLo, vHi).map(([vx, vy]) => [vx, vy * weight] as [number, number]) };
      }).filter((sub) => sub.pts.length);
      if (mode.each) for (const sub of out.subDens) for (const p of sub.pts) bump(p[1]);
    }
  } else if (opts.cloud === 'histogram') {
    const binW = (vHi - vLo) / mode.binCount;
    out.hist = { bins: histogram(g.values, vLo, vHi, mode.binCount), binW };
    for (const bn of out.hist.bins) bump(bn.count / (g.stats.n * binW));
    if (mode.split) {
      out.subHists = subGroups(g, mode.palette!).map((sub) => ({ colour: sub.colour, n: sub.values.length, bins: histogram(sub.values, vLo, vHi, mode.binCount) }));
      if (mode.each) for (const sub of out.subHists) for (const bn of sub.bins) bump(bn.count / (sub.n * binW));
    }
  }
  return out;
}

/** Draws the cloud: `hs` maps density to pixels; `colour` is the combined cloud's colour. */
export function drawCloud(f: CellFrame, g: Group, c: CellCloud, hs: ScaleLinear<number, number>, mode: CloudMode,
  colour: string, opts: RaincloudOptions, theme: RenderTheme): void {
  const { L, x, cloudBase } = f;
  const curve = area<[number, number]>().x((p) => x(p[0])).y0(cloudBase).y1((p) => cloudBase - hs(p[1])).curve(curveBasis);
  const { dens, hist } = c;
  if (dens?.length && mode.split) {
    // One curve per colour member: scaled by its share of the cell (they add up to the whole) or each its own 100%.
    for (const sub of c.subDens) {
      L.append('path').datum(sub.pts).attr('d', curve).attr('fill', sub.colour).attr('fill-opacity', 0.2)
        .attr('stroke', sub.colour).attr('stroke-width', 1.25);
    }
  } else if (hist && mode.each) {
    // Each colour its own 100%: overlaid step outlines, so every member's shape stays visible.
    for (const sub of c.subHists) {
      const bins = sub.bins;
      if (!sub.n || !bins.length) continue;
      let path = `M${x(bins[0].x0)},${cloudBase}`;
      for (const bn of bins) {
        const y = cloudBase - hs(bn.count / (sub.n * hist.binW));
        path += `L${x(bn.x0)},${y}L${x(bn.x1)},${y}`;
      }
      path += `L${x(bins[bins.length - 1].x1)},${cloudBase}Z`;
      L.append('path').attr('d', path).attr('fill', sub.colour).attr('fill-opacity', 0.12)
        .attr('stroke', sub.colour).attr('stroke-width', 1.25).attr('stroke-linejoin', 'round');
    }
  } else if (dens?.length) {
    L.append('path').datum(dens).attr('d', curve).attr('fill', colour).attr('fill-opacity', 0.35)
      .attr('stroke', colour).attr('stroke-width', 1.25);
  } else if (hist && mode.split) {
    // Stacked histogram: each bin's bar is divided by colour member, bottom-up in legend order.
    hist.bins.forEach((_, bi) => {
      let acc = 0;
      for (const s of c.subHists) {
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
      .attr('fill', colour).attr('fill-opacity', 0.45);
  } else if (opts.cloud === 'density' && g.stats.n < opts.minNForDensity) {
    L.append('text').attr('x', f.x0 + 4).attr('y', f.base - 8).attr('font-size', 10).attr('fill', theme.muted)
      .text(`too few values for a curve (n < ${opts.minNForDensity})`);
  }
}

/**
 * Peak label: what the cloud's height means, at the height of its peak (needed when heights fit each chart).
 * Histogram: the tallest bar's share of its records. Density: the share of records within one gridline interval
 * centred on the peak, counted (height × width overshoots 100% when a spike is narrower than the interval).
 */
export function drawPeakLabel(f: CellFrame, g: Group, c: CellCloud, hs: ScaleLinear<number, number>, each: boolean,
  tickStep: number, valueFormat: NumberFormat | null | undefined, theme: RenderTheme): void {
  const { L, x0, y0, cloudBase } = f;
  const pct = c.hist ? c.peak * c.hist.binW * 100 : densityPeakShare(each ? c.subDens : [], c.dens!, g.values, tickStep) * 100;
  const pctText = `${pct >= 10 ? Math.round(pct) : pct.toFixed(1)}%`;
  const per = c.hist ? 'per bin' : `per ${formatTick(tickStep, valueFormat, tickStep)}`;
  const py = cloudBase - hs(c.peak);
  L.append('line').attr('class', 'rc-peak').attr('x1', x0 + 1).attr('x2', x0 + 5).attr('y1', py).attr('y2', py)
    .attr('stroke', theme.muted).attr('stroke-width', 1);
  L.append('text').attr('class', 'rc-peak').attr('x', x0 + 7).attr('y', Math.max(y0 + 9, py + 3)).attr('font-size', 9)
    .attr('fill', theme.muted).attr('stroke', theme.surface).attr('stroke-width', 3).attr('paint-order', 'stroke')
    .style('font-variant-numeric', 'tabular-nums').text(`${pctText} ${per}`)
    .append('title').text(c.hist
      ? `The tallest bar holds ${pctText} of this chart's records.`
      : `${pctText} of this chart's records lie within ${per.slice(4)} (one gridline interval) around the peak.`);
}

/**
 * Share of records within `width` centred on the tallest curve's peak: the combined curve, or (split, each colour
 * 100%) the colour whose curve peaks highest, counted over that curve's own records.
 */
function densityPeakShare(subs: { values: number[]; pts: [number, number][] }[], pts: [number, number][], values: number[], width: number): number {
  const curves = subs.length ? subs : [{ values, pts }];
  let best = curves[0];
  let bestY = -1;
  let peakX = 0;
  for (const c of curves) for (const [vx, vy] of c.pts) if (vy > bestY) { bestY = vy; peakX = vx; best = c; }
  if (!best.values.length) return 0;
  const lo = peakX - width / 2;
  const hi = peakX + width / 2;
  return best.values.filter((v) => v >= lo && v <= hi).length / best.values.length;
}
