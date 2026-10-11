import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBlendedPreview } from './useBlendedPreview';
import { BackendAPI } from '../../../api';
import type { BlendPreviewResult } from '../../../api/types';
import { getAppState, resetAppStore } from '../../../test/store';
import { layerStackState, makeMap } from '../../../test/fixtures';

vi.mock('pixi.js', () => import('../../../test/mocks/pixi').then((m) => m.pixiJsMock));

const CELLS = new Uint8Array([2, 1]);
const PIXELS = [0, 0, 0, 255, 254, 254, 254, 255];

function previewOf(cells: Uint8Array = CELLS): BlendPreviewResult {
  return { width: 2, height: 1, origin: [-1, 2, 0], resolution: 0.05, cells };
}

describe('useBlendedPreview', () => {
  let blend: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    blend = vi.spyOn(BackendAPI, 'blendMapPreview').mockResolvedValue(previewOf());
    resetAppStore(layerStackState(makeMap('m1', { image_base64: 'data:image/png;base64,BBBB' })));
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

  it('shows the blended pixels the backend returned, placed where the backend says', async () => {
    const { result } = renderHook(() => useBlendedPreview());

    act(() => getAppState().setShowOccupancyHighlight(true));

    await waitFor(() => expect(result.current.previewTexture).not.toBeNull());
    const texture = result.current.previewTexture as unknown as {
      width: number;
      height: number;
      source: { resource: Uint8Array };
    };
    expect([texture.width, texture.height]).toEqual([2, 1]);
    expect(Array.from(texture.source.resource)).toEqual(PIXELS);
    expect(result.current.previewInfo).toMatchObject({ resolution: 0.05, origin: [-1, 2, 0] });
  });

  it('numbers each request higher than the one before, so the backend can tell which is the newest', async () => {
    renderHook(() => useBlendedPreview());

    act(() => getAppState().setShowOccupancyHighlight(true));
    await waitFor(() => expect(blend).toHaveBeenCalledTimes(1));
    act(() => getAppState().updateMapLayer('m1', { blend_mode: 'merge_obstacles' }));
    await waitFor(() => expect(blend).toHaveBeenCalledTimes(2));

    const [first, second] = blend.mock.calls.map((call: unknown[]) => call[1] as number);
    expect(second).toBeGreaterThan(first);
  });

  describe('the cache setting', () => {
    let clear: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      clear = vi.spyOn(BackendAPI, 'clearBlendCache').mockResolvedValue(undefined);
    });

    it('lets the backend keep decoded layers by default', async () => {
      renderHook(() => useBlendedPreview());

      act(() => getAppState().setShowOccupancyHighlight(true));

      await waitFor(() => expect(blend).toHaveBeenCalledTimes(1));
      expect(blend.mock.calls[0][2]).toBe(true);
    });

    it('asks the backend not to keep anything while the setting is off', async () => {
      act(() => getAppState().setEnableBlendCache(false));
      renderHook(() => useBlendedPreview());

      act(() => getAppState().setShowOccupancyHighlight(true));

      await waitFor(() => expect(blend).toHaveBeenCalledTimes(1));
      expect(blend.mock.calls[0][2]).toBe(false);
    });

    it('releases what the backend kept when the preview is turned off', async () => {
      const { result } = renderHook(() => useBlendedPreview());
      act(() => getAppState().setShowOccupancyHighlight(true));
      await waitFor(() => expect(result.current.previewTexture).not.toBeNull());
      expect(clear).not.toHaveBeenCalled();

      act(() => getAppState().setShowOccupancyHighlight(false));

      await waitFor(() => expect(clear).toHaveBeenCalledTimes(1));
    });

    it('releases it when the setting is turned off, without regenerating the preview', async () => {
      const { result } = renderHook(() => useBlendedPreview());
      act(() => getAppState().setShowOccupancyHighlight(true));
      await waitFor(() => expect(result.current.previewTexture).not.toBeNull());

      act(() => getAppState().setEnableBlendCache(false));

      await waitFor(() => expect(clear).toHaveBeenCalledTimes(1));
      expect(blend).toHaveBeenCalledTimes(1);
      expect(result.current.previewTexture).not.toBeNull();
    });

    it('does not wait on the backend when nothing was kept', async () => {
      act(() => getAppState().setEnableBlendCache(false));
      const { result } = renderHook(() => useBlendedPreview());
      act(() => getAppState().setShowOccupancyHighlight(true));
      await waitFor(() => expect(result.current.previewTexture).not.toBeNull());

      act(() => getAppState().setShowOccupancyHighlight(false));

      expect(clear).not.toHaveBeenCalled();
    });

    it('releases it only after a request still in flight has finished, so it cannot refill the cache', async () => {
      let finish: (result: BlendPreviewResult) => void = () => {};
      blend.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
      renderHook(() => useBlendedPreview());
      act(() => getAppState().setShowOccupancyHighlight(true));
      await waitFor(() => expect(blend).toHaveBeenCalledTimes(1));

      act(() => getAppState().setShowOccupancyHighlight(false));
      await Promise.resolve();
      expect(clear).not.toHaveBeenCalled();

      await act(async () => finish(previewOf()));
      await waitFor(() => expect(clear).toHaveBeenCalledTimes(1));
    });
  });

  it('lets go of the previous texture only after the canvas has had frames to switch to the new one', async () => {
    const { result } = renderHook(() => useBlendedPreview());
    act(() => getAppState().setShowOccupancyHighlight(true));
    await waitFor(() => expect(result.current.previewTexture).not.toBeNull());
    const first = result.current.previewTexture as unknown as { destroy: ReturnType<typeof vi.fn> };

    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => frames.push(callback));
    const nextFrame = () => act(() => frames.splice(0).forEach((callback) => callback(0)));

    act(() => getAppState().updateMapLayer('m1', { blend_mode: 'merge_obstacles' }));
    await waitFor(() => expect(result.current.previewTexture).not.toBe(first));

    expect(first.destroy).not.toHaveBeenCalled();
    nextFrame();
    expect(first.destroy).not.toHaveBeenCalled();
    nextFrame();
    expect(first.destroy).toHaveBeenCalledWith(true);
  });

  it('reports a backend failure', async () => {
    blend.mockRejectedValue(new Error('blend failed'));
    const { result } = renderHook(() => useBlendedPreview());

    act(() => getAppState().setShowOccupancyHighlight(true));

    await waitFor(() => expect(result.current.previewError).toContain('blend failed'));
  });

  it('does not report the failure of a request that a newer one replaced', async () => {
    let failFirst: (error: Error) => void = () => {};
    blend.mockImplementationOnce(() => new Promise((_resolve, reject) => (failFirst = reject)));
    const { result } = renderHook(() => useBlendedPreview());

    act(() => getAppState().setShowOccupancyHighlight(true));
    await waitFor(() => expect(blend).toHaveBeenCalledTimes(1));
    act(() => getAppState().updateMapLayer('m1', { blend_mode: 'merge_obstacles' }));
    await waitFor(() => expect(result.current.previewTexture).not.toBeNull());
    // The backend gives up on the first request once it sees the second.
    await act(async () => failFirst(new Error('cancelled')));

    expect(result.current.previewError).toBeNull();
    expect(result.current.previewTexture).not.toBeNull();
  });
});
