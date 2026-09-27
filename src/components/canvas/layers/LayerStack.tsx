import { useMemo, type ReactNode } from 'react';
import type { Texture, TextStyle } from 'pixi.js';
import { useAppStore } from '../../../stores/appStore';
import { useResolvedMapLayers } from '../../../hooks/useResolvedMapLayers';
import { stackEntries } from '../../../utils/layerStack';
import type { CustomLayer } from '../../../types/store';
import { MapLayerSprite } from '../MapLayerSprite';
import { MapEditSingleLayer, type SingleLayerProps } from './MapEditLayer';

export type BlendedPreviewView = {
  texture: Texture | null;
  /** Pseudo map layer describing the blended image (origin, resolution, thresholds). */
  layer: unknown;
  error: string | null;
};

interface LayerStackProps {
  scale: number;
  textStyle: TextStyle;
  /** Grid drawn when there is nothing in the stack. */
  fallbackTexture: Texture;
  /** Non-null while the merged / occupancy preview replaces the stack; only reference layers stay on top of it. */
  blendedPreview: BlendedPreviewView | null;
  editHandlers: Pick<
    SingleLayerProps,
    'selectedEditObjectId' | 'onObjectPointerDown' | 'onObjectHandlePointerDown' | 'onObjectResizeHandlePointerDown'
  >;
  /** Drawn above every layer (edit tool previews, brush cursor). */
  children?: ReactNode;
}

const isDrawable = (texture: Texture | null): texture is Texture =>
  !!texture && !texture.destroyed && !!texture.source && !texture.source.destroyed && !!texture.source.style;

/**
 * The map instances and custom layers, drawn bottom to top in the order the user arranged them, so a
 * custom layer can sit between two maps.
 */
export function LayerStack({
  scale,
  textStyle,
  fallbackTexture,
  blendedPreview,
  editHandlers,
  children,
}: LayerStackProps) {
  const mapLayers = useAppStore((state) => state.mapLayers);
  const customLayers = useAppStore((state) => state.customLayers) || [];
  const layerOrder = useAppStore((state) => state.layerOrder);
  const resolvedMapLayers = useResolvedMapLayers();

  const bottomFirst = useMemo(
    () => stackEntries({ mapLayers, customLayers, layerOrder }).reverse(),
    [mapLayers, customLayers, layerOrder],
  );
  // While its use area is being drawn, the map is shown whole so the part being left out stays visible.
  const clipEditLayerId = useAppStore((state) =>
    state.appMode.mode === 'map_clip_edit' ? state.appMode.layerId : null,
  );
  const resolvedById = useMemo(
    () => new Map(resolvedMapLayers.map((l) => [l.id, l.id === clipEditLayerId ? { ...l, clip: null } : l])),
    [resolvedMapLayers, clipEditLayerId],
  );

  const renderCustomLayer = (layer: CustomLayer, isExportPreview: boolean) =>
    layer.type === 'plugin' ? (
      <MapLayerSprite key={layer.id} layer={layer} scale={scale} textStyle={textStyle} />
    ) : (
      <MapEditSingleLayer
        key={layer.id}
        scale={scale}
        layer={layer}
        isExportPreview={isExportPreview}
        {...editHandlers}
      />
    );

  return (
    <pixiContainer label="layer-stack-group">
      {blendedPreview ? (
        <>
          {blendedPreview.error && !blendedPreview.texture ? (
            <pixiText
              text={`Error: ${blendedPreview.error}`}
              x={0}
              y={0}
              style={textStyle}
              anchor={0.5}
              scale={{ x: 1 / scale, y: -1 / scale }}
            />
          ) : isDrawable(blendedPreview.texture) ? (
            <MapLayerSprite
              layer={blendedPreview.layer}
              overrideTexture={blendedPreview.texture}
              scale={scale}
              textStyle={textStyle}
            />
          ) : null}
          {bottomFirst.map((entry) =>
            entry.kind === 'custom' && entry.layer.visible && entry.layer.is_reference
              ? renderCustomLayer(entry.layer, true)
              : null,
          )}
        </>
      ) : bottomFirst.length === 0 ? (
        <pixiSprite texture={fallbackTexture} anchor={0.5} scale={{ x: 1, y: -1 }} />
      ) : (
        bottomFirst.map((entry) => {
          if (entry.kind === 'custom') return renderCustomLayer(entry.layer, false);
          const resolved = resolvedById.get(entry.layer.id);
          return resolved ? (
            <MapLayerSprite key={resolved.id} layer={resolved} scale={scale} textStyle={textStyle} />
          ) : null;
        })
      )}
      {children}
    </pixiContainer>
  );
}
