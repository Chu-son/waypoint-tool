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

/** Which dockable panel tabs live in the left and right side panels. */
export interface PanelLayout {
  leftTabs: string[];
  rightTabs: string[];
}
