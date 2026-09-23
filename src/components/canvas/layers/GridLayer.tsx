import { useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { CANVAS_AXIS_X_COLOR, CANVAS_AXIS_Y_COLOR } from '../canvasConstants';

export function GridLayer({ scale }: { scale: number }) {
  const drawAxes = useCallback(
    (g: PIXI.Graphics) => {
      g.clear();
      const axisLength = 50 / scale; // Keep length consistent on screen
      const lineWidth = 2 / scale; // Keep line width consistent on screen

      // X axis (Red)
      g.strokeStyle = { width: lineWidth, color: CANVAS_AXIS_X_COLOR };
      g.moveTo(0, 0);
      g.lineTo(axisLength, 0);
      g.stroke();

      // Y axis (Green)
      g.strokeStyle = { width: lineWidth, color: CANVAS_AXIS_Y_COLOR };
      g.moveTo(0, 0);
      g.lineTo(0, axisLength);
      g.stroke();
    },
    [scale],
  );

  return <pixiGraphics draw={drawAxes} />;
}
