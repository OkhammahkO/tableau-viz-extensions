import type { Selection } from 'd3-selection';
import type { ScaleLinear } from 'd3-scale';

// Shared by the matrix renderer and its cell and point drawers.

export type G = Selection<SVGGElement, unknown, null, undefined>;

/** One matrix cell: row i, column j, its top-left corner and its scales (column measure across, row measure up). */
export interface Cell { i: number; j: number; x0: number; y0: number; x: ScaleLinear<number, number>; y: ScaleLinear<number, number> }
