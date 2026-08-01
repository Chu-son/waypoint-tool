import React from "react";
import { Label } from "./common/Label";
import { cn } from "../../utils/cn";
import { useAppStore } from "../../stores/appStore";
import { Select } from "./common/Select";
import { Input } from "./common/Input";
import { LabeledNumericInput } from "./common/LabeledNumericInput";
import { quaternionToYaw } from "../../utils/transformUtils";

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
  const rootNodeIds = useAppStore((state) => state.rootNodeIds);
  const nodes = useAppStore((state) => state.nodes);
  const indexStartIndex = useAppStore((state) => state.indexStartIndex);

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
                : input.type === "waypoint"
                  ? "▶ Select a waypoint from list or map"
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
              <PointForm
                data={interactionData}
                onChange={onUpdate}
                precision={decimalPrecision}
              />
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
              <RectangleForm
                data={interactionData}
                onChange={onUpdate}
                precision={decimalPrecision}
                showFooterHint
              />
            ) : (
              <div className="py-1 text-center text-text-muted/50 italic text-[11px]">
                Click and drag on map to draw
              </div>
            )}
          </div>
        )}

        {input.type === "waypoint" && (
          <div className="bg-surface-base border border-border-base/50 rounded-md p-2">
            <WaypointSelectForm
              value={interactionData}
              onChange={onUpdate}
              rootNodeIds={rootNodeIds}
              nodes={nodes}
              indexStartIndex={indexStartIndex}
              showDirectInput
            />
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
          ({input.type === "point" ? "Point" : input.type === "waypoint" ? "Waypoint Reference" : "Rectangle Area"})
        </span>
      </Label>

      {input.type === "waypoint" && (
        <div className="space-y-2">
          <WaypointSelectForm
            value={interactionData}
            onChange={onUpdate}
            rootNodeIds={rootNodeIds}
            nodes={nodes}
            indexStartIndex={indexStartIndex}
          />
        </div>
      )}

      {input.type === "point" && interactionData && (
        <PointForm
          data={interactionData}
          onChange={onUpdate}
          precision={decimalPrecision}
          includeYaw
          columns={3}
          inputSize="md"
        />
      )}

      {input.type === "rectangle" && (interactionData?.center || interactionData?.origin) && (
        <RectangleForm
          data={interactionData}
          onChange={onUpdate}
          precision={decimalPrecision}
          inputSize="md"
        />
      )}
    </div>
  );
};

// ----------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------

interface PointFormProps {
  data: any;
  onChange: (val: any) => void;
  precision?: number;
  includeYaw?: boolean;
  columns?: number;
  inputSize?: "sm" | "md";
}

function PointForm({
  data,
  onChange,
  precision = 2,
  includeYaw = false,
  columns = 2,
  inputSize = "sm",
}: PointFormProps) {
  const inputClassName = inputSize === "md" ? "h-8 text-xs" : "h-7 text-[11px]";
  const gridClass = columns === 3 ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-2";

  return (
    <div className={gridClass}>
      <LabeledNumericInput
        label="X (m)"
        value={data.x ?? 0}
        precision={precision}
        onChange={(val) => onChange({ ...data, x: val })}
        inputClassName={inputClassName}
      />
      <LabeledNumericInput
        label="Y (m)"
        value={data.y ?? 0}
        precision={precision}
        onChange={(val) => onChange({ ...data, y: val })}
        inputClassName={inputClassName}
      />
      {includeYaw && (
        <LabeledNumericInput
          label="Yaw (rad)"
          value={quaternionToYaw(data)}
          precision={precision}
          step="0.01"
          onChange={(val) => {
            const qz = Math.sin(val / 2);
            const qw = Math.cos(val / 2);
            onChange({ ...data, qx: 0, qy: 0, qz, qw });
          }}
          inputClassName={inputClassName}
        />
      )}
    </div>
  );
}

interface RectangleFormProps {
  data: any;
  onChange: (val: any) => void;
  precision?: number;
  showFooterHint?: boolean;
  inputSize?: "sm" | "md";
}

function RectangleForm({
  data,
  onChange,
  precision = 2,
  showFooterHint = false,
  inputSize = "sm",
}: RectangleFormProps) {
  const inputClassName = inputSize === "md" ? "h-8 text-xs" : "h-7 text-[11px]";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <LabeledNumericInput
          label="Width (m)"
          value={data.width ?? 0}
          precision={precision}
          onChange={(val) => onChange({ ...data, width: Math.max(0, val) })}
          inputClassName={inputClassName}
        />
        <LabeledNumericInput
          label="Height (m)"
          value={data.height ?? 0}
          precision={precision}
          onChange={(val) => onChange({ ...data, height: Math.max(0, val) })}
          inputClassName={inputClassName}
        />
        <LabeledNumericInput
          label="Center X"
          value={data.center?.x ?? 0}
          precision={precision}
          onChange={(val) =>
            onChange({ ...data, center: { ...data.center, x: val } })
          }
          inputClassName={inputClassName}
        />
        <LabeledNumericInput
          label="Center Y"
          value={data.center?.y ?? 0}
          precision={precision}
          onChange={(val) =>
            onChange({ ...data, center: { ...data.center, y: val } })
          }
          inputClassName={inputClassName}
        />
        <div className="col-span-2">
          <LabeledNumericInput
            label="Yaw (degrees)"
            value={((data.yaw ?? 0) * 180) / Math.PI}
            precision={1}
            onChange={(val) => onChange({ ...data, yaw: (val * Math.PI) / 180 })}
            inputClassName={inputClassName}
          />
        </div>
      </div>
      {showFooterHint && (
        <div className="text-center text-text-muted text-[9px] mt-1 font-sans border-t border-border-base/30 pt-1">
          Drag ◻ corners · Drag ↻ handle to rotate
        </div>
      )}
    </div>
  );
}

interface WaypointSelectFormProps {
  value: any;
  onChange: (val: any) => void;
  rootNodeIds: string[];
  nodes: Record<string, any>;
  indexStartIndex: number;
  showDirectInput?: boolean;
}

function WaypointSelectForm({
  value,
  onChange,
  rootNodeIds,
  nodes,
  indexStartIndex,
  showDirectInput = false,
}: WaypointSelectFormProps) {
  return (
    <>
      <Select
        value={value ?? ""}
        onChange={(e) => {
          const val = e.target.value === "" ? null : parseInt(e.target.value);
          onChange(val);
        }}
        className="h-8 text-[11px] mb-2"
      >
        <option value="">-- Select Waypoint --</option>
        {rootNodeIds.map((id, idx) => {
          const n = nodes[id];
          if (n && n.type === "manual") {
            return (
              <option key={id} value={idx}>
                Waypoint {idx + indexStartIndex}
              </option>
            );
          }
          return null;
        })}
      </Select>
      {showDirectInput && (
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-text-muted shrink-0">Index:</label>
          <Input
            type="number"
            min={indexStartIndex}
            max={rootNodeIds.length - 1 + indexStartIndex}
            value={value !== null ? value + indexStartIndex : ""}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val)) {
                const idx = val - indexStartIndex;
                if (idx >= 0 && idx < rootNodeIds.length) {
                  onChange(idx);
                }
              } else {
                onChange(null);
              }
            }}
            className="h-7 text-[11px]"
            placeholder="Direct Input"
          />
        </div>
      )}
    </>
  );
}
