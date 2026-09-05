import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusBar } from './StatusBar';
import { useAppStore } from '../../stores/appStore';

// Mock Store
vi.mock('../../stores/appStore', () => {
  const storeFn = vi.fn();
  (storeFn as any).getState = vi.fn();
  return { useAppStore: storeFn };
});

describe('StatusBar', () => {
  const mockSetEnableSnapping = vi.fn();
  const mockSaveProject = vi.fn();
  const mockTriggerFitToMaps = vi.fn();
  const mockHandleGlobalEscape = vi.fn();
  const mockSetInsertionTarget = vi.fn();

  const defaultStoreState = {
    cursorPosition: { x: 1.234, y: 5.678 },
    mapScale: 1.5,
    nodes: {
      'wp-1': {
        id: 'wp-1',
        name: 'wp_01',
        type: 'manual',
        transform: { x: 0, y: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
      },
      'wp-2': {
        id: 'wp-2',
        name: 'wp_02',
        type: 'manual',
        transform: { x: 3, y: 4, qx: 0, qy: 0, qz: 0, qw: 1 },
      },
    },
    rootNodeIds: ['wp-1', 'wp-2'],
    selectedNodeIds: [],
    selection: { type: 'none' },
    appMode: { mode: 'select' },
    insertionTarget: null,
    modalStack: [],
    isSettingsModalOpen: false,
    isExportModalOpen: false,
    isImportModalOpen: false,
    isExportMapsModalOpen: false,
    isShortcutsModalOpen: false,
    isWelcomeModalOpen: false,
    isInitialLaunch: false,
    pluginDataModalState: { isOpen: false, data: null },
    customLayers: [],
    mapLayers: [{ id: 'map-1', name: 'Map', info: { resolution: 0.05 }, visible: true }],
    enableSnapping: true,
    setEnableSnapping: mockSetEnableSnapping,
    isDirty: false,
    saveProject: mockSaveProject,
    triggerFitToMaps: mockTriggerFitToMaps,
    handleGlobalEscape: mockHandleGlobalEscape,
    showOccupancyHighlight: false,
    occupancyHighlightAlpha: 0.6,
    setOccupancyHighlightAlpha: vi.fn(),
    activeLoadingTasks: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppStore as any).mockImplementation((selector: any) => selector(defaultStoreState));
    (useAppStore as any).getState.mockReturnValue({
      ...defaultStoreState,
      setInsertionTarget: mockSetInsertionTarget,
    });
  });

  it('renders default select mode state with cursor coordinates', () => {
    render(<StatusBar />);
    expect(screen.getByText('選択ツール')).toBeInTheDocument();
    expect(screen.getByText(/1.234m/)).toBeInTheDocument();
    expect(screen.getByText('150%')).toBeInTheDocument();
    expect(screen.getByText('0.050m/px')).toBeInTheDocument();
    expect(screen.getByText('Snap')).toBeInTheDocument();
  });

  it('renders waypoint add mode and handles Esc button click', () => {
    (useAppStore as any).mockImplementation((selector: any) =>
      selector({
        ...defaultStoreState,
        appMode: {
          mode: 'waypoint_add',
          snapInput: '',
          lockedWaypointId: null,
          forcedAxis: null,
          forcedSign: null,
        },
      })
    );

    render(<StatusBar />);
    expect(screen.getByText('ウェイポイント追加')).toBeInTheDocument();
    
    const escBtn = screen.getByTitle(/Escキーまたはクリックで 選択モードへ復帰/i);
    expect(escBtn).toBeInTheDocument();

    fireEvent.click(escBtn);
    expect(mockHandleGlobalEscape).toHaveBeenCalledTimes(1);
  });

  it('renders selection count and handles clear selection Esc click', () => {
    (useAppStore as any).mockImplementation((selector: any) =>
      selector({
        ...defaultStoreState,
        selection: { type: 'nodes', ids: ['wp-1'] },
      })
    );

    render(<StatusBar />);
    expect(screen.getByText(/ノード選択中 "wp_01"/)).toBeInTheDocument();
    
    const escBtn = screen.getByTitle(/Escキーまたはクリックで 選択を解除/i);
    fireEvent.click(escBtn);
    expect(mockHandleGlobalEscape).toHaveBeenCalledTimes(1);
  });

  it('toggles snapping when Snap button is clicked', () => {
    render(<StatusBar />);
    const snapBtn = screen.getByRole('button', { name: /snap/i });
    fireEvent.click(snapBtn);
    expect(mockSetEnableSnapping).toHaveBeenCalledWith(false);
  });

  it('triggers fit to maps when Fit button is clicked', () => {
    render(<StatusBar />);
    const fitBtn = screen.getByRole('button', { name: /fit/i });
    fireEvent.click(fitBtn);
    expect(mockTriggerFitToMaps).toHaveBeenCalledTimes(1);
  });

  it('renders unsaved dirty badge and triggers save on click', () => {
    (useAppStore as any).mockImplementation((selector: any) =>
      selector({
        ...defaultStoreState,
        isDirty: true,
      })
    );

    render(<StatusBar />);
    const saveBtn = screen.getByRole('button', { name: /未保存/i });
    expect(saveBtn).toBeInTheDocument();

    fireEvent.click(saveBtn);
    expect(mockSaveProject).toHaveBeenCalledTimes(1);
  });
});
