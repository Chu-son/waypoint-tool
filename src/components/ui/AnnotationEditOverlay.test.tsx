import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnnotationEditOverlay } from './AnnotationEditOverlay';
import { useAppStore } from '../../stores/appStore';

describe('AnnotationEditOverlay', () => {
  const mockSetAnnotationEditMode = vi.fn();
  const mockSetActiveAnnotationSubTool = vi.fn();
  const mockSetDefaultAnnotationColor = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      isAnnotationEditMode: false,
      activeAnnotationSubTool: 'point',
      defaultAnnotationColor: '#3B82F6',
      selectedAnnotationIds: [],
      annotationObjects: {},
      setAnnotationEditMode: mockSetAnnotationEditMode,
      setActiveAnnotationSubTool: mockSetActiveAnnotationSubTool,
      setDefaultAnnotationColor: mockSetDefaultAnnotationColor,
    });
  });

  it('renders nothing when not in annotation edit mode', () => {
    const { container } = render(<AnnotationEditOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('renders overlay banner when in annotation edit mode', () => {
    useAppStore.setState({ isAnnotationEditMode: true });
    render(<AnnotationEditOverlay />);
    expect(screen.getByText('アノテーション配置・編集モード')).toBeInTheDocument();
    expect(screen.getByText('丸 (Point)')).toBeInTheDocument();
    expect(screen.getByText('三角 (Oriented)')).toBeInTheDocument();
    expect(screen.getByText('線分 (Line)')).toBeInTheDocument();
    expect(screen.getByText('矩形 (Rect)')).toBeInTheDocument();
    expect(screen.getByText('円形 (Circle)')).toBeInTheDocument();

    const doneButton = screen.getByTitle('配置モードを終了');
    fireEvent.click(doneButton);
    expect(mockSetAnnotationEditMode).toHaveBeenCalledWith(false);
  });

  it('filters tools when allowedAnnotationSubTools is provided', () => {
    useAppStore.setState({
      isAnnotationEditMode: true,
      allowedAnnotationSubTools: ['point', 'rect'],
    });
    render(<AnnotationEditOverlay />);
    expect(screen.getByText('丸 (Point)')).toBeInTheDocument();
    expect(screen.getByText('矩形 (Rect)')).toBeInTheDocument();
    expect(screen.getByText('選択')).toBeInTheDocument();
    expect(screen.queryByText('三角 (Oriented)')).not.toBeInTheDocument();
    expect(screen.queryByText('線分 (Line)')).not.toBeInTheDocument();
    expect(screen.queryByText('円形 (Circle)')).not.toBeInTheDocument();
  });
});
