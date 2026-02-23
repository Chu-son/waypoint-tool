import { useAppStore } from '../../stores/appStore';

export function WaypointTree() {
  const rootNodeIds = useAppStore(state => state.rootNodeIds);
  const nodes = useAppStore(state => state.nodes);
  const selectedNodeIds = useAppStore(state => state.selectedNodeIds);
  const selectNodes = useAppStore(state => state.selectNodes);

  return (
    <div className="flex-1 overflow-y-auto w-full">
      {rootNodeIds.length === 0 ? (
        <div className="text-sm text-slate-500 italic p-4 text-center">
          No items yet. Drag to create points on the map.
        </div>
      ) : (
        <ul className="p-2 space-y-1">
          {rootNodeIds.map(id => {
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
                className={`px-3 py-2 rounded text-sm cursor-pointer border transition-colors ${
                  isSelected 
                    ? 'bg-blue-900/50 border-blue-500 text-white' 
                    : 'bg-slate-800 border-transparent hover:bg-slate-700 hover:border-slate-600 text-slate-300'
                }`}
              >
                {node.type === 'manual' ? '🎯' : '🔲'} Waypoint <span className={`opacity-50 text-xs ml-2 ${isSelected ? 'text-blue-200' : ''}`}>{id.slice(0, 6)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
