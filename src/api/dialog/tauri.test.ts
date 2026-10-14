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

  it('shows Yes / No / Cancel buttons with the given labels and maps the pressed label back', async () => {
    const labels = { yes: '外も動かす', no: 'このグループだけ', cancel: '中止' };
    const choose = (pressed: string) => {
      vi.mocked(message).mockResolvedValueOnce(pressed as never);
      return api.choose('Move?', { title: 'Move', kind: 'info', labels });
    };

    expect(await choose('外も動かす')).toBe('yes');
    expect(message).toHaveBeenCalledWith('Move?', {
      title: 'Move',
      kind: 'info',
      buttons: { yes: '外も動かす', no: 'このグループだけ', cancel: '中止' },
    });
    expect(await choose('このグループだけ')).toBe('no');
    expect(await choose('中止')).toBe('cancel');
    // Closing the window answers with something else: that is a cancel.
    expect(await choose('')).toBe('cancel');
  });

  it('falls back to the default button names when no labels are given', async () => {
    vi.mocked(message).mockResolvedValueOnce('Yes' as never);

    expect(await api.choose('Sure?')).toBe('yes');
    expect(message).toHaveBeenCalledWith('Sure?', { buttons: { yes: 'Yes', no: 'No', cancel: 'Cancel' } });
  });

  it('calls tauri message with message and options', async () => {
    await api.message('Saved.', { title: 'Info', kind: 'info' });
    expect(message).toHaveBeenCalledWith('Saved.', { title: 'Info', kind: 'info' });
  });
});
