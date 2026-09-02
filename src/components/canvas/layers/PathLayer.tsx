import { useMemo } from 'react';
import { useAppStore } from '../../../stores/appStore';
import * as PIXI from 'pixi.js';
import { getFlattenedWaypointIds, getNodesAfterInsertionTarget } from '../../../utils/treeUtils';
import { DEFAULT_PATH_COLOR } from '../../../utils/colorPresets';

export function PathLayer({ scale }: { scale: number }) {
  const rootNodeIds = useAppStore(state => state.rootNodeIds);
  const nodes = useAppStore(state => state.nodes);
  const insertionTarget = useAppStore(state => state.insertionTarget);
  const calculatedPathSegments = useAppStore(state => state.calculatedPathSegments);
  const activePathCalculatorPluginId = useAppStore(state => state.activePathCalculatorPluginId);
  const pathColor = useAppStore(state => state.pathColor) || DEFAULT_PATH_COLOR;
  const pathWidth = useAppStore(state => state.pathWidth) ?? 0.1;
  const pathOpacity = useAppStore(state => state.pathOpacity) ?? 0.7;
  const syncPathWidthWithFootprint = useAppStore(state => state.syncPathWidthWithFootprint);
  const robotFootprint = useAppStore(state => state.robotFootprint);

  const afterNodeIds = useMemo(() => {
    return getNodesAfterInsertionTarget(rootNodeIds, nodes, insertionTarget);
  }, [rootNodeIds, nodes, insertionTarget]);

  return (
    <pixiGraphics
      draw={(g: PIXI.Graphics) => {
        g.clear();

        // Effective width in meters
        let effectiveWidth = Math.max(0.01, pathWidth);
        if (syncPathWidthWithFootprint && robotFootprint) {
          if (robotFootprint.type === 'circular') {
            effectiveWidth = (robotFootprint.radius || 0.25) * 2;
          } else if (robotFootprint.type === 'rectangular') {
            effectiveWidth = robotFootprint.width || 0.5;
          } else if (robotFootprint.type === 'polygon' && robotFootprint.points && robotFootprint.points.length > 0) {
            const maxR = Math.max(...robotFootprint.points.map((p: any) => Array.isArray(p) ? Math.hypot(p[0], p[1]) : Math.hypot(p.x, p.y)), 0.25);
            effectiveWidth = maxR * 2;
          }
        }

        const hex = pathColor.replace('#', '');
        const defaultHexNum = parseInt(DEFAULT_PATH_COLOR.replace('#', ''), 16);
        const colorNum = parseInt(hex, 16) || defaultHexNum;
        const baseAlpha = Math.max(0, Math.min(1, pathOpacity));

        // Gather line segments: list of individual segments with isAfter flag
        interface LineSegment {
          p1: { x: number; y: number };
          p2: { x: number; y: number };
          isAfter: boolean;
        }

        let lineSegments: LineSegment[] = [];

        if (activePathCalculatorPluginId && calculatedPathSegments && calculatedPathSegments.length > 0) {
          calculatedPathSegments.forEach(seg => {
            if (seg && seg.length >= 2) {
              for (let j = 0; j < seg.length - 1; j++) {
                lineSegments.push({ p1: seg[j], p2: seg[j + 1], isAfter: false });
              }
            }
          });
        } else {
          // Default straight line path from waypoints tree
          const flatWaypointIds = getFlattenedWaypointIds(rootNodeIds, nodes);
          const validWaypoints: { id: string; p: { x: number; y: number } }[] = [];
          flatWaypointIds.forEach(id => {
            const transform = nodes[id]?.transform;
            if (transform && isFinite(transform.x) && isFinite(transform.y)) {
              validWaypoints.push({ id, p: { x: transform.x, y: transform.y } });
            }
          });

          for (let i = 0; i < validWaypoints.length - 1; i++) {
            const curr = validWaypoints[i];
            const next = validWaypoints[i + 1];
            // 次のポイントが afterNodeIds に含まれていれば、この線分は挿入位置以降（後方）
            const isAfter = afterNodeIds.has(next.id);
            lineSegments.push({ p1: curr.p, p2: next.p, isAfter });
          }
        }

        if (lineSegments.length === 0) return;

        const isWideCorridor = effectiveWidth * scale >= 3.0;

        // Pass 1: Semi-transparent Corridor Ribbon (if width is wide enough)
        if (isWideCorridor) {
          lineSegments.forEach(({ p1, p2, isAfter }) => {
            g.strokeStyle = {
              width: effectiveWidth,
              color: isAfter ? 0x94a3b8 : colorNum,
              alpha: isAfter ? baseAlpha * 0.1 : baseAlpha * 0.35,
              cap: 'round',
              join: 'round',
            };
            g.moveTo(p1.x, p1.y);
            g.lineTo(p2.x, p2.y);
            g.stroke();
          });
        }

        // Pass 2: Center Guide Line
        lineSegments.forEach(({ p1, p2, isAfter }) => {
          g.strokeStyle = {
            width: isWideCorridor ? Math.max(1.5 / scale, 0.02) : Math.max(effectiveWidth, 1.5 / scale),
            color: isAfter ? 0x94a3b8 : colorNum,
            alpha: isAfter ? baseAlpha * 0.25 : baseAlpha,
            cap: 'round',
            join: 'round',
          };
          g.moveTo(p1.x, p1.y);
          g.lineTo(p2.x, p2.y);
          g.stroke();
        });
      }}
    />
  );
}
