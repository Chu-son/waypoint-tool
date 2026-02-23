import { useState } from 'react';
import { MousePointer2, Save, FolderOpen, Download, Settings, Plus, FilePlus2, SlidersHorizontal } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { open, save } from '@tauri-apps/plugin-dialog';
import { BackendAPI } from '../../api/backend';
import { SettingsModal } from './SettingsModal';

export function ToolPanel() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const activeTool = useAppStore(state => state.activeTool);
  const setActiveTool = useAppStore(state => state.setActiveTool);
  const addMapLayer = useAppStore(state => state.addMapLayer);
  const setLastDirectory = useAppStore(state => state.setLastDirectory);
  const lastDirectory = useAppStore(state => state.lastDirectory);
  const setOptionsSchema = useAppStore(state => state.setOptionsSchema);
  const plugins = useAppStore(state => state.plugins);
  const activePluginId = useAppStore(state => state.activePluginId);
  const setActivePlugin = useAppStore(state => state.setActivePlugin);
  
  // Data for export
  const nodes = useAppStore(state => state.nodes);
  const rootNodeIds = useAppStore(state => state.rootNodeIds);

  const getDirName = (path: string) => {
    // Basic extraction of directory path (works for both win and posix loosely)
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    return lastSlash > -1 ? path.substring(0, lastSlash) : path;
  };

  const handleLoadProject = async () => {
    try {
      const selectedPath = await open({
        multiple: false,
        defaultPath: lastDirectory || undefined,
        filters: [{ name: 'Waypoint Project', extensions: ['wptroj'] }]
      });
      
      if (selectedPath) {
        const pathStr = typeof selectedPath === 'string' ? selectedPath : (selectedPath as any).path;
        if (!pathStr) return;

        setLastDirectory(getDirName(pathStr));
        const projectData = await BackendAPI.loadProject(pathStr);
        
        // Restore Waypoints
        useAppStore.setState({
          nodes: projectData.nodes,
          rootNodeIds: projectData.root_node_ids,
          selectedNodeIds: [],
        });
        
        // Restore Map Layers (clear existing and add new)
        if (projectData.map_layers && Array.isArray(projectData.map_layers)) {
          useAppStore.setState({ mapLayers: [] }); // Clear current layers
          projectData.map_layers.forEach((layer: any) => {
            useAppStore.getState().addMapLayer(
              layer.name || 'Restored Map',
              layer.info || {},
              layer.image_base64 || '',
              layer.width || 1000,
              layer.height || 1000
            );
            // Optionally update properties like opacity and zIndex to match exactly
            // using the newly created ID, but for now addMapLayer defaults are okay.
          });
        }
        
        useAppStore.getState().setIsDirty(false);
        console.log("Project loaded successfully", projectData);
      }
    } catch (err) {
      console.error("Failed to load project:", err);
      alert(`プロジェクトの読み込みに失敗しました。\nエラー詳細: ${String(err)}`);
    }
  };

  const handleLoadMap = async () => {
    try {
      const selectedPath = await open({
        multiple: false,
        defaultPath: lastDirectory || undefined,
        filters: [{ name: 'ROS Map YAML', extensions: ['yaml'] }]
      });
      
      if (selectedPath) {
        const pathStr = typeof selectedPath === 'string' ? selectedPath : (selectedPath as any).path;
        if (!pathStr) return;

        setLastDirectory(getDirName(pathStr));
        const result = await BackendAPI.loadROSMap(pathStr);
        
        // Use the filename for the layer name
        const filename = pathStr.split(/[/\\]/).pop() || 'Map';
        addMapLayer(filename, result.info, result.image_data_b64, result.width, result.height);
        console.log("Map loaded successfully", result.info);
      }
    } catch (err) {
      console.error("Failed to load map:", err);
      alert(`マップの読み込みに失敗しました。\nエラー詳細: ${String(err)}`);
    }
  };

  const handleLoadOptions = async () => {
    try {
      const selectedPath = await open({
        multiple: false,
        defaultPath: lastDirectory || undefined,
        filters: [{ name: 'Options Schema YAML', extensions: ['yaml', 'yml'] }]
      });
      
      if (selectedPath) {
        const pathStr = typeof selectedPath === 'string' ? selectedPath : (selectedPath as any).path;
        if (!pathStr) return;

        setLastDirectory(getDirName(pathStr));
        const schema = await BackendAPI.loadOptionsSchema(pathStr);
        setOptionsSchema(schema);
      }
    } catch (err) {
      console.error("Failed to load options schema:", err);
      alert(`オプションスキーマの読み込みに失敗しました。\nエラー詳細: ${String(err)}`);
    }
  };

  const handleExportWaypoints = async () => {
    try {
      const exportTemplates = useAppStore.getState().exportTemplates;
      const customFilters = exportTemplates.map(t => ({ name: t.name, extensions: [t.extension] }));
      
      const savePath = await save({
        defaultPath: lastDirectory || undefined,
        filters: [
          { name: 'YAML Document', extensions: ['yaml', 'yml'] },
          { name: 'JSON Document', extensions: ['json'] },
          ...customFilters
        ]
      });
      
      if (savePath) {
        let finalPath = savePath;
        const validExts = ['yaml', 'yml', 'json', ...exportTemplates.map(t => t.extension)];
        const hasValidExt = validExts.some(ext => finalPath.toLowerCase().endsWith('.' + ext.toLowerCase()));
        
        if (!hasValidExt) {
          finalPath += '.yaml';
        }

        setLastDirectory(getDirName(finalPath));
        const waypointsToExport = rootNodeIds.map(id => {
          const node = nodes[id];
          if (!node) return null;
          return {
            id: node.id,
            type: node.type,
            x: node.transform?.x ?? 0,
            y: node.transform?.y ?? 0,
            yaw: node.transform?.yaw ?? 0,
            options: node.options ?? {}
          };
        }).filter(n => n !== null);

        // Check if the extension matches any custom template length
        const ext = finalPath.split('.').pop()?.toLowerCase();
        const matchedTemplate = exportTemplates.find(t => t.extension.toLowerCase() === ext);

        await BackendAPI.exportWaypoints(finalPath, waypointsToExport as any[], matchedTemplate?.content);
        alert("エクスポートが完了しました。");
      }
    } catch (err) {
      console.error("Failed to export waypoints:", err);
      alert(`エクスポートに失敗しました。\nエラー詳細: ${String(err)}`);
    }
  };

  const handleSaveProject = async () => {
    try {
      const savePath = await save({
        defaultPath: lastDirectory || undefined,
        filters: [{ name: 'Waypoint Project', extensions: ['wptroj'] }]
      });
      
      if (savePath) {
        let finalPath = savePath;
        if (!finalPath.toLowerCase().endsWith('.wptroj')) {
          finalPath += '.wptroj';
        }

        setLastDirectory(getDirName(finalPath));
        
        // Bundle current map layers
        const currentMapLayers = useAppStore.getState().mapLayers;
        const mapLayersToSave = currentMapLayers.map(layer => ({
          id: layer.id,
          name: layer.name,
          info: layer.info,
          image_base64: layer.image_base64,
          width: layer.width,
          height: layer.height,
          visible: layer.visible,
          opacity: layer.opacity,
          z_index: layer.z_index
        }));

        const projectData = {
          root_node_ids: rootNodeIds,
          nodes,
          map_layers: mapLayersToSave
        };
        await BackendAPI.saveProject(finalPath, projectData);
        useAppStore.getState().setIsDirty(false);
        alert("プロジェクトを保存しました。");
      }
    } catch (err) {
      console.error("Failed to save project:", err);
      alert(`プロジェクトの保存に失敗しました。\nエラー詳細: ${String(err)}`);
    }
  };

  const tools = [
    { id: 'select', icon: MousePointer2, label: 'Select (V)' },
    { id: 'add_point', icon: Plus, label: 'Add Waypoint (P)' },
    { id: 'add_generator', icon: FilePlus2, label: 'Add Generator Node' },
  ] as const;

  return (
    <div className="w-16 bg-slate-800 border-r border-slate-700 flex flex-col items-center py-4 gap-4 z-10 shadow-md">
      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-2">Tools</div>
      
      {tools.map(tool => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        
        return (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            title={tool.label}
            className={`
              w-10 h-10 rounded-xl transition-all flex items-center justify-center group
              ${isActive ? 'bg-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}
            `}
          >
            <Icon size={20} className={isActive ? '' : 'group-hover:scale-110 transition-transform'} />
          </button>
        );
      })}

      <div className="mt-auto mb-4 border-t border-slate-700 pt-4 flex flex-col items-center w-full gap-3">
        <button
          onClick={() => setIsSettingsOpen(true)}
          title="Settings & Plugins"
          className="w-10 h-10 rounded-xl transition-all flex items-center justify-center bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
        >
          <Settings size={20} />
        </button>

        <button
          onClick={handleLoadProject}
          title="Open Project (.wptroj)"
          className="w-10 h-10 rounded-xl bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all flex items-center justify-center group"
        >
          <FolderOpen size={20} className="group-hover:scale-110 transition-transform text-indigo-400" />
        </button>
        <button
          onClick={handleSaveProject}
          title="Save Project (.wptroj)"
          className="w-10 h-10 rounded-xl bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all flex items-center justify-center group"
        >
          <Save size={20} className="group-hover:scale-110 transition-transform text-blue-400" />
        </button>
        <button
          onClick={handleExportWaypoints}
          title="Export Waypoints (YAML/JSON)"
          className="w-10 h-10 rounded-xl bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all flex items-center justify-center group"
        >
          <Download size={20} className="group-hover:scale-110 transition-transform text-purple-400" />
        </button>
        <button
          onClick={handleLoadOptions}
          title="Load Options Schema (YAML)"
          className="w-10 h-10 rounded-xl bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all flex items-center justify-center group"
        >
          <SlidersHorizontal size={20} className="group-hover:scale-110 transition-transform text-amber-400" />
        </button>
        <button
          onClick={handleLoadMap}
          title="Load Map (YAML)"
          className="w-10 h-10 rounded-xl bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all flex items-center justify-center group"
        >
          <FolderOpen size={20} className="group-hover:scale-110 transition-transform text-emerald-400" />
        </button>
        <button
          onClick={() => setIsSettingsOpen(true)}
          title="App Settings"
          className="w-10 h-10 rounded-xl bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all flex items-center justify-center group"
        >
          <Settings size={20} className="group-hover:scale-110 transition-transform text-slate-300" />
        </button>
      </div>
      
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Generator Sub-panel */}
      {activeTool === 'add_generator' && (
        <div className="absolute left-16 top-0 w-64 bg-slate-800 border-r border-slate-700 h-full shadow-2xl z-20 overflow-y-auto flex flex-col">
          <div className="p-4 border-b border-slate-700 bg-slate-800/80 backdrop-blur sticky top-0 z-10">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Select Generator Plugin</h3>
          </div>
          <div className="p-4 flex flex-col gap-2 flex-1">
            {Object.keys(plugins).length === 0 ? (
              <div className="text-xs text-slate-500 italic p-3 bg-slate-900 rounded-lg text-center">
                No plugins available.<br/>Install plugins in Settings.
              </div>
            ) : (
              Object.values(plugins).map(plugin => {
                const isActive = activePluginId === plugin.id;
                return (
                  <button 
                    key={plugin.id}
                    onClick={() => setActivePlugin(plugin.id)}
                    className={`p-3 rounded-lg text-left transition-colors border group ${isActive ? 'bg-primary/20 border-primary shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'bg-slate-900/50 border-slate-700 hover:bg-slate-700 hover:border-slate-500'}`}
                  >
                    <div className={`font-bold text-sm ${isActive ? 'text-primary-100' : 'text-slate-200 group-hover:text-white'}`}>{plugin.manifest.name}</div>
                    <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{plugin.manifest.type}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
