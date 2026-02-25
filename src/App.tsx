import './App.css';
import { useEffect, useState, useCallback } from 'react';
import { ToolPanel } from './components/ui/ToolPanel';
import { TopMenu } from './components/ui/TopMenu';
import { WaypointTree } from './components/ui/WaypointTree';
import { PropertiesPanel } from './components/ui/PropertiesPanel';
import { LayerPanel } from './components/ui/LayerPanel';
import { PluginParamsPanel } from './components/ui/PluginParamsPanel';
import { MapCanvas } from './components/canvas/MapCanvas';
import { useAppStore } from './stores/appStore';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { ask } from '@tauri-apps/plugin-dialog';
import { BackendAPI } from './api/backend';
import { PluginInstance } from './types/store';

function App() {
  const activeTool = useAppStore(state => state.activeTool);
  const selectedNodeIds = useAppStore(state => state.selectedNodeIds);
  const removeNodes = useAppStore(state => state.removeNodes);

  // Sidebar States
  const [leftWidth, setLeftWidth] = useState(256);
  const [rightWidth, setRightWidth] = useState(320);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState<'inspector' | 'layers'>('inspector');

  useEffect(() => {
    const initApp = async () => {
      try {
        const installedPlugins = await BackendAPI.fetchInstalledPlugins();
        const pluginMap: Record<string, PluginInstance> = {};
        
        const storeSettings = useAppStore.getState().pluginSettings;
        const newSettings = [...storeSettings];
        let settingsChanged = false;

        // Register scanned plugins (both bundled and user-directory plugins)
        installedPlugins.forEach(p => { 
          pluginMap[p.id] = p; 
          
          // Auto-add to settings if not exists
          if (!newSettings.find(s => s.id === p.id)) {
            newSettings.push({
              id: p.id,
              enabled: true,
              order: newSettings.length,
              isBuiltin: p.is_builtin,
              path: p.is_builtin ? undefined : p.folder_path
            });
            settingsChanged = true;
          }
        });

        // Load custom plugins from settings
        for (const setting of storeSettings) {
          if (!setting.isBuiltin && setting.path && setting.enabled !== false) {
             try {
                const customPlugin = await BackendAPI.scanCustomPlugin(setting.path);
                pluginMap[customPlugin.id] = customPlugin;
                // If ID changed or wasn't set somehow, fix it up
                if (setting.id !== customPlugin.id) {
                    setting.id = customPlugin.id;
                    settingsChanged = true;
                }
             } catch (err) {
                console.warn(`Failed to load custom plugin from ${setting.path}:`, err);
             }
          }
        }

        useAppStore.getState().setPlugins(pluginMap);
        if (settingsChanged) {
           useAppStore.getState().setPluginSettings(newSettings);
        }
        
        console.log('Loaded plugins:', Object.keys(pluginMap).length);
      } catch (e) {
        console.error('Failed to load plugins:', e);
      }
    };
    initApp();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.length > 0) removeNodes(selectedNodeIds);
      }
      if (e.key === 'Escape') {
        if (selectedNodeIds.length > 0) useAppStore.setState({ selectedNodeIds: [] });
        if (activeTool !== 'select') useAppStore.setState({ activeTool: 'select' });
        useAppStore.setState({ pluginInteractionData: undefined });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, activeTool, removeNodes]);

  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      // Completely intercept the closing event to bypass tauri-plugin-window-state race conditions
      event.preventDefault();
      
      if (useAppStore.getState().isDirty) {
        const confirmed = await ask('未保存の変更があります。保存せずに終了してもよろしいですか？', {
          title: '終了の確認',
          kind: 'warning',
        });
        
        if (!confirmed) {
          return; // Abort close
        }
      }
      
      // Approved to close.
      useAppStore.getState().setIsDirty(false);
      try {
        // Explicitly trigger window state saving before we force destroy
        const { saveWindowState, StateFlags } = await import('@tauri-apps/plugin-window-state');
        await saveWindowState(StateFlags.ALL);
      } catch (err) {
        console.error("Failed to save window state", err);
      }
      
      setTimeout(() => {
        invoke('force_exit');
      }, 50);
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const handleLeftDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      setLeftWidth(Math.max(150, Math.min(newWidth, 600)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [leftWidth]);

  const handleRightDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth - (moveEvent.clientX - startX);
      setRightWidth(Math.max(200, Math.min(newWidth, 800)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [rightWidth]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      <TopMenu />
      
      <div className="flex flex-1 overflow-hidden w-full relative">
        <ToolPanel />

        {/* Left Panel */}
      {leftOpen && (
        <>
          <div style={{ width: leftWidth }} className="bg-slate-800 border-r border-slate-700 flex flex-col z-0 shadow-lg relative flex-shrink-0">
            <div className="p-3 border-b border-slate-700 bg-slate-800/80 backdrop-blur flex justify-between items-center">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Project / Hierarchy</h2>
              <button onClick={() => setLeftOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                <ChevronLeft size={16} />
              </button>
            </div>
            <WaypointTree />
          </div>
          {/* Dragger */}
          <div 
            className="w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary z-10 transition-colors"
            onMouseDown={handleLeftDrag}
          />
        </>
      )}

      {/* Main Center Area */}
      <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col">
        {/* Top Floating Bar for restoring panels if closed */}
        <div className="absolute top-4 left-4 right-4 z-10 flex justify-between pointer-events-none">
          {!leftOpen ? (
            <button 
              onClick={() => setLeftOpen(true)} 
              className="pointer-events-auto bg-slate-800/80 backdrop-blur border border-slate-700 p-2 rounded-lg shadow text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          ) : <div/>}
          
          {!rightOpen ? (
            <button 
              onClick={() => setRightOpen(true)} 
              className="pointer-events-auto bg-slate-800/80 backdrop-blur border border-slate-700 p-2 rounded-lg shadow text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
          ) : <div/>}
        </div>

        <div className="flex-1 relative w-full h-full flex items-center justify-center">
          <MapCanvas />
        </div>
      </div>

      {/* Right Panel */}
      {rightOpen && (
        <>
          {/* Dragger */}
          <div 
            className="w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary z-10 transition-colors"
            onMouseDown={handleRightDrag}
          />
          <div style={{ width: rightWidth }} className="bg-slate-800 border-l border-slate-700 flex flex-col z-0 shadow-lg relative flex-shrink-0">
            <div className="p-3 border-b border-slate-700 bg-slate-800/80 backdrop-blur flex justify-between items-center">
              <button onClick={() => setRightOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                <ChevronRight size={16} />
              </button>
              <div className="flex space-x-4">
                <button 
                  onClick={() => setRightTab('inspector')}
                  className={`text-xs font-bold uppercase tracking-wider pb-1 ${rightTab === 'inspector' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Inspector
                </button>
                <button 
                  onClick={() => setRightTab('layers')}
                  className={`text-xs font-bold uppercase tracking-wider pb-1 flex items-center gap-1 ${rightTab === 'layers' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <Layers size={14} /> Layers
                </button>
              </div>
            </div>
            {activeTool === 'add_generator' ? <PluginParamsPanel /> : (rightTab === 'inspector' ? <PropertiesPanel /> : <LayerPanel />)}
          </div>
        </>
      )}
      </div>
    </div>
  );
}

export default App;
