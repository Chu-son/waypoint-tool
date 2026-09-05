import { useAppStore } from '../../../stores/appStore';
import { WaypointNode } from '../../../types/store';
import { quaternionToYaw, yawToQuaternion, calculateAnchorRelativeTransform } from '../../../utils/transformUtils';
import { ElementCopyField } from '../../../stores/slices/uiSlice';
import { TransformField } from './TransformField';
import { PropertySectionHeader } from './PropertySectionHeader';
import { Anchor } from 'lucide-react';

interface AnchorTransformGroupProps {
  node: WaypointNode;
  anchorNode: WaypointNode;
  handleUpdate: (id: string, updates: any) => void;
  onContextMenuLabel?: (field: ElementCopyField, e: React.MouseEvent) => void;
  isCopyingField?: (field: ElementCopyField) => boolean;
}

export function AnchorTransformGroup({
  node,
  anchorNode,
  handleUpdate,
  onContextMenuLabel,
  isCopyingField,
}: AnchorTransformGroupProps) {
  const decimalPrecision = useAppStore((state) => state.decimalPrecision);

  if (!anchorNode.transform || !node.transform) return null;

  const ax = anchorNode.transform.x ?? 0;
  const ay = anchorNode.transform.y ?? 0;
  const az = anchorNode.transform.z ?? 0;
  const aYaw = quaternionToYaw(anchorNode.transform);

  const { relX, relY, relZ: dz, relYaw } = calculateAnchorRelativeTransform(node.transform, anchorNode.transform);

  const handleFieldChange = (field: "x" | "y" | "z", val: number) => {
    if (field === "x") {
      const newDx = val * Math.cos(aYaw) - relY * Math.sin(aYaw);
      const newDy = val * Math.sin(aYaw) + relY * Math.cos(aYaw);
      handleUpdate(node.id, {
        transform: { ...node.transform!, x: ax + newDx, y: ay + newDy },
      });
    } else if (field === "y") {
      const newDx = relX * Math.cos(aYaw) - val * Math.sin(aYaw);
      const newDy = relX * Math.sin(aYaw) + val * Math.cos(aYaw);
      handleUpdate(node.id, {
        transform: { ...node.transform!, x: ax + newDx, y: ay + newDy },
      });
    } else if (field === "z") {
      handleUpdate(node.id, {
        transform: { ...node.transform!, z: az + val },
      });
    }
  };

  const handleYawChange = (val: number, isDeg: boolean) => {
    const valRad = isDeg ? val * (Math.PI / 180.0) : val;
    const newYaw = aYaw + valRad;
    const q = yawToQuaternion(newYaw);
    handleUpdate(node.id, {
      transform: { ...node.transform!, ...q },
    });
  };

  return (
    <div className="space-y-2 pt-4 border-t border-accent-anchor/30 relative">
      <PropertySectionHeader
        title={
          <span className="flex items-center gap-1">
            <Anchor size={12} className="shrink-0" />
            Transform (From Anchor)
          </span>
        }
        className="text-accent-anchor"
      />

      <div className="grid grid-cols-3 gap-2">
        <TransformField
          label="Local X (m)"
          fieldId="x"
          value={relX}
          precision={decimalPrecision}
          variant="anchor"
          isCopying={isCopyingField?.('x')}
          onContextMenu={(e) => onContextMenuLabel?.('x', e)}
          onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
          onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
          onChange={(val) => handleFieldChange("x", val)}
        />
        <TransformField
          label="Local Y (m)"
          fieldId="y"
          value={relY}
          precision={decimalPrecision}
          variant="anchor"
          isCopying={isCopyingField?.('y')}
          onContextMenu={(e) => onContextMenuLabel?.('y', e)}
          onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
          onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
          onChange={(val) => handleFieldChange("y", val)}
        />
        <TransformField
          label="Delta Z (m)"
          fieldId="z"
          value={dz}
          precision={decimalPrecision}
          variant="anchor"
          isCopying={isCopyingField?.('z')}
          onContextMenu={(e) => onContextMenuLabel?.('z', e)}
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
            variant="anchor"
            isCopying={isCopyingField?.('yaw')}
            onContextMenu={(e) => onContextMenuLabel?.('yaw', e)}
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
            variant="anchor"
            isCopying={isCopyingField?.('yaw')}
            onContextMenu={(e) => onContextMenuLabel?.('yaw', e)}
            onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
            onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
            onChange={(val) => handleYawChange(val, true)}
          />
        </div>
      </div>
    </div>
  );
}
