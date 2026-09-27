import { Plus } from 'lucide-react';
import { Button } from '../common/Button';
import { NestedFieldRow } from './NestedFieldRow';
import type { FieldDef } from '../../../types/options';

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

/** object のフィールド一覧 / union の1バリアント分のフィールド一覧を編集する。 */
export function FieldListEditor({
  fields,
  onChange,
  addLabel = 'Add Nested Field',
}: {
  fields: FieldDef[];
  onChange: (fields: FieldDef[]) => void;
  addLabel?: string;
}) {
  const handleAdd = () => {
    onChange([...fields, { name: uniqueFieldName('field', fields), label: 'New Field', type: 'string' }]);
  };

  const handleUpdate = (index: number, updates: Partial<FieldDef>) => {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  const handleRemove = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1.5">
      {fields.map((f, i) => (
        <NestedFieldRow
          key={i}
          field={f}
          isDuplicateName={fields.filter((o) => o.name === f.name).length > 1}
          onChange={(updates) => handleUpdate(i, updates)}
          onRemove={() => handleRemove(i)}
        />
      ))}
      <Button variant="ghost" size="xs" onClick={handleAdd} className="text-primary-base hover:bg-primary-base/10">
        <Plus size={12} className="mr-1" /> {addLabel}
      </Button>
    </div>
  );
}
