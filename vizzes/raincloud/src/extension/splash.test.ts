// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderSplash } from './splash';

function host(w: number, h: number): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: w });
  Object.defineProperty(el, 'clientHeight', { value: h });
  document.body.appendChild(el);
  return el;
}

describe('landing page', () => {
  it('large frame: steps, live hero and four option thumbnails', () => {
    const el = host(900, 600);
    renderSplash(el);
    expect(el.querySelectorAll('.sp-step')).toHaveLength(4);
    expect(el.querySelector('.sp-hero svg')).not.toBeNull();
    expect(el.querySelectorAll('.sp-thumb')).toHaveLength(5);
    expect(el.querySelectorAll('.sp-thumb svg')).toHaveLength(5);
    expect(el.textContent).toContain('Format Extension');
    expect(el.querySelectorAll('.sp-feature')).toHaveLength(6);
    expect(el.innerHTML).not.toMatch(/NaN|undefined/);
  });

  it('medium frame: steps and hero, no thumbnails', () => {
    const el = host(520, 340);
    renderSplash(el);
    expect(el.querySelectorAll('.sp-step')).toHaveLength(4);
    expect(el.querySelector('.sp-hero')).not.toBeNull();
    expect(el.querySelector('.sp-thumbs')).toBeNull();
  });

  it('small frame: just the title and steps', () => {
    const el = host(320, 240);
    renderSplash(el);
    expect(el.querySelectorAll('.sp-step')).toHaveLength(4);
    expect(el.querySelector('.sp-hero')).toBeNull();
    // The Format Extension prompt and feature hints show even in the smallest frame.
    expect(el.textContent).toContain('Format Extension');
    expect(el.querySelectorAll('.sp-feature')).toHaveLength(6);
  });
});

describe('landing page examples', () => {
  it('hero rows are Normal, Bimodal, Right-skewed in that order', () => {
    const el = host(900, 600);
    renderSplash(el);
    const labels = [...el.querySelectorAll('.sp-hero text')].map((t) => t.textContent);
    const order = ['Normal', 'Bimodal', 'Right-skewed'].map((s) => labels.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe('landing page hero options', () => {
  it('hero: three shape panels with their own axes and summary labels', () => {
    const el = host(900, 640);
    renderSplash(el);
    const hero = el.querySelector('.sp-hero')!;
    expect(hero.querySelector('svg')).not.toBeNull();
    expect(hero.textContent).toMatch(/Median \d+/);
    for (const s of ['Normal', 'Bimodal', 'Right-skewed', 'Group A', 'Group B']) expect(hero.textContent).toContain(s);
    expect(el.innerHTML).not.toMatch(/NaN|undefined/);
  });

  it('thumbnail titles sit above their charts', () => {
    const el = host(900, 640);
    renderSplash(el);
    const card = el.querySelector('.sp-thumb')!;
    expect(card.firstElementChild?.tagName).toBe('FIGCAPTION');
  });
});
