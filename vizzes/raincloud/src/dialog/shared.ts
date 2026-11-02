import { DEFAULT_OPTIONS, type RaincloudOptions } from '../chart/options';
import { optionsStore } from '../extension/settings';
import { startDialog as startKitDialog, type DialogSession as KitSession } from '@kit/ui/dialog';

// Choices, parsers and the dialog session for the Format dialog (tableau-ui.tsx). The frozen Lite fallback in
// archive/lite-dialog keeps its own copy.

export const CLOUDS = [
  ['density', 'Smooth density'],
  ['histogram', 'Histogram'],
  ['none', 'None']
] as const;

export const RAINS = [
  ['dots', 'Stacked (dot plot)'],
  ['strip', 'Strip (one line)'],
  ['none', 'None']
] as const;

export const SIZE_MODES = [
  ['entire', 'Entire view'],
  ['fitWidth', 'Fit width'],
  ['fitHeight', 'Fit height'],
  ['standard', 'Standard']
] as const;

export const WRAP_CHOICES = ['auto', '1', '2', '3', '4', '5', '6', '8'] as const;

export const BINS = ['auto', '10', '15', '20', '30', '40'] as const;

// Smoothing slider is logarithmic: position 0–100 maps to 0.25×–4× with 1× in the middle, so each step
// changes the curve by a similar amount (a linear slider was "touchy" at the low end). Snaps to 1× near the middle.
export const SMOOTHING_STEPS = 100;
export function smoothingFromSlider(t: number): number {
  const bw = 0.25 * Math.pow(16, t / SMOOTHING_STEPS);
  return Math.abs(bw - 1) < 0.04 ? 1 : Math.round(bw * 100) / 100;
}
export function sliderFromSmoothing(bw: number): number {
  return Math.round((Math.log(bw / 0.25) / Math.log(16)) * SMOOTHING_STEPS);
}

/** "Fixed interval" text → a positive step, or 0 (automatic) for blank or invalid input. */
export function parseStep(text: string): number {
  const v = Number(text.trim().replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function parsePercentiles(text: string): number[] {
  return [...new Set(text.split(/[,\s]+/).map(Number).filter((p) => Number.isFinite(p) && p > 0 && p < 100))].sort((a, b) => a - b);
}

/** The Format dialog page, relative to the .trex URL (used to open and to close it). */
export const FORMAT_DIALOG = 'raincloud-format.html';

export type DialogSession = KitSession<RaincloudOptions>;
export const startDialog = (): Promise<DialogSession> => startKitDialog(optionsStore, DEFAULT_OPTIONS, FORMAT_DIALOG);
