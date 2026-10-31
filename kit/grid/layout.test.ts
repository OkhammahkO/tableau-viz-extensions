import { describe, expect, it } from 'vitest';
import { autoPerRow, computeGrid, type GridSpec, type SizeOptions } from './layout';

const size = (mode: SizeOptions['mode']): SizeOptions => ({ mode, rowHeight: 90, panelWidth: 480, minRowHeight: 64, minPanelWidth: 200 });

describe('computeGrid', () => {
  const spec = (over: Partial<GridSpec>): GridSpec => ({
    frameW: 1000, frameH: 600, rowCount: 3, colCount: 4, perRow: 4, rowHeaderW: 120, right: 10, top: 4,
    colHeaderH: 18, tickH: 16, bottomH: 6, gap: 12, size: size('entire'), ...over
  });

  it('fills the frame with a rows × columns grid in Entire view', () => {
    const g = computeGrid(spec({}));
    expect(g.width).toBeCloseTo(1000);
    expect(g.height).toBeCloseTo(600);
    expect(g.blockRows).toBe(1);
    expect(g.panelX(0)).toBe(120);
    expect(g.panelX(1)).toBeCloseTo(120 + g.panelW + 12);
    expect(g.cellY(0, 0)).toBe(4 + 18);
    expect(g.cellY(0, 1)).toBeCloseTo(4 + 18 + g.rowH + 16);
  });

  it('wraps column panels onto block rows that each repeat the column header', () => {
    const g = computeGrid(spec({ colCount: 12, perRow: 4 }));
    expect(g.blockRows).toBe(3);
    const blockH = 18 + 3 * (g.rowH + 16);
    expect(g.blockY(1)).toBeCloseTo(4 + blockH + 12);
    expect(g.cellY(2, 0)).toBeCloseTo(g.blockY(2) + 18);
  });

  it('keeps the minimum row height and scrolls when wrapped blocks get too tall', () => {
    const g = computeGrid(spec({ colCount: 12, perRow: 2, rowCount: 6 }));
    expect(g.rowH).toBe(64);
    expect(g.scrollY).toBe(true);
  });

  it('picks as many panels per row as fit at a readable width', () => {
    expect(autoPerRow(1000, 120, 10, 12, 12)).toBe(3); // (1000-130+12)/(260+12) = 3.2
    expect(autoPerRow(1000, 120, 10, 12, 2)).toBe(2);
    expect(autoPerRow(300, 120, 10, 12, 5)).toBe(1);
  });
});
