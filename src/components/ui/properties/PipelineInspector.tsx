import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { PipelineMetadata } from '../../../types/pipeline';
import { extractPipelineParameters } from '../../../utils/pipelineParameterExtractor';
import { PluginInputEditor } from '../PluginInputEditor';
import { PluginPropertyEditor } from '../PluginPropertyEditor';
import { Button } from '../common/Button';
import { AlertBox } from '../common/AlertBox';
import { Label } from '../common/Label';
import { Input } from '../common/Input';
import { Slider } from '../common/Slider';
import { Select } from '../common/Select';
import { Checkbox } from '../common/Checkbox';
import {
  Workflow,
  Play,
  Loader2,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
  AlertCircle,
  Unlink,
  Layers,
  MapPin,
  Tag,
  Bookmark,
} from 'lucide-react';
import { cn } from '../../../utils/cn';

export interface PipelineInspectorProps {
  pipelineMetadata: PipelineMetadata;
  targetNodeId?: string;
  targetCustomLayerId?: string;
  targetAnnotationGroupId?: string;
}

export const PipelineInspector: React.FC<PipelineInspectorProps> = ({
  pipelineMetadata,
  targetNodeId,
  targetCustomLayerId,
  targetAnnotationGroupId,
}) => {
  const plugins = useAppStore((state) => state.plugins);
  const activePipelineInputRef = useAppStore((state) => state.activePipelineInputRef);
  const pluginInteractionData = useAppStore((state) => state.pluginInteractionData);
  const decimalPrecision = useAppStore((state) => state.decimalPrecision);
  const runWithLoading = useAppStore((state) => state.runWithLoading);
  const setActivePipelineInputRef = useAppStore((state) => state.setActivePipelineInputRef);
  const executePipeline = useAppStore((state) => state.executePipeline);
  const detachFromPipeline = useAppStore((state) => state.detachFromPipeline);
  const customLayers = useAppStore((state) => state.customLayers);
  const updateCustomLayer = useAppStore((state) => state.updateCustomLayer);
  const nodes = useAppStore((state) => state.nodes);
  const annotationGroups = useAppStore((state) => state.annotationGroups);

  const pipelinePlugin = plugins[pipelineMetadata.pipeline_id];

  // Extract setup definition
  const setup = useMemo(() => {
    if (!pipelinePlugin) return null;
    return extractPipelineParameters(pipelinePlugin, plugins);
  }, [pipelinePlugin, plugins]);

  // Initialize inputs state with snapshots from metadata or fallback
  const [manualInputs, setManualInputs] = useState<Record<string, Record<string, any>>>(() => {
    if (pipelineMetadata.pipeline_inputs && Object.keys(pipelineMetadata.pipeline_inputs).length > 0) {
      return structuredClone(pipelineMetadata.pipeline_inputs);
    }
    const res: Record<string, Record<string, any>> = {};
    if (setup?.defaultInputs) {
      for (const [sId, map] of Object.entries(setup.defaultInputs)) {
        res[sId] = { ...map };
      }
    }
    return res;
  });

  // Initialize properties state with snapshots from metadata or fallback
  const [manualProperties, setManualProperties] = useState<Record<string, Record<string, any>>>(() => {
    if (pipelineMetadata.pipeline_properties && Object.keys(pipelineMetadata.pipeline_properties).length > 0) {
      return structuredClone(pipelineMetadata.pipeline_properties);
    }
    return setup?.defaultProperties ? structuredClone(setup.defaultProperties) : {};
  });

  // Reset or update state when pipeline execution or metadata changes
  useEffect(() => {
    if (pipelineMetadata.pipeline_inputs && Object.keys(pipelineMetadata.pipeline_inputs).length > 0) {
      setManualInputs(structuredClone(pipelineMetadata.pipeline_inputs));
    }
    if (pipelineMetadata.pipeline_properties && Object.keys(pipelineMetadata.pipeline_properties).length > 0) {
      setManualProperties(structuredClone(pipelineMetadata.pipeline_properties));
    }
  }, [pipelineMetadata.pipeline_execution_id, pipelineMetadata.pipeline_inputs, pipelineMetadata.pipeline_properties]);

  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const prevInteractionDataRef = useRef<Record<string, any>>(pluginInteractionData);

  // Sync canvas interactions (pluginInteractionData) to active pipeline manualInputs
  useEffect(() => {
    if (activePipelineInputRef) {
      const { stepId, inputId } = activePipelineInputRef;
      const value = pluginInteractionData[inputId];
      const prevVal = prevInteractionDataRef.current[inputId];

      if (value !== prevVal && value !== undefined) {
        prevInteractionDataRef.current = {
          ...prevInteractionDataRef.current,
          [inputId]: value,
        };
        setManualInputs((prev) => {
          if (prev[stepId]?.[inputId] === value) return prev;
          return {
            ...prev,
            [stepId]: {
              ...(prev[stepId] || {}),
              [inputId]: value,
            },
          };
        });
      }
    } else {
      prevInteractionDataRef.current = pluginInteractionData;
    }
  }, [pluginInteractionData, activePipelineInputRef]);

  const setActivePlugin = useAppStore((state) => state.setActivePlugin);

  // Initialize pipeline interaction state on mount or when pipeline metadata changes
  useEffect(() => {
    if (!pipelinePlugin || !setup) return;

    // 1. Set active plugin
    setActivePlugin(pipelinePlugin.id);

    // 2. Push all current manual inputs to store's pluginInteractionData
    Object.entries(manualInputs).forEach(([_sId, inputsMap]) => {
      Object.entries(inputsMap).forEach(([k, val]) => {
        if (val !== undefined) {
          useAppStore.getState().updatePluginInteractionData(k, val);
        }
      });
    });

    // 3. Auto-focus first manual input if not already set
    if (setup.manualInputs.length > 0) {
      const first = setup.manualInputs[0];
      const currentVal = manualInputs[first.stepId]?.[first.inputId];
      if (currentVal !== undefined) {
        useAppStore.getState().updatePluginInteractionData(first.inputId, currentVal);
        prevInteractionDataRef.current = {
          ...useAppStore.getState().pluginInteractionData,
          [first.inputId]: currentVal,
        };
      }
      setActivePipelineInputRef({ stepId: first.stepId, inputId: first.inputId });
    }

    return () => {
      useAppStore.getState().setActivePipelineInputRef(null);
    };
  }, [pipelinePlugin?.id, pipelineMetadata.pipeline_execution_id, setup]);

  if (!pipelinePlugin || !setup) {
    return (
      <div className="flex-1 overflow-y-auto w-full p-4 space-y-4 bg-surface-base text-text-base">
        <div className="flex items-center gap-2 text-status-danger font-semibold">
          <AlertCircle size={18} />
          <span>Pipeline Plugin Not Found</span>
        </div>
        <p className="text-xs text-text-muted">
          The pipeline plugin "{pipelineMetadata.pipeline_id}" is not installed or loaded.
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="w-full flex items-center justify-center gap-1.5"
          onClick={() => {
            detachFromPipeline({
              nodeId: targetNodeId,
              customLayerId: targetCustomLayerId,
              annotationGroupId: targetAnnotationGroupId,
            });
          }}
        >
          <Unlink size={14} />
          Detach from Pipeline
        </Button>
      </div>
    );
  }

  const handleUpdateInput = (stepId: string, inputId: string, data: any) => {
    setManualInputs((prev) => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] || {}),
        [inputId]: data,
      },
    }));
    prevInteractionDataRef.current = {
      ...prevInteractionDataRef.current,
      [inputId]: data,
    };
    useAppStore.getState().updatePluginInteractionData(inputId, data);
  };

  const handleSelectInput = (stepId: string, inputId: string) => {
    const currentVal = manualInputs[stepId]?.[inputId];
    useAppStore.getState().updatePluginInteractionData(inputId, currentVal);
    prevInteractionDataRef.current = {
      ...useAppStore.getState().pluginInteractionData,
      [inputId]: currentVal,
    };
    setActivePipelineInputRef({ stepId, inputId });
  };

  const handleUpdateProperty = (stepId: string, propName: string, val: any) => {
    setManualProperties((prev) => ({
      ...prev,
      [stepId]: {
        ...(prev[stepId] || {}),
        [propName]: val,
      },
    }));
  };

  const toggleStepCollapse = (stepId: string) => {
    setCollapsedSteps((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  const handleRegenerate = async () => {
    setIsExecuting(true);
    setErrorMessage(null);

    try {
      await runWithLoading(
        {
          message: 'パイプラインを再計算中...',
          detail: pipelinePlugin.manifest.name || pipelinePlugin.id,
          blocking: true,
        },
        async () => {
          const result = await executePipeline({
            pipelinePlugin,
            manualInputs,
            manualProperties,
            existingExecutionId: pipelineMetadata.pipeline_execution_id,
          });

          if (!result.success) {
            throw new Error(result.error || 'Pipeline execution failed');
          }
        }
      );
    } catch (err: any) {
      console.error('[PipelineInspector] Re-generation error:', err);
      setErrorMessage(err?.message || String(err));
    } finally {
      setIsExecuting(false);
    }
  };

  const handleDetach = () => {
    if (
      window.confirm(
        'この成果物をパイプラインの連動管理から切り離しますか？\n切り離すと、単独のノードやレイヤーとして独立して編集できるようになります。'
      )
    ) {
      detachFromPipeline({
        nodeId: targetNodeId,
        customLayerId: targetCustomLayerId,
        annotationGroupId: targetAnnotationGroupId,
      });
    }
  };

  // List existing artifacts associated with this pipeline execution
  const executionId = pipelineMetadata.pipeline_execution_id;
  const linkedLayers = customLayers.filter(
    (l) => l.pipeline_metadata?.pipeline_execution_id === executionId
  );
  const linkedNodes = Object.values(nodes).filter(
    (n) => n.pipeline_metadata?.pipeline_execution_id === executionId && n.type === 'generator'
  );
  const linkedGroups = Object.values(annotationGroups).filter(
    (g) => g.pipeline_metadata?.pipeline_execution_id === executionId
  );

  const recipe = pipelinePlugin.manifest.pipeline;
  const steps = recipe?.steps || [];

  return (
    <div className="flex flex-col h-full bg-surface-base text-text-base select-none">
      {/* Header */}
      <div className="p-4 border-b border-border-base shrink-0 bg-surface-base">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary shrink-0">
              <Workflow size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-text-base truncate leading-tight">
                {pipelinePlugin.manifest.name || pipelinePlugin.id}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-mono bg-accent-primary/10 text-accent-primary px-1.5 py-0.2 rounded font-medium border border-accent-primary/20">
                  Pipeline Instance
                </span>
                <span className="text-[10px] text-text-muted truncate">
                  v{pipelinePlugin.manifest.version}
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-text-muted hover:text-status-danger px-2 h-7 flex items-center gap-1 text-xs shrink-0"
            onClick={handleDetach}
            title="パイプラインから切り離す (Detach)"
          >
            <Unlink size={13} />
            <span>Detach</span>
          </Button>
        </div>

        {pipelinePlugin.manifest.description && (
          <p className="text-xs text-text-muted line-clamp-2 mt-1">
            {pipelinePlugin.manifest.description}
          </p>
        )}

        {/* Linked artifacts summary */}
        <div className="mt-3 flex items-center gap-2 text-[11px] text-text-muted bg-surface-raised px-2 py-1.5 rounded border border-border-base">
          <span className="font-semibold text-text-base">Outputs:</span>
          {linkedLayers.length > 0 && (
            <span className="flex items-center gap-1">
              <Layers size={11} className="text-accent-primary" /> {linkedLayers.length} layer(s)
            </span>
          )}
          {linkedNodes.length > 0 && (
            <span className="flex items-center gap-1">
              <MapPin size={11} className="text-accent-primary" /> {linkedNodes.length} waypoint group(s)
            </span>
          )}
          {linkedGroups.length > 0 && (
            <span className="flex items-center gap-1">
              <Tag size={11} className="text-accent-primary" /> {linkedGroups.length} annotation(s)
            </span>
          )}
        </div>

        {/* Target Custom Layer Settings (if selected artifact is a custom layer) */}
        {(() => {
          const effectiveLayerId =
            targetCustomLayerId ||
            linkedLayers.find((l) => l.id === useAppStore.getState().activeCustomLayerId)?.id;
          const targetLayer = effectiveLayerId ? customLayers.find((l) => l.id === effectiveLayerId) : null;
          if (!targetLayer) return null;

          return (
            <div className="mt-3 p-2.5 rounded-lg bg-surface-raised/50 border border-border-base/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Layers size={13} className="text-accent-primary shrink-0" />
                  <span className="text-xs font-bold text-text-base truncate">
                    Layer: {targetLayer.name}
                  </span>
                </div>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-accent-primary/10 text-accent-primary border border-accent-primary/20 font-medium">
                  Active Layer
                </span>
              </div>

              {/* Layer Name */}
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-text-muted">Layer Name</Label>
                <Input
                  value={targetLayer.name}
                  onChange={(e) => updateCustomLayer(targetLayer.id, { name: e.target.value })}
                  className="h-7 text-xs bg-surface-base"
                  placeholder="Layer Name"
                />
              </div>

              {/* Reference Layer Setting */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <Bookmark
                    size={13}
                    className={targetLayer.is_reference ? 'text-accent-reference fill-accent-reference' : 'text-text-muted'}
                  />
                  <span className="text-[11px] font-medium text-text-base">Reference Layer</span>
                </div>
                <Checkbox
                  checked={!!targetLayer.is_reference}
                  onChange={(e) => updateCustomLayer(targetLayer.id, { is_reference: e.target.checked })}
                />
              </div>

              {/* Opacity Slider */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between items-center text-[10px] text-text-muted font-medium">
                  <span>Opacity</span>
                  <span>{Math.round((targetLayer.opacity ?? 1.0) * 100)}%</span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={targetLayer.opacity ?? 1.0}
                  onChange={(e) => updateCustomLayer(targetLayer.id, { opacity: parseFloat(e.target.value) })}
                />
              </div>

              {/* Blend Mode */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[10px] text-text-muted font-medium">Blend Mode</span>
                <Select
                  value={targetLayer.blend_mode || 'overwrite'}
                  disabled={!!targetLayer.is_reference}
                  onChange={(e) => updateCustomLayer(targetLayer.id, { blend_mode: e.target.value as any })}
                  className={cn(
                    'h-6 text-[11px] bg-surface-base border-border-base/50 w-32',
                    targetLayer.is_reference && 'opacity-50 cursor-not-allowed bg-surface-base/30'
                  )}
                >
                  <option value="overwrite">Overwrite</option>
                  <option value="merge_obstacles">Merge Obstacles</option>
                  <option value="merge_free">Merge Free Space</option>
                </Select>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Error display */}
      {errorMessage && (
        <div className="p-3 border-b border-border-base shrink-0">
          <AlertBox variant="danger" title="再計算エラー">
            {errorMessage}
          </AlertBox>
        </div>
      )}

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {steps.map((step, idx) => {
          const stepId = step.step_id;
          const stepPlugin = plugins[step.plugin_id];
          const isCollapsed = collapsedSteps[stepId] ?? false;

          // Find manual inputs and properties for this step
          const stepManualInputs = setup.manualInputs.filter((i) => i.stepId === stepId);
          const stepManualProps = setup.manualProperties.filter((p) => p.stepId === stepId);

          // Find auto-bound inputs
          const bindings = step.bindings || {};
          const boundInputs = Object.entries(bindings).filter(([k]) => k.startsWith('inputs.'));

          const isCurrentTarget =
            (targetCustomLayerId && linkedLayers.some((l) => l.id === targetCustomLayerId && l.pipeline_metadata?.step_id === stepId)) ||
            (targetNodeId && linkedNodes.some((n) => n.id === targetNodeId && n.pipeline_metadata?.step_id === stepId));

          return (
            <div
              key={stepId}
              className={cn(
                'rounded-lg border transition-colors',
                isCurrentTarget
                  ? 'border-accent-primary/60 bg-surface-raised/40 shadow-sm'
                  : 'border-border-base bg-surface-raised/20'
              )}
            >
              {/* Step Header */}
              <div
                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-surface-raised/60 rounded-t-lg select-none"
                onClick={() => toggleStepCollapse(stepId)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-surface-raised border border-border-base text-[11px] font-bold flex items-center justify-center text-text-muted shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-text-base truncate">
                        {step.name || stepId}
                      </span>
                      {isCurrentTarget && (
                        <span className="text-[9px] bg-accent-primary/20 text-accent-primary px-1 rounded">
                          Selected
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-text-muted block truncate font-mono">
                      {stepPlugin?.manifest?.name || step.plugin_id}
                    </span>
                  </div>
                </div>

                <div className="text-text-muted shrink-0">
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* Step Content */}
              {!isCollapsed && (
                <div className="p-3 border-t border-border-base/50 space-y-4">
                  {/* Bound inputs indicator */}
                  {boundInputs.length > 0 && (
                    <div className="space-y-1">
                      {boundInputs.map(([targetKey, expr]) => (
                        <div
                          key={targetKey}
                          className="flex items-center gap-1.5 text-[11px] text-text-muted bg-surface-base px-2 py-1 rounded border border-border-base/40"
                        >
                          <ArrowRightLeft size={12} className="text-accent-primary shrink-0" />
                          <span className="font-mono text-text-base truncate">
                            {targetKey.replace('inputs.', '')}
                          </span>
                          <span className="text-text-muted">←</span>
                          <span className="font-mono text-accent-primary truncate text-[10px]">
                            {expr}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Manual Inputs (Interaction Data) */}
                  {stepManualInputs.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                        Canvas Inputs
                      </div>
                      {stepManualInputs.map((item, inputIdx) => {
                        const isCanvasActive =
                          activePipelineInputRef?.stepId === item.stepId &&
                          activePipelineInputRef?.inputId === item.inputId;
                        const currentVal = manualInputs[item.stepId]?.[item.inputId];
                        const hasData =
                          currentVal !== undefined &&
                          currentVal !== null &&
                          currentVal !== '' &&
                          (!Array.isArray(currentVal) || currentVal.length > 0);

                        return (
                          <div
                            key={item.inputId}
                            className={cn(
                              'p-2.5 rounded border transition-colors cursor-pointer',
                              isCanvasActive
                                ? 'border-accent-primary bg-accent-primary/5 ring-1 ring-accent-primary/30'
                                : 'border-border-base bg-surface-base hover:border-border-base/80'
                            )}
                            onClick={() => handleSelectInput(item.stepId, item.inputId)}
                          >
                            <PluginInputEditor
                              input={item.inputDef}
                              interactionData={currentVal}
                              onUpdate={(data: any) => handleUpdateInput(item.stepId, item.inputId, data)}
                              mode="creation"
                              index={inputIdx}
                              totalSteps={stepManualInputs.length}
                              isActive={isCanvasActive}
                              hasData={hasData}
                              decimalPrecision={decimalPrecision}
                              onSelect={() => handleSelectInput(item.stepId, item.inputId)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Manual Properties */}
                  {stepManualProps.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                        Properties
                      </div>
                      <div className="bg-surface-base p-2.5 rounded border border-border-base space-y-2.5">
                        {stepManualProps.map((item) => (
                          <PluginPropertyEditor
                            key={item.propertyName}
                            property={item.propertyDef}
                            value={
                              manualProperties[item.stepId]?.[item.propertyName] ??
                              item.defaultValue
                            }
                            onChange={(val: any) =>
                              handleUpdateProperty(item.stepId, item.propertyName, val)
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {stepManualInputs.length === 0 && stepManualProps.length === 0 && (
                    <div className="text-xs text-text-muted italic py-1">
                      No configurable manual parameters for this step.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer / Re-generation Action */}
      <div className="p-4 border-t border-border-base bg-surface-base shrink-0 space-y-2">
        <Button
          variant="primary"
          size="default"
          className="w-full flex items-center justify-center gap-2 font-medium"
          disabled={isExecuting}
          onClick={handleRegenerate}
        >
          {isExecuting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Re-calculating...</span>
            </>
          ) : (
            <>
              <Play size={16} fill="currentColor" />
              <span>Re-generate Pipeline</span>
            </>
          )}
        </Button>
        <p className="text-[11px] text-center text-text-muted">
          変更のないステップの計算は自動的にスキップされます
        </p>
      </div>
    </div>
  );
};
