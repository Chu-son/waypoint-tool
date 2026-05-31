import { useAppStore } from '../../../stores/appStore';
import { FederatedPointerEvent } from 'pixi.js';


interface PluginLayerProps {
  scale: number;
  onRectDragCornerDown: (e: FederatedPointerEvent, key: string, corner: 'min'|'max'|'topRight'|'bottomLeft') => void;
  onRectRotationDown: (e: FederatedPointerEvent, key: string) => void;
}

export function PluginLayer({ scale, onRectDragCornerDown, onRectRotationDown }: PluginLayerProps) {
  const activeTool = useAppStore(state => state.activeTool);
  const selectedNodeIds = useAppStore(state => state.selectedNodeIds);
  const nodes = useAppStore(state => state.nodes);
  const pluginInteractionData = useAppStore(state => state.pluginInteractionData);
  const plugins = useAppStore(state => state.plugins);
  const activePluginId = useAppStore(state => state.activePluginId);
  const pluginActiveProperties = useAppStore(state => state.pluginActiveProperties);

  const shouldRender = activeTool === 'add_generator' || (selectedNodeIds.length === 1 && nodes[selectedNodeIds[0]]?.type === 'generator');
  if (!shouldRender) return null;

  return (
    <>
      {Object.entries(pluginInteractionData).map(([key, data]) => {
        if (!data) return null;
        const safeScale = Math.max(scale, 0.001);

        // Rectangle data
        if (data.center && typeof data.width === 'number') {
          const { center, width, height, yaw = 0 } = data;
          if (!isFinite(center.x) || !isFinite(center.y) || !isFinite(width) || !isFinite(height)) return null;
          
          const halfW = width / 2;
          const halfH = height / 2;
          const cornerSize = 6 / safeScale;
          
          const corners = [
            { cx: -halfW, cy: halfH, corner: 'min' as const },
            { cx: halfW, cy: -halfH, corner: 'max' as const },
            { cx: halfW, cy: halfH, corner: 'topRight' as const },
            { cx: -halfW, cy: -halfH, corner: 'bottomLeft' as const },
          ];
          
          return (
            <pixiContainer key={`rect-${key}`} x={center.x} y={center.y} rotation={yaw}>
              <pixiGraphics
                draw={(g) => {
                  g.clear();
                  g.fillStyle = { color: 0xec4899, alpha: 0.1 };
                  g.rect(-halfW, -halfH, width, height);
                  g.fill();
                  g.strokeStyle = { width: 2 / safeScale, color: 0xec4899 };
                  const dashLen = 8 / safeScale;
                  const sides = [
                    [-halfW, -halfH, halfW, -halfH], [halfW, -halfH, halfW, halfH],
                    [halfW, halfH, -halfW, halfH], [-halfW, halfH, -halfW, -halfH],
                  ];
                  sides.forEach(([sx, sy, ex, ey]) => {
                    const dx = ex - sx, dy = ey - sy;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const nx = dx / len, ny = dy / len;
                    let d = 0;
                    let draw = true;
                    while (d < len) {
                      const segEnd = Math.min(d + dashLen, len);
                      if (draw) {
                        g.moveTo(sx + nx * d, sy + ny * d);
                        g.lineTo(sx + nx * segEnd, sy + ny * segEnd);
                      }
                      d = segEnd;
                      draw = !draw;
                    }
                  });
                  g.stroke();
                }}
              />
              {corners.map(({ cx, cy, corner }) => (
                <pixiGraphics
                  key={`corner-${corner}`}
                  x={cx}
                  y={cy}
                  eventMode="dynamic"
                  cursor="grab"
                  onPointerDown={(e: FederatedPointerEvent) => onRectDragCornerDown(e, key, corner)}
                  draw={(g) => {
                    g.clear();
                    g.fillStyle = { color: 0xffffff, alpha: 0.001 };
                    g.circle(0, 0, 15 / safeScale);
                    g.fill();

                    g.fillStyle = { color: 0xffffff, alpha: 0.9 };
                    g.strokeStyle = { width: 1.5 / safeScale, color: 0xec4899 };
                    g.rect(-cornerSize / 2, -cornerSize / 2, cornerSize, cornerSize);
                    g.fill();
                    g.stroke();
                  }}
                />
              ))}
              {(() => {
                const stemLen = 20 / safeScale;
                const rotHandleY = halfH + stemLen;
                const handleR = 5 / safeScale;
                return (
                  <pixiGraphics
                    x={0}
                    y={rotHandleY}
                    eventMode="dynamic"
                    cursor="grab"
                    onPointerDown={(e: FederatedPointerEvent) => onRectRotationDown(e, key)}
                    draw={(g) => {
                      g.clear();
                      g.strokeStyle = { width: 1.5 / safeScale, color: 0xec4899 };
                      g.moveTo(0, stemLen);
                      g.lineTo(0, 0);
                      g.stroke();
                      
                      g.fillStyle = { color: 0xffffff, alpha: 0.001 };
                      g.circle(0, 0, 15 / safeScale);
                      g.fill();
                      
                      g.fillStyle = { color: 0xffffff, alpha: 0.9 };
                      g.strokeStyle = { width: 1.5 / safeScale, color: 0xec4899 };
                      g.circle(0, 0, handleR);
                      g.fill();
                      g.stroke();
                      
                      g.strokeStyle = { width: 1.2 / safeScale, color: 0xec4899 };
                      const arcR = handleR * 0.55;
                      const arcSteps = 10;
                      for (let i = 0; i < arcSteps; i++) {
                        const a1 = -0.3 + (i / arcSteps) * 4.8;
                        const a2 = -0.3 + ((i + 1) / arcSteps) * 4.8;
                        if (i === 0) g.moveTo(Math.cos(a1) * arcR, Math.sin(a1) * arcR);
                        g.lineTo(Math.cos(a2) * arcR, Math.sin(a2) * arcR);
                      }
                      g.stroke();
                      
                      const lastAngle = -0.3 + 4.8;
                      const tipX = Math.cos(lastAngle) * arcR;
                      const tipY = Math.sin(lastAngle) * arcR;
                      const aSize = 2 / safeScale;
                      g.fillStyle = { color: 0xec4899, alpha: 1 };
                      g.moveTo(tipX, tipY);
                      g.lineTo(tipX + aSize, tipY - aSize * 0.5);
                      g.lineTo(tipX - aSize * 0.3, tipY - aSize);
                      g.lineTo(tipX, tipY);
                      g.fill();
                    }}
                  />
                );
              })()}
              {(() => {
                const selectedNode = selectedNodeIds.length === 1 ? nodes[selectedNodeIds[0]] : null;
                const selectedPluginId = selectedNode?.type === 'generator' ? selectedNode.plugin_id : activePluginId;
                const activePlugin = selectedPluginId ? plugins[selectedPluginId] : null;

                let startCorner = '';
                let sweepDir = '';

                activePlugin?.manifest?.properties?.forEach(prop => {
                  if (prop.interaction_hint?.target_input === key) {
                    const val = pluginActiveProperties[prop.name] ?? prop.default;
                    if (prop.interaction_hint.type === 'start_corner') startCorner = String(val || '');
                    if (prop.interaction_hint.type === 'sweep_direction') sweepDir = String(val || '');
                  }
                });

                if (!startCorner && !sweepDir) return null;

                if (!startCorner) startCorner = 'Bottom-Left';
                if (!sweepDir) sweepDir = 'Horizontal';
                
                let cx = 0, cy = 0;
                if (startCorner === 'Bottom-Left') { cx = -halfW; cy = -halfH; }
                else if (startCorner === 'Bottom-Right') { cx = halfW; cy = -halfH; }
                else if (startCorner === 'Top-Left') { cx = -halfW; cy = halfH; }
                else if (startCorner === 'Top-Right') { cx = halfW; cy = halfH; }
                
                let dirX = 0, dirY = 0;
                const arrowLen = 12 / safeScale;
                if (sweepDir === 'Horizontal') {
                  dirX = cx < 0 ? arrowLen : -arrowLen;
                } else {
                  dirY = cy < 0 ? arrowLen : -arrowLen;
                }
                
                const triSize = 5 / safeScale;
                const angle = Math.atan2(dirY, dirX);
                
                return (
                  <pixiGraphics
                    x={cx}
                    y={cy}
                    draw={(g) => {
                      g.clear();
                      g.fillStyle = { color: 0xf97316, alpha: 0.9 };
                      g.strokeStyle = { width: 1 / safeScale, color: 0xf97316 };
                      const tipX = dirX;
                      const tipY = dirY;
                      const perpX = -Math.sin(angle) * triSize;
                      const perpY = Math.cos(angle) * triSize;
                      g.moveTo(tipX, tipY);
                      g.lineTo(tipX - Math.cos(angle) * triSize * 2 + perpX, tipY - Math.sin(angle) * triSize * 2 + perpY);
                      g.lineTo(tipX - Math.cos(angle) * triSize * 2 - perpX, tipY - Math.sin(angle) * triSize * 2 - perpY);
                      g.lineTo(tipX, tipY);
                      g.fill();
                      g.stroke();
                    }}
                  />
                );
              })()}
            </pixiContainer>
          );
        }

        // Point data
        if (typeof data.x !== 'number' || !isFinite(data.x) || !isFinite(data.y)) return null;
        const pqw = data.qw ?? 1, pqz = data.qz ?? 0, pqx = data.qx ?? 0, pqy = data.qy ?? 0;
        let yaw = Math.atan2(2.0 * (pqw * pqz + pqx * pqy), 1.0 - 2.0 * (pqy * pqy + pqz * pqz));
        if (!isFinite(yaw)) yaw = 0;
        
        return (
          <pixiGraphics 
            key={key}
            x={data.x}
            y={data.y}
            rotation={yaw}
            draw={(g) => {
              g.clear();
              // simplified point drawing - it doesn't know if it's locked here, we assume it's just a plugin point preview
              g.strokeStyle = { width: 2 / safeScale, color: 0xec4899 };
              g.fillStyle = { color: 0xf472b6, alpha: 0.8 };
              g.moveTo(10 / safeScale, 0);
              g.lineTo(-5 / safeScale, 5 / safeScale);
              g.lineTo(-5 / safeScale, -5 / safeScale);
              g.lineTo(10 / safeScale, 0);
              g.fill();
              g.stroke();
              g.circle(0, 0, 3 / safeScale);
              g.fill();
            }}
          />
        );
      })}
    </>
  );
}
