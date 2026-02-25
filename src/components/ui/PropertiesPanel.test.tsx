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

  // --- 要件2: Waypoint編集 ---

  it('updates Yaw value through the numeric input', () => {
    render(<PropertiesPanel />);

    const textboxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    // X, Y, Z, Yaw — Yaw is the 4th textbox
    const yawInput = textboxes[3];
    expect(yawInput.value).toBe('0');

    fireEvent.change(yawInput, { target: { value: '1.57' } });
    fireEvent.blur(yawInput);

    const node = useAppStore.getState().nodes['test-node'];
    // After yaw=1.57, qz = sin(1.57/2) ≈ 0.707
    expect(node.transform?.qz).toBeCloseTo(Math.sin(1.57 / 2), 2);
  });

  it('shows "No item selected." when no node is selected', () => {
    useAppStore.setState({ selectedNodeIds: [] });
    render(<PropertiesPanel />);

    expect(screen.getByText(/No item selected/)).toBeInTheDocument();
  });

  it('shows multiple selection header when multiple nodes are selected', () => {
    useAppStore.setState({
      nodes: {
        'n1': { id: 'n1', type: 'manual', transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 } },
        'n2': { id: 'n2', type: 'manual', transform: { x: 5, y: 5, qx: 0, qy: 0, qz: 0, qw: 1 } },
      },
      rootNodeIds: ['n1', 'n2'],
      selectedNodeIds: ['n1', 'n2'],
    });

    render(<PropertiesPanel />);

    expect(screen.getByText('Multiple Selected (2)')).toBeInTheDocument();
  });

  // --- 要件3: オプションプロパティ ---

  it('renders option input forms when optionsSchema is defined', () => {
    useAppStore.setState({
      optionsSchema: {
        options: [
          { name: 'speed', label: 'Target Speed', type: 'float' },
          { name: 'mode', label: 'Action Mode', type: 'string' },
        ],
      },
    });

    render(<PropertiesPanel />);

    expect(screen.getByText('Target Speed')).toBeInTheDocument();
    expect(screen.getByText('Action Mode')).toBeInTheDocument();
  });

  it('updates option values in the store when changed', () => {
    useAppStore.setState({
      optionsSchema: {
        options: [
          { name: 'label_text', label: 'Label', type: 'string' },
        ],
      },
    });

    render(<PropertiesPanel />);

    // Find the text input for the option (it should be the last textbox)
    const textboxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    const optionInput = textboxes[textboxes.length - 1];

    fireEvent.change(optionInput, { target: { value: 'Dock A' } });

    const node = useAppStore.getState().nodes['test-node'];
    expect(node.options?.label_text).toBe('Dock A');
  });
});
