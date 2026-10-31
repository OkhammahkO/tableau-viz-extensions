import type { RaincloudOptions } from '../charts/raincloud/options';
import {
  BINS, CLOUDS, RAINS, SMOOTHING_STEPS, TABLEAU_10, parsePercentiles, sliderFromSmoothing, smoothingFromSlider, startDialog, type DialogSession
} from './shared';
import './lite.css';

// Format dialog prototype B: no framework, native controls styled to resemble Tableau's format panes.
// The whole form is rebuilt from the options on each change (it's tiny), which keeps it simple.

const root = document.getElementById('root')!;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...kids: (Node | string | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v as EventListener);
    else if (k in el) (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids) if (kid !== false) el.append(kid);
  return el;
}

let uid = 0;
function field(label: string, control: HTMLElement): HTMLElement {
  control.id ||= `f${++uid}`;
  return h('div', { className: 'field' }, h('label', { htmlFor: control.id }, label), control);
}

function select(value: string, choices: readonly (readonly [string, string])[], onChange: (v: string) => void): HTMLSelectElement {
  const s = h('select', { onchange: () => onChange(s.value) }, ...choices.map(([v, l]) => h('option', { value: v }, l)));
  s.value = value;
  return s;
}

function check(label: string, checked: boolean, onChange: (v: boolean) => void, kind: 'checkbox' | 'switch' = 'checkbox'): HTMLElement {
  const input = h('input', { type: 'checkbox', checked, onchange: () => onChange(input.checked) });
  if (kind === 'switch') input.setAttribute('role', 'switch');
  return h('label', { className: kind === 'switch' ? 'switch' : 'check' }, input, h('span', {}, label));
}

function number(value: number, min: number, max: number, step: number, onChange: (v: number) => void): HTMLInputElement {
  const n = h('input', { type: 'number', value: String(value), min: String(min), max: String(max), step: String(step) });
  n.addEventListener('change', () => { const v = Number(n.value); if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v))); });
  return n;
}

function section(title: string, open: boolean, ...kids: (Node | false)[]): HTMLElement {
  const d = h('details', { className: 'section', open }, h('summary', {}, title), h('div', { className: 'stack' }, ...kids));
  d.dataset.title = title;
  return d;
}

function render(s: DialogSession): void {
  const o = s.options;
  const openState = new Map([...root.querySelectorAll<HTMLDetailsElement>('details')].map((d) => [d.dataset.title, d.open]));
  const isOpen = (t: string, dflt: boolean) => openState.get(t) ?? dflt;
  const set = (next: RaincloudOptions) => { s.update(next); render(s); };

  const pct = h('input', { type: 'text', placeholder: 'e.g. 10, 90', value: o.markers.percentiles.join(', ') });
  pct.addEventListener('change', () => set({ ...o, markers: { ...o.markers, percentiles: parsePercentiles(pct.value) } }));

  const bwLabel = h('span', { className: 'value' }, `${o.bandwidth.toFixed(2)}×`);
  const bw = h('input', { type: 'range', min: '0', max: String(SMOOTHING_STEPS), step: '1', value: String(sliderFromSmoothing(o.bandwidth)) });
  // Live while dragging (no rebuild, so the drag isn't interrupted); rebuild on release so other controls see the new value.
  bw.addEventListener('input', () => {
    const v = smoothingFromSlider(Number(bw.value));
    bwLabel.textContent = `${v.toFixed(2)}×`;
    s.update({ ...o, bandwidth: v });
  });
  bw.addEventListener('change', () => render(s));

  const swatches = h('div', { className: 'swatches', role: 'radiogroup', 'aria-label': 'Mark colour' },
    ...TABLEAU_10.map((c) => h('button', {
      type: 'button', className: 'swatch', title: c, role: 'radio', 'aria-checked': String(c === o.color),
      style: `background:${c}`, onclick: () => set({ ...o, color: c })
    })));

  const cut = o.axis.range !== 'data';
  root.replaceChildren(
    h('div', { className: 'body' },
      section('Cloud', isOpen('Cloud', true),
        field('Shape', select(o.cloud, CLOUDS, (v) => set({ ...o, cloud: v as RaincloudOptions['cloud'] }))),
        o.cloud === 'density' && h('div', { className: 'field' }, h('label', {}, 'Smoothing ', bwLabel), bw,
          h('div', { className: 'scale' }, h('span', {}, 'Less'), h('span', {}, 'More'))),
        o.cloud === 'histogram' && field('Bins', select(String(o.bins), BINS.map((b) => [b, b === 'auto' ? 'Automatic' : b] as const),
          (v) => set({ ...o, bins: v === 'auto' ? 'auto' : Number(v) })))),
      section('Rain', isOpen('Rain', true),
        field('Points', select(o.rain, RAINS, (v) => set({ ...o, rain: v as RaincloudOptions['rain'] })))),
      section('Summary', isOpen('Summary', true),
        check('Box plot', o.lightning === 'box', (v) => set({ ...o, lightning: v ? 'box' : 'none' })),
        check('Mean marker', o.markers.mean, (v) => set({ ...o, markers: { ...o.markers, mean: v } })),
        field('Percentile markers', pct),
        check('Show values on markers', o.markers.showValues, (v) => set({ ...o, markers: { ...o.markers, showValues: v } }))),
      section('Axis', isOpen('Axis', true),
        check('Cut outliers from the axis', cut, (v) => set({ ...o, axis: { ...o.axis, range: v ? 'whiskers' : 'data' } }), 'switch'),
        cut && field('Cut at', select(o.axis.range, [['whiskers', 'Whiskers + margin'], ['percentile', 'Percentiles']],
          (v) => set({ ...o, axis: { ...o.axis, range: v as 'whiskers' | 'percentile' } }))),
        cut && o.axis.range === 'whiskers' && field('Margin (%)', number(Math.round(o.axis.margin * 100), 0, 50, 1,
          (v) => set({ ...o, axis: { ...o.axis, margin: v / 100 } }))),
        cut && o.axis.range === 'percentile' && h('div', { className: 'row' },
          field('Low', number(o.axis.low, 0, 49, 0.5, (v) => set({ ...o, axis: { ...o.axis, low: v } }))),
          field('High', number(o.axis.high, 51, 100, 0.5, (v) => set({ ...o, axis: { ...o.axis, high: v } })))),
        cut && h('p', { className: 'note' }, 'Statistics always use all values; values outside the axis are counted at the edges.')),
      section('Colour', isOpen('Colour', false), swatches)),
    h('div', { className: 'actions' },
      h('button', { type: 'button', className: 'btn', onclick: () => { s.reset(); render(s); } }, 'Reset'),
      h('button', { type: 'button', className: 'btn primary', onclick: () => s.close() }, 'Done'))
  );
}

startDialog()
  .then(render)
  .catch((err) => {
    console.error('[format] init failed', err);
    root.textContent = `Could not open the Format dialog: ${err}`;
  });
