import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { BackendAPI } from '../../api/backend';
import { Play, Settings2, X, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export function PluginParamsPanel() {
  const activeTool = useAppStore(state => state.activeTool);
  const activePluginId = useAppStore(state => state.activePluginId);
  const plugins = useAppStore(state => state.plugins);
  const pluginSettings = useAppStore(state => state.pluginSettings);
  const globalPythonPath = useAppStore(state => state.globalPythonPath);
  const pluginInteractionData = useAppStore(state => state.pluginInteractionData);
  const activeInputIndex = useAppStore(state => state.activeInputIndex);
  const setActiveInputIndex = useAppStore(state => state.setActiveInputIndex);
  
  const selectedNodeIds = useAppStore(state => state.selectedNodeIds);
  const nodes = useAppStore(state => state.nodes);
  
  const [params, setParams] = useState<Record<string, any>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  const plugin = activePluginId ? plugins[activePluginId] : null;

  useEffect(() => {
    // Reset params when different plugin selected
    if (plugin) {
      const initialParams: Record<string, any> = {};
      const inputs = plugin.manifest.inputs || [];
      inputs.forEach(inp => {
        const key = inp.name || inp.id;
        if (key) {
           initialParams[key] = inp.default ?? '';
        }
      });
      const properties = plugin.manifest.properties || [];
      properties.forEach(prop => {
        const key = prop.name;
        if (key) {
           initialParams[key] = prop.default ?? '';
        }
      });
      setParams(initialParams);
      setErrorInfo(null);
    }
  }, [activePluginId, plugin]);

  // Auto-advance to next unset input when current input is completed
  useEffect(() => {
    if (!plugin || activeTool !== 'add_generator') return;
    const inputs = plugin.manifest.inputs || [];
    if (inputs.length <= 1) return;
    
    const currentInput = inputs[activeInputIndex];
    const currentKey = currentInput?.name || currentInput?.id;
    if (!currentKey || !pluginInteractionData[currentKey]) return;
    
    // Current input has data - find next unset input
    for (let i = activeInputIndex + 1; i < inputs.length; i++) {
      const inp = inputs[i];
      const k = inp.name || inp.id;
      if (k && !pluginInteractionData[k]) {
        setActiveInputIndex(i);
        return;
      }
    }
  }, [pluginInteractionData, activeInputIndex, plugin, activeTool, setActiveInputIndex]);

  if (activeTool !== 'add_generator' || !plugin) {
    return null;
  }

  // Handle runtime undefined manifest issues gracefully
  const inputs = plugin.manifest.inputs || [];
  const properties = plugin.manifest.properties || [];
  const needsSelection = plugin.manifest.needs?.includes('selected_points' as any) || false;
  
  const handleExecute = async () => {
    if (needsSelection && selectedNodeIds.length === 0) {
      setErrorInfo('This plugin requires selecting waypoint(s) on the canvas first.');
      return;
    }

    setIsExecuting(true);
    setErrorInfo(null);
    try {
      const contextData: any = {
         properties: params,
         interaction_data: {}
      };

      // Add interaction inputs (points & rectangles) to the parameter payload for python scripts
      inputs.forEach(inp => {
         const key = inp.name || inp.id;
         if (key && pluginInteractionData[key]) {
            contextData.interaction_data[key] = pluginInteractionData[key];
         }
      });

      if (needsSelection) {
         contextData.selected_points = selectedNodeIds.map(id => nodes[id]?.transform).filter(Boolean);
      }

      // ----------------------------------------------------------------------
      // Python Configuration Injection
      // ----------------------------------------------------------------------
      let pythonPathToUse = globalPythonPath?.trim() || 'python3';
      if (plugin.manifest.type === 'python') {
         const setting = pluginSettings.find(s => s.id === plugin.id);
         if (setting && setting.pythonOverridePath && setting.pythonOverridePath.trim() !== '') {
            pythonPathToUse = setting.pythonOverridePath.trim();
         }
      }

      console.log("[DEBUG] Executing Plugin ID:", plugin.id);
      console.log("[DEBUG] Python Path Context:", pythonPathToUse);
      console.log("[DEBUG] Full Context Data sent to Execution:", contextData);

      // Execute plugin through backend API (passing contextual Python path)
      const resultingWaypoints = await BackendAPI.runPlugin(plugin, contextData, pythonPathToUse);
      
      if (Array.isArray(resultingWaypoints) && resultingWaypoints.length > 0) {
        // Create Parent Generator Node
        const parentId = uuidv4();
        useAppStore.getState().addNode({
          id: parentId,
          type: 'generator',
          plugin_id: plugin.id,
          generator_params: contextData,
          children_ids: []
        });

        // Build new child nodes
        resultingWaypoints.forEach(wp => {
           let qx = wp.qx ?? 0, qy = wp.qy ?? 0, qz = wp.qz ?? 0, qw = wp.qw ?? 1;
           // If python returned Euler yaw and skipped quaternions, convert it
           if (typeof wp.yaw === 'number' && typeof wp.qw !== 'number') {
               const halfYaw = wp.yaw / 2.0;
               qz = Math.sin(halfYaw);
               qw = Math.cos(halfYaw);
           }

           const id = uuidv4();
           useAppStore.getState().addNode({
             id,
             type: 'manual',
             transform: wp.transform || { x: wp.x ?? 0, y: wp.y ?? 0, qx, qy, qz, qw },
             options: wp.options || {}
           }, parentId); // append to parent
        });
        
        // Auto select the newly generated parent node
        useAppStore.getState().selectNodes([parentId]);
      } else {
        setErrorInfo('Plugin executed successfully but returned 0 waypoints. Check your settings.');
      }
      
    } catch (err: any) {
      console.error('Plugin execution failed:', err);
      setErrorInfo(err.toString());
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 flex flex-col h-full bg-slate-900 border-l border-slate-700">
      <div className="flex justify-between items-start mb-4 border-b border-slate-800 pb-3">
        <div>
           <div className="flex items-center gap-2">
             <Settings2 size={16} className="text-primary" />
             <h2 className="text-sm font-bold text-white leading-none">{plugin.manifest.name}</h2>
           </div>
           <p className="text-[11px] text-slate-500 mt-1 leading-tight">{plugin.manifest.description || 'No description provided'}</p>
        </div>
        <button 
           onClick={() => useAppStore.getState().setActiveTool('select')}
           className="text-slate-500 hover:text-white transition-colors p-1 bg-slate-800 rounded-md shrink-0 ml-2"
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-4 flex-1">
        {/* Step indicator for multi-input plugins */}
        {inputs.length > 1 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Input Steps</span>
              <span className="text-[10px] text-slate-500">{activeInputIndex + 1} / {inputs.length}</span>
            </div>
            <div className="flex gap-1">
              {inputs.map((inp, idx) => {
                const key = inp.name || inp.id || '';
                const hasData = !!pluginInteractionData[key];
                const isActive = idx === activeInputIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveInputIndex(idx)}
                    className={`flex-1 py-1.5 px-1 rounded text-[10px] font-medium transition-all border ${
                      isActive
                        ? 'bg-primary/20 border-primary text-primary'
                        : hasData
                          ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-400'
                          : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:border-slate-600'
                    }`}
                    title={inp.label || key}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold ${
                        isActive ? 'bg-primary text-white' : hasData ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'
                      }`}>{idx + 1}</span>
                      <span className="truncate">{inp.type === 'rectangle' ? '▭' : inp.type === 'point' ? '◉' : '●'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        
        {inputs.length === 0 ? (
           <p className="text-xs text-slate-500 italic">No parameters required for this plugin.</p>
        ) : (
          inputs.map((inp, idx) => {
            const key = inp.name || inp.id;
            if (!key) return null;
            const isActiveStep = idx === activeInputIndex;
            const hasData = !!pluginInteractionData[key];
            return (
              <div key={idx} className={`space-y-1 rounded-lg p-2 transition-all ${isActiveStep ? 'ring-1 ring-primary/50 bg-primary/5' : ''}`}>
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  {inputs.length > 1 && (
                    <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold shrink-0 ${
                      isActiveStep ? 'bg-primary text-white' : hasData ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'
                    }`}>{idx + 1}</span>
                  )}
                  {inp.label || key} {inp.required && <span className="text-red-400">*</span>}
                </label>
                {isActiveStep && !hasData && (
                  <p className="text-[10px] text-primary/70 font-medium">
                    {inp.type === 'rectangle' ? '▶ Click and drag on map to draw' : inp.type === 'point' ? '▶ Click on map to place' : ''}
                  </p>
                )}
                {inp.description && <p className="text-[10px] text-slate-500 leading-tight mb-1">{inp.description}</p>}
                
                {inp.type === 'boolean' ? (
                   <label className="flex items-center gap-3 mt-1 bg-slate-800/50 p-2 rounded border border-slate-700/50 cursor-pointer">
                     <input 
                       type="checkbox" 
                       checked={!!params[key]}
                       onChange={(e) => setParams(prev => ({...prev, [key]: e.target.checked}))}
                       className="rounded bg-slate-800 border-slate-600 text-primary focus:ring-primary focus:ring-offset-slate-900 w-4 h-4 cursor-pointer" 
                     />
                     <span className="text-xs text-slate-300 font-medium">Enabled</span>
                   </label>
                ) : inp.type === 'point' ? (
                  <div className="bg-slate-950 p-2 rounded border border-slate-700 font-mono text-center">
                     {pluginInteractionData[key] ? (
                        <span className="text-pink-400">
                          ({pluginInteractionData[key].x.toFixed(2)}, {pluginInteractionData[key].y.toFixed(2)}) 
                          <span className="text-slate-500 ml-1">SET</span>
                        </span>
                     ) : (
                        <span className="text-slate-500 italic">Click on map to define</span>
                     )}
                  </div>
                ) : inp.type === 'rectangle' ? (
                  <div className="bg-slate-950 p-2 rounded border border-slate-700 font-mono text-xs">
                      {pluginInteractionData[key]?.center ? (
                         <div className="space-y-1">
                           <div className="grid grid-cols-2 gap-x-2">
                             <div className="flex justify-between"><span className="text-slate-400">W:</span><span className="text-pink-400">{pluginInteractionData[key].width?.toFixed(2)}m</span></div>
                             <div className="flex justify-between"><span className="text-slate-400">H:</span><span className="text-pink-400">{pluginInteractionData[key].height?.toFixed(2)}m</span></div>
                             <div className="flex justify-between"><span className="text-slate-400">X:</span><span className="text-pink-400">{pluginInteractionData[key].center?.x?.toFixed(2)}</span></div>
                             <div className="flex justify-between"><span className="text-slate-400">Y:</span><span className="text-pink-400">{pluginInteractionData[key].center?.y?.toFixed(2)}</span></div>
                           </div>
                           <div className="flex justify-between pt-0.5 border-t border-slate-800">
                             <span className="text-slate-400">Yaw:</span>
                             <span className="text-orange-400">{((pluginInteractionData[key].yaw ?? 0) * 180 / Math.PI).toFixed(1)}°</span>
                           </div>
                           <div className="text-center text-slate-500 text-[10px] mt-1">Drag ◻ corners · Drag ↻ handle to rotate</div>
                         </div>
                      ) : (
                         <span className="text-slate-500 italic text-center block">Click and drag on map to draw rectangle</span>
                      )}
                   </div>
                ) : inp.type === 'integer' || inp.type === 'float' ? (
                   <input 
                     type="number"
                     step={inp.type === 'float' ? 'any' : '1'}
                     value={params[key] ?? ''}
                     onChange={e => {
                       const val = inp.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
                       setParams(prev => ({...prev, [key]: isNaN(val) ? '' : val}));
                     }}
                     className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary placeholder:text-slate-600"
                     placeholder={String(inp.default ?? '')}
                   />
                ) : (
                   <input 
                     type="text"
                     value={params[key] || ''}
                     onChange={e => setParams(prev => ({...prev, [key]: e.target.value}))}
                     className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary placeholder:text-slate-600"
                     placeholder={String(inp.default ?? '')}
                   />
                )}
              </div>
            );
          })
        )}

        {properties.length > 0 && properties.map((prop, idx) => {
          const key = prop.name;
          if (!key) return null;
          return (
            <div key={`prop-${idx}`} className="space-y-1 mt-3 pt-3 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300">
                {prop.label || key}
              </label>
              
              {prop.type === 'boolean' ? (
                 <label className="flex items-center gap-3 mt-1 bg-slate-800/50 p-2 rounded border border-slate-700/50 cursor-pointer">
                   <input 
                     type="checkbox" 
                     checked={!!params[key]}
                     onChange={(e) => setParams(prev => ({...prev, [key]: e.target.checked}))}
                     className="rounded bg-slate-800 border-slate-600 text-primary focus:ring-primary focus:ring-offset-slate-900 w-4 h-4 cursor-pointer" 
                   />
                   <span className="text-xs text-slate-300 font-medium">Enabled</span>
                 </label>
              ) : prop.type === 'integer' || prop.type === 'float' ? (
                 <input 
                   type="number"
                   step={prop.type === 'float' ? 'any' : '1'}
                   value={params[key] ?? ''}
                   onChange={e => {
                     const val = prop.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
                     setParams(prev => ({...prev, [key]: isNaN(val) ? '' : val}));
                   }}
                   className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary placeholder:text-slate-600"
                   placeholder={String(prop.default ?? '')}
                 />
              ) : Array.isArray((prop as any).options) && (prop as any).options.length > 0 ? (
                 <select
                   value={params[key] ?? prop.default ?? ''}
                   onChange={e => setParams(prev => ({...prev, [key]: e.target.value}))}
                   className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary cursor-pointer"
                 >
                   {(prop as any).options.map((opt: string) => (
                     <option key={opt} value={opt}>{opt}</option>
                   ))}
                 </select>
              ) : (
                 <input 
                   type="text"
                   value={params[key] || ''}
                   onChange={e => setParams(prev => ({...prev, [key]: e.target.value}))}
                   className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary placeholder:text-slate-600"
                   placeholder={String(prop.default ?? '')}
                 />
              )}
            </div>
          );
        })}

        {needsSelection && (
          <div className="mt-4 p-3 bg-indigo-950/20 border border-indigo-900/50 rounded-lg">
             <div className="flex items-start gap-2">
                <AlertCircle size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                <div>
                   <h4 className="text-xs font-bold text-indigo-300">Requires Waypoint Selection</h4>
                   <p className="text-[10px] text-indigo-400/70 mt-0.5">
                     You currently have <strong className="text-indigo-300">{selectedNodeIds.length}</strong> points selected.
                   </p>
                </div>
             </div>
          </div>
        )}

        {errorInfo && (
          <div className="mt-4 p-3 bg-red-950/20 border border-red-900/50 rounded-lg">
             <h4 className="text-xs font-bold text-red-500 mb-1">Execution Error</h4>
             <div className="text-[10px] font-mono text-red-400 whitespace-pre-wrap break-all overflow-auto max-h-32">
                {errorInfo}
             </div>
          </div>
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-slate-800">
        <button
          disabled={isExecuting || (needsSelection && selectedNodeIds.length === 0)}
          onClick={handleExecute}
          className="w-full h-9 flex items-center justify-center gap-2 bg-primary hover:bg-primary-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow transition-colors"
        >
          {isExecuting ? (
            <span className="animate-pulse">Running Generator...</span>
          ) : (
            <>
              <Play size={14} className={needsSelection && selectedNodeIds.length === 0 ? '' : 'fill-current'} /> 
              Generate Path
            </>
          )}
        </button>
      </div>
    </div>
  );
}
