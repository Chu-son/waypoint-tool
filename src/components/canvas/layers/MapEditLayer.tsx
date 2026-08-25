import { FederatedPointerEvent } from 'pixi.js';
import { ManualCustomLayer, EditObject } from '../../../types/store';
import { CanvasHandle } from '../common/CanvasHandle';
import { computePointsBoundingBox } from '../../../utils/geometry';

interface SingleLayerProps {
  scale: number;
  layer: ManualCustomLayer;
  selectedEditObjectId: string | null;
  isExportPreview: boolean;
  onObjectPointerDown?: (e: FederatedPointerEvent, layerId: string, objId: string) => void;
  onObjectHandlePointerDown?: (e: FederatedPointerEvent, layerId: string, objId: string) => void;
  onObjectResizeHandlePointerDown?: (e: FederatedPointerEvent, layerId: string, objId: string, handle: string) => void;
}

/**
 * Renders an EditObject for a ManualCustomLayer.
 */
function renderSingleEditObject(
  layerId: string,
  obj: EditObject,
  opacity: number,
  scale: number,
  selectedEditObjectId: string | null,
  isExportPreview: boolean,
  isPreview = false,
  isReference = false,
  onObjectPointerDown?: (e: FederatedPointerEvent, layerId: string, objId: string) => void,
  onObjectHandlePointerDown?: (e: FederatedPointerEvent, layerId: string, objId: string) => void,
  onObjectResizeHandlePointerDown?: (e: FederatedPointerEvent, layerId: string, objId: string, handle: string) => void
) {
  const safeScale = Math.max(scale, 0.001);
  const isEffectiveExportPreview = isExportPreview && !isReference;
  const isSelected = !isEffectiveExportPreview && !isPreview && selectedEditObjectId === obj.id;
  const fillVal = Math.min(255, Math.max(0, Math.round(obj.fillValue)));
  const colorHex = (fillVal << 16) | (fillVal << 8) | fillVal;
  const strokeColor = isSelected ? 0x3b82f6 : isPreview ? 0x94a3b8 : colorHex;

  if (obj.type === 'rect') {
    const handleOffset = obj.width / 2 + 20 / safeScale;
    const rectCorners = [
      { name: 'nw', x: -obj.width / 2, y: -obj.height / 2 },
      { name: 'ne', x: obj.width / 2, y: -obj.height / 2 },
      { name: 'se', x: obj.width / 2, y: obj.height / 2 },
      { name: 'sw', x: -obj.width / 2, y: obj.height / 2 },
    ];

    return (
      <pixiContainer key={obj.id} x={obj.cx} y={obj.cy} rotation={obj.angle}>
        {/* Main rectangle graphics */}
        <pixiGraphics
          eventMode={isEffectiveExportPreview || isPreview ? 'none' : 'dynamic'}
          cursor="pointer"
          onPointerDown={(e: FederatedPointerEvent) => onObjectPointerDown?.(e, layerId, obj.id)}
          draw={(g) => {
            g.clear();
            if (!isEffectiveExportPreview || isPreview) {
              g.fillStyle = { color: colorHex, alpha: opacity };
            }
            if (!isEffectiveExportPreview || isSelected || isPreview) {
              g.strokeStyle = {
                width: isSelected ? 2 / safeScale : 1 / safeScale,
                color: strokeColor,
                alpha: isSelected ? 1.0 : opacity,
              };
            }
            g.rect(-obj.width / 2, -obj.height / 2, obj.width, obj.height);
            if (!isEffectiveExportPreview || isPreview) {
              g.fill();
            }
            if (!isEffectiveExportPreview || isSelected || isPreview) {
              g.stroke();
            }
          }}
        />

        {/* Corner resize handles (when selected) */}
        {isSelected &&
          rectCorners.map((c) => (
            <CanvasHandle
              key={c.name}
              x={c.x}
              y={c.y}
              scale={scale}
              type="square"
              colorHex={0x3b82f6}
              cursor="pointer"
              onPointerDown={(e: FederatedPointerEvent) =>
                onObjectResizeHandlePointerDown?.(e, layerId, obj.id, c.name)
              }
            />
          ))}

        {/* Rotation handle (when selected) */}
        {isSelected && (
          <CanvasHandle
            x={handleOffset}
            y={0}
            scale={scale}
            type="circle"
            colorHex={0x3b82f6}
            cursor="grab"
            onPointerDown={(e: FederatedPointerEvent) => onObjectHandlePointerDown?.(e, layerId, obj.id)}
          />
        )}
      </pixiContainer>
    );
  } else if (obj.type === 'circle') {
    const quadHandles = [
      { name: 'e', x: obj.radius, y: 0 },
      { name: 'w', x: -obj.radius, y: 0 },
      { name: 'n', x: 0, y: obj.radius },
      { name: 's', x: 0, y: -obj.radius },
    ];

    return (
      <pixiContainer key={obj.id} x={obj.cx} y={obj.cy}>
        <pixiGraphics
          eventMode={isEffectiveExportPreview || isPreview ? 'none' : 'dynamic'}
          cursor="pointer"
          onPointerDown={(e: FederatedPointerEvent) => onObjectPointerDown?.(e, layerId, obj.id)}
          draw={(g) => {
            g.clear();
            if (!isEffectiveExportPreview || isPreview) {
              g.fillStyle = { color: colorHex, alpha: opacity };
            }
            if (!isEffectiveExportPreview || isSelected || isPreview) {
              g.strokeStyle = {
                width: isSelected ? 2 / safeScale : 1 / safeScale,
                color: strokeColor,
                alpha: isSelected ? 1.0 : opacity,
              };
            }
            g.circle(0, 0, obj.radius);
            if (!isEffectiveExportPreview || isPreview) {
              g.fill();
            }
            if (!isEffectiveExportPreview || isSelected || isPreview) {
              g.stroke();
            }
          }}
        />
        {isSelected &&
          quadHandles.map((qh) => (
            <CanvasHandle
              key={qh.name}
              x={qh.x}
              y={qh.y}
              scale={scale}
              type="circle"
              colorHex={0x3b82f6}
              cursor="pointer"
              onPointerDown={(e: FederatedPointerEvent) =>
                onObjectResizeHandlePointerDown?.(e, layerId, obj.id, qh.name)
              }
            />
          ))}
      </pixiContainer>
    );
  } else if (obj.type === 'freehand') {
    if (!obj.points.length) return null;

    const bbox = computePointsBoundingBox(obj.points);
    const freehandCorners = [
      { name: 'nw', x: bbox.minX, y: bbox.minY },
      { name: 'ne', x: bbox.maxX, y: bbox.minY },
      { name: 'se', x: bbox.maxX, y: bbox.maxY },
      { name: 'sw', x: bbox.minX, y: bbox.maxY },
    ];

    return (
      <pixiContainer key={obj.id}>
        <pixiGraphics
          eventMode={isEffectiveExportPreview || isPreview ? 'none' : 'dynamic'}
          cursor="pointer"
          onPointerDown={(e: FederatedPointerEvent) => onObjectPointerDown?.(e, layerId, obj.id)}
          draw={(g) => {
            g.clear();
            if (!isEffectiveExportPreview || isPreview) {
              g.strokeStyle = {
                width: obj.brushRadius * 2,
                color: strokeColor,
                alpha: opacity,
                cap: 'round',
                join: 'round',
              };
              g.fillStyle = { color: colorHex, alpha: opacity };

              const pts = obj.points;
              g.moveTo(pts[0].x, pts[0].y);
              for (let i = 1; i < pts.length; i++) {
                g.lineTo(pts[i].x, pts[i].y);
              }
              if (pts.length === 1) {
                g.circle(pts[0].x, pts[0].y, obj.brushRadius);
                g.fill();
              } else {
                g.stroke();
              }
            }

            if (isSelected) {
              g.strokeStyle = { width: 1 / safeScale, color: 0x3b82f6, alpha: 0.8 };
              g.rect(bbox.minX, bbox.minY, bbox.width, bbox.height);
              g.stroke();
            }
          }}
        />
        {isSelected &&
          freehandCorners.map((fc) => (
            <CanvasHandle
              key={fc.name}
              x={fc.x}
              y={fc.y}
              scale={scale}
              type="square"
              colorHex={0x3b82f6}
              cursor="pointer"
              onPointerDown={(e: FederatedPointerEvent) =>
                onObjectResizeHandlePointerDown?.(e, layerId, obj.id, fc.name)
              }
            />
          ))}
      </pixiContainer>
    );
  } else if (obj.type === 'line') {
    const midX = (obj.x1 + obj.x2) / 2;
    const midY = (obj.y1 + obj.y2) / 2;
    const lineStrokeWidth = Math.max(2 / safeScale, obj.lineWidth || 0);

    return (
      <pixiContainer key={obj.id}>
        <pixiGraphics
          eventMode={isEffectiveExportPreview || isPreview ? 'none' : 'dynamic'}
          cursor="pointer"
          onPointerDown={(e: FederatedPointerEvent) => onObjectPointerDown?.(e, layerId, obj.id)}
          draw={(g) => {
            g.clear();
            // Invisible broad stroke for easy hit test
            g.strokeStyle = { width: 14 / safeScale, color: 0xffffff, alpha: 0.001 };
            g.moveTo(obj.x1, obj.y1);
            g.lineTo(obj.x2, obj.y2);
            g.stroke();

            // Selection glow outline
            if (isSelected) {
              g.strokeStyle = { width: lineStrokeWidth + 4 / safeScale, color: 0x3b82f6, alpha: 0.6 };
              g.moveTo(obj.x1, obj.y1);
              g.lineTo(obj.x2, obj.y2);
              g.stroke();
            }

            // Visible line stroke
            if (!isEffectiveExportPreview || isPreview) {
              g.strokeStyle = {
                width: lineStrokeWidth,
                color: strokeColor,
                alpha: opacity,
                cap: 'round',
              };
              g.moveTo(obj.x1, obj.y1);
              g.lineTo(obj.x2, obj.y2);
              g.stroke();

              // Endpoints
              g.fillStyle = { color: colorHex, alpha: opacity };
              g.circle(obj.x1, obj.y1, 3 / safeScale);
              g.circle(obj.x2, obj.y2, 3 / safeScale);
              g.fill();
            } else if (isSelected) {
              g.strokeStyle = { width: lineStrokeWidth, color: 0x3b82f6, alpha: 1.0 };
              g.moveTo(obj.x1, obj.y1);
              g.lineTo(obj.x2, obj.y2);
              g.stroke();
            }
          }}
        />

        {/* Handles when selected */}
        {isSelected && (
          <>
            <CanvasHandle
              x={obj.x1}
              y={obj.y1}
              scale={scale}
              type="square"
              colorHex={0x3b82f6}
              cursor="crosshair"
              onPointerDown={(e: FederatedPointerEvent) =>
                onObjectResizeHandlePointerDown?.(e, layerId, obj.id, 'start')
              }
            />
            <CanvasHandle
              x={obj.x2}
              y={obj.y2}
              scale={scale}
              type="square"
              colorHex={0x3b82f6}
              cursor="crosshair"
              onPointerDown={(e: FederatedPointerEvent) =>
                onObjectResizeHandlePointerDown?.(e, layerId, obj.id, 'end')
              }
            />
            <CanvasHandle
              x={midX}
              y={midY}
              scale={scale}
              type="circle"
              colorHex={0x3b82f6}
              cursor="move"
              onPointerDown={(e: FederatedPointerEvent) =>
                onObjectResizeHandlePointerDown?.(e, layerId, obj.id, 'midpoint')
              }
            />
          </>
        )}
      </pixiContainer>
    );
  }
  return null;
}

