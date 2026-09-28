import { Plus, Save, Upload, Download, Database, Globe, BookMarked } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { DefinitionDef, GlobalFieldDef, OptionDef, OptionsSchema, OptionValue } from '../../../types/store';
import { Button } from '../common/Button';
import { TabSectionHeader } from './TabSectionHeader';
import { EmptyState } from '../common/EmptyState';
import { FieldEditor } from './optionSchema/FieldEditor';
import { DefinitionListEditor } from './optionSchema/DefinitionListEditor';
import { confirmAction, notify } from '../../../services/notify';
import { normalizeOptionsSchema, validateSchema } from '../../../utils/optionSchema';
import { collectPresetScopes, inlineRemovedPresets } from '../../../utils/optionPresets';

// `optionsSchema.definitions` が無いスキーマでは `?? []` の代わりにこの安定した参照を使う。
// 呼び出しの度に新しい配列を作ってしまうと、`isAppliedAndUnchanged` の参照比較が常に偽になる。
const EMPTY_DEFINITIONS: DefinitionDef[] = [];

/** Returns a `base`, `base_1`, `base_2`... key that no field in `fields` uses yet. */
function uniqueFieldName(base: string, fields: { name: string }[]) {
  let name = base;
  let counter = 1;
  while (fields.some((f) => f.name === name)) {
    name = `${base}_${counter}`;
    counter++;
  }
  return name;
}

