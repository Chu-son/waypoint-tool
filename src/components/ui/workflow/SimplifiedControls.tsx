import { useState } from 'react';
import { WorkflowControl, WorkflowSimplifiedParam, WorkflowActionButton, WorkflowButtonsLayout } from '../../../types/customUi';
import { useAppStore } from '../../../stores/appStore';
import { executeWorkflowAction } from '../../../utils/workflowActions';
import { Button } from '../common/Button';
import { FormField } from '../common/FormField';
import { ToggleSwitch } from '../common/ToggleSwitch';
import { Slider } from '../common/Slider';
import { Select } from '../common/Select';
import { FieldLabel } from '../common/FieldLabel';
import { NumericInput } from '../NumericInput';
import { DynamicIcon } from '../../common/DynamicIcon';
import { PluginInputEditor } from '../PluginInputEditor';
import { Loader2 } from 'lucide-react';
import { cn } from '../../../utils/cn';

interface SimplifiedControlsProps {
  controls?: WorkflowControl[];
  simplifiedParams?: WorkflowSimplifiedParam[];
  actionButton?: WorkflowActionButton;
  actionButtons?: WorkflowActionButton[];
  buttonsLayout?: WorkflowButtonsLayout;
  pluginTarget?: string;
  showPluginInputs?: boolean;
  pluginInputsFilter?: string[];
}

