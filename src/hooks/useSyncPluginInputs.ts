import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';
import type { PluginInputDef } from '../types/plugin';
import { interactionKeyOf } from '../utils/pluginInputTransform';

/**
 * Loads the saved inputs of a plugin output (a generator, an annotation group) into the live input editor
 * when it is opened, and again whenever the saved inputs change (a group move, undo, redo). Each input of
 * the plugin is replaced as a whole, so a value the saved data no longer has does not linger.
 */
export function useSyncPluginInputs(
  id: string,
  inputs: PluginInputDef[] | undefined,
  saved: Record<string, unknown> | undefined,
): void {
  useEffect(() => {
    if (!saved) return;
    const update = useAppStore.getState().updatePluginInteractionData;
    const keys = inputs ? inputs.map(interactionKeyOf) : Object.keys(saved);
    for (const key of keys) update(key, saved[key]);
    // `inputs` comes from the plugin manifest and does not change while the output is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, saved]);
}
