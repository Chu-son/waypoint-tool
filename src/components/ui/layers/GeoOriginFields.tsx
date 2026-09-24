import { useId } from 'react';
import type { GeoOrigin } from '../../../types/geo';
import { convertOrigin } from '../../../utils/geo/geoTransform';
import { utmZoneFromLon } from '../../../utils/geo/utm';
import { FieldLabel } from '../common/FieldLabel';
import { LabeledNumericInput } from '../common/LabeledNumericInput';
import { Select } from '../common/Select';

interface GeoOriginFieldsProps {
  origin: GeoOrigin;
  onChange: (origin: GeoOrigin) => void;
  onChangeKind: (kind: GeoOrigin['kind']) => void;
}

/** Where the world origin (0, 0) lies on Earth, entered as latitude/longitude or as UTM. */
export function GeoOriginFields({ origin, onChange, onChangeKind }: GeoOriginFieldsProps) {
  const kindId = useId();
  const hemisphereId = useId();
  const latLonOrigin = convertOrigin(origin, 'latlon');
  const naturalZone = latLonOrigin.kind === 'latlon' ? utmZoneFromLon(latLonOrigin.lon) : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor={kindId}>Origin format</FieldLabel>
        <Select
          id={kindId}
          value={origin.kind}
          onChange={(e) => onChangeKind(e.target.value as GeoOrigin['kind'])}
          className="text-xs border-border-base/50 h-7"
        >
          <option value="latlon">Latitude / Longitude</option>
          <option value="utm">UTM</option>
        </Select>
      </div>

      {origin.kind === 'latlon' ? (
        <div className="grid grid-cols-2 gap-1.5">
          <LabeledNumericInput
            label="Latitude (°)"
            value={origin.lat}
            precision={8}
            min={-90}
            max={90}
            onChange={(lat) => onChange({ ...origin, lat })}
          />
          <LabeledNumericInput
            label="Longitude (°)"
            value={origin.lon}
            precision={8}
            min={-180}
            max={180}
            onChange={(lon) => onChange({ ...origin, lon })}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          <LabeledNumericInput
            label="UTM zone"
            value={origin.zone}
            precision={0}
            min={1}
            max={60}
            onChange={(zone) => onChange({ ...origin, zone: Math.round(zone) })}
          />
          <div className="space-y-0.5">
            <FieldLabel htmlFor={hemisphereId} className="mb-0.5">
              Hemisphere
            </FieldLabel>
            <Select
              id={hemisphereId}
              value={origin.hemisphere}
              onChange={(e) => onChange({ ...origin, hemisphere: e.target.value === 'S' ? 'S' : 'N' })}
              className="text-xs border-border-base/50 h-7"
            >
              <option value="N">North</option>
              <option value="S">South</option>
            </Select>
          </div>
          <LabeledNumericInput
            label="Easting (m)"
            value={origin.easting}
            precision={3}
            onChange={(easting) => onChange({ ...origin, easting })}
          />
          <LabeledNumericInput
            label="Northing (m)"
            value={origin.northing}
            precision={3}
            onChange={(northing) => onChange({ ...origin, northing })}
          />
        </div>
      )}

      {origin.kind === 'utm' && naturalZone !== origin.zone && (
        <p className="text-[10px] text-text-muted px-0.5">
          These coordinates lie in zone {naturalZone}; check the zone number.
        </p>
      )}
    </div>
  );
}
