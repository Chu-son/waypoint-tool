import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Checkbox } from '../common/Checkbox';
import { FieldLabel } from '../common/FieldLabel';
import { cn } from '../../../utils/cn';
import { createValue, switchUnionVariant } from '../../../utils/optionValues';
import type { FieldDef, OptionValue, TypeSpec, VariantDef } from '../../../types/options';

const beginTx = () => useAppStore.getState().beginHistoryTransaction();
const endTx = () => useAppStore.getState().endHistoryTransaction();
const runTx = (fn: () => void) => useAppStore.getState().runInHistoryTransaction(fn);

const isScalarType = (t: TypeSpec['type']) => t === 'string' || t === 'float' || t === 'integer' || t === 'boolean';

function isRecord(v: unknown): v is Record<string, OptionValue> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export interface OptionValueEditorProps {
  spec: TypeSpec;
  value: OptionValue | undefined;
  onChange: (value: OptionValue | undefined) => void;
  /** Accessible-name prefix for the input(s) rendered at this level. */
  name: string;
  /** 未入力時にプレースホルダとして示す、解決済みの既定値。 */
  defaultValue?: OptionValue;
  disabled?: boolean;
}

/**
 * Option Schema の型仕様に従って、ウェイポイント（またはアノテーション）1件分の値を編集する。
 * list/object/map/union は自身を再帰的に呼び出して入れ子構造を編集する。
 */
