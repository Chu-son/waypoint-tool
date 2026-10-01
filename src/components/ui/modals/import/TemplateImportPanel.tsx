import { useMemo, useState } from 'react';
import { useAppStore } from '../../../../stores/appStore';
import { ModalContent, ModalFooter } from '../../common/Modal';
import { Button } from '../../common/Button';
import { FieldLabel } from '../../common/FieldLabel';
import { BrowseInput } from '../../common/BrowseInput';
import { AlertBox } from '../../common/AlertBox';
import { Input } from '../../common/Input';
import { Select } from '../../common/Select';
import { TextDiffView } from '../../common/TextDiffView';
import {
  IMPORT_FILE_FILTERS,
  ImportFileError,
  pickImportFile,
  readTemplateFile,
  type TemplateFileData,
} from '../../../../services/importFiles';
import { notify, notifyError } from '../../../../services/notify';
import { applyTemplateImport, type TemplateImportAction } from '../../../../services/templateImport';
import { diffLines } from '../../../../utils/diff/lineDiff';
import { diffTemplates } from '../../../../utils/import/projectImportPlan';
import { templatePropertiesText } from './diffRows';
import type { ImportPanelProps } from './types';

/**
 * エクスポートテンプレートのファイル（.wpt_template）を取り込む。
 * 同じ名前のテンプレートがあれば内容の差分を見せ、上書きするか別のテンプレートとして追加するかを選ばせる。
 */
export function TemplateImportPanel({ onClose }: ImportPanelProps) {
  const exportTemplates = useAppStore((state) => state.exportTemplates);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [data, setData] = useState<TemplateFileData | null>(null);
  const [action, setAction] = useState<TemplateImportAction>('add');
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'global' | 'local'>('global');

  const item = useMemo(
    () => (data ? diffTemplates(exportTemplates, [{ ...data, id: 'incoming' }])[0] : null),
    [data, exportTemplates],
  );
  const match = item?.match;

  const handleSelectFile = async () => {
    const path = await pickImportFile(IMPORT_FILE_FILTERS.template);
    if (!path) return;
    setFilePath(path);
    try {
      const file = await readTemplateFile(path);
      const existing = exportTemplates.find((t) => t.name === file.name);
      setData(file);
      setAction(existing ? 'overwrite' : 'add');
      setName(existing ? `${file.name} (Imported)` : file.name);
      setScope('global');
    } catch (err) {
      setData(null);
      void notifyError(err instanceof ImportFileError ? err.message : `読み込みに失敗しました。\n詳細: ${String(err)}`);
    }
  };

  const handleImport = () => {
    if (!data) return;
    if (action === 'overwrite' && match) applyTemplateImport(data, { action: 'overwrite', match });
    else applyTemplateImport(data, { action: 'add', name: name.trim() || data.name, scope });
    void notify('テンプレートを取り込みました。');
    onClose();
  };

  const isIdentical = item?.status === 'unchanged';

  return (
    <>
      <ModalContent className="space-y-6 p-6">
        <div className="space-y-3">
          <FieldLabel>Source File</FieldLabel>
          <BrowseInput value={filePath ?? ''} placeholder="No file selected" onBrowseClick={handleSelectFile} />
        </div>

        {data && item && (
          <div className="space-y-4">
            {!match && (
              <AlertBox variant="info" title={`"${data.name}" is a new template`}>
                No template with this name exists yet.
              </AlertBox>
            )}
            {match && isIdentical && (
              <AlertBox variant="success" title={`"${data.name}" is already up to date`}>
                The {match.scope === 'local' ? 'local' : 'global'} template with this name has the same content.
              </AlertBox>
            )}
            {match && !isIdentical && (
              <AlertBox
                variant="warning"
                title={`A ${match.scope === 'local' ? 'local' : 'global'} template named "${data.name}" already exists`}
              >
                Review the changes below, then choose whether to overwrite it or to add the file as a new template.
              </AlertBox>
            )}

            {match && !isIdentical && (
              <div className="space-y-3">
                <FieldLabel>Properties</FieldLabel>
                <TextDiffView
                  lines={diffLines(templatePropertiesText(match), templatePropertiesText(data))}
                  aria-label="Property changes"
                />
                <FieldLabel>Content</FieldLabel>
                <TextDiffView lines={diffLines(match.content, data.content)} aria-label="Content changes" />
              </div>
            )}

            {match && !isIdentical && (
              <fieldset className="space-y-1.5">
                <legend className="sr-only">Import action</legend>
                <label className="flex items-center gap-2 cursor-pointer text-[13px] text-text-base">
                  <input
                    type="radio"
                    name="templateImportAction"
                    checked={action === 'overwrite'}
                    onChange={() => setAction('overwrite')}
                  />
                  Overwrite the existing template
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-[13px] text-text-base">
                  <input
                    type="radio"
                    name="templateImportAction"
                    checked={action === 'add'}
                    onChange={() => setAction('add')}
                  />
                  Add as a new template
                </label>
              </fieldset>
            )}

            {action === 'add' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <FieldLabel htmlFor="template-import-name">Name</FieldLabel>
                  <Input id="template-import-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <FieldLabel htmlFor="template-import-scope">Scope</FieldLabel>
                  <Select
                    id="template-import-scope"
                    value={scope}
                    onChange={(e) => setScope(e.target.value as 'global' | 'local')}
                  >
                    <option value="global">Global (all projects)</option>
                    <option value="local">Local (this project only)</option>
                  </Select>
                </div>
              </div>
            )}
          </div>
        )}
      </ModalContent>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} className="px-6 text-text-muted font-bold">
          Cancel
        </Button>
        <Button onClick={handleImport} disabled={!data || (isIdentical && action === 'overwrite')}>
          Import
        </Button>
      </ModalFooter>
    </>
  );
}
