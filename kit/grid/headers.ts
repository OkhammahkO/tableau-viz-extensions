import type { Selection } from 'd3-selection';
import type { Palette } from '../colours';
import type { RenderTheme } from '../theme';
import type { computeGrid } from './layout';

// Row/column headers (nested, spanning, wrapped) and the colour legend for a Rows × Columns grid.

/** Height of one column-header level. */
export const HEADER_H = 18;

/** What header drawing needs to know about a grid. */
export interface HeaderGrid {
  rowLevels: string[];
  colLevels: string[];
  rows: string[][];
  cols: string[][];
}

type Geo = ReturnType<typeof computeGrid>;

/** Consecutive runs of equal prefixes at one header level: [start, end] inclusive. */
export function spans(paths: string[][], level: number): { start: number; end: number; label: string }[] {
  const out: { start: number; end: number; label: string }[] = [];
  paths.forEach((p, i) => {
    const key = p.slice(0, level + 1).join('\u0001');
    const last = out[out.length - 1];
    if (last && (last as { key?: string }).key === key) last.end = i;
    else out.push(Object.assign({ start: i, end: i, label: p[level] ?? '' }, { key }));
  });
  return out;
}

export function fitText(text: string, width: number, px = 6.6): string {
  const max = Math.max(1, Math.floor((width - 8) / px));
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`;
}

export interface LegendItem {
  kind: 'title' | 'item';
  x: number;
  y: number;
  label: string;
  colour?: string;
}

/** Positions for "Field: ● a ● b …", wrapping at maxW. y is the text baseline relative to the legend top. */
export function legendLayout(title: string, palette: Palette, maxW: number): { items: LegendItem[]; height: number } {
  const items: LegendItem[] = [];
  const lineH = 16;
  let x = 8;
  let y = 12;
  const titleW = title.length * 6.6 + 12;
  items.push({ kind: 'title', x, y, label: `${title}:` });
  x += titleW;
  for (const l of palette.legend) {
    const w = 14 + l.label.length * 6.2 + 12;
    if (x + w > maxW && x > 8 + titleW) { x = 8 + titleW; y += lineH; }
    items.push({ kind: 'item', x, y, label: l.label, colour: l.colour });
    x += w;
  }
  return { items, height: y + 8 };
}

/** Column headers: one level per Columns dimension with outer levels spanning; wrapped panels each get their own. */
export function drawColumnHeaders(svg: Selection<SVGSVGElement, unknown, null, undefined>, grid: HeaderGrid, geo: Geo, wrapped: boolean, theme: RenderTheme): void {
  if (!grid.colLevels.length) return;
  const text = (x: number, y: number, w: number, label: string) =>
    svg.append('text').attr('x', x + w / 2).attr('y', y).attr('text-anchor', 'middle').attr('font-size', 11.5)
      .attr('font-weight', 600).attr('fill', theme.text).text(fitText(label, w, 7));
  const rule = (x: number, y: number, w: number) =>
    svg.append('line').attr('x1', x).attr('x2', x + w).attr('y1', y).attr('y2', y).attr('stroke', theme.grid);
  if (wrapped) {
    grid.cols.forEach((p, c) => {
      const b = Math.floor(c / geo.perRow);
      const x = geo.panelX(c % geo.perRow);
      text(x, geo.blockY(b) + 13, geo.panelW, p[0] ?? '');
      rule(x, geo.blockY(b) + HEADER_H - 1, geo.panelW);
    });
    return;
  }
  grid.colLevels.forEach((_, k) => {
    for (const s of spans(grid.cols, k)) {
      const x = geo.panelX(s.start);
      const w = geo.panelX(s.end) + geo.panelW - x;
      text(x, geo.blockY(0) + k * HEADER_H + 13, w, s.label);
      rule(x, geo.blockY(0) + (k + 1) * HEADER_H - 1, w);
    }
  });
}

/** Row headers: one column per Rows level, outer levels spanning their inner rows (repeated per wrapped block). None without Rows. */
export function drawRowHeaders(
  svg: Selection<SVGSVGElement, unknown, null, undefined>,
  grid: HeaderGrid,
  geo: Geo,
  levelX: number[],
  levelW: number[],
  theme: RenderTheme,
  right: number
): void {
  const levels = grid.rowLevels.length;
  for (let b = 0; b < geo.blockRows; b++) {
    for (let k = 0; k < levels; k++) {
      const inner = k === levels - 1;
      for (const s of spans(grid.rows, k)) {
        const yTop = geo.cellY(b, s.start);
        const y = inner ? yTop + geo.rowH * 0.5 + 4 : yTop + 14;
        svg.append('text').attr('x', levelX[k] + levelW[k] - 6).attr('y', y).attr('text-anchor', 'end')
          .attr('font-size', 12).attr('font-weight', inner ? 600 : 500).attr('fill', theme.text)
          .text(fitText(s.label, levelW[k]));
        // A faint rule above each outer-level group (except the first) separates the groups across the grid.
        if (!inner && s.start > 0) {
          svg.append('line').attr('x1', levelX[k]).attr('x2', geo.width - right).attr('y1', yTop - 1).attr('y2', yTop - 1)
            .attr('stroke', theme.grid);
        }
      }
    }
  }
}