export function OptionValueEditor({ spec, value, onChange, name, defaultValue, disabled }: OptionValueEditorProps) {
  // すべての onChange 呼び出しを履歴トランザクションで包む。多重に入れ子になっても
  // historyTransactionDepth の再入可能な設計により、実際のスナップショットは一度しか取られない。
  const emit = (v: OptionValue | undefined) => runTx(() => onChange(v));

  switch (spec.type) {
    case 'string':
      if (spec.enum_values && spec.enum_values.length > 0) {
        return (
          <Select
            aria-label={name}
            value={value !== undefined ? String(value) : ''}
            disabled={disabled}
            onChange={(e) => emit(e.target.value === '' ? undefined : e.target.value)}
            className="h-8 text-xs"
          >
            <option value="">{defaultValue !== undefined ? `(${defaultValue})` : '(unset)'}</option>
            {spec.enum_values.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        );
      }
      return (
        <Input
          type="text"
          aria-label={name}
          value={value !== undefined ? String(value) : ''}
          placeholder={defaultValue !== undefined ? String(defaultValue) : undefined}
          disabled={disabled}
          onFocus={beginTx}
          onBlur={endTx}
          onChange={(e) => emit(e.target.value === '' ? undefined : e.target.value)}
          className="h-8 text-xs"
        />
      );
    case 'integer':
    case 'float':
      return (
        <Input
          type="number"
          step={spec.type === 'float' ? '0.1' : '1'}
          aria-label={name}
          value={value !== undefined ? String(value) : ''}
          placeholder={defaultValue !== undefined ? String(defaultValue) : undefined}
          disabled={disabled}
          onFocus={beginTx}
          onBlur={endTx}
          onChange={(e) => {
            if (e.target.value === '') {
              emit(undefined);
              return;
            }
            const n = spec.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
            if (!isNaN(n)) emit(n);
          }}
          className="h-8 text-xs font-mono"
        />
      );
    case 'boolean':
      return (
        <Checkbox
          aria-label={name}
          checked={value !== undefined ? Boolean(value) : Boolean(defaultValue)}
          disabled={disabled}
          onChange={(e) => emit(e.target.checked)}
        />
      );
    case 'list':
      return (
        <ListValueEditor
          spec={spec}
          value={Array.isArray(value) ? value : []}
          onChange={emit}
          name={name}
          disabled={disabled}
        />
      );
    case 'object':
      return (
        <ObjectValueEditor
          spec={spec}
          value={isRecord(value) ? value : {}}
          onChange={emit}
          name={name}
          disabled={disabled}
        />
      );
    case 'map':
      return (
        <MapValueEditor
          spec={spec}
          value={isRecord(value) ? value : {}}
          onChange={emit}
          name={name}
          disabled={disabled}
        />
      );
    case 'union':
      return (
        <UnionValueEditor
          spec={spec}
          value={isRecord(value) ? value : undefined}
          onChange={emit}
          name={name}
          disabled={disabled}
        />
      );
    case 'any':
    default:
      return <AnyValueEditor value={value} onChange={emit} name={name} disabled={disabled} />;
  }
}

/** list: スカラー要素は CSV 一発入力、構造体要素はアイテムカードで編集する。 */
function ListValueEditor({
  spec,
  value,
  onChange,
  name,
  disabled,
}: {
  spec: TypeSpec;
  value: OptionValue[];
  onChange: (value: OptionValue[]) => void;
  name: string;
  disabled?: boolean;
}) {
  const itemSpec: TypeSpec = spec.item ?? { type: 'string' };

  if (isScalarType(itemSpec.type)) {
    const formatItem = (v: OptionValue) => String(v);
    return (
      <Input
        type="text"
        aria-label={name}
        value={value.map(formatItem).join(', ')}
        disabled={disabled}
        onFocus={beginTx}
        onBlur={endTx}
        onChange={(e) => {
          const raw = e.target.value
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          let parsed: OptionValue[] = raw;
          if (itemSpec.type === 'float') parsed = raw.map((s) => parseFloat(s)).filter((n) => !isNaN(n));
          else if (itemSpec.type === 'integer') parsed = raw.map((s) => parseInt(s, 10)).filter((n) => !isNaN(n));
          else if (itemSpec.type === 'boolean') parsed = raw.map((s) => s === 'true' || s === '1');
          onChange(parsed);
        }}
        className="h-8 text-xs font-mono"
        placeholder="csv"
      />
    );
  }

  const handleAdd = () => onChange([...value, createValue(itemSpec)]);
  const handleRemove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const handleMove = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const handleItemChange = (i: number, itemVal: OptionValue | undefined) => {
    const next = [...value];
    next[i] = itemVal ?? createValue(itemSpec);
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      {value.map((item, i) => (
        <div
          key={i}
          className="flex gap-1.5 items-start bg-surface-base/40 p-2 rounded-lg border border-border-base/20"
        >
          <div className="flex-1">
            <OptionValueEditor
              spec={itemSpec}
              value={item}
              onChange={(v) => handleItemChange(i, v)}
              name={`${name}[${i}]`}
              disabled={disabled}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Move ${name} item ${i} up`}
              disabled={disabled || i === 0}
              onClick={() => handleMove(i, -1)}
              className="text-text-muted hover:text-text-base"
            >
              <ChevronUp size={12} />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Move ${name} item ${i} down`}
              disabled={disabled || i === value.length - 1}
              onClick={() => handleMove(i, 1)}
              className="text-text-muted hover:text-text-base"
            >
              <ChevronDown size={12} />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${name} item ${i}`}
            disabled={disabled}
            onClick={() => handleRemove(i)}
            className="text-text-muted hover:text-danger-base hover:bg-danger-base/10"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="xs"
        disabled={disabled}
        onClick={handleAdd}
        className="text-primary-base hover:bg-primary-base/10"
      >
        <Plus size={12} className="mr-1" /> Add Item
      </Button>
    </div>
  );
}

/** object: 固定フィールドの値を編集する。 */
function ObjectValueEditor({
  spec,
  value,
  onChange,
  name,
  disabled,
}: {
  spec: TypeSpec;
  value: Record<string, OptionValue>;
  onChange: (value: Record<string, OptionValue>) => void;
  name: string;
  disabled?: boolean;
}) {
  const fields = spec.fields ?? [];
  return (
    <div className="space-y-2 pl-2 border-l-2 border-border-base/30">
      {fields.map((field) => (
        <FieldValueRow
          key={field.name}
          field={field}
          value={value[field.name]}
          onChange={(v) => {
            const next = { ...value };
            if (v === undefined) delete next[field.name];
            else next[field.name] = v;
            onChange(next);
          }}
          namePrefix={name}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

/** union: バリアント（判別値）を選び、選んだバリアントのフィールドを編集する。 */
function UnionValueEditor({
  spec,
  value,
  onChange,
  name,
  disabled,
}: {
  spec: TypeSpec;
  value: Record<string, OptionValue> | undefined;
  onChange: (value: Record<string, OptionValue>) => void;
  name: string;
  disabled?: boolean;
}) {
  const discriminator = spec.discriminator || 'type';
  const variants: VariantDef[] = spec.variants ?? [];
  const currentVariantValue = value?.[discriminator];
  const variant = variants.find((v) => v.value === currentVariantValue);
  const obj: Record<string, OptionValue> = value ?? {};

  return (
    <div className="space-y-2 pl-2 border-l-2 border-accent-automation/30">
      <Select
        aria-label={`${name} variant`}
        value={typeof currentVariantValue === 'string' ? currentVariantValue : ''}
        disabled={disabled}
        onChange={(e) =>
          runTx(() => onChange(switchUnionVariant(spec, obj, e.target.value) as Record<string, OptionValue>))
        }
        className="h-8 text-xs"
      >
        <option value="" disabled hidden>
          (select)
        </option>
        {variants.map((v) => (
          <option key={v.value} value={v.value}>
            {v.label || v.value}
          </option>
        ))}
      </Select>
      {variant &&
        variant.fields.map((field) => (
          <FieldValueRow
            key={field.name}
            field={field}
            value={obj[field.name]}
            onChange={(v) => {
              const next = { ...obj };
              if (v === undefined) delete next[field.name];
              else next[field.name] = v;
              onChange(next);
            }}
            namePrefix={name}
            disabled={disabled}
          />
        ))}
    </div>
  );
}

/** map: 自由なキーと、共通の値型を持つエントリの一覧を編集する。 */
function MapValueEditor({
  spec,
  value,
  onChange,
  name,
  disabled,
}: {
  spec: TypeSpec;
  value: Record<string, OptionValue>;
  onChange: (value: Record<string, OptionValue>) => void;
  name: string;
  disabled?: boolean;
}) {
  const valueSpec: TypeSpec = spec.value_type ?? { type: 'any' };
  const entries = Object.entries(value);
  const [newKey, setNewKey] = useState('');

  const handleAddKey = () => {
    const key = newKey.trim();
    if (!key || key in value) return;
    onChange({ ...value, [key]: createValue(valueSpec) });
    setNewKey('');
  };

  const handleRenameKey = (oldKey: string, newKeyName: string) => {
    if (!newKeyName || newKeyName === oldKey || newKeyName in value) return;
    const next: Record<string, OptionValue> = {};
    Object.entries(value).forEach(([k, v]) => {
      next[k === oldKey ? newKeyName : k] = v;
    });
    onChange(next);
  };

  const handleRemoveKey = (key: string) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="space-y-1.5 pl-2 border-l-2 border-border-base/30">
      {entries.map(([key, v]) => (
        <div
          key={key}
          className="flex gap-1.5 items-start bg-surface-base/40 p-2 rounded-lg border border-border-base/20"
        >
          <Input
            type="text"
            aria-label={`${name} key`}
            defaultValue={key}
            disabled={disabled}
            onBlur={(e) => runTx(() => handleRenameKey(key, e.target.value.trim()))}
            className="h-8 text-xs font-mono w-32 shrink-0"
          />
          <div className="flex-1">
            <OptionValueEditor
              spec={valueSpec}
              value={v}
              onChange={(nv) => {
                const next = { ...value };
                if (nv === undefined) delete next[key];
                else next[key] = nv;
                onChange(next);
              }}
              name={`${name}.${key}`}
              disabled={disabled}
            />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${name} key ${key}`}
            disabled={disabled}
            onClick={() => runTx(() => handleRemoveKey(key))}
            className="text-text-muted hover:text-danger-base hover:bg-danger-base/10"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      ))}
      <div className="flex gap-1.5">
        <Input
          type="text"
          aria-label={`${name} new key`}
          value={newKey}
          disabled={disabled}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="key"
          className="h-7 text-xs font-mono w-32"
        />
        <Button
          variant="ghost"
          size="xs"
          disabled={disabled || !newKey.trim()}
          onClick={() => runTx(handleAddKey)}
          className="text-primary-base hover:bg-primary-base/10"
        >
          <Plus size={12} className="mr-1" /> Add Key
        </Button>
      </div>
    </div>
  );
}

