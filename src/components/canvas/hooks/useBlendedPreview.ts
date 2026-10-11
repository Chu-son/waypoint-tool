import { useEffect, useMemo, useRef, useState } from 'react';
import { BufferImageSource, Texture } from 'pixi.js';
import { useAppStore } from '../../../stores/appStore';
import { BackendAPI } from '../../../api';
import type { BlendPreviewResult } from '../../../api/types';
import { createRasterCache, prepareLayersForExport, type RasterCache } from '../../../services/mapRasterize';
import { createTrace, megabytes } from '../../../services/perfTrace';

const LOADING_TASK_ID = 'blended-preview';

/**
 * Numbers the preview requests in increasing order. The backend stops computing a request once a newer
 * one arrives, so the numbering must never go back — it is shared by every use of this hook.
 */
let lastRequestId = 0;

/** The blended pixels as a texture, uploaded straight from the backend's bytes (no image to decode). */
function textureFromPreview(result: BlendPreviewResult): Texture {
  const source = new BufferImageSource({
    resource: result.rgba,
    width: result.width,
    height: result.height,
    format: 'rgba8unorm',
  });
  return new Texture({ source });
}

/**
 * While the export preview or occupancy highlight is on, asks the backend to blend all map and
 * custom layers into one occupancy image and exposes it as a texture. The texture is rebuilt only
 * when something that affects the blend changes.
 */
