import { useAppStore } from '../../stores/appStore';
import { OptionDef } from '../../types/store';
import { Eye, EyeOff } from 'lucide-react';

export function PropertiesPanel() {
  const selectedNodeIds = useAppStore(state => state.selectedNodeIds);
  const nodes = useAppStore(state => state.nodes);
  const optionsSchema = useAppStore(state => state.optionsSchema);
  const rootNodeIds = useAppStore(state => state.rootNodeIds);
  const updateNode = useAppStore(state => state.updateNode);
  const visibleAttributes = useAppStore(state => state.visibleAttributes);
  const toggleAttributeVisibility = useAppStore(state => state.toggleAttributeVisibility);
  const indexStartIndex = useAppStore(state => state.indexStartIndex);

// ... (skip down to the render) ...
// Actually, `multi_replace_file_content` or `replace_file_content`? 
// The file is under 200 lines, I can do target replacement.

  if (selectedNodeIds.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto w-full p-4">
        <div className="text-sm text-slate-400 italic mb-4">No item selected.</div>
      </div>
    );
  }

  // Update handler for single node
  const handleUpdate = (id: string, updates: any) => {
    updateNode(id, updates);
  };

  const isMultiSelection = selectedNodeIds.length > 1;
  const node = isMultiSelection ? null : nodes[selectedNodeIds[0]];
  if (!isMultiSelection && !node) return null;

  const nodeIndex = node ? rootNodeIds.indexOf(node.id) : -1;

  return (
    <div className="flex-1 overflow-y-auto w-full p-4">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-white mb-1">
          {isMultiSelection ? `Multiple Selected (${selectedNodeIds.length})` : 
            (node?.type === 'manual' ? `Waypoint [${nodeIndex >= 0 ? nodeIndex + indexStartIndex : '?'}]` : 'Generator Node')}
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
              <input 
                type="number" 
                value={isMultiSelection ? '' : (node?.transform?.x || 0)} 
                placeholder={isMultiSelection ? "Mixed" : ""}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  if (isNaN(val)) return;
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
              <input 
                type="number" 
                value={isMultiSelection ? '' : (node?.transform?.y || 0)} 
                placeholder={isMultiSelection ? "Mixed" : ""}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  if (isNaN(val)) return;
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
              <input 
                type="number" 
                value={isMultiSelection ? '' : (node?.transform?.z ?? 0)} 
                placeholder={isMultiSelection ? "Mixed" : ""}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  if (isNaN(val)) return;
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
              <input 
                type="number"
                step="0.01"
                value={isMultiSelection ? '' : (node?.transform ? Math.atan2(2.0 * ((node.transform.qw ?? 1) * (node.transform.qz || 0) + (node.transform.qx || 0) * (node.transform.qy || 0)), 1.0 - 2.0 * ((node.transform.qy || 0) * (node.transform.qy || 0) + (node.transform.qz || 0) * (node.transform.qz || 0))) : 0)} 
                placeholder={isMultiSelection ? "Mixed" : ""}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  if (isNaN(val)) return;
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
