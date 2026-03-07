import { describe, it, expect, vi } from 'vitest';
import { MockDialogAPI } from './mock';

describe('MockDialogAPI', () => {
  const api = new MockDialogAPI();

  it('returns a mock path on open', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('/mock/path/file.yaml');
    const result = await api.open();
    expect(result).toBe('/mock/path/file.yaml');
  });

  it('returns a mock path on save', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('/mock/path/save.json');
    const result = await api.save();
    expect(result).toBe('/mock/path/save.json');
  });

  it('returns true on ask', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const result = await api.ask('Confirm?');
    expect(result).toBe(true);
  });
});
