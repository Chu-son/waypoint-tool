import type { StateStorage } from 'zustand/middleware';
import { AppAPI } from '../../api';
import type { IAppAPI } from '../../api/types';

type SettingsBackend = Pick<IAppAPI, 'loadUserSettings' | 'saveUserSettings'>;

export interface SettingsStorage extends StateStorage {
  /** Resolves once every write queued so far has reached the settings file. */
  flush(): Promise<void>;
}

/**
 * zustand `persist` storage backed by the settings file in the app config directory (shared by every
 * way of launching the app), instead of the WebView's per-origin localStorage.
 *
 * - Writes are ignored until the first read finishes, so the initial defaults never overwrite the file.
 * - An identical payload is not written twice, and writes never overlap: while one is running only the
 *   newest payload is kept for the next one (no timer, so nothing is lost if the app quits right after).
 * - Keys the file has but this build does not persist are written back unchanged, so a build that knows
 *   fewer settings does not erase the settings of a newer one that shares the file.
 */
export function createSettingsStorage(backend: SettingsBackend): SettingsStorage {
  let hydrated = false;
  let foreignState: Record<string, unknown> = {};
  let fileVersion = 0;
  let latest: string | null = null;
  let pending: string | null = null;
  let draining: Promise<void> | null = null;

  const merge = (value: string): string => {
    let parsed: { state?: Record<string, unknown>; version?: number };
    try {
      parsed = JSON.parse(value);
    } catch {
      return value;
    }
    const state = parsed.state ?? {};
    const mergedState = { ...foreignState, ...state };
    const version = Math.max(parsed.version ?? 0, fileVersion);
    return JSON.stringify({ ...parsed, state: mergedState, version });
  };

  const drain = async () => {
    while (pending !== null) {
      const next = pending;
      pending = null;
      try {
        await backend.saveUserSettings(next);
      } catch (err) {
        console.error('[settings] Failed to save settings:', err);
        // Let the next change retry instead of being skipped as "already written".
        latest = null;
      }
    }
    draining = null;
  };

  return {
    async getItem() {
      const raw = await backend.loadUserSettings();
      if (raw !== null) {
        try {
          const parsed = JSON.parse(raw);
          foreignState = parsed?.state && typeof parsed.state === 'object' ? parsed.state : {};
          fileVersion = typeof parsed?.version === 'number' ? parsed.version : 0;
        } catch {
          // The backend sets aside a broken file, so this is not expected; treat it as empty.
        }
      }
      hydrated = true;
      return raw;
    },

    setItem(_name, value) {
      if (!hydrated) return;
      const merged = merge(value);
      if (merged === latest) return;
      latest = merged;
      pending = merged;
      if (!draining) draining = drain();
    },

    removeItem() {},

    async flush() {
      while (draining) await draining;
    },
  };
}

export const settingsStorage = createSettingsStorage(AppAPI);

export const flushSettings = () => settingsStorage.flush();
