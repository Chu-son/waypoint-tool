import { X, Save, Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { save } from '@tauri-apps/plugin-dialog';
import { BackendAPI } from '../../api/backend';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const exportTemplates = useAppStore(state => state.exportTemplates);
  const rootNodeIds = useAppStore(state => state.rootNodeIds);
  const nodes = useAppStore(state => state.nodes);
  const lastDirectory = useAppStore(state => state.lastDirectory);
  const setLastDirectory = useAppStore(state => state.setLastDirectory);
  const indexStartIndex = useAppStore(state => state.indexStartIndex);

  const [includeImage, setIncludeImage] = useState(false);
  const [selectedFormatLabel, setSelectedFormatLabel] = useState<string>('YAML Document');

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
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
        
        // Find extension matching what they selected if missing
        if (!hasValidExt) {
          if (selectedFormatLabel === 'JSON Document') finalPath += '.json';
          else if (selectedFormatLabel === 'YAML Document') finalPath += '.yaml';
          else {
             const t = exportTemplates.find(x => x.name === selectedFormatLabel);
             if (t) finalPath += `.${t.extension}`;
             else finalPath += '.yaml';
          }
        }

        // Basic directory extraction
        const lastSlash = Math.max(finalPath.lastIndexOf('/'), finalPath.lastIndexOf('\\'));
        if (lastSlash > -1) setLastDirectory(finalPath.substring(0, lastSlash));

        const optionsSchema = useAppStore.getState().optionsSchema;

        const waypointsToExport = rootNodeIds.map((id, index) => {
          const node = nodes[id];
          if (!node) return null;
          
          // Hydrate options with schema defaults so templates can always access them
          const fullOptions: Record<string, any> = {};
          if (optionsSchema && optionsSchema.options) {
            optionsSchema.options.forEach((opt: any) => {
              fullOptions[opt.name] = (node.options && node.options[opt.name] !== undefined)
                ? node.options[opt.name]
                : opt.default;
            });
          }
          if (node.options) {
            Object.keys(node.options).forEach(k => {
              if (fullOptions[k] === undefined) fullOptions[k] = node.options![k];
            });
          }

          const qx = node.transform?.qx || 0;
          const qy = node.transform?.qy || 0;
          const qz = node.transform?.qz || 0;
          const qw = node.transform?.qw ?? 1;
          const yawVal = Math.atan2(2.0 * (qw * qz + qx * qy), 1.0 - 2.0 * (qy * qy + qz * qz));

          return {
            index: index + indexStartIndex,
            id: node.id,
            type: node.type,
            x: node.transform?.x ?? 0,
            y: node.transform?.y ?? 0,
            z: node.transform?.z ?? 0,
            yaw: yawVal,
            qx,
            qy,
            qz,
            qw,
            options: fullOptions
          };
        }).filter(n => n !== null);

        const ext = finalPath.split('.').pop()?.toLowerCase() || '';
        const matchedTemplate = exportTemplates.find(t => t.extension.toLowerCase() === ext);

        // Extract image if requested
        let imageDataB64 = undefined;
        if (includeImage) {
          useAppStore.setState({ shouldFitToMaps: Date.now() });
          await new Promise(r => setTimeout(r, 800)); // Give Pixi ample time to re-render

          const canvas = document.querySelector('canvas');
          if (canvas) {
            imageDataB64 = canvas.toDataURL('image/png').split(',')[1]; // remove data prefix
          }
        }

        await BackendAPI.exportWaypoints(finalPath, waypointsToExport as any[], matchedTemplate?.content, imageDataB64);
        
        alert("エクスポートが完了しました。");
        onClose();
      }
    } catch (err) {
      console.error("Failed to export waypoints:", err);
      alert(`エクスポートに失敗しました。\nエラー詳細: ${String(err)}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/80 shrink-0">
          <h2 className="text-lg font-bold text-slate-200">Export Options</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
               <label className="text-sm font-medium text-slate-300 block">Default Output Format</label>
               <select 
                 value={selectedFormatLabel} 
                 onChange={e => setSelectedFormatLabel(e.target.value)}
                 className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200"
               >
                 <option value="YAML Document">YAML (.yaml)</option>
                 <option value="JSON Document">JSON (.json)</option>
                 {exportTemplates.map(t => (
                   <option key={t.id} value={t.name}>{t.name} (.{t.extension})</option>
                 ))}
               </select>
               <p className="text-xs text-slate-500">This hints the file browser for default extension. You can still choose later.</p>
            </div>

            <div className="pt-4 border-t border-slate-700">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center pt-0.5">
                  <input
                    type="checkbox"
                    checked={includeImage}
                    onChange={(e) => setIncludeImage(e.target.checked)}
                    className="peer w-5 h-5 appearance-none border-2 border-slate-600 rounded-md bg-slate-900 checked:bg-primary checked:border-primary transition-colors cursor-pointer"
                  />
                  <ImageIcon size={14} className="absolute text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                    Include Canvas Image
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Saves a .png image of the current visible canvas (Map + Waypoints with visible attributes) alongside the exported file.
                  </p>
                </div>
              </label>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button onClick={handleExport} className="px-5 py-2 bg-primary hover:bg-blue-500 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20">
              <Save size={16} /> Choose Path & Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
