import { useId } from 'react';
import {
  ConditionCollection,
  ConditionGroup,
  ConditionNode,
  ConditionOperator,
  ConditionQuantifier,
  ConditionRule,
  OptionsSchema,
} from '../../../types/store';
import type { TypeSpec } from '../../../types/options';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '../../../utils/cn';
import {
  findOptionSpecAtPath,
  findSpecAtPath,
  getElementSpec,
  listCollectionPaths,
  listElementPropertyPaths,
  listPropertyPaths,
  listValueCandidates,
} from '../../../utils/optionSchema';

/**
 * 条件のプロパティが指す先。`root` は waypoint / annotation 本体（`options.*` は実効スキーマから補完）、
 * `element` は要素条件（`ConditionCollection`）の中で、list の要素 / map の値からの相対パスを指す。
 */
export type ConditionScope =
  { kind: 'root'; schema: OptionsSchema | null } | { kind: 'element'; spec: TypeSpec | undefined };

const ROOT_PROPERTIES = ['name', 'type', 'index', 'transform.x', 'transform.y', 'transform.yaw'];

function listScopePropertyPaths(scope: ConditionScope): string[] {
  if (scope.kind === 'element') return listElementPropertyPaths(scope.spec);
  return [...ROOT_PROPERTIES, ...(scope.schema ? listPropertyPaths(scope.schema) : [])];
}

function findScopeSpec(scope: ConditionScope, property: string): TypeSpec | undefined {
  if (scope.kind === 'root') return findOptionSpecAtPath(scope.schema, property);
  return scope.spec ? findSpecAtPath(scope.spec, property ? property.split('.') : []) : undefined;
}

function listScopeCollectionPaths(scope: ConditionScope): string[] {
  if (scope.kind === 'root') return scope.schema ? listCollectionPaths(scope.schema) : [];
  return listScopePropertyPaths(scope).filter((p) => getElementSpec(findScopeSpec(scope, p)));
}

