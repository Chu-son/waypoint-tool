import { useAppStore } from "../../../stores/appStore";
import { PropertySectionHeader } from "./PropertySectionHeader";

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
      <PropertySectionHeader
        title="Index"
        isVisible={visibleAttributes.includes("index")}
        onToggleVisible={() => toggleAttributeVisibility("index")}
        toggleTitle="Toggle Index on Canvas"
      />
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
