import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { PropertiesPanel } from './PropertiesPanel';
import { useAppStore } from '../../stores/appStore';

describe('PropertiesPanel UI', () => {
  beforeEach(() => {
    const store = useAppStore.getState();
    store.nodes = {
      'test-node': {
        id: 'test-node',
        type: 'manual',
        transform: { x: 10, y: 20, qx: 0, qy: 0, qz: 0, qw: 1 },
      }
    };
    store.selectedNodeIds = ['test-node'];
    store.rootNodeIds = ['test-node'];
    store.optionsSchema = null;
  });

  it('updates the store correctly when X/Y values change', () => {
    render(<PropertiesPanel />);

    const header = screen.getByText('Waypoint [0]');
    expect(header).toBeInTheDocument();

    // NumericInput renders type="text", so query by textbox role
    const textboxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    const xInput = textboxes[0];
    const yInput = textboxes[1];

    expect(xInput.value).toBe('10');
    expect(yInput.value).toBe('20');

    // Simulate user changing X to 15
    fireEvent.change(xInput, { target: { value: '15' } });
    fireEvent.blur(xInput);

    const state = useAppStore.getState();
    expect(state.nodes['test-node'].transform?.x).toBe(15);
  });
});
