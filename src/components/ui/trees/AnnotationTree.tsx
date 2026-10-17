import { useCallback, useMemo, useState } from 'react';
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '../common/ContextMenu';
import { useAppStore } from '../../../stores/appStore';
import {
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Tag,
  Copy,
  Folder,
  FolderOpen,
  FolderPlus,
  Unlink,
  Code2,
  Edit2,
  Scissors,
  ClipboardPaste,
  CircleDot,
  Navigation,
  Minus,
  Square,
  Circle,
  Wand2,
} from 'lucide-react';
import { Button } from '../common/Button';
import { cn } from '../../../utils/cn';
import { DEFAULT_ANNOTATION_COLOR } from '../../../utils/colorPresets';
import { collectDescendantIds, getAncestorIds, getAnnotationParentId } from '../../../utils/treeUtils';
import { idsHiddenByAnnotationGroups } from '../../../utils/annotationVisibility';
import type { DropTarget, TreeModel, TreeRowInfo } from '../../../utils/treeCore';
import { useTreeReveal } from '../../../hooks/useTreeReveal';
import { ANNOTATION_TREE_ID, groupAnnotationItems, ungroupAnnotationItems } from '../../../services/annotationCommands';
import type { AnnotationType } from '../../../types/store';
import { TreeView } from './core/TreeView';
import type { TreeRowContent } from './core/TreeRow';

function annotationIcon(type: AnnotationType) {
  switch (type) {
    case 'point':
      return <CircleDot size={13} className="text-primary-base" />;
    case 'oriented_point':
      return <Navigation size={13} className="text-accent-generator" />;
    case 'line':
      return <Minus size={13} className="text-accent-anchor" />;
    case 'rect':
      return <Square size={13} className="text-accent-reference" />;
    case 'circle':
      return <Circle size={13} className="text-accent-reference" />;
    default:
      return <CircleDot size={13} />;
  }
}

const TYPE_LABELS: Record<string, string> = {
  point: 'Point',
  oriented_point: 'Oriented',
  line: 'Line',
  rect: 'Rect',
  circle: 'Circle',
};

interface MenuState {
  /** The item the menu was opened on, or null for the empty area. */
  id: string | null;
  x: number;
  y: number;
}

