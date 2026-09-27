import { Trash2 } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { FieldLabel } from '../common/FieldLabel';
import { cn } from '../../../utils/cn';
import { isValueValid } from '../../../utils/optionValues';
import type { FieldDef } from '../../../types/options';

/** Fields shared by a waypoint option definition and a global field definition. */
export type SchemaFieldDef = FieldDef;

interface SchemaFieldRowProps {
  def: SchemaFieldDef;
  /** Which list the row belongs to (`Option` / `Global field`); disambiguates the key input for assistive tech. */
  groupLabel: string;
  /** Header of the value column: `Default` for waypoint options, `Value` for global fields. */
  valueLabel: string;
  /** The default (options) or current (globals) value being edited. */
  value: unknown;
  /** True when another field in the same list uses this key name. */
  isDuplicateName: boolean;
  onChangeDef: (updates: Partial<SchemaFieldDef>) => void;
  onChangeValue: (value: unknown) => void;
  onRemove: () => void;
}

function SchemaFieldCell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <FieldLabel className="ml-1">{label}</FieldLabel>
      {children}
    </div>
  );
}

const formatValue = (value: unknown) => {
  if (value === undefined) return '';
  return Array.isArray(value) ? value.join(', ') : String(value);
};

/** One editable schema row: key, label, type and a default/value cell, with type-specific extras. */
export function SchemaFieldRow({
  def,
  groupLabel,
  valueLabel,
  value,
  isDuplicateName,
  onChangeDef,
  onChangeValue,
  onRemove,
}: SchemaFieldRowProps) {
  const handleValueInput = (text: string) => {
    if (def.type !== 'list') {
      onChangeValue(text);
      return;
    }
    const rawArr = text
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const itemType = def.item?.type;
    let parsedArr: any[] = rawArr;
    if (itemType === 'float') {
      parsedArr = rawArr.map((s) => parseFloat(s)).filter((n) => !isNaN(n));
    } else if (itemType === 'integer') {
      parsedArr = rawArr.map((s) => parseInt(s, 10)).filter((n) => !isNaN(n));
    } else if (itemType === 'boolean') {
      parsedArr = rawArr.map((s) => s === 'true' || s === '1');
    }
    onChangeValue(parsedArr);
  };

  return (
    <div className="flex gap-3 items-start bg-surface-panel/40 p-4 rounded-xl border border-border-base/30 shadow-subtle hover:border-border-base/60 transition-all">
      <div className="flex-1 space-y-4">
        <div className="grid grid-cols-12 gap-3">
          <SchemaFieldCell label="Key Name" className="col-span-3">
            <Input
              type="text"
              aria-label={`${groupLabel} key name`}
              value={def.name}
              onChange={(e) => {
                const sanitized = e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
                onChangeDef({ name: sanitized });
              }}
              className={cn(
                'h-8 text-[13px] font-mono',
                isDuplicateName || def.name.trim() === ''
                  ? 'border-danger-base focus:border-danger-base ring-danger-base/20'
                  : '',
              )}
              placeholder="e.g. velocity"
            />
          </SchemaFieldCell>
          <SchemaFieldCell label="Label" className="col-span-3">
            <Input
              type="text"
              aria-label={`${def.name} label`}
              value={def.label}
              onChange={(e) => onChangeDef({ label: e.target.value })}
              className="h-8 text-[13px]"
              placeholder="e.g. Target Speed"
            />
          </SchemaFieldCell>
          <SchemaFieldCell label="Type" className="col-span-3">
            <Select
              aria-label={`${def.name} type`}
              value={def.type}
              onChange={(e) => onChangeDef({ type: e.target.value as FieldDef['type'] })}
              className="h-8 text-[13px]"
            >
              <option value="string">String</option>
              <option value="float">Float</option>
              <option value="integer">Integer</option>
              <option value="boolean">Boolean</option>
              <option value="list">List (Array)</option>
            </Select>
          </SchemaFieldCell>
          <SchemaFieldCell label={valueLabel} className="col-span-3">
            <Input
              type="text"
              aria-label={`${def.name} ${valueLabel.toLowerCase()}`}
              value={formatValue(value)}
              onChange={(e) => handleValueInput(e.target.value)}
              className={cn(
                'h-8 text-[13px] font-mono',
                !isValueValid(def, value) ? 'border-danger-base focus:border-danger-base ring-danger-base/20' : '',
              )}
              placeholder={def.type === 'list' ? 'csv' : def.type === 'boolean' ? 'true/false' : '0'}
            />
          </SchemaFieldCell>
        </div>
        {def.type === 'list' && (
          <div className="flex gap-2 mt-1">
            <SchemaFieldCell label="List Item Type" className="w-48">
              <Select
                aria-label={`${def.name} list item type`}
                value={def.item?.type || 'string'}
                onChange={(e) => onChangeDef({ item: { type: e.target.value as FieldDef['type'] } })}
                className="h-8 text-[13px]"
              >
                <option value="string">String</option>
                <option value="float">Float</option>
                <option value="integer">Integer</option>
                <option value="boolean">Boolean</option>
              </Select>
            </SchemaFieldCell>
          </div>
        )}
        {def.type === 'string' && (
          <div className="flex gap-2 mt-1">
            <SchemaFieldCell label="Dropdown Enums (csv, optional)" className="flex-1">
              <Input
                type="text"
                aria-label={`${def.name} dropdown enums`}
                value={def.enum_values ? def.enum_values.join(', ') : ''}
                onChange={(e) =>
                  onChangeDef({
                    enum_values: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0),
                  })
                }
                className="h-8 text-[13px]"
                placeholder="e.g. none, docking"
              />
            </SchemaFieldCell>
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove ${def.name}`}
        onClick={onRemove}
        className="mt-6 text-text-muted hover:text-danger-base hover:bg-danger-base/10"
      >
        <Trash2 size={16} />
      </Button>
    </div>
  );
}
