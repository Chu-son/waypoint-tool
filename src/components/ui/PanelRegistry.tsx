import { ReactNode } from 'react';
import { PanelTab } from './PanelContainer';
import { CustomUiPanelTabDef } from '../../types/customUi';
import { WaypointTree } from './WaypointTree';
import { PluginListPanel } from './PluginListPanel';
import { LayerPanel } from './LayerPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { PluginParamsPanel } from './PluginParamsPanel';
import { CustomLayerInspector } from './properties/CustomLayerInspector';
import { WorkflowPanel } from './WorkflowPanel';
import { CustomHtmlPanel } from './CustomHtmlPanel';
import { Box, Puzzle, Layers, Settings2, ListOrdered, Globe, Code } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

function resolveLucideIcon(name: string | undefined, defaultIcon: ReactNode): ReactNode {
  if (!name) return defaultIcon;
  const IconComponent = (LucideIcons as any)[name];
  if (IconComponent) {
    return <IconComponent size={14} />;
  }
  return defaultIcon;
}

export function useInspectorPanelComponent() {
  const activeTool = useAppStore((state) => state.activeTool);
  const activeCustomLayerId = useAppStore((state) => state.activeCustomLayerId);
  const activePluginId = useAppStore((state) => state.activePluginId);
  const plugins = useAppStore((state) => state.plugins) || {};
  const activePlugin = activePluginId ? plugins[activePluginId] : null;

  if (
    activeCustomLayerId ||
    (activeTool === 'add_generator' && activePlugin?.manifest?.category === 'map_layer_generator')
  ) {
    return <CustomLayerInspector />;
  }

  if (activeTool === 'add_generator') {
    return <PluginParamsPanel />;
  }

  return <PropertiesPanel />;
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
            title: tab.title || 'Waypoints',
            icon: resolveLucideIcon(tab.icon, <Box size={14} />),
            component: <WaypointTree />,
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
