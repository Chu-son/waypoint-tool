import { useAppStore } from '../../../stores/appStore';
import { TextStyle, FederatedPointerEvent } from 'pixi.js';

interface WaypointLayerProps {
  scale: number;
  textStyle: TextStyle;
  lockedWaypointId: string | null;
  onNodePointerDown: (e: FederatedPointerEvent, nodeId: string) => void;
  onNodeHandlePointerDown: (e: FederatedPointerEvent, nodeId: string) => void;
}

export function WaypointLayer({ scale, textStyle, lockedWaypointId, onNodePointerDown, onNodeHandlePointerDown }: WaypointLayerProps) {
  const rootNodeIds = useAppStore(state => state.rootNodeIds);
  const nodes = useAppStore(state => state.nodes);
  const selectedNodeIds = useAppStore(state => state.selectedNodeIds);
  const activeTool = useAppStore(state => state.activeTool);
  const plugins = useAppStore(state => state.plugins);
  const activePluginId = useAppStore(state => state.activePluginId);
  const pluginInteractionData = useAppStore(state => state.pluginInteractionData);
  const visibleAttributes = useAppStore(state => state.visibleAttributes);
  const optionsSchema = useAppStore(state => state.optionsSchema);
  const indexStartIndex = useAppStore(state => state.indexStartIndex);
  const showProperties = useAppStore(state => state.showProperties);

  const renderableNodes: { node: typeof nodes[string]; parentIsGenerator: boolean; globalIndex: number }[] = [];
  let globalIdx = 0;
  rootNodeIds.forEach(id => {
    const node = nodes[id];
    if (!node) return;
    if (node.type === 'manual' && node.transform) {
      renderableNodes.push({ node, parentIsGenerator: false, globalIndex: globalIdx++ });
    } else if (node.type === 'generator' && node.children_ids) {
      node.children_ids.forEach(childId => {
        const child = nodes[childId];
        if (child && child.transform) {
          renderableNodes.push({ node: child, parentIsGenerator: true, globalIndex: globalIdx++ });
        }
      });
    }
  });

  return (
    <>
      {renderableNodes.map(({ node, parentIsGenerator, globalIndex }) => {
        const isSelected = selectedNodeIds.includes(node.id);
        
        let isReferenced = false;
        const rootIdx = rootNodeIds.indexOf(node.id);
        if (rootIdx !== -1) {
          const activePlugin = activePluginId ? plugins[activePluginId] : null;
          const waypointInputKeys = activePlugin?.manifest?.inputs
            ?.filter(inp => inp.type === 'waypoint')
            ?.map(inp => inp.name || inp.id) || [];
          
          isReferenced = waypointInputKeys.some(key => pluginInteractionData[key] === rootIdx);
        }

        const transform = node.transform!;
        const qx = transform.qx ?? 0;
        const qy = transform.qy ?? 0;
        const qz = transform.qz ?? 0;
        const qw = transform.qw ?? 1;
        let yaw = Math.atan2(2.0 * (qw * qz + qx * qy), 1.0 - 2.0 * (qy * qy + qz * qz));
        if (!isFinite(yaw)) yaw = 0;
        const px = isFinite(transform.x) ? transform.x : 0;
        const py = isFinite(transform.y) ? transform.y : 0;
        const safeScale = Math.max(scale, 0.001);

        const isLocked = lockedWaypointId === node.id;
        const normalColor = isLocked ? 0x10b981 : (isReferenced ? 0xfacc15 : (parentIsGenerator ? 0x22c55e : 0xffa500));
        const selectedColor = 0x3b82f6;
        const normalFill = isLocked ? 0x34d399 : (isReferenced ? 0xfef08a : (parentIsGenerator ? 0x4ade80 : 0xffd700));
        const selectedFill = 0x60a5fa;

        return (
          <pixiContainer
            key={node.id}
            x={px}
            y={py}
            rotation={yaw}
          >
            <pixiGraphics
              eventMode="dynamic"
              cursor={activeTool === 'select' ? 'pointer' : 'default'}
              onPointerDown={(e: FederatedPointerEvent) => onNodePointerDown(e, node.id)}
              draw={(g) => {
                g.clear();
                g.strokeStyle = { width: 2 / safeScale, color: isSelected ? selectedColor : normalColor };
                g.fillStyle = { color: isSelected ? selectedFill : normalFill, alpha: 0.8 };
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

            {isSelected && activeTool === 'select' && (
              <pixiGraphics
                x={25 / safeScale}
                y={0}
                eventMode="dynamic"
                cursor="grab"
                onPointerDown={(e: FederatedPointerEvent) => onNodeHandlePointerDown(e, node.id)}
                draw={(g) => {
                  g.clear();
                  g.fillStyle = { color: 0xffffff, alpha: 0.001 };
                  g.circle(0, 0, 15 / safeScale);
                  g.fill();

                  g.strokeStyle = { width: 1.5 / safeScale, color: 0x3b82f6 };
                  g.fillStyle = { color: 0xffffff, alpha: 0.9 };
                  g.circle(0, 0, 4 / safeScale);
                  g.fill();
                  g.stroke();
                  
                  g.moveTo(-15 / safeScale, 0);
                  g.lineTo(-4 / safeScale, 0);
                  g.stroke();
                }}
              />
            )}

            {showProperties && visibleAttributes.length > 0 && (
              <pixiContainer rotation={-yaw} scale={{ x: 1 / safeScale, y: -1 / safeScale }} x={15 / safeScale} y={-15 / safeScale}>
                {(() => {
                  const lines: string[] = [];
                  if (visibleAttributes.includes('index')) {
                    lines.push(`Index: [${globalIndex + indexStartIndex}]`);
                  }
                  if (visibleAttributes.includes('transform')) {
                    lines.push(`Transform:\n  x: ${transform.x.toFixed(3)}, y: ${transform.y.toFixed(3)}, z: ${(transform.z ?? 0).toFixed(3)}\n  yaw: ${yaw.toFixed(3)}\n  qx: ${qx.toFixed(3)}, qy: ${qy.toFixed(3)}, qz: ${qz.toFixed(3)}, qw: ${qw.toFixed(3)}`);
                  }
                  const optionKeys = visibleAttributes.filter(attr => attr.startsWith('options.'));
                  optionKeys.forEach(attr => {
                    const key = attr.split('.')[1];
                    const optDef = optionsSchema?.options?.find(o => o.name === key);
                    let val = node.options?.[key];
                    if (val === undefined && optDef && optDef.default !== undefined) {
                      val = optDef.default;
                    }
                    if (val !== undefined && val !== '') {
                      const displayLabel = optDef?.label || key;
                      lines.push(`${displayLabel}: ${Array.isArray(val) ? `[${val.join(', ')}]` : val}`);
                    }
                  });
                  if (lines.length === 0) return null;
                  return <pixiText text={lines.join('\n')} style={textStyle} anchor={{ x: 0, y: 1 }} />;
                })()}
              </pixiContainer>
            )}
          </pixiContainer>
        );
      })}
    </>
  );
}
