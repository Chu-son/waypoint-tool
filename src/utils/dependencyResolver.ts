import { PluginInstance } from '../types/store';
import { PluginDependencyDef } from '../types/pipeline';

export type DependencyIssueType = 'missing' | 'version_mismatch' | 'circular';

export interface PluginDependencyIssue {
  type: DependencyIssueType;
  pluginId: string;
  dependencyId: string;
  requiredVersion: string;
  installedVersion?: string;
  message: string;
  cycle?: string[];
}

export interface DependencyReport {
  pluginId: string;
  isValid: boolean;
  satisfied: Array<{
    id: string;
    requiredVersion: string;
    installedVersion: string;
  }>;
  missing: Array<{
    id: string;
    requiredVersion: string;
  }>;
  mismatches: Array<{
    id: string;
    requiredVersion: string;
    installedVersion: string;
  }>;
  circular: Array<{
    cycle: string[];
    message: string;
  }>;
  issues: PluginDependencyIssue[];
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Normalizes and parses a semver string (e.g. "v1.2" -> { major: 1, minor: 2, patch: 0 }).
 */
export function parseSemVer(v: string): ParsedVersion | null {
  if (!v) return null;
  const clean = v.trim().replace(/^[vV]/, '');
  const core = clean.split('-')[0].split('+')[0];
  const parts = core.split('.').map((p) => parseInt(p, 10));

  if (parts.some((p) => isNaN(p))) return null;

  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0,
  };
}

/**
 * Compares two parsed semver versions.
 * Returns > 0 if a > b, < 0 if a < b, 0 if equal.
 */
