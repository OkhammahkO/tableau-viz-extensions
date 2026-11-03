// Carrying a selection across a data refresh. Tuple ids are row positions in the summary data, so a filter that drops
// rows renumbers the rest: kept as ids, a selection would highlight different records (TESTING.md C13, failed in
// Tableau 2026-11-03). Tableau keeps the same marks selected, so the extension remembers records by their content.

/** A record's identity: every cell of its row (with a row ID on Detail, unique). */
export const rowKey = (cells: { value: unknown }[]): string => cells.map((c) => String(c.value)).join('␟');

/**
 * The selection after a refresh: the new tuple ids of the records whose keys were selected before. Records filtered
 * out drop away; identical rows (no row ID) all stay selected together.
 */
export function remapSelection(selected: Set<number>, before: Map<number, string>, after: Map<number, string>): Set<number> {
  if (!selected.size) return new Set();
  const keys = new Set<string>();
  for (const id of selected) {
    const key = before.get(id);
    if (key !== undefined) keys.add(key);
  }
  const out = new Set<number>();
  for (const [id, key] of after) if (keys.has(key)) out.add(id);
  return out;
}
