import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../common/Button';
import { Input } from '../../common/Input';
import { FieldLabel } from '../../common/FieldLabel';
import { cn } from '../../../../utils/cn';
import { FieldListEditor } from './FieldListEditor';
import type { VariantDef } from '../../../../types/options';

/** union の discriminator（判別キー）に対する値ごとの、バリアント一覧を編集する。 */
export function VariantListEditor({
  variants,
  onChange,
  definitionNames,
  parentScope,
  isAppliedAndUnchanged,
}: {
  variants: VariantDef[];
  onChange: (variants: VariantDef[]) => void;
  definitionNames: string[];
  /** 親（union）のスコープ。各バリアントのフィールドは `${parentScope}.variants.${value}.fields.${name}` になる。 */
  parentScope: string;
  isAppliedAndUnchanged: boolean;
}) {
  const handleAdd = () => {
    onChange([...variants, { value: `variant_${variants.length + 1}`, fields: [] }]);
  };

  const handleUpdate = (index: number, updates: Partial<VariantDef>) => {
    onChange(variants.map((v, i) => (i === index ? { ...v, ...updates } : v)));
  };

  const handleRemove = (index: number) => {
    onChange(variants.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {variants.map((variant, i) => {
        const isDuplicate = variants.filter((v) => v.value === variant.value).length > 1;
        return (
          <div key={i} className="bg-surface-panel/30 border border-border-base/30 rounded-lg p-3 space-y-2">
            <div className="flex gap-2 items-center">
              <div className="flex-1 space-y-1">
                <FieldLabel>Variant Value</FieldLabel>
                <Input
                  type="text"
                  aria-label="Variant value"
                  value={variant.value}
                  onChange={(e) => handleUpdate(i, { value: e.target.value.trim() })}
                  className={cn(
                    'h-7 text-[12px] font-mono',
                    isDuplicate || variant.value.trim() === '' ? 'border-danger-base ring-danger-base/20' : '',
                  )}
                  placeholder="e.g. wait"
                />
              </div>
              <div className="flex-1 space-y-1">
                <FieldLabel>Label (optional)</FieldLabel>
                <Input
                  type="text"
                  aria-label={`${variant.value} label`}
                  value={variant.label || ''}
                  onChange={(e) => handleUpdate(i, { label: e.target.value })}
                  className="h-7 text-[12px]"
                  placeholder="e.g. Wait"
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove variant ${variant.value}`}
                onClick={() => handleRemove(i)}
                className="mt-4 text-text-muted hover:text-danger-base hover:bg-danger-base/10"
              >
                <Trash2 size={13} />
              </Button>
            </div>
            <FieldListEditor
              fields={variant.fields}
              onChange={(fields) => handleUpdate(i, { fields })}
              definitionNames={definitionNames}
              parentScope={`${parentScope}.variants.${variant.value}`}
              isAppliedAndUnchanged={isAppliedAndUnchanged}
              addLabel="Add Field to Variant"
            />
          </div>
        );
      })}
      <Button variant="secondary" size="xs" onClick={handleAdd}>
        <Plus size={12} className="mr-1" /> Add Variant
      </Button>
    </div>
  );
}
