export interface ColorPreset {
  hex: string;
  name: string;
}

export const ANNOTATION_COLOR_PRESETS: ColorPreset[] = [
  { hex: '#3B82F6', name: 'Blue' },
  { hex: '#10B981', name: 'Emerald' },
  { hex: '#F59E0B', name: 'Amber' },
  { hex: '#EF4444', name: 'Red' },
  { hex: '#8B5CF6', name: 'Purple' },
  { hex: '#EC4899', name: 'Pink' },
  { hex: '#FFFFFF', name: 'White' },
];

export const PATH_COLOR_PRESETS: string[] = [
  '#10b981',
  '#0ea5e9',
  '#8b5cf6',
  '#f59e0b',
  '#f43f5e',
  '#ffffff',
];

export const DEFAULT_ANNOTATION_COLOR = '#3B82F6';
export const DEFAULT_PATH_COLOR = '#10b981';
