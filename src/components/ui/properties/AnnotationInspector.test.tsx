import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnnotationInspector } from './AnnotationInspector';
import { useAppStore } from '../../../stores/appStore';
import { PointAnnotation, RectAnnotation } from '../../../types/store';

describe('AnnotationInspector', () => {
  const mockUpdateAnnotationObject = vi.fn();
  const mockRemoveAnnotationObjects = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      selectedAnnotationIds: [],
      annotationObjects: {},
      decimalPrecision: 2,
      updateAnnotationObject: mockUpdateAnnotationObject,
      removeAnnotationObjects: mockRemoveAnnotationObjects,
    });
  });

  it('renders empty state when no annotation is selected', () => {
    render(<AnnotationInspector />);
    expect(screen.getByText(/アノテーション未選択/)).toBeInTheDocument();
  });

  it('renders inspector for selected point and allows editing', () => {
    const point: PointAnnotation = {
      id: 'pt-1',
      name: 'Ref Point',
      type: 'point',
      x: 3.5,
      y: 4.5,
      visible: true,
      labelVisible: true,
      color: '#3B82F6',
    };

    useAppStore.setState({
      selectedAnnotationIds: ['pt-1'],
      annotationObjects: { 'pt-1': point },
    });

    render(<AnnotationInspector />);
    expect(screen.getByDisplayValue('Ref Point')).toBeInTheDocument();
    expect(screen.getByText('point')).toBeInTheDocument();

    const deleteBtn = screen.getByTitle('アノテーションを削除');
    fireEvent.click(deleteBtn);
    expect(mockRemoveAnnotationObjects).toHaveBeenCalledWith(['pt-1']);
  });

  it('renders geometry fields for rect annotation', () => {
    const rect: RectAnnotation = {
      id: 'rect-1',
      name: 'Zone A',
      type: 'rect',
      cx: 1.0,
      cy: 2.0,
      width: 4.0,
      height: 6.0,
      angle: 0,
      visible: true,
      labelVisible: true,
      color: '#8B5CF6',
    };

    useAppStore.setState({
      selectedAnnotationIds: ['rect-1'],
      annotationObjects: { 'rect-1': rect },
    });

    render(<AnnotationInspector />);
    expect(screen.getByText('Center X (m)')).toBeInTheDocument();
    expect(screen.getByText('Center Y (m)')).toBeInTheDocument();
    expect(screen.getByText('Width (m)')).toBeInTheDocument();
    expect(screen.getByText('Height (m)')).toBeInTheDocument();
  });
});
