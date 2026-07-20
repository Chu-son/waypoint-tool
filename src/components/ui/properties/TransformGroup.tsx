import { useAppStore } from "../../../stores/appStore";
import { Button } from "../common/Button";
import { Label } from "../common/Label";
import { NumericInput } from "../NumericInput";
import { Eye, EyeOff } from "lucide-react";
import { WaypointNode } from "../../../types/store";
import { quaternionToYaw } from "../../../utils/transformUtils";
import { ElementCopyField } from "../../../stores/slices/uiSlice";

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

  return (
    <div className="space-y-2 relative pt-2">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Transform (World)
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-text-muted hover:text-text-base"
          onClick={() => toggleAttributeVisibility("transform")}
          title="Toggle Transform on Canvas"
        >
          {visibleAttributes.includes("transform") ? (
            <Eye size={14} />
          ) : (
            <EyeOff size={14} />
          )}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label
            className={`block text-xs mb-1 cursor-context-menu select-none ${
              isCopyingField?.("x")
                ? "text-primary-base font-bold"
                : "text-text-muted hover:text-text-base"
            }`}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenuLabel?.("x", e);
            }}
          >
            X (m)
          </Label>
          <NumericInput
            value={isMultiSelection ? 0 : (node?.transform?.x ?? 0)}
            precision={decimalPrecision}
            placeholder={isMultiSelection ? "Mixed" : ""}
            className={
              isCopyingField?.("x") ? "border-primary-base bg-primary-base/10" : ""
            }
            onChange={(val) => {
              if (isMultiSelection) {
                selectedNodeIds.forEach((id) => {
                  const n = nodes[id];
                  if (n && n.transform)
                    handleUpdate(id, {
                      transform: { ...n.transform, x: val },
                    });
                });
              } else {
                handleUpdate(node!.id, {
                  transform: { ...node!.transform!, x: val },
                });
              }
            }}
          />
        </div>
        <div>
          <Label
            className={`block text-xs mb-1 cursor-context-menu select-none ${
              isCopyingField?.("y")
                ? "text-primary-base font-bold"
                : "text-text-muted hover:text-text-base"
            }`}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenuLabel?.("y", e);
            }}
          >
            Y (m)
          </Label>
          <NumericInput
            value={isMultiSelection ? 0 : (node?.transform?.y ?? 0)}
            precision={decimalPrecision}
            placeholder={isMultiSelection ? "Mixed" : ""}
            className={
              isCopyingField?.("y") ? "border-primary-base bg-primary-base/10" : ""
            }
            onChange={(val) => {
              if (isMultiSelection) {
                selectedNodeIds.forEach((id) => {
                  const n = nodes[id];
                  if (n && n.transform)
                    handleUpdate(id, {
                      transform: { ...n.transform, y: val },
                    });
                });
              } else {
                handleUpdate(node!.id, {
                  transform: { ...node!.transform!, y: val },
                });
              }
            }}
          />
        </div>
        <div>
          <Label
            className={`block text-xs mb-1 cursor-context-menu select-none ${
              isCopyingField?.("z")
                ? "text-primary-base font-bold"
                : "text-text-muted hover:text-text-base"
            }`}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenuLabel?.("z", e);
            }}
          >
            Z (m)
          </Label>
          <NumericInput
            value={isMultiSelection ? 0 : (node?.transform?.z ?? 0)}
            precision={decimalPrecision}
            placeholder={isMultiSelection ? "Mixed" : ""}
            className={
              isCopyingField?.("z") ? "border-primary-base bg-primary-base/10" : ""
            }
            onChange={(val) => {
              if (isMultiSelection) {
                selectedNodeIds.forEach((id) => {
                  const n = nodes[id];
                  if (n && n.transform)
                    handleUpdate(id, {
                      transform: { ...n.transform, z: val },
                    });
                });
              } else {
                handleUpdate(node!.id, {
                  transform: { ...node!.transform!, z: val },
                });
              }
            }}
          />
        </div>
        <div className="col-span-3 grid grid-cols-2 gap-2">
          <div>
            <Label
              className={`block text-xs mb-1 cursor-context-menu select-none ${
                isCopyingField?.("yaw")
                  ? "text-primary-base font-bold"
                  : "text-text-muted hover:text-text-base"
              }`}
              onContextMenu={(e) => {
                e.preventDefault();
                onContextMenuLabel?.("yaw", e);
              }}
            >
              Yaw (rad)
            </Label>
            <NumericInput
              step="0.01"
              precision={decimalPrecision}
              value={isMultiSelection ? 0 : currentYaw}
              placeholder={isMultiSelection ? "Mixed" : ""}
              className={
                isCopyingField?.("yaw")
                  ? "border-primary-base bg-primary-base/10"
                  : ""
              }
              onChange={(val) => {
                const halfYaw = val / 2.0;
                const qz = Math.sin(halfYaw);
                const qw = Math.cos(halfYaw);

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
              }}
            />
          </div>
          <div>
            <Label
              className={`block text-xs mb-1 cursor-context-menu select-none ${
                isCopyingField?.("yaw")
                  ? "text-primary-base font-bold"
                  : "text-text-muted hover:text-text-base"
              }`}
              onContextMenu={(e) => {
                e.preventDefault();
                onContextMenuLabel?.("yaw", e);
              }}
            >
              Yaw (deg)
            </Label>
            <NumericInput
              step="1"
              precision={decimalPrecision}
              value={isMultiSelection ? 0 : currentYaw * (180.0 / Math.PI)}
              placeholder={isMultiSelection ? "Mixed" : ""}
              className={
                isCopyingField?.("yaw")
                  ? "border-primary-base bg-primary-base/10"
                  : ""
              }
              onChange={(val) => {
                const rad = val * (Math.PI / 180.0);
                const halfYaw = rad / 2.0;
                const qz = Math.sin(halfYaw);
                const qw = Math.cos(halfYaw);

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
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

