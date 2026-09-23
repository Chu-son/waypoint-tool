import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';

import { GeneralTab } from './settings/GeneralTab';
import { AppearanceTab } from './settings/AppearanceTab';
import { OptionSchemaTab } from './settings/OptionSchemaTab';
import { RobotFootprintTab } from './settings/RobotFootprintTab';
import { ExportTemplatesTab } from './settings/ExportTemplatesTab';
import { PluginsTab } from './settings/PluginsTab';
import { ConditionalStylesTab } from './settings/ConditionalStylesTab';
import { Modal, ModalHeader, ModalContent } from './common/Modal';
import { Button } from './common/Button';
import { cn } from '../../utils/cn';
import { Sliders, Palette, Database, Sparkles, Bot, FileCode, Puzzle } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  type TabType = 'general' | 'appearance' | 'options' | 'conditional_styles' | 'robot' | 'export' | 'plugins';
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const modalTabFromStore = useAppStore((state) => state.settingsModalTab);
  const globalPythonPath = useAppStore((state) => state.globalPythonPath);

  const [pythonEnvs, setPythonEnvs] = useState<string[]>([]);
  const [bundledSdkVersion, setBundledSdkVersion] = useState<string | null>(null);

  // Sync when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(modalTabFromStore);
      import('../../api').then(({ BackendAPI }) => {
        BackendAPI.getPythonEnvironments()
          .then((envs) => setPythonEnvs(envs))
          .catch(console.error);
        BackendAPI.checkSdkVersion()
          .then((v) => setBundledSdkVersion(v))
          .catch(() => setBundledSdkVersion(null));
      });
    }
  }, [isOpen, modalTabFromStore]);

  const TABS = [
    { id: 'general', label: 'General', icon: Sliders },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'options', label: 'Option Schema', icon: Database },
    { id: 'conditional_styles', label: 'Conditional Styles', icon: Sparkles },
    { id: 'robot', label: 'Robot Footprint', icon: Bot },
    { id: 'export', label: 'Export Templates', icon: FileCode },
    { id: 'plugins', label: 'Plugins', icon: Puzzle },
  ] as const;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" className="h-[85vh]">
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
        <div className="w-40 sm:w-48 md:w-52 bg-surface-panel/40 border-r border-border-base/40 p-2 sm:p-2.5 shrink-0 space-y-1 overflow-y-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                variant={isSelected ? 'secondary' : 'ghost'}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full justify-start font-medium text-[13px] h-8.5 px-2.5 transition-colors truncate rounded-md group flex items-center gap-2.5',
                  isSelected
                    ? 'bg-primary-base/10 text-primary-base border border-primary-base/20 shadow-xs font-semibold'
                    : 'text-text-muted hover:text-text-base hover:bg-surface-hover/50 border border-transparent',
                )}
              >
                <Icon
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors',
                    isSelected ? 'text-primary-base' : 'text-text-muted/80 group-hover:text-text-base',
                  )}
                />
                <span className="truncate">{tab.label}</span>
              </Button>
            );
          })}
        </div>

        {/* Content Area */}
        <ModalContent className="p-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
            {activeTab === 'general' && <GeneralTab />}
            {activeTab === 'appearance' && <AppearanceTab />}
            {activeTab === 'options' && <OptionSchemaTab />}
            {activeTab === 'conditional_styles' && <ConditionalStylesTab />}
            {activeTab === 'robot' && <RobotFootprintTab />}
            {activeTab === 'export' && <ExportTemplatesTab />}
            {activeTab === 'plugins' && (
              <PluginsTab bundledSdkVersion={bundledSdkVersion} globalPythonPath={globalPythonPath} />
            )}
          </div>
        </ModalContent>
      </div>
    </Modal>
  );
}
