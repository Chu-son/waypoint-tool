import { useId } from 'react';
import { Globe, Move, RotateCcw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../stores/appStore';
import type { BasemapId, GeoAlignment } from '../../../types/geo';
import { BASEMAP_CHOICES, isValidTileTemplate, resolveBasemap } from '../../../utils/geo/basemapPresets';
import { Button } from '../common/Button';
import { FieldLabel } from '../common/FieldLabel';
import { Input } from '../common/Input';
import { LabeledNumericInput } from '../common/LabeledNumericInput';
import { Select } from '../common/Select';
import { Slider } from '../common/Slider';
import { ToggleSwitch } from '../common/ToggleSwitch';
import { CardFrame } from './LayerCardShell';
import { GeoOriginFields } from './GeoOriginFields';

/** Card for the geographic base map (OSM / satellite tiles behind every layer): source, origin and alignment. */
export function GeoMapCard() {
  const { geoMap, isAligning } = useAppStore(
    useShallow((state) => ({ geoMap: state.geoMap, isAligning: state.appMode.mode === 'geo_map_align' })),
  );
  const setGeoMapEnabled = useAppStore((state) => state.setGeoMapEnabled);
  const setGeoMapOpacity = useAppStore((state) => state.setGeoMapOpacity);
  const setBasemap = useAppStore((state) => state.setBasemap);
  const updateCustomBasemap = useAppStore((state) => state.updateCustomBasemap);
  const setGeoOrigin = useAppStore((state) => state.setGeoOrigin);
  const setGeoOriginKind = useAppStore((state) => state.setGeoOriginKind);
  const resetGeoAlignment = useAppStore((state) => state.resetGeoAlignment);
  const beginGeoAlignDrag = useAppStore((state) => state.beginGeoAlignDrag);
  const updateGeoAlignDrag = useAppStore((state) => state.updateGeoAlignDrag);
  const endGeoAlignDrag = useAppStore((state) => state.endGeoAlignDrag);
  const setActiveTool = useAppStore((state) => state.setActiveTool);

  const basemapId = useId();
  const urlId = useId();
  const attributionId = useId();

  const { enabled, alignment, customBasemap } = geoMap;
  const source = resolveBasemap(geoMap.basemapId, customBasemap);

  // Typing into a number field is one editing session, so it becomes a single undo step.
  const numberField = (label: string, key: keyof GeoAlignment, precision: number, step: number) => (
    <LabeledNumericInput
      label={label}
      value={alignment[key]}
      step={step}
      precision={precision}
      onEditStart={beginGeoAlignDrag}
      onChange={(value) => updateGeoAlignDrag({ ...alignment, [key]: value })}
      onEditEnd={endGeoAlignDrag}
    />
  );

  return (
    <CardFrame visible={enabled} className="cursor-default">
      <div className="flex items-center justify-between gap-2 relative z-10">
        <span className="text-sm font-bold text-text-base flex items-center gap-1.5">
          <Globe size={14} className="text-accent-reference" />
          Geo Base Map
        </span>
        <ToggleSwitch checked={enabled} onChange={setGeoMapEnabled} title="Show geo base map" />
      </div>

      {enabled && (
        <div className="relative z-10 mt-2.5 pt-2.5 border-t border-border-base/40 space-y-3">
          <div className="space-y-2">
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor={basemapId}>Base map</FieldLabel>
              <Select
                id={basemapId}
                value={geoMap.basemapId}
                onChange={(e) => setBasemap(e.target.value as BasemapId)}
                className="text-xs border-border-base/50 h-7"
              >
                {BASEMAP_CHOICES.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.label}
                  </option>
                ))}
              </Select>
            </div>

            {geoMap.basemapId === 'custom' && (
              <div className="space-y-2">
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor={urlId}>Tile URL template</FieldLabel>
                  <Input
                    id={urlId}
                    value={customBasemap.urlTemplate}
                    onChange={(e) => updateCustomBasemap({ urlTemplate: e.target.value })}
                    className="h-7 text-[11px] font-mono"
                    placeholder="https://example.com/{z}/{x}/{y}.png"
                    spellCheck={false}
                  />
                  {!isValidTileTemplate(customBasemap.urlTemplate) && (
                    <p role="alert" className="text-[10px] text-danger-base">
                      Use an http(s) URL containing {'{z}'}, {'{x}'} and {'{y}'}.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <LabeledNumericInput
                    label="Max zoom"
                    value={customBasemap.maxZoom}
                    precision={0}
                    min={0}
                    max={24}
                    onChange={(maxZoom) => updateCustomBasemap({ maxZoom: Math.round(maxZoom) })}
                  />
                  <div className="space-y-0.5">
                    <FieldLabel htmlFor={attributionId} className="mb-0.5">
                      Attribution
                    </FieldLabel>
                    <Input
                      id={attributionId}
                      value={customBasemap.attribution}
                      onChange={(e) => updateCustomBasemap({ attribution: e.target.value })}
                      className="h-7 text-[11px]"
                    />
                  </div>
                </div>
              </div>
            )}

            <Slider
              label="Opacity"
              valueDisplay={`${Math.round(geoMap.opacity * 100)}%`}
              min="0"
              max="1"
              step="0.05"
              value={geoMap.opacity}
              aria-label="Base map opacity"
              onChange={(e) => setGeoMapOpacity(parseFloat(e.target.value))}
            />
            <p className="text-[10px] text-text-muted px-0.5">
              {source.attribution || 'No attribution set'} — tiles are downloaded from the provider; follow its usage
              policy.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-border-base/30">
            <span className="text-[11px] font-bold text-text-base">World origin (0, 0) is at</span>
            <GeoOriginFields origin={geoMap.origin} onChange={setGeoOrigin} onChangeKind={setGeoOriginKind} />
          </div>

          <div className="space-y-2 pt-2 border-t border-border-base/30">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-text-base flex items-center gap-1.5">
                <Move size={12} className="text-accent-generator" />
                Alignment
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[10px] text-text-muted hover:text-text-base gap-1"
                onClick={resetGeoAlignment}
                title="Reset offset and rotation"
              >
                <RotateCcw size={11} />
                <span>Reset</span>
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {numberField('Offset X (m)', 'dx', 3, 0.1)}
              {numberField('Offset Y (m)', 'dy', 3, 0.1)}
              {numberField('Rotation (°)', 'yawDeg', 2, 1)}
            </div>
            <Button
              type="button"
              variant={isAligning ? 'primary' : 'secondary'}
              size="sm"
              className="w-full gap-1.5"
              aria-pressed={isAligning}
              onClick={() => setActiveTool(isAligning ? 'select' : 'geo_align')}
              title="Drag on the canvas to move the map, Shift+drag to rotate it about the origin"
            >
              <Move size={13} />
              <span>{isAligning ? 'Done aligning' : 'Align on canvas'}</span>
            </Button>
          </div>
        </div>
      )}
    </CardFrame>
  );
}
