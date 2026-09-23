import { useMemo } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { TextStyle, FederatedPointerEvent } from 'pixi.js';
import { computeLabelOffsets, LabelCandidate } from '../utils/labelLayout';
import { getNodesAfterInsertionTarget } from '../../../utils/treeUtils';
import { quaternionToYaw } from '../../../utils/transformUtils';
import {
  CANVAS_ACCENT_COLOR,
  CANVAS_ACCENT_HOVER_COLOR,
  CANVAS_CONTRAST_COLOR,
  CANVAS_HIT_AREA_COLOR,
  WAYPOINT_COLORS,
} from '../canvasConstants';
import {
  parseColorSafe,
  resolveWaypointConditionalStyle,
  ResolvedWaypointStyle,
} from '../../../utils/conditionalStyles';
import { WaypointShape } from '../../../types/store';

function drawWaypointShape(g: any, shape: WaypointShape, s: number) {
  if (shape === 'circle') {
    g.circle(0, 0, 6 * s);
    g.fill();
    g.stroke();
    // +X 進行方向ノッチ
    g.moveTo(5 * s, -3 * s);
    g.lineTo(10 * s, 0);
    g.lineTo(5 * s, 3 * s);
    g.fill();
    g.stroke();
  } else if (shape === 'square') {
    g.rect(-5 * s, -5 * s, 10 * s, 10 * s);
    g.fill();
    g.stroke();
    // +X 進行方向ノッチ
    g.moveTo(5 * s, -3 * s);
    g.lineTo(10 * s, 0);
    g.lineTo(5 * s, 3 * s);
    g.fill();
    g.stroke();
  } else if (shape === 'diamond') {
    g.moveTo(8 * s, 0);
    g.lineTo(0, 6 * s);
    g.lineTo(-8 * s, 0);
    g.lineTo(0, -6 * s);
    g.closePath();
    g.fill();
    g.stroke();
    // +X 進行方向ポインター
    g.moveTo(8 * s, -2 * s);
    g.lineTo(12 * s, 0);
    g.lineTo(8 * s, 2 * s);
    g.fill();
    g.stroke();
  } else if (shape === 'star') {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 9 * s : 4 * s;
      const angle = (i * Math.PI) / 5;
      pts.push([r * Math.cos(angle), r * Math.sin(angle)]);
    }
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      g.lineTo(pts[i][0], pts[i][1]);
    }
    g.closePath();
    g.fill();
    g.stroke();
  } else {
    // Default Arrow
    g.moveTo(10 * s, 0);
    g.lineTo(-5 * s, 5 * s);
    g.lineTo(-5 * s, -5 * s);
    g.lineTo(10 * s, 0);
    g.fill();
    g.stroke();
    g.circle(0, 0, 3 * s);
    g.fill();
  }
}

interface WaypointLayerProps {
  scale: number;
  textStyle: TextStyle;
  lockedWaypointId: string | null;
  onNodePointerDown: (e: FederatedPointerEvent, nodeId: string) => void;
  onNodeHandlePointerDown: (e: FederatedPointerEvent, nodeId: string) => void;
  onNodeContextMenu?: (e: FederatedPointerEvent, nodeId: string) => void;
}

