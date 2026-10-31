// Row/column paths for Rows × Columns tiles, like Tableau's shelves.

/** Above this many rows (or columns), show only combinations that exist rather than every combination. */
export const MAX_COMBINATIONS = 500;

/**
 * Leaf paths for one tile. Every combination of the levels' members (outer level major, members in
 * first-seen order), so missing combinations still get a row (user decision). Falls back to the
 * combinations that exist when the full set would exceed MAX_COMBINATIONS.
 */
export function leafPaths(paths: string[][], levels: number): string[][] {
  if (levels === 0) return [[]];
  const members: string[][] = Array.from({ length: levels }, () => []);
  const seen: Set<string>[] = Array.from({ length: levels }, () => new Set());
  const existing: string[][] = [];
  const existingKeys = new Set<string>();
  for (const p of paths) {
    p.forEach((m, k) => { if (!seen[k].has(m)) { seen[k].add(m); members[k].push(m); } });
    const key = p.join('\u0001');
    if (!existingKeys.has(key)) { existingKeys.add(key); existing.push(p); }
  }
  const total = members.reduce((n, m) => n * m.length, 1);
  if (total > MAX_COMBINATIONS) return existing;
  let out: string[][] = [[]];
  for (const level of members) out = out.flatMap((prefix) => level.map((m) => [...prefix, m]));
  return out;
}
