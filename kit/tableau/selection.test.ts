import { describe, expect, it } from 'vitest';
import { remapSelection, rowKey } from './selection';

const cells = (...vs: unknown[]) => vs.map((value) => ({ value }));

describe('selection across a refresh', () => {
  it('rowKey: every cell, so rows differing in any field differ', () => {
    expect(rowKey(cells(1, 'A', 3.5))).toBe(rowKey(cells(1, 'A', 3.5)));
    expect(rowKey(cells(1, 'A', 3.5))).not.toBe(rowKey(cells(2, 'A', 3.5)));
  });

  it('a filter drops rows and renumbers the rest: the same records stay selected, dropped ones go', () => {
    // Before: rows r1..r4 at tuple ids 1..4; r2 and r4 selected. A filter drops r1 and r2: r3, r4 become ids 1, 2.
    const before = new Map([[1, 'r1'], [2, 'r2'], [3, 'r3'], [4, 'r4']]);
    const after = new Map([[1, 'r3'], [2, 'r4']]);
    expect([...remapSelection(new Set([2, 4]), before, after)]).toEqual([2]); // r4, now id 2; r2 is gone
    expect(remapSelection(new Set(), before, after).size).toBe(0);
  });

  it('identical rows (no row ID) stay selected together', () => {
    const before = new Map([[1, 'x'], [2, 'x'], [3, 'y']]);
    const after = new Map([[1, 'y'], [2, 'x'], [3, 'x']]);
    expect([...remapSelection(new Set([1]), before, after)].sort()).toEqual([2, 3]);
  });
});
