import { describe, expect, it } from 'vitest';
import { OTHER_COLOUR, TABLEAU_10, TABLEAU_20, assignColours } from './colours';

const members = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `m${i}`, count: 100 - i }));

describe('assignColours', () => {
  it('uses Tableau 10 in member order for up to 10 members', () => {
    const p = assignColours(members(3));
    expect(p.legend.map((l) => l.colour)).toEqual(TABLEAU_10.slice(0, 3));
    expect(p.colourOf('m1')).toBe(TABLEAU_10[1]);
  });

  it('switches to Tableau 20 above 10 members', () => {
    const p = assignColours(members(12));
    expect(p.colourOf('m11')).toBe(TABLEAU_20[11]);
  });

  it('keeps the 19 largest and folds the rest into grey Other above 20 members', () => {
    const ms = members(25); // counts decrease, so m19..m24 are the smallest
    const p = assignColours(ms);
    expect(p.legend).toHaveLength(20);
    expect(p.legend[19].label).toBe('Other (6)');
    expect(p.colourOf('m24')).toBe(OTHER_COLOUR);
    expect(p.keyOf('m24')).toBe('Other');
    expect(p.rankOf('m24')).toBe(19);
    expect(p.colourOf('m0')).toBe(TABLEAU_20[0]);
  });

  it('keeps remembered colours when members are filtered out and back in', () => {
    const all = [{ name: 'A', count: 5 }, { name: 'B', count: 5 }, { name: 'C', count: 5 }];
    const first = assignColours(all);
    expect(first.colourOf('C')).toBe(TABLEAU_10[2]);
    // B filtered out: C must not shift into B's colour.
    const filtered = assignColours([all[0], all[2]], first.assigned);
    expect(filtered.colourOf('C')).toBe(TABLEAU_10[2]);
    expect(filtered.assigned.B).toBe(TABLEAU_10[1]); // B's colour is still remembered
    // A new member D takes the next colour no member on screen uses.
    const withD = assignColours([...all, { name: 'D', count: 5 }], first.assigned);
    expect(withD.colourOf('D')).toBe(TABLEAU_10[3]);
    expect(withD.colourOf('B')).toBe(TABLEAU_10[1]);
  });

  it('treats an unknown or null member as Other only when Other exists', () => {
    const p = assignColours(members(3));
    expect(p.keyOf(null)).toBe('Null');
    expect(p.colourOf('not-a-member')).toBe(OTHER_COLOUR);
  });
});
