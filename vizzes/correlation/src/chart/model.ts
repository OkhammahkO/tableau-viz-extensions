import type { ColourMember } from '@kit/colours';
import { axisTitle, type NumberFormat } from '@kit/format';

// The matrix's data: one record per row (a row ID on Detail), one value per measure, an optional colour member.

export interface MatrixRecord {
  /** One value per measure, in tile order; null when missing. */
  values: (number | null)[];
  colour: string | null;
  tupleId: number;
}

export interface Matrix {
  /** Display names, in tile order ("SUM(Age)" → "Age"). */
  names: string[];
  /** columns[j][r] = record r's value for measure j. */
  columns: (number | null)[][];
  records: MatrixRecord[];
  colourLevel: string | null;
  colourMembers: ColourMember[];
  /** Each measure's Tableau number format ($, %, K, separators) when it could be inferred; null otherwise. */
  formats: (NumberFormat | null)[];
}

export function buildMatrix(records: MatrixRecord[], fieldNames: string[], colourField: string | null = null): Matrix {
  const columns = fieldNames.map((_, j) => records.map((r) => r.values[j] ?? null));
  const counts = new Map<string, number>();
  if (colourField) for (const r of records) if (r.colour !== null) counts.set(r.colour, (counts.get(r.colour) ?? 0) + 1);
  return {
    names: fieldNames.map(axisTitle),
    columns,
    records,
    colourLevel: colourField,
    colourMembers: [...counts].map(([name, count]) => ({ name, count })),
    formats: fieldNames.map(() => null)
  };
}
