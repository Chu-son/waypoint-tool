import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../../utils/cn';
import type { DiffLine } from '../../../utils/diff/lineDiff';
import type { ItemDiffStatus } from '../../../utils/diff/itemDiff';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { EmptyState } from './EmptyState';
import { TextDiffView } from './TextDiffView';

export interface ItemDiffRow {
  id: string;
  label: string;
  /** ラベルの下に出す補足（種類・要約など）。 */
  description?: string;
  status: ItemDiffStatus;
  /** 展開したときに見せる、現在 → 取り込み元の行差分。 */
  lines?: DiffLine[];
  /** チェックボックスの操作名。省略時は `Import <label>`。 */
  actionLabel?: string;
}

interface ItemDiffListProps {
  rows: ItemDiffRow[];
  /** チェックが入っている（取り込む）行の ID。 */
  accepted: ReadonlySet<string>;
  onChange: (accepted: Set<string>) => void;
  /** 状態バッジの文言。省略した状態は既定の文言。 */
  statusLabels?: Partial<Record<ItemDiffStatus, string>>;
  className?: string;
}

const DEFAULT_STATUS_LABELS: Record<ItemDiffStatus, string> = {
  added: 'New',
  changed: 'Changed',
  removed: 'Only here',
  unchanged: 'Same',
};

const STATUS_STYLES: Record<ItemDiffStatus, string> = {
  added: 'bg-status-success/15 text-status-success border-status-success/30',
  changed: 'bg-status-warning/15 text-status-warning border-status-warning/30',
  removed: 'bg-danger-base/10 text-danger-base border-danger-base/30',
  unchanged: 'bg-surface-hover text-text-muted border-border-base',
};

/**
 * 項目ごとに差分を一覧し、取り込む項目をチェックボックスで選ぶ汎用リスト。
 * 変更のある行は展開すると行単位の差分が見られる。変更の無い行は既定では隠し、チェックもできない。
 */
export function ItemDiffList({ rows, accepted, onChange, statusLabels, className }: ItemDiffListProps) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const labels = { ...DEFAULT_STATUS_LABELS, ...statusLabels };

  const selectable = rows.filter((r) => r.status !== 'unchanged');
  const unchangedCount = rows.length - selectable.length;
  const visible = showUnchanged ? rows : selectable;

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(accepted);
    if (checked) next.add(id);
    else next.delete(id);
    onChange(next);
  };
  const toggleExpanded = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  if (rows.length === 0) return <EmptyState message="There is nothing to compare." />;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
        <span>
          {selectable.filter((r) => accepted.has(r.id)).length} of {selectable.length} selected
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onChange(new Set(selectable.map((r) => r.id)))}
            disabled={selectable.length === 0}
          >
            Select all
          </Button>
          <Button variant="ghost" size="xs" onClick={() => onChange(new Set())} disabled={accepted.size === 0}>
            Clear
          </Button>
          {unchangedCount > 0 && (
            <Button variant="ghost" size="xs" onClick={() => setShowUnchanged(!showUnchanged)}>
              {showUnchanged ? 'Hide' : 'Show'} {unchangedCount} unchanged
            </Button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState message="No differences. Everything is already the same here." />
      ) : (
        <ul className="space-y-1.5">
          {visible.map((row) => {
            const isOpen = expanded.has(row.id);
            const canExpand = !!row.lines && row.lines.length > 0;
            return (
              <li key={row.id} className="rounded-lg border border-border-base bg-surface-panel/40">
                <div className="flex items-center gap-3 px-3 py-2">
                  <Checkbox
                    checked={accepted.has(row.id)}
                    disabled={row.status === 'unchanged'}
                    onChange={(e) => toggle(row.id, e.target.checked)}
                    aria-label={row.actionLabel ?? `Import ${row.label}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-text-base">{row.label}</p>
                    {row.description && <p className="truncate text-[11px] text-text-muted">{row.description}</p>}
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold',
                      STATUS_STYLES[row.status],
                    )}
                  >
                    {labels[row.status]}
                  </span>
                  {canExpand && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => toggleExpanded(row.id)}
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? 'Hide' : 'Show'} changes of ${row.label}`}
                      title={isOpen ? 'Hide changes' : 'Show changes'}
                    >
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </Button>
                  )}
                </div>
                {isOpen && canExpand && (
                  <div className="border-t border-border-base/60 p-2">
                    <TextDiffView lines={row.lines!} aria-label={`Changes of ${row.label}`} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
