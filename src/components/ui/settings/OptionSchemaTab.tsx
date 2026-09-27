import { Plus, Save, Upload, Download, Database, Globe } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { GlobalFieldDef, OptionDef, OptionsSchema } from '../../../types/store';
import { Button } from '../common/Button';
import { TabSectionHeader } from './TabSectionHeader';
import { EmptyState } from '../common/EmptyState';
import { SchemaFieldRow } from './SchemaFieldRow';
import { notify } from '../../../services/notify';
import { isOptionValueValid, toStoredOptionValue } from '../../../utils/optionValues';

const hasDuplicates = (names: string[]) => new Set(names).size !== names.length;

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
    const hasEmptyName = [...localOptions, ...localGlobals].some((f) => f.name.trim() === '');
    const hasDuplicateOptions = hasDuplicates(localOptions.map((opt) => opt.name));
    const hasDuplicateGlobals = hasDuplicates(localGlobals.map((g) => g.name));
    const hasInvalidDefaults = localOptions.some((opt) => !isOptionValueValid(opt.type, opt.default));
    const hasInvalidGlobalValues = localGlobals.some((g) => !isOptionValueValid(g.type, g.value));

    if (hasEmptyName) {
      void notify('Key Name cannot be empty.');
      return;
    }
    if (hasDuplicateOptions || hasDuplicateGlobals) {
      void notify('Key Names must be unique. Duplicate keys found.');
      return;
    }
    if (hasInvalidDefaults) {
      void notify('Some options have default values that do not match their type.');
      return;
    }
    if (hasInvalidGlobalValues) {
      void notify('Some global fields have values that do not match their type.');
      return;
    }

    setGlobalOptionsSchema({
      options: localOptions,
      globals: localGlobals.map((g) => ({ ...g, value: toStoredOptionValue(g.value, g.type) })),
    });
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
        globals: localGlobals.map((g) => ({ ...g, value: toStoredOptionValue(g.value, g.type) })),
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

      let schema: OptionsSchema;

      if (pathStr.endsWith('.yaml') || pathStr.endsWith('.yml')) {
        schema = await BackendAPI.loadOptionsSchema(pathStr);
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
        schema = parsed as OptionsSchema;
      }

      setLocalOptions(schema.options || []);
      // 外部ファイルの globals は任意項目。無ければ空として扱う。
      setLocalGlobals(Array.isArray(schema.globals) ? schema.globals : []);
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
