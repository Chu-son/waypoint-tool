import { useEffect, useMemo, useState } from 'react';
import { Texture, TextStyle } from 'pixi.js';
import { useAppStore } from '../../stores/appStore';
import { ProjectMapLayer, PluginCustomLayer } from '../../types/store';
import { resolveThemeVariables } from '../../utils/themePresets';
import { hexStringToVec3 } from '../../utils/colorUtils';
import { OccupancyHighlightFilter } from './filters/OccupancyHighlightFilter';

/** Draws one occupancy-grid image (ROS map or plugin layer) at its ROS origin, with its name label. */
export function MapLayerSprite({
  layer,
  scale,
  textStyle,
  overrideTexture,
}: {
  layer: ProjectMapLayer | PluginCustomLayer | any;
  scale: number;
  textStyle: TextStyle;
  overrideTexture?: Texture | null;
}) {
  const [texture, setTexture] = useState<Texture | null>(overrideTexture || null);
  const [imgSize, setImgSize] = useState({
    w: overrideTexture ? overrideTexture.width : 0,
    h: overrideTexture ? overrideTexture.height : 0,
  });
  const showOccupancyHighlight = useAppStore((state) => state.showOccupancyHighlight);
  const occupancyHighlightAlpha = useAppStore((state) => state.occupancyHighlightAlpha);
  const customUiConfig = useAppStore((state) => state.customUiConfig);
  const isCustomUiMode = useAppStore((state) => state.isCustomUiMode);
  const themeMode = useAppStore((state) => state.themeMode);
  const themePreset = useAppStore((state) => state.themePreset);

  const occThresh = layer.info?.occupied_thresh ?? 0.65;
  const freeThresh = layer.info?.free_thresh ?? 0.25;
  const negate = layer.info?.negate ?? 0;

  const resolvedTheme = useMemo(() => {
    if (isCustomUiMode && customUiConfig?.theme) {
      return resolveThemeVariables(customUiConfig.theme);
    }
    return resolveThemeVariables({
      preset: themePreset || 'default',
      colorScheme: themeMode,
    });
  }, [isCustomUiMode, customUiConfig, themeMode, themePreset]);

  const freeColorVec = useMemo(
    () => hexStringToVec3(resolvedTheme.variables['--color-occupancy-free'], [0.0627, 0.7255, 0.5059]),
    [resolvedTheme],
  );
  const obstacleColorVec = useMemo(
    () => hexStringToVec3(resolvedTheme.variables['--color-occupancy-obstacle'], [0.9373, 0.2667, 0.2667]),
    [resolvedTheme],
  );
  const unknownColorVec = useMemo(
    () => hexStringToVec3(resolvedTheme.variables['--color-occupancy-unknown'], [0.6588, 0.3333, 0.9686]),
    [resolvedTheme],
  );

  const highlightFilter = useMemo(() => {
    if (!showOccupancyHighlight) return null;
    try {
      return new OccupancyHighlightFilter({
        occupiedThresh: occThresh,
        freeThresh: freeThresh,
        negate: negate,
        alpha: occupancyHighlightAlpha,
        freeColor: freeColorVec,
        obstacleColor: obstacleColorVec,
        unknownColor: unknownColorVec,
      });
    } catch {
      return null;
    }
  }, [showOccupancyHighlight, freeColorVec, obstacleColorVec, unknownColorVec]);

  useEffect(() => {
    if (highlightFilter) {
      highlightFilter.updateUniforms({
        occupiedThresh: occThresh,
        freeThresh: freeThresh,
        negate: negate,
        alpha: occupancyHighlightAlpha,
        freeColor: freeColorVec,
        obstacleColor: obstacleColorVec,
        unknownColor: unknownColorVec,
      });
    }
  }, [
    highlightFilter,
    occThresh,
    freeThresh,
    negate,
    occupancyHighlightAlpha,
    freeColorVec,
    obstacleColorVec,
    unknownColorVec,
  ]);

  useEffect(() => {
    return () => {
      if (highlightFilter && !highlightFilter.destroyed) {
        highlightFilter.destroy();
      }
    };
  }, [highlightFilter]);

  useEffect(() => {
    if (overrideTexture) {
      setTexture(overrideTexture);
      setImgSize({ w: overrideTexture.width, h: overrideTexture.height });
      return;
    }
    let cancelled = false;
    if (layer.image_base64) {
      const src = layer.image_base64.startsWith('data:')
        ? layer.image_base64
        : `data:image/png;base64,${layer.image_base64}`;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        const newTexture = Texture.from(img);
        setTexture(newTexture);
        setImgSize({ w: img.width, h: img.height });
      };
      img.onerror = (err) => {
        console.error(`[MapLayerSprite] Failed to load image for layer "${layer.name}":`, err);
      };
      img.src = src;
    }
    return () => {
      cancelled = true;
    };
  }, [layer.image_base64, layer.name, overrideTexture]);

  // Clean up the previous texture safely without nulling shared TextureSource style
  useEffect(() => {
    return () => {
      if (texture && !texture.destroyed && !overrideTexture) {
        texture.destroy(false);
      }
    };
  }, [texture, overrideTexture]);

  if (
    !texture ||
    texture.destroyed ||
    !texture.source ||
    texture.source.destroyed ||
    !texture.source.style ||
    !layer.visible
  ) {
    return null;
  }

  // Extract metadata (with safe fallbacks)
  const { resolution = 0.05, origin = [0, 0, 0] } = layer.info || {};
  const [ox, oy, oyaw] = origin;
  const yaw = oyaw || 0;

  // Render the map aligned to ROS origin
  // Anchor [0, 1] means the bottom-left of the image maps to the exact (ox, oy).
  // Y scale is inverted so that the image draws right-side up inside the Y-inverted Pixi Container.
  // Top-left Y calculation: Origin is bottom-left, so we add height * resolution
  // We must also account for the map's yaw rotation (yaw).
  const h = imgSize.h || (texture ? texture.height : 0) || ('height' in layer ? layer.height : layer.info?.height) || 0;
  const H = h * resolution;
  const topLeftX = ox - H * Math.sin(yaw);
  const topLeftY = oy + H * Math.cos(yaw);

  return (
    <pixiContainer>
      <pixiSprite
        key={texture.uid || layer.id}
        texture={texture}
        anchor={{ x: 0, y: 1 }}
        x={ox}
        y={oy}
        rotation={yaw}
        scale={{ x: resolution, y: -resolution }}
        alpha={layer.opacity}
        filters={highlightFilter ? [highlightFilter] : undefined}
      />
      {/* Top-Left Map Layer Name */}
      <pixiContainer x={topLeftX} y={topLeftY} scale={{ x: 1 / scale, y: -1 / scale }}>
        <pixiText text={layer.name || 'Map Layer'} style={textStyle} anchor={{ x: 0, y: 1 }} x={4} y={-4} />
      </pixiContainer>
    </pixiContainer>
  );
}
