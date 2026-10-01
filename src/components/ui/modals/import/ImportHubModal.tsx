import { useState, type ComponentType } from 'react';
import { ArrowLeft, Upload } from 'lucide-react';
import { useAppStore } from '../../../../stores/appStore';
import type { ImportCategory } from '../../../../types/modal';
import { Modal, ModalContent, ModalHeader } from '../../common/Modal';
import { Button } from '../../common/Button';
import { IMPORT_CATEGORIES, getImportCategory } from './importCategories';
import { MapImportPanel, PluginImportPanel } from './LaunchImportPanels';
import { OptionSchemaImportPanel } from './OptionSchemaImportPanel';
import { ProjectImportPanel } from './ProjectImportPanel';
import { TemplateImportPanel } from './TemplateImportPanel';
import { WaypointImportPanel } from './WaypointImportPanel';
import type { ImportPanelProps } from './types';

const PANELS: Record<ImportCategory, ComponentType<ImportPanelProps>> = {
  waypoints: WaypointImportPanel,
  project: ProjectImportPanel,
  optionSchema: OptionSchemaImportPanel,
  template: TemplateImportPanel,
  map: MapImportPanel,
  plugins: PluginImportPanel,
};

interface ImportHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * あらゆるインポートの入口。最初に取り込む対象の種類を選び、その種類の取り込み画面へ進む。
 * 設定画面など別の場所から開くときは、種類を指定して選択を飛ばせる（`setImportModalOpen(true, category)`）。
 */
export function ImportHubModal({ isOpen, onClose }: ImportHubModalProps) {
  if (!isOpen) return null;
  return <ImportHubContent onClose={onClose} />;
}

// 開くたびにマウントし直すことで、選択中の種類が前回の状態を引きずらないようにする。
function ImportHubContent({ onClose }: { onClose: () => void }) {
  const initialCategory = useAppStore((state) => state.importModalCategory);
  const [category, setCategory] = useState<ImportCategory | null>(initialCategory);
  const Panel = category ? PANELS[category] : null;

  return (
    <Modal isOpen onClose={onClose} size="3xl" className="h-[85vh]">
      <ModalHeader onClose={onClose}>
        {category && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCategory(null)}
            aria-label="Back to import types"
            title="Back"
          >
            <ArrowLeft size={16} />
          </Button>
        )}
        <Upload size={20} className="text-primary-base" />
        <span className="truncate">{category ? `Import ${getImportCategory(category).label}` : 'Import'}</span>
      </ModalHeader>

      {Panel ? (
        <Panel onClose={onClose} />
      ) : (
        <ModalContent className="p-6">
          <p className="mb-4 text-[13px] text-text-muted">What would you like to import?</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {IMPORT_CATEGORIES.map(({ id, label, description, icon: Icon }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setCategory(id)}
                  className="flex h-full w-full items-start gap-3 rounded-lg border border-border-base bg-surface-panel/40 p-4 text-left transition-colors hover:border-primary-base/40 hover:bg-surface-hover/60 focus:outline-none focus:ring-2 focus:ring-primary-base/40"
                >
                  <Icon size={20} className="mt-0.5 shrink-0 text-primary-base" />
                  <span className="space-y-1">
                    <span className="block text-sm font-bold text-text-base">{label}</span>
                    <span className="block text-[11px] leading-relaxed text-text-muted">{description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </ModalContent>
      )}
    </Modal>
  );
}
