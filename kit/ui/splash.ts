import './splash.css';

// Building blocks for a viz extension's landing page: Tableau-style pills, numbered steps, feature chips.

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export function pill(text: string, kind: 'measure' | 'dimension' | 'button'): HTMLElement {
  return el('span', `sp-pill sp-${kind}`, text);
}

export function step(n: number, pills: HTMLElement[], target: string, hint: string, extra?: HTMLElement): HTMLElement {
  const li = el('li', 'sp-step');
  li.append(el('span', 'sp-num', String(n)));
  const body = el('div', 'sp-step-body');
  const line = el('div', 'sp-step-line');
  line.append(...pills, el('span', 'sp-arrow', '→'), el('b', 'sp-target', target));
  body.append(line, el('div', 'sp-hint', hint));
  if (extra) body.append(extra);
  li.append(body);
  return li;
}

export function featureChips(features: [string, string][]): HTMLElement {
  const list = el('ul', 'sp-features');
  for (const [name, what] of features) {
    const li = el('li', 'sp-feature');
    li.append(el('b', '', name), el('span', '', what));
    list.append(li);
  }
  return list;
}
