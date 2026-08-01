import { Plus, Save, Trash2, Upload, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { useAppStore } from "../../../stores/appStore";
import { OptionDef, OptionsSchema } from "../../../types/store";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { Select } from "../common/Select";
import { Label } from "../common/Label";
import { cn } from "../../../utils/cn";
import { TabSectionHeader } from "./TabSectionHeader";
import { EmptyState } from "../common/EmptyState";

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
      alert("Some options have default values that do not match their type.");
      return;
    }

    setGlobalOptionsSchema({ options: localOptions });
    useAppStore.setState({ isDirty: true });
    alert("オプションスキーマを保存しました。");
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

  const handleRemoveOption = (index: number) => {
    setLocalOptions(localOptions.filter((_, i) => i !== index));
  };

  const handleUpdateOption = (index: number, updates: Partial<OptionDef>) => {
    setLocalOptions(
      localOptions.map((opt, i) => (i === index ? { ...opt, ...updates } : opt)),
    );
  };

  const handleExportSchema = async () => {
    try {
      const { DialogAPI, BackendAPI } = await import("../../../api");
      const savePath = await DialogAPI.save({
        defaultPath: "options_schema.json",
        filters: [{ name: "Options Schema", extensions: ["json"] }],
      });
      if (!savePath) return;

      const dataToExport = {
        options: localOptions,
      };

      await BackendAPI.writeTextFile(savePath, JSON.stringify(dataToExport, null, 2));
      alert("オプションスキーマをエクスポートしました。");
    } catch (err) {
      console.error("Failed to export options schema:", err);
      alert(`エクスポートに失敗しました。\n詳細: ${String(err)}`);
    }
  };

  const handleImportSchema = async () => {
    try {
      const { DialogAPI, BackendAPI } = await import("../../../api");
      const selectedPath = await DialogAPI.open({
        multiple: false,
        defaultPath: lastDirectory || undefined,
        filters: [
          {
            name: "Options Schema",
            extensions: ["json", "yaml", "yml"],
          },
        ],
      });
      if (!selectedPath) return;

      const pathStr = typeof selectedPath === "string" ? selectedPath : (selectedPath as any).path;
      if (!pathStr) return;

      const lastSlash = Math.max(pathStr.lastIndexOf("/"), pathStr.lastIndexOf("\\"));
      const dir = lastSlash > -1 ? pathStr.substring(0, lastSlash) : pathStr;
      useAppStore.getState().setLastDirectory(dir);

      let schema: OptionsSchema;

      if (pathStr.endsWith(".yaml") || pathStr.endsWith(".yml")) {
        schema = await BackendAPI.loadOptionsSchema(pathStr);
      } else {
        const fileContent = await BackendAPI.readTextFile(pathStr);
        let parsed: any;
        try {
          parsed = JSON.parse(fileContent);
        } catch {
          alert("ファイルの形式が不正です（JSONではありません）。");
          return;
        }
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.options)) {
          alert("有効な Options Schema ファイルではありません。");
          return;
        }
        schema = parsed as OptionsSchema;
      }

      setLocalOptions(schema.options || []);
      alert("オプションスキーマをインポートしました。");
    } catch (err) {
      console.error("Failed to import options schema:", err);
      alert(`インポートに失敗しました。\n詳細: ${String(err)}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <TabSectionHeader
        title="Waypoint Options Schema"
        subtitle="Define custom properties that can be attached to waypoints."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleImportSchema}
            >
              <Upload size={14} className="mr-1" /> Import
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportSchema}
            >
              <Download size={14} className="mr-1" /> Export
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddOption}
            >
              <Plus size={14} className="mr-1" /> Add Field
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveOptions}
            >
              <Save size={14} className="mr-1" /> Apply
            </Button>
          </>
        }
      />

      <div className="space-y-3 px-1">
        {localOptions.map((opt, i) => (
          <div
            key={i}
            className="flex gap-3 items-start bg-surface-panel/40 p-4 rounded-xl border border-border-base/30 shadow-subtle hover:border-border-base/60 transition-all"
          >
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-3 space-y-1.5">
                  <Label className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-1">
                    Key Name
                  </Label>
                  <Input
                    type="text"
                    value={opt.name}
                    onChange={(e) => {
                      const sanitized = e.target.value
                        .replace(/[^a-zA-Z0-9_]/g, "")
                        .toLowerCase();
                      handleUpdateOption(i, { name: sanitized });
                    }}
                    className={cn(
                      "h-9 text-xs font-mono",
                      (localOptions.filter((o) => o.name === opt.name).length > 1 || opt.name.trim() === "")
                        ? "border-danger-base focus:border-danger-base ring-danger-base/20"
                        : ""
                    )}
                    placeholder="e.g. velocity"
                  />
                </div>
                <div className="col-span-3 space-y-1.5">
                  <Label className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-1">
                    Label
                  </Label>
                  <Input
                    type="text"
                    value={opt.label}
                    onChange={(e) =>
                      handleUpdateOption(i, { label: e.target.value })
                    }
                    className="h-9 text-xs"
                    placeholder="e.g. Target Speed"
                  />
                </div>
                <div className="col-span-3 space-y-1.5">
                  <Label className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-1">
                    Type
                  </Label>
                  <Select
                    value={opt.type}
                    onChange={(e) =>
                      handleUpdateOption(i, { type: e.target.value })
                    }
                    className="h-9 text-xs"
                  >
                    <option value="string">String</option>
                    <option value="float">Float</option>
                    <option value="integer">Integer</option>
                    <option value="boolean">Boolean</option>
                    <option value="list">List (Array)</option>
                  </Select>
                </div>
                <div className="col-span-3 space-y-1.5">
                  <Label className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-1">
                    Default
                  </Label>
                  <Input
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
                    className={cn(
                      "h-9 text-xs font-mono",
                      !isDefaultValid(opt) ? "border-danger-base focus:border-danger-base ring-danger-base/20" : ""
                    )}
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
                <div className="flex gap-2 mt-1">
                  <div className="w-48 space-y-1.5">
                    <Label className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-1">
                      List Item Type
                    </Label>
                    <Select
                      value={opt.item_type || "string"}
                      onChange={(e) =>
                        handleUpdateOption(i, {
                          item_type: e.target.value,
                        })
                      }
                      className="h-9 text-xs"
                    >
                      <option value="string">String</option>
                      <option value="float">Float</option>
                      <option value="integer">Integer</option>
                      <option value="boolean">Boolean</option>
                    </Select>
                  </div>
                </div>
              )}
              {opt.type === "string" && (
                <div className="flex gap-2 mt-1">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-1">
                      Dropdown Enums (csv, optional)
                    </Label>
                    <Input
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
                      className="h-9 text-xs"
                      placeholder="e.g. none, docking"
                    />
                  </div>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveOption(i)}
              className="mt-6 text-text-muted hover:text-danger-base hover:bg-danger-base/10"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        {localOptions.length === 0 && (
          <EmptyState message="No custom options defined. Click 'Add Field' to create one." />
        )}
      </div>
    </div>
  );
}
