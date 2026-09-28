import { Trash2 } from 'lucide-react';
import { Button } from '../../common/Button';
import { Input } from '../../common/Input';
import { Checkbox } from '../../common/Checkbox';
import { FieldLabel } from '../../common/FieldLabel';
import { cn } from '../../../../utils/cn';
import { OptionValueEditor } from '../../properties/OptionValueEditor';
import { SchemaFieldCell } from './SchemaFieldCell';
import { TypeSpecEditor } from './TypeSpecEditor';
import type { FieldDef, OptionValue } from '../../../../types/options';

export interface FieldEditorProps {
  field: FieldDef;
  /** Which list the row belongs to (`Option` / `Global field`); disambiguates the key input for assistive tech. */
  groupLabel: string;
  /** Header of the value column: `Default` for waypoint options/nested fields, `Value` for global fields. */
  valueLabel: string;
  /** The default (options/nested fields) or current (globals) value being edited. */
  value: OptionValue | undefined;
  /** `ref` の選択肢に出す、定義済みの型名一覧。 */
  definitionNames: string[];
  /** このフィールド自身のスコープ（`optionPresets.ts` の走査と同じ形式）。プリセットの使用件数集計に使う。 */
  scope: string;
  isAppliedAndUnchanged: boolean;
  /** True when another field in the same list uses this key name. */
  isDuplicateName: boolean;
  onChangeField: (updates: Partial<FieldDef>) => void;
  onChangeValue: (value: OptionValue | undefined) => void;
  onRemove: () => void;
}

/**
 * スキーマの1フィールド分（Key/Label/Required/Description + 型仕様 + 既定値/値）を編集する。
 * トップレベルの Option・Global Field、object のフィールド、union のバリアントフィールドの
 * いずれでも共用する。型仕様の編集自体は再帰的な `TypeSpecEditor` に委譲するため、
 * ネストの深さに制限は無い。
 */
export function FieldEditor({
  field,
  groupLabel,
  valueLabel,
  value,
  definitionNames,
  scope,
  isAppliedAndUnchanged,
  isDuplicateName,
  onChangeField,
  onChangeValue,
  onRemove,
}: FieldEditorProps) {
  return (
    <div className="flex gap-3 items-start bg-surface-panel/40 p-4 rounded-xl border border-border-base/30 shadow-subtle hover:border-border-base/60 transition-all">
      <div className="flex-1 space-y-3">
        <div className="grid grid-cols-12 gap-3">
          <SchemaFieldCell label="Key Name" className="col-span-4">
            <Input
              type="text"
              aria-label={`${groupLabel} key name`}
              value={field.name}
              onChange={(e) => {
                const sanitized = e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
                onChangeField({ name: sanitized });
              }}
              className={cn(
                'h-8 text-[13px] font-mono',
                isDuplicateName || field.name.trim() === ''
                  ? 'border-danger-base focus:border-danger-base ring-danger-base/20'
                  : '',
              )}
              placeholder="e.g. velocity"
            />
          </SchemaFieldCell>
          <SchemaFieldCell label="Label" className="col-span-5">
            <Input
              type="text"
              aria-label={`${field.name} label`}
              value={field.label}
              onChange={(e) => onChangeField({ label: e.target.value })}
              className="h-8 text-[13px]"
              placeholder="e.g. Target Speed"
            />
          </SchemaFieldCell>
          <div className="col-span-3 flex items-center gap-1.5 pt-5">
            <Checkbox
              aria-label={`${field.name} required`}
              checked={!!field.required}
              onChange={(e) => onChangeField({ required: e.target.checked || undefined })}
            />
            <FieldLabel className="normal-case">Required</FieldLabel>
          </div>
        </div>

        <SchemaFieldCell label="Description (optional)">
          <Input
            type="text"
            aria-label={`${field.name} description`}
            value={field.description || ''}
            onChange={(e) => onChangeField({ description: e.target.value || undefined })}
            className="h-8 text-[13px]"
            placeholder="Inspector に表示される補足説明"
          />
        </SchemaFieldCell>

        <TypeSpecEditor
          spec={field}
          onChange={(spec) => onChangeField(spec)}
          definitionNames={definitionNames}
          fieldName={field.name}
          scope={scope}
          isAppliedAndUnchanged={isAppliedAndUnchanged}
        />

        <SchemaFieldCell label={valueLabel}>
          <OptionValueEditor
            spec={field}
            value={value}
            onChange={onChangeValue}
            name={`${field.name} ${valueLabel.toLowerCase()}`}
            showResetControl={false}
          />
        </SchemaFieldCell>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove ${field.name}`}
        onClick={onRemove}
        className="mt-1 text-text-muted hover:text-danger-base hover:bg-danger-base/10"
      >
        <Trash2 size={16} />
      </Button>
    </div>
  );
}
