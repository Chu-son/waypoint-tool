import { useMemo } from 'react';
import { cn } from '../../../utils/cn';
import { collapseContext, type DiffLine } from '../../../utils/diff/lineDiff';

interface TextDiffViewProps {
  lines: DiffLine[];
  /** 変更行の前後に残す変更なし行の数。それ以外は「N lines unchanged」にまとめる。 */
  contextLines?: number;
  'aria-label'?: string;
  className?: string;
}

const ROW_STYLES = {
  add: 'bg-status-success/10 text-status-success',
  del: 'bg-danger-base/10 text-danger-base',
  same: 'text-text-muted',
} as const;

const SIGNS = { add: '+', del: '-', same: ' ' } as const;

/** 行単位の差分を、追加（緑）・削除（赤）で色分けして表示する。 */
export function TextDiffView({
  lines,
  contextLines = 2,
  'aria-label': ariaLabel = 'Diff',
  className,
}: TextDiffViewProps) {
  const rows = useMemo(() => collapseContext(lines, contextLines), [lines, contextLines]);

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'max-h-64 overflow-auto rounded-lg border border-border-base bg-surface-base/40 py-1 font-mono text-[11px] leading-snug',
        className,
      )}
    >
      {rows.map((row, index) =>
        row.type === 'collapsed' ? (
          <div key={index} className="px-3 py-0.5 text-text-muted/60 select-none">
            … {row.count} lines unchanged
          </div>
        ) : (
          <div key={index} className={cn('flex px-2', ROW_STYLES[row.type])}>
            <span aria-hidden="true" className="w-4 shrink-0 select-none">
              {SIGNS[row.type]}
            </span>
            <span className="whitespace-pre-wrap break-all">{row.text}</span>
          </div>
        ),
      )}
    </div>
  );
}
