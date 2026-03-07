import { X } from "lucide-react";
import { useState, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";

import { GeneralTab } from "./settings/GeneralTab";
import { OptionSchemaTab } from "./settings/OptionSchemaTab";
import { ExportTemplatesTab } from "./settings/ExportTemplatesTab";
import { PluginsTab } from "./settings/PluginsTab";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  type TabType = "general" | "options" | "export" | "plugins";
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const modalTabFromStore = useAppStore((state) => state.settingsModalTab);
  const globalPythonPath = useAppStore((state) => state.globalPythonPath);

  const [pythonEnvs, setPythonEnvs] = useState<string[]>([]);
  const [bundledSdkVersion, setBundledSdkVersion] = useState<string | null>(
    null,
  );

  // Sync when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(modalTabFromStore);
      import("../../api").then(({ BackendAPI }) => {
        BackendAPI.getPythonEnvironments()
          .then((envs) => setPythonEnvs(envs))
          .catch(console.error);
        BackendAPI.checkSdkVersion()
          .then((v) => setBundledSdkVersion(v))
          .catch(() => setBundledSdkVersion(null));
      });
    }
  }, [isOpen, modalTabFromStore]);

  if (!isOpen) return null;

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
            {activeTab === "general" && <GeneralTab />}
            {activeTab === "options" && <OptionSchemaTab />}
            {activeTab === "export" && <ExportTemplatesTab />}
            {activeTab === "plugins" && (
              <PluginsTab
                bundledSdkVersion={bundledSdkVersion}
                globalPythonPath={globalPythonPath}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
