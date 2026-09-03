import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

const ProblemChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test explosive crash');
  }
  return <div>Safe Child Content</div>;
};

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Safe Child Content')).toBeInTheDocument();
  });

  it('renders fallback UI when child component throws', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallbackTitle="カスタムエラータイトル">
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('カスタムエラータイトル')).toBeInTheDocument();
    expect(screen.getByText(/Test explosive crash/)).toBeInTheDocument();
    expect(screen.getByText('再試行')).toBeInTheDocument();
    expect(screen.getByText('再読み込み')).toBeInTheDocument();
    expect(screen.getByText('設定をリセット')).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
