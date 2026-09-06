import { useMemo } from 'react';
import { TextStyle } from 'pixi.js';
import { useAppStore } from '../../../stores/appStore';
import { computeDistance } from '../../../stores/slices/measureSlice';

interface MeasureLayerProps {
  scale: number;
  snappedTarget?: { x: number; y: number; objectName: string } | null;
  isAltPressed?: boolean;
}

export function MeasureLayer({ scale, snappedTarget, isAltPressed }: MeasureLayerProps) {
  const activeTool = useAppStore((state) => state.activeTool);
  const appMode = useAppStore((state) => state.appMode);
  const measureStartPoint = useAppStore((state) => state.measureStartPoint);
  const measureEndPoint = useAppStore((state) => state.measureEndPoint);
  const measureHoverPoint = useAppStore((state) => state.measureHoverPoint);

  const isMeasureMode = activeTool === 'measure' || appMode.mode === 'measure';

  const safeScale = Math.max(scale, 0.001);

  const labelStyle = useMemo(
    () =>
      new TextStyle({
        fill: '#ffffff',
        fontSize: 12,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        stroke: { color: '#000000', width: 2 },
      }),
    []
  );

  const snapLabelStyle = useMemo(
    () =>
      new TextStyle({
        fill: '#34d399',
        fontSize: 11,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        stroke: { color: '#0f172a', width: 3 },
      }),
    []
  );

  // メジャーモードでない場合は何も描画しない
  if (!isMeasureMode) return null;
  // 1点目もなく、スナップ対象もない場合は何も描画しない
  if (!measureStartPoint && !(isAltPressed && snappedTarget)) return null;

  const p1 = measureStartPoint;
  const p2 = p1 ? (measureEndPoint || measureHoverPoint) : null;
  const isCommitted = measureEndPoint !== null;

  const primaryColor = 0x10b981; // Emerald 500
  const secondaryColor = 0x34d399; // Emerald 400
  const markerRadius = 6 / safeScale;
  const reticleSize = 10 / safeScale;
  const strokeWidth = (isCommitted ? 2.5 : 2.0) / safeScale;

  let distance = 0;
  let midX = 0;
  let midY = 0;

  if (p1 && p2) {
    distance = computeDistance(p1, p2);
    midX = (p1.x + p2.x) / 2;
    midY = (p1.y + p2.y) / 2;
  }

  const distanceText = `${distance.toFixed(2)} m`;
  const badgeWidth = Math.max(64, distanceText.length * 8 + 16) / safeScale;
  const badgeHeight = 22 / safeScale;

  return (
    <pixiContainer zIndex={9000}>
      {/* Measure line and markers */}
      {p1 && (
        <pixiGraphics
          draw={(g) => {
            g.clear();

            // 1. Line between p1 and p2 (if p2 exists)
            if (p2) {
              if (isCommitted) {
                // Committed solid line with subtle glow
                g.strokeStyle = { width: strokeWidth + 4 / safeScale, color: primaryColor, alpha: 0.25 };
                g.moveTo(p1.x, p1.y);
                g.lineTo(p2.x, p2.y);
                g.stroke();

                g.strokeStyle = { width: strokeWidth, color: primaryColor, alpha: 0.95 };
                g.moveTo(p1.x, p1.y);
                g.lineTo(p2.x, p2.y);
                g.stroke();
              } else {
                // Interactive/measuring line (dashed style simulated with alpha)
                g.strokeStyle = { width: strokeWidth, color: secondaryColor, alpha: 0.8 };
                g.moveTo(p1.x, p1.y);
                g.lineTo(p2.x, p2.y);
                g.stroke();
              }
            }

            // 2. Point 1 Marker (Circle + Reticle)
            g.fillStyle = { color: 0x0f172a, alpha: 0.8 };
            g.strokeStyle = { width: 2 / safeScale, color: primaryColor, alpha: 1.0 };
            g.circle(p1.x, p1.y, markerRadius);
            g.fill();
            g.stroke();

            // Center dot
            g.fillStyle = { color: primaryColor, alpha: 1.0 };
            g.circle(p1.x, p1.y, 2 / safeScale);
            g.fill();

            // Reticle crosshair on p1
            g.strokeStyle = { width: 1.5 / safeScale, color: primaryColor, alpha: 0.9 };
            g.moveTo(p1.x - reticleSize, p1.y);
            g.lineTo(p1.x - markerRadius - 1 / safeScale, p1.y);
            g.moveTo(p1.x + markerRadius + 1 / safeScale, p1.y);
            g.lineTo(p1.x + reticleSize, p1.y);
            g.moveTo(p1.x, p1.y - reticleSize);
            g.lineTo(p1.x, p1.y - markerRadius - 1 / safeScale);
            g.moveTo(p1.x, p1.y + markerRadius + 1 / safeScale);
            g.lineTo(p1.x, p1.y + reticleSize);
            g.stroke();

            // 3. Point 2 Marker (if p2 exists)
            if (p2) {
              g.fillStyle = { color: 0x0f172a, alpha: 0.8 };
              g.strokeStyle = { width: 2 / safeScale, color: isCommitted ? primaryColor : secondaryColor, alpha: 1.0 };
              g.circle(p2.x, p2.y, markerRadius);
              g.fill();
              g.stroke();

              g.fillStyle = { color: isCommitted ? primaryColor : secondaryColor, alpha: 1.0 };
              g.circle(p2.x, p2.y, 2 / safeScale);
              g.fill();

              // Reticle crosshair on p2
              g.strokeStyle = { width: 1.5 / safeScale, color: isCommitted ? primaryColor : secondaryColor, alpha: 0.9 };
              g.moveTo(p2.x - reticleSize, p2.y);
              g.lineTo(p2.x - markerRadius - 1 / safeScale, p2.y);
              g.moveTo(p2.x + markerRadius + 1 / safeScale, p2.y);
              g.lineTo(p2.x + reticleSize, p2.y);
              g.moveTo(p2.x, p2.y - reticleSize);
              g.lineTo(p2.x, p2.y - markerRadius - 1 / safeScale);
              g.moveTo(p2.x, p2.y + markerRadius + 1 / safeScale);
              g.lineTo(p2.x, p2.y + reticleSize);
              g.stroke();
            }
          }}
        />
      )}

      {/* Distance Badge on Line Center */}
      {p1 && p2 && (
        <pixiContainer x={midX} y={midY}>
          <pixiGraphics
            draw={(g) => {
              g.clear();
              // Pill background
              g.fillStyle = { color: 0x0f172a, alpha: 0.9 };
              g.strokeStyle = { width: 1.5 / safeScale, color: primaryColor, alpha: 1.0 };
              g.roundRect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight, 6 / safeScale);
              g.fill();
              g.stroke();
            }}
          />
          <pixiText
            text={distanceText}
            anchor={{ x: 0.5, y: 0.5 }}
            style={labelStyle}
            scale={{ x: 1 / safeScale, y: -1 / safeScale }}
          />
        </pixiContainer>
      )}

      {/* Snapped Object Target Indicator (when Alt is pressed) */}
      {isAltPressed && snappedTarget && (
        <pixiContainer x={snappedTarget.x} y={snappedTarget.y}>
          {/* Target Reticle & Circle */}
          <pixiGraphics
            draw={(g) => {
              g.clear();
              const snapRadius = 14 / safeScale;
              const snapCross = 18 / safeScale;

              // Outer pulsing-like ring
              g.strokeStyle = { width: 2 / safeScale, color: 0x34d399, alpha: 0.85 };
              g.circle(0, 0, snapRadius);
              g.stroke();

              // Inner accent ring
              g.strokeStyle = { width: 1 / safeScale, color: 0xffffff, alpha: 0.7 };
              g.circle(0, 0, snapRadius * 0.65);
              g.stroke();

              // Crosshair
              g.strokeStyle = { width: 1.5 / safeScale, color: 0x34d399, alpha: 0.9 };
              g.moveTo(-snapCross, 0);
              g.lineTo(-snapRadius - 2 / safeScale, 0);
              g.moveTo(snapRadius + 2 / safeScale, 0);
              g.lineTo(snapCross, 0);
              g.moveTo(0, -snapCross);
              g.lineTo(0, -snapRadius - 2 / safeScale);
              g.moveTo(0, snapRadius + 2 / safeScale);
              g.lineTo(0, snapCross);
              g.stroke();
            }}
          />
          {/* Snap Object Name Tag */}
          <pixiContainer y={20 / safeScale}>
            <pixiGraphics
              draw={(g) => {
                g.clear();
                const textWidth = Math.max(48, snappedTarget.objectName.length * 7 + 14) / safeScale;
                const textHeight = 18 / safeScale;
                g.fillStyle = { color: 0x0f172a, alpha: 0.85 };
                g.strokeStyle = { width: 1 / safeScale, color: 0x34d399, alpha: 0.9 };
                g.roundRect(-textWidth / 2, -textHeight / 2, textWidth, textHeight, 4 / safeScale);
                g.fill();
                g.stroke();
              }}
            />
            <pixiText
              text={snappedTarget.objectName}
              anchor={{ x: 0.5, y: 0.5 }}
              style={snapLabelStyle}
              scale={{ x: 1 / safeScale, y: -1 / safeScale }}
            />
          </pixiContainer>
        </pixiContainer>
      )}
    </pixiContainer>
  );
}
