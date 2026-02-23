import { X, Plus, Trash2, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { OptionDef } from '../../types/store';
import { v4 as uuidv4 } from 'uuid';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const defaultMapOpacity = useAppStore(state => state.defaultMapOpacity);
  // Note: We use the Zustand store directly to modify defaultMapOpacity for simplicity without adding a dedicated action, or we can use set
  const setDefaultMapOpacity = (opacity: number) => useAppStore.setState({ defaultMapOpacity: opacity, isDirty: true });
  const lastDirectory = useAppStore(state => state.lastDirectory);
  
  const globalOptionsSchema = useAppStore(state => state.optionsSchema);
  const setGlobalOptionsSchema = useAppStore(state => state.setOptionsSchema);
  const globalExportTemplates = useAppStore(state => state.exportTemplates);
  
  const addExportTemplate = useAppStore(state => state.addExportTemplate);
  const updateExportTemplate = useAppStore(state => state.updateExportTemplate);
  const removeExportTemplate = useAppStore(state => state.removeExportTemplate);

  type TabType = 'general' | 'options' | 'export' | 'plugins';
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const plugins = useAppStore(state => state.plugins);
  const [localOptions, setLocalOptions] = useState<OptionDef[]>([]);

  // Sync when opened
  useEffect(() => {
    if (isOpen) {
      setLocalOptions(globalOptionsSchema?.options || []);
    }
  }, [isOpen, globalOptionsSchema]);

  if (!isOpen) return null;

  const handleSaveOptions = () => {
    setGlobalOptionsSchema({ options: localOptions });
  };

  const handleAddOption = () => {
    setLocalOptions([...localOptions, { name: 'new_option', label: 'New Option', type: 'string', default: '' }]);
  };

  const handleUpdateOption = (index: number, updates: Partial<OptionDef>) => {
    const newOptions = [...localOptions];
    newOptions[index] = { ...newOptions[index], ...updates };
    setLocalOptions(newOptions);
  };

  const handleRemoveOption = (index: number) => {
    setLocalOptions(localOptions.filter((_, i) => i !== index));
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/80 shrink-0">
          <h2 className="text-lg font-bold text-slate-200">User Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Tabs Sidebar */}
          <div className="w-48 bg-slate-900 border-r border-slate-700 p-2 shrink-0">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('options')}
              className={`w-full text-left px-4 py-2 mt-1 rounded-lg text-sm font-medium transition-colors ${activeTab === 'options' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              Option Schema
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`w-full text-left px-4 py-2 mt-1 rounded-lg text-sm font-medium transition-colors ${activeTab === 'export' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            >
              Export Templates
            </button>
          </div>
          
          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'general' && (
              <div className="space-y-6 max-w-lg">
                <div className="space-y-2">
                  <label className="flex justify-between text-sm font-medium text-slate-300">
                    <span>Default Map Opacity</span>
                    <span>{Math.round(defaultMapOpacity * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={defaultMapOpacity}
                    onChange={(e) => setDefaultMapOpacity(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-slate-500">The default transparency applied to newly loaded map layers.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Last Used Directory</label>
                  <div className="p-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-400 font-mono break-all line-clamp-2">
                    {lastDirectory || 'None'}
                  </div>
                  <p className="text-xs text-slate-500">Remembered location for Save/Open dialogs across sessions.</p>
                </div>
              </div>
            )}

            {activeTab === 'options' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-md font-bold text-slate-200">Waypoint Options Schema</h3>
                    <p className="text-xs text-slate-500 mt-1">Define custom properties that can be attached to waypoints.</p>
                  </div>
                  <div className="space-x-2">
                    <button onClick={handleAddOption} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded flex items-center gap-1 transition-colors">
                      <Plus size={14} /> Add Field
                    </button>
                    <button onClick={handleSaveOptions} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded flex items-center gap-1 transition-colors">
                      <Save size={14} /> Apply Schema
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {localOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2 items-start bg-slate-900 p-3 rounded-lg border border-slate-700/50">
                      <div className="flex-1 space-y-3">
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-1">
                            <label className="text-xs font-medium text-slate-400">Key Name</label>
                            <input type="text" value={opt.name} onChange={(e) => handleUpdateOption(i, { name: e.target.value })} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200" placeholder="e.g. velocity" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <label className="text-xs font-medium text-slate-400">Display Label</label>
                            <input type="text" value={opt.label} onChange={(e) => handleUpdateOption(i, { label: e.target.value })} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200" placeholder="e.g. Target Speed" />
                          </div>
                          <div className="w-32 space-y-1">
                            <label className="text-xs font-medium text-slate-400">Type</label>
                            <select value={opt.type} onChange={(e) => handleUpdateOption(i, { type: e.target.value })} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200">
                              <option value="string">String</option>
                              <option value="float">Float</option>
                              <option value="integer">Integer</option>
                              <option value="boolean">Boolean</option>
                              <option value="list">List (Array)</option>
                            </select>
                          </div>
                          <div className="w-32 space-y-1">
                            <label className="text-xs font-medium text-slate-400">Default Value</label>
                            <input 
                              type="text" 
                              value={opt.default !== undefined ? (Array.isArray(opt.default) ? opt.default.join(', ') : String(opt.default)) : ''} 
                              onChange={(e) => {
                                if (opt.type === 'list') {
                                  const rawArr = e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
                                  let parsedArr: any[] = rawArr;
                                  if (opt.item_type === 'float') {
                                    parsedArr = rawArr.map(s => parseFloat(s)).filter(n => !isNaN(n));
                                  } else if (opt.item_type === 'integer') {
                                    parsedArr = rawArr.map(s => parseInt(s, 10)).filter(n => !isNaN(n));
                                  } else if (opt.item_type === 'boolean') {
                                    parsedArr = rawArr.map(s => s === 'true' || s === '1');
                                  }
                                  handleUpdateOption(i, { default: parsedArr });
                                } else {
                                  handleUpdateOption(i, { default: e.target.value });
                                }
                              }} 
                              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200" 
                              placeholder={opt.type === 'list' ? "csv" : "0.0"} 
                            />
                          </div>
                        </div>
                        {opt.type === 'list' && (
                          <div className="flex gap-2 mt-2">
                            <div className="w-48 space-y-1">
                              <label className="text-xs font-medium text-slate-400">List Item Type</label>
                              <select 
                                value={opt.item_type || 'string'} 
                                onChange={(e) => handleUpdateOption(i, { item_type: e.target.value })} 
                                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200"
                              >
                                <option value="string">String</option>
                                <option value="float">Float</option>
                                <option value="integer">Integer</option>
                                <option value="boolean">Boolean</option>
                              </select>
                            </div>
                          </div>
                        )}
                        {opt.type === 'string' && (
                          <div className="flex gap-2 mt-2">
                            <div className="flex-1 space-y-1">
                              <label className="text-xs font-medium text-slate-400">Dropdown Enums (csv, optional)</label>
                              <input 
                                type="text" 
                                value={opt.enum_values ? opt.enum_values.join(', ') : ''} 
                                onChange={(e) => handleUpdateOption(i, { enum_values: e.target.value.split(',').map(s => s.trim()).filter(s => s.length > 0) })} 
                                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200" 
                                placeholder="e.g. none, docking" 
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <button onClick={() => handleRemoveOption(i)} className="p-1.5 mt-5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {localOptions.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-sm bg-slate-900 rounded-lg border border-dashed border-slate-700">
                      No custom options defined. Click "Add Field" to create one.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'export' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-md font-bold text-slate-200">Custom Export Templates</h3>
                    <p className="text-xs text-slate-500 mt-1">Define Handlebars templates for custom waypoint export formats.</p>
                  </div>
                  <button onClick={() => addExportTemplate({ id: uuidv4(), name: 'New Template', extension: 'txt', content: '{{#each waypoints}}\nwp_{{index}}:\n  x: {{pose.x}}\n  y: {{pose.y}}\n  yaw: {{pose.yaw}}\n{{/each}}' })} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded flex items-center gap-1 transition-colors">
                    <Plus size={14} /> New Template
                  </button>
                </div>

                <div className="space-y-4">
                  {globalExportTemplates.map((template) => (
                    <div key={template.id} className="bg-slate-900 rounded-lg border border-slate-700/50 flex flex-col overflow-hidden">
                      <div className="flex items-center gap-3 p-3 border-b border-slate-800 bg-slate-800/30">
                        <input type="text" value={template.name} onChange={(e) => updateExportTemplate(template.id, { name: e.target.value })} className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm font-bold text-slate-200" placeholder="Template Name" />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-medium">Ext:</span>
                          <input type="text" value={template.extension} onChange={(e) => updateExportTemplate(template.id, { extension: e.target.value })} className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200" placeholder="yaml" />
                        </div>
                        <button onClick={() => removeExportTemplate(template.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors ml-2">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="p-3">
                        <textarea
                          value={template.content}
                          onChange={(e) => updateExportTemplate(template.id, { content: e.target.value })}
                          className="w-full h-40 bg-slate-950 border border-slate-800 rounded p-3 text-xs font-mono text-slate-300 resize-y focus:outline-none focus:border-primary/50"
                          placeholder="{{#each waypoints}}..."
                          spellCheck="false"
                        />
                      </div>
                    </div>
                  ))}
                  {globalExportTemplates.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-sm bg-slate-900 rounded-lg border border-dashed border-slate-700">
                      No custom templates defined.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'plugins' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-md font-bold text-slate-200">Installed Plugins</h3>
                  <p className="text-xs text-slate-500 mt-1">Generator plugins loaded from the application data directory.</p>
                </div>
                
                <div className="space-y-3">
                  {Object.values(plugins).length === 0 ? (
                    <div className="text-sm text-slate-500 italic p-4 bg-slate-900 rounded-lg text-center">
                      No plugins installed.
                    </div>
                  ) : (
                    Object.values(plugins).map((plugin, i) => (
                      <div key={i} className="bg-slate-900 border border-slate-700/50 p-4 rounded-lg flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-slate-200">{plugin.manifest.name}</span>
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wide">
                              {plugin.manifest.type}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 font-mono">v{plugin.manifest.version || '0.1.0'}</span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono break-all mt-1">{plugin.folder_path}</p>
                        
                        {plugin.manifest.inputs && plugin.manifest.inputs.length > 0 && (
                          <div className="mt-2 text-xs flex gap-2 flex-wrap">
                            <span className="text-slate-500 py-0.5">Requirements:</span>
                            {plugin.manifest.inputs.map(input => (
                              <span key={input.id} className="text-blue-400 bg-blue-950/30 px-1.5 py-0.5 rounded border border-blue-900/50">
                                {input.label} ({input.type})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
