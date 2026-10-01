import { useAppStore } from '../stores/appStore';
import type { OptionsSchema, OptionValue } from '../types/options';
import { collectPresetScopes, inlineRemovedPresets } from '../utils/optionPresets';
import { normalizeOptionsSchema, validateSchema } from '../utils/optionSchema';
import { confirmAction, notify } from './notify';

/**
 * オプションスキーマをプロジェクトへ適用する。設定画面の Apply と、インポートの両方が使う。
 *
 * 1. 検証（ref の未定義・循環、型の不一致など）。エラーがあれば適用せず、理由を知らせる。
 * 2. 正規形にそろえる。
 * 3. 直前のスキーマから消えたプリセットを参照している値は、プリセットの実際の値に展開する。
 *    展開しないと値が `$preset` を指したままになり、定義が無くなってエクスポート結果が壊れる。
 *    展開が必要なときは確認を取り、断られたら何も変えない。
 *
 * @returns 適用したかどうか。
 */
export async function applyOptionsSchema(schema: OptionsSchema): Promise<boolean> {
  const schemaErrors = validateSchema(schema);
  if (schemaErrors.length > 0) {
    void notify(`スキーマの定義に誤りがあります。\n${schemaErrors[0].message} (${schemaErrors[0].path})`);
    return false;
  }

  const normalized = normalizeOptionsSchema(schema);
  const state = useAppStore.getState();
  const previous = state.optionsSchema;

  if (previous) {
    const oldScopes = collectPresetScopes(previous);
    const newScopes = collectPresetScopes(normalized);
    const removals: { scope: string; name: string; value: OptionValue }[] = [];
    oldScopes.forEach((oldPresets, scope) => {
      const newNames = new Set((newScopes.get(scope) ?? []).map((p) => p.name));
      oldPresets.forEach((p) => {
        if (!newNames.has(p.name)) removals.push({ scope, name: p.name, value: p.value });
      });
    });

    if (removals.length > 0) {
      const { nodes, annotationObjects } = state;
      const nodeIds = Object.keys(nodes);
      const annotationIds = Object.keys(annotationObjects);
      const optionValuesList = [
        ...nodeIds.map((id) => nodes[id].options ?? {}),
        ...annotationIds.map((id) => annotationObjects[id].options ?? {}),
      ];
      const oldGlobalValues = Object.fromEntries(previous.globals.map((g) => [g.name, g.value]));
      const result = inlineRemovedPresets(previous, optionValuesList, oldGlobalValues, removals);

      if (result.count > 0) {
        const proceed = await confirmAction(
          `削除されたプリセットへの参照が ${result.count} 件あります。実際の値に展開してから保存しますか？`,
        );
        if (!proceed) return false;

        state.runInHistoryTransaction(() => {
          const nodeUpdates: Record<string, { options: (typeof result.optionValuesList)[number] }> = {};
          nodeIds.forEach((id, i) => {
            nodeUpdates[id] = { options: result.optionValuesList[i] };
          });
          if (Object.keys(nodeUpdates).length > 0) state.updateNodes(nodeUpdates);
          annotationIds.forEach((id, i) => {
            state.updateAnnotationObject(id, { options: result.optionValuesList[nodeIds.length + i] });
          });
        });
        normalized.globals = normalized.globals.map((g) => ({ ...g, value: result.globalValues[g.name] }));
      }
    }
  }

  useAppStore.getState().setOptionsSchema(normalized);
  return true;
}
