import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { DEFAULT_GEO_MAP } from '../../../stores/migrations/geoMapNormalization';
import type { GeoMapSettings } from '../../../types/geo';
import { GeoMapCard } from './GeoMapCard';

const enabled = (overrides: Partial<GeoMapSettings> = {}) => ({
  geoMap: { ...DEFAULT_GEO_MAP, enabled: true, ...overrides },
});

describe('GeoMapCard', () => {
  it('is off by default and shows only the switch', () => {
    renderWithStore(<GeoMapCard />);

    expect(screen.getByRole('switch', { name: /show geo base map/i })).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByLabelText('Base map')).not.toBeInTheDocument();
  });

  it('turns the base map on and reveals its settings', async () => {
    const { user } = renderWithStore(<GeoMapCard />);

    await user.click(screen.getByRole('switch', { name: /show geo base map/i }));

    expect(getAppState().geoMap.enabled).toBe(true);
    expect(screen.getByLabelText('Base map')).toBeInTheDocument();
  });

  it('collapses and expands the settings while the base map stays on', async () => {
    const { user } = renderWithStore(<GeoMapCard />, enabled());
    expect(screen.getByLabelText('Base map')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Collapse settings' }));
    expect(screen.queryByLabelText('Base map')).not.toBeInTheDocument();
    expect(getAppState().geoMap.enabled).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Expand settings' }));
    expect(screen.getByLabelText('Base map')).toBeInTheDocument();
  });

  it('offers no collapse control while the base map is off', () => {
    renderWithStore(<GeoMapCard />);
    expect(screen.queryByRole('button', { name: /collapse settings/i })).not.toBeInTheDocument();
  });

  describe('base map source', () => {
    it('switches between the road map and satellite imagery', async () => {
      const { user } = renderWithStore(<GeoMapCard />, enabled());

      await user.selectOptions(screen.getByLabelText('Base map'), 'Satellite (Esri)');

      expect(getAppState().geoMap.basemapId).toBe('esri_imagery');
      expect(screen.getByText(/Tiles © Esri/)).toBeInTheDocument();
    });

    it('asks for a usable tile URL when a custom source is chosen', async () => {
      const { user } = renderWithStore(<GeoMapCard />, enabled({ basemapId: 'custom' }));
      const url = screen.getByLabelText('Tile URL template');

      await user.clear(url);
      await user.type(url, 'not a url');
      expect(screen.getByRole('alert')).toHaveTextContent(/http\(s\) URL/);

      await user.clear(url);
      await user.click(url);
      await user.paste('https://tiles.example.com/{z}/{x}/{y}.png');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(getAppState().geoMap.customBasemap.urlTemplate).toBe('https://tiles.example.com/{z}/{x}/{y}.png');
    });

    it('changes the opacity', () => {
      renderWithStore(<GeoMapCard />, enabled());

      fireEvent.change(screen.getByLabelText('Base map opacity'), { target: { value: '0.25' } });

      expect(getAppState().geoMap.opacity).toBe(0.25);
    });
  });

  describe('origin', () => {
    it('takes a latitude and longitude', async () => {
      const { user } = renderWithStore(<GeoMapCard />, enabled({ origin: { kind: 'latlon', lat: 0, lon: 0 } }));

      const lat = screen.getByLabelText('Latitude (°)');
      await user.clear(lat);
      await user.type(lat, '35.681236{Enter}');
      const lon = screen.getByLabelText('Longitude (°)');
      await user.clear(lon);
      await user.type(lon, '139.767125{Enter}');

      expect(getAppState().geoMap.origin).toEqual({ kind: 'latlon', lat: 35.681236, lon: 139.767125 });
    });

    it('rejects a latitude beyond the poles', async () => {
      const { user } = renderWithStore(<GeoMapCard />, enabled({ origin: { kind: 'latlon', lat: 10, lon: 20 } }));

      const lat = screen.getByLabelText('Latitude (°)');
      await user.clear(lat);
      await user.type(lat, '95{Enter}');

      expect(getAppState().geoMap.origin).toMatchObject({ lat: 90 });
    });

    it('switches to UTM without moving the point and back again', async () => {
      const { user } = renderWithStore(
        <GeoMapCard />,
        enabled({ origin: { kind: 'latlon', lat: 35.681236, lon: 139.767125 } }),
      );

      await user.selectOptions(screen.getByLabelText('Origin format'), 'UTM');

      expect(screen.getByLabelText('UTM zone')).toHaveValue('54');
      expect(screen.getByLabelText('Hemisphere')).toHaveValue('N');
      expect(screen.queryByLabelText('Latitude (°)')).not.toBeInTheDocument();
      const origin = getAppState().geoMap.origin;
      expect(origin.kind === 'utm' && Math.round(origin.easting)).toBeGreaterThan(300000);

      await user.selectOptions(screen.getByLabelText('Origin format'), 'Latitude / Longitude');

      expect(Number(screen.getByLabelText('Latitude (°)').getAttribute('value') ?? '0')).toBeCloseTo(35.681236, 5);
    });

    it('takes UTM coordinates including the hemisphere', async () => {
      const { user } = renderWithStore(
        <GeoMapCard />,
        enabled({ origin: { kind: 'utm', zone: 54, hemisphere: 'N', easting: 500000, northing: 0 } }),
      );

      await user.selectOptions(screen.getByLabelText('Hemisphere'), 'South');
      const easting = screen.getByLabelText('Easting (m)');
      await user.clear(easting);
      await user.type(easting, '388123.5{Enter}');

      expect(getAppState().geoMap.origin).toMatchObject({
        kind: 'utm',
        hemisphere: 'S',
        easting: 388123.5,
      });
    });

    it('points out a UTM zone that does not match the coordinates', () => {
      renderWithStore(
        <GeoMapCard />,
        enabled({ origin: { kind: 'utm', zone: 10, hemisphere: 'N', easting: 500000, northing: 3950000 } }),
      );
      // zone 10's central meridian is 123°W, so an easting of 500000 sits in zone 10 itself
      expect(screen.queryByText(/check the zone number/i)).not.toBeInTheDocument();

      act(() =>
        getAppState().setGeoOrigin({ kind: 'utm', zone: 10, hemisphere: 'N', easting: 900000, northing: 3950000 }),
      );
      expect(screen.getByText(/check the zone number/i)).toBeInTheDocument();
    });
  });

  describe('alignment', () => {
    it('applies an offset and rotation typed into the fields', async () => {
      const { user } = renderWithStore(<GeoMapCard />, enabled());

      for (const [label, text] of [
        ['Offset X (m)', '12.5'],
        ['Offset Y (m)', '-3'],
        ['Rotation (°)', '45'],
      ]) {
        const field = screen.getByLabelText(label);
        await user.clear(field);
        await user.type(field, `${text}{Enter}`);
      }

      expect(getAppState().geoMap.alignment).toEqual({ dx: 12.5, dy: -3, yawDeg: 45 });
    });

    it('undoes everything typed into one field in a single step', async () => {
      const { user } = renderWithStore(<GeoMapCard />, enabled());

      const field = screen.getByLabelText('Offset X (m)');
      await user.clear(field);
      await user.type(field, '123{Enter}');
      expect(getAppState().geoMap.alignment.dx).toBe(123);

      act(() => getAppState().undo());

      expect(getAppState().geoMap.alignment.dx).toBe(0);
    });

    it('does not leave an undo step behind when a field is only focused', async () => {
      const { user } = renderWithStore(<GeoMapCard />, enabled());

      await user.click(screen.getByLabelText('Offset X (m)'));
      await user.click(document.body);

      expect(getAppState().historyPast).toHaveLength(0);
    });

    it('resets the offset and rotation', async () => {
      const { user } = renderWithStore(<GeoMapCard />, enabled({ alignment: { dx: 5, dy: 6, yawDeg: 7 } }));

      await user.click(screen.getByRole('button', { name: /reset/i }));

      expect(getAppState().geoMap.alignment).toEqual({ dx: 0, dy: 0, yawDeg: 0 });
    });

    it('enters and leaves the on-canvas alignment mode', async () => {
      const { user } = renderWithStore(<GeoMapCard />, enabled());

      await user.click(screen.getByRole('button', { name: 'Align on canvas' }));
      expect(getAppState().appMode.mode).toBe('geo_map_align');

      const done = screen.getByRole('button', { name: 'Done aligning' });
      expect(done).toHaveAttribute('aria-pressed', 'true');
      await user.click(done);
      expect(getAppState().appMode.mode).toBe('select');
    });

    it('shows the new numbers after the map is dragged on the canvas', () => {
      renderWithStore(<GeoMapCard />, enabled());

      act(() => {
        getAppState().beginGeoAlignDrag();
        getAppState().updateGeoAlignDrag({ dx: 7.5, dy: 0, yawDeg: 0 });
        getAppState().endGeoAlignDrag();
      });

      expect(screen.getByLabelText('Offset X (m)')).toHaveValue('7.5');
    });
  });
});
