import { useState } from 'react';
import { MousePointer2, Download, Settings, Plus, FilePlus2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { SettingsModal } from './SettingsModal';
import { ExportModal } from './ExportModal';

export function ToolPanel() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  
  const activeTool = useAppStore(state => state.activeTool);
  const setActiveTool = useAppStore(state => state.setActiveTool);
  const plugins = useAppStore(state => state.plugins);
  const activePluginId = useAppStore(state => state.activePluginId);
  const setActivePlugin = useAppStore(state => state.setActivePlugin);

  const handleExportWaypointsClick = () => {
    setIsExportOpen(true);
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
          onClick={handleExportWaypointsClick}
          title="Export Waypoints"
          className="w-10 h-10 rounded-xl bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all flex items-center justify-center group"
        >
          <Download size={20} className="group-hover:scale-110 transition-transform text-purple-400" />
        </button>

        <button
          onClick={() => setIsSettingsOpen(true)}
          title="Settings & Plugins"
          className="w-10 h-10 rounded-xl transition-all flex items-center justify-center bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200 mt-2"
        >
          <Settings size={20} className="text-slate-500 hover:text-white transition-colors" />
        </button>
      </div>
      
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />

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
