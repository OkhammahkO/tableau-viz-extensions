import { describe, expect, it } from 'vitest';
import { parsePercentiles, sliderFromSmoothing, smoothingFromSlider } from './shared';

describe('smoothing slider', () => {
  it('maps the ends to 0.25× and 4×, with 1× in the middle', () => {
    expect(smoothingFromSlider(0)).toBe(0.25);
    expect(smoothingFromSlider(50)).toBe(1);
    expect(smoothingFromSlider(100)).toBe(4);
  });

  it('snaps to 1× near the middle and round-trips', () => {
    expect(smoothingFromSlider(49)).toBe(1);
    for (const t of [0, 20, 50, 80, 100]) expect(sliderFromSmoothing(smoothingFromSlider(t))).toBeCloseTo(t, -0.5);
  });
});

describe('parsePercentiles', () => {
  it('accepts commas or spaces, drops invalid values, sorts and de-duplicates', () => {
    expect(parsePercentiles('90, 10 10 abc 0 100 50')).toEqual([10, 50, 90]);
  });
});
