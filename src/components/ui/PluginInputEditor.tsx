import React from "react";
import { NumericInput } from "./NumericInput";
import { Label } from "./common/Label";
import { cn } from "../../utils/cn";

export interface PluginInput {
  id: string;
  name?: string;
  label?: string;
  type: string;
  required?: boolean;
  description?: string;
}

interface PluginInputEditorProps {
  input: PluginInput;
  interactionData: any;
  onUpdate: (data: any) => void;
  mode: "creation" | "edit";
  index?: number;
  totalSteps?: number;
  isActive?: boolean;
  hasData?: boolean;
  decimalPrecision?: number;
}

export const PluginInputEditor: React.FC<PluginInputEditorProps> = ({
  input,
  interactionData,
  onUpdate,
  mode,
  index = 0,
  totalSteps = 1,
  isActive = false,
  hasData = false,
  decimalPrecision = 2,
}) => {
  const key = input.name || input.id;
  const label = input.label || key;

  if (mode === "creation") {
    return (
      <div
        className={cn(
          "space-y-2 rounded-lg p-2 transition-all border border-transparent",
          isActive ? "bg-primary-base/5 border-primary-base/20 ring-1 ring-primary-base/20" : ""
        )}
      >
        <Label className="text-[13px] font-semibold text-text-base flex items-center gap-2">
          {totalSteps > 1 && (
            <span
              className={cn(
                "w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold shrink-0",
                isActive ? "bg-primary-base text-white" : hasData ? "bg-emerald-600 text-white" : "bg-surface-hover text-text-muted"
              )}
            >
              {index + 1}
            </span>
          )}
          {label} {input.required && <span className="text-danger-base">*</span>}
        </Label>

        {isActive && !hasData && (
          <p className="text-[10px] text-primary-base font-medium opacity-80">
            {input.type === "rectangle"
              ? "▶ Click and drag on map to draw"
              : input.type === "point"
                ? "▶ Click on map to place"
                : ""}
          </p>
        )}

        {input.description && (
          <p className="text-[10px] text-text-muted/70 leading-tight mb-1">
            {input.description}
          </p>
        )}

        {input.type === "point" && (
          <div className="bg-surface-base p-2 rounded-md border border-border-base/50">
            {interactionData ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] text-text-muted uppercase mb-0.5 font-bold tracking-wider">
                    X (m)
                  </label>
                  <NumericInput
                    value={interactionData.x ?? 0}
                    precision={decimalPrecision}
                    onChange={(val) => onUpdate({ ...interactionData, x: val })}
                    className="h-7 text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-text-muted uppercase mb-0.5 font-bold tracking-wider">
                    Y (m)
                  </label>
                  <NumericInput
                    value={interactionData.y ?? 0}
                    precision={decimalPrecision}
                    onChange={(val) => onUpdate({ ...interactionData, y: val })}
                    className="h-7 text-[11px]"
                  />
                </div>
              </div>
            ) : (
              <div className="py-1 text-center text-text-muted/50 italic text-[11px]">
                Click on map to define
              </div>
            )}
          </div>
        )}

        {input.type === "rectangle" && (
          <div className="bg-surface-base p-2 rounded-md border border-border-base/50">
            {interactionData?.center ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-1">
                    <label className="block text-[9px] text-text-muted uppercase mb-0.5 font-bold tracking-wider">
                      Width (m)
                    </label>
                    <NumericInput
                      value={interactionData.width ?? 0}
                      precision={decimalPrecision}
                      onChange={(val) =>
                        onUpdate({
                          ...interactionData,
                          width: Math.max(0, val),
                        })
                      }
                      className="h-7 text-[11px]"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[9px] text-text-muted uppercase mb-0.5 font-bold tracking-wider">
                      Height (m)
                    </label>
                    <NumericInput
                      value={interactionData.height ?? 0}
                      precision={decimalPrecision}
                      onChange={(val) =>
                        onUpdate({
                          ...interactionData,
                          height: Math.max(0, val),
                        })
                      }
                      className="h-7 text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-text-muted uppercase mb-0.5 font-bold tracking-wider">
                      Center X
                    </label>
                    <NumericInput
                      value={interactionData.center?.x ?? 0}
                      precision={decimalPrecision}
                      onChange={(val) =>
                        onUpdate({
                          ...interactionData,
                          center: { ...interactionData.center, x: val },
                        })
                      }
                      className="h-7 text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-text-muted uppercase mb-0.5 font-bold tracking-wider">
                      Center Y
                    </label>
                    <NumericInput
                      value={interactionData.center?.y ?? 0}
                      precision={decimalPrecision}
                      onChange={(val) =>
                        onUpdate({
                          ...interactionData,
                          center: { ...interactionData.center, y: val },
                        })
                      }
                      className="h-7 text-[11px]"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[9px] text-text-muted uppercase mb-0.5 font-bold tracking-wider">
                      Yaw (degrees)
                    </label>
                    <NumericInput
                      value={((interactionData.yaw ?? 0) * 180) / Math.PI}
                      precision={1}
                      onChange={(val) =>
                        onUpdate({
                          ...interactionData,
                          yaw: (val * Math.PI) / 180,
                        })
                      }
                      className="h-7 text-[11px]"
                    />
                  </div>
                </div>
                <div className="text-center text-text-muted text-[9px] mt-1 font-sans border-t border-border-base/30 pt-1">
                  Drag ◻ corners · Drag ↻ handle to rotate
                </div>
              </div>
            ) : (
              <div className="py-1 text-center text-text-muted/50 italic text-[11px]">
                Click and drag on map to draw
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Edit Mode (PropertiesPanel)
  return (
    <div className="space-y-2 pt-3 border-t border-border-base/50">
      <Label className="text-[13px] font-bold text-primary-base flex items-center justify-between uppercase tracking-tight">
        <span>{label}</span>
        <span className="text-[10px] text-text-muted font-normal opacity-70 normal-case">
          ({input.type === "point" ? "Point" : "Rectangle Area"})
        </span>
      </Label>

      {input.type === "point" && interactionData && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] text-text-muted mb-0.5 font-medium uppercase tracking-wider">
              X (m)
            </label>
            <NumericInput
              value={interactionData.x ?? 0}
              precision={decimalPrecision}
              onChange={(val) => onUpdate({ ...interactionData, x: val })}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-0.5 font-medium uppercase tracking-wider">
              Y (m)
            </label>
            <NumericInput
              value={interactionData.y ?? 0}
              precision={decimalPrecision}
              onChange={(val) => onUpdate({ ...interactionData, y: val })}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] text-text-muted mb-0.5 font-medium uppercase tracking-wider">
              Yaw (rad)
            </label>
            <NumericInput
              step="0.01"
              value={Math.atan2(
                2.0 *
                  ((interactionData.qw ?? 1) * (interactionData.qz ?? 0) +
                    (interactionData.qx ?? 0) * (interactionData.qy ?? 0)),
                1.0 -
                  2.0 *
                    ((interactionData.qy ?? 0) * (interactionData.qy ?? 0) +
                      (interactionData.qz ?? 0) * (interactionData.qz ?? 0)),
              )}
              precision={decimalPrecision}
              onChange={(val) => {
                const qz = Math.sin(val / 2);
                const qw = Math.cos(val / 2);
                onUpdate({ ...interactionData, qx: 0, qy: 0, qz, qw });
              }}
              className="h-8 text-xs"
            />
          </div>
        </div>
      )}

      {input.type === "rectangle" &&
        (interactionData?.center || interactionData?.origin) && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-text-muted mb-0.5 font-medium uppercase tracking-wider">
                Center X
              </label>
              <NumericInput
                value={interactionData.center.x ?? 0}
                precision={decimalPrecision}
                onChange={(val) =>
                  onUpdate({
                    ...interactionData,
                    center: { ...interactionData.center, x: val },
                  })
                }
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-0.5 font-medium uppercase tracking-wider">
                Center Y
              </label>
              <NumericInput
                value={interactionData.center.y ?? 0}
                precision={decimalPrecision}
                onChange={(val) =>
                  onUpdate({
                    ...interactionData,
                    center: { ...interactionData.center, y: val },
                  })
                }
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-0.5 font-medium uppercase tracking-wider">
                Width
              </label>
              <NumericInput
                value={interactionData.width ?? 0}
                precision={decimalPrecision}
                onChange={(val) =>
                  onUpdate({ ...interactionData, width: Math.max(0, val) })
                }
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] text-text-muted mb-0.5 font-medium uppercase tracking-wider">
                Height
              </label>
              <NumericInput
                value={interactionData.height ?? 0}
                precision={decimalPrecision}
                onChange={(val) =>
                  onUpdate({ ...interactionData, height: Math.max(0, val) })
                }
                className="h-8 text-xs"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] text-text-muted mb-0.5 font-medium uppercase tracking-wider">
                Yaw (degrees)
              </label>
              <NumericInput
                value={((interactionData.yaw ?? 0) * 180) / Math.PI}
                precision={1}
                onChange={(val) =>
                  onUpdate({ ...interactionData, yaw: (val * Math.PI) / 180 })
                }
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}
    </div>
  );
};
