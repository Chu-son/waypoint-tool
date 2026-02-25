import React from "react";

export interface PluginProperty {
  name: string;
  label?: string;
  type: string;
  default?: any;
  options?: string[];
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

  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-xs font-semibold text-slate-300">{label}</label>

      {property.type === "boolean" ? (
        <label className="flex items-center gap-3 mt-1 bg-slate-800/50 p-2 rounded border border-slate-700/50 cursor-pointer hover:bg-slate-800/80 transition-colors">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="ui-checkbox"
          />
          <span className="text-xs text-slate-300 font-medium">Enabled</span>
        </label>
      ) : property.type === "integer" || property.type === "float" ? (
        <input
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
          className="ui-input-sm"
          placeholder={String(property.default ?? "")}
        />
      ) : Array.isArray(property.options) && property.options.length > 0 ? (
        <select
          value={value ?? property.default ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="ui-select-sm"
        >
          {property.options.map((opt: string) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="ui-input-sm"
          placeholder={String(property.default ?? "")}
        />
      )}
      {property.description && (
        <p className="text-[10px] text-slate-500 leading-tight mt-1">
          {property.description}
        </p>
      )}
    </div>
  );
};
