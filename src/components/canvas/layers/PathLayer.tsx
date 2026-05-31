import { useAppStore } from '../../../stores/appStore';
import * as PIXI from 'pixi.js';

export function PathLayer({ scale }: { scale: number }) {
  const rootNodeIds = useAppStore(state => state.rootNodeIds);
  const nodes = useAppStore(state => state.nodes);

  return (
    <pixiGraphics
      draw={(g: PIXI.Graphics) => {
        g.clear();
        
        type PathPoint = { x: number; y: number; isGenerated: boolean };
        const allPoints: PathPoint[] = [];
        
        rootNodeIds.forEach(id => {
          const node = nodes[id];
          if (!node) return;
          if (node.type === 'manual' && node.transform) {
            allPoints.push({ x: node.transform.x, y: node.transform.y, isGenerated: false });
          } else if (node.type === 'generator' && node.children_ids) {
            node.children_ids.forEach(childId => {
              const child = nodes[childId];
              if (child && child.transform) {
                allPoints.push({ x: child.transform.x, y: child.transform.y, isGenerated: true });
              }
            });
          }
        });

        for (let i = 1; i < allPoints.length; i++) {
          const prev = allPoints[i - 1];
          const curr = allPoints[i];
          const segIsGenerated = prev.isGenerated || curr.isGenerated;
          
          g.strokeStyle = {
            width: 2 / scale,
            color: segIsGenerated ? 0x22c55e : 0x94a3b8,
            alpha: segIsGenerated ? 0.5 : 0.6
          };
          g.moveTo(prev.x, prev.y);
          g.lineTo(curr.x, curr.y);
          g.stroke();
        }
      }}
    />
  );
}
