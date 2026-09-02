import { useMemo } from "react";
import { useAppStore } from "../../../stores/appStore";
import { WaypointNode } from "../../../types/store";
import { quaternionToYaw } from "../../../utils/transformUtils";
import { getFlattenedWaypointIds } from "../../../utils/treeUtils";
import { TransformField } from "./TransformField";
import { PropertySectionHeader } from "./PropertySectionHeader";

interface RelativeTransformGroupProps {
  node: WaypointNode;
  nodeIndex: number;
  handleUpdate: (id: string, updates: any) => void;
  prevNode?: WaypointNode;
}

export function RelativeTransformGroup({
  node,
  nodeIndex,
  handleUpdate,
  prevNode: propPrevNode,
}: RelativeTransformGroupProps) {
  const rootNodeIds = useAppStore((state) => state.rootNodeIds);
  const nodes = useAppStore((state) => state.nodes);
  const decimalPrecision = useAppStore((state) => state.decimalPrecision);

  const flatWaypointIds = useMemo(
    () => getFlattenedWaypointIds(rootNodeIds, nodes),
    [rootNodeIds, nodes]
  );

  const prevNodeId = flatWaypointIds[nodeIndex - 1];
  const prevNode = propPrevNode || (prevNodeId ? nodes[prevNodeId] : undefined);
  if (!prevNode || !prevNode.transform || !node.transform) return null;

  const px = prevNode.transform.x ?? 0;
  const py = prevNode.transform.y ?? 0;
  const pz = prevNode.transform.z ?? 0;
  const pYaw = quaternionToYaw(prevNode.transform);
  const cYaw = quaternionToYaw(node.transform);

  const dx = (node.transform.x ?? 0) - px;
  const dy = (node.transform.y ?? 0) - py;
  const dz = (node.transform.z ?? 0) - pz;
  
  const relX = dx * Math.cos(pYaw) + dy * Math.sin(pYaw);
  const relY = -dx * Math.sin(pYaw) + dy * Math.cos(pYaw);
  let relYaw = cYaw - pYaw;

  // Normalize relative yaw to -pi to pi
  while (relYaw > Math.PI) relYaw -= 2 * Math.PI;
  while (relYaw < -Math.PI) relYaw += 2 * Math.PI;

  const handleFieldChange = (field: "x" | "y" | "z", val: number) => {
    if (field === "x") {
      const newDx = val * Math.cos(pYaw) - relY * Math.sin(pYaw);
      const newDy = val * Math.sin(pYaw) + relY * Math.cos(pYaw);
      handleUpdate(node.id, {
        transform: { ...node.transform!, x: px + newDx, y: py + newDy },
      });
    } else if (field === "y") {
      const newDx = relX * Math.cos(pYaw) - val * Math.sin(pYaw);
      const newDy = relX * Math.sin(pYaw) + val * Math.cos(pYaw);
      handleUpdate(node.id, {
        transform: { ...node.transform!, x: px + newDx, y: py + newDy },
      });
    } else if (field === "z") {
      handleUpdate(node.id, {
        transform: { ...node.transform!, z: pz + val },
      });
    }
  };

  const handleYawChange = (val: number, isDeg: boolean) => {
    const valRad = isDeg ? val * (Math.PI / 180.0) : val;
    const newYaw = pYaw + valRad;
    const halfYaw = newYaw / 2.0;
    const qz = Math.sin(halfYaw);
    const qw = Math.cos(halfYaw);
    handleUpdate(node.id, {
      transform: { ...node.transform!, qx: 0, qy: 0, qz, qw },
    });
  };

  return (
    <div className="space-y-2 pt-4 border-t border-border-base relative">
      <PropertySectionHeader title="Transform (Relative to Prev)" />

      <div className="grid grid-cols-3 gap-2">
        <TransformField
          label="Local X (m)"
          fieldId="x"
          value={relX}
          precision={decimalPrecision}
          onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
          onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
          onChange={(val) => handleFieldChange("x", val)}
        />
        <TransformField
          label="Local Y (m)"
          fieldId="y"
          value={relY}
          precision={decimalPrecision}
          onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
          onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
          onChange={(val) => handleFieldChange("y", val)}
        />
        <TransformField
          label="Delta Z (m)"
          fieldId="z"
          value={dz}
          precision={decimalPrecision}
          onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
          onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
          onChange={(val) => handleFieldChange("z", val)}
        />
        <div className="col-span-3 grid grid-cols-2 gap-2">
          <TransformField
            label="Delta Yaw (rad)"
            fieldId="yaw"
            value={relYaw}
            precision={decimalPrecision}
            step="0.01"
            onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
            onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
            onChange={(val) => handleYawChange(val, false)}
          />
          <TransformField
            label="Delta Yaw (deg)"
            fieldId="yaw"
            value={relYaw * (180.0 / Math.PI)}
            precision={decimalPrecision}
            step="1"
            onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
            onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
            onChange={(val) => handleYawChange(val, true)}
          />
        </div>
      </div>
    </div>
  );
}
