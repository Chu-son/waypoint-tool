import { useState } from 'react';
import { useAppStore } from '../../../stores/appStore';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { Plus, Layers, X } from 'lucide-react';
import type { PluginInput } from './PluginInputEditor';

interface CustomLayerSelectFormProps {
  input: PluginInput;
  value: any;
  onChange: (val: any) => void;
}

export function CustomLayerSelectForm({ input, value, onChange }: CustomLayerSelectFormProps) {
  const customLayers = useAppStore((state) => state.customLayers) || [];
  const isMultiple = !!input.multiple;
  const [selectedLayerToAdd, setSelectedLayerToAdd] = useState<string>('');

  if (customLayers.length === 0) {
    return (
      <div className="text-xs text-text-muted/60 italic py-1 text-center">利用可能なカスタムレイヤーがありません</div>
    );
  }

  if (isMultiple) {
    const selectedList: any[] = Array.isArray(value) ? value : [];
    const selectedIds = selectedList.map((item) => (typeof item === 'string' ? item : item?.id)).filter(Boolean);

    const handleAdd = () => {
      if (!selectedLayerToAdd) return;
      const targetLayer = customLayers.find((l) => l.id === selectedLayerToAdd);
      if (targetLayer && !selectedIds.includes(targetLayer.id)) {
        onChange([...selectedList, targetLayer]);
        setSelectedLayerToAdd('');
      }
    };

    const handleRemove = (idToRemove: string) => {
      onChange(selectedList.filter((item) => (typeof item === 'string' ? item : item?.id) !== idToRemove));
    };

    const availableToAdd = customLayers.filter((l) => !selectedIds.includes(l.id));

    return (
      <div className="space-y-2">
        {/* Selected custom layers list */}
        <div className="space-y-1 max-h-36 overflow-y-auto p-1 bg-surface-base/40 rounded border border-border-base/30">
          {selectedList.length === 0 ? (
            <div className="text-xs text-text-muted/50 italic py-1 text-center">レイヤーが選択されていません</div>
          ) : (
            selectedList.map((item) => {
              const layerId = typeof item === 'string' ? item : item?.id;
              const layer = customLayers.find((l) => l.id === layerId) || item;
              if (!layer) return null;

              return (
                <div
                  key={layerId}
                  className="flex items-center justify-between gap-2 px-2 py-1 bg-surface-base rounded border border-border-base/40 text-xs"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <Layers size={12} className="text-primary-base shrink-0" />
                    <span className="truncate font-medium">{layer.name || 'Unnamed Layer'}</span>
                    <span className="text-[10px] text-text-muted uppercase font-mono px-1 py-0.5 rounded bg-surface-hover">
                      {layer.type}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(layerId)}
                    className="text-text-muted hover:text-danger-base p-0.5 rounded transition-colors"
                    title="削除"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Add layer dropdown + button */}
        {availableToAdd.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Select
              value={selectedLayerToAdd}
              onChange={(e) => setSelectedLayerToAdd(e.target.value)}
              className="h-7 text-xs flex-1"
            >
              <option value="">-- レイヤーを選択 --</option>
              {availableToAdd.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.name} ({layer.type})
                </option>
              ))}
            </Select>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!selectedLayerToAdd}
              onClick={handleAdd}
              className="h-7 px-2 text-xs font-bold gap-1 shrink-0"
            >
              <Plus size={12} />
              Add
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Single select
  const currentId = typeof value === 'string' ? value : value?.id || '';

  return (
    <Select
      value={currentId}
      onChange={(e) => {
        const found = customLayers.find((l) => l.id === e.target.value);
        onChange(found || null);
      }}
      className="h-8 text-xs w-full"
    >
      <option value="">-- カスタムレイヤーを選択 --</option>
      {customLayers.map((layer) => (
        <option key={layer.id} value={layer.id}>
          {layer.name} ({layer.type})
        </option>
      ))}
    </Select>
  );
}
