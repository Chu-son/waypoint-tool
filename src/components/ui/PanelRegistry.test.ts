import { describe, it, expect } from 'vitest';
import { resolvePanelTabs } from './PanelRegistry';
import { PanelTab } from './PanelContainer';

describe('PanelRegistry', () => {
  const fallbackTabs: PanelTab[] = [
    { id: 'project', title: 'Waypoints', component: null as any },
    { id: 'plugins', title: 'Plugins', component: null as any },
  ];

  it('returns fallback tabs when tabsDef is undefined or empty', () => {
    expect(resolvePanelTabs(undefined, fallbackTabs)).toEqual(fallbackTabs);
    expect(resolvePanelTabs([], fallbackTabs)).toEqual(fallbackTabs);
  });

  it('resolves builtin tabs with custom titles', () => {
    const tabs = resolvePanelTabs(
      [
        { type: 'builtin', id: 'project', title: 'Custom Waypoints' },
        { type: 'builtin', id: 'layers', title: 'Custom Layers' },
      ],
      fallbackTabs
    );

    expect(tabs.length).toBe(2);
    expect(tabs[0].id).toBe('project');
    expect(tabs[0].title).toBe('Custom Waypoints');
    expect(tabs[1].id).toBe('layers');
    expect(tabs[1].title).toBe('Custom Layers');
  });

  it('resolves workflow tab', () => {
    const tabs = resolvePanelTabs(
      [{ type: 'workflow', id: 'workflow', title: 'Workflow Guide' }],
      fallbackTabs
    );

    expect(tabs.length).toBe(1);
    expect(tabs[0].id).toBe('workflow');
    expect(tabs[0].title).toBe('Workflow Guide');
  });

  it('resolves custom html and url tabs', () => {
    const tabs = resolvePanelTabs(
      [
        { type: 'html_file', id: 'custom_html', title: 'Custom HTML', src: './panel.html' },
        { type: 'url', id: 'custom_url', title: 'Fleet URL', url: 'http://localhost' },
      ],
      fallbackTabs
    );

    expect(tabs.length).toBe(2);
    expect(tabs[0].id).toBe('custom_html');
    expect(tabs[1].id).toBe('custom_url');
  });
});
