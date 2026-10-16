import { screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AnnotationTree } from './AnnotationTree';
import { renderWithStore } from '../../../test/render';
import { getAppState } from '../../../test/store';
import { makeAnnotationGroup, makeLineAnnotation, makePointAnnotation } from '../../../test/fixtures';
import type { AnnotationGroup, AnnotationObject } from '../../../types/store';
import type { AppState } from '../../../stores/appStore';

const annotations = (
  objects: AnnotationObject[],
  groups: AnnotationGroup[] = [],
  rootIds: string[] = objects.map((o) => o.id),
): Partial<AppState> => ({
  annotationObjects: Object.fromEntries(objects.map((o) => [o.id, o])),
  annotationGroups: Object.fromEntries(groups.map((g) => [g.id, g])),
  rootAnnotationIds: rootIds,
});

const twoItems = () =>
  annotations([
    makePointAnnotation('point-1', { name: 'Start Point' }),
    makeLineAnnotation('line-1', { name: 'Stop Line', labelVisible: false }),
  ]);

describe('AnnotationTree', () => {
  it('renders the empty state when there are no annotations', () => {
    renderWithStore(<AnnotationTree />);
    expect(screen.getByText(/アノテーションがありません/)).toBeInTheDocument();
  });

  it('lists the annotations, and selecting one opens the inspector', () => {
    renderWithStore(<AnnotationTree />, twoItems());

    expect(screen.getByText('Point')).toBeInTheDocument();
    expect(screen.getByText('Line')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Start Point'));

    expect(getAppState().selectedAnnotationIds).toEqual(['point-1']);
    expect(getAppState().rightPanelActiveTab).toBe('inspector');
    expect(getAppState().isRightPanelOpen).toBe(true);
  });

  it('Ctrl+click adds to the selection and Shift+click selects the range', () => {
    renderWithStore(
      <AnnotationTree />,
      annotations([makePointAnnotation('a'), makePointAnnotation('b'), makePointAnnotation('c')]),
    );

    fireEvent.click(screen.getByText('a'));
    fireEvent.click(screen.getByText('c'), { ctrlKey: true });
    expect(getAppState().selectedAnnotationIds).toEqual(['a', 'c']);

    fireEvent.click(screen.getByText('a'));
    fireEvent.click(screen.getByText('c'), { shiftKey: true });
    expect(getAppState().selectedAnnotationIds).toEqual(['a', 'b', 'c']);
  });

  it('starts placing annotations with the Add button', () => {
    renderWithStore(<AnnotationTree />);

    fireEvent.click(screen.getByTitle('アノテーション配置モードを開始'));

    expect(getAppState().isAnnotationEditMode).toBe(true);
  });

  it('groups the selected annotations from the context menu', () => {
    renderWithStore(<AnnotationTree />, { ...twoItems(), selectedAnnotationIds: ['point-1', 'line-1'] });

    fireEvent.contextMenu(screen.getByText('Start Point'));
    fireEvent.click(screen.getByText(/選択項目をグループ化 \(2\)/));

    const { rootAnnotationIds, annotationGroups } = getAppState();
    expect(rootAnnotationIds).toHaveLength(1);
    expect(annotationGroups[rootAnnotationIds[0]].children_ids).toEqual(['point-1', 'line-1']);
  });

  it('renames by double-click', () => {
    renderWithStore(<AnnotationTree />, twoItems());

    fireEvent.doubleClick(screen.getByText('Start Point'));
    const input = screen.getByDisplayValue('Start Point');
    fireEvent.change(input, { target: { value: 'Goal' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(getAppState().annotationObjects['point-1'].name).toBe('Goal');
  });

  it('moves the selection among its siblings with Alt+↓', () => {
    renderWithStore(<AnnotationTree />, { ...twoItems(), selectedAnnotationIds: ['point-1'] });

    fireEvent.keyDown(screen.getByRole('tree'), { key: 'ArrowDown', altKey: true });

    expect(getAppState().rootAnnotationIds).toEqual(['line-1', 'point-1']);
  });

  it('deletes an annotation with the row button', () => {
    renderWithStore(<AnnotationTree />, twoItems());

    fireEvent.click(screen.getByRole('button', { name: 'Start Point を削除' }));

    expect(getAppState().annotationObjects['point-1']).toBeUndefined();
  });

  describe('with a group', () => {
    const grouped = () =>
      annotations(
        [
          makePointAnnotation('child-pt', { name: 'Child Annotation', group_id: 'grp-roi' }),
          makePointAnnotation('hidden-pt', { name: 'Hidden One', group_id: 'grp-roi', visible: false }),
        ],
        [makeAnnotationGroup('grp-roi', ['child-pt', 'hidden-pt'], { name: 'ROI Group' })],
        ['grp-roi'],
      );
    const rowOf = (name: string) => screen.getByRole('treeitem', { name });

    it('opens the group above a selected annotation and marks it when collapsed', () => {
      renderWithStore(<AnnotationTree />, { ...grouped(), selectedAnnotationIds: ['child-pt'] });

      expect(screen.getByText('Child Annotation')).toBeInTheDocument();
      expect(within(rowOf('ROI Group')).queryByTitle('選択中の項目を含んでいます')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'ROI Group を折りたたむ' }));

      expect(screen.queryByText('Child Annotation')).not.toBeInTheDocument();
      expect(within(rowOf('ROI Group')).getByTitle('選択中の項目を含んでいます')).toBeInTheDocument();
    });

    it('hiding the group keeps the visibility of what it holds, and showing it brings back the same', () => {
      renderWithStore(<AnnotationTree />, { ...grouped(), selectedAnnotationIds: ['child-pt'] });

      fireEvent.click(screen.getByRole('button', { name: 'ROI Group を非表示にする' }));

      expect(getAppState().annotationGroups['grp-roi'].visible).toBe(false);
      expect(getAppState().annotationObjects['child-pt'].visible).toBe(true);
      expect(getAppState().annotationObjects['hidden-pt'].visible).toBe(false);
      expect(
        within(rowOf('Child Annotation')).getByTitle('上のグループが非表示のため表示されていません'),
      ).toBeVisible();

      fireEvent.click(screen.getByRole('button', { name: 'ROI Group を表示する' }));

      expect(getAppState().annotationObjects['child-pt'].visible).toBe(true);
      expect(getAppState().annotationObjects['hidden-pt'].visible).toBe(false);
    });
  });

  it('shows paste and paste-as-group menu on blank area right-click', () => {
    const { container } = renderWithStore(<AnnotationTree />);

    fireEvent.contextMenu(container.firstChild as HTMLElement, { clientX: 150, clientY: 250 });

    expect(screen.getByText('貼り付け (Paste)')).toBeInTheDocument();
    expect(screen.getByText('グループで貼り付け')).toBeInTheDocument();
  });
});
