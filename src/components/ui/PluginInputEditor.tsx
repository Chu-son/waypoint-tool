import React from "react";
import { NumericInput } from "./NumericInput";

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
        className={`space-y-1 rounded-lg p-2 transition-all ${isActive ? "ring-1 ring-primary/50 bg-primary/5" : ""}`}
      >
        <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          {totalSteps > 1 && (
            <span
              className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold shrink-0 ${
                isActive
                  ? "bg-primary text-white"
                  : hasData
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-700 text-slate-400"
              }`}
            >
              {index + 1}
            </span>
          )}
          {label} {input.required && <span className="text-red-400">*</span>}
        </label>

        {isActive && !hasData && (
          <p className="text-[10px] text-primary/70 font-medium">
            {input.type === "rectangle"
              ? "▶ Click and drag on map to draw"
              : input.type === "point"
                ? "▶ Click on map to place"
                : ""}
          </p>
        )}

        {input.description && (
          <p className="text-[10px] text-slate-500 leading-tight mb-1">
            {input.description}
          </p>
        )}

        {input.type === "point" && (
          <div className="bg-slate-950 p-2 rounded border border-slate-700">
            {interactionData ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] text-slate-500 uppercase mb-0.5">
                    X (m)
                  </label>
                  <NumericInput
                    value={interactionData.x ?? 0}
                    precision={decimalPrecision}
                    onChange={(val) => onUpdate({ ...interactionData, x: val })}
                    className="ui-input-sm"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-slate-500 uppercase mb-0.5">
                    Y (m)
                  </label>
                  <NumericInput
                    value={interactionData.y ?? 0}
                    precision={decimalPrecision}
                    onChange={(val) => onUpdate({ ...interactionData, y: val })}
                    className="ui-input-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="py-1 text-center text-slate-500 italic text-[11px]">
                Click on map to define
              </div>
            )}
          </div>
        )}

        {input.type === "rectangle" && (
          <div className="bg-slate-950 p-2 rounded border border-slate-700">
            {interactionData?.center ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-1">
                    <label className="block text-[9px] text-slate-500 uppercase mb-0.5">
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
                      className="ui-input-sm"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[9px] text-slate-500 uppercase mb-0.5">
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
                      className="ui-input-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase mb-0.5">
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
                      className="ui-input-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-slate-500 uppercase mb-0.5">
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
                      className="ui-input-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[9px] text-slate-500 uppercase mb-0.5">
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
                      className="ui-input-sm"
                    />
                  </div>
                </div>
                <div className="text-center text-slate-500 text-[9px] mt-1 font-sans border-t border-slate-800 pt-1">
                  Drag ◻ corners · Drag ↻ handle to rotate
                </div>
              </div>
            ) : (
              <div className="py-1 text-center text-slate-500 italic text-[11px]">
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
    <div className="space-y-2 pt-3 border-t border-slate-700/50">
      <label className="text-xs font-semibold text-pink-400 flex items-center justify-between">
        <span>{label}</span>
        <span className="text-[10px] text-slate-500 font-normal opacity-70">
          ({input.type === "point" ? "Point" : "Rectangle Area"})
        </span>
      </label>

      {input.type === "point" && interactionData && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] text-slate-500 mb-0.5">
              X (m)
            </label>
            <NumericInput
              value={interactionData.x ?? 0}
              precision={decimalPrecision}
              onChange={(val) => onUpdate({ ...interactionData, x: val })}
              className="ui-input-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-0.5">
              Y (m)
            </label>
            <NumericInput
              value={interactionData.y ?? 0}
              precision={decimalPrecision}
              onChange={(val) => onUpdate({ ...interactionData, y: val })}
              className="ui-input-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-0.5">
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
              className="ui-input-sm"
            />
          </div>
        </div>
      )}

      {input.type === "rectangle" &&
        (interactionData?.center || interactionData?.origin) && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">
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
                className="ui-input-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">
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
                className="ui-input-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">
                Width
              </label>
              <NumericInput
                value={interactionData.width ?? 0}
                precision={decimalPrecision}
                onChange={(val) =>
                  onUpdate({ ...interactionData, width: Math.max(0, val) })
                }
                className="ui-input-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">
                Height
              </label>
              <NumericInput
                value={interactionData.height ?? 0}
                precision={decimalPrecision}
                onChange={(val) =>
                  onUpdate({ ...interactionData, height: Math.max(0, val) })
                }
                className="ui-input-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] text-slate-500 mb-0.5">
                Yaw (degrees)
              </label>
              <NumericInput
                value={((interactionData.yaw ?? 0) * 180) / Math.PI}
                precision={1}
                onChange={(val) =>
                  onUpdate({ ...interactionData, yaw: (val * Math.PI) / 180 })
                }
                className="ui-input-sm"
              />
            </div>
          </div>
        )}
    </div>
  );
};
