import { scaleLinear } from 'd3-scale';
import { describe, expect, it } from 'vitest';
import { axisTicks, labelEvery } from './ticks';

describe('axisTicks', () => {
  const x = scaleLinear().domain([0, 100]).range([0, 700]);

  it('gives more ticks for denser settings', () => {
    const n = (d: 'fewer' | 'auto' | 'more') => axisTicks(x, 700, d).length;
    expect(n('fewer')).toBeLessThan(n('auto'));
    expect(n('auto')).toBeLessThan(n('more'));
  });

  it('uses a fixed interval when set, and falls back to automatic ticks when it would crowd the axis', () => {
    expect(axisTicks(x, 700, 'auto', 25)).toEqual([0, 25, 50, 75, 100]);
    expect(axisTicks(x, 700, 'auto', 0.1)).toEqual(axisTicks(x, 700, 'auto'));
  });

  it('keeps fixed ticks free of floating-point noise', () => {
    const y = scaleLinear().domain([0, 1]).range([0, 600]);
    expect(axisTicks(y, 600, 'auto', 0.1)).toContain(0.3);
  });
});

describe('labelEvery', () => {
  it('labels every tick when labels fit, every k-th when they would overlap', () => {
    const x = scaleLinear().domain([0, 100]).range([0, 500]);
    const ticks = [0, 10, 20, 30, 40, 50];
    expect(labelEvery(ticks, x, ticks.map(String))).toBe(1); // 50 px apart, short labels
    expect(labelEvery(ticks, x, ticks.map((t) => `$${t},000,000`))).toBe(2);
  });
});
