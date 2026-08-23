import React from "react";
import { Label } from "./common/Label";
import { Checkbox } from "./common/Checkbox";
import { Input } from "./common/Input";
import { Select } from "./common/Select";

export interface PluginPropertyOption {
  value: string;
  label?: string;
}

export interface PluginProperty {
  name: string;
  label?: string;
  type: string;
  default?: any;
  options?: Array<string | PluginPropertyOption>;
  enum_values?: Array<string | PluginPropertyOption>;
  description?: string;
}

interface PluginPropertyEditorProps {
  property: PluginProperty;
  value: any;
  onChange: (value: any) => void;
  className?: string;
}

export const PluginPropertyEditor: React.FC<PluginPropertyEditorProps> = ({
  property,
  value,
  onChange,
  className = "",
}) => {
  const key = property.name;
  const label = property.label || key;
  const selectOptions = property.options || property.enum_values;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs font-semibold text-text-muted">{label}</Label>

      {property.type === "boolean" ? (
        <Label className="flex items-center gap-3 mt-1 bg-surface-panel/50 p-2 rounded-md border border-border-base/50 cursor-pointer hover:bg-surface-hover transition-colors">
          <Checkbox
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="text-xs text-text-muted font-medium">Enabled</span>
        </Label>
      ) : property.type === "color" ? (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value || property.default || "#22c55e"}
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-8 rounded-lg border border-border-base/50 cursor-pointer bg-surface-base p-0.5 shrink-0"
          />
          <Input
            type="text"
            value={value || property.default || "#22c55e"}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-xs font-mono flex-1 uppercase"
            placeholder="#22c55e"
          />
        </div>
      ) : property.type === "integer" || property.type === "float" ? (
        <Input
          type="number"
          step={property.type === "float" ? "any" : "1"}
          value={value ?? ""}
          onChange={(e) => {
            const val =
              property.type === "float"
                ? parseFloat(e.target.value)
                : parseInt(e.target.value, 10);
            onChange(isNaN(val) ? "" : val);
          }}
          className="h-8 text-xs"
          placeholder={String(property.default ?? "")}
        />
      ) : Array.isArray(selectOptions) && selectOptions.length > 0 ? (
        <Select
          value={value ?? property.default ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs"
        >
          {selectOptions.map((opt) => {
            const optVal = typeof opt === "string" ? opt : opt.value;
            const optLabel = typeof opt === "string" ? opt : (opt.label || opt.value);
            return (
              <option key={optVal} value={optVal}>
                {optLabel}
              </option>
            );
          })}
        </Select>
      ) : (
        <Input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs"
          placeholder={String(property.default ?? "")}
        />
      )}
      {property.description && (
        <p className="text-[10px] text-text-muted/60 leading-tight mt-1 px-1">
          {property.description}
        </p>
      )}
    </div>
  );
};
