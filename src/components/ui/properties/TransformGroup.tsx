import { useAppStore } from "../../../stores/appStore";
import { WaypointNode } from "../../../types/store";
import { quaternionToYaw } from "../../../utils/transformUtils";
import { ElementCopyField } from "../../../stores/slices/uiSlice";
import { TransformField } from "./TransformField";
import { PropertySectionHeader } from "./PropertySectionHeader";

interface TransformGroupProps {
  isMultiSelection: boolean;
  node: WaypointNode | null;
  handleUpdate: (id: string, updates: any) => void;
  onContextMenuLabel?: (field: ElementCopyField, e: React.MouseEvent) => void;
  isCopyingField?: (field: ElementCopyField) => boolean;
}

export function TransformGroup({
  isMultiSelection,
  node,
  handleUpdate,
  onContextMenuLabel,
  isCopyingField,
}: TransformGroupProps) {
  const visibleAttributes = useAppStore((state) => state.visibleAttributes);
  const toggleAttributeVisibility = useAppStore(
    (state) => state.toggleAttributeVisibility,
  );
  const decimalPrecision = useAppStore((state) => state.decimalPrecision);
  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds);
  const nodes = useAppStore((state) => state.nodes);

  const currentYaw = node?.transform ? quaternionToYaw(node.transform) : 0;

  const handleFieldChange = (field: "x" | "y" | "z", val: number) => {
    useAppStore.getState().runInHistoryTransaction(() => {
      if (isMultiSelection) {
        selectedNodeIds.forEach((id) => {
          const n = nodes[id];
          if (n && n.transform)
            handleUpdate(id, {
              transform: { ...n.transform, [field]: val },
            });
        });
      } else {
        handleUpdate(node!.id, {
          transform: { ...node!.transform!, [field]: val },
        });
      }
    });
  };

  const handleYawChange = (val: number, isDeg: boolean) => {
    const rad = isDeg ? val * (Math.PI / 180.0) : val;
    const halfYaw = rad / 2.0;
    const qz = Math.sin(halfYaw);
    const qw = Math.cos(halfYaw);

    useAppStore.getState().runInHistoryTransaction(() => {
      if (isMultiSelection) {
        selectedNodeIds.forEach((id) => {
          const n = nodes[id];
          if (n && n.transform)
            handleUpdate(id, {
              transform: { ...n.transform, qx: 0, qy: 0, qz, qw },
            });
        });
      } else {
        handleUpdate(node!.id, {
          transform: { ...node!.transform!, qx: 0, qy: 0, qz, qw },
        });
      }
    });
  };

  return (
    <div className="space-y-2 relative pt-2">
      <PropertySectionHeader
        title="Transform (World)"
        isVisible={visibleAttributes.includes("transform")}
        onToggleVisible={() => toggleAttributeVisibility("transform")}
        toggleTitle="Toggle Transform on Canvas"
      />

      <div className="grid grid-cols-3 gap-2">
        <TransformField
          label="X (m)"
          fieldId="x"
          value={isMultiSelection ? 0 : (node?.transform?.x ?? 0)}
          precision={decimalPrecision}
          placeholder={isMultiSelection ? "Mixed" : ""}
          isCopying={isCopyingField?.("x")}
          onContextMenu={(e) => onContextMenuLabel?.("x", e)}
          onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
          onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
          onChange={(val) => handleFieldChange("x", val)}
        />
        <TransformField
          label="Y (m)"
          fieldId="y"
          value={isMultiSelection ? 0 : (node?.transform?.y ?? 0)}
          precision={decimalPrecision}
          placeholder={isMultiSelection ? "Mixed" : ""}
          isCopying={isCopyingField?.("y")}
          onContextMenu={(e) => onContextMenuLabel?.("y", e)}
          onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
          onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
          onChange={(val) => handleFieldChange("y", val)}
        />
        <TransformField
          label="Z (m)"
          fieldId="z"
          value={isMultiSelection ? 0 : (node?.transform?.z ?? 0)}
          precision={decimalPrecision}
          placeholder={isMultiSelection ? "Mixed" : ""}
          isCopying={isCopyingField?.("z")}
          onContextMenu={(e) => onContextMenuLabel?.("z", e)}
          onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
          onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
          onChange={(val) => handleFieldChange("z", val)}
        />
        <div className="col-span-3 grid grid-cols-2 gap-2">
          <TransformField
            label="Yaw (rad)"
            fieldId="yaw"
            value={isMultiSelection ? 0 : currentYaw}
            precision={decimalPrecision}
            placeholder={isMultiSelection ? "Mixed" : ""}
            step="0.01"
            isCopying={isCopyingField?.("yaw")}
            onContextMenu={(e) => onContextMenuLabel?.("yaw", e)}
            onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
            onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
            onChange={(val) => handleYawChange(val, false)}
          />
          <TransformField
            label="Yaw (deg)"
            fieldId="yaw"
            value={isMultiSelection ? 0 : currentYaw * (180.0 / Math.PI)}
            precision={decimalPrecision}
            placeholder={isMultiSelection ? "Mixed" : ""}
            step="1"
            isCopying={isCopyingField?.("yaw")}
            onContextMenu={(e) => onContextMenuLabel?.("yaw", e)}
            onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
            onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
            onChange={(val) => handleYawChange(val, true)}
          />
        </div>
      </div>
    </div>
  );
}
