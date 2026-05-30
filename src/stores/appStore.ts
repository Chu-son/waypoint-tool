import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WaypointNode, ProjectMapLayer, OptionsSchema, PluginInstance, ExportTemplate } from '../types/store';
import { v4 as uuidv4 } from 'uuid';
import { BackendAPI, DialogAPI } from '../api';

export type AppState = {
  // App State
  rootNodeIds: string[];
  nodes: Record<string, WaypointNode>;
  selectedNodeIds: string[];
  activeTool: 'select' | 'add_point' | 'add_generator';
  insertionIndex: number;
  
  isSidebarOpen: boolean;
  mouseCenteredZoom: boolean;
  defaultMapOpacity: number; // Changed from 0.8
  
  plugins: Record<string, PluginInstance>;
  pluginSettings: import('../types/store').PluginSetting[];
  activePluginId: string | null;
  pluginInteractionData: Record<string, any>; // Interaction inputs (e.g. { 'sweep_rect': { center, ... } })
  pluginActiveProperties: Record<string, any>; // Currently edited properties (e.g. { 'num_lines': 5 })
  activeInputIndex: number;
  
  // Maps & Layers
  mapLayers: ProjectMapLayer[];
  lastDirectory: string | null;
  enableSnapping: boolean;

  optionsSchema: OptionsSchema | null;
  exportTemplates: ExportTemplate[];
  defaultExportFormats: import('../types/store').DefaultExportFormat[];
  globalPythonPath: string;
  
  visibleAttributes: string[];
  indexStartIndex: 0 | 1; // 0 or 1 for indexing
  
  isDirty: boolean; // Tracks unsaved changes

  // Cursor and Map View state
  cursorPosition: { x: number; y: number } | null;
  mapScale: number;

  // View Settings
  showPaths: boolean;
  showGrid: boolean;
  shouldFitToMaps: number; // timestamp trigger
  toolPanelMaxColumns: number;
  decimalPrecision: number; // Number of decimal places for numeric input display (default 6)
  
  // Panel States
  leftPanelWidth: number;
  rightPanelWidth: number;
  showProperties: boolean;
  leftPanelActiveTab: string;
  rightPanelActiveTab: string;
  leftPanelViewMode: 'tabs' | 'split';
  rightPanelViewMode: 'tabs' | 'split';
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;

  // Modals
  isSettingsModalOpen: boolean;
  isExportModalOpen: boolean;
  isShortcutsModalOpen: boolean;
  settingsModalTab: 'general' | 'options' | 'export' | 'plugins';

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
  setEnableSnapping: (enable: boolean) => void;
  setGlobalPythonPath: (path: string) => void;
  setOptionsSchema: (schema: OptionsSchema) => void;
  toggleAttributeVisibility: (attr: string) => void;
  setIndexStartIndex: (index: 0 | 1) => void;
  setInsertionIndex: (index: number) => void;
  setIsDirty: (dirty: boolean) => void;
  setProjectData: (data: { rootNodeIds: string[], nodes: Record<string, WaypointNode>, mapLayers?: ProjectMapLayer[] }) => void;
  
  setCursorPosition: (pos: { x: number; y: number } | null) => void;
  setMapScale: (scale: number) => void;

  setShowPaths: (show: boolean) => void;
  setShowGrid: (show: boolean) => void;
  triggerFitToMaps: () => void;
  
  addExportTemplate: (template: ExportTemplate) => void;
  updateExportTemplate: (id: string, updates: Partial<ExportTemplate>) => void;
  removeExportTemplate: (id: string) => void;
  updateDefaultExportFormat: (id: string, updates: Partial<import('../types/store').DefaultExportFormat>) => void;
  
  // Plugin Methods
  setPlugins: (plugins: Record<string, PluginInstance>) => void;
  setPluginSettings: (settings: import('../types/store').PluginSetting[]) => void;
  updatePluginSetting: (id: string, updates: Partial<import('../types/store').PluginSetting>) => void;
  setActivePlugin: (pluginId: string | null) => void;
  updatePluginInteractionData: (inputId: string, data: any) => void;
  clearPluginInteractionData: () => void;
  setPluginActiveProperties: (props: Record<string, any>) => void;
  setToolPanelMaxColumns: (max: number) => void;
  setActiveInputIndex: (index: number) => void;

  setLeftPanelActiveTab: (tab: string) => void;
  setRightPanelActiveTab: (tab: string) => void;
  setLeftPanelViewMode: (mode: 'tabs' | 'split') => void;
  setRightPanelViewMode: (mode: 'tabs' | 'split') => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  setShowProperties: (show: boolean) => void;
  resetWindowLayout: () => void;

  setSettingsModalOpen: (open: boolean, tab?: 'general' | 'options' | 'export' | 'plugins') => void;
  setExportModalOpen: (open: boolean) => void;
  setShortcutsModalOpen: (open: boolean) => void;
  
  selectAllNodes: () => void;
  deselectAllNodes: () => void;

  loadProject: () => Promise<void>;
  saveProject: () => Promise<void>;
  resetProject: () => void;
  explodeGenerator: (id: string) => void;
  reloadPlugins: () => Promise<void>;
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
      pluginActiveProperties: {},
      activeInputIndex: 0,
      
      // Maps & Layers
      mapLayers: [],
      lastDirectory: null,
      enableSnapping: true,

      optionsSchema: null,
      exportTemplates: [],
      defaultExportFormats: [
        { id: '__default_yaml__', name: 'YAML Document', extension: 'yaml', suffix: '_yaml', enabled: true },
        { id: '__default_json__', name: 'JSON Document', extension: 'json', suffix: '_json', enabled: true },
      ],
      globalPythonPath: 'python',
      visibleAttributes: [],
      indexStartIndex: 0,
      insertionIndex: -1,
      isDirty: false,
      
      cursorPosition: null,
      mapScale: 1,

      showPaths: true,
      showGrid: true,
      shouldFitToMaps: 0,
      toolPanelMaxColumns: 1,
      decimalPrecision: 6,

      // Modals
      isSettingsModalOpen: false,
      settingsModalTab: 'general',
      isExportModalOpen: false,
      isShortcutsModalOpen: false,

      leftPanelActiveTab: 'project',
      rightPanelActiveTab: 'layers',
      leftPanelViewMode: 'tabs',
      rightPanelViewMode: 'tabs',
      isLeftPanelOpen: true,
      isRightPanelOpen: true,
      leftPanelWidth: 256,
      rightPanelWidth: 320,
      showProperties: true,

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
      triggerFitToMaps: () => set({ shouldFitToMaps: Date.now() }),

      setMapLayers: (layers: ProjectMapLayer[]) => set({ mapLayers: layers, isDirty: true }),
      setIndexStartIndex: (index: 0 | 1) => set({ indexStartIndex: index, isDirty: true }),
      setInsertionIndex: (index: number) => set({ insertionIndex: index }),
      
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
      setEnableSnapping: (enable: boolean) => set({ enableSnapping: enable }),

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

      updateDefaultExportFormat: (id: string, updates: Partial<import('../types/store').DefaultExportFormat>) => set((state) => ({
        defaultExportFormats: state.defaultExportFormats.map((f: import('../types/store').DefaultExportFormat) => f.id === id ? { ...f, ...updates } : f),
        isDirty: true
      })),

      setIsDirty: (dirty: boolean) => set({ isDirty: dirty }),

      setCursorPosition: (pos) => set({ cursorPosition: pos }),
      setMapScale: (scale) => set({ mapScale: scale }),

      setActiveTool: (tool: AppState['activeTool']) => set(() => {
        const updates: Partial<AppState> = { activeTool: tool };
        if (tool === 'add_generator') {
          updates.rightPanelActiveTab = 'inspector';
        }
        return updates;
      }),
      selectNodes: (ids: string[], multi = false) => set((state) => {
        const nextIds = multi ? (() => {
          const current = new Set(state.selectedNodeIds);
          ids.forEach(id => {
            if (current.has(id)) current.delete(id);
            else current.add(id);
          });
          return Array.from(current);
        })() : ids;

        const updates: Partial<AppState> = { selectedNodeIds: nextIds };
        if (nextIds.length > 0) {
          updates.rightPanelActiveTab = 'inspector';
        }
        return updates;
      }),

      setLeftPanelActiveTab: (tab) => set({ leftPanelActiveTab: tab }),
      setRightPanelActiveTab: (tab) => set({ rightPanelActiveTab: tab }),
      setLeftPanelViewMode: (mode) => set({ leftPanelViewMode: mode, isDirty: true }),
      setRightPanelViewMode: (mode) => set({ rightPanelViewMode: mode, isDirty: true }),
      setLeftPanelOpen: (open) => set({ isLeftPanelOpen: open }),
      setRightPanelOpen: (open) => set({ isRightPanelOpen: open }),
      setLeftPanelWidth: (width) => set({ leftPanelWidth: width, isDirty: true }),
      setRightPanelWidth: (width) => set({ rightPanelWidth: width, isDirty: true }),
      setShowProperties: (show) => set({ showProperties: show, isDirty: true }),
      
      resetWindowLayout: () => set({
        isLeftPanelOpen: true,
        isRightPanelOpen: true,
        leftPanelViewMode: 'tabs',
        rightPanelViewMode: 'tabs',
        leftPanelActiveTab: 'project',
        rightPanelActiveTab: 'layers',
        leftPanelWidth: 256,
        rightPanelWidth: 320,
        isDirty: true
      }),

      setSettingsModalOpen: (open, tab) => set((state) => ({
        isSettingsModalOpen: open,
        settingsModalTab: tab || state.settingsModalTab
      })),
      setExportModalOpen: (open) => set({ isExportModalOpen: open }),
      setShortcutsModalOpen: (open) => set({ isShortcutsModalOpen: open }),

      selectAllNodes: () => set((state) => ({
        selectedNodeIds: Object.keys(state.nodes)
      })),
      deselectAllNodes: () => set({ selectedNodeIds: [] }),

      loadProject: async () => {
        const { lastDirectory, setLastDirectory, setProjectData, setIsDirty } = useAppStore.getState();
        try {
          const selectedPath = await DialogAPI.open({
            multiple: false,
            defaultPath: lastDirectory || undefined,
            filters: [{ name: "Waypoint Project", extensions: ["wptroj"] }],
          });

          if (selectedPath) {
            const pathStr = typeof selectedPath === "string" ? selectedPath : (selectedPath as any).path;
            if (!pathStr) return;

            const getDirName = (path: string) => {
              const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
              return lastSlash > -1 ? path.substring(0, lastSlash) : path;
            };

            setLastDirectory(getDirName(pathStr));
            const projectData = await BackendAPI.loadProject(pathStr);

            setProjectData({
              nodes: projectData.nodes,
              rootNodeIds: projectData.root_node_ids,
              mapLayers: projectData.map_layers?.map((layer: any) => ({
                id: uuidv4(),
                name: layer.name || "Restored Map",
                info: layer.info || {},
                image_base64: layer.image_base64 || "",
                width: layer.width || 1000,
                height: layer.height || 1000,
                visible: true,
                opacity: useAppStore.getState().defaultMapOpacity,
                z_index: 0
              }))
            });
            setIsDirty(false);
          }
        } catch (err) {
          console.error("Failed to load project:", err);
          alert(`プロジェクトの読み込みに失敗しました。\nエラー詳細: ${String(err)}`);
        }
      },

      saveProject: async () => {
        const { lastDirectory, setLastDirectory, rootNodeIds, nodes, mapLayers, setIsDirty } = useAppStore.getState();
        try {
          const savePath = await DialogAPI.save({
            defaultPath: lastDirectory || undefined,
            filters: [{ name: "Waypoint Project", extensions: ["wptroj"] }],
          });

          if (savePath) {
            let finalPath = savePath;
            if (!finalPath.toLowerCase().endsWith(".wptroj")) {
              finalPath += ".wptroj";
            }

            const getDirName = (path: string) => {
              const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
              return lastSlash > -1 ? path.substring(0, lastSlash) : path;
            };

            setLastDirectory(getDirName(finalPath));

            const mapLayersToSave = mapLayers.map((layer) => ({
              id: layer.id,
              name: layer.name,
              info: layer.info,
              image_base64: layer.image_base64,
              width: layer.width,
              height: layer.height,
              visible: layer.visible,
              opacity: layer.opacity,
              z_index: layer.z_index,
            }));

            const projectData = {
              root_node_ids: rootNodeIds,
              nodes,
              map_layers: mapLayersToSave,
            };
            await BackendAPI.saveProject(finalPath, projectData);
            setIsDirty(false);
            alert("プロジェクトを保存しました。");
          }
        } catch (err) {
          console.error("Failed to save project:", err);
          alert(`プロジェクトの保存に失敗しました。\nエラー詳細: ${String(err)}`);
        }
      },

      setProjectData: (data: any) =>
        set((state) => ({
          rootNodeIds: data.root_node_ids || data.rootNodeIds || [],
          nodes: data.nodes || {},
          selectedNodeIds: [],
          mapLayers: data.map_layers || data.mapLayers || state.mapLayers, // Keep existing if not in project
          exportTemplates: data.export_templates || state.exportTemplates,
          defaultExportFormats: data.default_export_formats || state.defaultExportFormats,
          indexStartIndex: data.index_start_index ?? state.indexStartIndex,
          decimalPrecision: data.decimal_precision ?? state.decimalPrecision,
          isDirty: false, // Reset dirty state on load
        })),

      resetProject: () => set({
        rootNodeIds: [],
        nodes: {},
        selectedNodeIds: [],
        mapLayers: [],
        isDirty: false
      }),
        
      setPlugins: (plugins) => set({ plugins }),
      setPluginSettings: (settings) => set({ pluginSettings: settings, isDirty: true }),
      updatePluginSetting: (id, updates) => set((state) => ({
        pluginSettings: state.pluginSettings.map(p => p.id === id ? { ...p, ...updates } : p),
        isDirty: true
      })),
      
      setActivePlugin: (pluginId) => set({ 
        activePluginId: pluginId, 
        pluginInteractionData: {}, 
        pluginActiveProperties: {},
        activeInputIndex: 0 
      }),
      
      updatePluginInteractionData: (inputId, data) => 
        set((state) => ({
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
      setToolPanelMaxColumns: (max) => set({ toolPanelMaxColumns: max, isDirty: true }),
      setActiveInputIndex: (index) => set({ activeInputIndex: index }),

      addNode: (node: WaypointNode, parentId?: string) => set((state) => {
        const newNodes = { ...state.nodes, [node.id]: node };
        let newRootIds = [...state.rootNodeIds];
        
        if (parentId && newNodes[parentId]) {
          const parent = newNodes[parentId];
          parent.children_ids = [...(parent.children_ids || []), node.id];
        } else {
          if (state.insertionIndex !== -1 && state.insertionIndex <= newRootIds.length) {
            newRootIds.splice(state.insertionIndex, 0, node.id);
            // Optionally, we could advance the insertion bar automatically
            // state.insertionIndex += 1; // Handled by a separate action or we can just leave it to stay below the inserted node
          } else {
            newRootIds.push(node.id);
          }
        }
        
        return { 
          nodes: newNodes, 
          rootNodeIds: newRootIds, 
          // Auto-advance the insertion bar if it's not at the very end (-1)
          insertionIndex: state.insertionIndex !== -1 ? state.insertionIndex + 1 : -1,
          isDirty: true 
        };
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

      explodeGenerator: (id: string) => set((state) => {
        const node = state.nodes[id];
        if (!node || node.type !== 'generator') return {};

        const childIds = node.children_ids || [];
        const newNodes = { ...state.nodes };
        delete newNodes[id];

        let newRootNodeIds = [...state.rootNodeIds];
        const rootIdx = newRootNodeIds.indexOf(id);

        if (rootIdx !== -1) {
          // It's a root node, replace it with its children
          newRootNodeIds.splice(rootIdx, 1, ...childIds);
        } else {
          // It might be a child of another node (though usually generators are root nodes in this app)
          Object.values(newNodes).forEach(parent => {
            if (parent.children_ids && parent.children_ids.includes(id)) {
              const idx = parent.children_ids.indexOf(id);
              parent.children_ids = [
                ...parent.children_ids.slice(0, idx),
                ...childIds,
                ...parent.children_ids.slice(idx + 1)
              ];
            }
          });
        }

        return {
          nodes: newNodes,
          rootNodeIds: newRootNodeIds,
          selectedNodeIds: state.selectedNodeIds.filter(sid => sid !== id),
          isDirty: true
        };
      }),

      reloadPlugins: async () => {
        try {
          const installedPlugins = await BackendAPI.fetchInstalledPlugins();
          const newMap: Record<string, PluginInstance> = {};
          
          // 1. 標準ディレクトリのプラグインを登録
          installedPlugins.forEach((p: PluginInstance) => {
            newMap[p.id] = p;
          });

          // 2. 設定に保存されているカスタムプラグインを再読み込みしてマージ
          const { pluginSettings } = useAppStore.getState();
          for (const setting of pluginSettings) {
            // builtinでない、かつパスがあるものを再スキャン
            if (!setting.isBuiltin && setting.path) {
              try {
                const customPlugin = await BackendAPI.scanCustomPlugin(setting.path);
                newMap[customPlugin.id] = customPlugin;
              } catch (err) {
                console.warn(`[AppStore] Failed to re-scan custom plugin at ${setting.path}:`, err);
                // スキャンに失敗しても、既存の情報を保持するか、リンク切れとして扱うかは
                // UI側で !plugin の判定をしているため、ここでは無理に保持せずスキップする
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
    }),
    {
      name: 'waypoint-tool-storage',
      partialize: (state) => ({
        defaultMapOpacity: state.defaultMapOpacity,
        lastDirectory: state.lastDirectory,
        enableSnapping: state.enableSnapping,
        optionsSchema: state.optionsSchema,
        exportTemplates: state.exportTemplates,
        defaultExportFormats: state.defaultExportFormats,
        indexStartIndex: state.indexStartIndex,
        showPaths: state.showPaths,
        showGrid: state.showGrid,
        pluginSettings: state.pluginSettings,
        toolPanelMaxColumns: state.toolPanelMaxColumns,
        globalPythonPath: state.globalPythonPath,
        decimalPrecision: state.decimalPrecision,
        leftPanelViewMode: state.leftPanelViewMode,
        rightPanelViewMode: state.rightPanelViewMode,
        leftPanelWidth: state.leftPanelWidth,
        rightPanelWidth: state.rightPanelWidth,
        showProperties: state.showProperties,
      }),
    }
  )
);
