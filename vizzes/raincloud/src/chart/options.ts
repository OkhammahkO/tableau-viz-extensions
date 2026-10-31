import type { SizeOptions } from '@kit/grid/layout';

// Every user-facing setting lives here. The Format dialog edits this object via Tableau settings.

export type CloudType = 'density' | 'histogram' | 'none';
export type RainType = 'dots' | 'strip' | 'none';
export type LightningType = 'box' | 'none';

export interface RaincloudOptions {
  cloud: CloudType;
  rain: RainType;
  lightning: LightningType;
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
  axis: { range: 'data' | 'percentile' | 'whiskers'; low: number; high: number; margin: number };
  /** Mark colour; Tableau's default blue. */
  color: string;
  /** Layout fit (F14), named like Tableau's Fit menu. */
  size: SizeOptions;
  /** Colour tile (F4). The box always stays combined (user decision). */
  colour: {
    /** Split the cloud into one curve per colour member, scaled by its share (histogram: stacked bars). */
    splitCloud: boolean;
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
  /** Extra marks on top of the box (user request 2026-10-31). */
  markers: {
    mean: boolean;
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
  bandwidth: 1,
  bins: 'auto',
  minNForDensity: 5,
  axis: { range: 'whiskers', low: 1, high: 99, margin: 0.05 },
  color: '#4e79a7',
  size: { mode: 'entire', rowHeight: 90, panelWidth: 480, minRowHeight: 64, minPanelWidth: 200 },
  panels: { wrap: 'auto', axis: 'shared' },
  colour: { splitCloud: false, showLegend: true, assigned: {} },
  // User decision 2026-10-31: P5, P95 and the mean shown by default, with values.
  markers: { mean: true, percentiles: [5, 95], showValues: true, decimals: 0 }
};
