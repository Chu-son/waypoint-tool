import { useAppStore } from '../../stores/appStore';
import { ChevronUp, ChevronDown } from 'lucide-react';

export function WaypointTree() {
  const rootNodeIds = useAppStore(state => state.rootNodeIds);
  const nodes = useAppStore(state => state.nodes);
  const selectedNodeIds = useAppStore(state => state.selectedNodeIds);
  const selectNodes = useAppStore(state => state.selectNodes);
  const reorderNodes = useAppStore(state => state.reorderNodes);
  const indexStartIndex = useAppStore(state => state.indexStartIndex);

  return (
    <div className="flex-1 overflow-y-auto w-full">
      {rootNodeIds.length === 0 ? (
        <div className="text-sm text-slate-500 italic p-4 text-center">
          No items yet. Drag to create points on the map.
        </div>
      ) : (
        <ul className="p-2 space-y-1">
          {rootNodeIds.map((id, index) => {
            const node = nodes[id];
            if (!node) return null;
            const isSelected = selectedNodeIds.includes(id);

            return (
              <li 
                key={id}
                onClick={(e) => {
                  e.stopPropagation();
                  selectNodes([id], e.shiftKey || e.metaKey);
                }}
                className={`px-3 py-2 rounded text-sm group border transition-colors cursor-pointer ${
                  isSelected 
                    ? 'bg-blue-900/50 border-blue-500 text-white' 
                    : 'bg-slate-800 border-transparent hover:bg-slate-700 hover:border-slate-600 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="opacity-75 font-mono text-xs mr-2">[{index + indexStartIndex}]</span>
                    {node.type === 'manual' ? '🎯' : '🔲'} Waypoint
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`opacity-50 text-xs ${isSelected ? 'text-blue-200' : ''}`}>{id.slice(0, 6)}</span>
                    <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); if (index > 0) reorderNodes(index, index - 1); }}
                        disabled={index === 0}
                        className="text-slate-500 hover:text-white disabled:opacity-30 disabled:hover:text-slate-500"
                        title="Move Up"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); if (index < rootNodeIds.length - 1) reorderNodes(index, index + 1); }}
                        disabled={index === rootNodeIds.length - 1}
                        className="text-slate-500 hover:text-white disabled:opacity-30 disabled:hover:text-slate-500"
                        title="Move Down"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
