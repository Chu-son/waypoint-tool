import { useEffect, useMemo, useState } from 'react';
import { Texture } from 'pixi.js';
import { useAppStore } from '../../../stores/appStore';
import { BackendAPI } from '../../../api';
import { prepareLayersForExport } from '../../../services/mapRasterize';

const LOADING_TASK_ID = 'blended-preview';

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

    prepareLayersForExport({ mapSources, mapLayers, customLayers, layerOrder })
      .then((layerInputs) => {
        if (cancelled) return null;
        if (!layerInputs || layerInputs.length === 0) return null;
        return BackendAPI.blendMapPreview(layerInputs);
      })
      .then((result) => {
        if (cancelled || !result) {
          stopLoading(LOADING_TASK_ID);
          return;
        }
        const img = new Image();
        img.onload = () => {
          if (cancelled) return;
          setPreviewTexture(Texture.from(img));
          setPreviewInfo({
            resolution: result.resolution,
            origin: result.origin,
            occupied_thresh: occupancySettings.defaultOccupiedThresh,
            free_thresh: occupancySettings.defaultFreeThresh,
            negate: occupancySettings.defaultNegate,
          });
          stopLoading(LOADING_TASK_ID);
        };
        img.onerror = () => {
          if (cancelled) return;
          setPreviewError('Failed to load image texture from base64.');
          stopLoading(LOADING_TASK_ID);
        };
        img.src = result.image_data_b64;
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

  useEffect(() => {
    return () => {
      if (previewTexture && !previewTexture.destroyed) {
        previewTexture.destroy(false);
      }
    };
  }, [previewTexture]);

  return { shouldShowBlendedPreview, previewTexture, previewInfo, previewError };
}
