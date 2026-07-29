import { useAppStore } from '../../../stores/appStore';
import { Label } from '../common/Label';
import { NumericInput } from '../NumericInput';
import { WaypointNode } from '../../../types/store';
import { quaternionToYaw, yawToQuaternion, calculateAnchorRelativeTransform } from '../../../utils/transformUtils';
import { ElementCopyField } from '../../../stores/slices/uiSlice';

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

  return (
    <div className="space-y-2 pt-4 border-t border-amber-500/30 relative">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
          <span>⚓</span> Transform (From Anchor)
        </h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label
            className={`block text-xs mb-1 cursor-context-menu select-none ${
              isCopyingField?.('x') ? 'text-amber-400 font-bold' : 'text-text-muted hover:text-text-base'
            }`}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenuLabel?.('x', e);
            }}
          >
            Local X (m)
          </Label>
          <NumericInput
            value={relX}
            precision={decimalPrecision}
            className={isCopyingField?.('x') ? 'border-amber-400 bg-amber-950/20' : ''}
            onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
            onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
            onChange={(val) => {
              const newDx = val * Math.cos(aYaw) - relY * Math.sin(aYaw);
              const newDy = val * Math.sin(aYaw) + relY * Math.cos(aYaw);
              handleUpdate(node.id, {
                transform: { ...node.transform!, x: ax + newDx, y: ay + newDy },
              });
            }}
          />
        </div>
        <div>
          <Label
            className={`block text-xs mb-1 cursor-context-menu select-none ${
              isCopyingField?.('y') ? 'text-amber-400 font-bold' : 'text-text-muted hover:text-text-base'
            }`}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenuLabel?.('y', e);
            }}
          >
            Local Y (m)
          </Label>
          <NumericInput
            value={relY}
            precision={decimalPrecision}
            className={isCopyingField?.('y') ? 'border-amber-400 bg-amber-950/20' : ''}
            onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
            onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
            onChange={(val) => {
              const newDx = relX * Math.cos(aYaw) - val * Math.sin(aYaw);
              const newDy = relX * Math.sin(aYaw) + val * Math.cos(aYaw);
              handleUpdate(node.id, {
                transform: { ...node.transform!, x: ax + newDx, y: ay + newDy },
              });
            }}
          />
        </div>
        <div>
          <Label
            className={`block text-xs mb-1 cursor-context-menu select-none ${
              isCopyingField?.('z') ? 'text-amber-400 font-bold' : 'text-text-muted hover:text-text-base'
            }`}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenuLabel?.('z', e);
            }}
          >
            Delta Z (m)
          </Label>
          <NumericInput
            value={dz}
            precision={decimalPrecision}
            className={isCopyingField?.('z') ? 'border-amber-400 bg-amber-950/20' : ''}
            onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
            onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
            onChange={(val) => {
              handleUpdate(node.id, {
                transform: { ...node.transform!, z: az + val },
              });
            }}
          />
        </div>
        <div className="col-span-3 grid grid-cols-2 gap-2">
          <div>
            <Label
              className={`block text-xs mb-1 cursor-context-menu select-none ${
                isCopyingField?.('yaw') ? 'text-amber-400 font-bold' : 'text-text-muted hover:text-text-base'
              }`}
              onContextMenu={(e) => {
                e.preventDefault();
                onContextMenuLabel?.('yaw', e);
              }}
            >
              Delta Yaw (rad)
            </Label>
            <NumericInput
              step="0.01"
              precision={decimalPrecision}
              value={relYaw}
              className={isCopyingField?.('yaw') ? 'border-amber-400 bg-amber-950/20' : ''}
              onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
              onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
              onChange={(val) => {
                const newYaw = aYaw + val;
                const q = yawToQuaternion(newYaw);
                handleUpdate(node.id, {
                  transform: { ...node.transform!, ...q },
                });
              }}
            />
          </div>
          <div>
            <Label
              className={`block text-xs mb-1 cursor-context-menu select-none ${
                isCopyingField?.('yaw') ? 'text-amber-400 font-bold' : 'text-text-muted hover:text-text-base'
              }`}
              onContextMenu={(e) => {
                e.preventDefault();
                onContextMenuLabel?.('yaw', e);
              }}
            >
              Delta Yaw (deg)
            </Label>
            <NumericInput
              step="1"
              precision={decimalPrecision}
              value={relYaw * (180.0 / Math.PI)}
              className={isCopyingField?.('yaw') ? 'border-amber-400 bg-amber-950/20' : ''}
              onEditStart={() => useAppStore.getState().beginHistoryTransaction()}
              onEditEnd={() => useAppStore.getState().endHistoryTransaction()}
              onChange={(val) => {
                const valRad = val * (Math.PI / 180.0);
                const newYaw = aYaw + valRad;
                const q = yawToQuaternion(newYaw);
                handleUpdate(node.id, {
                  transform: { ...node.transform!, ...q },
                });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
