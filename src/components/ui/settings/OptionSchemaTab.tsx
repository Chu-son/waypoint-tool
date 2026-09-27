import { Plus, Save, Upload, Download, Database, Globe } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { GlobalFieldDef, OptionDef, OptionsSchema } from '../../../types/store';
import { Button } from '../common/Button';
import { TabSectionHeader } from './TabSectionHeader';
import { EmptyState } from '../common/EmptyState';
import { SchemaFieldRow } from './SchemaFieldRow';
import { notify } from '../../../services/notify';
import { toStoredValue } from '../../../utils/optionValues';
import { normalizeOptionsSchema, validateSchema } from '../../../utils/optionSchema';

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

  const [localOptions, setLocalOptions] = useState<OptionDef[]>([]);
  const [localGlobals, setLocalGlobals] = useState<GlobalFieldDef[]>([]);

  useEffect(() => {
    setLocalOptions(globalOptionsSchema?.options || []);
    setLocalGlobals(globalOptionsSchema?.globals || []);
  }, [globalOptionsSchema]);

  const handleSaveOptions = () => {
    // トップレベルのキー重複・空欄、既定値・グローバル値の型不一致、union のバリアント重複や
    // 判別キーとの名前衝突、ref の未定義・循環参照まで、すべて validateSchema が再帰的に検証する。
    const schemaErrors = validateSchema({ options: localOptions, globals: localGlobals });

    if (schemaErrors.length > 0) {
      void notify(`スキーマの定義に誤りがあります。\n${schemaErrors[0].message} (${schemaErrors[0].path})`);
      return;
    }

    // 構造を常に正規形（discriminator の既定値補完、item の既定 {type: 'string'} 補完等）で保存する。
    setGlobalOptionsSchema(
      normalizeOptionsSchema({
        options: localOptions,
        globals: localGlobals.map((g) => ({ ...g, value: toStoredValue(g, g.value) })),
      }),
    );
    useAppStore.setState({ isDirty: true });
    void notify('オプションスキーマを保存しました。');
  };

  const handleAddOption = () => {
    setLocalOptions([
      ...localOptions,
      { name: uniqueFieldName('new_option', localOptions), label: 'New Option', type: 'string', default: '' },
    ]);
  };

  const handleAddGlobal = () => {
    setLocalGlobals([
      ...localGlobals,
      { name: uniqueFieldName('new_global', localGlobals), label: 'New Global', type: 'string', value: '' },
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

      const dataToExport = {
        options: localOptions,
        globals: localGlobals.map((g) => ({ ...g, value: toStoredValue(g, g.value) })),
      };

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
          <SchemaFieldRow
            key={i}
            def={opt}
            groupLabel="Option"
            valueLabel="Default"
            value={opt.default}
            isDuplicateName={localOptions.filter((o) => o.name === opt.name).length > 1}
            onChangeDef={(updates) => handleUpdateOption(i, updates)}
            onChangeValue={(value) => handleUpdateOption(i, { default: value as OptionDef['default'] })}
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
          <SchemaFieldRow
            key={i}
            def={field}
            groupLabel="Global field"
            valueLabel="Value"
            value={field.value}
            isDuplicateName={localGlobals.filter((g) => g.name === field.name).length > 1}
            onChangeDef={(updates) => handleUpdateGlobal(i, updates)}
            onChangeValue={(value) => handleUpdateGlobal(i, { value: value as GlobalFieldDef['value'] })}
            onRemove={() => setLocalGlobals(localGlobals.filter((_, idx) => idx !== i))}
          />
        ))}
        {localGlobals.length === 0 && (
          <EmptyState message="No global fields defined. Click 'Add Global' to create one." />
        )}
      </div>
    </div>
  );
}
