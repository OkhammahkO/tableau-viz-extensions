import { describe, expect, it } from 'vitest';
import { countAtMost, ecdfPath } from './ecdf';

describe('countAtMost', () => {
  it('counts sorted values ≤ v, ties included', () => {
    const xs = [1, 2, 2, 2, 5];
    expect(countAtMost(xs, 0)).toBe(0);
    expect(countAtMost(xs, 2)).toBe(4);
    expect(countAtMost(xs, 4.9)).toBe(4);
    expect(countAtMost(xs, 9)).toBe(5);
  });
});

describe('ecdfPath', () => {
  const x = (v: number) => v * 10; // 1 unit = 10 px
  const ys = (f: number) => 100 - f * 100; // 0% at y 100, 100% at y 0

  it('starts at the share below the visible window, so values cut off by the axis still count', () => {
    const d = ecdfPath([0, 1, 5, 6, 7, 20], x, ys, 4, 10);
    expect(d.startsWith(`M40,${ys(2 / 6)}`)).toBe(true); // 2 of 6 values lie below 4
    expect(d.endsWith('H100')).toBe(true);
  });

  it('steps once per tie and reaches the share at the end of the window', () => {
    const d = ecdfPath([1, 2, 2, 3], x, ys, 0, 4);
    expect(d).toBe(`M0,100H10V${ys(0.25)}H20V${ys(0.75)}H30V${ys(1)}H40`);
  });

  it('draws nothing without values', () => {
    expect(ecdfPath([], x, ys, 0, 1)).toBe('');
  });
});
