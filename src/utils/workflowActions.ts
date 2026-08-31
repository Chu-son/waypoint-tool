import { AppState, useAppStore } from '../stores/appStore';
import { DialogAPI, BackendAPI } from '../api';
import { AnnotationToolType } from '../stores/slices/annotationSlice';
import { v4 as uuidv4 } from 'uuid';

export type WorkflowActionHandler = (store: AppState, args?: any) => Promise<void> | void;

export function resolveWorkflowVariables(
  value: any,
  variables: Record<string, any>,
  store?: AppState
): any {
  if (value === null || value === undefined) return value;

  if (typeof value === 'object') {
    // $var reference object: { $var: "var_name" }
    if (value.$var && typeof value.$var === 'string') {
      const varVal = variables[value.$var];
      return varVal !== undefined ? resolveWorkflowVariables(varVal, variables, store) : value;
    }

    // $fromAnnotationGroup: { $fromAnnotationGroup: "group_name" | { $var: "..." } }
    if (value.$fromAnnotationGroup) {
      const rawGroupName = resolveWorkflowVariables(value.$fromAnnotationGroup, variables, store);
      const groupName = typeof rawGroupName === 'object' && rawGroupName.groupName
        ? rawGroupName.groupName
        : (typeof rawGroupName === 'object' && rawGroupName.name ? rawGroupName.name : String(rawGroupName));

      if (store) {
        const groups = store.annotationGroups || {};
        const objects = store.annotationObjects || {};
        const targetGroup = Object.values(groups).find((g) => g.name === groupName || g.id === groupName);
        if (targetGroup) {
          const childIds = targetGroup.children_ids || [];
          const childObjects = childIds.map((id) => objects[id]).filter(Boolean);
          // Return list of points / geometries
          return childObjects.map((obj) => {
            if (obj.type === 'point') {
              return { x: obj.x ?? 0, y: obj.y ?? 0, name: obj.name };
            }
            return obj;
          });
        }
      }
      return [];
    }

    if (Array.isArray(value)) {
      return value.map((item) => resolveWorkflowVariables(item, variables, store));
    }

    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = resolveWorkflowVariables(v, variables, store);
    }
    return result;
  }

  if (typeof value === 'string') {
    if (value.startsWith('$var:')) {
      const varName = value.substring(5);
      const varVal = variables[varName];
      return varVal !== undefined ? resolveWorkflowVariables(varVal, variables, store) : value;
    }
  }

  return value;
}

export function resolveExplicitAnnotationBindings(
  rawInteractionData: Record<string, any>,
  annotationObjects: Record<string, any>,
  annotationOrder: string[],
  variables?: Record<string, any>,
  store?: AppState
): Record<string, any> {
  const vars = variables || {};
  const resolvedWithVars = resolveWorkflowVariables(rawInteractionData, vars, store);
  const resolved: Record<string, any> = { ...resolvedWithVars };

  for (const [key, val] of Object.entries(resolved)) {
    if (val && typeof val === 'object' && val.$fromAnnotation) {
      const rawName = val.$fromAnnotation.name;
      const resolvedName = resolveWorkflowVariables(rawName, vars, store);
      const type = val.$fromAnnotation.type;

      const matchId = annotationOrder.find((id) => {
        const obj = annotationObjects[id];
        if (!obj) return false;
        if (resolvedName && obj.name !== resolvedName) return false;
        if (type && obj.type !== type) return false;
        return true;
      });
      if (matchId && annotationObjects[matchId]) {
        resolved[key] = annotationObjects[matchId];
      }
    }
  }

  return resolved;
}

