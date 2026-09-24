import { StateCreator } from 'zustand';
import type { AppState } from '../appStore';
import { BackendAPI } from '../../api';
import { prepareLayersForExport } from '../../services/mapRasterize';
import { resolvePythonPath } from '../../utils/pythonPath';
import { getFlattenedWaypointIds } from '../../utils/treeUtils';

export type PathSegments = Array<Array<{ x: number; y: number }>>;

/**
 * Optional "path calculator" plugin that routes between consecutive waypoints
 * (e.g. obstacle-avoiding paths). The result is drawn by PathLayer instead of straight lines.
 */
export type PathCalculatorSlice = {
  activePathCalculatorPluginId: string | null;
  pathCalculatorParams: Record<string, any>;
  autoRecalculatePath: boolean;
  calculatedPathSegments: PathSegments | null;
  isCalculatingPath: boolean;

  setActivePathCalculatorPluginId: (pluginId: string | null) => void;
  setPathCalculatorParams: (params: Record<string, any>) => void;
  setAutoRecalculatePath: (enabled: boolean) => void;
  setCalculatedPathSegments: (segments: PathSegments | null) => void;
  debouncedRecalculatePath: (delayMs?: number) => void;
  recalculatePath: (options?: { immediate?: boolean }) => Promise<void>;
};

const LOADING_TASK_ID = 'path-calc';

export const createPathCalculatorSlice: StateCreator<AppState, [], [], PathCalculatorSlice> = (set, get) => {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  // Only the most recent request may write its result (older in-flight runs are discarded).
  let latestRequestId = 0;

  const cancelPending = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const clearPath = () => {
    set({ calculatedPathSegments: null, isCalculatingPath: false });
    get().stopLoading(LOADING_TASK_ID);
  };

  return {
    activePathCalculatorPluginId: null,
    pathCalculatorParams: {},
    autoRecalculatePath: true,
    calculatedPathSegments: null,
    isCalculatingPath: false,

    setActivePathCalculatorPluginId: (pluginId) => {
      set({ activePathCalculatorPluginId: pluginId, isDirty: true });
      if (!pluginId) {
        set({ calculatedPathSegments: null, isCalculatingPath: false });
      } else if (get().autoRecalculatePath) {
        void get().recalculatePath({ immediate: true });
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
      cancelPending();
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void get().recalculatePath({ immediate: true });
      }, delayMs);
    },

    recalculatePath: async (options) => {
      if (!options?.immediate) {
        get().debouncedRecalculatePath(200);
        return;
      }
      cancelPending();

      const requestId = ++latestRequestId;
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

      const plugin = activePathCalculatorPluginId ? plugins[activePathCalculatorPluginId] : undefined;
      if (!plugin) {
        clearPath();
        return;
      }

      // Canonical DFS order (docs/ARCHITECTURE.md §5.2), so waypoints inside groups are included.
      const waypoints = getFlattenedWaypointIds(rootNodeIds, nodes)
        .map((id) => nodes[id]?.transform)
        .filter((t): t is NonNullable<typeof t> => !!t);

      if (waypoints.length < 2) {
        clearPath();
        return;
      }

      set({ isCalculatingPath: true });
      get().startLoading({
        id: LOADING_TASK_ID,
        message: '経路を計算中...',
        detail: plugin.manifest.name || plugin.id,
        blocking: false,
      });

      try {
        const contextData: Record<string, unknown> = { waypoints, properties: pathCalculatorParams };
        if (plugin.manifest.needs?.includes('robot_footprint')) {
          contextData.robot_footprint = robotFootprint;
        }

        const needsOccupancyGrid = plugin.manifest.needs?.some(
          (n) => n === 'occupancy_grid' || n === 'occupancy_grid_in_region',
        );
        const layersToPass = needsOccupancyGrid
          ? await prepareLayersForExport(mapLayers || [], customLayers || [])
          : undefined;

        const result = await BackendAPI.runPlugin(
          plugin,
          contextData,
          resolvePythonPath(plugin, pluginSettings, globalPythonPath),
          layersToPass,
        );

        if (requestId !== latestRequestId) return;

        if (result && Array.isArray(result.segments)) {
          set({ calculatedPathSegments: result.segments, isCalculatingPath: false });
        } else if (Array.isArray(result)) {
          // Flat list of points forming a single segment
          set({ calculatedPathSegments: [result], isCalculatingPath: false });
        } else {
          console.warn('[recalculatePath] Unexpected result format from path calculator:', result);
          set({ calculatedPathSegments: null, isCalculatingPath: false });
        }
      } catch (err) {
        if (requestId === latestRequestId) {
          console.error('[recalculatePath] Failed to calculate path:', err);
          set({ calculatedPathSegments: null, isCalculatingPath: false });
        }
      } finally {
        if (requestId === latestRequestId) {
          get().stopLoading(LOADING_TASK_ID);
        }
      }
    },
  };
};