export function useBlendedPreview() {
  const mapSources = useAppStore((state) => state.mapSources);
  const mapLayers = useAppStore((state) => state.mapLayers);
  const layerOrder = useAppStore((state) => state.layerOrder);
  const customLayers = useAppStore((state) => state.customLayers) || [];
  const occupancySettings = useAppStore((state) => state.occupancySettings);
  const isExportPreview = useAppStore((state) => state.isExportPreview);
  const showOccupancyHighlight = useAppStore((state) => state.showOccupancyHighlight);
  const startLoading = useAppStore((state) => state.startLoading);
  const stopLoading = useAppStore((state) => state.stopLoading);

  const shouldShowBlendedPreview = isExportPreview || showOccupancyHighlight;

  const [previewTexture, setPreviewTexture] = useState<Texture | null>(null);
  const [previewInfo, setPreviewInfo] = useState<any>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const enableBlendCache = useAppStore((state) => state.enableBlendCache);
  // Pictures of the custom layers drawn for the previous preview (see `RasterCache`).
  const rasterCache = useRef<RasterCache>(createRasterCache());
  // The newest request, settled or not. The backend's cache is released only after it, so a request that
  // is still running cannot fill the cache again behind the release.
  const latestRequest = useRef<Promise<unknown>>(Promise.resolve());
  // Whether the backend may be holding decoded layers of ours.
  const holdsBackendCache = useRef(false);

  // Changes to blend_mode, stack order, clip, visibility, images, custom layers or occupancy settings.
  const previewSyncKey = useMemo(() => {
    const sourceKey = JSON.stringify(mapSources.map((s) => ({ id: s.id, hasImage: !!s.image_base64, info: s.info })));
    const mapKey = JSON.stringify(
      mapLayers.map((l) => ({
        id: l.id,
        sourceId: l.sourceId,
        blend_mode: l.blend_mode,
        visible: l.visible,
        clip: l.clip,
        origin_override: l.origin_override,
      })),
    );
    const customKey = JSON.stringify(
      customLayers.map((l) => ({
        id: l.id,
        type: l.type,
        visible: l.visible,
        is_reference: l.is_reference || false,
        blend_mode: l.blend_mode || 'overwrite',
        objCount: l.type === 'manual' ? l.editObjects.length : 0,
        editObjects: l.type === 'manual' ? l.editObjects : undefined,
        hasImage: l.type === 'plugin' ? !!l.image_base64 : false,
      })),
    );
    const occKey = JSON.stringify(occupancySettings);
    return `${shouldShowBlendedPreview}::${sourceKey}::${mapKey}::${layerOrder.join(',')}::${customKey}::${occKey}`;
  }, [shouldShowBlendedPreview, mapSources, mapLayers, layerOrder, customLayers, occupancySettings]);

  useEffect(() => {
    if (!shouldShowBlendedPreview) {
      setPreviewTexture(null);
      stopLoading(LOADING_TASK_ID);
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    startLoading({
      id: LOADING_TASK_ID,
      message: isExportPreview ? 'エクスポートプレビューを生成中...' : '占有状態プレビューを生成中...',
      blocking: true,
    });
    setPreviewError(null);

    // Read when the request is made, not subscribed to: switching the setting must not regenerate the preview.
    const useCache = useAppStore.getState().enableBlendCache;
    if (useCache) holdsBackendCache.current = true;

    // Dev only: prints where the time of this preview went (see `createTrace`).
    const trace = createTrace('Blend Preview');

    latestRequest.current = prepareLayersForExport(
      { mapSources, mapLayers, customLayers, layerOrder },
      useCache ? { rasterCache: rasterCache.current } : {},
    )
      .then((layerInputs) => {
        if (cancelled) return null;
        if (!layerInputs || layerInputs.length === 0) return null;
        const sent = layerInputs.reduce((sum, layer) => sum + (layer.image_base64?.length ?? 0), 0);
        trace.mark('prepare layers (rasterize + toDataURL)', `${layerInputs.length} layers, ${megabytes(sent)} base64`);
        return BackendAPI.blendMapPreview(layerInputs, ++lastRequestId, useCache);
      })
      .then((result) => {
        if (cancelled || !result) {
          stopLoading(LOADING_TASK_ID);
          return;
        }
        trace.mark('IPC round trip (send + backend + receive)', `${megabytes(result.rgba.length)} received`);
        const texture = textureFromPreview(result);
        trace.mark('create texture');
        setPreviewTexture(texture);
        setPreviewInfo({
          resolution: result.resolution,
          origin: result.origin,
          occupied_thresh: occupancySettings.defaultOccupiedThresh,
          free_thresh: occupancySettings.defaultFreeThresh,
          negate: occupancySettings.defaultNegate,
        });
        stopLoading(LOADING_TASK_ID);
        void trace.markAfterPaint('render + GPU upload (2 frames)').then(() => trace.end());
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[Blend Preview] Blend Preview failed:', err);
        setPreviewError(String(err));
        stopLoading(LOADING_TASK_ID);
      });

    return () => {
      cancelled = true;
      stopLoading(LOADING_TASK_ID);
    };
  }, [
    shouldShowBlendedPreview,
    previewSyncKey,
    mapSources,
    mapLayers,
    layerOrder,
    customLayers,
    occupancySettings,
    isExportPreview,
    startLoading,
    stopLoading,
  ]);

  // Give the memory back once the preview is off, or the cache is switched off.
  useEffect(() => {
    if (shouldShowBlendedPreview && enableBlendCache) return;
    rasterCache.current.clear();
    if (!holdsBackendCache.current) return;
    holdsBackendCache.current = false;
    void latestRequest.current
      .then(() => BackendAPI.clearBlendCache())
      .catch((err) => console.error('[Blend Preview] Failed to release the cache:', err));
  }, [shouldShowBlendedPreview, enableBlendCache]);

  useEffect(() => {
    const cache = rasterCache.current;
    const pending = latestRequest;
    const holds = holdsBackendCache;
    return () => {
      cache.clear();
      if (!holds.current) return;
      holds.current = false;
      void pending.current.then(() => BackendAPI.clearBlendCache()).catch(() => {});
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewTexture && !previewTexture.destroyed) {
        // The texture owns its source (made in `textureFromPreview`), so destroy that as well.
        previewTexture.destroy(true);
      }
    };
  }, [previewTexture]);

  return { shouldShowBlendedPreview, previewTexture, previewInfo, previewError };
}
