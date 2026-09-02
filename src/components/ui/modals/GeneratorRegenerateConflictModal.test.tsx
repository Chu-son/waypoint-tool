import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GeneratorRegenerateConflictModal } from './GeneratorRegenerateConflictModal';
import { GeneratorModificationSummary } from '../../../types/store';

describe('GeneratorRegenerateConflictModal', () => {
  const dummySummary: GeneratorModificationSummary = {
    hasModifications: true,
    modifiedCount: 2,
    totalCurrent: 3,
    totalBaseline: 3,
    hasCountChanged: false,
    diffs: [
      {
        index: 0,
        hasTransformDiff: true,
        deltaX: 0.123,
        deltaY: -0.456,
        deltaZ: 0,
        deltaYaw: 0.5,
      },
      {
        index: 1,
        hasTransformDiff: false,
        deltaX: 0,
        deltaY: 0,
        deltaZ: 0,
        deltaYaw: 0,
        customName: 'RenamedPoint',
        modifiedOptions: { speed: 2.0 },
      },
    ],
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <GeneratorRegenerateConflictModal
        isOpen={false}
        onClose={vi.fn()}
        summary={dummySummary}
        onDiscardAndRegenerate={vi.fn()}
        onStashAndRegenerate={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modification details when open', () => {
    render(
      <GeneratorRegenerateConflictModal
        isOpen={true}
        onClose={vi.fn()}
        summary={dummySummary}
        generatorName="Path Gen Test"
        onDiscardAndRegenerate={vi.fn()}
        onStashAndRegenerate={vi.fn()}
      />
    );

    expect(screen.getByText('手動変更の検知 - 再生成の確認')).toBeInTheDocument();
    expect(screen.getByText('2 箇所')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText(/名前: RenamedPoint/)).toBeInTheDocument();
  });

  it('fires callbacks on button clicks', () => {
    const onClose = vi.fn();
    const onDiscard = vi.fn();
    const onStash = vi.fn();

    render(
      <GeneratorRegenerateConflictModal
        isOpen={true}
        onClose={onClose}
        summary={dummySummary}
        onDiscardAndRegenerate={onDiscard}
        onStashAndRegenerate={onStash}
      />
    );

    // Click Cancel
    fireEvent.click(screen.getByText('再生成を中断 (キャンセル)'));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Click Discard
    fireEvent.click(screen.getByText('編集を破棄して再生成'));
    expect(onDiscard).toHaveBeenCalledTimes(1);

    // Click Stash
    fireEvent.click(screen.getByText('スタッシュして適用'));
    expect(onStash).toHaveBeenCalledTimes(1);
  });
});
