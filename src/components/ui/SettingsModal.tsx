import { X, Plus, Trash2, Save, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { OptionDef } from "../../types/store";
import { v4 as uuidv4 } from "uuid";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const defaultMapOpacity = useAppStore((state) => state.defaultMapOpacity);
  // Note: We use the Zustand store directly to modify defaultMapOpacity for simplicity without adding a dedicated action, or we can use set
  const setDefaultMapOpacity = (opacity: number) =>
    useAppStore.setState({ defaultMapOpacity: opacity, isDirty: true });
  const lastDirectory = useAppStore((state) => state.lastDirectory);

  const globalOptionsSchema = useAppStore((state) => state.optionsSchema);
  const setGlobalOptionsSchema = useAppStore((state) => state.setOptionsSchema);
  const globalExportTemplates = useAppStore((state) => state.exportTemplates);
  const indexStartIndex = useAppStore((state) => state.indexStartIndex);
  const toolPanelMaxColumns = useAppStore((state) => state.toolPanelMaxColumns);
  const decimalPrecision = useAppStore((state) => state.decimalPrecision);
  const globalPythonPath = useAppStore((state) => state.globalPythonPath);
  const setIndexStartIndex = useAppStore((state) => state.setIndexStartIndex);
  const setToolPanelMaxColumns = useAppStore(
    (state) => state.setToolPanelMaxColumns,
  );
  const setGlobalPythonPath = useAppStore((state) => state.setGlobalPythonPath);

  const addExportTemplate = useAppStore((state) => state.addExportTemplate);
  const updateExportTemplate = useAppStore(
    (state) => state.updateExportTemplate,
  );
  const removeExportTemplate = useAppStore(
    (state) => state.removeExportTemplate,
  );
  const defaultExportFormats = useAppStore(
    (state) => state.defaultExportFormats,
  );
  const updateDefaultExportFormat = useAppStore(
    (state) => state.updateDefaultExportFormat,
  );

  type TabType = "general" | "options" | "export" | "plugins";
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const plugins = useAppStore((state) => state.plugins);
  const pluginSettings = useAppStore((state) => state.pluginSettings);
  const setPluginSettings = useAppStore((state) => state.setPluginSettings);
  const setPlugins = useAppStore((state) => state.setPlugins);
  const [localOptions, setLocalOptions] = useState<OptionDef[]>([]);

  const [pythonEnvs, setPythonEnvs] = useState<string[]>([]);
  const [bundledSdkVersion, setBundledSdkVersion] = useState<string | null>(
    null,
  );

  // Sync when opened
  useEffect(() => {
    if (isOpen) {
      setLocalOptions(globalOptionsSchema?.options || []);
      import("../../api/backend").then(({ BackendAPI }) => {
        BackendAPI.getPythonEnvironments()
          .then((envs) => setPythonEnvs(envs))
          .catch(console.error);
        BackendAPI.checkSdkVersion()
          .then((v) => setBundledSdkVersion(v))
          .catch(() => setBundledSdkVersion(null));
      });
    }
  }, [isOpen, globalOptionsSchema]);

  if (!isOpen) return null;

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
    return true; // string/list are generally freeform in this basic level
  };

  const handleSaveOptions = () => {
    // Validation
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

    // Parse correct types before saving to prevent string storage for numbers
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

  const insertTemplateVar = (templateId: string, text: string) => {
    const el = document.getElementById(
      `template-${templateId}`,
    ) as HTMLTextAreaElement;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const template = globalExportTemplates.find((t) => t.id === templateId);
      if (template) {
        const newContent =
          template.content.substring(0, start) +
          text +
          template.content.substring(end);
        updateExportTemplate(templateId, { content: newContent });
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + text.length, start + text.length);
        }, 10);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        <datalist id="python-envs">
          {pythonEnvs.map((env, i) => (
            <option key={i} value={env} />
          ))}
        </datalist>

        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/80 shrink-0">
          <h2 className="text-lg font-bold text-slate-200">User Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Tabs Sidebar */}
          <div className="w-48 bg-slate-900 border-r border-slate-700 p-2 shrink-0">
            <button
              onClick={() => setActiveTab("general")}
              className={`w-full text-left ui-tab ${activeTab === "general" ? "ui-tab-active" : "ui-tab-inactive"}`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab("options")}
              className={`mt-1 w-full text-left ui-tab ${activeTab === "options" ? "ui-tab-active" : "ui-tab-inactive"}`}
            >
              Option Schema
            </button>
            <button
              onClick={() => setActiveTab("export")}
              className={`mt-1 w-full text-left ui-tab ${activeTab === "export" ? "ui-tab-active" : "ui-tab-inactive"}`}
            >
              Export Templates
            </button>
            <button
              onClick={() => setActiveTab("plugins")}
              className={`mt-1 w-full text-left ui-tab ${activeTab === "plugins" ? "ui-tab-active" : "ui-tab-inactive"}`}
            >
              Plugins
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "general" && (
              <div className="space-y-6 max-w-lg">
                <div className="space-y-2">
                  <label className="flex justify-between text-sm font-medium text-slate-300">
                    <span>Default Map Opacity</span>
                    <span>{Math.round(defaultMapOpacity * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={defaultMapOpacity}
                    onChange={(e) =>
                      setDefaultMapOpacity(parseFloat(e.target.value))
                    }
                    className="ui-range"
                  />
                  <p className="text-xs text-slate-500">
                    The default transparency applied to newly loaded map layers.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Last Used Directory
                  </label>
                  <div className="p-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-400 font-mono break-all line-clamp-2">
                    {lastDirectory || "None"}
                  </div>
                  <p className="text-xs text-slate-500">
                    Remembered location for Save/Open dialogs across sessions.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Waypoint Index Start
                  </label>
                  <select
                    value={indexStartIndex}
                    onChange={(e) =>
                      setIndexStartIndex(parseInt(e.target.value) as 0 | 1)
                    }
                    className="ui-select"
                  >
                    <option value={0}>0 (0-indexed)</option>
                    <option value={1}>1 (1-indexed)</option>
                  </select>
                  <p className="text-xs text-slate-500">
                    Determines the starting index count for Waypoints across the
                    Canvas and Exports.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="flex justify-between text-sm font-medium text-slate-300">
                    <span>Decimal Precision</span>
                    <span>{decimalPrecision}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="12"
                    step="1"
                    value={decimalPrecision}
                    onChange={(e) =>
                      useAppStore.setState({
                        decimalPrecision: parseInt(e.target.value),
                        isDirty: true,
                      })
                    }
                    className="ui-range"
                  />
                  <p className="text-xs text-slate-500">
                    Number of decimal places shown in numeric input fields
                    (Inspector, Properties).
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="flex justify-between text-sm font-medium text-slate-300">
                    <span>Toolbar Max Columns</span>
                    <span>{toolPanelMaxColumns}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={toolPanelMaxColumns}
                    onChange={(e) =>
                      setToolPanelMaxColumns(parseInt(e.target.value))
                    }
                    className="ui-range"
                  />
                  <p className="text-xs text-slate-500">
                    Maximum column wrapping allowed on the Main Tool Panel
                    before overflowing.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">
                    Global Python Interpreter Path
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      list="python-envs"
                      value={globalPythonPath}
                      onChange={(e) => setGlobalPythonPath(e.target.value)}
                      className="ui-input"
                      placeholder="e.g. python, python3, /usr/bin/python3.10"
                    />
                    <button
                      onClick={async () => {
                        const { open } =
                          await import("@tauri-apps/plugin-dialog");
                        const selectedPath = await open({
                          multiple: false,
                          directory: false,
                        });
                        if (selectedPath) {
                          setGlobalPythonPath(
                            typeof selectedPath === "string"
                              ? selectedPath
                              : (selectedPath as any).path,
                          );
                        }
                      }}
                      className="ui-btn ui-btn-secondary ui-btn-md"
                    >
                      Browse
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    The default command or path used to execute Python plugins
                    (e.g. `python`, `python3` or absolute path to a virtual
                    environment).
                  </p>
                </div>
              </div>
            )}

            {activeTab === "options" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-md font-bold text-slate-200">
                      Waypoint Options Schema
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Define custom properties that can be attached to
                      waypoints.
                    </p>
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={async () => {
                        try {
                          const { open } =
                            await import("@tauri-apps/plugin-dialog");
                          const { BackendAPI } =
                            await import("../../api/backend");
                          const selectedPath = await open({
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

                            // Basic generic extraction of directory path
                            const lastSlash = Math.max(
                              pathStr.lastIndexOf("/"),
                              pathStr.lastIndexOf("\\"),
                            );
                            const dir =
                              lastSlash > -1
                                ? pathStr.substring(0, lastSlash)
                                : pathStr;
                            useAppStore.getState().setLastDirectory(dir);

                            const schema =
                              await BackendAPI.loadOptionsSchema(pathStr);
                            setGlobalOptionsSchema(schema);
                            setLocalOptions(schema.options || []);
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
                                localOptions.filter((o) => o.name === opt.name)
                                  .length > 1 || opt.name.trim() === ""
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
                                  opt.enum_values
                                    ? opt.enum_values.join(", ")
                                    : ""
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
                      No custom options defined. Click "Add Field" to create
                      one.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "export" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-md font-bold text-slate-200">
                      Custom Export Templates
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Define Handlebars templates for custom waypoint export
                      formats.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      addExportTemplate({
                        id: uuidv4(),
                        name: "New Template",
                        extension: "txt",
                        suffix: "",
                        content:
                          "{{#each waypoints}}\nwp_{{index}}:\n  x: {{x}}\n  y: {{y}}\n  yaw: {{yaw}}\n{{/each}}",
                      })
                    }
                    className="ui-btn ui-btn-secondary ui-btn-sm"
                  >
                    <Plus size={14} /> New Template
                  </button>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-slate-200 text-sm border-b border-slate-700 pb-1">
                    Default Formats
                  </h4>
                  {defaultExportFormats.map((format) => (
                    <div
                      key={format.id}
                      className="bg-slate-900 rounded-lg border border-slate-700/50 flex items-center justify-between p-3"
                    >
                      <div className="flex items-center gap-3 w-1/2">
                        <span className="text-sm font-bold text-slate-200">
                          {format.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 w-1/2 justify-end">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-medium">
                            Auto-Suffix :
                          </span>
                          <input
                            type="text"
                            value={format.suffix}
                            onChange={(e) =>
                              updateDefaultExportFormat(format.id, {
                                suffix: e.target.value,
                              } as Partial<
                                import("../../types/store").DefaultExportFormat
                              >)
                            }
                            className="ui-input w-24"
                            placeholder="_yaml"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-medium">
                            Ext :
                          </span>
                          <span className="w-16 text-slate-300 text-sm">
                            .{format.extension}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900 border border-slate-700/50 p-3 rounded-lg text-xs text-slate-300 mt-6 mt-4">
                  <h4 className="font-bold text-slate-200 mb-1">
                    Handlebars Iteration Syntax
                  </h4>
                  <p>
                    Wrap your logic inside{" "}
                    <code className="bg-slate-800 text-primary px-1 rounded">
                      {"{{#each waypoints}}"} ... {"{{/each}}"}
                    </code>{" "}
                    to render all elements.
                  </p>
                </div>

                <div className="space-y-4">
                  {globalExportTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="bg-slate-900 rounded-lg border border-slate-700/50 flex flex-col overflow-hidden"
                    >
                      <div className="flex items-center gap-3 p-3 border-b border-slate-800 bg-slate-800/30">
                        <input
                          type="text"
                          value={template.name}
                          onChange={(e) =>
                            updateExportTemplate(template.id, {
                              name: e.target.value,
                            } as Partial<
                              import("../../types/store").ExportTemplate
                            >)
                          }
                          className="ui-input"
                          placeholder="Template Name"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-medium">
                            Auto-Suffix:
                          </span>
                          <input
                            type="text"
                            value={template.suffix || ""}
                            onChange={(e) =>
                              updateExportTemplate(template.id, {
                                suffix: e.target.value,
                              } as Partial<
                                import("../../types/store").ExportTemplate
                              >)
                            }
                            className="ui-input w-24"
                            placeholder="_custom"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-medium">
                            Ext:
                          </span>
                          <input
                            type="text"
                            value={template.extension}
                            onChange={(e) =>
                              updateExportTemplate(template.id, {
                                extension: e.target.value,
                              } as Partial<
                                import("../../types/store").ExportTemplate
                              >)
                            }
                            className="ui-input w-16"
                            placeholder="yaml"
                          />
                        </div>
                        <button
                          onClick={() => removeExportTemplate(template.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors ml-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="p-3">
                        <textarea
                          id={`template-${template.id}`}
                          value={template.content}
                          onChange={(e) =>
                            updateExportTemplate(template.id, {
                              content: e.target.value,
                            })
                          }
                          className="ui-textarea h-40 bg-slate-950 border-slate-800 p-3 text-xs font-mono text-slate-300 focus:border-primary/50"
                          placeholder="{{#each waypoints}}..."
                          spellCheck="false"
                        />
                        <div className="mt-2 flex flex-wrap gap-1 items-center">
                          <span className="text-xs font-bold text-slate-500 mr-2">
                            Core:
                          </span>
                          {[
                            "{{index}}",
                            "{{id}}",
                            "{{type}}",
                            "{{x}}",
                            "{{y}}",
                            "{{z}}",
                            "{{yaw}}",
                            "{{qx}}",
                            "{{qy}}",
                            "{{qz}}",
                            "{{qw}}",
                          ].map((v) => (
                            <button
                              key={v}
                              onClick={() => insertTemplateVar(template.id, v)}
                              className="bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono text-blue-300 border border-slate-700 transition-colors"
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                        {globalOptionsSchema?.options &&
                          globalOptionsSchema.options.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1 items-center">
                              <span className="text-xs font-bold text-slate-500 mr-2">
                                Options ({globalOptionsSchema.options.length}):
                              </span>
                              {globalOptionsSchema.options.map((o) => (
                                <button
                                  key={o.name}
                                  onClick={() =>
                                    insertTemplateVar(
                                      template.id,
                                      `{{options.${o.name}}}`,
                                    )
                                  }
                                  className="bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono text-purple-300 border border-slate-700 transition-colors"
                                >
                                  {`{{options.${o.name}}}`}
                                </button>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                  {globalExportTemplates.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-sm bg-slate-900 rounded-lg border border-dashed border-slate-700">
                      No custom templates defined.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "plugins" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-md font-bold text-slate-200">
                      Installed Plugins
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Manage Generator plugins order and visibility on the Tool
                      Panel.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const { open } =
                          await import("@tauri-apps/plugin-dialog");
                        const { BackendAPI } =
                          await import("../../api/backend");
                        const selectedPath = await open({
                          multiple: false,
                          directory: true,
                          defaultPath: lastDirectory || undefined,
                        });
                        if (selectedPath) {
                          const pathStr =
                            typeof selectedPath === "string"
                              ? selectedPath
                              : (selectedPath as any).path;
                          if (!pathStr) return;

                          // Load it via backend
                          const customPlugin =
                            await BackendAPI.scanCustomPlugin(pathStr);

                          // Store memory
                          const newMap = {
                            ...plugins,
                            [customPlugin.id]: customPlugin,
                          };
                          setPlugins(newMap);

                          // Store settings
                          if (
                            !pluginSettings.find(
                              (s) => s.id === customPlugin.id,
                            )
                          ) {
                            setPluginSettings([
                              ...pluginSettings,
                              {
                                id: customPlugin.id,
                                path: pathStr,
                                enabled: true,
                                order: pluginSettings.length,
                                isBuiltin: false,
                              },
                            ]);
                          }
                        }
                      } catch (err) {
                        console.error("Failed to load custom plugin:", err);
                        alert(
                          `Custom Plugin の読み込みに失敗しました。\nエラー詳細: ${String(err)}`,
                        );
                      }
                    }}
                    className="ui-btn ui-btn-secondary ui-btn-sm"
                  >
                    <Plus size={14} /> Add Custom Folder
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const { open } =
                          await import("@tauri-apps/plugin-dialog");
                        const { BackendAPI } =
                          await import("../../api/backend");
                        // Step 1: Select parent directory via explorer dialog
                        const selectedPath = await open({
                          multiple: false,
                          directory: true,
                          defaultPath: lastDirectory || undefined,
                          title: "プラグインを作成する親ディレクトリを選択",
                        });
                        if (!selectedPath) return;
                        const targetDir =
                          typeof selectedPath === "string"
                            ? selectedPath
                            : (selectedPath as any).path;
                        if (!targetDir) return;

                        // Step 2: Prompt for plugin name
                        const pluginName = prompt(
                          `プラグイン名を入力してください:\n(作成先: ${targetDir})`,
                        );
                        if (!pluginName || !pluginName.trim()) return;

                        const newPlugin = await BackendAPI.scaffoldPlugin(
                          pluginName.trim(),
                          targetDir,
                        );
                        const newMap = {
                          ...plugins,
                          [newPlugin.id]: newPlugin,
                        };
                        setPlugins(newMap);
                        if (
                          !pluginSettings.find((s) => s.id === newPlugin.id)
                        ) {
                          setPluginSettings([
                            ...pluginSettings,
                            {
                              id: newPlugin.id,
                              path: newPlugin.folder_path,
                              enabled: true,
                              order: pluginSettings.length,
                              isBuiltin: false,
                            },
                          ]);
                        }
                        alert(
                          `Plugin '${pluginName}' を作成しました:\n${newPlugin.folder_path}`,
                        );
                      } catch (err) {
                        console.error("Failed to scaffold plugin:", err);
                        alert(
                          `プラグイン雛形の生成に失敗しました。\nエラー詳細: ${String(err)}`,
                        );
                      }
                    }}
                    className="ui-btn ui-btn-primary ui-btn-sm"
                  >
                    <Plus size={14} /> Create New Plugin
                  </button>
                </div>

                <div className="space-y-3">
                  {pluginSettings.length === 0 ? (
                    <div className="text-sm text-slate-500 italic p-4 bg-slate-900 rounded-lg text-center">
                      No plugins mapped via settings.
                    </div>
                  ) : (
                    [...pluginSettings]
                      .sort((a, b) => a.order - b.order)
                      .map((setting, index) => {
                        const plugin = plugins[setting.id];
                        return (
                          <div
                            key={setting.id}
                            className="bg-slate-900 border border-slate-700/50 p-3 rounded-lg flex flex-col gap-2"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                {/* Toggle Switch */}
                                <button
                                  onClick={() => {
                                    const newSettings = pluginSettings.map(
                                      (s) =>
                                        s.id === setting.id
                                          ? { ...s, enabled: !s.enabled }
                                          : s,
                                    );
                                    setPluginSettings(newSettings);
                                  }}
                                  className={`h-5 w-10 rounded-full border border-slate-600 relative transition-colors ${setting.enabled ? "bg-primary" : "bg-slate-700"}`}
                                >
                                  <div
                                    className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${setting.enabled ? "left-6" : "translate-x-1"}`}
                                  />
                                </button>
                                <div>
                                  <span className="font-bold text-slate-200">
                                    {plugin
                                      ? plugin.manifest.name
                                      : "Unknown Plugin"}
                                  </span>
                                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wide">
                                    {plugin ? plugin.manifest.type : "LOST"}{" "}
                                    {setting.isBuiltin ? "" : "(Custom)"}
                                  </span>
                                </div>
                              </div>

                              <div className="flex gap-1 items-center">
                                {/* Ordering arrows */}
                                <button
                                  disabled={index === 0}
                                  onClick={() => {
                                    let updated = [...pluginSettings];
                                    const idx = updated.findIndex(
                                      (u) => u.id === setting.id,
                                    );
                                    if (idx > 0) {
                                      const swapIdx = idx - 1;
                                      const temp = updated[idx].order;
                                      updated[idx].order =
                                        updated[swapIdx].order;
                                      updated[swapIdx].order = temp;
                                      updated.sort((a, b) => a.order - b.order);
                                      setPluginSettings(updated);
                                    }
                                  }}
                                  className="ui-icon-btn h-6 w-6 rounded p-1 disabled:opacity-30 disabled:hover:text-slate-500"
                                >
                                  ▲
                                </button>
                                <button
                                  disabled={index === pluginSettings.length - 1}
                                  onClick={() => {
                                    let updated = [...pluginSettings];
                                    const idx = updated.findIndex(
                                      (u) => u.id === setting.id,
                                    );
                                    if (idx < updated.length - 1) {
                                      const swapIdx = idx + 1;
                                      const temp = updated[idx].order;
                                      updated[idx].order =
                                        updated[swapIdx].order;
                                      updated[swapIdx].order = temp;
                                      updated.sort((a, b) => a.order - b.order);
                                      setPluginSettings(updated);
                                    }
                                  }}
                                  className="ui-icon-btn h-6 w-6 rounded p-1 disabled:opacity-30 disabled:hover:text-slate-500"
                                >
                                  ▼
                                </button>

                                {/* Remove Button — show for custom and orphaned entries */}
                                {(!setting.isBuiltin || !plugin) && (
                                  <button
                                    onClick={() => {
                                      const newSettings = pluginSettings.filter(
                                        (s) => s.id !== setting.id,
                                      );
                                      setPluginSettings(newSettings);
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors ml-2"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                            {plugin && (
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-slate-400 font-mono break-all flex-1">
                                  {plugin.folder_path}
                                </p>
                                {/* SDK Version Badge */}
                                {plugin.manifest.type === "python" && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    {plugin.is_builtin ? (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/50 text-blue-400 border border-blue-800">
                                        SDK{" "}
                                        {bundledSdkVersion
                                          ? `v${bundledSdkVersion}`
                                          : "Bundled"}
                                      </span>
                                    ) : plugin.sdk_version ? (
                                      plugin.sdk_version ===
                                      bundledSdkVersion ? (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-900/50 text-green-400 border border-green-800">
                                          SDK ✅ v{plugin.sdk_version}
                                        </span>
                                      ) : (
                                        <>
                                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-900/50 text-yellow-400 border border-yellow-800">
                                            SDK ⚠️ v{plugin.sdk_version}
                                          </span>
                                          <button
                                            onClick={async () => {
                                              try {
                                                const { BackendAPI } =
                                                  await import("../../api/backend");
                                                const newVersion =
                                                  await BackendAPI.updatePluginSdk(
                                                    plugin.folder_path,
                                                  );
                                                const refreshed =
                                                  await BackendAPI.fetchInstalledPlugins();
                                                const newMap: Record<
                                                  string,
                                                  any
                                                > = {};
                                                refreshed.forEach((p: any) => {
                                                  newMap[p.id] = p;
                                                });
                                                pluginSettings
                                                  .filter((s) => !s.isBuiltin)
                                                  .forEach((s) => {
                                                    if (
                                                      !newMap[s.id] &&
                                                      plugins[s.id]
                                                    )
                                                      newMap[s.id] =
                                                        plugins[s.id];
                                                  });
                                                setPlugins(newMap);
                                                alert(
                                                  `SDK を v${newVersion} に更新しました。`,
                                                );
                                              } catch (err) {
                                                alert(
                                                  `SDK 更新に失敗しました: ${String(err)}`,
                                                );
                                              }
                                            }}
                                            className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-700 hover:bg-yellow-600 text-white transition-colors flex items-center gap-0.5"
                                          >
                                            <RefreshCw size={10} /> Update
                                          </button>
                                        </>
                                      )
                                    ) : (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-900/50 text-red-400 border border-red-800">
                                        SDK ❌
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            {!plugin && (
                              <p className="text-xs text-red-400 font-mono break-all mt-1">
                                WARNING: Memory target missing! Was path{" "}
                                {setting.path} moved?
                              </p>
                            )}
                            {plugin && plugin.manifest.type === "python" && (
                              <div className="mt-2 pt-2 border-t border-slate-800 flex gap-2 items-center">
                                <span className="text-xs font-medium text-slate-500 w-32 shrink-0">
                                  Python Interpreter:
                                </span>
                                <input
                                  type="text"
                                  list="python-envs"
                                  value={setting.pythonOverridePath || ""}
                                  onChange={(e) => {
                                    const newSettings = pluginSettings.map(
                                      (s) =>
                                        s.id === setting.id
                                          ? {
                                              ...s,
                                              pythonOverridePath:
                                                e.target.value,
                                            }
                                          : s,
                                    );
                                    setPluginSettings(newSettings);
                                  }}
                                  className="ui-input-sm flex-1"
                                  placeholder={`Global: ${globalPythonPath}`}
                                />
                                <button
                                  onClick={async () => {
                                    const { open } =
                                      await import("@tauri-apps/plugin-dialog");
                                    const selectedPath = await open({
                                      multiple: false,
                                      directory: false,
                                    });
                                    if (selectedPath) {
                                      const pathStr =
                                        typeof selectedPath === "string"
                                          ? selectedPath
                                          : (selectedPath as any).path;
                                      const newSettings = pluginSettings.map(
                                        (s) =>
                                          s.id === setting.id
                                            ? {
                                                ...s,
                                                pythonOverridePath: pathStr,
                                              }
                                            : s,
                                      );
                                      setPluginSettings(newSettings);
                                    }
                                  }}
                                  className="ui-btn ui-btn-secondary ui-btn-sm"
                                >
                                  Browse
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
