import { useState, useMemo } from 'react';
import { useAppStore } from '../../../stores/appStore';
import {
  ConditionalStyleRule,
  ConditionGroup,
  ConditionRule,
  TargetElementType,
  ConditionOperator,
  WaypointShape,
} from '../../../types/store';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { ToggleSwitch } from '../common/ToggleSwitch';
import { FieldLabel } from '../common/FieldLabel';
import { Label } from '../common/Label';
import { TabSectionHeader } from './TabSectionHeader';
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Upload,
  Layers,
  Sparkles,
  Info,
  Check,
} from 'lucide-react';
import { cn } from '../../../utils/cn';

// ============================================================================
// Helper Components: Condition Group & Rule Editor
// ============================================================================

interface ConditionItemEditorProps {
  item: ConditionRule | ConditionGroup;
  onChange: (updated: ConditionRule | ConditionGroup) => void;
  onDelete: () => void;
  optionsList: string[];
  depth?: number;
}

function ConditionItemEditor({
  item,
  onChange,
  onDelete,
  optionsList,
  depth = 0,
}: ConditionItemEditorProps) {
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

function ConditionGroupEditor({
  group,
  onChange,
  onDelete,
  optionsList,
  depth = 0,
}: ConditionGroupEditorProps) {
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
        depth === 0
          ? 'bg-surface-panel/30 border-border-base/40'
          : 'bg-surface-panel/60 border-primary-base/20'
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
                  : 'text-text-muted hover:text-text-base'
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
                  : 'text-text-muted hover:text-text-base'
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

// ============================================================================
// Style Overrides Editor
// ============================================================================

interface StyleOverrideEditorProps {
  rule: ConditionalStyleRule;
  onChange: (rule: ConditionalStyleRule) => void;
  optionsList: string[];
}

function StyleOverrideEditor({ rule, onChange, optionsList }: StyleOverrideEditorProps) {
  const targetElement = rule.targetElement;

  if (targetElement === 'waypoint') {
    const wpStyle = rule.style?.waypoint || {};
    const shapes: { value: WaypointShape; label: string }[] = [
      { value: 'default', label: '矢印 (Arrow)' },
      { value: 'circle', label: '円 (Circle)' },
      { value: 'square', label: '四角形 (Square)' },
      { value: 'diamond', label: '菱形 (Diamond)' },
      { value: 'star', label: '星形 (Star)' },
    ];

    const updateWp = (updates: Partial<typeof wpStyle>) => {
      onChange({
        ...rule,
        style: {
          ...rule.style,
          waypoint: { ...wpStyle, ...updates },
        },
      });
    };

    return (
      <div className="space-y-3 bg-surface-panel/30 p-3 rounded-xl border border-border-base/40">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1">形状 (Shape)</Label>
            <Select
              value={wpStyle.shape || 'default'}
              onChange={(e) => updateWp({ shape: e.target.value as WaypointShape })}
              className="h-8 text-xs w-full"
            >
              {shapes.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1">ラベル表示 (Label)</Label>
            <Select
              value={wpStyle.labelVisible === undefined ? 'default' : wpStyle.labelVisible ? 'show' : 'hide'}
              onChange={(e) => {
                const val = e.target.value;
                updateWp({ labelVisible: val === 'default' ? undefined : val === 'show' });
              }}
              className="h-8 text-xs w-full"
            >
              <option value="default">通常（デフォルト設定に従う）</option>
              <option value="show">強制表示 (Show)</option>
              <option value="hide">強制非表示 (Hide)</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1">枠線色 (Border Color)</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={wpStyle.color || '#3b82f6'}
                onChange={(e) => updateWp({ color: e.target.value })}
                className="w-8 h-8 rounded border border-border-base cursor-pointer bg-transparent p-0 shrink-0"
              />
              <Input
                type="text"
                value={wpStyle.color || ''}
                onChange={(e) => updateWp({ color: e.target.value })}
                placeholder="Hex (例: #ff0000)"
                className="h-8 text-xs font-mono flex-1 min-w-0"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1">塗り色 (Fill Color)</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={wpStyle.fillColor || '#60a5fa'}
                onChange={(e) => updateWp({ fillColor: e.target.value })}
                className="w-8 h-8 rounded border border-border-base cursor-pointer bg-transparent p-0 shrink-0"
              />
              <Input
                type="text"
                value={wpStyle.fillColor || ''}
                onChange={(e) => updateWp({ fillColor: e.target.value })}
                placeholder="Hex (未指定なら枠色同等)"
                className="h-8 text-xs font-mono flex-1 min-w-0"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1">スケール倍率 (Scale: 0.1 ~ 5.0)</Label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              max="5.0"
              value={wpStyle.scale !== undefined ? String(wpStyle.scale) : ''}
              onChange={(e) => updateWp({ scale: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="1.0"
              className="h-8 text-xs font-mono w-full"
            />
          </div>

          <div>
            <Label className="text-xs mb-1">不透明度 (Opacity: 0.0 ~ 1.0)</Label>
            <Input
              type="number"
              step="0.05"
              min="0.0"
              max="1.0"
              value={wpStyle.opacity !== undefined ? String(wpStyle.opacity) : ''}
              onChange={(e) => updateWp({ opacity: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="1.0"
              className="h-8 text-xs font-mono w-full"
            />
          </div>
        </div>
      </div>
    );
  }

  if (targetElement === 'path') {
    const pStyle = rule.style?.path || {};

    const updatePath = (updates: Partial<typeof pStyle>) => {
      onChange({
        ...rule,
        style: {
          ...rule.style,
          path: { ...pStyle, ...updates },
        },
      });
    };

    return (
      <div className="space-y-3 bg-surface-panel/30 p-3 rounded-xl border border-border-base/40">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1">適用方向 (Direction)</Label>
            <Select
              value={pStyle.direction || 'outgoing'}
              onChange={(e) => updatePath({ direction: e.target.value as any })}
              className="h-8 text-xs w-full"
            >
              <option value="outgoing">このノードから出る線 (Outgoing)</option>
              <option value="incoming">このノードへ入る線 (Incoming)</option>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1">線種 (Dash Pattern)</Label>
            <Select
              value={pStyle.dashPattern || 'solid'}
              onChange={(e) => updatePath({ dashPattern: e.target.value as any })}
              className="h-8 text-xs w-full"
            >
              <option value="solid">実線 (Solid)</option>
              <option value="dashed">破線 (Dashed)</option>
              <option value="dotted">点線 (Dotted)</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1">線の色 (Path Color)</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={pStyle.color || '#3b82f6'}
                onChange={(e) => updatePath({ color: e.target.value })}
                className="w-8 h-8 rounded border border-border-base cursor-pointer bg-transparent p-0 shrink-0"
              />
              <Input
                type="text"
                value={pStyle.color || ''}
                onChange={(e) => updatePath({ color: e.target.value })}
                placeholder="Hex (例: #10b981)"
                className="h-8 text-xs font-mono flex-1 min-w-0"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1">不透明度 (Opacity)</Label>
            <Input
              type="number"
              step="0.05"
              min="0.0"
              max="1.0"
              value={pStyle.opacity !== undefined ? String(pStyle.opacity) : ''}
              onChange={(e) => updatePath({ opacity: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="0.7"
              className="h-8 text-xs font-mono w-full"
            />
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-border-base/30">
          <Label className="text-xs">線幅の設定方法</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] text-text-muted mb-1">固定線幅 (m)</Label>
              <Input
                type="number"
                step="0.05"
                min="0.01"
                max="5.0"
                value={pStyle.width !== undefined ? String(pStyle.width) : ''}
                disabled={Boolean(pStyle.widthFromOption)}
                onChange={(e) => updatePath({ width: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="0.2"
                className="h-8 text-xs font-mono w-full"
              />
            </div>

            <div>
              <Label className="text-[11px] text-text-muted mb-1">オプションから直接参照</Label>
              <Select
                value={pStyle.widthFromOption || ''}
                onChange={(e) => updatePath({ widthFromOption: e.target.value || undefined })}
                className="h-8 text-xs font-mono w-full"
              >
                <option value="">(使用しない: 固定値)</option>
                {optionsList.map((opt) => (
                  <option key={opt} value={opt}>
                    options.{opt}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (targetElement === 'footprint') {
    const fpStyle = rule.style?.footprint || {};

    const updateFp = (updates: Partial<typeof fpStyle>) => {
      onChange({
        ...rule,
        style: {
          ...rule.style,
          footprint: { ...fpStyle, ...updates },
        },
      });
    };

    return (
      <div className="space-y-3 bg-surface-panel/30 p-3 rounded-xl border border-border-base/40">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1">表示モード (Visibility)</Label>
            <Select
              value={fpStyle.visibleMode || 'default'}
              onChange={(e) => updateFp({ visibleMode: e.target.value as any })}
              className="h-8 text-xs w-full"
            >
              <option value="default">通常設定に従う</option>
              <option value="force_show">強制表示 (Force Show)</option>
              <option value="force_hide">強制非表示 (Force Hide)</option>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1">寸法モード (Size Mode)</Label>
            <Select
              value={fpStyle.sizeMode || 'default'}
              onChange={(e) => updateFp({ sizeMode: e.target.value as any })}
              className="h-8 text-xs w-full"
            >
              <option value="default">デフォルト寸法</option>
              <option value="scale">倍率スケーリング (Scale)</option>
              <option value="from_option">オプションから直接参照</option>
              <option value="custom_value">カスタム固定値</option>
            </Select>
          </div>
        </div>

        {fpStyle.sizeMode === 'scale' && (
          <div>
            <Label className="text-xs mb-1">スケール倍率 (Scale: 0.1 ~ 10.0)</Label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              max="10.0"
              value={fpStyle.scale !== undefined ? String(fpStyle.scale) : ''}
              onChange={(e) => updateFp({ scale: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="1.5"
              className="h-8 text-xs font-mono w-full"
            />
          </div>
        )}

        {fpStyle.sizeMode === 'from_option' && (
          <div>
            <Label className="text-xs mb-1">参照オプションキー (Option Key)</Label>
            <Select
              value={fpStyle.sizeOptionKey || ''}
              onChange={(e) => updateFp({ sizeOptionKey: e.target.value || undefined })}
              className="h-8 text-xs font-mono w-full"
            >
              <option value="">(キーを選択)</option>
              {optionsList.map((opt) => (
                <option key={opt} value={opt}>
                  options.{opt}
                </option>
              ))}
            </Select>
          </div>
        )}

        {fpStyle.sizeMode === 'custom_value' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs mb-1">半径 (Radius: m)</Label>
              <Input
                type="number"
                step="0.05"
                min="0.01"
                value={fpStyle.customRadius !== undefined ? String(fpStyle.customRadius) : ''}
                onChange={(e) => updateFp({ customRadius: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="0.3"
                className="h-8 text-xs font-mono w-full"
              />
            </div>
            <div>
              <Label className="text-xs mb-1">長さ (Length: m)</Label>
              <Input
                type="number"
                step="0.05"
                min="0.01"
                value={fpStyle.customLength !== undefined ? String(fpStyle.customLength) : ''}
                onChange={(e) => updateFp({ customLength: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="0.6"
                className="h-8 text-xs font-mono w-full"
              />
            </div>
            <div>
              <Label className="text-xs mb-1">幅 (Width: m)</Label>
              <Input
                type="number"
                step="0.05"
                min="0.01"
                value={fpStyle.customWidth !== undefined ? String(fpStyle.customWidth) : ''}
                onChange={(e) => updateFp({ customWidth: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="0.4"
                className="h-8 text-xs font-mono w-full"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs mb-1">枠線色</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={fpStyle.strokeColor || '#f59e0b'}
                onChange={(e) => updateFp({ strokeColor: e.target.value })}
                className="w-7 h-7 rounded border border-border-base cursor-pointer bg-transparent p-0 shrink-0"
              />
              <Input
                type="text"
                value={fpStyle.strokeColor || ''}
                onChange={(e) => updateFp({ strokeColor: e.target.value })}
                placeholder="Hex"
                className="h-8 text-xs font-mono flex-1 min-w-0"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1">塗り色</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={fpStyle.fillColor || '#fbbf24'}
                onChange={(e) => updateFp({ fillColor: e.target.value })}
                className="w-7 h-7 rounded border border-border-base cursor-pointer bg-transparent p-0 shrink-0"
              />
              <Input
                type="text"
                value={fpStyle.fillColor || ''}
                onChange={(e) => updateFp({ fillColor: e.target.value })}
                placeholder="Hex"
                className="h-8 text-xs font-mono flex-1 min-w-0"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1">塗り不透明度</Label>
            <Input
              type="number"
              step="0.05"
              min="0.0"
              max="1.0"
              value={fpStyle.fillAlpha !== undefined ? String(fpStyle.fillAlpha) : ''}
              onChange={(e) => updateFp({ fillAlpha: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="0.2"
              className="h-8 text-xs font-mono w-full"
            />
          </div>
        </div>
      </div>
    );
  }

  if (targetElement === 'annotation') {
    const annStyle = rule.style?.annotation || {};

    const updateAnn = (updates: Partial<typeof annStyle>) => {
      onChange({
        ...rule,
        style: {
          ...rule.style,
          annotation: { ...annStyle, ...updates },
        },
      });
    };

    return (
      <div className="space-y-3 bg-surface-panel/30 p-3 rounded-xl border border-border-base/40">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1">表示/非表示 (Visibility)</Label>
            <Select
              value={annStyle.visible === undefined ? 'default' : annStyle.visible ? 'show' : 'hide'}
              onChange={(e) => {
                const val = e.target.value;
                updateAnn({ visible: val === 'default' ? undefined : val === 'show' });
              }}
              className="h-8 text-xs w-full"
            >
              <option value="default">通常設定に従う</option>
              <option value="show">強制表示 (Show)</option>
              <option value="hide">強制非表示 (Hide)</option>
            </Select>
          </div>

          <div>
            <Label className="text-xs mb-1">線幅 (px)</Label>
            <Input
              type="number"
              step="0.5"
              min="0.5"
              max="20"
              value={annStyle.strokeWidth !== undefined ? String(annStyle.strokeWidth) : ''}
              onChange={(e) => updateAnn({ strokeWidth: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="2.0"
              className="h-8 text-xs font-mono w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs mb-1">枠線色</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={annStyle.strokeColor || '#ec4899'}
                onChange={(e) => updateAnn({ strokeColor: e.target.value })}
                className="w-7 h-7 rounded border border-border-base cursor-pointer bg-transparent p-0 shrink-0"
              />
              <Input
                type="text"
                value={annStyle.strokeColor || ''}
                onChange={(e) => updateAnn({ strokeColor: e.target.value })}
                placeholder="Hex"
                className="h-8 text-xs font-mono flex-1 min-w-0"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1">塗り色</Label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={annStyle.fillColor || '#f472b6'}
                onChange={(e) => updateAnn({ fillColor: e.target.value })}
                className="w-7 h-7 rounded border border-border-base cursor-pointer bg-transparent p-0 shrink-0"
              />
              <Input
                type="text"
                value={annStyle.fillColor || ''}
                onChange={(e) => updateAnn({ fillColor: e.target.value })}
                placeholder="Hex"
                className="h-8 text-xs font-mono flex-1 min-w-0"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs mb-1">不透明度</Label>
            <Input
              type="number"
              step="0.05"
              min="0.0"
              max="1.0"
              value={annStyle.opacity !== undefined ? String(annStyle.opacity) : ''}
              onChange={(e) => updateAnn({ opacity: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="1.0"
              className="h-8 text-xs font-mono w-full"
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ============================================================================
// Main ConditionalStylesTab Component
// ============================================================================

export function ConditionalStylesTab() {
  const conditionalStyles = useAppStore((state) => state.conditionalStyles) || [];
  const conditionalStylesEnabled = useAppStore((state) => state.conditionalStylesEnabled);
  const setConditionalStyles = useAppStore((state) => state.setConditionalStyles);
  const setConditionalStylesEnabled = useAppStore((state) => state.setConditionalStylesEnabled);
  const addConditionalStyleRule = useAppStore((state) => state.addConditionalStyleRule);
  const updateConditionalStyleRule = useAppStore((state) => state.updateConditionalStyleRule);
  const removeConditionalStyleRule = useAppStore((state) => state.removeConditionalStyleRule);
  const reorderConditionalStyleRules = useAppStore((state) => state.reorderConditionalStyleRules);
  const optionsSchema = useAppStore((state) => state.optionsSchema);

  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(
    conditionalStyles.length > 0 ? conditionalStyles[0].id : null
  );
  const [copySuccess, setCopySuccess] = useState(false);

  const selectedRule = useMemo(() => {
    return conditionalStyles.find((r) => r.id === selectedRuleId) || null;
  }, [conditionalStyles, selectedRuleId]);

  const optionsList = useMemo(() => {
    return optionsSchema?.options.map((o) => o.name) || [];
  }, [optionsSchema]);

  const handleAddRule = (target: TargetElementType = 'waypoint') => {
    const newRule: ConditionalStyleRule = {
      id: `rule_${Date.now()}`,
      name: `新規ルール (${target})`,
      enabled: true,
      targetElement: target,
      condition: {
        id: `group_${Date.now()}`,
        type: 'group',
        logicalOperator: 'and',
        children: [
          {
            id: `rule_${Date.now()}_child`,
            type: 'rule',
            property: optionsList.length > 0 ? `options.${optionsList[0]}` : 'options.type',
            operator: 'equals',
            value: '',
          },
        ],
      },
      style: {
        waypoint: target === 'waypoint' ? { color: '#ef4444', shape: 'diamond' } : undefined,
        path: target === 'path' ? { color: '#f59e0b', dashPattern: 'dashed' } : undefined,
        footprint: target === 'footprint' ? { visibleMode: 'force_show', strokeColor: '#10b981' } : undefined,
        annotation: target === 'annotation' ? { strokeColor: '#8b5cf6' } : undefined,
      },
      stopIfMatched: false,
    };
    addConditionalStyleRule(newRule);
    setSelectedRuleId(newRule.id);
  };

  const handleDuplicateRule = (rule: ConditionalStyleRule) => {
    const cloned: ConditionalStyleRule = {
      ...JSON.parse(JSON.stringify(rule)),
      id: `rule_${Date.now()}`,
      name: `${rule.name} (コピー)`,
    };
    addConditionalStyleRule(cloned);
    setSelectedRuleId(cloned.id);
  };

  const handleMoveRule = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= conditionalStyles.length) return;
    reorderConditionalStyleRules(index, targetIdx);
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(conditionalStyles, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleImportJson = () => {
    const input = prompt('条件付き書式のJSON設定を貼り付けてください:');
    if (!input) return;
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        setConditionalStyles(parsed);
        if (parsed.length > 0) setSelectedRuleId(parsed[0].id);
        alert(`${parsed.length} 個のルールをインポートしました。`);
      } else {
        alert('無効なJSONフォーマットです。配列である必要があります。');
      }
    } catch (e: any) {
      alert(`インポート失敗: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Property Options datalist for autocomplete */}
      <datalist id="property-options-list">
        <option value="name" />
        <option value="type" />
        <option value="index" />
        <option value="transform.x" />
        <option value="transform.y" />
        <option value="transform.yaw" />
        {optionsList.map((opt) => (
          <option key={opt} value={`options.${opt}`} />
        ))}
      </datalist>

      {/* Header & Global Master Controls */}
      <div className="space-y-3 pb-4 border-b border-border-base/40">
        <TabSectionHeader
          title="Conditional Styles"
          subtitle="Dynamically decorate waypoints, paths, footprints, and annotations based on custom options and conditions."
          icon={Sparkles}
        />

        {/* Master Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface-panel/40 rounded-xl border border-border-base/40">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-text-base">書式オーバーレイを適用:</span>
            <ToggleSwitch
              checked={conditionalStylesEnabled}
              onChange={(checked) => setConditionalStylesEnabled(checked)}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportJson}
              className="gap-1 text-xs h-8"
              title="全ルールをJSON形式でクリップボードにコピー"
            >
              {copySuccess ? <Check size={13} className="text-success-base" /> : <Copy size={13} />}
              <span>{copySuccess ? 'コピー完了' : 'JSONエクスポート'}</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleImportJson}
              className="gap-1 text-xs h-8"
              title="JSONからルールを一括インポート"
            >
              <Upload size={13} />
              <span>インポート</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Rule List (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <FieldLabel>ルール一覧 ({conditionalStyles.length})</FieldLabel>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleAddRule('waypoint')}
                className="text-[11px] h-7 px-2 text-primary-base hover:bg-primary-base/10 border-border-base/40 gap-1 justify-start"
                title="ウェイポイント用ルールを追加"
              >
                <Plus size={12} className="shrink-0" />
                <span className="truncate">Waypoint</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleAddRule('path')}
                className="text-[11px] h-7 px-2 text-accent-generator hover:bg-accent-generator/10 border-border-base/40 gap-1 justify-start"
                title="パス線分用ルールを追加"
              >
                <Plus size={12} className="shrink-0" />
                <span className="truncate">Path</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleAddRule('footprint')}
                className="text-[11px] h-7 px-2 text-accent-anchor hover:bg-accent-anchor/10 border-border-base/40 gap-1 justify-start"
                title="フットプリント用ルールを追加"
              >
                <Plus size={12} className="shrink-0" />
                <span className="truncate">Footprint</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleAddRule('annotation')}
                className="text-[11px] h-7 px-2 text-accent-reference hover:bg-accent-reference/10 border-border-base/40 gap-1 justify-start"
                title="アノテーション用ルールを追加"
              >
                <Plus size={12} className="shrink-0" />
                <span className="truncate">Annotation</span>
              </Button>
            </div>
          </div>

          {conditionalStyles.length === 0 ? (
            <div className="text-center py-8 bg-surface-panel/20 border border-dashed border-border-base/40 rounded-xl space-y-2">
              <Sparkles size={24} className="mx-auto text-primary-base opacity-40" />
              <p className="text-xs text-text-muted">登録されているルールはありません。</p>
              <p className="text-[11px] text-text-muted/70">
                上の追加ボタンから目的の要素に合わせたルールを作成してください。
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {conditionalStyles.map((rule, idx) => {
                const isSelected = rule.id === selectedRuleId;

                const targetBadgeColor: Record<TargetElementType, string> = {
                  waypoint: 'bg-primary-base/15 text-primary-base border-primary-base/30',
                  path: 'bg-accent-generator/15 text-accent-generator border-accent-generator/30',
                  footprint: 'bg-accent-anchor/15 text-accent-anchor border-accent-anchor/30',
                  annotation: 'bg-accent-reference/15 text-accent-reference border-accent-reference/30',
                };

                return (
                  <div
                    key={rule.id}
                    onClick={() => setSelectedRuleId(rule.id)}
                    className={cn(
                      'flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-all cursor-pointer text-xs select-none',
                      isSelected
                        ? 'bg-surface-panel border-primary-base/50 shadow-xs'
                        : 'bg-surface-panel/40 border-border-base/40 hover:bg-surface-panel/70'
                    )}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateConditionalStyleRule(rule.id, { enabled: e.target.checked });
                        }}
                        className="rounded border-border-base text-primary-base focus:ring-0 cursor-pointer shrink-0"
                      />

                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span
                          className={cn(
                            'text-[9px] uppercase px-1.5 py-0.5 rounded font-mono font-bold border shrink-0',
                            targetBadgeColor[rule.targetElement]
                          )}
                        >
                          {rule.targetElement}
                        </span>
                        <span
                          className={cn(
                            'font-medium truncate',
                            rule.enabled ? 'text-text-base' : 'text-text-muted line-through'
                          )}
                          title={rule.name}
                        >
                          {rule.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={idx === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveRule(idx, 'up');
                        }}
                        className="h-6 w-6 p-0 text-text-muted hover:text-text-base disabled:opacity-20"
                        title="上へ移動"
                      >
                        <ChevronUp size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={idx === conditionalStyles.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveRule(idx, 'down');
                        }}
                        className="h-6 w-6 p-0 text-text-muted hover:text-text-base disabled:opacity-20"
                        title="下へ移動"
                      >
                        <ChevronDown size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateRule(rule);
                        }}
                        className="h-6 w-6 p-0 text-text-muted hover:text-text-base"
                        title="複製"
                      >
                        <Copy size={12} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeConditionalStyleRule(rule.id);
                          if (selectedRuleId === rule.id) {
                            setSelectedRuleId(conditionalStyles[0]?.id || null);
                          }
                        }}
                        className="h-6 w-6 p-0 text-text-muted hover:text-danger-base"
                        title="削除"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="p-3 bg-surface-panel/20 rounded-xl border border-border-base/30 text-[11px] text-text-muted space-y-1">
            <div className="flex items-center gap-1 text-text-base font-semibold">
              <Info size={13} className="text-primary-base shrink-0" />
              <span>優先順位と評価ルール</span>
            </div>
            <p>
              リストの上にあるルールから順に評価され、複数のルールが一致した場合は未設定プロパティを補完しながらカスケーディング合成されます。
            </p>
          </div>
        </div>

        {/* Right Column: Rule Editor (8 cols on lg) */}
        <div className="lg:col-span-8">
          {selectedRule ? (
            <div className="space-y-4 bg-surface-panel/30 p-4 rounded-xl border border-border-base/40">
              {/* Rule Basic Settings */}
              <div className="space-y-3 pb-3 border-b border-border-base/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-text-base">ルール設定 (Rule Details)</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-text-muted">一致時に以降の評価を停止:</span>
                    <ToggleSwitch
                      checked={selectedRule.stopIfMatched || false}
                      onChange={(checked) =>
                        updateConditionalStyleRule(selectedRule.id, { stopIfMatched: checked })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1">ルール名</Label>
                    <Input
                      type="text"
                      value={selectedRule.name}
                      onChange={(e) =>
                        updateConditionalStyleRule(selectedRule.id, { name: e.target.value })
                      }
                      className="h-8 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <Label className="text-xs mb-1">対象要素 (Target Element)</Label>
                    <Select
                      value={selectedRule.targetElement}
                      onChange={(e) => {
                        const newTarget = e.target.value as TargetElementType;
                        updateConditionalStyleRule(selectedRule.id, {
                          targetElement: newTarget,
                          style: {
                            waypoint: newTarget === 'waypoint' ? { color: '#ef4444', shape: 'diamond' } : undefined,
                            path: newTarget === 'path' ? { color: '#f59e0b', dashPattern: 'dashed' } : undefined,
                            footprint: newTarget === 'footprint' ? { visibleMode: 'force_show', strokeColor: '#10b981' } : undefined,
                            annotation: newTarget === 'annotation' ? { strokeColor: '#8b5cf6' } : undefined,
                          },
                        });
                      }}
                      className="h-8 text-xs"
                    >
                      <option value="waypoint">ウェイポイント (Waypoint)</option>
                      <option value="path">パス線分 (Path)</option>
                      <option value="footprint">ロボットフットプリント (Footprint)</option>
                      <option value="annotation">アノテーション (Annotation)</option>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Condition Group Editor */}
              <div className="space-y-2">
                <FieldLabel>判定条件 (Conditions)</FieldLabel>
                <ConditionGroupEditor
                  group={selectedRule.condition}
                  onChange={(updatedGroup) =>
                    updateConditionalStyleRule(selectedRule.id, { condition: updatedGroup })
                  }
                  optionsList={optionsList}
                />
              </div>

              {/* Style Overrides Editor */}
              <div className="space-y-2 pt-2 border-t border-border-base/30">
                <FieldLabel>スタイル装飾 (Style Overrides)</FieldLabel>
                <StyleOverrideEditor
                  rule={selectedRule}
                  onChange={(upd) => updateConditionalStyleRule(selectedRule.id, upd)}
                  optionsList={optionsList}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-16 bg-surface-panel/20 border border-dashed border-border-base/40 rounded-xl space-y-2">
              <Layers size={28} className="mx-auto text-text-muted opacity-30" />
              <p className="text-xs text-text-muted">左のリストからルールを選択して編集してください。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
