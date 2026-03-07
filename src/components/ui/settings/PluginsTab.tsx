import { Plus, Trash2, RefreshCw, Sparkles, Map, PenTool, Wand2, Puzzle, Image as ImageIcon } from "lucide-react";
import { useAppStore } from "../../../stores/appStore";

interface PluginsTabProps {
  bundledSdkVersion: string | null;
  globalPythonPath: string;
}

export function PluginsTab({ bundledSdkVersion, globalPythonPath }: PluginsTabProps) {
  const plugins = useAppStore((state) => state.plugins);
  const pluginSettings = useAppStore((state) => state.pluginSettings);
  const setPluginSettings = useAppStore((state) => state.setPluginSettings);
  const setPlugins = useAppStore((state) => state.setPlugins);
  const lastDirectory = useAppStore((state) => state.lastDirectory);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-md font-bold text-slate-200">Installed Plugins</h3>
          <p className="text-xs text-slate-500 mt-1">
            Manage Generator plugins order and visibility on the Tool Panel.
          </p>
        </div>
        <button
          onClick={async () => {
            try {
              const { DialogAPI, BackendAPI } = await import("../../../api");
              const selectedPath = await DialogAPI.open({
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

                const customPlugin = await BackendAPI.scanCustomPlugin(pathStr);
                const newMap = { ...plugins, [customPlugin.id]: customPlugin };
                setPlugins(newMap);

                if (!pluginSettings.find((s) => s.id === customPlugin.id)) {
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
              const { DialogAPI, BackendAPI } = await import("../../../api");
              const selectedPath = await DialogAPI.open({
                multiple: false,
                directory: true,
                defaultPath: lastDirectory || undefined,
              });
              if (!selectedPath) return;
              const targetDir =
                typeof selectedPath === "string"
                  ? selectedPath
                  : (selectedPath as any).path;
              if (!targetDir) return;

              const pluginName = prompt(
                `プラグイン名を入力してください:\n(作成先: ${targetDir})`,
              );
              if (!pluginName || !pluginName.trim()) return;

              const newPlugin = await BackendAPI.scaffoldPlugin(
                pluginName.trim(),
                targetDir,
              );
              const newMap = { ...plugins, [newPlugin.id]: newPlugin };
              setPlugins(newMap);

              if (!pluginSettings.find((s) => s.id === newPlugin.id)) {
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
                      <button
                        onClick={() => {
                          const newSettings = pluginSettings.map((s) =>
                            s.id === setting.id ? { ...s, enabled: !s.enabled } : s,
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
                          {plugin ? plugin.manifest.name : "Unknown Plugin"}
                        </span>
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wide">
                          {plugin ? plugin.manifest.type : "LOST"}{" "}
                          {setting.isBuiltin ? "" : "(Custom)"}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-1 items-center">
                      <button
                        disabled={index === 0}
                        onClick={() => {
                          let updated = [...pluginSettings];
                          const idx = updated.findIndex((u) => u.id === setting.id);
                          if (idx > 0) {
                            const swapIdx = idx - 1;
                            const temp = updated[idx].order;
                            updated[idx].order = updated[swapIdx].order;
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
                          const idx = updated.findIndex((u) => u.id === setting.id);
                          if (idx < updated.length - 1) {
                            const swapIdx = idx + 1;
                            const temp = updated[idx].order;
                            updated[idx].order = updated[swapIdx].order;
                            updated[swapIdx].order = temp;
                            updated.sort((a, b) => a.order - b.order);
                            setPluginSettings(updated);
                          }
                        }}
                        className="ui-icon-btn h-6 w-6 rounded p-1 disabled:opacity-30 disabled:hover:text-slate-500"
                      >
                        ▼
                      </button>

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
                      {plugin.manifest.type === "python" && (
                        <div className="flex items-center gap-1 shrink-0">
                          {plugin.is_builtin ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/50 text-blue-400 border border-blue-800">
                              SDK {bundledSdkVersion ? `v${bundledSdkVersion}` : "Bundled"}
                            </span>
                          ) : plugin.sdk_version ? (
                            plugin.sdk_version === bundledSdkVersion ? (
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
                                      const { BackendAPI } = await import("../../../api");
                                      const newVersion = await BackendAPI.updatePluginSdk(
                                        plugin.folder_path,
                                      );
                                      const refreshed = await BackendAPI.fetchInstalledPlugins();
                                      const newMap: Record<string, any> = {};
                                      refreshed.forEach((p: any) => { newMap[p.id] = p; });
                                      pluginSettings
                                        .filter((s) => !s.isBuiltin)
                                        .forEach((s) => {
                                          if (!newMap[s.id] && plugins[s.id])
                                            newMap[s.id] = plugins[s.id];
                                        });
                                      setPlugins(newMap);
                                      alert(`SDK を v${newVersion} に更新しました。`);
                                    } catch (err) {
                                      alert(`SDK 更新に失敗しました: ${String(err)}`);
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
                      WARNING: Memory target missing! Was path {setting.path} moved?
                    </p>
                  )}

                  <div className="mt-2 pt-2 border-t border-slate-800 flex flex-col gap-2">
                    <span className="text-xs font-medium text-slate-500">Plugin Icon:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                        {setting.icon?.startsWith("data:image/") ? (
                          <img src={setting.icon} alt="icon" className="w-full h-full object-contain" />
                        ) : (
                          (() => {
                            const iconName = setting.icon || plugin?.manifest?.icon || "Puzzle";
                            switch (iconName) {
                              case "Sparkles": return <Sparkles size={16} className="text-slate-300" />;
                              case "Map": return <Map size={16} className="text-slate-300" />;
                              case "PenTool": return <PenTool size={16} className="text-slate-300" />;
                              case "Wand2": return <Wand2 size={16} className="text-slate-300" />;
                              case "ImageIcon": return <ImageIcon size={16} className="text-slate-300" />;
                              default: return <Puzzle size={16} className="text-slate-300" />;
                            }
                          })()
                        )}
                      </div>
                      <select
                        className="ui-select flex-1 text-xs h-7 py-1 pl-2 pr-8"
                        value={setting.icon?.startsWith("data:image/") ? "custom" : (setting.icon || "default")}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "custom") return;
                          const newFallback = val === "default" ? undefined : val;
                          const newSettings = pluginSettings.map(s => s.id === setting.id ? { ...s, icon: newFallback } : s);
                          setPluginSettings(newSettings);
                        }}
                      >
                        <option value="default">Default</option>
                        <option value="Puzzle">Puzzle</option>
                        <option value="Sparkles">Sparkles</option>
                        <option value="Map">Map</option>
                        <option value="PenTool">PenTool</option>
                        <option value="Wand2">Wand</option>
                        <option value="ImageIcon">Image</option>
                        {setting.icon?.startsWith("data:image/") && <option value="custom">Custom Image</option>}
                      </select>
                      <button
                        className="ui-btn ui-btn-secondary ui-btn-sm h-7 shrink-0"
                        onClick={async () => {
                          const { DialogAPI, BackendAPI } = await import("../../../api");
                          const selectedPath = await DialogAPI.open({
                            multiple: false,
                            filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "svg", "webp"] }]
                          });
                          if (selectedPath) {
                            const pathStr = typeof selectedPath === "string" ? selectedPath : (selectedPath as any).path;
                            try {
                              const base64Data = await BackendAPI.readImageBase64(pathStr);
                              const newSettings = pluginSettings.map(s => s.id === setting.id ? { ...s, icon: base64Data } : s);
                              setPluginSettings(newSettings);
                            } catch (err) {
                              console.error("Failed to read image", err);
                              alert("画像の読み込みに失敗しました。");
                            }
                          }
                        }}
                      >
                        Browse Custom
                      </button>
                      {setting.icon && (
                        <button
                          onClick={() => {
                            const newSettings = pluginSettings.map(s => s.id === setting.id ? { ...s, icon: undefined } : s);
                            setPluginSettings(newSettings);
                          }}
                          className="text-[10px] text-red-400 hover:text-red-300 ml-auto shrink-0"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

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
                          const newSettings = pluginSettings.map((s) =>
                            s.id === setting.id ? { ...s, pythonOverridePath: e.target.value } : s,
                          );
                          setPluginSettings(newSettings);
                        }}
                        className="ui-input-sm flex-1"
                        placeholder={`Global: ${globalPythonPath}`}
                      />
                      <button
                        onClick={async () => {
                          const { DialogAPI } = await import("../../../api");
                          const selectedPath = await DialogAPI.open({
                            multiple: false,
                            directory: false,
                          });
                          if (selectedPath) {
                            const pathStr =
                              typeof selectedPath === "string"
                                ? selectedPath
                                : (selectedPath as any).path;
                            const newSettings = pluginSettings.map((s) =>
                              s.id === setting.id ? { ...s, pythonOverridePath: pathStr } : s,
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
  );
}
