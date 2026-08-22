import { useAppStore } from '../../../stores/appStore';
import * as PIXI from 'pixi.js';

export function PathLayer({ scale }: { scale: number }) {
  const rootNodeIds = useAppStore(state => state.rootNodeIds);
  const nodes = useAppStore(state => state.nodes);
  const calculatedPathSegments = useAppStore(state => state.calculatedPathSegments);
  const activePathCalculatorPluginId = useAppStore(state => state.activePathCalculatorPluginId);
  const pathColor = useAppStore(state => state.pathColor) || '#10b981';
  const pathWidth = useAppStore(state => state.pathWidth) ?? 0.1;
  const pathOpacity = useAppStore(state => state.pathOpacity) ?? 0.7;
  const syncPathWidthWithFootprint = useAppStore(state => state.syncPathWidthWithFootprint);
  const robotFootprint = useAppStore(state => state.robotFootprint);

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
        const colorNum = parseInt(hex, 16) || 0x10b981;
        const baseAlpha = Math.max(0, Math.min(1, pathOpacity));

        // Gather all path segments: List of Point arrays
        let segmentsToDraw: { x: number; y: number }[][] = [];

        if (activePathCalculatorPluginId && calculatedPathSegments && calculatedPathSegments.length > 0) {
          segmentsToDraw = calculatedPathSegments.filter(seg => seg && seg.length >= 2);
        } else {
          // Default straight line path from waypoints tree
          type PathPoint = { x: number; y: number };
          const allPoints: PathPoint[] = [];

          rootNodeIds.forEach(id => {
            const node = nodes[id];
            if (!node) return;
            if (node.type === 'manual' && node.transform) {
              allPoints.push({ x: node.transform.x, y: node.transform.y });
            } else if (node.type === 'generator' && node.children_ids) {
              node.children_ids.forEach(childId => {
                const child = nodes[childId];
                if (child && child.transform) {
                  allPoints.push({ x: child.transform.x, y: child.transform.y });
                }
              });
            }
          });

          if (allPoints.length >= 2) {
            segmentsToDraw = [allPoints];
          }
        }

        if (segmentsToDraw.length === 0) return;

        const isWideCorridor = effectiveWidth * scale >= 3.0;

        // Pass 1: Semi-transparent Corridor Ribbon (if width is wide enough)
        if (isWideCorridor) {
          segmentsToDraw.forEach(segment => {
            g.strokeStyle = {
              width: effectiveWidth,
              color: colorNum,
              alpha: baseAlpha * 0.35,
              cap: 'round',
              join: 'round',
            };
            g.moveTo(segment[0].x, segment[0].y);
            for (let j = 1; j < segment.length; j++) {
              g.lineTo(segment[j].x, segment[j].y);
            }
            g.stroke();
          });
        }

        // Pass 2: Center Guide Line
        segmentsToDraw.forEach(segment => {
          g.strokeStyle = {
            width: isWideCorridor ? Math.max(1.5 / scale, 0.02) : Math.max(effectiveWidth, 1.5 / scale),
            color: colorNum,
            alpha: baseAlpha,
            cap: 'round',
            join: 'round',
          };
          g.moveTo(segment[0].x, segment[0].y);
          for (let j = 1; j < segment.length; j++) {
            g.lineTo(segment[j].x, segment[j].y);
          }
          g.stroke();
        });
      }}
    />
  );
}
