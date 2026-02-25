import { useAppStore } from '../../stores/appStore';
import { OptionDef } from '../../types/store';
import { Eye, EyeOff, Play, Settings2, RefreshCcw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { BackendAPI } from '../../api/backend';
import { v4 as uuidv4 } from 'uuid';
import { NumericInput } from './NumericInput';

export function PropertiesPanel() {
  const selectedNodeIds = useAppStore(state => state.selectedNodeIds);
  const nodes = useAppStore(state => state.nodes);
  const optionsSchema = useAppStore(state => state.optionsSchema);
  const rootNodeIds = useAppStore(state => state.rootNodeIds);
  const updateNode = useAppStore(state => state.updateNode);
  const removeNodes = useAppStore(state => state.removeNodes);
  const visibleAttributes = useAppStore(state => state.visibleAttributes);
  const toggleAttributeVisibility = useAppStore(state => state.toggleAttributeVisibility);
  const indexStartIndex = useAppStore(state => state.indexStartIndex);
  const decimalPrecision = useAppStore(state => state.decimalPrecision);

  const plugins = useAppStore(state => state.plugins);
  const pluginSettings = useAppStore(state => state.pluginSettings);
  const globalPythonPath = useAppStore(state => state.globalPythonPath);

  const [genParams, setGenParams] = useState<Record<string, any>>({});
  const [interactionParams, setInteractionParams] = useState<Record<string, any>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  
  const updatePluginInteractionData = useAppStore(state => state.updatePluginInteractionData);

  const isMultiSelection = selectedNodeIds.length > 1;
  const node = isMultiSelection ? null : nodes[selectedNodeIds[0]];

  useEffect(() => {
    if (!isMultiSelection && node?.type === 'generator') {
      if (node.generator_params?.properties) setGenParams({ ...node.generator_params.properties });
      if (node.generator_params?.interaction_data) {
        const iData = { ...node.generator_params.interaction_data };
        setInteractionParams(iData);
        // Sync to global store so MapCanvas shows the preview
        Object.entries(iData).forEach(([key, val]) => {
          updatePluginInteractionData(key, val);
        });
      }
    } else {
      // Clear global preview when not editing a generator
      useAppStore.getState().clearPluginInteractionData();
    }
  }, [node?.id, isMultiSelection]);

  if (selectedNodeIds.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto w-full p-4">
        <div className="text-sm text-slate-400 italic mb-4">No item selected.</div>
      </div>
    );
  }

  const handleUpdate = (id: string, updates: any) => {
    updateNode(id, updates);
  };

  if (!isMultiSelection && !node) return null;

  const nodeIndex = node ? rootNodeIds.indexOf(node.id) : -1;

  // --------------------------------------------------------------------------
  // GENERATOR NODE UI
  // --------------------------------------------------------------------------
  if (!isMultiSelection && node?.type === 'generator') {
    const pluginId = node.plugin_id || '';
    const plugin = plugins[pluginId];
    
    const handleRegenerate = async () => {
      if (!plugin) return;
      setIsExecuting(true);
      try {
        const contextData = {
          ...node.generator_params,
          properties: genParams,
          interaction_data: interactionParams
        };

        let pythonPathToUse = globalPythonPath?.trim() || 'python3';
        if (plugin.manifest.type === 'python') {
           const setting = pluginSettings.find(s => s.id === plugin.id);
           if (setting && setting.pythonOverridePath && setting.pythonOverridePath.trim() !== '') {
              pythonPathToUse = setting.pythonOverridePath.trim();
           }
        }

        const resultingWaypoints = await BackendAPI.runPlugin(plugin, contextData, pythonPathToUse);
        
        if (Array.isArray(resultingWaypoints) && resultingWaypoints.length > 0) {
          // Remove old children
          if (node.children_ids && node.children_ids.length > 0) {
             removeNodes(node.children_ids);
          }

          // Add new children
          const newChildIds: string[] = [];
          resultingWaypoints.forEach(wp => {
             let qx = wp.qx ?? 0, qy = wp.qy ?? 0, qz = wp.qz ?? 0, qw = wp.qw ?? 1;
             if (typeof wp.yaw === 'number' && typeof wp.qw !== 'number') {
                 const halfYaw = wp.yaw / 2.0;
                 qz = Math.sin(halfYaw);
                 qw = Math.cos(halfYaw);
             }
             const id = uuidv4();
             newChildIds.push(id);
             useAppStore.getState().addNode({
               id,
               type: 'manual',
               transform: wp.transform || { x: wp.x ?? 0, y: wp.y ?? 0, qx, qy, qz, qw },
               options: wp.options || {}
             }, node.id); 
          });

          // Update generator params on the node
          handleUpdate(node.id, { generator_params: contextData });
        } else {
          alert("Plugin executed but returned 0 waypoints.");
        }
      } catch (err: any) {
        console.error('Re-generation failed:', err);
        alert(`Failed to re-generate:\n${err.toString()}`);
      } finally {
        setIsExecuting(false);
      }
    };

    return (
      <div className="flex-1 overflow-y-auto w-full p-4 flex flex-col h-full">
        <div className="mb-4 pb-3 border-b border-slate-700/50">
          <h2 className="text-sm font-bold text-emerald-400 mb-1 flex items-center gap-2">
            <Settings2 size={16} /> Generator Node
          </h2>
          <p className="text-[11px] text-slate-500 font-mono break-all">{node.id}</p>
        </div>

        {plugin ? (
          <div className="space-y-4 flex-1">
            <h3 className="text-xs font-semibold text-slate-300 bg-slate-800/50 p-2 rounded">
               {plugin.manifest.name}
            </h3>

            {plugin.manifest.properties?.map((prop, idx) => {
              const key = prop.name;
              if (!key) return null;
              return (
                <div key={idx} className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">{prop.label || key}</label>
                  {prop.type === 'boolean' ? (
                     <label className="flex items-center gap-3 mt-1 bg-slate-900 border border-slate-700 p-2 rounded cursor-pointer">
                       <input 
                         type="checkbox" 
                         checked={!!genParams[key]}
                         onChange={(e) => setGenParams(prev => ({...prev, [key]: e.target.checked}))}
                         className="rounded bg-slate-800 border-slate-600 text-primary w-4 h-4 cursor-pointer" 
                       />
                       <span className="text-xs text-slate-300">Enabled</span>
                     </label>
                  ) : prop.type === 'integer' || prop.type === 'float' ? (
                     <input 
                       type="number"
                       step={prop.type === 'float' ? 'any' : '1'}
                       value={genParams[key] ?? ''}
                       onChange={e => {
                         const val = prop.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
                         setGenParams(prev => ({...prev, [key]: isNaN(val) ? '' : val}));
                       }}
                       className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary placeholder:text-slate-600"
                     />
                  ) : (
                     <input 
                       type="text"
                       value={genParams[key] || ''}
                       onChange={e => setGenParams(prev => ({...prev, [key]: e.target.value}))}
                       className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                     />
                  )}
                </div>
              );
            })}

            {plugin.manifest.inputs?.map((inp, idx) => {
              const key = inp.name || inp.id;
              if (!key) return null;
              
              if (inp.type === 'point') {
                const point = interactionParams[key];
                if (!point) return null;
                
                const pqw = point.qw ?? 1, pqz = point.qz ?? 0, pqx = point.qx ?? 0, pqy = point.qy ?? 0;
                const yaw = Math.atan2(2.0 * (pqw * pqz + pqx * pqy), 1.0 - 2.0 * (pqy * pqy + pqz * pqz));

                return (
                  <div key={`param-int-${idx}`} className="space-y-2 pt-3 border-t border-slate-700/50">
                    <label className="text-xs font-semibold text-pink-400">{inp.label || key} <span className="text-[10px] text-slate-500 font-normal">(Point Input)</span></label>
                    <div className="grid grid-cols-3 gap-2">
                       <div>
                         <label className="block text-[10px] text-slate-500 mb-0.5">X (m)</label>
                         <NumericInput 
                           value={point.x ?? 0}
                           precision={decimalPrecision}
                           onChange={val => {
                             setInteractionParams(prev => ({...prev, [key]: {...prev[key], x: val}}));
                             updatePluginInteractionData(key, { ...point, x: val });
                           }}
                           className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-pink-500"
                         />
                       </div>
                       <div>
                         <label className="block text-[10px] text-slate-500 mb-0.5">Y (m)</label>
                         <NumericInput 
                           value={point.y ?? 0}
                           precision={decimalPrecision}
                           onChange={val => {
                             setInteractionParams(prev => ({...prev, [key]: {...prev[key], y: val}}));
                             updatePluginInteractionData(key, { ...point, y: val });
                           }}
                           className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-pink-500"
                         />
                       </div>
                       <div>
                         <label className="block text-[10px] text-slate-500 mb-0.5">Yaw (rad)</label>
                         <NumericInput 
                           step="0.01"
                           value={yaw}
                           precision={decimalPrecision}
                           onChange={val => {
                             const qz = Math.sin(val / 2);
                             const qw = Math.cos(val / 2);
                             setInteractionParams(prev => ({...prev, [key]: {...prev[key], qx: 0, qy: 0, qz, qw}}));
                             updatePluginInteractionData(key, { ...point, qx: 0, qy: 0, qz, qw });
                           }}
                           className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-pink-500"
                         />
                       </div>
                    </div>
                  </div>
                );
              }
              
              if (inp.type === 'rectangle') {
                const rectData = interactionParams[key];
                if (!rectData?.center) return null;
                
                return (
                  <div key={`param-int-${idx}`} className="space-y-2 pt-3 border-t border-slate-700/50">
                    <label className="text-xs font-semibold text-pink-400">{inp.label || key} <span className="text-[10px] text-slate-500 font-normal">(Rectangle)</span></label>
                    <div className="grid grid-cols-2 gap-2">
                       <div>
                         <label className="block text-[10px] text-slate-500 mb-0.5">Center X</label>
                         <NumericInput 
                           value={rectData.center.x ?? 0}
                           precision={decimalPrecision}
                           onChange={val => {
                             const updated = {...rectData, center: {...rectData.center, x: val}};
                             setInteractionParams(prev => ({...prev, [key]: updated}));
                             updatePluginInteractionData(key, updated);
                           }}
                           className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-pink-500"
                         />
                       </div>
                       <div>
                         <label className="block text-[10px] text-slate-500 mb-0.5">Center Y</label>
                         <NumericInput 
                           value={rectData.center.y ?? 0}
                           precision={decimalPrecision}
                           onChange={val => {
                             const updated = {...rectData, center: {...rectData.center, y: val}};
                             setInteractionParams(prev => ({...prev, [key]: updated}));
                             updatePluginInteractionData(key, updated);
                           }}
                           className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-pink-500"
                         />
                       </div>
                       <div>
                         <label className="block text-[10px] text-slate-500 mb-0.5">Width</label>
                         <NumericInput 
                           value={rectData.width ?? 0}
                           precision={decimalPrecision}
                           onChange={val => {
                             const updated = {...rectData, width: Math.max(0, val)};
                             setInteractionParams(prev => ({...prev, [key]: updated}));
                             updatePluginInteractionData(key, updated);
                           }}
                           className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-pink-500"
                         />
                       </div>
                       <div>
                         <label className="block text-[10px] text-slate-500 mb-0.5">Height</label>
                         <NumericInput 
                           value={rectData.height ?? 0}
                           precision={decimalPrecision}
                           onChange={val => {
                             const updated = {...rectData, height: Math.max(0, val)};
                             setInteractionParams(prev => ({...prev, [key]: updated}));
                             updatePluginInteractionData(key, updated);
                           }}
                           className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-pink-500"
                         />
                       </div>
                       <div className="col-span-2">
                         <label className="block text-[10px] text-slate-500 mb-0.5">Yaw (degrees)</label>
                         <NumericInput 
                           value={((rectData.yaw ?? 0) * 180 / Math.PI)}
                           precision={1}
                           onChange={val => {
                             const updated = {...rectData, yaw: val * Math.PI / 180};
                             setInteractionParams(prev => ({...prev, [key]: updated}));
                             updatePluginInteractionData(key, updated);
                           }}
                           className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-pink-500"
                         />
                       </div>
                    </div>
                  </div>
                );
              }
              
              return null;
            })}

            <div className="pt-4 mt-6 border-t border-slate-800">
              <button
                disabled={isExecuting}
                onClick={handleRegenerate}
                className="w-full h-9 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold rounded-lg shadow transition-colors"
              >
                {isExecuting ? <RefreshCcw size={14} className="animate-spin" /> : <Play size={14} className="fill-current" />}
                {isExecuting ? 'Re-Generating...' : 'Re-Generate Path'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-red-400 italic bg-red-950/20 p-3 rounded border border-red-900/50">
            Plugin "{pluginId}" is no longer available or loaded. Cannot edit parameters.
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // MANUAL NODE UI (Original)
  // --------------------------------------------------------------------------
  return (
    <div className="flex-1 overflow-y-auto w-full p-4">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-white mb-1">
          {isMultiSelection ? `Multiple Selected (${selectedNodeIds.length})` : `Waypoint [${nodeIndex >= 0 ? nodeIndex + indexStartIndex : '?'}]`}
        </h2>
        {!isMultiSelection && <p className="text-xs text-slate-500 font-mono break-all">{node?.id}</p>}
      </div>

      <div className="space-y-4">
        {/* Index Group */}
        <div className="space-y-2 relative">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Index</h3>
            <button 
              onClick={() => toggleAttributeVisibility('index')}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              title="Toggle Index on Canvas"
            >
              {visibleAttributes.includes('index') ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>
          <div className="bg-slate-900 border border-slate-700/50 rounded px-2 py-1 text-sm text-slate-300 font-mono">
            {isMultiSelection ? "Mixed Selection" : (nodeIndex >= 0 ? String(nodeIndex + indexStartIndex) : '-')}
          </div>
        </div>

        {/* Transform Group */}
        <div className="space-y-2 relative pt-2">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Transform (World)</h3>
            <button 
              onClick={() => toggleAttributeVisibility('transform')}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              title="Toggle Transform on Canvas"
            >
              {visibleAttributes.includes('transform') ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">X (m)</label>
              <NumericInput 
                value={isMultiSelection ? 0 : (node?.transform?.x ?? 0)} 
                precision={decimalPrecision}
                placeholder={isMultiSelection ? "Mixed" : ""}
                onChange={val => {
                  if (isMultiSelection) {
                    selectedNodeIds.forEach(id => {
                      const n = nodes[id];
                      if(n && n.transform) handleUpdate(id, { transform: { ...n.transform, x: val }});
                    });
                  } else {
                    handleUpdate(node!.id, { transform: { ...node!.transform!, x: val }})
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-primary placeholder:text-slate-600" 
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Y (m)</label>
              <NumericInput 
                value={isMultiSelection ? 0 : (node?.transform?.y ?? 0)} 
                precision={decimalPrecision}
                placeholder={isMultiSelection ? "Mixed" : ""}
                onChange={val => {
                  if (isMultiSelection) {
                    selectedNodeIds.forEach(id => {
                      const n = nodes[id];
                      if(n && n.transform) handleUpdate(id, { transform: { ...n.transform, y: val }});
                    });
                  } else {
                    handleUpdate(node!.id, { transform: { ...node!.transform!, y: val }})
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-primary placeholder:text-slate-600" 
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Z (m)</label>
              <NumericInput 
                value={isMultiSelection ? 0 : (node?.transform?.z ?? 0)} 
                precision={decimalPrecision}
                placeholder={isMultiSelection ? "Mixed" : ""}
                onChange={val => {
                  if (isMultiSelection) {
                    selectedNodeIds.forEach(id => {
                      const n = nodes[id];
                      if(n && n.transform) handleUpdate(id, { transform: { ...n.transform, z: val }});
                    });
                  } else {
                    handleUpdate(node!.id, { transform: { ...node!.transform!, z: val }})
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-primary placeholder:text-slate-600" 
              />
            </div>
            <div className="col-span-3">
              <label className="block text-xs text-slate-500 mb-1">Yaw (rad)</label>
              <NumericInput 
                step="0.01"
                precision={decimalPrecision}
                value={isMultiSelection ? 0 : (node?.transform ? Math.atan2(2.0 * ((node.transform.qw ?? 1) * (node.transform.qz || 0) + (node.transform.qx || 0) * (node.transform.qy || 0)), 1.0 - 2.0 * ((node.transform.qy || 0) * (node.transform.qy || 0) + (node.transform.qz || 0) * (node.transform.qz || 0))) : 0)} 
                placeholder={isMultiSelection ? "Mixed" : ""}
                onChange={val => {
                  const halfYaw = val / 2.0;
                  const qz = Math.sin(halfYaw);
                  const qw = Math.cos(halfYaw);

                  if (isMultiSelection) {
                    selectedNodeIds.forEach(id => {
                      const n = nodes[id];
                      if(n && n.transform) handleUpdate(id, { transform: { ...n.transform, qx: 0, qy: 0, qz, qw }});
                    });
                  } else {
                    handleUpdate(node!.id, { transform: { ...node!.transform!, qx: 0, qy: 0, qz, qw }})
                  }
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-primary placeholder:text-slate-600" 
              />
            </div>
          </div>
        </div>

        {/* Custom Options Group */}
        <div className="space-y-2 pt-4 border-t border-slate-700">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between items-center">
            Custom Options
          </h3>
          
          {!optionsSchema ? (
            <div className="text-xs text-slate-500 italic p-2 bg-slate-900 rounded border border-slate-800">
              No schema loaded. Load a schema (YAML) from the Toolbar.
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              {optionsSchema.options.map((opt: OptionDef) => {
                const nodeOptVal = isMultiSelection ? '' : (node?.options?.[opt.name] ?? opt.default ?? '');
                
                const handleChange = (val: string | number | boolean | Array<string | number | boolean>) => {
                  const currentState = useAppStore.getState();
                  if (isMultiSelection) {
                    selectedNodeIds.forEach(id => {
                      const n = currentState.nodes[id];
                      if (n) {
                        handleUpdate(id, { 
                          options: { ...(n.options || {}), [opt.name]: val }
                        });
                      }
                    });
                  } else {
                    const n = currentState.nodes[node!.id];
                    handleUpdate(node!.id, { 
                      options: { ...(n.options || {}), [opt.name]: val }
                    });
                  }
                };

                return (
                  <div key={opt.name}>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-slate-500">
                        {opt.label || opt.name} <span className="opacity-50 text-[10px] ml-1 uppercase">({opt.type})</span>
                      </label>
                      <button 
                        onClick={() => toggleAttributeVisibility(`options.${opt.name}`)}
                        className="text-slate-500 hover:text-slate-300 transition-colors"
                        title={`Toggle ${opt.name} on Canvas`}
                      >
                        {visibleAttributes.includes(`options.${opt.name}`) ? <Eye size={12} /> : <EyeOff size={12} />}
                      </button>
                    </div>
                    
                    {opt.type === 'list' ? (
                      <input 
                        type="text" 
                        value={Array.isArray(nodeOptVal) ? nodeOptVal.join(', ') : String(nodeOptVal || '')}
                        placeholder={isMultiSelection ? "Mixed" : (opt.default !== undefined ? (Array.isArray(opt.default) ? opt.default.join(', ') : String(opt.default)) : 'csv')}
                        onChange={e => {
                          const rawArr = e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
                          let parsedArr: any[] = rawArr;
                          if (opt.item_type === 'float') {
                            parsedArr = rawArr.map(s => parseFloat(s)).filter(n => !isNaN(n));
                          } else if (opt.item_type === 'integer') {
                            parsedArr = rawArr.map(s => parseInt(s, 10)).filter(n => !isNaN(n));
                          } else if (opt.item_type === 'boolean') {
                            parsedArr = rawArr.map(s => s === 'true' || s === '1');
                          }
                          handleChange(parsedArr);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-primary placeholder:text-slate-600" 
                      />
                    ) : opt.type === 'string' && opt.enum_values && opt.enum_values.length > 0 ? (
                      <select
                        value={String(nodeOptVal)}
                        onChange={e => handleChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-primary"
                      >
                        {isMultiSelection && <option value="" disabled hidden>Mixed</option>}
                        {opt.enum_values.map((v: string) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    ) : (opt.type === 'integer' || opt.type === 'float') ? (
                      <input 
                        type="number"
                        step={opt.type === 'float' ? "0.1" : "1"}
                        value={String(nodeOptVal)}
                        placeholder={isMultiSelection ? "Mixed" : String(opt.default || '')}
                        onChange={e => {
                          const val = opt.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
                          if (!isNaN(val)) handleChange(val);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-primary placeholder:text-slate-600" 
                      />
                    ) : opt.type === 'boolean' ? (
                      <input 
                        type="checkbox"
                        checked={Boolean(nodeOptVal)}
                        onChange={e => handleChange(e.target.checked)}
                        className="rounded bg-slate-900 border-slate-700 text-primary"
                      />
                    ) : (
                      <input 
                        type="text" 
                        value={String(nodeOptVal)}
                        placeholder={isMultiSelection ? "Mixed" : String(opt.default || '')}
                        onChange={e => handleChange(e.target.value)}
                        className={`w-full bg-slate-900 border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-primary placeholder:text-slate-600 ${
                          String(nodeOptVal).trim() === '' && !isMultiSelection ? 'border-amber-500/50' : 'border-slate-700'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
