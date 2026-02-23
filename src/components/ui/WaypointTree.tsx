import { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import { ChevronUp, ChevronDown, ChevronRight, Layers } from 'lucide-react';

export function WaypointTree() {
  const rootNodeIds = useAppStore(state => state.rootNodeIds);
  const nodes = useAppStore(state => state.nodes);
  const plugins = useAppStore(state => state.plugins);
  const selectedNodeIds = useAppStore(state => state.selectedNodeIds);
  const selectNodes = useAppStore(state => state.selectNodes);
  const reorderNodes = useAppStore(state => state.reorderNodes);
  const indexStartIndex = useAppStore(state => state.indexStartIndex);

  const [expandedGenerators, setExpandedGenerators] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedGenerators(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Calculate a flat global index for sequential numbering
  let globalIndex = 0;

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

            // Generator node: collapsible group
            if (node.type === 'generator') {
              const isSelected = selectedNodeIds.includes(id);
              const isExpanded = expandedGenerators.has(id);
              const childIds = node.children_ids || [];
              const pluginName = node.plugin_id && plugins[node.plugin_id]
                ? plugins[node.plugin_id].manifest.name
                : 'Generator';
              const startIdx = globalIndex;
              globalIndex += childIds.length;

              return (
                <li key={id}>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      selectNodes([id], e.shiftKey || e.metaKey);
                    }}
                    className={`px-3 py-2 rounded text-sm group border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-900/50 border-emerald-500 text-white'
                        : 'bg-slate-800 border-transparent hover:bg-slate-700 hover:border-slate-600 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpand(id); }}
                          className="text-slate-400 hover:text-white transition-colors"
                        >
                          <ChevronRight size={14} className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                        <Layers size={14} className="text-emerald-400" />
                        <span className="font-medium text-xs">{pluginName}</span>
                        <span className="text-[10px] text-slate-500 ml-1">({childIds.length} pts)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`opacity-50 text-xs ${isSelected ? 'text-emerald-200' : ''}`}>{id.slice(0, 6)}</span>
                        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); if (index > 0) reorderNodes(index, index - 1); }}
                            disabled={index === 0}
                            className="text-slate-500 hover:text-white disabled:opacity-30"
                            title="Move Up"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (index < rootNodeIds.length - 1) reorderNodes(index, index + 1); }}
                            disabled={index === rootNodeIds.length - 1}
                            className="text-slate-500 hover:text-white disabled:opacity-30"
                            title="Move Down"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Expanded children */}
                  {isExpanded && childIds.length > 0 && (
                    <ul className="ml-4 mt-1 space-y-0.5 border-l-2 border-emerald-800/50 pl-2">
                      {childIds.map((childId, childIdx) => {
                        const child = nodes[childId];
                        if (!child) return null;
                        const isChildSelected = selectedNodeIds.includes(childId);
                        return (
                          <li
                            key={childId}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectNodes([childId], e.shiftKey || e.metaKey);
                            }}
                            className={`px-2 py-1 rounded text-xs border transition-colors cursor-pointer ${
                              isChildSelected
                                ? 'bg-blue-900/50 border-blue-500 text-white'
                                : 'bg-slate-850 border-transparent hover:bg-slate-700 hover:border-slate-600 text-slate-400'
                            }`}
                          >
                            <span className="opacity-60 font-mono mr-1">[{startIdx + childIdx + indexStartIndex}]</span>
                            🎯 Waypoint
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            }

            // Manual waypoint node
            const isSelected = selectedNodeIds.includes(id);
            const currentGlobalIndex = globalIndex++;

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
                    <span className="opacity-75 font-mono text-xs mr-2">[{currentGlobalIndex + indexStartIndex}]</span>
                    🎯 Waypoint
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
