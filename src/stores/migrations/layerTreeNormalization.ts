/**
 * Boundary normalization of the layer tree read from a project file.
 *
 * Files saved before layer groups have only `layer_order` (already reconciled against the layers that
 * exist): it becomes the top level of a tree without groups. Newer files carry `layer_root_ids` and
 * `layer_groups`; malformed entries are dropped and the tree is made well formed by `normalizeLayerTree`.
 */
import type { LayerGroup } from '../../types/layer';
import { normalizeLayerTree, type LayerTree } from '../../utils/layerTree';

const stringsOf = (value: unknown[]): string[] => value.filter((v): v is string => typeof v === 'string');

function sanitizeGroups(raw: unknown): Record<string, LayerGroup> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const groups: Record<string, LayerGroup> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const g = value as Record<string, unknown>;
    groups[id] = {
      id,
      name: typeof g.name === 'string' && g.name.trim() ? g.name : 'Group',
      visible: typeof g.visible === 'boolean' ? g.visible : true,
      children_ids: Array.isArray(g.children_ids) ? stringsOf(g.children_ids) : [],
    };
  }
  return groups;
}

/**
 * The layer tree of a project file. `layerOrder` lists every layer that exists, top first; it is the top
 * level when the file has no tree, and decides where layers missing from the tree go.
 */
export function normalizeLayerTreeData(
  data: { layer_root_ids?: unknown; layer_groups?: unknown },
  layerOrder: string[],
): LayerTree {
  if (!Array.isArray(data.layer_root_ids)) {
    return { rootLayerIds: [...layerOrder], layerGroups: {} };
  }
  return normalizeLayerTree(
    { rootLayerIds: stringsOf(data.layer_root_ids), layerGroups: sanitizeGroups(data.layer_groups) },
    layerOrder,
  );
}
