import { ObjectNode, OptionsSchema } from '../types/store';
import { getFlattenedWaypointIds } from './treeUtils';

export interface ExportedWaypointItem {
  index: number;
  id: string;
  type: ObjectNode['type'];
  x: number;
  y: number;
  z: number;
  yaw: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  options: Record<string, any>;
}

export function extractWaypointsForExport(
  rootNodeIds: string[],
  nodes: Record<string, ObjectNode>,
  optionsSchema: OptionsSchema | null,
  indexStartIndex: number = 0
): ExportedWaypointItem[] {
  const flatIds = getFlattenedWaypointIds(rootNodeIds, nodes);

  return flatIds
    .map((id, index) => {
      const node = nodes[id];
      if (!node) return null;

      const fullOptions: Record<string, any> = {};
      if (optionsSchema && optionsSchema.options) {
        optionsSchema.options.forEach((opt: any) => {
          fullOptions[opt.name] =
            node.options && node.options[opt.name] !== undefined
              ? node.options[opt.name]
              : opt.default;
        });
      }
      if (node.options) {
        Object.keys(node.options).forEach((k) => {
          if (fullOptions[k] === undefined) {
            fullOptions[k] = node.options![k];
          }
        });
      }

      const qx = node.transform?.qx || 0;
      const qy = node.transform?.qy || 0;
      const qz = node.transform?.qz || 0;
      const qw = node.transform?.qw ?? 1;
      const yawVal = Math.atan2(
        2.0 * (qw * qz + qx * qy),
        1.0 - 2.0 * (qy * qy + qz * qz)
      );

      return {
        index: index + indexStartIndex,
        id: node.id,
        type: node.type,
        x: node.transform?.x ?? 0,
        y: node.transform?.y ?? 0,
        z: node.transform?.z ?? 0,
        yaw: yawVal,
        qx,
        qy,
        qz,
        qw,
        options: fullOptions,
      };
    })
    .filter((n): n is ExportedWaypointItem => n !== null);
}
