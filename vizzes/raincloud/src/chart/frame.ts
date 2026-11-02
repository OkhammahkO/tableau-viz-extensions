import type { ScaleLinear } from 'd3-scale';
import type { Selection } from 'd3-selection';

// What the per-cell drawing helpers (cloud, ECDF, summary) share: the cell's clipped layer, its value scale and the
// vertical positions the renderer worked out for it.

export type G = Selection<SVGGElement, unknown, null, undefined>;

export interface CellFrame {
  /** The cell's layer, clipped to the cell. */
  L: G;
  x: ScaleLinear<number, number>;
  x0: number;
  y0: number;
  w: number;
  h: number;
  /** Line the cloud sits on. */
  cloudBase: number;
  /** Centre line of the box. */
  base: number;
  boxH: number;
}

/** Tooltip callbacks into the chart's shared tooltip. */
export interface Tip {
  show(html: string, e: PointerEvent): void;
  hide(): void;
}
