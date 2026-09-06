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
import { PipelineInspector } from './properties/PipelineInspector';
import { PipelineMetadata } from '../../types/pipeline';
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

export interface PipelineInspectorTarget {
  pipelineMetadata: PipelineMetadata;
  targetNodeId?: string;
  targetCustomLayerId?: string;
  targetAnnotationGroupId?: string;
}

export function resolveInspectorComponent(
  appMode?: AppModeState,
  selection?: ActiveSelection,
  activePlugin?: any,
  pipelineTarget?: PipelineInspectorTarget | null
): ReactElement {
  // 0. Pipeline artifact selection takes highest priority to avoid intermediate inspectors mounting and executing conflicting side effects
  if (pipelineTarget?.pipelineMetadata) {
    return (
      <PipelineInspector
        pipelineMetadata={pipelineTarget.pipelineMetadata}
        targetNodeId={pipelineTarget.targetNodeId}
        targetCustomLayerId={pipelineTarget.targetCustomLayerId}
        targetAnnotationGroupId={pipelineTarget.targetAnnotationGroupId}
      />
    );
  }

  // 1. Selection-based inspector resolution takes priority when an object is actively selected
  if (selection?.type === 'custom_layer') {
    return <CustomLayerInspector />;
  }

  if (selection?.type === 'annotations') {
    return <AnnotationInspector />;
  }

  if (selection?.type === 'nodes') {
    return <PropertiesPanel />;
  }

  // 2. Primary mode specific inspector requirements (matching docs/STATE_MACHINE.md §4.2)
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

  // 3. Default to properties panel (selected waypoint nodes or project settings)
  return <PropertiesPanel />;
}

export function useInspectorPanelComponent() {
  const appMode = useAppStore((state) => state.appMode);
  const selection = useAppStore((state) => state.selection);
  const selectedNodeIds = useAppStore((state) => state.selectedNodeIds) || [];
  const activeTool = useAppStore((state) => state.activeTool);
  const activeCustomLayerId = useAppStore((state) => state.activeCustomLayerId);
  const activePluginId = useAppStore((state) => state.activePluginId);
  const selectedAnnotationIds = useAppStore((state) => state.selectedAnnotationIds) || [];
  const plugins = useAppStore((state) => state.plugins) || {};
  const activePlugin = activePluginId ? plugins[activePluginId] : null;
  const customLayers = useAppStore((state) => state.customLayers) || [];
  const nodes = useAppStore((state) => state.nodes) || {};
  const annotationGroups = useAppStore((state) => state.annotationGroups) || {};
  const annotationObjects = useAppStore((state) => state.annotationObjects) || {};

  let effectiveSelection: ActiveSelection = selection || { type: 'none' };
  if (effectiveSelection.type === 'none') {
    if (selectedNodeIds.length > 0) {
      effectiveSelection = { type: 'nodes', ids: selectedNodeIds };
    } else if (activeCustomLayerId) {
      effectiveSelection = {
        type: 'custom_layer',
        layerId: activeCustomLayerId,
        selectedObjectId: null,
      };
    } else if (selectedAnnotationIds.length > 0) {
      effectiveSelection = { type: 'annotations', ids: selectedAnnotationIds };
    }
  }

  // Detect pipeline-bound artifact target
  let pipelineTarget: PipelineInspectorTarget | null = null;
  if (effectiveSelection.type === 'custom_layer' && effectiveSelection.layerId) {
    const layer = customLayers.find((l) => l.id === effectiveSelection.layerId);
    if (layer?.pipeline_metadata) {
      pipelineTarget = {
        pipelineMetadata: layer.pipeline_metadata,
        targetCustomLayerId: layer.id,
      };
    }
  } else if (effectiveSelection.type === 'nodes' && effectiveSelection.ids.length === 1) {
    const node = nodes[effectiveSelection.ids[0]];
    if (node?.pipeline_metadata) {
      pipelineTarget = {
        pipelineMetadata: node.pipeline_metadata,
        targetNodeId: node.id,
      };
    }
  } else if (effectiveSelection.type === 'annotations' && effectiveSelection.ids.length === 1) {
    const obj = annotationObjects[effectiveSelection.ids[0]];
    const parentGroup = obj?.group_id ? annotationGroups[obj.group_id] : null;
    const targetGroup = annotationGroups[effectiveSelection.ids[0]];
    const metadata = targetGroup?.pipeline_metadata || obj?.pipeline_metadata || parentGroup?.pipeline_metadata;
    if (metadata) {
      pipelineTarget = {
        pipelineMetadata: metadata,
        targetAnnotationGroupId: targetGroup?.id || parentGroup?.id,
      };
    }
  }

  const effectiveMode: AppModeState =
    effectiveSelection.type === 'none' && activeTool === 'add_generator' && appMode?.mode !== 'generator_add'
      ? { mode: 'generator_add', pluginId: activePluginId || '' }
      : appMode || { mode: 'select' };

  return resolveInspectorComponent(effectiveMode, effectiveSelection, activePlugin, pipelineTarget);
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
