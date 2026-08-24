import { useState } from 'react';
import { WorkflowControl, WorkflowSimplifiedParam, WorkflowActionButton } from '../../../types/customUi';
import { useAppStore } from '../../../stores/appStore';
import { executeWorkflowAction } from '../../../utils/workflowActions';
import { Button } from '../common/Button';
import { FormField } from '../common/FormField';
import { ToggleSwitch } from '../common/ToggleSwitch';
import { Slider } from '../common/Slider';
import { Select } from '../common/Select';
import { FieldLabel } from '../common/FieldLabel';
import { NumericInput } from '../NumericInput';

interface SimplifiedControlsProps {
  controls?: WorkflowControl[];
  simplifiedParams?: WorkflowSimplifiedParam[];
  actionButton?: WorkflowActionButton;
  pluginTarget?: string;
}

export function SimplifiedControls({
  controls,
  simplifiedParams,
  actionButton,
  pluginTarget,
}: SimplifiedControlsProps) {
  const [controlValues, setControlValues] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    controls?.forEach((c) => {
      init[c.label] = c.default ?? (c.type === 'slider' || c.type === 'number' ? c.min ?? 0 : c.type === 'toggle' ? false : c.options?.[0]?.value);
    });
    return init;
  });

  const pluginProperties = useAppStore((state) => state.pluginActiveProperties);
  const setPluginActiveProperties = useAppStore((state) => state.setPluginActiveProperties);

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

  const [isExecuting, setIsExecuting] = useState(false);
  const handleActionClick = async () => {
    if (!actionButton) return;
    setIsExecuting(true);
    try {
      await executeWorkflowAction(actionButton.action, actionButton.args);
    } finally {
      setIsExecuting(false);
    }
  };

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

      {/* Primary Action Button */}
      {actionButton && (
        <div className="pt-2">
          <Button
            variant="primary"
            className="w-full justify-center shadow-md py-2.5 font-bold"
            disabled={isExecuting}
            onClick={handleActionClick}
          >
            {isExecuting ? '実行中...' : actionButton.label}
          </Button>
        </div>
      )}
    </div>
  );
}
