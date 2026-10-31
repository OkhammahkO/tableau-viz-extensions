import { describe, expect, it } from 'vitest';
import { MAX_COMBINATIONS, leafPaths } from './paths';

describe('leafPaths', () => {
  it('lists every combination, outer level major, members in first-seen order (Tableau sort)', () => {
    const paths = [['North', 'Y'], ['South', 'X'], ['North', 'X']];
    expect(leafPaths(paths, 2)).toEqual([['North', 'Y'], ['North', 'X'], ['South', 'Y'], ['South', 'X']]);
  });

  it('is a single empty path when the tile is empty', () => {
    expect(leafPaths([[], []], 0)).toEqual([[]]);
  });

  it('falls back to existing combinations when every combination would be too many', () => {
    const paths = Array.from({ length: 30 }, (_, i) => [`a${i}`, `b${i}`]); // 30 × 30 = 900 > cap
    expect(30 * 30).toBeGreaterThan(MAX_COMBINATIONS);
    expect(leafPaths(paths, 2)).toHaveLength(30);
  });
});
