import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../common/Button';
import { Input } from '../../common/Input';
import { cn } from '../../../../utils/cn';
import { SchemaFieldCell } from './SchemaFieldCell';
import { TypeSpecEditor } from './TypeSpecEditor';
import type { DefinitionDef } from '../../../../types/options';

/** Returns a `base`, `base_1`, `base_2`... key that no definition uses yet. */
function uniqueDefinitionName(base: string, definitions: { name: string }[]) {
  let name = base;
  let counter = 1;
  while (definitions.some((d) => d.name === name)) {
    name = `${base}_${counter}`;
    counter++;
  }
  return name;
}

/**
 * `OptionsSchema.definitions`（名前付き型定義）の一覧を編集する。定義した型は、
 * option/global/object のフィールド・union のバリアントフィールドから
 * `{ type: 'ref', ref: <name> }` で参照でき、同じ構造を複数箇所で使い回せる。
 */
export function DefinitionListEditor({
  definitions,
  onChange,
  isAppliedAndUnchanged,
}: {
  definitions: DefinitionDef[];
  onChange: (definitions: DefinitionDef[]) => void;
  isAppliedAndUnchanged: boolean;
}) {
  const allNames = definitions.map((d) => d.name).filter((n) => n.trim() !== '');

  const handleAdd = () => {
    onChange([...definitions, { name: uniqueDefinitionName('definition', definitions), type: 'string' }]);
  };
  const handleUpdate = (index: number, updates: Partial<DefinitionDef>) => {
    onChange(definitions.map((d, i) => (i === index ? { ...d, ...updates } : d)));
  };
  const handleRemove = (index: number) => {
    onChange(definitions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {definitions.map((d, i) => {
        const isDuplicateName = definitions.filter((x) => x.name === d.name).length > 1;
        // 直接の自己参照は明らかな誤りなので候補から外す（間接的な循環は validateSchema が検出する）。
        const definitionNamesForThis = allNames.filter((n) => n !== d.name);
        return (
          <div key={i} className="bg-surface-panel/40 p-4 rounded-xl border border-border-base/30 space-y-3">
            <div className="flex gap-3 items-start">
              <SchemaFieldCell label="Type Name" className="flex-1">
                <Input
                  type="text"
                  aria-label="Definition name"
                  value={d.name}
                  onChange={(e) =>
                    handleUpdate(i, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() })
                  }
                  className={cn(
                    'h-8 text-[13px] font-mono',
                    isDuplicateName || d.name.trim() === ''
                      ? 'border-danger-base focus:border-danger-base ring-danger-base/20'
                      : '',
                  )}
                  placeholder="e.g. action"
                />
              </SchemaFieldCell>
              <SchemaFieldCell label="Label (optional)" className="flex-1">
                <Input
                  type="text"
                  aria-label={`${d.name} definition label`}
                  value={d.label || ''}
                  onChange={(e) => handleUpdate(i, { label: e.target.value || undefined })}
                  className="h-8 text-[13px]"
                  placeholder="e.g. Action"
                />
              </SchemaFieldCell>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove definition ${d.name}`}
                onClick={() => handleRemove(i)}
                className="mt-6 text-text-muted hover:text-danger-base hover:bg-danger-base/10"
              >
                <Trash2 size={16} />
              </Button>
            </div>
            <SchemaFieldCell label="Description (optional)">
              <Input
                type="text"
                aria-label={`${d.name} definition description`}
                value={d.description || ''}
                onChange={(e) => handleUpdate(i, { description: e.target.value || undefined })}
                className="h-8 text-[13px]"
                placeholder="この型が何を表すかの補足説明"
              />
            </SchemaFieldCell>
            <TypeSpecEditor
              spec={d}
              onChange={(spec) => handleUpdate(i, spec)}
              definitionNames={definitionNamesForThis}
              fieldName={d.name}
              scope={`definitions.${d.name}`}
              isAppliedAndUnchanged={isAppliedAndUnchanged}
            />
          </div>
        );
      })}
      <Button variant="secondary" size="sm" onClick={handleAdd}>
        <Plus size={14} className="mr-1" /> Add Definition
      </Button>
    </div>
  );
}
