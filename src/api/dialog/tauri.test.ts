import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TauriDialogAPI } from './tauri';
import { open, save, ask, message } from '@tauri-apps/plugin-dialog';

// Mock tauri plugin dialog
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
  ask: vi.fn(),
  message: vi.fn(),
}));

describe('TauriDialogAPI', () => {
  const api = new TauriDialogAPI();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls tauri open with options', async () => {
    const options = { multiple: true };
    await api.open(options);
    expect(open).toHaveBeenCalledWith(options);
  });

  it('calls tauri save with options', async () => {
    const options = { defaultPath: 'test.json' };
    await api.save(options);
    expect(save).toHaveBeenCalledWith(options);
  });

  it('calls tauri ask with message and options', async () => {
    await api.ask('Are you sure?', { title: 'Confirm' });
    expect(ask).toHaveBeenCalledWith('Are you sure?', { title: 'Confirm' });
  });

  it('calls tauri message with message and options', async () => {
    await api.message('Saved.', { title: 'Info', kind: 'info' });
    expect(message).toHaveBeenCalledWith('Saved.', { title: 'Info', kind: 'info' });
  });
});
