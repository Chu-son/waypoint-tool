/**
 * Whether applying `updates` to `target` (as `{ ...target, ...updates }`) would change anything, comparing
 * each field by identity. Actions use it to skip no-op updates, so that they leave no undo step.
 */
export function changesAny<T extends object>(target: T, updates: Partial<T>): boolean {
  return (Object.keys(updates) as (keyof T)[]).some((key) => !Object.is(target[key], updates[key]));
}
