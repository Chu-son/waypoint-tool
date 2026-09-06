import { PluginInstance, PluginInputDef, OptionDef } from '../types/store';
import type { PipelineExecutionSetup } from '../types/pipeline';

/**
 * Checks if a given plugin input definition is bound by the pipeline step bindings.
 */
function isInputBound(inp: PluginInputDef, bindings: Record<string, string>): boolean {
  const id = inp.id;
  const name = inp.name;
  return Boolean(
    (id && (bindings[id] !== undefined || bindings[`inputs.${id}`] !== undefined)) ||
    (name && (bindings[name] !== undefined || bindings[`inputs.${name}`] !== undefined))
  );
}

/**
 * Checks if a given property definition is overridden or bound in the pipeline step.
 */
function isPropertyBoundOrOverridden(
  prop: OptionDef,
  bindings: Record<string, string>,
  overrides: Record<string, any>
): boolean {
  const name = prop.name;
  if (!name) return false;
  if (overrides[name] !== undefined) return true;
  return Boolean(
    bindings[name] !== undefined ||
    bindings[`properties.${name}`] !== undefined
  );
}

/**
 * Extracts manual inputs, manual properties, and initial defaults for a pipeline execution.
 *
 * Filters out inputs and properties that are bound to preceding steps or explicitly overridden.
 */
export function extractPipelineParameters(
  pipeline: PluginInstance,
  plugins: Record<string, PluginInstance>
): PipelineExecutionSetup {
  const setup: PipelineExecutionSetup = {
    pipelineId: pipeline.id,
    pipelineName: pipeline.manifest?.name || pipeline.id,
    manualInputs: [],
    manualProperties: [],
    defaultInputs: {},
    defaultProperties: {},
    missingPlugins: [],
    errors: [],
  };

  const recipe = pipeline.manifest?.pipeline;
  if (!recipe || !Array.isArray(recipe.steps) || recipe.steps.length === 0) {
    return setup;
  }

  for (const step of recipe.steps) {
    const stepId = step.step_id;
    const stepName = step.name || stepId;
    const pluginId = step.plugin_id;

    setup.defaultInputs[stepId] = {};
    setup.defaultProperties[stepId] = {};

    if (!stepId || !pluginId) {
      setup.errors.push(`Invalid step definition in pipeline: missing step_id or plugin_id.`);
      continue;
    }

    const targetPlugin = plugins[pluginId];
    if (!targetPlugin) {
      if (!setup.missingPlugins.includes(pluginId)) {
        setup.missingPlugins.push(pluginId);
      }
      setup.errors.push(`Plugin "${pluginId}" for step "${stepId}" was not found.`);
      continue;
    }

    const bindings = step.bindings || {};
    const propertyOverrides = step.property_overrides || {};
    Object.assign(setup.defaultProperties[stepId], propertyOverrides);

    // 1. Process inputs
    const inputs = targetPlugin.manifest?.inputs || [];
    for (const inp of inputs) {
      if (!isInputBound(inp, bindings)) {
        const inputKey = inp.name || inp.id;
        // Check if any downstream step binds to this input
        let isRequiredByDownstream = false;
        for (const otherStep of recipe.steps) {
          for (const expr of Object.values(otherStep.bindings || {})) {
            if (
              expr === `$steps.${stepId}.inputs.${inputKey}` ||
              expr === `$steps.${stepId}.inputs.${inp.id}` ||
              expr === `$steps.${stepId}.inputs.${inp.name}`
            ) {
              isRequiredByDownstream = true;
              break;
            }
          }
          if (isRequiredByDownstream) break;
        }

        const effectiveRequired = inp.required || isRequiredByDownstream;

        setup.manualInputs.push({
          stepId,
          stepName,
          pluginId,
          inputId: inputKey,
          label: inp.label || inp.name || inp.id,
          inputDef: {
            ...inp,
            required: effectiveRequired,
          },
          defaultValue: inp.default,
        });

        if (inp.default !== undefined) {
          setup.defaultInputs[stepId][inputKey] = inp.default;
        }
      }
    }

    // 2. Process properties
    const properties = targetPlugin.manifest?.properties || [];
    for (const prop of properties) {
      if (prop.name in propertyOverrides) {
        // Explicit override already assigned to setup.defaultProperties[stepId]
        setup.defaultProperties[stepId][prop.name] = propertyOverrides[prop.name];
      } else if (!isPropertyBoundOrOverridden(prop, bindings, propertyOverrides)) {
        // Manual property
        setup.manualProperties.push({
          stepId,
          stepName,
          pluginId,
          propertyName: prop.name,
          label: prop.label || prop.name,
          propertyDef: prop,
          defaultValue: prop.default,
        });

        if (prop.default !== undefined) {
          setup.defaultProperties[stepId][prop.name] = prop.default;
        }
      }
    }
  }

  return setup;
}
