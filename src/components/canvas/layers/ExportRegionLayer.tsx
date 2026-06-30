import { useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { useAppStore } from '../../../stores/appStore';
import { FederatedPointerEvent, TextStyle } from 'pixi.js';

interface ExportRegionLayerProps {
  scale: number;
  textStyle: TextStyle;
  onRegionDragDown: (e: FederatedPointerEvent, regionId: string) => void;
  onRegionResizeDown: (e: FederatedPointerEvent, regionId: string, handle: 'nw'|'ne'|'sw'|'se'|'n'|'s'|'e'|'w') => void;
}

export function ExportRegionLayer({ scale, textStyle, onRegionDragDown, onRegionResizeDown }: ExportRegionLayerProps) {
  const exportRegions = useAppStore(state => state.exportRegions);
  const activeTool = useAppStore(state => state.activeTool);

  const drawRegions = useCallback((g: PIXI.Graphics) => {
    g.clear();
    const lineWidth = 2 / scale;

    exportRegions.forEach(region => {
      if (!region.visible) return;
      
      g.fillStyle = { color: 0x10b981, alpha: 0.1 };
      g.strokeStyle = { width: lineWidth, color: 0x10b981, alpha: 0.8 };
      g.rect(region.rect.x, region.rect.y, region.rect.width, region.rect.height);
      g.fill();
      g.stroke();
    });
  }, [exportRegions, scale]);

  return (
    <>
      <pixiGraphics draw={drawRegions} zIndex={1000} />
      
      {activeTool === 'add_export_region' && exportRegions.map(region => {
        if (!region.visible) return null;
        
        const { x, y, width: w, height: h } = region.rect;
        const handleSize = 8 / scale;
        const halfSize = handleSize / 2;

        const handles = [
          { type: 'nw' as const, cx: x, cy: y, cursor: 'nwse-resize' },
          { type: 'ne' as const, cx: x + w, cy: y, cursor: 'nesw-resize' },
          { type: 'sw' as const, cx: x, cy: y + h, cursor: 'nesw-resize' },
          { type: 'se' as const, cx: x + w, cy: y + h, cursor: 'nwse-resize' },
          { type: 'n' as const, cx: x + w / 2, cy: y, cursor: 'ns-resize' },
          { type: 's' as const, cx: x + w / 2, cy: y + h, cursor: 'ns-resize' },
          { type: 'e' as const, cx: x + w, cy: y + h / 2, cursor: 'ew-resize' },
          { type: 'w' as const, cx: x, cy: y + h / 2, cursor: 'ew-resize' },
        ];

        return (
          <pixiContainer key={`interaction-${region.id}`} zIndex={1001}>
            {/* Draggable body */}
            <pixiGraphics
              eventMode="dynamic"
              cursor="move"
              onPointerDown={(e: FederatedPointerEvent) => onRegionDragDown(e, region.id)}
              draw={(g) => {
                g.clear();
                g.fillStyle = { color: 0xffffff, alpha: 0.001 };
                g.rect(x, y, w, h);
                g.fill();
              }}
            />
            {/* Resize handles */}
            {handles.map(handle => (
              <pixiGraphics
                key={handle.type}
                eventMode="dynamic"
                cursor={handle.cursor}
                onPointerDown={(e: FederatedPointerEvent) => onRegionResizeDown(e, region.id, handle.type)}
                draw={(g) => {
                  g.clear();
                  // Hit area
                  g.fillStyle = { color: 0xffffff, alpha: 0.001 };
                  g.rect(handle.cx - halfSize * 2, handle.cy - halfSize * 2, handleSize * 2, handleSize * 2);
                  g.fill();
                  
                  // Visible handle
                  g.fillStyle = { color: 0xffffff, alpha: 1 };
                  g.strokeStyle = { width: 1.5 / scale, color: 0x10b981 };
                  g.rect(handle.cx - halfSize, handle.cy - halfSize, handleSize, handleSize);
                  g.fill();
                  g.stroke();
                }}
              />
            ))}
            {/* Region Name Text */}
            <pixiContainer
               x={x}
               y={y + h}
               scale={{ x: 1 / scale, y: -1 / scale }}
            >
               <pixiText
                 text={region.name}
                 style={textStyle}
                 anchor={{ x: 0, y: 0 }}
                 x={4}
                 y={4}
               />
            </pixiContainer>
          </pixiContainer>
        );
      })}
    </>
  );
}