export function compareSemVer(a: ParsedVersion, b: ParsedVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * Evaluates whether an installed candidate version satisfies a requirement string.
 * Supports: *, exact, >, >=, <, <=, ^, ~, and comma-separated clauses (e.g. ">=1.0.0, <2.0.0").
 */
export function matchesSemVer(candidate: string, requirement: string): boolean {
  const req = requirement.trim();
  if (!req || req === '*' || req.toLowerCase() === 'latest') {
    return true;
  }

  const candVer = parseSemVer(candidate);
  if (!candVer) {
    return candidate.trim() === req;
  }

  // Normalize spaces between operators and version numbers (e.g. ">= 1.0.0" -> ">=1.0.0")
  const normalizedReq = req.replace(/([><=!~^]+)\s+/g, '$1');

  // Split comma or whitespace separated clauses: e.g. ">=1.0.0, <2.0.0" or ">=1.0.0 <2.0.0"
  const clauses = normalizedReq
    .split(/[\s,]+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  for (const clause of clauses) {
    const match = clause.match(/^([><=!~^]+)?\s*(.+)$/);
    if (!match) continue;

    const op = match[1] || '=';
    const targetStr = match[2];
    const targetVer = parseSemVer(targetStr);
    if (!targetVer) {
      if (candidate.trim() !== targetStr.trim()) return false;
      continue;
    }

    const cmp = compareSemVer(candVer, targetVer);

    switch (op) {
      case '>':
        if (cmp <= 0) return false;
        break;
      case '>=':
        if (cmp < 0) return false;
        break;
      case '<':
        if (cmp >= 0) return false;
        break;
      case '<=':
        if (cmp > 0) return false;
        break;
      case '!=':
        if (cmp === 0) return false;
        break;
      case '=':
      case '==':
        if (cmp !== 0) return false;
        break;
      case '^': {
        // Caret allows changes that do not modify the left-most non-zero digit
        if (cmp < 0) return false;
        if (targetVer.major > 0) {
          if (candVer.major !== targetVer.major) return false;
        } else if (targetVer.minor > 0) {
          if (candVer.major !== 0 || candVer.minor !== targetVer.minor) return false;
        } else {
          if (candVer.major !== 0 || candVer.minor !== 0 || candVer.patch !== targetVer.patch) return false;
        }
        break;
      }
      case '~': {
        // Tilde allows patch-level changes if minor is specified (e.g. ~1.2.0),
        // or minor-level changes if only major is specified (e.g. ~1)
        if (cmp < 0) return false;
        if (candVer.major !== targetVer.major) return false;
        const parts = targetStr.trim().replace(/^[vV]/, '').split('.');
        if (parts.length > 1 && candVer.minor !== targetVer.minor) {
          return false;
        }
        break;
      }
      default:
        if (cmp !== 0) return false;
    }
  }

  return true;
}

/**
 * Finds dependency cycles in the plugin dependency graph using Depth-First Search.
 */
function findCycles(startId: string, allPlugins: Record<string, PluginInstance>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(currId: string) {
    visited.add(currId);
    inStack.add(currId);
    path.push(currId);

    const currPlugin = allPlugins[currId];
    if (currPlugin) {
      const depIds: string[] = [];
      for (const d of currPlugin.manifest?.plugin_dependencies || []) {
        if (!depIds.includes(d.id)) depIds.push(d.id);
      }
      if (currPlugin.manifest?.pipeline?.steps) {
        for (const s of currPlugin.manifest.pipeline.steps) {
          if (!depIds.includes(s.plugin_id)) depIds.push(s.plugin_id);
        }
      }

      for (const nextId of depIds) {
        if (inStack.has(nextId)) {
          // Cycle found!
          const cycleStartIndex = path.indexOf(nextId);
          if (cycleStartIndex !== -1) {
            const cycle = path.slice(cycleStartIndex).concat(nextId);
            cycles.push(cycle);
          }
        } else if (!visited.has(nextId)) {
          dfs(nextId);
        }
      }
    }

    path.pop();
    inStack.delete(currId);
  }

  dfs(startId);
  return cycles;
}

/**
 * Resolves dependencies for a given plugin against all registered plugins.
 * Checks for satisfied dependencies, missing plugins, version mismatches, and circular dependencies.
 */
export function resolvePluginDependencies(
  plugin: PluginInstance,
  allPlugins: Record<string, PluginInstance>
): DependencyReport {
  const report: DependencyReport = {
    pluginId: plugin.id,
    isValid: true,
    satisfied: [],
    missing: [],
    mismatches: [],
    circular: [],
    issues: [],
  };

  // Collect direct dependencies: plugin_dependencies + pipeline steps
  const directDeps: PluginDependencyDef[] = [
    ...(plugin.manifest?.plugin_dependencies || []),
  ];

  if (plugin.manifest?.pipeline?.steps) {
    for (const step of plugin.manifest.pipeline.steps) {
      if (!directDeps.some((d) => d.id === step.plugin_id)) {
        directDeps.push({
          id: step.plugin_id,
          name: step.name,
          version: '*',
        });
      }
    }
  }

  // 1. Check direct dependencies
  for (const dep of directDeps) {
    const installed = allPlugins[dep.id];
    if (!installed) {
      report.missing.push({
        id: dep.id,
        requiredVersion: dep.version,
      });
      report.issues.push({
        type: 'missing',
        pluginId: plugin.id,
        dependencyId: dep.id,
        requiredVersion: dep.version,
        message: `Plugin "${dep.id}" is required (version ${dep.version}) but not installed.`,
      });
      continue;
    }

    const installedVersion = installed.manifest?.version || '0.0.0';
    if (matchesSemVer(installedVersion, dep.version)) {
      report.satisfied.push({
        id: dep.id,
        requiredVersion: dep.version,
        installedVersion,
      });
    } else {
      report.mismatches.push({
        id: dep.id,
        requiredVersion: dep.version,
        installedVersion,
      });
      report.issues.push({
        type: 'version_mismatch',
        pluginId: plugin.id,
        dependencyId: dep.id,
        requiredVersion: dep.version,
        installedVersion,
        message: `Plugin "${dep.id}" version ${installedVersion} does not satisfy requirement "${dep.version}".`,
      });
    }
  }

  // 2. Check for circular dependencies
  const detectedCycles = findCycles(plugin.id, allPlugins);
  for (const cycle of detectedCycles) {
    const message = `Circular dependency detected: ${cycle.join(' -> ')}`;
    report.circular.push({
      cycle,
      message,
    });
    report.issues.push({
      type: 'circular',
      pluginId: plugin.id,
      dependencyId: cycle[0] === plugin.id ? (cycle[1] || plugin.id) : cycle[0],
      requiredVersion: '',
      cycle,
      message,
    });
  }

  report.isValid =
    report.missing.length === 0 &&
    report.mismatches.length === 0 &&
    report.circular.length === 0;

  return report;
}
