import { assignColours } from '@kit/colours';
import { renderFocus } from '../chart/focus';
import { DEFAULT_OPTIONS, type CorrOptions } from '../chart/options';
import { DEFAULT_THEME, renderMatrix } from '../chart/render';
import { buildMatrix } from '../chart/model';
import { HEALTH, iceCreamRecords, sample } from '../extension/splash';
import '../chart/chart.css';

// Website images: showcase.html?view=<name>&w=<px>&h=<px> draws one view from the landing page's seeded sample data,
// for headless Chrome to screenshot (see docs/RELEASE.md, "Website images"). Dev only, not built.

const { AGE, HEIGHT, WEIGHT, MAX_HR, EXERCISE, CHOLESTEROL } = HEALTH;
const noop = { onHover() {}, onSelect() {} };
const focusHandlers = { ...noop, onClose() {} };
const opts = (o: Partial<CorrOptions> = {}): CorrOptions => ({ ...structuredClone(DEFAULT_OPTIONS), ...o });

const VIEWS: Record<string, (host: HTMLElement) => void> = {
  hero: (h) => renderMatrix(h, sample([AGE, MAX_HR, HEIGHT, WEIGHT, EXERCISE], null, 400, true), opts(), DEFAULT_THEME, new Set(), noop),
  focus: (h) => renderFocus(h, sample([HEIGHT, WEIGHT], null, 400, true), 0, 1, opts(), null, DEFAULT_THEME, new Set(), focusHandlers),
  simpson: (h) => {
    const m = sample([EXERCISE, CHOLESTEROL], 'ageGroup', 400, true);
    renderFocus(h, m, 0, 1, opts(), assignColours(m.colourMembers), DEFAULT_THEME, new Set(), focusHandlers);
  },
  icecream: (h) => {
    const m = buildMatrix(iceCreamRecords(), ['Ice cream sales', 'Drownings'], 'Season');
    renderFocus(h, m, 0, 1, opts(), assignColours(m.colourMembers), DEFAULT_THEME, new Set(), focusHandlers);
  },
  density: (h) => renderMatrix(h, sample([AGE, HEIGHT, WEIGHT], 'sex', 400, true),
    opts({ diag: 'density' }), DEFAULT_THEME, new Set(), noop),
  bigdata: (h) => renderMatrix(h, sample([AGE, HEIGHT, WEIGHT], null, 20000, true), opts({ points: 'density' }), DEFAULT_THEME, new Set(), noop),
  tiles: (h) => renderMatrix(h, sample([AGE, MAX_HR, HEIGHT, WEIGHT, EXERCISE], null, 400, true), opts({ upper: 'tile' }), DEFAULT_THEME, new Set(), noop)
};

const q = new URLSearchParams(location.search);
const host = document.getElementById('chart')!;
host.style.width = `${q.get('w') ?? 800}px`;
host.style.height = `${q.get('h') ?? 800}px`;
(VIEWS[q.get('view') ?? 'hero'] ?? VIEWS.hero)(host);
