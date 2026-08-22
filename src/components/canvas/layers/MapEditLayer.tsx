import { FederatedPointerEvent } from 'pixi.js';
import { ManualCustomLayer, EditObject } from '../../../types/store';
import { CanvasHandle } from '../common/CanvasHandle';
import { computePointsBoundingBox } from '../../../utils/geometry';

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
  const safeScale = Math.max(scale, 0.001);

  // Render a single EditObject
  const renderObject = (layerId: string, obj: EditObject, opacity: number, isPreview = false) => {
    const isSelected = !isExportPreview && !isPreview && selectedEditObjectId === obj.id;
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
            eventMode={isExportPreview || isPreview ? 'none' : 'dynamic'}
            cursor="pointer"
            onPointerDown={(e: FederatedPointerEvent) => onObjectPointerDown?.(e, layerId, obj.id)}
            draw={(g) => {
              g.clear();
              // When in export/blended preview, body is already rendered on the blended previewTexture
              if (!isExportPreview || isPreview) {
                g.fillStyle = { color: colorHex, alpha: opacity };
              }
              if (!isExportPreview || isSelected || isPreview) {
                g.strokeStyle = {
                  width: isSelected ? 2 / safeScale : 1 / safeScale,
                  color: strokeColor,
                  alpha: isSelected ? 1.0 : opacity,
                };
              }
              g.rect(-obj.width / 2, -obj.height / 2, obj.width, obj.height);
              if (!isExportPreview || isPreview) {
                g.fill();
              }
              if (!isExportPreview || isSelected || isPreview) {
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
            eventMode={isExportPreview || isPreview ? 'none' : 'dynamic'}
            cursor="pointer"
            onPointerDown={(e: FederatedPointerEvent) => onObjectPointerDown?.(e, layerId, obj.id)}
            draw={(g) => {
              g.clear();
              if (!isExportPreview || isPreview) {
                g.fillStyle = { color: colorHex, alpha: opacity };
              }
              if (!isExportPreview || isSelected || isPreview) {
                g.strokeStyle = {
                  width: isSelected ? 2 / safeScale : 1 / safeScale,
                  color: strokeColor,
                  alpha: isSelected ? 1.0 : opacity,
                };
              }
              g.circle(0, 0, obj.radius);
              if (!isExportPreview || isPreview) {
                g.fill();
              }
              if (!isExportPreview || isSelected || isPreview) {
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
            eventMode={isExportPreview || isPreview ? 'none' : 'dynamic'}
            cursor="pointer"
            onPointerDown={(e: FederatedPointerEvent) => onObjectPointerDown?.(e, layerId, obj.id)}
            draw={(g) => {
              g.clear();
              if (!isExportPreview || isPreview) {
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
    }
    return null;
  };

  const visibleLayers = editLayers
    .filter((l) => l.visible)
    .sort((a, b) => a.z_index - b.z_index);

  return (
    <>
      {/* Existing EditLayers */}
      {visibleLayers.map((layer) => (
        <pixiContainer key={layer.id}>
          {layer.editObjects.map((obj) => renderObject(layer.id, obj, layer.opacity))}
        </pixiContainer>
      ))}

      {/* Preview object being created */}
      {previewObject && renderObject('preview', previewObject, 0.7, true)}

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
