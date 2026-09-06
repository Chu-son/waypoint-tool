import { StateCreator } from 'zustand';
import { AppState } from '../appStore';
import { PluginInstance, PluginSetting, PluginCustomLayer, AnnotationGroup, AnnotationObject, WaypointBaselineItem, GeneratorStash, Transform, WaypointNode, PipelineMetadata, InsertionTarget } from '../../types/store';
import { BackendAPI } from '../../api';
import { prepareLayersForExport, enrichInteractionDataWithCustomLayers } from '../../utils/mapRasterize';
import { applyGeneratorStash, computeGeneratorStash } from '../../utils/generatorStashUtils';
import { DEFAULT_ANNOTATION_COLOR } from '../../utils/colorPresets';
import { findNodeParentId } from '../../utils/treeUtils';
import { cloneSelection } from './historySlice';
import { v4 as uuidv4 } from 'uuid';

export type PluginPlacement =
  | { type: 'replace_ids'; ids: string[] }
  | { type: 'use_insertion_target' };

export interface ExecutePluginParams {
  plugin: PluginInstance;
  properties: Record<string, any>;
  interactionData?: Record<string, any>;
  existingExecutionId?: string;
  targetParentWaypointId?: string;
  targetCustomLayerId?: string;
  targetAnnotationGroupId?: string;
  idsToConsume?: string[];
  placement?: PluginPlacement;
  stashToApply?: GeneratorStash;
}

export type PluginSlice = {
  plugins: Record<string, PluginInstance>;
  pluginSettings: PluginSetting[];
  activePluginId: string | null;
  pluginInteractionData: Record<string, any>;
  pluginActiveProperties: Record<string, any>;
  activeInputIndex: number;
  activePipelineInputRef: { stepId: string; inputId: string } | null;

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
  setActivePipelineInputRef: (ref: { stepId: string; inputId: string } | null) => void;
  reloadPlugins: () => Promise<void>;

  executeGeneratorPlugin: (params: ExecutePluginParams) => Promise<{
    success: boolean;
    executionId: string;
    parentWaypointId?: string;
    customLayerIds: string[];
    annotationGroupId?: string;
    error?: string;
  }>;

  executePipeline: (params: {
    pipelinePlugin: PluginInstance;
    manualInputs: Record<string, Record<string, any>>;
    manualProperties: Record<string, Record<string, any>>;
    existingExecutionId?: string;
  }) => Promise<{
    success: boolean;
    pipelineExecutionId: string;
    error?: string;
  }>;

  detachFromPipeline: (params: {
    nodeId?: string;
    customLayerId?: string;
    annotationGroupId?: string;
  }) => void;

  setActivePathCalculatorPluginId: (pluginId: string | null) => void;
  setPathCalculatorParams: (params: Record<string, any>) => void;
  setAutoRecalculatePath: (enabled: boolean) => void;
  setCalculatedPathSegments: (segments: Array<Array<{ x: number; y: number }>> | null) => void;
  debouncedRecalculatePath: (delayMs?: number) => void;
  recalculatePath: (options?: { immediate?: boolean }) => Promise<void>;
};

let recalculateTimer: any = null;
let currentCalculationRequestId = 0;

function getPathValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const tokens = path.match(/[^.\[\]]+/g) || [];
  let current = obj;
  for (const token of tokens) {
    if (current == null) return undefined;
    if (current[token] !== undefined) {
      current = current[token];
    } else if (current.raw && current.raw[token] !== undefined) {
      current = current.raw[token];
    } else {
      return undefined;
    }
  }
  return current;
}

function resolveBindingExpression(
  expr: string,
  stepOutputs: Record<string, any>,
  manualInputs: Record<string, Record<string, any>>
): any {
  if (expr.startsWith('$steps.')) {
    const rest = expr.slice(7);
    const dotIndex = rest.indexOf('.');
    if (dotIndex === -1) {
      const stepId = rest;
      return stepOutputs[stepId]?.raw;
    }
    const stepId = rest.slice(0, dotIndex);
    const path = rest.slice(dotIndex + 1);

    const stepOut = stepOutputs[stepId];
    if (!stepOut) {
      throw new Error(`Referenced step "${stepId}" output was not found for binding "${expr}".`);
    }

    const val = getPathValue(stepOut, path);
    if (val === undefined) {
      if (path.startsWith('inputs.') || path.startsWith('inputs[')) {
        return undefined;
      }
      throw new Error(`Binding "${expr}" could not be resolved: path "${path}" in step "${stepId}" evaluated to undefined.`);
    }

    return val;
  }

  if (expr.startsWith('$inputs.')) {
    const key = expr.slice(8);
    for (const sInputs of Object.values(manualInputs)) {
      if (sInputs[key] !== undefined) {
        return sInputs[key];
      }
    }
    return undefined;
  }

  if (manualInputs[expr] !== undefined) {
    return manualInputs[expr];
  }
  for (const sInputs of Object.values(manualInputs)) {
    if (sInputs[expr] !== undefined) {
      return sInputs[expr];
    }
  }

  // If it looks like an identifier rather than a literal value, do not return it as a raw string if missing
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expr)) {
    return undefined;
  }

  return expr;
}

