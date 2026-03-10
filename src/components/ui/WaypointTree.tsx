import { useState, useMemo } from 'react';
import { useAppStore } from '../../stores/appStore';
import { ChevronRight, Layers, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItem({ id, children, isDragging }: { id: string; children: React.ReactNode; isDragging: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { 
    transform: CSS.Transform.toString(transform), 
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
  };
  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none select-none">
      {children}
    </li>
  );
}

export function WaypointTree() {
  const rootNodeIds = useAppStore(state => state.rootNodeIds);
  const nodes = useAppStore(state => state.nodes);
  const plugins = useAppStore(state => state.plugins);
  const selectedNodeIds = useAppStore(state => state.selectedNodeIds);
  const selectNodes = useAppStore(state => state.selectNodes);
  const reorderNodes = useAppStore(state => state.reorderNodes);
  const indexStartIndex = useAppStore(state => state.indexStartIndex);
  const insertionIndex = useAppStore(state => state.insertionIndex);
  const setInsertionIndex = useAppStore(state => state.setInsertionIndex);

  const [expandedGenerators, setExpandedGenerators] = useState<Set<string>>(new Set());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedGenerators(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const renderItems = useMemo(() => {
    const items = [...rootNodeIds];
    const targetIdx = insertionIndex === -1 ? items.length : insertionIndex;
    if (targetIdx >= 0 && targetIdx <= items.length) {
      items.splice(targetIdx, 0, '__insertion_bar__');
    } else {
      items.push('__insertion_bar__');
    }
    return items;
  }, [rootNodeIds, insertionIndex]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = renderItems.indexOf(active.id as string);
      const newIndex = renderItems.indexOf(over.id as string);

      if (active.id === '__insertion_bar__') {
        setInsertionIndex(newIndex === rootNodeIds.length ? -1 : newIndex);
      } else {
        const newRenderItems = arrayMove(renderItems, oldIndex, newIndex);
        const newInsertionIdx = newRenderItems.indexOf('__insertion_bar__');
        const newRootNodeIds = newRenderItems.filter(id => id !== '__insertion_bar__');

        const activeNodeId = active.id as string;
        const origOldIndex = rootNodeIds.indexOf(activeNodeId);
        const origNewIndex = newRootNodeIds.indexOf(activeNodeId);
        
        if (origOldIndex !== origNewIndex) {
          reorderNodes(origOldIndex, origNewIndex);
        }
        setInsertionIndex(newInsertionIdx === newRootNodeIds.length ? -1 : newInsertionIdx);
      }
    }
  };

  // Calculate a flat global index for sequential numbering
  let globalIndex = 0;

  return (
    <div className="flex-1 overflow-y-auto w-full">
      {rootNodeIds.length === 0 && insertionIndex === -1 && renderItems.length === 1 ? (
        <div className="text-sm text-slate-500 italic p-4 text-center">
          No items yet. Drag to create points on the map.
        </div>
      ) : null}
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="p-2">
          <SortableContext
            items={renderItems}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-1">
              {renderItems.map((id, _index) => {
                if (id === '__insertion_bar__') {
                  return (
                    <SortableItem key={id} id={id} isDragging={activeDragId === id}>
                      <div className="py-1 cursor-ns-resize group relative flex items-center justify-center">
                        <div className="h-1 bg-emerald-500/50 group-hover:bg-emerald-400 rounded-full w-full transition-colors" />
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-panel text-[10px] px-3 py-0.5 rounded-full border border-emerald-500/50 text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm pointer-events-none">
                          Insert Here
                        </div>
                      </div>
                    </SortableItem>
                  );
                }

                const node = nodes[id];
                if (!node) return null;

                const isSelected = selectedNodeIds.includes(id);

                // Generator node
                if (node.type === 'generator') {
                  const isExpanded = expandedGenerators.has(id);
                  const childIds = node.children_ids || [];
                  const pluginName = node.plugin_id && plugins[node.plugin_id]
                    ? plugins[node.plugin_id].manifest.name
                    : 'Generator';
                  const startIdx = globalIndex;
                  globalIndex += childIds.length;

                  return (
                    <SortableItem key={id} id={id} isDragging={activeDragId === id}>
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
                            <GripVertical size={14} className="text-slate-600 group-hover:text-slate-400 cursor-grab active:cursor-grabbing" />
                          </div>
                        </div>
                      </div>
                      
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
                    </SortableItem>
                  );
                }

                // Manual waypoint node
                const currentGlobalIndex = globalIndex++;
                return (
                  <SortableItem key={id} id={id} isDragging={activeDragId === id}>
                    <div
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
                          <GripVertical size={14} className="text-slate-600 group-hover:text-slate-400 cursor-grab active:cursor-grabbing" />
                        </div>
                      </div>
                    </div>
                  </SortableItem>
                );
              })}
            </ul>
          </SortableContext>
        </div>
      </DndContext>
    </div>
  );
}
