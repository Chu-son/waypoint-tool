import { describe, it, expect, vi } from 'vitest';
import { createSettingsStorage } from './settingsStorage';

const payload = (state: Record<string, unknown>, version = 3) => JSON.stringify({ state, version });

function makeBackend(initial: string | null = null) {
  const saved: string[] = [];
  const releases: Array<() => void> = [];
  let hold = false;
  const backend = {
    loadUserSettings: vi.fn(async () => initial),
    saveUserSettings: vi.fn(async (s: string) => {
      if (hold) await new Promise<void>((resolve) => releases.push(resolve));
      saved.push(s);
    }),
  };
  return {
    backend,
    saved,
    holdWrites: () => {
      hold = true;
    },
    releaseWrites: () => {
      hold = false;
      releases.splice(0).forEach((r) => r());
    },
  };
}

describe('settingsStorage', () => {
  it('returns the stored settings and null when there are none', async () => {
    const withFile = createSettingsStorage(makeBackend(payload({ a: 1 })).backend);
    expect(await withFile.getItem('k')).toBe(payload({ a: 1 }));

    const without = createSettingsStorage(makeBackend(null).backend);
    expect(await without.getItem('k')).toBeNull();
  });

  it('does not write before the stored settings have been read', async () => {
    const { backend, saved } = makeBackend(payload({ a: 1 }));
    const storage = createSettingsStorage(backend);
    storage.setItem('k', payload({ a: 0 }));
    await storage.flush();
    expect(saved).toEqual([]);
  });

  it('writes after reading, and skips an identical payload', async () => {
    const { backend, saved } = makeBackend(null);
    const storage = createSettingsStorage(backend);
    await storage.getItem('k');
    storage.setItem('k', payload({ a: 1 }));
    storage.setItem('k', payload({ a: 1 }));
    await storage.flush();
    expect(saved).toEqual([payload({ a: 1 })]);
  });

  it('keeps only the newest payload while a write is in progress', async () => {
    const { backend, saved, holdWrites, releaseWrites } = makeBackend(null);
    const storage = createSettingsStorage(backend);
    await storage.getItem('k');
    holdWrites();
    storage.setItem('k', payload({ a: 1 }));
    storage.setItem('k', payload({ a: 2 }));
    storage.setItem('k', payload({ a: 3 }));
    releaseWrites();
    await storage.flush();
    expect(saved).toEqual([payload({ a: 1 }), payload({ a: 3 })]);
  });

  it('flush resolves only after the latest payload is saved', async () => {
    const { backend, saved, holdWrites, releaseWrites } = makeBackend(null);
    const storage = createSettingsStorage(backend);
    await storage.getItem('k');
    holdWrites();
    storage.setItem('k', payload({ a: 1 }));
    const flushed = storage.flush();
    releaseWrites();
    await flushed;
    expect(saved).toEqual([payload({ a: 1 })]);
  });

  it('writes back settings this build does not know about, and does not lower the version', async () => {
    const { backend, saved } = makeBackend(payload({ known: 1, newerOnly: 'x' }, 5));
    const storage = createSettingsStorage(backend);
    await storage.getItem('k');
    storage.setItem('k', payload({ known: 2 }, 3));
    await storage.flush();
    expect(JSON.parse(saved[0])).toEqual({ state: { known: 2, newerOnly: 'x' }, version: 5 });
  });

  it('retries a payload after a failed write', async () => {
    const { backend, saved } = makeBackend(null);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.saveUserSettings.mockRejectedValueOnce(new Error('disk full'));
    const storage = createSettingsStorage(backend);
    await storage.getItem('k');
    storage.setItem('k', payload({ a: 1 }));
    await storage.flush();
    storage.setItem('k', payload({ a: 1 }));
    await storage.flush();
    expect(saved).toEqual([payload({ a: 1 })]);
    error.mockRestore();
  });
});
