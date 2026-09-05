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

  it('renders secondary and danger button variants without forcing danger style onto secondary', () => {
    const handleSecondary = vi.fn();
    const handleDanger = vi.fn();

    render(
      <FloatingActionBanner
        title="MULTI ACTIONS"
        actions={[
          { label: 'Cancel', variant: 'secondary', onClick: handleSecondary },
          { label: 'Delete', variant: 'danger', onClick: handleDanger },
        ]}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancel/ });
    const deleteBtn = screen.getByRole('button', { name: /Delete/ });

    expect(cancelBtn.className).not.toContain('bg-danger-base');
    expect(deleteBtn.className).toContain('bg-danger-base');
  });

  it('renders primary button variant with primary brand styling', () => {
    render(
      <FloatingActionBanner
        title="PRIMARY ACTION"
        actions={[
          { label: 'Save', variant: 'primary', onClick: vi.fn() },
        ]}
      />
    );

    const saveBtn = screen.getByRole('button', { name: /Save/ });
    expect(saveBtn.className).toContain('bg-primary-base');
    expect(saveBtn.className).not.toContain('bg-status-success');
  });
});
