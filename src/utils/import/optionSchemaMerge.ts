import type { DefinitionDef, GlobalFieldDef, OptionDef, OptionsSchema } from '../../types/options';
import { diffByKey, type ItemDiff } from '../diff/itemDiff';

export type SchemaSection = 'options' | 'globals' | 'definitions';

export const SCHEMA_SECTIONS: readonly SchemaSection[] = ['options', 'globals', 'definitions'];

export const SCHEMA_SECTION_LABELS: Record<SchemaSection, string> = {
  options: 'Options',
  globals: 'Globals',
  definitions: 'Definitions',
};

type SchemaItem = OptionDef | GlobalFieldDef | DefinitionDef;

export interface SchemaItemDiff extends ItemDiff<SchemaItem> {
  /** セクションをまたいで一意な項目 ID。`isAccepted` の判定に使う。 */
  id: string;
  section: SchemaSection;
}

export const schemaItemId = (section: SchemaSection, name: string): string => `${section}:${name}`;

const sectionItems = (schema: OptionsSchema | null, section: SchemaSection): SchemaItem[] =>
  (schema?.[section] as SchemaItem[] | undefined) ?? [];

/**
 * 現在のスキーマと取り込み元のスキーマを、セクションごとに項目名で突き合わせる。
 * 結果はセクション順（options → globals → definitions）で、各セクション内は「現在の項目 → 取り込み元にだけある項目」の順。
 */
export function diffOptionsSchema(current: OptionsSchema | null, incoming: OptionsSchema): SchemaItemDiff[] {
  return SCHEMA_SECTIONS.flatMap((section) =>
    diffByKey(sectionItems(current, section), sectionItems(incoming, section), (item) => item.name).map((d) => ({
      ...d,
      id: schemaItemId(section, d.key),
      section,
    })),
  );
}

/** 差分のうち、既定で取り込む項目の ID。追加と変更は取り込み、現在にだけある項目は残す（削除しない）。 */
export function defaultAcceptedIds(diffs: readonly SchemaItemDiff[]): Set<string> {
  return new Set(diffs.filter((d) => d.status === 'added' || d.status === 'changed').map((d) => d.id));
}

/**
 * `accepted` に含まれる差分を現在のスキーマへ反映したスキーマを返す。
 * - `added`: 取り込み元の項目を末尾に追加する。
 * - `changed`: 取り込み元の項目で置き換える（位置は変えない）。
 * - `removed`: 取り込むと現在の項目を削除する。
 * - 差分のない項目や、`accepted` に含まれない差分は現在のまま。
 */
export function mergeOptionsSchema(diffs: readonly SchemaItemDiff[], accepted: ReadonlySet<string>): OptionsSchema {
  const merge = (section: SchemaSection): SchemaItem[] => {
    const sectionDiffs = diffs.filter((d) => d.section === section);
    const kept: SchemaItem[] = [];
    const appended: SchemaItem[] = [];
    sectionDiffs.forEach((d) => {
      const take = accepted.has(d.id);
      if (d.status === 'added') {
        if (take && d.incoming) appended.push(d.incoming);
      } else if (d.status === 'removed') {
        if (!take && d.current) kept.push(d.current);
      } else if (d.status === 'changed') {
        const item = take ? d.incoming : d.current;
        if (item) kept.push(item);
      } else if (d.current) {
        kept.push(d.current);
      }
    });
    return [...kept, ...appended];
  };

  return {
    options: merge('options') as OptionDef[],
    globals: merge('globals') as GlobalFieldDef[],
    definitions: merge('definitions') as DefinitionDef[],
  };
}
