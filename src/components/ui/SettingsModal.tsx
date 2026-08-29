import { } from "lucide-react";
import { useState, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";

import { GeneralTab } from "./settings/GeneralTab";
import { OptionSchemaTab } from "./settings/OptionSchemaTab";
import { RobotFootprintTab } from "./settings/RobotFootprintTab";
import { ExportTemplatesTab } from "./settings/ExportTemplatesTab";
import { PluginsTab } from "./settings/PluginsTab";
import { Modal, ModalHeader, ModalContent } from "./common/Modal";
import { Button } from "./common/Button";
import { cn } from "../../utils/cn";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  type TabType = "general" | "options" | "robot" | "export" | "plugins";
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" className="h-[80vh]">
      <datalist id="python-envs">
        {pythonEnvs.map((env, i) => (
          <option key={i} value={env} />
        ))}
      </datalist>

      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-3">
          <span>User Settings</span>
        </div>
      </ModalHeader>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-40 sm:w-52 md:w-56 bg-surface-panel/40 border-r border-border-base/40 p-2 sm:p-3 shrink-0 space-y-1 overflow-y-auto">
          {([
            { id: "general", label: "General" },
            { id: "options", label: "Option Schema" },
            { id: "robot", label: "Robot Footprint" },
            { id: "export", label: "Export Templates" },
            { id: "plugins", label: "Plugins" },
          ] as const).map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "secondary" : "ghost"}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full justify-start font-bold text-xs sm:text-[13px] h-9 sm:h-10 px-2.5 sm:px-4 transition-all truncate",
                activeTab === tab.id
                  ? "bg-primary-base/10 text-primary-base border border-primary-base/20 shadow-sm"
                  : "text-text-muted hover:text-text-base hover:bg-surface-hover/50"
              )}
            >
              <span className="truncate">{tab.label}</span>
            </Button>
          ))}
        </div>

        {/* Content Area */}
        <ModalContent className="p-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
            {activeTab === "general" && <GeneralTab />}
            {activeTab === "options" && <OptionSchemaTab />}
            {activeTab === "robot" && <RobotFootprintTab />}
            {activeTab === "export" && <ExportTemplatesTab />}
            {activeTab === "plugins" && (
              <PluginsTab
                bundledSdkVersion={bundledSdkVersion}
                globalPythonPath={globalPythonPath}
              />
            )}
          </div>
        </ModalContent>
      </div>
    </Modal>
  );
}
