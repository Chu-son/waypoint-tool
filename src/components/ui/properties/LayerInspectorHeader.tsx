import { useEffect, useState, type ReactNode } from 'react';
import { Copy, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { FieldLabel } from '../common/FieldLabel';

interface LayerInspectorHeaderProps {
  icon: ReactNode;
  kind: string;
  name: string;
  onRename: (name: string) => void;
  visible: boolean;
  /** Hidden by a group above it although its own flag is on. */
  hiddenByAncestor?: boolean;
  onToggleVisible: () => void;
  onDuplicate?: () => void;
  onRemove: () => void;
}

/** Top of the inspector for an item of the layer tree: kind, name, visibility, duplicate and delete. */
export function LayerInspectorHeader({
  icon,
  kind,
  name,
  onRename,
  visible,
  hiddenByAncestor,
  onToggleVisible,
  onDuplicate,
  onRemove,
}: LayerInspectorHeaderProps) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    else setDraft(name);
  };

  return (
    <div className="space-y-2 pb-3 border-b border-border-base/50">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-text-base flex items-center gap-2 min-w-0">
          {icon}
          <span className="truncate">{kind}</span>
        </h2>
        <div className="flex items-center gap-1 shrink-0">
          {onDuplicate && (
            <Button variant="ghost" size="icon-sm" onClick={onDuplicate} aria-label="複製" title="複製 (Ctrl+D)">
              <Copy size={14} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleVisible}
            aria-label={visible ? '非表示にする' : '表示する'}
            aria-pressed={visible}
            title={hiddenByAncestor ? '上のグループが非表示のため表示されていません' : undefined}
            className={hiddenByAncestor ? 'text-text-muted/50' : undefined}
          >
            {visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label="削除"
            title="削除 (Delete)"
            className="hover:text-danger-base hover:bg-danger-base/10"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        <FieldLabel>Name</FieldLabel>
        <Input
          aria-label="Name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
          }}
          className="h-7 text-xs"
        />
      </div>
    </div>
  );
}
