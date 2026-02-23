import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WaypointNode, ProjectMapLayer, OptionsSchema, PluginInstance, ExportTemplate } from '../types/store';
import { v4 as uuidv4 } from 'uuid';

export type AppState = {
  // App State
  rootNodeIds: string[];
  nodes: Record<string, WaypointNode>;
  selectedNodeIds: string[];
  activeTool: 'select' | 'add_point' | 'add_generator';
  
  isSidebarOpen: boolean;
  mouseCenteredZoom: boolean;
  defaultMapOpacity: number; // Changed from 0.8
  
  plugins: Record<string, PluginInstance>;
  pluginSettings: import('../types/store').PluginSetting[];
  activePluginId: string | null;
  pluginInteractionData: Record<string, any>;
  
  // Maps & Layers
  mapLayers: ProjectMapLayer[];
  lastDirectory: string | null;

  optionsSchema: OptionsSchema | null;
  exportTemplates: ExportTemplate[];
  globalPythonPath: string;
  
  visibleAttributes: string[];
  indexStartIndex: 0 | 1; // 0 or 1 for indexing
  
  isDirty: boolean; // Tracks unsaved changes

  // View Settings
  showPaths: boolean;
  showGrid: boolean;
  shouldFitToMaps: number; // timestamp trigger
  toolPanelMaxColumns: number;

  // Methods
  addNode: (node: WaypointNode, parentId?: string) => void;
  updateNode: (id: string, updates: Partial<WaypointNode>) => void;
  removeNodes: (ids: string[]) => void;
  reorderNodes: (fromIndex: number, toIndex: number) => void;
  selectNodes: (ids: string[], multi?: boolean) => void;
  setActiveTool: (tool: AppState['activeTool']) => void;
  setMapLayers: (layers: ProjectMapLayer[]) => void;
  addMapLayer: (name: string, info: any, base64: string, width: number, height: number) => void;
  updateMapLayer: (id: string, updates: Partial<ProjectMapLayer>) => void;
  removeMapLayer: (id: string) => void;
  reorderMapLayers: (fromIndex: number, toIndex: number) => void;
  setLastDirectory: (dir: string | null) => void;
  setGlobalPythonPath: (path: string) => void;
  setOptionsSchema: (schema: OptionsSchema) => void;
  toggleAttributeVisibility: (attr: string) => void;
  setIndexStartIndex: (index: 0 | 1) => void;
  setIsDirty: (dirty: boolean) => void;
  setProjectData: (data: { rootNodeIds: string[], nodes: Record<string, WaypointNode>, mapLayers?: ProjectMapLayer[] }) => void;
  
  setShowPaths: (show: boolean) => void;
  setShowGrid: (show: boolean) => void;
  
  addExportTemplate: (template: ExportTemplate) => void;
  updateExportTemplate: (id: string, updates: Partial<ExportTemplate>) => void;
  removeExportTemplate: (id: string) => void;
  
  // Plugin Methods
  setPlugins: (plugins: Record<string, PluginInstance>) => void;
  setPluginSettings: (settings: import('../types/store').PluginSetting[]) => void;
  updatePluginSetting: (id: string, updates: Partial<import('../types/store').PluginSetting>) => void;
  setActivePlugin: (pluginId: string | null) => void;
  updatePluginInteractionData: (inputId: string, data: any) => void;
  clearPluginInteractionData: () => void;
  setToolPanelMaxColumns: (max: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      nodes: {},
      rootNodeIds: [],
      selectedNodeIds: [],
      activeTool: 'select',
      
      isSidebarOpen: true,
      mouseCenteredZoom: true,
      defaultMapOpacity: 0.5, // Changed from 0.8
      
      plugins: {},
      pluginSettings: [],
      activePluginId: null,
      pluginInteractionData: {},
      
      // Maps & Layers
      mapLayers: [],
      lastDirectory: null,

      optionsSchema: null,
      exportTemplates: [],
      globalPythonPath: 'python',
      visibleAttributes: [],
      indexStartIndex: 0,
      isDirty: false,
      
      showPaths: true,
      showGrid: true,
      shouldFitToMaps: 0,
      toolPanelMaxColumns: 1,

      // Actions
      setDirty: (dirty: boolean) => set({ isDirty: dirty }), // --- Actions ---

      toggleAttributeVisibility: (attr: string) => set((state) => {
        const next = state.visibleAttributes.includes(attr) 
          ? state.visibleAttributes.filter(a => a !== attr)
          : [...state.visibleAttributes, attr];
        return { visibleAttributes: next, isDirty: true };
      }),

      setShowPaths: (show: boolean) => set({ showPaths: show }),
      setShowGrid: (show: boolean) => set({ showGrid: show }),

      setMapLayers: (layers: ProjectMapLayer[]) => set({ mapLayers: layers, isDirty: true }),
      setIndexStartIndex: (index: 0 | 1) => set({ indexStartIndex: index, isDirty: true }),
      
      addMapLayer: (name: string, info: any, base64: string, width: number, height: number) => set((state) => {
        const newLayer: ProjectMapLayer = {
          id: uuidv4(),
          name,
          visible: true,
          opacity: state.defaultMapOpacity,
          image_base64: base64,
          info: info,
          width,
          height,
          z_index: state.mapLayers.length,
        };
        return { mapLayers: [newLayer, ...state.mapLayers], isDirty: true };
      }),

      updateMapLayer: (id: string, updates: Partial<ProjectMapLayer>) => set((state) => ({
        mapLayers: state.mapLayers.map(l => l.id === id ? { ...l, ...updates } : l),
        isDirty: true
      })),

      removeMapLayer: (id: string) => set((state) => ({
        mapLayers: state.mapLayers.filter(l => l.id !== id),
        isDirty: true
      })),

      reorderMapLayers: (fromIndex: number, toIndex: number) => set((state) => {
        const layers = [...state.mapLayers];
        const [moved] = layers.splice(fromIndex, 1);
        layers.splice(toIndex, 0, moved);
        return { mapLayers: layers, isDirty: true };
      }),

      setLastDirectory: (dir: string | null) => set({ lastDirectory: dir }),
      setGlobalPythonPath: (path: string) => set({ globalPythonPath: path, isDirty: true }),

      setOptionsSchema: (schema: OptionsSchema) => set({ optionsSchema: schema, isDirty: true }),
      
      addExportTemplate: (template: ExportTemplate) => set((state) => ({
        exportTemplates: [...state.exportTemplates, template],
        isDirty: true
      })),
      
      updateExportTemplate: (id: string, updates: Partial<ExportTemplate>) => set((state) => ({
        exportTemplates: state.exportTemplates.map(t => t.id === id ? { ...t, ...updates } : t),
        isDirty: true
      })),
      
      removeExportTemplate: (id: string) => set((state) => ({
        exportTemplates: state.exportTemplates.filter(t => t.id !== id),
        isDirty: true
      })),

      setIsDirty: (dirty: boolean) => set({ isDirty: dirty }),

      setActiveTool: (tool: AppState['activeTool']) => set({ activeTool: tool }),
      selectNodes: (ids: string[], multi = false) => set((state) => {
        if (multi) {
          // Toggle logic: if already selected, remove it; otherwise add it.
          const current = new Set(state.selectedNodeIds);
          ids.forEach(id => {
            if (current.has(id)) current.delete(id);
            else current.add(id);
          });
          return { selectedNodeIds: Array.from(current) };
        }
        return { selectedNodeIds: ids };
      }),

      setProjectData: (data: any) =>
        set((state) => ({
          rootNodeIds: data.root_node_ids || data.rootNodeIds || [],
          nodes: data.nodes || {},
          selectedNodeIds: [],
          mapLayers: data.map_layers || data.mapLayers || state.mapLayers, // Keep existing if not in project
          exportTemplates: data.export_templates || state.exportTemplates,
          indexStartIndex: data.index_start_index ?? state.indexStartIndex,
          isDirty: false, // Reset dirty state on load
        })),
        
      setPlugins: (plugins) => set({ plugins }),
      setPluginSettings: (settings) => set({ pluginSettings: settings, isDirty: true }),
      updatePluginSetting: (id, updates) => set((state) => ({
        pluginSettings: state.pluginSettings.map(p => p.id === id ? { ...p, ...updates } : p),
        isDirty: true
      })),
      
      setActivePlugin: (pluginId) => set({ activePluginId: pluginId, pluginInteractionData: {} }),
      
      updatePluginInteractionData: (inputId, data) => 
        set((state) => ({
          pluginInteractionData: {
            ...state.pluginInteractionData,
            [inputId]: data
          }
        })),
        
      clearPluginInteractionData: () => set({ pluginInteractionData: {} }),
      setToolPanelMaxColumns: (max) => set({ toolPanelMaxColumns: max, isDirty: true }),

      addNode: (node: WaypointNode, parentId?: string) => set((state) => {
        const newNodes = { ...state.nodes, [node.id]: node };
        let newRootIds = [...state.rootNodeIds];
        
        if (parentId && newNodes[parentId]) {
          const parent = newNodes[parentId];
          parent.children_ids = [...(parent.children_ids || []), node.id];
        } else {
          newRootIds.push(node.id);
        }
        
        return { nodes: newNodes, rootNodeIds: newRootIds, isDirty: true };
      }),

      updateNode: (id: string, updates: Partial<WaypointNode>) => set((state) => ({
        nodes: {
          ...state.nodes,
          [id]: { ...state.nodes[id], ...updates }
        },
        isDirty: true
      })),

      reorderNodes: (fromIndex: number, toIndex: number) => set((state) => {
        const newRootIds = [...state.rootNodeIds];
        const [moved] = newRootIds.splice(fromIndex, 1);
        newRootIds.splice(toIndex, 0, moved);
        return { rootNodeIds: newRootIds, isDirty: true };
      }),

      removeNodes: (ids: string[]) => set((state) => {
        const newNodes = { ...state.nodes };
        let newRootIds = [...state.rootNodeIds];
        
        // 削除対象となるすべてのID（自身＋すべての子孫）を Set に収集する再帰的トラバーサル・ヘルパー。
        // アルゴリズム背景:
        // - ツリー構造（親が子のID配列を持つ）において、親ノードを削除した際に子が孤立し、
        //   存在しない親を参照し続けるデータ不整合（メモリリーク/UI上の幽霊ノード）を防ぐため、
        //   指定されたID群から子を再帰的に手繰り寄せ一括で削除キューに入れます。
        const idsToRemove = new Set<string>();
        const traverseIds = (id: string) => {
          if (!idsToRemove.has(id)) {
            idsToRemove.add(id);
            const node = newNodes[id];
            if (node?.children_ids) {
              node.children_ids.forEach(traverseIds);
            }
          }
        };
        ids.forEach(traverseIds);
        
        idsToRemove.forEach(id => {
          delete newNodes[id];
          newRootIds = newRootIds.filter(rid => rid !== id);
          
          // Remove from any parent's children array
          Object.values(newNodes).forEach(node => {
            if (node.children_ids) {
              node.children_ids = node.children_ids.filter((cid: string) => cid !== id);
            }
          });
        });
        
        return { 
          nodes: newNodes, 
          rootNodeIds: newRootIds,
          selectedNodeIds: state.selectedNodeIds.filter(id => !idsToRemove.has(id)),
          isDirty: true
        };
      }),
    }),
    {
      name: 'waypoint-tool-storage',
      partialize: (state) => ({
        defaultMapOpacity: state.defaultMapOpacity,
        lastDirectory: state.lastDirectory,
        optionsSchema: state.optionsSchema,
        exportTemplates: state.exportTemplates,
        indexStartIndex: state.indexStartIndex,
        showPaths: state.showPaths,
        showGrid: state.showGrid,
        pluginSettings: state.pluginSettings,
        toolPanelMaxColumns: state.toolPanelMaxColumns,
        globalPythonPath: state.globalPythonPath,
      }),
    }
  )
);
