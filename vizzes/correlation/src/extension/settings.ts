import { createSettingsStore } from '@kit/tableau/settings';
import { DEFAULT_OPTIONS, type CorrOptions } from '../chart/options';

// Options are stored per extension instance in Tableau settings (saved with the workbook) as one JSON string.
// The Format dialog writes here; the extension re-renders on SettingsChanged.

export const SETTINGS_KEY = 'correlation.options.v1';

/** Deep-merges stored options over the defaults, so new options get defaults in older workbooks. */
export function mergeOptions(stored: Partial<CorrOptions> | undefined): CorrOptions {
  const s = stored ?? {};
  return {
    ...DEFAULT_OPTIONS,
    ...s,
    axisCut: { ...DEFAULT_OPTIONS.axisCut, ...s.axisCut },
    markers: { ...DEFAULT_OPTIONS.markers, ...s.markers },
    colour: { ...DEFAULT_OPTIONS.colour, ...s.colour }
  };
}

export const optionsStore = createSettingsStore(SETTINGS_KEY, mergeOptions, 'correlation');
export const loadOptions = (): CorrOptions => optionsStore.load();
export const saveOptions = (options: CorrOptions): void => optionsStore.save(options);
