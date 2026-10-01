import { describe, expect, it, vi } from 'vitest';
import { BackendAPI, DialogAPI } from '../api';
import { getAppState, resetAppStore } from '../test/store';
import { importMapFromDialog } from './mapImport';

const loaded = {
  info: {
    image: 'office.pgm',
    resolution: 0.05,
    origin: [0, 0, 0] as [number, number, number],
    negate: 0,
    occupied_thresh: 0.65,
    free_thresh: 0.196,
  },
  image_data_b64: 'AAAA',
  width: 10,
  height: 20,
};

describe('importMapFromDialog', () => {
  it('adds the chosen map as a new layer named after the file', async () => {
    resetAppStore();
    vi.spyOn(DialogAPI, 'open').mockResolvedValue('/maps/office.yaml');
    const load = vi.spyOn(BackendAPI, 'loadROSMap').mockResolvedValue(loaded);

    const added = await importMapFromDialog();

    expect(added).toBe(true);
    expect(load).toHaveBeenCalledWith('/maps/office.yaml');
    expect(getAppState().mapLayers.map((l) => l.name)).toEqual(['office.yaml']);
    expect(getAppState().mapSources).toHaveLength(1);
  });

  it('does nothing when the dialog is cancelled', async () => {
    resetAppStore();
    vi.spyOn(DialogAPI, 'open').mockResolvedValue(null);
    const load = vi.spyOn(BackendAPI, 'loadROSMap');

    expect(await importMapFromDialog()).toBe(false);
    expect(load).not.toHaveBeenCalled();
    expect(getAppState().mapLayers).toHaveLength(0);
  });

  it('tells the user when loading fails and adds nothing', async () => {
    resetAppStore();
    vi.spyOn(DialogAPI, 'open').mockResolvedValue('/maps/bad.yaml');
    vi.spyOn(BackendAPI, 'loadROSMap').mockRejectedValue(new Error('broken'));
    const message = vi.spyOn(DialogAPI, 'message').mockResolvedValue(undefined);

    expect(await importMapFromDialog()).toBe(false);
    expect(message).toHaveBeenCalledWith(expect.stringContaining('broken'), expect.anything());
    expect(getAppState().mapLayers).toHaveLength(0);
  });
});
