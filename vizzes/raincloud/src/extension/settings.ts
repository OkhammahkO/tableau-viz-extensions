import { createSettingsStore } from '@kit/tableau/settings';
import { DEFAULT_OPTIONS, type RaincloudOptions } from '../chart/options';

// Options are stored per extension instance in Tableau settings (saved with the workbook) as one JSON string.
// The Format dialog writes here; the extension re-renders on SettingsChanged.

export const SETTINGS_KEY = 'raincloud.options.v1';

/** Deep-merges stored options over the defaults, so new options get defaults in old workbooks. */
export function mergeOptions(stored: Partial<RaincloudOptions> | undefined): RaincloudOptions {
  const s = stored ?? {};
  return {
    ...DEFAULT_OPTIONS,
    ...s,
    axis: { ...DEFAULT_OPTIONS.axis, ...s.axis },
    size: { ...DEFAULT_OPTIONS.size, ...s.size },
    panels: { ...DEFAULT_OPTIONS.panels, ...s.panels },
    scales: { ...DEFAULT_OPTIONS.scales, ...s.scales },
    colour: { ...DEFAULT_OPTIONS.colour, ...s.colour },
    markers: { ...DEFAULT_OPTIONS.markers, ...s.markers }
  };
}

export const optionsStore = createSettingsStore(SETTINGS_KEY, mergeOptions, 'raincloud');
export const loadOptions = (): RaincloudOptions => optionsStore.load();
export const saveOptions = (options: RaincloudOptions): void => optionsStore.save(options);
