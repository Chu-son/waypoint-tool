import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FloatingActionBanner } from './FloatingActionBanner';
import { Copy, Check } from 'lucide-react';

describe('FloatingActionBanner', () => {
  it('renders title, subtitle, value, statusText and actions', () => {
    const handleAction = vi.fn();

    render(
      <FloatingActionBanner
        icon={<Copy data-testid="banner-icon" />}
        title="TEST MODE"
        subtitle="World"
        valueDisplay={12.3456}
        statusText={<span>Target Active</span>}
        actions={[
          {
            label: 'Apply',
            icon: <Check />,
            variant: 'primary',
            onClick: handleAction,
          },
        ]}
      />
    );

    expect(screen.getByText('TEST MODE')).toBeInTheDocument();
    expect(screen.getByText('(World)')).toBeInTheDocument();
    expect(screen.getByText('値: 12.3456')).toBeInTheDocument();
    expect(screen.getByText('Target Active')).toBeInTheDocument();

    const applyBtn = screen.getByRole('button', { name: /Apply/ });
    fireEvent.click(applyBtn);
    expect(handleAction).toHaveBeenCalled();
  });
});
