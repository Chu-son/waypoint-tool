import { memo, useCallback, useMemo } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { TextStyle, FederatedPointerEvent, Graphics } from 'pixi.js';
import { computeLabelOffsets, LabelCandidate } from '../utils/labelLayout';
import { getNodesAfterInsertionTarget } from '../../../utils/treeUtils';
import { quaternionToYaw } from '../../../utils/transformUtils';
import { resolveWithDefaults, summarizeValue } from '../../../utils/optionValues';
import { resolveOptionsSchema } from '../../../utils/optionSchema';
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
import { WaypointNode, WaypointShape } from '../../../types/store';

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

type NodePointerHandler = (e: FederatedPointerEvent, nodeId: string) => void;

interface WaypointLayerProps {
  scale: number;
  textStyle: TextStyle;
  lockedWaypointId: string | null;
  onNodePointerDown: NodePointerHandler;
  onNodeHandlePointerDown: NodePointerHandler;
  onNodeContextMenu?: NodePointerHandler;
}

/**
 * Waypoints (manual root nodes and children of generator nodes). Each waypoint is its own memoized
 * component, so dragging one redraws only that one; pass stable callbacks to keep it that way.
 */
export const WaypointLayer = memo(function WaypointLayer({
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
  const rawOptionsSchema = useAppStore((state) => state.optionsSchema);
  // ラベル表示・条件付き書式の評価は ref を解決した実効スキーマで行う。
  const optionsSchema = resolveOptionsSchema(rawOptionsSchema);
  const indexStartIndex = useAppStore((state) => state.indexStartIndex);
  const showProperties = useAppStore((state) => state.showProperties);
  const conditionalStyles = useAppStore((state) => state.conditionalStyles);
  const conditionalStylesEnabled = useAppStore((state) => state.conditionalStylesEnabled);

  const afterNodeIds = useMemo(() => {
    return getNodesAfterInsertionTarget(rootNodeIds, nodes, insertionTarget);
  }, [rootNodeIds, nodes, insertionTarget]);

  const renderableNodes = useMemo(() => {
    const result: { node: WaypointNode; parentIsGenerator: boolean; globalIndex: number }[] = [];
    let globalIdx = 0;

    function traverse(id: string, isUnderGenerator: boolean) {
      const node = nodes[id];
      if (!node) return;
      const isGen = isUnderGenerator || node.type === 'generator';
      if (node.children_ids && node.children_ids.length > 0) {
        node.children_ids.forEach((cid) => traverse(cid, isGen));
      } else if (node.type === 'manual' && node.transform) {
        result.push({ node, parentIsGenerator: isGen, globalIndex: globalIdx++ });
      }
    }

    rootNodeIds.forEach((id) => traverse(id, false));
    return result;
  }, [rootNodeIds, nodes]);

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
  const items = useMemo(() => {
    const selected = new Set(selectedNodeIds);
    // indexOf と同じく、最初に現れた位置
    const rootIndex = new Map<string, number>();
    rootNodeIds.forEach((id, i) => {
      if (!rootIndex.has(id)) rootIndex.set(id, i);
    });
    const activePlugin = activePluginId ? plugins[activePluginId] : null;
    const waypointInputKeys =
      activePlugin?.manifest?.inputs?.filter((inp) => inp.type === 'waypoint')?.map((inp) => inp.name || inp.id) || [];

    return renderableNodes.map(({ node, parentIsGenerator, globalIndex }) => {
      const isSelected = selected.has(node.id);

      let isReferenced = false;
      const rootIdx = rootIndex.get(node.id);
      if (rootIdx !== undefined) {
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
          const val = optDef ? resolveWithDefaults(optDef, node.options?.[key]) : node.options?.[key];
          if (val !== undefined && val !== '') {
            const displayLabel = optDef?.label || key;
            const summary = optDef ? summarizeValue(optDef, val) : String(val);
            lines.push(`${displayLabel}: ${summary}`);
          }
        });
      }

      const isAfter = afterNodeIds.has(node.id);
      return { node, parentIsGenerator, isSelected, isReferenced, isAfter, yaw, px, py, lines };
    });
  }, [
    renderableNodes,
    selectedNodeIds,
    rootNodeIds,
    activePluginId,
    plugins,
    pluginInteractionData,
    showProperties,
    visibleAttributes,
    indexStartIndex,
    optionsSchema,
    afterNodeIds,
  ]);

  const labelLayoutMap = useMemo(() => {
    const labelCandidates: LabelCandidate[] = items
      .filter((item) => item.lines.length > 0)
      .map((item) => ({ id: item.node.id, worldX: item.px, worldY: item.py, lines: item.lines }));
    return computeLabelOffsets(labelCandidates, scale, textStyle);
  }, [items, scale, textStyle]);

  const safeScale = Math.max(scale, 0.001);

  return (
    <>
      {items.map(({ node, parentIsGenerator, isSelected, isReferenced, isAfter, yaw, px, py, lines }) => {
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

        const itemScale = condStyle?.scale ?? 1.0;
        const itemOpacity = condStyle?.opacity ?? 1.0;

        const labelLayout = labelLayoutMap.get(node.id);

        return (
          <WaypointMarker
            key={node.id}
            nodeId={node.id}
            px={px}
            py={py}
            yaw={yaw}
            alpha={isAfter ? 0.35 : itemOpacity}
            safeScale={safeScale}
            itemScale={itemScale}
            shape={condStyle?.shape || 'default'}
            isSelected={isSelected}
            normalColor={stateColors ? stateColors.stroke : baseColor}
            normalFill={stateColors ? stateColors.fill : baseFill}
            isSelectTool={activeTool === 'select'}
            labelText={condStyle?.labelVisible !== false && lines.length > 0 ? lines.join('\n') : null}
            labelOffsetX={labelLayout ? labelLayout.x : 15 / safeScale}
            labelOffsetY={labelLayout ? labelLayout.y : -15 / safeScale}
            labelWidth={labelLayout?.width ?? 0}
            labelHeight={labelLayout?.height ?? 0}
            textStyle={textStyle}
            onNodePointerDown={onNodePointerDown}
            onNodeHandlePointerDown={onNodeHandlePointerDown}
            onNodeContextMenu={onNodeContextMenu}
          />
        );
      })}
    </>
  );
});

