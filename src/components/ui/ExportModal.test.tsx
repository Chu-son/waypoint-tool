import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportModal } from './ExportModal';
import { useAppStore } from '../../stores/appStore';

// Mock Tauri modules
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
}));

vi.mock('../../api/backend', () => ({
  BackendAPI: {
    exportWaypoints: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('ExportModal UI', () => {
  beforeEach(() => {
    useAppStore.setState({
      nodes: {
        'wp1': { id: 'wp1', type: 'manual', transform: { x: 1, y: 2, qx: 0, qy: 0, qz: 0, qw: 1 } },
      },
      rootNodeIds: ['wp1'],
      selectedNodeIds: [],
      exportTemplates: [],
      defaultExportFormats: [
        { id: '__default_yaml__', name: 'YAML Document', extension: 'yaml', suffix: '_yaml', enabled: true },
        { id: '__default_json__', name: 'JSON Document', extension: 'json', suffix: '_json', enabled: true },
      ],
    });
  });

  // --- 要件5: 入出力 ---

  it('displays default export formats (YAML and JSON)', () => {
    render(<ExportModal isOpen={true} onClose={vi.fn()} />);

    // ExportModal renders format names as "Name (.ext)"
    expect(screen.getByText('YAML Document (.yaml)')).toBeInTheDocument();
    expect(screen.getByText('JSON Document (.json)')).toBeInTheDocument();
  });

  it('displays custom templates in the list', () => {
    useAppStore.setState({
      exportTemplates: [
        { id: 'tmpl1', name: 'Custom ROS', extension: 'txt', suffix: '_ros', content: '{{#each waypoints}}...{{/each}}' },
      ],
    });

    render(<ExportModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Custom ROS (.txt)')).toBeInTheDocument();
  });

  // --- 要件10: エクスポートサフィックス ---

  it('renders the Export Options heading when open', () => {
    render(<ExportModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Export Options')).toBeInTheDocument();
    expect(screen.getByText('Output Formats')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<ExportModal isOpen={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });
});
