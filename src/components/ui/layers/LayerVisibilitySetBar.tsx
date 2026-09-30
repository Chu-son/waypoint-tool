import { useState } from 'react';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../stores/appStore';
import { differsFromSet, undecidedLayerIds } from '../../../utils/layerVisibilitySets';
import { confirmAction } from '../../../services/notify';
import { AlertBox } from '../common/AlertBox';
import { Button } from '../common/Button';
import { InlineNameInput } from '../common/InlineNameInput';
import { Select } from '../common/Select';

type Editing = 'new' | 'rename' | null;

/**
 * Chooses among saved layer visibility sets: named on/off snapshots of the layer stack. Picking a
 * set applies it; the list says which sets no longer cover every layer ("needs update") and which
 * set in use has been changed by hand ("modified").
 */
export function LayerVisibilitySetBar() {
  const { sets, activeId, mapLayers, customLayers } = useAppStore(
    useShallow((state) => ({
      sets: state.layerVisibilitySets,
      activeId: state.activeLayerVisibilitySetId,
      mapLayers: state.mapLayers,
      customLayers: state.customLayers,
    })),
  );
  const [editing, setEditing] = useState<Editing>(null);

  if (mapLayers.length === 0 && customLayers.length === 0) return null;

  const stack = { mapLayers, customLayers };
  const active = sets.find((s) => s.id === activeId) ?? null;
  const activeUndecided = active ? undecidedLayerIds(active, stack) : [];

  const labelOf = (set: (typeof sets)[number]) => {
    if (undecidedLayerIds(set, stack).length > 0) return `${set.name} (needs update)`;
    if (set.id === activeId && differsFromSet(set, stack)) return `${set.name} (modified)`;
    return set.name;
  };

  const handleDelete = async () => {
    if (active && (await confirmAction(`表示セット「${active.name}」を削除しますか？`))) {
      useAppStore.getState().deleteLayerVisibilitySet(active.id);
    }
  };

  return (
    <div className="p-2.5 space-y-2 bg-surface-panel/40 border border-border-base/40 rounded-lg">
      <div className="flex items-center gap-1.5">
        <Select
          aria-label="Layer visibility set"
          value={active?.id ?? ''}
          disabled={sets.length === 0}
          onChange={(e) => useAppStore.getState().applyLayerVisibilitySet(e.target.value)}
        >
          <option value="" disabled>
            {sets.length === 0 ? 'No saved sets' : 'Select a set...'}
          </option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {labelOf(s)}
            </option>
          ))}
        </Select>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Save the current display as a new set"
          aria-label="Save display as new set"
          onClick={() => setEditing('new')}
        >
          <Plus size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Update the selected set with the current display"
          aria-label="Update set with current display"
          disabled={!active}
          onClick={() => active && useAppStore.getState().overwriteLayerVisibilitySet(active.id)}
        >
          <Save size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Rename the selected set"
          aria-label="Rename set"
          disabled={!active}
          onClick={() => setEditing('rename')}
        >
          <Pencil size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Delete the selected set"
          aria-label="Delete set"
          disabled={!active}
          onClick={handleDelete}
        >
          <Trash2 size={14} />
        </Button>
      </div>

      {editing && (
        <div className="flex items-center gap-1.5">
          <InlineNameInput
            name={editing === 'rename' ? (active?.name ?? '') : ''}
            onRename={(name) => {
              const state = useAppStore.getState();
              if (editing === 'rename' && active) state.renameLayerVisibilitySet(active.id, name);
              if (editing === 'new') state.saveLayerVisibilitySet(name);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
            className="h-7"
          />
        </div>
      )}

      {active && activeUndecided.length > 0 && (
        <AlertBox
          variant="warning"
          title={`${activeUndecided.length} layer(s) not in this set`}
          action={
            <Button
              size="xs"
              variant="secondary"
              onClick={() => useAppStore.getState().overwriteLayerVisibilitySet(active.id)}
            >
              Update
            </Button>
          }
        >
          Layers added after the set was saved keep their current visibility when it is applied. Update the set to
          include them.
        </AlertBox>
      )}
    </div>
  );
}
