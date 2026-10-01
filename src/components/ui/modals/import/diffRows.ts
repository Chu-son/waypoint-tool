import type { ExportProfile, ExportTemplate } from '../../../../types/export';
import { diffLines } from '../../../../utils/diff/lineDiff';
import { diffValues, toDiffText, type ItemDiff } from '../../../../utils/diff/itemDiff';
import { SCHEMA_SECTION_LABELS, type SchemaItemDiff } from '../../../../utils/import/optionSchemaMerge';
import type { TemplateImportItem } from '../../../../utils/import/projectImportPlan';
import type { ItemDiffRow } from '../../common/ItemDiffList';

/** テンプレートの内容以外の設定（拡張子・接尾辞・エンジン）を、差分表示用のテキストにする。 */
export const templatePropertiesText = (t: Pick<ExportTemplate, 'extension' | 'suffix' | 'engine'>): string =>
  toDiffText({ extension: t.extension, suffix: t.suffix, engine: t.engine ?? 'handlebars' });

/** 設定部分と本文をつなげた、テンプレート全体の差分表示用テキスト。 */
const templateText = (t: Pick<ExportTemplate, 'extension' | 'suffix' | 'engine' | 'content'>): string =>
  `${templatePropertiesText(t)}\n\n${t.content}`;

/** テンプレートの取り込み候補を、`ItemDiffList` の行にする（取り込み元の ID を行の ID に使う）。 */
export function templateDiffRows(items: readonly TemplateImportItem[]): ItemDiffRow[] {
  return items.map((item) => ({
    id: item.incoming.id,
    label: item.incoming.name,
    description: item.match
      ? `${item.status === 'unchanged' ? 'Same as' : 'Overwrites'} the ${item.match.scope === 'local' ? 'local' : 'global'} template`
      : 'Added as a local template',
    status: item.status,
    lines:
      item.match && item.status === 'changed'
        ? diffLines(templateText(item.match), templateText(item.incoming))
        : undefined,
  }));
}

/** `ItemDiff` の現在 → 取り込み元の行差分。変更のある行だけ付ける。 */
const linesOf = <T>(d: ItemDiff<T>) => (d.status === 'unchanged' ? undefined : diffValues(d.current, d.incoming));

/** オプションスキーマの項目差分を、`ItemDiffList` の行にする。 */
export function schemaDiffRows(diffs: readonly SchemaItemDiff[]): ItemDiffRow[] {
  return diffs.map((d) => {
    const item = d.incoming ?? d.current;
    return {
      id: d.id,
      label: d.key,
      description: `${SCHEMA_SECTION_LABELS[d.section]} · ${item && 'type' in item ? item.type : ''}`,
      status: d.status,
      lines: linesOf(d),
      actionLabel: d.status === 'removed' ? `Remove ${d.section}:${d.key}` : `Import ${d.section}:${d.key}`,
    };
  });
}

/** エクスポートプロファイルの差分を、`ItemDiffList` の行にする（取り込み元の ID を行の ID に使う）。 */
export function profileDiffRows(diffs: readonly ItemDiff<ExportProfile>[]): ItemDiffRow[] {
  return diffs
    .filter((d) => d.incoming)
    .map((d) => ({
      id: d.incoming!.id,
      label: d.key,
      description: `${d.incoming!.items.length} item(s)`,
      status: d.status,
      lines: linesOf(d),
    }));
}
