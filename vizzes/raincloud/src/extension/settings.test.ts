import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS } from '../chart/options';
import { mergeOptions } from './settings';

describe('mergeOptions', () => {
  it('returns defaults when nothing is stored', () => {
    expect(mergeOptions(undefined)).toEqual(DEFAULT_OPTIONS);
  });

  it('keeps stored values and fills options added since the workbook was saved', () => {
    // A workbook saved before axis/markers existed
    const old = { cloud: 'histogram', rain: 'strip' } as const;
    const o = mergeOptions(old);
    expect(o.cloud).toBe('histogram');
    expect(o.rain).toBe('strip');
    expect(o.axis).toEqual(DEFAULT_OPTIONS.axis);
    expect(o.markers).toEqual(DEFAULT_OPTIONS.markers);
  });

  it('merges nested objects field by field', () => {
    const o = mergeOptions({ axis: { range: 'whiskers' } as never });
    expect(o.axis.range).toBe('whiskers');
    expect(o.axis.margin).toBe(DEFAULT_OPTIONS.axis.margin);
  });
});
