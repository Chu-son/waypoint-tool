import { memo, useCallback, useMemo } from 'react';
import type { Graphics } from 'pixi.js';
import { useAppStore } from '../../../stores/appStore';
import { RobotFootprint } from '../../../types/store';
import { quaternionToYaw } from '../../../utils/transformUtils';
import { getFlattenedWaypointIds } from '../../../utils/treeUtils';
import { resolveOptionsSchema } from '../../../utils/optionSchema';
import { CANVAS_FOOTPRINT_SELECTED_COLOR, CANVAS_MUTED_COLOR } from '../canvasConstants';
import {
  parseColorSafe,
  resolveFootprintConditionalStyle,
  ResolvedFootprintStyle,
} from '../../../utils/conditionalStyles';

interface FootprintLayerProps {
  scale: number;
}

export const FootprintLayer = memo(function FootprintLayer({ scale }: FootprintLayerProps) {
  const robotFootprint = useAppStore((state) => state.robotFootprint);
  const showFootprints = useAppStore((state) => state.showFootprints);
  const rootNodeIds = useAppStore((state) => state.rootNodeIds);
  const nodes = useAppStore((state) => state.nodes);
  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds);
  const rawOptionsSchema = useAppStore((state) => state.optionsSchema);
  const optionsSchema = resolveOptionsSchema(rawOptionsSchema);
  const conditionalStyles = useAppStore((state) => state.conditionalStyles);
  const conditionalStylesEnabled = useAppStore((state) => state.conditionalStylesEnabled);

  // Collect all renderable nodes (same logic as WaypointLayer)
  const renderableNodes = useMemo(
    () =>
      getFlattenedWaypointIds(rootNodeIds, nodes)
        .map((id) => nodes[id])
        .filter((node) => node && node.transform)
        .map((node) => ({ node })),
    [rootNodeIds, nodes],
  );

  // 条件付き書式のメモ化キャッシュ
  const resolvedFpMap = useMemo(() => {
    const map = new Map<string, ResolvedFootprintStyle>();
    if (!robotFootprint || !conditionalStylesEnabled || !conditionalStyles || conditionalStyles.length === 0)
      return map;
    renderableNodes.forEach(({ node }, idx) => {
      const style = resolveFootprintConditionalStyle(
        node,
        robotFootprint,
        conditionalStyles,
        conditionalStylesEnabled,
        optionsSchema,
        { index: idx },
      );
      if (style) map.set(node.id, style);
    });
    return map;
  }, [renderableNodes, robotFootprint, conditionalStyles, conditionalStylesEnabled, optionsSchema]);

  const selected = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  if (!robotFootprint) return null;

  const safeScale = Math.max(scale, 0.001);

  return (
    <>
      {renderableNodes.map(({ node }) => {
        const isSelected = selected.has(node.id);
        const condStyle = resolvedFpMap.get(node.id);

        const isForceShow = condStyle?.visibleMode === 'force_show';
        const isForceHide = condStyle?.visibleMode === 'force_hide';
        const shouldRender = isSelected || isForceShow || (showFootprints && !isForceHide);
        if (!shouldRender) return null;

        const effectiveFootprint = condStyle?.footprint || robotFootprint;

        const transform = node.transform!;
        const yaw = quaternionToYaw(transform);
        const px = isFinite(transform.x) ? transform.x : 0;
        const py = isFinite(transform.y) ? transform.y : 0;

        const baseStroke = condStyle?.strokeColor
          ? parseColorSafe(condStyle.strokeColor, CANVAS_MUTED_COLOR)
          : CANVAS_MUTED_COLOR;
        const baseFill = condStyle?.fillColor
          ? parseColorSafe(condStyle.fillColor, CANVAS_MUTED_COLOR)
          : CANVAS_MUTED_COLOR;

        return (
          <Footprint
            key={`footprint-${node.id}`}
            px={px}
            py={py}
            yaw={yaw}
            footprint={effectiveFootprint}
            safeScale={safeScale}
            isSelected={isSelected}
            strokeColor={isSelected ? CANVAS_FOOTPRINT_SELECTED_COLOR : baseStroke}
            strokeWidth={isSelected ? 1.5 / safeScale : (condStyle?.strokeWidth ?? 1.0) / safeScale}
            fillColor={isSelected ? CANVAS_FOOTPRINT_SELECTED_COLOR : baseFill}
            fillAlpha={isSelected ? 0.18 : (condStyle?.fillAlpha ?? 0.05)}
          />
        );
      })}
    </>
  );
});

interface FootprintProps {
  px: number;
  py: number;
  yaw: number;
  footprint: RobotFootprint;
  safeScale: number;
  isSelected: boolean;
  strokeColor: number;
  strokeWidth: number;
  fillColor: number;
  fillAlpha: number;
}

/** The footprint of one waypoint; memoized so moving one waypoint redraws only its own. */
const Footprint = memo(function Footprint({
  px,
  py,
  yaw,
  footprint,
  safeScale,
  isSelected,
  strokeColor,
  strokeWidth,
  fillColor,
  fillAlpha,
}: FootprintProps) {
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      g.strokeStyle = { width: strokeWidth, color: strokeColor, alpha: isSelected ? 0.9 : 0.6 };
      g.fillStyle = { color: fillColor, alpha: fillAlpha };

      drawFootprintShape(g, footprint, safeScale, isSelected);
    },
    [strokeWidth, strokeColor, isSelected, fillColor, fillAlpha, footprint, safeScale],
  );

  return (
    <pixiContainer x={px} y={py} rotation={yaw} eventMode="none">
      <pixiGraphics eventMode="none" draw={draw} />
    </pixiContainer>
  );
});

function drawFootprintShape(g: any, footprint: RobotFootprint, safeScale: number, isSelected: boolean) {
  if (footprint.type === 'circular') {
    const r = footprint.radius;
    g.circle(0, 0, r);
    g.fill();
    g.stroke();

    // Direction line to +X (Forward)
    if (isSelected) {
      g.moveTo(0, 0);
      g.lineTo(r, 0);
      g.stroke();
    }
  } else if (footprint.type === 'rectangular') {
    const halfL = footprint.length / 2;
    const halfW = footprint.width / 2;
    const ox = footprint.offset_x || 0;
    const oy = footprint.offset_y || 0;

    const minX = ox - halfL;
    const minY = oy - halfW;
    const widthX = footprint.length;
    const heightY = footprint.width;

    g.rect(minX, minY, widthX, heightY);
    g.fill();
    g.stroke();

    // Front arrow indicator on the front face
    if (isSelected) {
      const frontX = ox + halfL;
      g.moveTo(ox, oy);
      g.lineTo(frontX, oy);
      g.stroke();
    }
  } else if (footprint.type === 'polygon' && footprint.points && footprint.points.length >= 3) {
    const pts = footprint.points;
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      g.lineTo(pts[i][0], pts[i][1]);
    }
    g.closePath();
    g.fill();
    g.stroke();

    if (isSelected) {
      // Small heading indicator from origin to +X front
      const arrowLen = Math.min(0.2, 10 / safeScale);
      g.moveTo(0, 0);
      g.lineTo(arrowLen, 0);
      g.stroke();
    }
  }
}
