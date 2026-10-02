import type { MapBlendMode } from '../types/layer';

/** How a layer is combined with the cells below it. The order is the order shown in the UI. */
export const BLEND_MODE_OPTIONS: ReadonlyArray<{ value: MapBlendMode; label: string }> = [
  { value: 'overwrite', label: 'Overwrite (Ignore Unknown)' },
  { value: 'replace', label: 'Replace (Include Unknown)' },
  { value: 'merge_obstacles', label: 'Merge Obstacles' },
  { value: 'merge_free', label: 'Merge Free Space' },
];

export const BLEND_MODES: readonly MapBlendMode[] = BLEND_MODE_OPTIONS.map((o) => o.value);
