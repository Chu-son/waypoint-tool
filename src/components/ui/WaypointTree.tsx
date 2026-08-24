import { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/appStore';
import { ChevronRight, Layers, GripVertical, Anchor } from 'lucide-react';
import { Button } from './common/Button';
import { cn } from '../../utils/cn';
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

  const anchorNodeId = useAppStore(state => state.anchorNodeId);
  const setAnchorNode = useAppStore(state => state.setAnchorNode);
  const elementCopyState = useAppStore(state => state.elementCopyState);
  const setElementCopyState = useAppStore(state => state.setElementCopyState);

  const [expandedGenerators, setExpandedGenerators] = useState<Set<string>>(new Set());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedGenerators(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNodeClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (elementCopyState) {
      // コピーモード中: 単一選択でプレビューノードを更新
      selectNodes([id]);
      setElementCopyState({ ...elementCopyState, previewNodeId: id });
      return;
    }
    selectNodes([id], e.shiftKey || e.metaKey);
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

  const totalWaypointsCount = useMemo(() => {
    let count = 0;
    rootNodeIds.forEach((id) => {
      const node = nodes[id];
      if (!node) return;
      if (node.type === 'manual') {
        count += 1;
      } else if (node.type === 'generator') {
        count += node.children_ids?.length || 0;
      }
    });
    return count;
  }, [rootNodeIds, nodes]);

  let globalIndex = 0;

  return (
    <div className="w-full flex flex-col space-y-2 relative">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-text-base uppercase tracking-wider">Waypoints</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-hover text-text-muted font-bold">
            {totalWaypointsCount}
          </span>
        </div>
      </div>

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
                      <InsertionBar />
                    </SortableItem>
                  );
                }

                const node = nodes[id];
                if (!node) return null;

                const isSelected = selectedNodeIds.includes(id);
                const isAnchor = anchorNodeId === id;

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
                      <TreeItemRow
                        isSelected={isSelected}
                        variant="generator"
                        onClick={(e) => handleNodeClick(id, e)}
                        idTag={id.slice(0, 6)}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpand(id); }}
                          className="text-text-muted hover:text-text-base transition-colors"
                        >
                          <ChevronRight size={14} className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                        <Layers size={14} className="text-emerald-400" />
                        <span className="font-medium text-xs">{pluginName}</span>
                        <span className="text-[10px] text-text-muted/70 ml-1">({childIds.length} pts)</span>
                      </TreeItemRow>
                      
                      {isExpanded && childIds.length > 0 && (
                        <ul className="ml-4 mt-1 space-y-0.5 border-l-2 border-emerald-500/30 pl-2">
                          {childIds.map((childId, childIdx) => {
                            const child = nodes[childId];
                            if (!child) return null;
                            const isChildSelected = selectedNodeIds.includes(childId);
                            const isChildAnchor = anchorNodeId === childId;
                            return (
                              <li
                                key={childId}
                                onClick={(e) => handleNodeClick(childId, e)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setContextMenu({ nodeId: childId, x: e.clientX, y: e.clientY });
                                }}
                                className={cn(
                                  "px-2 py-1 rounded text-xs border transition-colors cursor-pointer flex items-center justify-between",
                                  isChildSelected
                                    ? "bg-primary-base/20 border-primary-base text-text-base"
                                    : "bg-surface-panel/80 border-transparent hover:bg-surface-hover hover:border-border-base/60 text-text-muted",
                                  isChildAnchor && "border-amber-400/60 bg-amber-950/20"
                                )}
                              >
                                <div className="flex items-center gap-1">
                                  <span className="opacity-60 font-mono mr-1">[{startIdx + childIdx + indexStartIndex}]</span>
                                  🎯 Waypoint
                                </div>
                                {isChildAnchor && (
                                  <span className="text-amber-400 text-xs font-bold" title="Anchor Point">⚓</span>
                                )}
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
                    <TreeItemRow
                      isSelected={isSelected}
                      isAnchor={isAnchor}
                      variant="primary"
                      onClick={(e) => handleNodeClick(id, e)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({ nodeId: id, x: e.clientX, y: e.clientY });
                      }}
                      idTag={id.slice(0, 6)}
                    >
                      <span className="opacity-75 font-mono text-xs mr-1">[{currentGlobalIndex + indexStartIndex}]</span>
                      🎯 Waypoint
                      {isAnchor && (
                        <span className="text-amber-400 text-xs font-bold ml-1" title="Anchor Point">⚓</span>
                      )}
                    </TreeItemRow>
                  </SortableItem>
                );
              })}
            </ul>
          </SortableContext>
        </div>
      </DndContext>

      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-[9999] bg-surface-panel border border-border-base rounded-lg shadow-xl py-1 min-w-[160px] text-xs text-text-base select-none"
        >
          <Button
            variant="ghost"
            onClick={() => {
              if (anchorNodeId === contextMenu.nodeId) {
                setAnchorNode(null);
              } else {
                setAnchorNode(contextMenu.nodeId);
              }
              setContextMenu(null);
            }}
            className="w-full justify-start px-3 py-2 text-left text-xs flex items-center gap-2 text-text-base hover:bg-surface-hover rounded-none border-none transition-colors"
          >
            <Anchor size={14} className="text-amber-400" />
            {anchorNodeId === contextMenu.nodeId ? 'アンカー設定を解除' : 'アンカーに設定'}
          </Button>
        </div>
      )}
    </div>
  );
}

interface TreeItemRowProps {
  isSelected: boolean;
  isAnchor?: boolean;
  variant?: "primary" | "generator";
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  idTag?: string;
  showGrip?: boolean;
}

function TreeItemRow({
  isSelected,
  isAnchor,
  variant = "primary",
  onClick,
  onContextMenu,
  children,
  idTag,
  showGrip = true,
}: TreeItemRowProps) {
  const selectedBg =
    variant === "generator"
      ? "bg-emerald-500/20 border-emerald-500 text-text-base"
      : "bg-primary-base/20 border-primary-base text-text-base";
  const anchorBorder = isAnchor ? "border-amber-400/60 bg-amber-950/20" : "";

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        "px-3 py-2 rounded text-sm group border transition-colors cursor-pointer select-none",
        isSelected
          ? selectedBg
          : "bg-surface-panel border-transparent hover:bg-surface-hover hover:border-border-base/60 text-text-base",
        anchorBorder
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">{children}</div>
        <div className="flex items-center gap-2">
          {idTag && (
            <span
              className={cn(
                "opacity-50 text-xs",
                isSelected && (variant === "generator" ? "text-emerald-400" : "text-primary-base/80")
              )}
            >
              {idTag}
            </span>
          )}
          {showGrip && (
            <GripVertical
              size={14}
              className="text-text-muted/40 group-hover:text-text-muted cursor-grab active:cursor-grabbing"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function InsertionBar() {
  return (
    <div className="py-1 cursor-ns-resize group relative flex items-center justify-center">
      <div className="h-1 bg-emerald-500/50 group-hover:bg-emerald-400 rounded-full w-full transition-colors" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-panel text-[10px] px-3 py-0.5 rounded-full border border-emerald-500/50 text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm pointer-events-none">
        Insert Here
      </div>
    </div>
  );
}

