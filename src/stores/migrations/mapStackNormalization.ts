/**
 * Boundary normalization of the map layer stack read from a project file.
 *
 * Current files hold `map_sources` (loaded maps), `map_layers` (instances of those maps with clip,
 * opacity and blend mode) and `layer_order`. Older files hold `map_layers` that each carry their own
 * image and metadata, no `layer_order`, and a `z_index` on every layer; those are split into one
 * source plus one instance per map, and ordered as before: custom layers above all maps.
 */
import { v4 as uuidv4 } from 'uuid';
import type { ClipRect, CustomLayer, MapLayerClip, MapSource, ProjectMapLayer } from '../../types/store';
import { BLEND_MODES } from '../../utils/blendModes';
import { reconcileLayerOrder } from '../../utils/layerStack';

export type NormalizedMapStack = {
  mapSources: MapSource[];
  mapLayers: ProjectMapLayer[];
  layerOrder: string[];
};

const toTriple = (raw: unknown): [number, number, number] | null =>
  Array.isArray(raw) && raw.length >= 2 ? [Number(raw[0]) || 0, Number(raw[1]) || 0, Number(raw[2]) || 0] : null;

function normalizeSource(raw: any, index: number): MapSource {
  const rawInfo = raw?.info && typeof raw.info === 'object' ? raw.info : {};
  const origin = toTriple(rawInfo.origin) ?? [0, 0, 0];
  const initial_origin = toTriple(rawInfo.initial_origin) ?? [...origin];
  return {
    id: raw?.id || uuidv4(),
    name: raw?.name || `Map ${index + 1}`,
    info: { ...rawInfo, origin, initial_origin },
    image_base64: raw?.image_base64 || raw?.imageBase64 || '',
    width: typeof raw?.width === 'number' ? raw.width : 1000,
    height: typeof raw?.height === 'number' ? raw.height : 1000,
  };
}

function normalizeClip(raw: any): MapLayerClip | null {
  if (!raw || !Array.isArray(raw.rects)) return null;
  const rects: ClipRect[] = raw.rects
    .filter(
      (r: any) =>
        r &&
        Number.isFinite(r.x) &&
        Number.isFinite(r.y) &&
        Number.isFinite(r.width) &&
        Number.isFinite(r.height) &&
        r.width >= 0 &&
        r.height >= 0,
    )
    .map((r: any) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
  return rects.length > 0 ? { rects } : null;
}

function normalizeInstance(raw: any, source: MapSource, defaultOpacity: number): ProjectMapLayer {
  return {
    id: raw?.id || uuidv4(),
    sourceId: source.id,
    name: raw?.name || source.name,
    visible: typeof raw?.visible === 'boolean' ? raw.visible : true,
    opacity: typeof raw?.opacity === 'number' ? raw.opacity : defaultOpacity,
    blend_mode: BLEND_MODES.includes(raw?.blend_mode) ? raw.blend_mode : 'overwrite',
    clip: normalizeClip(raw?.clip),
    origin_override: toTriple(raw?.origin_override),
  };
}

/** `data` is the raw project object; `customLayers` are its already-normalized custom layers, top first. */
export function normalizeMapStack(data: any, customLayers: CustomLayer[], defaultOpacity: number): NormalizedMapStack {
  const rawLayers: any[] = Array.isArray(data.map_layers ?? data.mapLayers) ? (data.map_layers ?? data.mapLayers) : [];

  let mapSources: MapSource[];
  let mapLayers: ProjectMapLayer[];

  if (Array.isArray(data.map_sources)) {
    mapSources = data.map_sources.map(normalizeSource);
    const sourceById = new Map(mapSources.map((s) => [s.id, s]));
    mapLayers = rawLayers.flatMap((raw) => {
      const source = sourceById.get(raw?.sourceId);
      return source ? [normalizeInstance(raw, source, defaultOpacity)] : [];
    });
    const used = new Set(mapLayers.map((l) => l.sourceId));
    mapSources = mapSources.filter((s) => used.has(s.id));
  } else {
    // Each legacy map becomes a source with a fresh id; its old layer id lives on as the instance id.
    mapSources = rawLayers.map((raw, index) => ({ ...normalizeSource(raw, index), id: uuidv4() }));
    mapLayers = rawLayers.map((raw, index) => normalizeInstance(raw, mapSources[index], defaultOpacity));
  }

  const ids = [...customLayers.map((l) => l.id), ...mapLayers.map((l) => l.id)];
  const layerOrder = Array.isArray(data.layer_order) ? reconcileLayerOrder(data.layer_order, ids) : ids;

  return { mapSources, mapLayers, layerOrder };
}
