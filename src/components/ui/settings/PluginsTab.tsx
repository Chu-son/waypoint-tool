import { Plus, Trash2, RefreshCw, Sparkles, Map, PenTool, Wand2, Puzzle, Image as ImageIcon, Check, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { Label } from "../common/Label";
import { Select } from "../common/Select";
import { cn } from "../../../utils/cn";

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-center bg-surface-panel p-4 rounded-xl border border-border-base/50 shadow-sm">
        <div>
          <h3 className="text-lg font-bold text-text-base tracking-tight">Installed Plugins</h3>
          <p className="text-xs text-text-muted mt-0.5 font-medium">
            Manage Generator plugins order and visibility on the Tool Panel.
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button
            variant="secondary"
            size="sm"
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
          >
            <Plus size={14} className="mr-1" /> Add Folder
          </Button>
          <Button
            variant="primary"
            size="sm"
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
          >
            <Plus size={14} className="mr-1" /> Create New
          </Button>
        </div>
      </div>

      {/* Missing Plugins Cleanup Banner */}
      {(() => {
        const missingCount = pluginSettings.filter(s => !plugins[s.id]).length;
        if (missingCount > 0) {
          return (
            <div className="bg-danger-base/10 border border-danger-base/20 rounded-xl p-4 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-danger-base/20 flex items-center justify-center text-danger-base shrink-0">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-danger-base leading-tight">Missing Plugin Sources</h4>
                  <p className="text-[11px] text-danger-base/80 mt-0.5">
                    {missingCount} {missingCount === 1 ? 'plugin setting doesn\'t' : 'plugin settings don\'t'} match any installed folder.
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (confirm(`${missingCount}個の欠落したプラグイン設定を削除します。よろしいですか？`)) {
                    const nextSettings = pluginSettings.filter(s => !!plugins[s.id]);
                    setPluginSettings(nextSettings);
                  }
                }}
                className="bg-danger-base/10 hover:bg-danger-base/20 border-danger-base/20 text-danger-base hover:text-danger-base"
              >
                Cleanup All
              </Button>
            </div>
          );
        }
        return null;
      })()}

      <div className="space-y-4">
        {pluginSettings.length === 0 ? (
          <div className="text-center py-12 text-text-muted/60 text-sm bg-surface-panel/30 rounded-2xl border-2 border-dashed border-border-base/50 animate-pulse">
            No plugins installed.
          </div>
        ) : (
          [...pluginSettings]
            .sort((a, b) => a.order - b.order)
            .map((setting, index) => {
              const plugin = plugins[setting.id];
              const isEnabled = setting.enabled;

              return (
                <div
                  key={setting.id}
                  className={cn(
                    "bg-surface-panel/40 border border-border-base/30 rounded-xl overflow-hidden shadow-subtle hover:border-border-base/60 transition-all",
                    !isEnabled && "opacity-75 grayscale-[0.5]"
                  )}
                >
                  <div className="p-4 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => {
                            const newSettings = pluginSettings.map((s) =>
                              s.id === setting.id ? { ...s, enabled: !s.enabled } : s,
                            );
                            setPluginSettings(newSettings);
                          }}
                          className={cn(
                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-base/50",
                            isEnabled ? "bg-primary-base" : "bg-surface-hover"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              isEnabled ? "translate-x-5" : "translate-x-0"
                            )}
                          />
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-text-base text-[15px]">
                              {plugin ? plugin.manifest.name : "Unknown Plugin"}
                            </span>
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-surface-base/60 text-text-muted border border-border-base/50 uppercase font-bold tracking-widest shadow-sm">
                              {plugin ? plugin.manifest.type : "MISSING"} {setting.isBuiltin ? "" : "(Custom)"}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted font-mono mt-1 opacity-80 break-all line-clamp-1">
                            {plugin?.folder_path || setting.path}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-1 items-center bg-surface-base/30 p-1 rounded-lg border border-border-base/20">
                        <Button
                          variant="ghost"
                          size="icon"
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
                          className="h-7 w-7 text-text-muted disabled:opacity-30"
                        >
                          <ChevronUp size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
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
                          className="h-7 w-7 text-text-muted disabled:opacity-30"
                        >
                          <ChevronDown size={16} />
                        </Button>

                        {(!setting.isBuiltin || !plugin) && (
                          <div className="w-px h-4 bg-border-base/20 mx-1" />
                        )}
                        {(!setting.isBuiltin || !plugin) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const newSettings = pluginSettings.filter(
                                (s) => s.id !== setting.id,
                              );
                              setPluginSettings(newSettings);
                            }}
                            className="h-7 w-7 text-text-muted hover:text-danger-base hover:bg-danger-base/10"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-6 pt-1">
                      {/* Icon Config */}
                      <div className="col-span-12 md:col-span-5 space-y-2.5">
                        <Label className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-1">Plugin Icon</Label>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-surface-base/50 border border-border-base/40 flex items-center justify-center shrink-0 overflow-hidden shadow-subtle group/icon">
                            {setting.icon?.startsWith("data:image/") ? (
                              <img src={setting.icon} alt="icon" className="w-full h-full object-contain" />
                            ) : (
                              (() => {
                                const iconName = setting.icon || plugin?.manifest?.icon || "Puzzle";
                                switch (iconName) {
                                  case "Sparkles": return <Sparkles size={20} className="text-primary-base" />;
                                  case "Map": return <Map size={20} className="text-primary-base" />;
                                  case "PenTool": return <PenTool size={20} className="text-primary-base" />;
                                  case "Wand2": return <Wand2 size={20} className="text-primary-base" />;
                                  case "ImageIcon": return <ImageIcon size={20} className="text-primary-base" />;
                                  default: return <Puzzle size={20} className="text-primary-base" />;
                                }
                              })()
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex gap-2">
                              <Select
                                className="h-8 text-[11px] py-0"
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
                              </Select>
                              <Button
                                variant="secondary"
                                className="h-8 px-3 shrink-0 text-[10px]"
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
                                Browse
                              </Button>
                              {setting.icon && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const newSettings = pluginSettings.map(s => s.id === setting.id ? { ...s, icon: undefined } : s);
                                    setPluginSettings(newSettings);
                                  }}
                                  className="h-8 w-8 text-danger-base/60 hover:text-danger-base hover:bg-danger-base/10"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Interpreter Override */}
                      {plugin && plugin.manifest.type === "python" && (
                        <div className="col-span-12 md:col-span-7 space-y-2.5">
                          <Label className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-1">Python Interpreter Override</Label>
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              list="python-envs"
                              value={setting.pythonOverridePath || ""}
                              onChange={(e) => {
                                const newSettings = pluginSettings.map((s) =>
                                  s.id === setting.id ? { ...s, pythonOverridePath: e.target.value } : s,
                                );
                                setPluginSettings(newSettings);
                              }}
                              className="h-8 text-[11px] flex-1 font-mono"
                              placeholder={`Global: ${globalPythonPath}`}
                            />
                            <Button
                              variant="secondary"
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
                              className="h-8 px-3 text-[10px]"
                            >
                              Browse
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status Info */}
                    {plugin && plugin.manifest.type === "python" && (
                      <div className="mt-1 flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {plugin.is_builtin ? (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-accent-blue-400/10 text-accent-blue-400 border border-accent-blue-400/20 text-[10px] font-bold">
                              <Check size={10} />
                              <span>SDK Bundled {bundledSdkVersion ? `v${bundledSdkVersion}` : ""}</span>
                            </div>
                          ) : plugin.sdk_version ? (
                            plugin.sdk_version === bundledSdkVersion ? (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-accent-green-400/10 text-accent-green-400 border border-accent-green-400/20 text-[10px] font-bold">
                                <Check size={10} />
                                <span>SDK v{plugin.sdk_version} (Up to date)</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-accent-orange-400/10 text-accent-orange-400 border border-accent-orange-400/20 text-[10px] font-bold">
                                  <AlertCircle size={10} />
                                  <span>SDK v{plugin.sdk_version} (v{bundledSdkVersion} available)</span>
                                </div>
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
                                  className="text-[10px] font-bold text-accent-orange-400 hover:text-accent-orange-300 flex items-center gap-1 bg-accent-orange-400/5 hover:bg-accent-orange-400/10 px-2 py-0.5 rounded-md transition-colors"
                                >
                                  <RefreshCw size={10} /> Update SDK
                                </button>
                              </div>
                            )
                          ) : (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-danger-base/10 text-danger-base border border-danger-base/20 text-[10px] font-bold">
                              <AlertCircle size={10} />
                              <span>SDK Missing</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {!plugin && (
                      <div className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger-base/10 text-danger-base border border-danger-base/20 text-xs font-semibold">
                        <AlertCircle size={14} />
                        <span>Plugin source not found. Was it deleted or moved?</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}
