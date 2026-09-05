import { ReactNode, ReactElement } from 'react';
import { PanelTab } from './PanelContainer';
import { CustomUiPanelTabDef } from '../../types/customUi';
import { ObjectsPanel } from './ObjectsPanel';
import { PluginListPanel } from './PluginListPanel';
import { LayerPanel } from './LayerPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { PluginParamsPanel } from './PluginParamsPanel';
import { CustomLayerInspector } from './properties/CustomLayerInspector';
import { AnnotationInspector } from './properties/AnnotationInspector';
import { WorkflowPanel } from './WorkflowPanel';
import { CustomHtmlPanel } from './CustomHtmlPanel';
import { Box, Puzzle, Layers, Settings2, ListOrdered, Globe, Code } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

import { AppModeState } from '../../types/mode';
import { ActiveSelection } from '../../types/selection';

function resolveLucideIcon(name: string | undefined, defaultIcon: ReactNode): ReactNode {
  if (!name) return defaultIcon;
  const IconComponent = (LucideIcons as any)[name];
  if (IconComponent) {
    return <IconComponent size={14} />;
  }
  return defaultIcon;
}

export function resolveInspectorComponent(
  appMode?: AppModeState,
  selection?: ActiveSelection,
  activePlugin?: any
): ReactElement {
  // 1. Primary mode specific inspector requirements (matching docs/STATE_MACHINE.md §4.2)
  if (appMode?.mode === 'generator_add' || appMode?.mode === 'plugin_interaction') {
    if (activePlugin?.manifest?.category === 'map_layer_generator') {
      return <CustomLayerInspector />;
    }
    return <PluginParamsPanel />;
  }

  if (appMode?.mode === 'custom_layer_edit') {
    return <CustomLayerInspector />;
  }

  if (appMode?.mode === 'annotation_edit') {
    return <AnnotationInspector />;
  }

  // 2. Selection-based inspector resolution
  if (selection?.type === 'custom_layer') {
    return <CustomLayerInspector />;
  }

  if (selection?.type === 'annotations') {
    return <AnnotationInspector />;
  }

  // 3. Default to properties panel (selected waypoint nodes or project settings)
  return <PropertiesPanel />;
}

export function useInspectorPanelComponent() {
  const appMode = useAppStore((state) => state.appMode);
  const selection = useAppStore((state) => state.selection);
  const activeTool = useAppStore((state) => state.activeTool);
  const activeCustomLayerId = useAppStore((state) => state.activeCustomLayerId);
  const activePluginId = useAppStore((state) => state.activePluginId);
  const selectedAnnotationIds = useAppStore((state) => state.selectedAnnotationIds) || [];
  const plugins = useAppStore((state) => state.plugins) || {};
  const activePlugin = activePluginId ? plugins[activePluginId] : null;

  const effectiveMode: AppModeState =
    activeTool === 'add_generator' && appMode?.mode !== 'generator_add'
      ? { mode: 'generator_add', pluginId: activePluginId || '' }
      : appMode || { mode: 'select' };

  let effectiveSelection: ActiveSelection = selection || { type: 'none' };
  if (effectiveSelection.type === 'none') {
    if (activeCustomLayerId) {
      effectiveSelection = {
        type: 'custom_layer',
        layerId: activeCustomLayerId,
        selectedObjectId: null,
      };
    } else if (selectedAnnotationIds.length > 0) {
      effectiveSelection = { type: 'annotations', ids: selectedAnnotationIds };
    }
  }

  return resolveInspectorComponent(effectiveMode, effectiveSelection, activePlugin);
}

export function resolvePanelTabs(
  tabsDef: CustomUiPanelTabDef[] | undefined,
  fallbackTabs: PanelTab[],
  inspectorComponent?: ReactNode
): PanelTab[] {
  if (!tabsDef || tabsDef.length === 0) {
    return fallbackTabs;
  }

  return tabsDef.map((tab) => {
    if (tab.type === 'builtin') {
      switch (tab.id) {
        case 'project':
          return {
            id: 'project',
            title: tab.title || 'Objects',
            icon: resolveLucideIcon(tab.icon, <Box size={14} />),
            component: <ObjectsPanel />,
          };
        case 'plugins':
          return {
            id: 'plugins',
            title: tab.title || 'Plugins',
            icon: resolveLucideIcon(tab.icon, <Puzzle size={14} />),
            component: <PluginListPanel />,
          };
        case 'layers':
          return {
            id: 'layers',
            title: tab.title || 'Layers',
            icon: resolveLucideIcon(tab.icon, <Layers size={14} />),
            component: <LayerPanel />,
          };
        case 'inspector':
          return {
            id: 'inspector',
            title: tab.title || 'Inspector',
            icon: resolveLucideIcon(tab.icon, <Settings2 size={14} />),
            component: inspectorComponent || <PropertiesPanel />,
          };
        default:
          return {
            id: tab.id,
            title: tab.title || tab.id,
            icon: resolveLucideIcon(tab.icon, <Box size={14} />),
            component: <div className="p-4 text-xs text-text-muted">Unknown panel: {tab.id}</div>,
          };
      }
    }

    if (tab.type === 'workflow') {
      return {
        id: tab.id || 'workflow',
        title: tab.title || 'Workflow Guide',
        icon: resolveLucideIcon(tab.icon, <ListOrdered size={14} />),
        component: <WorkflowPanel />,
      };
    }

    if (tab.type === 'html_file' || tab.type === 'html_inline') {
      return {
        id: tab.id,
        title: tab.title || 'Custom Panel',
        icon: resolveLucideIcon(tab.icon, <Code size={14} />),
        component: <CustomHtmlPanel tabDef={tab} />,
      };
    }

    if (tab.type === 'url') {
      return {
        id: tab.id,
        title: tab.title || 'Web Panel',
        icon: resolveLucideIcon(tab.icon, <Globe size={14} />),
        component: <CustomHtmlPanel tabDef={tab} />,
      };
    }

    return {
      id: tab.id,
      title: tab.title || tab.id,
      icon: resolveLucideIcon(tab.icon, <Box size={14} />),
      component: <div className="p-4 text-xs text-text-muted">Unknown panel type: {tab.type}</div>,
    };
  });
}
