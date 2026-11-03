import { buildMatrix, type Matrix, type MatrixRecord } from '../chart/model';
import { DEFAULT_OPTIONS, type CorrOptions } from '../chart/options';
import { DEFAULT_THEME, renderMatrix } from '../chart/render';
import { renderFocus } from '../chart/focus';
import { assignColours } from '@kit/colours';
import { el, featureChips, pill, step } from '@kit/ui/splash';

// The getting-started screen shown until two measures are on Measures (approved 2026-11-03), laid out like
// the raincloud's: four Tableau-style steps beside a live hero, then "Make it yours" thumbnails of looks people
// wouldn't otherwise find. Everything is drawn by the real engine from seeded sample data. Adapts to the frame:
// thumbnails need room, the hero needs a little; the steps always stay.

/**
 * Seeded sample people with familiar health relationships (user, 2026-11-03: "more scientific things people are
 * familiar with"): height and weight (strong positive), age and maximum heart rate (strong negative, the
 * "208 − 0.7 × age" rule of thumb), and exercise and cholesterol, the textbook Simpson's paradox: within each age group
 * more exercise goes with lower cholesterol, but older people both exercise more and have higher cholesterol, so
 * overall the trend looks the other way. Two groupings: age group and sex.
 */
interface Person { values: number[]; ageGroup: string; sex: string; tupleId: number }

const MEASURES = ['Age', 'Height (cm)', 'Weight (kg)', 'Max heart rate', 'Exercise (h/week)', 'Cholesterol (mg/dL)'];
/** Without units, for the small matrices: their diagonal labels have little room. */
const SHORT = ['Age', 'Height', 'Weight', 'Max HR', 'Exercise', 'Cholesterol'];
/** Indexes of the sample measures (also used by the website's showcase images). */
export const HEALTH = { AGE: 0, HEIGHT: 1, WEIGHT: 2, MAX_HR: 3, EXERCISE: 4, CHOLESTEROL: 5 } as const;
const { AGE, HEIGHT, WEIGHT, MAX_HR, EXERCISE, CHOLESTEROL } = HEALTH;

function people(n: number): Person[] {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const norm = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
  return Array.from({ length: n }, (_, i) => {
    const female = i % 2 === 0;
    const age = 20 + rand() * 60;
    const older = age >= 45;
    const height = (female ? 163 : 177) + norm() * 7;
    const weight = 22.5 * (height / 100) ** 2 * Math.exp(norm() * 0.12) + 0.12 * (age - 50);
    const maxHr = 208 - 0.7 * age + norm() * 7;
    const exercise = Math.max(0.3, (older ? 7 : 1.8) + norm());
    const cholesterol = 140 + 2.2 * age - 6 * exercise + norm() * 9;
    return {
      values: [age, height, weight, maxHr, exercise, cholesterol].map((v) => Math.round(v * 10) / 10),
      ageGroup: older ? '45 and over' : 'Under 45',
      sex: female ? 'Female' : 'Male',
      tupleId: i + 1
    };
  });
}

/**
 * The classic spurious correlation: ice cream sales and drownings rise together because hot weather drives both (a
 * confounder). Within a season, where the temperature varies little, the link largely fades. Coloured by season.
 */
export function iceCreamRecords(n = 240): MatrixRecord[] {
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const norm = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
  return Array.from({ length: n }, (_, i) => {
    const summer = i % 2 === 1; // Winter first, so it takes the first colour (blue) and Summer orange
    const temp = (summer ? 26 : 8) + norm() * 1.2;
    const iceCream = 40 + 6 * temp + norm() * 18;
    const drownings = Math.max(0, 0.5 + 0.18 * temp + norm() * 1.1);
    return { values: [Math.round(iceCream), Math.round(drownings * 10) / 10], colour: summer ? 'Summer' : 'Winter', tupleId: i + 1 };
  });
}

/** The sample as matrix records, coloured by age group (used by tests and as a default). */
export function sampleRecords(n = 400): MatrixRecord[] {
  return people(n).map((p) => ({ values: p.values, colour: p.ageGroup, tupleId: p.tupleId }));
}

/** A matrix of some sample measures (by index), optionally coloured by age group or sex; short names unless `units`. */
export function sample(cols: number[], colour: 'ageGroup' | 'sex' | null, n = 400, units = false): Matrix {
  const recs = people(n).map((p) => ({ values: cols.map((j) => p.values[j]), colour: colour ? p[colour] : null, tupleId: p.tupleId }));
  return buildMatrix(recs, cols.map((j) => (units ? MEASURES : SHORT)[j]), colour === 'ageGroup' ? 'Age group' : colour === 'sex' ? 'Sex' : null);
}

const FEATURES: [string, string][] = [
  ['Coefficient', 'Pearson r or Spearman ρ'],
  ['Outliers', 'cut automatically · show all'],
  ['Big data', 'density cells, still selectable'],
  ['Look closer', 'click a number or a scatter\'s ⤢']
];

const noop = { onHover() {}, onSelect() {} };
// Landing-page charts: no outlier badge, no legend clutter.
const quiet = (o: Partial<CorrOptions> = {}): CorrOptions =>
  ({ ...structuredClone(DEFAULT_OPTIONS), axisCut: { ...DEFAULT_OPTIONS.axisCut, on: false }, ...o });

// Three focus views (taller) above three small matrices; no wide card (it left the grid's second row half empty).
interface Thumb { title: string; note: string; kind: 'focus' | 'matrix'; draw(host: HTMLElement): void }

