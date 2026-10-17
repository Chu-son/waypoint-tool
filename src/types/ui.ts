/** Waypoint field that can be copied to other waypoints with Element Copy. */
export type ElementCopyField = 'x' | 'y' | 'z' | 'yaw';
export type ElementCopyCoordSystem = 'world' | 'anchor';

export type ElementCopyState = {
  field: ElementCopyField;
  value: number;
  coordSystem: ElementCopyCoordSystem;
  previewNodeId: string | null;
} | null;

export type AnnotationToolType = 'select' | 'point' | 'oriented_point' | 'line' | 'rect' | 'circle';

/**
 * The pre-dock layout (settings file `panelLayout`): tab ids per side panel. Kept only so the settings migration
 * can read it; the app itself uses `DockLayout`.
 */
export interface LegacyPanelLayout {
  leftTabs: string[];
  rightTabs: string[];
}

export type DockSide = 'left' | 'right';
/** 0 = the group nearest the canvas, 1 = the group nearest the screen edge (and its rail). */
export type DockGroupIndex = 0 | 1;

/** One column of a side panel: the tabs it holds, the one shown, and whether the column is shown at all. */
export interface DockGroup {
  tabs: string[];
  activeTab: string | null;
  visible: boolean;
  width: number;
}

/** A side panel: up to two columns (groups) shown next to each other. */
export interface DockSideLayout {
  groups: [DockGroup, DockGroup];
}

/** Which dockable panel tabs live in which column of the left and right side panels. */
export interface DockLayout {
  left: DockSideLayout;
  right: DockSideLayout;
}

/** A layout together with whether each side panel is open (the open flags are not persisted). */
export interface DockState {
  layout: DockLayout;
  open: Record<DockSide, boolean>;
}
