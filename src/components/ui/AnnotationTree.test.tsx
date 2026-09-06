import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnnotationTree } from './AnnotationTree';
import { useAppStore } from '../../stores/appStore';
import { PointAnnotation, LineAnnotation, AnnotationObject, AnnotationGroup } from '../../types/store';

describe('AnnotationTree', () => {
  const mockSelectAnnotationObjects = vi.fn();
  const mockToggleAnnotationVisibility = vi.fn();
  const mockToggleAnnotationLabelVisibility = vi.fn();
  const mockRemoveAnnotationObjects = vi.fn();
  const mockSetAnnotationEditMode = vi.fn();
  const mockSetRightPanelActiveTab = vi.fn();
  const mockSetRightPanelOpen = vi.fn();
  const mockGroupAnnotations = vi.fn().mockReturnValue('new-group-id');
  const mockUngroupAnnotation = vi.fn();

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
      annotationGroups: {},
      rootAnnotationIds: [],
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
      groupAnnotations: mockGroupAnnotations,
      ungroupAnnotation: mockUngroupAnnotation,
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
      annotationGroups: {},
      rootAnnotationIds: ['point-1', 'line-1'],
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

  it('handles grouping from context menu on selected annotations', () => {
    useAppStore.setState({
      annotationObjects: {
        'point-1': mockPoint,
        'line-1': mockLine,
      },
      annotationGroups: {},
      rootAnnotationIds: ['point-1', 'line-1'],
      selectedAnnotationIds: ['point-1', 'line-1'],
    });

    render(<AnnotationTree />);

    const item = screen.getByText('Start Point');
    fireEvent.contextMenu(item);

    const groupOption = screen.getByText('選択項目をグループ化 (2)');
    expect(groupOption).toBeInTheDocument();

    fireEvent.click(groupOption);
    expect(mockGroupAnnotations).toHaveBeenCalledWith(['point-1', 'line-1']);
  });

  it('highlights parent group and shows dot indicator when child annotation is selected', () => {
    const childPoint: AnnotationObject = {
      id: 'child-pt',
      type: 'point',
      name: 'Child Annotation',
      color: '#00ff00',
      visible: true,
      labelVisible: true,
      x: 10,
      y: 20,
      group_id: 'grp-roi',
    };
    const parentGroup: AnnotationGroup = {
      id: 'grp-roi',
      name: 'ROI Group',
      type: 'manual_group',
      visible: true,
      children_ids: ['child-pt'],
    };

    useAppStore.setState({
      annotationObjects: { 'child-pt': childPoint },
      annotationGroups: { 'grp-roi': parentGroup },
      rootAnnotationIds: ['grp-roi'],
      selectedAnnotationIds: ['child-pt'], // Child selected!
    });

    const { container } = render(<AnnotationTree />);

    const grpItem = container.querySelector('[data-tree-item-id="grp-roi"]');
    expect(grpItem).not.toBeNull();

    // Inner row of group should have parent highlight classes
    const innerRow = grpItem?.querySelector('div');
    expect(innerRow?.className).toContain('bg-primary-base/10');
    expect(innerRow?.className).toContain('border-primary-base/40');

    // Dot indicator should be visible for collapsed group
    const dot = container.querySelector('span[title="選択中の子要素を含んでいます"]');
    expect(dot).not.toBeNull();
  });
});

