import type { SettingsStore } from '../tableau/settings';

// A Format-dialog session: edits are saved to settings straight away, so the chart updates live.

export interface DialogSession<T> {
  options: T;
  update(next: T): void;
  reset(): T;
  close(): Promise<void>;
}

/** `dialogUrl` is the dialog's own page, as passed to displayDialogAsync (needed to close it in Tableau Desktop). */
export async function startDialog<T>(store: SettingsStore<T>, defaults: T, dialogUrl: string): Promise<DialogSession<T>> {
  await tableau.extensions.initializeDialogAsync();
  const session: DialogSession<T> = {
    options: store.load(),
    update(next) {
      session.options = next;
      store.save(next);
    },
    reset() {
      session.update(structuredClone(defaults));
      return session.options;
    },
    // Close only after pending saves finish (as Tableau's samples do). In Tableau Desktop, pass the dialog's own URL:
    // Tableau's production Sankey does this, and without it Desktop ignored the close under sandbox hosting.
    async close() {
      await store.whenSaved();
      const context = tableau.extensions.environment?.context;
      const desktop = context === tableau.ExtensionContext.Desktop || context === tableau.ExtensionContext.PublicDesktop;
      try {
        if (desktop) tableau.extensions.ui.closeDialog(' ', dialogUrl);
        else tableau.extensions.ui.closeDialog(' ');
      } catch (err) {
        console.warn('[dialog] closeDialog failed', err);
      }
    }
  };
  return session;
}
