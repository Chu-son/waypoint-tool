import { useAppStore } from '../../stores/appStore';
import { FloatingActionBanner } from './common/FloatingActionBanner';
import { Check, X, Copy, Target } from 'lucide-react';
import { applyElementPaste } from '../../utils/transformUtils';

export function ElementCopyOverlay() {
  const elementCopyState = useAppStore((state) => state.elementCopyState);
  const setElementCopyState = useAppStore((state) => state.setElementCopyState);
  const clearElementCopyState = useAppStore((state) => state.clearElementCopyState);
  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds);
  const nodes = useAppStore((state) => state.nodes);
  const rootNodeIds = useAppStore((state) => state.rootNodeIds);
  const anchorNodeId = useAppStore((state) => state.anchorNodeId);
  const updateNode = useAppStore((state) => state.updateNode);
  const indexStartIndex = useAppStore((state) => state.indexStartIndex);

  // Determine current target node
  const targetId = elementCopyState?.previewNodeId || (selectedNodeIds.length === 1 ? selectedNodeIds[0] : null);
  const targetNode = targetId ? nodes[targetId] : null;
  const targetIndex = targetNode ? rootNodeIds.indexOf(targetNode.id) : -1;

  const handleConfirmPaste = () => {
    if (targetNode && elementCopyState) {
      applyElementPaste(targetNode, elementCopyState, anchorNodeId, nodes, updateNode);
      setElementCopyState({ ...elementCopyState, previewNodeId: null });
    }
  };

  if (!elementCopyState) return null;

  return (
    <FloatingActionBanner
      icon={<Copy size={16} className="animate-pulse" />}
      title={`${elementCopyState.field.toUpperCase()} コピー中`}
      subtitle={elementCopyState.coordSystem === 'world' ? 'World' : 'Anchor 相対'}
      valueDisplay={elementCopyState.value}
      statusText={
        <div className="truncate min-w-0">
          {targetNode ? (
            <span className="text-accent-generator font-medium flex items-center gap-1.5 truncate">
              <Target size={13} className="shrink-0" />
              Waypoint [{targetIndex >= 0 ? targetIndex + indexStartIndex : '?'}] に適用中
            </span>
          ) : (
            <span className="italic text-text-muted/70 truncate">Waypointをクリックして選択</span>
          )}
        </div>
      }
      actions={[
        {
          label: 'ペースト確定',
          icon: <Check size={14} />,
          variant: 'primary',
          disabled: !targetNode,
          onClick: handleConfirmPaste,
          title: '選択中のWaypointにコピー値を反映',
        },
        {
          label: '完了',
          icon: <X size={14} />,
          variant: 'secondary',
          onClick: clearElementCopyState,
          title: 'コピーモードを終了',
        },
      ]}
    />
  );
}
