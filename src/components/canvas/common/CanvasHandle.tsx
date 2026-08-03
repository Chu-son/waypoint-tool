import { FederatedPointerEvent } from 'pixi.js';

interface CanvasHandleProps {
  x: number;
  y: number;
  scale: number;
  type?: 'square' | 'circle';
  colorHex?: number;
  cursor?: string;
  onPointerDown?: (e: FederatedPointerEvent) => void;
}

export function CanvasHandle({
  x,
  y,
  scale,
  type = 'square',
  colorHex = 0x3b82f6,
  cursor = 'pointer',
  onPointerDown,
}: CanvasHandleProps) {
  const safeScale = Math.max(scale, 0.001);
  const hitRadius = 15 / safeScale;
  const shapeSize = 6 / safeScale;
  const strokeWidth = 1.5 / safeScale;

  return (
    <pixiGraphics
      x={x}
      y={y}
      eventMode="dynamic"
      cursor={cursor}
      onPointerDown={onPointerDown}
      draw={(g) => {
        g.clear();
        // Invisible hit target area for easy pointer capture
        g.fillStyle = { color: 0xffffff, alpha: 0.001 };
        g.circle(0, 0, hitRadius);
        g.fill();

        // Visible handle graphic
        g.strokeStyle = { width: strokeWidth, color: colorHex };
        g.fillStyle = { color: 0xffffff, alpha: 0.95 };
        if (type === 'square') {
          g.rect(-shapeSize / 2, -shapeSize / 2, shapeSize, shapeSize);
        } else {
          g.circle(0, 0, shapeSize / 2);
        }
        g.fill();
        g.stroke();
      }}
    />
  );
}
