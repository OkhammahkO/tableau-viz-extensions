import { describe, expect, it } from 'vitest';
import { bandwidthOf, kde, mean, quantile, quantileSorted } from './stats';

describe('kit stats', () => {
  it('quantiles interpolate linearly (R type 7), sorted or not', () => {
    expect(quantileSorted([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([4, 1, 3, 2], 0.25)).toBe(1.75);
    expect(quantile([], 0.5)).toBeNaN();
  });

  it('mean, bandwidth and a KDE that integrates to about 1 over the data range', () => {
    const v = Array.from({ length: 200 }, (_, i) => Math.sin(i) * 10 + 50);
    expect(mean([1, 2, 3])).toBe(2);
    const bw = bandwidthOf(v);
    expect(bw).toBeGreaterThan(0);
    const pts = kde([...v].sort((a, b) => a - b), bw, 256);
    const area = pts.slice(1).reduce((t, [x, y], i) => t + (x - pts[i][0]) * (y + pts[i][1]) / 2, 0);
    expect(area).toBeGreaterThan(0.8); // clipped to the data range, so a little under 1
    expect(area).toBeLessThan(1.01);
  });
});
