import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Puzzle } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { Button } from '../common/Button';
import { TabSectionHeader } from './TabSectionHeader';
import { EmptyState } from '../common/EmptyState';
import { AlertBox } from '../common/AlertBox';
import { PluginCard } from './PluginCard';
import { VenvSetupModal } from './VenvSetupModal';
import { BackendAPI } from '../../../api';
import { PluginInstance } from '../../../types/store';
import { notify } from '../../../services/notify';
import { resolvePythonPath } from '../../../utils/pythonPath';
import { importPluginFolders, scaffoldNewPlugin } from '../../../services/pluginImport';

interface PluginsTabProps {
  bundledSdkVersion: string | null;
  globalPythonPath: string;
}

export function PluginsTab({ bundledSdkVersion, globalPythonPath }: PluginsTabProps) {
  const plugins = useAppStore((state) => state.plugins) || {};
  const rawPluginSettings = useAppStore((state) => state.pluginSettings);
  const pluginSettings = Array.isArray(rawPluginSettings) ? rawPluginSettings : [];
  const setPluginSettings = useAppStore((state) => state.setPluginSettings);
  const lastDirectory = useAppStore((state) => state.lastDirectory);

  const [venvModalPlugin, setVenvModalPlugin] = useState<PluginInstance | null>(null);
  const [packageCheckResults, setPackageCheckResults] = useState<Record<string, Record<string, boolean>>>({});
  const [isCheckingPackages, setIsCheckingPackages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Object.values(plugins).forEach(async (p) => {
      if (
        (p?.manifest?.type === 'python' || p?.manifest?.type === 'python_library') &&
        p.manifest.python_dependencies &&
        p.manifest.python_dependencies.length > 0
      ) {
        const pkgNames = p.manifest.python_dependencies.map((d: any) => (typeof d === 'string' ? d : d.name));
        const pythonPath = resolvePythonPath(p, pluginSettings, globalPythonPath);

        setIsCheckingPackages((prev) => ({ ...prev, [p.id]: true }));
        try {
          const res = await BackendAPI.checkPythonPackages(pythonPath, pkgNames);
          setPackageCheckResults((prev) => ({ ...prev, [p.id]: res }));
        } catch (err) {
          console.warn(`checkPythonPackages error for ${p.id}:`, err);
        } finally {
          setIsCheckingPackages((prev) => ({ ...prev, [p.id]: false }));
        }
      }
    });
  }, [plugins, pluginSettings, globalPythonPath]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <TabSectionHeader
        title="Installed Plugins"
        subtitle="Manage Generator plugins order and visibility on the Tool Panel."
        icon={Puzzle}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  const reloadPlugins = useAppStore.getState().reloadPlugins;
                  await reloadPlugins();
                } catch (err) {
                  void notify(`リロードに失敗しました: ${String(err)}`);
                }
              }}
              className="text-text-muted hover:text-text-base border-border-base/30"
            >
              <RefreshCw size={14} className="mr-1" /> Reload All
            </Button>
            <Button variant="secondary" size="sm" onClick={() => importPluginFolders(lastDirectory)}>
              <Plus size={14} className="mr-1" /> Add Folder
            </Button>
            <Button variant="primary" size="sm" onClick={() => scaffoldNewPlugin(lastDirectory)}>
              <Plus size={14} className="mr-1" /> Create New
            </Button>
          </>
        }
      />

      {/* Missing Plugins Cleanup Banner */}
      {(() => {
        const missingCount = pluginSettings.filter((s) => !plugins[s.id]).length;
        if (missingCount > 0) {
          return (
            <AlertBox
              variant="danger"
              title="Missing Plugin Sources"
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const { DialogAPI } = await import('../../../api');
                    const confirmed = await DialogAPI.ask(
                      `${missingCount}個の欠落したプラグイン設定を削除します。よろしいですか？`,
                      { title: '一括削除の確認', kind: 'warning' },
                    );
                    if (confirmed) {
                      const nextSettings = pluginSettings.filter((s) => !!plugins[s.id]);
                      setPluginSettings(nextSettings);
                    }
                  }}
                  className="bg-danger-base/10 hover:bg-danger-base/20 border-danger-base/20 text-danger-base hover:text-danger-base"
                >
                  Cleanup All
                </Button>
              }
            >
              {missingCount} {missingCount === 1 ? "plugin setting doesn't" : "plugin settings don't"} match any
              installed folder.
            </AlertBox>
          );
        }
        return null;
      })()}

      <div className="space-y-4">
        {pluginSettings.length === 0 ? (
          <EmptyState message="No plugins installed." />
        ) : (
          [...pluginSettings]
            .sort((a, b) => a.order - b.order)
            .map((setting, index) => {
              const plugin = plugins[setting.id];

              return (
                <PluginCard
                  key={setting.id}
                  setting={setting}
                  plugin={plugin}
                  index={index}
                  pluginSettings={pluginSettings}
                  plugins={plugins}
                  globalPythonPath={globalPythonPath}
                  bundledSdkVersion={bundledSdkVersion}
                  packageCheck={packageCheckResults[setting.id] || {}}
                  isCheckingPackages={!!isCheckingPackages[setting.id]}
                  onOpenVenvSetup={setVenvModalPlugin}
                />
              );
            })
        )}
      </div>

      {venvModalPlugin && (
        <VenvSetupModal
          isOpen={true}
          onClose={() => setVenvModalPlugin(null)}
          plugin={venvModalPlugin}
          globalPythonPath={globalPythonPath}
          onComplete={async (venvPythonPath) => {
            const p = venvModalPlugin;
            const names = (p.manifest.python_dependencies || []).map((d: any) => (typeof d === 'string' ? d : d.name));
            try {
              const res = await BackendAPI.checkPythonPackages(venvPythonPath, names);
              setPackageCheckResults((prev) => ({ ...prev, [p.id]: res }));
            } catch (err) {
              console.warn(err);
            }
          }}
        />
      )}
    </div>
  );
}
