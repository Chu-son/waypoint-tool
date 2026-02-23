import './App.css';
import { useEffect, useState, useCallback } from 'react';
import { ToolPanel } from './components/ui/ToolPanel';
import { WaypointTree } from './components/ui/WaypointTree';
import { PropertiesPanel } from './components/ui/PropertiesPanel';
import { LayerPanel } from './components/ui/LayerPanel';
import { MapCanvas } from './components/canvas/MapCanvas';
import { useAppStore } from './stores/appStore';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ask } from '@tauri-apps/plugin-dialog';
import { BackendAPI } from './api/backend';
import { PluginInstance } from './types/store';

function App() {
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
        const plugins = await BackendAPI.fetchInstalledPlugins();
        const pluginMap: Record<string, PluginInstance> = {};
        plugins.forEach(p => { pluginMap[p.id] = p; });
        useAppStore.getState().setPlugins(pluginMap);
        console.log('Loaded plugins:', plugins.length);
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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, removeNodes]);

  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      if (useAppStore.getState().isDirty) {
        // Prevent immediate close
        event.preventDefault();
        
        // Ask user for confirmation
        const confirmed = await ask('未保存の変更があります。保存せずに終了してもよろしいですか？', {
          title: '終了の確認',
          kind: 'warning',
        });
        
        if (confirmed) {
          // User chose to close without saving
          getCurrentWindow().destroy();
        }
      }
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
    <div className="flex h-screen w-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
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
            {rightTab === 'inspector' ? <PropertiesPanel /> : <LayerPanel />}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
