import { useMemo } from 'react';
import { useAppStore } from '../../../stores/appStore';
import * as PIXI from 'pixi.js';
import { getFlattenedWaypointIds, getNodesAfterInsertionTarget } from '../../../utils/treeUtils';
import { DEFAULT_PATH_COLOR } from '../../../utils/colorPresets';
import { resolvePathConditionalStyle, parseColorSafe, drawDashedLine } from '../../../utils/conditionalStyles';

export function PathLayer({ scale }: { scale: number }) {
  const rootNodeIds = useAppStore((state) => state.rootNodeIds);
  const nodes = useAppStore((state) => state.nodes);
  const insertionTarget = useAppStore((state) => state.insertionTarget);
  const calculatedPathSegments = useAppStore((state) => state.calculatedPathSegments);
  const activePathCalculatorPluginId = useAppStore((state) => state.activePathCalculatorPluginId);
  const pathColor = useAppStore((state) => state.pathColor) || DEFAULT_PATH_COLOR;
  const pathWidth = useAppStore((state) => state.pathWidth) ?? 0.1;
  const pathOpacity = useAppStore((state) => state.pathOpacity) ?? 0.7;
  const syncPathWidthWithFootprint = useAppStore((state) => state.syncPathWidthWithFootprint);
  const robotFootprint = useAppStore((state) => state.robotFootprint);
  const conditionalStyles = useAppStore((state) => state.conditionalStyles);
  const conditionalStylesEnabled = useAppStore((state) => state.conditionalStylesEnabled);
  const optionsSchema = useAppStore((state) => state.optionsSchema);

  const afterNodeIds = useMemo(() => {
    return getNodesAfterInsertionTarget(rootNodeIds, nodes, insertionTarget);
  }, [rootNodeIds, nodes, insertionTarget]);

  const baseEffectiveWidth = useMemo(() => {
    let w = Math.max(0.01, pathWidth);
    if (syncPathWidthWithFootprint && robotFootprint) {
      if (robotFootprint.type === 'circular') {
        w = (robotFootprint.radius || 0.25) * 2;
      } else if (robotFootprint.type === 'rectangular') {
        w = robotFootprint.width || 0.5;
      } else if (robotFootprint.type === 'polygon' && robotFootprint.points && robotFootprint.points.length > 0) {
        const maxR = Math.max(
          ...robotFootprint.points.map((p: any) => (Array.isArray(p) ? Math.hypot(p[0], p[1]) : Math.hypot(p.x, p.y))),
          0.25,
        );
        w = maxR * 2;
      }
    }
    return w;
  }, [pathWidth, syncPathWidthWithFootprint, robotFootprint]);

  const defaultColorNum = useMemo(() => {
    const hex = (pathColor || DEFAULT_PATH_COLOR).replace('#', '');
    const defaultHexNum = parseInt(DEFAULT_PATH_COLOR.replace('#', ''), 16);
    return parseInt(hex, 16) || defaultHexNum;
  }, [pathColor]);

  const baseAlpha = Math.max(0, Math.min(1, pathOpacity));

  interface SegmentData {
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    isAfter: boolean;
    color: number;
    width: number;
    opacity: number;
    dashPattern: 'solid' | 'dashed' | 'dotted';
  }

  const segments = useMemo<SegmentData[]>(() => {
    if (activePathCalculatorPluginId && calculatedPathSegments && calculatedPathSegments.length > 0) {
      const segs: SegmentData[] = [];
      calculatedPathSegments.forEach((seg) => {
        if (seg && seg.length >= 2) {
          for (let j = 0; j < seg.length - 1; j++) {
            segs.push({
              p1: seg[j],
              p2: seg[j + 1],
              isAfter: false,
              color: defaultColorNum,
              width: baseEffectiveWidth,
              opacity: baseAlpha,
              dashPattern: 'solid',
            });
          }
        }
      });
      return segs;
    }

    const flatWaypointIds = getFlattenedWaypointIds(rootNodeIds, nodes);
    const validWaypoints: { id: string; p: { x: number; y: number } }[] = [];
    flatWaypointIds.forEach((id) => {
      const transform = nodes[id]?.transform;
      if (transform && isFinite(transform.x) && isFinite(transform.y)) {
        validWaypoints.push({ id, p: { x: transform.x, y: transform.y } });
      }
    });

    const segs: SegmentData[] = [];
    for (let i = 0; i < validWaypoints.length - 1; i++) {
      const curr = validWaypoints[i];
      const next = validWaypoints[i + 1];
      const isAfter = afterNodeIds.has(next.id);
      const currNode = nodes[curr.id] ?? null;
      const nextNode = nodes[next.id] ?? null;

      const styleOverride = resolvePathConditionalStyle(
        currNode,
        nextNode,
        conditionalStyles,
        conditionalStylesEnabled,
        optionsSchema,
        { sourceIndex: i, targetIndex: i + 1 },
      );

      let segColor = defaultColorNum;
      if (styleOverride?.color) {
        segColor = parseColorSafe(styleOverride.color, defaultColorNum);
      }

      let segWidth = baseEffectiveWidth;
      if (styleOverride?.width !== undefined) {
        segWidth = styleOverride.width;
      }

      let segAlpha = baseAlpha;
      if (styleOverride?.opacity !== undefined) {
        segAlpha = styleOverride.opacity;
      }

      const dashPattern = styleOverride?.dashPattern || 'solid';

      segs.push({
        p1: curr.p,
        p2: next.p,
        isAfter,
        color: segColor,
        width: segWidth,
        opacity: segAlpha,
        dashPattern,
      });
    }

    return segs;
  }, [
    activePathCalculatorPluginId,
    calculatedPathSegments,
    rootNodeIds,
    nodes,
    afterNodeIds,
    conditionalStyles,
    conditionalStylesEnabled,
    optionsSchema,
    defaultColorNum,
    baseEffectiveWidth,
    baseAlpha,
  ]);

  return (
    <pixiGraphics
      draw={(g: PIXI.Graphics) => {
        g.clear();
        if (segments.length === 0) return;

        // Pass 1: Semi-transparent Corridor Ribbon (if width is wide enough)
        segments.forEach(({ p1, p2, isAfter, color, width, opacity, dashPattern }) => {
          const isWideCorridor = width * scale >= 3.0;
          if (!isWideCorridor) return;

          g.strokeStyle = {
            width,
            color: isAfter ? 0x94a3b8 : color,
            alpha: isAfter ? opacity * 0.1 : opacity * 0.35,
            cap: 'round',
            join: 'round',
          };
          if (dashPattern === 'dashed') {
            drawDashedLine(g, p1.x, p1.y, p2.x, p2.y, 0.3, 0.15);
          } else if (dashPattern === 'dotted') {
            drawDashedLine(g, p1.x, p1.y, p2.x, p2.y, 0.1, 0.1);
          } else {
            g.moveTo(p1.x, p1.y);
            g.lineTo(p2.x, p2.y);
          }
          g.stroke();
        });

        // Pass 2: Center Guide Line
        segments.forEach(({ p1, p2, isAfter, color, width, opacity, dashPattern }) => {
          const isWideCorridor = width * scale >= 3.0;
          const centerWidth = isWideCorridor ? Math.max(1.5 / scale, 0.02) : Math.max(width, 1.5 / scale);

          g.strokeStyle = {
            width: centerWidth,
            color: isAfter ? 0x94a3b8 : color,
            alpha: isAfter ? opacity * 0.25 : opacity,
            cap: 'round',
            join: 'round',
          };
          if (dashPattern === 'dashed') {
            drawDashedLine(g, p1.x, p1.y, p2.x, p2.y, 0.2, 0.1);
          } else if (dashPattern === 'dotted') {
            drawDashedLine(g, p1.x, p1.y, p2.x, p2.y, 0.05, 0.05);
          } else {
            g.moveTo(p1.x, p1.y);
            g.lineTo(p2.x, p2.y);
          }
          g.stroke();
        });
      }}
    />
  );
}
