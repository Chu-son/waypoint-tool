import { Plus, Save, Upload, Download, Database, Globe, BookMarked } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { DefinitionDef, GlobalFieldDef, OptionDef } from '../../../types/store';
import { Button } from '../common/Button';
import { TabSectionHeader } from './TabSectionHeader';
import { EmptyState } from '../common/EmptyState';
import { FieldEditor } from './optionSchema/FieldEditor';
import { SchemaGlobalsContext } from './optionSchema/SchemaGlobalsContext';
import { DefinitionListEditor } from './optionSchema/DefinitionListEditor';
import { confirmAction, notify } from '../../../services/notify';
import { applyOptionsSchema } from '../../../services/optionSchemaApply';
import { collectGlobalDefaultLinks } from '../../../utils/optionSchema';
import { deepEqual } from '../../../utils/optionValues';

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
  const setImportModalOpen = useAppStore((state) => state.setImportModalOpen);

  const [localOptions, setLocalOptions] = useState<OptionDef[]>([]);
  const [localGlobals, setLocalGlobals] = useState<GlobalFieldDef[]>([]);
  const [localDefinitions, setLocalDefinitions] = useState<DefinitionDef[]>([]);

  useEffect(() => {
    setLocalOptions(globalOptionsSchema?.options || []);
    setLocalGlobals(globalOptionsSchema?.globals || []);
    setLocalDefinitions(globalOptionsSchema?.definitions || EMPTY_DEFINITIONS);
  }, [globalOptionsSchema]);

  const globalsContext = useMemo(
    () => ({ globals: localGlobals, linkedFields: collectGlobalDefaultLinks(localOptions, localDefinitions) }),
    [localGlobals, localOptions, localDefinitions],
  );

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
    const applied = await applyOptionsSchema({
      options: localOptions,
      globals: localGlobals,
      definitions: localDefinitions,
    });
    if (applied) void notify('オプションスキーマを保存しました。');
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

  // Apply していない編集があるか。インポートはストアのスキーマへ直接反映するので、この編集は上書きされる。
  const hasUnappliedEdits = !deepEqual(
    { options: localOptions, globals: localGlobals, definitions: localDefinitions },
    {
      options: globalOptionsSchema?.options ?? [],
      globals: globalOptionsSchema?.globals ?? [],
      definitions: globalOptionsSchema?.definitions ?? [],
    },
  );

  const handleImportSchema = async () => {
    if (hasUnappliedEdits) {
      const proceed = await confirmAction(
        '適用していない編集内容があります。インポートすると、この編集内容は破棄されます。続けますか？',
      );
      if (!proceed) return;
    }
    setImportModalOpen(true, 'optionSchema');
  };

  return (
    <SchemaGlobalsContext.Provider value={globalsContext}>
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
              <Button variant="primary" size="sm" onClick={handleSaveOptions}>
                <Save size={14} className="mr-1" /> Apply
              </Button>
            </>
          }
        />

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
          title="Waypoint Options"
          subtitle="Per-waypoint properties. A field can be left unset on a waypoint and fall back to its default."
          icon={Database}
          actions={
            <Button variant="secondary" size="sm" onClick={handleAddOption}>
              <Plus size={14} className="mr-1" /> Add Field
            </Button>
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
    </SchemaGlobalsContext.Provider>
  );
}
