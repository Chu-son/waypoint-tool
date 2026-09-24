import { useState, useMemo } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { ConditionalStyleRule, TargetElementType } from '../../../types/store';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { ToggleSwitch } from '../common/ToggleSwitch';
import { FieldLabel } from '../common/FieldLabel';
import { Label } from '../common/Label';
import { TabSectionHeader } from './TabSectionHeader';
import { Plus, Trash2, Copy, ChevronUp, ChevronDown, Upload, Layers, Sparkles, Info, Check } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { notify } from '../../../services/notify';
import { ConditionGroupEditor } from './ConditionEditor';
import { StyleOverrideEditor } from './StyleOverrideEditor';

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
    conditionalStyles.length > 0 ? conditionalStyles[0].id : null,
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
        void notify(`${parsed.length} 個のルールをインポートしました。`);
      } else {
        void notify('無効なJSONフォーマットです。配列である必要があります。');
      }
    } catch (e: any) {
      void notify(`インポート失敗: ${e.message}`);
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
                        : 'bg-surface-panel/40 border-border-base/40 hover:bg-surface-panel/70',
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
                            targetBadgeColor[rule.targetElement],
                          )}
                        >
                          {rule.targetElement}
                        </span>
                        <span
                          className={cn(
                            'font-medium truncate',
                            rule.enabled ? 'text-text-base' : 'text-text-muted line-through',
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
                      onChange={(checked) => updateConditionalStyleRule(selectedRule.id, { stopIfMatched: checked })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1">ルール名</Label>
                    <Input
                      type="text"
                      value={selectedRule.name}
                      onChange={(e) => updateConditionalStyleRule(selectedRule.id, { name: e.target.value })}
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
                            footprint:
                              newTarget === 'footprint'
                                ? { visibleMode: 'force_show', strokeColor: '#10b981' }
                                : undefined,
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
                  onChange={(updatedGroup) => updateConditionalStyleRule(selectedRule.id, { condition: updatedGroup })}
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