export function SimplifiedControls({
  controls,
  simplifiedParams,
  actionButton,
  actionButtons,
  buttonsLayout = 'column',
  pluginTarget,
  showPluginInputs = false,
  pluginInputsFilter,
}: SimplifiedControlsProps) {
  const [controlValues, setControlValues] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    controls?.forEach((c) => {
      init[c.label] = c.default ?? (c.type === 'slider' || c.type === 'number' ? c.min ?? 0 : c.type === 'toggle' ? false : c.options?.[0]?.value);
    });
    return init;
  });

  const plugins = useAppStore((state) => state.plugins) || {};
  const activePluginId = useAppStore((state) => state.activePluginId);
  const pluginProperties = useAppStore((state) => state.pluginActiveProperties);
  const setPluginActiveProperties = useAppStore((state) => state.setPluginActiveProperties);
  const interactionData = useAppStore((state) => state.pluginInteractionData) || {};
  const updatePluginInteractionData = useAppStore((state) => state.updatePluginInteractionData);

  const targetPluginId = pluginTarget || activePluginId;
  const targetPlugin = targetPluginId ? plugins[targetPluginId] : null;

  const handleControlChange = (control: WorkflowControl, val: any) => {
    setControlValues((prev) => ({ ...prev, [control.label]: val }));
    executeWorkflowAction(control.target.action, { value: val });
  };

  const handleParamChange = (paramKey: string, val: any) => {
    setPluginActiveProperties({
      ...pluginProperties,
      [paramKey]: val,
    });
  };

  const handleUpdateInteractionData = (key: string, data: any) => {
    updatePluginInteractionData(key, data);
  };

  const [executingIndex, setExecutingIndex] = useState<number | null>(null);

  const handleButtonClick = async (btn: WorkflowActionButton, index: number) => {
    setExecutingIndex(index);
    try {
      await executeWorkflowAction(btn.action, btn.args);
    } finally {
      setExecutingIndex(null);
    }
  };

  // Resolve list of buttons
  const buttons: WorkflowActionButton[] = actionButtons && actionButtons.length > 0
    ? actionButtons
    : actionButton
    ? [actionButton]
    : [];

  return (
    <div className="space-y-4 pt-2">
      {/* Workflow Controls (State/Action bindings like Robot Footprint) */}
      {controls && controls.length > 0 && (
        <div className="space-y-3">
          {controls.map((c, idx) => {
            const val = controlValues[c.label];

            if (c.type === 'slider') {
              return (
                <FormField key={idx} label={c.label} labelRight={String(val ?? c.default ?? 0)}>
                  <Slider
                    min={c.min ?? 0}
                    max={c.max ?? 100}
                    step={c.step ?? 1}
                    value={val ?? c.default ?? 0}
                    onChange={(e) => handleControlChange(c, parseFloat(e.target.value))}
                  />
                </FormField>
              );
            }

            if (c.type === 'select') {
              return (
                <FormField key={idx} label={c.label}>
                  <Select
                    value={val ?? c.default}
                    onChange={(e) => handleControlChange(c, e.target.value)}
                    className="h-10 text-sm"
                  >
                    {c.options?.map((opt, oIdx) => (
                      <option key={oIdx} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              );
            }

            if (c.type === 'toggle') {
              return (
                <div key={idx} className="flex items-center justify-between py-1">
                  <span className="text-xs font-medium text-text-base">{c.label}</span>
                  <ToggleSwitch
                    checked={!!val}
                    onChange={(checked) => handleControlChange(c, checked)}
                  />
                </div>
              );
            }

            if (c.type === 'number') {
              return (
                <FormField key={idx} label={c.label}>
                  <NumericInput
                    min={c.min}
                    max={c.max}
                    step={c.step ?? 1}
                    value={val ?? c.default ?? 0}
                    onChange={(newVal) => handleControlChange(c, newVal)}
                    className="h-10 text-sm font-mono"
                  />
                </FormField>
              );
            }

            return null;
          })}
        </div>
      )}

      {/* Plugin Inputs (e.g. sweep_rect, seed_points, annotation selection) */}
      {showPluginInputs && targetPlugin?.manifest?.inputs && targetPlugin.manifest.inputs.length > 0 && (
        <div className="space-y-3 bg-surface-panel/40 p-3 rounded-lg border border-border-base/40">
          <FieldLabel>
            {targetPlugin.manifest.name || targetPluginId} の領域・入力指定
          </FieldLabel>
          <div className="space-y-2.5">
            {targetPlugin.manifest.inputs
              .filter((inp) => !pluginInputsFilter || pluginInputsFilter.includes(inp.id || inp.name || ''))
              .map((inp, idx) => {
                const key = inp.name || inp.id;
                return (
                  <PluginInputEditor
                    key={key || idx}
                    input={inp}
                    interactionData={interactionData[key]}
                    onUpdate={(data) => handleUpdateInteractionData(key, data)}
                    mode="creation"
                    index={idx}
                    totalSteps={targetPlugin.manifest.inputs.length}
                    isActive={true}
                    hasData={interactionData[key] !== undefined && interactionData[key] !== null}
                  />
                );
              })}
          </div>
        </div>
      )}

      {/* Simplified Plugin Parameters */}
      {simplifiedParams && simplifiedParams.length > 0 && (
        <div className="space-y-3 bg-surface-panel/40 p-3 rounded-lg border border-border-base/40">
          <FieldLabel>
            {pluginTarget ? `パラメータ設定 (${pluginTarget})` : 'パラメータ設定'}
          </FieldLabel>
          {simplifiedParams.map((p, idx) => {
            const currentVal = pluginProperties[p.paramKey] ?? p.default ?? p.options?.[0]?.value;

            if (p.type === 'select') {
              return (
                <FormField key={idx} label={p.label}>
                  <Select
                    value={currentVal}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const num = Number(raw);
                      handleParamChange(p.paramKey, isNaN(num) ? raw : num);
                    }}
                    className="h-8 text-xs"
                  >
                    {p.options?.map((opt, oIdx) => (
                      <option key={oIdx} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              );
            }

            if (p.type === 'slider') {
              return (
                <FormField key={idx} label={p.label} labelRight={String(currentVal ?? p.min ?? 0)}>
                  <Slider
                    min={p.min ?? 0}
                    max={p.max ?? 100}
                    step={p.step ?? 1}
                    value={currentVal ?? p.min ?? 0}
                    onChange={(e) => handleParamChange(p.paramKey, parseFloat(e.target.value))}
                  />
                </FormField>
              );
            }

            return null;
          })}
        </div>
      )}

      {/* Action Buttons */}
      {buttons.length > 0 && (
        <div
          className={cn(
            "pt-2",
            buttonsLayout === 'grid' && "grid grid-cols-2 gap-2",
            buttonsLayout === 'row' && "flex flex-row flex-wrap gap-2",
            buttonsLayout === 'column' && "flex flex-col gap-2.5"
          )}
        >
          {buttons.map((btn, idx) => {
            const isExecuting = executingIndex === idx;
            const isAnyExecuting = executingIndex !== null;
            const variant = btn.variant || (actionButton && buttons.length === 1 ? 'primary' : 'secondary');

            return (
              <div key={idx} className={cn("flex flex-col", btn.fullWidth !== false && "w-full")}>
                <Button
                  variant={variant}
                  className={cn(
                    "w-full justify-center shadow-sm py-2.5 font-bold gap-2 text-xs",
                    variant === 'primary' && "shadow-md py-3 text-sm"
                  )}
                  disabled={btn.disabled || isAnyExecuting}
                  onClick={() => handleButtonClick(btn, idx)}
                >
                  {isExecuting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>実行中...</span>
                    </>
                  ) : (
                    <>
                      {btn.icon && <DynamicIcon name={btn.icon} size={15} />}
                      <span>{btn.label}</span>
                    </>
                  )}
                </Button>
                {btn.description && (
                  <span className="text-[11px] text-text-muted mt-1 px-1 leading-snug">
                    {btn.description}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
