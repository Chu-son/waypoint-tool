import { beforeEach, describe, expect, it } from 'vitest';
import { getAppState, resetAppStore } from '../../test/store';
import { makeWaypoint, waypointTree } from '../../test/fixtures';
import { DEFAULT_GEO_MAP } from '../migrations/geoMapNormalization';
import { originToLatLon } from '../../utils/geo/geoTransform';

describe('geo map settings', () => {
  beforeEach(() => resetAppStore());

  it('starts disabled with an OpenStreetMap base map and no offset', () => {
    expect(getAppState().geoMap).toEqual(DEFAULT_GEO_MAP);
    expect(getAppState().geoMap.enabled).toBe(false);
  });

  it('switching the base map keeps the origin and the alignment', () => {
    getAppState().setGeoOrigin({ kind: 'latlon', lat: 10, lon: 20 });
    getAppState().setGeoAlignment({ dx: 4, dy: 5, yawDeg: 6 });

    getAppState().setBasemap('esri_imagery');

    const { geoMap } = getAppState();
    expect(geoMap.basemapId).toBe('esri_imagery');
    expect(geoMap.origin).toEqual({ kind: 'latlon', lat: 10, lon: 20 });
    expect(geoMap.alignment).toEqual({ dx: 4, dy: 5, yawDeg: 6 });
  });

  it('switching the origin between lat/lon and UTM points at the same place', () => {
    getAppState().setGeoOrigin({ kind: 'latlon', lat: 35.681236, lon: 139.767125 });

    getAppState().setGeoOriginKind('utm');
    const utm = getAppState().geoMap.origin;
    expect(utm.kind).toBe('utm');
    expect(utm.kind === 'utm' && utm.zone).toBe(54);

    getAppState().setGeoOriginKind('latlon');
    const back = originToLatLon(getAppState().geoMap.origin);
    expect(back.lat).toBeCloseTo(35.681236, 8);
    expect(back.lon).toBeCloseTo(139.767125, 8);
  });

  it('clamps opacity to 0..1 and marks the project as modified', () => {
    getAppState().setGeoMapOpacity(3);
    expect(getAppState().geoMap.opacity).toBe(1);
    getAppState().setGeoMapOpacity(-1);
    expect(getAppState().geoMap.opacity).toBe(0);
    expect(getAppState().isDirty).toBe(true);
  });

  it('edits the custom source without touching the presets', () => {
    getAppState().updateCustomBasemap({ urlTemplate: 'https://t.example/{z}/{x}/{y}.png', attribution: 'Me' });
    getAppState().setBasemap('custom');
    const { geoMap } = getAppState();
    expect(geoMap.customBasemap.urlTemplate).toBe('https://t.example/{z}/{x}/{y}.png');
    expect(geoMap.customBasemap.maxZoom).toBe(DEFAULT_GEO_MAP.customBasemap.maxZoom);
  });
});

describe('geo map alignment history', () => {
  beforeEach(() => resetAppStore(waypointTree([makeWaypoint('a')])));

  it('a numeric alignment change is undone in one step and can be redone', () => {
    getAppState().setGeoAlignment({ dx: 10, dy: 0, yawDeg: 45 });
    expect(getAppState().geoMap.alignment).toEqual({ dx: 10, dy: 0, yawDeg: 45 });

    getAppState().undo();
    expect(getAppState().geoMap.alignment).toEqual({ dx: 0, dy: 0, yawDeg: 0 });

    getAppState().redo();
    expect(getAppState().geoMap.alignment).toEqual({ dx: 10, dy: 0, yawDeg: 45 });
  });

  it('setting the same alignment again does not add an undo step', () => {
    getAppState().setGeoAlignment({ dx: 1, dy: 1, yawDeg: 1 });
    getAppState().setGeoAlignment({ dx: 1, dy: 1, yawDeg: 1 });
    getAppState().undo();
    expect(getAppState().geoMap.alignment).toEqual({ dx: 0, dy: 0, yawDeg: 0 });
    expect(getAppState().historyPast).toHaveLength(0);
  });

  it('ignores non-finite values', () => {
    getAppState().setGeoAlignment({ dx: Number.NaN, dy: 0, yawDeg: 0 });
    expect(getAppState().geoMap.alignment).toEqual({ dx: 0, dy: 0, yawDeg: 0 });
  });

  it('reset returns to no offset and can be undone', () => {
    getAppState().setGeoAlignment({ dx: 3, dy: 4, yawDeg: 5 });
    getAppState().resetGeoAlignment();
    expect(getAppState().geoMap.alignment).toEqual({ dx: 0, dy: 0, yawDeg: 0 });
    getAppState().undo();
    expect(getAppState().geoMap.alignment).toEqual({ dx: 3, dy: 4, yawDeg: 5 });
  });

  it('undoing a node edit does not disturb the map alignment', () => {
    getAppState().pushHistorySnapshot();
    getAppState().setGeoAlignment({ dx: 2, dy: 2, yawDeg: 2 });
    getAppState().undo(); // alignment change
    expect(getAppState().geoMap.alignment).toEqual({ dx: 0, dy: 0, yawDeg: 0 });
    getAppState().undo(); // the earlier snapshot
    expect(getAppState().geoMap.alignment).toEqual({ dx: 0, dy: 0, yawDeg: 0 });
  });
});

describe('geo map alignment drag', () => {
  beforeEach(() => resetAppStore());

  it('a whole drag is one undo step', () => {
    getAppState().beginGeoAlignDrag();
    getAppState().updateGeoAlignDrag({ dx: 1, dy: 0, yawDeg: 0 });
    getAppState().updateGeoAlignDrag({ dx: 5, dy: 2, yawDeg: 0 });
    getAppState().endGeoAlignDrag();

    expect(getAppState().geoMap.alignment).toEqual({ dx: 5, dy: 2, yawDeg: 0 });
    getAppState().undo();
    expect(getAppState().geoMap.alignment).toEqual({ dx: 0, dy: 0, yawDeg: 0 });
    expect(getAppState().historyPast).toHaveLength(0);
  });

  it('cancelling restores the position before the drag and leaves no undo step', () => {
    getAppState().setGeoAlignment({ dx: 2, dy: 2, yawDeg: 10 });
    const undoDepth = getAppState().historyPast.length;

    getAppState().beginGeoAlignDrag();
    getAppState().updateGeoAlignDrag({ dx: 50, dy: 50, yawDeg: 90 });
    getAppState().cancelGeoAlignDrag();

    expect(getAppState().geoMap.alignment).toEqual({ dx: 2, dy: 2, yawDeg: 10 });
    expect(getAppState().historyPast).toHaveLength(undoDepth);
    expect(getAppState().geoAlignDrag).toBeNull();
  });

  it('a click without movement leaves no undo step', () => {
    getAppState().beginGeoAlignDrag();
    getAppState().endGeoAlignDrag();
    expect(getAppState().historyPast).toHaveLength(0);
  });

  it('drag updates outside of a drag are ignored', () => {
    getAppState().updateGeoAlignDrag({ dx: 9, dy: 9, yawDeg: 9 });
    expect(getAppState().geoMap.alignment).toEqual({ dx: 0, dy: 0, yawDeg: 0 });
  });
});
