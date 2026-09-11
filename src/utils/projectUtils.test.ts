import { describe, it, expect } from 'vitest';
import { extractProjectName, formatWindowTitle } from './projectUtils';

describe('projectUtils', () => {
  describe('extractProjectName', () => {
    it('returns fallback for null or undefined path', () => {
      expect(extractProjectName(null)).toBe('Untitled');
      expect(extractProjectName(undefined)).toBe('Untitled');
      expect(extractProjectName('', 'CustomFallback')).toBe('CustomFallback');
      expect(extractProjectName('   ')).toBe('Untitled');
    });

    it('extracts project name without .wptroj extension for unix path', () => {
      expect(extractProjectName('/home/user/projects/sample_project.wptroj')).toBe('sample_project');
      expect(extractProjectName('/my_route.wptroj')).toBe('my_route');
    });

    it('extracts project name without .wptroj extension for windows path', () => {
      expect(extractProjectName('C:\\Users\\user\\projects\\robot_path.wptroj')).toBe('robot_path');
      expect(extractProjectName('D:/nested\\mixed/path\\test_project.wptroj')).toBe('test_project');
    });

    it('handles case-insensitive .WPTROJ extension', () => {
      expect(extractProjectName('/projects/UPPERCASE.WPTROJ')).toBe('UPPERCASE');
      expect(extractProjectName('/projects/MixedCase.WpTrOj')).toBe('MixedCase');
    });

    it('returns full filename if extension is not .wptroj', () => {
      expect(extractProjectName('/path/to/custom_file.json')).toBe('custom_file.json');
      expect(extractProjectName('simple_name')).toBe('simple_name');
    });
  });

  describe('formatWindowTitle', () => {
    it('formats title without dirty indicator when not dirty', () => {
      expect(formatWindowTitle('sample_project', false, 'Waypoint Tool')).toBe('sample_project - Waypoint Tool');
    });

    it('formats title with dirty indicator when dirty', () => {
      expect(formatWindowTitle('sample_project', true, 'Waypoint Tool')).toBe('sample_project * - Waypoint Tool');
    });

    it('works with custom brand names', () => {
      expect(formatWindowTitle('route_1', false, 'Custom AGV Navigator')).toBe('route_1 - Custom AGV Navigator');
      expect(formatWindowTitle('route_1', true, 'Custom AGV Navigator')).toBe('route_1 * - Custom AGV Navigator');
    });
  });
});
