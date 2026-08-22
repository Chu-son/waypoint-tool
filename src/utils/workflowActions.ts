import { AppState, useAppStore } from '../stores/appStore';
import { DialogAPI, BackendAPI } from '../api';
import { prepareLayersForExport } from './mapRasterize';

export type WorkflowActionHandler = (store: AppState, args?: any) => Promise<void> | void;

import { v4 as uuidv4 } from 'uuid';

export const workflowActionRegistry: Record<string, WorkflowActionHandler> = {
  triggerFitToMaps: (store) => {
    store.triggerFitToMaps();
  },

  ensureCustomLayer: (store, args) => {
    const exists = store.customLayers.some((l) => l.type === 'manual');
    if (!exists) {
      store.addManualCustomLayer(args?.layerName || 'Custom Layer');
    }
  },

  setRobotFootprintRadius: (store, args) => {
    const radius = typeof args?.value === 'number' ? args.value : 0.3;
    store.setRobotFootprint({
      type: 'circular',
      radius,
    });
  },

  reset_project: (store) => {
    store.resetProject();
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
        const mapData = await BackendAPI.loadROSMap(selected);
        const fileName = selected.split(/[/\\]/).pop() || 'Map';
        store.addMapLayer(fileName, mapData.info, mapData.image_data_b64, mapData.width, mapData.height);
        store.triggerFitToMaps();
      }
    } catch (err) {
      console.error('Failed to open map in workflow action:', err);
    }
  },

  open_export_modal: () => {
    useAppStore.setState({ isExportModalOpen: true });
  },

  open_import_modal: () => {
    useAppStore.setState({ isImportModalOpen: true });
  },

  open_settings_modal: (store, args) => {
    store.setSettingsModalOpen(true, args?.tab);
  },

  run_active_plugin: async (store) => {
    const activePluginId = store.activePluginId;
    const plugins = store.plugins || {};
    const plugin = activePluginId ? plugins[activePluginId] : null;
    if (!plugin) {
      console.warn('No active plugin to run');
      return;
    }

    try {
      const layersToPass = await prepareLayersForExport(store.mapLayers, store.customLayers);
      const pythonPath = store.globalPythonPath;
      const contextData = {
        interactionData: store.pluginInteractionData,
        properties: store.pluginActiveProperties,
      };

      const result = await BackendAPI.runPlugin(plugin, contextData, pythonPath, layersToPass);
      if (result && Array.isArray(result)) {
        const parentId = uuidv4();
        store.runInHistoryTransaction(() => {
          store.addNode({
            id: parentId,
            type: "generator",
            plugin_id: plugin.id,
            generator_params: contextData,
            children_ids: [],
          });

          result.forEach((wp: any) => {
            let qx = wp.qx ?? 0,
              qy = wp.qy ?? 0,
              qz = wp.qz ?? 0,
              qw = wp.qw ?? 1;
            if (typeof wp.yaw === "number" && typeof wp.qw !== "number") {
              const halfYaw = wp.yaw / 2.0;
              qz = Math.sin(halfYaw);
              qw = Math.cos(halfYaw);
            }

            const id = uuidv4();
            store.addNode(
              {
                id,
                type: "manual",
                transform: wp.transform || {
                  position: { x: wp.x ?? 0, y: wp.y ?? 0, z: wp.z ?? 0 },
                  orientation: { x: qx, y: qy, z: qz, w: qw },
                },
                options: wp.options || wp.properties || {},
              },
              parentId
            );
          });
        });
      }
    } catch (err) {
      console.error('Failed to run plugin in workflow action:', err);
    }
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
