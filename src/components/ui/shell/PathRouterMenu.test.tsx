import { fireEvent, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PathRouterMenu } from './PathRouterMenu';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { makePlugin } from '../../../test/fixtures';

const dijkstra = makePlugin('path-plugin-1', {
  name: 'Dijkstra Avoidance',
  category: 'path_calculator',
  primary_output: 'path_calculator',
  description: 'Calculates path with obstacle avoidance',
  properties: [{ name: 'safety_margin', label: 'Safety Margin', type: 'float', default: 0.15 }],
});

const renderMenu = () =>
  renderWithStore(<PathRouterMenu />, { plugins: { [dijkstra.id]: dijkstra }, autoRecalculatePath: false });

describe('PathRouterMenu', () => {
  it('shows straight-line routing by default', () => {
    renderMenu();
    expect(screen.getByText('Route: Straight')).toBeInTheDocument();
  });

  it('lists the available path calculators', () => {
    renderMenu();
    fireEvent.click(screen.getByTitle('Path Routing Settings'));

    expect(screen.getByText('Path Routing')).toBeInTheDocument();
    expect(screen.getByText('Straight Line (Default)')).toBeInTheDocument();
    expect(screen.getByText('Dijkstra Avoidance')).toBeInTheDocument();
  });

  it('activates the chosen path calculator', () => {
    renderMenu();
    fireEvent.click(screen.getByTitle('Path Routing Settings'));

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'path-plugin-1' } });

    expect(getAppState().activePathCalculatorPluginId).toBe('path-plugin-1');
  });
});
