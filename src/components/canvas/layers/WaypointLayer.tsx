import { useMemo } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { TextStyle, FederatedPointerEvent } from 'pixi.js';
import { computeLabelOffsets, LabelCandidate } from '../../../utils/labelLayout';
import { getNodesAfterInsertionTarget } from '../../../utils/treeUtils';
import { CANVAS_ACCENT_COLOR, CANVAS_ACCENT_HOVER_COLOR } from '../canvasConstants';

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
  const insertionTarget = useAppStore(state => state.insertionTarget);
  const selectedNodeIds = useAppStore(state => state.selectedNodeIds);
  const activeTool = useAppStore(state => state.activeTool);
  const plugins = useAppStore(state => state.plugins);
  const activePluginId = useAppStore(state => state.activePluginId);
  const pluginInteractionData = useAppStore(state => state.pluginInteractionData);
  const visibleAttributes = useAppStore(state => state.visibleAttributes);
  const optionsSchema = useAppStore(state => state.optionsSchema);
  const indexStartIndex = useAppStore(state => state.indexStartIndex);
  const showProperties = useAppStore(state => state.showProperties);

  const afterNodeIds = useMemo(() => {
    return getNodesAfterInsertionTarget(rootNodeIds, nodes, insertionTarget);
  }, [rootNodeIds, nodes, insertionTarget]);

  const renderableNodes: { node: typeof nodes[string]; parentIsGenerator: boolean; globalIndex: number }[] = [];
  let globalIdx = 0;

  function traverse(id: string, isUnderGenerator: boolean) {
    const node = nodes[id];
    if (!node) return;
    const isGen = isUnderGenerator || node.type === 'generator';
    if (node.children_ids && node.children_ids.length > 0) {
      node.children_ids.forEach(cid => traverse(cid, isGen));
    } else if (node.type === 'manual' && node.transform) {
      renderableNodes.push({ node, parentIsGenerator: isGen, globalIndex: globalIdx++ });
    }
  }

  rootNodeIds.forEach(id => traverse(id, false));

  // 選択状態・座標・属性ラベル行など、描画とラベル重なり判定の両方で使う値をまとめて1回だけ計算する
  const items = renderableNodes.map(({ node, parentIsGenerator, globalIndex }) => {
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

    const lines: string[] = [];
    if (showProperties && visibleAttributes.length > 0) {
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
    }

    const isAfter = afterNodeIds.has(node.id);
    return { node, parentIsGenerator, isSelected, isReferenced, isAfter, transform, yaw, px, py, lines };
  });

  const labelCandidates: LabelCandidate[] = items
    .filter(item => item.lines.length > 0)
    .map(item => ({ id: item.node.id, worldX: item.px, worldY: item.py, lines: item.lines }));
  const labelLayoutMap = computeLabelOffsets(labelCandidates, scale, textStyle);

  return (
    <>
      {items.map(({ node, parentIsGenerator, isSelected, isReferenced, isAfter, yaw, px, py, lines }) => {
        const safeScale = Math.max(scale, 0.001);

        const isLocked = lockedWaypointId === node.id;
        const normalColor = isLocked
          ? 0x10b981
          : isReferenced
          ? 0xfacc15
          : isAfter
          ? 0x94a3b8
          : parentIsGenerator
          ? 0x22c55e
          : 0xffa500;
        const selectedColor = CANVAS_ACCENT_COLOR;
        const normalFill = isLocked
          ? 0x34d399
          : isReferenced
          ? 0xfef08a
          : isAfter
          ? 0xcbd5e1
          : parentIsGenerator
          ? 0x4ade80
          : 0xffd700;
        const selectedFill = CANVAS_ACCENT_HOVER_COLOR;

        const labelLayout = labelLayoutMap.get(node.id);
        const labelOffsetX = labelLayout ? labelLayout.x : 15 / safeScale;
        const labelOffsetY = labelLayout ? labelLayout.y : -15 / safeScale;
        const labelWidth = labelLayout?.width ?? 0;
        const labelHeight = labelLayout?.height ?? 0;

        return (
          <pixiContainer
            key={node.id}
            x={px}
            y={py}
            rotation={yaw}
            alpha={isAfter ? 0.35 : 1.0}
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

                  g.strokeStyle = { width: 1.5 / safeScale, color: CANVAS_ACCENT_COLOR };
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

            {lines.length > 0 && (
              <pixiContainer rotation={-yaw} scale={{ x: 1 / safeScale, y: -1 / safeScale }} x={labelOffsetX} y={labelOffsetY}>
                <pixiGraphics
                  eventMode="dynamic"
                  cursor={activeTool === 'select' ? 'pointer' : 'default'}
                  onPointerDown={(e: FederatedPointerEvent) => onNodePointerDown(e, node.id)}
                  draw={(g) => {
                    g.clear();
                    if (isSelected) {
                      g.fillStyle = { color: selectedFill, alpha: 0.25 };
                      g.strokeStyle = { width: 1.5, color: selectedColor };
                    } else {
                      g.fillStyle = { color: 0xffffff, alpha: 0.001 };
                    }
                    g.rect(0, -labelHeight, labelWidth, labelHeight);
                    g.fill();
                    if (isSelected) {
                      g.stroke();
                    }
                  }}
                />
                <pixiText text={lines.join('\n')} style={textStyle} anchor={{ x: 0, y: 1 }} />
              </pixiContainer>
            )}
          </pixiContainer>
        );
      })}
    </>
  );
}
