import { useAppStore } from "../../../stores/appStore";
import { Input } from "../common/Input";
import { Select } from "../common/Select";
import { Checkbox } from "../common/Checkbox";
import { OptionDef, WaypointNode } from "../../../types/store";
import { cn } from "../../../utils/cn";
import { PropertySectionHeader } from "./PropertySectionHeader";

interface CustomOptionsGroupProps {
  isMultiSelection: boolean;
  node: WaypointNode | null;
  handleUpdate: (id: string, updates: any) => void;
}

export function CustomOptionsGroup({
  isMultiSelection,
  node,
  handleUpdate,
}: CustomOptionsGroupProps) {
  const optionsSchema = useAppStore((state) => state.optionsSchema);
  const visibleAttributes = useAppStore((state) => state.visibleAttributes);
  const toggleAttributeVisibility = useAppStore(
    (state) => state.toggleAttributeVisibility,
  );
  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds);

  return (
    <div className="space-y-2 pt-4 border-t border-border-base">
      <PropertySectionHeader title="Custom Options" />

      {!optionsSchema ? (
        <div className="text-xs text-text-muted italic p-2 bg-surface-panel rounded border border-border-base">
          No schema loaded. Load a schema (YAML) from the Toolbar.
        </div>
      ) : (
        <div className="space-y-2 pt-2">
          {optionsSchema.options.map((opt: OptionDef) => {
            const nodeOptVal = isMultiSelection
              ? ""
              : (node?.options?.[opt.name] ?? opt.default ?? "");

            const handleChange = (
              val: string | number | boolean | Array<string | number | boolean>,
            ) => {
              useAppStore.getState().runInHistoryTransaction(() => {
                const currentState = useAppStore.getState();
                if (isMultiSelection) {
                  selectedNodeIds.forEach((id) => {
                    const n = currentState.nodes[id];
                    if (n) {
                      handleUpdate(id, {
                        options: { ...(n.options || {}), [opt.name]: val },
                      });
                    }
                  });
                } else {
                  const n = currentState.nodes[node!.id];
                  handleUpdate(node!.id, {
                    options: { ...(n.options || {}), [opt.name]: val },
                  });
                }
              });
            };

            return (
              <div key={opt.name}>
                <PropertySectionHeader
                  title={
                    <>
                      {opt.label || opt.name}
                      <span className="opacity-50 text-[10px] ml-1 uppercase font-normal">
                        ({opt.type})
                      </span>
                    </>
                  }
                  isVisible={visibleAttributes.includes(`options.${opt.name}`)}
                  onToggleVisible={() =>
                    toggleAttributeVisibility(`options.${opt.name}`)
                  }
                  toggleTitle={`Toggle ${opt.name} on Canvas`}
                  className="mb-1"
                />

                {opt.type === "list" ? (
                  <Input
                    type="text"
                    value={
                      Array.isArray(nodeOptVal)
                        ? nodeOptVal.join(", ")
                        : String(nodeOptVal || "")
                    }
                    placeholder={
                      isMultiSelection
                        ? "Mixed"
                        : opt.default !== undefined
                          ? Array.isArray(opt.default)
                            ? opt.default.join(", ")
                            : String(opt.default)
                          : "csv"
                    }
                    onFocus={() => useAppStore.getState().beginHistoryTransaction()}
                    onBlur={() => useAppStore.getState().endHistoryTransaction()}
                    onChange={(e) => {
                      const rawArr = e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0);
                      let parsedArr: any[] = rawArr;
                      if (opt.item_type === "float") {
                        parsedArr = rawArr
                          .map((s) => parseFloat(s))
                          .filter((n) => !isNaN(n));
                      } else if (opt.item_type === "integer") {
                        parsedArr = rawArr
                          .map((s) => parseInt(s, 10))
                          .filter((n) => !isNaN(n));
                      } else if (opt.item_type === "boolean") {
                        parsedArr = rawArr.map(
                          (s) => s === "true" || s === "1",
                        );
                      }
                      handleChange(parsedArr);
                    }}
                  />
                ) : opt.type === "string" &&
                  opt.enum_values &&
                  opt.enum_values.length > 0 ? (
                  <Select
                    value={String(nodeOptVal)}
                    onChange={(e) => handleChange(e.target.value)}
                  >
                    {isMultiSelection && (
                      <option value="" disabled hidden>
                        Mixed
                      </option>
                    )}
                    {opt.enum_values.map((v: string) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </Select>
                ) : opt.type === "integer" || opt.type === "float" ? (
                  <Input
                    type="number"
                    step={opt.type === "float" ? "0.1" : "1"}
                    value={String(nodeOptVal)}
                    placeholder={
                      isMultiSelection ? "Mixed" : String(opt.default || "")
                    }
                    onFocus={() => useAppStore.getState().beginHistoryTransaction()}
                    onBlur={() => useAppStore.getState().endHistoryTransaction()}
                    onChange={(e) => {
                      const val =
                        opt.type === "float"
                          ? parseFloat(e.target.value)
                          : parseInt(e.target.value, 10);
                      if (!isNaN(val)) handleChange(val);
                    }}
                  />
                ) : opt.type === "boolean" ? (
                  <Checkbox
                    checked={Boolean(nodeOptVal)}
                    onChange={(e) => handleChange(e.target.checked)}
                  />
                ) : (
                  <Input
                    type="text"
                    value={String(nodeOptVal)}
                    placeholder={
                      isMultiSelection ? "Mixed" : String(opt.default || "")
                    }
                    onFocus={() => useAppStore.getState().beginHistoryTransaction()}
                    onBlur={() => useAppStore.getState().endHistoryTransaction()}
                    onChange={(e) => handleChange(e.target.value)}
                    className={cn(
                      String(nodeOptVal).trim() === "" &&
                        !isMultiSelection &&
                        "border-amber-500/50",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
