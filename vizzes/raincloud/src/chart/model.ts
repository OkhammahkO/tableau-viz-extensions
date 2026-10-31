import { summarize, type GroupStats } from './stats';
import type { NumberFormat } from '@kit/format';
import { leafPaths } from '@kit/grid/paths';

// Turns flat records (from Tableau or a CSV) into a grid of cells, each holding one raincloud's data.
// Rows and Columns work like Tableau's shelves: each takes ordered dimensions; a cell is one combination.

export interface GridRecord {
  /** One member per Rows dimension, outer first. Empty when Rows is empty. */
  rowPath: string[];
  /** One member per Columns dimension, outer first. Empty when Columns is empty. */
  colPath: string[];
  /** Colour (sub-category) member, or null when the Colour tile is empty. */
  colour: string | null;
  value: number | null;
  tupleId: number;
}

export interface Point {
  value: number;
  tupleId: number;
  colour?: string | null;
}

export interface Group {
  name: string;
  /** Non-null values, ascending. */
  points: Point[];
  values: number[];
  stats: GroupStats;
}

export interface Grid {
  /** Field names on Rows / Columns (for headers and tooltips). */
  rowLevels: string[];
  colLevels: string[];
  /** Leaf row and column paths in display order. A single empty path when the tile is empty. */
  rows: string[][];
  cols: string[][];
  /** cells[r][c]; undefined means no records for that combination ("no values"). */
  cells: (Group | undefined)[][];
  /** The measure's name, used as the label when Rows is empty. */
  valueName: string;
  /** The measure's Tableau number format, inferred from formatted values (null/absent: plain numbers). */
  valueFormat?: NumberFormat | null;
  /** Field on the Colour tile, or null. */
  colourLevel: string | null;
  /** Colour members in first-seen (Tableau) order, with record counts. */
  colourMembers: { name: string; count: number }[];
}

export function group(name: string, points: Point[], missing: number): Group {
  points.sort((a, b) => a.value - b.value);
  const values = points.map((p) => p.value);
  return { name, points, values, stats: summarize(values, missing) };
}

export function buildGrid(
  records: GridRecord[],
  rowLevels: string[],
  colLevels: string[],
  valueName: string,
  colourLevel: string | null = null
): Grid {
  const colourCounts = new Map<string, number>();
  if (colourLevel) for (const r of records) colourCounts.set(r.colour ?? 'Null', (colourCounts.get(r.colour ?? 'Null') ?? 0) + 1);
  const colourMembers = [...colourCounts.entries()].map(([name, count]) => ({ name, count }));
  const rows = leafPaths(records.map((r) => r.rowPath), rowLevels.length);
  const cols = leafPaths(records.map((r) => r.colPath), colLevels.length);
  const rowIndex = new Map(rows.map((p, i) => [p.join('\u0001'), i]));
  const colIndex = new Map(cols.map((p, i) => [p.join('\u0001'), i]));
  const buckets: { points: Point[]; missing: number }[][] = rows.map(() => cols.map(() => ({ points: [], missing: 0 })));
  const used: boolean[][] = rows.map(() => cols.map(() => false));
  for (const r of records) {
    const ri = rowIndex.get(r.rowPath.join('\u0001'));
    const ci = colIndex.get(r.colPath.join('\u0001'));
    if (ri === undefined || ci === undefined) continue;
    used[ri][ci] = true;
    const b = buckets[ri][ci];
    if (r.value === null || !Number.isFinite(r.value)) b.missing++;
    else b.points.push({ value: r.value, tupleId: r.tupleId, colour: r.colour });
  }
  const cells = rows.map((rp, ri) =>
    cols.map((_, ci) => (used[ri][ci] ? group(rp[rp.length - 1] ?? valueName, buckets[ri][ci].points, buckets[ri][ci].missing) : undefined))
  );
  return { rowLevels, colLevels, rows, cols, cells, valueName, colourLevel, colourMembers };
}

/** All non-empty cells, for statistics that span the grid. */
export function allGroups(grid: Grid): Group[] {
  return grid.cells.flat().filter((g): g is Group => !!g);
}
