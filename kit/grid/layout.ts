// Grid geometry and size modes (named like Tableau's Fit menu, which doesn't reach viz extensions). Pure: works out
// panel width and row height from the frame; the renderer draws at that size and the host scrolls when it's bigger.

export type SizeMode = 'entire' | 'fitWidth' | 'fitHeight' | 'standard';

export interface SizeOptions {
  mode: SizeMode;
  /** Row height used by Fit width and Standard. */
  rowHeight: number;
  /** Panel width used by Fit height and Standard. */
  panelWidth: number;
  /** Never draw a row smaller than this; scroll instead (raincloud default: 64 px). */
  minRowHeight: number;
  /** Never draw a panel narrower than this; scroll instead. */
  minPanelWidth: number;
}

export interface GridSpec {
  frameW: number;
  frameH: number;
  /** Leaf rows per block and total column panels. */
  rowCount: number;
  colCount: number;
  /** Panels per block row: colCount normally, fewer when wrapping. */
  perRow: number;
  rowHeaderW: number;
  right: number;
  top: number;
  /** Column header height above each block row (0 when Columns is empty). */
  colHeaderH: number;
  /** Tick-label strip under every cell (0 when the axis is drawn once at the bottom). */
  tickH: number;
  /** Tick-label strip under the last row of each block row only (dense layouts); default 0. */
  footH?: number;
  /** Space below everything: shared axis and/or footnote. */
  bottomH: number;
  /** Gap between panels, and between wrapped block rows. */
  gap: number;
  size: SizeOptions;
}

export interface GridGeometry {
  width: number;
  height: number;
  rowH: number;
  panelW: number;
  perRow: number;
  blockRows: number;
  scrollX: boolean;
  scrollY: boolean;
  /** Left edge of panel slot j (0-based within a block row). */
  panelX(j: number): number;
  /** Top of block row b (its column header starts here). */
  blockY(b: number): number;
  /** Top of leaf row r's plot band within block row b. */
  cellY(b: number, r: number): number;
}

/**
 * Geometry for a rows × columns grid of charts, optionally wrapping column panels onto several block rows
 * (each block row repeats the row headers and has its own column header). Entire view / Fit width fill the frame width; Entire view / Fit height fill its height; the others use the fixed sizes; nothing goes below the minimums.
 */
export function computeGrid(s: GridSpec): GridGeometry {
  const rows = Math.max(1, s.rowCount);
  const perRow = Math.max(1, Math.min(s.perRow, Math.max(1, s.colCount)));
  const blockRows = Math.ceil(Math.max(1, s.colCount) / perRow);
  const footH = s.footH ?? 0;
  const vertFixed = s.top + blockRows * (s.colHeaderH + footH) + blockRows * rows * s.tickH + s.bottomH + (blockRows - 1) * s.gap;
  const fillH = (s.frameH - vertFixed) / (blockRows * rows);
  const fillW = (s.frameW - s.rowHeaderW - s.right - (perRow - 1) * s.gap) / perRow;
  const fitsW = s.size.mode === 'entire' || s.size.mode === 'fitWidth';
  const fitsH = s.size.mode === 'entire' || s.size.mode === 'fitHeight';
  const panelW = Math.max(s.size.minPanelWidth, fitsW ? fillW : s.size.panelWidth);
  const rowH = Math.max(s.size.minRowHeight, fitsH ? fillH : s.size.rowHeight);
  const width = s.rowHeaderW + s.right + perRow * panelW + (perRow - 1) * s.gap;
  const height = vertFixed + blockRows * rows * rowH;
  const blockH = s.colHeaderH + rows * (rowH + s.tickH) + footH;
  return {
    width, height, rowH, panelW, perRow, blockRows,
    scrollX: width > s.frameW + 0.5,
    scrollY: height > s.frameH + 0.5,
    panelX: (j) => s.rowHeaderW + j * (panelW + s.gap),
    blockY: (b) => s.top + b * (blockH + s.gap),
    cellY: (b, r) => s.top + b * (blockH + s.gap) + s.colHeaderH + r * (rowH + s.tickH)
  };
}

/** Panels per row when wrapping automatically: as many as fit at a readable width (≥ minWidth). */
export function autoPerRow(frameW: number, rowHeaderW: number, right: number, gap: number, colCount: number, minWidth = 260): number {
  const fit = Math.floor((frameW - rowHeaderW - right + gap) / (minWidth + gap));
  return Math.max(1, Math.min(colCount, fit));
}
