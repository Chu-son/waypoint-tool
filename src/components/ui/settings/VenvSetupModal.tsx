import React, { useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Checkbox } from '../common/Checkbox';
import { AlertBox } from '../common/AlertBox';
import { FieldLabel } from '../common/FieldLabel';
import { BackendAPI } from '../../../api';
import { useAppStore } from '../../../stores/appStore';
import { PluginInstance } from '../../../types/store';
import { PythonDependencyDef } from '../../../types/pipeline';
import {
  Terminal,
  Loader2,
} from 'lucide-react';

export interface VenvSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  plugin: PluginInstance;
  globalPythonPath?: string;
  onComplete?: (venvPythonPath: string) => void;
}

interface NormalizedDependency {
  name: string;
  version?: string;
  spec: string;
  optional: boolean;
  description?: string;
}

export const VenvSetupModal: React.FC<VenvSetupModalProps> = ({
  isOpen,
  onClose,
  plugin,
  globalPythonPath = '',
  onComplete,
}) => {
  const updatePluginSetting = useAppStore((state) => state.updatePluginSetting);

  // Normalize dependencies from manifest
  const dependencies: NormalizedDependency[] = React.useMemo(() => {
    const rawDeps = plugin.manifest?.python_dependencies || [];
    return rawDeps.map((dep: string | PythonDependencyDef) => {
      if (typeof dep === 'string') {
        return { name: dep, spec: dep, optional: false };
      }
      let spec = dep.name;
      if (dep.version && dep.version.trim()) {
        const v = dep.version.trim();
        spec = /^[><=~!^]/.test(v) ? `${dep.name}${v}` : `${dep.name}==${v}`;
      }
      return {
        name: dep.name,
        version: dep.version,
        spec,
        optional: Boolean(dep.optional),
        description: dep.description,
      };
    });
  }, [plugin.manifest?.python_dependencies]);

  const defaultVenvDir = plugin.folder_path
    ? `${plugin.folder_path}/.venv`
    : '.venv';

  const [basePython, setBasePython] = useState(globalPythonPath || 'python3');
  const [targetDir, setTargetDir] = useState(defaultVenvDir);
  const [detectedEnvs, setDetectedEnvs] = useState<string[]>([]);

  // Selected packages to install (package name -> boolean)
  const [selectedPackages, setSelectedPackages] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    dependencies.forEach((d) => {
      initial[d.name] = true;
    });
    return initial;
  });

  const [status, setStatus] = useState<'idle' | 'creating' | 'installing' | 'success' | 'error'>(
    'idle'
  );
  const [logs, setLogs] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Detect available Python environments on open
  useEffect(() => {
    if (!isOpen) return;

    // Reset form states
    setTargetDir(defaultVenvDir);
    setBasePython(globalPythonPath || 'python3');
    setStatus('idle');
    setLogs([]);
    setErrorMessage(null);

    const initialSelection: Record<string, boolean> = {};
    dependencies.forEach((d) => {
      initialSelection[d.name] = true;
    });
    setSelectedPackages(initialSelection);

    let isMounted = true;
    BackendAPI.getPythonEnvironments()
      .then((envs) => {
        if (isMounted && Array.isArray(envs)) {
          setDetectedEnvs(envs);
          if (!globalPythonPath && envs.length > 0) {
            setBasePython(envs[0]);
          }
        }
      })
      .catch((err) => {
        console.warn('Failed to detect python environments:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, plugin.folder_path, globalPythonPath, dependencies, defaultVenvDir]);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleTogglePackage = (pkgName: string) => {
    if (status === 'creating' || status === 'installing') return;
    setSelectedPackages((prev) => ({
      ...prev,
      [pkgName]: !prev[pkgName],
    }));
  };

  const handleCreateAndInstall = async () => {
    setStatus('creating');
    setErrorMessage(null);
    setLogs([]);

    try {
      addLog(`仮想環境の作成を開始します: ${targetDir}`);
      addLog(`ベース Python: ${basePython.trim() || 'default'}`);

      const venvPythonPath = await BackendAPI.createVirtualenv(
        targetDir,
        basePython.trim() || undefined
      );

      addLog(`仮想環境の作成に成功しました: ${venvPythonPath}`);

      const packagesToInstall = dependencies
        .filter((dep) => selectedPackages[dep.name] ?? true)
        .map((dep) => dep.spec);

      if (packagesToInstall.length > 0) {
        setStatus('installing');
        addLog(`依存パッケージのインストールを開始します: ${packagesToInstall.join(', ')}`);

        const installLog = await BackendAPI.installPipPackages(venvPythonPath, packagesToInstall);
        if (installLog) {
          addLog(installLog);
        }
        addLog('パッケージのインストールが完了しました。');
      } else {
        addLog('インストール対象のパッケージが選択されていません。スキップします。');
      }

      addLog(`プラグイン "${plugin.id}" のインタープリタ設定を更新中...`);
      updatePluginSetting(plugin.id, { pythonOverridePath: venvPythonPath });
      addLog(`プラグインの Python インタープリタを ${venvPythonPath} に設定しました。`);

      setStatus('success');
      if (onComplete) {
        onComplete(venvPythonPath);
      }
    } catch (err: any) {
      const errText = err?.message || String(err);
      addLog(`エラー: ${errText}`);
      setErrorMessage(errText);
      setStatus('error');
    }
  };

  const isRunning = status === 'creating' || status === 'installing';
  const hasDependencies = dependencies.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={isRunning ? () => {} : onClose} size="lg">
      <ModalHeader
        title={`Virtual Environment Setup - ${plugin.manifest?.name || plugin.id}`}
        icon={<Terminal size={18} className="text-primary-base" />}
        onClose={isRunning ? undefined : onClose}
      />

      <ModalContent className="space-y-4">
        {/* Base Python Interpreter */}
        <div className="space-y-1.5">
          <FieldLabel>Base Python Interpreter</FieldLabel>
          <div className="flex gap-2">
            <Input
              value={basePython}
              onChange={(e) => setBasePython(e.target.value)}
              placeholder="e.g. /usr/bin/python3 or python3"
              disabled={isRunning}
              className="font-mono text-xs"
            />
            {detectedEnvs.length > 0 && (
              <select
                aria-label="Select Detected Python Environment"
                className="text-xs bg-surface-panel border border-border-base rounded-md px-2 text-text-muted focus:text-text-base cursor-pointer"
                disabled={isRunning}
                value=""
                onChange={(e) => {
                  if (e.target.value) setBasePython(e.target.value);
                }}
              >
                <option value="">Detected Envs ({detectedEnvs.length})</option>
                {detectedEnvs.map((env) => (
                  <option key={env} value={env}>
                    {env}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="text-[11px] text-text-muted">
            仮想環境の作成元となるPython実行可能ファイルのパスを指定します。
          </p>
        </div>

        {/* Target Directory */}
        <div className="space-y-1.5">
          <FieldLabel>Target Directory (仮想環境作成先)</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              value={targetDir}
              onChange={(e) => setTargetDir(e.target.value)}
              disabled={isRunning}
              className="font-mono text-xs"
            />
          </div>
          <p className="text-[11px] text-text-muted">
            プラグインフォルダ直下の <code>.venv</code> に作成することを推奨します。
          </p>
        </div>

        {/* Packages to Install */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <FieldLabel className="mb-0">
              Packages to Install ({dependencies.length})
            </FieldLabel>
            {hasDependencies && (
              <span className="text-[10px] text-text-muted font-mono">
                plugin.manifest.python_dependencies
              </span>
            )}
          </div>

          {!hasDependencies ? (
            <div className="text-xs text-text-muted/70 italic p-3 rounded-lg bg-surface-base/30 border border-border-base/30">
              このプラグインには追加の Python 依存パッケージは定義されていません。
            </div>
          ) : (
            <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 rounded-lg bg-surface-base/30 border border-border-base/30">
              {dependencies.map((dep) => (
                <label
                  key={dep.name}
                  className="flex items-center justify-between p-1.5 rounded hover:bg-surface-hover/50 transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Checkbox
                      checked={Boolean(selectedPackages[dep.name])}
                      onChange={() => handleTogglePackage(dep.name)}
                      disabled={isRunning}
                    />
                    <div className="truncate">
                      <span className="text-xs font-mono font-medium text-text-base">
                        {dep.spec}
                      </span>
                      {dep.description && (
                        <span className="text-[11px] text-text-muted ml-2">
                          - {dep.description}
                        </span>
                      )}
                    </div>
                  </div>
                  {dep.optional && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-surface-hover text-text-muted border border-border-base/30">
                      optional
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <AlertBox variant="danger" title="Setup Failed">
            {errorMessage}
          </AlertBox>
        )}

        {/* Success Alert */}
        {status === 'success' && (
          <AlertBox variant="success" title="Setup Completed">
            仮想環境の作成と依存パッケージのインストールが完了しました。プラグインのPythonインタープリタ設定が自動更新されました。
          </AlertBox>
        )}

        {/* Real-time Output Log */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-semibold text-text-muted">Execution Output</span>
            {isRunning && (
              <span className="text-[10px] text-primary-base flex items-center gap-1 font-medium">
                <Loader2 size={11} className="animate-spin" />
                {status === 'creating' ? 'Creating venv...' : 'Installing packages...'}
              </span>
            )}
          </div>
          <pre
            aria-label="Execution Output Log"
            className="bg-surface-canvas text-text-muted font-mono text-[11px] p-3 rounded-lg border border-border-base/40 overflow-y-auto max-h-36 whitespace-pre-wrap select-text leading-relaxed"
          >
            {logs.length === 0
              ? '準備完了。「Create & Install」をクリックすると実行ログがここに表示されます。'
              : logs.join('\n')}
          </pre>
        </div>
      </ModalContent>

      <ModalFooter>
        {status === 'success' ? (
          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isRunning}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateAndInstall}
              disabled={isRunning || !targetDir.trim()}
              className="gap-1.5 font-bold"
            >
              {isRunning ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Terminal size={13} />
                  <span>Create & Install</span>
                </>
              )}
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
};
