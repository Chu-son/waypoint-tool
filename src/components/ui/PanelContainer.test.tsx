import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PanelContainer, PanelTab } from './PanelContainer';

describe('PanelContainer', () => {
  const samplePanels: PanelTab[] = [
    {
      id: 'tab1',
      title: 'Waypoints',
      component: <div data-testid="panel-content-tab1">Waypoints Content</div>,
    },
    {
      id: 'tab2',
      title: 'Plugins',
      component: <div data-testid="panel-content-tab2">Plugins Content</div>,
    },
  ];

  it('renders tab buttons and active panel content in tabs mode', () => {
    const handleTabChange = vi.fn();
    const handleViewModeChange = vi.fn();

    render(
      <PanelContainer
        panels={samplePanels}
        activeTabId="tab1"
        onTabChange={handleTabChange}
        viewMode="tabs"
        onViewModeChange={handleViewModeChange}
      />
    );

    expect(screen.getByText('Waypoints')).toBeDefined();
    expect(screen.getByText('Plugins')).toBeDefined();
    expect(screen.getByTestId('panel-content-tab1')).toBeDefined();
    expect(screen.queryByTestId('panel-content-tab2')).toBeNull();
  });

  it('calls onTabChange when a tab button is clicked', () => {
    const handleTabChange = vi.fn();
    const handleViewModeChange = vi.fn();

    render(
      <PanelContainer
        panels={samplePanels}
        activeTabId="tab1"
        onTabChange={handleTabChange}
        viewMode="tabs"
        onViewModeChange={handleViewModeChange}
      />
    );

    const pluginsTab = screen.getByText('Plugins');
    fireEvent.click(pluginsTab);
    expect(handleTabChange).toHaveBeenCalledWith('tab2');
  });

  it('allows switching view mode between tabs and split view via menu', () => {
    const handleTabChange = vi.fn();
    const handleViewModeChange = vi.fn();

    const { container } = render(
      <PanelContainer
        panels={samplePanels}
        activeTabId="tab1"
        onTabChange={handleTabChange}
        viewMode="tabs"
        onViewModeChange={handleViewModeChange}
      />
    );

    // Open menu (MoreHorizontal icon button)
    const menuButtons = container.querySelectorAll('button');
    const menuButton = Array.from(menuButtons).find(btn => !btn.textContent);
    expect(menuButton).toBeDefined();
    if (menuButton) {
      fireEvent.click(menuButton);
    }

    // Click "Split View (Vertical)"
    const splitMenuItem = screen.getByText('Split View (Vertical)');
    expect(splitMenuItem).toBeDefined();
    fireEvent.click(splitMenuItem);
    expect(handleViewModeChange).toHaveBeenCalledWith('split');
  });

  it('renders all panel components in split mode', () => {
    const handleTabChange = vi.fn();
    const handleViewModeChange = vi.fn();

    render(
      <PanelContainer
        panels={samplePanels}
        activeTabId="tab1"
        onTabChange={handleTabChange}
        viewMode="split"
        onViewModeChange={handleViewModeChange}
      />
    );

    expect(screen.getByTestId('panel-content-tab1')).toBeDefined();
    expect(screen.getByTestId('panel-content-tab2')).toBeDefined();
  });

  it('allows switching tabs via the 3-dots menu', () => {
    const handleTabChange = vi.fn();
    const handleViewModeChange = vi.fn();

    const { container } = render(
      <PanelContainer
        panels={samplePanels}
        activeTabId="tab1"
        onTabChange={handleTabChange}
        viewMode="tabs"
        onViewModeChange={handleViewModeChange}
      />
    );

    // Open menu
    const menuButtons = container.querySelectorAll('button');
    const menuButton = Array.from(menuButtons).find(btn => !btn.textContent);
    expect(menuButton).toBeDefined();
    if (menuButton) {
      fireEvent.click(menuButton);
    }

    // There should now be "Plugins" in the menu as well
    const pluginsMenuItems = screen.getAllByText('Plugins');
    // pluginsMenuItems[0] is the header tab button, pluginsMenuItems[1] is in the menu
    expect(pluginsMenuItems.length).toBe(2);
    fireEvent.click(pluginsMenuItems[1]);
    expect(handleTabChange).toHaveBeenCalledWith('tab2');
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();

    render(
      <PanelContainer
        panels={samplePanels}
        activeTabId="tab1"
        onTabChange={vi.fn()}
        viewMode="tabs"
        onViewModeChange={vi.fn()}
        onClose={handleClose}
        closeIcon={<span data-testid="close-icon">X</span>}
      />
    );

    const closeBtn = screen.getByTestId('close-icon').closest('button');
    expect(closeBtn).toBeDefined();
    if (closeBtn) {
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    }
  });
});
