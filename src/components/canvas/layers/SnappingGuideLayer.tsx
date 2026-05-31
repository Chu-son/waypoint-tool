import { TextStyle } from 'pixi.js';

interface SnappingGuideLayerProps {
  scale: number;
  snapState: any; // We'll refine this if we export types
  snapInput: string;
}

export function SnappingGuideLayer({ scale, snapState, snapInput }: SnappingGuideLayerProps) {
  if (!snapState.origin || (!snapState.isSnapped && !snapState.forcedAxis)) {
    return null;
  }

  let ex = snapState.snappedWorldPos?.x ?? snapState.origin.x;
  let ey = snapState.snappedWorldPos?.y ?? snapState.origin.y;
  const val = parseFloat(snapInput);
  const effectiveAxis = snapState.forcedAxis || snapState.axis;
  const effectiveSign = snapState.forcedSign || 1;
  
  if (snapInput !== '' && !isNaN(val)) {
    if (effectiveAxis === 'X') {
      ex = snapState.origin.x + val * effectiveSign * Math.cos(snapState.origin.yaw);
      ey = snapState.origin.y + val * effectiveSign * Math.sin(snapState.origin.yaw);
    } else if (effectiveAxis === 'Y') {
      ex = snapState.origin.x - val * effectiveSign * Math.sin(snapState.origin.yaw);
      ey = snapState.origin.y + val * effectiveSign * Math.cos(snapState.origin.yaw);
    }
  }

  return (
    <pixiContainer>
      <pixiGraphics
        draw={(g) => {
          g.clear();
          g.strokeStyle = { width: 1.5 / Math.max(scale, 0.001), color: 0x3b82f6, alpha: 0.8 };
          const { x: sx, y: sy } = snapState.origin!;
          
          const dx = ex - sx;
          const dy = ey - sy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const dashLen = 8 / Math.max(scale, 0.001);
            let drawn = 0;
            let isGap = false;
            
            g.moveTo(sx, sy);
            while (drawn < dist) {
              const step = Math.min(dashLen, dist - drawn);
              drawn += step;
              const curX = sx + (dx / dist) * drawn;
              const curY = sy + (dy / dist) * drawn;
              if (isGap) {
                g.moveTo(curX, curY);
              } else {
                g.lineTo(curX, curY);
              }
              isGap = !isGap;
            }
            g.stroke();
          }
        }}
      />
      
      {snapInput && (
        <pixiContainer 
          x={ex + 20 / Math.max(scale, 0.001)} 
          y={ey} 
          scale={{ x: 1 / Math.max(scale, 0.001), y: -1 / Math.max(scale, 0.001) }}
        >
          <pixiText 
            text={`Dist: ${snapInput}`} 
            style={
              new TextStyle({
                fill: '#3b82f6',
                fontSize: 16,
                fontFamily: 'Arial',
                fontWeight: 'bold',
                stroke: { color: '#000000', width: 3 },
              })
            } 
          />
        </pixiContainer>
      )}
    </pixiContainer>
  );
}
