import type { Cell } from './geometry';
import type { Matrix, MatrixRecord } from './model';

// Scatter points on a canvas: thousands of points × up to 28 scatters stay fast where SVG elements would not.

const orders = new WeakMap<Matrix, Uint32Array>();
/** A seeded shuffle of the record indexes (Fisher–Yates with a small LCG), cached per matrix. */
export function drawOrder(m: Matrix): Uint32Array {
  let order = orders.get(m);
  if (order) return order;
  order = Uint32Array.from(m.records, (_, n) => n);
  let seed = 2654435761;
  for (let n = order.length - 1; n > 0; n--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const k = seed % (n + 1);
    [order[n], order[k]] = [order[k], order[n]];
  }
  orders.set(m, order);
  return order;
}

/** Points on the canvas, faded by how many there are; emphasised records (the selection, a hovered legend member or
 *  bar, a brush) drawn last and solid, the rest faded. */
export function drawPoints(canvas: HTMLCanvasElement, m: Matrix, lower: Cell[], width: number, height: number, radius: number,
  colourOf: (r: MatrixRecord) => string, emphasis: ((r: MatrixRecord) => boolean) | null): void {
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return; // e.g. a test DOM without canvas
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.scale(ratio, ratio);
  const n = m.records.length;
  const alpha = n <= 300 ? 0.55 : Math.max(0.1, 0.55 * Math.sqrt(300 / n));
  // Draw in a fixed shuffled order, not data order: with data sorted by colour, the last member would always paint
  // over the others and look dominant. Same order every render (seeded), so nothing flickers.
  const order = drawOrder(m);
  const pass = (pick: (r: MatrixRecord) => boolean, a: number) => {
    for (const c of lower) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(c.x0, c.y0, c.x.range()[1] - c.x0, c.y.range()[0] - c.y0);
      ctx.clip();
      for (const n of order) {
        const r = m.records[n];
        if (!pick(r)) continue;
        const vx = r.values[c.j];
        const vy = r.values[c.i];
        if (vx === null || vy === null) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = colourOf(r);
        ctx.beginPath();
        ctx.arc(c.x(vx), c.y(vy), radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  };
  if (!emphasis) pass(() => true, alpha);
  else {
    pass((r) => !emphasis(r), alpha * 0.25);
    pass(emphasis, 0.95);
  }
}
