import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../../common/Button';
import { Input } from '../../common/Input';

/**
 * `string` 型の選択肢（`enum_values`）をチップとして追加・削除する。
 * 既定値・値の入力欄と紛らわしかった CSV テキスト欄を置き換える。
 */
export function ChoicesEditor({
  values,
  onChange,
  fieldName,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  fieldName: string;
}) {
  const [draft, setDraft] = useState('');

  const handleAdd = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setDraft('');
  };

  return (
    <div className="space-y-1.5">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 text-[11px] font-mono bg-surface-hover px-2 py-0.5 rounded-full border border-border-base/40"
            >
              {v}
              <button
                type="button"
                aria-label={`Remove choice ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="text-text-muted hover:text-danger-base"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <Input
          type="text"
          aria-label={`${fieldName} new choice`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="例: normal"
          className="h-7 text-[12px] font-mono flex-1"
        />
        <Button
          variant="ghost"
          size="xs"
          disabled={!draft.trim()}
          onClick={handleAdd}
          className="text-primary-base hover:bg-primary-base/10"
        >
          <Plus size={12} className="mr-1" /> Add Choice
        </Button>
      </div>
    </div>
  );
}