export const workflowActionRegistry: Record<string, WorkflowActionHandler> = {
  triggerFitToMaps: (store) => {
    store.triggerFitToMaps();
  },

  reset_project: (store) => {
    store.resetProject();
  },

  open_project_dialog: async (store) => {
    try {
      await store.loadProject();
    } catch (err) {
      console.error('Failed to load project in workflow action:', err);
    }
  },

  save_project: async (store) => {
    try {
      await store.saveProject();
    } catch (err) {
      console.error('Failed to save project in workflow action:', err);
    }
  },

  open_map_dialog: async (store) => {
    try {
      const selected = await DialogAPI.open({
        filters: [
          { name: 'ROS Map (*.yaml, *.yml)', extensions: ['yaml', 'yml'] },
          { name: 'Image Map (*.png, *.jpg, *.jpeg, *.pgm)', extensions: ['png', 'jpg', 'jpeg', 'pgm'] },
        ],
      });
      if (selected && typeof selected === 'string') {
        const fileName = selected.split(/[/\\]/).pop() || 'Map';
        await store.runWithLoading(
          {
            message: "マップを読み込み中...",
            detail: fileName,
            blocking: true,
          },
          async () => {
            const mapData = await BackendAPI.loadROSMap(selected);
            store.addMapLayer(fileName, mapData.info, mapData.image_data_b64, mapData.width, mapData.height);
            store.triggerFitToMaps();
          }
        );
      }
    } catch (err) {
      console.error('Failed to open map in workflow action:', err);
    }
  },

  open_export_modal: () => {
    useAppStore.setState({ isExportModalOpen: true });
  },

  open_export_maps_modal: () => {
    useAppStore.setState({ isExportMapsModalOpen: true });
  },

  open_import_modal: () => {
    useAppStore.setState({ isImportModalOpen: true });
  },

  open_settings_modal: (store, args) => {
    store.setSettingsModalOpen(true, args?.tab);
  },

  ensureCustomLayer: (store, args) => {
    const exists = store.customLayers.some((l) => l.type === 'manual');
    if (!exists) {
      store.addManualCustomLayer(args?.layerName || 'Custom Layer', args?.is_reference);
    }
  },

  ensure_custom_layer: (store, args) => {
    const exists = store.customLayers.some((l) => l.type === 'manual');
    if (!exists) {
      store.addManualCustomLayer(args?.layerName || 'Custom Layer', args?.is_reference);
    }
  },

  setRobotFootprintRadius: (store, args) => {
    const radius = typeof args?.value === 'number' ? args.value : (typeof args?.radius === 'number' ? args.radius : 0.3);
    store.setRobotFootprint({
      type: 'circular',
      radius,
    });
  },

  set_robot_footprint: (store, args) => {
    if (!args) return;
    const current = store.robotFootprint || { type: 'circular', radius: 0.3 };
    store.setRobotFootprint({
      ...current,
      ...args,
    });
  },

  set_annotation_tool: (store, args) => {
    store.setAnnotationEditMode(true);
    if (args?.tool) {
      store.setActiveAnnotationSubTool(args.tool as AnnotationToolType);
    }
    if (args?.defaultColor) {
      store.setDefaultAnnotationColor(args.defaultColor);
    }
    if (args?.allowedTools) {
      store.setAllowedAnnotationSubTools(args.allowedTools);
    }

    let targetGroupId: string | null = null;
    if (args?.groupName) {
      const existing = Object.values(store.annotationGroups || {}).find(
        (g) => g.name === args.groupName || g.id === args.groupName
      );
      if (existing) {
        targetGroupId = existing.id;
      } else {
        targetGroupId = uuidv4();
        store.addAnnotationGroup({
          id: targetGroupId,
          type: 'manual_group',
          name: args.groupName,
          children_ids: [],
          visible: true,
        });
      }
      store.setActiveAnnotationGroupId(targetGroupId);
    }

    if (args?.saveToVariable) {
      store.setWorkflowVariable(args.saveToVariable, {
        groupId: targetGroupId,
        groupName: args?.groupName || 'Annotations',
        tool: args?.tool,
      });
    }

    // Switch to select tool so that canvas annotation pointer events are active
    store.setActiveTool('select');
  },

  start_map_edit: (store, args) => {
    // 1. Ensure an active manual custom layer
    let targetLayer = store.customLayers.find((l) => l.id === store.activeCustomLayerId && l.type === 'manual');
    if (!targetLayer) {
      targetLayer = store.customLayers.find((l) => l.type === 'manual');
      if (targetLayer) {
        store.setActiveCustomLayerId(targetLayer.id);
      } else {
        const created = store.addManualCustomLayer(args?.layerName || 'Edit Layer');
        store.setActiveCustomLayerId(created.id);
      }
    }

    // 2. Enable map edit mode and sub-tool
    store.setMapEditMode(true);
    if (args?.subTool) {
      store.setMapEditSubTool(args.subTool);
    }
    if (typeof args?.fillValue === 'number') {
      store.setMapEditFillValue(args.fillValue);
    }
    if (typeof args?.brushSize === 'number') {
      store.setMapEditBrushSize(args.brushSize);
    }
  },

  stop_map_edit: (store) => {
    store.setMapEditMode(false);
  },

  set_active_plugin: (store, args) => {
    if (args?.pluginId) {
      store.setActivePlugin(args.pluginId);
    }
  },

  run_plugin: async (store, args) => {
    const pluginId = args?.pluginId || store.activePluginId;
    let plugins = store.plugins || {};

    // If plugins map is empty (e.g. initial launch timing), attempt reload
    if (Object.keys(plugins).length === 0) {
      try {
        await store.reloadPlugins();
        plugins = useAppStore.getState().plugins || {};
      } catch (err) {
        console.warn('[WorkflowAction] Failed to auto-reload plugins:', err);
      }
    }

    const plugin = pluginId ? plugins[pluginId] : null;
    if (!plugin) {
      const availableIds = Object.keys(plugins);
      const availableMsg = availableIds.length > 0
        ? `\n\n利用可能なプラグイン一覧:\n- ${availableIds.join('\n- ')}`
        : '\n\n(利用可能なプラグインがロードされていません)';
      console.warn(`[WorkflowAction] Plugin not found: ${pluginId}`, availableIds);
      alert(`プラグインが見つかりません: ${pluginId || '(未指定)'}${availableMsg}`);
      return;
    }

    try {
      await store.runWithLoading(
        {
          message: "プラグインを実行中...",
          detail: plugin.manifest.name || plugin.id,
          blocking: true,
        },
        async () => {
          const stepId = args?.stepId || store.currentStepIndex.toString();
          const existingExecutionId = store.stepExecutionIds?.[stepId];

          const variables = store.workflowVariables || {};
          const rawProperties = {
            ...store.pluginActiveProperties,
            ...(args?.properties || {}),
          };
          const properties = resolveWorkflowVariables(rawProperties, variables, store);

          const mergedInteractionData = {
            ...store.pluginInteractionData,
            ...(args?.interactionData || {}),
          };
          const interactionData = resolveExplicitAnnotationBindings(
            mergedInteractionData,
            store.annotationObjects || {},
            store.annotationOrder || [],
            variables,
            store
          );

          const result = await store.executeGeneratorPlugin({
            plugin,
            properties,
            interactionData,
            existingExecutionId,
          });

          const resultExecId = (result as any)?.source_execution_id || (result as any)?.executionId || (result as any)?.execution_id;
          if (resultExecId) {
            store.setStepExecutionId(stepId, resultExecId);
          }

          if (args?.saveToVariable && result) {
            store.setWorkflowVariable(args.saveToVariable, result);
          }

          if (!result.success && result.error) {
            throw new Error(result.error);
          }
        }
      );
    } catch (err) {
      console.error('Failed to run plugin in workflow action:', err);
      alert(`プラグイン実行に失敗しました:\n${String(err)}`);
    }
  },

  run_active_plugin: async (store, args) => {
    await workflowActionRegistry.run_plugin(store, args);
  },
};

export async function executeWorkflowAction(actionName: string, args?: any) {
  const handler = workflowActionRegistry[actionName];
  if (handler) {
    await handler(useAppStore.getState(), args);
  } else {
    console.warn(`[WorkflowAction] Unknown action: ${actionName}`);
  }
}

