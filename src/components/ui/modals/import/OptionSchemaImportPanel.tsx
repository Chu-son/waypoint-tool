import { useMemo, useState } from 'react';
import { useAppStore } from '../../../../stores/appStore';
import { ModalContent, ModalFooter } from '../../common/Modal';
import { Button } from '../../common/Button';
import { FieldLabel } from '../../common/FieldLabel';
import { BrowseInput } from '../../common/BrowseInput';
import { AlertBox } from '../../common/AlertBox';
import { ItemDiffList } from '../../common/ItemDiffList';
import {
  IMPORT_FILE_FILTERS,
  ImportFileError,
  pickImportFile,
  readOptionsSchemaFile,
} from '../../../../services/importFiles';
import { notify, notifyError } from '../../../../services/notify';
import { applyOptionsSchema } from '../../../../services/optionSchemaApply';
import type { OptionsSchema } from '../../../../types/options';
import { validateSchema } from '../../../../utils/optionSchema';
import { defaultAcceptedIds, diffOptionsSchema, mergeOptionsSchema } from '../../../../utils/import/optionSchemaMerge';
import { schemaDiffRows } from './diffRows';
import type { ImportPanelProps } from './types';

/**
 * オプションスキーマのファイルを、今のスキーマとの差分を見ながら取り込む。
 * 追加と変更は既定で取り込み、今のスキーマにだけある項目は残す（取り込み側でチェックすると削除する）。
 */
export function OptionSchemaImportPanel({ onClose }: ImportPanelProps) {
  const currentSchema = useAppStore((state) => state.optionsSchema);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<OptionsSchema | null>(null);
  const [accepted, setAccepted] = useState<ReadonlySet<string>>(new Set());
  const [isBusy, setIsBusy] = useState(false);

  const diffs = useMemo(() => (incoming ? diffOptionsSchema(currentSchema, incoming) : []), [currentSchema, incoming]);
  const rows = useMemo(() => schemaDiffRows(diffs), [diffs]);
  const merged = useMemo(() => (incoming ? mergeOptionsSchema(diffs, accepted) : null), [incoming, diffs, accepted]);
  const schemaErrors = useMemo(() => (merged ? validateSchema(merged) : []), [merged]);
  const hasDifferences = diffs.some((d) => d.status !== 'unchanged');

  const handleSelectFile = async () => {
    const path = await pickImportFile(IMPORT_FILE_FILTERS.optionSchema);
    if (!path) return;
    setFilePath(path);
    setIsBusy(true);
    try {
      const schema = await readOptionsSchemaFile(path);
      setIncoming(schema);
      setAccepted(defaultAcceptedIds(diffOptionsSchema(currentSchema, schema)));
    } catch (err) {
      setIncoming(null);
      void notifyError(err instanceof ImportFileError ? err.message : `読み込みに失敗しました。\n詳細: ${String(err)}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleImport = async () => {
    if (!merged) return;
    setIsBusy(true);
    try {
      const applied = await applyOptionsSchema(merged);
      if (!applied) return;
      void notify('オプションスキーマを取り込みました。');
      onClose();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <ModalContent className="space-y-6 p-6">
        <div className="space-y-3">
          <FieldLabel>Source File</FieldLabel>
          <BrowseInput value={filePath ?? ''} placeholder="No file selected" onBrowseClick={handleSelectFile} />
        </div>

        {incoming && (
          <div className="space-y-3">
            <FieldLabel>Differences from the current schema</FieldLabel>
            {!currentSchema && (
              <AlertBox variant="info" title="This project has no option schema yet">
                Everything in the file will be added.
              </AlertBox>
            )}
            {currentSchema && !hasDifferences && (
              <AlertBox variant="success" title="The file matches the current schema">
                There is nothing to import.
              </AlertBox>
            )}
            <ItemDiffList rows={rows} accepted={accepted} onChange={setAccepted} />
            {schemaErrors.length > 0 && (
              <AlertBox variant="danger" title="The merged schema is not valid">
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
          </div>
        )}
      </ModalContent>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} className="px-6 text-text-muted font-bold">
          Cancel
        </Button>
        <Button onClick={handleImport} disabled={!incoming || isBusy || accepted.size === 0 || schemaErrors.length > 0}>
          Import {accepted.size > 0 ? `${accepted.size} item(s)` : ''}
        </Button>
      </ModalFooter>
    </>
  );
}