export function OptionSchemaTab() {
  const globalOptionsSchema = useAppStore((state) => state.optionsSchema);
  const setGlobalOptionsSchema = useAppStore((state) => state.setOptionsSchema);
  const lastDirectory = useAppStore((state) => state.lastDirectory);
  const nodes = useAppStore((state) => state.nodes);
  const annotationObjects = useAppStore((state) => state.annotationObjects);
  const updateNodes = useAppStore((state) => state.updateNodes);
  const updateAnnotationObject = useAppStore((state) => state.updateAnnotationObject);
  const runInHistoryTransaction = useAppStore((state) => state.runInHistoryTransaction);

  const [localOptions, setLocalOptions] = useState<OptionDef[]>([]);
  const [localGlobals, setLocalGlobals] = useState<GlobalFieldDef[]>([]);
  const [localDefinitions, setLocalDefinitions] = useState<DefinitionDef[]>([]);

  useEffect(() => {
    setLocalOptions(globalOptionsSchema?.options || []);
    setLocalGlobals(globalOptionsSchema?.globals || []);
    setLocalDefinitions(globalOptionsSchema?.definitions || EMPTY_DEFINITIONS);
  }, [globalOptionsSchema]);

  const definitionNames = localDefinitions.map((d) => d.name).filter((n) => n.trim() !== '');

  // ローカルの編集内容が、直近に Apply/Import したスキーマと（参照として）一致しているか。
  // Apply/Import 直後は上の useEffect が globalOptionsSchema の配列をそのまま local state にコピーするため、
  // 一致していれば参照が同一になる。プリセットの使用件数・一括置換は、実際のノード値と対応が取れている
  // このときだけ有効にする（未適用の編集中はノードの値がまだ古いスキーマの構造のままのため）。
  const isAppliedAndUnchanged =
    !!globalOptionsSchema &&
    localOptions === globalOptionsSchema.options &&
    localGlobals === globalOptionsSchema.globals &&
    localDefinitions === (globalOptionsSchema.definitions ?? EMPTY_DEFINITIONS);

  const handleSaveOptions = async () => {
    // トップレベルのキー重複・空欄、既定値・グローバル値の型不一致、union のバリアント重複や
    // 判別キーとの名前衝突、ref の未定義・循環参照まで、すべて validateSchema が再帰的に検証する。
    const schemaErrors = validateSchema({
      options: localOptions,
      globals: localGlobals,
      definitions: localDefinitions,
    });

    if (schemaErrors.length > 0) {
      void notify(`スキーマの定義に誤りがあります。\n${schemaErrors[0].message} (${schemaErrors[0].path})`);
      return;
    }

    // 構造を常に正規形（discriminator の既定値補完、item の既定 {type: 'string'} 補完等）で保存する。
    const normalized = normalizeOptionsSchema({
      options: localOptions,
      globals: localGlobals,
      definitions: localDefinitions,
    });

    // 直前に Apply されていたスキーマと比べて、消えたプリセット（フィールド自体の削除・改名を含む）が
    // あれば、それを参照している値をプリセットの実際の値に展開する。展開しないまま Apply すると、
    // 値が `$preset` を指したままになり、そのプリセットの定義が無くなってエクスポート結果が壊れてしまう。
    if (globalOptionsSchema) {
      const oldScopes = collectPresetScopes(globalOptionsSchema);
      const newScopes = collectPresetScopes(normalized);
      const removals: { scope: string; name: string; value: OptionValue }[] = [];
      oldScopes.forEach((oldPresets, scope) => {
        const newNames = new Set((newScopes.get(scope) ?? []).map((p) => p.name));
        oldPresets.forEach((p) => {
          if (!newNames.has(p.name)) removals.push({ scope, name: p.name, value: p.value });
        });
      });

      if (removals.length > 0) {
        const nodeIds = Object.keys(nodes);
        const annotationIds = Object.keys(annotationObjects);
        const optionValuesList = [
          ...nodeIds.map((id) => nodes[id].options ?? {}),
          ...annotationIds.map((id) => annotationObjects[id].options ?? {}),
        ];
        const oldGlobalValues = Object.fromEntries(globalOptionsSchema.globals.map((g) => [g.name, g.value]));
        const result = inlineRemovedPresets(globalOptionsSchema, optionValuesList, oldGlobalValues, removals);

        if (result.count > 0) {
          const proceed = await confirmAction(
            `削除されたプリセットへの参照が ${result.count} 件あります。実際の値に展開してから保存しますか？`,
          );
          if (!proceed) return;

          runInHistoryTransaction(() => {
            const nodeUpdates: Record<string, { options: (typeof result.optionValuesList)[number] }> = {};
            nodeIds.forEach((id, i) => {
              nodeUpdates[id] = { options: result.optionValuesList[i] };
            });
            if (Object.keys(nodeUpdates).length > 0) updateNodes(nodeUpdates);
            annotationIds.forEach((id, i) => {
              updateAnnotationObject(id, { options: result.optionValuesList[nodeIds.length + i] });
            });
          });
          normalized.globals = normalized.globals.map((g) => ({ ...g, value: result.globalValues[g.name] }));
        }
      }
    }

    setGlobalOptionsSchema(normalized);
    useAppStore.setState({ isDirty: true });
    void notify('オプションスキーマを保存しました。');
  };

  const handleAddOption = () => {
    setLocalOptions([
      ...localOptions,
      { name: uniqueFieldName('new_option', localOptions), label: 'New Option', type: 'string' },
    ]);
  };

  const handleAddGlobal = () => {
    setLocalGlobals([
      ...localGlobals,
      { name: uniqueFieldName('new_global', localGlobals), label: 'New Global', type: 'string' },
    ]);
  };

  const handleUpdateOption = (index: number, updates: Partial<OptionDef>) => {
    setLocalOptions(localOptions.map((opt, i) => (i === index ? { ...opt, ...updates } : opt)));
  };

  const handleUpdateGlobal = (index: number, updates: Partial<GlobalFieldDef>) => {
    setLocalGlobals(localGlobals.map((g, i) => (i === index ? { ...g, ...updates } : g)));
  };

  const handleExportSchema = async () => {
    try {
      const { DialogAPI, BackendAPI } = await import('../../../api');
      const savePath = await DialogAPI.save({
        defaultPath: 'options_schema.json',
        filters: [{ name: 'Options Schema', extensions: ['json'] }],
      });
      if (!savePath) return;

      const dataToExport = { options: localOptions, globals: localGlobals, definitions: localDefinitions };

      await BackendAPI.writeTextFile(savePath, JSON.stringify(dataToExport, null, 2));
      void notify('オプションスキーマをエクスポートしました。');
    } catch (err) {
      console.error('Failed to export options schema:', err);
      void notify(`エクスポートに失敗しました。\n詳細: ${String(err)}`);
    }
  };

  const handleImportSchema = async () => {
    try {
      const { DialogAPI, BackendAPI } = await import('../../../api');
      const selectedPath = await DialogAPI.open({
        multiple: false,
        defaultPath: lastDirectory || undefined,
        filters: [
          {
            name: 'Options Schema',
            extensions: ['json', 'yaml', 'yml'],
          },
        ],
      });
      if (!selectedPath) return;

      const pathStr = typeof selectedPath === 'string' ? selectedPath : (selectedPath as any).path;
      if (!pathStr) return;

      const lastSlash = Math.max(pathStr.lastIndexOf('/'), pathStr.lastIndexOf('\\'));
      const dir = lastSlash > -1 ? pathStr.substring(0, lastSlash) : pathStr;
      useAppStore.getState().setLastDirectory(dir);

      let rawSchema: any;

      if (pathStr.endsWith('.yaml') || pathStr.endsWith('.yml')) {
        rawSchema = await BackendAPI.loadOptionsSchema(pathStr);
      } else {
        const fileContent = await BackendAPI.readTextFile(pathStr);
        let parsed: any;
        try {
          parsed = JSON.parse(fileContent);
        } catch {
          void notify('ファイルの形式が不正です（JSONではありません）。');
          return;
        }
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.options)) {
          void notify('有効な Options Schema ファイルではありません。');
          return;
        }
        rawSchema = parsed;
      }

      // 旧形式（item_type がフラットに置かれた list 等）を含む可能性があるため、必ず正規化を通す。
      const schema: OptionsSchema = normalizeOptionsSchema(rawSchema);
      setLocalOptions(schema.options);
      setLocalGlobals(schema.globals);
      setLocalDefinitions(schema.definitions || []);
      void notify('オプションスキーマをインポートしました。');
    } catch (err) {
      console.error('Failed to import options schema:', err);
      void notify(`インポートに失敗しました。\n詳細: ${String(err)}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <TabSectionHeader
        title="Waypoint Options Schema"
        subtitle="Define custom properties that can be attached to waypoints."
        icon={Database}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleImportSchema}>
              <Upload size={14} className="mr-1" /> Import
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportSchema}>
              <Download size={14} className="mr-1" /> Export
            </Button>
            <Button variant="secondary" size="sm" onClick={handleAddOption}>
              <Plus size={14} className="mr-1" /> Add Field
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveOptions}>
              <Save size={14} className="mr-1" /> Apply
            </Button>
          </>
        }
      />

      <div className="space-y-3 px-1">
        {localOptions.map((opt, i) => (
          <FieldEditor
            key={i}
            field={opt}
            groupLabel="Option"
            valueLabel="Default"
            value={opt.default}
            definitionNames={definitionNames}
            scope={`options.${opt.name}`}
            isAppliedAndUnchanged={isAppliedAndUnchanged}
            isDuplicateName={localOptions.filter((o) => o.name === opt.name).length > 1}
            onChangeField={(updates) => handleUpdateOption(i, updates)}
            onChangeValue={(value) => handleUpdateOption(i, { default: value })}
            onRemove={() => setLocalOptions(localOptions.filter((_, idx) => idx !== i))}
          />
        ))}
        {localOptions.length === 0 && (
          <EmptyState message="No custom options defined. Click 'Add Field' to create one." />
        )}
      </div>

      <TabSectionHeader
        title="Global Fields"
        subtitle="Project-wide values, not tied to a waypoint. Reference them in export templates as {{globals.name}}."
        icon={Globe}
        actions={
          <Button variant="secondary" size="sm" onClick={handleAddGlobal}>
            <Plus size={14} className="mr-1" /> Add Global
          </Button>
        }
      />

      <div className="space-y-3 px-1">
        {localGlobals.map((field, i) => (
          <FieldEditor
            key={i}
            field={field}
            groupLabel="Global field"
            valueLabel="Value"
            value={field.value}
            definitionNames={definitionNames}
            scope={`globals.${field.name}`}
            isAppliedAndUnchanged={isAppliedAndUnchanged}
            isDuplicateName={localGlobals.filter((g) => g.name === field.name).length > 1}
            onChangeField={(updates) => handleUpdateGlobal(i, updates)}
            onChangeValue={(value) => handleUpdateGlobal(i, { value })}
            onRemove={() => setLocalGlobals(localGlobals.filter((_, idx) => idx !== i))}
          />
        ))}
        {localGlobals.length === 0 && (
          <EmptyState message="No global fields defined. Click 'Add Global' to create one." />
        )}
      </div>

      <TabSectionHeader
        title="Definitions"
        subtitle="Named, reusable types. Reference them from any field's type as Ref, to avoid repeating the same structure (e.g. a shared action union) in several places."
        icon={BookMarked}
      />

      <div className="px-1">
        <DefinitionListEditor
          definitions={localDefinitions}
          onChange={setLocalDefinitions}
          isAppliedAndUnchanged={isAppliedAndUnchanged}
        />
      </div>
    </div>
  );
}