export function AnnotationTree() {
  const annotationObjects = useAppStore((state) => state.annotationObjects) || {};
  const annotationGroups = useAppStore((state) => state.annotationGroups) || {};
  const rootAnnotationIds = useAppStore((state) => state.rootAnnotationIds) || [];
  const selectedAnnotationIds = useAppStore((state) => state.selectedAnnotationIds) || [];
  const selectAnnotationObjects = useAppStore((state) => state.selectAnnotationObjects);
  const duplicateAnnotations = useAppStore((state) => state.duplicateAnnotations);
  const renameAnnotation = useAppStore((state) => state.renameAnnotation);
  const moveAnnotationsInTree = useAppStore((state) => state.moveAnnotationsInTree);
  const removeAnnotationObjects = useAppStore((state) => state.removeAnnotationObjects);
  const toggleAnnotationVisibility = useAppStore((state) => state.toggleAnnotationVisibility);
  const toggleAnnotationGroupVisibility = useAppStore((state) => state.toggleAnnotationGroupVisibility);
  const toggleAnnotationLabelVisibility = useAppStore((state) => state.toggleAnnotationLabelVisibility);
  const setAnnotationEditMode = useAppStore((state) => state.setAnnotationEditMode);
  const isAnnotationEditMode = useAppStore((state) => state.isAnnotationEditMode);
  const showAnnotations = useAppStore((state) => state.showAnnotations);
  const setShowAnnotations = useAppStore((state) => state.setShowAnnotations);
  const showAnnotationLabels = useAppStore((state) => state.showAnnotationLabels);
  const setShowAnnotationLabels = useAppStore((state) => state.setShowAnnotationLabels);
  const activateTab = useAppStore((state) => state.activateTab);
  const openPluginDataModal = useAppStore((state) => state.openPluginDataModal);
  const copySelectedMapElements = useAppStore((state) => state.copySelectedMapElements);
  const cutSelectedMapElements = useAppStore((state) => state.cutSelectedMapElements);
  const pasteMapElements = useAppStore((state) => state.pasteMapElements);
  const expandTreeItems = useAppStore((state) => state.expandTreeItems);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<MenuState | null>(null);

  const model: TreeModel = useMemo(
    () => ({ rootIds: rootAnnotationIds, childrenOf: (id) => annotationGroups[id]?.children_ids ?? undefined }),
    [rootAnnotationIds, annotationGroups],
  );
  const hiddenByGroups = useMemo(() => idsHiddenByAnnotationGroups(annotationGroups), [annotationGroups]);

  const getParentId = useCallback(
    (id: string) => getAnnotationParentId(id, rootAnnotationIds, annotationGroups, annotationObjects),
    [rootAnnotationIds, annotationGroups, annotationObjects],
  );
  const { flashingId } = useTreeReveal({
    treeType: 'annotation',
    getAncestorIds: useCallback((id: string) => getAncestorIds(id, getParentId), [getParentId]),
    expandItems: useCallback((ids: string[]) => expandTreeItems(ANNOTATION_TREE_ID, ids), [expandTreeItems]),
  });

  const select = (ids: string[]) => {
    selectAnnotationObjects(ids);
    if (ids.length > 0 && useAppStore.getState().autoFocusInspector) {
      activateTab('inspector');
    }
  };

  const renderRow = (row: TreeRowInfo): TreeRowContent | null => {
    const hiddenByAncestor = hiddenByGroups.has(row.id);
    const group = annotationGroups[row.id];
    if (group) {
      const isGenerator = group.type === 'generator';
      return {
        name: group.name,
        icon: isGenerator ? (
          <Wand2 size={13} className="text-primary-base" />
        ) : row.isExpanded ? (
          <FolderOpen size={13} className="text-accent-anchor" />
        ) : (
          <Folder size={13} className="text-accent-anchor" />
        ),
        badges: (
          <span className="text-[9px] px-1.5 rounded-full bg-surface-hover text-text-muted border border-border-base/30 shrink-0 font-mono font-bold">
            {group.children_ids?.length ?? 0}
          </span>
        ),
        actions: <DeleteButton name={group.name} onDelete={() => removeAnnotationObjects([row.id])} />,
        visible: group.visible ?? true,
        hiddenByAncestor,
      };
    }

    const obj = annotationObjects[row.id];
    if (!obj) return null;
    return {
      name: obj.name,
      icon: (
        <span className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full border border-border-base shadow-xs shrink-0"
            style={{ backgroundColor: obj.color || DEFAULT_ANNOTATION_COLOR }}
            title={`Color: ${obj.color || DEFAULT_ANNOTATION_COLOR}`}
          />
          {annotationIcon(obj.type)}
        </span>
      ),
      badges: (
        <span className="text-[9px] px-1 rounded bg-surface-hover/80 text-text-muted border border-border-base/30 shrink-0 font-mono hidden xs:inline-block sm:inline-block">
          {TYPE_LABELS[obj.type] ?? obj.type}
        </span>
      ),
      actions: (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              toggleAnnotationLabelVisibility(obj.id);
            }}
            className={cn(
              'w-5 h-5 p-0 hover:bg-surface-hover',
              obj.labelVisible ? 'text-primary-base' : 'text-text-muted/40 hover:text-text-muted',
            )}
            title={obj.labelVisible ? 'ラベル: 表示中' : 'ラベル: 非表示中'}
            aria-label={`${obj.name} のラベルを${obj.labelVisible ? '隠す' : '表示する'}`}
          >
            <Tag size={11} />
          </Button>
          <DeleteButton name={obj.name} onDelete={() => removeAnnotationObjects([row.id])} />
        </>
      ),
      visible: obj.visible ?? true,
      hiddenByAncestor,
    };
  };

  const toggleVisible = (id: string) => {
    if (annotationGroups[id]) toggleAnnotationGroupVisibility(id);
    else toggleAnnotationVisibility(id);
  };

  const canDrop = (movingIds: string[], target: DropTarget) => {
    if (movingIds.includes(target.targetId)) return false;
    if (target.position === 'inside' && !annotationGroups[target.targetId]) return false;
    // Not into itself: a group cannot go next to or inside what it holds.
    return !movingIds.some(
      (id) => annotationGroups[id] && collectDescendantIds(id, annotationGroups).includes(target.targetId),
    );
  };

  const handleCreateGroup = () => {
    const targetIds =
      selectedAnnotationIds.length > 0 ? selectedAnnotationIds : contextMenu?.id ? [contextMenu.id] : [];
    setContextMenu(null);
    if (targetIds.length === 0) return;
    const newGroupId = groupAnnotationItems(targetIds);
    if (newGroupId) setEditingId(newGroupId);
  };

  return (
    <div
      className="w-full flex flex-col space-y-2 relative min-h-[120px]"
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ id: null, x: e.clientX, y: e.clientY });
      }}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-text-base uppercase tracking-wider">Annotations</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-hover text-text-muted font-bold">
            {Object.keys(annotationObjects).length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Toggle All Labels */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAnnotationLabels(!showAnnotationLabels)}
            className={cn(
              'h-6 px-1.5 text-[11px] gap-1',
              showAnnotationLabels ? 'text-primary-base' : 'text-text-muted',
            )}
            title={showAnnotationLabels ? '全ラベル非表示' : '全ラベル表示'}
          >
            <Tag size={12} />
          </Button>

          {/* Toggle All Annotations */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAnnotations(!showAnnotations)}
            className={cn('h-6 px-1.5 text-[11px] gap-1', showAnnotations ? 'text-text-base' : 'text-text-muted')}
            title={showAnnotations ? '全アノテーション非表示' : '全アノテーション表示'}
          >
            {showAnnotations ? <Eye size={12} /> : <EyeOff size={12} />}
          </Button>

          {/* Add Annotation Button */}
          <Button
            variant={isAnnotationEditMode ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setAnnotationEditMode(true)}
            className="h-6 px-2 text-[11px] font-bold gap-1 shadow-xs"
            title="アノテーション配置モードを開始"
          >
            <Plus size={12} />
            <span>Add</span>
          </Button>
        </div>
      </div>

      <TreeView
        treeId={ANNOTATION_TREE_ID}
        ariaLabel="Annotations"
        model={model}
        selectedIds={selectedAnnotationIds}
        onSelectionChange={select}
        renderRow={renderRow}
        onToggleVisible={toggleVisible}
        onRename={renameAnnotation}
        editingId={editingId}
        onEditingChange={setEditingId}
        canDrop={canDrop}
        onDrop={(ids, target) => moveAnnotationsInTree(ids, target.targetId, target.position)}
        onItemContextMenu={(e, id) => {
          e.stopPropagation();
          setContextMenu({ id, x: e.clientX, y: e.clientY });
        }}
        flashingId={flashingId}
        emptyState={
          <div className="text-center py-4 text-xs text-text-muted/60 italic bg-surface-panel/20 rounded-xl border border-border-base/20">
            アノテーションがありません。「+ Add」ボタンから配置できます。
          </div>
        }
      />

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
          {contextMenu.id === null ? (
            <>
              <ContextMenuItem
                icon={<ClipboardPaste size={13} className="text-primary-base" />}
                onSelect={() => pasteMapElements({ asGroup: false })}
              >
                貼り付け (Paste)
              </ContextMenuItem>
              <ContextMenuItem
                icon={<FolderPlus size={13} className="text-primary-base" />}
                onSelect={() => pasteMapElements({ asGroup: true })}
              >
                グループで貼り付け
              </ContextMenuItem>
            </>
          ) : (
            (() => {
              const contextId = contextMenu.id;
              const isGroup = !!annotationGroups[contextId];
              const groupObj = isGroup ? annotationGroups[contextId] : undefined;
              const itemObj = !isGroup ? annotationObjects[contextId] : undefined;
              const isMultiSelected = selectedAnnotationIds.length > 1 && selectedAnnotationIds.includes(contextId);
              const targetIds = isMultiSelected ? selectedAnnotationIds : [contextId];

              return (
                <>
                  <ContextMenuItem
                    emphasis="strong"
                    icon={<FolderPlus size={13} className="text-accent-anchor" />}
                    onSelect={handleCreateGroup}
                  >
                    {targetIds.length > 1
                      ? `選択項目をグループ化 (${targetIds.length}) (Ctrl+G)`
                      : 'グループ化 (Ctrl+G)'}
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<Edit2 size={13} className="text-primary-base" />}
                    onSelect={() => setEditingId(contextId)}
                  >
                    名前を変更 (F2)
                  </ContextMenuItem>
                  {isGroup && (
                    <ContextMenuItem
                      icon={<Unlink size={13} className="text-accent-anchor" />}
                      onSelect={() => ungroupAnnotationItems([contextId])}
                    >
                      グループ解除 (Ctrl+Shift+G)
                    </ContextMenuItem>
                  )}

                  <ContextMenuSeparator />

                  <ContextMenuItem
                    icon={<Scissors size={13} className="text-accent-automation" />}
                    onSelect={() => cutSelectedMapElements()}
                  >
                    {isMultiSelected ? `選択項目を切り取り (${targetIds.length})` : '切り取り (Cut)'}
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<Copy size={13} className="text-accent-automation" />}
                    onSelect={() => copySelectedMapElements()}
                  >
                    {isMultiSelected ? `選択項目をコピー (${targetIds.length})` : 'コピー (Copy)'}
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<ClipboardPaste size={13} className="text-primary-base" />}
                    onSelect={() => pasteMapElements({ asGroup: false })}
                  >
                    貼り付け (Paste)
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<FolderPlus size={13} className="text-primary-base" />}
                    onSelect={() => pasteMapElements({ asGroup: true })}
                  >
                    グループで貼り付け
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<Copy size={13} className="text-accent-automation" />}
                    onSelect={() => duplicateAnnotations(targetIds)}
                  >
                    {isMultiSelected ? `選択項目を複製 (${targetIds.length})` : '複製 (Duplicate)'}
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<Code2 size={13} className="text-accent-automation" />}
                    onSelect={() => {
                      if (isGroup) {
                        openPluginDataModal(
                          `グループ: ${groupObj?.name || 'Group'}`,
                          groupObj?.plugin_data,
                          `プラグイン: ${groupObj?.plugin_id || 'Manual'} • 内部メタデータ (Read-only)`,
                        );
                      } else {
                        openPluginDataModal(
                          `アノテーション: ${itemObj?.name || 'Annotation'}`,
                          itemObj?.plugin_data,
                          `タイプ: ${itemObj?.type} • 内部メタデータ (Read-only)`,
                        );
                      }
                    }}
                  >
                    内部プロパティを表示
                  </ContextMenuItem>
                  <ContextMenuItem
                    icon={<Folder size={13} className="text-text-muted" />}
                    onSelect={() => select([contextId])}
                  >
                    インスペクターを開く
                  </ContextMenuItem>

                  <ContextMenuSeparator />

                  <ContextMenuItem
                    tone="danger"
                    icon={<Trash2 size={13} />}
                    onSelect={() => removeAnnotationObjects(targetIds)}
                  >
                    {isMultiSelected ? `選択項目を削除 (${targetIds.length})` : '削除 (Delete)'}
                  </ContextMenuItem>
                </>
              );
            })()
          )}
        </ContextMenu>
      )}
    </div>
  );
}

function DeleteButton({ name, onDelete }: { name: string; onDelete: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
      className="w-5 h-5 p-0 hover:bg-danger-base/10 hover:text-danger-base text-text-muted/40 transition-colors"
      title="削除"
      aria-label={`${name} を削除`}
    >
      <Trash2 size={11} />
    </Button>
  );
}
