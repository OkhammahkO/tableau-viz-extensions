// Pure statistics and layout for the raincloud. No DOM, no Tableau: unit-tested in stats.test.ts.

export interface GroupStats {
  n: number;
  missing: number;
  min: number;
  max: number;
  q1: number;
  median: number;
  q3: number;
  mean: number;
  /** Tukey whiskers: most extreme values within 1.5 × IQR of the box. */
  whiskerLow: number;
  whiskerHigh: number;
  /** Silverman's rule-of-thumb bandwidth; 0 when it can't be estimated (n < 2 or no spread). */
  bandwidth: number;
}

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

export function summarize(sorted: number[], missing = 0): GroupStats {
  const n = sorted.length;
  if (n === 0) {
    return { n, missing, min: NaN, max: NaN, q1: NaN, median: NaN, q3: NaN, mean: NaN, whiskerLow: NaN, whiskerHigh: NaN, bandwidth: 0 };
  }
  const q1 = quantileSorted(sorted, 0.25);
  const median = quantileSorted(sorted, 0.5);
  const q3 = quantileSorted(sorted, 0.75);
  const iqr = q3 - q1;
  let sum = 0;
  for (const v of sorted) sum += v;
  const mean = sum / n;
  let ss = 0;
  for (const v of sorted) ss += (v - mean) ** 2;
  const sd = n > 1 ? Math.sqrt(ss / (n - 1)) : 0;
  const lowFence = q1 - 1.5 * iqr;
  const highFence = q3 + 1.5 * iqr;
  let whiskerLow = sorted[0];
  for (const v of sorted) if (v >= lowFence) { whiskerLow = v; break; }
  let whiskerHigh = sorted[n - 1];
  for (let i = n - 1; i >= 0; i--) if (sorted[i] <= highFence) { whiskerHigh = sorted[i]; break; }
  return { n, missing, min: sorted[0], max: sorted[n - 1], q1, median, q3, mean, whiskerLow, whiskerHigh, bandwidth: silverman(n, sd, iqr) };
}

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

export interface Bin {
  x0: number;
  x1: number;
  count: number;
}

/** Equal-width bins over [lo, hi]; the last bin includes hi. */
export function histogram(sorted: number[], lo: number, hi: number, binCount: number): Bin[] {
  const bins: Bin[] = [];
  if (!(hi > lo) || binCount < 1) {
    if (sorted.length) bins.push({ x0: lo, x1: hi, count: sorted.length });
    return bins;
  }
  const w = (hi - lo) / binCount;
  for (let i = 0; i < binCount; i++) bins.push({ x0: lo + i * w, x1: lo + (i + 1) * w, count: 0 });
  for (const v of sorted) {
    if (v < lo || v > hi) continue;
    bins[Math.min(binCount - 1, Math.floor((v - lo) / w))].count++;
  }
  return bins;
}

/** Sturges' rule, clamped to a readable range. */
export function autoBinCount(n: number): number {
  return Math.max(8, Math.min(40, Math.ceil(Math.log2(Math.max(1, n)) + 1)));
}

export interface StackedDot {
  /** Centre x in pixels (the mean of the values in its stack, as in Wilkinson's dot plot). */
  x: number;
  /** Position in its stack: 0 = first dot. */
  k: number;
}

/**
 * Wilkinson dot-density layout in pixel space. `xs` must be ascending. Each stack collects values
 * within one dot diameter `d` of its first value and is centred on their mean, so a dot is never more
 * than d/2 from its true position.
 */
export function wilkinsonStacks(xs: number[], d: number): StackedDot[] {
  const out: StackedDot[] = new Array(xs.length);
  let i = 0;
  while (i < xs.length) {
    let j = i;
    while (j < xs.length && xs[j] < xs[i] + d) j++;
    const centre = (xs[i] + xs[j - 1]) / 2;
    for (let k = i; k < j; k++) out[k] = { x: centre, k: k - i };
    i = j;
  }
  return out;
}

/**
 * Re-orders dots within each stack by rank (e.g. colour legend order), so a stack shows sub-groups together,
 * like a stacked histogram (user decision). Stack membership and x positions don't change.
 */
export function orderWithinStacks(stacks: StackedDot[], ranks: number[]): StackedDot[] {
  const out = stacks.slice();
  let i = 0;
  while (i < stacks.length) {
    let j = i + 1;
    while (j < stacks.length && stacks[j].k !== 0) j++;
    const idx = Array.from({ length: j - i }, (_, n) => i + n).sort((a, b) => ranks[a] - ranks[b] || a - b);
    idx.forEach((orig, k) => (out[orig] = { x: stacks[orig].x, k }));
    i = j;
  }
  return out;
}

export function tallestStack(xs: number[], d: number): number {
  let best = 0;
  let i = 0;
  while (i < xs.length) {
    let j = i;
    while (j < xs.length && xs[j] < xs[i] + d) j++;
    best = Math.max(best, j - i);
    i = j;
  }
  return best;
}

export interface DotLayout {
  /** Dot diameter in px. */
  d: number;
  /** Vertical distance between dots in a stack; < d means dots overlap ("compress", as ggdist does). */
  step: number;
  /** Height the tallest stack actually uses: (tallest − 1) × step + d. */
  used: number;
}

/**
 * Dot size and stack spacing so every stack fits in `height`: shrink dots down to `minD`, then compress the
 * spacing. Guarantees (tallest − 1) × step + d ≤ height, so a stack never spills into the next band.
 */
export function dotLayout(groupsXs: number[][], height: number, maxD: number, minD: number): DotLayout {
  const d = fitDotDiameter(groupsXs, height, maxD, minD);
  const tallest = Math.max(1, ...groupsXs.map((xs) => tallestStack(xs, d)));
  // The last dot still needs its full diameter: (tallest − 1) × step + d ≤ height.
  const step = tallest > 1 ? Math.max(0, Math.min(d, (height - d) / (tallest - 1))) : d;
  return { d, step, used: (tallest - 1) * step + d };
}

/** Stack spacing for a given dot size so the tallest stack fits in `height` (dots overlap when they must). */
export function stackLayout(xs: number[], height: number, d: number): DotLayout {
  const tallest = Math.max(1, tallestStack(xs, d));
  const step = tallest > 1 ? Math.max(0, Math.min(d, (height - d) / (tallest - 1))) : d;
  return { d, step, used: (tallest - 1) * step + d };
}

/**
 * One dot size for all groups, sized for a typical group (the lower median of each group's own best fit), so one
 * huge group doesn't shrink every group's dots. Groups that don't fit at that size compress their own stacks
 * (stackLayout): their crowding shows as overlap, and one dot stays one record everywhere.
 */
export function typicalDotDiameter(groupsXs: number[][], height: number, maxD: number, minD = 0.5): number {
  const fits = groupsXs.filter((xs) => xs.length).map((xs) => fitDotDiameter([xs], height, maxD, minD)).sort((a, b) => a - b);
  return fits.length ? fits[Math.floor((fits.length - 1) / 2)] : maxD;
}

/**
 * Largest dot diameter (≤ maxD) such that every group's tallest stack fits in `height` pixels.
 * Shared across groups so dot size is comparable between them.
 */
export function fitDotDiameter(groupsXs: number[][], height: number, maxD: number, minD = 0.5): number {
  const fits = (d: number) => groupsXs.every((xs) => tallestStack(xs, d) * d <= height);
  if (fits(maxD)) return maxD;
  let lo = minD;
  let hi = maxD;
  if (!fits(lo)) return lo;
  for (let it = 0; it < 24; it++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}
