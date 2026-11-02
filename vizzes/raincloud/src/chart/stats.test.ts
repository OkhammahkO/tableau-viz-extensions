import { describe, expect, it } from 'vitest';
import { dotLayout, fitDotDiameter, histogram, orderWithinStacks, kde, quantileSorted, stackLayout, summarize, tallestStack, typicalDotDiameter, wilkinsonStacks } from './stats';

describe('summarize', () => {
  it('matches known quartiles and Tukey whiskers', () => {
    const s = summarize([1, 2, 3, 4, 5, 6, 7, 8, 9, 100]);
    expect(s.median).toBe(5.5);
    expect(s.q1).toBe(3.25);
    expect(s.q3).toBe(7.75);
    expect(s.whiskerHigh).toBe(9); // 100 is beyond Q3 + 1.5 × IQR
    expect(s.whiskerLow).toBe(1);
    expect(s.mean).toBeCloseTo(14.5);
  });

  it('handles empty, single and constant groups without NaN bandwidths', () => {
    expect(summarize([]).n).toBe(0);
    expect(summarize([42]).bandwidth).toBe(0);
    const c = summarize([42, 42, 42, 42]);
    expect(c.median).toBe(42);
    expect(c.bandwidth).toBe(0);
  });

  it('agrees with d3-style quantiles', () => {
    expect(quantileSorted([10, 20, 30, 40], 0.5)).toBe(25);
    expect(quantileSorted([10], 0.9)).toBe(10);
  });
});

describe('kde', () => {
  it('stays inside the observed range and integrates close to 1 for wide data', () => {
    const xs = Array.from({ length: 400 }, (_, i) => i / 4);
    const s = summarize(xs);
    const pts = kde(xs, s.bandwidth, 200);
    expect(pts[0][0]).toBe(0);
    expect(pts[pts.length - 1][0]).toBe(99.75);
    let area = 0;
    for (let i = 1; i < pts.length; i++) area += ((pts[i][1] + pts[i - 1][1]) / 2) * (pts[i][0] - pts[i - 1][0]);
    expect(area).toBeGreaterThan(0.9); // a little mass is lost at the clipped edges
    expect(area).toBeLessThanOrEqual(1);
  });

  it('returns nothing when no bandwidth is available', () => {
    expect(kde([5, 5, 5], 0)).toEqual([]);
  });
});

describe('histogram', () => {
  it('counts every value once, including the maximum', () => {
    const bins = histogram([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0, 10, 5);
    expect(bins.reduce((a, b) => a + b.count, 0)).toBe(11);
    expect(bins[4].count).toBe(3); // 8, 9, 10
  });
});

describe('dot plot layout', () => {
  it('keeps every dot within half a diameter of its value', () => {
    const xs = [0, 1, 2, 2.5, 10, 10.2, 30];
    const d = 4;
    const dots = wilkinsonStacks(xs, d);
    dots.forEach((dot, i) => expect(Math.abs(dot.x - xs[i])).toBeLessThanOrEqual(d / 2));
    expect(dots.map((p) => p.k)).toEqual([0, 1, 2, 3, 0, 1, 0]);
    expect(tallestStack(xs, d)).toBe(4);
  });

  it('shrinks dots so the tallest stack fits', () => {
    const xs = Array.from({ length: 60 }, () => 50); // one big tie
    const d = fitDotDiameter([xs], 40, 8);
    expect(60 * d).toBeLessThanOrEqual(40);
    expect(d).toBeGreaterThan(0.6);
    expect(fitDotDiameter([[1, 50, 100]], 40, 8)).toBe(8);
  });

  it('compresses stack spacing so even huge stacks stay inside the band', () => {
    const xs = Array.from({ length: 5000 }, (_, i) => Math.floor(i / 100)); // 50 px wide, very tall stacks
    const { d, step } = dotLayout([xs], 40, 7, 1.5);
    expect(d).toBe(1.5);
    expect((tallestStack(xs, d) - 1) * step + d).toBeLessThanOrEqual(40);
  });

  it('typical dot size ignores one huge group; that group compresses its own stacks to fit', () => {
    const quiet = [[10, 30, 50], [12, 32, 52], [14, 34, 54]];
    const pile = Array.from({ length: 400 }, () => 50);
    const d = typicalDotDiameter([...quiet, pile], 40, 7, 1.5);
    expect(d).toBe(7);
    const lay = stackLayout(pile, 40, d);
    expect(lay.d).toBe(7);
    expect(lay.used).toBeLessThanOrEqual(40 + 1e-9);
    expect(lay.step).toBeLessThan(d);
    expect(stackLayout([1, 50], 40, d)).toEqual({ d, step: d, used: d });
  });

  it('falls back to the minimum diameter when nothing fits', () => {
    const xs = Array.from({ length: 200 }, () => 50);
    expect(fitDotDiameter([xs], 40, 8, 0.5)).toBe(0.5);
  });
});

describe('orderWithinStacks', () => {
  it('groups dots by rank inside each stack without moving them between stacks', () => {
    const xs = [0, 1, 2, 10, 11];
    const stacks = wilkinsonStacks(xs, 4); // stacks: [0,1,2] at x=1, [10,11] at x=10.5
    const ranks = [1, 0, 1, 1, 0];
    const out = orderWithinStacks(stacks, ranks);
    expect(out.map((s) => s.x)).toEqual(stacks.map((s) => s.x));
    expect(out.map((s) => s.k)).toEqual([1, 0, 2, 1, 0]);
  });
});
