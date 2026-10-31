import { describe, expect, it } from 'vitest';
import { buildGrid, type GridRecord } from './model';

const rec = (rowPath: string[], colPath: string[], value: number | null, tupleId: number): GridRecord => ({ rowPath, colPath, colour: null, value, tupleId });

describe('buildGrid', () => {
  it('buckets records into cells, keeping empty combinations as undefined', () => {
    const grid = buildGrid(
      [rec(['North'], ['A'], 1, 1), rec(['North'], ['A'], 3, 2), rec(['South'], ['B'], 5, 3), rec(['South'], ['B'], null, 4)],
      ['Region'], ['Segment'], 'Sales'
    );
    expect(grid.rows).toEqual([['North'], ['South']]);
    expect(grid.cols).toEqual([['A'], ['B']]);
    expect(grid.cells[0][0]?.stats.n).toBe(2);
    expect(grid.cells[0][1]).toBeUndefined(); // North × B: no records → "no values"
    expect(grid.cells[1][1]?.stats.missing).toBe(1);
  });

  it('labels the single row with the measure when Rows is empty', () => {
    const grid = buildGrid([rec([], [], 1, 1), rec([], [], 2, 2)], [], [], 'Sales');
    expect(grid.rows).toEqual([[]]);
    expect(grid.cells[0][0]?.name).toBe('Sales');
  });
});
