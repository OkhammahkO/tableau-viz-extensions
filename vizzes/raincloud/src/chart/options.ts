import type { SizeOptions } from '@kit/grid/layout';
import type { TickDensity } from '@kit/grid/ticks';

// Every user-facing setting lives here. The Format dialog edits this object via Tableau settings.

export type CloudType = 'density' | 'histogram' | 'none';
export type RainType = 'dots' | 'strip' | 'none';
export type LightningType = 'box' | 'none';
export type { TickDensity };
export type Density = 'comfortable' | 'compact' | 'dense';

/**
 * Layout density (user, 2026-11-02: dense small multiples). Sets the smallest row and the spacing (including the gaps
 * between cloud, box and rain: `laneGap`, a minimum and a fraction of the row height); Compact and Dense
 * draw tick labels once under each block of rows instead of under every cell when Columns is used. Thinning by the
 * actual row height (marker labels, n, box size) applies at every density.
 */
export const DENSITY: Record<Density, { minRow: number; pad: number; gap: number; ticksPerBlock: boolean; laneGap: { min: number; frac: number } }> = {
  comfortable: { minRow: 64, pad: 8, gap: 14, ticksPerBlock: false, laneGap: { min: 6, frac: 0.06 } },
  compact: { minRow: 40, pad: 6, gap: 10, ticksPerBlock: true, laneGap: { min: 3, frac: 0.035 } },
  dense: { minRow: 24, pad: 4, gap: 6, ticksPerBlock: true, laneGap: { min: 2, frac: 0.02 } }
};

