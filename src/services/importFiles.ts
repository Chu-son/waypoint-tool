import { BackendAPI, DialogAPI } from '../api';
import { useAppStore } from '../stores/appStore';
import { migrateAndNormalizeProjectData } from '../stores/migrations/projectMigration';
import type { ExportTemplate } from '../types/export';
import type { OptionsSchema } from '../types/options';
import type { StrictProjectData } from '../types/project';
import { normalizeOptionsSchema } from '../utils/optionSchema';

/**
 * インポート対象ファイルの選択と読み込み。
 * 外部から来たデータはここで検証・正規化し、以降のコードは正規化済みの型だけを扱う（docs/RULES.md §3.1）。
 */

/** 内容をユーザーにそのまま見せてよいエラー（形式不正など）。 */
export class ImportFileError extends Error {}

export type FileFilter = { name: string; extensions: string[] };

export const IMPORT_FILE_FILTERS = {
  waypoints: [{ name: 'Waypoint File', extensions: ['yaml', 'yml', 'json'] }],
  optionSchema: [{ name: 'Options Schema', extensions: ['json', 'yaml', 'yml'] }],
  template: [{ name: 'Waypoint Export Template', extensions: ['wpt_template'] }],
  project: [{ name: 'Waypoint Project', extensions: ['wptroj'] }],
} satisfies Record<string, FileFilter[]>;

const directoryOf = (path: string): string => {
  const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return lastSlash > -1 ? path.substring(0, lastSlash) : path;
};

/** ファイル選択ダイアログを開き、選ばれたパスを返す（キャンセルなら null）。開いたフォルダは次回の初期位置に覚える。 */
export async function pickImportFile(filters: FileFilter[]): Promise<string | null> {
  const store = useAppStore.getState();
  const selected = await DialogAPI.open({
    multiple: false,
    defaultPath: store.lastDirectory || undefined,
    filters,
  });
  if (!selected) return null;
  const path = typeof selected === 'string' ? selected : (selected as { path?: string }).path;
  if (!path) return null;
  store.setLastDirectory(directoryOf(path));
  return path;
}

async function readJson(path: string): Promise<unknown> {
  const text = await BackendAPI.readTextFile(path);
  try {
    return JSON.parse(text);
  } catch {
    throw new ImportFileError('ファイルの形式が不正です（JSONではありません）。');
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** オプションスキーマ（yaml / json）を読み、正規化して返す。 */
export async function readOptionsSchemaFile(path: string): Promise<OptionsSchema> {
  let raw: unknown;
  if (path.endsWith('.yaml') || path.endsWith('.yml')) {
    raw = await BackendAPI.loadOptionsSchema(path);
  } else {
    raw = await readJson(path);
    if (!isRecord(raw) || !Array.isArray(raw.options)) {
      throw new ImportFileError('有効な Options Schema ファイルではありません。');
    }
  }
  // 旧形式（item_type がフラットに置かれた list 等）を含む可能性があるため、必ず正規化を通す。
  return normalizeOptionsSchema(raw);
}

/** `.wpt_template` ファイルの中身。`id` は取り込み時に決まるので持たない。 */
export type TemplateFileData = Omit<ExportTemplate, 'id' | 'scope'>;

/** エクスポートテンプレートファイル（.wpt_template）を読む。 */
export async function readTemplateFile(path: string): Promise<TemplateFileData> {
  const parsed = await readJson(path);
  if (
    !isRecord(parsed) ||
    typeof parsed.name !== 'string' ||
    !parsed.name ||
    typeof parsed.extension !== 'string' ||
    !parsed.extension ||
    typeof parsed.content !== 'string'
  ) {
    throw new ImportFileError('有効な Waypoint テンプレートファイルではありません。');
  }
  return {
    name: parsed.name,
    extension: parsed.extension,
    suffix: typeof parsed.suffix === 'string' ? parsed.suffix : '',
    content: parsed.content,
    // engine が無ければ旧形式のテンプレートとして handlebars 扱いにする。
    engine: parsed.engine === 'jinja' ? 'jinja' : 'handlebars',
  };
}

/** プロジェクトファイル（.wptroj）を読み、現在の形式へ移行・正規化して返す。 */
export async function readProjectFile(path: string): Promise<StrictProjectData> {
  const raw = await BackendAPI.loadProject(path);
  if (!isRecord(raw)) throw new ImportFileError('有効なプロジェクトファイルではありません。');
  return migrateAndNormalizeProjectData(raw);
}
