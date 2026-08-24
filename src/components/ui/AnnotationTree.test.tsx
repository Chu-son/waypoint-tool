import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnnotationTree } from './AnnotationTree';
import { useAppStore } from '../../stores/appStore';
import { PointAnnotation, LineAnnotation } from '../../types/store';

describe('AnnotationTree', () => {
  const mockSelectAnnotationObjects = vi.fn();
  const mockToggleAnnotationVisibility = vi.fn();
  const mockToggleAnnotationLabelVisibility = vi.fn();
  const mockRemoveAnnotationObjects = vi.fn();
  const mockSetAnnotationEditMode = vi.fn();
  const mockSetRightPanelActiveTab = vi.fn();
  const mockSetRightPanelOpen = vi.fn();

  const mockPoint: PointAnnotation = {
    id: 'point-1',
    name: 'Start Point',
    type: 'point',
    x: 1.0,
    y: 2.0,
    visible: true,
    labelVisible: true,
    color: '#3B82F6',
  };

  const mockLine: LineAnnotation = {
    id: 'line-1',
    name: 'Stop Line',
    type: 'line',
    x1: 0,
    y1: 0,
    x2: 5,
    y2: 5,
    visible: true,
    labelVisible: false,
    color: '#EF4444',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      annotationObjects: {},
      annotationOrder: [],
      selectedAnnotationIds: [],
      isAnnotationEditMode: false,
      showAnnotations: true,
      showAnnotationLabels: true,
      selectAnnotationObjects: mockSelectAnnotationObjects,
      toggleAnnotationVisibility: mockToggleAnnotationVisibility,
      toggleAnnotationLabelVisibility: mockToggleAnnotationLabelVisibility,
      removeAnnotationObjects: mockRemoveAnnotationObjects,
      setAnnotationEditMode: mockSetAnnotationEditMode,
      setRightPanelActiveTab: mockSetRightPanelActiveTab,
      setRightPanelOpen: mockSetRightPanelOpen,
    });
  });

  it('renders empty state when there are no annotations', () => {
    render(<AnnotationTree />);
    expect(screen.getByText(/アノテーションがありません/)).toBeInTheDocument();
  });

  it('renders list of annotations and handles selection', () => {
    useAppStore.setState({
      annotationObjects: {
        'point-1': mockPoint,
        'line-1': mockLine,
      },
      annotationOrder: ['point-1', 'line-1'],
    });

    render(<AnnotationTree />);
    expect(screen.getByText('Start Point')).toBeInTheDocument();
    expect(screen.getByText('Stop Line')).toBeInTheDocument();
    expect(screen.getByText('Point')).toBeInTheDocument();
    expect(screen.getByText('Line')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Start Point'));
    expect(mockSelectAnnotationObjects).toHaveBeenCalledWith(['point-1'], false);
    expect(mockSetRightPanelActiveTab).toHaveBeenCalledWith('inspector');
  });

  it('clicking Add button triggers setAnnotationEditMode', () => {
    render(<AnnotationTree />);
    const addButton = screen.getByTitle('アノテーション配置モードを開始');
    fireEvent.click(addButton);
    expect(mockSetAnnotationEditMode).toHaveBeenCalledWith(true);
  });
});
