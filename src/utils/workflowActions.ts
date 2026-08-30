import { AppState, useAppStore } from '../stores/appStore';
import { DialogAPI, BackendAPI } from '../api';
import { AnnotationToolType } from '../stores/slices/annotationSlice';

export type WorkflowActionHandler = (store: AppState, args?: any) => Promise<void> | void;

export function resolveExplicitAnnotationBindings(
  rawInteractionData: Record<string, any>,
  annotationObjects: Record<string, any>,
  annotationOrder: string[]
): Record<string, any> {
  const resolved: Record<string, any> = { ...rawInteractionData };

  for (const [key, val] of Object.entries(resolved)) {
    if (val && typeof val === 'object' && val.$fromAnnotation) {
      const { name, type } = val.$fromAnnotation;
      const matchId = annotationOrder.find((id) => {
        const obj = annotationObjects[id];
        if (!obj) return false;
        if (name && obj.name !== name) return false;
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
          const properties = {
            ...store.pluginActiveProperties,
            ...(args?.properties || {}),
          };
          const mergedInteractionData = {
            ...store.pluginInteractionData,
            ...(args?.interactionData || {}),
          };
          const interactionData = resolveExplicitAnnotationBindings(
            mergedInteractionData,
            store.annotationObjects || {},
            store.annotationOrder || []
          );

          const result = await store.executeGeneratorPlugin({
            plugin,
            properties,
            interactionData,
          });

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

