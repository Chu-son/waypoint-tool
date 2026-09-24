import { describe, expect, it } from 'vitest';
import {
  BASEMAP_CHOICES,
  buildTileUrl,
  DEFAULT_CUSTOM_BASEMAP,
  isValidTileTemplate,
  resolveBasemap,
} from './basemapPresets';

describe('basemap presets', () => {
  it('offers a road map, satellite imagery and a custom source', () => {
    const ids = BASEMAP_CHOICES.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['osm', 'esri_imagery', 'gsi_photo', 'custom']));
  });

  it('resolves presets by id and the custom source for "custom"', () => {
    const custom = { urlTemplate: 'https://t.example/{z}/{x}/{y}.png', maxZoom: 15, attribution: 'me' };
    expect(resolveBasemap('osm', custom).attribution).toContain('OpenStreetMap');
    expect(resolveBasemap('custom', custom)).toBe(custom);
  });

  it('every preset has a valid template and an attribution', () => {
    for (const { id } of BASEMAP_CHOICES.filter((c) => c.id !== 'custom')) {
      const source = resolveBasemap(id, DEFAULT_CUSTOM_BASEMAP);
      expect(isValidTileTemplate(source.urlTemplate)).toBe(true);
      expect(source.attribution).not.toBe('');
    }
  });

  it('fills placeholders by name so z/y/x ordered templates work', () => {
    const esri = resolveBasemap('esri_imagery', DEFAULT_CUSTOM_BASEMAP);
    expect(buildTileUrl(esri.urlTemplate, { z: 17, x: 116420, y: 51614 })).toBe(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/17/51614/116420',
    );
    expect(buildTileUrl('https://t.example/{z}/{x}/{y}.jpg', { z: 3, x: 4, y: 5 })).toBe('https://t.example/3/4/5.jpg');
  });

  it.each([
    ['https://t.example/{z}/{x}/{y}.png', true],
    ['http://t.example/{z}/{y}/{x}', true],
    ['file:///etc/passwd/{z}/{x}/{y}', false],
    ['https://t.example/{z}/{x}.png', false],
    ['', false],
  ])('validates template %s → %s', (template, valid) => {
    expect(isValidTileTemplate(template)).toBe(valid);
  });
});
