import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { binCounts, boxStats, completePairs, cutWindow, formulaText, leastSquares, pairStats, paddedExtent, pearson, ranks, sig3, spearman } from './stats';

const DIR = join(__dirname, '../../../../data/synthetic');
function csv(file: string): Record<string, (number | null)[]> {
  const lines = readFileSync(join(DIR, file), 'utf8').trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const cols: Record<string, (number | null)[]> = Object.fromEntries(header.map((h) => [h, []]));
  for (const line of lines.slice(1)) line.split(',').forEach((c, i) => cols[header[i]].push(c === '' ? null : Number(c)));
  return cols;
}

describe('pearson and spearman', () => {
  it("Anscombe's quartet: four pairs with r ≈ 0.816", () => {
    const a = csv('corr_anscombe.csv');
    for (const i of [1, 2, 3, 4]) expect(pairStats(a[`x${i}`], a[`y${i}`]).pearson).toBeCloseTo(0.816, 2);
  });

  it('perfect relationships give ±1, a constant gives NaN (undefined, not a crash)', () => {
    const e = csv('corr_edge_cases.csv');
    expect(pairStats(e.a, e.a_times_2_plus_3).pearson).toBeCloseTo(1, 5); // the CSV rounds to 2 decimals
    expect(pairStats(e.a, e.minus_half_a).spearman).toBeCloseTo(-1, 5);
    expect(pairStats(e.a, e.constant).pearson).toBeNaN();
  });

  it('uses pairwise-complete records: nulls only reduce n for their own pairs', () => {
    const e = csv('corr_edge_cases.csv');
    const nulls = e.a_with_nulls.filter((v) => v === null).length;
    expect(nulls).toBeGreaterThan(0);
    expect(pairStats(e.a, e.a_with_nulls).n).toBe(e.a.length - nulls);
    expect(pairStats(e.a, e.likert_1_5).n).toBe(e.a.length);
  });

  it('spearman is robust to the outlier that pulls pearson down', () => {
    const c = csv('corr_customers.csv');
    const s = pairStats(c.income_k, c.spend_k);
    expect(s.spearman).toBeGreaterThan(s.pearson);
  });

  it('ranks ties by their average rank', () => {
    expect(ranks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
    expect(spearman([1, 2, 3, 4], [1, 1, 2, 2])).toBeCloseTo(pearson([1, 2, 3, 4], [1.5, 1.5, 3.5, 3.5]), 10);
  });

  it('needs at least three pairs', () => {
    expect(pearson([1, 2], [3, 4])).toBeNaN();
  });
});

describe('helpers', () => {
  it('completePairs drops records missing either value', () => {
    expect(completePairs([1, null, 3, 4], [5, 6, null, 8])).toEqual([[1, 4], [5, 8]]);
  });

  it('leastSquares fits y = 2x + 3 exactly, and returns null without x variance', () => {
    expect(leastSquares([0, 1, 2], [3, 5, 7])).toEqual({ slope: 2, intercept: 3 });
    expect(leastSquares([1, 1, 1], [1, 2, 3])).toBeNull();
  });

  it('binCounts includes the top edge; paddedExtent copes with constants and empties', () => {
    expect(binCounts([0, 1, 2, 3, 4], 0, 4, 2)).toEqual([2, 3]);
    expect(paddedExtent([42, 42, null])).toEqual([41, 43]);
    expect(paddedExtent([null])).toEqual([0, 1]);
  });
});

describe('box and formula helpers', () => {
  it('boxStats gives quartiles and Tukey whiskers', () => {
    const b = boxStats([1, 2, 3, 4, 5, 6, 7, 8, 100])!;
    expect(b.median).toBe(5);
    expect(b.q1).toBe(3);
    expect(b.q3).toBe(7);
    expect(b.hi).toBe(8); // 100 is beyond 1.5 × IQR
    expect(boxStats([])).toBeNull();
  });

  it('formats formulas with three significant figures and true minus signs', () => {
    expect(sig3(0.62134)).toBe('0.621');
    expect(sig3(1234.5)).toBe('1230');
    expect(formulaText('Spend', 'Income', 0.62134, -3.14)).toBe('Spend = 0.621 × Income − 3.14');
  });
});

describe('cutWindow', () => {
  it('cuts at the whiskers + margin, never beyond the data; no cut without outliers or spread', () => {
    const vals = [...Array.from({ length: 50 }, (_, i) => 10 + i * 0.2), 100];
    const { window, cut } = cutWindow(vals, 0.05);
    expect(cut).toBe(true);
    expect(window[1]).toBeLessThan(100);
    expect(window[0]).toBe(10);
    expect(cutWindow([1, 2, 3, 4, 5], 0.05).cut).toBe(false);
    expect(cutWindow([42, 42, 42], 0.05)).toEqual({ window: [41, 43], cut: false });
  });
});
