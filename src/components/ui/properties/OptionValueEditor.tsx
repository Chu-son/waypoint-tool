import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, RotateCcw, Info, ClipboardPaste } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Checkbox } from '../common/Checkbox';
import { FieldLabel } from '../common/FieldLabel';
import { cn } from '../../../utils/cn';
import {
  createValue,
  switchUnionVariant,
  parseCsvList,
  isActivePresetRef,
  findPresetByName,
  findMatchingPreset,
} from '../../../utils/optionValues';
import type { FieldDef, OptionValue, ScalarType, TypeSpec, VariantDef } from '../../../types/options';

// ============================================================================
// 履歴トランザクションの注入
// ============================================================================

export interface ValueEditTransactions {
  begin: () => void;
  end: () => void;
  run: (fn: () => void) => void;
}

/** Provider が無い場合の既定（no-op）。ストアを持たない文脈（設定画面の既定値編集等）で使う。 */
export const noopValueEditTransactions: ValueEditTransactions = {
  begin: () => {},
  end: () => {},
  run: (fn) => fn(),
};

/**
 * `OptionValueEditor` が使う Undo/Redo トランザクションの実装を注入する Context。
 * Inspector（ウェイポイント・アノテーション）はストアの historySlice と連動した実装を providing し、
 * 設定画面のようにストアの履歴と無関係な文脈では既定の no-op のまま使う。
 */
export const ValueEditTransactionContext = createContext<ValueEditTransactions>(noopValueEditTransactions);

// ============================================================================
// ヘルパー
// ============================================================================

const isScalarType = (t: TypeSpec['type']): t is ScalarType =>
  t === 'string' || t === 'float' || t === 'integer' || t === 'boolean';

function isRecord(v: unknown): v is Record<string, OptionValue> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function formatScalar(v: OptionValue): string {
  return Array.isArray(v) ? v.join(', ') : String(v);
}

/** 型に応じた、未入力時のプレースホルダ文言。既定値があればそれを優先して示す。 */
function scalarPlaceholder(
  type: ScalarType,
  defaultValue: OptionValue | undefined,
  mixed?: boolean,
): string | undefined {
  if (mixed) return 'Mixed';
  if (defaultValue !== undefined) return `既定: ${formatScalar(defaultValue)}`;
  switch (type) {
    case 'float':
      return '例: 1.5';
    case 'integer':
      return '例: 3';
    case 'string':
      return '例: map';
    default:
      return undefined;
  }
}

// ============================================================================
// 既定値に戻すボタン / 「既定」バッジ
// ============================================================================

/**
 * 値が明示的に設定されているフィールドに「既定値に戻す」ボタンを、未設定で既定値を
 * 表示中のフィールドに「既定」バッジを添える。list の要素・map の値など、
 * フィールド自体に既定値の概念が無い箇所では `enabled=false` で無効化する。
 */
function ValueWithResetControl({
  value,
  defaultValue,
  onChange,
  disabled,
  enabled = true,
  children,
}: {
  value: OptionValue | undefined;
  defaultValue?: OptionValue;
  onChange: (value: OptionValue | undefined) => void;
  disabled?: boolean;
  enabled?: boolean;
  children: React.ReactNode;
}) {
  const transactions = useContext(ValueEditTransactionContext);
  if (!enabled) return <>{children}</>;

  return (
    <div className="flex items-start gap-1">
      <div className="flex-1 min-w-0">{children}</div>
      {value !== undefined ? (
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          title="既定値に戻す"
          aria-label="Reset to default"
          disabled={disabled}
          onClick={() => transactions.run(() => onChange(undefined))}
          className="mt-1 text-text-muted hover:text-text-base shrink-0"
        >
          <RotateCcw size={12} />
        </Button>
      ) : defaultValue !== undefined ? (
        <span
          className="mt-1.5 text-[9px] px-1 py-0.5 rounded bg-surface-hover text-text-muted shrink-0 leading-none"
          title="既定値を使用中"
        >
          既定
        </span>
      ) : null}
    </div>
  );
}

