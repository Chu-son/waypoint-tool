import { useAppStore } from '../../../stores/appStore';
import { RobotFootprint } from '../../../types/store';
import { quaternionToYaw } from '../../../utils/transformUtils';

interface FootprintLayerProps {
  scale: number;
}

export function FootprintLayer({ scale }: FootprintLayerProps) {
  const robotFootprint = useAppStore((state) => state.robotFootprint);
  const showFootprints = useAppStore((state) => state.showFootprints);
  const rootNodeIds = useAppStore((state) => state.rootNodeIds);
  const nodes = useAppStore((state) => state.nodes);
  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds);

  if (!robotFootprint) return null;

  // Collect all renderable nodes (same logic as WaypointLayer)
  const renderableNodes: { node: typeof nodes[string] }[] = [];
  rootNodeIds.forEach((id) => {
    const node = nodes[id];
    if (!node) return;
    if (node.type === 'manual' && node.transform) {
      renderableNodes.push({ node });
    } else if (node.type === 'generator' && node.children_ids) {
      node.children_ids.forEach((childId) => {
        const child = nodes[childId];
        if (child && child.transform) {
          renderableNodes.push({ node: child });
        }
      });
    }
  });

  const safeScale = Math.max(scale, 0.001);

  return (
    <>
      {renderableNodes.map(({ node }) => {
        const isSelected = selectedNodeIds.includes(node.id);
        const shouldRender = isSelected || showFootprints;
        if (!shouldRender) return null;

        const transform = node.transform!;
        const yaw = quaternionToYaw(transform);
        const px = isFinite(transform.x) ? transform.x : 0;
        const py = isFinite(transform.y) ? transform.y : 0;

        const strokeColor = isSelected ? 0x38bdf8 : 0x94a3b8;
        const strokeWidth = isSelected ? 1.5 / safeScale : 1.0 / safeScale;
        const fillColor = isSelected ? 0x38bdf8 : 0x94a3b8;
        const fillAlpha = isSelected ? 0.18 : 0.05;

        return (
          <pixiContainer
            key={`footprint-${node.id}`}
            x={px}
            y={py}
            rotation={yaw}
            eventMode="none"
          >
            <pixiGraphics
              eventMode="none"
              draw={(g) => {
                g.clear();
                g.strokeStyle = { width: strokeWidth, color: strokeColor, alpha: isSelected ? 0.9 : 0.6 };
                g.fillStyle = { color: fillColor, alpha: fillAlpha };

                drawFootprintShape(g, robotFootprint, safeScale, isSelected);
              }}
            />
          </pixiContainer>
        );
      })}
    </>
  );
}

function drawFootprintShape(
  g: any,
  footprint: RobotFootprint,
  safeScale: number,
  isSelected: boolean
) {
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
