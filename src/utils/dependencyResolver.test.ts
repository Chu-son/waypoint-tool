import { describe, it, expect } from 'vitest';
import {
  matchesSemVer,
  parseSemVer,
  compareSemVer,
  resolvePluginDependencies,
} from './dependencyResolver';
import { PluginInstance } from '../types/store';

describe('SemVer Matching', () => {
  it('parses valid and partial versions', () => {
    expect(parseSemVer('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseSemVer('v2.0')).toEqual({ major: 2, minor: 0, patch: 0 });
    expect(parseSemVer('3')).toEqual({ major: 3, minor: 0, patch: 0 });
    expect(parseSemVer('1.2.3-alpha.1')).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('compares versions correctly', () => {
    const v1 = { major: 1, minor: 2, patch: 0 };
    const v2 = { major: 1, minor: 3, patch: 0 };
    const v3 = { major: 2, minor: 0, patch: 0 };

    expect(compareSemVer(v1, v2)).toBeLessThan(0);
    expect(compareSemVer(v2, v1)).toBeGreaterThan(0);
    expect(compareSemVer(v1, v1)).toBe(0);
    expect(compareSemVer(v3, v2)).toBeGreaterThan(0);
  });

  it('handles wildcard and empty requirements', () => {
    expect(matchesSemVer('1.0.0', '*')).toBe(true);
    expect(matchesSemVer('0.0.1', '')).toBe(true);
    expect(matchesSemVer('2.5.1', 'latest')).toBe(true);
  });

  it('handles exact and v-prefix requirements', () => {
    expect(matchesSemVer('1.2.3', '1.2.3')).toBe(true);
    expect(matchesSemVer('v1.2.3', '1.2.3')).toBe(true);
    expect(matchesSemVer('1.2.3', 'v1.2.3')).toBe(true);
    expect(matchesSemVer('1.2.4', '1.2.3')).toBe(false);
  });

  it('handles inequality operators and ranges with and without spaces', () => {
    expect(matchesSemVer('1.5.0', '>=1.0.0, <2.0.0')).toBe(true);
    expect(matchesSemVer('1.5.0', '>= 1.0.0, < 2.0.0')).toBe(true);
    expect(matchesSemVer('1.0.0', '>= 1.0.0, < 2.0.0')).toBe(true);
    expect(matchesSemVer('2.0.0', '>= 1.0.0, < 2.0.0')).toBe(false);
    expect(matchesSemVer('0.9.9', '>= 1.0.0, < 2.0.0')).toBe(false);
    expect(matchesSemVer('1.5.0', '>1.5.0')).toBe(false);
    expect(matchesSemVer('1.5.1', '> 1.5.0')).toBe(true);
  });

  it('handles caret (^) requirements with and without spaces', () => {
    expect(matchesSemVer('1.2.3', '^1.2.0')).toBe(true);
    expect(matchesSemVer('1.2.3', '^ 1.2.0')).toBe(true);
    expect(matchesSemVer('1.9.0', '^ 1.2.0')).toBe(true);
    expect(matchesSemVer('2.0.0', '^ 1.2.0')).toBe(false);
    expect(matchesSemVer('0.2.3', '^ 0.2.0')).toBe(true);
    expect(matchesSemVer('0.3.0', '^ 0.2.0')).toBe(false);
    expect(matchesSemVer('0.0.4', '^ 0.0.4')).toBe(true);
    expect(matchesSemVer('0.0.5', '^ 0.0.4')).toBe(false);
  });

  it('handles tilde (~) requirements with and without spaces and major-only', () => {
    expect(matchesSemVer('1.2.5', '~1.2.0')).toBe(true);
    expect(matchesSemVer('1.2.5', '~ 1.2.0')).toBe(true);
    expect(matchesSemVer('1.2.0', '~ 1.2.0')).toBe(true);
    expect(matchesSemVer('1.3.0', '~ 1.2.0')).toBe(false);
    expect(matchesSemVer('1.5.0', '~1')).toBe(true);
    expect(matchesSemVer('2.0.0', '~1')).toBe(false);
  });
});

describe('resolvePluginDependencies', () => {
  const createMockPlugin = (
    id: string,
    version: string,
    deps: { id: string; version: string }[] = [],
    steps?: { step_id: string; plugin_id: string }[]
  ): PluginInstance => ({
    id,
    folder_path: `/plugins/${id}`,
    is_builtin: false,
    manifest: {
      name: `Plugin ${id}`,
      version,
      type: steps ? 'pipeline' : 'python',
      executable: 'main.py',
      inputs: [],
      properties: [],
      plugin_dependencies: deps.map((d) => ({ id: d.id, version: d.version })),
      pipeline: steps ? { steps } : undefined,
    },
  });

  it('returns valid report when all dependencies are satisfied', () => {
    const geomLib = createMockPlugin('geom_lib', '1.5.0');
    const mainPlugin = createMockPlugin('main_plugin', '1.0.0', [
      { id: 'geom_lib', version: '^1.2.0' },
    ]);

    const allPlugins = {
      geom_lib: geomLib,
      main_plugin: mainPlugin,
    };

    const report = resolvePluginDependencies(mainPlugin, allPlugins);
    expect(report.isValid).toBe(true);
    expect(report.satisfied).toHaveLength(1);
    expect(report.satisfied[0].id).toBe('geom_lib');
    expect(report.missing).toHaveLength(0);
    expect(report.mismatches).toHaveLength(0);
    expect(report.circular).toHaveLength(0);
  });

  it('detects missing dependencies', () => {
    const mainPlugin = createMockPlugin('main_plugin', '1.0.0', [
      { id: 'non_existent_lib', version: '>=1.0.0' },
    ]);

    const report = resolvePluginDependencies(mainPlugin, { main_plugin: mainPlugin });
    expect(report.isValid).toBe(false);
    expect(report.missing).toHaveLength(1);
    expect(report.missing[0].id).toBe('non_existent_lib');
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].type).toBe('missing');
  });

  it('detects version mismatches', () => {
    const oldLib = createMockPlugin('geom_lib', '0.9.0');
    const mainPlugin = createMockPlugin('main_plugin', '1.0.0', [
      { id: 'geom_lib', version: '>=1.0.0' },
    ]);

    const report = resolvePluginDependencies(mainPlugin, {
      geom_lib: oldLib,
      main_plugin: mainPlugin,
    });

    expect(report.isValid).toBe(false);
    expect(report.mismatches).toHaveLength(1);
    expect(report.mismatches[0].id).toBe('geom_lib');
    expect(report.mismatches[0].installedVersion).toBe('0.9.0');
    expect(report.issues[0].type).toBe('version_mismatch');
  });

  it('detects circular dependencies (A -> B -> A)', () => {
    const pluginA = createMockPlugin('pluginA', '1.0.0', [{ id: 'pluginB', version: '*' }]);
    const pluginB = createMockPlugin('pluginB', '1.0.0', [{ id: 'pluginA', version: '*' }]);

    const allPlugins = { pluginA, pluginB };

    const report = resolvePluginDependencies(pluginA, allPlugins);
    expect(report.isValid).toBe(false);
    expect(report.circular).toHaveLength(1);
    expect(report.circular[0].cycle).toEqual(['pluginA', 'pluginB', 'pluginA']);
    expect(report.issues.some((i) => i.type === 'circular')).toBe(true);
  });

  it('detects circular dependencies in pipelines (A -> B -> C -> A)', () => {
    const pluginA = createMockPlugin('pluginA', '1.0.0', [{ id: 'pluginB', version: '*' }]);
    const pluginB = createMockPlugin('pluginB', '1.0.0', [{ id: 'pluginC', version: '*' }]);
    const pluginC = createMockPlugin('pluginC', '1.0.0', [], [
      { step_id: 's1', plugin_id: 'pluginA' },
    ]);

    const allPlugins = { pluginA, pluginB, pluginC };

    const report = resolvePluginDependencies(pluginA, allPlugins);
    expect(report.isValid).toBe(false);
    expect(report.circular).toHaveLength(1);
    expect(report.circular[0].cycle).toEqual(['pluginA', 'pluginB', 'pluginC', 'pluginA']);
  });

  it('automatically treats pipeline step plugins as dependencies', () => {
    const stepPlugin = createMockPlugin('step_plugin', '1.0.0');
    const pipeline = createMockPlugin('my_pipeline', '1.0.0', [], [
      { step_id: 'step1', plugin_id: 'step_plugin' },
    ]);

    const report = resolvePluginDependencies(pipeline, {
      step_plugin: stepPlugin,
      my_pipeline: pipeline,
    });

    expect(report.isValid).toBe(true);
    expect(report.satisfied).toHaveLength(1);
    expect(report.satisfied[0].id).toBe('step_plugin');
  });
});
