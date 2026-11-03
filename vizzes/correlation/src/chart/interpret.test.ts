import { describe, expect, it } from 'vitest';
import { readPair, strengthOf } from './interpret';

const stats = (pearson: number, spearman: number, n = 500) => ({ n, pearson, spearman });

describe('readPair', () => {
  it('names strength and direction in plain words, with the share of variation explained', () => {
    const r = readPair('Income', 'Spend', stats(0.76, 0.79), 'pearson');
    expect(r.headline).toBe('Very strong positive: as Income rises, Spend tends to rise.');
    expect(r.explained).toBe('Income accounts for 58% of the variation in Spend (straight-line fit).');
    expect(r.caveats).toEqual([]);
    expect(readPair('Visits', 'Days', stats(-0.35, -0.4), 'pearson').headline).toBe('Moderate negative: as Visits rises, Days tends to fall.');
    expect(readPair('A', 'B', stats(0.03, 0.02), 'pearson').headline).toMatch(/^Negligible/);
  });

  it('adds caveats only when they apply: curved/outliers, Simpson, groups disagreeing, few records', () => {
    expect(readPair('X', 'Y', stats(0.5, 0.75), 'pearson').caveats[0]).toMatch(/curved, or pulled by outliers/);
    const simpson = readPair('Tenure', 'Satisfaction', stats(-0.41, -0.4), 'pearson',
      [{ label: 'Online', r: 0.68, n: 300 }, { label: 'In store', r: 0.72, n: 300 }]);
    expect(simpson.caveats.join(' ')).toMatch(/Simpson/);
    const mixed = readPair('P', 'D', stats(0.5, 0.5), 'pearson', [{ label: 'A', r: 0.6, n: 700 }, { label: 'B', r: -0.7, n: 40 }]);
    expect(mixed.caveats.join(' ')).toMatch(/disagree in direction/);
    expect(readPair('X', 'Y', stats(0.5, 0.5, 20), 'pearson').caveats.join(' ')).toMatch(/Only 20 records/);
  });

  it('says plainly when no correlation can be computed', () => {
    expect(readPair('A', 'Constant', stats(NaN, NaN), 'pearson').headline).toMatch(/no variation/);
  });

  it('uses the conventional strength bands', () => {
    expect([0.05, 0.2, 0.4, 0.6, 0.9].map(strengthOf)).toEqual(['negligible', 'weak', 'moderate', 'strong', 'very strong']);
  });
});
