import { describe, expect, it } from 'vitest';
import { axisTitle, formatSummary, formatTick, inferFormat, parseFormatted } from './format';

describe('parseFormatted', () => {
  it('reads common Tableau formats', () => {
    expect(parseFormatted('$1,234.50')).toMatchObject({ prefix: '$', suffix: '', number: 1234.5, decimals: 2, grouped: true });
    expect(parseFormatted('12.3%')).toMatchObject({ prefix: '', suffix: '%', number: 12.3, decimals: 1 });
    expect(parseFormatted('(45)')).toMatchObject({ number: -45 });
    expect(parseFormatted('1.234,5 €')).toMatchObject({ suffix: '€', number: 1234.5, decimals: 1, grouped: true });
    expect(parseFormatted('2.5K')).toMatchObject({ suffix: 'K', number: 2.5 });
    expect(parseFormatted('Null')).toBeNull();
  });
});

describe('inferFormat', () => {
  it('currency with thousands separators', () => {
    const f = inferFormat([{ value: 1234.5, formatted: '$1,234.50' }, { value: 12, formatted: '$12.00' }]);
    expect(f).toEqual({ prefix: '$', suffix: '', scale: 1, thousands: true, decimals: 2 });
  });

  it('percent: raw 0.123 shown as 12.3%', () => {
    const f = inferFormat([{ value: 0.123, formatted: '12.3%' }, { value: 0.5, formatted: '50.0%' }]);
    expect(f).toMatchObject({ suffix: '%', scale: 100, decimals: 1 });
  });

  it('display units: 2,500 shown as 2.5K', () => {
    expect(inferFormat([{ value: 2500, formatted: '2.5K' }, { value: 1200, formatted: '1.2K' }])).toMatchObject({ suffix: 'K', scale: 0.001 });
  });

  it('no separator when large values are shown without one', () => {
    expect(inferFormat([{ value: 12345, formatted: '12345' }])).toMatchObject({ thousands: false });
  });

  it('gives up when samples disagree', () => {
    expect(inferFormat([{ value: 1, formatted: '$1' }, { value: 2, formatted: '2€' }])).toBeNull();
  });
});

describe('formatting', () => {
  const pct = { prefix: '', suffix: '%', scale: 100, thousands: true, decimals: 1 };
  const usd = { prefix: '$', suffix: '', scale: 1, thousands: true, decimals: 2 };

  it('ticks get just enough decimals for their step', () => {
    expect(formatTick(0.25, pct, 0.05)).toBe('25%');
    expect(formatTick(2000, usd, 500)).toBe('$2,000');
    expect(formatTick(0.5, null, 0.1)).toBe('0.5');
    expect(formatTick(-1500, usd, 500)).toBe('−$1,500');
  });

  it('summaries use the user decimals with the field affixes', () => {
    expect(formatSummary(1234.567, usd, 0)).toBe('$1,235');
    expect(formatSummary(0.4567, pct, 1)).toBe('45.7%');
    expect(formatSummary(51.04, null, 0)).toBe('51');
  });

  it('axis title drops SUM/AGG/ATTR wrappers only', () => {
    expect(axisTitle('SUM(Response Ms)')).toBe('Response Ms');
    expect(axisTitle('AVG(Profit)')).toBe('AVG(Profit)');
    expect(axisTitle('value')).toBe('value');
  });
});
