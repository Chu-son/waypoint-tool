import { fireEvent, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ToolPanel } from './ToolPanel';
import { renderWithStore } from '../../../test/render';
import { getAppState, PAST_WELCOME } from '../../../test/store';

describe('ToolPanel', () => {
  it('switches between the add-waypoint and measure tools', () => {
    renderWithStore(<ToolPanel />, PAST_WELCOME);

    fireEvent.click(screen.getByTitle(/add waypoint/i));
    expect(getAppState().activeTool).toBe('add_point');
    expect(getAppState().activePluginId).toBeNull();

    fireEvent.click(screen.getByTitle(/measure distance/i));
    expect(getAppState().activeTool).toBe('measure');
  });

  it('opens the export dialog and the settings dialog', () => {
    renderWithStore(<ToolPanel />, PAST_WELCOME);

    fireEvent.click(screen.getByTitle(/export waypoints/i));
    expect(getAppState().isExportModalOpen).toBe(true);

    fireEvent.click(screen.getByTitle(/settings/i));
    expect(getAppState().isSettingsModalOpen).toBe(true);
    expect(getAppState().settingsModalTab).toBe('general');
  });
});
