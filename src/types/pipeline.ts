import { PluginInputDef, OptionDef } from './store';

export interface PipelineStepExportsDef {
  custom_layers?: boolean;
  waypoints?: boolean;
  annotations?: boolean;
}

export interface PipelineStepDef {
  step_id: string;
  plugin_id: string;
  name?: string;
  bindings?: Record<string, string>; // e.g. { "inputs.cost_layer": "$steps.filter_step.custom_layers[0]" }
  property_overrides?: Record<string, any>;
  exports?: PipelineStepExportsDef;
}

export interface PipelineRecipeDef {
  steps: PipelineStepDef[];
}

export interface PipelineMetadata {
  pipeline_id: string;
  pipeline_execution_id: string;
  step_id: string;
  step_execution_id: string;
  /** Snapshot of manual inputs for all steps at pipeline execution time */
  pipeline_inputs?: Record<string, Record<string, any>>;
  /** Snapshot of manual properties for all steps at pipeline execution time */
  pipeline_properties?: Record<string, Record<string, any>>;
}

export interface PluginDependencyDef {
  id: string;
  name?: string;
  version: string;
}

export interface PythonDependencyDef {
  name: string;
  version?: string;
  optional?: boolean;
  description?: string;
}

export interface ManualInputItem {
  stepId: string;
  stepName?: string;
  pluginId: string;
  inputId: string;
  label: string;
  inputDef: PluginInputDef;
  defaultValue?: any;
}

export interface ManualPropertyItem {
  stepId: string;
  stepName?: string;
  pluginId: string;
  propertyName: string;
  label: string;
  propertyDef: OptionDef;
  defaultValue?: any;
}

export interface PipelineExecutionSetup {
  pipelineId: string;
  pipelineName?: string;
  manualInputs: ManualInputItem[];
  manualProperties: ManualPropertyItem[];
  defaultInputs: Record<string, Record<string, any>>;
  defaultProperties: Record<string, Record<string, any>>;
  missingPlugins: string[];
  errors: string[];
}
