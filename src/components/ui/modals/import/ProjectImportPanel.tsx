import { useState } from 'react';
import { useAppStore } from '../../../../stores/appStore';
import { ModalContent, ModalFooter } from '../../common/Modal';
import { Button } from '../../common/Button';
import { FieldLabel } from '../../common/FieldLabel';
import { BrowseInput } from '../../common/BrowseInput';
import { AlertBox } from '../../common/AlertBox';
import {
  IMPORT_FILE_FILTERS,
  ImportFileError,
  pickImportFile,
  readProjectFile,
} from '../../../../services/importFiles';
import { notify, notifyError } from '../../../../services/notify';
import { applyProjectImportPlan } from '../../../../services/projectImport';
import { PROJECT_IMPORT_CATEGORIES } from '../../../../utils/import/projectImportPlan';
import { ProjectImportCategoryRow } from './ProjectImportCategoryRow';
import { useProjectImport } from './useProjectImport';
import type { ImportPanelProps } from './types';

const GROUPS = [
  { kind: 'settings', title: 'Settings', hint: 'Compared with this project. Open a row to see the differences.' },
  { kind: 'data', title: 'Data', hint: 'Added to this project under new ids; nothing existing is replaced.' },
] as const;

/**
 * 他のプロジェクト（.wptroj）から、必要な設定やデータだけを選んで取り込む。
 * 設定は今のプロジェクトとの差分を見て採否を決め、データは新しい ID で追加する。
 */
export function ProjectImportPanel({ onClose }: ImportPanelProps) {
  const runWithLoading = useAppStore((state) => state.runWithLoading);
  const state = useProjectImport();
  const [filePath, setFilePath] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const { loaded, plan, schemaErrors } = state;

  const handleSelectFile = async () => {
    const path = await pickImportFile(IMPORT_FILE_FILTERS.project);
    if (!path) return;
    setFilePath(path);
    try {
      const data = await runWithLoading(
        { message: 'プロジェクトを読み込み中...', detail: path.split(/[/\\]/).pop(), blocking: true },
        () => readProjectFile(path),
      );
      state.load(data);
    } catch (err) {
      void notifyError(err instanceof ImportFileError ? err.message : `読み込みに失敗しました。\n詳細: ${String(err)}`);
    }
  };

  const handleImport = async () => {
    if (!plan) return;
    setIsBusy(true);
    try {
      const applied = await applyProjectImportPlan(plan);
      if (!applied) return;
      void notify('選択した内容を取り込みました。');
      onClose();
    } finally {
      setIsBusy(false);
    }
  };

  const hasUndoableData = state.categories.has('waypoints') || state.categories.has('annotations');

  return (
    <>
      <ModalContent className="space-y-6 p-6">
        <div className="space-y-3">
          <FieldLabel>Project File</FieldLabel>
          <BrowseInput value={filePath ?? ''} placeholder="No file selected" onBrowseClick={handleSelectFile} />
        </div>

        {loaded &&
          GROUPS.map((group) => (
            <div key={group.kind} className="space-y-2">
              <div>
                <FieldLabel>{group.title}</FieldLabel>
                <p className="mt-0.5 text-[11px] text-text-muted">{group.hint}</p>
              </div>
              <ul className="space-y-1.5">
                {PROJECT_IMPORT_CATEGORIES.filter((c) => c.kind === group.kind).map((c) => (
                  <ProjectImportCategoryRow key={c.id} id={c.id} state={state} />
                ))}
              </ul>
            </div>
          ))}

        {schemaErrors.length > 0 && (
          <AlertBox variant="danger" title="The merged option schema is not valid">
            <ul className="list-disc list-inside space-y-0.5 mt-1">
              {schemaErrors.slice(0, 5).map((e, i) => (
                <li key={i}>
                  {e.message} ({e.path})
                </li>
              ))}
            </ul>
            Select the definitions or globals these items depend on, or leave the items out.
          </AlertBox>
        )}

        {plan && plan.warnings.length > 0 && (
          <AlertBox variant="warning" title="Please check before importing">
            <ul className="list-disc list-inside space-y-0.5 mt-1">
              {plan.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertBox>
        )}

        {hasUndoableData && (
          <AlertBox variant="info" title="About Undo">
            Undo removes the imported waypoints, annotations and custom layers. Imported settings and maps stay.
          </AlertBox>
        )}
      </ModalContent>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} className="px-6 text-text-muted font-bold">
          Cancel
        </Button>
        <Button onClick={handleImport} disabled={!state.canImport || isBusy}>
          Import
        </Button>
      </ModalFooter>
    </>
  );
}