export function WaypointLayer({
  scale,
  textStyle,
  lockedWaypointId,
  onNodePointerDown,
  onNodeHandlePointerDown,
  onNodeContextMenu,
}: WaypointLayerProps) {
  const rootNodeIds = useAppStore((state) => state.rootNodeIds);
  const nodes = useAppStore((state) => state.nodes);
  const insertionTarget = useAppStore((state) => state.insertionTarget);
  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds);
  const activeTool = useAppStore((state) => state.activeTool);
  const plugins = useAppStore((state) => state.plugins);
  const activePluginId = useAppStore((state) => state.activePluginId);
  const pluginInteractionData = useAppStore((state) => state.pluginInteractionData);
  const visibleAttributes = useAppStore((state) => state.visibleAttributes);
  const optionsSchema = useAppStore((state) => state.optionsSchema);
  const indexStartIndex = useAppStore((state) => state.indexStartIndex);
  const showProperties = useAppStore((state) => state.showProperties);
  const conditionalStyles = useAppStore((state) => state.conditionalStyles);
  const conditionalStylesEnabled = useAppStore((state) => state.conditionalStylesEnabled);

  const afterNodeIds = useMemo(() => {
    return getNodesAfterInsertionTarget(rootNodeIds, nodes, insertionTarget);
  }, [rootNodeIds, nodes, insertionTarget]);

  const renderableNodes: { node: (typeof nodes)[string]; parentIsGenerator: boolean; globalIndex: number }[] = [];
  let globalIdx = 0;

  function traverse(id: string, isUnderGenerator: boolean) {
    const node = nodes[id];
    if (!node) return;
    const isGen = isUnderGenerator || node.type === 'generator';
    if (node.children_ids && node.children_ids.length > 0) {
      node.children_ids.forEach((cid) => traverse(cid, isGen));
    } else if (node.type === 'manual' && node.transform) {
      renderableNodes.push({ node, parentIsGenerator: isGen, globalIndex: globalIdx++ });
    }
  }

  rootNodeIds.forEach((id) => traverse(id, false));

  // 条件付き書式のメモ化キャッシュ（ノード・ルール・スキーマ変更時のみ再計算）
  const resolvedStyleMap = useMemo(() => {
    const map = new Map<string, ResolvedWaypointStyle>();
    if (!conditionalStylesEnabled || !conditionalStyles || conditionalStyles.length === 0) {
      return map;
    }
    renderableNodes.forEach(({ node, globalIndex }) => {
      const style = resolveWaypointConditionalStyle(node, conditionalStyles, conditionalStylesEnabled, optionsSchema, {
        index: globalIndex,
      });
      if (style) {
        map.set(node.id, style);
      }
    });
    return map;
  }, [renderableNodes, conditionalStyles, conditionalStylesEnabled, optionsSchema]);

  // 選択状態・座標・属性ラベル行など、描画とラベル重なり判定の両方で使う値をまとめて1回だけ計算する
  const items = renderableNodes.map(({ node, parentIsGenerator, globalIndex }) => {
    const isSelected = selectedNodeIds.includes(node.id);

    let isReferenced = false;
    const rootIdx = rootNodeIds.indexOf(node.id);
    if (rootIdx !== -1) {
      const activePlugin = activePluginId ? plugins[activePluginId] : null;
      const waypointInputKeys =
        activePlugin?.manifest?.inputs?.filter((inp) => inp.type === 'waypoint')?.map((inp) => inp.name || inp.id) ||
        [];

      isReferenced = waypointInputKeys.some((key) => pluginInteractionData[key] === rootIdx);
    }

    const transform = node.transform!;
    const { qx, qy, qz, qw } = transform;
    const yaw = quaternionToYaw(transform);
    const px = isFinite(transform.x) ? transform.x : 0;
    const py = isFinite(transform.y) ? transform.y : 0;

    const lines: string[] = [];
    if (showProperties && visibleAttributes.length > 0) {
      if (visibleAttributes.includes('index')) {
        lines.push(`Index: [${globalIndex + indexStartIndex}]`);
      }
      if (visibleAttributes.includes('transform')) {
        lines.push(
          `Transform:\n  x: ${transform.x.toFixed(3)}, y: ${transform.y.toFixed(3)}, z: ${(transform.z ?? 0).toFixed(3)}\n  yaw: ${yaw.toFixed(3)}\n  qx: ${qx.toFixed(3)}, qy: ${qy.toFixed(3)}, qz: ${qz.toFixed(3)}, qw: ${qw.toFixed(3)}`,
        );
      }
      const optionKeys = visibleAttributes.filter((attr) => attr.startsWith('options.'));
      optionKeys.forEach((attr) => {
        const key = attr.split('.')[1];
        const optDef = optionsSchema?.options?.find((o) => o.name === key);
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
    .filter((item) => item.lines.length > 0)
    .map((item) => ({ id: item.node.id, worldX: item.px, worldY: item.py, lines: item.lines }));
  const labelLayoutMap = computeLabelOffsets(labelCandidates, scale, textStyle);

  return (
    <>
      {items.map(({ node, parentIsGenerator, isSelected, isReferenced, isAfter, yaw, px, py, lines }) => {
        const safeScale = Math.max(scale, 0.001);

        const condStyle = resolvedStyleMap.get(node.id);

        const base = parentIsGenerator ? WAYPOINT_COLORS.generated : WAYPOINT_COLORS.manual;
        let baseColor: number = base.stroke;
        let baseFill: number = base.fill;

        if (condStyle?.color) {
          baseColor = parseColorSafe(condStyle.color, baseColor);
          baseFill = condStyle.fillColor ? parseColorSafe(condStyle.fillColor, baseColor) : baseColor;
        } else if (condStyle?.fillColor) {
          baseFill = parseColorSafe(condStyle.fillColor, baseFill);
        }

        const isLocked = lockedWaypointId === node.id;
        const stateColors = isLocked
          ? WAYPOINT_COLORS.locked
          : isReferenced
            ? WAYPOINT_COLORS.referenced
            : isAfter
              ? WAYPOINT_COLORS.afterInsertion
              : null;
        const normalColor = stateColors ? stateColors.stroke : baseColor;
        const selectedColor = CANVAS_ACCENT_COLOR;
        const normalFill = stateColors ? stateColors.fill : baseFill;
        const selectedFill = CANVAS_ACCENT_HOVER_COLOR;

        const itemScale = condStyle?.scale ?? 1.0;
        const itemOpacity = condStyle?.opacity ?? 1.0;
        const finalAlpha = isAfter ? 0.35 : itemOpacity;
        const shape: WaypointShape = condStyle?.shape || 'default';

        const labelLayout = labelLayoutMap.get(node.id);
        const labelOffsetX = labelLayout ? labelLayout.x : 15 / safeScale;
        const labelOffsetY = labelLayout ? labelLayout.y : -15 / safeScale;
        const labelWidth = labelLayout?.width ?? 0;
        const labelHeight = labelLayout?.height ?? 0;
        const showLabel = condStyle?.labelVisible !== false;

        return (
          <pixiContainer key={node.id} x={px} y={py} rotation={yaw} alpha={finalAlpha}>
            <pixiGraphics
              eventMode="dynamic"
              cursor={activeTool === 'select' ? 'pointer' : 'default'}
              onPointerDown={(e: FederatedPointerEvent) => {
                if (e.button === 2) {
                  e.stopPropagation();
                  onNodeContextMenu?.(e, node.id);
                } else {
                  onNodePointerDown(e, node.id);
                }
              }}
              onRightDown={(e: FederatedPointerEvent) => {
                e.stopPropagation();
                onNodeContextMenu?.(e, node.id);
              }}
              onRightClick={(e: FederatedPointerEvent) => {
                e.stopPropagation();
                onNodeContextMenu?.(e, node.id);
              }}
              draw={(g) => {
                g.clear();
                g.strokeStyle = { width: 2 / safeScale, color: isSelected ? selectedColor : normalColor };
                g.fillStyle = { color: isSelected ? selectedFill : normalFill, alpha: 0.8 };
                drawWaypointShape(g, shape, itemScale / safeScale);
              }}
            />

            {isSelected && activeTool === 'select' && (
              <pixiGraphics
                x={(25 * Math.max(1.0, itemScale)) / safeScale}
                y={0}
                eventMode="dynamic"
                cursor="grab"
                onPointerDown={(e: FederatedPointerEvent) => onNodeHandlePointerDown(e, node.id)}
                draw={(g) => {
                  g.clear();
                  g.fillStyle = { color: CANVAS_HIT_AREA_COLOR, alpha: 0.001 };
                  g.circle(0, 0, 15 / safeScale);
                  g.fill();

                  g.strokeStyle = { width: 1.5 / safeScale, color: CANVAS_ACCENT_COLOR };
                  g.fillStyle = { color: CANVAS_CONTRAST_COLOR, alpha: 0.9 };
                  g.circle(0, 0, 4 / safeScale);
                  g.fill();
                  g.stroke();

                  g.moveTo(-15 / safeScale, 0);
                  g.lineTo(-4 / safeScale, 0);
                  g.stroke();
                }}
              />
            )}

            {showLabel && lines.length > 0 && (
              <pixiContainer
                rotation={-yaw}
                scale={{ x: 1 / safeScale, y: -1 / safeScale }}
                x={labelOffsetX}
                y={labelOffsetY}
              >
                <pixiGraphics
                  eventMode="dynamic"
                  cursor={activeTool === 'select' ? 'pointer' : 'default'}
                  onPointerDown={(e: FederatedPointerEvent) => {
                    if (e.button === 2) {
                      e.stopPropagation();
                      onNodeContextMenu?.(e, node.id);
                    } else {
                      onNodePointerDown(e, node.id);
                    }
                  }}
                  onRightDown={(e: FederatedPointerEvent) => {
                    e.stopPropagation();
                    onNodeContextMenu?.(e, node.id);
                  }}
                  onRightClick={(e: FederatedPointerEvent) => {
                    e.stopPropagation();
                    onNodeContextMenu?.(e, node.id);
                  }}
                  draw={(g) => {
                    g.clear();
                    if (isSelected) {
                      g.fillStyle = { color: selectedFill, alpha: 0.25 };
                      g.strokeStyle = { width: 1.5, color: selectedColor };
                    } else {
                      g.fillStyle = { color: CANVAS_HIT_AREA_COLOR, alpha: 0.001 };
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