const THUMBS: Thumb[] = [
  {
    title: 'Look closer', note: 'click a number or ⤢: one pair, large', kind: 'focus',
    draw: (h) => renderFocus(h, sample([HEIGHT, WEIGHT], null, 400, true), 0, 1, quiet(), null, DEFAULT_THEME, new Set(), { ...noop, onClose() {} })
  },
  {
    title: 'Colour can flip a trend', note: 'more exercise, lower cholesterol in each age group', kind: 'focus',
    draw: (h) => {
      const m = sample([EXERCISE, CHOLESTEROL], 'ageGroup', 400, true);
      renderFocus(h, m, 0, 1, quiet(), assignColours(m.colourMembers), DEFAULT_THEME, new Set(), { ...noop, onClose() {} });
    }
  },
  {
    title: 'Correlation isn\'t cause', note: 'both rise in hot weather; within a season the link fades', kind: 'focus',
    draw: (h) => {
      const m = buildMatrix(iceCreamRecords(), ['Ice cream sales', 'Drownings'], 'Season');
      renderFocus(h, m, 0, 1, quiet(), assignColours(m.colourMembers), DEFAULT_THEME, new Set(), { ...noop, onClose() {} });
    }
  },
  {
    title: 'Smooth or bars', note: 'density curves, here split by sex', kind: 'matrix',
    draw: (h) => renderMatrix(h, sample([HEIGHT, WEIGHT], 'sex'), quiet({ diag: 'density', colour: { ...DEFAULT_OPTIONS.colour, showLegend: false } }), DEFAULT_THEME, new Set(), noop)
  },
  {
    title: 'Big data', note: 'density cells, still selectable', kind: 'matrix',
    draw: (h) => renderMatrix(h, sample([HEIGHT, WEIGHT], null, 3000), quiet({ points: 'density' }), DEFAULT_THEME, new Set(), noop)
  },
  {
    title: 'Tiles', note: 'shaded tiles instead of sized numbers', kind: 'matrix',
    draw: (h) => renderMatrix(h, sample([AGE, MAX_HR, WEIGHT], null), quiet({ upper: 'tile', diagBox: false }), DEFAULT_THEME, new Set(), noop)
  }
];

export function renderSplash(host: HTMLElement): void {
  host.replaceChildren();
  const W = host.clientWidth || 600;
  const H = host.clientHeight || 400;
  const roomy = W >= 640 && H >= 400;
  const medium = W >= 420 && H >= 300;
  const page = el('div', `sp-page ${roomy ? 'sp-roomy' : medium ? 'sp-medium' : 'sp-small'}`);
  const head = el('header', 'sp-head');
  head.append(el('h1', 'sp-title', 'Correlation matrix'),
    el('p', 'sp-lede', 'See how your measures relate: every pair as a scatter, each measure\'s distribution, and how strongly they move together.'));
  page.append(head);

  const main = el('div', 'sp-main');
  const steps = el('ol', 'sp-steps');
  steps.append(
    step(1, [pill('AVG(Age)', 'measure'), pill('AVG(Height)', 'measure'), pill('AVG(Weight)', 'measure')], 'Measures', 'Two to eight measures to compare, in the order you want them.'),
    step(2, [pill('Row ID', 'dimension')], 'Detail', 'One point per record (or turn off Analysis → Aggregate Measures).'),
    step(3, [pill('Age group', 'dimension')], 'Colour', 'Optional: colours the points and splits each histogram by group.'),
    step(4, [pill('Format Extension', 'button')], 'Fine-tune', 'Below the tiles on the Marks card.', featureChips(FEATURES))
  );
  main.append(steps);
  if (medium) {
    const hero = el('div', 'sp-hero cm-splash-hero');
    hero.setAttribute('aria-hidden', 'true');
    main.append(hero);
  }
  page.append(main);

  if (roomy) {
    const more = el('section', 'sp-more');
    const grid = el('div', 'sp-thumbs cm-thumbs');
    for (const t of THUMBS) {
      const card = el('figure', `sp-thumb cm-thumb-${t.kind}`);
      const chart = el('div', 'sp-thumb-chart cm-thumb-chart');
      chart.setAttribute('aria-hidden', 'true');
      const cap = el('figcaption');
      cap.append(el('b', '', t.title), el('span', '', t.note));
      card.append(cap, chart); // title and note above the picture, as in the raincloud
      grid.append(card);
      (card as HTMLElement & { _thumb?: Thumb })._thumb = t;
    }
    more.append(el('h2', 'sp-more-title', 'Make it yours'), el('p', 'sp-more-hint', 'A few of the views and looks in this extension:'), grid,
      el('p', 'sp-more-hint cm-not-cause', 'Remember: correlation shows that two measures move together, not that one causes the other.'));
    page.append(more);
  }
  host.append(page);

  // Draw the live charts now that their boxes have sizes.
  const hero = page.querySelector<HTMLElement>('.cm-splash-hero');
  // Hero: a strong negative (age, max heart rate), a strong positive (height, weight) and near-zero pairs.
  if (hero) renderMatrix(hero, sample([AGE, MAX_HR, HEIGHT, WEIGHT], null), quiet(), DEFAULT_THEME, new Set(), noop);
  page.querySelectorAll<HTMLElement>('.sp-thumb').forEach((card) => {
    const t = (card as HTMLElement & { _thumb?: Thumb })._thumb!;
    t.draw(card.querySelector<HTMLElement>('.cm-thumb-chart')!);
  });
}
