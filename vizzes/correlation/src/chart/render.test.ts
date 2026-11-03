// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildMatrix, type MatrixRecord } from './model';
import { DEFAULT_OPTIONS, type CorrOptions } from './options';
import { DEFAULT_THEME, drawOrder, formatR, renderMatrix } from './render';
import { binIdsOf } from './cells';
import { paddedExtent } from './stats';

const DIR = join(__dirname, '../../../../data/synthetic');
const noop = { onHover() {}, onSelect() {} };

/** Records from a synthetic CSV: the given measure columns, an optional colour column, row_id as the tuple id. */
function load(file: string, measures: string[], colour?: string) {
  const lines = readFileSync(join(DIR, file), 'utf8').trim().split(/\r?\n/);
  const h = lines[0].split(',');
  const records: MatrixRecord[] = lines.slice(1).map((l) => {
    const c = l.split(',');
    return {
      values: measures.map((mm) => (c[h.indexOf(mm)] === '' ? null : Number(c[h.indexOf(mm)]))),
      colour: colour ? c[h.indexOf(colour)] : null,
      tupleId: Number(c[h.indexOf('row_id')])
    };
  });
  return buildMatrix(records, measures.map((mm) => `SUM(${mm})`), colour ?? null);
}

function host(w = 700, h = 600): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: w });
  Object.defineProperty(el, 'clientHeight', { value: h });
  document.body.appendChild(el);
  return el;
}
const render = (m: ReturnType<typeof load>, o: Partial<CorrOptions> = {}, el = host()) => {
  const result = renderMatrix(el, m, { ...DEFAULT_OPTIONS, ...o }, DEFAULT_THEME, new Set(), noop);
  return { el, result };
};

