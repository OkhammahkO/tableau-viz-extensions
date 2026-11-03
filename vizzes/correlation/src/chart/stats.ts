// Statistics for the correlation matrix (quantiles, mean, KDE: @kit/stats). Pairs use only the records where both measures have a value
// ("pairwise complete"), so a measure with nulls doesn't shrink every other pair.

export type Coefficient = 'pearson' | 'spearman';

export interface PairStats {
  /** Records with both values. */
  n: number;
  /** NaN when undefined (fewer than 3 pairs, or a measure without variance). */
  pearson: number;
  spearman: number;
}

/** The (x, y) values where both are present. */
export function completePairs(xs: (number | null)[], ys: (number | null)[]): [number[], number[]] {
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const y = ys[i];
    if (x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y)) { a.push(x); b.push(y); }
  }
  return [a, b];
}

export function pearson(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 3) return NaN;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n;
  mb /= n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    sab += da * db;
    saa += da * da;
    sbb += db * db;
  }
  if (saa === 0 || sbb === 0) return NaN;
  return Math.max(-1, Math.min(1, sab / Math.sqrt(saa * sbb)));
}

/** Ranks 1..n, ties get the average of the ranks they span (needed for Spearman with Likert-style data). */
export function ranks(a: number[]): number[] {
  const idx = a.map((_, i) => i).sort((i, j) => a[i] - a[j]);
  const out = new Array<number>(a.length);
  for (let k = 0; k < idx.length;) {
    let e = k;
    while (e + 1 < idx.length && a[idx[e + 1]] === a[idx[k]]) e++;
    for (let m = k; m <= e; m++) out[idx[m]] = (k + e) / 2 + 1;
    k = e + 1;
  }
  return out;
}

/** Spearman ρ: Pearson on the ranks. */
export const spearman = (a: number[], b: number[]): number => pearson(ranks(a), ranks(b));

export function pairStats(xs: (number | null)[], ys: (number | null)[]): PairStats {
  const [a, b] = completePairs(xs, ys);
  return { n: a.length, pearson: pearson(a, b), spearman: spearman(a, b) };
}

/** Least-squares line y = intercept + slope · x, or null when x has no variance. */
export function leastSquares(a: number[], b: number[]): { slope: number; intercept: number } | null {
  const n = a.length;
  if (n < 2) return null;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0;
  let saa = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; }
  if (saa === 0) return null;
  const slope = sab / saa;
  return { slope, intercept: mb - slope * ma };
}

/** Equal-width bin counts over [lo, hi]; the top edge is inclusive. */
export function binCounts(values: number[], lo: number, hi: number, bins: number): number[] {
  const counts = new Array<number>(bins).fill(0);
  const w = (hi - lo) / bins || 1;
  for (const v of values) {
    if (v < lo || v > hi) continue;
    counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++;
  }
  return counts;
}

/** Value range of a measure with a small pad, or [0, 1] when empty; a constant gets ±1 so it still has a scale. */
export function paddedExtent(values: (number | null)[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) if (v !== null && Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (!Number.isFinite(lo)) return [0, 1];
  if (lo === hi) return [lo - 1, hi + 1];
  const pad = (hi - lo) * 0.04;
  return [lo - pad, hi + pad];
}

export interface BoxStats {
  q1: number;
  median: number;
  q3: number;
  /** Tukey whiskers: the furthest values within 1.5 × IQR of the box. */
  lo: number;
  hi: number;
}

/** Quartiles (linear interpolation) and Tukey whiskers, or null without values. */
export function boxStats(values: number[]): BoxStats | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const q = (p: number) => {
    const h = (v.length - 1) * p;
    const lo = Math.floor(h);
    return v[lo] + (v[Math.min(v.length - 1, lo + 1)] - v[lo]) * (h - lo);
  };
  const q1 = q(0.25);
  const q3 = q(0.75);
  const iqr = q3 - q1;
  return { q1, median: q(0.5), q3, lo: v.find((x) => x >= q1 - 1.5 * iqr)!, hi: [...v].reverse().find((x) => x <= q3 + 1.5 * iqr)! };
}

/** Three significant figures without trailing zeros, for formula labels: 0.6213 → "0.621", 1234.5 → "1230". */
export function sig3(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  return String(Number(v.toPrecision(3)));
}

/** "Spend = 0.621 × Income − 3.14", with true minus signs. */
export function formulaText(yName: string, xName: string, slope: number, intercept: number): string {
  const sign = intercept < 0 ? '−' : '+';
  const slopeText = slope < 0 ? `−${sig3(-slope)}` : sig3(slope);
  return `${yName} = ${slopeText} × ${xName} ${sign} ${sig3(Math.abs(intercept))}`;
}

/**
 * Axis window for a measure, as the raincloud cuts outliers: the Tukey whiskers plus `margin` × their span on each
 * side, never beyond the data. Statistics still use every value; only the view is cut. `cut` says whether anything
 * falls outside. Without spread (a constant, or one value) it falls back to the padded data range.
 */
export function cutWindow(values: (number | null)[], margin: number): { window: [number, number]; cut: boolean } {
  const v = values.filter((x): x is number => x !== null && Number.isFinite(x));
  const box = boxStats(v);
  if (!box || box.hi <= box.lo) return { window: paddedExtent(values), cut: false };
  let min = Infinity;
  let max = -Infinity;
  for (const x of v) { if (x < min) min = x; if (x > max) max = x; }
  const m = (box.hi - box.lo) * margin;
  const lo = Math.max(min, box.lo - m);
  const hi = Math.min(max, box.hi + m);
  const cut = lo > min || hi < max;
  if (!cut) return { window: paddedExtent(values), cut: false };
  return { window: [lo, hi], cut };
}

export { mean, quantile } from '@kit/stats';
