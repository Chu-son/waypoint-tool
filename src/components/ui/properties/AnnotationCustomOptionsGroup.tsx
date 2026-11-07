import { useAppStore } from '../../../stores/appStore';
import { historyEditTransactions } from '../../../stores/history/historyEditHandlers';
import { AnnotationObject, OptionDef, OptionValue } from '../../../types/store';
import { FieldLabel } from '../common/FieldLabel';
import { Label } from '../common/Label';
import { OptionValueEditor, ValueEditTransactionContext } from './OptionValueEditor';
import { resolveOptionsSchema } from '../../../utils/optionSchema';

export function AnnotationCustomOptionsGroup({ obj }: { obj: AnnotationObject }) {
  const rawOptionsSchema = useAppStore((state) => state.optionsSchema);
  const optionsSchema = resolveOptionsSchema(rawOptionsSchema);
  const updateAnnotationObject = useAppStore((state) => state.updateAnnotationObject);

  if (!optionsSchema || !optionsSchema.options || optionsSchema.options.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 pt-3 border-t border-border-base/40">
      <div className="flex items-center justify-between">
        <FieldLabel>カスタムオプション (Custom Options)</FieldLabel>
        <span className="text-[9px] px-1.5 py-0.2 rounded bg-surface-hover text-text-muted border border-border-base/30 font-mono">
          Options
        </span>
      </div>

      <ValueEditTransactionContext.Provider value={historyEditTransactions}>
        <div className="space-y-2">
          {optionsSchema.options.map((opt: OptionDef) => (
            <div key={`${obj.id}:${opt.name}`} className="space-y-1">
              <Label className="text-[11px] flex items-center justify-between">
                <span>
                  {opt.label || opt.name}
                  {opt.required && (
                    <span className="text-danger-base ml-0.5" title="必須項目">
                      *
                    </span>
                  )}
                </span>
                <span className="opacity-50 text-[10px] uppercase font-normal">({opt.type})</span>
              </Label>
              <OptionValueEditor
                spec={opt}
                value={obj.options?.[opt.name]}
                defaultValue={opt.default}
                defaultGlobal={opt.default_global}
                onChange={(v: OptionValue | undefined) => {
                  const current = useAppStore.getState().annotationObjects[obj.id];
                  const next = { ...(current?.options || {}) };
                  if (v === undefined) delete next[opt.name];
                  else next[opt.name] = v;
                  updateAnnotationObject(obj.id, { options: next });
                }}
                name={opt.name}
              />
            </div>
          ))}
        </div>
      </ValueEditTransactionContext.Provider>
    </div>
  );
}
