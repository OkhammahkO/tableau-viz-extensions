// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { pairStats } from '../chart/stats';
import { iceCreamRecords, renderSplash, sampleRecords } from './splash';

describe('landing page (draft)', () => {
  it('shows the four steps and, with room, a live mini matrix from the sample data', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { value: 900 });
    Object.defineProperty(el, 'clientHeight', { value: 600 });
    document.body.appendChild(el);
    renderSplash(el);
    expect(el.querySelectorAll('.sp-step')).toHaveLength(4);
    expect(el.textContent).toContain('Measures');
    expect(el.querySelector('.cm-splash-hero')).not.toBeNull();
    const thumbs = [...el.querySelectorAll('.sp-thumb')];
    expect(thumbs.map((t) => t.querySelector('b')!.textContent)).toEqual(['Look closer', 'Colour can flip a trend', "Correlation isn't cause", 'Smooth or bars', 'Big data', 'Tiles']);
    expect(el.querySelector('.cm-not-cause')!.textContent).toMatch(/not that one causes the other/);
    expect(thumbs[0].querySelector('.cm-focus')).not.toBeNull(); // live focus view
    expect(thumbs[1].querySelectorAll('.cm-focus-group-line')).toHaveLength(2); // the Simpson thumbnail's group lines
    expect(thumbs[4].querySelectorAll('.cm-bin').length).toBeGreaterThan(0); // density cells
    expect(el.innerHTML).not.toMatch(/NaN|undefined/);
  });

  it('sample data is seeded: the same records every time', () => {
    expect(sampleRecords()).toEqual(sampleRecords());
    expect(sampleRecords()).toHaveLength(400);
    expect(sampleRecords(3000)).toHaveLength(3000);
  });

  it('the health sample shows what the landing page claims (strong +, strong −, Simpson)', () => {
    const recs = sampleRecords(1000);
    const col = (j: number, keep: (c: string | null) => boolean = () => true) => recs.filter((r) => keep(r.colour)).map((r) => r.values[j]);
    expect(pairStats(col(1), col(2)).pearson).toBeGreaterThan(0.5); // height, weight
    expect(pairStats(col(0), col(3)).pearson).toBeLessThan(-0.7); // age, max heart rate
    expect(pairStats(col(4), col(5)).pearson).toBeGreaterThan(0.25); // exercise, cholesterol: positive overall …
    for (const g of ['Under 45', '45 and over']) {
      expect(pairStats(col(4, (c) => c === g), col(5, (c) => c === g)).pearson).toBeLessThan(-0.15); // … negative within each age group
    }
  });

  it('ice cream and drownings: strong overall, much weaker within a season (a confounder)', () => {
    const recs = iceCreamRecords();
    const col = (j: number, season?: string) => recs.filter((r) => !season || r.colour === season).map((r) => r.values[j]);
    expect(pairStats(col(0), col(1)).pearson).toBeGreaterThan(0.6);
    for (const s of ['Summer', 'Winter']) expect(pairStats(col(0, s), col(1, s)).pearson).toBeLessThan(0.4);
  });
});
