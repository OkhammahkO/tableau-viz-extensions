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

  it('opens a workbook saved with v1.0 settings: its choices kept, v1.1 options get their defaults', () => {
    // The full options object v1.0.0 saved (2026-10-31), with a few non-default choices.
    const v10 = {
      cloud: 'histogram', rain: 'dots', lightning: 'box', bandwidth: 1, bins: 20, minNForDensity: 5,
      axis: { range: 'whiskers', low: 1, high: 99, margin: 0.1 }, color: '#e15759',
      size: { mode: 'fitWidth', rowHeight: 120, panelWidth: 480, minRowHeight: 64, minPanelWidth: 200 },
      panels: { wrap: 2, axis: 'independent' },
      colour: { splitCloud: true, showLegend: false, assigned: { Region: { North: '#4e79a7' } } },
      markers: { mean: true, percentiles: [10, 90], showValues: true, decimals: 1 }
    };
    const o = mergeOptions(JSON.parse(JSON.stringify(v10)));
    // v1.0 choices survive
    expect(o.cloud).toBe('histogram');
    expect(o.bins).toBe(20);
    expect(o.axis.margin).toBe(0.1);
    expect(o.color).toBe('#e15759');
    expect(o.size.rowHeight).toBe(120);
    expect(o.panels.wrap).toBe(2);
    expect(o.colour.splitCloud).toBe(true);
    expect(o.colour.assigned.Region.North).toBe('#4e79a7');
    expect(o.markers.percentiles).toEqual([10, 90]);
    // options added in v1.1 take their defaults
    expect(o.axis.titleMode).toBe(DEFAULT_OPTIONS.axis.titleMode);
    expect(o.axis.ticks).toBe(DEFAULT_OPTIONS.axis.ticks);
    expect(o.axis.gridlines).toBe(true);
    expect(o.colour.cloudSizing).toBe(DEFAULT_OPTIONS.colour.cloudSizing);
    expect(o.scales).toEqual(DEFAULT_OPTIONS.scales);
    expect(o.density).toBe('comfortable');
    expect(o.boxPosition).toBe('auto');
    expect(o.ecdf).toBe(false);
    expect(o.markers.meanStyle).toBe('circle');
    expect(o.markers.meanColour).toBe(DEFAULT_OPTIONS.markers.meanColour);
  });

  it('merges nested objects field by field', () => {
    const o = mergeOptions({ axis: { range: 'whiskers' } as never });
    expect(o.axis.range).toBe('whiskers');
    expect(o.axis.margin).toBe(DEFAULT_OPTIONS.axis.margin);
  });
});
