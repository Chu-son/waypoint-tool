import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MapCanvasPlaceholder } from './MapCanvasPlaceholder';

// Mock the store
vi.mock('../../stores/appStore', () => ({
  useAppStore: Object.assign(vi.fn(), {
    getState: vi.fn(),
    setState: vi.fn(),
    subscribe: vi.fn(),
  }),
}));

import { useAppStore } from '../../stores/appStore';

// A helper for useAppStore mocking
const mockStoreState = (state: any) => {
  (useAppStore as any).mockImplementation((selector: any) => selector(state));
};

describe('MapCanvasPlaceholder', () => {
  it('renders correctly', () => {
    mockStoreState({ activeTool: 'select', mapLayers: [{ id: '1' }] });
    const { getByText } = render(<MapCanvasPlaceholder />);
    expect(getByText(/Map Viewport Placeholder/i)).toBeInTheDocument();
  });
});
