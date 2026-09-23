import { ConditionGroup, ConditionRule, ConditionOperator } from '../../../types/store';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface ConditionItemEditorProps {
  item: ConditionRule | ConditionGroup;
  onChange: (updated: ConditionRule | ConditionGroup) => void;
  onDelete: () => void;
  optionsList: string[];
  depth?: number;
}

function ConditionItemEditor({ item, onChange, onDelete, optionsList, depth = 0 }: ConditionItemEditorProps) {
  if (item.type === 'group') {
    return (
      <ConditionGroupEditor
        group={item}
        onChange={onChange}
        onDelete={onDelete}
        optionsList={optionsList}
        depth={depth}
      />
    );
  }

  const rule = item as ConditionRule;

  const operators: { value: ConditionOperator; label: string }[] = [
    { value: 'equals', label: '= 等しい (equals)' },
    { value: 'not_equals', label: '!= 等しくない (not equals)' },
    { value: 'greater_than', label: '> より大きい (greater than)' },
    { value: 'greater_than_or_equal', label: '>= 以上 (greater or equal)' },
    { value: 'less_than', label: '< より小さい (less than)' },
    { value: 'less_than_or_equal', label: '<= 以下 (less or equal)' },
    { value: 'between', label: '範囲内 (between)' },
    { value: 'contains', label: '含む (contains)' },
    { value: 'in', label: 'リストのいずれか (in)' },
    { value: 'is_empty', label: '空である (is empty)' },
    { value: 'is_not_empty', label: '空でない (is not empty)' },
  ];

  const handlePropertyChange = (prop: string) => {
    onChange({ ...rule, property: prop });
  };

  const handleOperatorChange = (op: ConditionOperator) => {
    onChange({ ...rule, operator: op });
  };

  const handleValueChange = (val: string) => {
    onChange({ ...rule, value: val });
  };

  const isNoValueNeeded = rule.operator === 'is_empty' || rule.operator === 'is_not_empty';

  return (
    <div className="flex flex-wrap items-center gap-2 bg-surface-base/50 p-2.5 rounded-lg border border-border-base/30 text-xs">
      <div className="flex-1 min-w-[130px]">
        <Input
          type="text"
          list="property-options-list"
          value={rule.property}
          onChange={(e) => handlePropertyChange(e.target.value)}
          placeholder="options.key or prop"
          className="h-7 text-xs font-mono w-full"
        />
      </div>

      <div className="w-36 shrink-0">
        <Select
          value={rule.operator}
          onChange={(e) => handleOperatorChange(e.target.value as ConditionOperator)}
          className="h-7 text-xs w-full"
        >
          {operators.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </Select>
      </div>

      {!isNoValueNeeded && (
        <div className="flex-1 min-w-[120px]">
          <Input
            type="text"
            value={String(rule.value ?? '')}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="比較値 (例: true, 1.5, charge)"
            className="h-7 text-xs w-full"
          />
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="text-text-muted hover:text-danger-base h-7 w-7 p-0 shrink-0 ml-auto"
        title="条件を削除"
      >
        <Trash2 size={13} />
      </Button>
    </div>
  );
}

interface ConditionGroupEditorProps {
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  onDelete?: () => void;
  optionsList: string[];
  depth?: number;
}

export function ConditionGroupEditor({ group, onChange, onDelete, optionsList, depth = 0 }: ConditionGroupEditorProps) {
  const handleLogicalChange = (logical: 'and' | 'or') => {
    onChange({ ...group, logicalOperator: logical });
  };

  const handleAddRule = () => {
    const defaultProp = optionsList.length > 0 ? `options.${optionsList[0]}` : 'options.type';
    const newRule: ConditionRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'rule',
      property: defaultProp,
      operator: 'equals',
      value: '',
    };
    onChange({ ...group, children: [...group.children, newRule] });
  };

  const handleAddSubGroup = () => {
    const newSubGroup: ConditionGroup = {
      id: `group_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'group',
      logicalOperator: 'and',
      children: [],
    };
    onChange({ ...group, children: [...group.children, newSubGroup] });
  };

  const handleChildChange = (index: number, updated: ConditionRule | ConditionGroup) => {
    const nextChildren = [...group.children];
    nextChildren[index] = updated;
    onChange({ ...group, children: nextChildren });
  };

  const handleChildDelete = (index: number) => {
    const nextChildren = group.children.filter((_, i) => i !== index);
    onChange({ ...group, children: nextChildren });
  };

  return (
    <div
      className={cn(
        'rounded-xl border p-3 space-y-2.5 transition-colors',
        depth === 0 ? 'bg-surface-panel/30 border-border-base/40' : 'bg-surface-panel/60 border-primary-base/20',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-text-muted">一致条件:</span>
          <div className="flex rounded-md p-0.5 bg-surface-base border border-border-base/40">
            <button
              type="button"
              onClick={() => handleLogicalChange('and')}
              className={cn(
                'px-2 py-0.5 rounded text-[11px] font-bold transition-colors whitespace-nowrap',
                group.logicalOperator === 'and'
                  ? 'bg-primary-base text-white shadow-xs'
                  : 'text-text-muted hover:text-text-base',
              )}
            >
              すべて一致 (AND)
            </button>
            <button
              type="button"
              onClick={() => handleLogicalChange('or')}
              className={cn(
                'px-2 py-0.5 rounded text-[11px] font-bold transition-colors whitespace-nowrap',
                group.logicalOperator === 'or'
                  ? 'bg-primary-base text-white shadow-xs'
                  : 'text-text-muted hover:text-text-base',
              )}
            >
              いずれか一致 (OR)
            </button>
          </div>
          <span className="text-[11px] text-text-muted shrink-0">({group.children.length} 項目)</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddRule}
            className="h-6.5 text-[11px] px-2 gap-1 text-primary-base hover:bg-primary-base/10 whitespace-nowrap"
          >
            <Plus size={11} />
            <span>条件追加</span>
          </Button>
          {depth < 2 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddSubGroup}
              className="h-6.5 text-[11px] px-2 gap-1 text-accent-generator hover:bg-accent-generator/10 whitespace-nowrap"
            >
              <Plus size={11} />
              <span>グループ追加</span>
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-6.5 w-6.5 p-0 text-danger-base hover:bg-danger-base/10 shrink-0"
              title="グループを削除"
            >
              <Trash2 size={12} />
            </Button>
          )}
        </div>
      </div>

      {group.children.length === 0 ? (
        <div className="text-center py-3 text-xs text-text-muted italic border border-dashed border-border-base/40 rounded-lg">
          条件が指定されていません（すべてに一致します）。「条件追加」をクリックしてルールを記述してください。
        </div>
      ) : (
        <div className="space-y-2">
          {group.children.map((child, idx) => (
            <ConditionItemEditor
              key={idx}
              item={child}
              onChange={(upd) => handleChildChange(idx, upd)}
              onDelete={() => handleChildDelete(idx)}
              optionsList={optionsList}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
