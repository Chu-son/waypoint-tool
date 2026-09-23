import { Code2, Maximize2 } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { Button } from '../common/Button';
import { PluginDataViewer } from '../common/PluginDataViewer';

interface InternalPropertiesSectionProps {
  /** The element's read-only `plugin_data`. */
  data: Record<string, unknown> | undefined | null;
  /** Title shown on the inline viewer. */
  viewerTitle: string;
  /** Title and subtitle of the full-screen plugin data dialog. */
  modalTitle: string;
  modalSubtitle: string;
  /** Hide the whole section when there is no data, instead of showing an empty message. */
  hideWhenEmpty?: boolean;
}

/** Read-only "内部プロパティ" section shared by the inspectors of plugin-generated elements. */
export function InternalPropertiesSection({
  data,
  viewerTitle,
  modalTitle,
  modalSubtitle,
  hideWhenEmpty = false,
}: InternalPropertiesSectionProps) {
  const openPluginDataModal = useAppStore((state) => state.openPluginDataModal);
  const hasData = !!data && Object.keys(data).length > 0;
  if (!hasData && hideWhenEmpty) return null;

  return (
    <div className="space-y-2 pt-3 border-t border-border-base/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Code2 size={13} className="text-accent-automation" />
          <span className="text-[11px] font-bold text-text-base">内部プロパティ (Internal Properties)</span>
        </div>
        <span className="text-[9px] px-1.5 py-0.2 rounded bg-surface-hover text-text-muted border border-border-base/30 font-mono">
          Read-only
        </span>
      </div>

      {hasData ? (
        <div className="space-y-1.5">
          <PluginDataViewer data={data} title={viewerTitle} defaultExpanded={true} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openPluginDataModal(modalTitle, data, modalSubtitle)}
            className="w-full text-[10px] text-accent-automation hover:bg-accent-automation/10 gap-1 h-6"
          >
            <Maximize2 size={11} />
            <span>全画面ダイアログで開く</span>
          </Button>
        </div>
      ) : (
        <p className="text-[10px] text-text-muted/60 bg-surface-base/30 p-2 rounded-lg border border-border-base/20 italic">
          内部プロパティ（plugin_data）はありません。
        </p>
      )}
    </div>
  );
}