interface WaypointMarkerProps {
  nodeId: string;
  px: number;
  py: number;
  yaw: number;
  alpha: number;
  safeScale: number;
  itemScale: number;
  shape: WaypointShape;
  isSelected: boolean;
  normalColor: number;
  normalFill: number;
  isSelectTool: boolean;
  /** The label text, or `null` when no label is shown. */
  labelText: string | null;
  labelOffsetX: number;
  labelOffsetY: number;
  labelWidth: number;
  labelHeight: number;
  textStyle: TextStyle;
  onNodePointerDown: NodePointerHandler;
  onNodeHandlePointerDown: NodePointerHandler;
  onNodeContextMenu?: NodePointerHandler;
}

const SELECTED_COLOR = CANVAS_ACCENT_COLOR;
const SELECTED_FILL = CANVAS_ACCENT_HOVER_COLOR;

/** One waypoint: its marker, the heading handle while selected, and its attribute label. */
const WaypointMarker = memo(function WaypointMarker({
  nodeId,
  px,
  py,
  yaw,
  alpha,
  safeScale,
  itemScale,
  shape,
  isSelected,
  normalColor,
  normalFill,
  isSelectTool,
  labelText,
  labelOffsetX,
  labelOffsetY,
  labelWidth,
  labelHeight,
  textStyle,
  onNodePointerDown,
  onNodeHandlePointerDown,
  onNodeContextMenu,
}: WaypointMarkerProps) {
  const handlePointerDown = useCallback(
    (e: FederatedPointerEvent) => {
      if (e.button === 2) {
        e.stopPropagation();
        onNodeContextMenu?.(e, nodeId);
      } else {
        onNodePointerDown(e, nodeId);
      }
    },
    [nodeId, onNodePointerDown, onNodeContextMenu],
  );
  const handleContextMenu = useCallback(
    (e: FederatedPointerEvent) => {
      e.stopPropagation();
      onNodeContextMenu?.(e, nodeId);
    },
    [nodeId, onNodeContextMenu],
  );
  const handleHeadingPointerDown = useCallback(
    (e: FederatedPointerEvent) => onNodeHandlePointerDown(e, nodeId),
    [nodeId, onNodeHandlePointerDown],
  );

  const drawMarker = useCallback(
    (g: Graphics) => {
      g.clear();
      g.strokeStyle = { width: 2 / safeScale, color: isSelected ? SELECTED_COLOR : normalColor };
      g.fillStyle = { color: isSelected ? SELECTED_FILL : normalFill, alpha: 0.8 };
      drawWaypointShape(g, shape, itemScale / safeScale);
    },
    [safeScale, isSelected, normalColor, normalFill, shape, itemScale],
  );

  const drawHeadingHandle = useCallback(
    (g: Graphics) => {
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
    },
    [safeScale],
  );

  const drawLabelBox = useCallback(
    (g: Graphics) => {
      g.clear();
      if (isSelected) {
        g.fillStyle = { color: SELECTED_FILL, alpha: 0.25 };
        g.strokeStyle = { width: 1.5, color: SELECTED_COLOR };
      } else {
        g.fillStyle = { color: CANVAS_HIT_AREA_COLOR, alpha: 0.001 };
      }
      g.rect(0, -labelHeight, labelWidth, labelHeight);
      g.fill();
      if (isSelected) {
        g.stroke();
      }
    },
    [isSelected, labelWidth, labelHeight],
  );

  const cursor = isSelectTool ? 'pointer' : 'default';

  return (
    <pixiContainer x={px} y={py} rotation={yaw} alpha={alpha}>
      <pixiGraphics
        eventMode="dynamic"
        cursor={cursor}
        onPointerDown={handlePointerDown}
        onRightDown={handleContextMenu}
        onRightClick={handleContextMenu}
        draw={drawMarker}
      />

      {isSelected && isSelectTool && (
        <pixiGraphics
          x={(25 * Math.max(1.0, itemScale)) / safeScale}
          y={0}
          eventMode="dynamic"
          cursor="grab"
          onPointerDown={handleHeadingPointerDown}
          draw={drawHeadingHandle}
        />
      )}

      {labelText !== null && (
        <pixiContainer
          rotation={-yaw}
          scale={{ x: 1 / safeScale, y: -1 / safeScale }}
          x={labelOffsetX}
          y={labelOffsetY}
        >
          <pixiGraphics
            eventMode="dynamic"
            cursor={cursor}
            onPointerDown={handlePointerDown}
            onRightDown={handleContextMenu}
            onRightClick={handleContextMenu}
            draw={drawLabelBox}
          />
          <pixiText text={labelText} style={textStyle} anchor={{ x: 0, y: 1 }} />
        </pixiContainer>
      )}
    </pixiContainer>
  );
});
