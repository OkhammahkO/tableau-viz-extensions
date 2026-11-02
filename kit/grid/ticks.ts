// Axis tick values and which of them get a label, for a linear value axis.

export type TickDensity = 'fewer' | 'auto' | 'more';

/** Target pixels between ticks per density. 'auto' was 90 px in v1.0, which felt too sparse. */
export const TICK_SPACING: Record<TickDensity, number> = { fewer: 110, auto: 70, more: 45 };

/** A fixed interval is used only while it leaves at least this many px per tick; otherwise automatic ticks. */
const MIN_FIXED_PX = 24;

interface LinearScale {
  domain(): number[];
  ticks(count: number): number[];
}

/** Tick values: every `step` units when step > 0 (Tableau's "Fixed"), else about one per TICK_SPACING px. */
export function axisTicks(scale: LinearScale, widthPx: number, density: TickDensity, step = 0): number[] {
  const [lo, hi] = scale.domain();
  if (step > 0 && Number.isFinite(step)) {
    const first = Math.ceil(lo / step - 1e-9);
    const last = Math.floor(hi / step + 1e-9);
    const n = last - first + 1;
    if (n >= 1 && widthPx / n >= MIN_FIXED_PX) {
      return Array.from({ length: n }, (_, k) => Number(((first + k) * step).toPrecision(12)));
    }
  }
  return scale.ticks(Math.max(2, Math.floor(widthPx / TICK_SPACING[density])));
}

/**
 * Which ticks to label so labels never overlap: every k-th tick, with k the smallest that leaves room for the widest
 * label (gridlines stay on every tick). `labelW` estimates a label's width in px.
 */
export function labelEvery(ticks: number[], toPx: (v: number) => number, labels: string[], labelW = (s: string) => s.length * 6 + 8): number {
  if (ticks.length < 2) return 1;
  const gap = Math.abs(toPx(ticks[1]) - toPx(ticks[0]));
  const widest = Math.max(...labels.map(labelW));
  return gap > 0 ? Math.max(1, Math.ceil(widest / gap)) : 1;
}
