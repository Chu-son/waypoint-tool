import { useAppStore } from "../../../stores/appStore";
import { Label } from "../common/Label";
import { NumericInput } from "../NumericInput";
import { WaypointNode } from "../../../types/store";

interface RelativeTransformGroupProps {
  node: WaypointNode;
  nodeIndex: number;
  handleUpdate: (id: string, updates: any) => void;
}

export function RelativeTransformGroup({
  node,
  nodeIndex,
  handleUpdate,
}: RelativeTransformGroupProps) {
  const rootNodeIds = useAppStore((state) => state.rootNodeIds);
  const nodes = useAppStore((state) => state.nodes);
  const decimalPrecision = useAppStore((state) => state.decimalPrecision);

  const prevNodeId = rootNodeIds[nodeIndex - 1];
  const prevNode = nodes[prevNodeId];
  if (!prevNode || !prevNode.transform) return null;

  const px = prevNode.transform.x ?? 0;
  const py = prevNode.transform.y ?? 0;
  const pz = prevNode.transform.z ?? 0;
  const pYaw = Math.atan2(
    2.0 * ((prevNode.transform.qw ?? 1) * (prevNode.transform.qz || 0) + (prevNode.transform.qx || 0) * (prevNode.transform.qy || 0)),
    1.0 - 2.0 * ((prevNode.transform.qy || 0) * (prevNode.transform.qy || 0) + (prevNode.transform.qz || 0) * (prevNode.transform.qz || 0))
  );

  const cx = node.transform?.x ?? 0;
  const cy = node.transform?.y ?? 0;
  const cz = node.transform?.z ?? 0;
  const cYaw = Math.atan2(
    2.0 * ((node.transform?.qw ?? 1) * (node.transform?.qz || 0) + (node.transform?.qx || 0) * (node.transform?.qy || 0)),
    1.0 - 2.0 * ((node.transform?.qy || 0) * (node.transform?.qy || 0) + (node.transform?.qz || 0) * (node.transform?.qz || 0))
  );

  const dx = cx - px;
  const dy = cy - py;
  const dz = cz - pz;
  
  const relX = dx * Math.cos(pYaw) + dy * Math.sin(pYaw);
  const relY = -dx * Math.sin(pYaw) + dy * Math.cos(pYaw);
  let relYaw = cYaw - pYaw;

  // Normalize relative yaw to -pi to pi
  while (relYaw > Math.PI) relYaw -= 2 * Math.PI;
  while (relYaw < -Math.PI) relYaw += 2 * Math.PI;

  return (
    <div className="space-y-2 pt-4 border-t border-border-base relative">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Transform (Relative to Prev)
        </h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="block text-xs text-text-muted mb-1">Local X (m)</Label>
          <NumericInput
            value={relX}
            precision={decimalPrecision}
            onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
            onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
            onChange={(val) => {
              const newDx = val * Math.cos(pYaw) - relY * Math.sin(pYaw);
              const newDy = val * Math.sin(pYaw) + relY * Math.cos(pYaw);
              handleUpdate(node.id, {
                transform: { ...node.transform!, x: px + newDx, y: py + newDy },
              });
            }}
          />
        </div>
        <div>
          <Label className="block text-xs text-text-muted mb-1">Local Y (m)</Label>
          <NumericInput
            value={relY}
            precision={decimalPrecision}
            onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
            onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
            onChange={(val) => {
              const newDx = relX * Math.cos(pYaw) - val * Math.sin(pYaw);
              const newDy = relX * Math.sin(pYaw) + val * Math.cos(pYaw);
              handleUpdate(node.id, {
                transform: { ...node.transform!, x: px + newDx, y: py + newDy },
              });
            }}
          />
        </div>
        <div>
          <Label className="block text-xs text-text-muted mb-1">Delta Z (m)</Label>
          <NumericInput
            value={dz}
            precision={decimalPrecision}
            onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
            onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
            onChange={(val) => {
              handleUpdate(node.id, {
                transform: { ...node.transform!, z: pz + val },
              });
            }}
          />
        </div>
        <div className="col-span-3 grid grid-cols-2 gap-2">
          <div>
            <Label className="block text-xs text-text-muted mb-1">
              Delta Yaw (rad)
            </Label>
            <NumericInput
              step="0.01"
              precision={decimalPrecision}
              value={relYaw}
              onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
              onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
              onChange={(val) => {
                const newYaw = pYaw + val;
                const halfYaw = newYaw / 2.0;
                const qz = Math.sin(halfYaw);
                const qw = Math.cos(halfYaw);
                handleUpdate(node.id, {
                  transform: { ...node.transform!, qx: 0, qy: 0, qz, qw },
                });
              }}
            />
          </div>
          <div>
            <Label className="block text-xs text-text-muted mb-1">
              Delta Yaw (deg)
            </Label>
            <NumericInput
              step="1"
              precision={decimalPrecision}
              value={relYaw * (180.0 / Math.PI)}
              onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
              onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
              onChange={(val) => {
                const valRad = val * (Math.PI / 180.0);
                const newYaw = pYaw + valRad;
                const halfYaw = newYaw / 2.0;
                const qz = Math.sin(halfYaw);
                const qw = Math.cos(halfYaw);
                handleUpdate(node.id, {
                  transform: { ...node.transform!, qx: 0, qy: 0, qz, qw },
                });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