/** any: 自由な JSON 値を、テキストとして編集する。パースできるまで値は確定しない。 */
function AnyValueEditor({
  value,
  onChange,
  name,
  disabled,
}: {
  value: OptionValue | undefined;
  onChange: (value: OptionValue | undefined) => void;
  name: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(() => (value === undefined ? '' : JSON.stringify(value)));
  const [isValid, setIsValid] = useState(true);

  return (
    <textarea
      aria-label={name}
      value={text}
      disabled={disabled}
      onFocus={beginTx}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        if (t.trim() === '') {
          setIsValid(true);
          return;
        }
        try {
          JSON.parse(t);
          setIsValid(true);
        } catch {
          setIsValid(false);
        }
      }}
      onBlur={() => {
        if (text.trim() === '') {
          onChange(undefined);
        } else {
          try {
            onChange(JSON.parse(text));
          } catch {
            // 無効な JSON は確定しない（次にフォーカスするまでテキストは保持する）。
          }
        }
        endTx();
      }}
      className={cn(
        'w-full h-16 bg-surface-base/50 border rounded-lg p-2 text-[11px] font-mono resize-none',
        isValid ? 'border-border-base/50' : 'border-danger-base ring-1 ring-danger-base/30',
      )}
      placeholder="JSON"
    />
  );
}

/** object のフィールド / union のバリアントフィールド、1件分の Label + 値エディタ。 */
function FieldValueRow({
  field,
  value,
  onChange,
  namePrefix,
  disabled,
}: {
  field: FieldDef;
  value: OptionValue | undefined;
  onChange: (value: OptionValue | undefined) => void;
  namePrefix: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <FieldLabel className="text-[10px]">{field.label || field.name}</FieldLabel>
      <OptionValueEditor
        spec={field}
        value={value}
        onChange={onChange}
        name={`${namePrefix}.${field.name}`}
        defaultValue={field.default}
        disabled={disabled}
      />
    </div>
  );
}
