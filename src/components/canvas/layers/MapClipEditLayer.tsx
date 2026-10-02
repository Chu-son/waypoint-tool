import { memo, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import type { FederatedPointerEvent } from 'pixi.js';
import { useAppStore } from '../../../stores/appStore';
import { CLIP_HANDLES, handlePosition, type ClipHandle } from '../../../utils/mapClip';
import { CANVAS_CLIP_EDIT_COLOR, CANVAS_CONTRAST_COLOR, CANVAS_HIT_AREA_COLOR } from '../canvasConstants';

interface MapClipEditLayerProps {
  scale: number;
  onHandleDown: (e: FederatedPointerEvent, layerId: string, index: number, handle: ClipHandle) => void;
}

/** World Y points up, so a handle on the maximum-Y edge is on the top of the screen. */
const cursorFor = ({ hx, hy }: ClipHandle) =>
  hx === 0 ? 'ns-resize' : hy === 0 ? 'ew-resize' : hx * hy < 0 ? 'nwse-resize' : 'nesw-resize';

/**
 * The use area of the map layer being edited: each rectangle with a resize handle on every corner and
 * edge. New areas are drawn by dragging on the empty canvas (see `useMapClipEdit`).
 */
export const MapClipEditLayer = memo(function MapClipEditLayer({ scale, onHandleDown }: MapClipEditLayerProps) {
  const layerId = useAppStore((state) => (state.appMode.mode === 'map_clip_edit' ? state.appMode.layerId : null));
  const rects = useAppStore((state) => state.mapLayers.find((l) => l.id === layerId)?.clip?.rects);

  const drawAreas = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      for (const r of rects ?? []) {
        g.fillStyle = { color: CANVAS_CLIP_EDIT_COLOR, alpha: 0.12 };
        g.strokeStyle = { width: 2 / scale, color: CANVAS_CLIP_EDIT_COLOR, alpha: 0.9 };
        g.rect(r.x, r.y, r.width, r.height);
        g.fill();
        g.stroke();
      }
    },
    [rects, scale],
  );

  if (!layerId || !rects) return null;

  const size = 8 / scale;
  return (
    <pixiContainer label="map-clip-edit-layer" zIndex={1000}>
      <pixiGraphics draw={drawAreas} />
      {rects.flatMap((rect, index) =>
        CLIP_HANDLES.map((handle) => {
          const { x, y } = handlePosition(rect, handle);
          return (
            <pixiGraphics
              key={`${index}:${handle.hx}:${handle.hy}`}
              eventMode="dynamic"
              cursor={cursorFor(handle)}
              onPointerDown={(e: FederatedPointerEvent) => onHandleDown(e, layerId, index, handle)}
              draw={(g) => {
                g.clear();
                g.fillStyle = { color: CANVAS_HIT_AREA_COLOR, alpha: 0.001 };
                g.rect(x - size, y - size, size * 2, size * 2);
                g.fill();
                g.fillStyle = { color: CANVAS_CONTRAST_COLOR, alpha: 1 };
                g.strokeStyle = { width: 1.5 / scale, color: CANVAS_CLIP_EDIT_COLOR };
                g.rect(x - size / 2, y - size / 2, size, size);
                g.fill();
                g.stroke();
              }}
            />
          );
        }),
      )}
    </pixiContainer>
  );
});
