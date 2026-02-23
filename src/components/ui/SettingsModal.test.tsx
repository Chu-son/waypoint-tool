import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsModal } from './SettingsModal';
import { useAppStore } from '../../stores/appStore';

describe('SettingsModal UI', () => {
  beforeEach(() => {
    useAppStore.setState({
      optionsSchema: null,
      exportTemplates: [],
      plugins: {},
      defaultMapOpacity: 0.8,
    });
  });

  it('applies updated options schema correctly', async () => {
    // Render the modal
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    // Click the Options tab
    const optionsTab = screen.getByText('Option Schema');
    act(() => {
      optionsTab.click();
    });

    // Add a new option
    const addOptionBtn = screen.getByRole('button', { name: /Add Field/i });
    act(() => {
      addOptionBtn.click();
    });

    // Fill in the required fields
    // Fill in the required fields
    const nameInputs = screen.getAllByPlaceholderText('e.g. velocity');
    const labelInputs = screen.getAllByPlaceholderText('e.g. Target Speed');

    act(() => {
      fireEvent.change(nameInputs[0], { target: { value: 'test_opt' } });
      fireEvent.change(labelInputs[0], { target: { value: 'Test Opt' } });
    });

    // Save changes
    const applyButton = screen.getByText(/Apply Schema/i);
    act(() => {
      applyButton.click();
    });

    // Verify store
    await waitFor(() => {
      const state = useAppStore.getState();
      expect(state.optionsSchema).not.toBeNull();
      expect(state.optionsSchema?.options.length).toBe(1);
      expect(state.optionsSchema?.options[0].name).toBe('test_opt');
    });
  });
});
