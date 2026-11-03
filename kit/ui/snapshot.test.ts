// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { snapshotPng } from './snapshot';

describe('snapshotPng', () => {
  it('returns null where the browser cannot draw (no canvas), instead of throwing', async () => {
    const el = document.createElement('div');
    el.innerHTML = '<svg width="10" height="10"><rect width="10" height="10"/></svg>';
    document.body.appendChild(el);
    await expect(snapshotPng(el)).resolves.toBeNull();
  });
});
