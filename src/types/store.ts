/**
 * Domain type barrel.
 *
 * Types live in per-domain modules; this file re-exports them so existing
 * `import { ... } from '../types/store'` statements keep working. New code may import
 * from the specific module directly.
 */
export type * from './geometry';
export type * from './options';
export type * from './waypoint';
export type * from './footprint';
export type * from './plugin';
export type * from './layer';
export type * from './annotation';
export type * from './style';
export type * from './export';
export type * from './project';
export type { PipelineRecipeDef, PipelineMetadata, PluginDependencyDef, PythonDependencyDef } from './pipeline';