describe('renderMatrix', () => {
  const health = () => load('corr_health_8.csv', ['age', 'bmi', 'blood_pressure', 'cholesterol']);

  it('labels the diagonal with the measure names (SUM() stripped) and puts k(k-1)/2 coefficients above', () => {
    const { el } = render(health());
    expect([...el.querySelectorAll('.cm-name')].map((t) => t.textContent)).toEqual(['age', 'bmi', 'blood_pressure', 'cholesterol']);
    expect(el.querySelectorAll('.cm-r')).toHaveLength(6);
    expect(el.querySelectorAll('.cm-coef')).toHaveLength(6);
  });

  it('shows the coefficient in the chosen form: Spearman when asked, nothing when blank', () => {
    const m = health();
    const pearsonText = [...render(m).el.querySelectorAll('.cm-r')].map((t) => t.textContent);
    const spearmanText = [...render(m, { coefficient: 'spearman' }).el.querySelectorAll('.cm-r')].map((t) => t.textContent);
    expect(spearmanText).not.toEqual(pearsonText);
    expect(render(m, { upper: 'blank' }).el.querySelectorAll('.cm-r')).toHaveLength(0);
  });

  it('draws a trend line per scatter, or none', () => {
    expect(render(health()).el.querySelectorAll('.cm-trend')).toHaveLength(6);
    expect(render(health(), { trendLine: false }).el.querySelectorAll('.cm-trend')).toHaveLength(0);
  });

  it('switches to density cells above the threshold, and their ids select whole bins', () => {
    const { el, result } = render(health(), { densityThreshold: 500, axisCut: { on: false, margin: 0.05 } }); // 1,000 records, no cut
    expect(result.density).toBe(true);
    const bins = [...el.querySelectorAll('.cm-bin')];
    expect(bins.length).toBeGreaterThan(6);
    const ids = bins.flatMap((b) => binIdsOf(b)!);
    expect(ids.length).toBe(1000 * 6); // every record lands in one bin per scatter
    expect(render(health()).result.density).toBe(false);
  });

  it('copes with edge cases: a constant measure shows "—", nulls only reduce their own pairs', () => {
    const m = load('corr_edge_cases.csv', ['a', 'constant', 'a_with_nulls', 'likert_1_5']);
    const { el } = render(m);
    const texts = [...el.querySelectorAll('.cm-r')].map((t) => t.textContent);
    expect(texts.filter((t) => t === '—')).toHaveLength(3); // every pair with the constant
    expect(el.innerHTML).not.toMatch(/NaN|undefined/);
  });

  it('colours by a dimension with a legend', () => {
    const m = load('corr_customers.csv', ['tenure_years', 'satisfaction'], 'channel');
    const { el, result } = render(m);
    expect(el.textContent).toContain('channel:');
    expect(result.colourField).toBe('channel');
    expect(Object.keys(result.colourAssignments!)).toEqual(expect.arrayContaining(['Online', 'In store']));
  });

  it('cross-highlights a scatter with its paired coefficient and the two names; a histogram with its row and column', () => {
    const { el } = render(health());
    const wrap = el.querySelector('.cm-wrap') as HTMLElement;
    wrap.getBoundingClientRect = () => ({ left: 0, top: 0, right: 700, bottom: 600, width: 700, height: 600, x: 0, y: 0, toJSON() {} });
    const rects = [...el.querySelectorAll('.cm-coef')].map((r) => ({ x: Number(r.getAttribute('x')), y: Number(r.getAttribute('y')), w: Number(r.getAttribute('width')) }));
    const cell = rects[0].w;
    const hover = (x: number, y: number) => wrap.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
    const coef01 = rects[0];
    const names = () => [...el.querySelectorAll('.cm-name')].map((t) => t.getAttribute('fill'));
    hover(coef01.x + cell / 2, coef01.y + cell / 2); // the coefficient of age · bmi
    expect(el.querySelectorAll('.cm-pair')).toHaveLength(2);
    expect(names().filter((f) => f !== DEFAULT_THEME.text)).toHaveLength(2);
    const nameEl = el.querySelector('.cm-name')!;
    hover(Number(nameEl.getAttribute('x')) + 4, Number(nameEl.getAttribute('y')) + 10); // age's histogram
    expect(el.querySelectorAll('.cm-pair')).toHaveLength(7); // itself + 3 in its row + 3 in its column
  });

  it('puts a box plot under each histogram (option)', () => {
    expect(render(health()).el.querySelectorAll('.cm-box').length).toBe(4 * 3);
    expect(render(health(), { diagBox: false }).el.querySelectorAll('.cm-box')).toHaveLength(0);
  });

  it("tooltips give the formula with R², and with a colour field r per member (Simpson's paradox shows)", () => {
    const m = load('corr_customers.csv', ['tenure_years', 'satisfaction'], 'channel');
    const tipText = render(m).el.querySelector('.cm-coef')!.getAttribute('data-tip')!;
    expect(tipText).toMatch(/satisfaction = −?[\d.]+ × tenure_years [+−] [\d.]+ · R² \.\d\d/);
    const perMember = [...tipText.matchAll(/(Online|In store): r (−?\.\d\d)/g)].map((x) => x[2]);
    expect(perMember).toHaveLength(2);
    perMember.forEach((r) => expect(r.startsWith('−')).toBe(false)); // positive within each channel
    expect(tipText).toMatch(/Pearson r −/); // but negative overall
  });

  it('prints the formula in each scatter when asked', () => {
    expect(render(health(), { formula: 'cell' }).el.querySelectorAll('.cm-formula')).toHaveLength(6);
    expect(render(health()).el.querySelectorAll('.cm-formula')).toHaveLength(0);
  });

  describe('brushing', () => {
    // A rendered matrix whose wrapper reports its own box, so pointer coordinates map onto cells.
    function brushable(o: Partial<CorrOptions> = {}) {
      const selections: number[][] = [];
      const el = host();
      renderMatrix(el, health(), { ...DEFAULT_OPTIONS, ...o }, DEFAULT_THEME, new Set(), { onHover() {}, onSelect: (ids) => selections.push(ids) });
      const wrap = el.querySelector('.cm-wrap') as HTMLElement;
      wrap.getBoundingClientRect = () => ({ left: 0, top: 0, right: 700, bottom: 600, width: 700, height: 600, x: 0, y: 0, toJSON() {} });
      const fire = (type: string, x: number, y: number, target: Element = wrap) =>
        target.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0, pointerId: 1 }));
      return { el, wrap, fire, selections };
    }

    it('dragging a rectangle in a scatter selects the records inside it', () => {
      const { el, fire, selections } = brushable();
      // The first trend line's clip rect is the scatter at row 1, col 0.
      const clip = el.querySelector('clipPath rect')!;
      const cx = Number(clip.getAttribute('x'));
      const cy = Number(clip.getAttribute('y'));
      const w = Number(clip.getAttribute('width'));
      fire('pointerdown', cx + 2, cy + 2);
      fire('pointermove', cx + w - 2, cy + w - 2);
      expect(el.querySelector('.cm-brush')).not.toBeNull();
      fire('pointerup', cx + w - 2, cy + w - 2);
      expect(selections).toHaveLength(1);
      expect(selections[0].length).toBeGreaterThan(900); // nearly the whole cell: almost every record
      expect(el.querySelector('.cm-brush')).toBeNull();
    });

    it('clicking a histogram bar selects the records in its range', () => {
      const { el, selections } = brushable();
      const bar = el.querySelector('.cm-bar')!;
      bar.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(selections).toHaveLength(1);
      expect(selections[0].length).toBeGreaterThan(0);
      const n = Number(/([\d,]+) records/.exec(bar.getAttribute('data-tip')!)![1].replace(/,/g, ''));
      expect(selections[0]).toHaveLength(n);
    });

    it('draws the selection over each histogram', () => {
      const m = health();
      const ids = new Set(m.records.slice(0, 100).map((r) => r.tupleId));
      const el = host();
      renderMatrix(el, m, DEFAULT_OPTIONS, DEFAULT_THEME, ids, noop);
      expect(el.querySelectorAll('.cm-bar-sel').length).toBeGreaterThan(4);
    });
  });

  describe('colour cases (corr_groups.csv)', () => {
    it('draws points in a stable shuffled order, so sorted data does not put the last member on top', () => {
      const m = load('corr_groups.csv', ['price', 'demand'], 'tier');
      const order = drawOrder(m);
      expect(order).toBe(drawOrder(m)); // cached, same every render
      expect([...order].sort((a, b) => a - b)).toEqual(m.records.map((_, n) => n)); // a permutation
      const lastQuarter = [...order].slice(-Math.floor(order.length / 4)).map((n) => m.records[n].colour);
      const premiumShare = lastQuarter.filter((c) => c === 'Premium').length / lastQuarter.length;
      expect(premiumShare).toBeLessThan(0.15); // the data has Premium last; the draw order doesn't
    });

    it('a small group gets its own r, with its n', () => {
      const m = load('corr_groups.csv', ['price', 'demand'], 'tier');
      const tipText = render(m).el.querySelector('.cm-coef')!.getAttribute('data-tip')!;
      expect(tipText).toMatch(/Premium: r −\.\d\d \(n \d\d\)/); // opposite slope, few records
      expect(tipText).toMatch(/Standard: r \.\d\d/);
    });

    it('splits each histogram by colour: outlines per member (each 100%), stacked bars, or off; stacked past 8 members', () => {
      const tier = load('corr_groups.csv', ['price', 'demand'], 'tier');
      const outlines = render(tier).el.querySelectorAll('path.cm-split');
      expect(outlines).toHaveLength(2 * 2); // 2 histograms × 2 members
      expect(render(tier, { diagSplit: 'share' }).el.querySelectorAll('rect.cm-split').length).toBeGreaterThan(0);
      expect(render(tier, { diagSplit: 'off' }).el.querySelectorAll('.cm-split')).toHaveLength(0);
      const stores = render(load('corr_groups.csv', ['price', 'demand'], 'store')).el;
      expect(stores.querySelectorAll('path.cm-split')).toHaveLength(0); // too many members for outlines
      expect(stores.querySelectorAll('rect.cm-split').length).toBeGreaterThan(0);
      const tipText = render(tier).el.querySelector('.cm-bar')!.getAttribute('data-tip')!;
      expect(tipText).toMatch(/(Standard|Premium) \d+/); // per-member counts in the bar's tooltip
    });

    it('boxes: combined by default, one per member when asked (2-4 members), combined again past 4', () => {
      const tier = load('corr_groups.csv', ['price', 'demand'], 'tier');
      const rects = (el: HTMLElement) => el.querySelectorAll('rect.cm-box').length;
      expect(rects(render(tier).el)).toBe(2); // one box per histogram
      expect(rects(render(tier, { diagBoxMode: 'colour' }).el)).toBe(2 * 2); // two members × two histograms
      expect(rects(render(load('corr_groups.csv', ['price', 'demand'], 'store'), { diagBoxMode: 'colour' }).el)).toBe(2);
    });

    it('25 members fold the smallest into Other; nulls become a "Null" member', () => {
      const stores = render(load('corr_groups.csv', ['price', 'demand'], 'store')).result;
      expect(Object.keys(stores.colourAssignments!).length).toBeLessThanOrEqual(20);
      const el = render(load('corr_groups.csv', ['price', 'demand'], 'store')).el;
      expect(el.textContent).toContain('Other');
      expect(el.innerHTML).not.toMatch(/NaN|undefined/);
    });
  });

  it('focus view: clicking a coefficient opens its pair large; it survives a redraw; Esc closes it', () => {
    const m = health();
    const el = host();
    const uncut = { ...DEFAULT_OPTIONS, axisCut: { on: false, margin: 0.05 } }; // so every record is drawn
    renderMatrix(el, m, uncut, DEFAULT_THEME, new Set(), noop);
    el.querySelector('.cm-coef')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const focus = el.querySelector('.cm-focus');
    expect(focus).not.toBeNull();
    expect(focus!.textContent).toMatch(/bmi vs age/); // first coefficient: age across, bmi up
    expect(focus!.querySelectorAll('.cm-focus-pt')).toHaveLength(1000);
    expect(focus!.querySelector('.cm-focus-facts')!.textContent).toMatch(/r \.\d\d .*ρ .*n 1,000/);
    expect(focus!.querySelectorAll('.cm-focus-box')).toHaveLength(2); // a box beside each marginal histogram
    expect(focus!.querySelectorAll('.cm-focus-mean')).toHaveLength(2); // orange mean circle on each box
    expect(focus!.querySelectorAll('.cm-focus-pct')).toHaveLength(4); // P5 and P95 on each box
    const labelText = [...focus!.querySelectorAll('.cm-focus-label')].map((l) => l.textContent).join(' ');
    for (const re of [/Median /, /P5 /, /P95 /, /Mean /]) expect(labelText).toMatch(re);
    expect(focus!.querySelector('.cm-focus-band')).not.toBeNull(); // the trend line's confidence band
    // Hovering a point hands it to Tableau (native tooltip) and shows no second tooltip of our own.
    focus!.querySelector('.cm-focus-pt')!.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }));
    expect((focus!.querySelector('.cm-tip') as HTMLElement).hidden).toBe(true); // that tip is for histogram bars only
    // The vertical box's labels follow the values: P95 near the top, P5 near the bottom (they once all piled up below).
    const vbox = focus!.querySelectorAll('.cm-focus-box')[1];
    const ly = (re: RegExp) => Number([...vbox.querySelectorAll('.cm-focus-label')].find((l) => re.test(l.textContent!))!.getAttribute('y'));
    expect(ly(/^P95/)).toBeLessThan(ly(/^Median/));
    expect(ly(/^Median/)).toBeLessThan(ly(/^P5 /));
    expect(ly(/^P5 /) - ly(/^P95/)).toBeGreaterThan(40);
    expect(focus!.querySelector('.cm-focus-reading')!.textContent).toMatch(/as age rises, bmi tends to (rise|fall).*not that one causes the other/);
    renderMatrix(el, m, uncut, DEFAULT_THEME, new Set([1, 2]), noop); // e.g. after a selection
    expect(el.querySelector('.cm-focus')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(el.querySelector('.cm-focus')).toBeNull();
    renderMatrix(el, m, DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
    expect(el.querySelector('.cm-focus')).toBeNull(); // stays closed
  });

  it('hover preview: a pause over a scatter shows the pair in the top-right corner; clicking it opens the focus view', () => {
    vi.useFakeTimers();
    try {
      const el = host(900, 800);
      renderMatrix(el, health(), DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
      const wrap = el.querySelector('.cm-wrap') as HTMLElement;
      wrap.getBoundingClientRect = () => ({ left: 0, top: 0, right: 900, bottom: 800, width: 900, height: 800, x: 0, y: 0, toJSON() {} });
      const clip = el.querySelector('clipPath rect')!; // the scatter at row 1, col 0
      const x = Number(clip.getAttribute('x')) + 20;
      const y = Number(clip.getAttribute('y')) + 20;
      wrap.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
      expect(el.querySelector('.cm-preview')).toBeNull(); // not before the pause
      vi.advanceTimersByTime(600);
      const preview = el.querySelector('.cm-preview') as HTMLElement;
      expect(preview).not.toBeNull();
      expect(preview.textContent).toMatch(/bmi vs age/);
      expect(Number(preview.style.left.replace('px', ''))).toBeGreaterThan(x); // in the opposite (top-right) corner
      preview.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(el.querySelector('.cm-preview')).toBeNull();
      expect(el.querySelector(':scope > .cm-focus')).not.toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    } finally {
      vi.useRealTimers();
    }
  });

  it('focus view brushing: drag a rectangle, hover and click a marginal bar, as in the matrix', () => {
    const picks: { ids: number[]; additive: boolean }[] = [];
    const handlers = { onHover() {}, onSelect(ids: number[], additive: boolean) { picks.push({ ids, additive }); } };
    const el = host(900, 800);
    const uncut = { ...DEFAULT_OPTIONS, axisCut: { on: false, margin: 0.05 } };
    renderMatrix(el, health(), uncut, DEFAULT_THEME, new Set(), handlers);
    el.querySelector('.cm-coef')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const focus = el.querySelector(':scope > .cm-focus') as HTMLElement;
    const svg = focus.querySelector('svg')!;
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, right: 900, bottom: 800, width: 900, height: 800, x: 0, y: 0, toJSON() {} });
    const clip = focus.querySelector('clipPath rect')!;
    const [x0, y0, size] = ['x', 'y', 'width'].map((k) => Number(clip.getAttribute(k)));
    const ev = (type: string, px: number, py: number) => svg.dispatchEvent(new PointerEvent(type, { clientX: px, clientY: py, bubbles: true, button: 0, pointerId: 1 }));
    // Drag over the whole plot: every drawn point is selected, and the drag's click selects nothing more.
    ev('pointerdown', x0 + 1, y0 + 1);
    ev('pointermove', x0 + size - 1, y0 + size - 1);
    expect(focus.querySelector('.cm-brush')).not.toBeNull();
    ev('pointerup', x0 + size - 1, y0 + size - 1);
    svg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(picks).toHaveLength(1);
    expect(picks[0].ids.length).toBe(focus.querySelectorAll('.cm-focus-pt').length);
    // A marginal bar: hover shows its range and count; click selects its records (Ctrl adds).
    const bin = focus.querySelector('.cm-focus-bin')!;
    bin.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 10, clientY: 10 }));
    const tip = focus.querySelector('.cm-tip') as HTMLElement;
    expect(tip.hidden).toBe(false);
    expect(tip.innerHTML).toMatch(/records/);
    bin.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    expect(picks[1].additive).toBe(true);
    expect(picks[1].ids.length).toBe(Number(tip.innerHTML.match(/([\d,]+) records/)![1].replace(/,/g, '')));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });

  it('hover highlight skips measures where the record is beyond a cut axis (it drew outside the cells)', () => {
    // 60 records on a grid in measures 1 and 2; record 0 is also an extreme outlier in measure 0 only.
    const recs: MatrixRecord[] = Array.from({ length: 60 }, (_, n) => ({
      values: [n === 0 ? 1000 : n % 10, (n * 7) % 11, (n * 3) % 13], colour: null, tupleId: n + 1
    }));
    const m = buildMatrix(recs, ['a', 'b', 'c']);
    const el = host(900, 800);
    renderMatrix(el, m, DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
    const wrap = el.querySelector('.cm-wrap') as HTMLElement;
    wrap.getBoundingClientRect = () => ({ left: 0, top: 0, right: 900, bottom: 800, width: 900, height: 800, x: 0, y: 0, toJSON() {} });
    // Record 0 in the scatter of b (across) and c (up): both windows are the padded data range (nothing cut there).
    const clip = el.querySelector('clipPath[id^="cm-clip-2-1-"] rect')!;
    const [x0, y0, size] = ['x', 'y', 'width'].map((k) => Number(clip.getAttribute(k)));
    const [bl, bh] = paddedExtent(m.columns[1]);
    const [cl, ch] = paddedExtent(m.columns[2]);
    const px = x0 + ((recs[0].values[1]! - bl) / (bh - bl)) * size;
    const py = y0 + size - ((recs[0].values[2]! - cl) / (ch - cl)) * size;
    wrap.dispatchEvent(new PointerEvent('pointermove', { clientX: px, clientY: py, bubbles: true }));
    expect(el.querySelectorAll('circle.cm-hl')).toHaveLength(1); // only the b–c scatter: a is cut for this record
    expect(el.querySelectorAll('line.cm-hl')).toHaveLength(2); // ticks on b's and c's histograms, none on a's
  });

  it('expand button: appears on a hovered scatter only; clicking it opens that pair\'s focus view', () => {
    const el = host(900, 800);
    renderMatrix(el, health(), DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
    const wrap = el.querySelector('.cm-wrap') as HTMLElement;
    wrap.getBoundingClientRect = () => ({ left: 0, top: 0, right: 900, bottom: 800, width: 900, height: 800, x: 0, y: 0, toJSON() {} });
    const expand = el.querySelector('.cm-expand') as HTMLButtonElement;
    expect(expand.hidden).toBe(true);
    const clip = el.querySelector('clipPath rect')!; // the scatter at row 1, col 0
    wrap.dispatchEvent(new PointerEvent('pointermove', { clientX: Number(clip.getAttribute('x')) + 20, clientY: Number(clip.getAttribute('y')) + 20, bubbles: true }));
    expect(expand.hidden).toBe(false);
    expand.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(el.querySelector(':scope > .cm-focus')!.textContent).toMatch(/bmi vs age/);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    wrap.dispatchEvent(new PointerEvent('pointermove', { clientX: 5, clientY: 5, bubbles: true })); // outside any scatter
    expect((el.querySelector('.cm-expand') as HTMLButtonElement).hidden).toBe(true);
  });

  it('outlier axis cut: dashed edges, counts beyond on the histograms, a badge whose "show all" redraws uncut', () => {
    const m = load('corr_customers.csv', ['income_k', 'spend_k']); // row 1 is the outlier (income 120, spend 20)
    const frame = document.createElement('div');
    const el = host();
    frame.appendChild(el);
    document.body.appendChild(frame);
    renderMatrix(el, m, DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
    expect(el.querySelectorAll('.cm-cut').length).toBeGreaterThan(0);
    expect(el.querySelector('.cm-beyond')!.textContent).toMatch(/1 ›|‹ 1/);
    const badge = frame.querySelector('.cm-badge') as HTMLButtonElement;
    expect(badge.textContent).toMatch(/record.* beyond the axes · show all/);
    badge.click();
    expect(el.querySelectorAll('.cm-cut')).toHaveLength(0);
    expect(frame.querySelector('.cm-badge')!.textContent).toMatch(/Showing all values/);
    (frame.querySelector('.cm-badge') as HTMLButtonElement).click(); // and back
    expect(el.querySelectorAll('.cm-cut').length).toBeGreaterThan(0);
    expect(render(m, { axisCut: { on: false, margin: 0.05 } }).el.querySelectorAll('.cm-cut')).toHaveLength(0);
  });

  it("ticks and bar ranges follow each measure's Tableau number format", () => {
    const m = health();
    m.formats = [{ prefix: '', suffix: ' yrs', scale: 1, thousands: false, decimals: 0 }, null, { prefix: '', suffix: ' mmHg', scale: 1, thousands: false, decimals: 0 }, null];
    const { el } = render(m);
    expect(el.textContent).toMatch(/\d+ yrs/);
    expect(el.textContent).toMatch(/\d+ mmHg/);
    expect([...el.querySelectorAll('.cm-bar')].some((b) => / yrs – \d+ yrs/.test(b.getAttribute('data-tip')!))).toBe(true);
  });

  it('coefficients: red/blue without a Colour field, neutral with one (auto); tiles as an option; words in the tooltip', () => {
    const fills = (el: HTMLElement) => new Set([...el.querySelectorAll('.cm-r')].map((t) => t.getAttribute('fill')));
    const plain = render(load('corr_customers.csv', ['income_k', 'spend_k', 'basket_size'])).el;
    expect([...fills(plain)].some((f) => f === '#2166ac')).toBe(true); // positive in blue
    const coloured = render(load('corr_customers.csv', ['income_k', 'spend_k', 'basket_size'], 'channel')).el;
    expect(fills(coloured)).toEqual(new Set([DEFAULT_THEME.text])); // neutral while points carry the palette
    const tiles = render(load('corr_customers.csv', ['income_k', 'spend_k']), { upper: 'tile' }).el;
    expect(Number(tiles.querySelector('.cm-coef')!.getAttribute('fill-opacity'))).toBeGreaterThan(0.3);
    const tipText = plain.querySelector('.cm-coef')!.getAttribute('data-tip')!;
    expect(tipText).toMatch(/positive: as income_k rises, spend_k tends to rise/);
    expect(tipText).toMatch(/accounts for \d+% of the variation/);
  });

  it('focus view with a Colour field: split marginals and a dashed line per group (Simpson shows)', () => {
    const m = load('corr_customers.csv', ['tenure_years', 'satisfaction'], 'channel');
    const el = host();
    renderMatrix(el, m, DEFAULT_OPTIONS, DEFAULT_THEME, new Set(), noop);
    el.querySelector('.cm-coef')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const focus = el.querySelector('.cm-focus')!;
    expect(focus.querySelectorAll('.cm-focus-group-line')).toHaveLength(2);
    expect(focus.querySelectorAll('.cm-focus-hist path').length).toBe(4); // 2 marginals × 2 members
    expect(focus.querySelector('.cm-focus-reading')!.textContent).toMatch(/Simpson/);
    expect(focus.querySelector('.cm-focus-line-label')!.textContent).toMatch(/^R² \.\d\d · y = −?[\d.]+x [+−] [\d.]+$/);
    expect([...focus.querySelectorAll('.cm-focus-group-label')].map((l) => l.textContent)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Online r \.\d\d$/), expect.stringMatching(/^In store r \.\d\d$/)]));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });

  it("the diagonal boxes carry the raincloud's markers, values on hover", () => {
    const { el } = render(health());
    expect(el.querySelectorAll('.cm-box-mean')).toHaveLength(4);
    expect(el.querySelectorAll('.cm-box-pct')).toHaveLength(8);
    expect(el.querySelector('.cm-box-hit')!.getAttribute('data-tip')).toMatch(/median .* mean .*P5 .*P95 .*n 1,000/);
    expect(render(health(), { markers: { mean: false, percentiles: [], showValues: true, decimals: 'auto' } }).el.querySelectorAll('.cm-box-mean, .cm-box-pct')).toHaveLength(0);
  });

  it('diagonal as density curves: combined, or one per colour; bars stay as invisible hit areas', () => {
    const plain = render(health(), { diag: 'density' }).el;
    expect(plain.querySelectorAll('path.cm-density')).toHaveLength(4);
    expect([...plain.querySelectorAll('.cm-bar')].every((b) => b.getAttribute('fill') === 'transparent')).toBe(true);
    const split = render(load('corr_groups.csv', ['price', 'demand'], 'tier'), { diag: 'density' }).el;
    expect(split.querySelectorAll('path.cm-density')).toHaveLength(2 * 2);
    expect(split.innerHTML).not.toMatch(/NaN|undefined/);
  });

  it('marker decimals: automatic by the spread (default), the field format, or a fixed number', () => {
    const tip = (d: CorrOptions['markers']['decimals'], measures = ['age', 'bmi', 'blood_pressure', 'cholesterol']) =>
      render(load('corr_health_8.csv', measures), { markers: { ...DEFAULT_OPTIONS.markers, decimals: d } }).el.querySelector('.cm-box-hit')!.getAttribute('data-tip')!;
    expect(DEFAULT_OPTIONS.markers.decimals).toBe('auto');
    expect(tip('auto')).toMatch(/median \d+ /); // age: a spread of decades, so whole years
    expect(tip(3)).toMatch(/median \d+\.\d{3}/);
    expect(tip(0)).toMatch(/median \d+ /);
    expect(tip('field')).toMatch(/median \d+\.\d /); // no Tableau format here: falls back to 1
  });

  it('asks for more measures with fewer than two', () => {
    const one = load('corr_health_8.csv', ['age']);
    expect(render(one).el.textContent).toMatch(/at least one more measure/);
  });

  it('formats coefficients without a leading zero and with a true minus sign', () => {
    expect(formatR(0.7012)).toBe('.70');
    expect(formatR(-0.28)).toBe('−.28');
    expect(formatR(NaN)).toBe('—');
  });
});
