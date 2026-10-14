import { useMemo } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';
import { Slider } from '../common/Slider';
import { Select } from '../common/Select';
import { FieldLabel } from '../common/FieldLabel';
import { BLEND_MODE_OPTIONS } from '../../../utils/blendModes';
import { resolveMapLayers } from '../../../utils/layerStack';
import { idsHiddenByGroups } from '../../../utils/layerTree';
import { confirmRemoveLayerItems } from '../../../services/layerCommands';
import type { MapBlendMode } from '../../../types/store';
import { MapClipEditor } from '../layers/MapClipEditor';
import { LayerInspectorHeader } from './LayerInspectorHeader';
import { MapPoseSection } from './MapPoseSection';
import { MapThresholdSection } from './MapThresholdSection';

/** Inspector of one map instance: pose, display, use area and the occupancy thresholds of its map. */
export function MapLayerInspector({ id }: { id: string }) {
  const mapSources = useAppStore((state) => state.mapSources);
  const mapLayers = useAppStore((state) => state.mapLayers);
  const rootLayerIds = useAppStore((state) => state.rootLayerIds);
  const layerGroups = useAppStore((state) => state.layerGroups);
  const updateMapLayer = useAppStore((state) => state.updateMapLayer);
  const updateMapSource = useAppStore((state) => state.updateMapSource);
  const setMapLayerOrigin = useAppStore((state) => state.setMapLayerOrigin);
  const setMapLayerPoseLinked = useAppStore((state) => state.setMapLayerPoseLinked);
  const duplicateLayerItems = useAppStore((state) => state.duplicateLayerItems);

  // The layer with its own flags (not as composited): this panel edits them.
  const layer = useMemo(
    () => resolveMapLayers(mapSources, mapLayers).find((l) => l.id === id),
    [mapSources, mapLayers, id],
  );
  const hiddenByAncestor = useMemo(
    () => idsHiddenByGroups({ rootLayerIds, layerGroups }).has(id),
    [rootLayerIds, layerGroups, id],
  );
  if (!layer) return null;
  const sharedCount = mapLayers.filter((l) => l.sourceId === layer.sourceId).length;
  const source = mapSources.find((s) => s.id === layer.sourceId);

  return (
    <div className="flex-1 overflow-y-auto w-full p-4 space-y-4">
      <LayerInspectorHeader
        icon={<MapIcon size={16} className="text-accent-generator" />}
        kind={sharedCount > 1 ? `Map Layer (shared ×${sharedCount})` : 'Map Layer'}
        name={layer.name}
        onRename={(name) => updateMapLayer(id, { name })}
        visible={layer.visible}
        hiddenByAncestor={hiddenByAncestor}
        onToggleVisible={() => updateMapLayer(id, { visible: !layer.visible })}
        onDuplicate={() => duplicateLayerItems([id])}
        onRemove={() => void confirmRemoveLayerItems([id])}
      />

      <MapPoseSection
        layer={layer}
        sharedCount={sharedCount}
        onSetOrigin={(origin) => setMapLayerOrigin(id, origin)}
        onSetPoseLinked={(linked) => setMapLayerPoseLinked(id, linked)}
      />

      <div className="space-y-2 pt-3 border-t border-border-base/30">
        <span className="text-[11px] font-bold text-text-base">Display</span>
        <Slider
          label="Layer Opacity"
          valueDisplay={`${Math.round(layer.opacity * 100)}%`}
          min="0"
          max="1"
          step="0.05"
          value={layer.opacity}
          onChange={(e) => updateMapLayer(id, { opacity: parseFloat(e.target.value) })}
        />
        <div className="flex flex-col gap-1 mt-1">
          <FieldLabel>Blend Mode</FieldLabel>
          <Select
            aria-label="Blend Mode"
            value={layer.blend_mode || 'overwrite'}
            onChange={(e) => updateMapLayer(id, { blend_mode: e.target.value as MapBlendMode })}
            className="text-xs border-border-base/50 h-7"
          >
            {BLEND_MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="pt-3 border-t border-border-base/30">
        <MapClipEditor layer={layer} onChange={(clip) => updateMapLayer(id, { clip })} />
      </div>

      <div className="pt-3 border-t border-border-base/30">
        <MapThresholdSection
          layer={layer}
          onUpdate={(updates) => {
            if (source) updateMapSource(source.id, { info: { ...source.info, ...updates } });
          }}
        />
      </div>
    </div>
  );
}
