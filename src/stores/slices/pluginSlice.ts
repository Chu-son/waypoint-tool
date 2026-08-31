import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { PluginInstance, PluginSetting, PluginCustomLayer, AnnotationGroup, AnnotationObject } from '../../types/store';
import { BackendAPI } from '../../api';
import { prepareLayersForExport, enrichInteractionDataWithCustomLayers } from '../../utils/mapRasterize';
import { DEFAULT_ANNOTATION_COLOR } from '../../utils/colorPresets';
import { v4 as uuidv4 } from 'uuid';

export interface ExecutePluginParams {
  plugin: PluginInstance;
  properties: Record<string, any>;
  interactionData?: Record<string, any>;
  existingExecutionId?: string;
  targetParentWaypointId?: string;
  targetCustomLayerId?: string;
  targetAnnotationGroupId?: string;
  idsToConsume?: string[];
  insertIndex?: number;
}

export type PluginSlice = {
  plugins: Record<string, PluginInstance>;
  pluginSettings: PluginSetting[];
  activePluginId: string | null;
  pluginInteractionData: Record<string, any>;
  pluginActiveProperties: Record<string, any>;
  activeInputIndex: number;

  activePathCalculatorPluginId: string | null;
  pathCalculatorParams: Record<string, any>;
  autoRecalculatePath: boolean;
  calculatedPathSegments: Array<Array<{ x: number; y: number }>> | null;
  isCalculatingPath: boolean;

  setPlugins: (plugins: Record<string, PluginInstance>) => void;
  setPluginSettings: (settings: PluginSetting[]) => void;
  updatePluginSetting: (id: string, updates: Partial<PluginSetting>) => void;
  setActivePlugin: (pluginId: string | null) => void;
  updatePluginInteractionData: (inputId: string, data: any) => void;
  clearPluginInteractionData: () => void;
  setPluginActiveProperties: (props: Record<string, any>) => void;
  setActiveInputIndex: (index: number) => void;
  reloadPlugins: () => Promise<void>;

  executeGeneratorPlugin: (params: ExecutePluginParams) => Promise<{
    success: boolean;
    executionId: string;
    parentWaypointId?: string;
    customLayerIds: string[];
    annotationGroupId?: string;
    error?: string;
  }>;

  setActivePathCalculatorPluginId: (pluginId: string | null) => void;
  setPathCalculatorParams: (params: Record<string, any>) => void;
  setAutoRecalculatePath: (enabled: boolean) => void;
  setCalculatedPathSegments: (segments: Array<Array<{ x: number; y: number }>> | null) => void;
  debouncedRecalculatePath: (delayMs?: number) => void;
  recalculatePath: (options?: { immediate?: boolean }) => Promise<void>;
};

let recalculateTimer: any = null;
let currentCalculationRequestId = 0;

