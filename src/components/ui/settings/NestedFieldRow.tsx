import { Trash2 } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { FieldLabel } from '../common/FieldLabel';
import { cn } from '../../../utils/cn';
import type { FieldDef, ScalarType } from '../../../types/options';

/**
 * object のフィールドや union のバリアントフィールドとして使える型。
 * 深いネストは GUI では扱わず（Key/Value ペア中心の mg_robot の `request` 等を想定した `map` まで）、
 * それ以上の入れ子が必要な場合は YAML/JSON でのスキーマインポートを使う。
 */
export type NestedFieldType = ScalarType | 'map' | 'any';

/** object.fields / union.variants[].fields の1行。SchemaFieldRow よりコンパクトな表示にする。 */
export function NestedFieldRow({
  field,
  isDuplicateName,
  onChange,
  onRemove,
}: {
  field: FieldDef;
  isDuplicateName: boolean;
  onChange: (updates: Partial<FieldDef>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-2 items-start bg-surface-base/40 p-2.5 rounded-lg border border-border-base/20">
      <div className="flex-1 grid grid-cols-12 gap-2">
        <Input
          type="text"
          aria-label="Field key name"
          value={field.name}
          onChange={(e) => onChange({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() })}
          className={cn(
            'col-span-3 h-7 text-[12px] font-mono',
            isDuplicateName || field.name.trim() === '' ? 'border-danger-base ring-danger-base/20' : '',
          )}
          placeholder="key"
        />
        <Input
          type="text"
          aria-label={`${field.name} label`}
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="col-span-4 h-7 text-[12px]"
          placeholder="Label"
        />
        <Select
          aria-label={`${field.name} type`}
          value={field.type}
          onChange={(e) => onChange({ type: e.target.value as NestedFieldType })}
          className="col-span-3 h-7 text-[12px]"
        >
          <option value="string">String</option>
          <option value="float">Float</option>
          <option value="integer">Integer</option>
          <option value="boolean">Boolean</option>
          <option value="map">Map (dict)</option>
          <option value="any">Any (JSON)</option>
        </Select>
        {field.type === 'string' && (
          <Input
            type="text"
            aria-label={`${field.name} enum values`}
            value={field.enum_values ? field.enum_values.join(', ') : ''}
            onChange={(e) =>
              onChange({
                enum_values: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0),
              })
            }
            className="col-span-2 h-7 text-[12px] font-mono"
            placeholder="enum, csv"
          />
        )}
        {field.type !== 'string' && <FieldLabel className="col-span-2 self-center opacity-0">-</FieldLabel>}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${field.name || 'field'}`}
        onClick={onRemove}
        className="text-text-muted hover:text-danger-base hover:bg-danger-base/10"
      >
        <Trash2 size={13} />
      </Button>
    </div>
  );
}
