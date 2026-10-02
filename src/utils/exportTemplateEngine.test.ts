import { describe, it, expect } from 'vitest';
import {
  normalizeRelativePath,
  resolveExportPattern,
  resolveExportFiles,
  buildExportTreePreview,
  findDuplicateOutputPaths,
  resolveMapListFiles,
  type ResolvedExportFile,
} from './exportTemplateEngine';
import { ExportTargetItem } from '../types/store';

describe('exportTemplateEngine', () => {
  describe('normalizeRelativePath', () => {
    it('removes leading slashes and backslashes', () => {
      expect(normalizeRelativePath('/waypoints/test.yaml')).toBe('waypoints/test.yaml');
      expect(normalizeRelativePath('\\Map\\map.pgm')).toBe('Map/map.pgm');
      expect(normalizeRelativePath('///nested/dir/')).toBe('nested/dir');
    });

    it('removes path traversal segments (..)', () => {
      expect(normalizeRelativePath('../../etc/passwd')).toBe('etc/passwd');
      expect(normalizeRelativePath('waypoints/../other/file.yaml')).toBe('waypoints/other/file.yaml');
    });

    it('sanitizes windows forbidden characters in path segments', () => {
      expect(normalizeRelativePath('folder:name/file*1?.yaml')).toBe('folder_name/file_1_.yaml');
      expect(normalizeRelativePath('bad<path>|name/test.txt')).toBe('bad_path__name/test.txt');
    });
  });

  describe('resolveExportPattern', () => {
    const mockDate = new Date(2026, 8, 12, 11, 5, 30); // 2026-09-12 11:05:30

    it('expands date and time variables correctly with distinct MM (month) and mm (minute)', () => {
      const pattern = '{{YYYY}}_{{MM}}_{{dd}}_{{HH}}_{{mm}}_{{ss}}_file.yaml';
      const resolved = resolveExportPattern(pattern, { now: mockDate, projectName: 'MyProj' });
      expect(resolved).toBe('2026_09_12_11_05_30_file.yaml');
    });

    it('distinguishes uppercase MM (month) and lowercase mm (minute)', () => {
      // Month is 09, minute is 05
      const pattern = 'M{{MM}}_m{{mm}}.yaml';
      const resolved = resolveExportPattern(pattern, { now: mockDate });
      expect(resolved).toBe('M09_m05.yaml');
    });

    it('expands compound date-time variables like YYYYMMDD_HHmmss', () => {
      const pattern = 'backup_{{YYYYMMDD_HHmmss}}.yaml';
      const resolved = resolveExportPattern(pattern, { now: mockDate });
      expect(resolved).toBe('backup_20260912_110530.yaml');
    });

    it('expands alias variables like {{month}}, {{minute}}, {{hour}}, {{second}}', () => {
      const pattern = '{{year}}-{{month}}-{{day}}_{{hour}}-{{minute}}-{{second}}.yaml';
      const resolved = resolveExportPattern(pattern, { now: mockDate });
      expect(resolved).toBe('2026-09-12_11-05-30.yaml');
    });

    it('expands project_name and name variables', () => {
      const pattern = '{{project_name}}/{{name}}.yaml';
      const resolved = resolveExportPattern(pattern, {
        now: mockDate,
        projectName: 'Robot Project',
        name: 'Warehouse 1F',
      });
      expect(resolved).toBe('Robot Project/Warehouse 1F.yaml');
    });

    it('sanitizes forbidden characters in variables', () => {
      const pattern = '{{project_name}}/{{name}}.yaml';
      const resolved = resolveExportPattern(pattern, {
        now: mockDate,
        projectName: 'Robot:Special/Project*',
        name: 'Floor?1|Area',
      });
      expect(resolved).toBe('Robot_Special_Project_/Floor_1_Area.yaml');
    });
  });

  describe('resolveExportFiles & buildExportTreePreview', () => {
    const mockDate = new Date(2026, 8, 12, 10, 0, 0);

    const items: ExportTargetItem[] = [
      {
        id: 'item-wp',
        type: 'waypoint_default',
        sourceId: '__default_yaml__',
        relativePathPattern: 'waypoints/{{yyyymmdd}}_wp',
        includeMapImage: true,
        enabled: true,
      },
      {
        id: 'item-map',
        type: 'map_all_regions',
        sourceId: 'all',
        relativePathPattern: 'maps/{{name}}.pgm',
        mapFormat: 'ros_standard',
        enabled: true,
      },
    ];

    const context = {
      now: mockDate,
      projectName: 'TestBot',
      rootDir: '/home/user/export',
      availableRegions: [
        { id: 'reg-1', name: 'kitchen' },
        { id: 'reg-2', name: 'living_room' },
      ],
      templates: [],
      defaultFormats: [{ id: '__default_yaml__', name: 'Standard YAML', extension: 'yaml' }],
    };

    it('resolves all files with PGM+YAML pairs and PNG image attachment', () => {
      const files = resolveExportFiles(items, context);

      // Expected files:
      // 1. waypoints/20260912_wp.yaml
      // 2. waypoints/20260912_wp.png (image)
      // 3. maps/kitchen.pgm
      // 4. maps/kitchen.yaml
      // 5. maps/living_room.pgm
      // 6. maps/living_room.yaml
      expect(files.length).toBe(6);

      const relPaths = files.map((f) => f.relativePath);
      expect(relPaths).toContain('waypoints/20260912_wp.yaml');
      expect(relPaths).toContain('waypoints/20260912_wp.png');
      expect(relPaths).toContain('maps/kitchen.pgm');
      expect(relPaths).toContain('maps/kitchen.yaml');
      expect(relPaths).toContain('maps/living_room.pgm');
      expect(relPaths).toContain('maps/living_room.yaml');
    });

    it('builds a virtual directory tree hierarchy correctly', () => {
      const files = resolveExportFiles(items, context);
      const tree = buildExportTreePreview(files);

      expect(tree.length).toBe(2); // 'waypoints' directory and 'maps' directory
      const dirNames = tree.map((n) => n.name);
      expect(dirNames).toContain('waypoints');
      expect(dirNames).toContain('maps');

      const waypointsDir = tree.find((n) => n.name === 'waypoints') as any;
      expect(waypointsDir.type).toBe('directory');
      expect(waypointsDir.children.length).toBe(2); // .yaml and .png

      const mapsDir = tree.find((n) => n.name === 'maps') as any;
      expect(mapsDir.type).toBe('directory');
      expect(mapsDir.children.length).toBe(4); // kitchen.pgm, kitchen.yaml, living_room.pgm, living_room.yaml
    });

    it('does not export maps if availableRegions is empty', () => {
      const emptyContext = {
        ...context,
        availableRegions: [],
      };
      const files = resolveExportFiles(items, emptyContext);
      // Only waypoints should be resolved (yaml and png)
      expect(files.length).toBe(2);
      expect(files.every((f) => f.item.type.startsWith('waypoint'))).toBe(true);
    });

    it('skips map_region item if specified sourceId is not found', () => {
      const customItems: ExportTargetItem[] = [
        {
          id: 'item-specific-map',
          type: 'map_region',
          sourceId: 'non-existent-region',
          relativePathPattern: 'maps/specific.pgm',
          mapFormat: 'ros_standard',
          enabled: true,
        },
      ];
      const files = resolveExportFiles(customItems, context);
      expect(files.length).toBe(0);
    });
  });

  describe('{{set}} in a map path', () => {
    const now = new Date(2026, 0, 2, 3, 4, 5);

    it('becomes the name of the layer visibility set, or "current" when no set is named', () => {
      expect(resolveExportPattern('Map/{{name}}_{{set}}.pgm', { now, name: 'north', setName: 'Nav / Full' })).toBe(
        'Map/north_Nav _ Full.pgm',
      );
      expect(resolveExportPattern('Map/{{name}}_{{SET}}.pgm', { now, name: 'north' })).toBe('Map/north_current.pgm');
    });
  });

  describe('resolveMapListFiles', () => {
    const regions = [
      { id: 'r1', name: 'north' },
      { id: 'r2', name: 'south' },
    ];
    const resolve = (items: ExportTargetItem[]) =>
      resolveMapListFiles(
        resolveExportFiles(items, {
          now: new Date(2026, 8, 12),
          projectName: 'p',
          rootDir: '/out',
          availableRegions: regions,
          templates: [],
          defaultFormats: [],
        }),
      );
    const mapItem = (id: string, overrides: Partial<ExportTargetItem> = {}): ExportTargetItem => ({
      id,
      type: 'map_all_regions',
      sourceId: 'all',
      relativePathPattern: 'Map/{{name}}.pgm',
      mapFormat: 'ros_standard',
      mapList: { fileName: 'map_list.txt', existing: 'append' },
      enabled: true,
      ...overrides,
    });

    it('lists the yaml of every map written to the same folder in one file, across items', () => {
      const lists = resolve([
        mapItem('a', { relativePathPattern: 'Map/a_{{name}}.pgm' }),
        mapItem('b', { type: 'map_region', sourceId: 'r1', relativePathPattern: 'Map/b_{{name}}.pgm' }),
      ]);

      expect(lists).toHaveLength(1);
      expect(lists[0].file.fullPath).toBe('/out/Map/map_list.txt');
      expect(lists[0].entries).toEqual(['a_north.yaml', 'a_south.yaml', 'b_north.yaml']);
    });

    it('keeps lists of different folders apart', () => {
      const lists = resolve([
        mapItem('a', { relativePathPattern: 'Nav/{{name}}.pgm' }),
        mapItem('b', { relativePathPattern: 'Loc/{{name}}.pgm' }),
      ]);

      expect(lists.map((l) => [l.file.fullPath, l.entries])).toEqual([
        ['/out/Nav/map_list.txt', ['north.yaml', 'south.yaml']],
        ['/out/Loc/map_list.txt', ['north.yaml', 'south.yaml']],
      ]);
    });

    it('lists the png file name for an image-only map', () => {
      const lists = resolve([
        mapItem('a', {
          type: 'map_region',
          sourceId: 'r1',
          mapFormat: 'png_only',
          relativePathPattern: 'Map/{{name}}.png',
        }),
      ]);

      expect(lists[0].entries).toEqual(['north.png']);
    });

    it('lists the output file name, which may differ from the region name', () => {
      const lists = resolve([
        mapItem('a', { type: 'map_region', sourceId: 'r1', relativePathPattern: 'Map/nav_{{name}}.pgm' }),
      ]);

      expect(lists[0].entries).toEqual(['nav_north.yaml']);
    });

    it('lists a map once even when two items write the same file name', () => {
      const lists = resolve([mapItem('a'), mapItem('b')]);

      expect(lists[0].entries).toEqual(['north.yaml', 'south.yaml']);
    });

    it('ignores items without a list setting, disabled items and waypoint items', () => {
      const lists = resolve([
        mapItem('a', { mapList: undefined }),
        mapItem('b', { enabled: false }),
        {
          id: 'w',
          type: 'waypoint_default',
          sourceId: '__default_yaml__',
          relativePathPattern: 'wp.yaml',
          mapList: { fileName: 'map_list.txt', existing: 'append' },
          enabled: true,
        },
      ]);

      expect(lists).toEqual([]);
    });

    it('ignores case in the list name when grouping, as file names on Windows do', () => {
      const lists = resolve([
        mapItem('a', { mapList: { fileName: 'Map_List.txt', existing: 'append' } }),
        mapItem('b', { mapList: { fileName: 'map_list.txt', existing: 'append' } }),
      ]);

      expect(lists).toHaveLength(1);
    });

    it('appends only when every item sharing the list says so, and reports a disagreement', () => {
      const agree = resolve([mapItem('a'), mapItem('b')]);
      expect(agree[0]).toMatchObject({ append: true, hasConflictingModes: false });

      const replace = resolve([mapItem('a', { mapList: { fileName: 'map_list.txt', existing: 'conflict_setting' } })]);
      expect(replace[0]).toMatchObject({ append: false, hasConflictingModes: false });

      const disagree = resolve([
        mapItem('a'),
        mapItem('b', { mapList: { fileName: 'map_list.txt', existing: 'conflict_setting' } }),
      ]);
      expect(disagree[0].hasConflictingModes).toBe(true);
    });

    it('keeps the list inside the output folder when the name carries a path', () => {
      const lists = resolve([mapItem('a', { mapList: { fileName: '../../etc/list.txt', existing: 'append' } })]);

      expect(lists[0].file.fullPath).toBe('/out/Map/list.txt');
    });
  });

  describe('findDuplicateOutputPaths', () => {
    const file = (fullPath: string): ResolvedExportFile => ({
      item: { id: fullPath, type: 'map_region', sourceId: 'r', relativePathPattern: '', enabled: true },
      relativePath: fullPath,
      fullPath,
      fileName: fullPath,
      sourceLabel: '',
    });

    it('lists every path that more than one file would be written to, once', () => {
      expect(
        findDuplicateOutputPaths([file('/o/a.pgm'), file('/o/b.pgm'), file('/o/a.pgm'), file('/o/a.pgm')]),
      ).toEqual(['/o/a.pgm']);
    });

    it('treats paths that differ only by case as the same file', () => {
      expect(findDuplicateOutputPaths([file('/o/Map.pgm'), file('/o/map.pgm')])).toEqual(['/o/Map.pgm']);
    });

    it('reports nothing when every file has its own path', () => {
      expect(findDuplicateOutputPaths([file('/o/a.pgm'), file('/o/b.pgm')])).toEqual([]);
    });
  });
});
