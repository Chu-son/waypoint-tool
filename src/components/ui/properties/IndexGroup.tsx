import { useAppStore } from "../../../stores/appStore";
import { Button } from "../common/Button";
import { Eye, EyeOff } from "lucide-react";

interface IndexGroupProps {
  isMultiSelection: boolean;
  nodeIndex: number;
}

export function IndexGroup({ isMultiSelection, nodeIndex }: IndexGroupProps) {
  const visibleAttributes = useAppStore((state) => state.visibleAttributes);
  const toggleAttributeVisibility = useAppStore(
    (state) => state.toggleAttributeVisibility,
  );
  const indexStartIndex = useAppStore((state) => state.indexStartIndex);

  return (
    <div className="space-y-2 relative">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
          Index
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-text-muted hover:text-text-base"
          onClick={() => toggleAttributeVisibility("index")}
          title="Toggle Index on Canvas"
        >
          {visibleAttributes.includes("index") ? (
            <Eye size={14} />
          ) : (
            <EyeOff size={14} />
          )}
        </Button>
      </div>
      <div className="bg-surface-panel border border-border-base rounded px-2 py-1 text-sm text-text-base font-mono">
        {isMultiSelection
          ? "Mixed Selection"
          : nodeIndex >= 0
            ? String(nodeIndex + indexStartIndex)
            : "-"}
      </div>
    </div>
  );
}
