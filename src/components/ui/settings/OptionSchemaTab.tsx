import { Plus, Save, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAppStore } from "../../../stores/appStore";
import { OptionDef } from "../../../types/store";

export function OptionSchemaTab() {
  const globalOptionsSchema = useAppStore((state) => state.optionsSchema);
  const setGlobalOptionsSchema = useAppStore((state) => state.setOptionsSchema);
  const lastDirectory = useAppStore((state) => state.lastDirectory);

  const [localOptions, setLocalOptions] = useState<OptionDef[]>([]);

  useEffect(() => {
    setLocalOptions(globalOptionsSchema?.options || []);
  }, [globalOptionsSchema]);

  const isDefaultValid = (opt: OptionDef) => {
    if (opt.default === undefined || opt.default === "") return true;
    if (opt.type === "integer")
      return (
        !isNaN(Number(opt.default)) && Number.isInteger(Number(opt.default))
      );
    if (opt.type === "float") return !isNaN(Number(opt.default));
    if (opt.type === "boolean") {
      const str = String(opt.default).toLowerCase();
      return str === "true" || str === "false";
    }
    return true;
  };

  const handleSaveOptions = () => {
    const hasEmptyName = localOptions.some((opt) => opt.name.trim() === "");
    const names = localOptions.map((opt) => opt.name);
    const hasDuplicates = new Set(names).size !== names.length;
    const hasInvalidDefaults = localOptions.some((opt) => !isDefaultValid(opt));

    if (hasEmptyName) {
      alert("Key Name cannot be empty.");
      return;
    }
    if (hasDuplicates) {
      alert("Key Names must be unique. Duplicate keys found.");
      return;
    }
    if (hasInvalidDefaults) {
      alert("Invalid default values detected. Please match the selected type.");
      return;
    }

    const parsedOptions = localOptions.map((opt) => {
      let parsedDefault = opt.default;
      if (opt.default === "") parsedDefault = undefined;
      else if (opt.type === "integer")
        parsedDefault = parseInt(String(opt.default), 10);
      else if (opt.type === "float")
        parsedDefault = parseFloat(String(opt.default));
      else if (opt.type === "boolean")
        parsedDefault = String(opt.default).toLowerCase() === "true";
      return { ...opt, default: parsedDefault };
    });

    setGlobalOptionsSchema({ options: parsedOptions });
    alert("Schema applied successfully.");
  };

  const handleAddOption = () => {
    const baseName = "new_option";
    let newName = baseName;
    let counter = 1;
    while (localOptions.some((opt) => opt.name === newName)) {
      newName = `${baseName}_${counter}`;
      counter++;
    }
    setLocalOptions([
      ...localOptions,
      { name: newName, label: "New Option", type: "string", default: "" },
    ]);
  };

  const handleUpdateOption = (index: number, updates: Partial<OptionDef>) => {
    const newOptions = [...localOptions];
    newOptions[index] = { ...newOptions[index], ...updates };
    setLocalOptions(newOptions);
  };

  const handleRemoveOption = (index: number) => {
    setLocalOptions(localOptions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-md font-bold text-slate-200">
            Waypoint Options Schema
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Define custom properties that can be attached to waypoints.
          </p>
        </div>
        <div className="space-x-2">
          <button
            onClick={async () => {
              try {
                const { DialogAPI, BackendAPI } = await import("../../../api");
                const selectedPath = await DialogAPI.open({
                  multiple: false,
                  defaultPath: lastDirectory || undefined,
                  filters: [
                    {
                      name: "Options Schema YAML",
                      extensions: ["yaml", "yml"],
                    },
                  ],
                });
                if (selectedPath) {
                  const pathStr =
                    typeof selectedPath === "string"
                      ? selectedPath
                      : (selectedPath as any).path;
                  if (!pathStr) return;

                  const lastSlash = Math.max(
                    pathStr.lastIndexOf("/"),
                    pathStr.lastIndexOf("\\"),
                  );
                  const dir =
                    lastSlash > -1 ? pathStr.substring(0, lastSlash) : pathStr;
                  useAppStore.getState().setLastDirectory(dir);

                  const schema = await BackendAPI.loadOptionsSchema(pathStr);
                  setGlobalOptionsSchema(schema);
                  // localOptions will be updated by useEffect
                }
              } catch (err) {
                console.error("Failed to load options schema:", err);
                alert(
                  `オプションスキーマの読み込みに失敗しました。\nエラー詳細: ${String(err)}`,
                );
              }
            }}
            className="ui-btn ui-btn-secondary ui-btn-sm"
          >
            <Plus size={14} /> Load from File
          </button>
          <button
            onClick={handleAddOption}
            className="ui-btn ui-btn-secondary ui-btn-sm"
          >
            <Plus size={14} /> Add Field
          </button>
          <button
            onClick={handleSaveOptions}
            className="ui-btn ui-btn-primary ui-btn-sm"
          >
            <Save size={14} /> Apply Schema
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {localOptions.map((opt, i) => (
          <div
            key={i}
            className="flex gap-2 items-start bg-slate-900 p-3 rounded-lg border border-slate-700/50"
          >
            <div className="flex-1 space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-slate-400">
                    Key Name
                  </label>
                  <input
                    type="text"
                    value={opt.name}
                    onChange={(e) => {
                      const sanitized = e.target.value
                        .replace(/[^a-zA-Z0-9_]/g, "")
                        .toLowerCase();
                      handleUpdateOption(i, { name: sanitized });
                    }}
                    className={`w-full bg-slate-800 border rounded px-2 py-1 text-sm text-slate-200 outline-none ${
                      localOptions.filter((o) => o.name === opt.name).length >
                        1 || opt.name.trim() === ""
                        ? "border-red-500 focus:border-red-500"
                        : "border-slate-600 focus:border-primary"
                    }`}
                    placeholder="e.g. velocity"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-slate-400">
                    Display Label
                  </label>
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) =>
                      handleUpdateOption(i, { label: e.target.value })
                    }
                    className="ui-input"
                    placeholder="e.g. Target Speed"
                  />
                </div>
                <div className="w-32 space-y-1">
                  <label className="text-xs font-medium text-slate-400">
                    Type
                  </label>
                  <select
                    value={opt.type}
                    onChange={(e) =>
                      handleUpdateOption(i, { type: e.target.value })
                    }
                    className="ui-select"
                  >
                    <option value="string">String</option>
                    <option value="float">Float</option>
                    <option value="integer">Integer</option>
                    <option value="boolean">Boolean</option>
                    <option value="list">List (Array)</option>
                  </select>
                </div>
                <div className="w-32 space-y-1">
                  <label className="text-xs font-medium text-slate-400">
                    Default Value
                  </label>
                  <input
                    type="text"
                    value={
                      opt.default !== undefined
                        ? Array.isArray(opt.default)
                          ? opt.default.join(", ")
                          : String(opt.default)
                        : ""
                    }
                    onChange={(e) => {
                      if (opt.type === "list") {
                        const rawArr = e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter((s) => s.length > 0);
                        let parsedArr: any[] = rawArr;
                        if (opt.item_type === "float") {
                          parsedArr = rawArr
                            .map((s) => parseFloat(s))
                            .filter((n) => !isNaN(n));
                        } else if (opt.item_type === "integer") {
                          parsedArr = rawArr
                            .map((s) => parseInt(s, 10))
                            .filter((n) => !isNaN(n));
                        } else if (opt.item_type === "boolean") {
                          parsedArr = rawArr.map(
                            (s) => s === "true" || s === "1",
                          );
                        }
                        handleUpdateOption(i, { default: parsedArr });
                      } else {
                        handleUpdateOption(i, {
                          default: e.target.value,
                        });
                      }
                    }}
                    className={`w-full rounded px-2 py-1 text-sm text-slate-200 outline-none ${
                      isDefaultValid(opt)
                        ? "border-slate-600 focus:border-primary"
                        : "border-red-500 focus:border-red-500"
                    } bg-slate-800 border`}
                    placeholder={
                      opt.type === "list"
                        ? "csv"
                        : opt.type === "boolean"
                          ? "true/false"
                          : "0"
                    }
                  />
                </div>
              </div>
              {opt.type === "list" && (
                <div className="flex gap-2 mt-2">
                  <div className="w-48 space-y-1">
                    <label className="text-xs font-medium text-slate-400">
                      List Item Type
                    </label>
                    <select
                      value={opt.item_type || "string"}
                      onChange={(e) =>
                        handleUpdateOption(i, {
                          item_type: e.target.value,
                        })
                      }
                      className="ui-select"
                    >
                      <option value="string">String</option>
                      <option value="float">Float</option>
                      <option value="integer">Integer</option>
                      <option value="boolean">Boolean</option>
                    </select>
                  </div>
                </div>
              )}
              {opt.type === "string" && (
                <div className="flex gap-2 mt-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-slate-400">
                      Dropdown Enums (csv, optional)
                    </label>
                    <input
                      type="text"
                      value={
                        opt.enum_values ? opt.enum_values.join(", ") : ""
                      }
                      onChange={(e) =>
                        handleUpdateOption(i, {
                          enum_values: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0),
                        })
                      }
                      className="ui-input"
                      placeholder="e.g. none, docking"
                    />
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => handleRemoveOption(i)}
              className="p-1.5 mt-5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {localOptions.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm bg-slate-900 rounded-lg border border-dashed border-slate-700">
            No custom options defined. Click "Add Field" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
