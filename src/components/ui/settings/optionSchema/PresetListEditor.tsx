import { Plus, Trash2, Replace } from 'lucide-react';
import { useAppStore } from '../../../../stores/appStore';
import { Button } from '../../common/Button';
import { Input } from '../../common/Input';
import { Checkbox } from '../../common/Checkbox';
import { FieldLabel } from '../../common/FieldLabel';
import { OptionValueEditor } from '../../properties/OptionValueEditor';
import { SchemaFieldCell } from './SchemaFieldCell';
import { notify } from '../../../../services/notify';
import { countPresetUsages, replaceMatchingValuesWithPreset, usageCountFor } from '../../../../utils/optionPresets';
import type { PresetDef, TypeSpec } from '../../../../types/options';

/** Returns a `base`, `base_1`, `base_2`... name that no preset in `presets` uses yet. */
function uniquePresetName(base: string, presets: { name: string }[]) {
  let name = base;
  let counter = 1;
  while (presets.some((p) => p.name === name)) {
    name = `${base}_${counter}`;
    counter++;
  }
  return name;
}

/**
 * 型仕様が持つ `presets`（名前付きの値の候補）を編集する。値の変更は、その名前を参照している
 * 全箇所（ウェイポイント・アノテーション・グローバル）に反映される。
 *
 * 使用件数の表示・「一致する値を参照に置換」は、実際のノード値と突き合わせる必要があるため、
 * ローカルの未適用な編集ではなく、ストアに Apply 済みのスキーマに基づく（`isAppliedAndUnchanged`）。
 * `scope` は `optionPresets.ts` の走査と同じ形式（例: `options.tolerance`, `definitions.action`）。
 */