export const createPluginSlice: StateCreator<AppState, [], [], PluginSlice> = (set, get) => ({
  plugins: {},
  pluginSettings: [],
  activePluginId: null,
  pluginInteractionData: {},
  pluginActiveProperties: {},
  activeInputIndex: 0,
  activePipelineInputRef: null,

  activePathCalculatorPluginId: null,
  pathCalculatorParams: {},
  autoRecalculatePath: true,
  calculatedPathSegments: null,
  isCalculatingPath: false,

  setPlugins: (plugins) => {
    const merged: Record<string, PluginInstance> = { ...plugins };
    Object.values(plugins).forEach((p) => {
      if (p.manifest?.legacy_ids) {
        for (const legacyId of p.manifest.legacy_ids) {
          if (!merged[legacyId]) {
            merged[legacyId] = p;
          }
        }
      }
    });
    set({ plugins: merged });
  },
  
  setPluginSettings: (settings) => set({ pluginSettings: Array.isArray(settings) ? settings : [], isDirty: true }),
  
  updatePluginSetting: (id, updates) => set((state) => {
    const list = Array.isArray(state.pluginSettings) ? state.pluginSettings : [];
    const index = list.findIndex((p) => p.id === id);
    if (index >= 0) {
      return {
        pluginSettings: list.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        isDirty: true,
      };
    }
    const newSetting: PluginSetting = {
      id,
      enabled: true,
      order: list.length,
      isBuiltin: false,
      ...updates,
    };
    return {
      pluginSettings: [...list, newSetting],
      isDirty: true,
    };
  }),
  
  setActivePlugin: (pluginId) => set((state) => {
    if (state.activePluginId === pluginId) {
      return { isAnnotationEditMode: false, activePipelineInputRef: null };
    }
    const plugin = pluginId && state.plugins ? state.plugins[pluginId] : null;
    const isMapLayerGen = plugin?.manifest?.category === 'map_layer_generator';
    return {
      activePluginId: pluginId,
      pluginInteractionData: {},
      pluginActiveProperties: {},
      activeInputIndex: 0,
      activePipelineInputRef: null,
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
    activeInputIndex: 0,
    activePipelineInputRef: null,
  }),
  
  setPluginActiveProperties: (props) => set({ pluginActiveProperties: props }),
  
  setActiveInputIndex: (index) => set({ activeInputIndex: index }),

  setActivePipelineInputRef: (ref) => set({ activePipelineInputRef: ref }),

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
      stashToApply,
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
      if (key && interactionData[key] !== undefined && interactionData[key] !== null && interactionData[key] !== '') {
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
        const baselineWaypoints: WaypointBaselineItem[] = waypointItems.map((wp) => {
          let qx = wp.qx ?? 0,
            qy = wp.qy ?? 0,
            qz = wp.qz ?? 0,
            qw = wp.qw ?? 1;
          if (typeof wp.yaw === 'number' && typeof wp.qw !== 'number') {
            const halfYaw = wp.yaw / 2.0;
            qz = Math.sin(halfYaw);
            qw = Math.cos(halfYaw);
          }
          const transform: Transform = wp.transform
            ? { ...wp.transform }
            : {
                x: wp.x ?? 0,
                y: wp.y ?? 0,
                z: wp.z ?? 0,
                qx,
                qy,
                qz,
                qw,
              };
          return {
            transform,
            options: wp.options ? { ...wp.options } : undefined,
            name: wp.name,
          };
        });

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
            baseline_waypoints: baselineWaypoints,
          });
          resultingParentWaypointId = parentId;
        } else {
          // New parent generator node
          parentId = uuidv4();
          const placement: PluginPlacement = params.placement || (
            (idsToConsume && idsToConsume.length > 0)
              ? { type: 'replace_ids', ids: idsToConsume }
              : { type: 'use_insertion_target' }
          );

          let targetParentId: string | null | undefined = undefined;
          let targetIndex: number | undefined = undefined;

          if (placement.type === 'replace_ids' && placement.ids.length > 0) {
            const firstId = placement.ids[0];
            const currentNodes = get().nodes;
            const currentRootIds = get().rootNodeIds;
            const parentOfFirst = findNodeParentId(firstId, currentRootIds, currentNodes);
            targetParentId = parentOfFirst;
            const siblings = parentOfFirst ? (currentNodes[parentOfFirst]?.children_ids || []) : currentRootIds;
            const idx = siblings.indexOf(firstId);
            if (idx !== -1) {
              targetIndex = idx;
            }
            store.removeNodes(placement.ids);
          }

          const generatorNode: WaypointNode = {
            id: parentId,
            type: 'generator',
            name: waypointGroupName || plugin.manifest.name,
            plugin_id: plugin.id,
            source_execution_id: executionId,
            generator_params: finalContextData,
            plugin_data: waypointPluginData || rawResult.plugin_data,
            children_ids: [],
            baseline_waypoints: baselineWaypoints,
          };

          store.addNodes([generatorNode], targetParentId, targetIndex);
          resultingParentWaypointId = parentId;
        }

        // Apply stash if provided
        const waypointsToInstantiate = stashToApply
          ? applyGeneratorStash(waypointItems, stashToApply)
          : waypointItems;

        // Add child waypoint nodes in a single atomic batch
        const childNodes: WaypointNode[] = waypointsToInstantiate.map((wp) => {
          let qx = wp.qx ?? 0,
            qy = wp.qy ?? 0,
            qz = wp.qz ?? 0,
            qw = wp.qw ?? 1;
          if (typeof wp.yaw === 'number' && typeof wp.qw !== 'number') {
            const halfYaw = wp.yaw / 2.0;
            qz = Math.sin(halfYaw);
            qw = Math.cos(halfYaw);
          }

          return {
            id: uuidv4(),
            type: 'manual' as const,
            name: wp.name,
            transform: wp.transform || {
              x: wp.x ?? 0,
              y: wp.y ?? 0,
              z: wp.z ?? 0,
              qx,
              qy,
              qz,
              qw,
            },
            options: wp.options || {},
          };
        });

        if (childNodes.length > 0) {
          store.addNodes(childNodes, parentId);
        }
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

  executePipeline: async (params) => {
    const {
      pipelinePlugin,
      manualInputs,
      manualProperties,
      existingExecutionId,
    } = params;

    const recipe = pipelinePlugin.manifest?.pipeline;
    const steps = recipe?.steps || [];
    const pipelineExecutionId = existingExecutionId || uuidv4();
    const pipelineId = pipelinePlugin.id;

    if (steps.length === 0) {
      return {
        success: false,
        pipelineExecutionId,
        error: 'Pipeline contains no steps',
      };
    }

    // Capture initial state for rollback on failure
    const initialNodes = { ...get().nodes };
    const initialRootNodeIds = [...get().rootNodeIds];
    const initialSelectedNodeIds = [...get().selectedNodeIds];
    const initialSelection = cloneSelection(get().selection);
    const initialCustomLayers = structuredClone(get().customLayers ?? []);
    const initialAnnotationGroups = { ...get().annotationGroups };
    const initialAnnotationObjects = structuredClone(get().annotationObjects ?? {});
    const initialAnnotationOrder = [...(get().annotationOrder ?? [])];
    const initialRootAnnotationIds = [...(get().rootAnnotationIds ?? [])];
    const initialSelectedAnnotationIds = [...(get().selectedAnnotationIds ?? [])];
    const initialActiveCustomLayerId = get().activeCustomLayerId;
    const initialSelectedEditObjectId = get().selectedEditObjectId;
    const initialInsertionTarget: InsertionTarget | null = get().insertionTarget
      ? { parentId: get().insertionTarget!.parentId, index: get().insertionTarget!.index }
      : null;

    const initialHistoryDepth = get().historyTransactionDepth;
    const initialHistoryLength = get().historyPast.length;

    // Snapshot selected points at execution initiation so intermediate step mutations do not clobber them
    const initialSelectedPoints = initialSelectedNodeIds
      .map((id) => (get().nodes[id] || initialNodes[id])?.transform)
      .filter(Boolean);

    // Begin atomic transaction for the whole pipeline execution
    get().beginHistoryTransaction();

    const stepOutputs: Record<
      string,
      {
        inputs?: Record<string, any>;
        properties?: Record<string, any>;
        custom_layers: PluginCustomLayer[];
        custom_layer?: PluginCustomLayer;
        waypoints: any[];
        waypoint?: any;
        annotations: any[];
        annotation?: any;
        plugin_data?: any;
        raw: any;
      }
    > = {};

    const intermediateLayers: PluginCustomLayer[] = [];

    // Snapshot of previous inputs/properties for dirty check / skip optimization
    let previousInputsSnapshot: Record<string, Record<string, any>> | undefined;
    let previousPropertiesSnapshot: Record<string, Record<string, any>> | undefined;

    if (existingExecutionId) {
      const existingLayer = get().customLayers.find(
        (l) => l.pipeline_metadata?.pipeline_execution_id === existingExecutionId && l.pipeline_metadata?.pipeline_inputs
      );
      const existingNode = Object.values(get().nodes).find(
        (n) => n.pipeline_metadata?.pipeline_execution_id === existingExecutionId && n.pipeline_metadata?.pipeline_inputs
      );
      const existingGroup = Object.values(get().annotationGroups).find(
        (g) => g.pipeline_metadata?.pipeline_execution_id === existingExecutionId && g.pipeline_metadata?.pipeline_inputs
      );
      const metaWithSnapshots =
        existingLayer?.pipeline_metadata ||
        existingNode?.pipeline_metadata ||
        existingGroup?.pipeline_metadata;

      if (metaWithSnapshots) {
        previousInputsSnapshot = metaWithSnapshots.pipeline_inputs;
        previousPropertiesSnapshot = metaWithSnapshots.pipeline_properties;
      }
    }

    const dirtySteps = new Set<string>();

    try {
      for (const step of steps) {
        const stepId = step.step_id;
        const stepName = step.name || stepId;
        const targetPlugin = get().plugins[step.plugin_id];

        if (!targetPlugin) {
          throw new Error(`Plugin "${step.plugin_id}" for step "${stepId}" was not found.`);
        }

        const stepExecutionId = uuidv4();
        const pipelineMetadata: PipelineMetadata = {
          pipeline_id: pipelineId,
          pipeline_execution_id: pipelineExecutionId,
          step_id: stepId,
          step_execution_id: stepExecutionId,
          pipeline_inputs: manualInputs,
          pipeline_properties: manualProperties,
        };

        // 1. Prepare properties
        const stepProperties: Record<string, any> = {};
        for (const prop of targetPlugin.manifest?.properties || []) {
          if (prop.default !== undefined) {
            stepProperties[prop.name] = prop.default;
          }
        }
        if (manualProperties[stepId]) {
          Object.assign(stepProperties, manualProperties[stepId]);
        } else if (manualProperties[targetPlugin.id]) {
          Object.assign(stepProperties, manualProperties[targetPlugin.id]);
        }
        if (step.property_overrides) {
          Object.assign(stepProperties, step.property_overrides);
        }

        // 2. Prepare interactionData (inputs)
        const stepInteractionData: Record<string, any> = {};
        for (const inp of targetPlugin.manifest?.inputs || []) {
          const canonicalKey = inp.name || inp.id;
          if (inp.default !== undefined) {
            stepInteractionData[canonicalKey] = inp.default;
            if (inp.id) stepInteractionData[inp.id] = inp.default;
            if (inp.name) stepInteractionData[inp.name] = inp.default;
          }
        }
        if (manualInputs[stepId]) {
          Object.assign(stepInteractionData, manualInputs[stepId]);
        } else if (manualInputs[targetPlugin.id]) {
          Object.assign(stepInteractionData, manualInputs[targetPlugin.id]);
        }

        // 3. Inject bindings
        for (const [targetKey, expr] of Object.entries(step.bindings || {})) {
          const resolvedValue = resolveBindingExpression(expr, stepOutputs, manualInputs);
          if (targetKey.startsWith('inputs.')) {
            const rawKey = targetKey.slice(7);
            const matchingInp = targetPlugin.manifest?.inputs?.find(
              (i) => i.id === rawKey || i.name === rawKey
            );
            const canonicalKey = matchingInp ? (matchingInp.name || matchingInp.id) : rawKey;
            stepInteractionData[canonicalKey] = resolvedValue;
            stepInteractionData[rawKey] = resolvedValue;
          } else if (targetKey.startsWith('properties.')) {
            const key = targetKey.slice(11);
            stepProperties[key] = resolvedValue;
          } else {
            const matchingInp = targetPlugin.manifest?.inputs?.find(
              (i) => i.id === targetKey || i.name === targetKey
            );
            if (matchingInp) {
              const canonicalKey = matchingInp.name || matchingInp.id;
              stepInteractionData[canonicalKey] = resolvedValue;
              stepInteractionData[targetKey] = resolvedValue;
            } else {
              stepProperties[targetKey] = resolvedValue;
              stepInteractionData[targetKey] = resolvedValue;
            }
          }
        }

        // 4. Validate requirements
        const needsSelection = targetPlugin.manifest?.needs?.includes('selected_points');
        if (needsSelection && initialSelectedPoints.length === 0 && !existingExecutionId) {
          throw new Error(`Step "${stepId}" requires selecting waypoint(s) on the canvas first.`);
        }

        const contextData: any = {
          properties: stepProperties,
          interaction_data: {},
        };

        for (const inp of targetPlugin.manifest?.inputs || []) {
          const canonicalKey = inp.name || inp.id;
          const val =
            stepInteractionData[canonicalKey] !== undefined
              ? stepInteractionData[canonicalKey]
              : inp.id && stepInteractionData[inp.id] !== undefined
              ? stepInteractionData[inp.id]
              : inp.name && stepInteractionData[inp.name] !== undefined
              ? stepInteractionData[inp.name]
              : undefined;
          if (canonicalKey && val !== undefined && val !== null && val !== '') {
            contextData.interaction_data[canonicalKey] = val;
          }
        }

        if (needsSelection) {
          contextData.selected_points = initialSelectedPoints;
        }

        if (targetPlugin.manifest?.needs?.includes('robot_footprint')) {
          contextData.robot_footprint = get().robotFootprint;
        }

        // 5. Python interpreter path
        let pythonPathToUse = get().globalPythonPath?.trim() || 'python3';
        if (targetPlugin.manifest?.type === 'python') {
          const setting = get().pluginSettings.find((s) => s.id === targetPlugin.id);
          if (setting?.pythonOverridePath?.trim()) {
            pythonPathToUse = setting.pythonOverridePath.trim();
          }
        }

        // 6. Pass map layers and custom layers (including intermediate non-exported layers)
        const allAvailableCustomLayers = [...get().customLayers, ...intermediateLayers];
        const needsOccupancyGrid = targetPlugin.manifest?.needs?.some(
          (n) => n === 'occupancy_grid' || n === 'occupancy_grid_in_region'
        );
        const layersToPass = needsOccupancyGrid
          ? await prepareLayersForExport(get().mapLayers, allAvailableCustomLayers)
          : undefined;

        const baseRes = get().mapLayers.find((l) => l.visible)?.info?.resolution || 0.05;
        const enrichedInteractionData = await enrichInteractionDataWithCustomLayers(
          targetPlugin.manifest?.inputs,
          contextData.interaction_data || {},
          allAvailableCustomLayers,
          baseRes,
          get().annotationObjects
        );

        const finalContextData = {
          ...contextData,
          interaction_data: enrichedInteractionData,
        };

        // Check dirty status for skip optimization
        let dependsOnDirtyStep = false;
        for (const expr of Object.values(step.bindings || {})) {
          const match = expr.match(/^\$steps\.([a-zA-Z0-9_-]+)/);
          if (match && dirtySteps.has(match[1])) {
            dependsOnDirtyStep = true;
            break;
          }
        }

        const currentStepInputs = manualInputs[stepId] || manualInputs[targetPlugin.id] || {};
        const prevStepInputs = previousInputsSnapshot?.[stepId] || previousInputsSnapshot?.[targetPlugin.id] || {};
        const inputsChanged = JSON.stringify(currentStepInputs) !== JSON.stringify(prevStepInputs);

        const currentStepProps = manualProperties[stepId] || manualProperties[targetPlugin.id] || {};
        const prevStepProps = previousPropertiesSnapshot?.[stepId] || previousPropertiesSnapshot?.[targetPlugin.id] || {};
        const propertiesChanged = JSON.stringify(currentStepProps) !== JSON.stringify(prevStepProps);

        const existingStepLayers = existingExecutionId
          ? (get().customLayers.filter(
              (l): l is PluginCustomLayer =>
                l.type === 'plugin' &&
                l.pipeline_metadata?.pipeline_execution_id === existingExecutionId &&
                l.pipeline_metadata?.step_id === stepId
            ))
          : [];

        const existingParent = existingExecutionId
          ? Object.values(get().nodes).find(
              (n) =>
                n.type === 'generator' &&
                n.pipeline_metadata?.pipeline_execution_id === existingExecutionId &&
                n.pipeline_metadata?.step_id === stepId
            )
          : undefined;

        const existingGroup = existingExecutionId
          ? Object.values(get().annotationGroups).find(
              (g) =>
                g.pipeline_metadata?.pipeline_execution_id === existingExecutionId &&
                g.pipeline_metadata?.step_id === stepId
            )
          : undefined;

        const hasExistingArtifacts = Boolean(
          existingStepLayers.length > 0 || existingParent || existingGroup
        );

        const isStepDirty =
          !existingExecutionId ||
          !previousInputsSnapshot ||
          !hasExistingArtifacts ||
          dependsOnDirtyStep ||
          inputsChanged ||
          propertiesChanged;

        const exportsDef = step.exports;
        const shouldExportLayers = exportsDef?.custom_layers !== false;
        const shouldExportWaypoints = exportsDef?.waypoints !== false;
        const shouldExportAnnotations = exportsDef?.annotations !== false;

        let rawResult: any = null;
        let constructedLayers: PluginCustomLayer[] = [];
        let rawWaypoints: any[] = [];
        let waypointPluginData: Record<string, any> | undefined = undefined;
        let waypointGroupName: string | undefined = undefined;
        let rawAnnotations: any[] = [];
        let annotationPluginData: Record<string, any> | undefined = undefined;
        let annotationGroupName: string | undefined = undefined;

        if (!isStepDirty) {
          console.info(
            `[PIPELINE] Step "${stepId}" is clean. Skipping backend execution and reusing cached outputs.`
          );

          if (existingStepLayers.length > 0) {
            constructedLayers = existingStepLayers.map((l) => ({
              ...l,
              params: stepProperties,
              interaction_data: finalContextData.interaction_data,
              pipeline_metadata: pipelineMetadata,
            }));
          }

          if (existingParent) {
            waypointPluginData = existingParent.plugin_data;
            waypointGroupName = existingParent.name;
            if (existingParent.children_ids && existingParent.children_ids.length > 0) {
              rawWaypoints = existingParent.children_ids
                .map((cid) => get().nodes[cid])
                .filter(Boolean)
                .map((n) => ({
                  name: n.name,
                  transform: n.transform,
                  options: n.options,
                }));
            } else if (existingParent.baseline_waypoints) {
              rawWaypoints = existingParent.baseline_waypoints.map((bw) => ({
                name: bw.name,
                transform: bw.transform,
                options: bw.options,
              }));
            }
          }

          if (existingGroup) {
            annotationPluginData = existingGroup.plugin_data;
            annotationGroupName = existingGroup.name;
            if (existingGroup.children_ids) {
              rawAnnotations = existingGroup.children_ids
                .map((cid) => get().annotationObjects[cid])
                .filter(Boolean);
            }
          }
        } else {
          dirtySteps.add(stepId);

          // 7. Run plugin backend API
          rawResult = await BackendAPI.runPlugin(
            targetPlugin,
            finalContextData,
            pythonPathToUse,
            layersToPass
          );

          // 8. Process outputs
          // Custom Layers output
          let rawLayers: any[] = [];
          if (rawResult?.custom_layers && Array.isArray(rawResult.custom_layers)) {
            rawLayers = rawResult.custom_layers;
          } else if (rawResult?.image_base64 && rawResult?.info) {
            rawLayers = [rawResult];
          }

          constructedLayers = rawLayers.map((layerItem, idx) => {
            return {
              id: layerItem.id || uuidv4(),
              name: layerItem.name || `${stepName || targetPlugin.manifest.name} Layer`,
              type: 'plugin' as const,
              plugin_id: targetPlugin.id,
              source_execution_id: stepExecutionId,
              plugin_data: layerItem.plugin_data || rawResult.plugin_data,
              params: stepProperties,
              interaction_data: finalContextData.interaction_data,
              image_base64: layerItem.image_base64,
              info: layerItem.info,
              visible: true,
              opacity: layerItem.opacity ?? 0.7,
              z_index: get().customLayers.length + idx,
              blend_mode: layerItem.blend_mode || 'overwrite',
              is_reference: false,
              pipeline_metadata: pipelineMetadata,
            };
          });

          // Waypoints output
          if (rawResult?.waypoints) {
            if (Array.isArray(rawResult.waypoints)) {
              rawWaypoints = rawResult.waypoints;
            } else if (rawResult.waypoints.items && Array.isArray(rawResult.waypoints.items)) {
              rawWaypoints = rawResult.waypoints.items;
              waypointPluginData = rawResult.waypoints.plugin_data;
              waypointGroupName = rawResult.waypoints.name;
            }
          } else if (
            Array.isArray(rawResult) &&
            rawResult.length > 0 &&
            (rawResult[0].transform || rawResult[0].x !== undefined)
          ) {
            rawWaypoints = rawResult;
          }

          // Annotations output
          if (rawResult?.annotations) {
            if (Array.isArray(rawResult.annotations)) {
              rawAnnotations = rawResult.annotations;
            } else if (rawResult.annotations.items && Array.isArray(rawResult.annotations.items)) {
              rawAnnotations = rawResult.annotations.items;
              annotationPluginData = rawResult.annotations.plugin_data;
              annotationGroupName = rawResult.annotations.name;
            }
          }
        }

        // Store outputs in memory context for subsequent steps (with convenient singular aliases)
        stepOutputs[stepId] = {
          inputs: finalContextData.interaction_data,
          properties: stepProperties,
          custom_layers: constructedLayers,
          custom_layer: constructedLayers[0],
          waypoints: rawWaypoints,
          waypoint: rawWaypoints[0],
          annotations: rawAnnotations,
          annotation: rawAnnotations[0],
          plugin_data: rawResult?.plugin_data || waypointPluginData || annotationPluginData,
          raw: rawResult,
        };

        if (!shouldExportLayers) {
          intermediateLayers.push(...constructedLayers);
        }

        // 9. Mutate store inside runInHistoryTransaction
        get().runInHistoryTransaction(() => {
          const store = get();

          if (!isStepDirty) {
            // Re-apply updated pipeline metadata snapshot without replacing items
            if (shouldExportLayers && existingStepLayers.length > 0) {
              existingStepLayers.forEach((l) => {
                store.updateCustomLayer(l.id, { pipeline_metadata: pipelineMetadata });
              });
            }
            if (shouldExportWaypoints && existingParent) {
              store.updateNode(existingParent.id, { pipeline_metadata: pipelineMetadata });
            }
            if (shouldExportAnnotations && existingGroup) {
              store.updateAnnotationGroup(existingGroup.id, { pipeline_metadata: pipelineMetadata });
            }
            return;
          }

          // Custom layers export
          if (shouldExportLayers && constructedLayers.length > 0) {
            const existingStepLayers = existingExecutionId
              ? store.customLayers.filter(
                  (l) =>
                    l.type === 'plugin' &&
                    l.pipeline_metadata?.pipeline_execution_id === existingExecutionId &&
                    l.pipeline_metadata?.step_id === stepId
                )
              : [];

            constructedLayers.forEach((constructedLayer, idx) => {
              const existingLayer = existingStepLayers[idx];
              if (existingLayer) {
                store.updateCustomLayer(existingLayer.id, {
                  ...constructedLayer,
                  id: existingLayer.id,
                });
                constructedLayer.id = existingLayer.id;
              } else {
                store.addPluginCustomLayer(constructedLayer);
              }
            });
          }

          // Waypoints export
          if (shouldExportWaypoints && rawWaypoints.length > 0) {
            let targetParentId: string | undefined = undefined;
            if (existingExecutionId) {
              const found = Object.values(store.nodes).find(
                (n) =>
                  n.type === 'generator' &&
                  n.pipeline_metadata?.pipeline_execution_id === existingExecutionId &&
                  n.pipeline_metadata?.step_id === stepId
              );
              if (found) targetParentId = found.id;
            }

            let stashToApply: GeneratorStash | undefined = undefined;
            if (targetParentId && store.nodes[targetParentId]) {
              const existingParent = store.nodes[targetParentId];
              const stash = computeGeneratorStash(existingParent, store.nodes);
              if (Object.keys(stash).length > 0) {
                stashToApply = stash;
              }
            }

            const baselineWaypoints: WaypointBaselineItem[] = rawWaypoints.map((wp) => {
              let qx = wp.qx ?? 0,
                qy = wp.qy ?? 0,
                qz = wp.qz ?? 0,
                qw = wp.qw ?? 1;
              if (typeof wp.yaw === 'number' && typeof wp.qw !== 'number') {
                const halfYaw = wp.yaw / 2.0;
                qz = Math.sin(halfYaw);
                qw = Math.cos(halfYaw);
              }
              const transform: Transform = wp.transform
                ? { ...wp.transform }
                : {
                    x: wp.x ?? 0,
                    y: wp.y ?? 0,
                    z: wp.z ?? 0,
                    qx,
                    qy,
                    qz,
                    qw,
                  };
              return {
                transform,
                options: wp.options ? { ...wp.options } : undefined,
                name: wp.name,
              };
            });

            const waypointsToInstantiate = stashToApply
              ? applyGeneratorStash(rawWaypoints, stashToApply)
              : rawWaypoints;

            let parentId = targetParentId;
            if (parentId && store.nodes[parentId]) {
              const existingParent = store.nodes[parentId];
              if (existingParent.children_ids && existingParent.children_ids.length > 0) {
                store.removeNodes(existingParent.children_ids);
              }
              store.updateNode(parentId, {
                plugin_id: targetPlugin.id,
                source_execution_id: stepExecutionId,
                generator_params: finalContextData,
                plugin_data: waypointPluginData || rawResult.plugin_data || existingParent.plugin_data,
                name: waypointGroupName || existingParent.name,
                baseline_waypoints: baselineWaypoints,
                pipeline_metadata: pipelineMetadata,
              });
            } else {
              parentId = uuidv4();
              const generatorNode: WaypointNode = {
                id: parentId,
                type: 'generator',
                name: waypointGroupName || stepName || targetPlugin.manifest.name,
                plugin_id: targetPlugin.id,
                source_execution_id: stepExecutionId,
                generator_params: finalContextData,
                plugin_data: waypointPluginData || rawResult.plugin_data,
                children_ids: [],
                baseline_waypoints: baselineWaypoints,
                pipeline_metadata: pipelineMetadata,
              };
              store.addNodes([generatorNode]);
            }

            const childNodes: WaypointNode[] = waypointsToInstantiate.map((wp) => {
              let qx = wp.qx ?? 0,
                qy = wp.qy ?? 0,
                qz = wp.qz ?? 0,
                qw = wp.qw ?? 1;
              if (typeof wp.yaw === 'number' && typeof wp.qw !== 'number') {
                const halfYaw = wp.yaw / 2.0;
                qz = Math.sin(halfYaw);
                qw = Math.cos(halfYaw);
              }
              return {
                id: uuidv4(),
                type: 'manual' as const,
                name: wp.name,
                transform: wp.transform || {
                  x: wp.x ?? 0,
                  y: wp.y ?? 0,
                  z: wp.z ?? 0,
                  qx,
                  qy,
                  qz,
                  qw,
                },
                options: wp.options || {},
                pipeline_metadata: pipelineMetadata,
              };
            });
            if (childNodes.length > 0) {
              store.addNodes(childNodes, parentId);
            }
          }

          // Annotations export
          if (shouldExportAnnotations && rawAnnotations.length > 0) {
            let targetGroupId: string | undefined = undefined;
            if (existingExecutionId) {
              const found = Object.values(store.annotationGroups).find(
                (g) =>
                  g.pipeline_metadata?.pipeline_execution_id === existingExecutionId &&
                  g.pipeline_metadata?.step_id === stepId
              );
              if (found) targetGroupId = found.id;
            }

            let groupId = targetGroupId;
            if (groupId && store.annotationGroups[groupId]) {
              const existingGroup = store.annotationGroups[groupId];
              if (existingGroup.children_ids && existingGroup.children_ids.length > 0) {
                store.removeAnnotationObjects(existingGroup.children_ids);
              }
              const newChildrenIds: string[] = [];
              rawAnnotations.forEach((anno) => {
                const childId = anno.id || uuidv4();
                const childObj: AnnotationObject = {
                  id: childId,
                  name: anno.name || `${existingGroup.name} Item`,
                  type: anno.type || 'point',
                  visible: anno.visible ?? true,
                  labelVisible: anno.labelVisible ?? true,
                  color: anno.color || existingGroup.color || DEFAULT_ANNOTATION_COLOR,
                  group_id: groupId,
                  source_execution_id: stepExecutionId,
                  plugin_data: anno.plugin_data,
                  pipeline_metadata: pipelineMetadata,
                  ...(anno as any),
                };
                store.addAnnotationObject(childObj, groupId);
                newChildrenIds.push(childId);
              });

              store.updateAnnotationGroup(groupId, {
                name: annotationGroupName || existingGroup.name,
                plugin_id: targetPlugin.id,
                source_execution_id: stepExecutionId,
                generator_params: finalContextData,
                plugin_data: annotationPluginData || rawResult.plugin_data || existingGroup.plugin_data,
                children_ids: newChildrenIds,
                pipeline_metadata: pipelineMetadata,
              });
            } else {
              groupId = uuidv4();
              const newGroup: AnnotationGroup = {
                id: groupId,
                name: annotationGroupName || `${stepName || targetPlugin.manifest.name} Annotations`,
                type: 'generator',
                visible: true,
                color: DEFAULT_ANNOTATION_COLOR,
                children_ids: [],
                plugin_id: targetPlugin.id,
                source_execution_id: stepExecutionId,
                generator_params: finalContextData,
                plugin_data: annotationPluginData || rawResult.plugin_data,
                pipeline_metadata: pipelineMetadata,
              };
              store.addAnnotationGroup(newGroup);

              rawAnnotations.forEach((anno) => {
                const childId = anno.id || uuidv4();
                const childObj: AnnotationObject = {
                  id: childId,
                  name: anno.name || 'Annotation',
                  type: anno.type || 'point',
                  visible: anno.visible ?? true,
                  labelVisible: anno.labelVisible ?? true,
                  color: anno.color || DEFAULT_ANNOTATION_COLOR,
                  group_id: groupId,
                  source_execution_id: stepExecutionId,
                  plugin_data: anno.plugin_data,
                  pipeline_metadata: pipelineMetadata,
                  ...(anno as any),
                };
                store.addAnnotationObject(childObj, groupId);
              });
            }
          }
        });
      }

      get().endHistoryTransaction();
      return { success: true, pipelineExecutionId };
    } catch (err: any) {
      // Roll back cleanly
      set({
        nodes: initialNodes,
        rootNodeIds: initialRootNodeIds,
        selectedNodeIds: initialSelectedNodeIds,
        selection: initialSelection,
        customLayers: initialCustomLayers,
        annotationGroups: initialAnnotationGroups,
        annotationObjects: initialAnnotationObjects,
        annotationOrder: initialAnnotationOrder,
        rootAnnotationIds: initialRootAnnotationIds,
        selectedAnnotationIds: initialSelectedAnnotationIds,
        activeCustomLayerId: initialActiveCustomLayerId,
        selectedEditObjectId: initialSelectedEditObjectId,
        insertionTarget: initialInsertionTarget,
      });
      set((state) => ({
        historyPast: state.historyPast.slice(0, initialHistoryLength),
        historyTransactionDepth: initialHistoryDepth,
      }));

      return {
        success: false,
        pipelineExecutionId,
        error: err?.message || String(err),
      };
    }
  },

  detachFromPipeline: (params) => {
    const { nodeId, customLayerId, annotationGroupId } = params;
    get().runInHistoryTransaction(() => {
      const store = get();
      if (nodeId && store.nodes[nodeId]) {
        const node = store.nodes[nodeId];
        store.updateNode(nodeId, { pipeline_metadata: undefined });
        if (node.children_ids) {
          node.children_ids.forEach((childId) => {
            if (store.nodes[childId]) {
              store.updateNode(childId, { pipeline_metadata: undefined });
            }
          });
        }
      }
      if (customLayerId) {
        const layer = store.customLayers.find((l) => l.id === customLayerId);
        if (layer) {
          store.updateCustomLayer(customLayerId, { pipeline_metadata: undefined });
        }
      }
      if (annotationGroupId && store.annotationGroups[annotationGroupId]) {
        const group = store.annotationGroups[annotationGroupId];
        store.updateAnnotationGroup(annotationGroupId, { pipeline_metadata: undefined });
        if (group.children_ids) {
          group.children_ids.forEach((childId) => {
            if (store.annotationObjects[childId]) {
              store.updateAnnotationObject(childId, { pipeline_metadata: undefined });
            }
          });
        }
      }
    });
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
      
      // Alias resolution for legacy_ids
      Object.values(newMap).forEach((p) => {
        if (p.manifest?.legacy_ids) {
          for (const legacyId of p.manifest.legacy_ids) {
            if (!newMap[legacyId]) {
              newMap[legacyId] = p;
            }
          }
        }
      });

      set({ plugins: newMap });
      console.log("[AppStore] Plugins reloaded successfully (with custom merging).");
    } catch (err) {
      console.error("Failed to reload plugins:", err);
      throw err;
    }
  },
});
