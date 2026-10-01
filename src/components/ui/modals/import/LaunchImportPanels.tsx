import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { useAppStore } from '../../../../stores/appStore';
import { ModalContent, ModalFooter } from '../../common/Modal';
import { Button } from '../../common/Button';
import { importPluginFolders } from '../../../../services/pluginImport';
import { importMapFromDialog } from '../../../../services/mapImport';
import type { ImportPanelProps } from './types';

interface LaunchImportPanelProps extends ImportPanelProps {
  description: string;
  actionLabel: string;
  /** ファイル（フォルダ）選択から取り込みまでを行う。取り込めたら true を返すと、モーダルを閉じる。 */
  onLaunch: () => Promise<boolean | void>;
}

/** ファイル選択と取り込みを既存の流れに任せる種類（マップ、プラグイン）の入口。 */
function LaunchImportPanel({ description, actionLabel, onLaunch, onClose }: LaunchImportPanelProps) {
  const [isBusy, setIsBusy] = useState(false);

  const handleLaunch = async () => {
    setIsBusy(true);
    try {
      if ((await onLaunch()) !== false) onClose();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <ModalContent className="space-y-4 p-6">
        <p className="text-[13px] leading-relaxed text-text-muted">{description}</p>
        <Button onClick={handleLaunch} disabled={isBusy}>
          <FolderOpen size={14} className="mr-1.5" />
          {actionLabel}
        </Button>
      </ModalContent>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} className="px-6 text-text-muted font-bold">
          Cancel
        </Button>
      </ModalFooter>
    </>
  );
}

export function MapImportPanel({ onClose }: ImportPanelProps) {
  return (
    <LaunchImportPanel
      onClose={onClose}
      description="Add a map (ROS map YAML or an image map) to the project as a new layer."
      actionLabel="Choose map file..."
      onLaunch={() => importMapFromDialog({ fitToMaps: true })}
    />
  );
}

export function PluginImportPanel({ onClose }: ImportPanelProps) {
  const lastDirectory = useAppStore((state) => state.lastDirectory);
  return (
    <LaunchImportPanel
      onClose={onClose}
      description="Add plugins from a folder that contains one or more plugin folders. Plugins are installed for this application, not for a single project."
      actionLabel="Choose plugin folder..."
      onLaunch={() => importPluginFolders(lastDirectory)}
    />
  );
}