/**
 * Renders a single manual custom layer with its vector edit objects.
 */
export function MapEditSingleLayer({
  scale,
  layer,
  selectedEditObjectId,
  isExportPreview,
  onObjectPointerDown,
  onObjectHandlePointerDown,
  onObjectResizeHandlePointerDown,
}: SingleLayerProps) {
  if (!layer.visible) return null;

  return (
    <pixiContainer key={layer.id}>
      {layer.editObjects.map((obj) =>
        renderSingleEditObject(
          layer.id,
          obj,
          layer.opacity,
          scale,
          selectedEditObjectId,
          isExportPreview,
          false,
          !!layer.is_reference,
          onObjectPointerDown,
          onObjectHandlePointerDown,
          onObjectResizeHandlePointerDown
        )
      )}
    </pixiContainer>
  );
}

interface ToolOverlayProps {
  scale: number;
  previewObject: EditObject | null;
  brushPreviewPos: { x: number; y: number } | null;
  brushPreviewRadius: number;
  isExportPreview: boolean;
}

/**
 * Renders transient creation previews and brush cursor overlay.
 */
export function MapEditToolOverlay({
  scale,
  previewObject,
  brushPreviewPos,
  brushPreviewRadius,
  isExportPreview,
}: ToolOverlayProps) {
  const safeScale = Math.max(scale, 0.001);

  return (
    <>
      {/* Preview object being created */}
      {previewObject &&
        renderSingleEditObject(
          'preview',
          previewObject,
          0.7,
          scale,
          null,
          isExportPreview,
          true,
          false
        )}

      {/* Brush cursor preview for freehand tool */}
      {!isExportPreview && brushPreviewPos && brushPreviewRadius > 0 && (
        <pixiGraphics
          x={brushPreviewPos.x}
          y={brushPreviewPos.y}
          eventMode="none"
          draw={(g) => {
            g.clear();
            g.strokeStyle = { width: 1.5 / safeScale, color: 0x3b82f6, alpha: 0.8 };
            g.fillStyle = { color: 0x3b82f6, alpha: 0.15 };
            g.circle(0, 0, brushPreviewRadius);
            g.fill();
            g.stroke();
          }}
        />
      )}
    </>
  );
}

