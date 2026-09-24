import type { OptionDef } from './options';
import type { PluginInputDef } from './plugin';

/** A step input the user must provide before running a pipeline (not bound to another step). */
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
