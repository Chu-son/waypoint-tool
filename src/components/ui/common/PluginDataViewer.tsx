import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Copy, Check, Search, Code2 } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../../utils/cn';

interface PluginDataViewerProps {
  data: any;
  title?: string;
  className?: string;
  defaultExpanded?: boolean;
}

function JsonNode({
  keyName,
  value,
  depth = 0,
  searchTerm = '',
}: {
  keyName?: string;
  value: any;
  depth?: number;
  searchTerm?: string;
}) {
  const [isExpanded, setIsExpanded] = useState<boolean>(depth < 2);

  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isCompound = isObject || isArray;

  // Search matching
  const isMatch = useMemo(() => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    if (keyName && keyName.toLowerCase().includes(term)) return true;
    if (!isCompound && String(value).toLowerCase().includes(term)) return true;
    return false;
  }, [keyName, value, isCompound, searchTerm]);

  if (!isMatch && !isCompound) {
    return null;
  }

  if (isCompound) {
    const keys = isArray ? value.map((_: any, idx: number) => String(idx)) : Object.keys(value);
    const count = keys.length;

    return (
      <div className="text-xs font-mono select-text" style={{ paddingLeft: depth > 0 ? 14 : 0 }}>
        <div
          className="flex items-center gap-1 py-0.5 px-1 rounded hover:bg-surface-hover/60 cursor-pointer text-text-base"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="text-text-muted hover:text-text-base">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          {keyName && <span className="text-primary-base font-semibold">{keyName}: </span>}
          <span className="text-text-muted/80 text-[11px]">
            {isArray ? `Array(${count})` : `Object{${count}}`}
          </span>
        </div>

        {isExpanded && (
          <div className="border-l border-border-base/40 ml-2 pl-1 space-y-0.5">
            {keys.map((k: string) => (
              <JsonNode
                key={k}
                keyName={isArray ? undefined : k}
                value={value[k]}
                depth={depth + 1}
                searchTerm={searchTerm}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Primitive leaf node
  let valueColor = 'text-status-success'; // String
  let formattedValue = JSON.stringify(value);

  if (typeof value === 'number') {
    valueColor = 'text-accent-automation';
    formattedValue = String(value);
  } else if (typeof value === 'boolean') {
    valueColor = 'text-accent-reference';
    formattedValue = value ? 'true' : 'false';
  } else if (value === null) {
    valueColor = 'text-text-muted/60';
    formattedValue = 'null';
  }

  return (
    <div
      className="flex items-baseline gap-1.5 py-0.5 px-1 text-xs font-mono hover:bg-surface-hover/40 rounded select-text"
      style={{ paddingLeft: depth > 0 ? 14 : 0 }}
    >
      {keyName && <span className="text-text-muted">{keyName}:</span>}
      <span className={cn('break-all font-medium', valueColor)}>{formattedValue}</span>
    </div>
  );
}

export function PluginDataViewer({
  data,
  title = 'Plugin Internal Data (plugin_data)',
  className,
  defaultExpanded = true,
}: PluginDataViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSectionOpen, setIsSectionOpen] = useState(defaultExpanded);

  if (data === undefined || data === null) {
    return (
      <div className={cn('bg-surface-panel/30 border border-border-base/30 rounded-xl p-3 text-xs text-text-muted/70 italic text-center', className)}>
        プラグイン内部データ (plugin_data) はありません。
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn('bg-surface-panel/40 border border-border-base/40 rounded-xl overflow-hidden', className)}>
      {/* Header */}
      <div
        onClick={() => setIsSectionOpen(!isSectionOpen)}
        className="flex items-center justify-between px-3 py-2 bg-surface-panel/80 border-b border-border-base/30 cursor-pointer select-none"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Code2 size={14} className="text-primary-base shrink-0" />
          <span className="text-xs font-bold text-text-base truncate">{title}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-6 px-1.5 text-[11px] gap-1 text-text-muted hover:text-text-base"
            title="JSONをクリップボードにコピー"
          >
            {copied ? <Check size={12} className="text-status-success" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </Button>

          <button
            onClick={() => setIsSectionOpen(!isSectionOpen)}
            className="p-1 hover:bg-surface-hover rounded text-text-muted"
          >
            {isSectionOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      {/* Content */}
      {isSectionOpen && (
        <div className="p-2 space-y-2">
          {/* Search bar */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted/60" />
            <input
              type="text"
              placeholder="Filter keys or values..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-base border border-border-base/40 rounded-lg pl-7 pr-2 py-1 text-xs text-text-base placeholder:text-text-muted/40 focus:outline-none focus:border-primary-base/70"
            />
          </div>

          {/* JSON Tree */}
          <div className="max-h-60 overflow-y-auto p-1.5 bg-surface-base/80 rounded-lg border border-border-base/30 font-mono">
            <JsonNode value={data} depth={0} searchTerm={searchTerm} />
          </div>
        </div>
      )}
    </div>
  );
}
