import { FederatedPointerEvent } from 'pixi.js';
import { EditLayer, EditObject } from '../../../types/store';

interface MapEditLayerProps {
  scale: number;
  editLayers: EditLayer[];
  activeEditLayerId: string | null;
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
              g.fillStyle = { color: colorHex, alpha: opacity };
              g.strokeStyle = {
                width: isSelected ? 2 / safeScale : 1 / safeScale,
                color: strokeColor,
                alpha: isSelected ? 1.0 : opacity,
              };
              g.rect(-obj.width / 2, -obj.height / 2, obj.width, obj.height);
              g.fill();
              g.stroke();
            }}
          />

          {/* Corner resize handles (when selected) */}
          {isSelected &&
            rectCorners.map((c) => (
              <pixiGraphics
                key={c.name}
                x={c.x}
                y={c.y}
                eventMode="dynamic"
                cursor="pointer"
                onPointerDown={(e: FederatedPointerEvent) =>
                  onObjectResizeHandlePointerDown?.(e, layerId, obj.id, c.name)
                }
                draw={(g) => {
                  g.clear();
                  g.fillStyle = { color: 0xffffff, alpha: 0.001 };
                  g.circle(0, 0, 10 / safeScale);
                  g.fill();

                  g.strokeStyle = { width: 1.5 / safeScale, color: 0x3b82f6 };
                  g.fillStyle = { color: 0xffffff, alpha: 1.0 };
                  g.rect(-3 / safeScale, -3 / safeScale, 6 / safeScale, 6 / safeScale);
                  g.fill();
                  g.stroke();
                }}
              />
            ))}

          {/* Rotation handle (when selected) */}
          {isSelected && (
            <pixiGraphics
              x={handleOffset}
              y={0}
              eventMode="dynamic"
              cursor="grab"
              onPointerDown={(e: FederatedPointerEvent) => onObjectHandlePointerDown?.(e, layerId, obj.id)}
              draw={(g) => {
                g.clear();
                // Invisible hit circle
                g.fillStyle = { color: 0xffffff, alpha: 0.001 };
                g.circle(0, 0, 15 / safeScale);
                g.fill();

                // Visible handle dot
                g.strokeStyle = { width: 1.5 / safeScale, color: 0x3b82f6 };
                g.fillStyle = { color: 0xffffff, alpha: 0.9 };
                g.circle(0, 0, 4 / safeScale);
                g.fill();
                g.stroke();

                // Connecting line
                g.moveTo(-15 / safeScale, 0);
                g.lineTo(-4 / safeScale, 0);
                g.stroke();
              }}
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
              g.fillStyle = { color: colorHex, alpha: opacity };
              g.strokeStyle = {
                width: isSelected ? 2 / safeScale : 1 / safeScale,
                color: strokeColor,
                alpha: isSelected ? 1.0 : opacity,
              };
              g.circle(0, 0, obj.radius);
              g.fill();
              g.stroke();
            }}
          />
          {isSelected &&
            quadHandles.map((qh) => (
              <pixiGraphics
                key={qh.name}
                x={qh.x}
                y={qh.y}
                eventMode="dynamic"
                cursor="pointer"
                onPointerDown={(e: FederatedPointerEvent) =>
                  onObjectResizeHandlePointerDown?.(e, layerId, obj.id, qh.name)
                }
                draw={(g) => {
                  g.clear();
                  g.fillStyle = { color: 0xffffff, alpha: 0.001 };
                  g.circle(0, 0, 10 / safeScale);
                  g.fill();

                  g.strokeStyle = { width: 1.5 / safeScale, color: 0x3b82f6 };
                  g.fillStyle = { color: 0xffffff, alpha: 1.0 };
                  g.circle(0, 0, 4 / safeScale);
                  g.fill();
                  g.stroke();
                }}
              />
            ))}
        </pixiContainer>
      );
    } else if (obj.type === 'freehand') {
      if (!obj.points.length) return null;

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      obj.points.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });

      const freehandCorners = [
        { name: 'nw', x: minX, y: minY },
        { name: 'ne', x: maxX, y: minY },
        { name: 'se', x: maxX, y: maxY },
        { name: 'sw', x: minX, y: maxY },
      ];

      return (
        <pixiContainer key={obj.id}>
          <pixiGraphics
            eventMode={isExportPreview || isPreview ? 'none' : 'dynamic'}
            cursor="pointer"
            onPointerDown={(e: FederatedPointerEvent) => onObjectPointerDown?.(e, layerId, obj.id)}
            draw={(g) => {
              g.clear();
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

              if (isSelected) {
                g.strokeStyle = { width: 1 / safeScale, color: 0x3b82f6, alpha: 0.8 };
                g.rect(minX, minY, maxX - minX, maxY - minY);
                g.stroke();
              }
            }}
          />
          {isSelected &&
            freehandCorners.map((fc) => (
              <pixiGraphics
                key={fc.name}
                x={fc.x}
                y={fc.y}
                eventMode="dynamic"
                cursor="pointer"
                onPointerDown={(e: FederatedPointerEvent) =>
                  onObjectResizeHandlePointerDown?.(e, layerId, obj.id, fc.name)
                }
                draw={(g) => {
                  g.clear();
                  g.fillStyle = { color: 0xffffff, alpha: 0.001 };
                  g.circle(0, 0, 10 / safeScale);
                  g.fill();

                  g.strokeStyle = { width: 1.5 / safeScale, color: 0x3b82f6 };
                  g.fillStyle = { color: 0xffffff, alpha: 1.0 };
                  g.rect(-3 / safeScale, -3 / safeScale, 6 / safeScale, 6 / safeScale);
                  g.fill();
                  g.stroke();
                }}
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
