
import { useCallback } from 'react';
import * as PIXI from 'pixi.js';

export function GridLayer({ scale }: { scale: number }) {
  const drawAxes = useCallback((g: PIXI.Graphics) => {
    g.clear();
    const axisLength = 50 / scale; // Keep length consistent on screen
    const lineWidth = 2 / scale; // Keep line width consistent on screen

    // X axis (Red)
    g.strokeStyle = { width: lineWidth, color: 0xef4444 };
    g.moveTo(0, 0);
    g.lineTo(axisLength, 0);
    g.stroke();
    
    // Y axis (Green)
    g.strokeStyle = { width: lineWidth, color: 0x22c55e };
    g.moveTo(0, 0);
    g.lineTo(0, axisLength);
    g.stroke();
  }, [scale]);

  return <pixiGraphics draw={drawAxes} />;
}
