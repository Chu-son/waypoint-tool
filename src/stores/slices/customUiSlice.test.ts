import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../appStore';
import { MockBackendAPI } from '../../api/backend/mock';
import { BackendAPI } from '../../api';

describe('customUiSlice', () => {
  beforeEach(() => {
    useAppStore.setState({
      customUiConfig: null,
      isCustomUiMode: false,
    });
  });

  it('should initialize with default state', () => {
    const state = useAppStore.getState();
    expect(state.customUiConfig).toBeNull();
    expect(state.isCustomUiMode).toBe(false);
    expect(state.getEffectiveBrandName()).toBe('Waypoint Tool');
  });

  it('should set Custom UI config and update brand name', () => {
    useAppStore.getState().setCustomUiConfig({
      brand: { appName: 'My Custom App' },
    });

    const state = useAppStore.getState();
    expect(state.isCustomUiMode).toBe(true);
    expect(state.getEffectiveBrandName()).toBe('My Custom App');
  });

  it('should toggle Custom UI mode', () => {
    useAppStore.getState().setCustomUiConfig({
      brand: { appName: 'My Custom App' },
    });

    expect(useAppStore.getState().isCustomUiMode).toBe(true);
    expect(useAppStore.getState().getEffectiveBrandName()).toBe('My Custom App');

    useAppStore.getState().toggleCustomUiMode();
    expect(useAppStore.getState().isCustomUiMode).toBe(false);
    expect(useAppStore.getState().getEffectiveBrandName()).toBe('Waypoint Tool');

    useAppStore.getState().toggleCustomUiMode();
    expect(useAppStore.getState().isCustomUiMode).toBe(true);
  });

  it('should load Custom UI config from backend API and apply layout overrides', async () => {
    const mockBackend = BackendAPI as unknown as MockBackendAPI;
    mockBackend.setMockCustomUiConfig({
      brand: { appName: 'Acme Route Planner' },
      layout: {
        showWelcomeModal: false,
        leftPanel: {
          defaultOpen: false,
          defaultWidth: 400,
          viewMode: 'split',
        },
      },
    });

    await useAppStore.getState().loadCustomUiConfig();

    const state = useAppStore.getState();
    expect(state.isCustomUiMode).toBe(true);
    expect(state.getEffectiveBrandName()).toBe('Acme Route Planner');
    expect(state.isWelcomeModalOpen).toBe(false);
    expect(state.isInitialLaunch).toBe(false);
    expect(state.isLeftPanelOpen).toBe(false);
    expect(state.leftPanelWidth).toBe(400);
    expect(state.leftPanelViewMode).toBe('split');
  });
});