// ============================================================================
// プリセット選択
// ============================================================================

/**
 * 型仕様が持つ `presets` から選ぶセレクタ。「カスタム値」を選ぶと、それまで参照していた
 * プリセットの値をコピーして編集可能な状態に切り離す（`preset_only` では「カスタム値」自体を出さない）。
 * 未定義のプリセットを参照している場合は、その旨をエラー表示する。
 */
function PresetSelector({
  spec,
  value,
  onChange,
  name,
  disabled,
}: {
  spec: TypeSpec;
  value: OptionValue | undefined;
  onChange: (value: OptionValue | undefined) => void;
  name: string;
  disabled?: boolean;
}) {
  const transactions = useContext(ValueEditTransactionContext);
  const presets = spec.presets ?? [];
  const currentRefName = isActivePresetRef(spec, value) ? value.$preset : undefined;
  const isUnresolvedRef = currentRefName !== undefined && !findPresetByName(spec, currentRefName);

  return (
    <div className="space-y-0.5">
      <Select
        aria-label={`${name} preset`}
        value={currentRefName ?? ''}
        disabled={disabled}
        onChange={(e) => {
          const nextName = e.target.value;
          if (nextName === '') {
            // カスタム値へ切り離す: 参照していたプリセットの値をコピーして、そのまま編集を続けられるようにする。
            const detachedValue = currentRefName ? findPresetByName(spec, currentRefName)?.value : value;
            transactions.run(() => onChange(detachedValue));
          } else {
            transactions.run(() => onChange({ $preset: nextName }));
          }
        }}
        className="h-7 text-xs"
      >
        {!spec.preset_only && <option value="">カスタム値</option>}
        {presets.map((p) => (
          <option key={p.name} value={p.name}>
            {p.label || p.name}
          </option>
        ))}
      </Select>
      {isUnresolvedRef && <p className="text-[10px] text-danger-base">未定義のプリセットです: {currentRefName}</p>}
    </div>
  );
}

// ============================================================================
// メインディスパッチャ
// ============================================================================

export interface OptionValueEditorProps {
  spec: TypeSpec;
  value: OptionValue | undefined;
  onChange: (value: OptionValue | undefined) => void;
  /** Accessible-name prefix for the input(s) rendered at this level. */
  name: string;
  /** 未入力時にプレースホルダとして示す、解決済みの既定値。 */
  defaultValue?: OptionValue;
  disabled?: boolean;
  /** 複数選択時: スカラーは空欄 + "Mixed" 表示で一括設定を許可し、複合型は編集不可のメッセージにする。 */
  mixed?: boolean;
  /**
   * 「既定値に戻す」ボタン・「既定」バッジを表示するか。list の要素・map の値など、
   * それ自体に既定値の概念が無い箇所では呼び出し側が false にする（既定は true）。
   */
  showResetControl?: boolean;
}

/**
 * Option Schema の型仕様に従って、ウェイポイント（またはアノテーション）1件分の値を編集する。
 * list/object/map/union は自身を再帰的に呼び出して入れ子構造を編集する。
 */
