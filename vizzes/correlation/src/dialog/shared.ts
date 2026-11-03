import { DEFAULT_OPTIONS, type CorrOptions } from '../chart/options';
import { optionsStore } from '../extension/settings';
import { startDialog as startKitDialog, type DialogSession as KitSession } from '@kit/ui/dialog';

// The Format dialog's page and session (tableau-ui.tsx renders it).

/** The Format dialog page, relative to the .trex URL (used to open and to close it). */
export const FORMAT_DIALOG = 'correlation-format.html';

export type DialogSession = KitSession<CorrOptions>;

/** "5, 95" → [5, 95]: unique percentiles strictly between 0 and 100, sorted. */
export function parsePercentiles(text: string): number[] {
  return [...new Set(text.split(/[,\s]+/).map(Number).filter((p) => Number.isFinite(p) && p > 0 && p < 100))].sort((a, b) => a - b);
}
export const startDialog = (): Promise<DialogSession> => startKitDialog(optionsStore, DEFAULT_OPTIONS, FORMAT_DIALOG);
