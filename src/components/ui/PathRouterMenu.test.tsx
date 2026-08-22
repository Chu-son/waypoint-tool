import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PathRouterMenu } from './PathRouterMenu';
import { useAppStore } from '../../stores/appStore';

vi.mock('../../stores/appStore', () => ({
  useAppStore: vi.fn(),
}));

describe('PathRouterMenu', () => {
  const mockPlugins = {
    'path-plugin-1': {
      id: 'path-plugin-1',
      manifest: {
        name: 'Dijkstra Avoidance',
        category: 'path_calculator',
        type: 'python',
        description: 'Calculates path with obstacle avoidance',
        properties: [
          { name: 'safety_margin', label: 'Safety Margin', type: 'float', default: 0.15 }
        ],
      }
    }
  };

  const mockSetActivePluginId = vi.fn();
  const mockSetPathCalculatorParams = vi.fn();
  const mockSetAutoRecalculatePath = vi.fn();
  const mockRecalculatePath = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as any).mockImplementation((selector: any) =>
      selector({
        plugins: mockPlugins,
        activePathCalculatorPluginId: null,
        setActivePathCalculatorPluginId: mockSetActivePluginId,
        pathCalculatorParams: {},
        setPathCalculatorParams: mockSetPathCalculatorParams,
        autoRecalculatePath: true,
        setAutoRecalculatePath: mockSetAutoRecalculatePath,
        isCalculatingPath: false,
        recalculatePath: mockRecalculatePath,
      })
    );
  });

  it('renders default button text when no active plugin', () => {
    render(<PathRouterMenu />);
    expect(screen.getByText('Route: Straight')).toBeInTheDocument();
  });

  it('opens menu on click and lists path calculators', () => {
    render(<PathRouterMenu />);
    const button = screen.getByTitle('Path Routing Settings');
    fireEvent.click(button);

    expect(screen.getByText('Path Routing')).toBeInTheDocument();
    expect(screen.getByText('Straight Line (Default)')).toBeInTheDocument();
    expect(screen.getByText('Dijkstra Avoidance')).toBeInTheDocument();
  });

  it('selects a path calculator plugin', () => {
    render(<PathRouterMenu />);
    const button = screen.getByTitle('Path Routing Settings');
    fireEvent.click(button);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'path-plugin-1' } });

    expect(mockSetActivePluginId).toHaveBeenCalledWith('path-plugin-1');
  });
});
