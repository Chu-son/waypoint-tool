import { useState, useEffect } from "react";
import { useAppStore } from "../../../stores/appStore";
import { Button } from "../common/Button";
import { Folder, Unlink, Edit2, BoxSelect, Target, Layers } from "lucide-react";
import { WaypointNode } from "../../../types/store";

interface GroupNodePanelProps {
  node: WaypointNode;
}

export function GroupNodePanel({ node }: GroupNodePanelProps) {
  const renameNode = useAppStore((state) => state.renameNode);
  const ungroupNode = useAppStore((state) => state.ungroupNode);
  const selectNodes = useAppStore((state) => state.selectNodes);
  const nodes = useAppStore((state) => state.nodes);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(node.name || "");

  useEffect(() => {
    setNameValue(node.name || "");
    setIsEditingName(false);
  }, [node.id, node.name]);

  const childCount = node.children_ids?.length || 0;

  // 子ノードの内訳を計算
  const childBreakdown = (() => {
    let waypoints = 0;
    let groups = 0;
    let generators = 0;
    (node.children_ids || []).forEach((cid) => {
      const child = nodes[cid];
      if (!child) return;
      if (child.type === "manual") waypoints++;
      else if (child.type === "manual_group" || child.type === "group") groups++;
      else if (child.type === "generator") generators++;
    });
    return { waypoints, groups, generators };
  })();

  const handleNameSubmit = () => {
    if (nameValue.trim() && nameValue.trim() !== node.name) {
      renameNode(node.id, nameValue.trim());
    }
    setIsEditingName(false);
  };

  const handleSelectChildren = () => {
    if (node.children_ids && node.children_ids.length > 0) {
      selectNodes(node.children_ids);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 flex flex-col h-full">
      {/* Header */}
      <div className="mb-4 pb-3 border-b border-border-base/50">
        <h2 className="text-sm font-bold text-accent-anchor mb-1 flex items-center gap-2">
          <Folder size={16} />
          Group
        </h2>
        <p className="text-[11px] text-text-muted font-mono break-all">
          {node.id}
        </p>
      </div>

      <div className="space-y-4 flex-1">
        {/* グループ名編集 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            グループ名
          </label>
          {isEditingName ? (
            <input
              type="text"
              value={nameValue}
              autoFocus
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameSubmit();
                if (e.key === "Escape") {
                  setNameValue(node.name || "");
                  setIsEditingName(false);
                }
              }}
              className="w-full bg-surface-base border border-primary-base rounded px-2 py-1 text-xs text-text-base focus:outline-none focus:ring-1 focus:ring-primary-base"
            />
          ) : (
            <div
              className="flex items-center justify-between px-2 py-1 bg-surface-base/50 rounded border border-border-base/40 cursor-pointer hover:border-primary-base/50 transition-colors"
              onClick={() => setIsEditingName(true)}
            >
              <span className="text-xs text-text-base font-medium">
                {node.name || "Group"}
              </span>
              <Edit2 size={11} className="text-text-muted" />
            </div>
          )}
        </div>

        {/* 子ノード情報 */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            子要素
          </label>
          <div className="bg-surface-base/50 rounded border border-border-base/40 p-2 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-text-muted">合計</span>
              <span className="font-bold text-text-base">{childCount}</span>
            </div>
            {childBreakdown.waypoints > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-text-muted flex items-center gap-1">
                  <Target size={12} className="shrink-0" />
                  Waypoints
                </span>
                <span className="text-text-base">{childBreakdown.waypoints}</span>
              </div>
            )}
            {childBreakdown.groups > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-text-muted flex items-center gap-1">
                  <Folder size={12} className="shrink-0" />
                  Sub-Groups
                </span>
                <span className="text-text-base">{childBreakdown.groups}</span>
              </div>
            )}
            {childBreakdown.generators > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-text-muted flex items-center gap-1">
                  <Layers size={12} className="shrink-0" />
                  Generators
                </span>
                <span className="text-text-base">{childBreakdown.generators}</span>
              </div>
            )}
          </div>
        </div>

        {/* アクション */}
        <div className="pt-4 mt-auto border-t border-border-base space-y-2">
          {childCount > 0 && (
            <Button
              variant="secondary"
              onClick={handleSelectChildren}
              className="w-full gap-2"
            >
              <BoxSelect size={14} />
              子要素をすべて選択
            </Button>
          )}
          <Button
            variant="danger"
            onClick={() => ungroupNode(node.id)}
            className="w-full gap-2"
          >
            <Unlink size={14} />
            グループ解除 (Ungroup)
          </Button>
        </div>
      </div>
    </div>
  );
}