export const createPluginSlice: StateCreator<AppState, [], [], PluginSlice> = (set, get) => ({
  plugins: {},
  pluginSettings: [],
  activePluginId: null,
  pluginInteractionData: {},
  pluginActiveProperties: {},
  activeInputIndex: 0,

  activePathCalculatorPluginId: null,
  pathCalculatorParams: {},
  autoRecalculatePath: true,
  calculatedPathSegments: null,
  isCalculatingPath: false,

  setPlugins: (plugins) => set({ plugins }),
  
  setPluginSettings: (settings) => set({ pluginSettings: settings, isDirty: true }),
  
  updatePluginSetting: (id, updates) => set((state) => ({
    pluginSettings: state.pluginSettings.map(p => p.id === id ? { ...p, ...updates } : p),
    isDirty: true
  })),
  
  setActivePlugin: (pluginId) => set((state) => {
    if (state.activePluginId === pluginId) {
      return { isAnnotationEditMode: false };
    }
    const plugin = pluginId && state.plugins ? state.plugins[pluginId] : null;
    const isMapLayerGen = plugin?.manifest?.category === 'map_layer_generator';
    return {
      activePluginId: pluginId,
      pluginInteractionData: {},
      pluginActiveProperties: {},
      activeInputIndex: 0,
      isAnnotationEditMode: false,
      ...(!isMapLayerGen ? { activeCustomLayerId: null, isMapEditMode: false } : {}),
    };
  }),
  
  updatePluginInteractionData: (inputId, data) => set((state) => ({
    pluginInteractionData: {
      ...state.pluginInteractionData,
      [inputId]: data
    }
  })),
    
  clearPluginInteractionData: () => set({ 
    pluginInteractionData: {}, 
    pluginActiveProperties: {},
    activeInputIndex: 0 
  }),
  
  setPluginActiveProperties: (props) => set({ pluginActiveProperties: props }),
  
  setActiveInputIndex: (index) => set({ activeInputIndex: index }),

  executeGeneratorPlugin: async (params) => {
    const {
      plugin,
      properties,
      interactionData = {},
      existingExecutionId,
      targetParentWaypointId,
      targetCustomLayerId,
      targetAnnotationGroupId,
      idsToConsume = [],
      insertIndex = -1,
    } = params;

    const {
      globalPythonPath,
      pluginSettings,
      mapLayers,
      customLayers,
      nodes,
      selectedNodeIds,
      robotFootprint,
      annotationObjects,
    } = get();

    const executionId = existingExecutionId || uuidv4();
    const inputs = plugin.manifest.inputs || [];
    const needsSelection = plugin.manifest.needs?.includes('selected_points') || false;

    if (needsSelection && selectedNodeIds.length === 0 && !params.existingExecutionId) {
      throw new Error('This plugin requires selecting waypoint(s) on the canvas first.');
    }

    const contextData: any = {
      properties,
      interaction_data: {},
    };

    inputs.forEach((inp) => {
      const key = inp.name || inp.id;
      if (key && interactionData[key] !== undefined) {
        contextData.interaction_data[key] = interactionData[key];
      }
    });

    if (needsSelection) {
      contextData.selected_points = selectedNodeIds
        .map((id) => nodes[id]?.transform)
        .filter(Boolean);
    }

    if (plugin.manifest.needs?.includes('robot_footprint')) {
      contextData.robot_footprint = robotFootprint;
    }

    let pythonPathToUse = globalPythonPath?.trim() || 'python3';
    if (plugin.manifest.type === 'python') {
      const setting = pluginSettings.find((s) => s.id === plugin.id);
      if (setting && setting.pythonOverridePath && setting.pythonOverridePath.trim() !== '') {
        pythonPathToUse = setting.pythonOverridePath.trim();
      }
    }

    const needsOccupancyGrid = plugin.manifest.needs?.some(
      (n) => n === 'occupancy_grid' || n === 'occupancy_grid_in_region'
    );

    const layersToPass = needsOccupancyGrid
      ? await prepareLayersForExport(mapLayers, customLayers)
      : undefined;

    const baseRes = mapLayers.find((l) => l.visible)?.info?.resolution || 0.05;
    const enrichedInteractionData = await enrichInteractionDataWithCustomLayers(
      plugin.manifest.inputs,
      contextData.interaction_data || {},
      customLayers,
      baseRes,
      annotationObjects
    );

    const finalContextData = {
      ...contextData,
      interaction_data: enrichedInteractionData,
    };

    const rawResult: any = await BackendAPI.runPlugin(
      plugin,
      finalContextData,
      pythonPathToUse,
      layersToPass
    );

    let resultingParentWaypointId: string | undefined = undefined;
    const resultingCustomLayerIds: string[] = [];
    let resultingAnnotationGroupId: string | undefined = undefined;

    get().runInHistoryTransaction(() => {
      const store = get();

      // ----------------------------------------------------
      // 1. Waypoint Output Handling
      // ----------------------------------------------------
      let waypointItems: any[] | null = null;
      let waypointPluginData: Record<string, any> | undefined = undefined;
      let waypointGroupName: string | undefined = undefined;

      if (rawResult && rawResult.waypoints) {
        if (Array.isArray(rawResult.waypoints)) {
          waypointItems = rawResult.waypoints;
        } else if (rawResult.waypoints.items && Array.isArray(rawResult.waypoints.items)) {
          waypointItems = rawResult.waypoints.items;
          waypointPluginData = rawResult.waypoints.plugin_data;
          waypointGroupName = rawResult.waypoints.name;
        }
      } else if (Array.isArray(rawResult) && rawResult.length > 0 && (rawResult[0].transform || rawResult[0].x !== undefined)) {
        // Direct list of waypoints
        waypointItems = rawResult;
      }

      if (waypointItems && waypointItems.length > 0) {
        let parentId = targetParentWaypointId;
        if (!parentId && existingExecutionId) {
          // Find parent node with matching execution_id
          const found = Object.values(store.nodes).find(n => n.type === 'generator' && n.source_execution_id === existingExecutionId);
          if (found) parentId = found.id;
        }

        if (parentId && store.nodes[parentId]) {
          // Existing generator node -> replace children
          const existingParent = store.nodes[parentId];
          if (existingParent.children_ids && existingParent.children_ids.length > 0) {
            store.removeNodes(existingParent.children_ids);
          }
          store.updateNode(parentId, {
            plugin_id: plugin.id,
            source_execution_id: executionId,
            generator_params: finalContextData,
            plugin_data: waypointPluginData || rawResult.plugin_data || existingParent.plugin_data,
            name: waypointGroupName || existingParent.name,
          });
          resultingParentWaypointId = parentId;
        } else {
          // New parent generator node
          parentId = uuidv4();
          if (idsToConsume.length > 0) {
            store.removeNodes(idsToConsume);
          }
          store.addNode({
            id: parentId,
            type: 'generator',
            name: waypointGroupName || plugin.manifest.name,
            plugin_id: plugin.id,
            source_execution_id: executionId,
            generator_params: finalContextData,
            plugin_data: waypointPluginData || rawResult.plugin_data,
            children_ids: [],
          });

          if (insertIndex !== -1) {
            const currentRootIds = store.rootNodeIds;
            const newIdx = currentRootIds.indexOf(parentId);
            if (newIdx !== -1 && newIdx !== insertIndex) {
              store.reorderNodes(newIdx, insertIndex);
            }
          }
          resultingParentWaypointId = parentId;
        }

        // Add child waypoint nodes
        waypointItems.forEach((wp) => {
          let qx = wp.qx ?? 0,
            qy = wp.qy ?? 0,
            qz = wp.qz ?? 0,
            qw = wp.qw ?? 1;
          if (typeof wp.yaw === 'number' && typeof wp.qw !== 'number') {
            const halfYaw = wp.yaw / 2.0;
            qz = Math.sin(halfYaw);
            qw = Math.cos(halfYaw);
          }

          const childId = uuidv4();
          store.addNode(
            {
              id: childId,
              type: 'manual',
              transform: wp.transform || {
                x: wp.x ?? 0,
                y: wp.y ?? 0,
                qx,
                qy,
                qz,
                qw,
              },
              options: wp.options || {},
            },
            parentId
          );
        });
      }

      // ----------------------------------------------------
      // 2. Custom Layer Output Handling
      // ----------------------------------------------------
      let layerList: any[] = [];
      if (rawResult && rawResult.custom_layers && Array.isArray(rawResult.custom_layers)) {
        layerList = rawResult.custom_layers;
      } else if (rawResult && rawResult.image_base64 && rawResult.info) {
        // Direct single layer output
        layerList = [rawResult];
      }

      layerList.forEach((layerItem) => {
        let existingLayerId = targetCustomLayerId;
        if (!existingLayerId && existingExecutionId) {
          const found = store.customLayers.find(
            (l) => l.type === 'plugin' && (l as any).source_execution_id === existingExecutionId
          );
          if (found) existingLayerId = found.id;
        }

        const layerPluginData = layerItem.plugin_data || rawResult.plugin_data;

        if (existingLayerId) {
          store.updateCustomLayer(existingLayerId, {
            name: layerItem.name || 'Generated Layer',
            image_base64: layerItem.image_base64,
            info: layerItem.info,
            blend_mode: layerItem.blend_mode || 'overwrite',
            opacity: layerItem.opacity ?? 0.7,
            params: properties,
            interaction_data: contextData.interaction_data,
            plugin_id: plugin.id,
            source_execution_id: executionId,
            plugin_data: layerPluginData,
          } as Partial<PluginCustomLayer>);
          resultingCustomLayerIds.push(existingLayerId);
        } else {
          const newLayerId = layerItem.id || uuidv4();
          const newPluginLayer: PluginCustomLayer = {
            id: newLayerId,
            name: layerItem.name || `${plugin.manifest.name} Layer`,
            type: 'plugin',
            plugin_id: plugin.id,
            source_execution_id: executionId,
            plugin_data: layerPluginData,
            params: properties,
            interaction_data: contextData.interaction_data,
            image_base64: layerItem.image_base64,
            info: layerItem.info,
            visible: true,
            opacity: layerItem.opacity ?? 0.7,
            z_index: store.customLayers.length,
            blend_mode: layerItem.blend_mode || 'overwrite',
            is_reference: false,
          };
          store.addPluginCustomLayer(newPluginLayer);
          resultingCustomLayerIds.push(newLayerId);
        }
      });

      // ----------------------------------------------------
      // 3. Annotation Output Handling
      // ----------------------------------------------------
      let annotationItems: any[] | null = null;
      let annotationPluginData: Record<string, any> | undefined = undefined;
      let annotationGroupName: string | undefined = undefined;

      if (rawResult && rawResult.annotations) {
        if (Array.isArray(rawResult.annotations)) {
          annotationItems = rawResult.annotations;
        } else if (rawResult.annotations.items && Array.isArray(rawResult.annotations.items)) {
          annotationItems = rawResult.annotations.items;
          annotationPluginData = rawResult.annotations.plugin_data;
          annotationGroupName = rawResult.annotations.name;
        }
      }

      if (annotationItems && annotationItems.length > 0) {
        let groupId = targetAnnotationGroupId;
        if (!groupId && existingExecutionId) {
          const found = Object.values(store.annotationGroups).find(
            (g) => g.source_execution_id === existingExecutionId
          );
          if (found) groupId = found.id;
        }

        const annoPluginData = annotationPluginData || rawResult.plugin_data;

        if (groupId && store.annotationGroups[groupId]) {
          // Existing group -> remove old children and replace
          const existingGroup = store.annotationGroups[groupId];
          if (existingGroup.children_ids && existingGroup.children_ids.length > 0) {
            store.removeAnnotationObjects(existingGroup.children_ids);
          }

          const newChildrenIds: string[] = [];
          annotationItems.forEach((anno) => {
            const childId = anno.id || uuidv4();
            const childObj: AnnotationObject = {
              id: childId,
              name: anno.name || `${existingGroup.name} Item`,
              type: anno.type || 'point',
              visible: anno.visible ?? true,
              labelVisible: anno.labelVisible ?? true,
              color: anno.color || existingGroup.color || DEFAULT_ANNOTATION_COLOR,
              group_id: groupId,
              source_execution_id: executionId,
              plugin_data: anno.plugin_data,
              ...(anno as any),
            };
            store.addAnnotationObject(childObj, groupId);
            newChildrenIds.push(childId);
          });

          store.updateAnnotationGroup(groupId, {
            name: annotationGroupName || existingGroup.name,
            plugin_id: plugin.id,
            source_execution_id: executionId,
            generator_params: finalContextData,
            plugin_data: annoPluginData || existingGroup.plugin_data,
            children_ids: newChildrenIds,
          });
          resultingAnnotationGroupId = groupId;
        } else {
          // New Annotation Group
          groupId = uuidv4();
          const newGroup: AnnotationGroup = {
            id: groupId,
            name: annotationGroupName || `${plugin.manifest.name} Annotations`,
            type: 'generator',
            visible: true,
            color: DEFAULT_ANNOTATION_COLOR,
            children_ids: [],
            plugin_id: plugin.id,
            source_execution_id: executionId,
            generator_params: finalContextData,
            plugin_data: annoPluginData,
          };
          store.addAnnotationGroup(newGroup);

          annotationItems.forEach((anno) => {
            const childId = anno.id || uuidv4();
            const childObj: AnnotationObject = {
              id: childId,
              name: anno.name || 'Annotation',
              type: anno.type || 'point',
              visible: anno.visible ?? true,
              labelVisible: anno.labelVisible ?? true,
              color: anno.color || DEFAULT_ANNOTATION_COLOR,
              group_id: groupId,
              source_execution_id: executionId,
              plugin_data: anno.plugin_data,
              ...(anno as any),
            };
            store.addAnnotationObject(childObj, groupId);
          });
          resultingAnnotationGroupId = groupId;
        }
      }
    });

    return {
      success: true,
      executionId,
      parentWaypointId: resultingParentWaypointId,
      customLayerIds: resultingCustomLayerIds,
      annotationGroupId: resultingAnnotationGroupId,
    };
  },

  setActivePathCalculatorPluginId: (pluginId) => {
    set({ activePathCalculatorPluginId: pluginId, isDirty: true });
    if (!pluginId) {
      set({ calculatedPathSegments: null, isCalculatingPath: false });
    } else if (get().autoRecalculatePath) {
      get().recalculatePath({ immediate: true });
    }
  },

  setPathCalculatorParams: (params) => {
    set({ pathCalculatorParams: params, isDirty: true });
    if (get().autoRecalculatePath && get().activePathCalculatorPluginId) {
      get().debouncedRecalculatePath(200);
    }
  },

  setAutoRecalculatePath: (enabled) => set({ autoRecalculatePath: enabled, isDirty: true }),

  setCalculatedPathSegments: (segments) => set({ calculatedPathSegments: segments }),

  debouncedRecalculatePath: (delayMs = 200) => {
    if (recalculateTimer) {
      clearTimeout(recalculateTimer);
      recalculateTimer = null;
    }
    recalculateTimer = setTimeout(() => {
      recalculateTimer = null;
      get().recalculatePath({ immediate: true });
    }, delayMs);
  },

  recalculatePath: async (options) => {
    if (!options?.immediate) {
      get().debouncedRecalculatePath(200);
      return;
    }

    if (recalculateTimer) {
      clearTimeout(recalculateTimer);
      recalculateTimer = null;
    }

    const requestId = ++currentCalculationRequestId;

    const {
      activePathCalculatorPluginId,
      pathCalculatorParams,
      plugins,
      pluginSettings,
      globalPythonPath,
      rootNodeIds,
      nodes,
      mapLayers,
      customLayers,
      robotFootprint,
    } = get();

    if (!activePathCalculatorPluginId || !plugins[activePathCalculatorPluginId]) {
      set({ calculatedPathSegments: null, isCalculatingPath: false });
      get().stopLoading('path-calc');
      return;
    }

    const plugin = plugins[activePathCalculatorPluginId];

    // Collect ordered waypoints
    const waypoints: Array<{ x: number; y: number; qx: number; qy: number; qz: number; qw: number }> = [];
    rootNodeIds.forEach((id) => {
      const node = nodes[id];
      if (!node) return;
      if (node.type === 'manual' && node.transform) {
        waypoints.push(node.transform);
      } else if (node.type === 'generator' && node.children_ids) {
        node.children_ids.forEach((cid) => {
          const child = nodes[cid];
          if (child && child.transform) {
            waypoints.push(child.transform);
          }
        });
      }
    });

    if (waypoints.length < 2) {
      set({ calculatedPathSegments: null, isCalculatingPath: false });
      get().stopLoading('path-calc');
      return;
    }

    set({ isCalculatingPath: true });
    get().startLoading({
      id: 'path-calc',
      message: '経路を計算中...',
      detail: plugin.manifest.name || plugin.id,
      blocking: false,
    });

    try {
      let pythonPathToUse = globalPythonPath?.trim() || "python3";
      if (plugin.manifest.type === "python") {
        const setting = pluginSettings.find((s) => s.id === plugin.id);
        if (setting && setting.pythonOverridePath && setting.pythonOverridePath.trim() !== "") {
          pythonPathToUse = setting.pythonOverridePath.trim();
        }
      }

      const contextData: any = {
        waypoints,
        properties: pathCalculatorParams,
      };

      if (plugin.manifest.needs?.includes('robot_footprint')) {
        contextData.robot_footprint = robotFootprint;
      }

      const layersToPass = await prepareLayersForExport(mapLayers || [], customLayers || []);

      const result = await BackendAPI.runPlugin(
        plugin,
        contextData,
        pythonPathToUse,
        layersToPass
      );

      // Check if this request is still the latest one
      if (requestId !== currentCalculationRequestId) {
        return;
      }

      if (result && Array.isArray(result.segments)) {
        set({ calculatedPathSegments: result.segments, isCalculatingPath: false });
      } else if (Array.isArray(result)) {
        // Flat list of segments or points
        set({ calculatedPathSegments: [result], isCalculatingPath: false });
      } else {
        console.warn("[recalculatePath] Unexpected result format from path calculator:", result);
        set({ calculatedPathSegments: null, isCalculatingPath: false });
      }
    } catch (err) {
      if (requestId === currentCalculationRequestId) {
        console.error("[recalculatePath] Failed to calculate path:", err);
        set({ calculatedPathSegments: null, isCalculatingPath: false });
      }
    } finally {
      if (requestId === currentCalculationRequestId) {
        get().stopLoading('path-calc');
      }
    }
  },

  reloadPlugins: async () => {
    try {
      const installedPlugins = await BackendAPI.fetchInstalledPlugins();
      const newMap: Record<string, PluginInstance> = {};
      
      installedPlugins.forEach((p: PluginInstance) => {
        newMap[p.id] = p;
      });

      const { pluginSettings } = get();
      for (const setting of pluginSettings) {
        if (!setting.isBuiltin && setting.path) {
          try {
            const customPlugin = await BackendAPI.scanCustomPlugin(setting.path);
            newMap[customPlugin.id] = customPlugin;
          } catch (err) {
            console.warn(`[AppStore] Failed to re-scan custom plugin at ${setting.path}:`, err);
          }
        }
      }
      
      set({ plugins: newMap });
      console.log("[AppStore] Plugins reloaded successfully (with custom merging).");
    } catch (err) {
      console.error("Failed to reload plugins:", err);
      throw err;
    }
  },
});
