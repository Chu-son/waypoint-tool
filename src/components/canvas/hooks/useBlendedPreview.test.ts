import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBlendedPreview } from './useBlendedPreview';
import { BackendAPI } from '../../../api';
import { getAppState, resetAppStore } from '../../../test/store';
import { makeMapLayer } from '../../../test/fixtures';

vi.mock('pixi.js', () => import('../../../test/mocks/pixi').then((m) => m.pixiJsMock));

describe('useBlendedPreview', () => {
  let blend: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    blend = vi.spyOn(BackendAPI, 'blendMapPreview').mockResolvedValue({
      image_data_b64: 'data:image/png;base64,AAAA',
      width: 10,
      height: 10,
      origin: [0, 0, 0],
      resolution: 0.05,
    });
    resetAppStore({ mapLayers: [makeMapLayer('m1', { image_base64: 'data:image/png;base64,BBBB' })] });
  });

  it('does nothing while neither the export preview nor the occupancy highlight is on', () => {
    const { result } = renderHook(() => useBlendedPreview());

    expect(result.current.shouldShowBlendedPreview).toBe(false);
    expect(blend).not.toHaveBeenCalled();
  });

  it('asks the backend to blend the visible layers when the occupancy highlight is turned on', async () => {
    const { result } = renderHook(() => useBlendedPreview());

    act(() => getAppState().setShowOccupancyHighlight(true));

    expect(result.current.shouldShowBlendedPreview).toBe(true);
    await waitFor(() => expect(blend).toHaveBeenCalledTimes(1));
    expect(blend.mock.calls[0][0]).toEqual([expect.objectContaining({ id: 'm1', visible: true })]);
  });

  it('reports a backend failure', async () => {
    blend.mockRejectedValue(new Error('blend failed'));
    const { result } = renderHook(() => useBlendedPreview());

    act(() => getAppState().setShowOccupancyHighlight(true));

    await waitFor(() => expect(result.current.previewError).toContain('blend failed'));
  });
});
