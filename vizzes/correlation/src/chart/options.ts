import { decimalsForSpan, type NumberFormat } from '@kit/format';
import { quantile } from '@kit/stats';
import type { Coefficient } from './stats';

// Every user-facing setting of the correlation matrix (decisions: docs/concepts/correlation-matrix/README.md).

export interface CorrOptions {
  /** Shown above the diagonal; hover always shows both. Pearson by default, Spearman ρ as an option. */
  coefficient: Coefficient;
  /** Thin least-squares line in each scatter. */
  trendLine: boolean;
  /** The line's formula and R²: in the coefficient's tooltip (default), or also printed in each scatter. */
  formula: 'tooltip' | 'cell';
  /** The diagonal: bars, or a smooth density curve (the raincloud's cloud; the ggpairs default). */
  diag: 'histogram' | 'density';
  /** Slim box plot (median, quartiles, Tukey whiskers) under each histogram. */
  diagBox: boolean;
  /**
   * With a Colour field: one combined box (default, as the raincloud keeps its box combined) or one thin box per
   * member in its colour, to compare group medians and spreads. Per colour works for 2–4 members; more fall back to
   * combined (user, 2026-11-02).
   */
  diagBoxMode: 'combined' | 'colour';
  /**
   * Markers on the boxes, as in the raincloud (user, 2026-11-03): an orange hollow mean circle and dashed percentile
   * ticks; values labelled in the focus view (the matrix's small boxes show them on hover). `decimals`: 'auto' (the
   * default) suits the data's spread (`decimalsForSpan`); 'field' follows the field's Tableau format; or a number.
   */
  markers: { mean: boolean; percentiles: number[]; showValues: boolean; decimals: 'auto' | 'field' | number };
  /**
   * With a Colour field, split each histogram by member, as the raincloud splits its cloud. 'each' (default): one
   * outline per member, each its own 100%, to compare shapes (a 5% group stays visible); 'share': bars stacked by
   * member, to compare sizes; 'off': one combined histogram. Past 8 members 'each' falls back to stacked bars.
   */
  diagSplit: 'each' | 'share' | 'off';
  /** Above the diagonal: the number sized by strength on a light tile, a shaded tile with a plain number, a plain
   *  number, or nothing. */
  upper: 'number' | 'tile' | 'plain' | 'blank';
  /**
   * Coefficient colour (user, 2026-11-03): red/blue for negative/positive while the marks are grey; neutral grey when a
   * Colour field gives the marks hues, so each colour has one meaning in the view ('auto', default). Or always one.
   */
  coefColour: 'auto' | 'diverging' | 'neutral';
  /**
   * Scatters: every point, or density cells (shaded bins; hover shows the count, click selects the bin's records).
   * 'auto' switches to density cells above `densityThreshold` records.
   */
  points: 'auto' | 'points' | 'density';
  densityThreshold: number;
  /**
   * Outlier axis cut, as in the raincloud (user, 2026-11-02): each measure's axis spans its Tukey whiskers plus
   * `margin` (5%); statistics always use every value. Cut edges are dashed, histograms count what's beyond, and a
   * badge lets viewers show all values (not saved).
   */
  axisCut: { on: boolean; margin: number };
  /** Mark colour when the Colour tile is empty: grey, so red/blue on the coefficients is the only hue (user, 2026-11-03). */
  color: string;
  colour: {
    showLegend: boolean;
    /** Remembered member → colour, per Colour field (stable colours, as in the raincloud). */
    assigned: Record<string, Record<string, string>>;
  };
}

export const DEFAULT_OPTIONS: CorrOptions = {
  coefficient: 'pearson',
  trendLine: true,
  formula: 'tooltip',
  diag: 'histogram',
  diagBox: true,
  diagBoxMode: 'combined',
  markers: { mean: true, percentiles: [5, 95], showValues: true, decimals: 'auto' },
  diagSplit: 'each',
  upper: 'number',
  coefColour: 'auto',
  points: 'auto',
  densityThreshold: 5000,
  axisCut: { on: true, margin: 0.05 },
  color: '#8a9097',
  colour: { showLegend: true, assigned: {} }
};

/**
 * Decimals for a measure's marker values: automatic (by the spread of its values: AVG fields often carry many
 * decimals in their Tableau format), the field's format (else 1), or the user's number.
 */
export function markerDecimals(opts: CorrOptions, fieldFormat: NumberFormat | null | undefined, values: number[]): number {
  const d = opts.markers.decimals;
  if (d === 'field') return fieldFormat?.decimals ?? 1;
  if (d !== 'auto') return d;
  if (values.every((v) => Number.isInteger(v))) return 0; // counts, whole years: never "47.0"
  return decimalsForSpan(quantile(values, 0.95) - quantile(values, 0.05), fieldFormat?.scale ?? 1);
}
