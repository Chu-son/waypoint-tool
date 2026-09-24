import { describe, expect, it } from 'vitest';
import { latLonToUtm, utmToLatLon, utmZoneFromLon } from './utm';

describe('UTM conversion', () => {
  it('places the equator/prime-meridian point at its published UTM position', () => {
    const utm = latLonToUtm(0, 0);
    expect(utm.zone).toBe(31);
    expect(utm.hemisphere).toBe('N');
    expect(utm.easting).toBeCloseTo(166021.443, 2);
    expect(utm.northing).toBeCloseTo(0, 2);
  });

  it('puts the central meridian at the false easting with the scaled meridian arc as northing', () => {
    const utm = latLonToUtm(45, 3);
    expect(utm.zone).toBe(31);
    expect(utm.easting).toBeCloseTo(500000, 3);
    expect(utm.northing).toBeCloseTo(4982950.4, 0);
  });

  it('uses the southern false northing below the equator', () => {
    const utm = latLonToUtm(-33.8688, 151.2093);
    expect(utm.hemisphere).toBe('S');
    expect(utm.zone).toBe(56);
    expect(utm.northing).toBeGreaterThan(6000000);
  });

  it.each([
    ['Tokyo', 35.681236, 139.767125],
    ['Sydney', -33.8688, 151.2093],
    ['Reykjavik', 64.1466, -21.9426],
    ['Quito', -0.1807, -78.4678],
  ])('round-trips %s within a millimetre', (_name, lat, lon) => {
    const back = utmToLatLon(latLonToUtm(lat, lon));
    // 1e-8 deg ≈ 1 mm
    expect(back.lat).toBeCloseTo(lat, 8);
    expect(back.lon).toBeCloseTo(lon, 8);
  });

  it('keeps using the requested zone for points outside it', () => {
    const utm = latLonToUtm(35.68, 139.77, 53);
    expect(utm.zone).toBe(53);
    expect(utm.easting).toBeGreaterThan(900000);
    const back = utmToLatLon(utm);
    expect(back.lon).toBeCloseTo(139.77, 8);
  });

  it.each([
    [-180, 1],
    [-0.0001, 30],
    [0, 31],
    [139.7, 54],
    [179.999, 60],
    [180, 1],
  ])('maps longitude %d to zone %d', (lon, zone) => {
    expect(utmZoneFromLon(lon)).toBe(zone);
  });
});
