import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS } from '../chart/options';
import { mergeOptions } from './settings';

describe('mergeOptions', () => {
  it('returns defaults when nothing is stored', () => {
    expect(mergeOptions(undefined)).toEqual(DEFAULT_OPTIONS);
  });

  it('keeps stored choices and fills options added since the workbook was saved', () => {
    const o = mergeOptions({ coefficient: 'spearman', axisCut: { on: false } as never, colour: { assigned: { seg: { A: '#4e79a7' } } } as never });
    expect(o.coefficient).toBe('spearman');
    expect(o.axisCut).toEqual({ on: false, margin: DEFAULT_OPTIONS.axisCut.margin });
    expect(o.colour.assigned.seg.A).toBe('#4e79a7');
    expect(o.colour.showLegend).toBe(DEFAULT_OPTIONS.colour.showLegend);
    expect(o.diagSplit).toBe(DEFAULT_OPTIONS.diagSplit);
  });
});
