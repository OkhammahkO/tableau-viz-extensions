// Colour assignment for the Colour tile (sub-categories). Colours follow the member, not its position:
// assignments are remembered (in Tableau settings, per Colour field) and reused, so filtering members out
// and back in never repaints the others. New members take the next unused palette colour, in Tableau's order.

export const TABLEAU_10 = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'];
export const TABLEAU_20 = [
  '#4e79a7', '#a0cbe8', '#f28e2b', '#ffbe7d', '#59a14f', '#8cd17d', '#b6992d', '#f1ce63', '#499894', '#86bcb6',
  '#e15759', '#ff9d9a', '#79706e', '#bab0ac', '#d37295', '#fabfd2', '#b07aa1', '#d4a6c8', '#9d7660', '#d7b5a6'
];
export const OTHER_COLOUR = '#c4c4c4';
export const OTHER_LABEL = 'Other';
/** Combined cloud colour when dots carry the colours, so the two don't clash. */
export const NEUTRAL_CLOUD = '#9aa0a6';

export interface ColourMember {
  name: string;
  count: number;
}

export interface Palette {
  /** Legend entries in display order (members, then Other if used). */
  legend: { key: string; label: string; colour: string }[];
  /** Grouping key for a member: itself, or OTHER_LABEL when folded into Other. */
  keyOf(member: string | null | undefined): string;
  colourOf(member: string | null | undefined): string;
  /** Position in the legend, for ordering dots within a stack. */
  rankOf(member: string | null | undefined): number;
  /** Member → colour to remember: the stored map plus any new assignments (absent members keep theirs). */
  assigned: Record<string, string>;
}

/**
 * Up to 10 members → Tableau 10; up to 20 → Tableau 20; more → the 19 largest keep colours and the rest fold into
 * grey "Other" (user decision). `stored` holds earlier assignments, which always win.
 */
export function assignColours(members: ColourMember[], stored: Record<string, string> = {}): Palette {
  let kept = members;
  let hasOther = false;
  if (members.length > TABLEAU_20.length) {
    const largest = new Set([...members].sort((a, b) => b.count - a.count).slice(0, TABLEAU_20.length - 1).map((m) => m.name));
    kept = members.filter((m) => largest.has(m.name));
    hasOther = true;
  }
  const scheme = kept.length <= TABLEAU_10.length ? TABLEAU_10 : TABLEAU_20;
  const used = new Set(kept.map((m) => stored[m.name]).filter(Boolean));
  const colourByKey = new Map<string, string>();
  const assigned: Record<string, string> = { ...stored };
  let next = 0;
  for (const m of kept) {
    let colour = stored[m.name];
    if (!colour) {
      // Next scheme colour not already used by a member on screen; cycle if the scheme is exhausted.
      let tries = 0;
      while (used.has(scheme[next % scheme.length]) && tries++ < scheme.length) next++;
      colour = scheme[next % scheme.length];
      next++;
      used.add(colour);
      assigned[m.name] = colour;
    }
    colourByKey.set(m.name, colour);
  }
  const legend = kept.map((m) => ({ key: m.name, label: m.name, colour: colourByKey.get(m.name)! }));
  if (hasOther) legend.push({ key: OTHER_LABEL, label: `${OTHER_LABEL} (${members.length - kept.length})`, colour: OTHER_COLOUR });
  const rank = new Map(legend.map((l, i) => [l.key, i]));
  const keyOf = (m: string | null | undefined) => (m != null && colourByKey.has(m) ? m : hasOther ? OTHER_LABEL : String(m ?? 'Null'));
  return {
    legend,
    keyOf,
    colourOf: (m) => colourByKey.get(keyOf(m)) ?? OTHER_COLOUR,
    rankOf: (m) => rank.get(keyOf(m)) ?? legend.length,
    assigned
  };
}
