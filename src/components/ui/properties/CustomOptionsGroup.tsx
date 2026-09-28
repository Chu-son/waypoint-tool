import { useAppStore } from '../../../stores/appStore';
import { OptionDef, OptionValue, WaypointNode } from '../../../types/store';
import { PropertySectionHeader } from './PropertySectionHeader';
import { OptionValueEditor, ValueEditTransactionContext, ValueEditTransactions } from './OptionValueEditor';
import { resolveOptionsSchema } from '../../../utils/optionSchema';

interface CustomOptionsGroupProps {
  isMultiSelection: boolean;
  node: WaypointNode | null;
  handleUpdate: (id: string, updates: any) => void;
}

/** ウェイポイントの Inspector で使う、ストアの Undo 履歴と連動したトランザクション実装。 */
const storeValueEditTransactions: ValueEditTransactions = {
  begin: () => useAppStore.getState().beginHistoryTransaction(),
  end: () => useAppStore.getState().endHistoryTransaction(),
  run: (fn) => useAppStore.getState().runInHistoryTransaction(fn),
};

export function CustomOptionsGroup({ isMultiSelection, node, handleUpdate }: CustomOptionsGroupProps) {
  const rawOptionsSchema = useAppStore((state) => state.optionsSchema);
  // 値の表示・編集は ref を解決した実効スキーマで行う。定義そのものの編集は設定画面の役目。
  const optionsSchema = resolveOptionsSchema(rawOptionsSchema);
  const visibleAttributes = useAppStore((state) => state.visibleAttributes);
  const toggleAttributeVisibility = useAppStore((state) => state.toggleAttributeVisibility);
  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds);

  return (
    <div className="space-y-2 pt-4 border-t border-border-base">
      <PropertySectionHeader title="Custom Options" />

      {!optionsSchema ? (
        <div className="text-xs text-text-muted italic p-2 bg-surface-panel rounded border border-border-base">
          No schema loaded. Load a schema (YAML) from the Toolbar.
        </div>
      ) : (
        <ValueEditTransactionContext.Provider value={storeValueEditTransactions}>
          <div className="space-y-2 pt-2">
            {optionsSchema.options.map((opt: OptionDef) => {
              const handleChange = (val: OptionValue | undefined) => {
                const currentState = useAppStore.getState();
                const applyTo = (id: string) => {
                  const n = currentState.nodes[id];
                  if (!n) return;
                  const next = { ...(n.options || {}) };
                  if (val === undefined) delete next[opt.name];
                  else next[opt.name] = val;
                  handleUpdate(id, { options: next });
                };
                if (isMultiSelection) {
                  selectedNodeIds.forEach((id) => {
                    const n = currentState.nodes[id];
                    if (n && n.type === 'manual') applyTo(id);
                  });
                } else if (node) {
                  applyTo(node.id);
                }
              };

              return (
                <div key={`${isMultiSelection ? selectedNodeIds.join(',') : node?.id}:${opt.name}`}>
                  <PropertySectionHeader
                    title={
                      <>
                        {opt.label || opt.name}
                        {opt.required && (
                          <span className="text-danger-base ml-0.5" title="必須項目">
                            *
                          </span>
                        )}
                        <span className="opacity-50 text-[10px] ml-1 uppercase font-normal">({opt.type})</span>
                      </>
                    }
                    isVisible={visibleAttributes.includes(`options.${opt.name}`)}
                    onToggleVisible={() => toggleAttributeVisibility(`options.${opt.name}`)}
                    toggleTitle={`Toggle ${opt.name} on Canvas`}
                    className="mb-1"
                  />
                  <OptionValueEditor
                    spec={opt}
                    value={node?.options?.[opt.name]}
                    defaultValue={opt.default}
                    defaultGlobal={opt.default_global}
                    mixed={isMultiSelection}
                    onChange={handleChange}
                    name={opt.name}
                  />
                </div>
              );
            })}
          </div>
        </ValueEditTransactionContext.Provider>
      )}
    </div>
  );
}