export function OptionValueEditor({
  spec,
  value,
  onChange,
  name,
  defaultValue,
  disabled: disabledProp,
  mixed,
  showResetControl = true,
}: OptionValueEditorProps) {
  const transactions = useContext(ValueEditTransactionContext);
  // すべての onChange 呼び出しを履歴トランザクションで包む。多重に入れ子になっても
  // historyTransactionDepth の再入可能な設計により、実際のスナップショットは一度しか取られない。
  const emit = (v: OptionValue | undefined) => transactions.run(() => onChange(v));

  const hasPresets = (spec.presets?.length ?? 0) > 0;
  const presetSelector = hasPresets ? (
    <PresetSelector spec={spec} value={mixed ? undefined : value} onChange={emit} name={name} disabled={disabledProp} />
  ) : null;

  if (mixed && !isScalarType(spec.type)) {
    return (
      <div className="space-y-1">
        {presetSelector}
        <p className="text-xs text-text-muted italic p-2 bg-surface-panel/40 rounded border border-border-base/30">
          Mixed — select a single waypoint to edit.
        </p>
      </div>
    );
  }

  // プリセットを参照中は、実体の値は読み取り専用でプリセットの値を表示する（編集は「カスタム値」への
  // 切り離しを経由する）。未定義のプリセットを参照している場合は、型別コントロール自体を出さない。
  const activePreset = !mixed && isActivePresetRef(spec, value) ? findPresetByName(spec, value.$preset) : undefined;
  const isUnresolvedRef = !mixed && isActivePresetRef(spec, value) && !activePreset;
  const displayValue = mixed ? undefined : activePreset ? activePreset.value : value;
  const disabled = disabledProp || !!activePreset;

  const matchingPreset =
    hasPresets && !mixed && value !== undefined && !isActivePresetRef(spec, value)
      ? findMatchingPreset(spec, value)
      : undefined;

  const control = isUnresolvedRef
    ? null
    : (() => {
        switch (spec.type) {
          case 'string':
            if (spec.enum_values && spec.enum_values.length > 0) {
              return (
                <Select
                  aria-label={name}
                  value={displayValue !== undefined ? String(displayValue) : ''}
                  disabled={disabled}
                  onChange={(e) => emit(e.target.value === '' ? undefined : e.target.value)}
                  className="h-8 text-xs"
                >
                  <option value="">
                    {mixed ? 'Mixed' : defaultValue !== undefined ? `既定: ${defaultValue}` : '(未設定)'}
                  </option>
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
                value={displayValue !== undefined ? String(displayValue) : ''}
                placeholder={scalarPlaceholder('string', defaultValue, mixed)}
                disabled={disabled}
                onFocus={transactions.begin}
                onBlur={transactions.end}
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
                value={displayValue !== undefined ? String(displayValue) : ''}
                placeholder={scalarPlaceholder(spec.type, defaultValue, mixed)}
                disabled={disabled}
                onFocus={transactions.begin}
                onBlur={transactions.end}
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
                checked={displayValue !== undefined ? Boolean(displayValue) : Boolean(defaultValue)}
                disabled={disabled}
                onChange={(e) => emit(e.target.checked)}
              />
            );
          case 'list':
            return (
              <ListValueEditor
                spec={spec}
                value={Array.isArray(displayValue) ? displayValue : []}
                onChange={emit}
                name={name}
                disabled={disabled}
              />
            );
          case 'object':
            return (
              <ObjectValueEditor
                spec={spec}
                value={isRecord(displayValue) ? displayValue : {}}
                onChange={emit}
                name={name}
                disabled={disabled}
              />
            );
          case 'map':
            return (
              <MapValueEditor
                spec={spec}
                value={isRecord(displayValue) ? displayValue : {}}
                onChange={emit}
                name={name}
                disabled={disabled}
              />
            );
          case 'union':
            return (
              <UnionValueEditor
                spec={spec}
                value={isRecord(displayValue) ? displayValue : undefined}
                onChange={emit}
                name={name}
                disabled={disabled}
              />
            );
          case 'any':
          default:
            return <AnyValueEditor value={displayValue} onChange={emit} name={name} disabled={disabled} />;
        }
      })();

  return (
    <ValueWithResetControl
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      disabled={disabledProp}
      enabled={showResetControl && !mixed}
    >
      <div className="space-y-1">
        {presetSelector}
        {control}
        {matchingPreset && (
          <p className="text-[10px] text-text-muted">
            プリセット「{matchingPreset.label ?? matchingPreset.name}」と同じ値です。{' '}
            <button
              type="button"
              className="underline text-primary-base hover:text-primary-hover"
              onClick={() => emit({ $preset: matchingPreset.name })}
            >
              参照にする
            </button>
          </p>
        )}
      </div>
    </ValueWithResetControl>
  );
}

// ============================================================================
// list
// ============================================================================

/** list: スカラー要素は行ごとの入力（+ カンマ区切り貼り付け）、構造体要素はアイテムカードで編集する。 */
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
  // アイテムの並べ替え・追加・削除をしても、各アイテムの内部状態（ネストした map/any エディタの
  // 編集中テキスト等）が取り違えられないよう、値とは別に安定した行 ID を保持する。
  // 選択中ウェイポイントの切替では OptionValueEditor 自体が remount されるため、
  // ここでの再同期は「このコンポーネント自身の add/remove/move 操作」だけを想定すればよい。
  const [ids, setIds] = useState<string[]>(() => value.map(() => uuidv4()));
  const itemKey = (i: number) => ids[i] ?? `idx-${i}`;

  if (isScalarType(itemSpec.type)) {
    return (
      <ScalarListEditor itemType={itemSpec.type} value={value} onChange={onChange} name={name} disabled={disabled} />
    );
  }

  const handleAdd = () => {
    setIds([...ids, uuidv4()]);
    onChange([...value, createValue(itemSpec)]);
  };
  const handleRemove = (i: number) => {
    setIds(ids.filter((_, idx) => idx !== i));
    onChange(value.filter((_, idx) => idx !== i));
  };
  const handleMove = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const nextValue = [...value];
    [nextValue[i], nextValue[j]] = [nextValue[j], nextValue[i]];
    const nextIds = [...ids];
    [nextIds[i], nextIds[j]] = [nextIds[j], nextIds[i]];
    setIds(nextIds);
    onChange(nextValue);
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
          key={itemKey(i)}
          className="flex gap-1.5 items-start bg-surface-base/40 p-2 rounded-lg border border-border-base/20"
        >
          <div className="flex-1">
            <OptionValueEditor
              spec={itemSpec}
              value={item}
              onChange={(v) => handleItemChange(i, v)}
              name={`${name}[${i}]`}
              disabled={disabled}
              showResetControl={false}
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

/** list<scalar>: 要素ごとの入力・削除・追加に加えて、カンマ区切りテキストの一括貼り付けにも対応する。 */
function ScalarListEditor({
  itemType,
  value,
  onChange,
  name,
  disabled,
}: {
  itemType: ScalarType;
  value: OptionValue[];
  onChange: (value: OptionValue[]) => void;
  name: string;
  disabled?: boolean;
}) {
  const transactions = useContext(ValueEditTransactionContext);
  const [isPasting, setIsPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const handleItemChange = (i: number, raw: string) => {
    const next = [...value];
    if (itemType === 'float') next[i] = parseFloat(raw);
    else if (itemType === 'integer') next[i] = parseInt(raw, 10);
    else if (itemType === 'boolean') next[i] = raw === 'true';
    else next[i] = raw;
    onChange(next);
  };
  const handleAdd = () => onChange([...value, itemType === 'boolean' ? false : itemType === 'string' ? '' : 0]);
  const handleRemove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const commitPaste = () => {
    const parsed = parseCsvList(pasteText, itemType);
    if (parsed.length > 0) onChange([...value, ...parsed]);
    setPasteText('');
    setIsPasting(false);
  };

  return (
    <div className="space-y-1.5">
      {value.map((item, i) => (
        <div key={i} className="flex gap-1.5 items-center">
          {itemType === 'boolean' ? (
            <Checkbox
              aria-label={`${name}[${i}]`}
              checked={Boolean(item)}
              disabled={disabled}
              onChange={(e) => handleItemChange(i, String(e.target.checked))}
            />
          ) : (
            <Input
              type={itemType === 'float' || itemType === 'integer' ? 'number' : 'text'}
              step={itemType === 'float' ? '0.1' : '1'}
              aria-label={`${name}[${i}]`}
              value={String(item)}
              disabled={disabled}
              onFocus={transactions.begin}
              onBlur={transactions.end}
              onChange={(e) => handleItemChange(i, e.target.value)}
              className="h-7 text-xs font-mono flex-1"
            />
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Remove ${name} item ${i}`}
            disabled={disabled}
            onClick={() => handleRemove(i)}
            className="text-text-muted hover:text-danger-base hover:bg-danger-base/10 shrink-0"
          >
            <Trash2 size={12} />
          </Button>
        </div>
      ))}
      {isPasting ? (
        <div className="flex gap-1.5">
          <Input
            type="text"
            aria-label={`${name} paste csv`}
            value={pasteText}
            disabled={disabled}
            autoFocus
            onChange={(e) => setPasteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                transactions.run(commitPaste);
              }
            }}
            onBlur={() => transactions.run(commitPaste)}
            placeholder="1, 2, 3"
            className="h-7 text-xs font-mono flex-1"
          />
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="xs"
            disabled={disabled}
            onClick={() => transactions.run(handleAdd)}
            className="text-primary-base hover:bg-primary-base/10"
          >
            <Plus size={12} className="mr-1" /> Add Item
          </Button>
          <Button
            variant="ghost"
            size="xs"
            disabled={disabled}
            onClick={() => setIsPasting(true)}
            className="text-text-muted hover:bg-surface-hover"
            title="カンマ区切りのテキストから複数件まとめて追加する"
          >
            <ClipboardPaste size={12} className="mr-1" /> カンマ区切りで貼り付け
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// object / union
// ============================================================================

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
  const transactions = useContext(ValueEditTransactionContext);
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
          transactions.run(() => onChange(switchUnionVariant(spec, obj, e.target.value) as Record<string, OptionValue>))
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

// ============================================================================
// map
// ============================================================================

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
  const transactions = useContext(ValueEditTransactionContext);
  const valueSpec: TypeSpec = spec.value_type ?? { type: 'any' };
  const entries = Object.entries(value);
  const [newKey, setNewKey] = useState('');

  const handleAddKey = () => {
    const key = newKey.trim();
    if (!key || key in value) return;
    onChange({ ...value, [key]: createValue(valueSpec) });
    setNewKey('');
  };

  return (
    <div className="space-y-1.5 pl-2 border-l-2 border-border-base/30">
      {entries.map(([key, v]) => (
        <MapEntryRow
          key={key}
          mapKey={key}
          value={v}
          valueSpec={valueSpec}
          existingKeys={value}
          name={name}
          disabled={disabled}
          onRename={(newKeyName) => {
            const next: Record<string, OptionValue> = {};
            Object.entries(value).forEach(([k, vv]) => {
              next[k === key ? newKeyName : k] = vv;
            });
            onChange(next);
          }}
          onValueChange={(nv) => {
            const next = { ...value };
            if (nv === undefined) delete next[key];
            else next[key] = nv;
            onChange(next);
          }}
          onRemove={() => {
            const next = { ...value };
            delete next[key];
            onChange(next);
          }}
        />
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
          onClick={() => transactions.run(handleAddKey)}
          className="text-primary-base hover:bg-primary-base/10"
        >
          <Plus size={12} className="mr-1" /> Add Key
        </Button>
      </div>
    </div>
  );
}

/**
 * map の1エントリ。キー入力を制御コンポーネントにし、`mapKey` が外部から変わったら
 * 編集中でない限り追従させる（選択ウェイポイント切替時に古いキー名が残る不具合を防ぐ）。
 */
function MapEntryRow({
  mapKey,
  value,
  valueSpec,
  existingKeys,
  name,
  disabled,
  onRename,
  onValueChange,
  onRemove,
}: {
  mapKey: string;
  value: OptionValue;
  valueSpec: TypeSpec;
  existingKeys: Record<string, OptionValue>;
  name: string;
  disabled?: boolean;
  onRename: (newKey: string) => void;
  onValueChange: (value: OptionValue | undefined) => void;
  onRemove: () => void;
}) {
  const transactions = useContext(ValueEditTransactionContext);
  const [draft, setDraft] = useState(mapKey);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) setDraft(mapKey);
  }, [mapKey]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== mapKey && !(trimmed in existingKeys)) {
      onRename(trimmed);
    } else {
      setDraft(mapKey);
    }
  };

  return (
    <div className="flex gap-1.5 items-start bg-surface-base/40 p-2 rounded-lg border border-border-base/20">
      <Input
        type="text"
        aria-label={`${name} key`}
        value={draft}
        disabled={disabled}
        onFocus={() => {
          isFocusedRef.current = true;
          transactions.begin();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          isFocusedRef.current = false;
          transactions.run(commitRename);
          transactions.end();
        }}
        className="h-8 text-xs font-mono w-32 shrink-0"
      />
      <div className="flex-1">
        <OptionValueEditor
          spec={valueSpec}
          value={value}
          onChange={onValueChange}
          name={`${name}.${mapKey}`}
          disabled={disabled}
          showResetControl={false}
        />
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${name} key ${mapKey}`}
        disabled={disabled}
        onClick={() => transactions.run(onRemove)}
        className="text-text-muted hover:text-danger-base hover:bg-danger-base/10"
      >
        <Trash2 size={13} />
      </Button>
    </div>
  );
}

// ============================================================================
// any
// ============================================================================

/**
 * any: 自由な JSON 値を、テキストとして編集する。パースできるまで値は確定しない。
 * 外部から `value` が変わったとき（選択ウェイポイントの切替等）は、編集中でない限り表示を同期する。
 */
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
  const transactions = useContext(ValueEditTransactionContext);
  const [text, setText] = useState(() => (value === undefined ? '' : JSON.stringify(value)));
  const [isValid, setIsValid] = useState(true);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (isFocusedRef.current) return;
    setText(value === undefined ? '' : JSON.stringify(value));
    setIsValid(true);
  }, [value]);

  return (
    <textarea
      aria-label={name}
      value={text}
      disabled={disabled}
      onFocus={() => {
        isFocusedRef.current = true;
        transactions.begin();
      }}
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
        isFocusedRef.current = false;
        if (text.trim() === '') {
          onChange(undefined);
        } else {
          try {
            onChange(JSON.parse(text));
          } catch {
            // 無効な JSON は確定しない（次にフォーカスするまでテキストは保持する）。
          }
        }
        transactions.end();
      }}
      className={cn(
        'w-full h-16 bg-surface-base/50 border rounded-lg p-2 text-[11px] font-mono resize-none',
        isValid ? 'border-border-base/50' : 'border-danger-base ring-1 ring-danger-base/30',
      )}
      placeholder="JSON"
    />
  );
}

// ============================================================================
// フィールド行（object のフィールド / union のバリアントフィールド）
// ============================================================================

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
  const isMissingRequired = field.required && value === undefined && field.default === undefined;
  return (
    <div className="space-y-1">
      <FieldLabel className="text-[10px] flex items-center gap-1">
        <span>{field.label || field.name}</span>
        {field.required && (
          <span className="text-danger-base" title="必須項目">
            *
          </span>
        )}
        {field.description && (
          <span title={field.description} className="text-text-muted normal-case">
            <Info size={10} />
          </span>
        )}
      </FieldLabel>
      <div className={cn(isMissingRequired && 'rounded-md ring-1 ring-danger-base/40')}>
        <OptionValueEditor
          spec={field}
          value={value}
          onChange={onChange}
          name={`${namePrefix}.${field.name}`}
          defaultValue={field.default}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