const OPERATORS: { value: ConditionOperator; label: string }[] = [
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

const QUANTIFIERS: { value: ConditionQuantifier; label: string }[] = [
  { value: 'any', label: 'いずれかの要素が一致 (any)' },
  { value: 'all', label: 'すべての要素が一致 (all)' },
  { value: 'none', label: 'どの要素も一致しない (none)' },
];

const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

interface ConditionItemEditorProps {
  item: ConditionNode;
  onChange: (updated: ConditionNode) => void;
  onDelete: () => void;
  scope: ConditionScope;
  propertyListId: string;
  depth?: number;
}

function ConditionItemEditor({ item, onChange, onDelete, scope, propertyListId, depth = 0 }: ConditionItemEditorProps) {
  if (item.type === 'group') {
    return <ConditionGroupEditor group={item} onChange={onChange} onDelete={onDelete} scope={scope} depth={depth} />;
  }
  if (item.type === 'collection') {
    return (
      <ConditionCollectionEditor node={item} onChange={onChange} onDelete={onDelete} scope={scope} depth={depth} />
    );
  }
  return (
    <ConditionRuleEditor
      rule={item}
      onChange={onChange}
      onDelete={onDelete}
      scope={scope}
      propertyListId={propertyListId}
    />
  );
}

interface ConditionRuleEditorProps {
  rule: ConditionRule;
  onChange: (updated: ConditionRule) => void;
  onDelete: () => void;
  scope: ConditionScope;
  propertyListId: string;
}

function ConditionRuleEditor({ rule, onChange, onDelete, scope, propertyListId }: ConditionRuleEditorProps) {
  const valueListId = useId();
  const valueCandidates = listValueCandidates(findScopeSpec(scope, rule.property));
  const isNoValueNeeded = rule.operator === 'is_empty' || rule.operator === 'is_not_empty';

  return (
    <div className="flex flex-wrap items-center gap-2 bg-surface-base/50 p-2.5 rounded-lg border border-border-base/30 text-xs">
      <div className="flex-1 min-w-[130px]">
        <Input
          type="text"
          list={propertyListId}
          value={rule.property}
          onChange={(e) => onChange({ ...rule, property: e.target.value })}
          placeholder={scope.kind === 'element' ? '要素のキー (空 = 要素自身)' : 'options.key or prop'}
          aria-label="プロパティ"
          className="h-7 text-xs font-mono w-full"
        />
      </div>

      <div className="w-36 shrink-0">
        <Select
          value={rule.operator}
          onChange={(e) => onChange({ ...rule, operator: e.target.value as ConditionOperator })}
          aria-label="演算子"
          className="h-7 text-xs w-full"
        >
          {OPERATORS.map((op) => (
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
            list={valueCandidates.length > 0 ? valueListId : undefined}
            value={String(rule.value ?? '')}
            onChange={(e) => onChange({ ...rule, value: e.target.value })}
            placeholder="比較値 (例: true, 1.5, charge)"
            aria-label="比較値"
            className="h-7 text-xs w-full"
          />
          {valueCandidates.length > 0 && (
            <datalist id={valueListId}>
              {valueCandidates.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          )}
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

interface ConditionCollectionEditorProps {
  node: ConditionCollection;
  onChange: (updated: ConditionCollection) => void;
  onDelete: () => void;
  scope: ConditionScope;
  depth: number;
}

function ConditionCollectionEditor({ node, onChange, onDelete, scope, depth }: ConditionCollectionEditorProps) {
  const collectionListId = useId();
  const elementScope: ConditionScope = {
    kind: 'element',
    spec: getElementSpec(findScopeSpec(scope, node.property)),
  };

  return (
    <div className="rounded-lg border border-accent-generator/30 bg-surface-base/30 p-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] font-semibold text-accent-generator shrink-0">要素条件</span>
        <div className="flex-1 min-w-[130px]">
          <Input
            type="text"
            list={collectionListId}
            value={node.property}
            onChange={(e) => onChange({ ...node, property: e.target.value })}
            placeholder="list / map のプロパティ"
            aria-label="対象リスト"
            className="h-7 text-xs font-mono w-full"
          />
          <datalist id={collectionListId}>
            {listScopeCollectionPaths(scope).map((path) => (
              <option key={path} value={path} />
            ))}
          </datalist>
        </div>
        <div className="w-52 shrink-0">
          <Select
            value={node.quantifier}
            onChange={(e) => onChange({ ...node, quantifier: e.target.value as ConditionQuantifier })}
            aria-label="量化子"
            className="h-7 text-xs w-full"
          >
            {QUANTIFIERS.map((q) => (
              <option key={q.value} value={q.value}>
                {q.label}
              </option>
            ))}
          </Select>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-text-muted hover:text-danger-base h-7 w-7 p-0 shrink-0 ml-auto"
          title="要素条件を削除"
        >
          <Trash2 size={13} />
        </Button>
      </div>
      <ConditionGroupEditor
        group={node.condition}
        onChange={(condition) => onChange({ ...node, condition })}
        scope={elementScope}
        depth={depth}
      />
    </div>
  );
}

interface ConditionGroupEditorProps {
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  onDelete?: () => void;
  scope: ConditionScope;
  depth?: number;
}

export function ConditionGroupEditor({ group, onChange, onDelete, scope, depth = 0 }: ConditionGroupEditorProps) {
  const propertyListId = useId();
  const propertyPaths = listScopePropertyPaths(scope);
  const collectionPaths = listScopeCollectionPaths(scope);

  const handleLogicalChange = (logical: 'and' | 'or') => {
    onChange({ ...group, logicalOperator: logical });
  };

  const handleAddRule = () => {
    // 要素スコープの既定は「要素自身」(空パス)。ルートはスキーマ先頭のパスにする。
    const defaultProp =
      scope.kind === 'element' ? '' : (propertyPaths.find((p) => p.startsWith('options.')) ?? 'options.type');
    const newRule: ConditionRule = {
      id: newId('rule'),
      type: 'rule',
      property: defaultProp,
      operator: 'equals',
      value: '',
    };
    onChange({ ...group, children: [...group.children, newRule] });
  };

  const handleAddCollection = () => {
    const newCollection: ConditionCollection = {
      id: newId('collection'),
      type: 'collection',
      property: collectionPaths[0] ?? '',
      quantifier: 'any',
      condition: { id: newId('group'), type: 'group', logicalOperator: 'and', children: [] },
    };
    onChange({ ...group, children: [...group.children, newCollection] });
  };

  const handleAddSubGroup = () => {
    const newSubGroup: ConditionGroup = {
      id: newId('group'),
      type: 'group',
      logicalOperator: 'and',
      children: [],
    };
    onChange({ ...group, children: [...group.children, newSubGroup] });
  };

  const handleChildChange = (index: number, updated: ConditionNode) => {
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
      <datalist id={propertyListId}>
        {propertyPaths.map((path) => (
          <option key={path} value={path} />
        ))}
      </datalist>

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
              onClick={handleAddCollection}
              className="h-6.5 text-[11px] px-2 gap-1 text-accent-generator hover:bg-accent-generator/10 whitespace-nowrap"
            >
              <Plus size={11} />
              <span>要素条件追加</span>
            </Button>
          )}
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
              scope={scope}
              propertyListId={propertyListId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