export function PresetListEditor({
  spec,
  onChange,
  scope,
  isAppliedAndUnchanged,
}: {
  spec: TypeSpec;
  onChange: (updates: Partial<TypeSpec>) => void;
  scope: string;
  isAppliedAndUnchanged: boolean;
}) {
  const appliedSchema = useAppStore((s) => s.optionsSchema);
  const nodes = useAppStore((s) => s.nodes);
  const annotationObjects = useAppStore((s) => s.annotationObjects);
  const updateNodes = useAppStore((s) => s.updateNodes);
  const updateAnnotationObject = useAppStore((s) => s.updateAnnotationObject);
  const setOptionsSchema = useAppStore((s) => s.setOptionsSchema);
  const runInHistoryTransaction = useAppStore((s) => s.runInHistoryTransaction);

  const presets = spec.presets ?? [];
  const canCountUsage = isAppliedAndUnchanged && !!appliedSchema;

  const handleAdd = () =>
    onChange({ presets: [...presets, { name: uniquePresetName('preset', presets), value: null }] });
  const handleUpdate = (i: number, updates: Partial<PresetDef>) =>
    onChange({ presets: presets.map((p, idx) => (idx === i ? { ...p, ...updates } : p)) });
  const handleRemove = (i: number) => onChange({ presets: presets.filter((_, idx) => idx !== i) });

  const nodeIds = canCountUsage ? Object.keys(nodes) : [];
  const annotationIds = canCountUsage ? Object.keys(annotationObjects) : [];
  const optionValuesList = canCountUsage
    ? [
        ...nodeIds.map((id) => nodes[id].options ?? {}),
        ...annotationIds.map((id) => annotationObjects[id].options ?? {}),
      ]
    : [];
  const globalValues = canCountUsage
    ? Object.fromEntries((appliedSchema!.globals ?? []).map((g) => [g.name, g.value]))
    : {};
  const usageCounts = canCountUsage ? countPresetUsages(appliedSchema!, optionValuesList, globalValues) : null;

  const handleReplace = (preset: PresetDef) => {
    if (!appliedSchema) return;
    const result = replaceMatchingValuesWithPreset(
      appliedSchema,
      optionValuesList,
      globalValues,
      scope,
      spec,
      preset.name,
    );
    if (result.count === 0) {
      void notify('一致する値は見つかりませんでした。');
      return;
    }
    runInHistoryTransaction(() => {
      const nodeUpdates: Record<string, { options: (typeof result.optionValuesList)[number] }> = {};
      nodeIds.forEach((id, i) => {
        nodeUpdates[id] = { options: result.optionValuesList[i] };
      });
      if (Object.keys(nodeUpdates).length > 0) updateNodes(nodeUpdates);
      annotationIds.forEach((id, i) => {
        updateAnnotationObject(id, { options: result.optionValuesList[nodeIds.length + i] });
      });
      if (Object.keys(globalValues).length > 0) {
        setOptionsSchema({
          ...appliedSchema,
          globals: appliedSchema.globals.map((g) => ({ ...g, value: result.globalValues[g.name] })),
        });
      }
    });
    void notify(`${result.count} 件を「${preset.label || preset.name}」への参照に置き換えました。`);
  };

  // 置換で実際に変わる件数（まだ参照になっていない、値が完全に一致するものだけ）のプレビュー。
  // 実際の置換と同じ関数で数えるので、ボタンを押した結果と表示が食い違わない。
  const matchCountFor = (preset: PresetDef) =>
    canCountUsage
      ? replaceMatchingValuesWithPreset(appliedSchema!, optionValuesList, globalValues, scope, spec, preset.name).count
      : 0;

  return (
    <SchemaFieldCell label="Presets（名前付きの値の候補）">
      <div className="space-y-2">
        {presets.map((p, i) => {
          const count = usageCounts ? usageCountFor(usageCounts, scope, p.name) : null;
          const matchCount = count !== null ? matchCountFor(p) : 0;
          return (
            <div
              key={i}
              className="flex gap-2 items-start bg-surface-base/40 p-2.5 rounded-lg border border-border-base/20"
            >
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="text"
                    aria-label={`${scope} preset[${i}] name`}
                    value={p.name}
                    onChange={(e) =>
                      handleUpdate(i, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() })
                    }
                    className="h-7 text-[12px] font-mono"
                    placeholder="e.g. small"
                  />
                  <Input
                    type="text"
                    aria-label={`${scope} preset[${i}] label`}
                    value={p.label || ''}
                    onChange={(e) => handleUpdate(i, { label: e.target.value || undefined })}
                    className="h-7 text-[12px]"
                    placeholder="e.g. Small"
                  />
                </div>
                <OptionValueEditor
                  spec={{ ...spec, presets: undefined, preset_only: false }}
                  value={p.value}
                  onChange={(v) => handleUpdate(i, { value: v ?? null })}
                  name={`${scope} preset[${i}] value`}
                  showResetControl={false}
                />
                {count !== null && (
                  <p className="text-[10px] text-text-muted">
                    使用中: {count}件
                    {matchCount > 0 && (
                      <>
                        {' '}
                        （一致する未参照の値: {matchCount}件）{' '}
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 underline text-primary-base hover:text-primary-hover"
                          onClick={() => handleReplace(p)}
                        >
                          <Replace size={10} /> 一致する値を参照に置換
                        </button>
                      </>
                    )}
                  </p>
                )}
                {!canCountUsage && (
                  <p className="text-[10px] text-text-muted italic">Apply 後に使用件数・一括置換を利用できます。</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${scope} preset[${i}]`}
                onClick={() => handleRemove(i)}
                className="text-text-muted hover:text-danger-base hover:bg-danger-base/10"
              >
                <Trash2 size={13} />
              </Button>
            </div>
          );
        })}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="xs" onClick={handleAdd} className="text-primary-base hover:bg-primary-base/10">
            <Plus size={12} className="mr-1" /> Add Preset
          </Button>
          {presets.length > 0 && (
            <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <Checkbox
                aria-label={`${scope} preset only`}
                checked={!!spec.preset_only}
                onChange={(e) => onChange({ preset_only: e.target.checked || undefined })}
              />
              <FieldLabel className="normal-case">プリセットからのみ選択可能にする</FieldLabel>
            </label>
          )}
        </div>
      </div>
    </SchemaFieldCell>
  );
}
