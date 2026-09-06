import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { PluginInstance } from '../../../types/store';
import { extractPipelineParameters } from '../../../utils/pipelineParameterExtractor';
import { PluginInputEditor } from '../PluginInputEditor';
import { PluginPropertyEditor } from '../PluginPropertyEditor';
import { Button } from '../common/Button';
import { AlertBox } from '../common/AlertBox';
import {
  Workflow,
  Play,
  Loader2,
  X,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface PipelineSetupViewProps {
  plugin: PluginInstance;
}

export const PipelineSetupView: React.FC<PipelineSetupViewProps> = ({ plugin }) => {
  const plugins = useAppStore((state) => state.plugins);
  const activePipelineInputRef = useAppStore((state) => state.activePipelineInputRef);
  const pluginInteractionData = useAppStore((state) => state.pluginInteractionData);
  const decimalPrecision = useAppStore((state) => state.decimalPrecision);
  const runWithLoading = useAppStore((state) => state.runWithLoading);
  const setActivePipelineInputRef = useAppStore((state) => state.setActivePipelineInputRef);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const executePipeline = useAppStore((state) => state.executePipeline);

  // Extract pipeline parameters
  const setup = useMemo(() => {
    return extractPipelineParameters(plugin, plugins);
  }, [plugin, plugins]);

  const [manualInputs, setManualInputs] = useState<Record<string, Record<string, any>>>(() => {
    const res: Record<string, Record<string, any>> = {};
    for (const [sId, map] of Object.entries(setup.defaultInputs || {})) {
      res[sId] = { ...map };
    }
    for (const inp of setup.manualInputs) {
      if (res[inp.stepId]?.[inp.inputId] === undefined) {
        if (pluginInteractionData[inp.inputId] !== undefined) {
          res[inp.stepId] = res[inp.stepId] || {};
          res[inp.stepId][inp.inputId] = pluginInteractionData[inp.inputId];
        }
      }
    }
    return res;
  });

  const [manualProperties, setManualProperties] = useState<Record<string, Record<string, any>>>(
    () => setup.defaultProperties || {}
  );

  // Track collapsed state per stepId
  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});

  const [isExecuting, setIsExecuting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset or update state if plugin changes
  useEffect(() => {
    const res: Record<string, Record<string, any>> = {};
    for (const [sId, map] of Object.entries(setup.defaultInputs || {})) {
      res[sId] = { ...map };
    }
    for (const inp of setup.manualInputs) {
      if (res[inp.stepId]?.[inp.inputId] === undefined) {
        if (pluginInteractionData[inp.inputId] !== undefined) {
          res[inp.stepId] = res[inp.stepId] || {};
          res[inp.stepId][inp.inputId] = pluginInteractionData[inp.inputId];
        }
      }
    }
    setManualInputs(res);
    setManualProperties(setup.defaultProperties || {});
    setErrorMessage(null);

    // Auto-select first manual input on mount / setup change
    if (setup.manualInputs.length > 0) {
      const first = setup.manualInputs[0];
      const currentVal = res[first.stepId]?.[first.inputId];
      useAppStore.getState().updatePluginInteractionData(first.inputId, currentVal);
      prevInteractionDataRef.current = {
        ...useAppStore.getState().pluginInteractionData,
        [first.inputId]: currentVal,
      };
      setActivePipelineInputRef({ stepId: first.stepId, inputId: first.inputId });
      setActiveTool('add_generator');
    }
  }, [setup, plugin.id]);

  // Track previous interaction data to avoid cross-step contamination
  const prevInteractionDataRef = React.useRef<Record<string, any>>(pluginInteractionData);

  // Sync canvas interactions (pluginInteractionData) to active pipeline manualInputs
  useEffect(() => {
    if (activePipelineInputRef) {
      const { stepId, inputId } = activePipelineInputRef;
      const value = pluginInteractionData[inputId];
      const prevVal = prevInteractionDataRef.current[inputId];

      // Only update manualInputs if interaction data actually changed
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

  // Clean up activePipelineInputRef on unmount
  useEffect(() => {
    return () => {
      useAppStore.getState().setActivePipelineInputRef(null);
    };
  }, []);

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
    // Sync current step's input to store so canvas reflects it
    useAppStore.getState().updatePluginInteractionData(inputId, currentVal);
    prevInteractionDataRef.current = {
      ...useAppStore.getState().pluginInteractionData,
      [inputId]: currentVal,
    };
    setActivePipelineInputRef({ stepId, inputId });
    setActiveTool('add_generator');
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

  // Validation: check if all required manual inputs are filled
  const missingRequiredInputs = useMemo(() => {
    return setup.manualInputs.filter((item) => {
      if (!item.inputDef.required) return false;
      const val = manualInputs[item.stepId]?.[item.inputId];
      if (val === undefined || val === null || val === '') return true;
      if (Array.isArray(val) && val.length === 0) return true;
      return false;
    });
  }, [setup.manualInputs, manualInputs]);

  const hasFatalErrors = setup.errors.length > 0;
  const isReady = !hasFatalErrors && missingRequiredInputs.length === 0 && !isExecuting;

  const handleClose = () => {
    const store = useAppStore.getState();
    store.setActiveTool('select');
    store.setActivePlugin(null);
    store.setActivePipelineInputRef(null);
    store.clearPluginInteractionData();
  };

  const handleRunPipeline = async () => {
    if (!isReady) return;
    setIsExecuting(true);
    setErrorMessage(null);

    try {
      await runWithLoading(
        {
          message: 'パイプラインを実行中...',
          detail: plugin.manifest.name || plugin.id,
          blocking: true,
        },
        async () => {
          const result = await executePipeline({
            pipelinePlugin: plugin,
            manualInputs,
            manualProperties,
          });

          if (!result.success) {
            throw new Error(result.error || 'Pipeline execution failed');
          }

          // On success, select resulting elements and return tool to 'select'
          const state = useAppStore.getState();
          const pExecId = result.pipelineExecutionId;

          const matchingNodes = Object.values(state.nodes).filter(
            (n) => n.pipeline_metadata?.pipeline_execution_id === pExecId
          );
          const matchingLayers = state.customLayers.filter(
            (l) => l.pipeline_metadata?.pipeline_execution_id === pExecId
          );
          const matchingAnnotations = Object.values(state.annotationGroups).filter(
            (g) => g.pipeline_metadata?.pipeline_execution_id === pExecId
          );

          if (matchingNodes.length > 0) {
            state.selectNodes([matchingNodes[0].id]);
          } else if (matchingAnnotations.length > 0) {
            state.selectAnnotationObjects([matchingAnnotations[0].id]);
          } else if (matchingLayers.length > 0) {
            state.setActiveCustomLayerId(matchingLayers[0].id);
          }

          state.clearPluginInteractionData();
          state.setActivePlugin(null);
          state.setActivePipelineInputRef(null);
          state.setActiveTool('select');
        }
      );
    } catch (err: any) {
      setErrorMessage(err?.message || String(err));
    } finally {
      setIsExecuting(false);
    }
  };

  const recipeSteps = plugin.manifest?.pipeline?.steps || [];

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 flex flex-col h-full bg-surface-base border-l border-border-base">
      {/* Header */}
      <div className="flex justify-between items-start mb-4 border-b border-border-base/50 pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary-base/15 text-primary-base">
              <Workflow size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-base leading-none">
                {plugin.manifest.name}
              </h2>
              <span className="text-[10px] text-primary-base font-medium">Pipeline Workflow</span>
            </div>
          </div>
          {plugin.manifest.description && (
            <p className="text-[11px] text-text-muted mt-1.5 leading-tight">
              {plugin.manifest.description}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="h-7 w-7 text-text-muted hover:text-text-base"
          title="Close Pipeline Setup"
        >
          <X size={14} />
        </Button>
      </div>

      {/* Errors & Alerts */}
      <div className="space-y-3 mb-4 shrink-0">
        {setup.errors.length > 0 && (
          <AlertBox variant="danger" title="Pipeline Configuration Error">
            <ul className="list-disc list-inside space-y-0.5">
              {setup.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </AlertBox>
        )}

        {errorMessage && (
          <AlertBox variant="danger" title="Execution Failed">
            {errorMessage}
          </AlertBox>
        )}

        {missingRequiredInputs.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-status-warning/10 border border-status-warning/20 text-status-warning text-xs">
            <AlertCircle size={14} className="shrink-0" />
            <span>
              Required inputs need setup: {missingRequiredInputs.map((i) => i.label).join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* Step by Step Execution Cards */}
      <div className="space-y-3 flex-1 overflow-y-auto pr-0.5">
        {recipeSteps.map((step, stepIndex) => {
          const stepId = step.step_id;
          const targetPlugin = plugins[step.plugin_id];
          const isCollapsed = Boolean(collapsedSteps[stepId]);

          const stepManualInputs = setup.manualInputs.filter((i) => i.stepId === stepId);
          const stepManualProperties = setup.manualProperties.filter((p) => p.stepId === stepId);
          const boundInputEntries = Object.entries(step.bindings || {}).filter(
            ([k]) => !k.startsWith('properties.')
          );
          const boundPropEntries = Object.entries(step.bindings || {}).filter(
            ([k]) => k.startsWith('properties.')
          );
          const propOverrides = Object.entries(step.property_overrides || {});

          const hasItems =
            stepManualInputs.length > 0 ||
            stepManualProperties.length > 0 ||
            boundInputEntries.length > 0 ||
            boundPropEntries.length > 0 ||
            propOverrides.length > 0;

          return (
            <div
              key={stepId}
              className="bg-surface-panel/50 border border-border-base/40 rounded-xl overflow-hidden shadow-subtle transition-all"
            >
              {/* Step Card Header */}
              <div
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-surface-hover/40 transition-colors bg-surface-panel/80 select-none"
                onClick={() => toggleStepCollapse(stepId)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-primary-base/20 text-primary-base text-[11px] font-bold flex items-center justify-center shrink-0">
                    {stepIndex + 1}
                  </span>
                  <div className="truncate">
                    <span className="text-xs font-bold text-text-base">
                      {step.name || stepId}
                    </span>
                    <span className="text-[10px] text-text-muted ml-2 font-mono">
                      ({targetPlugin?.manifest.name || step.plugin_id})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {stepManualInputs.every(
                    (i) =>
                      !i.inputDef.required ||
                      (manualInputs[stepId]?.[i.inputId] !== undefined &&
                        manualInputs[stepId]?.[i.inputId] !== '')
                  ) && (
                    <CheckCircle2 size={13} className="text-status-success shrink-0" />
                  )}
                  {isCollapsed ? (
                    <ChevronRight size={14} className="text-text-muted" />
                  ) : (
                    <ChevronDown size={14} className="text-text-muted" />
                  )}
                </div>
              </div>

              {/* Step Card Content */}
              {!isCollapsed && (
                <div className="p-3 border-t border-border-base/20 space-y-3">
                  {/* Auto-wired bindings */}
                  {boundInputEntries.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                        Auto-wired Inputs
                      </span>
                      <div className="space-y-1">
                        {boundInputEntries.map(([k, expr]) => (
                          <div
                            key={k}
                            className="flex items-center gap-1.5 text-[11px] text-text-muted bg-surface-base/40 px-2.5 py-1.5 rounded border border-border-base/20"
                          >
                            <ArrowRightLeft size={11} className="text-primary-base shrink-0" />
                            <span className="font-mono text-text-base">{k.replace('inputs.', '')}</span>
                            <span className="italic text-text-muted/80">
                              (Auto-wired from {expr})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual Inputs */}
                  {stepManualInputs.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                        Step Inputs
                      </span>
                      <div className="space-y-2">
                        {stepManualInputs.map((item, idx) => {
                          const isActiveInput =
                            activePipelineInputRef?.stepId === stepId &&
                            activePipelineInputRef?.inputId === item.inputId;
                          const currentVal = manualInputs[stepId]?.[item.inputId];
                          const hasData =
                            currentVal !== undefined &&
                            currentVal !== null &&
                            currentVal !== '' &&
                            (!Array.isArray(currentVal) || currentVal.length > 0);

                          return (
                            <PluginInputEditor
                              key={item.inputId}
                              input={item.inputDef}
                              interactionData={currentVal}
                              onUpdate={(data) => handleUpdateInput(stepId, item.inputId, data)}
                              mode="creation"
                              index={idx}
                              totalSteps={stepManualInputs.length}
                              isActive={isActiveInput}
                              hasData={hasData}
                              decimalPrecision={decimalPrecision}
                              onSelect={() => handleSelectInput(stepId, item.inputId)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Manual Properties */}
                  {stepManualProperties.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                        Step Properties
                      </span>
                      <div className="space-y-2 bg-surface-base/30 p-2.5 rounded-lg border border-border-base/20">
                        {stepManualProperties.map((item) => (
                          <PluginPropertyEditor
                            key={item.propertyName}
                            property={item.propertyDef}
                            value={
                              manualProperties[stepId]?.[item.propertyName] ?? item.defaultValue
                            }
                            onChange={(val) =>
                              handleUpdateProperty(stepId, item.propertyName, val)
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Overridden / Fixed Properties */}
                  {(boundPropEntries.length > 0 || propOverrides.length > 0) && (
                    <div className="text-[10px] text-text-muted space-y-1">
                      <span className="font-semibold uppercase tracking-wider">
                        Preset Overrides
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {propOverrides.map(([k, v]) => (
                          <span
                            key={k}
                            className="px-1.5 py-0.5 rounded bg-surface-base/60 border border-border-base/30 font-mono text-[10px]"
                          >
                            {k}: {String(v)}
                          </span>
                        ))}
                        {boundPropEntries.map(([k, expr]) => (
                          <span
                            key={k}
                            className="px-1.5 py-0.5 rounded bg-surface-base/60 border border-border-base/30 font-mono text-[10px]"
                          >
                            {k.replace('properties.', '')} ← {expr}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {!hasItems && (
                    <div className="text-[11px] text-text-muted/60 italic py-1">
                      No parameters required for this step.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer / Run Button */}
      <div className="pt-3 mt-3 border-t border-border-base/40 shrink-0">
        <Button
          variant="primary"
          size="default"
          className="w-full gap-2 font-bold shadow-md"
          disabled={!isReady}
          onClick={handleRunPipeline}
        >
          {isExecuting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Running Pipeline...</span>
            </>
          ) : (
            <>
              <Play size={16} />
              <span>Run Pipeline</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
