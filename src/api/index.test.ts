import { describe, it, expect, vi, afterEach } from 'vitest';

describe('API Router (index.ts)', () => {
  afterEach(() => {
    // @ts-ignore
    delete window.__TAURI_INTERNALS__;
    vi.resetModules();
  });

  it('should export Mock implementations when not in Tauri environment', async () => {
    const { BackendAPI: B } = await import('./index');
    expect(B.constructor.name).toBe('MockBackendAPI');
  });

  it('should export Tauri implementations when in Tauri environment', async () => {
    // @ts-ignore
    window.__TAURI_INTERNALS__ = {};
    
    const { BackendAPI: B } = await import('./index');
    expect(B.constructor.name).toBe('TauriBackendAPI');
  });
});
