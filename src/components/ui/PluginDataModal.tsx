import { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { X, Code2, Copy, Check, FileJson, Info } from 'lucide-react';
import { Button } from './common/Button';
import { PluginDataViewer } from './common/PluginDataViewer';

export function PluginDataModal() {
  const pluginDataModalState = useAppStore((state) => state.pluginDataModalState);
  const closePluginDataModal = useAppStore((state) => state.closePluginDataModal);
  const [copied, setCopied] = useState(false);

  if (!pluginDataModalState?.isOpen) return null;

  const { title, subtitle, data } = pluginDataModalState;
  const hasData = data && typeof data === 'object' && Object.keys(data).length > 0;

  const handleCopyAll = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy json', e);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-surface-base/80 backdrop-blur-xs">
      <div className="bg-surface-panel border border-border-base rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-base/40 flex items-center justify-between bg-surface-panel/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-accent-automation/10 text-accent-automation border border-accent-automation/20">
              <Code2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-text-base">{title || '内部プロパティ (Plugin Data)'}</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover text-text-muted border border-border-base/30 font-mono">
                  Read-only
                </span>
              </div>
              {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={closePluginDataModal}
            className="h-8 w-8 text-text-muted hover:text-text-base rounded-lg"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Info Banner */}
        <div className="px-5 py-2.5 bg-accent-automation/5 border-b border-accent-automation/15 flex items-center gap-2 text-xs text-accent-automation">
          <Info size={14} className="shrink-0 text-accent-automation" />
          <span>
            プラグインが内部計算結果として出力した読み取り専用のメタデータです。他のプラグインへの入力パイプライン等でも参照されます。
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {hasData ? (
            <div className="bg-surface-base/60 rounded-xl p-3 border border-border-base/40">
              <PluginDataViewer data={data} title="Structured Data" defaultExpanded={true} />
            </div>
          ) : (
            <div className="text-center py-12 flex flex-col items-center justify-center space-y-3 bg-surface-base/30 rounded-xl border border-dashed border-border-base/40">
              <div className="p-3 rounded-full bg-surface-hover/80 text-text-muted">
                <FileJson size={28} />
              </div>
              <div>
                <p className="text-xs font-semibold text-text-base">内部プロパティ（plugin_data）はありません</p>
                <p className="text-[11px] text-text-muted mt-1 max-w-sm">
                  このオブジェクトを生成したプラグインは、内部メタデータ（<code>plugin_data</code>）を出力していないか、データが空です。
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-base/40 flex items-center justify-between bg-surface-panel/80">
          <div>
            {hasData && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyAll}
                className="gap-1.5 text-xs shadow-xs"
              >
                {copied ? <Check size={13} className="text-status-success" /> : <Copy size={13} />}
                <span>{copied ? 'コピー完了' : 'JSON をコピー'}</span>
              </Button>
            )}
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={closePluginDataModal}
            className="px-5 text-xs font-semibold"
          >
            閉じる
          </Button>
        </div>
      </div>
    </div>
  );
}
