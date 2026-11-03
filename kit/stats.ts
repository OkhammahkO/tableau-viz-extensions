// Statistics shared by the vizzes: quantiles, the mean, Silverman's bandwidth and a Gaussian KDE. Pure functions,
// no DOM: unit-tested in stats.test.ts (and through each viz's tests).

/** Linear-interpolation quantile of an ascending array (same method as d3.quantile / R type 7). */
export function quantileSorted(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];
  const i = (n - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.min(n - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** Quantile p (0–1) of unsorted values (sorts a copy). */
export const quantile = (values: number[], p: number): number => quantileSorted([...values].sort((a, b) => a - b), p);

/** Arithmetic mean; NaN without values. */
export const mean = (values: number[]): number => (values.length ? values.reduce((t, v) => t + v, 0) / values.length : NaN);

/** Silverman: 0.9 · min(sd, IQR/1.34) · n^-1/5, falling back to sd when IQR is 0. */
export function silverman(n: number, sd: number, iqr: number): number {
  if (n < 2) return 0;
  const spread = iqr > 0 ? Math.min(sd, iqr / 1.34) : sd;
  return spread > 0 ? 0.9 * spread * Math.pow(n, -0.2) : 0;
}

/**
 * Gaussian KDE evaluated over the observed range only (no density drawn beyond the data),
 * optionally narrowed to a visible window [from, to] so a truncated axis still gets a smooth curve.
 * Returns [x, density] pairs; empty when there's no usable bandwidth.
 */
export function kde(sorted: number[], bandwidth: number, steps = 128, from = -Infinity, to = Infinity): [number, number][] {
  const n = sorted.length;
  if (n < 2 || !(bandwidth > 0)) return [];
  const lo = Math.max(sorted[0], from);
  const hi = Math.min(sorted[n - 1], to);
  if (!(hi > lo)) return [];
  const k = 1 / (n * bandwidth * Math.sqrt(2 * Math.PI));
  const cutoff = 4 * bandwidth; // contributions beyond 4 bandwidths are negligible
  const out: [number, number][] = [];
  let start = 0;
  for (let s = 0; s < steps; s++) {
    const x = lo + ((hi - lo) * s) / (steps - 1);
    while (start < n && sorted[start] < x - cutoff) start++;
    let sum = 0;
    for (let i = start; i < n && sorted[i] <= x + cutoff; i++) {
      const z = (x - sorted[i]) / bandwidth;
      sum += Math.exp(-0.5 * z * z);
    }
    out.push([x, sum * k]);
  }
  return out;
}

/** Silverman's bandwidth straight from values (sorted or not). */
export function bandwidthOf(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const m = mean(sorted);
  const sd = Math.sqrt(sorted.reduce((t, v) => t + (v - m) ** 2, 0) / (n - 1));
  return silverman(n, sd, quantileSorted(sorted, 0.75) - quantileSorted(sorted, 0.25));
}
