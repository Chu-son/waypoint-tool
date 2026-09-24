import { screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MapCanvasPlaceholder } from './MapCanvasPlaceholder';
import { renderWithStore } from '../../test/render';
import { makeMapLayer } from '../../test/fixtures';

describe('MapCanvasPlaceholder', () => {
  it('renders the placeholder viewport', () => {
    renderWithStore(<MapCanvasPlaceholder />, { mapLayers: [makeMapLayer('1')] });
    expect(screen.getByText(/Map Viewport Placeholder/i)).toBeInTheDocument();
  });
});
