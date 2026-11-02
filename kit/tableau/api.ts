import type { DataTable, FieldInstance, Worksheet } from '@tableau/extensions-api-types';

// Shared Tableau plumbing, verified in Tableau Desktop (see the project skill for why each rule exists).

export type EncodingFields = Record<string, FieldInstance[]>;

// Tuple id = summary-data row index (across pages) + 1. Verified in Tableau.
export const tupleIdForRow = (rowIndex: number): number => rowIndex + 1;

// Every API call goes through this so a rejected promise is logged, not "Uncaught (in promise)".
export function fireAndLog(label: string, p: Promise<unknown>): void {
  p.catch((err) => console.warn(`[viz] ${label} failed`, err));
}

export async function getEncodingFields(worksheet: Worksheet): Promise<EncodingFields> {
  const spec = await worksheet.getVisualSpecificationAsync();
  if (spec.activeMarksSpecificationIndex < 0) return {};
  const map: EncodingFields = {};
  for (const encoding of spec.marksSpecifications[spec.activeMarksSpecificationIndex].encodings) {
    (map[encoding.id] ??= []).push(encoding.field);
  }
  return map;
}

// Loop pageCount rather than getAllPagesAsync: with no data, pageCount is 0 and
// getAllPagesAsync still requests page 0 and throws "0 is invalid value for range: [0..0)".
export async function readSummaryData(
  worksheet: Worksheet,
  onPage: (page: DataTable, rowOffset: number) => void
): Promise<{ totalRows: number; pageCount: number }> {
  const reader = await worksheet.getSummaryDataReaderAsync(undefined, { ignoreSelection: true });
  try {
    let rowOffset = 0;
    for (let i = 0; i < reader.pageCount; i++) {
      const page = await reader.getPageAsync(i);
      onPage(page, rowOffset);
      rowOffset += page.data.length;
    }
    return { totalRows: reader.totalRowCount, pageCount: reader.pageCount };
  } finally {
    await reader.releaseAsync();
  }
}
