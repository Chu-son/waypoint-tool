import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../stores/appStore';
import type { ExportTemplate } from '../types/export';
import type { TemplateFileData } from './importFiles';

export type TemplateImportAction = 'overwrite' | 'add';

/**
 * 読み込んだテンプレートを取り込む。
 * - `overwrite`: `match` の内容を置き換える。ID とスコープ（グローバル／ローカル）は変えない。
 * - `add`: 新しいテンプレートとして、指定したスコープで追加する。
 */
export function applyTemplateImport(
  data: TemplateFileData,
  options: { action: 'overwrite'; match: ExportTemplate } | { action: 'add'; name: string; scope: 'global' | 'local' },
): void {
  const { addExportTemplate, updateExportTemplate } = useAppStore.getState();
  const body = {
    extension: data.extension,
    suffix: data.suffix,
    content: data.content,
    engine: data.engine,
  };
  if (options.action === 'overwrite') {
    updateExportTemplate(options.match.id, { ...body, name: data.name });
  } else {
    addExportTemplate({ id: uuidv4(), name: options.name, scope: options.scope, ...body });
  }
}
