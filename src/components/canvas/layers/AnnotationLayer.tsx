import { useMemo } from 'react';
import { FederatedPointerEvent, TextStyle } from 'pixi.js';
import { useAppStore } from '../../../stores/appStore';
import {
  AnnotationObject,
  PointAnnotation,
  OrientedPointAnnotation,
  LineAnnotation,
  RectAnnotation,
  CircleAnnotation,
} from '../../../types/store';
import { CanvasHandle } from '../common/CanvasHandle';

interface AnnotationLayerProps {
  scale: number;
  textStyle?: TextStyle;
  previewObject?: AnnotationObject | null;
  onAnnotationPointerDown?: (e: FederatedPointerEvent, id: string) => void;
  onAnnotationHandlePointerDown?: (e: FederatedPointerEvent, id: string, handleType: string) => void;
}

export function parseHexColor(colorStr?: string, fallback = 0x3b82f6): number {
  if (!colorStr) return fallback;
  const cleaned = colorStr.replace('#', '');
  const parsed = parseInt(cleaned, 16);
  return isNaN(parsed) ? fallback : parsed;
}

export function AnnotationLayer({
  scale,
  previewObject,
  onAnnotationPointerDown,
  onAnnotationHandlePointerDown,
}: AnnotationLayerProps) {
  const annotationObjects = useAppStore((state) => state.annotationObjects) || {};
  const annotationGroups = useAppStore((state) => state.annotationGroups) || {};
  const annotationOrder = useAppStore((state) => state.annotationOrder) || [];
  const selectedAnnotationIds = useAppStore((state) => state.selectedAnnotationIds) || [];
  const showAnnotations = useAppStore((state) => state.showAnnotations);
  const showAnnotationLabels = useAppStore((state) => state.showAnnotationLabels);
  const isAnnotationEditMode = useAppStore((state) => state.isAnnotationEditMode);
  const activeAnnotationSubTool = useAppStore((state) => state.activeAnnotationSubTool);

  const safeScale = Math.max(scale, 0.001);
  const isPlacing = isAnnotationEditMode && activeAnnotationSubTool !== 'select';

  // Label style with outline for readability
  const labelStyle = useMemo(
    () =>
      new TextStyle({
        fill: '#ffffff',
        fontSize: 12,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        stroke: { color: '#000000', width: 2.5 },
      }),
    []
  );

  const renderSingleAnnotation = (obj: AnnotationObject, isPreview = false) => {
    if (!isPreview) {
      if (!obj.visible) return null;
      let currentGid = obj.group_id;
      while (currentGid) {
        const grp = annotationGroups[currentGid];
        if (grp && grp.visible === false) return null;
        currentGid = grp?.parent_id;
      }
    }

    const isSelected = !isPreview && selectedAnnotationIds.includes(obj.id);
    const baseColorHex = parseHexColor(obj.color, 0x3b82f6);
    const strokeWidth = (isSelected ? 3.0 : 2.0) / safeScale;
    const isInteractive = !isPreview;
    const cursor = isPlacing ? 'crosshair' : isInteractive ? 'pointer' : 'default';

    switch (obj.type) {
      case 'point': {
        const point = obj as PointAnnotation;
        const radius = 6 / safeScale;
        return (
          <pixiContainer key={point.id} x={point.x} y={point.y}>
            <pixiGraphics
              eventMode={isInteractive ? 'dynamic' : 'none'}
              cursor={cursor}
              onPointerDown={(e: FederatedPointerEvent) => onAnnotationPointerDown?.(e, point.id)}
              draw={(g) => {
                g.clear();
                // Outer glow / selection outline if selected
                if (isSelected) {
                  g.strokeStyle = { width: 2 / safeScale, color: 0x60a5fa, alpha: 0.9 };
                  g.circle(0, 0, radius + 3 / safeScale);
                  g.stroke();
                }
                g.fillStyle = { color: baseColorHex, alpha: 0.85 };
                g.strokeStyle = { width: strokeWidth, color: baseColorHex, alpha: 1.0 };
                g.circle(0, 0, radius);
                g.fill();
                g.stroke();
                // Center white dot
                g.fillStyle = { color: 0xffffff, alpha: 0.9 };
                g.circle(0, 0, 2 / safeScale);
                g.fill();
              }}
            />
            {isSelected && (
              <CanvasHandle
                x={0}
                y={0}
                scale={scale}
                type="circle"
                colorHex={0x3b82f6}
                cursor="move"
                onPointerDown={(e) => onAnnotationHandlePointerDown?.(e, point.id, 'center')}
              />
            )}
            {showAnnotationLabels && point.labelVisible && point.name && (
              <pixiText
                text={point.name}
                x={8 / safeScale}
                y={8 / safeScale}
                style={labelStyle}
                scale={{ x: 1 / safeScale, y: -1 / safeScale }}
              />
            )}
          </pixiContainer>
        );
      }

      case 'oriented_point': {
        const op = obj as OrientedPointAnnotation;
        const yaw = op.yaw || 0;
        const handleDist = 22 / safeScale;
        return (
          <pixiContainer key={op.id}>
            {/* Rotated Graphics and Handles */}
            <pixiContainer x={op.x} y={op.y} rotation={yaw}>
              <pixiGraphics
                eventMode={isInteractive ? 'dynamic' : 'none'}
                cursor={cursor}
                onPointerDown={(e: FederatedPointerEvent) => onAnnotationPointerDown?.(e, op.id)}
                draw={(g) => {
                  g.clear();
                  if (isSelected) {
                    g.strokeStyle = { width: 2 / safeScale, color: 0x60a5fa, alpha: 0.8 };
                    g.circle(0, 0, 16 / safeScale);
                    g.stroke();
                  }
                  g.strokeStyle = { width: strokeWidth, color: baseColorHex, alpha: 1.0 };
                  g.fillStyle = { color: baseColorHex, alpha: 0.85 };
                  // Triangle pointing forward (+X)
                  g.moveTo(12 / safeScale, 0);
                  g.lineTo(-6 / safeScale, 6 / safeScale);
                  g.lineTo(-6 / safeScale, -6 / safeScale);
                  g.lineTo(12 / safeScale, 0);
                  g.fill();
                  g.stroke();
                  // Center origin circle
                  g.circle(0, 0, 3 / safeScale);
                  g.fill();
                }}
              />
              {isSelected && (
                <CanvasHandle
                  x={handleDist}
                  y={0}
                  scale={scale}
                  type="circle"
                  colorHex={0x3b82f6}
                  cursor="grab"
                  onPointerDown={(e) => onAnnotationHandlePointerDown?.(e, op.id, 'yaw')}
                />
              )}
            </pixiContainer>

            {/* Unrotated Label */}
            {showAnnotationLabels && op.labelVisible && op.name && (
              <pixiText
                text={op.name}
                x={op.x + 8 / safeScale}
                y={op.y + 8 / safeScale}
                style={labelStyle}
                scale={{ x: 1 / safeScale, y: -1 / safeScale }}
              />
            )}
          </pixiContainer>
        );
      }

      case 'line': {
        const line = obj as LineAnnotation;
        const midX = (line.x1 + line.x2) / 2;
        const midY = (line.y1 + line.y2) / 2;
        return (
          <pixiContainer key={line.id}>
            <pixiGraphics
              eventMode={isInteractive ? 'dynamic' : 'none'}
              cursor={cursor}
              onPointerDown={(e: FederatedPointerEvent) => onAnnotationPointerDown?.(e, line.id)}
              draw={(g) => {
                g.clear();
                // Broad invisible hit area for easy line selection
                g.strokeStyle = { width: 14 / safeScale, color: 0xffffff, alpha: 0.001 };
                g.moveTo(line.x1, line.y1);
                g.lineTo(line.x2, line.y2);
                g.stroke();

                // Selection glow if selected
                if (isSelected) {
                  g.strokeStyle = { width: strokeWidth + 3 / safeScale, color: 0x60a5fa, alpha: 0.6 };
                  g.moveTo(line.x1, line.y1);
                  g.lineTo(line.x2, line.y2);
                  g.stroke();
                }

                // Visible line in chosen color
                g.strokeStyle = { width: strokeWidth, color: baseColorHex, alpha: 1.0 };
                g.moveTo(line.x1, line.y1);
                g.lineTo(line.x2, line.y2);
                g.stroke();

                // End endpoints in chosen color
                g.fillStyle = { color: baseColorHex, alpha: 1.0 };
                g.circle(line.x1, line.y1, 4 / safeScale);
                g.circle(line.x2, line.y2, 4 / safeScale);
                g.fill();
              }}
            />
            {isSelected && (
              <>
                <CanvasHandle
                  x={line.x1}
                  y={line.y1}
                  scale={scale}
                  type="square"
                  colorHex={0x3b82f6}
                  cursor="crosshair"
                  onPointerDown={(e) => onAnnotationHandlePointerDown?.(e, line.id, 'start')}
                />
                <CanvasHandle
                  x={line.x2}
                  y={line.y2}
                  scale={scale}
                  type="square"
                  colorHex={0x3b82f6}
                  cursor="crosshair"
                  onPointerDown={(e) => onAnnotationHandlePointerDown?.(e, line.id, 'end')}
                />
                <CanvasHandle
                  x={midX}
                  y={midY}
                  scale={scale}
                  type="circle"
                  colorHex={0x3b82f6}
                  cursor="move"
                  onPointerDown={(e) => onAnnotationHandlePointerDown?.(e, line.id, 'midpoint')}
                />
              </>
            )}
            {showAnnotationLabels && line.labelVisible && line.name && (
              <pixiText
                text={line.name}
                x={midX + 6 / safeScale}
                y={midY + 6 / safeScale}
                style={labelStyle}
                scale={{ x: 1 / safeScale, y: -1 / safeScale }}
              />
            )}
          </pixiContainer>
        );
      }

      case 'rect': {
        const rect = obj as RectAnnotation;
        const halfW = rect.width / 2;
        const halfH = rect.height / 2;
        const handleOffset = halfW + 18 / safeScale;
        const corners = [
          { name: 'nw', x: -halfW, y: -halfH },
          { name: 'ne', x: halfW, y: -halfH },
          { name: 'se', x: halfW, y: halfH },
          { name: 'sw', x: -halfW, y: halfH },
        ];

        return (
          <pixiContainer key={rect.id}>
            {/* Rotated Graphics and Handles */}
            <pixiContainer x={rect.cx} y={rect.cy} rotation={rect.angle || 0}>
              <pixiGraphics
                eventMode={isInteractive ? 'dynamic' : 'none'}
                cursor={cursor}
                onPointerDown={(e: FederatedPointerEvent) => onAnnotationPointerDown?.(e, rect.id)}
                draw={(g) => {
                  g.clear();
                  // Selection outer ring
                  if (isSelected) {
                    g.strokeStyle = { width: 1.5 / safeScale, color: 0x60a5fa, alpha: 0.8 };
                    g.rect(-halfW - 3 / safeScale, -halfH - 3 / safeScale, rect.width + 6 / safeScale, rect.height + 6 / safeScale);
                    g.stroke();
                  }

                  // Fill in chosen color
                  g.fillStyle = { color: baseColorHex, alpha: 0.15 };
                  g.rect(-halfW, -halfH, rect.width, rect.height);
                  g.fill();

                  // Stroke in chosen color
                  g.strokeStyle = { width: strokeWidth, color: baseColorHex, alpha: 1.0 };
                  g.rect(-halfW, -halfH, rect.width, rect.height);
                  g.stroke();
                }}
              />
              {isSelected && (
                <>
                  {corners.map((c) => (
                    <CanvasHandle
                      key={c.name}
                      x={c.x}
                      y={c.y}
                      scale={scale}
                      type="square"
                      colorHex={0x3b82f6}
                      cursor="pointer"
                      onPointerDown={(e) => onAnnotationHandlePointerDown?.(e, rect.id, `corner_${c.name}`)}
                    />
                  ))}
                  <CanvasHandle
                    x={handleOffset}
                    y={0}
                    scale={scale}
                    type="circle"
                    colorHex={0x3b82f6}
                    cursor="grab"
                    onPointerDown={(e) => onAnnotationHandlePointerDown?.(e, rect.id, 'rotate')}
                  />
                  <CanvasHandle
                    x={0}
                    y={0}
                    scale={scale}
                    type="circle"
                    colorHex={0x3b82f6}
                    cursor="move"
                    onPointerDown={(e) => onAnnotationHandlePointerDown?.(e, rect.id, 'center')}
                  />
                </>
              )}
            </pixiContainer>

            {/* Unrotated Label */}
            {showAnnotationLabels && rect.labelVisible && rect.name && (
              <pixiText
                text={rect.name}
                x={rect.cx - halfW + 4 / safeScale}
                y={rect.cy + halfH + 6 / safeScale}
                style={labelStyle}
                scale={{ x: 1 / safeScale, y: -1 / safeScale }}
              />
            )}
          </pixiContainer>
        );
      }

      case 'circle': {
        const circle = obj as CircleAnnotation;
        const radHandles = [
          { name: 'e', x: circle.radius, y: 0 },
          { name: 'w', x: -circle.radius, y: 0 },
          { name: 'n', x: 0, y: circle.radius },
          { name: 's', x: 0, y: -circle.radius },
        ];

        return (
          <pixiContainer key={circle.id} x={circle.cx} y={circle.cy}>
            <pixiGraphics
              eventMode={isInteractive ? 'dynamic' : 'none'}
              cursor={cursor}
              onPointerDown={(e: FederatedPointerEvent) => onAnnotationPointerDown?.(e, circle.id)}
              draw={(g) => {
                g.clear();
                // Selection outer ring
                if (isSelected) {
                  g.strokeStyle = { width: 1.5 / safeScale, color: 0x60a5fa, alpha: 0.8 };
                  g.circle(0, 0, circle.radius + 3 / safeScale);
                  g.stroke();
                }

                // Fill in chosen color
                g.fillStyle = { color: baseColorHex, alpha: 0.15 };
                g.circle(0, 0, circle.radius);
                g.fill();

                // Stroke in chosen color
                g.strokeStyle = { width: strokeWidth, color: baseColorHex, alpha: 1.0 };
                g.circle(0, 0, circle.radius);
                g.stroke();
              }}
            />
            {isSelected && (
              <>
                {radHandles.map((rh) => (
                  <CanvasHandle
                    key={rh.name}
                    x={rh.x}
                    y={rh.y}
                    scale={scale}
                    type="circle"
                    colorHex={0x3b82f6}
                    cursor="ew-resize"
                    onPointerDown={(e) => onAnnotationHandlePointerDown?.(e, circle.id, `radius_${rh.name}`)}
                  />
                ))}
                <CanvasHandle
                  x={0}
                  y={0}
                  scale={scale}
                  type="circle"
                  colorHex={0x3b82f6}
                  cursor="move"
                  onPointerDown={(e) => onAnnotationHandlePointerDown?.(e, circle.id, 'center')}
                />
              </>
            )}
            {showAnnotationLabels && circle.labelVisible && circle.name && (
              <pixiText
                text={circle.name}
                x={-circle.radius + 4 / safeScale}
                y={circle.radius + 6 / safeScale}
                style={labelStyle}
                scale={{ x: 1 / safeScale, y: -1 / safeScale }}
              />
            )}
          </pixiContainer>
        );
      }

      default:
        return null;
    }
  };

  if (!showAnnotations) {
    return null;
  }

  return (
    <pixiContainer label="annotation-layer">
      {annotationOrder.map((id) => {
        const obj = annotationObjects[id];
        if (!obj) return null;
        return renderSingleAnnotation(obj, false);
      })}

      {previewObject && renderSingleAnnotation(previewObject, true)}
    </pixiContainer>
  );
}