interface MapEditLayerProps {
  scale: number;
  editLayers: ManualCustomLayer[];
  selectedEditObjectId: string | null;
  previewObject: EditObject | null;
  brushPreviewPos: { x: number; y: number } | null;
  brushPreviewRadius: number;
  isExportPreview: boolean;
  onObjectPointerDown?: (e: FederatedPointerEvent, layerId: string, objId: string) => void;
  onObjectHandlePointerDown?: (e: FederatedPointerEvent, layerId: string, objId: string) => void;
  onObjectResizeHandlePointerDown?: (e: FederatedPointerEvent, layerId: string, objId: string, handle: string) => void;
}

/**
 * Legacy MapEditLayer component for rendering multiple editLayers together.
 */
export function MapEditLayer({
  scale,
  editLayers,
  selectedEditObjectId,
  previewObject,
  brushPreviewPos,
  brushPreviewRadius,
  isExportPreview,
  onObjectPointerDown,
  onObjectHandlePointerDown,
  onObjectResizeHandlePointerDown,
}: MapEditLayerProps) {
  const visibleLayers = editLayers
    .filter((l) => l.visible)
    .sort((a, b) => a.z_index - b.z_index);

  return (
    <>
      {/* Existing EditLayers */}
      {visibleLayers.map((layer) => (
        <MapEditSingleLayer
          key={layer.id}
          scale={scale}
          layer={layer}
          selectedEditObjectId={selectedEditObjectId}
          isExportPreview={isExportPreview}
          onObjectPointerDown={onObjectPointerDown}
          onObjectHandlePointerDown={onObjectHandlePointerDown}
          onObjectResizeHandlePointerDown={onObjectResizeHandlePointerDown}
        />
      ))}

      {/* Tool preview overlay */}
      <MapEditToolOverlay
        scale={scale}
        previewObject={previewObject}
        brushPreviewPos={brushPreviewPos}
        brushPreviewRadius={brushPreviewRadius}
        isExportPreview={isExportPreview}
      />
    </>
  );
}