export interface RaincloudOptions {
  cloud: CloudType;
  rain: RainType;
  lightning: LightningType;
  /**
   * Where the box sits (user, 2026-11-02, in review): 'lane' its own lane between cloud and rain (v1.0), 'baseline'
   * centred on the cloud's baseline, 'inside' within the cloud on its baseline. 'auto' (default) follows the density:
   * Comfortable → lane, Compact → baseline, Dense → inside.
   */
  boxPosition: 'auto' | 'lane' | 'baseline' | 'inside';
  /** Multiplier on Silverman's bandwidth (density cloud). */
  bandwidth: number;
  /** Histogram bin count; 'auto' uses Sturges on the largest group. */
  bins: number | 'auto';
  /** Below this many values a group gets no density curve (it would pretend to know the shape). */
  minNForDensity: number;
  /**
   * Axis range. Statistics always use all data; values outside the view are counted at the edges.
   * - 'data': everything.
   * - 'percentile': [low, high] percentiles of all values pooled across groups.
   * - 'whiskers': the outermost Tukey whiskers across groups, plus `margin` × that span on each side
   *   (never beyond the data). Cuts exactly the points the box plot treats as outliers.
   * Decision (user, 2026-10-31, revised): **on by default** as 'whiskers' + 5%. With no outliers it hides nothing
   * (the window equals the data range); when it does hide values, an amber badge says so and lets viewers show all.
   */
  axis: {
    range: 'data' | 'percentile' | 'whiskers'; low: number; high: number; margin: number;
    /** Axis title (user, 2026-11-02): 'auto' = the field name without SUM()/AGG()/ATTR(); 'custom' = `title`. */
    titleMode: 'auto' | 'hidden' | 'custom';
    title: string;
    /** How many ticks 'auto' picks (user: the old spacing felt too sparse). */
    ticks: TickDensity;
    /** Fixed tick interval in field units, like Tableau's "Fixed" tick marks; 0 = automatic. */
    tickStep: number;
    gridlines: boolean;
  };
  /**
   * Cumulative line (ECDF) over the cloud (user, 2026-11-02; off by default): share of records ≤ each value. Follows
   * the cloud: one line per colour member when the cloud is split, else one combined line. A second scale in the cloud area, so it's drawn Pareto-style: its own 0 / 50 / 100% labels on
   * the right edge, a faint 50% guide (it crosses at the median) and a hover readout ("62% of records ≤ 45").
   */
  ecdf: boolean;
  /** Mark colour; Tableau's default blue. */
  color: string;
  /** Layout fit (F14), named like Tableau's Fit menu. */
  size: SizeOptions;
  density: Density;
  /** Colour tile (F4). The box always stays combined (user decision). */
  colour: {
    /** Split the cloud into one curve per colour member, scaled by its share (histogram: stacked bars). */
    splitCloud: boolean;
    /**
     * Split cloud sizing (user, 2026-11-02; default 'each'). 'each': every colour is its own 100% (histogram:
     * overlaid outlines), to compare sub-group shapes, even small ones. 'share': each colour's curve is scaled by its
     * share of the slice, so the colours add up to the whole (histogram: stacked bars).
     */
    cloudSizing: 'share' | 'each';
    /** Show the colour legend above the grid. */
    showLegend: boolean;
    /** Remembered member → colour, per Colour field, so filters never repaint members (stable colours). */
    assigned: Record<string, Record<string, string>>;
  };
  /** Rows/Columns panels (F2). */
  panels: {
    /** With one Columns dimension: panels per row before wrapping. 'auto' = as many as fit at a readable width. */
    wrap: 'auto' | number;
    /** 'shared': one value range across all panels; 'independent': each column fits its own data. */
    axis: 'shared' | 'independent';
  };
  /**
   * How cells scale against each other (user, 2026-11-02), so one spiky cell no longer squashes the others.
   * cloudHeight 'independent' (default): each cloud's peak reaches the top of its own chart (to be labelled with a
   * per-row % axis, as heights are then not comparable); 'shared': one height scale.
   * Dots have no option (trimmed before v1.1): one dot size for typical cells, and a cell with a big pile overlaps its
   * own dots, so one dot is one record everywhere and one busy cell never shrinks the others.
   */
  scales: {
    cloudHeight: 'independent' | 'shared';
    /**
     * Peak label on each cloud, e.g. "12% per 10" (density: % of the chart's records per gridline interval at the
     * peak; histogram: % per bin). 'auto' (default): shown when heights fit each chart, as they aren't comparable then.
     */
    cloudLabel: 'auto' | 'on' | 'off';
  };
  /** Extra marks on top of the box (user request 2026-10-31). */
  markers: {
    mean: boolean;
    /** Mean marker shape. Default 'circle', hollow (user, 2026-11-02); v1.0 drew a hollow 'diamond'. */
    meanStyle: 'diamond' | 'circle' | 'circle-lift' | 'dot' | 'cross' | 'triangle';
    /**
     * Mean marker colour: a hex colour, '' = the summary ink (like the median), 'mark' = the mark colour.
     * Default Tableau 10 orange (user, 2026-11-02: mean and median must be told apart when they coincide; orange vs the
     * dark median differs in lightness too, so it holds for colour-blind readers). Labels stay in text ink.
     */
    meanColour: string;
    /** e.g. [10, 90] draws labelled ticks at P10 and P90. */
    percentiles: number[];
    /** Label the median, mean and percentile markers with their values. */
    showValues: boolean;
    /** Decimal places for summary values (marker labels, box tooltip). User decision: default 0. */
    decimals: number;
  };
}

export const DEFAULT_OPTIONS: RaincloudOptions = {
  cloud: 'density',
  rain: 'dots',
  lightning: 'box',
  boxPosition: 'auto',
  bandwidth: 1,
  bins: 'auto',
  minNForDensity: 5,
  axis: { range: 'whiskers', low: 1, high: 99, margin: 0.05, titleMode: 'auto', title: '', ticks: 'auto', tickStep: 0, gridlines: true },
  ecdf: false,
  color: '#4e79a7',
  size: { mode: 'entire', rowHeight: 90, panelWidth: 480, minRowHeight: 64, minPanelWidth: 200 },
  density: 'comfortable',
  panels: { wrap: 'auto', axis: 'shared' },
  scales: { cloudHeight: 'independent', cloudLabel: 'auto' },
  colour: { splitCloud: false, cloudSizing: 'each', showLegend: true, assigned: {} },
  // User decision 2026-10-31: P5, P95 and the mean shown by default, with values.
  markers: { mean: true, meanStyle: 'circle', meanColour: '#f28e2b', percentiles: [5, 95], showValues: true, decimals: 0 }
};
