// Test helpers: build simple one-column grids from flat category records.
import { group, type Grid, type Group, type Point } from './model';

export interface RecordPoint {
  category: string;
  value: number | null;
  /** Tableau tuple id for hover/selection; any unique id outside Tableau. */
  tupleId: number;
}

/** Groups records by category, keeping first-seen category order (Tableau's own sort). */
export function buildGroups(records: RecordPoint[]): Group[] {
  const map = new Map<string, { points: Point[]; missing: number }>();
  for (const r of records) {
    let g = map.get(r.category);
    if (!g) map.set(r.category, (g = { points: [], missing: 0 }));
    if (r.value === null || !Number.isFinite(r.value)) g.missing++;
    else g.points.push({ value: r.value, tupleId: r.tupleId });
  }
  return [...map.entries()].map(([name, g]) => group(name, g.points, g.missing));
}

/** A one-column grid from category groups. */
export function gridFromGroups(groups: Group[], rowLevel = 'Category', valueName = 'Value'): Grid {
  return {
    rowLevels: [rowLevel],
    colLevels: [],
    rows: groups.map((g) => [g.name]),
    cols: [[]],
    cells: groups.map((g) => [g]),
    valueName,
    colourLevel: null,
    colourMembers: []
  };
}

