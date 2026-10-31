import { describe, expect, it } from 'vitest';
import { createSettingsStore } from './settings';

// A fake Tableau settings API whose saves finish when we say so.
function fakeTableau() {
  const stored: Record<string, string> = {};
  const finishers: (() => void)[] = [];
  (globalThis as { tableau?: unknown }).tableau = {
    extensions: {
      settings: {
        get: (k: string) => stored[k],
        set: (k: string, v: string) => (stored[k] = v),
        saveAsync: () => new Promise<void>((resolve) => finishers.push(resolve))
      }
    }
  };
  return { stored, finishNext: () => finishers.shift()?.() };
}

describe('createSettingsStore', () => {
  it('serializes saves, keeps the latest value, and whenSaved waits for all of them', async () => {
    const t = fakeTableau();
    const store = createSettingsStore<{ n: number }>('k', (s) => ({ n: s?.n ?? 0 }));
    store.save({ n: 1 });
    store.save({ n: 2 });
    store.save({ n: 3 }); // 2 is skipped: only the latest pending value is written next
    let done = false;
    const waiting = store.whenSaved().then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    t.finishNext(); // finishes the save of 1; then 3 is written
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.parse(t.stored.k)).toEqual({ n: 3 });
    t.finishNext();
    await waiting;
    expect(done).toBe(true);
    expect(store.load()).toEqual({ n: 3 });
  });
});
