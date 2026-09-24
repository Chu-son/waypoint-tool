/**
 * Canvas styling and theme constants aligned with the Linear Design System.
 */

// Linear Accent Indigo (#5e6ad2) for selections, active marquee, handles, and snapping guides
export const CANVAS_ACCENT_COLOR = 0x5e6ad2;
export const CANVAS_ACCENT_COLOR_HEX = '#5e6ad2';
export const CANVAS_ACCENT_HOVER_COLOR = 0x6f7be8;
export const CANVAS_ACCENT_HOVER_COLOR_HEX = '#6f7be8';

// Linear charcoal surface (#090a0c) for canvas background
export const CANVAS_SURFACE_BASE = 0x090a0c;
export const CANVAS_SURFACE_BASE_HEX = '#090a0c';

// Linear neutral border and preview lines
export const CANVAS_PREVIEW_COLOR = 0x8a8f98;

// ---------------------------------------------------------------------------
// Element colors. Canvas layers must use these instead of hex literals
// (docs/DESIGN_SYSTEM.md "PixiJS キャンバスデザイン定数").
// ---------------------------------------------------------------------------

/** Near-transparent fill/stroke drawn only to enlarge a pointer hit area. Use with alpha ≈ 0.001. */
export const CANVAS_HIT_AREA_COLOR = 0xffffff;
/** High-contrast white for handle fills, center dots and inner rings. */
export const CANVAS_CONTRAST_COLOR = 0xffffff;
/** Dark background behind on-canvas text labels. */
export const CANVAS_LABEL_BG = 0x0f172a;
export const CANVAS_LABEL_BG_ALT = 0x1e293b;
/** Elements placed after the insertion point (dimmed), and default footprints. */
export const CANVAS_MUTED_COLOR = 0x94a3b8;
export const CANVAS_MUTED_FILL = 0xcbd5e1;

/** World axes drawn by the grid at the origin. */
export const CANVAS_AXIS_X_COLOR = 0xef4444;
export const CANVAS_AXIS_Y_COLOR = 0x22c55e;

export const CANVAS_EXPORT_REGION_COLOR = 0x10b981;
export const CANVAS_MEASURE_COLOR = 0x10b981;
/** Origin marker of the geographic base map while it is being aligned. */
export const CANVAS_GEO_ANCHOR_COLOR = 0xf59e0b;
export const CANVAS_MEASURE_LIGHT_COLOR = 0x34d399;
/** Selection / hover outline of annotations. */
export const CANVAS_ANNOTATION_HIGHLIGHT_COLOR = 0x60a5fa;
/** Footprint of the selected waypoint. */
export const CANVAS_FOOTPRINT_SELECTED_COLOR = 0x38bdf8;

/** Plugin interaction inputs (points, rectangles) being edited on the canvas. */
export const CANVAS_PLUGIN_INPUT_COLOR = 0xec4899;
export const CANVAS_PLUGIN_INPUT_LIGHT_COLOR = 0xf472b6;
/** Interaction hints a plugin draws (e.g. sweep start corner). */
export const CANVAS_PLUGIN_HINT_COLOR = 0xf97316;

/** Waypoint marker stroke / fill by state. */
export const WAYPOINT_COLORS = {
  manual: { stroke: 0xffa500, fill: 0xffd700 },
  generated: { stroke: 0x22c55e, fill: 0x4ade80 },
  locked: { stroke: 0x10b981, fill: 0x34d399 },
  referenced: { stroke: 0xfacc15, fill: 0xfef08a },
  afterInsertion: { stroke: CANVAS_MUTED_COLOR, fill: CANVAS_MUTED_FILL },
} as const;
