// A settings store for one extension instance: one JSON string in Tableau settings (saved with the workbook).
// Saving from a dialog fires SettingsChanged in the extension, which gives live preview.

export interface SettingsStore<T> {
  load(): T;
  save(value: T): void;
  /** Resolves once no save is pending (close a dialog only after this, as Tableau's samples do). */
  whenSaved(): Promise<void>;
}

/**
 * `merge` fills defaults over what was stored, so options added later get defaults in old workbooks.
 * Only one saveAsync may run at a time; later saves wait and the latest wins.
 */
export function createSettingsStore<T>(key: string, merge: (stored: Partial<T> | undefined) => T, label = 'viz'): SettingsStore<T> {
  let saving: Promise<unknown> | undefined;
  let pending: T | undefined;
  return {
    load() {
      try {
        const raw = tableau.extensions.settings.get(key);
        return merge(raw ? (JSON.parse(raw) as Partial<T>) : undefined);
      } catch (err) {
        console.warn(`[${label}] could not read settings; using defaults`, err);
        return merge(undefined);
      }
    },
    save(value) {
      pending = value;
      if (saving) return;
      const run = async (): Promise<void> => {
        while (pending !== undefined) {
          const v = pending;
          pending = undefined;
          tableau.extensions.settings.set(key, JSON.stringify(v));
          try {
            await tableau.extensions.settings.saveAsync();
          } catch (err) {
            console.warn(`[${label}] settings save failed`, err);
          }
        }
        saving = undefined;
      };
      saving = run();
    },
    async whenSaved() {
      while (saving) await saving;
    }
  };
}
